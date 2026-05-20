import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase, signIn, signUp } from '../lib/supabase';

// ── 바퀴벌레 배경 파티클 ──────────────────────────────────────────
function RoachParticle({ style }) {
  return (
    <div className="absolute pointer-events-none select-none" style={style}>🪳</div>
  );
}

// ── 인증 모달 ─────────────────────────────────────────────────────
function AuthModal({ mode, onClose, onSuccess }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
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
      if (msg.includes('Invalid login'))          setError('이메일 또는 비밀번호가 틀렸습니다');
      else if (msg.includes('User already'))      setError('이미 가입된 이메일입니다');
      else if (msg.includes('Password should'))   setError('비밀번호는 6자 이상이어야 합니다');
      else setError(msg);
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.88)' }}>
      <div style={{
        background: 'linear-gradient(145deg, #1a1208, #0d0d06)',
        border: '1px solid #8a6a20',
        borderRadius: 16,
        padding: '28px 28px 24px',
        width: '100%', maxWidth: 360,
        boxShadow: '0 0 40px rgba(180,120,0,0.25), inset 0 1px 0 rgba(255,200,50,0.08)',
      }}>
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div style={{ color: '#f5c842', fontWeight: 800, fontSize: 17, letterSpacing: 1 }}>
              {mode === 'signup' ? '🪳 방역단 등록' : '🥿 로그인'}
            </div>
            <div style={{ color: '#7a6a4a', fontSize: 12, marginTop: 3 }}>
              {mode === 'signup' ? '방역단에 합류하여 기록을 남기세요' : '다시 싸우러 왔군요'}
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#555', fontSize: 20, lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none', paddingTop: 2 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <div>
              <label style={{ color: '#8a7a50', fontSize: 11, display: 'block', marginBottom: 5, letterSpacing: 0.5 }}>닉네임 (랭킹에 표시됨)</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="ex) 슬리퍼달인99" maxLength={20}
                style={inputStyle} />
            </div>
          )}
          <div>
            <label style={{ color: '#8a7a50', fontSize: 11, display: 'block', marginBottom: 5, letterSpacing: 0.5 }}>이메일</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com" required style={inputStyle} />
          </div>
          <div>
            <label style={{ color: '#8a7a50', fontSize: 11, display: 'block', marginBottom: 5, letterSpacing: 0.5 }}>비밀번호 (6자 이상)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={6} style={inputStyle} />
          </div>

          {error && (
            <div style={{ background: 'rgba(120,20,20,0.5)', border: '1px solid #8b2020', borderRadius: 8, padding: '8px 12px', color: '#ff9999', fontSize: 12 }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            background: loading ? '#3a2a00' : 'linear-gradient(135deg, #c8960a, #e8b820)',
            color: loading ? '#666' : '#1a0e00',
            fontWeight: 800, fontSize: 14, padding: '12px 0', borderRadius: 10,
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: 1, marginTop: 4,
            boxShadow: loading ? 'none' : '0 0 18px rgba(200,150,10,0.4)',
            transition: 'all 0.2s',
          }}>
            {loading ? '처리 중...' : mode === 'signup' ? '방역단 합류하기 🪳' : '로그인 🥿'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid #3a3020', borderRadius: 8,
  padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
};

// ── 모드 카드 ─────────────────────────────────────────────────────
const MODES = [
  {
    key: '3min',
    icon: '⏱',
    label: '3분 생존',
    desc: '3분 동안 최대한 많이 잡아라!',
    accent: '#c8960a',
    glow: 'rgba(200,150,10,0.35)',
    bg: 'rgba(60,40,0,0.55)',
  },
  {
    key: 'infinite',
    icon: '∞',
    label: '무한 모드',
    desc: '끝까지 살아남는 랭킹 경쟁!',
    accent: '#cc3322',
    glow: 'rgba(200,50,30,0.35)',
    bg: 'rgba(50,10,5,0.55)',
  },
  {
    key: 'daysurvival',
    icon: '🏠',
    label: '하루살이',
    desc: '전기세·집 상태 관리하며 버텨라!',
    accent: '#2266cc',
    glow: 'rgba(30,80,200,0.35)',
    bg: 'rgba(5,15,50,0.55)',
  },
];

export default function Home() {
  const router = useRouter();
  const [authMode,      setAuthMode]      = useState(null);
  const [user,          setUser]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [selectedMode,  setSelectedMode]  = useState('3min');
  const [godFlash,      setGodFlash]      = useState(false);
  const [eggOpen,       setEggOpen]       = useState(false);
  const [eggInput,      setEggInput]      = useState('');
  const [titleGlow,     setTitleGlow]     = useState(false);
  const [btnHover,      setBtnHover]      = useState(false);
  const eggRef = useRef(null);
  const SECRET = 'cockroach';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null); setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user || null));
    return () => subscription.unsubscribe();
  }, []);

  // 타이틀 글로우 펄스
  useEffect(() => {
    const id = setInterval(() => setTitleGlow(v => !v), 2200);
    return () => clearInterval(id);
  }, []);

  // 이스터에그
  useEffect(() => {
    let cnt = 0, timer = null;
    function onKeyDown(e) {
      if (e.key === 'Shift') {
        cnt++;
        clearTimeout(timer);
        if (cnt >= 2) { cnt = 0; setEggOpen(true); setEggInput(''); setTimeout(() => eggRef.current?.focus(), 50); }
        else timer = setTimeout(() => { cnt = 0; }, 600);
      }
      if (e.key === 'Escape') { setEggOpen(false); setEggInput(''); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); clearTimeout(timer); };
  }, []);

  function handleEggInput(e) {
    const val = e.target.value; setEggInput(val);
    if (val.toLowerCase() === SECRET) {
      sessionStorage.setItem('__xsys_dbg', btoa('god_mode_active'));
      setEggOpen(false); setEggInput(''); setGodFlash(true);
      setTimeout(() => setGodFlash(false), 2000);
    }
  }

  function handlePlay() {
    if (!user) { setAuthMode('login'); return; }
    const isGod = sessionStorage.getItem('__xsys_dbg') === btoa('god_mode_active');
    router.push(`/game?mode=${selectedMode}${isGod ? '&_d=1' : ''}`);
  }
  function handleGuest() { router.push(`/game?mode=${selectedMode}&guest=1`); }
  async function handleLogout() { await supabase.auth.signOut(); setUser(null); }

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#080604', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 48, animation: 'spin 1s linear infinite' }}>🪳</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const selMode = MODES.find(m => m.key === selectedMode);

  return (
    <>
      <Head>
        <title>박멸의 달인 🪳</title>
        <meta name="description" content="노란장판 흙수저 바퀴벌레 서바이벌" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🪳</text></svg>" />
      </Head>

      <style>{`
        @keyframes roachWalk {
          0%   { transform: translateX(-80px) scaleX(1); opacity: 0; }
          5%   { opacity: 1; }
          48%  { transform: translateX(110vw) scaleX(1); }
          50%  { transform: translateX(110vw) scaleX(-1); opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translateX(-80px) scaleX(-1); opacity: 0; }
        }
        @keyframes titlePulse {
          0%, 100% { text-shadow: 0 0 30px rgba(220,160,0,0.6), 0 0 60px rgba(180,100,0,0.3), 0 2px 4px rgba(0,0,0,0.9); }
          50%       { text-shadow: 0 0 50px rgba(255,200,0,0.9), 0 0 100px rgba(220,130,0,0.5), 0 2px 4px rgba(0,0,0,0.9); }
        }
        @keyframes btnPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(220,160,0,0.5), 0 4px 20px rgba(0,0,0,0.6); }
          50%       { box-shadow: 0 0 45px rgba(255,200,0,0.85), 0 4px 30px rgba(0,0,0,0.7); }
        }
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes floatUp {
          0%,100% { transform: translateY(0px); }
          50%     { transform: translateY(-8px); }
        }
        @keyframes borderGlow {
          0%,100% { opacity: 0.5; }
          50%     { opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── 배경 ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse at 50% 30%, #1e1405 0%, #0d0a04 50%, #050403 100%)',
      }} />
      {/* 배경 그리드 */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        backgroundImage: 'linear-gradient(rgba(180,130,20,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(180,130,20,0.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      {/* 스캔라인 */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
      }} />
      {/* 바퀴 파티클 */}
      {[12, 28, 44, 60, 76, 90].map((top, i) => (
        <div key={i} style={{
          position: 'fixed', top: `${top}%`, left: 0, zIndex: 3,
          fontSize: 18 + i * 3, opacity: 0.12,
          animation: `roachWalk ${10 + i * 3}s linear ${i * 2.5}s infinite`,
          pointerEvents: 'none', userSelect: 'none',
        }}>🪳</div>
      ))}

      {/* ── 이스터에그 ── */}
      {eggOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', opacity: 0.5 }}>
            <input ref={eggRef} type="text" value={eggInput} onChange={handleEggInput}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { setEggOpen(false); setEggInput(''); } }}
              placeholder="..." autoComplete="off" spellCheck={false}
              style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #555', color: '#fff', fontSize: 13, outline: 'none', textAlign: 'center', width: 120, fontFamily: 'monospace', caretColor: 'white' }} />
          </div>
        </div>
      )}
      {godFlash && (
        <div style={{ position: 'fixed', bottom: 8, left: 8, zIndex: 100, color: '#fff', fontSize: 11, opacity: 0.35, fontFamily: 'monospace', pointerEvents: 'none' }}>
          sys: debug mode on
        </div>
      )}

      {/* ── 메인 레이아웃 ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px 24px',
        gap: 0,
      }}>

        {/* ── 상단 상태바 ── */}
        <div style={{
          position: 'absolute', top: 16, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 24px', zIndex: 20,
        }}>
          {/* 유저 상태 */}
          {user ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(0,40,0,0.6)', border: '1px solid #1a6a1a',
              borderRadius: 20, padding: '6px 14px',
            }}>
              <span style={{ color: '#5cff5c', fontSize: 12, fontWeight: 700 }}>
                🟢 {user.user_metadata?.username || user.email?.split('@')[0]}
              </span>
              <button onClick={handleLogout} style={{
                color: '#4a5a4a', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer',
              }}>로그아웃</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAuthMode('login')} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid #3a3020',
                borderRadius: 20, padding: '6px 14px', color: '#aaa', fontSize: 12,
                cursor: 'pointer', transition: 'all 0.2s',
              }}>로그인</button>
              <button onClick={() => setAuthMode('signup')} style={{
                background: 'rgba(180,130,0,0.15)', border: '1px solid #7a6020',
                borderRadius: 20, padding: '6px 14px', color: '#d4a830', fontSize: 12,
                cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s',
              }}>방역단 등록</button>
            </div>
          )}

          {/* 조작법 힌트 */}
          <div style={{
            display: 'flex', gap: 12, fontSize: 11, color: '#5a5040',
          }}>
            {[['WASD','이동'],['E','공격'],['Q','무기교체'],['B','상점']].map(([k,v]) => (
              <span key={k} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid #3a3020', borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', fontSize: 10, color: '#9a8860' }}>{k}</span>
                <span>{v}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── 타이틀 영역 ── */}
        <div style={{ textAlign: 'center', marginBottom: 32, animation: 'floatUp 4s ease-in-out infinite' }}>
          {/* 대형 바퀴 아이콘 */}
          <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 8, filter: 'drop-shadow(0 0 24px rgba(180,120,0,0.6))' }}>
            🪳
          </div>

          {/* 메인 타이틀 */}
          <h1 style={{
            fontSize: 'clamp(42px, 8vw, 72px)',
            fontWeight: 900,
            color: '#f5c030',
            margin: '0 0 6px',
            letterSpacing: 4,
            animation: 'titlePulse 2.2s ease-in-out infinite',
            fontFamily: '"Noto Sans KR", sans-serif',
          }}>
            박멸의 달인
          </h1>

          {/* 서브타이틀 */}
          <p style={{ color: '#7a6840', fontSize: 13, letterSpacing: 2, margin: '0 0 12px' }}>
            노란장판 흙수저 바퀴벌레 서바이벌
          </p>

          {/* 뱃지 태그 */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {[
              { label: 'B급감성', bg: 'rgba(100,10,10,0.7)', color: '#ff8080', border: '#6a1010' },
              { label: '한 판만 더', bg: 'rgba(100,80,0,0.7)', color: '#ffd060', border: '#7a6010' },
              { label: '3D', bg: 'rgba(20,20,60,0.7)', color: '#8090ff', border: '#202060' },
            ].map(t => (
              <span key={t.label} style={{
                background: t.bg, border: `1px solid ${t.border}`,
                borderRadius: 20, padding: '3px 12px',
                color: t.color, fontSize: 11, fontWeight: 700, letterSpacing: 1,
              }}>{t.label}</span>
            ))}
          </div>
        </div>

        {/* ── 구분선 ── */}
        <div style={{
          width: '100%', maxWidth: 520, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(180,130,10,0.4), transparent)',
          marginBottom: 24,
        }} />

        {/* ── 게임 모드 선택 ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          gap: 12, width: '100%', maxWidth: 520, marginBottom: 28,
        }}>
          {MODES.map(m => {
            const sel = selectedMode === m.key;
            return (
              <button key={m.key} onClick={() => setSelectedMode(m.key)} style={{
                background: sel ? m.bg : 'rgba(20,16,8,0.6)',
                border: `1.5px solid ${sel ? m.accent : '#2a2218'}`,
                borderRadius: 12, padding: '16px 10px 14px',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: sel ? `0 0 22px ${m.glow}, inset 0 1px 0 rgba(255,255,255,0.05)` : 'none',
                transform: sel ? 'scale(1.04) translateY(-2px)' : 'scale(1)',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* 선택 상단 라인 */}
                {sel && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: `linear-gradient(90deg, transparent, ${m.accent}, transparent)`,
                    animation: 'borderGlow 1.5s ease-in-out infinite',
                  }} />
                )}
                <div style={{ fontSize: 28, marginBottom: 6, lineHeight: 1 }}>{m.icon}</div>
                <div style={{ color: sel ? '#fff' : '#8a7a5a', fontWeight: 800, fontSize: 12, marginBottom: 4, letterSpacing: 0.5 }}>
                  {m.label}
                </div>
                <div style={{ color: sel ? '#aaa' : '#4a4030', fontSize: 10, lineHeight: 1.4 }}>
                  {m.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── 게임 시작 버튼 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handlePlay}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            style={{
              background: btnHover
                ? 'linear-gradient(135deg, #e8a808, #ffd040, #e8a808)'
                : 'linear-gradient(135deg, #c88808, #e8c020, #c88808)',
              color: '#1a0e00',
              fontWeight: 900,
              fontSize: 22,
              padding: '16px 52px',
              borderRadius: 14,
              border: '2px solid rgba(255,220,80,0.6)',
              cursor: 'pointer',
              letterSpacing: 3,
              animation: 'btnPulse 2s ease-in-out infinite',
              transition: 'background 0.2s, transform 0.15s',
              transform: btnHover ? 'scale(1.05)' : 'scale(1)',
              position: 'relative',
            }}
          >
            <span style={{ marginRight: 10 }}>🥿</span>
            게임 시작
            <span style={{
              display: 'block', fontSize: 10, fontWeight: 600,
              letterSpacing: 4, color: 'rgba(0,0,0,0.55)', marginTop: 2,
            }}>START GAME</span>
          </button>

          {!user && (
            <button onClick={handleGuest} style={{
              background: 'none', border: 'none',
              color: '#4a4030', fontSize: 12, cursor: 'pointer',
              textDecoration: 'underline', textDecorationColor: '#3a3020',
            }}>
              비로그인으로 시작 (랭킹 미등록)
            </button>
          )}
        </div>

        {/* ── 하단 격언 ── */}
        <div style={{
          position: 'absolute', bottom: 16,
          color: '#3a3020', fontSize: 11, letterSpacing: 1, textAlign: 'center',
        }}>
          "바퀴벌레보다 강한 인간은 없다. 하지만 슬리퍼는 있다."
        </div>
      </div>

      {/* ── 인증 모달 ── */}
      {authMode && (
        <AuthModal mode={authMode} onClose={() => setAuthMode(null)}
          onSuccess={u => { setUser(u); setAuthMode(null); }} />
      )}
    </>
  );
}
