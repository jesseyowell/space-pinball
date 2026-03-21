import RAPIER from '@dimforge/rapier3d';

// Gravity: Y holds ball on XZ table, +Z rolls ball toward drain (high-Z end)
const GRAVITY = {
  x: 0,
  y: -9.81 * Math.cos((6.5 * Math.PI) / 180),  // ≈ -9.757
  z:  9.81 * Math.sin((6.5 * Math.PI) / 180),  // ≈  1.112
};

export function createPhysicsWorld(): RAPIER.World {
  return new RAPIER.World(GRAVITY);
}
