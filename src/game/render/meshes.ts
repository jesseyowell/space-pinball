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

export function createBumperMesh(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff6600,
    emissive: 0xff3300,
    emissiveIntensity: 1.0,
    roughness: 0.3,
    metalness: 0.5,
  });
  return new THREE.Mesh(geo, mat);
}

export function createRampMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.8, 0.1, 3.0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x003366,
    emissive: 0x0055ff,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.8,
    roughness: 0.1,
    metalness: 0.5,
  });
  return new THREE.Mesh(geo, mat);
}

export function createTrickHoleMesh(): THREE.Mesh {
  const geo = new THREE.CircleGeometry(0.35, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x440088,
    emissiveIntensity: 2.0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.01, -2.5);
  return mesh;
}
