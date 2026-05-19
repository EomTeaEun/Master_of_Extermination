import { useState, useEffect } from 'react';

const SCENES = [
  {
    bg: 'bg-gray-900',
    caption: '밤 11시. 어두운 고시원 방.',
    text: '오늘도 야근하고 집에 돌아왔다.',
    emoji: '🌙',
    subtext: '전기세 아끼려고 불도 안 켰다.',
    illustration: <DarkRoom />,
  },
  {
    bg: 'bg-gray-900',
    caption: '그런데...',
    text: '다리가 좀 가렵다.',
    emoji: '🦵',
    subtext: '\'에이 그냥 피곤한 거겠지\'',
    illustration: <ScratchingLeg />,
  },
  {
    bg: 'bg-gray-800',
    caption: '불을 켰다.',
    text: '긁으려다 보니...',
    emoji: '😧',
    subtext: '뭔가... 꿈틀거리고 있었다.',
    illustration: <LightOn />,
  },
  {
    bg: 'bg-red-950',
    caption: '!!!!!!',
    text: '🪳 바퀴벌레였다 🪳',
    emoji: '😱',
    subtext: '내 다리에 바퀴벌레가 올라타 있었다!!',
    illustration: <RoachOnLeg />,
    shake: true,
  },
  {
    bg: 'bg-red-950',
    caption: '소리를 질렀다.',
    text: '"으아아아아아아아아아!!!!!"',
    emoji: '😱',
    subtext: '그 순간...',
    illustration: <Screaming />,
    shake: true,
  },
  {
    bg: 'bg-black',
    caption: '집 전체가...',
    text: '샤샤샤샥 샤샤샤샥',
    emoji: '🪳🪳🪳',
    subtext: '사방에서 바퀴벌레가 쏟아져 나왔다!!!',
    illustration: <RoachInvasion />,
    shake: true,
  },
  {
    bg: 'bg-yellow-900',
    caption: '선택의 시간',
    text: '도망칠 것인가, 싸울 것인가.',
    emoji: '🥿',
    subtext: '바닥에 슬리퍼가 보인다...',
    illustration: <SlipperOnFloor />,
    final: true,
  },
];

function DarkRoom() {
  return (
    <div className="relative w-64 h-48 bg-gray-950 border border-gray-700 rounded mx-auto overflow-hidden">
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-yellow-900 opacity-60" />
      <div className="absolute bottom-8 left-4 w-16 h-20 bg-gray-800 rounded-sm" />
      <div className="absolute bottom-8 right-4 w-20 h-12 bg-gray-800" />
      <div className="absolute top-2 right-2 text-xs text-gray-600">고시원 302호</div>
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 text-4xl opacity-30">🌙</div>
    </div>
  );
}

function ScratchingLeg() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="text-7xl animate-bounce">🦵</div>
      <div className="flex gap-1">
        {['~','~','~','~','~'].map((t,i) => (
          <span key={i} className="text-yellow-400 text-2xl" style={{ animationDelay: `${i*0.1}s` }}>~</span>
        ))}
      </div>
    </div>
  );
}

function LightOn() {
  return (
    <div className="relative w-64 h-48 bg-yellow-900 rounded mx-auto overflow-hidden">
      <div className="absolute inset-0 bg-yellow-400 opacity-20 animate-pulse" />
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-3xl">💡</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-6xl">😨</div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-yellow-700" />
    </div>
  );
}

function RoachOnLeg() {
  return (
    <div className="relative flex flex-col items-center gap-2 py-2">
      <div className="text-lg text-red-400 font-bold animate-pulse">!!!</div>
      <div className="relative">
        <div className="text-6xl">🦵</div>
        <div className="absolute -top-2 right-0 text-3xl animate-bounce">🪳</div>
      </div>
      <div className="text-red-300 text-sm font-mono">[ HP -5 ]</div>
    </div>
  );
}

function Screaming() {
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="text-7xl" style={{ animation: 'shake 0.1s infinite' }}>😱</div>
      <div className="flex gap-1 text-yellow-400 font-bold text-lg animate-pulse">
        <span>!</span><span>!</span><span>!</span><span>!</span><span>!</span>
      </div>
    </div>
  );
}

function RoachInvasion() {
  const roaches = ['🪳','🪳','🪳','🪳','🪳','🪳','🪳','🪳','🪳'];
  return (
    <div className="relative w-64 h-48 bg-black border border-red-900 rounded mx-auto overflow-hidden">
      <div className="absolute inset-0 bg-yellow-900 opacity-20" />
      {roaches.map((r, i) => (
        <div
          key={i}
          className="absolute text-xl"
          style={{
            left: `${10 + (i % 3) * 30}%`,
            top: `${10 + Math.floor(i / 3) * 30}%`,
            animation: `scurry-${i % 3} 0.5s infinite alternate`,
            transform: `rotate(${i * 40}deg)`,
          }}
        >
          {r}
        </div>
      ))}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-center text-red-400 text-xs font-bold">
        바퀴 대습격!!
      </div>
    </div>
  );
}

function SlipperOnFloor() {
  return (
    <div className="relative w-64 h-48 bg-yellow-900 rounded mx-auto overflow-hidden">
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-yellow-700" />
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-5xl" style={{ transform: 'rotate(-20deg) translateX(-50%)' }}>
        🥿
      </div>
      <div className="absolute top-4 left-0 right-0 flex justify-around text-2xl opacity-50">
        <span>🪳</span><span>🪳</span><span>🪳</span>
      </div>
      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-yellow-300 text-xs font-bold">
        잡을 것인가...
      </div>
    </div>
  );
}

export default function Opening({ onComplete }) {
  const [scene, setScene] = useState(0);
  const [visible, setVisible] = useState(true);
  const [textVisible, setTextVisible] = useState(false);
  const [autoNext, setAutoNext] = useState(null);

  useEffect(() => {
    setTextVisible(false);
    const t = setTimeout(() => setTextVisible(true), 200);
    return () => clearTimeout(t);
  }, [scene]);

  const next = () => {
    if (scene >= SCENES.length - 1) {
      onComplete();
      return;
    }
    setVisible(false);
    setTimeout(() => {
      setScene(s => s + 1);
      setVisible(true);
    }, 300);
  };

  const skip = () => onComplete();

  const current = SCENES[scene];

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${current.bg} transition-colors duration-500`}>
      {/* Skip button */}
      <button
        onClick={skip}
        className="absolute top-4 right-4 text-gray-400 hover:text-white text-sm border border-gray-600 px-3 py-1 rounded transition-colors"
      >
        스킵 ▶▶
      </button>

      {/* Scene counter */}
      <div className="absolute top-4 left-4 flex gap-1">
        {SCENES.map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full ${i <= scene ? 'bg-yellow-400' : 'bg-gray-700'}`} />
        ))}
      </div>

      {/* Content */}
      <div
        className={`max-w-lg w-full mx-4 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${current.shake ? 'animate-bounce' : ''}`}
      >
        {/* Caption */}
        <div className="text-gray-400 text-sm text-center mb-2 font-mono">{current.caption}</div>

        {/* Illustration */}
        <div className="mb-4">
          {current.illustration}
        </div>

        {/* Main text */}
        <div className={`text-center transition-all duration-500 ${textVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-white text-xl font-bold mb-1 font-['Noto_Sans_KR']">
            {current.text}
          </div>
          <div className="text-4xl my-2">{current.emoji}</div>
          <div className="text-gray-300 text-sm">{current.subtext}</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="absolute bottom-8 flex flex-col items-center gap-3">
        {current.final ? (
          <button
            onClick={next}
            className="bg-red-600 hover:bg-red-500 text-white font-bold px-10 py-4 rounded-lg text-lg transition-all hover:scale-105 border-2 border-red-400 shadow-lg shadow-red-900 animate-pulse"
          >
            🥿 슬리퍼 집어들기 🪳
          </button>
        ) : (
          <button
            onClick={next}
            className="text-gray-300 hover:text-white text-sm flex items-center gap-2 transition-colors"
          >
            <span>다음</span>
            <span>▶</span>
          </button>
        )}
        <div className="text-gray-600 text-xs">{scene + 1} / {SCENES.length}</div>
      </div>

      <style jsx>{`
        @keyframes scurry-0 { from { transform: translateX(-5px) rotate(0deg); } to { transform: translateX(5px) rotate(20deg); } }
        @keyframes scurry-1 { from { transform: translateY(-5px) rotate(0deg); } to { transform: translateY(5px) rotate(-20deg); } }
        @keyframes scurry-2 { from { transform: translate(-3px, -3px) rotate(0deg); } to { transform: translate(3px, 3px) rotate(30deg); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
      `}</style>
    </div>
  );
}
