'use client';
import { useEffect, useState } from 'react';
import RAPIER from '@dimforge/rapier3d';
import { createRenderContext } from '@/game/render/scene';
import { createPhysicsWorld } from '@/game/physics/world';
import { createTableBodies } from '@/game/physics/table';
import { createTableMesh } from '@/game/render/meshes';
import { GameLoop } from '@/game/GameLoop';

const loadingStyle = {
  width: '100vw', height: '100vh', background: '#000',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#fff', fontFamily: 'monospace', fontSize: '1.5rem'
} as const;

export default function GameShell() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('@dimforge/rapier3d').then(() => {
      // @dimforge/rapier3d v0.19.3 does not expose an init() on its main
      // export — the WASM is initialised automatically on import.
      if (!cancelled) setReady(true);
    }).catch((e) => {
      if (!cancelled) setError(String(e));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const { renderer, scene, camera } = createRenderContext(canvas);
    const world = createPhysicsWorld();

    // Create table physics bodies and mesh
    const { bodies: tableBodies, drainBody } = createTableBodies(world);
    const tableMesh = createTableMesh();
    scene.add(tableMesh);

    // Create and start the game loop
    const loop = new GameLoop(world, { scene, camera, renderer });
    loop.start();

    return () => { loop.stop(); renderer.dispose(); };
  }, [ready]);

  if (error) return <div style={{ ...loadingStyle, color: '#f66' }}>Failed to load: {error}</div>;

  if (!ready) {
    return (
      <div style={loadingStyle}>
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
