import { useEffect, useState, useRef, useCallback } from 'react';
import { WEAPONS, COCKROACH_TYPES } from '../lib/GameEngine';

function formatTime(seconds) {
  if (!isFinite(seconds)) return '∞';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function HPBar({ hp, maxHp }) {
  const pct = (hp / maxHp) * 100;
  const color = pct > 60 ? '#22c55e' : pct > 30 ? '#eab308' : '#ef4444';
  const isLow = pct <= 30;

  return (
    <div className="flex items-center gap-2">
      <span className="text-white text-xs font-bold w-6">❤️</span>
      <div className="relative w-36 h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-600">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isLow ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%`, backgroundColor: color, transition: 'width 0.3s ease' }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
          {hp}/{maxHp}
        </div>
      </div>
    </div>
  );
}

function ComboDisplay({ combo }) {
  if (combo < 2) return null;
  const size = Math.min(combo * 4 + 16, 32);
  const color = combo >= 10 ? '#ff4444' : combo >= 5 ? '#ff8800' : '#ffdd00';
  return (
    <div
      className="text-center font-bold animate-bounce"
      style={{ color, fontSize: `${size}px`, textShadow: `0 0 10px ${color}`, lineHeight: 1 }}
    >
      x{combo} COMBO!
    </div>
  );
}

function WeaponSlot({ weapon, isActive, cooldownPct, index }) {
  const w = WEAPONS[weapon];
  if (!w) return null;
  return (
    <div className={`relative flex flex-col items-center p-1.5 rounded-lg border-2 transition-all min-w-[52px] ${
      isActive
        ? 'bg-yellow-900 border-yellow-400 shadow-lg shadow-yellow-900 scale-110'
        : 'bg-gray-900 border-gray-700 opacity-60'
    }`}>
      {/* Slot number badge */}
      <div className={`absolute -top-2 -right-1.5 text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full ${
        isActive ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-gray-400'
      }`} style={{ fontSize: '9px' }}>
        {index + 1}
      </div>
      <span className="text-2xl leading-none">{w.emoji}</span>
      <span className={`text-xs mt-0.5 font-bold ${isActive ? 'text-yellow-300' : 'text-gray-400'}`}>{w.name}</span>
      {isActive && cooldownPct > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700 rounded-b">
          <div
            className="h-full bg-yellow-400 rounded-b transition-all"
            style={{ width: `${(1 - cooldownPct) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Mini-map: shows room bounds, player dot, roach dots
function MiniMap({ playerPos, roachPositions }) {
  const SIZE = 84;   // px
  const ROOM = 8.5;  // half-size of map (matches engine MAP_HALF)
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Room border
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, SIZE - 4, SIZE - 4);

    function toMap(wx, wz) {
      const px = ((wx + ROOM) / (ROOM * 2)) * (SIZE - 8) + 4;
      const pz = ((wz + ROOM) / (ROOM * 2)) * (SIZE - 8) + 4;
      return [px, pz];
    }

    // Roaches
    if (roachPositions) {
      roachPositions.forEach(r => {
        const [px, pz] = toMap(r.x, r.z);
        const isSpecial = r.type && r.type !== 'normal' && r.type !== 'zigzag';
        ctx.beginPath();
        ctx.arc(px, pz, isSpecial ? 2.5 : 1.8, 0, Math.PI * 2);
        ctx.fillStyle = isSpecial ? '#ff8800' : '#aa3300';
        ctx.fill();
      });
    }

    // Player
    if (playerPos) {
      const [px, pz] = toMap(playerPos.x, playerPos.z);
      ctx.beginPath();
      ctx.arc(px, pz, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#4ade80';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [playerPos, roachPositions]);

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{ borderRadius: '6px', border: '1px solid #444' }}
      />
      <div className="absolute bottom-0.5 left-0 right-0 text-center" style={{ fontSize: '9px', color: '#666' }}>
        미니맵
      </div>
    </div>
  );
}

export default function GameUI({ gameState, events, onOpenShop, onOpenLeaderboard, gameMode }) {
  const [popups, setPopups] = useState([]);
  const [damageFlash, setDamageFlash] = useState(false);
  const [waveAnnounce, setWaveAnnounce] = useState(null);
  const [crisisAnnounce, setCrisisAnnounce] = useState(null);
  const [jumpscareKey, setJumpscareKey] = useState(null); // null = 숨김, key값 = 표시 중
  const popupId = useRef(0);

  useEffect(() => {
    if (!events || events.length === 0) return;
    events.forEach(ev => {
      if (ev.type === 'damage') {
        setDamageFlash(true);
        setTimeout(() => setDamageFlash(false), 150);
      }
      if (ev.type === 'kill') {
        const name = COCKROACH_TYPES[ev.data.type]?.name || ev.data.type;
        addPopup(`${name} 처치`);
      }
      if (ev.type === 'wave') {
        setWaveAnnounce({ wave: ev.data.wave, count: ev.data.count });
        setTimeout(() => setWaveAnnounce(null), 3000);
      }
      if (ev.type === 'crisis') {
        setCrisisAnnounce(ev.data.text);
        setTimeout(() => setCrisisAnnounce(null), 4000);
      }
      if (ev.type === 'achievement') {
        addPopup(`🏆 ${ev.data}`);
      }
      if (ev.type === 'exterminator') {
        addPopup('🧹 방역업체 출동');
      }
      if (ev.type === 'jumpscare') {
        const key = Date.now();
        setJumpscareKey(key);
        setTimeout(() => setJumpscareKey(k => k === key ? null : k), 2000);
      }
    });
  }, [events]);

  function addPopup(text) {
    const id = popupId.current++;
    setPopups(prev => [...prev.slice(-6), { id, text }]); // 최대 6줄만 유지
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== id));
    }, 1500);
  }

  if (!gameState) return null;

  const { hp, maxHp, timeLeft, killCount, money, combo, wave, currentWeapon, weaponSlots, attackCooldown, roachCount, playerPos, roachPositions, daySurvivalKilled, daySurvivalTarget, sprayEnergy, sprayRecharging, lightsOut } = gameState;
  const weaponConfig = WEAPONS[currentWeapon];
  const cooldownPct = weaponConfig ? Math.min(1, attackCooldown / (weaponConfig.cooldown / 1000)) : 0;
  const timeIsLow = isFinite(timeLeft) && timeLeft < 30;
  const isDaySurvival = gameMode === 'daysurvival';
  // 하루살이: elapsedTime = GAME_DURATION(180) - timeLeft 대신 별도 카운트업
  // timeLeft가 Infinity이므로 엔진의 elapsedTime을 직접 쓰기 위해 gameState에서 받음
  const elapsed = gameState.elapsedTime ?? 0;
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = Math.floor(elapsed % 60);

  return (
    <>
      {/* Damage flash overlay */}
      <div
        className="fixed inset-0 z-30 pointer-events-none bg-red-600 transition-opacity duration-300"
        style={{ opacity: damageFlash ? 0.35 : 0 }}
      />

      {/* 정전 블랙아웃 — 3초간 시야 완전 차단 */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-500"
        style={{ zIndex: 35, background: '#000', opacity: lightsOut ? 0.97 : 0 }}
      >
        {lightsOut && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center" style={{ animation: 'pulse 0.6s ease-in-out infinite' }}>
              <div style={{ fontSize: 48 }}>⚡</div>
              <div style={{ color: '#555', fontSize: 14, marginTop: 8, letterSpacing: 2 }}>정전...</div>
            </div>
          </div>
        )}
      </div>

      {/* TOP BAR */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-start justify-between p-3 pointer-events-none">
        {/* Left: HP + Wave */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <HPBar hp={hp} maxHp={maxHp} />
          <div className="flex items-center gap-2">
            <span className="bg-red-900 border border-red-600 text-red-200 text-xs font-bold px-2 py-0.5 rounded">
              WAVE {wave}
            </span>
            <span className="text-gray-400 text-xs">🪳 {roachCount}마리</span>
          </div>
        </div>

        {/* Center: Timer */}
        <div className="text-center">
          {isDaySurvival ? (
            <>
              {/* 하루살이: 올라가는 타이머 + 킬 진행도 */}
              <div className="text-3xl font-mono font-bold text-cyan-300 drop-shadow-lg">
                {String(elapsedMin).padStart(2,'0')}:{String(elapsedSec).padStart(2,'0')}
              </div>
              <div className="text-xs text-cyan-500 mt-0.5">⏱ 경과 시간</div>
              <div className="mt-1">
                <div className="text-yellow-300 font-bold text-sm">
                  🪳 {daySurvivalKilled ?? 0} / {daySurvivalTarget ?? 500}
                </div>
                <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden mt-0.5 mx-auto">
                  <div
                    className="h-full rounded-full bg-yellow-400 transition-all duration-300"
                    style={{ width: `${((daySurvivalKilled ?? 0) / (daySurvivalTarget ?? 500)) * 100}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={`text-3xl font-mono font-bold ${timeIsLow ? 'text-red-400 animate-pulse' : 'text-white'} drop-shadow-lg`}>
                {formatTime(timeLeft)}
              </div>
              {gameMode === 'infinite' && (
                <div className="text-gray-500 text-xs">무한모드</div>
              )}
            </>
          )}
        </div>

        {/* Right: Score + Money + Mini-map */}
        <div className="flex flex-col items-end gap-1 pointer-events-auto">
          <div className="text-yellow-300 font-bold text-lg drop-shadow">
            {money.toLocaleString()} 귗
          </div>
          <div className="text-gray-300 text-sm">
            🪳 {killCount}마리 처치
          </div>
          <button
            onClick={onOpenLeaderboard}
            className="text-gray-400 hover:text-white text-xs border border-gray-700 px-2 py-0.5 rounded transition-colors pointer-events-auto"
          >
            🏆 랭킹
          </button>
          <MiniMap playerPos={playerPos} roachPositions={roachPositions} />
        </div>
      </div>

      {/* BOTTOM: Weapon slots + Combo + Shop */}
      <div className="fixed bottom-0 left-0 right-0 z-20 flex items-end justify-between p-3 pointer-events-none">
        {/* Left: Combo */}
        <div className="min-w-[100px]">
          <ComboDisplay combo={combo} />
        </div>

        {/* Center: Weapon slots with Q/E flanking */}
        <div className="flex flex-col items-center gap-1 pointer-events-auto">
          <div className="flex items-center gap-2">
            {/* Q key — weapon switch */}
            <div className="flex flex-col items-center">
              <div className="bg-gray-800 border border-gray-500 text-yellow-300 font-bold text-sm px-2.5 py-1 rounded-md shadow-md" style={{ minWidth: 32, textAlign: 'center' }}>Q</div>
              <span className="text-gray-500 text-xs mt-0.5">교체</span>
            </div>

            {/* Weapon icons */}
            <div className="flex gap-1.5 items-end">
              {weaponSlots.map((w, i) => (
                <WeaponSlot
                  key={w}
                  weapon={w}
                  isActive={w === currentWeapon}
                  cooldownPct={w === currentWeapon ? cooldownPct : 0}
                  index={i}
                />
              ))}
            </div>

            {/* E key — attack */}
            <div className="flex flex-col items-center">
              <div className="bg-gray-800 border border-gray-500 text-yellow-300 font-bold text-sm px-2.5 py-1 rounded-md shadow-md" style={{ minWidth: 32, textAlign: 'center' }}>E</div>
              <span className="text-gray-500 text-xs mt-0.5">공격</span>
            </div>
          </div>
          {/* 살충제: 에너지 게이지 / 그 외: 쿨다운 바 */}
          {currentWeapon === 'spray' ? (
            <div className="flex flex-col items-center gap-0.5 mt-0.5" style={{ maxWidth: 120, width: '100%' }}>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-600" style={{ maxWidth: 120 }}>
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{
                    width: `${(sprayEnergy ?? 1) * 100}%`,
                    backgroundColor: sprayRecharging
                      ? '#f97316'                                      // 충전 중: 주황
                      : (sprayEnergy ?? 1) > 0.5 ? '#34d399' : '#facc15', // 여유: 초록 / 절반이하: 노랑
                  }}
                />
              </div>
              <span className="text-xs font-bold" style={{
                color: sprayRecharging ? '#f97316' : '#34d399', fontSize: 10
              }}>
                {sprayRecharging ? '⚡ 충전 중...' : `💨 ${Math.round((sprayEnergy ?? 1) * 100)}%`}
              </span>
            </div>
          ) : (
            <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden mt-0.5" style={{ maxWidth: 120 }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(1 - cooldownPct) * 100}%`,
                  backgroundColor: cooldownPct > 0.5 ? '#ef4444' : '#facc15',
                }}
              />
            </div>
          )}
        </div>

        {/* Right: Shop button */}
        <div className="pointer-events-auto">
          <button
            onClick={onOpenShop}
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg transition-all hover:scale-105 border-2 border-yellow-400 flex flex-col items-center"
          >
            <span>🛒 상점</span>
            <span className="text-xs">[B]</span>
          </button>
        </div>
      </div>

      {/* WAVE ANNOUNCEMENT */}
      {waveAnnounce && (
        <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center">
          <div className="text-center animate-bounce">
            <div className="text-red-400 text-5xl font-bold drop-shadow-lg">
              WAVE {waveAnnounce.wave}
            </div>
            <div className="text-yellow-300 text-xl mt-1">
              🪳 바퀴 {waveAnnounce.count}마리 출격!!
            </div>
          </div>
        </div>
      )}

      {/* CRISIS ANNOUNCEMENT */}
      {crisisAnnounce && (
        <div className="fixed top-1/3 left-0 right-0 z-30 pointer-events-none flex justify-center">
          <div className="bg-red-900 border-2 border-red-500 text-red-200 font-bold text-lg px-6 py-3 rounded-xl animate-bounce shadow-lg shadow-red-950">
            {crisisAnnounce}
          </div>
        </div>
      )}

      {/* KILL LOG — 오른쪽 사이드, 흰색 글씨 50% 투명도 */}
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-end gap-1">
        {popups.map(p => (
          <div
            key={p.id}
            className="text-white text-sm font-medium"
            style={{ opacity: 0.5, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            {p.text}
          </div>
        ))}
      </div>

      {/* JUMP SCARE OVERLAY */}
      {jumpscareKey && (
        <div
          key={jumpscareKey}
          className="jumpscare-overlay fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black"
        >
          <img
            src="/cocorach.png"
            alt=""
            className="jumpscare-img"
            draggable={false}
          />
        </div>
      )}

      {/* Low HP warning */}
      {hp <= 20 && hp > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-20 pointer-events-none flex justify-center">
          <div className="text-red-400 font-bold text-sm animate-pulse">
            ⚠️ HP 위험!! 바퀴를 피하세요!!
          </div>
        </div>
      )}

      {/* Controls hint (first 10 seconds) */}
    </>
  );
}
