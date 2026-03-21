import RAPIER from '@dimforge/rapier3d';
import { scoring, POINTS } from '../state/scoring';
import { stateMachine } from '../state/StateMachine';

const BUMPER_POSITIONS = [
  { x: -1.5, z: -2 },
  { x:  1.5, z: -2 },
  { x:  0,   z: -3.5 },
];

export function createBumpers(world: RAPIER.World) {
  return BUMPER_POSITIONS.map(({ x, z }) => {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.3, z);
    const body = world.createRigidBody(desc);
    world.createCollider(
      RAPIER.ColliderDesc.ball(0.4).setRestitution(1.5).setFriction(0),
      body,
    );
    return body;
  });
}

export function handleBumperCollision(
  world: RAPIER.World,
  ballBody: RAPIER.RigidBody,
  bumperBody: RAPIER.RigidBody,
) {
  // Impulse away from bumper center
  const ballPos = ballBody.translation();
  const bumperPos = bumperBody.translation();
  const dx = ballPos.x - bumperPos.x;
  const dz = ballPos.z - bumperPos.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  ballBody.applyImpulse({ x: (dx / len) * 5, y: 0, z: (dz / len) * 5 }, true);

  const state = stateMachine.getState();
  if (state === 'PLAYING' || state === 'MULTIBALL') {
    scoring.add(POINTS.BUMPER);
  }
}
