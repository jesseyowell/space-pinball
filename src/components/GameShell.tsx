'use client';
import { useEffect, useState } from 'react';

export default function GameShell() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import('@dimforge/rapier3d').then(() => {
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontFamily: 'monospace', fontSize: '1.5rem'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <canvas id="game-canvas" style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
