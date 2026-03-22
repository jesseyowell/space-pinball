import RAPIER from '@dimforge/rapier3d';
import { Ball, spawnBall } from './ball';

const LAUNCH_X = 2.75;
const LAUNCH_Z = 6.3;  // ball spawns at 5.8, clear of flipper sweep zone
const MIN_SPEED = 9;   // m/s at zero charge
const MAX_SPEED = 16;  // m/s at full charge

export function createLauncher(world: RAPIER.World): {
  spawnBallInLauncher: () => Ball;
  fireBall: (ball: Ball, charge: number) => void;
  isAboveLauncher: (ball: Ball) => boolean;
} {
  return {
    spawnBallInLauncher: () => spawnBall(world, LAUNCH_X, 0.22, LAUNCH_Z - 0.5),

    fireBall: (ball: Ball, charge: number) => {
      const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * charge;
      // setLinvel is reliable regardless of physics step timing
      ball.body.setLinvel({ x: 0, y: 0, z: -speed }, true);
    },

    isAboveLauncher: (ball: Ball) => {
      const pos = ball.body.translation();
      return pos.z < LAUNCH_Z - 1.5 && pos.z > LAUNCH_Z - 3.5 && Math.abs(pos.x - LAUNCH_X) < 0.5;
    },
  };
}
