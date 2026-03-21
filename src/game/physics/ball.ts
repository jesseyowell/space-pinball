import RAPIER from '@dimforge/rapier3d';

let nextBallId = 0;

export interface Ball {
  id: number;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

let primaryBallId = 0;

export function getPrimaryBallId() { return primaryBallId; }

export function spawnBall(world: RAPIER.World, x: number, y: number, z: number): Ball {
  const id = nextBallId++;
  if (id === 0) primaryBallId = 0;

  const desc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setLinearDamping(0.1)
    .setAngularDamping(0.5);
  const body = world.createRigidBody(desc);
  const colliderDesc = RAPIER.ColliderDesc.ball(0.2)
    .setRestitution(0.7)
    .setFriction(0.3);
  const collider = world.createCollider(colliderDesc, body);
  return { id, body, collider };
}

export function removeBall(world: RAPIER.World, ball: Ball) {
  world.removeRigidBody(ball.body);
}

export function promotePrimaryBall(activeBalls: Ball[]) {
  if (activeBalls.length === 0) return;
  primaryBallId = Math.min(...activeBalls.map(b => b.id));
}
