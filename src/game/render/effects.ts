import * as THREE from 'three';

export class Effects {
  private shakeIntensity = 0;
  private originalCamPos: THREE.Vector3;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
  ) {
    this.originalCamPos = camera.position.clone();
  }

  bumpHit(position: THREE.Vector3) {
    this.spawnParticles(position, 0xff6600, 12);
    this.shakeIntensity = 0.05;
  }

  trickHit(position: THREE.Vector3) {
    this.spawnParticles(position, 0xaa00ff, 25);
    this.shakeIntensity = 0.15;
  }

  private spawnParticles(pos: THREE.Vector3, color: number, count: number) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y + 0.3;
      positions[i * 3 + 2] = pos.z;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2,
        (Math.random() - 0.5) * 3,
      ));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.1 });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    let life = 1.0;
    const tick = () => {
      life -= 0.05;
      if (life <= 0) { this.scene.remove(points); return; }
      const pos = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        pos[i * 3]     += velocities[i].x * 0.05;
        pos[i * 3 + 1] += velocities[i].y * 0.05;
        pos[i * 3 + 2] += velocities[i].z * 0.05;
        velocities[i].y -= 0.1; // gravity
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = life;
      mat.transparent = true;
      requestAnimationFrame(tick);
    };
    tick();
  }

  tick() {
    if (this.shakeIntensity > 0.001) {
      this.camera.position.x = this.originalCamPos.x + (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y = this.originalCamPos.y + (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= 0.85;
    } else {
      this.camera.position.copy(this.originalCamPos);
      this.shakeIntensity = 0;
    }
  }
}
