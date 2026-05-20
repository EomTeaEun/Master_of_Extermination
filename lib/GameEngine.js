/**
 * 박멸의 달인 - Three.js Game Engine
 * ─────────────────────────────────────
 * 3D 탑다운 방 + 바퀴벌레 5종 + 무기 4종 + 웨이브 시스템
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────
export const WEAPONS = {
  slipper: { name: '슬리퍼', emoji: '🥿', damage: 25, range: 1.8, cooldown: 800, color: 0xff6b35 },
  chopstick: { name: '젓가락', emoji: '🥢', damage: 100, range: 1.0, cooldown: 250, color: 0xd4a574 },
  frypan: { name: '후라이팬', emoji: '🍳', damage: 60, range: 2.2, cooldown: 1400, color: 0x444444 },
  spray: { name: '살충제', emoji: '💨', damage: 5, range: 1.6, cooldown: 80, continuous: true, color: 0x88ffcc },
};

export const COCKROACH_TYPES = {
  normal:    { name: '일반 바퀴', hp: 1,  speed: 2.5, reward: 50,   size: 0.29, color: 0x3d2b1f, xp: 1 },
  zigzag:    { name: '지그재그', hp: 1,  speed: 3.2, reward: 75,   size: 0.26, color: 0x5a3825, xp: 1 },
  pregnant:  { name: '임산부',   hp: 2,  speed: 1.8, reward: 100,  size: 0.36, color: 0x6b4226, xp: 2 },
  tank:      { name: '탱크형',   hp: 5,  speed: 1.4, reward: 200,  size: 0.46, color: 0x2a1a0e, xp: 3 },
  ninja:     { name: '닌자형',   hp: 1,  speed: 5.0, reward: 250,  size: 0.23, color: 0x1a1a1a, xp: 3 },
  flying:    { name: '날바퀴',   hp: 1,  speed: 4.0, reward: 250,  size: 0.26, color: 0x4a3020, xp: 2 },
  golden:    { name: '황금바퀴', hp: 3,  speed: 3.8, reward: 500,  size: 0.31, color: 0xffd700, xp: 10 },
  mutant:    { name: '변이형',   hp: 12, speed: 2.0, reward: 500,  size: 0.65, color: 0x8b0000, xp: 8 },
  giant:     { name: '거인바퀴', hp: 30, speed: 1.2, reward: 1000, size: 1.56, color: 0x1a0a00, xp: 20 },
};

const ROOM_SIZE = 14;
const WALL_H = 2.5;
const PLAYER_SPEED = 4.8;
const WAVE_INTERVAL = 18; // seconds
const GAME_DURATION = 180; // 3 minutes

// Spawn points (near furniture)
const SPAWN_ZONES = [
  { x: -5, z: -5, label: '싱크대' },
  { x: 5,  z: -5, label: '냉장고' },
  { x: -5, z: 5,  label: '화장실' },
  { x: 5,  z: 5,  label: '라면박스' },
  { x: 0,  z: -6, label: '장판 틈' },
  { x: -6, z: 0,  label: '벽 틈' },
  { x: 6,  z: 0,  label: '창문 아래' },
];

// ─────────────────────────────────────────────────────────────────
// SOUND SYSTEM (Web Audio API) — BGM + SFX
// ─────────────────────────────────────────────────────────────────
class SoundSystem {
  constructor() {
    this.ctx        = null;
    this.enabled    = true;
    this.masterGain = null;
    this.bgmGain    = null;
    this.sfxGain    = null;
    this._bgmNodes  = [];
    this._beatTimer = null;
    this._beatIdx   = 0;
    this._tension   = 0;   // 0~1: 웨이브가 올라갈수록 긴장감↑
    this._reverb    = null;
  }

  // ── Init ─────────────────────────────────────────────────────────
  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();

      // 마스터 → SFX / BGM 버스
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.28;
      this.bgmGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.masterGain);

      this._reverb = this._buildReverb(1.8);

      this._startBGM();
    } catch (e) {
      this.enabled = false;
    }
  }

  // ── 리버브 임펄스 생성 ────────────────────────────────────────────
  _buildReverb(duration) {
    const rate   = this.ctx.sampleRate;
    const len    = Math.floor(rate * duration);
    const buf    = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    const conv = this.ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  // ── BGM 메인 ─────────────────────────────────────────────────────
  _startBGM() {
    if (!this.ctx) return;

    // ── 1. 저주파 드론 (으스스한 기저음) ──
    const droneFreqs = [
      { f: 55.0,  type: 'sawtooth', vol: 0.04, lfoRate: 0.3  },   // A1
      { f: 82.4,  type: 'sine',     vol: 0.03, lfoRate: 0.17 },   // E2
      { f: 110.0, type: 'sine',     vol: 0.02, lfoRate: 0.41 },   // A2
      { f: 164.8, type: 'sine',     vol: 0.02, lfoRate: 0.23 },   // E3
    ];
    droneFreqs.forEach(({ f, type, vol, lfoRate }) => {
      const osc  = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator(); // slight detune for thickness
      const g    = this.ctx.createGain();
      const lp   = this.ctx.createBiquadFilter();

      osc.type  = type;
      osc2.type = 'sine';
      osc.frequency.value  = f;
      osc2.frequency.value = f * 1.006; // 6 cents detuned

      lp.type            = 'lowpass';
      lp.frequency.value = 600 + f * 2;
      lp.Q.value         = 1.2;

      // tremolo LFO
      const lfo    = this.ctx.createOscillator();
      const lfoG   = this.ctx.createGain();
      lfo.frequency.value = lfoRate;
      lfoG.gain.value     = vol * 0.35;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);

      g.gain.value = vol;
      osc.connect(lp); osc2.connect(lp);
      lp.connect(g);
      g.connect(this._reverb);
      g.connect(this.bgmGain);
      this._reverb.connect(this.bgmGain);

      osc.start(); osc2.start(); lfo.start();
      this._bgmNodes.push(osc, osc2, lfo);
    });

    // ── 2. 고주파 긴장 사인파 (불안한 화음) ──
    const tensionNotes = [220, 233.1, 246.9]; // A3, Bb3, B3 — 반음 클러스터
    tensionNotes.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      const hp  = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = f * 2;
      hp.Q.value = 3;
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.value = 0.03;
      osc.connect(hp); hp.connect(g); g.connect(this.bgmGain);
      osc.start();
      this._bgmNodes.push(osc);
      // slow swell
      g.gain.setValueAtTime(0, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.035, this.ctx.currentTime + 4 + i * 2.5);
    });

    // ── 3. 리듬 섹션 (kick + hihat + bass stab) ──
    this._scheduleBeat();
  }

  // ── 리듬 스케줄러 ─────────────────────────────────────────────────
  _scheduleBeat() {
    if (!this.ctx) return;
    const BPM     = 95 + this._tension * 40;         // 95~135 BPM — 긴박감↑
    const beatLen = (60 / BPM) * 1000 / 2;           // 8분음표 ms

    // 16스텝 패턴 (8분음표 단위) — 더 밀도 높은 패턴
    const kick  = [1,0,0,1, 1,0,1,0, 1,0,0,1, 1,0,1,0]; // 더블킥 포함
    const snare = [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,1]; // 백비트 + 마지막 필인
    const hihat = [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]; // 16분음표 풀 하이햇
    const bass  = [1,0,0,0, 0,1,0,0, 1,0,0,0, 0,1,0,1]; // 오프비트 베이스

    const step = this._beatIdx % 16;
    if (kick[step])  this._playKick(0.75 + this._tension * 0.25);
    if (snare[step]) this._playSnare(0.35 + this._tension * 0.2);
    // 8분음표 하이햇 only (홀수 step 줄이기) or full on high tension
    if (hihat[step] && (step % 2 === 0 || this._tension > 0.4))
      this._playHihat(0.12 + this._tension * 0.12);
    if (bass[step])  this._playBassStab(55 * (step < 8 ? 1 : 1.333), 0.28 + this._tension * 0.12);

    // 고텐션(0.7+)일 때 짝수 비트에 긴장 멜로디 스탭 추가
    if (this._tension > 0.7 && step % 4 === 2) {
      const melodyFreqs = [369.99, 349.23, 329.63, 311.13]; // F#4~Eb4 하강
      this._playMelodyStab(melodyFreqs[Math.floor(step / 4) % 4], 0.10);
    }

    this._beatIdx++;
    this._beatTimer = setTimeout(() => this._scheduleBeat(), beatLen);
  }

  _playKick(vol = 0.75) {
    if (!this.ctx) return;
    const t   = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator(); // sub layer
    const g   = this.ctx.createGain();
    osc.connect(g); osc2.connect(g); g.connect(this.sfxGain);
    osc.type = 'sine';   osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.4);
    osc2.type = 'sine';  osc2.frequency.setValueAtTime(80, t);
    osc2.frequency.exponentialRampToValueAtTime(0.01, t + 0.3);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.start(t); osc.stop(t + 0.45);
    osc2.start(t); osc2.stop(t + 0.35);
  }

  _playSnare(vol = 0.35) {
    if (!this.ctx) return;
    const t    = this.ctx.currentTime;
    // 노이즈 스네어
    const buf  = this.ctx.createBuffer(1, 4096, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < 4096; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(bp); bp.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + 0.2);
    // 톤 레이어 (crack)
    const osc = this.ctx.createOscillator();
    const og  = this.ctx.createGain();
    osc.type = 'triangle'; osc.frequency.value = 220;
    og.gain.setValueAtTime(vol * 0.4, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og); og.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.12);
  }

  _playHihat(vol = 0.15) {
    if (!this.ctx) return;
    const t    = this.ctx.currentTime;
    const buf  = this.ctx.createBuffer(1, 1024, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < 1024; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 8500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(hp); hp.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + 0.07);
  }

  _playBassStab(freq, vol = 0.28) {
    if (!this.ctx) return;
    const t   = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    const lp  = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 400;
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(lp); lp.connect(g); g.connect(this.bgmGain);
    osc.start(t); osc.stop(t + 0.3);
  }

  _playMelodyStab(freq, vol = 0.10) {
    if (!this.ctx) return;
    const t   = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    const hp  = this.ctx.createBiquadFilter();
    hp.type = 'bandpass'; hp.frequency.value = freq * 1.5; hp.Q.value = 2;
    osc.type = 'square'; osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(hp); hp.connect(g); g.connect(this.bgmGain);
    osc.start(t); osc.stop(t + 0.25);
  }

  // ── 텐션 조절 (웨이브 상승 시 호출) ─────────────────────────────
  setTension(wave) {
    this._tension = Math.min(1, (wave - 1) / 10);   // 10웨이브에서 최대 긴장
    if (!this.bgmGain) return;
    const t = this.ctx.currentTime;
    this.bgmGain.gain.linearRampToValueAtTime(0.30 + this._tension * 0.22, t + 2);
  }

  // ── BGM 중지 ──────────────────────────────────────────────────────
  stopBGM() {
    clearTimeout(this._beatTimer);
    this._bgmNodes.forEach(n => { try { n.stop(); } catch(e) {} });
    this._bgmNodes = [];
  }

  // ── SFX ──────────────────────────────────────────────────────────
  _play(freq, type, duration, gain = 0.3) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      osc.connect(g);
      g.connect(this.sfxGain || this.ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(0.01, freq * 0.4), this.ctx.currentTime + duration);
      g.gain.setValueAtTime(gain, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  hit()  {}  // 타격 미스 SFX 제거 (이미 bgm으로 충분)
  kill() {
    // 짧고 강한 임팩트: 저음 퍽 + 찰싹
    this._play(75,  'sine',     0.08, 0.55);
    this._play(200, 'square',   0.04, 0.08);
    setTimeout(() => this._play(90, 'sawtooth', 0.05, 0.12), 20);
  }
  combo()   { this._play(880, 'triangle', 0.18, 0.35); setTimeout(() => this._play(1100, 'sine', 0.12, 0.25), 100); }
  damage()  {
    this._play(80,  'sawtooth', 0.25, 0.7);
    this._play(160, 'square',   0.12, 0.4);
  }
  upgrade() {
    const chord = [440, 554, 659, 880];
    chord.forEach((f, i) => setTimeout(() => this._play(f, 'sine', 0.18, 0.28), i * 70));
  }
  wave() {
    // 웨이브 경보음
    [180, 150, 220].forEach((f, i) => setTimeout(() => this._play(f, 'square', 0.4, 0.5), i * 250));
  }
  spray()  { this._play(55 + Math.random() * 35, 'sawtooth', 0.04, 0.12); }
  golden() {
    const arp = [523, 659, 784, 1047, 1318];
    arp.forEach((f, i) => setTimeout(() => this._play(f, 'sine', 0.22, 0.4), i * 80));
  }
}

// ─────────────────────────────────────────────────────────────────
// PARTICLE SYSTEM
// ─────────────────────────────────────────────────────────────────
class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  spawnSplat(x, z, color = 0x3d2b1f) {
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.SphereGeometry(0.04 + Math.random() * 0.06, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.05, z);
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      mesh.userData = {
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03,
      };
      this.scene.add(mesh);
      this.particles.push(mesh);
    }
  }

  spawnComboText(x, z, text) {
    // We'll handle text via React overlay — just spawn visual particles here
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.SphereGeometry(0.08, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.3, z);
      mesh.userData = {
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 2,
        vz: (Math.random() - 0.5) * 4,
        life: 1.0,
        decay: 0.04,
        gravity: true,
      };
      this.scene.add(mesh);
      this.particles.push(mesh);
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const d = p.userData;
      d.life -= d.decay;
      p.position.x += d.vx * dt;
      p.position.z += d.vz * dt;
      if (d.gravity) {
        d.vy -= 9.8 * dt;
        p.position.y += d.vy * dt;
      }
      d.vx *= 0.92;
      d.vz *= 0.92;
      p.material.opacity = d.life;
      p.material.transparent = true;
      if (d.life <= 0) {
        this.scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// COCKROACH CLASS
// ─────────────────────────────────────────────────────────────────
class Cockroach {
  constructor(scene, type, spawnX, spawnZ, id) {
    this.scene = scene;
    this.type = type;
    this.config = COCKROACH_TYPES[type];
    this.id = id;
    this.hp = this.config.hp;
    this.maxHp = this.config.hp;
    this.dead = false;
    this.speed = this.config.speed;

    // Movement state
    this.vx = 0;
    this.vz = 0;
    this.angle = Math.random() * Math.PI * 2;
    this.zigzagTimer = 0;
    this.ninjaTimer = 0;
    this.stunTimer = 0;

    this._buildMesh(spawnX, spawnZ);
  }

  _buildMesh(x, z) {
    const s = this.config.size;
    const col = this.config.color;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);

    // ── 몸통: 납작한 타원형 (실제 바퀴 실루엣) ──
    const bodyGeo = new THREE.CapsuleGeometry(s * 0.42, s * 0.75, 6, 12);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.55,
      metalness: 0.15,
      emissive: new THREE.Color(col).multiplyScalar(0.08),
    });
    this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.scale.y = 0.45; // 납작하게
    this.mesh.position.y = s * 0.12;
    this.mesh.castShadow = true;
    this.group.add(this.mesh);

    // ── 머리 (앞쪽 작은 구) ──
    const headGeo = new THREE.SphereGeometry(s * 0.22, 8, 6);
    const headMesh = new THREE.Mesh(headGeo, bodyMat);
    headMesh.position.set(0, s * 0.1, -s * 0.52);
    headMesh.scale.set(1, 0.7, 0.9);
    this.group.add(headMesh);

    // ── 6개 다리 (3쌍, 꺾인 형태) ──
    const legMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(0.7) });
    const legPositions = [
      { z: -s*0.35, angle: 1.1 }, { z: 0,      angle: 1.4 }, { z: s*0.3,  angle: 1.0 }
    ];
    for (const lp of legPositions) {
      for (const side of [-1, 1]) {
        // 상단 다리
        const upperGeo = new THREE.CylinderGeometry(0.012, 0.012, s * 0.45, 4);
        const upper = new THREE.Mesh(upperGeo, legMat);
        upper.rotation.z = side * lp.angle;
        upper.position.set(side * s * 0.38, s * 0.05, lp.z);
        this.group.add(upper);
        // 하단 다리 (꺾인 부분)
        const lowerGeo = new THREE.CylinderGeometry(0.01, 0.01, s * 0.38, 4);
        const lower = new THREE.Mesh(lowerGeo, legMat);
        lower.rotation.z = side * (lp.angle - 0.8);
        lower.rotation.x = 0.3;
        lower.position.set(side * (s * 0.55 + Math.cos(lp.angle)*s*0.2), s * 0.02, lp.z + 0.1);
        this.group.add(lower);
      }
    }

    // ── 더듬이 (2개, 길고 가늘게) ──
    for (const side of [-1, 1]) {
      // 더듬이 1절
      const a1Geo = new THREE.CylinderGeometry(0.008, 0.008, s * 0.7, 4);
      const a1 = new THREE.Mesh(a1Geo, legMat);
      a1.rotation.z = side * 0.35;
      a1.rotation.x = -0.5;
      a1.position.set(side * s * 0.13, s * 0.15, -s * 0.72);
      this.group.add(a1);
      // 더듬이 2절
      const a2Geo = new THREE.CylinderGeometry(0.005, 0.005, s * 0.55, 4);
      const a2 = new THREE.Mesh(a2Geo, legMat);
      a2.rotation.z = side * 0.5;
      a2.rotation.x = -0.7;
      a2.position.set(side * s * 0.22, s * 0.18, -s * 1.05);
      this.group.add(a2);
    }

    // ── 황금 바퀴 광택 후광 ──
    if (this.type === 'golden') {
      const glowGeo = new THREE.SphereGeometry(s * 0.9, 10, 10);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.18, depthWrite: false });
      this.group.add(new THREE.Mesh(glowGeo, glowMat));
      bodyMat.emissive = new THREE.Color(0xffaa00);
      bodyMat.emissiveIntensity = 0.4;
    }

    // ── 날바퀴 날개 ──
    if (this.type === 'flying') {
      this._flyPhase = Math.random() * Math.PI * 2;
      for (const side of [-1, 1]) {
        const wingGeo = new THREE.PlaneGeometry(s * 0.8, s * 0.55);
        const wingMat = new THREE.MeshBasicMaterial({ color: 0x6a4a2a, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.rotation.x = -Math.PI/2;
        wing.rotation.z = side * 0.4;
        wing.position.set(side * s * 0.6, s * 0.25, 0);
        this.group.add(wing);
      }
    }

    // ── HP 바 (체력 많은 바퀴만) ──
    if (this.maxHp > 1) {
      const bgGeo = new THREE.PlaneGeometry(s * 1.6, 0.08);
      const bgMat = new THREE.MeshBasicMaterial({ color: 0x220000, depthWrite: false });
      this.hpBarBg = new THREE.Mesh(bgGeo, bgMat);
      this.hpBarBg.rotation.x = -Math.PI/2;
      this.hpBarBg.position.set(0, 0.02, -s * 0.9);
      this.group.add(this.hpBarBg);

      const fgGeo = new THREE.PlaneGeometry(s * 1.6, 0.08);
      const fgMat = new THREE.MeshBasicMaterial({ color: 0xff2200, depthWrite: false });
      this.hpBarFg = new THREE.Mesh(fgGeo, fgMat);
      this.hpBarFg.rotation.x = -Math.PI/2;
      this.hpBarFg.position.set(0, 0.025, -s * 0.9);
      this.group.add(this.hpBarFg);
    }

    this.scene.add(this.group);
  }

  update(dt, playerPos, elapsedTime) {
    if (this.dead) return;
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return;
    }

    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // ── Flee AI (하루살이 모드) ──
    if (this.fleeMode) {
      if (!this._fleeAngle) this._fleeAngle = Math.atan2(-dz, -dx);
      this._fleeAngle += (Math.random() - 0.5) * 4 * dt;
      const awayAngle = Math.atan2(-dz, -dx);
      let diff = this._fleeAngle - awayAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this._fleeAngle = awayAngle + Math.max(-1.0, Math.min(1.0, diff * 0.8));
      this.vx = Math.cos(this._fleeAngle) * this.speed;
      this.vz = Math.sin(this._fleeAngle) * this.speed;
    } else {
    switch (this.type) {
      case 'normal':
      case 'pregnant':
      case 'tank':
      case 'mutant':
      case 'giant':
        // Chase player
        if (dist > 0.01) {
          this.vx = (dx / dist) * this.speed;
          this.vz = (dz / dist) * this.speed;
        }
        break;

      case 'zigzag':
        this.zigzagTimer += dt;
        const zigAngle = Math.atan2(dz, dx) + Math.sin(this.zigzagTimer * 6) * 1.2;
        this.vx = Math.cos(zigAngle) * this.speed;
        this.vz = Math.sin(zigAngle) * this.speed;
        break;

      case 'ninja':
        this.ninjaTimer -= dt;
        if (this.ninjaTimer <= 0) {
          // Teleport closer to player
          const teleportDist = 2.5;
          if (dist > teleportDist) {
            const nx = playerPos.x - (dx / dist) * teleportDist * (0.5 + Math.random() * 0.5);
            const nz = playerPos.z - (dz / dist) * teleportDist * (0.5 + Math.random() * 0.5);
            this.group.position.x = Math.max(-ROOM_SIZE/2 + 1, Math.min(ROOM_SIZE/2 - 1, nx));
            this.group.position.z = Math.max(-ROOM_SIZE/2 + 1, Math.min(ROOM_SIZE/2 - 1, nz));
          }
          this.ninjaTimer = 1.5 + Math.random() * 2;
        }
        if (dist > 0.01) {
          this.vx = (dx / dist) * this.speed;
          this.vz = (dz / dist) * this.speed;
        }
        break;

      case 'flying':
        if (dist > 0.01) {
          this.vx = (dx / dist) * this.speed;
          this.vz = (dz / dist) * this.speed;
        }
        this._flyPhase += dt * 3;
        this.group.position.y = this.config.size * 0.5 + Math.sin(this._flyPhase) * 0.3;
        break;

      case 'golden':
        // Random erratic movement
        this.angle += (Math.random() - 0.5) * 8 * dt;
        // Also slightly chase
        if (dist < 5) {
          const chaseAngle = Math.atan2(dz, dx);
          this.angle = this.angle * 0.95 + chaseAngle * 0.05;
        }
        this.vx = Math.cos(this.angle) * this.speed;
        this.vz = Math.sin(this.angle) * this.speed;
        break;
    }
    } // end else (fleeMode)

    // Move
    let nx = this.group.position.x + this.vx * dt;
    let nz = this.group.position.z + this.vz * dt;

    // Wall bounce
    const half = ROOM_SIZE / 2 - 0.5;
    if (nx < -half) { nx = -half; this.vx *= -1; }
    if (nx > half)  { nx = half;  this.vx *= -1; }
    if (nz < -half) { nz = -half; this.vz *= -1; }
    if (nz > half)  { nz = half;  this.vz *= -1; }

    this.group.position.x = nx;
    this.group.position.z = nz;

    // Face movement direction
    if (Math.abs(this.vx) + Math.abs(this.vz) > 0.1) {
      this.group.rotation.y = Math.atan2(this.vx, this.vz);
    }

    // Leg animation
    const t = elapsedTime * 10 * (this.speed / 3);
    this.group.children.slice(1, 7).forEach((leg, i) => {
      leg.rotation.y = Math.sin(t + i * 0.5) * 0.3;
    });

    // HP bar update
    if (this.maxHp > 1 && this.hpBarFg) {
      const ratio = this.hp / this.maxHp;
      this.hpBarFg.scale.x = Math.max(0.001, ratio);
      this.hpBarFg.position.x = -this.config.size * 1.6 * 0.5 * (1 - ratio);
    }
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    // Flash red
    this.mesh.material.emissive = new THREE.Color(0xff0000);
    setTimeout(() => {
      if (this.mesh && this.mesh.material) {
        this.mesh.material.emissive = new THREE.Color(0x000000);
      }
    }, 100);
    this.stunTimer = 0.05;
    return this.hp <= 0;
  }

  die() {
    this.dead = true;
    this.scene.remove(this.group);
    this.group.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
  }

  getPos() {
    return { x: this.group.position.x, z: this.group.position.z };
  }
}

// ─────────────────────────────────────────────────────────────────
// MAIN GAME ENGINE
// ─────────────────────────────────────────────────────────────────
export class GameEngine {
  constructor(canvas, onStateUpdate, onEvent) {
    this.canvas = canvas;
    this.onStateUpdate = onStateUpdate;
    this.onEvent = onEvent;
    this.godMode = false; // 관리자 모드 (이스터에그)

    // Three.js
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // Game state
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.gameMode = '3min'; // '3min' | 'infinite' | 'daysurvival'

    this.hp = 100;
    this.maxHp = 100;
    this.timeLeft = GAME_DURATION;
    this.elapsedTime = 0;
    this.killCount = 0;
    this.money = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.wave = 1;
    this.waveTimer = WAVE_INTERVAL;
    this.score = 0;

    // Player
    this.player = null;
    this.playerGroup = null;
    this.playerPos = { x: 0, z: 0 };
    this.playerAngle = 0;

    // Weapon — 시작 시 슬리퍼만 보유, 나머지는 상점에서 구매
    this.currentWeapon = 'slipper';
    this.weaponSlots = ['slipper'];
    this.ownedWeapons = new Set(['slipper']);
    this.attackCooldown = 0;
    this.isAttacking = false;
    this.attackMesh = null;
    this.sprayHeld       = false;
    this.sprayEnergy     = 1.0;   // 0~1, 3초 연사 후 소진
    this.sprayRecharging = false; // 에너지 0 도달 시 강제 충전 중

    // Cockroaches
    this.cockroaches = [];
    this.cockroachIdCounter = 0;

    // Systems
    this.particles = null;
    this.sound = new SoundSystem();

    // Input
    this.keys = {};
    this.mousePos = { x: 0, y: 0 };

    // Upgrades
    this.upgrades = {
      newFloor: 0,       // 장판 교체: spawn rate -10% per level
      insecticide: 0,    // 살충제 자동: auto damage aura
      newFridge: 0,      // 냉장고 교체: rare roach chance
      ledLight: 0,       // LED 조명: roach speed -8%
      aircon: 0,         // 에어컨: all roach hp -1 per level
      cat: 0,            // 고양이: auto hunter
      exterminator: 0,   // 방역업체: periodic mass kill
    };

    // NPC helpers
    this.npcs = [];
    this.catTimer = 0;
    this.exterminatorTimer = 0;
    this.autoSprayTimer = 0;

    // Room meshes
    this.roomMeshes = [];

    // Crisis events
    this.crisisTimer = 60 + Math.random() * 30;
    this.crisisActive = false;
    this.crisisType = null;
    this.lightsOut = false;

    // 상시 소량 스폰 (웨이브 외 시간에도 바퀴 유지)
    this.ambientSpawnTimer = 5.0; // 첫 스폰까지 5초

    // Day survival mode
    this.electricity = 100;
    this.cleanliness = 100;
    this.rent = 0;

    // Post-processing
    this.composer = null;

    // Camera shake
    this._shakePower = 0;
    this._shakeTimer = 0;

    // Ambient dust particles
    this._dustParticles = [];

    // Day survival
    this.daySurvivalTarget  = 500;
    this.daySurvivalKilled  = 0;
    this.hidingSpots        = [];
    this._spotMeshes        = [];

    this._animFrame = null;
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundKeyUp = this._onKeyUp.bind(this);
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundClick = this._onClick.bind(this);
  }

  // ─── INIT ────────────────────────────────────────────────────────
  init(gameMode = '3min', godMode = false) {
    this.gameMode = gameMode;
    this.godMode = godMode;
    this.timeLeft = gameMode === 'infinite' ? Infinity : GAME_DURATION;
    this.sound.init();
    if (gameMode === 'daysurvival') {
      this.timeLeft = Infinity;
    }
    this._setupRenderer();
    this._setupScene();
    this._setupPlayer();
    this._setupLights();
    this._addDustParticles();
    this._setupPostProcessing();
    this._setupControls();
    this.particles = new ParticleSystem(this.scene);
    if (gameMode === 'daysurvival') this._setupDaySurvivalSpots();
    this.running = true;
    this._animate();
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x06050200);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 4.5;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  // ── Post-processing: Bloom + Vignette ────────────────────────────
  _setupPostProcessing() {
    try {
      const w = window.innerWidth;
      const h = window.innerHeight;

      this.composer = new EffectComposer(this.renderer);

      // 1. 기본 렌더 패스
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      // 2. Unreal Bloom — 황금 바퀴·조명 발광 효과
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(w, h),
        0.4,    // strength  (강도)
        0.4,    // radius    (번짐)
        0.85    // threshold (임계값)
      );
      this.composer.addPass(bloomPass);
      this._bloomPass = bloomPass;

      // 3. 비네팅 + 필름 그레인 커스텀 셰이더
      const VignetteShader = {
        uniforms: {
          tDiffuse:  { value: null },
          offset:    { value: 1.0 },
          darkness:  { value: 0.8 },
          grainTime: { value: 0.0 },
          grainAmt:  { value: 0.035 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float offset;
          uniform float darkness;
          uniform float grainTime;
          uniform float grainAmt;
          varying vec2 vUv;
          float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453 + grainTime); }
          void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            // 채도 20% 감소
            float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            color.rgb = mix(vec3(luma), color.rgb, 0.75);
            // 필름 그레인
            float grain = rand(vUv) * grainAmt - grainAmt * 0.5;
            color.rgb += grain;
            // 비네팅
            vec2 uv2 = (vUv - 0.5) * 2.0;
            color.rgb *= 1.0 - smoothstep(offset - 0.05, offset + 0.3, dot(uv2, uv2) * darkness * 0.5);
            gl_FragColor = color;
          }
        `,
      };
      const vigPass = new ShaderPass(VignetteShader);
      this.composer.addPass(vigPass);
      this._vigPass = vigPass;

    } catch (e) {
      console.warn('Post-processing unavailable, using fallback:', e);
      this.composer = null;
    }
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0d0b06, 0.055); // 지수 안개로 더 자연스럽게

    // ── Camera: 줌인된 탑다운 (viewSize 5.5로 확대) ──
    const aspect = window.innerWidth / window.innerHeight;
    const viewSize = 5.5;
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect,
      viewSize, -viewSize,
      0.1, 100
    );
    this.camera.position.set(0, 16, 8);
    this.camera.lookAt(0, 0, 0);

    // ── Floor (노란 장판 — 레퍼런스처럼 어둡고 지저분) ──
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = 1024; tileCanvas.height = 1024;
    const ctx = tileCanvas.getContext('2d');

    // 기본 장판 색 (밝은 베이지)
    ctx.fillStyle = '#d4c08a';
    ctx.fillRect(0, 0, 1024, 1024);

    // 타일 줄눈 (밝게)
    ctx.strokeStyle = 'rgba(160,130,60,0.4)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 1024; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
    }
    // 은은한 얼룩 (밝은 베이지톤 유지)
    for (let i = 0; i < 20; i++) {
      const grd = ctx.createRadialGradient(
        Math.random()*1024, Math.random()*1024, 0,
        Math.random()*1024, Math.random()*1024, 20 + Math.random()*60
      );
      grd.addColorStop(0, 'rgba(100,80,30,0.18)');
      grd.addColorStop(1, 'rgba(100,80,30,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 1024, 1024);
    }
    // 긁힌 자국 (연하게)
    ctx.strokeStyle = 'rgba(160,130,60,0.2)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random()*1024, Math.random()*1024);
      ctx.lineTo(Math.random()*1024, Math.random()*1024);
      ctx.stroke();
    }

    const floorTex = new THREE.CanvasTexture(tileCanvas);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(3, 3);

    const floorGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE, 1, 1);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.85,
      metalness: 0.0,
      color: 0xf0dfa0,  // 밝은 베이지
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.roomMeshes.push(floor);

    // ── Walls — 벗겨진 벽지 텍스처 ──
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 512; wallCanvas.height = 256;
    const wctx = wallCanvas.getContext('2d');
    wctx.fillStyle = '#8a7040';
    wctx.fillRect(0, 0, 512, 256);
    // 벽지 패턴
    for (let i = 0; i < 512; i += 48) {
      for (let j = 0; j < 256; j += 24) {
        const shade = 0.88 + Math.random() * 0.12;
        wctx.fillStyle = `rgba(${Math.floor(160*shade)},${Math.floor(130*shade)},${Math.floor(60*shade)},1)`;
        wctx.fillRect(i, j, 46, 22);
      }
    }
    // 벗겨진 자국
    wctx.strokeStyle = 'rgba(50,35,10,0.5)';
    wctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      wctx.beginPath();
      const sx = Math.random()*512; const sy = Math.random()*256;
      wctx.moveTo(sx, sy);
      wctx.lineTo(sx+(Math.random()-0.5)*80, sy+(Math.random()-0.5)*60);
      wctx.stroke();
    }
    // 곰팡이 자국
    for (let i = 0; i < 5; i++) {
      const grd = wctx.createRadialGradient(Math.random()*512,Math.random()*256,0,Math.random()*512,Math.random()*256,25);
      grd.addColorStop(0,'rgba(30,50,20,0.4)');
      grd.addColorStop(1,'rgba(30,50,20,0)');
      wctx.fillStyle = grd;
      wctx.fillRect(0,0,512,256);
    }
    const wallTex = new THREE.CanvasTexture(wallCanvas);
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(4, 1);

    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1.0, metalness: 0.0 });
    const wallPositions = [
      { pos: [0, WALL_H/2, -ROOM_SIZE/2], rot: [0,0,0],           size: [ROOM_SIZE, WALL_H, 0.25] },
      { pos: [0, WALL_H/2,  ROOM_SIZE/2], rot: [0, Math.PI, 0],   size: [ROOM_SIZE, WALL_H, 0.25] },
      { pos: [-ROOM_SIZE/2, WALL_H/2, 0], rot: [0, Math.PI/2, 0], size: [ROOM_SIZE, WALL_H, 0.25] },
      { pos: [ ROOM_SIZE/2, WALL_H/2, 0], rot: [0,-Math.PI/2, 0], size: [ROOM_SIZE, WALL_H, 0.25] },
    ];
    wallPositions.forEach(w => {
      const geo = new THREE.BoxGeometry(...w.size);
      const mesh = new THREE.Mesh(geo, wallMat.clone());
      mesh.position.set(...w.pos);
      mesh.rotation.set(...w.rot);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.roomMeshes.push(mesh);
    });

    // 천장
    const ceilGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x6a5a30, roughness: 1.0 });
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WALL_H;
    this.scene.add(ceil);

    // ── Furniture ──
    this._addFurniture();
  }

  _addFurniture() {
    // ── 싱크대 + 수납장 ──
    this._box([-5.2, 0.45, -5.5], [1.6, 0.9, 0.85], 0x6a6050, '싱크대');
    this._box([-5.2, 0.88, -5.5], [1.55, 0.06, 0.8], 0x888070); // 상판
    this._box([-5.2, 0.68, -5.3], [0.5, 0.25, 0.4], 0x444440);  // 싱크볼
    this._box([-5.2, 1.6,  -5.6], [1.6, 1.0, 0.25], 0x504838);  // 수납장 상단
    this._box([-5.2, 1.6,  -5.48],[1.55,0.95,0.05], 0x3a3028);   // 수납장 문

    // ── 냉장고 (레퍼런스처럼 크고 낡음) ──
    this._box([5.4, 1.1, -5.3], [1.05, 2.2, 1.05], 0xb8b0a0, '냉장고');
    this._box([5.4, 2.15,-5.3], [1.0, 0.07, 1.0],  0xa8a090); // 상단
    this._box([5.4, 1.1, -5.23],[0.98,1.05,0.04],  0x989080); // 냉동칸 문
    this._box([5.4, 0.35,-5.23],[0.98,0.65,0.04],  0xa09888); // 냉장칸 문
    this._box([5.75,1.1, -5.23],[0.05,0.08,0.04],  0x333333); // 손잡이

    // ── 화장실 (타일 + 변기) ──
    this._box([-5.6, 0.35, 5.2], [0.85, 0.7, 0.95], 0xddd8cc, '화장실');
    this._box([-5.6, 0.68, 5.2], [0.8, 0.08, 0.9],  0xeeeae0); // 변기 상단
    this._box([-5.6, 0.4,  5.65],[0.85,0.8, 0.12],  0xddddcc); // 물탱크
    // 타일 바닥
    this._box([-5.6, 0.02, 5.0], [2.0, 0.04, 2.0],  0xaaaaaa);

    // ── 라면 박스 + 쓰레기 (레퍼런스처럼 쌓여있음) ──
    this._box([4.9, 0.2, 5.1],  [1.3, 0.4, 0.9], 0xcc3311, '라면박스');
    this._box([4.9, 0.6, 5.1],  [1.1, 0.4, 0.8], 0xdd4422);
    this._box([4.0, 0.2, 5.3],  [0.9, 0.4, 0.7], 0xee5533);
    this._box([4.0, 0.6, 5.3],  [0.8, 0.35,0.6], 0xbb2200);
    this._box([4.5, 0.2, 4.2],  [0.6, 0.3, 0.5], 0x886644); // 빈 상자
    this._box([3.5, 0.15,4.8],  [0.4, 0.3, 0.4], 0x554433); // 봉투

    // ── 컴퓨터 책상 (레퍼런스 핵심) ──
    this._box([3.2, 0.44, 1.8],  [2.2, 0.08, 1.1], 0x5a4a30); // 책상
    this._box([2.2, 0.44, 2.35], [0.08,0.88,0.08], 0x3a2a18); // 다리1
    this._box([4.2, 0.44, 2.35], [0.08,0.88,0.08], 0x3a2a18); // 다리2
    this._box([2.2, 0.44, 1.25], [0.08,0.88,0.08], 0x3a2a18); // 다리3
    this._box([4.2, 0.44, 1.25], [0.08,0.88,0.08], 0x3a2a18); // 다리4
    // 모니터
    this._box([3.0, 1.05, 1.35], [0.06,0.75,0.9],  0x111122); // 화면
    this._box([3.0, 0.75, 1.35], [0.06,0.15,0.25], 0x222233); // 스탠드
    this._box([3.0, 0.68, 1.55], [0.06,0.06,0.5],  0x222233); // 받침
    // 키보드
    this._box([3.2, 0.54, 1.85], [0.9, 0.04, 0.35],0x333333);
    // 컵라면 + 음료캔
    this._box([4.0, 0.55, 1.55], [0.18,0.22,0.18], 0xdd4422);
    this._box([4.3, 0.52, 1.6],  [0.14,0.2, 0.14], 0x3355aa);

    // ── 옷/쓰레기 더미 ──
    this._box([-1.5,0.12, 3.5],  [1.2, 0.24, 0.9], 0x445566);  // 옷더미
    this._box([-0.5,0.1,  3.0],  [0.7, 0.2,  0.7], 0x776655);
    this._box([1.5, 0.1,  3.8],  [0.5, 0.18, 0.5], 0x223344);
    // 빈 봉투
    this._box([0.5, 0.08, 4.5],  [0.4, 0.16, 0.4], 0x888866);

    // ── 책장 (벽 쪽) ──
    this._box([-5.5, 1.2, -2.5], [0.25, 2.4, 2.0], 0x4a3820); // 옆판
    this._box([-5.38,0.5,-2.5],  [0.02, 0.06,1.9], 0x3a2810); // 선반1
    this._box([-5.38,1.0,-2.5],  [0.02, 0.06,1.9], 0x3a2810); // 선반2
    this._box([-5.38,1.5,-2.5],  [0.02, 0.06,1.9], 0x3a2810); // 선반3
    // 책들
    for (let i = 0; i < 5; i++) {
      const bookColor = [0x882222,0x228844,0x224488,0x884422,0x666622][i];
      this._box([-5.36, 0.7+i*0.04, -3.2+i*0.38], [0.12, 0.4, 0.22], bookColor);
    }

    // ── 바닥 얼룩/쓰레기 ──
    const dirtMat = new THREE.MeshBasicMaterial({ color: 0x1a1005, transparent: true, opacity: 0.45, depthWrite: false });
    for (let i = 0; i < 18; i++) {
      const g = new THREE.CircleGeometry(0.08 + Math.random() * 0.3, 8);
      const m = new THREE.Mesh(g, dirtMat.clone());
      m.rotation.x = -Math.PI/2;
      m.position.set((Math.random()-0.5)*11, 0.015, (Math.random()-0.5)*11);
      this.scene.add(m);
    }
  }

  _box(pos, size, color, label) {
    const geo = new THREE.BoxGeometry(...size);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (label) mesh.userData.label = label;
    this.scene.add(mesh);
    this.roomMeshes.push(mesh);
    return mesh;
  }

  _setupPlayer() {
    this.playerGroup = new THREE.Group();

    const skinMat  = new THREE.MeshStandardMaterial({ color: 0xf5c49a, roughness: 0.8 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xd4cdb0, roughness: 0.9 }); // 레퍼런스: 회백색 티셔츠
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x3a3020, roughness: 0.9 }); // 어두운 반바지
    const hairMat  = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 1.0 });
    const shoeMat  = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });

    // ── 몸통 (짧고 통통한 SD 비율) ──
    const torsoGeo = new THREE.CapsuleGeometry(0.28, 0.35, 8, 12);
    this.player = new THREE.Mesh(torsoGeo, shirtMat);
    this.player.position.y = 0.62;
    this.player.castShadow = true;
    this.playerGroup.add(this.player);

    // ── 반바지 ──
    const shortsGeo = new THREE.CylinderGeometry(0.27, 0.22, 0.3, 10);
    const shorts = new THREE.Mesh(shortsGeo, pantsMat);
    shorts.position.y = 0.28;
    this.playerGroup.add(shorts);

    // ── 다리 (짧게) ──
    for (const side of [-1, 1]) {
      const legGeo = new THREE.CapsuleGeometry(0.1, 0.2, 6, 8);
      const leg = new THREE.Mesh(legGeo, skinMat);
      leg.position.set(side * 0.12, 0.12, 0);
      this.playerGroup.add(leg);
      // 신발
      const shoeGeo = new THREE.BoxGeometry(0.18, 0.08, 0.28);
      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(side * 0.12, 0.04, 0.04);
      this.playerGroup.add(shoe);
    }

    // ── 큰 머리 (SD 비율 핵심) ──
    const headGeo = new THREE.SphereGeometry(0.35, 12, 10);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.18;
    head.scale.set(1, 1.05, 0.92);
    head.castShadow = true;
    this.playerGroup.add(head);

    // ── 머리카락 ──
    const hairGeo = new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.2;
    hair.scale.set(1, 1.0, 0.92);
    this.playerGroup.add(hair);
    // 앞머리
    const bangGeo = new THREE.SphereGeometry(0.2, 8, 6);
    const bang = new THREE.Mesh(bangGeo, hairMat);
    bang.position.set(0, 1.46, -0.24);
    bang.scale.set(1.2, 0.5, 0.5);
    this.playerGroup.add(bang);

    // ── 눈 (간단한 두 점) ──
    for (const side of [-1, 1]) {
      const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.12, 1.2, -0.31);
      this.playerGroup.add(eye);
    }

    // ── 팔 (옆으로 약간 내려진) ──
    for (const side of [-1, 1]) {
      const armGeo = new THREE.CapsuleGeometry(0.08, 0.28, 6, 8);
      const arm = new THREE.Mesh(armGeo, shirtMat);
      arm.position.set(side * 0.38, 0.72, 0);
      arm.rotation.z = side * 0.25;
      arm.castShadow = true;
      this.playerGroup.add(arm);
    }

    // ── 그림자 원 ──
    const shadowGeo = new THREE.CircleGeometry(0.45, 20);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI/2;
    shadow.position.y = 0.01;
    this.playerGroup.add(shadow);

    this.playerGroup.position.set(0, 0, 0);
    this.playerGroup.scale.set(1.3, 1.3, 1.3); // 캐릭터 1.3배
    this.scene.add(this.playerGroup);

    // ── 무기 범위 표시 링 ──
    this._buildRangeIndicator();
  }

  _buildRangeIndicator() {
    // 기존 제거
    if (this.rangeRing) {
      (this.rangeRingParent || this.scene).remove(this.rangeRing);
      this.rangeRing.geometry?.dispose();
      this.rangeRing.material?.dispose();
    }
    const w = WEAPONS[this.currentWeapon];
    const mat = new THREE.MeshBasicMaterial({
      color: w.color,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // 모든 무기: 원형 링 — 씬에 붙이고 매 프레임 위치 추적 (살충제도 360° 원)
    {
      const geo = new THREE.RingGeometry(w.range - 0.04, w.range + 0.04, 64);
      this.rangeRing = new THREE.Mesh(geo, mat);
      this.rangeRing.rotation.x = -Math.PI / 2;
      this.rangeRing.position.y = 0.05;
      this.scene.add(this.rangeRing);
      this.rangeRingParent = this.scene;
    }
  }

  _updateWeaponMesh() {
    // Remove old weapon
    if (this.weaponMesh) {
      this.playerGroup.remove(this.weaponMesh);
      if (this.weaponMesh.geometry) this.weaponMesh.geometry.dispose();
      if (this.weaponMesh.material) this.weaponMesh.material.dispose();
    }

    const w = this.currentWeapon;
    let geo, mat;
    if (w === 'slipper') {
      geo = new THREE.BoxGeometry(0.6, 0.08, 0.25);
      mat = new THREE.MeshLambertMaterial({ color: 0xff6b35 });
    } else if (w === 'chopstick') {
      geo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6);
      mat = new THREE.MeshLambertMaterial({ color: 0xd4a574 });
    } else if (w === 'frypan') {
      geo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16);
      mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    } else { // spray
      geo = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
      mat = new THREE.MeshLambertMaterial({ color: 0x88ffcc });
    }
    this.weaponMesh = new THREE.Mesh(geo, mat);
    this.weaponMesh.position.set(0.5, 0.9, 0);
    this.playerGroup.add(this.weaponMesh);
  }

  // ── 하루살이: 은신처 설정 ─────────────────────────────────────────
  _setupDaySurvivalSpots() {
    const spots = [
      { x:  5.4, z: -5.3, label: '냉장고',   count: 80,  color: 0x99ccff },
      { x:  3.0, z:  1.4, label: '컴퓨터',   count: 60,  color: 0x4466ff },
      { x: -5.2, z: -2.5, label: '책장',     count: 55,  color: 0xcc9944 },
      { x: -5.6, z:  5.2, label: '화장실',   count: 70,  color: 0x88ff99 },
      { x:  4.9, z:  5.1, label: '라면박스', count: 85,  color: 0xff4422 },
      { x: -1.5, z:  3.5, label: '옷더미',   count: 75,  color: 0x6688aa },
      { x: -5.2, z: -5.5, label: '싱크대',   count: 75,  color: 0x888870 },
    ]; // 합계 500

    this.hidingSpots = spots.map(s => ({
      ...s, remaining: s.count, triggered: false,
      releaseTimer: 0, indicator: null, labelSprite: null,
    }));

    this.hidingSpots.forEach(spot => this._buildSpotIndicator(spot));
  }

  _buildSpotIndicator(spot) {
    // 발광 구체
    const geo = new THREE.SphereGeometry(0.3, 10, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: spot.color, emissive: new THREE.Color(spot.color),
      emissiveIntensity: 1.2, transparent: true, opacity: 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(spot.x, 1.8, spot.z);
    this.scene.add(mesh);
    spot.indicator = mesh;
    this._spotMeshes.push(mesh);

    // 라벨 스프라이트
    const c = document.createElement('canvas');
    c.width = 256; c.height = 80;
    this._drawSpotLabel(c, spot);
    const tex = new THREE.CanvasTexture(c);
    const smat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(smat);
    sprite.scale.set(1.6, 0.5, 1);
    sprite.position.set(spot.x, 2.4, spot.z);
    this.scene.add(sprite);
    spot.labelSprite = sprite;
    this._spotMeshes.push(sprite);
  }

  _drawSpotLabel(canvas, spot) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4;
    ctx.strokeText(`${spot.label}`, 128, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${spot.label}`, 128, 28);
    ctx.font = 'bold 28px Arial';
    const pct = spot.remaining / spot.count;
    ctx.fillStyle = pct > 0.5 ? '#ffdd44' : pct > 0.2 ? '#ff8822' : '#ff3333';
    ctx.strokeText(`🪳 ${spot.remaining}`, 128, 62);
    ctx.fillText(`🪳 ${spot.remaining}`, 128, 62);
  }

  _updateSpotIndicator(spot) {
    if (!spot.labelSprite?.material?.map) return;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 80;
    this._drawSpotLabel(c, spot);
    spot.labelSprite.material.map.dispose();
    spot.labelSprite.material.map = new THREE.CanvasTexture(c);
    // 색 변화
    const pct = spot.remaining / spot.count;
    if (spot.indicator) {
      const col = pct > 0.5 ? 0x99ccff : pct > 0.2 ? 0xff8822 : 0xff2200;
      spot.indicator.material.color.set(col);
      spot.indicator.material.emissive.set(col);
    }
    if (spot.remaining <= 0) {
      this.scene.remove(spot.indicator);
      this.scene.remove(spot.labelSprite);
    }
  }

  _setupLights() {
    // ── 앰비언트: 아주 낮게 — 어두운 공포 분위기
    const ambient = new THREE.AmbientLight(0xf5e8c0, 4.5);
    this.scene.add(ambient);

    // ── 메인 형광등: 깜빡이는 차가운 흰빛 ──
    this.ceilingLight = new THREE.PointLight(0xfff5e0, 12.0, 40);
    this.ceilingLight.position.set(0, 4.5, -1);
    this.ceilingLight.castShadow = true;
    this.ceilingLight.shadow.mapSize.width  = 512;
    this.ceilingLight.shadow.mapSize.height = 512;
    this.ceilingLight.shadow.camera.near = 0.5;
    this.ceilingLight.shadow.camera.far  = 28;
    this.ceilingLight.shadow.bias = -0.001;
    this.scene.add(this.ceilingLight);

    // 형광등 발광체 제거됨 (눈부심 방지)

    // ── 보조 천장등 ──
    const ceilingLight2 = new THREE.PointLight(0xfff0d8, 8.0, 38);
    ceilingLight2.position.set(0, 4.5, 3.5);
    this.scene.add(ceilingLight2);

    // ── 화장실 — 썩은 초록 형광등 ──
    const bathLight = new THREE.PointLight(0x88ff99, 2.8, 8);
    bathLight.position.set(-5.2, 2.8, 5);
    this.scene.add(bathLight);
    const bathTubeGeo = new THREE.BoxGeometry(0.8, 0.08, 0.12);
    const bathTubeMat = new THREE.MeshStandardMaterial({ color: 0x88ff99, emissive: 0x44aa66, emissiveIntensity: 2 });
    const bathTube = new THREE.Mesh(bathTubeGeo, bathTubeMat);
    bathTube.position.set(-5.4, WALL_H - 0.1, 5.0);
    this.scene.add(bathTube);

    // ── 냉장고 — 차갑고 파란 빛 ──
    this.fridgeLight = new THREE.PointLight(0x99ccff, 3.2, 7);
    this.fridgeLight.position.set(5.4, 1.0, -5.2);
    this.scene.add(this.fridgeLight);

    // ── 모니터 — 파란 글로우 ──
    this.monitorLight = new THREE.PointLight(0x4466ff, 2.8, 5.5);
    this.monitorLight.position.set(3.0, 1.2, 1.4);
    this.scene.add(this.monitorLight);
    // 모니터 화면 자체 발광
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x112244,
      emissive: 0x2244aa,
      emissiveIntensity: 1.5,
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.85), screenMat);
    screen.position.set(3.0, 1.05, 1.35);
    this.scene.add(screen);

    // ── 따뜻한 오렌지 보조광 (라면박스 쪽) ──
    const warmLight = new THREE.PointLight(0xff6622, 1.8, 8);
    warmLight.position.set(4.5, 1.5, 4.5);
    this.scene.add(warmLight);

    // 깜빡임 내부 상태
    this._flickerTime   = 0;
    this._flickerBase   = 12.0;
    this._monitorPhase  = Math.random() * Math.PI * 2;
    this._fridgePhase   = Math.random() * Math.PI * 2;
  }

  // ── 부유 먼지 파티클 ────────────────────────────────────────────
  _addDustParticles() {
    const COUNT  = 20;
    const GEO    = new THREE.SphereGeometry(0.025, 4, 4);
    for (let i = 0; i < COUNT; i++) {
      const brightness = 0.7 + Math.random() * 0.3;
      const mat  = new THREE.MeshBasicMaterial({
        color: new THREE.Color(brightness * 0.9, brightness * 0.8, brightness * 0.55),
        transparent: true,
        opacity: 0.08 + Math.random() * 0.12,
      });
      const mesh = new THREE.Mesh(GEO, mat);
      const half = ROOM_SIZE / 2 - 0.8;
      mesh.position.set(
        (Math.random() - 0.5) * half * 2,
        0.3 + Math.random() * 2.2,
        (Math.random() - 0.5) * half * 2,
      );
      mesh.userData = {
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.02,
        vz: (Math.random() - 0.5) * 0.08,
        phase: Math.random() * Math.PI * 2,
        baseOpacity: mat.opacity,
      };
      this.scene.add(mesh);
      this._dustParticles.push(mesh);
    }
  }

  _setupControls() {
    window.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('keyup', this._boundKeyUp);
    this.canvas.addEventListener('mousemove', this._boundMouseMove);
    this.canvas.addEventListener('click', this._boundClick);
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
    if (e.code === 'KeyQ') this._cycleWeapon();
    if (e.code === 'KeyE') this._startAttack();
    if (e.code === 'KeyB') this.onEvent?.('openShop');
    e.preventDefault?.();
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
    if (e.code === 'KeyE') this.sprayHeld = false;
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePos.x = e.clientX - rect.left;
    this.mousePos.y = e.clientY - rect.top;
  }

  _onClick(e) {
    this._startAttack();
  }

  _cycleWeapon() {
    const idx = this.weaponSlots.indexOf(this.currentWeapon);
    this.currentWeapon = this.weaponSlots[(idx + 1) % this.weaponSlots.length];
    this._updateWeaponMesh();
    this._buildRangeIndicator(); // 범위 링도 갱신
    this._pushState();
  }

  _startAttack() {
    if (this.attackCooldown > 0 && this.currentWeapon !== 'spray') return;
    if (this.currentWeapon === 'spray') {
      if (this.sprayRecharging || this.sprayEnergy <= 0) return; // 충전 중엔 사용 불가
      this.sprayHeld = true;
      return;
    }
    this.isAttacking = true;
    const weapon = WEAPONS[this.currentWeapon];
    this.attackCooldown = weapon.cooldown / 1000;
    this._doAttack();
  }

  _doAttack() {
    const weapon = WEAPONS[this.currentWeapon];
    const px = this.playerPos.x;
    const pz = this.playerPos.z;

    let killed = 0;
    this.cockroaches.forEach(c => {
      if (c.dead) return;
      const dx = c.group.position.x - px;
      const dz = c.group.position.z - pz;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist <= weapon.range) {
        const died = c.takeDamage(weapon.damage);
        if (died) {
          this._killCockroach(c);
          killed++;
        } else {
          this.sound.hit();
        }
      }
    });

    // Attack visual flash
    this._spawnAttackVisual(px, pz, weapon.range, weapon.color);
  }

  _doSprayAttack() {
    const weapon = WEAPONS.spray;
    const px = this.playerPos.x;
    const pz = this.playerPos.z;

    // 360° 원형 범위 — 반경 내 모든 바퀴에 지속 데미지
    this.cockroaches.forEach(c => {
      if (c.dead) return;
      const dx = c.group.position.x - px;
      const dz = c.group.position.z - pz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > weapon.range) return;

      c.stunTimer = Math.max(c.stunTimer, 0.1);
      const died = c.takeDamage(weapon.damage * 0.1);
      if (died) this._killCockroach(c);
    });
    this.sound.spray();
  }

  _spawnAttackVisual(x, z, range, color) {
    // 충격파 원 (빠르게 확장하며 사라짐)
    const geo = new THREE.RingGeometry(range * 0.3, range, 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI/2;
    ring.position.set(x, 0.06, z);
    ring.userData.life = 0.3;
    this.scene.add(ring);
    this._attackVisuals = this._attackVisuals || [];
    this._attackVisuals.push(ring);

    // 무기별 추가 이펙트
    if (this.currentWeapon === 'frypan') {
      // 후라이팬 - 큰 호 이펙트
      const arcGeo = new THREE.RingGeometry(range * 0.7, range * 1.05, 32, 1, -Math.PI*0.4, Math.PI*0.8);
      const arcMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
      const arc = new THREE.Mesh(arcGeo, arcMat);
      arc.rotation.x = -Math.PI/2;
      arc.rotation.z = this.playerGroup.rotation.y;
      arc.position.set(x, 0.08, z);
      arc.userData.life = 0.35;
      this.scene.add(arc);
      this._attackVisuals.push(arc);
    }
  }

  // ─── 부유 텍스트 스프라이트 ─────────────────────────────────────
  _spawnFloatText(x, z, text, color = '#ffff00', scale = 1.0) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 96;
    const ctx = c.getContext('2d');
    const fontSize = Math.floor(28 * scale);
    ctx.font = `bold ${fontSize}px "Noto Sans KR", Arial`;
    ctx.textAlign = 'center';
    // 외곽선
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 5;
    ctx.strokeText(text, 128, 60);
    // 본문
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 60);

    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4 * scale, 0.52 * scale, 1);
    sprite.position.set(x, 1.2, z);
    sprite.userData = { vy: 1.8 + Math.random() * 0.8, life: 1.0, decay: 0.025 };
    this.scene.add(sprite);
    this._floatTexts = this._floatTexts || [];
    this._floatTexts.push(sprite);
  }

  _killCockroach(roach) {
    const pos = roach.getPos();
    const config = roach.config;

    // Spawn babies if pregnant
    if (roach.type === 'pregnant') {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          if (!this.running) return;
          const baby = this._spawnCockroach('normal',
            pos.x + (Math.random()-0.5)*1.5,
            pos.z + (Math.random()-0.5)*1.5
          );
          if (this.gameMode === 'daysurvival') { baby.fleeMode = true; baby.speed *= 1.25; }
        }, 100 + i * 150);
      }
    }

    roach.die();
    this.particles.spawnSplat(pos.x, pos.z, config.color === 0xffd700 ? 0xffd700 : 0x2a1508);

    // Remove from array
    const idx = this.cockroaches.indexOf(roach);
    if (idx >= 0) this.cockroaches.splice(idx, 1);

    // Reward
    this.killCount++;
    if (this.gameMode === 'daysurvival') this.daySurvivalKilled++;
    this.money += config.reward;
    this.score += config.reward * (1 + Math.floor(this.combo / 3));

    // Combo
    this.combo++;
    this.comboTimer = 3.0;

    // 부유 텍스트 — +귗 & 콤보 텍스트
    this._spawnFloatText(pos.x, pos.z, `+${config.reward}귗`, '#ffd700');

    const hitWords = ['찰싹!', '쾅!', '퍽!', '작살!'];
    this._spawnFloatText(pos.x + (Math.random()-0.5)*0.8, pos.z + (Math.random()-0.5)*0.8,
      hitWords[Math.floor(Math.random()*hitWords.length)], '#ffffff');

    let comboText = null;
    if (this.combo >= 10) comboText = 'MASSACRE!!';
    else if (this.combo >= 5) comboText = 'DOUBLE CRUSH!!';
    else if (this.combo >= 3) comboText = 'CLEAN KILL!';
    else if (this.combo >= 2) comboText = 'PERFECT!';
    if (comboText) {
      this._spawnFloatText(pos.x, pos.z + 0.6, comboText, '#ff6600', 1.4);
      this.onEvent?.('combo', { combo: this.combo, text: comboText });
    }

    this.sound.kill();
    if (config.color === 0xffd700) this.sound.golden();

    // 카메라 셰이크: 보스급일수록 강하게
    const shakePow = roach.type === 'giant'  ? 0.55
                   : roach.type === 'mutant' ? 0.35
                   : roach.type === 'tank'   ? 0.22
                   : 0.12;
    this._triggerCameraShake(shakePow);

    this.onEvent?.('kill', { type: roach.type, reward: config.reward, killCount: this.killCount });

    // 0.1% 확률 점프스케어
    if (Math.random() < 0.001) {
      this.onEvent?.('jumpscare');
    }

    this._pushState();

    // Achievements
    if (this.killCount === 1)    this.onEvent?.('achievement', '첫 압살');
    if (this.killCount === 100)  this.onEvent?.('achievement', '바퀴와의 전쟁');
    if (this.killCount === 1000) this.onEvent?.('achievement', '1000마리 박멸');
    if (this.money >= 10000)     this.onEvent?.('achievement', '월세의 지배자');
  }

  // ─── SPAWNING ────────────────────────────────────────────────────
  _spawnCockroach(type, x, z) {
    // Apply upgrades
    let spawnX = x ?? this._randomSpawnX();
    let spawnZ = z ?? this._randomSpawnZ();

    const roach = new Cockroach(this.scene, type, spawnX, spawnZ, this.cockroachIdCounter++);

    // Apply LED light upgrade (speed reduction)
    if (this.upgrades.ledLight > 0) {
      roach.speed *= (1 - this.upgrades.ledLight * 0.08);
    }
    // Apply aircon (HP reduction)
    if (this.upgrades.aircon > 0) {
      roach.hp = Math.max(1, roach.hp - this.upgrades.aircon);
    }

    this.cockroaches.push(roach);
    return roach;
  }

  _randomSpawnX() {
    const zone = SPAWN_ZONES[Math.floor(Math.random() * SPAWN_ZONES.length)];
    return zone.x + (Math.random() - 0.5) * 1.5;
  }
  _randomSpawnZ() {
    const zone = SPAWN_ZONES[Math.floor(Math.random() * SPAWN_ZONES.length)];
    return zone.z + (Math.random() - 0.5) * 1.5;
  }

  _getWaveSpawnConfig() {
    const w = this.wave;
    const configs = [];

    // 웨이브 수 증가 — 뒤로 갈수록 더 많이
    const count = 4 + w * 3;

    for (let i = 0; i < count; i++) {
      let type = 'normal';
      const r = Math.random();

      // 웨이브가 높을수록 강한 바퀴 확률 급격히 증가
      // 각 웨이브에서 강한 종류가 나올 누적 확률 (내림차순으로 체크)
      const giantChance   = Math.min(0.02, 0.002 * (w - 4));       // w≥5부터
      const mutantChance  = Math.min(0.15, 0.015 * (w - 3));       // w≥4부터
      const ninjaChance   = Math.min(0.20, 0.025 * (w - 2));       // w≥3부터
      const tankChance    = Math.min(0.22, 0.030 * (w - 2));       // w≥3부터
      const flyingChance  = Math.min(0.18, 0.025 * (w - 1));       // w≥2부터
      const pregChance    = Math.min(0.20, 0.040 * (w - 1));       // w≥2부터
      const zigzagChance  = Math.min(0.30, 0.060 * w);             // w≥1부터
      const goldenChance  = Math.min(0.05, 0.008 * w);             // 황금바퀴

      // 우선순위 순서로 체크 (강한 것부터)
      if (w >= 5 && r < giantChance)                 type = 'giant';
      else if (w >= 4 && r < mutantChance)            type = 'mutant';
      else if (w >= 3 && r < ninjaChance)             type = 'ninja';
      else if (w >= 3 && r < tankChance)              type = 'tank';
      else if (w >= 2 && r < flyingChance)            type = 'flying';
      else if (w >= 2 && r < pregChance)              type = 'pregnant';
      else if (r < zigzagChance)                      type = 'zigzag';
      else if (r < goldenChance)                      type = 'golden';

      configs.push(type);
    }

    // 황금바퀴: 냉장고 업그레이드 보너스
    if (this.upgrades.newFridge > 0 && Math.random() < 0.1 * this.upgrades.newFridge) {
      configs.push('golden');
    }

    return configs;
  }

  _triggerWave() {
    this.wave++;
    const types = this._getWaveSpawnConfig();

    types.forEach((type, i) => {
      setTimeout(() => {
        if (!this.running) return;
        this._spawnCockroach(type);
      }, i * 200);
    });

    this.sound.wave();
    this.sound.setTension(this.wave);
    this.onEvent?.('wave', { wave: this.wave, count: types.length });
    this._pushState();
  }

  // ─── CRISIS EVENTS ───────────────────────────────────────────────
  _triggerCrisis() {
    const crises = ['lights_out', 'roach_surge', 'fridge_explode'];
    this.crisisType = crises[Math.floor(Math.random() * crises.length)];
    this.crisisActive = true;

    if (this.crisisType === 'lights_out') {
      this.ceilingLight.intensity = 0.1;
      this.lightsOut = true; // 3초간 완전 암흑
      this.onEvent?.('crisis', { type: 'lights_out', text: '⚡ 정전!! 불이 꺼졌다!!' });
      setTimeout(() => {
        this.lightsOut = false; // 3초 후 시야 회복
      }, 3000);
      setTimeout(() => {
        this.ceilingLight.intensity = this._flickerBase;
        this.crisisActive = false;
      }, 5000);
    }

    if (this.crisisType === 'roach_surge') {
      this.onEvent?.('crisis', { type: 'roach_surge', text: '🪳🪳 바퀴 대습격!! 🪳🪳' });
      for (let i = 0; i < 8 + this.wave; i++) {
        setTimeout(() => {
          if (!this.running) return;
          this._spawnCockroach('normal');
        }, i * 150);
      }
      setTimeout(() => { this.crisisActive = false; }, 3000);
    }

    if (this.crisisType === 'fridge_explode') {
      this.onEvent?.('crisis', { type: 'fridge_explode', text: '💥 냉장고 폭발!! 바퀴가 쏟아진다!!' });
      this.particles.spawnSplat(5, -5, 0x888888);
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (!this.running) return;
          this._spawnCockroach(Math.random() < 0.3 ? 'flying' : 'normal');
        }, i * 100);
      }
      setTimeout(() => { this.crisisActive = false; }, 2000);
    }

    this.crisisTimer = 45 + Math.random() * 30;
  }

  // ─── AUTO SYSTEMS (upgrades) ─────────────────────────────────────
  _updateAutoSystems(dt) {
    // Auto insecticide aura
    if (this.upgrades.insecticide > 0) {
      this.autoSprayTimer -= dt;
      if (this.autoSprayTimer <= 0) {
        this.autoSprayTimer = 1.0;
        const dmg = this.upgrades.insecticide * 2;
        this.cockroaches.forEach(c => {
          if (c.dead) return;
          const dx = c.group.position.x - this.playerPos.x;
          const dz = c.group.position.z - this.playerPos.z;
          if (Math.sqrt(dx*dx + dz*dz) < 2.0) {
            const died = c.takeDamage(dmg);
            if (died) this._killCockroach(c);
          }
        });
      }
    }

    // Cat auto-hunter
    if (this.upgrades.cat > 0) {
      this.catTimer -= dt;
      if (this.catTimer <= 0) {
        this.catTimer = 3.0 / this.upgrades.cat;
        // Find nearest roach and kill it
        let nearest = null, nearDist = Infinity;
        this.cockroaches.forEach(c => {
          if (c.dead) return;
          const dx = c.group.position.x - this.playerPos.x;
          const dz = c.group.position.z - this.playerPos.z;
          const d = Math.sqrt(dx*dx + dz*dz);
          if (d < nearDist) { nearest = c; nearDist = d; }
        });
        if (nearest && nearDist < 8) {
          const died = nearest.takeDamage(15);
          if (died) this._killCockroach(nearest);
          this.onEvent?.('catAttack', { x: nearest.group?.position.x, z: nearest.group?.position.z });
        }
      }
    }

    // Exterminator periodic mass kill
    if (this.upgrades.exterminator > 0) {
      this.exterminatorTimer -= dt;
      if (this.exterminatorTimer <= 0) {
        this.exterminatorTimer = 60 / this.upgrades.exterminator;
        const toKill = [...this.cockroaches].slice(0, 10);
        toKill.forEach(c => {
          if (!c.dead) this._killCockroach(c);
        });
        this.onEvent?.('exterminator');
      }
    }
  }

  // ─── PLAYER HP DAMAGE ────────────────────────────────────────────
  _checkPlayerCollisions() {
    const px = this.playerPos.x;
    const pz = this.playerPos.z;

    this.cockroaches.forEach(c => {
      if (c.dead) return;
      const dx = c.group.position.x - px;
      const dz = c.group.position.z - pz;
      const dist = Math.sqrt(dx*dx + dz*dz);
      const hitRadius = 0.5 + c.config.size * 0.5;
      if (dist < hitRadius) {
        if (!c._hitCooldown || c._hitCooldown <= 0) {
          if (!this.godMode && this.gameMode !== 'daysurvival') {
            const dmg = this.gameMode === 'infinite'
              ? (c.type === 'giant' ? 20 : c.type === 'mutant' ? 10 : c.type === 'tank' ? 10 : 5)
              : (c.type === 'giant' ? 10 : c.type === 'mutant' ? 7  : c.type === 'tank' ? 5  : 2);
            this.hp = Math.max(0, this.hp - dmg);
            this.sound.damage();
            this._triggerCameraShake(0.18 + dmg * 0.04);
            this.onEvent?.('damage', { dmg, hp: this.hp });
            this._pushState();
            if (this.hp <= 0) this._triggerGameOver('death');
          }
          c._hitCooldown = 1.0;
        }
        if (c._hitCooldown) c._hitCooldown -= 0.016; // rough dt
      }
      if (c._hitCooldown > 0) c._hitCooldown -= 0.016;
    });
  }

  // ─── GAME OVER / WIN ─────────────────────────────────────────────
  _triggerGameOver(reason) {
    this.running = false;
    this.gameOver = true;
    const finalScore = this.gameMode === 'daysurvival'
      ? 0
      : this.killCount * 10 + this.money * 5;
    this.onEvent?.('gameOver', {
      reason, killCount: this.killCount, money: this.money, wave: this.wave,
      score: finalScore, elapsedTime: Math.floor(this.elapsedTime),
      daySurvivalKilled: this.daySurvivalKilled,
    });
  }

  _triggerWin() {
    this.running = false;
    const finalScore = this.gameMode === 'daysurvival'
      ? Math.max(0, 9999999 - Math.floor(this.elapsedTime * 100))
      : this.killCount * 10 + this.money * 5;
    this.onEvent?.('win', {
      killCount: this.killCount,
      money: this.money,
      wave: this.wave,
      score: finalScore,
      elapsedTime: Math.floor(this.elapsedTime),
      survivalTime: Math.floor(this.elapsedTime),   // 하루살이: 클리어 시간
      daySurvivalKilled: this.daySurvivalKilled,
    });
  }

  // ─── MAIN LOOP ───────────────────────────────────────────────────
  _animate() {
    this._animFrame = requestAnimationFrame(this._animate.bind(this));
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (!this.running || this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.elapsedTime += dt;

    // Timer
    if (this.gameMode !== 'infinite') {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft <= 0) {
        this._triggerWin();
        return;
      }
    }

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this._pushState();
      }
    }

    // Wave system (하루살이 제외)
    if (this.gameMode !== 'daysurvival') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.waveTimer = WAVE_INTERVAL;
        this._triggerWave();
      }
    }

    // Crisis events
    if (!this.crisisActive) {
      this.crisisTimer -= dt;
      if (this.crisisTimer <= 0) this._triggerCrisis();
    }

    // Player movement
    this._updatePlayer(dt);

    // Attack cooldown
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    // Spray attack (hold E) — 에너지 버스트 시스템
    if (this.currentWeapon === 'spray') {
      if (this.sprayHeld && !this.sprayRecharging && this.sprayEnergy > 0) {
        // 에너지 소모: 5초에 1.0 소진 (최대 5초 연사)
        this.sprayEnergy = Math.max(0, this.sprayEnergy - dt / 5);
        if (this.sprayEnergy <= 0) {
          // 에너지 소진 → 강제 충전 모드
          this.sprayHeld = false;
          this.sprayRecharging = true;
        }
        if (this.attackCooldown <= 0) {
          this.attackCooldown = WEAPONS.spray.cooldown / 1000;
          this._doSprayAttack();
        }
      } else {
        // 충전 중: ~3초에 가득 참 (0.33/sec)
        if (this.sprayEnergy < 1.0) {
          this.sprayEnergy = Math.min(1.0, this.sprayEnergy + dt * 0.33);
          if (this.sprayRecharging && this.sprayEnergy >= 1.0) {
            this.sprayRecharging = false; // 완충 시 사용 허용
          }
        }
      }
    }

    // Cockroach updates
    for (let i = this.cockroaches.length - 1; i >= 0; i--) {
      const c = this.cockroaches[i];
      if (!c.dead) c.update(dt, this.playerGroup.position, this.elapsedTime);
    }

    // Particle updates
    this.particles.update(dt);

    // Auto systems
    this._updateAutoSystems(dt);

    // Collision check
    this._checkPlayerCollisions();

    // Attack visual decay
    if (this._attackVisuals) {
      for (let i = this._attackVisuals.length - 1; i >= 0; i--) {
        const v = this._attackVisuals[i];
        v.userData.life -= dt * 5;
        v.material.opacity = v.userData.life * 0.7;
        v.scale.x = v.scale.z = 1 + (1 - v.userData.life) * 0.3;
        if (v.userData.life <= 0) {
          this.scene.remove(v);
          v.geometry.dispose();
          v.material.dispose();
          this._attackVisuals.splice(i, 1);
        }
      }
    }

    // 부유 텍스트 업데이트
    if (this._floatTexts) {
      for (let i = this._floatTexts.length - 1; i >= 0; i--) {
        const s = this._floatTexts[i];
        s.userData.life -= s.userData.decay;
        s.position.y += s.userData.vy * dt;
        s.userData.vy *= 0.94;
        s.material.opacity = s.userData.life;
        if (s.userData.life <= 0) {
          this.scene.remove(s);
          s.material.map?.dispose();
          s.material.dispose();
          this._floatTexts.splice(i, 1);
        }
      }
    }

    // ── 범위 링 위치 + 맥박 애니메이션 ──
    if (this.rangeRing) {
      this.rangeRing.position.x = this.playerPos.x;
      this.rangeRing.position.z = this.playerPos.z;
      const pulse = 0.25 + Math.sin(this.elapsedTime * 3) * 0.08;
      if (this.currentWeapon === 'spray') {
        // 에너지 잔량으로 밝기 표시 + 충전 중 깜빡임
        const flickr = this.sprayRecharging ? (Math.sin(this.elapsedTime * 8) * 0.5 + 0.5) * 0.15 : 0;
        this.rangeRing.material.opacity = this.sprayEnergy * 0.5 + flickr;
      } else {
        const coolPct = this.attackCooldown / (WEAPONS[this.currentWeapon]?.cooldown / 1000 || 1);
        this.rangeRing.material.opacity = coolPct > 0 ? 0.15 + (1 - coolPct) * 0.4 : pulse;
      }
    }

    // ── 하루살이: 은신처 → 바퀴 방출 ──
    if (this.gameMode === 'daysurvival') {
      for (const spot of this.hidingSpots) {
        if (spot.remaining <= 0) continue;
        const sdx = this.playerPos.x - spot.x;
        const sdz = this.playerPos.z - spot.z;
        const sdist = Math.sqrt(sdx * sdx + sdz * sdz);
        if (sdist < 3.5) spot.triggered = true;
        if (!spot.triggered) continue;
        spot.releaseTimer -= dt;
        if (spot.releaseTimer <= 0) {
          const batch = Math.min(3, spot.remaining);
          for (let i = 0; i < batch; i++) {
            const r = this._spawnCockroach(
              ['normal','normal','zigzag','pregnant'][Math.floor(Math.random()*4)],
              spot.x + (Math.random() - 0.5) * 2.0,
              spot.z + (Math.random() - 0.5) * 2.0,
            );
            r.fleeMode = true;
            r.speed *= 1.25;
          }
          spot.remaining -= batch;
          spot.releaseTimer = 0.28;
          this._updateSpotIndicator(spot);
        }
      }
      // 지표 발광 펄스
      this.hidingSpots.forEach(spot => {
        if (spot.indicator) {
          spot.indicator.position.y = 1.8 + Math.sin(this.elapsedTime * 2.5) * 0.12;
          spot.indicator.material.emissiveIntensity = 0.9 + Math.sin(this.elapsedTime * 3) * 0.4;
        }
      });
      // 500마리 달성 → 클리어
      if (this.daySurvivalKilled >= this.daySurvivalTarget && this.running) {
        this._triggerWin();
      }
    }

    // ── 상시 소량 스폰 (웨이브 외, 하루살이 제외) ──
    if (this.gameMode !== 'daysurvival') this.ambientSpawnTimer -= dt;
    if (this.gameMode !== 'daysurvival' && this.ambientSpawnTimer <= 0) {
      const maxAmbient = 3 + Math.floor(this.wave * 0.5); // 웨이브 오를수록 더 많이 상시 유지
      if (this.cockroaches.length < maxAmbient) {
        const types = ['normal', 'normal', 'normal', 'zigzag'];
        if (this.wave >= 3) types.push('pregnant');
        const t = types[Math.floor(Math.random() * types.length)];
        this._spawnCockroach(t);
      }
      // 스폰 간격: 파업 중 5~8초, 웨이브 후엔 점점 빨라짐
      this.ambientSpawnTimer = Math.max(3, 8 - this.wave * 0.3);
    }

    // Camera follow player
    const camTarget = new THREE.Vector3(
      this.playerGroup.position.x,
      0,
      this.playerGroup.position.z
    );
    this.camera.position.x += (camTarget.x - (this.camera.position.x - 0)) * 0.08;
    this.camera.position.z += (camTarget.z + 8 - this.camera.position.z) * 0.08;
    this.camera.lookAt(this.camera.position.x, 0, this.camera.position.z - 8);

    // Day survival: cleanliness drops
    if (this.gameMode === 'daysurvival') {
      this.cleanliness = Math.max(0, this.cleanliness - dt * 0.5 * (this.cockroaches.length * 0.1 + 0.5));
      if (this.cleanliness <= 0) {
        // Spawn extra roaches
        if (Math.random() < dt * 2) this._spawnCockroach('normal');
      }
    }

    // Light flicker during lights_out crisis
    if (this.crisisActive && this.crisisType === 'lights_out') {
      this.ceilingLight.intensity = 0.05 + Math.random() * 0.15;
    }

    // Weapon bob animation
    if (this.weaponMesh) {
      this.weaponMesh.rotation.z = Math.sin(this.elapsedTime * 3) * 0.1;
    }

    // ── 부유 먼지 파티클 업데이트 ──
    const half = ROOM_SIZE / 2 - 0.8;
    for (const p of this._dustParticles) {
      const d = p.userData;
      p.position.x += d.vx * dt;
      p.position.y += d.vy * dt + Math.sin(this.elapsedTime * 0.4 + d.phase) * 0.005;
      p.position.z += d.vz * dt;
      // 바운드
      if (p.position.x >  half) { p.position.x =  half; d.vx *= -1; }
      if (p.position.x < -half) { p.position.x = -half; d.vx *= -1; }
      if (p.position.y > 2.5)   { p.position.y = 2.5;   d.vy *= -1; }
      if (p.position.y < 0.2)   { p.position.y = 0.2;   d.vy *= -1; }
      if (p.position.z >  half) { p.position.z =  half; d.vz *= -1; }
      if (p.position.z < -half) { p.position.z = -half; d.vz *= -1; }
      // 깜빡임
      p.material.opacity = d.baseOpacity * (0.7 + Math.sin(this.elapsedTime * 1.2 + d.phase) * 0.3);
    }

    // ── 조명 깜빡임 ──
    this._flickerTime += dt;
    if (this.ceilingLight && !(this.crisisActive && this.crisisType === 'lights_out')) {
      // 미세한 랜덤 깜빡임 (형광등 노화 효과)
      const noise = Math.sin(this._flickerTime * 17.3) * 0.08
                  + Math.sin(this._flickerTime * 5.7)  * 0.04
                  + (Math.random() < 0.008 ? (Math.random() - 0.5) * 1.5 : 0);
      this.ceilingLight.intensity = this._flickerBase + noise;
    }
    if (this.monitorLight) {
      this.monitorLight.intensity = 2.8 + Math.sin(this.elapsedTime * 2.3 + this._monitorPhase) * 0.6;
    }
    if (this.fridgeLight) {
      this.fridgeLight.intensity = 3.2 + Math.sin(this.elapsedTime * 0.8 + this._fridgePhase) * 0.4;
    }

    // ── 카메라 셰이크 ──
    if (this._shakeTimer > 0) {
      this._shakeTimer -= dt;
      const s = this._shakePower * Math.max(0, this._shakeTimer / 0.3);
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.4;
      this.camera.position.z += (Math.random() - 0.5) * s * 0.3;
    }

    // ── 비네팅 그레인 시간 업데이트 ──
    if (this._vigPass) {
      this._vigPass.uniforms.grainTime.value = this.elapsedTime * 13.7;
    }

    // ── 렌더 ──
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    // Push state every 10 frames
    if (Math.floor(this.elapsedTime * 60) % 10 === 0) {
      this._pushState();
    }
  }

  // ── 카메라 셰이크 트리거 ─────────────────────────────────────────
  _triggerCameraShake(power = 0.25) {
    if (power > this._shakePower || this._shakeTimer <= 0) {
      this._shakePower = power;
      this._shakeTimer = Math.min(0.35, power * 1.2);
    }
  }

  _updatePlayer(dt) {
    let mx = 0, mz = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp'])    mz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  mz += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;

    const len = Math.sqrt(mx*mx + mz*mz);
    if (len > 0) {
      mx /= len; mz /= len;
      const newX = this.playerGroup.position.x + mx * PLAYER_SPEED * dt;
      const newZ = this.playerGroup.position.z + mz * PLAYER_SPEED * dt;
      const half = ROOM_SIZE/2 - 0.5;
      this.playerGroup.position.x = Math.max(-half, Math.min(half, newX));
      this.playerGroup.position.z = Math.max(-half, Math.min(half, newZ));

      // Face direction
      const angle = Math.atan2(mx, mz);
      this.playerGroup.rotation.y += (angle - this.playerGroup.rotation.y) * 0.12;

      // Step animation
      this.player.position.y = 0.6 + Math.abs(Math.sin(this.elapsedTime * 8)) * 0.05;
    }

    this.playerPos.x = this.playerGroup.position.x;
    this.playerPos.z = this.playerGroup.position.z;
  }

  // ─── UPGRADES ────────────────────────────────────────────────────
  applyUpgrade(key) {
    // 소모품: 초콜릿 (레벨 없이 매번 3000귗에 HP +5)
    if (key === 'chocolate') {
      if (this.money < 3000) return false;
      if (this.hp >= this.maxHp) return false;
      this.money -= 3000;
      this.hp = Math.min(this.maxHp, this.hp + 5);
      this.sound.upgrade();
      this._pushState();
      return true;
    }

    const cost = this._getUpgradeCost(key);
    if (this.money < cost) return false;
    this.money -= cost;
    this.upgrades[key] = (this.upgrades[key] || 0) + 1;
    this.sound.upgrade();
    this._pushState();

    // Visual effects for upgrades
    if (key === 'newFloor') {
      // Lighten floor
      const floor = this.roomMeshes[0];
      if (floor) floor.material.color.set(0xe8cf5a);
    }
    if (key === 'ledLight') {
      this.ceilingLight.color.set(0xffffff);
      this.ceilingLight.intensity = 2.0;
    }
    if (key === 'cat') {
      this._spawnCatNPC();
    }
    return true;
  }

  _spawnCatNPC() {
    const catGroup = new THREE.Group();
    const bodyGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xff8c00 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    catGroup.add(body);
    // Ears
    for (let s of [-1, 1]) {
      const earGeo = new THREE.ConeGeometry(0.1, 0.2, 4);
      const ear = new THREE.Mesh(earGeo, bodyMat);
      ear.position.set(s * 0.2, 0.35, 0);
      catGroup.add(ear);
    }
    catGroup.position.set(Math.random()*6-3, 0.3, Math.random()*6-3);
    this.scene.add(catGroup);
    this.npcs.push({ mesh: catGroup, type: 'cat' });
  }

  _getUpgradeCost(key) {
    const level = this.upgrades[key] || 0;
    const baseCosts = {
      newFloor: 300, insecticide: 200, newFridge: 500,
      ledLight: 250, aircon: 400, cat: 5000, exterminator: 10000,
    };
    return (baseCosts[key] || 500) * Math.pow(2, level);
  }

  // ─── 무기 구매 ────────────────────────────────────────────────────
  WEAPON_PRICES = { chopstick: 500, frypan: 1500, spray: 5000 };

  buyWeapon(key) {
    if (this.ownedWeapons.has(key)) return false;
    const price = this.WEAPON_PRICES[key];
    if (!price || this.money < price) return false;
    this.money -= price;
    this.ownedWeapons.add(key);
    this.weaponSlots = ['slipper', 'chopstick', 'frypan', 'spray'].filter(w => this.ownedWeapons.has(w));
    this.sound.upgrade();
    this._pushState();
    return true;
  }

  getWeaponShopInfo() {
    return Object.entries(WEAPONS).map(([key, w]) => ({
      key,
      name: w.name,
      emoji: w.emoji,
      price: this.WEAPON_PRICES[key] || 0,
      owned: this.ownedWeapons.has(key),
      range: w.range,
      damage: w.damage,
      cooldown: w.cooldown,
    }));
  }

  getUpgradeInfo() {
    return {
      chocolate: { key: 'chocolate', name: '달콤한 초콜릿', emoji: '🍫', desc: 'HP +5 즉시 회복', cost: 3000, level: 0, consumable: true, disabled: this.hp >= this.maxHp },
      newFloor: { name: '새 장판', emoji: '🏠', desc: '바퀴벌레 생성 1% 감소', cost: this._getUpgradeCost('newFloor'), level: this.upgrades.newFloor },
      insecticide: { name: '살충제 설치', emoji: '💨', desc: '자동 범위 데미지', cost: this._getUpgradeCost('insecticide'), level: this.upgrades.insecticide },
      newFridge: { name: '냉장고 교체', emoji: '🧊', desc: '희귀 바퀴 출현↑', cost: this._getUpgradeCost('newFridge'), level: this.upgrades.newFridge },
      ledLight: { name: 'LED 조명', emoji: '💡', desc: '바퀴 이동속도 -8%', cost: this._getUpgradeCost('ledLight'), level: this.upgrades.ledLight },
      aircon: { name: '에어컨', emoji: '❄️', desc: '모든 바퀴 HP -1', cost: this._getUpgradeCost('aircon'), level: this.upgrades.aircon },
      cat: { name: '고양이 입양', emoji: '🐱', desc: '자동 사냥꾼', cost: this._getUpgradeCost('cat'), level: this.upgrades.cat },
      exterminator: { name: '방역업체', emoji: '🧹', desc: '주기적 광역 제거', cost: this._getUpgradeCost('exterminator'), level: this.upgrades.exterminator },
    };
  }

  // ─── NPC HELPERS (숨은고수) ──────────────────────────────────────
  hireNPC(npcKey) {
    const npcCosts = { kimBangnyeok: 1500, sprayHalbe: 8000, militaryUncle: 1600, catLady: 10000 };
    const cost = npcCosts[npcKey] || 500;
    if (this.money < cost) return false;
    this.money -= cost;

    const effects = {
      kimBangnyeok: () => { this.cockroaches.slice(0, 5).forEach(c => { if (!c.dead) this._killCockroach(c); }); },
      jangpanDosa:  () => { this.cockroaches.forEach(c => { c.mesh.material.emissive = new THREE.Color(0x00ff00); setTimeout(() => { if(c.mesh) c.mesh.material.emissive = new THREE.Color(0); }, 2000); }); },
      sprayHalbe:   () => { this.cockroaches.slice(0, 20).forEach(c => { if (!c.dead) this._killCockroach(c); }); },
      militaryUncle:() => { WEAPONS.slipper.damage *= 1.1; WEAPONS.slipper.range *= 1.2; },
      catLady:      () => { this.upgrades.cat = (this.upgrades.cat || 0) + 2; this._spawnCatNPC(); this._spawnCatNPC(); },
    };

    if (effects[npcKey]) effects[npcKey]();

    // 고용 이펙트: 3D 사람 5초간 등장
    this._spawnHelperNPC(npcKey);

    this.sound.upgrade();
    this._pushState();
    this.onEvent?.('npcHired', { npcKey });
    return true;
  }

  // 숨은고수 고용 시 3D 사람 소환 (5초 후 페이드아웃)
  _spawnHelperNPC(npcKey) {
    const configs = {
      kimBangnyeok:  { shirtColor: 0x2255aa, pantsColor: 0x222222, skinColor: 0xf5c49a },
      jangpanDosa:   { shirtColor: 0x6633aa, pantsColor: 0x1a1a1a, skinColor: 0xf0c090 },
      sprayHalbe:    { shirtColor: 0x228833, pantsColor: 0x333333, skinColor: 0xe8b870 },
      militaryUncle: { shirtColor: 0x445533, pantsColor: 0x334422, skinColor: 0xd4a060 },
      catLady:       { shirtColor: 0xcc4488, pantsColor: 0x442244, skinColor: 0xf5d0a0 },
    };
    const cfg = configs[npcKey] || configs.kimBangnyeok;

    const group = new THREE.Group();
    const mats = {
      skin:  new THREE.MeshStandardMaterial({ color: cfg.skinColor, roughness: 0.8 }),
      shirt: new THREE.MeshStandardMaterial({ color: cfg.shirtColor, roughness: 0.9 }),
      pants: new THREE.MeshStandardMaterial({ color: cfg.pantsColor, roughness: 0.9 }),
      hair:  new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 1.0 }),
    };

    // 몸통
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.3, 6, 8), mats.shirt);
    torso.position.y = 0.55; group.add(torso);
    // 머리
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), mats.skin);
    head.position.y = 1.05; group.add(head);
    // 머리카락
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.hair);
    hair.position.y = 1.07; group.add(hair);
    // 다리 2개
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.28, 4, 6), mats.pants);
      leg.position.set(side * 0.1, 0.18, 0); group.add(leg);
    }

    // 랜덤 위치 (플레이어 근처)
    const px = this.playerPos.x + (Math.random() - 0.5) * 3;
    const pz = this.playerPos.z + (Math.random() - 0.5) * 3;
    group.position.set(
      Math.max(-5, Math.min(5, px)),
      0,
      Math.max(-5, Math.min(5, pz))
    );
    group.scale.set(1.2, 1.2, 1.2);
    this.scene.add(group);

    // 5초 후 페이드아웃 후 제거
    let elapsed = 0;
    const DURATION = 5.0;
    const FADE_START = 4.0;
    const allMats = Object.values(mats);
    allMats.forEach(m => { m.transparent = true; m.opacity = 1; });

    const tick = () => {
      if (!this.running) { this.scene.remove(group); return; }
      elapsed += 0.016;
      if (elapsed >= FADE_START) {
        const t = (elapsed - FADE_START) / (DURATION - FADE_START);
        const opacity = Math.max(0, 1 - t);
        allMats.forEach(m => { m.opacity = opacity; });
      }
      if (elapsed >= DURATION) {
        this.scene.remove(group);
        allMats.forEach(m => m.dispose());
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ─── PUBLIC API ──────────────────────────────────────────────────
  pause()  { this.paused = true; }
  resume() { this.paused = false; }

  resize(w, h) {
    if (!this.renderer || !this.camera) return;
    this.renderer.setSize(w, h);
    if (this.composer) this.composer.setSize(w, h);
    const aspect = w / h;
    const viewSize = 5.5;
    this.camera.left   = -viewSize * aspect;
    this.camera.right  =  viewSize * aspect;
    this.camera.top    =  viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
  }

  getState() {
    return {
      hp: this.hp, maxHp: this.maxHp,
      timeLeft: this.timeLeft,
      killCount: this.killCount,
      money: this.money,
      combo: this.combo,
      wave: this.wave,
      score: this.score,
      currentWeapon: this.currentWeapon,
      weaponSlots: this.weaponSlots,
      ownedWeapons: [...this.ownedWeapons],
      upgrades: { ...this.upgrades },
      attackCooldown: this.attackCooldown,
      roachCount: this.cockroaches.length,
      playerPos: this.player ? { x: this.player.position.x, z: this.player.position.z } : { x: 0, z: 0 },
      roachPositions: this.cockroaches.map(r => ({ x: r.mesh.position.x, z: r.mesh.position.z, type: r.type })),
      daySurvivalKilled: this.daySurvivalKilled,
      daySurvivalTarget: this.daySurvivalTarget,
      hidingSpotsLeft: this.hidingSpots.filter(s => s.remaining > 0).length,
      elapsedTime: Math.floor(this.elapsedTime),
      sprayEnergy: this.sprayEnergy ?? 1.0,
      sprayRecharging: this.sprayRecharging ?? false,
      lightsOut: this.lightsOut ?? false,
    };
  }

  _pushState() {
    this.onStateUpdate?.(this.getState());
  }

  destroy() {
    this.running = false;
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup', this._boundKeyUp);
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this._boundMouseMove);
      this.canvas.removeEventListener('click', this._boundClick);
    }
    this.cockroaches.forEach(c => c.die());
    this.cockroaches = [];
    // 부유 텍스트 정리
    this._floatTexts?.forEach(s => { this.scene?.remove(s); s.material?.map?.dispose(); s.material?.dispose(); });
    this._floatTexts = [];
    this._attackVisuals?.forEach(v => { this.scene?.remove(v); v.geometry?.dispose(); v.material?.dispose(); });
    this._attackVisuals = [];
    if (this.rangeRing) { (this.rangeRingParent || this.scene)?.remove(this.rangeRing); this.rangeRing.geometry?.dispose(); this.rangeRing.material?.dispose(); }
    this.sound.stopBGM();
    this._spotMeshes.forEach(m => { this.scene?.remove(m); m.geometry?.dispose(); m.material?.dispose(); });
    this._spotMeshes = [];
    this._dustParticles.forEach(p => { this.scene?.remove(p); p.material?.dispose(); });
    this._dustParticles = [];
    this.composer?.dispose?.();
    this.scene?.clear();
    this.renderer?.dispose();
  }
}
