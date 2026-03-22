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

export function createKickerMeshes(): { left: THREE.Mesh; right: THREE.Mesh } {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1a1a3a,
    emissive: 0x4466cc,
    emissiveIntensity: 0.7,
    roughness: 0.2,
    metalness: 0.8,
  });
  const geo = new THREE.BoxGeometry(1.2, TABLE.WALL_H * 2, 0.2);
  const left = new THREE.Mesh(geo, mat);
  left.position.set(-2.1, TABLE.WALL_H / 2, 3.2);
  left.rotation.y = -Math.PI / 4;

  const right = new THREE.Mesh(geo, mat.clone());
  right.position.set(2.1, TABLE.WALL_H / 2, 3.2);
  right.rotation.y = Math.PI / 4;

  return { left, right };
}

export function createLaneSeparatorMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.1, TABLE.WALL_H * 2, 4.5);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0d1b33,
    emissive: 0x1a3a6e,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(2.50, TABLE.WALL_H / 2, 4.25);
  return mesh;
}

export function createLaunchGuideMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1.8, TABLE.WALL_H * 2, 0.2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0d1b33,
    emissive: 0x3366aa,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(2.0, 0.1, -4.5);
  mesh.rotation.y = Math.PI / 5;
  return mesh;
}

export function createBorderMeshes(): { leftWall: THREE.Mesh; rightWall: THREE.Mesh; topWall: THREE.Mesh } {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0d1b33,
    emissive: 0x1a3a6e,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.9,
  });
  const wallH = TABLE.WALL_H * 2;   // full height (WALL_H is half-extent)
  const wallT = TABLE.WALL_T;        // full thickness

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, TABLE.L), mat);
  leftWall.position.set(-(TABLE.W / 2 + TABLE.WALL_T / 2), TABLE.WALL_H / 2, 0);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, TABLE.L), mat.clone());
  rightWall.position.set(TABLE.W / 2 + TABLE.WALL_T / 2, TABLE.WALL_H / 2, 0);

  const topWall = new THREE.Mesh(new THREE.BoxGeometry(TABLE.W + wallT * 2, wallH, wallT), mat.clone());
  topWall.position.set(0, TABLE.WALL_H / 2, -(TABLE.L / 2 + TABLE.WALL_T / 2));

  return { leftWall, rightWall, topWall };
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
