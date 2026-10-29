import {
  GAME_WIDTH,
  GAME_HEIGHT,
  PLAYER_SPEED,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_FIRE_RATE,
  PLAYER_RAPID_FIRE_RATE,
  INVINCIBLE_DURATION,
  RAPID_FIRE_DURATION,
  ENEMY_COLORS,
  POWERUP_CONFIG,
} from '../utils/constants';
import {
  GameStatus,
  PlayerStats,
  Bullet,
  Enemy,
  Particle,
  PowerUp,
  FloatingText,
  Star,
  EnemyType,
  PowerUpType,
} from '../types/game';
import { soundManager } from '../utils/audio';

export interface GameEngineCallbacks {
  onStatusChange: (status: GameStatus) => void;
  onStatsChange: (stats: PlayerStats) => void;
  onActivePowerupsChange: (powerups: { rapidTimer: number; hasShield: boolean; bombs: number }) => void;
  onBossStateChange: (boss: { active: boolean; name: string; title: string; health: number; maxHealth: number } | null) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameEngineCallbacks;

  // Game state
  public status: GameStatus = 'MENU';
  private lastTime: number = 0;
  private animationFrameId: number | null = null;

  // Player state
  private playerX: number = GAME_WIDTH / 2;
  private playerY: number = GAME_HEIGHT - 120;
  private playerVx: number = 0;
  private playerVy: number = 0;
  private playerTilt: number = 0; // for banking animation
  private shootCooldown: number = 0;
  private invincibleTimer: number = 0;
  private hasShield: boolean = false;
  private rapidFireTimer: number = 0;
  private bombCount: number = 1;

  // Stats
  private score: number = 0;
  private highScore: number = 0;
  private lives: number = 3;
  private maxLives: number = 5;
  private wave: number = 1;
  private combo: number = 0;
  private comboTimer: number = 0;
  private enemiesDefeated: number = 0;
  private shotsFired: number = 0;
  private shotsHit: number = 0;

  // Entities
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private powerups: PowerUp[] = [];
  private floatingTexts: FloatingText[] = [];
  private stars: Star[] = [];

  // Wave & Spawning
  private waveTimer: number = 0;
  private waveState: 'incoming' | 'active' | 'cleared' = 'incoming';
  private waveSpawnQueue: { type: EnemyType; delay: number }[] = [];
  private isBossWave: boolean = false;
  private activeBoss: Enemy | null = null;

  // Controls map
  private keys: Record<string, boolean> = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    Space: false,
  };

  // Screen shake
  private screenShake: number = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2d context');
    this.ctx = context;
    this.callbacks = callbacks;

    // Load high score
    const saved = localStorage.getItem('space_defender_high_score');
    this.highScore = saved ? parseInt(saved, 10) || 0 : 0;

    this.initStars();
    this.setupListeners();
    this.updateStatsUI();
  }

  private initStars() {
    this.stars = [];
    const colors = ['#ffffff', '#bae6fd', '#fef08a', '#e0e7ff'];
    for (let i = 0; i < 160; i++) {
      const layer = Math.random() < 0.6 ? 1 : Math.random() < 0.85 ? 2 : 3;
      this.stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: layer === 1 ? 1 : layer === 2 ? 1.8 : 2.6,
        speed: layer === 1 ? 25 : layer === 2 ? 65 : 130,
        brightness: layer === 1 ? 0.35 + Math.random() * 0.3 : 0.6 + Math.random() * 0.4,
        layer,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  private setupListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  public destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    soundManager.stopBackgroundMusic();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Prevent scrolling for navigation and fire keys
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) ||
      e.key === ' ' ||
      e.key.startsWith('Arrow')
    ) {
      e.preventDefault();
    }

    if (e.code in this.keys) {
      this.keys[e.code] = true;
    }

    // Toggle pause with P
    if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
      if (this.status === 'PLAYING') {
        this.pauseGame();
      } else if (this.status === 'PAUSED') {
        this.resumeGame();
      }
    }

    // Restart with R on game over
    if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
      if (this.status === 'GAMEOVER') {
        this.startNewGame();
      }
    }

    // Bomb trigger with B
    if (e.code === 'KeyB' || e.key === 'b' || e.key === 'B') {
      if (this.status === 'PLAYING' && this.bombCount > 0) {
        this.triggerBomb();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code in this.keys) {
      this.keys[e.code] = false;
    }
  };

  private handleBlur = () => {
    this.clearKeys();
    if (this.status === 'PLAYING') {
      this.pauseGame();
    }
  };

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.clearKeys();
      if (this.status === 'PLAYING') {
        this.pauseGame();
      }
    }
  };

  public clearKeys() {
    for (const key in this.keys) {
      this.keys[key] = false;
    }
  }

  // External control helpers (for on-screen touch buttons)
  public setKey(code: string, pressed: boolean) {
    if (code in this.keys) {
      this.keys[code] = pressed;
    }
  }

  public startNewGame() {
    soundManager.init();
    this.status = 'PLAYING';
    this.callbacks.onStatusChange(this.status);

    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.enemiesDefeated = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;

    this.playerX = GAME_WIDTH / 2;
    this.playerY = GAME_HEIGHT - 120;
    this.playerVx = 0;
    this.playerVy = 0;
    this.playerTilt = 0;
    this.shootCooldown = 0;
    this.invincibleTimer = 1.0;
    this.hasShield = false;
    this.rapidFireTimer = 0;
    this.bombCount = 1;

    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.powerups = [];
    this.floatingTexts = [];
    this.activeBoss = null;
    this.screenShake = 0;

    this.clearKeys();
    this.initStars();
    this.startWave(1);
    this.updateStatsUI();
    this.updatePowerupsUI();
    this.callbacks.onBossStateChange(null);

    soundManager.startBackgroundMusic(false);

    this.lastTime = performance.now();
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  public pauseGame() {
    if (this.status !== 'PLAYING') return;
    this.status = 'PAUSED';
    this.clearKeys();
    this.callbacks.onStatusChange(this.status);
    soundManager.stopBackgroundMusic();
  }

  public resumeGame() {
    if (this.status !== 'PAUSED') return;
    this.status = 'PLAYING';
    this.clearKeys();
    this.callbacks.onStatusChange(this.status);
    this.lastTime = performance.now();
    soundManager.startBackgroundMusic(this.isBossWave);
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  public triggerBomb() {
    if (this.bombCount <= 0 || this.status !== 'PLAYING') return;
    this.bombCount--;
    this.updatePowerupsUI();
    soundManager.playBomb();
    this.screenShake = 22;

    // Destroy all enemy bullets
    this.bullets = this.bullets.filter((b) => !b.isEnemy);

    // Damage all visible enemies
    for (const enemy of this.enemies) {
      if (enemy.type === 'boss') {
        enemy.health -= 150;
      } else {
        enemy.health -= 999;
      }
      this.createExplosion(enemy.x, enemy.y, enemy.type === 'boss' ? '#38bdf8' : enemy.color, 15);
    }

    // Flash ring shockwave
    this.particles.push({
      id: Math.random().toString(),
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      vx: 0,
      vy: 0,
      size: 4,
      color: '#38bdf8',
      alpha: 1,
      decay: 1.2,
      type: 'ring',
      currentRadius: 20,
      maxRadius: 650,
    });

    this.addFloatingText('NOVA BOMB DETONATED!', GAME_WIDTH / 2, GAME_HEIGHT / 2, '#38bdf8', 1.8);
  }

  private startWave(waveNum: number) {
    this.wave = waveNum;
    this.waveState = 'incoming';
    this.waveTimer = 2.0;
    this.isBossWave = waveNum % 5 === 0;

    soundManager.setBossMode(this.isBossWave);

    const bannerText = this.isBossWave
      ? `WARNING: BOSS WAVE ${waveNum}`
      : `WAVE ${waveNum}`;
    const bannerColor = this.isBossWave ? '#ef4444' : '#38bdf8';

    this.addFloatingText(bannerText, GAME_WIDTH / 2, GAME_HEIGHT / 3, bannerColor, 2.0);

    if (this.isBossWave) {
      soundManager.playBossAlarm();
      this.buildBossWave(waveNum);
    } else {
      this.buildNormalWave(waveNum);
    }

    this.updateStatsUI();
  }

  private buildNormalWave(waveNum: number) {
    this.waveSpawnQueue = [];
    const count = 10 + waveNum * 3;
    let accumulatedDelay = 1.0;

    for (let i = 0; i < count; i++) {
      let type: EnemyType = 'scout';
      const roll = Math.random();

      if (waveNum >= 4 && roll > 0.75) {
        type = 'kamikaze';
      } else if (waveNum >= 3 && roll > 0.5) {
        type = 'gunship';
      } else if (waveNum >= 2 && roll > 0.3) {
        type = 'interceptor';
      }

      this.waveSpawnQueue.push({
        type,
        delay: accumulatedDelay,
      });

      accumulatedDelay += Math.max(0.35, 1.4 - waveNum * 0.08) + Math.random() * 0.4;
    }
  }

  private buildBossWave(waveNum: number) {
    this.waveSpawnQueue = [];
    const bossNames = [
      { name: 'DREADNOUGHT ARES', title: 'Sector Vanguard Destroyer' },
      { name: 'CYBER-COLOSSUS TITAN', title: 'Orbital Fortress Flagship' },
      { name: 'VOID HYPERION', title: 'Apex Singularity Carrier' },
      { name: 'OMEGA ECLIPSE', title: 'Supermassive Dreadnought' },
    ];
    const index = Math.min(Math.floor(waveNum / 5) - 1, bossNames.length - 1);
    const bossInfo = bossNames[index] || { name: `TITAN LEVEL ${waveNum}`, title: 'Grand Warship' };

    // Spawn boss after 1.5s
    const bossHealth = 350 + waveNum * 90;
    const boss: Enemy = {
      id: 'boss-' + Date.now(),
      type: 'boss',
      x: GAME_WIDTH / 2,
      y: -140,
      width: 140,
      height: 110,
      vx: 0,
      vy: 60,
      health: bossHealth,
      maxHealth: bossHealth,
      scoreValue: 5000 + waveNum * 1000,
      color: ENEMY_COLORS.boss.color,
      accentColor: ENEMY_COLORS.boss.accentColor,
      shootCooldown: 1.5,
      shootInterval: 1.6,
      behaviorTimer: 0,
      initialX: GAME_WIDTH / 2,
      phase: 1,
      bossName: bossInfo.name,
      bossTitle: bossInfo.title,
    };

    this.enemies.push(boss);
    this.activeBoss = boss;
    this.callbacks.onBossStateChange({
      active: true,
      name: boss.bossName || 'BOSS',
      title: boss.bossTitle || 'Flagship',
      health: boss.health,
      maxHealth: boss.maxHealth,
    });
  }

  private spawnEnemy(type: EnemyType) {
    const margin = 50;
    const x = margin + Math.random() * (GAME_WIDTH - margin * 2);
    const y = -50;
    const colors = ENEMY_COLORS[type];

    let width = 36;
    let height = 36;
    let vy = 160 + this.wave * 8;
    let vx = (Math.random() - 0.5) * 80;
    let health = 1;
    let scoreVal = 100;
    let shootInterval = 2.4 - Math.min(this.wave * 0.1, 1.2);

    if (type === 'interceptor') {
      width = 38;
      height = 42;
      vy = 210 + this.wave * 12;
      vx = (Math.random() > 0.5 ? 1 : -1) * (140 + this.wave * 10);
      health = 2;
      scoreVal = 200;
      shootInterval = 1.9;
    } else if (type === 'gunship') {
      width = 54;
      height = 50;
      vy = 85 + this.wave * 5;
      vx = (Math.random() - 0.5) * 110;
      health = 4 + Math.floor(this.wave / 3);
      scoreVal = 350;
      shootInterval = 1.6;
    } else if (type === 'kamikaze') {
      width = 32;
      height = 34;
      vy = 260 + this.wave * 15;
      vx = 0;
      health = 1;
      scoreVal = 250;
      shootInterval = 999; // doesn't shoot, it charges!
    }

    this.enemies.push({
      id: Math.random().toString(),
      type,
      x,
      y,
      width,
      height,
      vx,
      vy,
      health,
      maxHealth: health,
      scoreValue: scoreVal,
      color: colors.color,
      accentColor: colors.accentColor,
      shootCooldown: 0.8 + Math.random() * shootInterval,
      shootInterval,
      behaviorTimer: Math.random() * 10,
      initialX: x,
    });
  }

  private gameLoop = (currentTime: number) => {
    if (this.status !== 'PLAYING') return;

    let dt = (currentTime - this.lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // clamp delta time for stability
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  private update(dt: number) {
    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Update stars
    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > GAME_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * GAME_WIDTH;
      }
    }

    // Timers
    if (this.invincibleTimer > 0) {
      this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    }
    if (this.rapidFireTimer > 0) {
      this.rapidFireTimer = Math.max(0, this.rapidFireTimer - dt);
      if (this.rapidFireTimer === 0) {
        this.addFloatingText('RAPID FIRE ENDED', this.playerX, this.playerY - 40, '#facc15', 1.0);
      }
      this.updatePowerupsUI();
    }
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) {
        this.combo = 0;
        this.updateStatsUI();
      }
    }

    // Player Movement
    let moveX = 0;
    let moveY = 0;

    if (this.keys.ArrowLeft || this.keys.KeyA) moveX -= 1;
    if (this.keys.ArrowRight || this.keys.KeyD) moveX += 1;
    if (this.keys.ArrowUp || this.keys.KeyW) moveY -= 1;
    if (this.keys.ArrowDown || this.keys.KeyS) moveY += 1;

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.7071;
      moveY *= 0.7071;
    }

    this.playerVx = moveX * PLAYER_SPEED;
    this.playerVy = moveY * PLAYER_SPEED;

    this.playerX += this.playerVx * dt;
    this.playerY += this.playerVy * dt;

    // Banking tilt
    const targetTilt = moveX * 0.25;
    this.playerTilt += (targetTilt - this.playerTilt) * 12 * dt;

    // Clamp player to bounds
    const halfW = PLAYER_WIDTH / 2;
    const halfH = PLAYER_HEIGHT / 2;
    if (this.playerX < halfW) this.playerX = halfW;
    if (this.playerX > GAME_WIDTH - halfW) this.playerX = GAME_WIDTH - halfW;
    if (this.playerY < halfH + 40) this.playerY = halfH + 40;
    if (this.playerY > GAME_HEIGHT - halfH - 10) this.playerY = GAME_HEIGHT - halfH - 10;

    // Thruster engine particles
    if (Math.random() < 0.6) {
      this.particles.push({
        id: Math.random().toString(),
        x: this.playerX + (Math.random() - 0.5) * 10,
        y: this.playerY + halfH + 2,
        vx: (Math.random() - 0.5) * 30,
        vy: 120 + Math.random() * 80,
        size: 2.5 + Math.random() * 2,
        color: this.rapidFireTimer > 0 ? '#facc15' : '#38bdf8',
        alpha: 0.8,
        decay: 3.5,
        type: 'thrust',
      });
    }

    // Player Shooting (hold Spacebar for continuous fire)
    this.shootCooldown -= dt;
    if (this.keys.Space && this.shootCooldown <= 0) {
      this.firePlayerLaser();
      const currentRate = this.rapidFireTimer > 0 ? PLAYER_RAPID_FIRE_RATE : PLAYER_FIRE_RATE;
      this.shootCooldown = currentRate;
    }

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Bullet trail
      if (!b.trail) b.trail = [];
      b.trail.unshift({ x: b.x, y: b.y, alpha: 0.7 });
      if (b.trail.length > 5) b.trail.pop();
      b.trail.forEach((t) => (t.alpha -= dt * 2.5));

      // Remove off-screen bullets
      if (b.y < -30 || b.y > GAME_HEIGHT + 30 || b.x < -30 || b.x > GAME_WIDTH + 30) {
        this.bullets.splice(i, 1);
      }
    }

    // Wave Spawning logic
    if (this.waveState === 'incoming') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.waveState = 'active';
      }
    } else if (this.waveState === 'active') {
      // Process wave spawn queue
      for (let i = this.waveSpawnQueue.length - 1; i >= 0; i--) {
        const item = this.waveSpawnQueue[i];
        item.delay -= dt;
        if (item.delay <= 0) {
          this.spawnEnemy(item.type);
          this.waveSpawnQueue.splice(i, 1);
        }
      }

      // Check if wave is defeated
      if (this.waveSpawnQueue.length === 0 && this.enemies.length === 0) {
        this.waveState = 'cleared';
        this.waveTimer = 2.0;
        this.addFloatingText(`WAVE ${this.wave} CLEARED! +${500 * this.wave} BONUS`, GAME_WIDTH / 2, GAME_HEIGHT / 2, '#4ade80', 1.6);
        this.score += 500 * this.wave;
        this.updateStatsUI();
      }
    } else if (this.waveState === 'cleared') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.startWave(this.wave + 1);
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.behaviorTimer += dt;

      // Enemy specific movement
      if (e.type === 'scout') {
        e.y += e.vy * dt;
        e.x = e.initialX + Math.sin(e.behaviorTimer * 3) * 45;
      } else if (e.type === 'interceptor') {
        e.y += e.vy * dt;
        e.x += e.vx * dt;
        // Bounce off walls
        if (e.x < 30 || e.x > GAME_WIDTH - 30) {
          e.vx = -e.vx;
        }
      } else if (e.type === 'gunship') {
        // Patrol upper half
        if (e.y < 160) {
          e.y += e.vy * dt;
        } else {
          e.x += e.vx * dt;
          if (e.x < 50 || e.x > GAME_WIDTH - 50) {
            e.vx = -e.vx;
          }
        }
      } else if (e.type === 'kamikaze') {
        e.y += e.vy * dt;
        // Slight homing
        const dx = this.playerX - e.x;
        e.x += Math.sign(dx) * Math.min(Math.abs(dx), 110 * dt);
      } else if (e.type === 'boss') {
        // Boss entrance & fight movement
        if (e.y < 120) {
          e.y += e.vy * dt;
        } else {
          // Sweeping figure-8 movement
          e.x = GAME_WIDTH / 2 + Math.sin(e.behaviorTimer * 1.2) * 260;
          e.y = 130 + Math.cos(e.behaviorTimer * 2.4) * 40;
        }

        // Update Boss HUD
        this.callbacks.onBossStateChange({
          active: true,
          name: e.bossName || 'BOSS',
          title: e.bossTitle || 'Flagship',
          health: Math.max(0, e.health),
          maxHealth: e.maxHealth,
        });
      }

      // Enemy Shooting
      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0 && e.y > 0 && e.y < GAME_HEIGHT - 100) {
        this.enemyShoot(e);
        e.shootCooldown = e.shootInterval;
      }

      // Check if regular enemy fell off screen
      if (e.type !== 'boss' && e.y > GAME_HEIGHT + 60) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Collision with player
      const dist = Math.hypot(e.x - this.playerX, e.y - this.playerY);
      const minDistance = (PLAYER_WIDTH + e.width) / 2.4;
      if (dist < minDistance && this.invincibleTimer <= 0) {
        this.onPlayerHit();
        if (e.type !== 'boss') {
          this.createExplosion(e.x, e.y, e.color, 15);
          this.enemies.splice(i, 1);
          continue;
        }
      }
    }

    // Bullet Collisions
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];

      if (b.isEnemy) {
        // Check collision with player
        const dist = Math.hypot(b.x - this.playerX, b.y - this.playerY);
        if (dist < b.radius + PLAYER_WIDTH / 2.6) {
          if (this.invincibleTimer <= 0) {
            this.bullets.splice(bi, 1);
            this.onPlayerHit();
            break;
          } else {
            // Invincible deflect spark
            this.createExplosion(b.x, b.y, '#38bdf8', 4);
            this.bullets.splice(bi, 1);
            continue;
          }
        }
      } else {
        // Player bullet vs enemies
        for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
          const e = this.enemies[ei];
          const dist = Math.hypot(b.x - e.x, b.y - e.y);
          if (dist < b.radius + e.width / 2) {
            // Hit!
            this.shotsHit++;
            e.health -= b.damage;
            this.createExplosion(b.x, b.y, b.color, 4);
            this.bullets.splice(bi, 1);

            if (e.health <= 0) {
              this.onEnemyDefeated(e);
              this.enemies.splice(ei, 1);
            }
            break;
          }
        }
      }
    }

    // Update PowerUps
    for (let pi = this.powerups.length - 1; pi >= 0; pi--) {
      const p = this.powerups[pi];
      p.y += p.vy * dt;
      p.x += Math.sin(p.pulseTimer * 4) * 35 * dt;
      p.pulseTimer += dt;

      // Check collection
      const dist = Math.hypot(p.x - this.playerX, p.y - this.playerY);
      if (dist < PLAYER_WIDTH / 2 + p.width / 2) {
        this.collectPowerUp(p);
        this.powerups.splice(pi, 1);
        continue;
      }

      if (p.y > GAME_HEIGHT + 40) {
        this.powerups.splice(pi, 1);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      if (part.type === 'ring') {
        part.currentRadius = (part.currentRadius || 10) + 700 * dt;
        part.alpha -= part.decay * dt;
        if (part.alpha <= 0 || part.currentRadius > (part.maxRadius || 500)) {
          this.particles.splice(i, 1);
        }
      } else {
        part.x += part.vx * dt;
        part.y += part.vy * dt;
        part.alpha -= part.decay * dt;
        if (part.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= 0.7 * dt;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private firePlayerLaser() {
    this.shotsFired++;
    const isRapid = this.rapidFireTimer > 0;
    soundManager.playLaser(isRapid);

    if (isRapid) {
      // Triple spread shot
      this.bullets.push(
        {
          id: Math.random().toString(),
          x: this.playerX,
          y: this.playerY - 24,
          vx: 0,
          vy: -880,
          radius: 4,
          color: '#facc15',
          glowColor: 'rgba(250, 204, 21, 0.8)',
          isEnemy: false,
          damage: 1.5,
        },
        {
          id: Math.random().toString(),
          x: this.playerX - 14,
          y: this.playerY - 14,
          vx: -130,
          vy: -840,
          radius: 3.5,
          color: '#facc15',
          glowColor: 'rgba(250, 204, 21, 0.8)',
          isEnemy: false,
          damage: 1.2,
        },
        {
          id: Math.random().toString(),
          x: this.playerX + 14,
          y: this.playerY - 14,
          vx: 130,
          vy: -840,
          radius: 3.5,
          color: '#facc15',
          glowColor: 'rgba(250, 204, 21, 0.8)',
          isEnemy: false,
          damage: 1.2,
        }
      );
    } else {
      // Dual high-tech blue lasers
      this.bullets.push(
        {
          id: Math.random().toString(),
          x: this.playerX - 12,
          y: this.playerY - 18,
          vx: 0,
          vy: -780,
          radius: 3.5,
          color: '#38bdf8',
          glowColor: 'rgba(56, 189, 248, 0.8)',
          isEnemy: false,
          damage: 1,
        },
        {
          id: Math.random().toString(),
          x: this.playerX + 12,
          y: this.playerY - 18,
          vx: 0,
          vy: -780,
          radius: 3.5,
          color: '#38bdf8',
          glowColor: 'rgba(56, 189, 248, 0.8)',
          isEnemy: false,
          damage: 1,
        }
      );
    }
  }

  private enemyShoot(e: Enemy) {
    soundManager.playEnemyLaser();

    if (e.type === 'boss') {
      // Boss bullet pattern rotates every few seconds
      const pattern = Math.floor(e.behaviorTimer / 3.5) % 3;

      if (pattern === 0) {
        // Radial 8-way ring burst
        const count = 8;
        for (let i = 0; i < count; i++) {
          const angle = (i * Math.PI * 2) / count + e.behaviorTimer;
          const speed = 240;
          this.bullets.push({
            id: Math.random().toString(),
            x: e.x,
            y: e.y + 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 4.5,
            color: '#ef4444',
            glowColor: 'rgba(239, 68, 68, 0.8)',
            isEnemy: true,
            damage: 1,
          });
        }
      } else if (pattern === 1) {
        // Targeted dual heavy plasma bolts
        const dx = this.playerX - e.x;
        const dy = this.playerY - e.y;
        const angle = Math.atan2(dy, dx);
        const speed = 360;

        [-25, 25].forEach((offset) => {
          this.bullets.push({
            id: Math.random().toString(),
            x: e.x + offset,
            y: e.y + 30,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 5.5,
            color: '#f97316',
            glowColor: 'rgba(249, 115, 22, 0.9)',
            isEnemy: true,
            damage: 1,
          });
        });
      } else {
        // Spiral volley
        for (let j = -2; j <= 2; j++) {
          const speed = 280;
          this.bullets.push({
            id: Math.random().toString(),
            x: e.x + j * 18,
            y: e.y + 40,
            vx: j * 50,
            vy: speed,
            radius: 4,
            color: '#a855f7',
            glowColor: 'rgba(168, 85, 247, 0.8)',
            isEnemy: true,
            damage: 1,
          });
        }
      }
    } else if (e.type === 'gunship') {
      // Aimed dual laser
      const dx = this.playerX - e.x;
      const dy = this.playerY - e.y;
      const angle = Math.atan2(dy, dx);
      const speed = 280;
      this.bullets.push(
        {
          id: Math.random().toString(),
          x: e.x - 14,
          y: e.y + 16,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 3.5,
          color: '#a855f7',
          glowColor: 'rgba(168, 85, 247, 0.8)',
          isEnemy: true,
          damage: 1,
        },
        {
          id: Math.random().toString(),
          x: e.x + 14,
          y: e.y + 16,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 3.5,
          color: '#a855f7',
          glowColor: 'rgba(168, 85, 247, 0.8)',
          isEnemy: true,
          damage: 1,
        }
      );
    } else if (e.type === 'interceptor') {
      // Fast angled dart
      this.bullets.push({
        id: Math.random().toString(),
        x: e.x,
        y: e.y + 14,
        vx: (Math.random() - 0.5) * 80,
        vy: 320,
        radius: 3,
        color: '#f97316',
        glowColor: 'rgba(249, 115, 22, 0.8)',
        isEnemy: true,
        damage: 1,
      });
    } else {
      // Scout straight shot
      this.bullets.push({
        id: Math.random().toString(),
        x: e.x,
        y: e.y + 14,
        vx: 0,
        vy: 290,
        radius: 3,
        color: '#ec4899',
        glowColor: 'rgba(236, 72, 153, 0.8)',
        isEnemy: true,
        damage: 1,
      });
    }
  }

  private onEnemyDefeated(enemy: Enemy) {
    this.enemiesDefeated++;
    this.combo++;
    this.comboTimer = 2.5;

    // Calculate score with combo multiplier
    const multiplier = 1 + Math.min(this.combo * 0.2, 3.0);
    const addedScore = Math.round(enemy.scoreValue * multiplier);
    this.score += addedScore;

    // Floating score popup
    const comboText = this.combo > 2 ? ` x${multiplier.toFixed(1)}` : '';
    this.addFloatingText(
      `+${addedScore}${comboText}`,
      enemy.x,
      enemy.y,
      enemy.type === 'boss' ? '#facc15' : '#38bdf8',
      enemy.type === 'boss' ? 1.6 : 1.1
    );

    // Sound & particles
    if (enemy.type === 'boss') {
      soundManager.playExplosion(2.4);
      this.screenShake = 24;
      this.createMassiveExplosion(enemy.x, enemy.y);
      this.activeBoss = null;
      this.callbacks.onBossStateChange(null);
      soundManager.setBossMode(false);

      // Boss always drops rare powerups
      this.spawnPowerUp(enemy.x - 40, enemy.y, 'shield');
      this.spawnPowerUp(enemy.x, enemy.y, 'rapid');
      this.spawnPowerUp(enemy.x + 40, enemy.y, 'bomb');
    } else {
      soundManager.playExplosion(enemy.type === 'gunship' ? 1.2 : 0.8);
      this.screenShake = Math.max(this.screenShake, 4);
      this.createExplosion(enemy.x, enemy.y, enemy.color, enemy.type === 'gunship' ? 24 : 14);

      // Random powerup drop (14% chance)
      if (Math.random() < 0.16) {
        const types: PowerUpType[] = ['shield', 'rapid', 'life', 'bomb'];
        const weights = [0.35, 0.4, 0.15, 0.1];
        let rand = Math.random();
        let chosen: PowerUpType = 'shield';
        for (let i = 0; i < weights.length; i++) {
          if (rand < weights[i]) {
            chosen = types[i];
            break;
          }
          rand -= weights[i];
        }
        this.spawnPowerUp(enemy.x, enemy.y, chosen);
      }
    }

    // High score check
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('space_defender_high_score', this.highScore.toString());
    }

    this.updateStatsUI();
  }

  private onPlayerHit() {
    if (this.invincibleTimer > 0) return;

    if (this.hasShield) {
      // Shield absorbs hit
      this.hasShield = false;
      this.invincibleTimer = 1.0;
      soundManager.playShieldDeflect();
      this.screenShake = 10;
      this.addFloatingText('SHIELD BROKEN!', this.playerX, this.playerY - 30, '#38bdf8', 1.3);
      this.createExplosion(this.playerX, this.playerY, '#38bdf8', 20);
      this.updatePowerupsUI();
      return;
    }

    // Normal hit
    this.lives--;
    this.invincibleTimer = INVINCIBLE_DURATION;
    this.combo = 0;
    this.screenShake = 18;
    soundManager.playHit();
    this.createExplosion(this.playerX, this.playerY, '#ef4444', 30);
    this.addFloatingText('HULL BREACH!', this.playerX, this.playerY - 30, '#ef4444', 1.4);
    this.updateStatsUI();

    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  private gameOver() {
    this.status = 'GAMEOVER';
    this.callbacks.onStatusChange(this.status);
    this.screenShake = 22;
    soundManager.playGameOver();
    soundManager.stopBackgroundMusic();
    this.createMassiveExplosion(this.playerX, this.playerY);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('space_defender_high_score', this.highScore.toString());
    }
    this.updateStatsUI();
  }

  private spawnPowerUp(x: number, y: number, type: PowerUpType) {
    this.powerups.push({
      id: Math.random().toString(),
      x,
      y,
      width: 30,
      height: 30,
      type,
      vx: 0,
      vy: 110,
      pulseTimer: 0,
    });
  }

  private collectPowerUp(p: PowerUp) {
    soundManager.playPowerup(p.type);
    const cfg = POWERUP_CONFIG[p.type];

    if (p.type === 'shield') {
      this.hasShield = true;
      this.addFloatingText('+ SHIELD ACTIVATED', this.playerX, this.playerY - 30, cfg.color, 1.3);
    } else if (p.type === 'rapid') {
      this.rapidFireTimer = RAPID_FIRE_DURATION;
      this.addFloatingText('+ RAPID FIRE x10s', this.playerX, this.playerY - 30, cfg.color, 1.3);
    } else if (p.type === 'life') {
      if (this.lives < this.maxLives) {
        this.lives++;
        this.addFloatingText('+1 EXTRA LIFE', this.playerX, this.playerY - 30, cfg.color, 1.3);
      } else {
        this.score += 1500;
        this.addFloatingText('+1500 BONUS SCORE', this.playerX, this.playerY - 30, cfg.color, 1.3);
      }
    } else if (p.type === 'bomb') {
      this.bombCount = Math.min(this.bombCount + 1, 3);
      this.addFloatingText('+1 NOVA BOMB [B]', this.playerX, this.playerY - 30, cfg.color, 1.3);
    }

    this.createExplosion(p.x, p.y, cfg.color, 16);
    this.updateStatsUI();
    this.updatePowerupsUI();
  }

  private addFloatingText(text: string, x: number, y: number, color: string, scale: number = 1.0) {
    this.floatingTexts.push({
      id: Math.random().toString(),
      text,
      x,
      y,
      vy: -55,
      color,
      alpha: 1.0,
      scale,
    });
  }

  private createExplosion(x: number, y: number, color: string, count: number = 15) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 220;
      this.particles.push({
        id: Math.random().toString(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1.0,
        decay: 1.2 + Math.random() * 1.8,
        type: 'spark',
      });
    }

    // Shockwave ring
    this.particles.push({
      id: Math.random().toString(),
      x,
      y,
      vx: 0,
      vy: 0,
      size: 2,
      color,
      alpha: 0.8,
      decay: 2.2,
      type: 'ring',
      currentRadius: 5,
      maxRadius: 40 + count * 2,
    });
  }

  private createMassiveExplosion(x: number, y: number) {
    const colors = ['#f43f5e', '#fbbf24', '#38bdf8', '#c084fc', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 380;
      this.particles.push({
        id: Math.random().toString(),
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        decay: 0.8 + Math.random() * 1.5,
        type: 'spark',
      });
    }

    // Expanding shockwaves
    this.particles.push({
      id: Math.random().toString(),
      x,
      y,
      vx: 0,
      vy: 0,
      size: 4,
      color: '#ffffff',
      alpha: 1.0,
      decay: 1.2,
      type: 'ring',
      currentRadius: 10,
      maxRadius: 260,
    });
  }

  private updateStatsUI() {
    const accuracy = this.shotsFired > 0 ? Math.round((this.shotsHit / this.shotsFired) * 100) : 100;
    this.callbacks.onStatsChange({
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      maxLives: this.maxLives,
      wave: this.wave,
      combo: this.combo,
      comboTimer: this.comboTimer,
      enemiesDefeated: this.enemiesDefeated,
      accuracy: Math.min(100, accuracy),
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
    });
  }

  private updatePowerupsUI() {
    this.callbacks.onActivePowerupsChange({
      rapidTimer: this.rapidFireTimer,
      hasShield: this.hasShield,
      bombs: this.bombCount,
    });
  }

  // ------------------- RENDERING -------------------
  private render() {
    const ctx = this.ctx;

    ctx.save();

    // Apply screen shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Deep space background with subtle nebula gradient
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Nebula dust effect
    const grad = ctx.createRadialGradient(
      GAME_WIDTH * 0.3,
      GAME_HEIGHT * 0.4,
      50,
      GAME_WIDTH * 0.5,
      GAME_HEIGHT * 0.5,
      GAME_WIDTH * 0.8
    );
    grad.addColorStop(0, 'rgba(30, 27, 75, 0.45)');
    grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.3)');
    grad.addColorStop(1, 'rgba(3, 7, 18, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Render Stars
    for (const star of this.stars) {
      ctx.fillStyle = star.color;
      ctx.globalAlpha = star.brightness;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Render Particles
    for (const part of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, part.alpha);

      if (part.type === 'ring') {
        ctx.strokeStyle = part.color;
        ctx.lineWidth = part.size;
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.currentRadius || 10, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = part.color;
        ctx.shadowColor = part.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Render PowerUps
    for (const p of this.powerups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const cfg = POWERUP_CONFIG[p.type];

      // Pulsing outer aura
      const auraScale = 1 + Math.sin(p.pulseTimer * 6) * 0.15;
      ctx.shadowColor = cfg.color;
      ctx.shadowBlur = 14;

      // Hexagon / diamond badge
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';

      ctx.beginPath();
      const r = (p.width / 2) * auraScale;
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Power-up Icon/Emoji
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.icon, 0, 1);

      ctx.restore();
    }

    // Render Bullets
    for (const b of this.bullets) {
      ctx.save();
      // Render trail
      if (b.trail && b.trail.length > 1) {
        ctx.strokeStyle = b.glowColor;
        ctx.lineWidth = b.radius * 1.5;
        ctx.beginPath();
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        for (let t = 1; t < b.trail.length; t++) {
          ctx.lineTo(b.trail[t].x, b.trail[t].y);
        }
        ctx.stroke();
      }

      ctx.fillStyle = b.color;
      ctx.shadowColor = b.glowColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Enemies
    for (const e of this.enemies) {
      this.drawEnemy(ctx, e);
    }

    // Render Player Spaceship
    if (this.lives > 0) {
      this.drawPlayer(ctx);
    }

    // Render Floating Text
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.font = `bold ${Math.round(18 * ft.scale)}px 'Orbitron', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.playerX, this.playerY);
    ctx.rotate(this.playerTilt);

    // Flashing when invincible
    if (this.invincibleTimer > 0) {
      const flash = Math.floor(this.invincibleTimer * 14) % 2 === 0;
      ctx.globalAlpha = flash ? 0.35 : 0.9;
    }

    // Shield Dome Visual
    if (this.hasShield) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';

      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Shield hexagonal runes / tick marks
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 1.5;
      const t = performance.now() * 0.002;
      for (let i = 0; i < 4; i++) {
        const ang = t + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(0, 0, 34, ang, ang + 0.35);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Neon Blue Player Ship (Crisp sci-fi geometry)
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 14;

    // Wing thrusters glow
    const w = PLAYER_WIDTH / 2;
    const h = PLAYER_HEIGHT / 2;

    // Main hull
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;

    ctx.beginPath();
    // Nose
    ctx.moveTo(0, -h);
    // Right wingtip
    ctx.lineTo(w, h * 0.7);
    // Right engine notch
    ctx.lineTo(w * 0.45, h * 0.85);
    // Center engine bay
    ctx.lineTo(0, h * 0.55);
    // Left engine notch
    ctx.lineTo(-w * 0.45, h * 0.85);
    // Left wingtip
    ctx.lineTo(-w, h * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner wing accents
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.6, h * 0.4);
    ctx.lineTo(0, -h * 0.35);
    ctx.lineTo(w * 0.6, h * 0.4);
    ctx.stroke();

    // Cockpit Canopy (cyan neon glass)
    ctx.fillStyle = '#67e8f9';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.15, 5, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Weapon pods
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-w + 2, h * 0.2, 3, 10);
    ctx.fillRect(w - 5, h * 0.2, 3, 10);

    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    ctx.save();
    ctx.translate(e.x, e.y);

    const w = e.width / 2;
    const h = e.height / 2;

    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;

    if (e.type === 'boss') {
      // ---------------- BOSS SHIP ----------------
      ctx.fillStyle = '#111827';
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;

      // Heavy command hull
      ctx.beginPath();
      ctx.moveTo(0, h); // front ram
      ctx.lineTo(w * 0.3, h * 0.5);
      ctx.lineTo(w * 0.8, h * 0.7);
      ctx.lineTo(w, -h * 0.2);
      ctx.lineTo(w * 0.6, -h);
      ctx.lineTo(-w * 0.6, -h);
      ctx.lineTo(-w, -h * 0.2);
      ctx.lineTo(-w * 0.8, h * 0.7);
      ctx.lineTo(-w * 0.3, h * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wing weapon turrets
      ctx.fillStyle = e.accentColor;
      ctx.fillRect(-w + 8, -h * 0.1, 10, 24);
      ctx.fillRect(w - 18, -h * 0.1, 10, 24);

      // Core Reactor (pulsing glow)
      const corePulse = 0.8 + Math.sin(e.behaviorTimer * 6) * 0.2;
      ctx.fillStyle = e.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, -h * 0.1, 16 * corePulse, 0, Math.PI * 2);
      ctx.fill();

      // Core inner ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -h * 0.1, 8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.type === 'gunship') {
      // Heavy armored cruiser
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(w, h * 0.2);
      ctx.lineTo(w * 0.7, -h);
      ctx.lineTo(-w * 0.7, -h);
      ctx.lineTo(-w, h * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Heavy plasma cannons
      ctx.fillStyle = e.accentColor;
      ctx.fillRect(-w * 0.7, h * 0.3, 6, 12);
      ctx.fillRect(w * 0.7 - 6, h * 0.3, 6, 12);

      // Sensor eye
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'interceptor') {
      // Sleek delta wing
      ctx.fillStyle = '#431407';
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(w, -h * 0.6);
      ctx.lineTo(0, -h * 0.2);
      ctx.lineTo(-w, -h * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Jet exhaust glow
      ctx.fillStyle = e.accentColor;
      ctx.beginPath();
      ctx.arc(0, -h * 0.2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'kamikaze') {
      // Needle-shaped stinger
      ctx.fillStyle = '#450a0a';
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, h + 4);
      ctx.lineTo(w, -h);
      ctx.lineTo(0, -h * 0.5);
      ctx.lineTo(-w, -h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Stinger thruster flame
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(-4, -h * 0.5);
      ctx.lineTo(0, -h - 8);
      ctx.lineTo(4, -h * 0.5);
      ctx.closePath();
      ctx.fill();
    } else {
      // Scout / Grunt drone
      ctx.fillStyle = '#2e1065';
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(w, 0);
      ctx.lineTo(w * 0.5, -h);
      ctx.lineTo(-w * 0.5, -h);
      ctx.lineTo(-w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Visor
      ctx.fillStyle = e.accentColor;
      ctx.fillRect(-6, -2, 12, 4);
    }

    // Health bar for damaged heavy enemies
    if (e.health < e.maxHealth && e.type !== 'boss') {
      const barW = e.width;
      const barH = 4;
      const hpPercent = Math.max(0, e.health / e.maxHealth);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(-barW / 2, -h - 10, barW, barH);

      ctx.fillStyle = e.color;
      ctx.fillRect(-barW / 2, -h - 10, barW * hpPercent, barH);
    }

    ctx.restore();
  }
}
