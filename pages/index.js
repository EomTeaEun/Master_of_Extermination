import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase, signIn, signUp } from '../lib/supabase';

function RoachWalker({ delay, top, size = 24 }) {
  return (
    <div
      className="absolute pointer-events-none select-none z-0"
      style={{
        top: `${top}%`,
        fontSize: `${size}px`,
        animation: `roach-walk ${8 + Math.random() * 6}s linear ${delay}s infinite`,
        opacity: 0.15,
      }}
    >
      🪳
    </div>
  );
}

function AuthModal({ mode, onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!username.trim()) { setError('닉네임을 입력하세요'); setLoading(false); return; }
        if (username.length < 2) { setError('닉네임은 2자 이상이어야 합니다'); setLoading(false); return; }
        const { data, error: err } = await signUp(email, password, username);
        if (err) throw err;
        onSuccess(data.user || data.session?.user);
      } else {
        const { data, error: err } = await signIn(email, password);
        if (err) throw err;
        onSuccess(data.user || data.session?.user);
      }
    } catch (err) {
      const msg = err.message || '오류가 발생했습니다';
      if (msg.includes('Invalid login')) setError('이메일 또는 비밀번호가 틀렸습니다');
      else if (msg.includes('User already registered')) setError('이미 가입된 이메일입니다');
      else if (msg.includes('Password should be')) setError('비밀번호는 6자 이상이어야 합니다');
      else setError(msg);
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-gray-900 border-2 border-yellow-600 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl shadow-yellow-950">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-yellow-400 font-bold text-lg">
              {mode === 'signup' ? '🪳 방역단 등록' : '🥿 로그인'}
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {mode === 'signup' ? '방역단에 합류하여 기록을 남기세요' : '다시 싸우러 왔군요'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <div>
              <label className="text-gray-400 text-xs mb-1 block">닉네임 (랭킹에 표시됨)</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="ex) 슬리퍼달인99"
                maxLength={20}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 outline-none transition-colors"
              />
            </div>
          )}

          <div>
            <label className="text-gray-400 text-xs mb-1 block">이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">비밀번호 (6자 이상)</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 outline-none transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-950 border border-red-700 text-red-300 text-xs px-3 py-2 rounded">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-black font-bold py-2.5 rounded-lg transition-all hover:scale-105 mt-1"
          >
            {loading ? '처리 중...' : mode === 'signup' ? '방역단 합류하기 🪳' : '로그인 🥿'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState('3min');
  const [godFlash, setGodFlash] = useState(false);
  const [eggOpen, setEggOpen] = useState(false);   // 입력창 표시 여부
  const [eggInput, setEggInput] = useState('');     // 입력값
  const eggRef = useRef(null);
  const SECRET = 'cockroach';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── 이스터에그: Shift×2 → 입력창 표시 ──
  useEffect(() => {
    let shiftCount = 0;
    let shiftTimer = null;

    function onKeyDown(e) {
      if (e.key === 'Shift') {
        shiftCount++;
        clearTimeout(shiftTimer);
        if (shiftCount >= 2) {
          shiftCount = 0;
          setEggOpen(true);
          setEggInput('');
          setTimeout(() => eggRef.current?.focus(), 50);
        } else {
          shiftTimer = setTimeout(() => { shiftCount = 0; }, 600);
        }
      }
      if (e.key === 'Escape') {
        setEggOpen(false);
        setEggInput('');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); clearTimeout(shiftTimer); };
  }, []);

  function handleEggInput(e) {
    const val = e.target.value;
    setEggInput(val);
    if (val.toLowerCase() === SECRET) {
      sessionStorage.setItem('__xsys_dbg', btoa('god_mode_active'));
      setEggOpen(false);
      setEggInput('');
      setGodFlash(true);
      setTimeout(() => setGodFlash(false), 2000);
    }
  }

  function handleEggKey(e) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEggOpen(false);
      setEggInput('');
    }
  }

  function handlePlay() {
    if (!user) {
      setAuthMode('login');
      return;
    }
    const isGod = sessionStorage.getItem('__xsys_dbg') === btoa('god_mode_active');
    router.push(`/game?mode=${selectedMode}${isGod ? '&_d=1' : ''}`);
  }

  function handleGuest() {
    router.push(`/game?mode=${selectedMode}&guest=1`);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  if (loading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-4xl animate-spin">🪳</div>
      </div>
    );
  }

  const gameModes = [
    { key: '3min', label: '3분 생존', emoji: '⏱️', desc: '3분 동안 최대한 많이 잡아라!', color: 'border-yellow-600' },
    { key: 'infinite', label: '무한 모드', emoji: '♾️', desc: '끝까지 살아남는 랭킹 경쟁!', color: 'border-red-600' },
    { key: 'daysurvival', label: '하루살이 모드', emoji: '🏠', desc: '전기세·집 상태 관리하며 버텨라!', color: 'border-blue-600' },
  ];

  return (
    <>
      {/* 이스터에그 입력창 — Shift×2로 열림 */}
      {eggOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto" style={{ opacity: 0.6 }}>
            <input
              ref={eggRef}
              type="text"
              value={eggInput}
              onChange={handleEggInput}
              onKeyDown={handleEggKey}
              placeholder="..."
              autoComplete="off"
              spellCheck={false}
              className="bg-transparent border-b border-gray-600 text-white text-sm outline-none text-center w-32"
              style={{ fontFamily: 'monospace', caretColor: 'white' }}
            />
          </div>
        </div>
      )}

      {/* God mode 활성화 피드백 */}
      {godFlash && (
        <div className="fixed bottom-2 left-2 z-50 text-white text-xs pointer-events-none"
          style={{ opacity: 0.4, fontFamily: 'monospace' }}>
          sys: debug mode on
        </div>
      )}

      <Head>
        <title>박멸의 달인 🪳</title>
        <meta name="description" content="노란장판 흙수저 바퀴벌레 잡기 서바이벌" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🪳</text></svg>" />
      </Head>

      {/* Background: dark dirty room */}
      <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-yellow-950 to-black crt" />

      {/* Walking roaches */}
      {[...Array(6)].map((_, i) => (
        <RoachWalker key={i} delay={i * 1.5} top={10 + i * 15} size={20 + i * 4} />
      ))}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-7xl mb-3">🪳</div>
          <h1 className="text-yellow-400 text-4xl font-black mb-1 drop-shadow-lg" style={{ fontFamily: 'Noto Sans KR' }}>
            박멸의 달인
          </h1>
          <p className="text-gray-400 text-sm">노란장판 흙수저 바퀴벌레 서바이벌</p>
          <div className="flex justify-center gap-2 mt-2">
            <span className="bg-red-900 text-red-300 text-xs px-2 py-0.5 rounded">B급감성</span>
            <span className="bg-yellow-900 text-yellow-300 text-xs px-2 py-0.5 rounded">한 판만 더</span>
            <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded">3D</span>
          </div>
        </div>

        {/* User status */}
        {user ? (
          <div className="flex items-center gap-3 mb-4 bg-green-950 border border-green-700 rounded-lg px-4 py-2">
            <span className="text-green-400 text-sm font-bold">
              👤 {user.user_metadata?.username || user.email?.split('@')[0]}
            </span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-gray-300 text-xs">로그아웃</button>
          </div>
        ) : (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setAuthMode('login')}
              className="border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              로그인
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className="border border-yellow-600 text-yellow-300 hover:bg-yellow-900 text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              회원가입 (랭킹 등록)
            </button>
          </div>
        )}

        {/* Game mode selector */}
        <div className="grid grid-cols-3 gap-2 mb-6 w-full max-w-md">
          {gameModes.map(mode => (
            <button
              key={mode.key}
              onClick={() => setSelectedMode(mode.key)}
              className={`border-2 rounded-lg p-3 text-center transition-all ${
                selectedMode === mode.key
                  ? `${mode.color} bg-gray-800 scale-105 shadow-lg`
                  : 'border-gray-700 bg-gray-900 hover:border-gray-500'
              }`}
            >
              <div className="text-2xl mb-1">{mode.emoji}</div>
              <div className="text-white text-xs font-bold">{mode.label}</div>
              <div className="text-gray-400 text-xs mt-0.5 leading-tight">{mode.desc}</div>
            </button>
          ))}
        </div>

        {/* Play button */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handlePlay}
            className="bg-red-700 hover:bg-red-600 text-white font-black text-xl px-12 py-4 rounded-xl transition-all hover:scale-105 border-2 border-red-500 shadow-lg shadow-red-950 animate-pulse"
          >
            🥿 게임 시작!!
          </button>
          {!user && (
            <button
              onClick={handleGuest}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              비로그인으로 시작 (랭킹 미등록)
            </button>
          )}
        </div>

        {/* Controls info */}
        <div className="mt-8 bg-gray-900 bg-opacity-80 border border-gray-700 rounded-lg p-4 text-center max-w-sm">
          <div className="text-gray-400 text-xs mb-2 font-bold">조작법</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400">
            <span>WASD / ↑↓←→</span><span>이동</span>
            <span>E / 클릭</span><span>공격</span>
            <span>Q</span><span>무기 교체</span>
            <span>B</span><span>업그레이드 상점</span>
          </div>
        </div>

        {/* Bottom credits */}
        <div className="absolute bottom-4 text-gray-700 text-xs text-center">
          "바퀴벌레보다 강한 인간은 없다. 하지만 슬리퍼는 있다."
        </div>
      </div>

      {/* Auth modal */}
      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSuccess={(u) => {
            setUser(u);
            setAuthMode(null);
          }}
        />
      )}
    </>
  );
}
