import { useEffect, useState } from 'react';
import { getDailyRankingByMode, getAllTimeRankingByMode } from '../lib/supabase';

// ── 모의 데이터 ─────────────────────────────────────────────────
const MOCK = {
  '3min': {
    daily:   [
      { username: '방역왕_김씨',    kill_count: 247, money_earned: 18400, wave_reached: 8,  score: 38890 },
      { username: '슬리퍼달인',     kill_count: 198, money_earned: 14200, wave_reached: 7,  score: 31620 },
      { username: '바퀴사냥꾼99',   kill_count: 156, money_earned: 11000, wave_reached: 6,  score: 24500 },
    ],
    allTime: [
      { username: '전국방역왕',     kill_count: 1842, money_earned: 142000, wave_reached: 22, score: 290500 },
      { username: '살충제마스터',   kill_count: 1234, money_earned: 98000,  wave_reached: 15, score: 195600 },
    ],
  },
  infinite: {
    daily:   [
      { username: '무한의사나이',   kill_count: 890,  money_earned: 68000,  wave_reached: 24, score: 140300 },
      { username: '바퀴지옥탈출',  kill_count: 654,  money_earned: 51000,  wave_reached: 18, score: 103200 },
    ],
    allTime: [
      { username: 'EndlessKiller', kill_count: 4200, money_earned: 320000, wave_reached: 55, score: 662000 },
    ],
  },
  daysurvival: {
    daily:   [
      { username: '스피드런王',     kill_count: 500, survival_time: 187, score: 9980700 },
      { username: '바퀴청소기',     kill_count: 500, survival_time: 234, score: 9976600 },
    ],
    allTime: [
      { username: '세계최속방역',   kill_count: 500, survival_time: 142, score: 9985800 },
      { username: '스피드런王',     kill_count: 500, survival_time: 187, score: 9980700 },
    ],
  },
};

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${String(s).padStart(2,'0')}초`;
}

function RankBadge({ rank }) {
  if (rank === 0) return <span style={{ fontSize: 22 }}>🥇</span>;
  if (rank === 1) return <span style={{ fontSize: 22 }}>🥈</span>;
  if (rank === 2) return <span style={{ fontSize: 22 }}>🥉</span>;
  return <span style={{ color: '#666', fontWeight: 700, width: 28, textAlign: 'center', display: 'inline-block' }}>{rank + 1}</span>;
}

const MODE_INFO = {
  '3min':        { label: '3분 생존',   emoji: '⏱',  scoreLabel: '점수',  scoreKey: 'score'         },
  infinite:      { label: '무한 모드',  emoji: '∞',   scoreLabel: '점수',  scoreKey: 'score'         },
  daysurvival:   { label: '하루살이',   emoji: '🏠',  scoreLabel: '기록',  scoreKey: 'survival_time' },
};

export default function Leaderboard({ onClose, currentUser }) {
  const [gameMode, setGameMode] = useState('3min');
  const [tab,      setTab]      = useState('daily');
  const [dataMap,  setDataMap]  = useState({ '3min': null, infinite: null, daysurvival: null });
  const [loading,  setLoading]  = useState(false);

  useEffect(() => { loadMode(gameMode); }, [gameMode, tab]);

  async function loadMode(mode) {
    setLoading(true);
    try {
      const fn = tab === 'daily' ? getDailyRankingByMode : getAllTimeRankingByMode;
      const { data } = await fn(mode);
      setDataMap(prev => ({ ...prev, [mode]: { ...prev[mode], [tab]: data?.length > 0 ? data : MOCK[mode][tab] } }));
    } catch {
      setDataMap(prev => ({ ...prev, [mode]: { ...prev[mode], [tab]: MOCK[mode][tab] } }));
    }
    setLoading(false);
  }

  const rows = dataMap[gameMode]?.[tab] ?? MOCK[gameMode][tab];
  const mInfo = MODE_INFO[gameMode];
  const isDaysurvival = gameMode === 'daysurvival';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }}>
      <div style={{
        background: 'linear-gradient(160deg, #12100a, #0a0807)',
        border: '1px solid #6a5010', borderRadius: 16,
        width: '100%', maxWidth: 520, margin: '0 16px',
        boxShadow: '0 0 40px rgba(150,100,0,0.2)',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #2a2010' }}>
          <div>
            <div style={{ color: '#f5c030', fontWeight: 800, fontSize: 18 }}>🏆 명예의 전당</div>
            <div style={{ color: '#5a4a28', fontSize: 12, marginTop: 2 }}>전국 방역 달인 순위</div>
          </div>
          <button onClick={onClose} style={{ color: '#555', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>

        {/* 게임 모드 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #2a2010' }}>
          {Object.entries(MODE_INFO).map(([key, info]) => (
            <button key={key} onClick={() => setGameMode(key)} style={{
              flex: 1, padding: '10px 4px', fontSize: 12, fontWeight: 700,
              background: gameMode === key ? 'rgba(200,150,0,0.12)' : 'none',
              color: gameMode === key ? '#f5c030' : '#5a4a28',
              borderBottom: gameMode === key ? '2px solid #f5c030' : '2px solid transparent',
              border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {info.emoji} {info.label}
            </button>
          ))}
        </div>

        {/* 일간/역대 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #2a2010' }}>
          {[['daily','🌅 오늘의 방역왕'],['allTime','🌍 역대 기록']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: '8px', fontSize: 12, fontWeight: 600,
              background: tab === key ? 'rgba(200,150,0,0.08)' : 'none',
              color: tab === key ? '#d4a830' : '#4a3a1a',
              borderBottom: tab === key ? '2px solid #d4a830' : '2px solid transparent',
              border: 'none', cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        {/* 컬럼 헤더 */}
        <div style={{ display: 'flex', padding: '6px 16px', fontSize: 10, color: '#4a3a1a', letterSpacing: 1 }}>
          <span style={{ width: 36 }}>#</span>
          <span style={{ flex: 1 }}>플레이어</span>
          <span style={{ width: 80, textAlign: 'right' }}>{isDaysurvival ? '클리어 시간' : '점수'}</span>
          {!isDaysurvival && <span style={{ width: 60, textAlign: 'right' }}>킬수</span>}
        </div>

        {/* 목록 */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 12px 8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#555', padding: '32px 0' }}>
              <div style={{ fontSize: 32, animation: 'spin 1s linear infinite' }}>🪳</div>
              <div style={{ marginTop: 8, fontSize: 12 }}>로딩 중...</div>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#444', padding: '32px 0', fontSize: 13 }}>
              아직 기록이 없습니다
            </div>
          ) : (
            rows.map((row, i) => {
              const myName = currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0];
              const isMe = myName && row.username === myName;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 8px', borderRadius: 10, marginBottom: 4,
                  background: isMe ? 'rgba(200,150,0,0.15)' : i < 3 ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: isMe ? '1px solid rgba(200,150,0,0.4)' : '1px solid transparent',
                  transition: 'background 0.15s',
                }}>
                  <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
                    <RankBadge rank={i} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: isMe ? '#f5c030' : '#ddd', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.username}
                      </span>
                      {isMe && <span style={{ color: '#f5c030', fontSize: 10, flexShrink: 0 }}>(나)</span>}
                    </div>
                    <div style={{ color: '#4a4030', fontSize: 10, marginTop: 1 }}>
                      {isDaysurvival
                        ? `🪳 ${row.kill_count}마리 잡음`
                        : `WAVE ${row.wave_reached ?? '-'} | ${row.game_mode}`
                      }
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: isDaysurvival ? '#88ddff' : '#f5c030', fontWeight: 800, fontSize: 14 }}>
                      {isDaysurvival
                        ? fmtTime(row.survival_time ?? 0)
                        : (row.score ?? 0).toLocaleString()
                      }
                    </div>
                    <div style={{ color: '#4a4030', fontSize: 10 }}>
                      {isDaysurvival ? '⏱ 최속' : '🪳 ' + (row.kill_count ?? 0) + '킬'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 푸터 */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #2a2010', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => loadMode(gameMode)} style={{ color: '#5a4a28', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
            🔄 새로고침
          </button>
          {!isDaysurvival && (
            <span style={{ color: '#3a3020', fontSize: 10 }}>점수 = 킬×150 + 귗/10</span>
          )}
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid #3a3020',
            color: '#aaa', padding: '6px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
          }}>닫기</button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
