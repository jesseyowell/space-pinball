import * as THREE from 'three';
import { TABLE } from '../physics/table';

export function createTableMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(TABLE.W, 0.1, TABLE.L);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a0a1a,
    roughness: 0.6,
    metalness: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -0.05, 0);
  return mesh;
}

export function createBallMesh(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.2, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x88aaff,
    emissive: 0x2244aa,
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.9,
  });
  return new THREE.Mesh(geo, mat);
}

export function createFlipperMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1.2, 0.15, 0.25);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x334466,
    emissive: 0x0033aa,
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.8,
  });
  return new THREE.Mesh(geo, mat);
}
