'use client';
import { useEffect, useState } from 'react';
import RAPIER from '@dimforge/rapier3d';
import * as THREE from 'three';
import { createRenderContext } from '@/game/render/scene';
import { createPostProcessing } from '@/game/render/postprocessing';
import { createStarfield } from '@/game/render/starfield';
import { Effects } from '@/game/render/effects';
import { createPhysicsWorld } from '@/game/physics/world';
import { createTableBodies } from '@/game/physics/table';
import { createTableMesh, createBallMesh, createFlipperMesh, createBumperMesh, createRampMesh, createTrickHoleMesh } from '@/game/render/meshes';
import { createFlippers } from '@/game/physics/flippers';
import { GameLoop } from '@/game/GameLoop';
import { createLauncher } from '@/game/physics/launcher';
import { createBumpers, handleBumperCollision } from '@/game/physics/bumpers';
import { createRamps, handleRampEntrance, handleRampExit } from '@/game/physics/ramps';
import { createTrickHole, handleTrickHoleTrigger } from '@/game/physics/trickHole';
import { removeBall, promotePrimaryBall, getPrimaryBallId, incrementRampCount, canTriggerMultiball, setMultifired, spawnBall, resetBallState } from '@/game/physics/ball';
import { InputHandler } from '@/game/input/InputHandler';
import { stateMachine } from '@/game/state/StateMachine';
import { gameStore } from '@/game/gameStore';
import { scoring } from '@/game/state/scoring';
import HUD from './HUD';

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
    createStarfield(scene);
    const { render: bloomRender } = createPostProcessing(renderer, scene, camera);
    const effects = new Effects(scene, camera);
    const world = createPhysicsWorld();

    // Create table physics bodies and mesh
    const { bodies: _tableBodies, drainBody } = createTableBodies(world);
    const tableMesh = createTableMesh();
    scene.add(tableMesh);

    // Create bumpers
    const bumperBodies = createBumpers(world);
    bumperBodies.forEach((body) => {
      const mesh = createBumperMesh();
      const pos = body.translation();
      mesh.position.set(pos.x, pos.y, pos.z);
      scene.add(mesh);
      // Bumpers are static — no sync pair needed
    });

    // Create ramps
    const ramps = createRamps(world);
    ramps.forEach(({ body }) => {
      const mesh = createRampMesh();
      const pos = body.translation();
      mesh.position.set(pos.x, pos.y, pos.z);
      scene.add(mesh);
      // Ramps are static — no sync pair needed
    });

    // Create trick hole
    const trickHoleSensor = createTrickHole(world);
    scene.add(createTrickHoleMesh());

    // Pre-compute ramp sensor list for per-frame intersection checks
    const rampHandles = ramps.map(r => ({ ramp: r }));

    // Create and start the game loop
    const loop = new GameLoop(world, { scene, camera, renderer }, () => {
      const eq = loop.getEventQueue();

      // Drain collision events (bumper hits via EventQueue)
      eq.drainCollisionEvents((h1, h2, started) => {
        if (!started) return;
        for (const bumperBody of bumperBodies) {
          const bc = bumperBody.collider(0);
          const ballHit = activeBalls.find(b => b.collider.handle === h1 || b.collider.handle === h2);
          if (ballHit && (bc.handle === h1 || bc.handle === h2)) {
            handleBumperCollision(world, ballHit.body, bumperBody);
            const bumperPos = bumperBody.translation();
            effects.bumpHit(new THREE.Vector3(bumperPos.x, bumperPos.y, bumperPos.z));
          }
        }
      });

      // Sensor intersection checks via world.intersectionPairsWith
      // (Rapier v0.19 EventQueue has no drainIntersectionEvents)

      // Drain sensor
      world.intersectionPairsWith(drainBody.collider(0), (collider2: RAPIER.Collider) => {
        const ball = activeBalls.find(b => b.collider.handle === collider2.handle);
        if (ball) {
          activeBalls = activeBalls.filter(b => b !== ball);
          removeBall(world, ball);
          loop.removeSyncPair(ball.body);
          const mesh = ballMeshMap.get(ball.id);
          if (mesh) { scene.remove(mesh); ballMeshMap.delete(ball.id); }
          promotePrimaryBall(activeBalls);
          stateMachine.ballDrained(ball.id);
        }
      });

      // Trick hole sensor
      world.intersectionPairsWith(trickHoleSensor, (collider2: RAPIER.Collider) => {
        const ball = activeBalls.find(b => b.collider.handle === collider2.handle);
        if (ball) {
          handleTrickHoleTrigger(ball);
          const ballPos = ball.body.translation();
          effects.trickHit(new THREE.Vector3(ballPos.x, ballPos.y, ballPos.z));
        }
      });

      // Ramp entrance/exit sensors
      for (const { ramp } of rampHandles) {
        world.intersectionPairsWith(ramp.entranceSensor, (collider2: RAPIER.Collider) => {
          const ball = activeBalls.find(b => b.collider.handle === collider2.handle);
          if (ball) handleRampEntrance(ramp, ball.id);
        });
        world.intersectionPairsWith(ramp.exitSensor, (collider2: RAPIER.Collider) => {
          const ball = activeBalls.find(b => b.collider.handle === collider2.handle);
          if (ball) {
            const isPrimaryCompletion = handleRampExit(ramp, ball.id, getPrimaryBallId);
            if (isPrimaryCompletion) {
              incrementRampCount();

              // Multiball trigger: spawn bonus ball at table center upper third
              if (canTriggerMultiball()) {
                setMultifired();
                stateMachine.multiBallStart();
                scoring.setMultiplier(2);

                // Spawn bonus ball at table center upper third
                const bonusBall = spawnBall(world, 0, 0.5, -1.0);
                const bonusMesh = createBallMesh();
                scene.add(bonusMesh);
                activeBalls.push(bonusBall);
                ballMeshMap.set(bonusBall.id, bonusMesh);
                loop.addSyncPair({ body: bonusBall.body, mesh: bonusMesh });
                bonusBall.body.applyImpulse({ x: (Math.random() - 0.5) * 2, y: 1, z: -5 }, true);
              }
            }
          }
        });
      }

      effects.tick();
    }, bloomRender);

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
    let activeBalls = [currentBall];
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

    // Listen for multiball end event
    const unsubMultiBallEnd = gameStore.on('multiBallEnd', () => scoring.setMultiplier(1));

    // Listen for state changes to manage ball lifecycle
    const unsubStateChange = gameStore.on('stateChange', ({ state }) => {
      if (state === 'BALL_LOST' || state === 'GAME_OVER') {
        activeBalls.forEach(b => {
          removeBall(world, b);
          loop.removeSyncPair(b.body);
          const mesh = ballMeshMap.get(b.id);
          if (mesh) scene.remove(mesh);
        });
        activeBalls = [];
        ballMeshMap.clear();
        scoring.setMultiplier(1);
        resetBallState();
      }
      if (state === 'LAUNCHING') {
        currentBall = launcher.spawnBallInLauncher();
        const mesh = createBallMesh();
        scene.add(mesh);
        activeBalls = [currentBall];
        ballMeshMap.set(currentBall.id, mesh);
        loop.addSyncPair({ body: currentBall.body, mesh });
      }
    });

    loop.start();

    return () => {
      loop.stop();
      renderer.dispose();
      input.destroy();
      unsubLaunchFire();
      unsubMultiBallEnd();
      unsubStateChange();
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
      <HUD />
    </div>
  );
}
