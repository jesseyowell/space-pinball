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

  // After animation delay, eject ball back into play
  setTimeout(() => {
    ball.body.setTranslation({ x: EJECT_X, y: 0.2, z: EJECT_Z }, true);
    ball.body.applyImpulse({ x: (Math.random() - 0.5) * 1.5, y: 0.05, z: -2.5 }, true);
  }, 800);
}
