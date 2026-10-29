import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameStatus, PlayerStats } from '../types/game';
import { soundManager } from '../utils/audio';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';
import {
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Pause,
  Shield,
  Zap,
  Heart,
  Bomb,
  Trophy,
  Crosshair,
  Sparkles,
} from 'lucide-react';

export const SpaceDefender: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState<GameStatus>('MENU');
  const [stats, setStats] = useState<PlayerStats>({
    score: 0,
    highScore: 0,
    lives: 3,
    maxLives: 5,
    wave: 1,
    combo: 0,
    comboTimer: 0,
    enemiesDefeated: 0,
    accuracy: 100,
    shotsFired: 0,
    shotsHit: 0,
  });

  const [powerups, setPowerups] = useState<{
    rapidTimer: number;
    hasShield: boolean;
    bombs: number;
  }>({
    rapidTimer: 0,
    hasShield: false,
    bombs: 1,
  });

  const [bossState, setBossState] = useState<{
    active: boolean;
    name: string;
    title: string;
    health: number;
    maxHealth: number;
  } | null>(null);

  const [isMuted, setIsMuted] = useState<boolean>(() => soundManager.getMuted());
  const [scale, setScale] = useState<number>(1);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  // Responsive scaling to fit window maintaining 800x920 ratio
  const handleResize = useCallback(() => {
    if (!containerRef.current) return;
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    // Scale calculation
    const maxW = windowW * 0.98;
    const maxH = windowH * 0.98;

    const scaleW = maxW / GAME_WIDTH;
    const scaleH = maxH / GAME_HEIGHT;
    const fitScale = Math.min(scaleW, scaleH, 1.25);
    setScale(Math.max(fitScale, 0.45));
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    // Detect touch
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      setIsTouchDevice(true);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  // Initialize GameEngine
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    const engine = new GameEngine(canvas, {
      onStatusChange: (newStatus) => setStatus(newStatus),
      onStatsChange: (newStats) => setStats(newStats),
      onActivePowerupsChange: (p) => setPowerups(p),
      onBossStateChange: (b) => setBossState(b),
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
    };
  }, []);

  const handleStartGame = () => {
    soundManager.init();
    if (engineRef.current) {
      engineRef.current.startNewGame();
    }
  };

  const handlePauseToggle = () => {
    if (!engineRef.current) return;
    if (status === 'PLAYING') {
      engineRef.current.pauseGame();
    } else if (status === 'PAUSED') {
      engineRef.current.resumeGame();
    }
  };

  const handleTriggerBomb = () => {
    if (engineRef.current && status === 'PLAYING') {
      engineRef.current.triggerBomb();
    }
  };

  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  // Virtual touch control helpers
  const handleTouchDown = (key: string) => {
    if (engineRef.current) {
      engineRef.current.setKey(key, true);
    }
  };

  const handleTouchUp = (key: string) => {
    if (engineRef.current) {
      engineRef.current.setKey(key, false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-slate-950 flex items-center justify-center overflow-hidden select-none"
    >
      {/* Game Frame Container */}
      <div
        className="relative shadow-2xl shadow-cyan-950/60 rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950"
        style={{
          width: `${GAME_WIDTH * scale}px`,
          height: `${GAME_HEIGHT * scale}px`,
        }}
      >
        {/* Render Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full block bg-slate-950"
        />

        {/* TOP HUD (Active in PLAYING and PAUSED) */}
        {(status === 'PLAYING' || status === 'PAUSED') && (
          <div className="absolute top-0 left-0 right-0 p-3 pointer-events-none flex flex-col gap-2 z-10">
            {/* Top Bar: Stats, Lives, Controls */}
            <div className="flex items-center justify-between text-xs sm:text-sm font-semibold tracking-wider font-orbitron">
              {/* Score & Combo */}
              <div className="flex items-center gap-2 sm:gap-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg">
                <div className="text-slate-400">SCORE</div>
                <div className="text-cyan-400 text-sm sm:text-base font-bold tracking-widest text-glow-cyan">
                  {stats.score.toLocaleString()}
                </div>
                {stats.combo > 1 && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse text-xs">
                    <Sparkles className="w-3 h-3" />
                    COMBO x{(1 + Math.min(stats.combo * 0.2, 3)).toFixed(1)}
                  </div>
                )}
              </div>

              {/* Wave & High Score */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-slate-300 flex items-center gap-1.5 shadow-lg">
                  <span className="text-slate-400">WAVE</span>
                  <span className="text-cyan-300 font-bold text-sm sm:text-base">
                    {stats.wave}
                  </span>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-slate-400 shadow-lg">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300 font-bold">
                    {stats.highScore.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Lives & Utility Buttons */}
              <div className="flex items-center gap-2">
                {/* Lives */}
                <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/60 shadow-lg">
                  {Array.from({ length: stats.maxLives }).map((_, i) => (
                    <Heart
                      key={i}
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all ${
                        i < stats.lives
                          ? 'text-rose-500 fill-rose-500 filter drop-shadow-[0_0_6px_rgba(244,63,94,0.7)]'
                          : 'text-slate-700 fill-slate-800'
                      }`}
                    />
                  ))}
                </div>

                {/* Pause Button */}
                <button
                  onClick={handlePauseToggle}
                  className="pointer-events-auto p-1.5 sm:p-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-600 transition-colors cursor-pointer"
                  title="Pause / Resume (P)"
                >
                  {status === 'PAUSED' ? (
                    <Play className="w-3.5 h-3.5" />
                  ) : (
                    <Pause className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Sound Toggle */}
                <button
                  onClick={handleToggleMute}
                  className="pointer-events-auto p-1.5 sm:p-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-600 transition-colors cursor-pointer"
                  title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Boss Health Bar (When Boss Active) */}
            {bossState && bossState.active && (
              <div className="w-full bg-slate-950/90 border border-rose-600/70 rounded-lg p-2.5 backdrop-blur-md shadow-xl animate-pulse">
                <div className="flex justify-between items-center text-xs font-orbitron mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-rose-400 font-bold tracking-wider">
                      {bossState.name}
                    </span>
                    <span className="text-slate-400 hidden sm:inline">
                      | {bossState.title}
                    </span>
                  </div>
                  <span className="text-rose-300 font-bold">
                    {Math.round((bossState.health / bossState.maxHealth) * 100)}%
                  </span>
                </div>
                {/* Boss bar fill */}
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-rose-950">
                  <div
                    className="h-full bg-gradient-to-r from-rose-600 via-amber-500 to-rose-400 transition-all duration-150"
                    style={{
                      width: `${Math.max(
                        0,
                        (bossState.health / bossState.maxHealth) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Active Powerups status bar */}
            <div className="flex items-center gap-2 text-xs">
              {powerups.hasShield && (
                <div className="flex items-center gap-1.5 bg-cyan-950/80 border border-cyan-500/60 px-2 py-1 rounded text-cyan-300 shadow-md">
                  <Shield className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span className="font-semibold font-orbitron text-[10px] sm:text-xs">
                    SHIELD ACTIVE
                  </span>
                </div>
              )}

              {powerups.rapidTimer > 0 && (
                <div className="flex items-center gap-2 bg-amber-950/80 border border-amber-500/60 px-2.5 py-1 rounded text-amber-300 shadow-md">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold font-orbitron text-[10px] sm:text-xs">
                    RAPID {powerups.rapidTimer.toFixed(1)}s
                  </span>
                  <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{
                        width: `${(powerups.rapidTimer / 10) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {powerups.bombs > 0 && (
                <button
                  onClick={handleTriggerBomb}
                  className="pointer-events-auto flex items-center gap-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/60 px-2.5 py-1 rounded text-rose-300 cursor-pointer shadow-md transition-all active:scale-95"
                  title="Detonate Nova Bomb (Key B)"
                >
                  <Bomb className="w-3.5 h-3.5 text-rose-400" />
                  <span className="font-semibold font-orbitron text-[10px] sm:text-xs">
                    BOMB ({powerups.bombs}) [B]
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* START SCREEN OVERLAY */}
        {status === 'MENU' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-between p-6 sm:p-10 text-center z-20">
            {/* Header / Title */}
            <div className="flex flex-col items-center gap-2 mt-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-400 text-xs font-semibold tracking-widest font-orbitron">
                RETRO ARCADE SPACE COMBAT
              </div>
              <h1 className="text-4xl sm:text-6xl font-black font-orbitron tracking-wider text-cyan-400 text-glow-cyan">
                SPACE DEFENDER
              </h1>
              <p className="text-slate-400 text-sm sm:text-base max-w-md">
                Pilot the vanguard fighter, blast hostile armadas, collect combat power-ups, and destroy the mothership flagships.
              </p>
            </div>

            {/* Ship Visual & High Score Card */}
            <div className="flex flex-col items-center gap-4 my-auto">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
                <div className="relative border-2 border-cyan-400/80 rounded-2xl p-4 bg-slate-900/90 box-glow-cyan">
                  {/* Vector ship illustration */}
                  <svg
                    viewBox="0 0 60 60"
                    className="w-16 h-16 drop-shadow-[0_0_12px_#38bdf8]"
                  >
                    <polygon
                      points="30,8 52,48 38,44 30,36 22,44 8,48"
                      fill="#0f172a"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                    />
                    <polygon
                      points="30,16 42,42 30,36 18,42"
                      fill="#06b6d4"
                      opacity="0.6"
                    />
                    <ellipse cx="30" cy="24" rx="3.5" ry="8" fill="#67e8f9" />
                  </svg>
                </div>
              </div>

              {stats.highScore > 0 && (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-orbitron text-sm">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>HIGH SCORE: {stats.highScore.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Controls & Powerups Guide */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg w-full text-left text-xs bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <div>
                <div className="text-cyan-400 font-bold font-orbitron mb-1.5 flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" /> FLIGHT CONTROLS
                </div>
                <ul className="text-slate-300 space-y-1">
                  <li><span className="text-white font-mono bg-slate-800 px-1 rounded">Arrow Keys / WASD</span> : Move</li>
                  <li><span className="text-white font-mono bg-slate-800 px-1 rounded">Spacebar</span> : Hold to Fire</li>
                  <li><span className="text-white font-mono bg-slate-800 px-1 rounded">P</span> : Pause / Resume</li>
                  <li><span className="text-white font-mono bg-slate-800 px-1 rounded">B</span> : Nova Bomb Blast</li>
                </ul>
              </div>

              <div>
                <div className="text-amber-400 font-bold font-orbitron mb-1.5 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> COMBAT DROPS
                </div>
                <ul className="text-slate-300 space-y-1">
                  <li><span className="text-cyan-400">🛡️ Shield</span> : Absorbs 1 hit</li>
                  <li><span className="text-amber-400">⚡ Rapid</span> : Triple spread cannons</li>
                  <li><span className="text-green-400">❤️ Life</span> : Restore 1 hull life</li>
                  <li><span className="text-rose-400">💣 Bomb</span> : Wipe enemy bullets</li>
                </ul>
              </div>
            </div>

            {/* Start Button */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 w-full max-w-sm">
              <button
                onClick={handleStartGame}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black font-orbitron tracking-wider text-lg shadow-lg shadow-cyan-500/40 hover:shadow-cyan-400/60 transition-all cursor-pointer flex items-center justify-center gap-2 transform active:scale-95"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                DEFEND SECTOR NOW
              </button>

              <button
                onClick={handleToggleMute}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-rose-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-cyan-400" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* PAUSE OVERLAY */}
        {status === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="p-8 max-w-sm w-full bg-slate-900/90 border border-slate-700 rounded-2xl shadow-2xl flex flex-col items-center gap-5">
              <div className="text-xs font-orbitron tracking-widest text-cyan-400 uppercase">
                Tactical Pause
              </div>
              <h2 className="text-3xl font-black font-orbitron text-slate-100">
                SYSTEM PAUSED
              </h2>

              <p className="text-slate-400 text-sm">
                Sector defense paused. Press <span className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">P</span> or click resume below.
              </p>

              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={handlePauseToggle}
                  className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-orbitron tracking-wider text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  RESUME COMBAT (P)
                </button>

                <button
                  onClick={handleStartGame}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold font-orbitron tracking-wider text-xs border border-slate-600 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  RESTART MISSION
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER OVERLAY */}
        {status === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in duration-300">
            <div className="p-8 max-w-md w-full bg-slate-900/95 border border-rose-500/40 rounded-2xl shadow-2xl box-glow-red flex flex-col items-center gap-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/70 border border-rose-500/50 text-rose-400 text-xs font-semibold tracking-widest font-orbitron">
                HULL CRITICALLY DESTROYED
              </div>

              <h2 className="text-4xl font-black font-orbitron text-rose-500 text-glow-red">
                MISSION FAILED
              </h2>

              {/* Score summary */}
              <div className="w-full bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3 font-orbitron text-sm">
                <div className="flex justify-between items-center text-slate-400">
                  <span>FINAL SCORE</span>
                  <span className="text-2xl font-bold text-cyan-400 text-glow-cyan">
                    {stats.score.toLocaleString()}
                  </span>
                </div>

                {stats.score >= stats.highScore && stats.score > 0 && (
                  <div className="py-1 px-2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-1.5 animate-pulse">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    NEW PERSONAL HIGH SCORE!
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <div className="text-slate-500">WAVES</div>
                    <div className="text-slate-200 font-bold text-base">
                      {stats.wave}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">KILLS</div>
                    <div className="text-slate-200 font-bold text-base">
                      {stats.enemiesDefeated}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">ACCURACY</div>
                    <div className="text-slate-200 font-bold text-base">
                      {stats.accuracy}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={handleStartGame}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-rose-500 via-amber-500 to-rose-400 hover:brightness-110 text-slate-950 font-black font-orbitron tracking-wider text-base shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 transform active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" />
                  PLAY AGAIN (R)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ON-SCREEN MOBILE / TOUCH CONTROLS (Rendered when touch device active during PLAYING) */}
        {isTouchDevice && status === 'PLAYING' && (
          <div className="absolute inset-x-0 bottom-4 px-4 flex justify-between items-end pointer-events-none z-10">
            {/* D-Pad */}
            <div className="grid grid-cols-3 gap-1.5 pointer-events-auto bg-slate-900/60 p-2 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
              <div />
              <button
                onTouchStart={() => handleTouchDown('ArrowUp')}
                onTouchEnd={() => handleTouchUp('ArrowUp')}
                className="w-12 h-12 rounded-xl bg-slate-800/80 active:bg-cyan-500 active:text-slate-950 text-slate-200 flex items-center justify-center font-bold text-xl border border-slate-700"
              >
                ▲
              </button>
              <div />
              <button
                onTouchStart={() => handleTouchDown('ArrowLeft')}
                onTouchEnd={() => handleTouchUp('ArrowLeft')}
                className="w-12 h-12 rounded-xl bg-slate-800/80 active:bg-cyan-500 active:text-slate-950 text-slate-200 flex items-center justify-center font-bold text-xl border border-slate-700"
              >
                ◀
              </button>
              <button
                onTouchStart={() => handleTouchDown('ArrowDown')}
                onTouchEnd={() => handleTouchUp('ArrowDown')}
                className="w-12 h-12 rounded-xl bg-slate-800/80 active:bg-cyan-500 active:text-slate-950 text-slate-200 flex items-center justify-center font-bold text-xl border border-slate-700"
              >
                ▼
              </button>
              <button
                onTouchStart={() => handleTouchDown('ArrowRight')}
                onTouchEnd={() => handleTouchUp('ArrowRight')}
                className="w-12 h-12 rounded-xl bg-slate-800/80 active:bg-cyan-500 active:text-slate-950 text-slate-200 flex items-center justify-center font-bold text-xl border border-slate-700"
              >
                ▶
              </button>
            </div>

            {/* Fire and Bomb Buttons */}
            <div className="flex flex-col gap-2 pointer-events-auto items-end">
              {powerups.bombs > 0 && (
                <button
                  onClick={handleTriggerBomb}
                  className="w-12 h-12 rounded-full bg-rose-600/90 active:bg-rose-400 text-white flex items-center justify-center font-bold shadow-lg border border-rose-400"
                >
                  <Bomb className="w-5 h-5" />
                </button>
              )}
              <button
                onTouchStart={() => handleTouchDown('Space')}
                onTouchEnd={() => handleTouchUp('Space')}
                className="w-16 h-16 rounded-2xl bg-cyan-500 active:bg-cyan-300 text-slate-950 flex flex-col items-center justify-center font-black font-orbitron text-xs shadow-lg shadow-cyan-500/50 border border-cyan-300"
              >
                <Crosshair className="w-6 h-6" />
                FIRE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
