export interface StarshipItem {
  id: string;
  name: string;
  price: number;
  description: string;
  hullColor: string;
  accentColor: string;
  glowColor: string;
  trailColor: string;
  speedMultiplier: number;
  bonusLives: number;
  shape: 'viper' | 'phoenix' | 'interceptor' | 'phantom' | 'titan';
}

export interface GunItem {
  id: string;
  name: string;
  price: number;
  description: string;
  fireRate: number;
  pattern: 'dual' | 'scatter' | 'heavy' | 'quad' | 'hyper';
  bulletColor: string;
  bulletGlow: string;
  bulletRadius: number;
  soundType: 'laser' | 'heavy' | 'rapid' | 'hyper';
}

export interface PlayerInventory {
  coins: number;
  ownedShips: string[];
  equippedShip: string;
  ownedGuns: string[];
  equippedGun: string;
  engineLevel: number;
  reloadLevel: number;
  bountyLevel: number; // auto-claim bonus multiplier
  magnetLevel?: number; // legacy fallback
}

export const STARSHIPS: StarshipItem[] = [
  {
    id: 'ship-viper',
    name: 'Viper Scout',
    price: 0,
    description: 'Standard agile patrol fighter. Balanced speed and handling.',
    hullColor: '#0284c7',
    accentColor: '#38bdf8',
    glowColor: '#06b6d4',
    trailColor: '#38bdf8',
    speedMultiplier: 1.0,
    bonusLives: 0,
    shape: 'viper',
  },
  {
    id: 'ship-phoenix',
    name: 'Solar Phoenix',
    price: 150,
    description: 'Swept-wing interceptor with supercharged golden solar engines (+15% Speed).',
    hullColor: '#ea580c',
    accentColor: '#facc15',
    glowColor: '#f97316',
    trailColor: '#f59e0b',
    speedMultiplier: 1.15,
    bonusLives: 0,
    shape: 'phoenix',
  },
  {
    id: 'ship-interceptor',
    name: 'Jade Striker',
    price: 350,
    description: 'Reinforced nano-armor hull. Grants +1 Extra Starting Life (6 total).',
    hullColor: '#059669',
    accentColor: '#34d399',
    glowColor: '#10b981',
    trailColor: '#34d399',
    speedMultiplier: 1.05,
    bonusLives: 1,
    shape: 'interceptor',
  },
  {
    id: 'ship-phantom',
    name: 'Void Phantom',
    price: 650,
    description: 'Quantum-drive stealth cruiser with immense acceleration (+25% Speed).',
    hullColor: '#7c3aed',
    accentColor: '#e879f9',
    glowColor: '#a855f7',
    trailColor: '#ec4899',
    speedMultiplier: 1.25,
    bonusLives: 0,
    shape: 'phantom',
  },
  {
    id: 'ship-titan',
    name: 'Cosmic Titan',
    price: 1200,
    description: 'Apex heavy dreadnought. Extremely durable with +2 Extra Starting Lives (7 total).',
    hullColor: '#dc2626',
    accentColor: '#f8fafc',
    glowColor: '#ef4444',
    trailColor: '#f43f5e',
    speedMultiplier: 1.1,
    bonusLives: 2,
    shape: 'titan',
  },
];

export const GUNS: GunItem[] = [
  {
    id: 'gun-twin',
    name: 'Twin Blaster',
    price: 0,
    description: 'Standard dual-barrel cyan plasma cannons. Clean and reliable.',
    fireRate: 0.17,
    pattern: 'dual',
    bulletColor: '#38bdf8',
    bulletGlow: 'rgba(56, 189, 248, 0.8)',
    bulletRadius: 3.5,
    soundType: 'laser',
  },
  {
    id: 'gun-scatter',
    name: 'Triple Scatter',
    price: 200,
    description: 'Fires 3 golden projectiles in a wide forward cone to wipe multiple lanes.',
    fireRate: 0.18,
    pattern: 'scatter',
    bulletColor: '#facc15',
    bulletGlow: 'rgba(250, 204, 21, 0.8)',
    bulletRadius: 3.5,
    soundType: 'laser',
  },
  {
    id: 'gun-heavy',
    name: 'Heavy Plasma Orb',
    price: 450,
    description: 'Fires massive, pulsating high-energy violet spheres with wide collision hitboxes.',
    fireRate: 0.22,
    pattern: 'heavy',
    bulletColor: '#c084fc',
    bulletGlow: 'rgba(192, 132, 252, 0.9)',
    bulletRadius: 6.5,
    soundType: 'heavy',
  },
  {
    id: 'gun-quad',
    name: 'Quad Striker',
    price: 800,
    description: '4-stream rapid laser storm firing high-velocity jade energy bolts.',
    fireRate: 0.13,
    pattern: 'quad',
    bulletColor: '#34d399',
    bulletGlow: 'rgba(52, 211, 153, 0.8)',
    bulletRadius: 3.2,
    soundType: 'rapid',
  },
  {
    id: 'gun-hyper',
    name: 'Hyper Nova Ray',
    price: 1500,
    description: 'Supercharged concentrated twin neon beams with maximum firing speed.',
    fireRate: 0.10,
    pattern: 'hyper',
    bulletColor: '#00f5ff',
    bulletGlow: 'rgba(0, 245, 255, 0.9)',
    bulletRadius: 4.2,
    soundType: 'hyper',
  },
];

export const UPGRADE_CONFIGS = [
  {
    id: 'engine',
    name: 'Thruster Overdrive',
    description: 'Increases flight speed by +6% per level.',
    maxLevel: 5,
    baseCost: 75,
    costMultiplier: 1.6,
  },
  {
    id: 'reload',
    name: 'Rapid Capacitor',
    description: 'Increases weapon fire rate by +8% per level.',
    maxLevel: 5,
    baseCost: 90,
    costMultiplier: 1.7,
  },
  {
    id: 'bounty',
    name: 'Auto-Coin Harvester',
    description: 'Automatically yields +25% bonus coins per destroyed enemy.',
    maxLevel: 4,
    baseCost: 100,
    costMultiplier: 1.8,
  },
];

const INVENTORY_STORAGE_KEY = 'space_defender_inventory_v1';

export function loadInventory(): PlayerInventory {
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const bounty = typeof parsed.bountyLevel === 'number'
        ? parsed.bountyLevel
        : typeof parsed.magnetLevel === 'number'
        ? parsed.magnetLevel
        : 0;

      return {
        coins: typeof parsed.coins === 'number' ? parsed.coins : 0,
        ownedShips: Array.isArray(parsed.ownedShips) && parsed.ownedShips.length > 0 ? parsed.ownedShips : ['ship-viper'],
        equippedShip: parsed.equippedShip || 'ship-viper',
        ownedGuns: Array.isArray(parsed.ownedGuns) && parsed.ownedGuns.length > 0 ? parsed.ownedGuns : ['gun-twin'],
        equippedGun: parsed.equippedGun || 'gun-twin',
        engineLevel: typeof parsed.engineLevel === 'number' ? parsed.engineLevel : 0,
        reloadLevel: typeof parsed.reloadLevel === 'number' ? parsed.reloadLevel : 0,
        bountyLevel: bounty,
      };
    }
  } catch {
    // Fallback on parse failure
  }

  return {
    coins: 0,
    ownedShips: ['ship-viper'],
    equippedShip: 'ship-viper',
    ownedGuns: ['gun-twin'],
    equippedGun: 'gun-twin',
    engineLevel: 0,
    reloadLevel: 0,
    bountyLevel: 0,
  };
}

export function saveInventory(inv: PlayerInventory) {
  try {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inv));
  } catch {
    // Ignore storage errors
  }
}
