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

  // Launch guide ramp: angled wall at top of right lane, deflects ball into main field
  const guideAngle = Math.PI / 5; // 36°
  const guideBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(2.0, 0.1, -4.5)
      .setRotation({ x: 0, y: Math.sin(guideAngle / 2), z: 0, w: Math.cos(guideAngle / 2) }),
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.9, TABLE.WALL_H, 0.1), guideBody);
  bodies.push(guideBody);

  // Launch lane separator: thin wall separating the right shooter lane from the main field.
  // Starts at z=2.0 (leaves the top open so the ball can flow into the main field after the guide ramp).
  // Runs from z=2.0 down through the drain area (z=6.5).
  addStatic(0.05, TABLE.WALL_H, 2.25, 2.50, TABLE.WALL_H / 2, 4.25);

  // Outlane kicker guides: angled walls that redirect side-falling balls back toward the flippers.
  // Left kicker: ball falling down left side gets deflected right onto the left flipper face.
  // Right kicker: mirror image on the right side.
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

  // Drain sensor (bottom strip)
  // Tall sensor so it catches balls that fall off the floor edge (z=6) before draining
  const drainDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -4.0, TABLE.L / 2 + 1.5);
  const drainBody = world.createRigidBody(drainDesc);
  const drainCollider = RAPIER.ColliderDesc.cuboid(TABLE.W / 2, 5.0, 0.5).setSensor(true);
  world.createCollider(drainCollider, drainBody);

  return { bodies, drainBody };
}
