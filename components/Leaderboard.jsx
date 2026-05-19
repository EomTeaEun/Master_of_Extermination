import { useEffect, useState } from 'react';
import { getDailyRanking, getAllTimeRanking } from '../lib/supabase';

const MOCK_DAILY = [
  { username: '방역왕_김씨', kill_count: 247, wave_reached: 8, game_mode: '3min' },
  { username: '슬리퍼달인', kill_count: 198, wave_reached: 7, game_mode: '3min' },
  { username: '바퀴사냥꾼99', kill_count: 156, wave_reached: 6, game_mode: 'infinite' },
  { username: '흙수저탈출', kill_count: 134, wave_reached: 5, game_mode: '3min' },
  { username: '고시원_전사', kill_count: 112, wave_reached: 5, game_mode: '3min' },
];

const MOCK_ALL_TIME = [
  { username: '전국방역왕', best_kill_count: 1842, best_wave: 22, total_games: 89 },
  { username: '살충제마스터', best_kill_count: 1234, best_wave: 15, total_games: 45 },
  { username: '바퀴지옥탈출', best_kill_count: 987, best_wave: 12, total_games: 67 },
  { username: '방역의달인', best_kill_count: 756, best_wave: 10, total_games: 34 },
  { username: 'SlipperGod', best_kill_count: 623, best_wave: 9, total_games: 21 },
];

function RankBadge({ rank }) {
  if (rank === 0) return <span className="text-2xl">🥇</span>;
  if (rank === 1) return <span className="text-2xl">🥈</span>;
  if (rank === 2) return <span className="text-2xl">🥉</span>;
  return <span className="text-gray-400 w-8 text-center font-bold">{rank + 1}</span>;
}

export default function Leaderboard({ onClose, currentUser }) {
  const [tab, setTab] = useState('daily');
  const [data, setData] = useState({ daily: null, allTime: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [daily, allTime] = await Promise.all([getDailyRanking(), getAllTimeRanking()]);
      setData({
        daily: daily.data?.length > 0 ? daily.data : MOCK_DAILY,
        allTime: allTime.data?.length > 0 ? allTime.data : MOCK_ALL_TIME,
      });
    } catch {
      setData({ daily: MOCK_DAILY, allTime: MOCK_ALL_TIME });
    }
    setLoading(false);
  }

  const rows = tab === 'daily' ? (data.daily || MOCK_DAILY) : (data.allTime || MOCK_ALL_TIME);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-gray-900 border-2 border-yellow-600 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-yellow-400 font-bold text-xl">🏆 명예의 전당</h2>
            <p className="text-gray-400 text-xs">전국 방역 달인 순위</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setTab('daily')}
            className={`flex-1 py-2 text-sm font-bold transition-colors ${tab === 'daily' ? 'bg-yellow-900 text-yellow-300 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            🌅 오늘의 방역왕
          </button>
          <button
            onClick={() => setTab('allTime')}
            className={`flex-1 py-2 text-sm font-bold transition-colors ${tab === 'allTime' ? 'bg-yellow-900 text-yellow-300 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            🌍 역대 킬수
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-3">
          {loading ? (
            <div className="text-center text-gray-400 py-8">
              <div className="text-3xl mb-2 animate-spin">🪳</div>
              데이터 로딩 중...
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((row, i) => {
                const isMe = currentUser && row.username === (currentUser.user_metadata?.username || currentUser.email?.split('@')[0]);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      isMe
                        ? 'bg-yellow-900 border-yellow-500 shadow-lg'
                        : i < 3
                        ? 'bg-gray-800 border-gray-600'
                        : 'bg-gray-850 border-gray-700'
                    }`}
                  >
                    <RankBadge rank={i} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={`font-bold text-sm truncate ${isMe ? 'text-yellow-300' : 'text-white'}`}>
                          {row.username}
                        </span>
                        {isMe && <span className="text-xs text-yellow-400 shrink-0">(나)</span>}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {tab === 'daily'
                          ? `WAVE ${row.wave_reached} | ${row.game_mode}`
                          : `${row.total_games}게임 | 최고 WAVE ${row.best_wave}`
                        }
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-white font-bold">
                        {tab === 'daily' ? row.kill_count : row.best_kill_count}
                        <span className="text-gray-400 text-xs"> 마리</span>
                      </div>
                      <div className="text-yellow-500 text-xs">🪳킬</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 flex justify-between items-center">
          <button onClick={loadData} className="text-gray-400 hover:text-white text-xs transition-colors">
            🔄 새로고침
          </button>
          <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded text-sm transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
