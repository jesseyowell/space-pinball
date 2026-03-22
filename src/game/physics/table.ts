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

  // Launch arc: 3 thin segments at the top of the lane that deflect the ball LEFT into the field.
  // Negative angles (CW rotation) are required — positive angles deflect RIGHT into the wall.
  // hw=0.12 keeps each segment narrow so it deflects without spanning the full lane width.
  // half-height=0.2 keeps them short so they guide rather than wall-off.
  const arcSegs = [
    { x: 2.75, z: -4.7, hw: 0.12, angle: -Math.PI / 6  }, // -30°
    { x: 2.3,  z: -5.1, hw: 0.12, angle: -Math.PI / 4  }, // -45°
    { x: 1.7,  z: -5.3, hw: 0.12, angle: -Math.PI / 3  }, // -60°
  ];
  arcSegs.forEach(({ x, z, hw, angle }) => {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(x, 0.25, z)
        .setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) }),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(hw, 0.2, 0.05), body);
    bodies.push(body);
  });

  // Launch lane floor: extends the table floor under the ball spawn position so a
  // returning ball lands here instead of falling through the void.
  addStatic(0.35, 0.05, 0.8, 2.75, -0.05, 6.7);

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

  // Drain sensor: thin vertical wall right at the table's bottom edge (z=6.2).
  // Positioned here so any ball that exits the playing area immediately triggers it —
  // the old z=7.5 position was unreliable because balls would fall in Y and miss it.
  // x narrowed to 2.3 so launch-lane balls (x≈2.75) are handled by returnToLauncher instead.
  const drainDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, TABLE.L / 2 + 0.2);
  const drainBody = world.createRigidBody(drainDesc);
  const drainCollider = RAPIER.ColliderDesc.cuboid(2.3, 3.0, 0.15).setSensor(true);
  world.createCollider(drainCollider, drainBody);

  return { bodies, drainBody };
}
