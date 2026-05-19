import { useState } from 'react';

// 무기별 색상
const WEAPON_COLORS = {
  slipper:   { border: 'border-orange-500', bg: 'bg-orange-950', badge: 'bg-orange-600' },
  chopstick: { border: 'border-yellow-600', bg: 'bg-yellow-950', badge: 'bg-yellow-600' },
  frypan:    { border: 'border-gray-500',   bg: 'bg-gray-800',   badge: 'bg-gray-600'   },
  spray:     { border: 'border-teal-500',   bg: 'bg-teal-950',   badge: 'bg-teal-600'   },
};

function WeaponCard({ wInfo, money, onBuy }) {
  const col = WEAPON_COLORS[wInfo.key] || WEAPON_COLORS.slipper;
  const canAfford = money >= wInfo.price;

  return (
    <div className={`border-2 rounded-lg p-3 flex flex-col gap-2 transition-all ${
      wInfo.owned ? `${col.border} ${col.bg}` :
      canAfford   ? `${col.border} bg-gray-800 hover:opacity-90` :
                    'border-gray-700 bg-gray-900 opacity-50'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{wInfo.emoji}</span>
          <div>
            <div className="text-white font-bold">{wInfo.name}</div>
            <div className="flex gap-2 mt-0.5 text-xs text-gray-400">
              <span>💥 데미지 {wInfo.damage}</span>
              <span>🎯 범위 {wInfo.range}</span>
            </div>
          </div>
        </div>
        {wInfo.owned && (
          <span className={`${col.badge} text-white text-xs font-bold px-2 py-0.5 rounded`}>보유중</span>
        )}
      </div>
      {/* 쿨타임 바 */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>쿨타임</span>
        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-400 rounded-full"
            style={{ width: `${Math.max(5, 100 - (wInfo.cooldown / 1400) * 100)}%` }}
          />
        </div>
        <span className={wInfo.cooldown <= 300 ? 'text-green-400' : wInfo.cooldown >= 1200 ? 'text-red-400' : 'text-yellow-400'}>
          {wInfo.cooldown <= 300 ? '빠름' : wInfo.cooldown >= 1200 ? '느림' : '보통'}
        </span>
      </div>
      <button
        onClick={() => !wInfo.owned && canAfford && onBuy(wInfo.key)}
        disabled={wInfo.owned || !canAfford}
        className={`w-full py-1.5 rounded text-sm font-bold transition-all ${
          wInfo.owned    ? 'bg-gray-700 text-gray-400 cursor-default' :
          canAfford      ? `${col.badge} hover:opacity-80 text-white hover:scale-105` :
                           'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {wInfo.owned ? '✅ 구매완료' : wInfo.price === 0 ? '기본 지급' : `${wInfo.price} 귗에 구매`}
      </button>
    </div>
  );
}

const NPC_LIST = [
  { key: 'kimBangnyeok', name: '김방역',      emoji: '👨‍🔧', cost: 1500,  desc: '기본형 방역사. 즉시 바퀴 5마리 처리.' },
  { key: 'militaryUncle', name: '군필 삼촌',  emoji: '🪖',   cost: 1600,  desc: '슬리퍼 공격력 +10%, 범위 +20%.' },
  { key: 'sprayHalbe',   name: '살충제 할배', emoji: '👴',   cost: 8000,  desc: '맵 전체 살충제 살포! 즉시 대량 처리.' },
  { key: 'catLady',      name: '고양이 아줌마', emoji: '👩', cost: 10000, desc: '고양이 2마리 소환. 자동 사냥 강화.' },
];

function UpgradeCard({ info, money, onBuy }) {
  const canAfford = money >= info.cost;
  const maxed = !info.consumable && info.level >= 5;
  const isDisabled = info.consumable ? (info.disabled || !canAfford) : (maxed || !canAfford);

  return (
    <div className={`border rounded-lg p-3 flex flex-col gap-2 transition-all ${
      maxed              ? 'border-purple-500 bg-purple-950' :
      info.consumable    ? (canAfford && !info.disabled ? 'border-pink-500 bg-pink-950 hover:border-pink-400 cursor-pointer' : 'border-gray-700 bg-gray-900 opacity-60') :
      canAfford          ? 'border-yellow-600 bg-gray-800 hover:border-yellow-400 cursor-pointer' :
                           'border-gray-700 bg-gray-900 opacity-60'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{info.emoji}</span>
          <div>
            <div className="text-white font-bold text-sm">{info.name}</div>
            <div className="text-gray-400 text-xs">{info.desc}</div>
          </div>
        </div>
        {!info.consumable && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < info.level ? 'bg-yellow-400' : 'bg-gray-700'}`} />
              ))}
            </div>
            <div className="text-xs text-gray-400">Lv.{info.level}</div>
          </div>
        )}
        {info.consumable && (
          <span className="text-xs text-pink-300 border border-pink-700 px-1.5 py-0.5 rounded">소모품</span>
        )}
      </div>
      <button
        onClick={() => !isDisabled && onBuy(info.key)}
        disabled={isDisabled}
        className={`w-full py-1.5 rounded text-sm font-bold transition-all ${
          maxed              ? 'bg-purple-700 text-purple-300 cursor-default' :
          isDisabled         ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
          info.consumable    ? 'bg-pink-600 hover:bg-pink-500 text-white hover:scale-105' :
                               'bg-yellow-600 hover:bg-yellow-500 text-black hover:scale-105'
        }`}
      >
        {maxed ? '✅ MAX' : info.consumable && info.disabled ? 'HP 가득 참' : `${info.cost.toLocaleString()} 귗`}
      </button>
    </div>
  );
}

function NPCCard({ npc, money, hired, onHire }) {
  const canAfford = money >= npc.cost;
  return (
    <div className={`border rounded-lg p-3 flex flex-col gap-2 transition-all ${
      hired ? 'border-green-500 bg-green-950' :
      canAfford ? 'border-yellow-600 bg-gray-800 hover:border-yellow-400' :
      'border-gray-700 bg-gray-900 opacity-60'
    }`}>
      <div className="flex items-center gap-2">
        <span className="text-3xl">{npc.emoji}</span>
        <div>
          <div className="text-white font-bold text-sm">{npc.name}</div>
          <div className="text-gray-400 text-xs">{npc.desc}</div>
        </div>
      </div>
      <button
        onClick={() => !hired && canAfford && onHire(npc.key)}
        disabled={hired || !canAfford}
        className={`w-full py-1.5 rounded text-sm font-bold transition-all ${
          hired ? 'bg-green-700 text-green-300 cursor-default' :
          canAfford ? 'bg-yellow-600 hover:bg-yellow-500 text-black hover:scale-105' :
          'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {hired ? '✅ 고용됨' : `${npc.cost.toLocaleString()} 귗`}
      </button>
    </div>
  );
}

export default function UpgradeShop({ gameState, upgradeInfo, weaponShopInfo, onBuy, onBuyWeapon, onHireNPC, onClose }) {
  const [tab, setTab] = useState('weapons'); // 처음엔 무기 탭 열림
  const [hiredNPCs, setHiredNPCs] = useState([]);

  if (!gameState || !upgradeInfo) return null;
  const { money } = gameState;

  const handleHireNPC = (key) => {
    if (onHireNPC(key)) {
      setHiredNPCs(prev => [...prev, key]);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-gray-900 border-2 border-yellow-600 rounded-xl w-full max-w-lg mx-4 shadow-2xl shadow-yellow-950 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-yellow-400 font-bold text-xl">🛒 흙수저 집 수리점</h2>
            <p className="text-gray-400 text-xs">돈이 있으면 행복이 온다</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-yellow-300 font-bold">💰 {money.toLocaleString()} 귗</div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl transition-colors">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {[
            { key: 'weapons',  label: '🥿 무기 구매' },
            { key: 'upgrades', label: '🏠 집 업그레이드' },
            { key: 'npcs',     label: '👥 숨은고수' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-sm font-bold transition-colors ${
                tab === t.key ? 'bg-yellow-900 text-yellow-300 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-3">
          {tab === 'weapons' && (
            <div className="flex flex-col gap-3">
              <p className="text-gray-500 text-xs text-center">무기를 구매하면 Q키로 교체할 수 있어요</p>
              {(weaponShopInfo || []).sort((a, b) => a.price - b.price).map(w => (
                <WeaponCard key={w.key} wInfo={w} money={money} onBuy={onBuyWeapon} />
              ))}
            </div>
          )}
          {tab === 'upgrades' && (
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(upgradeInfo)
                .map(([key, info]) => ({ ...info, key: info.key || key }))
                .sort((a, b) => a.cost - b.cost)
                .map(info => (
                  <UpgradeCard key={info.key} info={info} money={money} onBuy={onBuy} />
                ))}
            </div>
          )}

          {tab === 'npcs' && (
            <div>
              <p className="text-gray-500 text-xs mb-3 text-center">
                동네 방역 고수들을 고용하여 바퀴를 박멸하세요!
              </p>
              <div className="grid grid-cols-1 gap-2">
                {[...NPC_LIST].sort((a, b) => a.cost - b.cost).map(npc => (
                  <NPCCard
                    key={npc.key}
                    npc={npc}
                    money={money}
                    hired={hiredNPCs.includes(npc.key)}
                    onHire={handleHireNPC}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 flex justify-between items-center">
          <span className="text-gray-500 text-xs">B키 또는 닫기로 게임으로 돌아가기</span>
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            계속 싸우기 🥿
          </button>
        </div>
      </div>
    </div>
  );
}
