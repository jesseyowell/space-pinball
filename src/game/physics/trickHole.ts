import RAPIER from '@dimforge/rapier3d';
import { scoring, POINTS } from '../state/scoring';
import { stateMachine } from '../state/StateMachine';
import { Ball } from './ball';

const HOLE_X = 0;
const HOLE_Z = -2.5;
const EJECT_X = 0;
const EJECT_Z = -1.0;

export function createTrickHole(world: RAPIER.World): RAPIER.Collider {
  const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(HOLE_X, 0, HOLE_Z);
  const body = world.createRigidBody(desc);
  return world.createCollider(
    RAPIER.ColliderDesc.ball(0.35).setSensor(true),
    body,
  );
}

export function handleTrickHoleTrigger(ball: Ball) {
  const state = stateMachine.getState();
  if (state !== 'PLAYING' && state !== 'MULTIBALL') return;

  // Freeze ball
  ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

  // Award points
  scoring.add(POINTS.TRICK_HOLE);

  // After animation delay, eject ball in a random direction across a 180° fan
  // pointing toward the top half of the table so gravity doesn't immediately recapture it.
  setTimeout(() => {
    const angle = (Math.random() - 0.5) * Math.PI; // -90° to +90° spread
    const speed = 3.0 + Math.random() * 2.0;
    ball.body.setTranslation({ x: EJECT_X, y: 0.2, z: EJECT_Z }, true);
    ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    ball.body.applyImpulse({ x: Math.sin(angle) * speed, y: 0.05, z: -Math.cos(angle) * speed }, true);
  }, 800);
}
