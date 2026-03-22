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

    // Flipper body
    const flipperDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pivotX + sign * FLIPPER_W / 2, 0.2, pivotZ);
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

export function activateFlipper(flipper: Flipper) {
  const j = flipper.joint as RAPIER.RevoluteImpulseJoint;
  j.configureMotorVelocity(20, 100);
}

export function deactivateFlipper(flipper: Flipper) {
  const j = flipper.joint as RAPIER.RevoluteImpulseJoint;
  j.configureMotorVelocity(-20, 100);
}
