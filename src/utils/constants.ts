export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 920;

export const PLAYER_SPEED = 480; // pixels per second
export const PLAYER_WIDTH = 46;
export const PLAYER_HEIGHT = 48;
export const PLAYER_FIRE_RATE = 0.22; // seconds between regular shots
export const PLAYER_RAPID_FIRE_RATE = 0.11; // rapid fire rate
export const INVINCIBLE_DURATION = 2.5; // seconds
export const RAPID_FIRE_DURATION = 10; // seconds

export const ENEMY_COLORS = {
  scout: {
    color: '#ec4899', // bright pink
    accentColor: '#f43f5e',
    glow: 'rgba(236, 72, 153, 0.6)',
  },
  interceptor: {
    color: '#f97316', // neon orange
    accentColor: '#eab308',
    glow: 'rgba(249, 115, 22, 0.6)',
  },
  gunship: {
    color: '#a855f7', // purple
    accentColor: '#06b6d4',
    glow: 'rgba(168, 85, 247, 0.7)',
  },
  kamikaze: {
    color: '#ef4444', // hazard red
    accentColor: '#f59e0b',
    glow: 'rgba(239, 68, 68, 0.8)',
  },
  boss: {
    color: '#e11d48', // crimson
    accentColor: '#38bdf8',
    glow: 'rgba(225, 29, 72, 0.8)',
  },
};

export const POWERUP_CONFIG = {
  shield: {
    color: '#38bdf8', // cyan
    label: 'SHIELD',
    icon: '🛡️',
  },
  rapid: {
    color: '#facc15', // yellow
    label: 'RAPID FIRE',
    icon: '⚡',
  },
  life: {
    color: '#22c55e', // green
    label: 'EXTRA LIFE',
    icon: '❤️',
  },
  bomb: {
    color: '#f97316', // orange
    label: 'NOVA BOMB',
    icon: '💣',
  },
};
