'use client';
import { useEffect, useState } from 'react';
import { gameStore, GameState } from '@/game/gameStore';

interface HUDState {
  score: number;
  highScore: number;
  ballsRemaining: number;
  gameState: GameState;
  isMultiball: boolean;
  charge: number;
}

export default function HUD() {
  const [hud, setHUD] = useState<HUDState>({
    score: 0, highScore: 0, ballsRemaining: 3,
    gameState: 'IDLE', isMultiball: false, charge: 0,
  });

  useEffect(() => {
    const unsubs = [
      gameStore.on('scoreChange', ({ score, highScore }) =>
        setHUD(h => ({ ...h, score, highScore }))),
      gameStore.on('stateChange', ({ state }) =>
        setHUD(h => ({ ...h, gameState: state }))),
      gameStore.on('ballChange', ({ ballsRemaining }) =>
        setHUD(h => ({ ...h, ballsRemaining }))),
      gameStore.on('multiBallStart', () =>
        setHUD(h => ({ ...h, isMultiball: true }))),
      gameStore.on('multiBallEnd', () =>
        setHUD(h => ({ ...h, isMultiball: false }))),
      gameStore.on('chargeChange', ({ charge }) =>
        setHUD(h => ({ ...h, charge: Math.abs(charge) }))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none', fontFamily: 'monospace', color: '#fff',
    }}>
      {hud.gameState === 'IDLE' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <h1 style={{ fontSize: '3rem', color: '#88aaff', textShadow: '0 0 20px #4466ff' }}>SPACE PINBALL</h1>
          <p style={{ color: '#aaa' }}>Press SPACE or ENTER to start</p>
          {hud.highScore > 0 && <p>High Score: {hud.highScore.toLocaleString()}</p>}
        </div>
      )}

      {hud.gameState === 'GAME_OVER' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <h2 style={{ fontSize: '2rem', color: '#ff4444' }}>GAME OVER</h2>
          <p>Score: {hud.score.toLocaleString()}</p>
          <p>High Score: {hud.highScore.toLocaleString()}</p>
          <p style={{ color: '#aaa' }}>Press SPACE to play again</p>
        </div>
      )}

      <div style={{ position: 'absolute', top: '1rem', left: '1rem' }}>
        <div style={{ fontSize: '1.5rem' }}>{hud.score.toLocaleString()}</div>
        <div style={{ fontSize: '0.8rem', color: '#888' }}>HI {hud.highScore.toLocaleString()}</div>
      </div>

      <div style={{ position: 'absolute', top: '1rem', right: '1rem', textAlign: 'right' }}>
        {'● '.repeat(hud.ballsRemaining).trim()}
        {hud.isMultiball && <div style={{ color: '#ffaa00', fontSize: '0.8rem' }}>MULTIBALL 2×</div>}
      </div>

      {hud.gameState === 'LAUNCHING' && (
        <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#888' }}>Hold SPACE to charge</p>
          <div style={{ width: '120px', height: '10px', background: '#333', borderRadius: '5px' }}>
            <div style={{ width: `${hud.charge * 100}%`, height: '100%', background: '#4488ff', borderRadius: '5px', transition: 'width 0.05s' }} />
          </div>
        </div>
      )}
    </div>
  );
}
