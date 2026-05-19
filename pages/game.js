import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabase';

// Dynamic imports (no SSR for game components)
const Opening = dynamic(() => import('../components/Opening'), { ssr: false });
const GameUI = dynamic(() => import('../components/GameUI'), { ssr: false });
const UpgradeShop = dynamic(() => import('../components/UpgradeShop'), { ssr: false });
const Leaderboard = dynamic(() => import('../components/Leaderboard'), { ssr: false });
const Endings = dynamic(() => import('../components/Endings'), { ssr: false });

// Game engine is imported dynamically to avoid SSR issues with Three.js
let GameEngineClass = null;

const PHASE = {
  LOADING: 'loading',
  OPENING: 'opening',
  PLAYING: 'playing',
  SHOP: 'shop',
  LEADERBOARD: 'leaderboard',
  ENDING: 'ending',
};

export default function GamePage() {
  const router = useRouter();
  const { mode = '3min', guest, _d } = router.query;

  // 관리자 모드: startGame 시점에 직접 확인 (router.query가 초기엔 비어있어서 ref로 추적)
  const godModeRef = useRef(false);
  useEffect(() => {
    if (_d === '1' && sessionStorage.getItem('__xsys_dbg') === btoa('god_mode_active')) {
      godModeRef.current = true;
    }
  }, [_d]);

  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const [phase, setPhase] = useState(PHASE.LOADING);
  const [gameState, setGameState] = useState(null);
  const [events, setEvents] = useState([]);
  const [endingType, setEndingType] = useState(null);
  const [endingStats, setEndingStats] = useState(null);
  const [user, setUser] = useState(null);
  const [engineLoaded, setEngineLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Load user session
  useEffect(() => {
    if (!guest) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user || null);
      });
    }
  }, [guest]);

  // Load Three.js engine dynamically
  useEffect(() => {
    import('../lib/GameEngine').then(mod => {
      GameEngineClass = mod.GameEngine;
      setEngineLoaded(true);
      setPhase(PHASE.OPENING);
    });
  }, []);

  // Handle game events from engine
  const handleEvent = useCallback((type, data) => {
    setEvents(prev => {
      const newEv = { type, data, id: Date.now() + Math.random() };
      return [...prev.slice(-10), newEv];
    });

    if (type === 'gameOver') {
      setEndingType('death');
      setEndingStats({ ...data, gameMode: mode });
      setTimeout(() => setPhase(PHASE.ENDING), 800);
    }
    if (type === 'win') {
      setEndingType('win');
      setEndingStats({ ...data, gameMode: mode });
      setTimeout(() => setPhase(PHASE.ENDING), 500);
    }
    if (type === 'openShop') {
      if (phase === PHASE.PLAYING) {
        engineRef.current?.pause();
        setPhase(PHASE.SHOP);
      }
    }
  }, [phase, mode]);

  // Init game after opening
  function startGame() {
    if (!engineLoaded || !canvasRef.current) return;

    // Destroy old engine if exists
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }

    setPhase(PHASE.PLAYING);
    setGameState(null);
    setEvents([]);

    setTimeout(() => {
      if (!canvasRef.current) return;
      try {
        const engine = new GameEngineClass(
          canvasRef.current,
          (state) => setGameState({ ...state }),
          handleEvent
        );
        engine.init(mode, godModeRef.current);
        engineRef.current = engine;

        // Hide controls after 8 seconds
        setTimeout(() => setShowControls(false), 8000);
      } catch (err) {
        console.error('Engine init error:', err);
      }
    }, 100);
  }

  // Shop
  function openShop() {
    if (phase !== PHASE.PLAYING) return;
    engineRef.current?.pause();
    setPhase(PHASE.SHOP);
  }

  function closeShop() {
    setPhase(PHASE.PLAYING);
    engineRef.current?.resume();
  }

  function handleBuyUpgrade(key) {
    engineRef.current?.applyUpgrade(key);
    const state = engineRef.current?.getState();
    if (state) setGameState({ ...state });
  }

  function handleBuyWeapon(key) {
    const ok = engineRef.current?.buyWeapon(key);
    const state = engineRef.current?.getState();
    if (state) setGameState({ ...state });
    return ok;
  }

  function handleHireNPC(key) {
    return engineRef.current?.hireNPC(key) || false;
  }

  // Leaderboard
  function openLeaderboard() {
    engineRef.current?.pause();
    setPhase(PHASE.LEADERBOARD);
  }

  function closeLeaderboard() {
    setPhase(PHASE.PLAYING);
    engineRef.current?.resume();
  }

  // Retry
  function handleRetry() {
    setEndingType(null);
    setEndingStats(null);
    setPhase(PHASE.OPENING);
  }

  // Menu
  function handleMenu() {
    engineRef.current?.destroy();
    engineRef.current = null;
    router.push('/');
  }

  // Resize handler
  useEffect(() => {
    function onResize() {
      engineRef.current?.resize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  // Keyboard shortcut for shop
  useEffect(() => {
    function onKey(e) {
      if (e.code === 'KeyB' && phase === PHASE.PLAYING) openShop();
      if (e.code === 'Escape') {
        if (phase === PHASE.SHOP) closeShop();
        if (phase === PHASE.LEADERBOARD) closeLeaderboard();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const upgradeInfo   = engineRef.current?.getUpgradeInfo?.()   || null;
  const weaponShopInfo = engineRef.current?.getWeaponShopInfo?.() || null;

  return (
    <>
      <Head>
        <title>박멸의 달인 🪳 - 게임 중</title>
      </Head>

      <div className="fixed inset-0 bg-black overflow-hidden">
        {/* THREE.JS CANVAS */}
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: phase === PHASE.PLAYING || phase === PHASE.SHOP || phase === PHASE.LEADERBOARD ? 'block' : 'none' }}
          tabIndex={0}
        />

        {/* LOADING */}
        {phase === PHASE.LOADING && (
          <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
            <div className="text-6xl mb-4 animate-bounce">🪳</div>
            <div className="text-yellow-400 text-lg font-bold mb-2">게임 로딩 중...</div>
            <div className="text-gray-500 text-sm">Three.js 엔진 초기화 중</div>
          </div>
        )}

        {/* OPENING */}
        {phase === PHASE.OPENING && (
          <Opening onComplete={startGame} />
        )}

        {/* HUD */}
        {(phase === PHASE.PLAYING || phase === PHASE.SHOP || phase === PHASE.LEADERBOARD) && gameState && (
          <GameUI
            gameState={gameState}
            events={events}
            onOpenShop={openShop}
            onOpenLeaderboard={openLeaderboard}
            gameMode={mode}
          />
        )}

        {/* Controls hint */}
        {phase === PHASE.PLAYING && showControls && (
          <div className="fixed top-1/2 left-4 z-20 pointer-events-none transform -translate-y-1/2">
            <div className="bg-black bg-opacity-70 border border-gray-700 rounded-lg p-3 text-xs text-gray-400">
              <div className="font-bold text-gray-300 mb-1">조작법</div>
              <div>WASD / 방향키 — 이동</div>
              <div>E / 클릭 — 공격</div>
              <div>Q — 무기 교체</div>
              <div>B — 상점</div>
            </div>
          </div>
        )}

        {/* UPGRADE SHOP */}
        {phase === PHASE.SHOP && (
          <UpgradeShop
            gameState={gameState}
            weaponShopInfo={weaponShopInfo}
            onBuyWeapon={handleBuyWeapon}
            upgradeInfo={upgradeInfo}
            onBuy={handleBuyUpgrade}
            onHireNPC={handleHireNPC}
            onClose={closeShop}
          />
        )}

        {/* LEADERBOARD */}
        {phase === PHASE.LEADERBOARD && (
          <Leaderboard onClose={closeLeaderboard} currentUser={user} />
        )}

        {/* ENDING */}
        {phase === PHASE.ENDING && endingType && endingStats && (
          <Endings
            type={endingType}
            stats={endingStats}
            user={guest ? null : user}
            onRetry={handleRetry}
            onMenu={handleMenu}
          />
        )}

        {/* Pause overlay */}
        {(phase === PHASE.SHOP || phase === PHASE.LEADERBOARD) && (
          <div className="fixed inset-0 z-30 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-700 text-sm opacity-50">
              ⏸ 일시 정지
            </div>
          </div>
        )}
      </div>
    </>
  );
}
