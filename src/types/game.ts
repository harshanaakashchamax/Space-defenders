export type GameStatus = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export type PowerUpType = 'shield' | 'rapid' | 'life' | 'bomb';

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: PowerUpType;
  vy: number;
  vx: number;
  pulseTimer: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glowColor: string;
  isEnemy: boolean;
  damage: number;
  trail?: { x: number; y: number; alpha: number }[];
}

export type EnemyType = 'scout' | 'interceptor' | 'gunship' | 'kamikaze' | 'boss';

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  scoreValue: number;
  color: string;
  accentColor: string;
  shootCooldown: number;
  shootInterval: number;
  behaviorTimer: number;
  initialX: number;
  phase?: number;
  bossName?: string;
  bossTitle?: string;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  type?: 'spark' | 'smoke' | 'ring' | 'thrust';
  maxRadius?: number;
  currentRadius?: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  alpha: number;
  scale: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  brightness: number;
  layer: number;
  color: string;
}

export interface PlayerStats {
  score: number;
  highScore: number;
  lives: number;
  maxLives: number;
  wave: number;
  combo: number;
  comboTimer: number;
  enemiesDefeated: number;
  accuracy: number;
  shotsFired: number;
  shotsHit: number;
}
