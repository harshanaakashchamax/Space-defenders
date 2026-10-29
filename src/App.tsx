import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Heart,
  Sparkles,
  ShoppingBag,
  Coins,
  Shield,
  Gauge,
  Zap,
} from 'lucide-react';
import {
  loadInventory,
  saveInventory,
  STARSHIPS,
  GUNS,
  PlayerInventory,
  StarshipItem,
  GunItem,
} from './utils/shopData';
import { soundManager } from './utils/audio';
import { HangarShop } from './components/HangarShop';

// Virtual Canvas Dimensions
const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 650;
const BASE_PLAYER_SPEED = 330;
const BASE_ENEMY_SPEED = 85;
const MAX_CONCURRENT_ENEMIES = 3;
const INVINCIBLE_TIME = 1.6;

interface Enemy {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
  shapeType: number;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glow: string;
}

interface CoinItem {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  value: number;
  rotation: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
}

const ENEMY_COLORS = ['#34d399', '#f43f5e', '#fbbf24', '#a855f7', '#38bdf8', '#fb923c'];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Inventory & Shop
  const [inventory, setInventory] = useState<PlayerInventory>(() => loadInventory());
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);

  // Game Status
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [score, setScore] = useState<number>(0);
  const [sessionCoins, setSessionCoins] = useState<number>(0);
  const [lives, setLives] = useState<number>(5);
  const [maxLives, setMaxLives] = useState<number>(5);
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('simple_space_defender_highscore');
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => soundManager.getMuted());
  const [enemiesDefeated, setEnemiesDefeated] = useState<number>(0);
  const [scale, setScale] = useState<number>(1);

  // Active equipped items
  const equippedShip: StarshipItem =
    STARSHIPS.find((s) => s.id === inventory.equippedShip) || STARSHIPS[0];
  const equippedGun: GunItem =
    GUNS.find((g) => g.id === inventory.equippedGun) || GUNS[0];

  // Effective stats with upgrades
  const effectiveSpeed =
    BASE_PLAYER_SPEED * equippedShip.speedMultiplier * (1 + inventory.engineLevel * 0.06);
  const effectiveFireRate = Math.max(
    0.07,
    equippedGun.fireRate * (1 - inventory.reloadLevel * 0.08)
  );
  const bountyMultiplier = 1 + (inventory.bountyLevel || 0) * 0.25;

  // Refs for high performance game loop
  const playerRef = useRef({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 70,
    width: 40,
    height: 44,
    invincibleTimer: 0,
  });

  const keysRef = useRef<{ [key: string]: boolean }>({
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
  });

  const shootTimerRef = useRef<number>(0);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const coinsRef = useRef<CoinItem[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const nextIdRef = useRef<number>(1);
  const lastTimeRef = useRef<number>(0);

  // Save inventory changes
  const handleUpdateInventory = (updated: PlayerInventory) => {
    setInventory(updated);
    saveInventory(updated);
  };

  const toggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  // Responsive canvas scaling preserving proportions
  const updateScale = useCallback(() => {
    const padW = window.innerWidth * 0.96;
    const padH = window.innerHeight * 0.94;
    const scaleFactor = Math.min(padW / CANVAS_WIDTH, padH / CANVAS_HEIGHT, 1.25);
    setScale(Math.max(scaleFactor, 0.45));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  // Setup Stars
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() < 0.7 ? 1.5 : 2.5,
        speed: 15 + Math.random() * 30,
        alpha: 0.3 + Math.random() * 0.6,
      });
    }
    starsRef.current = stars;
  }, []);

  // Spawn an enemy
  const spawnEnemy = useCallback(() => {
    const padding = 50;
    const x = padding + Math.random() * (CANVAS_WIDTH - padding * 2);
    const color = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
    const shape = Math.floor(Math.random() * 3);

    enemiesRef.current.push({
      id: nextIdRef.current++,
      x,
      y: -40,
      width: 38,
      height: 38,
      speed: BASE_ENEMY_SPEED + (Math.random() * 20 - 10),
      color,
      shapeType: shape,
    });
  }, []);

  // Simple explosion creator
  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.3;
      const speed = 40 + Math.random() * 120;
      particlesRef.current.push({
        id: nextIdRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1.0,
      });
    }
  };

  // Start or restart game
  const startGame = () => {
    soundManager.init();
    setIsShopOpen(false);
    setScore(0);
    setSessionCoins(0);
    setEnemiesDefeated(0);

    const startingLives = 5 + equippedShip.bonusLives;
    setLives(startingLives);
    setMaxLives(startingLives);
    setGameState('PLAYING');

    playerRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 70,
      width: 40,
      height: 44,
      invincibleTimer: 0,
    };

    bulletsRef.current = [];
    enemiesRef.current = [];
    coinsRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    shootTimerRef.current = 0;

    for (const k in keysRef.current) {
      keysRef.current[k] = false;
    }

    // Pre-spawn initial enemies
    for (let i = 0; i < 2; i++) {
      spawnEnemy();
      enemiesRef.current[i].y = -40 - i * 100;
    }

    lastTimeRef.current = performance.now();
  };

  // Keyboard navigation & spacebar scroll prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) || e.code === 'Space') {
        e.preventDefault();
      }

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keysRef.current.ArrowUp = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keysRef.current.ArrowDown = true;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.ArrowLeft = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.ArrowRight = true;
      if (e.code === 'Space' || e.key === ' ') keysRef.current.Space = true;

      // Quick restart with R on Game Over
      if ((e.key === 'r' || e.key === 'R') && gameState === 'GAMEOVER') {
        startGame();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keysRef.current.ArrowUp = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keysRef.current.ArrowDown = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.ArrowLeft = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.ArrowRight = false;
      if (e.code === 'Space' || e.key === ' ') keysRef.current.Space = false;
    };

    const handleBlur = () => {
      for (const k in keysRef.current) {
        keysRef.current[k] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameState]);

  // Main Canvas Render & Physics Loop
  useEffect(() => {
    let animId: number;

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = currentTime;

      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(loop);
        return;
      }

      // ----------------- UPDATE LOGIC -----------------
      // Stars drift
      for (const star of starsRef.current) {
        star.y += star.speed * dt;
        if (star.y > CANVAS_HEIGHT) {
          star.y = 0;
          star.x = Math.random() * CANVAS_WIDTH;
        }
      }

      if (gameState === 'PLAYING') {
        const player = playerRef.current;

        // Player movement
        let dx = 0;
        let dy = 0;
        if (keysRef.current.ArrowLeft) dx -= 1;
        if (keysRef.current.ArrowRight) dx += 1;
        if (keysRef.current.ArrowUp) dy -= 1;
        if (keysRef.current.ArrowDown) dy += 1;

        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071;
          dy *= 0.7071;
        }

        player.x += dx * effectiveSpeed * dt;
        player.y += dy * effectiveSpeed * dt;

        // Clamp inside bounds
        const halfW = player.width / 2;
        const halfH = player.height / 2;
        if (player.x < halfW) player.x = halfW;
        if (player.x > CANVAS_WIDTH - halfW) player.x = CANVAS_WIDTH - halfW;
        if (player.y < halfH) player.y = halfH;
        if (player.y > CANVAS_HEIGHT - halfH - 6) player.y = CANVAS_HEIGHT - halfH - 6;

        if (player.invincibleTimer > 0) {
          player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);
        }

        // Weapon Firing based on equipped gun pattern
        shootTimerRef.current -= dt;
        if (keysRef.current.Space && shootTimerRef.current <= 0) {
          shootTimerRef.current = effectiveFireRate;

          // Sound effect
          if (equippedGun.soundType === 'heavy') soundManager.playHeavyLaser();
          else if (equippedGun.soundType === 'hyper') soundManager.playHyperLaser();
          else soundManager.playLaser(equippedGun.soundType === 'rapid');

          const bColor = equippedGun.bulletColor;
          const bGlow = equippedGun.bulletGlow;
          const bRadius = equippedGun.bulletRadius;

          if (equippedGun.pattern === 'scatter') {
            // Triple scatter
            bulletsRef.current.push(
              { id: nextIdRef.current++, x: player.x, y: player.y - 18, vx: 0, vy: -580, radius: bRadius, color: bColor, glow: bGlow },
              { id: nextIdRef.current++, x: player.x - 12, y: player.y - 14, vx: -110, vy: -550, radius: bRadius, color: bColor, glow: bGlow },
              { id: nextIdRef.current++, x: player.x + 12, y: player.y - 14, vx: 110, vy: -550, radius: bRadius, color: bColor, glow: bGlow }
            );
          } else if (equippedGun.pattern === 'heavy') {
            // Big plasma orb
            bulletsRef.current.push({
              id: nextIdRef.current++,
              x: player.x,
              y: player.y - 20,
              vx: 0,
              vy: -520,
              radius: bRadius,
              color: bColor,
              glow: bGlow,
            });
          } else if (equippedGun.pattern === 'quad') {
            // 4-stream rapid laser storm
            bulletsRef.current.push(
              { id: nextIdRef.current++, x: player.x - 14, y: player.y - 16, vx: -20, vy: -620, radius: bRadius, color: bColor, glow: bGlow },
              { id: nextIdRef.current++, x: player.x - 5, y: player.y - 20, vx: 0, vy: -620, radius: bRadius, color: bColor, glow: bGlow },
              { id: nextIdRef.current++, x: player.x + 5, y: player.y - 20, vx: 0, vy: -620, radius: bRadius, color: bColor, glow: bGlow },
              { id: nextIdRef.current++, x: player.x + 14, y: player.y - 16, vx: 20, vy: -620, radius: bRadius, color: bColor, glow: bGlow }
            );
          } else if (equippedGun.pattern === 'hyper') {
            // Concentrated twin hyper beam
            bulletsRef.current.push(
              { id: nextIdRef.current++, x: player.x - 8, y: player.y - 22, vx: 0, vy: -750, radius: bRadius, color: bColor, glow: bGlow },
              { id: nextIdRef.current++, x: player.x + 8, y: player.y - 22, vx: 0, vy: -750, radius: bRadius, color: bColor, glow: bGlow }
            );
          } else {
            // Standard dual blaster
            bulletsRef.current.push(
              { id: nextIdRef.current++, x: player.x - 10, y: player.y - 18, vx: 0, vy: -560, radius: bRadius, color: bColor, glow: bGlow },
              { id: nextIdRef.current++, x: player.x + 10, y: player.y - 18, vx: 0, vy: -560, radius: bRadius, color: bColor, glow: bGlow }
            );
          }
        }

        // Update Bullets
        for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
          const b = bulletsRef.current[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.y < -20 || b.x < -20 || b.x > CANVAS_WIDTH + 20) {
            bulletsRef.current.splice(i, 1);
          }
        }

        // Maintain gentle enemy flow (2-3 enemies at once)
        if (enemiesRef.current.length < MAX_CONCURRENT_ENEMIES && Math.random() < 0.035) {
          spawnEnemy();
        }

        // Update Enemies
        for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
          const enemy = enemiesRef.current[i];
          enemy.y += enemy.speed * dt;

          // Recycle enemy if it reaches bottom
          if (enemy.y > CANVAS_HEIGHT + 40) {
            enemy.y = -40;
            enemy.x = 40 + Math.random() * (CANVAS_WIDTH - 80);
            continue;
          }

          // Player collision
          const distToPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
          if (distToPlayer < (enemy.width + player.width) / 2.3) {
            if (player.invincibleTimer <= 0) {
              createExplosion(player.x, player.y, '#f43f5e');
              createExplosion(enemy.x, enemy.y, enemy.color);
              enemiesRef.current.splice(i, 1);
              player.invincibleTimer = INVINCIBLE_TIME;
              soundManager.playHit();

              setLives((prev) => {
                const nextLives = prev - 1;
                if (nextLives <= 0) {
                  setGameState('GAMEOVER');
                  soundManager.playGameOver();

                  // Save total coins & high score
                  setScore((currentScore) => {
                    setHighScore((prevBest) => {
                      const newHigh = Math.max(prevBest, currentScore);
                      localStorage.setItem('simple_space_defender_highscore', String(newHigh));
                      return newHigh;
                    });
                    return currentScore;
                  });
                }
                return Math.max(0, nextLives);
              });
              continue;
            }
          }

          // Bullet collision: 1-hit destroys enemy!
          for (let bi = bulletsRef.current.length - 1; bi >= 0; bi--) {
            const bullet = bulletsRef.current[bi];
            const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (dist < bullet.radius + enemy.width / 2) {
              createExplosion(enemy.x, enemy.y, enemy.color);
              soundManager.playExplosion(0.8);

              // 1. Give +10 points
              setScore((s) => s + 10);
              setEnemiesDefeated((k) => k + 1);

              // 2. Auto-claim coins directly!
              const coinsEarned = Math.round(15 * bountyMultiplier);
              setSessionCoins((sc) => sc + coinsEarned);
              setInventory((prev) => {
                const updated = { ...prev, coins: prev.coins + coinsEarned };
                saveInventory(updated);
                return updated;
              });

              soundManager.playCoin();

              // 3. Spawn auto-flying coin visual traveling straight into top HUD coin bank
              coinsRef.current.push({
                id: nextIdRef.current++,
                x: enemy.x,
                y: enemy.y,
                startX: enemy.x,
                startY: enemy.y,
                targetX: 215,
                targetY: 25,
                progress: 0,
                speed: 1.8 + Math.random() * 0.4,
                value: coinsEarned,
                rotation: 0,
              });

              // Floating notification indicating auto-claimed coins
              floatingTextsRef.current.push({
                id: nextIdRef.current++,
                text: `+10 PTS (+${coinsEarned} 🪙 AUTO)`,
                x: enemy.x,
                y: enemy.y - 10,
                color: '#facc15',
                alpha: 1.0,
              });

              bulletsRef.current.splice(bi, 1);
              enemiesRef.current.splice(i, 1);
              break;
            }
          }
        }

        // Update Auto-Claiming Flying Coins (Arcing smoothly up into HUD coin counter)
        for (let ci = coinsRef.current.length - 1; ci >= 0; ci--) {
          const coin = coinsRef.current[ci];
          coin.progress += coin.speed * dt;
          coin.rotation += dt * 8;

          const t = Math.min(1, coin.progress);
          // Ease-in ease-out curve
          const easeT = t * t * (3 - 2 * t);
          const midX = (coin.startX + coin.targetX) / 2 + (coin.startX < coin.targetX ? -50 : 50);
          const midY = Math.min(coin.startY, coin.targetY) - 40;

          // Quadratic bezier interpolation
          const oneMinusT = 1 - easeT;
          coin.x = oneMinusT * oneMinusT * coin.startX + 2 * oneMinusT * easeT * midX + easeT * easeT * coin.targetX;
          coin.y = oneMinusT * oneMinusT * coin.startY + 2 * oneMinusT * easeT * midY + easeT * easeT * coin.targetY;

          // Gold sparkle trail
          if (Math.random() < 0.45) {
            particlesRef.current.push({
              id: nextIdRef.current++,
              x: coin.x,
              y: coin.y,
              vx: (Math.random() - 0.5) * 20,
              vy: (Math.random() - 0.5) * 20,
              size: 2,
              color: '#fef08a',
              alpha: 0.8,
            });
          }

          if (coin.progress >= 1) {
            // Arrived at HUD! Create burst of sparkles at coin counter
            for (let sp = 0; sp < 6; sp++) {
              const ang = Math.random() * Math.PI * 2;
              particlesRef.current.push({
                id: nextIdRef.current++,
                x: coin.targetX,
                y: coin.targetY,
                vx: Math.cos(ang) * (30 + Math.random() * 50),
                vy: Math.sin(ang) * (30 + Math.random() * 50),
                size: 2.5,
                color: '#facc15',
                alpha: 0.9,
              });
            }
            coinsRef.current.splice(ci, 1);
          }
        }

        // Update Particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.alpha -= 2.2 * dt;
          if (p.alpha <= 0) {
            particlesRef.current.splice(i, 1);
          }
        }

        // Update Floating Text
        for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
          const ft = floatingTextsRef.current[i];
          ft.y -= 45 * dt;
          ft.alpha -= 1.3 * dt;
          if (ft.alpha <= 0) {
            floatingTextsRef.current.splice(i, 1);
          }
        }
      }

      // ----------------- RENDER CANVAS -----------------
      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Deep space ambient glow
      const grad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT * 0.4,
        60,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT * 0.5,
        CANVAS_WIDTH * 0.75
      );
      grad.addColorStop(0, 'rgba(16, 24, 52, 0.45)');
      grad.addColorStop(1, 'rgba(5, 8, 20, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Render Stars
      for (const star of starsRef.current) {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Particles
      for (const p of particlesRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Render Bullets
      for (const b of bulletsRef.current) {
        ctx.save();
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.glow;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.radius, b.radius * 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Render Floating Coins (3D rotating gold coins)
      for (const c of coinsRef.current) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 10;

        // Rotating width
        const scaleX = Math.abs(Math.sin(c.rotation));
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.ellipse(0, 0, 9 * Math.max(0.2, scaleX), 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner star symbol
        if (scaleX > 0.4) {
          ctx.fillStyle = '#78350f';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('$', 0, 0.5);
        }

        ctx.restore();
      }

      // Render Enemies
      for (const e of enemiesRef.current) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = e.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;

        const hw = e.width / 2;
        const hh = e.height / 2;

        if (e.shapeType === 0) {
          ctx.beginPath();
          ctx.moveTo(0, hh);
          ctx.lineTo(hw, -hh);
          ctx.lineTo(0, -hh * 0.3);
          ctx.lineTo(-hw, -hh);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (e.shapeType === 1) {
          ctx.beginPath();
          ctx.ellipse(0, 0, hw, hh * 0.65, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, -hh * 0.2, hw * 0.4, Math.PI, 0);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, hh);
          ctx.lineTo(hw, 0);
          ctx.lineTo(0, -hh);
          ctx.lineTo(-hw, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      }

      // Render Equipped Player Spaceship
      if (gameState === 'PLAYING' || gameState === 'START') {
        const player = playerRef.current;
        ctx.save();
        ctx.translate(player.x, player.y);

        if (player.invincibleTimer > 0) {
          const blink = Math.floor(player.invincibleTimer * 12) % 2 === 0;
          ctx.globalAlpha = blink ? 0.35 : 0.9;
        }

        // Thruster flame animation
        const flameLength = 10 + Math.sin(currentTime * 0.02) * 5;
        ctx.fillStyle = equippedShip.trailColor;
        ctx.shadowColor = equippedShip.trailColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(-6, player.height / 2 - 4);
        ctx.lineTo(0, player.height / 2 + flameLength);
        ctx.lineTo(6, player.height / 2 - 4);
        ctx.closePath();
        ctx.fill();

        // Hull Geometry matching equipped Starship model
        ctx.shadowColor = equippedShip.glowColor;
        ctx.shadowBlur = 14;
        ctx.fillStyle = equippedShip.hullColor;
        ctx.strokeStyle = equippedShip.accentColor;
        ctx.lineWidth = 2.2;

        const hw = player.width / 2;
        const hh = player.height / 2;

        if (equippedShip.shape === 'phoenix') {
          // Swept forward wings
          ctx.beginPath();
          ctx.moveTo(0, -hh - 2);
          ctx.lineTo(hw + 4, hh * 0.5);
          ctx.lineTo(hw * 0.4, hh * 0.8);
          ctx.lineTo(0, hh * 0.4);
          ctx.lineTo(-hw * 0.4, hh * 0.8);
          ctx.lineTo(-hw - 4, hh * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (equippedShip.shape === 'interceptor') {
          // Double forward needle wings
          ctx.beginPath();
          ctx.moveTo(0, -hh - 4);
          ctx.lineTo(hw, -hh * 0.2);
          ctx.lineTo(hw * 0.6, hh * 0.8);
          ctx.lineTo(0, hh * 0.5);
          ctx.lineTo(-hw * 0.6, hh * 0.8);
          ctx.lineTo(-hw, -hh * 0.2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (equippedShip.shape === 'phantom') {
          // Stealth diamond delta
          ctx.beginPath();
          ctx.moveTo(0, -hh - 3);
          ctx.lineTo(hw + 2, hh * 0.3);
          ctx.lineTo(hw * 0.5, hh * 0.9);
          ctx.lineTo(0, hh * 0.35);
          ctx.lineTo(-hw * 0.5, hh * 0.9);
          ctx.lineTo(-hw - 2, hh * 0.3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (equippedShip.shape === 'titan') {
          // Heavy armored vanguard
          ctx.beginPath();
          ctx.moveTo(0, -hh);
          ctx.lineTo(hw, -hh * 0.4);
          ctx.lineTo(hw + 2, hh * 0.8);
          ctx.lineTo(hw * 0.4, hh);
          ctx.lineTo(0, hh * 0.6);
          ctx.lineTo(-hw * 0.4, hh);
          ctx.lineTo(-hw - 2, hh * 0.8);
          ctx.lineTo(-hw, -hh * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Viper Scout
          ctx.beginPath();
          ctx.moveTo(0, -hh);
          ctx.lineTo(hw, hh * 0.7);
          ctx.lineTo(hw * 0.35, hh * 0.5);
          ctx.lineTo(0, hh * 0.3);
          ctx.lineTo(-hw * 0.35, hh * 0.5);
          ctx.lineTo(-hw, hh * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Cockpit glass canopy
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = equippedShip.accentColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(0, -hh * 0.2, 4, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Render Floating Text
      for (const ft of floatingTextsRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = ft.color;
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 8;
        ctx.font = 'bold 16px "Rajdhani", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    gameState,
    effectiveFireRate,
    effectiveSpeed,
    equippedGun,
    equippedShip,
    bountyMultiplier,
    spawnEnemy,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden select-none"
    >
      {/* Game Window Card */}
      <div
        className="relative shadow-2xl rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col"
        style={{
          width: `${CANVAS_WIDTH * scale}px`,
          height: `${CANVAS_HEIGHT * scale}px`,
        }}
      >
        {/* TOP STATUS BAR */}
        <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex items-center justify-between text-slate-100 z-10 pointer-events-none">
          {/* Score & Coins Badges */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-md flex items-center gap-2">
              <span className="text-slate-400 text-xs sm:text-sm font-semibold tracking-wider">SCORE</span>
              <span className="text-cyan-400 font-bold text-base sm:text-xl font-orbitron tracking-widest">
                {score}
              </span>
            </div>

            {/* Total Gold Coins Badge */}
            <div className="bg-amber-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-amber-500/60 shadow-md flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 font-bold text-sm sm:text-base font-orbitron">
                {inventory.coins.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Remaining Lives & Controls */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-md">
              <span className="text-slate-400 text-xs sm:text-sm font-semibold mr-1">LIVES</span>
              {Array.from({ length: maxLives }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-4 h-4 transition-all ${
                    i < lives
                      ? 'text-rose-500 fill-rose-500 filter drop-shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                      : 'text-slate-700 fill-slate-800'
                  }`}
                />
              ))}
            </div>

            {/* Hangar & Shop Button */}
            <button
              onClick={() => setIsShopOpen(true)}
              className="p-2 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
              title="Open Hangar & Armory"
            >
              <ShoppingBag className="w-4 h-4 text-cyan-400" />
            </button>

            {/* Sound Mute Toggle */}
            <button
              onClick={toggleMute}
              className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 transition-colors cursor-pointer shadow-md"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
          </div>
        </div>

        {/* Canvas Element */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block bg-slate-950"
        />

        {/* START SCREEN OVERLAY */}
        {gameState === 'START' && !isShopOpen && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="max-w-md w-full bg-slate-900/95 border border-slate-700/90 rounded-2xl p-6 sm:p-7 shadow-2xl flex flex-col items-center gap-4">
              <div>
                <span className="text-xs uppercase font-orbitron tracking-widest text-cyan-400 font-semibold px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-800">
                  UPGRADABLE ARCADE SHOOTER
                </span>
                <h1 className="text-3xl sm:text-4xl font-black font-orbitron text-cyan-400 mt-2 tracking-wide text-glow-cyan">
                  SPACE DEFENDER
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  Blast aliens, collect gold coins, and upgrade your fleet
                </p>
              </div>

              {/* Active Loadout Banner */}
              <div className="w-full bg-slate-950/90 rounded-xl p-3 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg border flex items-center justify-center"
                    style={{
                      borderColor: equippedShip.accentColor,
                      backgroundColor: '#0a0f1d',
                    }}
                  >
                    <span className="text-xs">🚀</span>
                  </div>
                  <div className="text-left">
                    <div className="text-slate-400 text-[10px]">SHIP</div>
                    <div className="font-orbitron font-bold text-slate-100">
                      {equippedShip.name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg border flex items-center justify-center"
                    style={{
                      borderColor: equippedGun.bulletColor,
                      backgroundColor: '#0a0f1d',
                    }}
                  >
                    <span className="text-xs">⚡</span>
                  </div>
                  <div className="text-left">
                    <div className="text-slate-400 text-[10px]">WEAPON</div>
                    <div className="font-orbitron font-bold text-amber-300">
                      {equippedGun.name}
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls display */}
              <div className="w-full bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/80 text-left text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-cyan-300 border border-slate-700">
                    Arrow Keys
                  </span>
                  <span className="text-slate-400">Move Spaceship</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-cyan-300 border border-slate-700">
                    Spacebar
                  </span>
                  <span className="text-slate-400">Hold to Shoot</span>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-slate-400 text-[11px] space-y-0.5">
                  <div>🪙 <strong>Coins are Auto-Claimed!</strong> Every enemy destroyed instantly credits your bank.</div>
                  <div>🛒 Spend coins in the <strong>Hangar Shop</strong> to unlock new starships & weapons!</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 w-full">
                <button
                  onClick={startGame}
                  className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black font-orbitron tracking-wider text-base shadow-lg shadow-cyan-500/30 transition-all cursor-pointer flex items-center justify-center gap-2 transform active:scale-95"
                >
                  <Play className="w-5 h-5 fill-slate-950" />
                  START GAME
                </button>

                <button
                  onClick={() => setIsShopOpen(true)}
                  className="w-full py-2.5 px-6 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-amber-500/50 text-amber-300 font-bold font-orbitron tracking-wider text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4 text-amber-400" />
                  VISIT HANGAR & WEAPONS SHOP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER SCREEN OVERLAY */}
        {gameState === 'GAMEOVER' && !isShopOpen && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="max-w-md w-full bg-slate-900/95 border border-rose-500/40 rounded-2xl p-6 sm:p-7 shadow-2xl flex flex-col items-center gap-4">
              <div>
                <span className="text-xs font-orbitron uppercase tracking-widest text-rose-400 font-semibold px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-800">
                  OUT OF LIVES
                </span>
                <h2 className="text-3xl sm:text-4xl font-black font-orbitron text-rose-500 mt-1 tracking-wide">
                  GAME OVER
                </h2>
              </div>

              {/* Score and Coins Collected Summary */}
              <div className="w-full bg-slate-950/90 rounded-xl p-4 border border-slate-800 space-y-2.5 font-orbitron">
                <div className="flex justify-between items-center text-slate-400 text-sm">
                  <span>FINAL SCORE</span>
                  <span className="text-2xl font-bold text-cyan-400 tracking-wider">
                    {score} PTS
                  </span>
                </div>
                <div className="flex justify-between items-center text-amber-300 text-xs border-t border-slate-800/80 pt-2">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-400" /> COINS AUTO-CLAIMED THIS RUN
                  </span>
                  <span className="font-bold text-sm">+{sessionCoins} 🪙</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-xs">
                  <span>TOTAL COIN BANK</span>
                  <span className="text-amber-400 font-semibold">{inventory.coins.toLocaleString()} 🪙</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-xs">
                  <span>ALL-TIME BEST</span>
                  <span className="text-slate-200 font-semibold">{Math.max(highScore, score)} PTS</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 w-full">
                <button
                  onClick={startGame}
                  className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black font-orbitron tracking-wider text-base shadow-lg shadow-cyan-500/30 transition-all cursor-pointer flex items-center justify-center gap-2 transform active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" />
                  PLAY AGAIN (R)
                </button>

                <button
                  onClick={() => setIsShopOpen(true)}
                  className="w-full py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-500/50 text-amber-300 font-bold font-orbitron tracking-wider text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4 text-amber-400" />
                  UPGRADE IN HANGAR SHOP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HANGAR & WEAPONS SHOP MODAL */}
        {isShopOpen && (
          <HangarShop
            inventory={inventory}
            onUpdateInventory={handleUpdateInventory}
            onClose={() => setIsShopOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
