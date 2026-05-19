import { useEffect, useState } from 'react';
import { saveScore } from '../lib/supabase';

// BAD ENDING: HP 0 → 주인공이 현실에 우울감을 느끼는 엔딩 (B급 병맛)
function BadEnding({ stats, onRetry, onMenu }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 6000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Phase 0-1: Darkness */}
      {phase >= 0 && phase < 2 && (
        <div className="text-center transition-all duration-1000">
          <div className="text-6xl mb-4">🪳</div>
          <div className={`text-red-500 text-2xl font-bold transition-opacity duration-1000 ${phase >= 1 ? 'opacity-100' : 'opacity-0'}`}>
            바퀴에게 졌다...
          </div>
        </div>
      )}

      {/* Phase 2: Sad scene */}
      {phase >= 2 && phase < 4 && (
        <div className={`text-center transition-all duration-1000 ${phase >= 2 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-8xl mb-6 animate-bounce">😔</div>
          <div className="text-gray-300 text-lg mb-2">"나는 왜 이렇게 사는 걸까..."</div>
          <div className="text-gray-500 text-sm">"월세 40만원짜리 방에서 바퀴한테 지다니..."</div>
          <div className="flex justify-center gap-2 mt-4 text-3xl">
            {'🪳'.repeat(8).split('').map((r, i) => (
              <span key={i} style={{ animationDelay: `${i*0.1}s` }} className="animate-bounce">{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* Phase 3-4: Dramatic ending + stats */}
      {phase >= 4 && (
        <div className="text-center animate-fade-in">
          {/* Main ending card */}
          <div className="bg-gray-900 border-2 border-red-800 rounded-xl p-6 max-w-md mx-4 mb-6">
            <div className="text-red-400 text-4xl font-bold mb-2">💀 GAME OVER</div>
            <div className="text-gray-400 text-sm mb-4">바퀴벌레 {stats.killCount}마리를 잡았지만...</div>
            <div className="text-gray-300 italic text-sm border-l-4 border-red-700 pl-3 text-left mb-4">
              "각박한 현실 속에서 그는 깨달았다.<br/>
              바퀴벌레보다 자신의 처지가 더 처참하다는 것을."<br/>
              <span className="text-gray-500">— 흙수저 연대기 중에서</span>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400">처치</div>
                <div className="text-white font-bold">{stats.killCount}마리 🪳</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400">벌었던 돈</div>
                <div className="text-yellow-300 font-bold">{stats.money.toLocaleString()} 귗</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400">웨이브</div>
                <div className="text-red-300 font-bold">WAVE {stats.wave}</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400">점수</div>
                <div className="text-purple-300 font-bold">{stats.score.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={onRetry}
              className="bg-red-700 hover:bg-red-600 text-white font-bold px-8 py-3 rounded-lg text-lg transition-all hover:scale-105 border-2 border-red-500"
            >
              🥿 다시 싸우기 (한 판만 더)
            </button>
            <button
              onClick={onMenu}
              className="text-gray-400 hover:text-white text-sm border border-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              🏠 메인으로
            </button>
          </div>

          {/* B급 footer text */}
          <div className="mt-4 text-gray-700 text-xs">
            "내일은 더 잘 할 수 있다. 아마도. 아마?"
          </div>
        </div>
      )}
    </div>
  );
}

// GOOD ENDING: 시간 내 생존
function GoodEnding({ stats, onRetry, onMenu }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const grade = stats.killCount >= 100 ? 'S' : stats.killCount >= 50 ? 'A' : stats.killCount >= 20 ? 'B' : 'C';
  const gradeColor = grade === 'S' ? 'text-yellow-400' : grade === 'A' ? 'text-green-400' : grade === 'B' ? 'text-blue-400' : 'text-gray-400';

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-yellow-950 to-black flex flex-col items-center justify-center overflow-hidden">
      {/* Falling roach particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute text-2xl"
            style={{
              left: `${Math.random() * 100}%`,
              top: '-10%',
              animation: `fall ${2 + Math.random() * 3}s linear ${Math.random() * 2}s infinite`,
              opacity: 0.3,
            }}
          >
            💀
          </div>
        ))}
      </div>

      {phase >= 1 && (
        <div className={`text-center transition-all duration-1000 ${phase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <div className="text-6xl mb-2">🎉</div>
          <div className="text-yellow-400 text-4xl font-bold mb-1">생존 성공!!</div>
          <div className="text-gray-300 text-sm">3분 동안 살아남았다!!</div>
        </div>
      )}

      {phase >= 2 && (
        <div className="bg-gray-900 border-2 border-yellow-600 rounded-xl p-6 max-w-md mx-4 mt-6 text-center">
          {/* Grade */}
          <div className={`text-8xl font-bold ${gradeColor} mb-2`}>{grade}</div>
          <div className="text-gray-400 text-sm mb-4">방역 등급</div>

          {/* Story text */}
          <div className="text-gray-300 italic text-sm border-l-4 border-yellow-700 pl-3 text-left mb-4">
            "오늘 밤 바퀴와의 전쟁에서 살아남았다.<br/>
            슬리퍼는 뜨거웠고, 손목은 아팠지만...<br/>
            <span className="text-yellow-400">적어도 오늘 밤은 내가 이 방의 주인이다.</span>"
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 text-sm mb-4">
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-400">총 처치</div>
              <div className="text-white font-bold">{stats.killCount}마리 🪳</div>
            </div>
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-400">획득 귗</div>
              <div className="text-yellow-300 font-bold">{stats.money.toLocaleString()} 귗</div>
            </div>
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-400">최고 웨이브</div>
              <div className="text-red-300 font-bold">WAVE {stats.wave}</div>
            </div>
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-400">최종 점수</div>
              <div className="text-purple-300 font-bold">{stats.score.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {phase >= 3 && (
        <div className="flex flex-col gap-3 items-center mt-6">
          <button
            onClick={onRetry}
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-8 py-3 rounded-lg text-lg transition-all hover:scale-105 border-2 border-yellow-400"
          >
            🥿 한 판 더!! (기록 경신)
          </button>
          <button
            onClick={onMenu}
            className="text-gray-400 hover:text-white text-sm border border-gray-700 px-4 py-2 rounded-lg transition-colors"
          >
            🏠 메인으로
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes fall {
          from { transform: translateY(0) rotate(0deg); }
          to { transform: translateY(110vh) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function Endings({ type, stats, user, onRetry, onMenu }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user && stats && !saved) {
      setSaved(true);
      saveScore({
        userId: user.id,
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'unknown',
        killCount: stats.killCount,
        moneyEarned: stats.money,
        waveReached: stats.wave,
        survivalTime: stats.survivalTime || 0,
        gameMode: stats.gameMode || '3min',
        endedWith: type === 'win' ? 'win' : 'death',
      });
    }
  }, [user, stats, saved, type]);

  if (type === 'death') {
    return <BadEnding stats={stats} onRetry={onRetry} onMenu={onMenu} />;
  }
  return <GoodEnding stats={stats} onRetry={onRetry} onMenu={onMenu} />;
}
