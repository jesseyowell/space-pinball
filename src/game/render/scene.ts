import * as THREE from 'three';

export interface RenderContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000008);

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
  // Position camera above and slightly behind the table (table is on XZ plane, drain at +Z)
  camera.position.set(0, 18, 8);
  camera.lookAt(0, 0, -2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // Ambient light
  scene.add(new THREE.AmbientLight(0x111133, 2));

  // Handle resize
  const ro = new ResizeObserver(() => {
    const nw = canvas.clientWidth;
    const nh = canvas.clientHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
  ro.observe(canvas);

  return { scene, camera, renderer };
}
