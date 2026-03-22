import RAPIER from '@dimforge/rapier3d';
import { Ball, spawnBall } from './ball';

const LAUNCH_X = 2.7;  // right gutter
const LAUNCH_Z = 5.0;  // near drain
const MIN_IMPULSE = 18;
const MAX_IMPULSE = 36;

export function createLauncher(world: RAPIER.World): {
  spawnBallInLauncher: () => Ball;
  fireBall: (ball: Ball, charge: number) => void;
  isAboveLauncher: (ball: Ball) => boolean;
} {
  return {
    spawnBallInLauncher: () => {
      const ball = spawnBall(world, LAUNCH_X, 0.3, LAUNCH_Z - 0.5);
      // Hold kinematic so the flipper motor sweep can't push it before launch
      ball.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      return ball;
    },

    fireBall: (ball: Ball, charge: number) => {
      // Re-enable physics, then send ball up the table
      ball.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      const impulse = MIN_IMPULSE + (MAX_IMPULSE - MIN_IMPULSE) * charge;
      ball.body.applyImpulse({ x: 0, y: 0, z: -impulse }, true);
    },

    isAboveLauncher: (ball: Ball) => {
      const pos = ball.body.translation();
      return pos.z < LAUNCH_Z - 1.5 && pos.z > LAUNCH_Z - 3.5 && Math.abs(pos.x - LAUNCH_X) < 0.5;
    },
  };
}
