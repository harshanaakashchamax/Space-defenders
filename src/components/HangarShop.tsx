import React, { useState } from 'react';
import {
  STARSHIPS,
  GUNS,
  UPGRADE_CONFIGS,
  PlayerInventory,
  StarshipItem,
  GunItem,
} from '../utils/shopData';
import { soundManager } from '../utils/audio';
import {
  Coins,
  X,
  Zap,
  Shield,
  Gauge,
  Check,
  Sparkles,
  Magnet,
  Lock,
} from 'lucide-react';

interface HangarShopProps {
  inventory: PlayerInventory;
  onUpdateInventory: (updated: PlayerInventory) => void;
  onClose: () => void;
}

export const HangarShop: React.FC<HangarShopProps> = ({
  inventory,
  onUpdateInventory,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'ships' | 'guns' | 'upgrades'>('ships');

  const buyShip = (ship: StarshipItem) => {
    if (inventory.coins < ship.price) return;
    soundManager.playPurchase();
    const nextInventory: PlayerInventory = {
      ...inventory,
      coins: inventory.coins - ship.price,
      ownedShips: [...inventory.ownedShips, ship.id],
      equippedShip: ship.id,
    };
    onUpdateInventory(nextInventory);
  };

  const equipShip = (shipId: string) => {
    soundManager.playCoin();
    onUpdateInventory({
      ...inventory,
      equippedShip: shipId,
    });
  };

  const buyGun = (gun: GunItem) => {
    if (inventory.coins < gun.price) return;
    soundManager.playPurchase();
    const nextInventory: PlayerInventory = {
      ...inventory,
      coins: inventory.coins - gun.price,
      ownedGuns: [...inventory.ownedGuns, gun.id],
      equippedGun: gun.id,
    };
    onUpdateInventory(nextInventory);
  };

  const equipGun = (gunId: string) => {
    soundManager.playCoin();
    onUpdateInventory({
      ...inventory,
      equippedGun: gunId,
    });
  };

  const upgradeStat = (type: 'engine' | 'reload' | 'bounty', cost: number) => {
    if (inventory.coins < cost) return;
    soundManager.playPurchase();
    const nextInventory: PlayerInventory = {
      ...inventory,
      coins: inventory.coins - cost,
      engineLevel: type === 'engine' ? inventory.engineLevel + 1 : inventory.engineLevel,
      reloadLevel: type === 'reload' ? inventory.reloadLevel + 1 : inventory.reloadLevel,
      bountyLevel: type === 'bounty' ? inventory.bountyLevel + 1 : inventory.bountyLevel,
    };
    onUpdateInventory(nextInventory);
  };

  return (
    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col z-30 select-none text-slate-100 p-4 sm:p-6 overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black font-orbitron tracking-wide text-cyan-400 text-glow-cyan">
              HANGAR & ARMORY
            </h2>
            <p className="text-xs text-slate-400">
              Upgrade your craft, unlock advanced weaponry, and dominate deep space
            </p>
          </div>
        </div>

        {/* Coins & Close */}
        <div className="flex items-center gap-3">
          {/* Coin Badge */}
          <div className="flex items-center gap-2 bg-amber-950/80 border border-amber-500/60 px-3.5 py-1.5 rounded-xl shadow-lg">
            <Coins className="w-4 h-4 text-amber-400 animate-bounce" />
            <span className="font-orbitron font-bold text-amber-300 text-sm sm:text-base">
              {inventory.coins.toLocaleString()}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Close Shop"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 pt-4 pb-3">
        <button
          onClick={() => setActiveTab('ships')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-orbitron font-bold text-xs sm:text-sm tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 border ${
            activeTab === 'ships'
              ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/30'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          🚀 STARSHIPS
        </button>

        <button
          onClick={() => setActiveTab('guns')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-orbitron font-bold text-xs sm:text-sm tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 border ${
            activeTab === 'guns'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          ⚡ WEAPONS
        </button>

        <button
          onClick={() => setActiveTab('upgrades')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-orbitron font-bold text-xs sm:text-sm tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 border ${
            activeTab === 'upgrades'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/30'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          🛠️ UPGRADES
        </button>
      </div>

      {/* Tab Content List (Scrollable) */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 pt-2">
        {/* ================= STARSHIPS TAB ================= */}
        {activeTab === 'ships' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {STARSHIPS.map((ship) => {
              const isOwned = inventory.ownedShips.includes(ship.id);
              const isEquipped = inventory.equippedShip === ship.id;
              const canAfford = inventory.coins >= ship.price;

              return (
                <div
                  key={ship.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isEquipped
                      ? 'bg-slate-900/90 border-cyan-400 shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-400'
                      : isOwned
                      ? 'bg-slate-900/70 border-slate-700'
                      : 'bg-slate-950/80 border-slate-800/90 opacity-90'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Visual Ship Icon Preview */}
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: '#090d16',
                        borderColor: ship.accentColor,
                        boxShadow: `0 0 12px ${ship.glowColor}40`,
                      }}
                    >
                      <svg viewBox="0 0 40 40" className="w-10 h-10">
                        {ship.shape === 'viper' && (
                          <polygon
                            points="20,6 34,34 26,30 20,24 14,30 6,34"
                            fill={ship.hullColor}
                            stroke={ship.accentColor}
                            strokeWidth="2"
                          />
                        )}
                        {ship.shape === 'phoenix' && (
                          <polygon
                            points="20,4 36,28 32,36 20,28 8,36 4,28"
                            fill={ship.hullColor}
                            stroke={ship.accentColor}
                            strokeWidth="2"
                          />
                        )}
                        {ship.shape === 'interceptor' && (
                          <polygon
                            points="20,6 36,18 32,34 20,26 8,34 4,18"
                            fill={ship.hullColor}
                            stroke={ship.accentColor}
                            strokeWidth="2"
                          />
                        )}
                        {ship.shape === 'phantom' && (
                          <polygon
                            points="20,4 34,22 36,36 24,32 20,22 16,32 4,36 6,22"
                            fill={ship.hullColor}
                            stroke={ship.accentColor}
                            strokeWidth="2"
                          />
                        )}
                        {ship.shape === 'titan' && (
                          <polygon
                            points="20,4 34,14 36,34 26,36 20,30 14,36 4,34 6,14"
                            fill={ship.hullColor}
                            stroke={ship.accentColor}
                            strokeWidth="2.2"
                          />
                        )}
                        <circle cx="20" cy="18" r="3" fill="#ffffff" opacity="0.9" />
                      </svg>
                    </div>

                    {/* Ship Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-orbitron font-bold text-sm sm:text-base text-slate-100 truncate">
                          {ship.name}
                        </h3>
                        {isEquipped && (
                          <span className="text-[10px] font-orbitron font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {ship.description}
                      </p>

                      {/* Stat badges */}
                      <div className="flex items-center gap-2 mt-2 text-[11px] font-semibold">
                        <span className="flex items-center gap-1 text-sky-300">
                          <Gauge className="w-3 h-3" />
                          {Math.round(ship.speedMultiplier * 100)}% Speed
                        </span>
                        {ship.bonusLives > 0 && (
                          <span className="flex items-center gap-1 text-rose-400">
                            <Shield className="w-3 h-3" />+{ship.bonusLives} Lives
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      {!isOwned && (
                        <div className="flex items-center gap-1 font-orbitron font-bold text-amber-300 text-sm">
                          <Coins className="w-4 h-4 text-amber-400" />
                          <span>{ship.price === 0 ? 'FREE' : ship.price.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {isEquipped ? (
                      <div className="flex items-center gap-1 text-cyan-400 font-orbitron font-bold text-xs py-1.5 px-3 rounded-lg bg-cyan-950/60 border border-cyan-800">
                        <Check className="w-3.5 h-3.5" /> EQUIPPED
                      </div>
                    ) : isOwned ? (
                      <button
                        onClick={() => equipShip(ship.id)}
                        className="py-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-orbitron font-bold text-xs border border-slate-600 transition-all cursor-pointer"
                      >
                        EQUIP
                      </button>
                    ) : (
                      <button
                        onClick={() => buyShip(ship)}
                        disabled={!canAfford}
                        className={`py-1.5 px-4 rounded-xl font-orbitron font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                          canAfford
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/30'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                      >
                        {canAfford ? (
                          <>BUY STARSHIP</>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" /> NEED COINS
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= GUNS TAB ================= */}
        {activeTab === 'guns' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {GUNS.map((gun) => {
              const isOwned = inventory.ownedGuns.includes(gun.id);
              const isEquipped = inventory.equippedGun === gun.id;
              const canAfford = inventory.coins >= gun.price;

              return (
                <div
                  key={gun.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isEquipped
                      ? 'bg-slate-900/90 border-amber-400 shadow-lg shadow-amber-950/60 ring-1 ring-amber-400'
                      : isOwned
                      ? 'bg-slate-900/70 border-slate-700'
                      : 'bg-slate-950/80 border-slate-800/90 opacity-90'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Visual Weapon Preview */}
                    <div
                      className="w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: '#090d16',
                        borderColor: gun.bulletColor,
                        boxShadow: `0 0 12px ${gun.bulletColor}40`,
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        {gun.pattern === 'dual' && (
                          <>
                            <div
                              className="w-1.5 h-6 rounded-full"
                              style={{ backgroundColor: gun.bulletColor }}
                            />
                            <div
                              className="w-1.5 h-6 rounded-full"
                              style={{ backgroundColor: gun.bulletColor }}
                            />
                          </>
                        )}
                        {gun.pattern === 'scatter' && (
                          <>
                            <div
                              className="w-1.5 h-5 rounded-full transform -rotate-12"
                              style={{ backgroundColor: gun.bulletColor }}
                            />
                            <div
                              className="w-1.5 h-6 rounded-full"
                              style={{ backgroundColor: gun.bulletColor }}
                            />
                            <div
                              className="w-1.5 h-5 rounded-full transform rotate-12"
                              style={{ backgroundColor: gun.bulletColor }}
                            />
                          </>
                        )}
                        {gun.pattern === 'heavy' && (
                          <div
                            className="w-6 h-6 rounded-full shadow-lg"
                            style={{
                              backgroundColor: gun.bulletColor,
                              boxShadow: `0 0 8px ${gun.bulletColor}`,
                            }}
                          />
                        )}
                        {gun.pattern === 'quad' && (
                          <div className="grid grid-cols-2 gap-1">
                            <div
                              className="w-1.5 h-3 rounded-full"
                              style={{ backgroundColor: gun.bulletColor }}
                            />
                            <div
                              className="w-1.5 h-3 rounded-full"
                              style={{ backgroundColor: gun.bulletColor }}
                            />
                            <div
                              className="w-1.5 h-3 rounded-full"
                              style={{ backgroundColor: gun.bulletColor }}
                            />
                            <div
                              className="w-1.5 h-3 rounded-full"
                              style={{ backgroundColor: gun.bulletColor }}
                            />
                          </div>
                        )}
                        {gun.pattern === 'hyper' && (
                          <div className="flex items-center gap-1">
                            <div
                              className="w-2 h-7 rounded-sm shadow-md animate-pulse"
                              style={{ backgroundColor: gun.bulletColor }}
                            />
                            <div
                              className="w-2 h-7 rounded-sm shadow-md animate-pulse"
                              style={{ backgroundColor: gun.bulletColor }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Gun Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-orbitron font-bold text-sm sm:text-base text-slate-100 truncate">
                          {gun.name}
                        </h3>
                        {isEquipped && (
                          <span className="text-[10px] font-orbitron font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            EQUIPPED
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {gun.description}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[11px] font-semibold text-slate-300">
                        <span className="flex items-center gap-1 text-amber-300">
                          <Zap className="w-3 h-3" />
                          Rate: {(1 / gun.fireRate).toFixed(1)}/s
                        </span>
                        <span className="capitalize text-slate-400">
                          Pattern: {gun.pattern}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      {!isOwned && (
                        <div className="flex items-center gap-1 font-orbitron font-bold text-amber-300 text-sm">
                          <Coins className="w-4 h-4 text-amber-400" />
                          <span>{gun.price === 0 ? 'FREE' : gun.price.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {isEquipped ? (
                      <div className="flex items-center gap-1 text-amber-400 font-orbitron font-bold text-xs py-1.5 px-3 rounded-lg bg-amber-950/60 border border-amber-800">
                        <Check className="w-3.5 h-3.5" /> EQUIPPED
                      </div>
                    ) : isOwned ? (
                      <button
                        onClick={() => equipGun(gun.id)}
                        className="py-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-orbitron font-bold text-xs border border-slate-600 transition-all cursor-pointer"
                      >
                        EQUIP
                      </button>
                    ) : (
                      <button
                        onClick={() => buyGun(gun)}
                        disabled={!canAfford}
                        className={`py-1.5 px-4 rounded-xl font-orbitron font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                          canAfford
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/30'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                      >
                        {canAfford ? (
                          <>BUY WEAPON</>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" /> NEED COINS
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= UPGRADES TAB ================= */}
        {activeTab === 'upgrades' && (
          <div className="space-y-3">
            {UPGRADE_CONFIGS.map((cfg) => {
              const currentLvl =
                cfg.id === 'engine'
                  ? inventory.engineLevel
                  : cfg.id === 'reload'
                  ? inventory.reloadLevel
                  : inventory.bountyLevel;

              const isMax = currentLvl >= cfg.maxLevel;
              const nextCost = Math.round(cfg.baseCost * Math.pow(cfg.costMultiplier, currentLvl));
              const canAfford = inventory.coins >= nextCost;

              return (
                <div
                  key={cfg.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-400 shrink-0">
                      {cfg.id === 'engine' && <Gauge className="w-5 h-5" />}
                      {cfg.id === 'reload' && <Zap className="w-5 h-5" />}
                      {cfg.id === 'bounty' && <Coins className="w-5 h-5 text-amber-400" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-orbitron font-bold text-slate-100 text-sm sm:text-base">
                          {cfg.name}
                        </h4>
                        <span className="text-xs font-orbitron px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                          LVL {currentLvl} / {cfg.maxLevel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{cfg.description}</p>

                      {/* Level Pips */}
                      <div className="flex items-center gap-1.5 mt-2">
                        {Array.from({ length: cfg.maxLevel }).map((_, idx) => (
                          <div
                            key={idx}
                            className={`h-2 w-6 rounded-full transition-all ${
                              idx < currentLvl
                                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                                : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Upgrade Button */}
                  <div className="sm:self-center shrink-0">
                    {isMax ? (
                      <div className="text-emerald-400 font-orbitron font-bold text-xs py-2 px-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-center">
                        MAX LEVEL
                      </div>
                    ) : (
                      <button
                        onClick={() => upgradeStat(cfg.id as 'engine' | 'reload' | 'bounty', nextCost)}
                        disabled={!canAfford}
                        className={`w-full sm:w-auto py-2.5 px-5 rounded-xl font-orbitron font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          canAfford
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/30'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                      >
                        <span>UPGRADE</span>
                        <span className="flex items-center gap-1 text-slate-900 bg-emerald-400/80 px-2 py-0.5 rounded">
                          <Coins className="w-3.5 h-3.5" />
                          {nextCost}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
