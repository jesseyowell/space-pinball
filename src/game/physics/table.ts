import RAPIER from '@dimforge/rapier3d';

// Table dimensions (in world units): 6 wide, 12 long
export const TABLE = { W: 6, L: 12, WALL_H: 0.5, WALL_T: 0.2 };

export function createTableBodies(world: RAPIER.World) {
  const bodies: RAPIER.RigidBody[] = [];

  const addStatic = (hw: number, hh: number, hd: number, x: number, y: number, z: number) => {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const body = world.createRigidBody(desc);
    const collider = RAPIER.ColliderDesc.cuboid(hw, hh, hd);
    world.createCollider(collider, body);
    bodies.push(body);
    return body;
  };

  // Floor
  addStatic(TABLE.W / 2, 0.05, TABLE.L / 2, 0, -0.05, 0);
  // Left wall
  addStatic(TABLE.WALL_T / 2, TABLE.WALL_H, TABLE.L / 2, -TABLE.W / 2 - TABLE.WALL_T / 2, TABLE.WALL_H / 2, 0);
  // Right wall
  addStatic(TABLE.WALL_T / 2, TABLE.WALL_H, TABLE.L / 2,  TABLE.W / 2 + TABLE.WALL_T / 2, TABLE.WALL_H / 2, 0);
  // Top wall
  addStatic(TABLE.W / 2, TABLE.WALL_H, TABLE.WALL_T / 2, 0, TABLE.WALL_H / 2, -TABLE.L / 2 - TABLE.WALL_T / 2);

  // Launch lane separator: runs from just below the arc (z=-4.2) all the way to the drain (z=6.5).
  // Forms the left wall of the shooter lane so the ball is channelled upward.
  // center = (-4.2 + 6.5) / 2 = 1.15, hd = (6.5 - (-4.2)) / 2 = 5.35
  addStatic(0.05, TABLE.WALL_H, 5.35, 2.50, TABLE.WALL_H / 2, 1.15);

  // Launch arc: 3 segments placed directly in the launch lane, progressively angled
  // so the ball curves smoothly around the top-right corner into the main field.
  //
  //  Arc1 (25°) at x=2.7 — in the lane itself, first gentle deflection left
  //  Arc2 (45°) at x=2.1 — crossing the separator gap, steepening
  //  Arc3 (60°) at x=1.4 — final redirect into the play field
  //
  // All segments sit at z ≈ -5 so they're above the separator and clearly in the
  // top corner, giving the ball a curved path instead of sharp bounces.
  const arcSegs = [
    { x: 2.7,  z: -4.7, hw: 0.25, angle: Math.PI / 7.2 }, // 25°
    { x: 2.1,  z: -5.1, hw: 0.40, angle: Math.PI / 4   }, // 45°
    { x: 1.4,  z: -5.3, hw: 0.40, angle: Math.PI / 3   }, // 60°
  ];
  arcSegs.forEach(({ x, z, hw, angle }) => {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(x, 0.1, z)
        .setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) }),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(hw, TABLE.WALL_H, 0.1), body);
    bodies.push(body);
  });

  // Outlane kicker guides: angled walls that redirect side-falling balls back toward the flippers.
  const kickerAngle = Math.PI / 4; // 45°
  const leftKicker = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(-2.1, TABLE.WALL_H / 2, 3.2)
      .setRotation({ x: 0, y: Math.sin(-kickerAngle / 2), z: 0, w: Math.cos(kickerAngle / 2) }),
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, TABLE.WALL_H, 0.1), leftKicker);
  bodies.push(leftKicker);

  const rightKicker = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(2.1, TABLE.WALL_H / 2, 3.2)
      .setRotation({ x: 0, y: Math.sin(kickerAngle / 2), z: 0, w: Math.cos(kickerAngle / 2) }),
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, TABLE.WALL_H, 0.1), rightKicker);
  bodies.push(rightKicker);

  // Drain sensor — narrowed to x=-2.3..+2.3 so a ball falling back down the
  // launch lane (x≈2.75) does NOT count as a ball loss.
  const drainDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -4.0, TABLE.L / 2 + 1.5);
  const drainBody = world.createRigidBody(drainDesc);
  const drainCollider = RAPIER.ColliderDesc.cuboid(2.3, 5.0, 0.5).setSensor(true);
  world.createCollider(drainCollider, drainBody);

  return { bodies, drainBody };
}
