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
