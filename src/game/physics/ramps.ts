import RAPIER from '@dimforge/rapier3d';
import { scoring, POINTS } from '../state/scoring';
import { stateMachine } from '../state/StateMachine';

interface RampState {
  entranceTimes: Map<number, number>; // ballId → timestamp ms
}

export interface Ramp {
  body: RAPIER.RigidBody;
  entranceSensor: RAPIER.Collider;
  exitSensor: RAPIER.Collider;
  state: RampState;
}

const RAMP_DEFS = [
  { x: -1.5, z: -1.5, angle: 0.3 },  // left ramp — mid-field left
  { x:  1.5, z: -1.5, angle: -0.3 }, // right ramp — mid-field right, below guide walls and clear of launch exit
];

export function createRamps(world: RAPIER.World): Ramp[] {
  return RAMP_DEFS.map(({ x, z, angle }) => {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.0, z)
      .setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) });
    const body = world.createRigidBody(desc);
    // Ramp surface
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.4, 0.05, 1.5).setFriction(0.3), body);

    // Entrance sensor (low-Z side of ramp)
    const entranceSensor = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.4, 0.2, 0.15).setSensor(true)
        .setTranslation(0, 0.2, 1.3),
      body,
    );
    // Exit sensor (high-Z side of ramp)
    const exitSensor = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.4, 0.2, 0.15).setSensor(true)
        .setTranslation(0, 0.2, -1.3),
      body,
    );

    return { body, entranceSensor, exitSensor, state: { entranceTimes: new Map() } };
  });
}

export function handleRampEntrance(ramp: Ramp, ballId: number) {
  ramp.state.entranceTimes.set(ballId, performance.now());
}

export function handleRampExit(ramp: Ramp, ballId: number, getPrimaryId: () => number) {
  const enterTime = ramp.state.entranceTimes.get(ballId);
  if (!enterTime) return;
  ramp.state.entranceTimes.delete(ballId);
  if (performance.now() - enterTime > 5000) return; // expired

  const state = stateMachine.getState();
  if (state === 'PLAYING' || state === 'MULTIBALL') {
    scoring.add(POINTS.RAMP);
    if (ballId === getPrimaryId()) {
      return true; // signal primary ramp completion
    }
  }
  return false;
}
