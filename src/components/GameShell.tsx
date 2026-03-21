'use client';
import { useEffect, useState } from 'react';
import RAPIER from '@dimforge/rapier3d';
import * as THREE from 'three';
import { createRenderContext } from '@/game/render/scene';
import { createPhysicsWorld } from '@/game/physics/world';
import { createTableBodies } from '@/game/physics/table';
import { createTableMesh, createBallMesh, createFlipperMesh } from '@/game/render/meshes';
import { createFlippers } from '@/game/physics/flippers';
import { GameLoop } from '@/game/GameLoop';
import { createLauncher } from '@/game/physics/launcher';
import { InputHandler } from '@/game/input/InputHandler';
import { stateMachine } from '@/game/state/StateMachine';
import { gameStore } from '@/game/gameStore';

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

    // Create flippers
    const { left, right } = createFlippers(world);
    const leftMesh = createFlipperMesh();
    const rightMesh = createFlipperMesh();
    scene.add(leftMesh, rightMesh);
    loop.addSyncPair({ body: left.body, mesh: leftMesh });
    loop.addSyncPair({ body: right.body, mesh: rightMesh });

    // Create launcher and spawn ball
    const launcher = createLauncher(world);
    let currentBall = launcher.spawnBallInLauncher();
    const ballMesh = createBallMesh();
    scene.add(ballMesh);
    loop.addSyncPair({ body: currentBall.body, mesh: ballMesh });

    // Track active balls and their meshes
    const activeBalls = [currentBall];
    const ballMeshMap = new Map<number, THREE.Mesh>();
    ballMeshMap.set(currentBall.id, ballMesh);

    // Create input handler
    const input = new InputHandler({ left, right });

    // Listen for launch fire event
    const unsubLaunchFire = gameStore.on('launchFire', ({ charge }) => {
      if (currentBall) {
        launcher.fireBall(currentBall, charge);
        stateMachine.ballLaunched();
      }
    });

    loop.start();

    return () => {
      loop.stop();
      renderer.dispose();
      input.destroy();
      unsubLaunchFire();
    };
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
