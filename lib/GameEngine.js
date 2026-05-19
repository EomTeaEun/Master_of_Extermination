/**
 * 박멸의 달인 - Three.js Game Engine
 * ─────────────────────────────────────
 * 3D 탑다운 방 + 바퀴벌레 5종 + 무기 4종 + 웨이브 시스템
 */

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────
export const WEAPONS = {
  slipper: { name: '슬리퍼', emoji: '🥿', damage: 25, range: 1.8, cooldown: 800, color: 0xff6b35 },
  chopstick: { name: '젓가락', emoji: '🥢', damage: 100, range: 1.0, cooldown: 250, color: 0xd4a574 },
  frypan: { name: '후라이팬', emoji: '🍳', damage: 60, range: 2.2, cooldown: 1400, color: 0x444444 },
  spray: { name: '살충제', emoji: '💨', damage: 5, range: 2.5, cooldown: 80, continuous: true, color: 0x88ffcc },
};

export const COCKROACH_TYPES = {
  normal:    { name: '일반 바퀴', hp: 1,  speed: 2.5, reward: 100,  size: 0.29, color: 0x3d2b1f, xp: 1 },
  zigzag:    { name: '지그재그', hp: 1,  speed: 3.2, reward: 150,  size: 0.26, color: 0x5a3825, xp: 1 },
  pregnant:  { name: '임산부',   hp: 2,  speed: 1.8, reward: 200,  size: 0.36, color: 0x6b4226, xp: 2 },
  tank:      { name: '탱크형',   hp: 5,  speed: 1.4, reward: 400,  size: 0.46, color: 0x2a1a0e, xp: 3 },
  ninja:     { name: '닌자형',   hp: 1,  speed: 5.0, reward: 500,  size: 0.23, color: 0x1a1a1a, xp: 3 },
  flying:    { name: '날바퀴',   hp: 1,  speed: 4.0, reward: 500,  size: 0.26, color: 0x4a3020, xp: 2 },
  golden:    { name: '황금바퀴', hp: 3,  speed: 3.8, reward: 5000, size: 0.31, color: 0xffd700, xp: 10 },
  mutant:    { name: '변이형',   hp: 12, speed: 2.0, reward: 2000, size: 0.65, color: 0x8b0000, xp: 8 },
  giant:     { name: '거인바퀴', hp: 30, speed: 1.2, reward: 10000,size: 1.56, color: 0x1a0a00, xp: 20 },
};

const ROOM_SIZE = 14;
const WALL_H = 2.5;
const PLAYER_SPEED = 4.5;
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
// SOUND SYSTEM (Web Audio API)
// ─────────────────────────────────────────────────────────────────
class SoundSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  }

  _play(freq, type, duration, gain = 0.3) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, this.ctx.currentTime + duration);
      g.gain.setValueAtTime(gain, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  hit()  { /* 타격 미스 효과음 제거 */ }
  kill() {
    // 퍽! — 낮고 짧은 임팩트음
    this._play(90,  'sine',     0.06, 0.4);   // 저음 쿵
    this._play(180, 'sawtooth', 0.04, 0.06);  // 찰싹 느낌
  }
  combo()   { this._play(880, 'sine', 0.2, 0.5); }
  damage()  { this._play(120, 'sawtooth', 0.3, 0.6); }
  upgrade() { [440, 550, 660, 880].forEach((f, i) => setTimeout(() => this._play(f, 'sine', 0.15, 0.3), i * 80)); }
  wave()    { this._play(220, 'square', 0.5, 0.5); setTimeout(() => this._play(180, 'sawtooth', 0.4, 0.5), 300); }
  spray()   { this._play(80 + Math.random() * 40, 'sawtooth', 0.05, 0.15); }
  golden()  { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._play(f, 'sine', 0.3, 0.4), i * 100)); }
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
    this.sprayHeld = false;

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

    // 상시 소량 스폰 (웨이브 외 시간에도 바퀴 유지)
    this.ambientSpawnTimer = 5.0; // 첫 스폰까지 5초

    // Day survival mode
    this.electricity = 100;
    this.cleanliness = 100;
    this.rent = 0;

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
    this._setupRenderer();
    this._setupScene();
    this._setupPlayer();
    this._setupLights();
    this._setupControls();
    this.particles = new ParticleSystem(this.scene);
    this.running = true;
    this._animate();
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x0a0805);
    // 시네마틱 톤매핑 — 레퍼런스처럼 따뜻하고 어두운 분위기
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 2.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
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

    // 기본 장판 색 (어두운 황토)
    ctx.fillStyle = '#a8882a';
    ctx.fillRect(0, 0, 1024, 1024);

    // 타일 줄눈
    ctx.strokeStyle = 'rgba(60,45,10,0.6)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 1024; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
    }
    // 오래된 얼룩
    for (let i = 0; i < 30; i++) {
      const grd = ctx.createRadialGradient(
        Math.random()*1024, Math.random()*1024, 0,
        Math.random()*1024, Math.random()*1024, 20 + Math.random()*60
      );
      grd.addColorStop(0, 'rgba(40,25,5,0.35)');
      grd.addColorStop(1, 'rgba(40,25,5,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 1024, 1024);
    }
    // 긁힌 자국
    ctx.strokeStyle = 'rgba(80,60,15,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
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
      roughness: 0.9,
      metalness: 0.0,
      color: 0xd4aa40,
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

    if (this.currentWeapon === 'spray') {
      // 살충제: 60° 부채꼴 — playerGroup에 붙여서 플레이어와 함께 회전
      const HALF_CONE = Math.PI / 6; // 30° (총 60°)
      const range = w.range;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const a = -HALF_CONE + (HALF_CONE * 2 * i / steps);
        shape.lineTo(Math.sin(a) * range, -Math.cos(a) * range); // -Z 방향 (전방)
      }
      shape.lineTo(0, 0);
      const geo = new THREE.ShapeGeometry(shape);
      this.rangeRing = new THREE.Mesh(geo, mat);
      this.rangeRing.rotation.x = -Math.PI / 2;
      this.rangeRing.position.y = 0.06;
      this.playerGroup.add(this.rangeRing);
      this.rangeRingParent = this.playerGroup;
    } else {
      // 다른 무기: 원형 링 — 씬에 붙이고 매 프레임 위치 추적
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

  _setupLights() {
    // 앰비언트 — 전반적으로 밝게
    const ambient = new THREE.AmbientLight(0xfff5e0, 2.5);
    this.scene.add(ambient);

    // 메인 형광등 — 천장 중앙 (그림자 드리움)
    this.ceilingLight = new THREE.PointLight(0xfff8e8, 6.0, 30);
    this.ceilingLight.position.set(0, 4.5, -1);
    this.ceilingLight.castShadow = true;
    this.ceilingLight.shadow.mapSize.width  = 2048;
    this.ceilingLight.shadow.mapSize.height = 2048;
    this.ceilingLight.shadow.camera.near = 0.5;
    this.ceilingLight.shadow.camera.far  = 25;
    this.ceilingLight.shadow.bias = -0.001;
    this.scene.add(this.ceilingLight);

    // 형광등 모형 (천장에 붙은 직사각형 발광체)
    const tubeGeo = new THREE.BoxGeometry(2.0, 0.08, 0.2);
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.set(0, WALL_H - 0.05, -1);
    this.scene.add(tube);

    // 보조 천장등 — 맵 반대편도 밝게
    const ceilingLight2 = new THREE.PointLight(0xfff8e8, 4.0, 28);
    ceilingLight2.position.set(0, 4.5, 3);
    this.scene.add(ceilingLight2);

    // 화장실 초록 형광등
    const bathLight = new THREE.PointLight(0xaaffcc, 2.5, 9);
    bathLight.position.set(-5, 3, 5);
    this.scene.add(bathLight);

    // 냉장고 쿨 블루 빛
    this.fridgeLight = new THREE.PointLight(0xbbddff, 3.0, 7);
    this.fridgeLight.position.set(5, 1.5, -5);
    this.scene.add(this.fridgeLight);

    // TV 블루빛 (모니터)
    const tvLight = new THREE.PointLight(0x6699ff, 2.0, 6);
    tvLight.position.set(0, 1, -6);
    this.scene.add(tvLight);
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
    const facing = this.playerGroup.rotation.y; // 플레이어가 바라보는 방향
    const HALF_CONE = Math.PI / 6; // 30° (총 60°)

    this.cockroaches.forEach(c => {
      if (c.dead) return;
      const dx = c.group.position.x - px;
      const dz = c.group.position.z - pz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > weapon.range) return;

      // 60° 부채꼴 범위 체크 (플레이어 시선 기준)
      const toRoach = Math.atan2(dx, dz);
      let diff = toRoach - facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > HALF_CONE) return;

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
      this.onEvent?.('crisis', { type: 'lights_out', text: '⚡ 정전!! 불이 꺼졌다!!' });
      setTimeout(() => {
        this.ceilingLight.intensity = 1.5;
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
          if (!this.godMode) {
            const dmg = c.type === 'giant' ? 8 : c.type === 'mutant' ? 5 : c.type === 'tank' ? 3 : 1;
            //const dmg = c.type === 'giant' ? 0 : c.type === 'mutant' ? 0 : c.type === 'tank' ? 0 : 0;
            this.hp = Math.max(0, this.hp - dmg);
            this.sound.damage();
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
    this.onEvent?.('gameOver', { reason, killCount: this.killCount, money: this.money, wave: this.wave, score: this.score });
  }

  _triggerWin() {
    this.running = false;
    this.onEvent?.('win', { killCount: this.killCount, money: this.money, wave: this.wave, score: this.score });
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

    // Wave system
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveTimer = WAVE_INTERVAL;
      this._triggerWave();
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

    // Spray attack (hold E)
    if (this.sprayHeld && this.currentWeapon === 'spray') {
      if (this.attackCooldown <= 0) {
        this.attackCooldown = WEAPONS.spray.cooldown / 1000;
        this._doSprayAttack();
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
      // 씬에 붙은 원형 링만 위치 추적 (spray 콘은 playerGroup에 붙어서 자동 이동)
      if (this.rangeRingParent !== this.playerGroup) {
        this.rangeRing.position.x = this.playerPos.x;
        this.rangeRing.position.z = this.playerPos.z;
      }
      const coolPct = this.attackCooldown / (WEAPONS[this.currentWeapon]?.cooldown / 1000 || 1);
      const pulse = 0.25 + Math.sin(this.elapsedTime * 3) * 0.08;
      this.rangeRing.material.opacity = coolPct > 0 ? 0.15 + (1 - coolPct) * 0.4 : pulse;
    }

    // ── 상시 소량 스폰 (웨이브 외) ──
    this.ambientSpawnTimer -= dt;
    if (this.ambientSpawnTimer <= 0) {
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

    this.renderer.render(this.scene, this.camera);

    // Push state every 10 frames
    if (Math.floor(this.elapsedTime * 60) % 10 === 0) {
      this._pushState();
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
      this.playerGroup.rotation.y += (angle - this.playerGroup.rotation.y) * 0.3;

      // Step animation
      this.player.position.y = 0.6 + Math.abs(Math.sin(this.elapsedTime * 8)) * 0.05;
    }

    this.playerPos.x = this.playerGroup.position.x;
    this.playerPos.z = this.playerGroup.position.z;
  }

  // ─── UPGRADES ────────────────────────────────────────────────────
  applyUpgrade(key) {
    // 소모품: 초콜릿 (레벨 없이 매번 300귗에 HP +5)
    if (key === 'chocolate') {
      if (this.money < 300) return false;
      if (this.hp >= this.maxHp) return false;
      this.money -= 300;
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
      chocolate: { key: 'chocolate', name: '달콤한 초콜릿', emoji: '🍫', desc: 'HP +5 즉시 회복', cost: 300, level: 0, consumable: true, disabled: this.hp >= this.maxHp },
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
    this.scene?.clear();
    this.renderer?.dispose();
  }
}
