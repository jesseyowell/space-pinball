import RAPIER from '@dimforge/rapier3d';

const TABLE_W = 6;
const FLIPPER_W = 1.2;
const FLIPPER_H = 0.15;
const FLIPPER_D = 0.25;
const REST_ANGLE = 0.45;   // radians, resting down
const ACTIVE_ANGLE = -0.45; // radians, raised up

export interface Flipper {
  body: RAPIER.RigidBody;
  joint: RAPIER.ImpulseJoint;
  side: 'left' | 'right';
}

export function createFlippers(world: RAPIER.World): { left: Flipper; right: Flipper } {
  const make = (side: 'left' | 'right'): Flipper => {
    const sign = side === 'left' ? -1 : 1;
    const pivotX = sign * (TABLE_W / 2 - 0.8);
    const pivotZ = 4.5; // near drain end

    // Fixed anchor body
    const anchorDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pivotX, 0.2, pivotZ);
    const anchor = world.createRigidBody(anchorDesc);

    // Flipper body — pre-rotated to rest angle so it starts at 45° down
    const flipperDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pivotX + sign * FLIPPER_W / 2, 0.2, pivotZ)
      .setRotation({ x: 0, y: Math.sin(-sign * REST_ANGLE / 2), z: 0, w: Math.cos(REST_ANGLE / 2) });
    const flipper = world.createRigidBody(flipperDesc);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(FLIPPER_W / 2, FLIPPER_H / 2, FLIPPER_D / 2)
        .setRestitution(0.4).setFriction(0.6),
      flipper,
    );

    // Revolute joint around Y axis
    const jointData = RAPIER.JointData.revolute(
      { x: -sign * FLIPPER_W / 2, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    const joint = world.createImpulseJoint(jointData, anchor, flipper, true) as RAPIER.RevoluteImpulseJoint;

    return { body: flipper, joint, side };
  };

  return { left: make('left'), right: make('right') };
}

const FLIP_STIFFNESS = 500;
const FLIP_DAMPING = 50;

export function activateFlipper(flipper: Flipper) {
  const j = flipper.joint as RAPIER.RevoluteImpulseJoint;
  // Joint angle 0 = rest (45° down). Active = 0.9 rad the other way (mirrored per side).
  const dir = flipper.side === 'left' ? -1 : 1;
  j.configureMotorPosition(dir * (REST_ANGLE + Math.abs(ACTIVE_ANGLE)), FLIP_STIFFNESS, FLIP_DAMPING);
}

export function deactivateFlipper(flipper: Flipper) {
  const j = flipper.joint as RAPIER.RevoluteImpulseJoint;
  j.configureMotorPosition(0, FLIP_STIFFNESS, FLIP_DAMPING);
}
