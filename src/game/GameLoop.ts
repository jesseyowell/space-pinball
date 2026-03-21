import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { RenderContext } from './render/scene';

export interface SyncPair {
  body: RAPIER.RigidBody;
  mesh: THREE.Object3D;
}

export class GameLoop {
  private rafId = 0;
  private pairs: SyncPair[] = [];

  constructor(
    private world: RAPIER.World,
    private ctx: RenderContext,
    private onStep?: () => void,
  ) {}

  addSyncPair(pair: SyncPair) { this.pairs.push(pair); }
  removeSyncPair(body: RAPIER.RigidBody) {
    this.pairs = this.pairs.filter(p => p.body !== body);
  }

  start() {
    const step = () => {
      this.rafId = requestAnimationFrame(step);
      this.world.step();
      for (const { body, mesh } of this.pairs) {
        const pos = body.translation();
        const rot = body.rotation();
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      }
      this.onStep?.();
      this.ctx.renderer.render(this.ctx.scene, this.ctx.camera);
    };
    step();
  }

  stop() { cancelAnimationFrame(this.rafId); }
}
