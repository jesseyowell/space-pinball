# Space Pinball Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable space-themed 3D pinball game in Next.js using Three.js for rendering and Rapier for realistic physics simulation.

**Architecture:** Next.js App Router shell with a single Client Component that initializes Rapier WASM, then mounts a full-screen Three.js canvas. The game loop runs outside React via `requestAnimationFrame`, syncing Rapier rigid body positions to Three.js meshes each frame. A plain JS event emitter (`gameStore`) bridges game state to a React HUD overlay.

**Tech Stack:** Next.js 14 (App Router), Three.js, `@dimforge/rapier3d`, Three.js `EffectComposer` for bloom post-processing, TypeScript.

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, minimal
│   └── page.tsx                # Mounts <GameShell />
├── components/
│   └── GameShell.tsx           # Client Component: WASM init gate + canvas + HUD overlay
├── game/
│   ├── GameLoop.ts             # rAF loop: step physics → sync meshes → render
│   ├── gameStore.ts            # Plain JS EventEmitter for game state/score events
│   ├── physics/
│   │   ├── world.ts            # Rapier world creation, gravity setup
│   │   ├── table.ts            # Table colliders (walls, floor, drain sensor)
│   │   ├── flippers.ts         # Flipper rigid bodies + revolute joints
│   │   ├── ball.ts             # Ball factory: spawn, ID assignment, primary tracking
│   │   ├── bumpers.ts          # Bumper colliders + collision impulse
│   │   ├── ramps.ts            # Ramp colliders + entrance/exit sensors
│   │   ├── trickHole.ts        # Trick shot hole sensor + eject logic
│   │   └── launcher.ts         # Prismatic joint launcher
│   ├── render/
│   │   ├── scene.ts            # Three.js scene, camera, renderer setup
│   │   ├── meshes.ts           # Three.js mesh factory (table, ball, bumpers, etc.)
│   │   ├── postprocessing.ts   # EffectComposer + UnrealBloomPass setup
│   │   ├── starfield.ts        # Particle system starfield + skydome
│   │   └── effects.ts          # Hit particles, point light pulses, camera shake
│   ├── state/
│   │   ├── StateMachine.ts     # IDLE→LAUNCHING→PLAYING→MULTIBALL→BALL_LOST→GAME_OVER
│   │   └── scoring.ts          # Score tracking, multiplier, high score localStorage
│   └── input/
│       └── InputHandler.ts     # Keyboard event listeners, state-gated dispatch
└── components/
    └── HUD.tsx                 # React overlay: score, ball #, multiball, charge bar
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json` (via `create-next-app`)
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/components/GameShell.tsx` (stub)

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /Users/jyowell/sandbox/pinball
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes
```

Expected: project files created, `npm run dev` works.

- [ ] **Step 2: Install game dependencies**

```bash
npm install three @dimforge/rapier3d
npm install --save-dev @types/three
```

- [ ] **Step 3: Verify three + rapier imports resolve**

Create `src/app/page.tsx`:
```tsx
export default function Home() {
  return <main style={{ width: '100vw', height: '100vh', background: '#000' }} />;
}
```

Run `npm run build` — expected: builds without errors.

- [ ] **Step 4: Strip default Next.js styles**

Replace `src/app/globals.css`:
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: bootstrap Next.js project with Three.js and Rapier"
```

---

## Task 2: Rapier WASM Init + Loading Gate

**Files:**
- Create: `src/components/GameShell.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create GameShell with WASM loading gate**

Create `src/components/GameShell.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';

export default function GameShell() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import('@dimforge/rapier3d').then((RAPIER) => {
      RAPIER.init().then(() => setReady(true));
    });
  }, []);

  if (!ready) {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontFamily: 'monospace', fontSize: '1.5rem'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <canvas id="game-canvas" style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
```

- [ ] **Step 2: Mount GameShell from page**

Update `src/app/page.tsx`:
```tsx
import GameShell from '@/components/GameShell';

export default function Home() {
  return <GameShell />;
}
```

- [ ] **Step 3: Verify loading screen appears then clears**

Run `npm run dev`. Open browser. Should see "Loading..." briefly then a black canvas. Check console for no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/GameShell.tsx src/app/page.tsx
git commit -m "feat: add Rapier WASM loading gate"
```

---

## Task 3: gameStore Event Emitter

**Files:**
- Create: `src/game/gameStore.ts`

- [ ] **Step 1: Write gameStore**

Create `src/game/gameStore.ts`:
```ts
type EventMap = {
  stateChange: { state: GameState };
  scoreChange: { score: number; highScore: number };
  ballChange: { ballsRemaining: number };
  multiBallStart: void;
  multiBallEnd: void;
  chargeChange: { charge: number }; // 0–1, updated each frame during charging
  launchFire: { charge: number };   // fired once on Space release with final charge (0–1)
};

export type GameState =
  | 'IDLE'
  | 'LAUNCHING'
  | 'PLAYING'
  | 'MULTIBALL'
  | 'BALL_LOST'
  | 'GAME_OVER';

type Listener<T> = (payload: T) => void;

class GameStore {
  private listeners: { [K in keyof EventMap]?: Listener<EventMap[K]>[] } = {};

  on<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>) {
    (this.listeners[event] ??= []).push(fn as any);
    return () => this.off(event, fn);
  }

  off<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>) {
    this.listeners[event] = (this.listeners[event] ?? []).filter(f => f !== fn) as any;
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    (this.listeners[event] ?? []).forEach(fn => (fn as any)(payload));
  }
}

export const gameStore = new GameStore();
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/game/gameStore.ts
git commit -m "feat: add gameStore event emitter"
```

---

## Task 4: State Machine

**Files:**
- Create: `src/game/state/StateMachine.ts`

- [ ] **Step 1: Write StateMachine**

Create `src/game/state/StateMachine.ts`:
```ts
import { gameStore, GameState } from '../gameStore';

export class StateMachine {
  private state: GameState = 'IDLE';
  private ballsRemaining = 3;
  private activeBalls = 0;
  private ballLostTimer: ReturnType<typeof setTimeout> | null = null;

  getState() { return this.state; }
  getBallsRemaining() { return this.ballsRemaining; }
  getActiveBalls() { return this.activeBalls; }

  private transition(next: GameState) {
    this.state = next;
    gameStore.emit('stateChange', { state: next });
  }

  startGame() {
    if (this.state !== 'IDLE') return;
    this.ballsRemaining = 3;
    this.transition('LAUNCHING');
  }

  ballLaunched() {
    if (this.state !== 'LAUNCHING') return;
    this.activeBalls = 1;
    this.transition('PLAYING');
  }

  multiBallStart() {
    if (this.state !== 'PLAYING') return;
    this.activeBalls = 2;
    this.transition('MULTIBALL');
    gameStore.emit('multiBallStart', undefined as any);
  }

  ballDrained(ballId: number) {
    if (this.state === 'BALL_LOST') return; // discard
    this.activeBalls = Math.max(0, this.activeBalls - 1);
    if (this.activeBalls >= 1) {
      // Return to PLAYING from MULTIBALL
      if (this.state === 'MULTIBALL') {
        this.transition('PLAYING');
        gameStore.emit('multiBallEnd', undefined as any);
      }
      return;
    }
    // Last ball drained
    this.ballsRemaining -= 1;
    gameStore.emit('ballChange', { ballsRemaining: this.ballsRemaining });
    this.transition('BALL_LOST');
    this.ballLostTimer = setTimeout(() => {
      if (this.ballsRemaining > 0) {
        this.transition('LAUNCHING');
      } else {
        this.transition('GAME_OVER');
      }
    }, 1500);
  }

  reset() {
    if (this.ballLostTimer) clearTimeout(this.ballLostTimer);
    this.state = 'IDLE';
    this.ballsRemaining = 3;
    this.activeBalls = 0;
    this.transition('IDLE');
  }
}

export const stateMachine = new StateMachine();
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/game/state/StateMachine.ts
git commit -m "feat: add game state machine"
```

---

## Task 5: Scoring

**Files:**
- Create: `src/game/state/scoring.ts`

- [ ] **Step 1: Write scoring module**

Create `src/game/state/scoring.ts`:
```ts
import { gameStore } from '../gameStore';

const HIGH_SCORE_KEY = 'pinball_high_score';

class Scoring {
  private score = 0;
  private multiplier = 1;
  private highScore = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) ?? '0', 10);
    }
  }

  getScore() { return this.score; }
  getMultiplier() { return this.multiplier; }
  getHighScore() { return this.highScore; }

  setMultiplier(m: number) {
    this.multiplier = m;
  }

  add(base: number) {
    const pts = base * this.multiplier;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof window !== 'undefined') {
        localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      }
    }
    gameStore.emit('scoreChange', { score: this.score, highScore: this.highScore });
    return pts;
  }

  reset() {
    this.score = 0;
    this.multiplier = 1;
    gameStore.emit('scoreChange', { score: 0, highScore: this.highScore });
  }
}

export const scoring = new Scoring();
export const POINTS = {
  BUMPER: 100,
  RAMP: 500,
  TRICK_HOLE: 1000,
} as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/game/state/scoring.ts
git commit -m "feat: add scoring module with localStorage high score"
```

---

## Task 6: Three.js Scene + Camera + Renderer

**Files:**
- Create: `src/game/render/scene.ts`

- [ ] **Step 1: Write scene setup**

Create `src/game/render/scene.ts`:
```ts
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
```

- [ ] **Step 2: Mount renderer in GameShell and verify black canvas renders**

Update `src/components/GameShell.tsx` — after `setReady(true)`, add:
```tsx
// After ready gate renders canvas, initialize renderer
useEffect(() => {
  if (!ready) return;
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const { renderer, scene, camera } = createRenderContext(canvas);
  let raf: number;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    renderer.render(scene, camera);
  };
  loop();
  return () => { cancelAnimationFrame(raf); renderer.dispose(); };
}, [ready]);
```

Add import: `import { createRenderContext } from '@/game/render/scene';`

- [ ] **Step 3: Verify in browser**

`npm run dev`. Should see a very dark (near-black with blue tint) canvas. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/game/render/scene.ts src/components/GameShell.tsx
git commit -m "feat: add Three.js scene, camera, and renderer"
```

---

## Task 7: Rapier Physics World

**Files:**
- Create: `src/game/physics/world.ts`

- [ ] **Step 1: Write physics world factory**

Create `src/game/physics/world.ts`:
```ts
import RAPIER from '@dimforge/rapier3d';

// Gravity: Y holds ball on XZ table, +Z rolls ball toward drain (high-Z end)
const GRAVITY = {
  x: 0,
  y: -9.81 * Math.cos((6.5 * Math.PI) / 180),  // ≈ -9.757
  z:  9.81 * Math.sin((6.5 * Math.PI) / 180),  // ≈  1.112
};

export function createPhysicsWorld(): RAPIER.World {
  return new RAPIER.World(GRAVITY);
}
```

- [ ] **Step 2: Wire world into GameShell**

In `GameShell.tsx`, after WASM is ready, create the world:
```ts
import RAPIER from '@dimforge/rapier3d';
import { createPhysicsWorld } from '@/game/physics/world';

// Inside the ready useEffect:
const world = createPhysicsWorld();
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/game/physics/world.ts src/components/GameShell.tsx
git commit -m "feat: create Rapier physics world with tilted gravity"
```

---

## Task 8: Game Loop

**Files:**
- Create: `src/game/GameLoop.ts`

- [ ] **Step 1: Write game loop**

Create `src/game/GameLoop.ts`:
```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/game/GameLoop.ts
git commit -m "feat: add rAF game loop with physics/mesh sync"
```

---

## Task 9: Table Geometry

**Files:**
- Create: `src/game/physics/table.ts`
- Create: `src/game/render/meshes.ts` (table mesh section)

- [ ] **Step 1: Write table physics**

Create `src/game/physics/table.ts`:
```ts
import RAPIER from '@dimforge/rapier3d';

// Table dimensions (in world units): 6 wide, 12 long
export const TABLE = { W: 6, L: 12, WALL_H: 0.5, WALL_T: 0.2 };

export function createTableBodies(world: RAPIER.World) {
  const bodies: RAPIER.RigidBody[] = [];

  const addStatic = (hw: number, hh: number, hd: number, x: number, y: number, z: number) => {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const body = world.createRigidBody(desc);
    const collider = RAPIER.ColliderDesc.cuboid(hw, hh, hd);
    world.createCollider(collider, body);
    bodies.push(body);
    return body;
  };

  // Floor
  addStatic(TABLE.W / 2, 0.05, TABLE.L / 2, 0, -0.05, 0);
  // Left wall
  addStatic(TABLE.WALL_T / 2, TABLE.WALL_H, TABLE.L / 2, -TABLE.W / 2 - TABLE.WALL_T / 2, TABLE.WALL_H / 2, 0);
  // Right wall
  addStatic(TABLE.WALL_T / 2, TABLE.WALL_H, TABLE.L / 2,  TABLE.W / 2 + TABLE.WALL_T / 2, TABLE.WALL_H / 2, 0);
  // Top wall
  addStatic(TABLE.W / 2, TABLE.WALL_H, TABLE.WALL_T / 2, 0, TABLE.WALL_H / 2, -TABLE.L / 2 - TABLE.WALL_T / 2);

  // Drain sensor (bottom strip)
  const drainDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, TABLE.L / 2 + 0.5);
  const drainBody = world.createRigidBody(drainDesc);
  const drainCollider = RAPIER.ColliderDesc.cuboid(TABLE.W / 2, 0.1, 0.3).setSensor(true);
  world.createCollider(drainCollider, drainBody);

  return { bodies, drainBody };
}
```

- [ ] **Step 2: Create table mesh**

Create `src/game/render/meshes.ts`:
```ts
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
```

- [ ] **Step 3: Add table to scene and verify visible**

In `GameShell.tsx` inside the ready `useEffect`, after creating the scene and world:
```ts
import { createTableBodies } from '@/game/physics/table';
import { createTableMesh } from '@/game/render/meshes';

const { bodies: tableBodies, drainBody } = createTableBodies(world);
const tableMesh = createTableMesh();
scene.add(tableMesh);
```

Run `npm run dev`. Should see a dark rectangular table surface in the browser.

- [ ] **Step 4: Commit**

```bash
git add src/game/physics/table.ts src/game/render/meshes.ts src/components/GameShell.tsx
git commit -m "feat: add table geometry (physics + mesh)"
```

---

## Task 10: Ball Physics + Mesh

**Files:**
- Create: `src/game/physics/ball.ts`
- Modify: `src/game/render/meshes.ts`

- [ ] **Step 1: Write ball factory**

Create `src/game/physics/ball.ts`:
```ts
import RAPIER from '@dimforge/rapier3d';

let nextBallId = 0;

export interface Ball {
  id: number;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

let primaryBallId = 0;

export function getPrimaryBallId() { return primaryBallId; }

export function spawnBall(world: RAPIER.World, x: number, y: number, z: number): Ball {
  const id = nextBallId++;
  if (id === 0) primaryBallId = 0;

  const desc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setLinearDamping(0.1)
    .setAngularDamping(0.5);
  const body = world.createRigidBody(desc);
  const colliderDesc = RAPIER.ColliderDesc.ball(0.2)
    .setRestitution(0.7)
    .setFriction(0.3);
  const collider = world.createCollider(colliderDesc, body);
  return { id, body, collider };
}

export function removeBall(world: RAPIER.World, ball: Ball) {
  world.removeRigidBody(ball.body);
}

export function promotePrimaryBall(activeBalls: Ball[]) {
  if (activeBalls.length === 0) return;
  primaryBallId = Math.min(...activeBalls.map(b => b.id));
}
```

- [ ] **Step 2: Add ball mesh factory**

In `src/game/render/meshes.ts`, add:
```ts
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
```

- [ ] **Step 3: Spawn a ball and verify it falls onto the table**

In `GameShell.tsx`:
```ts
import { spawnBall } from '@/game/physics/ball';
import { createBallMesh } from '@/game/render/meshes';
import { GameLoop } from '@/game/GameLoop';

const ball = spawnBall(world, 0, 1, -4); // spawn above table center
const ballMesh = createBallMesh();
scene.add(ballMesh);

const loop = new GameLoop(world, { scene, camera, renderer });
loop.addSyncPair({ body: ball.body, mesh: ballMesh });
loop.start();
```

Run `npm run dev`. Ball should appear and fall onto the table surface, rolling toward the drain end due to gravity's Z component.

- [ ] **Step 4: Commit**

```bash
git add src/game/physics/ball.ts src/game/render/meshes.ts src/components/GameShell.tsx
git commit -m "feat: add ball physics and mesh, verify gravity roll"
```

---

## Task 11: Flippers

**Files:**
- Create: `src/game/physics/flippers.ts`
- Modify: `src/game/render/meshes.ts`

- [ ] **Step 1: Write flipper physics**

Create `src/game/physics/flippers.ts`:
```ts
import RAPIER from '@dimforge/rapier3d';

const TABLE_W = 6; // must be declared before use below
const FLIPPER_W = 1.2;
const FLIPPER_H = 0.15;
const FLIPPER_D = 0.25;
const REST_ANGLE = 0.45;   // radians, resting down
const ACTIVE_ANGLE = -0.45; // radians, raised up

export interface Flipper {
  body: RAPIER.RigidBody;
  joint: RAPIER.ImpulseJoint;
  side: 'left' | 'right';
}

export function createFlippers(world: RAPIER.World): { left: Flipper; right: Flipper } {
  const make = (side: 'left' | 'right'): Flipper => {
    const sign = side === 'left' ? -1 : 1;
    const pivotX = sign * (TABLE_W / 2 - 0.8);
    const pivotZ = 4.5; // near drain end

    // Fixed anchor body
    const anchorDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pivotX, 0.2, pivotZ);
    const anchor = world.createRigidBody(anchorDesc);

    // Flipper body
    const flipperDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pivotX + sign * FLIPPER_W / 2, 0.2, pivotZ);
    const flipper = world.createRigidBody(flipperDesc);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(FLIPPER_W / 2, FLIPPER_H / 2, FLIPPER_D / 2)
        .setRestitution(0.4).setFriction(0.6),
      flipper,
    );

    // Revolute joint around Y axis
    const jointData = RAPIER.JointData.revolute(
      { x: -sign * FLIPPER_W / 2, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    const joint = world.createImpulseJoint(jointData, anchor, flipper, true) as RAPIER.RevoluteImpulseJoint;

    return { body: flipper, joint, side };
  };

  return { left: make('left'), right: make('right') };
}

export function activateFlipper(flipper: Flipper) {
  const j = flipper.joint as RAPIER.RevoluteImpulseJoint;
  j.configureMotorVelocity(20, 100);
}

export function deactivateFlipper(flipper: Flipper) {
  const j = flipper.joint as RAPIER.RevoluteImpulseJoint;
  j.configureMotorVelocity(-20, 100);
}
```

- [ ] **Step 2: Add flipper meshes**

In `src/game/render/meshes.ts`, add:
```ts
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
```

- [ ] **Step 3: Add flippers to scene, verify they appear**

In `GameShell.tsx`:
```ts
import { createFlippers } from '@/game/physics/flippers';

const { left, right } = createFlippers(world);
const leftMesh = createFlipperMesh();
const rightMesh = createFlipperMesh();
scene.add(leftMesh, rightMesh);
loop.addSyncPair({ body: left.body, mesh: leftMesh });
loop.addSyncPair({ body: right.body, mesh: rightMesh });
```

Run `npm run dev`. Two flipper shapes should appear near the drain end of the table.

- [ ] **Step 4: Commit**

```bash
git add src/game/physics/flippers.ts src/game/render/meshes.ts src/components/GameShell.tsx
git commit -m "feat: add flipper physics and meshes"
```

---

## Task 12: Input Handler

**Files:**
- Create: `src/game/input/InputHandler.ts`

- [ ] **Step 1: Write input handler**

Create `src/game/input/InputHandler.ts`:
```ts
import { stateMachine } from '../state/StateMachine';
import { Flipper, activateFlipper, deactivateFlipper } from '../physics/flippers';
import { gameStore } from '../gameStore';

export class InputHandler {
  private chargeStart: number | null = null;
  private maxCharge = 2000; // ms

  constructor(private flippers: { left: Flipper; right: Flipper }) {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
  }

  private onDown = (e: KeyboardEvent) => {
    const state = stateMachine.getState();

    if ((e.code === 'Space' || e.code === 'Enter') && state === 'IDLE') {
      e.preventDefault();
      stateMachine.startGame();
      return; // consume; do NOT start charging
    }

    if (state === 'LAUNCHING' && e.code === 'Space' && this.chargeStart === null) {
      e.preventDefault();
      this.chargeStart = performance.now();
    }

    if (state === 'PLAYING' || state === 'MULTIBALL') {
      if (e.code === 'ArrowLeft' || e.code === 'KeyZ') activateFlipper(this.flippers.left);
      if (e.code === 'ArrowRight' || e.code === 'Slash') activateFlipper(this.flippers.right);
    }
  };

  private onUp = (e: KeyboardEvent) => {
    const state = stateMachine.getState();

    if (state === 'LAUNCHING' && e.code === 'Space' && this.chargeStart !== null) {
      const charge = Math.min(1, (performance.now() - this.chargeStart) / this.maxCharge);
      this.chargeStart = null;
      gameStore.emit('chargeChange', { charge: 0 }); // reset bar
      gameStore.emit('launchFire', { charge });       // dedicated fire event
    }

    if (e.code === 'ArrowLeft' || e.code === 'KeyZ') deactivateFlipper(this.flippers.left);
    if (e.code === 'ArrowRight' || e.code === 'Slash') deactivateFlipper(this.flippers.right);
  };

  // Called each frame during LAUNCHING to update charge bar
  tickCharge() {
    if (this.chargeStart === null) return;
    const charge = Math.min(1, (performance.now() - this.chargeStart) / this.maxCharge);
    gameStore.emit('chargeChange', { charge });
  }

  destroy() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/game/input/InputHandler.ts
git commit -m "feat: add keyboard input handler with state-gated dispatch"
```

---

## Task 13: Launcher

**Files:**
- Create: `src/game/physics/launcher.ts`

- [ ] **Step 1: Write launcher**

Create `src/game/physics/launcher.ts`:
```ts
import RAPIER from '@dimforge/rapier3d';
import { Ball, spawnBall } from './ball';

const LAUNCH_X = 2.7;  // right gutter
const LAUNCH_Z = 5.0;  // near drain
const MIN_IMPULSE = 3;
const MAX_IMPULSE = 12;

export function createLauncher(world: RAPIER.World): {
  spawnBallInLauncher: () => Ball;
  fireBall: (ball: Ball, charge: number) => void;
  isAboveLauncher: (ball: Ball) => boolean;
} {
  return {
    spawnBallInLauncher: () => spawnBall(world, LAUNCH_X, 0.3, LAUNCH_Z - 0.5),

    fireBall: (ball: Ball, charge: number) => {
      const impulse = MIN_IMPULSE + (MAX_IMPULSE - MIN_IMPULSE) * charge;
      // Fire in -Z direction (toward top of table, into play)
      ball.body.applyImpulse({ x: 0, y: 0, z: -impulse }, true);
    },

    isAboveLauncher: (ball: Ball) => {
      const pos = ball.body.translation();
      return pos.z < LAUNCH_Z - 1.5 && pos.z > LAUNCH_Z - 3.5 && Math.abs(pos.x - LAUNCH_X) < 0.5;
    },
  };
}
```

- [ ] **Step 2: Wire launcher fire to input**

In `GameShell.tsx`, listen for the dedicated fire event:
```ts
gameStore.on('launchFire', ({ charge }) => {
  if (currentBall) {
    launcher.fireBall(currentBall, charge);
    stateMachine.ballLaunched();
  }
});
```

- [ ] **Step 3: Verify ball launches on Space release**

`npm run dev`. Press Space/Enter to start → hold Space → release → ball should fly up the table.

- [ ] **Step 4: Commit**

```bash
git add src/game/physics/launcher.ts src/components/GameShell.tsx
git commit -m "feat: add launcher with charge-based ball firing"
```

---

## Task 14: Bumpers

**Files:**
- Create: `src/game/physics/bumpers.ts`
- Modify: `src/game/render/meshes.ts`

- [ ] **Step 1: Write bumper physics**

Create `src/game/physics/bumpers.ts`:
```ts
import RAPIER from '@dimforge/rapier3d';
import { scoring, POINTS } from '../state/scoring';
import { stateMachine } from '../state/StateMachine';

const BUMPER_POSITIONS = [
  { x: -1.5, z: -2 },
  { x:  1.5, z: -2 },
  { x:  0,   z: -3.5 },
];

export function createBumpers(world: RAPIER.World) {
  return BUMPER_POSITIONS.map(({ x, z }) => {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.3, z);
    const body = world.createRigidBody(desc);
    world.createCollider(
      RAPIER.ColliderDesc.ball(0.4).setRestitution(1.5).setFriction(0),
      body,
    );
    return body;
  });
}

export function handleBumperCollision(
  world: RAPIER.World,
  ballBody: RAPIER.RigidBody,
  bumperBody: RAPIER.RigidBody,
) {
  // Impulse away from bumper center
  const ballPos = ballBody.translation();
  const bumperPos = bumperBody.translation();
  const dx = ballPos.x - bumperPos.x;
  const dz = ballPos.z - bumperPos.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  ballBody.applyImpulse({ x: (dx / len) * 5, y: 0, z: (dz / len) * 5 }, true);

  const state = stateMachine.getState();
  if (state === 'PLAYING' || state === 'MULTIBALL') {
    scoring.add(POINTS.BUMPER);
  }
}
```

- [ ] **Step 2: Add bumper meshes**

In `src/game/render/meshes.ts`, add:
```ts
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
```

- [ ] **Step 3: Add bumpers to scene**

In `GameShell.tsx`:
```ts
import { createBumpers } from '@/game/physics/bumpers';

const bumperBodies = createBumpers(world);
bumperBodies.forEach((body, i) => {
  const mesh = createBumperMesh();
  const pos = body.translation();
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);
  // Bumpers are static, no sync pair needed
});
```

- [ ] **Step 4: Wire collision detection in game loop**

In `GameLoop.ts`, add a collision event step:
```ts
// After world.step():
world.contactsWith(/* ball collider */ ...) // see Task 18 for full collision wiring
```

(Collision wiring is completed in Task 18; for now verify bumpers are visible.)

- [ ] **Step 5: Commit**

```bash
git add src/game/physics/bumpers.ts src/game/render/meshes.ts src/components/GameShell.tsx
git commit -m "feat: add bumper physics and meshes"
```

---

## Task 15: Ramps

**Files:**
- Create: `src/game/physics/ramps.ts`
- Modify: `src/game/render/meshes.ts`

- [ ] **Step 1: Write ramp physics with entrance/exit sensors**

Create `src/game/physics/ramps.ts`:
```ts
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
  { x: -2, z: -1, angle: 0.3 },  // left ramp
  { x:  2, z: -1, angle: -0.3 }, // right ramp
];

export function createRamps(world: RAPIER.World): Ramp[] {
  return RAMP_DEFS.map(({ x, z, angle }) => {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.1, z)
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
    // Exit sensor (high-Z side of ramp — note: "exit" means exiting toward upper table)
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
    // Track ramp completions on primary ball only (handled in GameShell)
    if (ballId === getPrimaryId()) {
      return true; // signal primary ramp completion
    }
  }
  return false;
}
```

- [ ] **Step 2: Add ramp meshes**

In `src/game/render/meshes.ts`, add:
```ts
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
```

- [ ] **Step 3: Add ramps to scene**

In `GameShell.tsx`:
```ts
import { createRamps } from '@/game/physics/ramps';

const ramps = createRamps(world);
ramps.forEach(({ body }) => {
  const mesh = createRampMesh();
  const pos = body.translation();
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);
});
```

- [ ] **Step 4: Commit**

```bash
git add src/game/physics/ramps.ts src/game/render/meshes.ts src/components/GameShell.tsx
git commit -m "feat: add ramp physics with entrance/exit sensors"
```

---

## Task 16: Trick Shot Hole

**Files:**
- Create: `src/game/physics/trickHole.ts`
- Modify: `src/game/render/meshes.ts`

- [ ] **Step 1: Write trick hole sensor**

Create `src/game/physics/trickHole.ts`:
```ts
import RAPIER from '@dimforge/rapier3d';
import { scoring, POINTS } from '../state/scoring';
import { stateMachine } from '../state/StateMachine';
import { Ball } from './ball';

// Positioned at table center-X, upper-third Z — away from launcher (lower-right)
const HOLE_X = 0;
const HOLE_Z = -2.5;
const EJECT_X = 0;
const EJECT_Z = -1.0; // safe eject point, center table, away from launcher zone

export function createTrickHole(world: RAPIER.World): RAPIER.Collider {
  const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(HOLE_X, 0, HOLE_Z);
  const body = world.createRigidBody(desc);
  return world.createCollider(
    RAPIER.ColliderDesc.ball(0.35).setSensor(true),
    body,
  );
}

export function handleTrickHoleTrigger(ball: Ball) {
  const state = stateMachine.getState();
  if (state !== 'PLAYING' && state !== 'MULTIBALL') return;

  // Freeze ball
  ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

  // Award points
  scoring.add(POINTS.TRICK_HOLE);

  // After animation delay, eject ball back into play
  setTimeout(() => {
    ball.body.setTranslation({ x: EJECT_X, y: 0.5, z: EJECT_Z }, true);
    // Eject in -Z direction (toward upper table, away from drain and launcher)
    ball.body.applyImpulse({ x: (Math.random() - 0.5) * 2, y: 1, z: -4 }, true);
  }, 800);
}
```

- [ ] **Step 2: Add trick hole visual**

In `src/game/render/meshes.ts`, add:
```ts
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
```

- [ ] **Step 3: Add to scene**

In `GameShell.tsx`:
```ts
import { createTrickHole } from '@/game/physics/trickHole';
import { createTrickHoleMesh } from '@/game/render/meshes';

const trickHoleSensor = createTrickHole(world);
scene.add(createTrickHoleMesh());
```

- [ ] **Step 4: Commit**

```bash
git add src/game/physics/trickHole.ts src/game/render/meshes.ts src/components/GameShell.tsx
git commit -m "feat: add trick shot hole sensor and mesh"
```

---

## Task 17: Drain Detection + Multiball Counter

**Files:**
- Modify: `src/game/physics/ball.ts`
- Modify: `src/components/GameShell.tsx`

- [ ] **Step 1: Add multiball counter logic**

Add to `src/game/physics/ball.ts`:
```ts
export let rampCount = 0;
export let multifired = false;

export function incrementRampCount() { rampCount++; }
export function resetBallState() { rampCount = 0; multifired = false; }
export function canTriggerMultiball() { return rampCount >= 3 && !multifired; }
export function setMultifired() { multifired = true; rampCount = 0; }
```

Note: simultaneous drain ordering is handled directly in GameShell (Task 17 Step 2) by sorting colliding balls by ascending ID before calling `stateMachine.ballDrained`. The `StateMachine.ballDrained` method already guards against events received while in `BALL_LOST` state (returns early), so no additional queuing is needed.

- [ ] **Step 2: Wire drain events in GameShell**

In `GameShell.tsx`, listen for drain intersections and wire to state machine:
```ts
// In the game loop's onStep callback, check sensor intersections:
world.intersectionsWith(drainBody, (collider) => {
  // Find which ball this is
  const ball = activeBalls.find(b => b.collider === collider);
  if (ball) {
    activeBalls = activeBalls.filter(b => b !== ball);
    removeBall(world, ball);
    loop.removeSyncPair(ball.body);
    scene.remove(ballMeshMap.get(ball.id)!);
    stateMachine.ballDrained(ball.id);
    promotePrimaryBall(activeBalls);
  }
});
```

- [ ] **Step 3: Verify drain removes ball and transitions state**

`npm run dev`. Launch ball, let it roll to drain end. State should transition to BALL_LOST then LAUNCHING.

- [ ] **Step 4: Commit**

```bash
git add src/game/physics/ball.ts src/components/GameShell.tsx
git commit -m "feat: add drain detection, multiball counter, and state transitions"
```

---

## Task 18: Full Collision Wiring

**Files:**
- Modify: `src/game/GameLoop.ts`
- Modify: `src/components/GameShell.tsx`

- [ ] **Step 1: Add collision event processing in game loop**

Update `src/game/GameLoop.ts` to expose the world and call collision callbacks:
```ts
// After world.step(), in GameLoop:
this.world.contactPairsWith(/* handled via eventQueue */);
// Use Rapier's EventQueue for collision events
```

Replace the world.step() call with event queue approach in GameShell:
```ts
const eventQueue = new RAPIER.EventQueue(true);

// In onStep callback:
world.step(eventQueue);
eventQueue.drainCollisionEvents((h1, h2, started) => {
  if (!started) return;
  // Check bumper collisions
  for (const bumperBody of bumperBodies) {
    const bc = bumperBody.collider(0);
    const ballHit = activeBalls.find(b => b.collider.handle === h1 || b.collider.handle === h2);
    if (ballHit && (bc.handle === h1 || bc.handle === h2)) {
      handleBumperCollision(world, ballHit.body, bumperBody);
    }
  }
});
eventQueue.drainIntersectionEvents((h1, h2, intersecting) => {
  if (!intersecting) return;
  // Drain sensor
  // Trick hole sensor
  // Ramp entrance/exit sensors
  // (handled per sensor handle lookup)
});
```

- [ ] **Step 2: Wire all sensor intersections**

In `GameShell.tsx`, store sensor collider handles at creation time, then match in the intersection drain loop. Example pattern — apply to drain, trick hole, and each ramp entrance/exit:

```ts
// Store handles when sensors are created:
const drainHandle = drainBody.collider(0).handle;
const trickHoleHandle = trickHoleSensor.handle;
const rampHandles = ramps.map(r => ({
  entrance: r.entranceSensor.handle,
  exit: r.exitSensor.handle,
  ramp: r,
}));

// In the intersection event drain:
eventQueue.drainIntersectionEvents((h1, h2, intersecting) => {
  if (!intersecting) return;
  const handles = [h1, h2];

  // Drain sensor
  if (handles.includes(drainHandle)) {
    const ballHandle = handles.find(h => h !== drainHandle)!;
    // Sort by ball ID ascending before processing (handles simultaneous drains)
    const hitBalls = activeBalls
      .filter(b => b.collider.handle === ballHandle)
      .sort((a, b) => a.id - b.id);
    hitBalls.forEach(ball => {
      activeBalls = activeBalls.filter(b => b !== ball);
      removeBall(world, ball);
      loop.removeSyncPair(ball.body);
      scene.remove(ballMeshMap.get(ball.id)!);
      ballMeshMap.delete(ball.id);
      promotePrimaryBall(activeBalls);
      stateMachine.ballDrained(ball.id); // state machine guards BALL_LOST re-entry
    });
  }

  // Trick hole
  if (handles.includes(trickHoleHandle)) {
    const ball = activeBalls.find(b => handles.includes(b.collider.handle));
    if (ball) handleTrickHoleTrigger(ball);
  }

  // Ramp entrance/exit
  for (const { entrance, exit, ramp } of rampHandles) {
    const ball = activeBalls.find(b => handles.includes(b.collider.handle));
    if (!ball) continue;
    if (handles.includes(entrance)) handleRampEntrance(ramp, ball.id);
    if (handles.includes(exit)) {
      const isPrimaryCompletion = handleRampExit(ramp, ball.id, getPrimaryBallId);
      if (isPrimaryCompletion) {
        incrementRampCount();
        if (canTriggerMultiball()) { /* handled in Task 22 */ }
      }
    }
  }
});
```

- [ ] **Step 3: Test bumper scoring**

`npm run dev`. Launch ball into bumpers. Score should increment by 100 each hit.

- [ ] **Step 4: Commit**

```bash
git add src/game/GameLoop.ts src/components/GameShell.tsx
git commit -m "feat: wire all collision and sensor events via Rapier EventQueue"
```

---

## Task 19: HUD Component

**Files:**
- Create: `src/components/HUD.tsx`
- Modify: `src/components/GameShell.tsx`

- [ ] **Step 1: Write HUD component**

Create `src/components/HUD.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { gameStore, GameState } from '@/game/gameStore';

interface HUDState {
  score: number;
  highScore: number;
  ballsRemaining: number;
  gameState: GameState;
  isMultiball: boolean;
  charge: number;
}

export default function HUD() {
  const [hud, setHUD] = useState<HUDState>({
    score: 0, highScore: 0, ballsRemaining: 3,
    gameState: 'IDLE', isMultiball: false, charge: 0,
  });

  useEffect(() => {
    const unsubs = [
      gameStore.on('scoreChange', ({ score, highScore }) =>
        setHUD(h => ({ ...h, score, highScore }))),
      gameStore.on('stateChange', ({ state }) =>
        setHUD(h => ({ ...h, gameState: state }))),
      gameStore.on('ballChange', ({ ballsRemaining }) =>
        setHUD(h => ({ ...h, ballsRemaining }))),
      gameStore.on('multiBallStart', () =>
        setHUD(h => ({ ...h, isMultiball: true }))),
      gameStore.on('multiBallEnd', () =>
        setHUD(h => ({ ...h, isMultiball: false }))),
      gameStore.on('chargeChange', ({ charge }) =>
        setHUD(h => ({ ...h, charge: Math.abs(charge) }))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none', fontFamily: 'monospace', color: '#fff',
    }}>
      {hud.gameState === 'IDLE' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <h1 style={{ fontSize: '3rem', color: '#88aaff', textShadow: '0 0 20px #4466ff' }}>SPACE PINBALL</h1>
          <p style={{ color: '#aaa' }}>Press SPACE or ENTER to start</p>
          {hud.highScore > 0 && <p>High Score: {hud.highScore.toLocaleString()}</p>}
        </div>
      )}

      {hud.gameState === 'GAME_OVER' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <h2 style={{ fontSize: '2rem', color: '#ff4444' }}>GAME OVER</h2>
          <p>Score: {hud.score.toLocaleString()}</p>
          <p>High Score: {hud.highScore.toLocaleString()}</p>
          <p style={{ color: '#aaa' }}>Press SPACE to play again</p>
        </div>
      )}

      <div style={{ position: 'absolute', top: '1rem', left: '1rem' }}>
        <div style={{ fontSize: '1.5rem' }}>{hud.score.toLocaleString()}</div>
        <div style={{ fontSize: '0.8rem', color: '#888' }}>HI {hud.highScore.toLocaleString()}</div>
      </div>

      <div style={{ position: 'absolute', top: '1rem', right: '1rem', textAlign: 'right' }}>
        {'● '.repeat(hud.ballsRemaining).trim()}
        {hud.isMultiball && <div style={{ color: '#ffaa00', fontSize: '0.8rem' }}>MULTIBALL 2×</div>}
      </div>

      {hud.gameState === 'LAUNCHING' && (
        <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#888' }}>Hold SPACE to charge</p>
          <div style={{ width: '120px', height: '10px', background: '#333', borderRadius: '5px' }}>
            <div style={{ width: `${hud.charge * 100}%`, height: '100%', background: '#4488ff', borderRadius: '5px', transition: 'width 0.05s' }} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add HUD to GameShell**

In `GameShell.tsx`:
```tsx
import HUD from './HUD';

// In JSX return:
return (
  <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
    <canvas id="game-canvas" style={{ display: 'block', width: '100%', height: '100%' }} />
    <HUD />
  </div>
);
```

- [ ] **Step 3: Verify HUD renders and responds to game events**

`npm run dev`. Title screen should show. Start game — score/ball count should update.

- [ ] **Step 4: Commit**

```bash
git add src/components/HUD.tsx src/components/GameShell.tsx
git commit -m "feat: add React HUD overlay"
```

---

## Task 20: Starfield + Post-Processing

**Files:**
- Create: `src/game/render/starfield.ts`
- Create: `src/game/render/postprocessing.ts`
- Modify: `src/game/render/scene.ts`

- [ ] **Step 1: Create starfield particle system**

Create `src/game/render/starfield.ts`:
```ts
import * as THREE from 'three';

export function createStarfield(scene: THREE.Scene) {
  const count = 3000;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 100;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 });
  scene.add(new THREE.Points(geo, mat));
}
```

- [ ] **Step 2: Create bloom post-processing**

Create `src/game/render/postprocessing.ts`:
```ts
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): { composer: EffectComposer; render: () => void } {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,  // strength
    0.4,  // radius
    0.2,  // threshold
  );
  composer.addPass(bloom);
  return { composer, render: () => composer.render() };
}
```

- [ ] **Step 3: Replace raw renderer.render() with composer**

In `GameLoop.ts`, allow passing a custom render function:
```ts
constructor(
  private world: RAPIER.World,
  private ctx: RenderContext,
  private onStep?: () => void,
  private renderFn?: () => void,
) {}
// In loop: (this.renderFn ?? () => this.ctx.renderer.render(this.ctx.scene, this.ctx.camera))();
```

In `GameShell.tsx`:
```ts
const { render: bloomRender } = createPostProcessing(renderer, scene, camera);
const loop = new GameLoop(world, { scene, camera, renderer }, onStep, bloomRender);
```

- [ ] **Step 4: Add starfield to scene**

```ts
import { createStarfield } from '@/game/render/starfield';
createStarfield(scene);
```

- [ ] **Step 5: Verify bloom glow on emissive objects**

`npm run dev`. Bumpers, ball, ramps should have a visible glow halo. Stars should be visible in the background.

- [ ] **Step 6: Commit**

```bash
git add src/game/render/starfield.ts src/game/render/postprocessing.ts src/game/render/scene.ts src/game/GameLoop.ts src/components/GameShell.tsx
git commit -m "feat: add starfield particle system and UnrealBloom post-processing"
```

---

## Task 21: Hit Effects (Particles + Camera Shake)

**Files:**
- Create: `src/game/render/effects.ts`

- [ ] **Step 1: Write effects module**

Create `src/game/render/effects.ts`:
```ts
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
```

- [ ] **Step 2: Wire effects to bumper and trick hole events**

In `GameShell.tsx`, create effects instance and call in bumper collision and trick hole callbacks.

- [ ] **Step 3: Call effects.tick() each frame**

In `GameLoop.ts` onStep, call `effects.tick()`.

- [ ] **Step 4: Verify particle burst on bumper hit**

`npm run dev`. Hit a bumper — should see particle burst and slight camera shake.

- [ ] **Step 5: Commit**

```bash
git add src/game/render/effects.ts src/components/GameShell.tsx src/game/GameLoop.ts
git commit -m "feat: add bumper/trick-hole particle effects and camera shake"
```

---

## Task 22: Multiball

**Files:**
- Modify: `src/components/GameShell.tsx`
- Modify: `src/game/physics/ball.ts`

- [ ] **Step 1: Wire multiball spawn in GameShell**

In the ramp completion handler in `GameShell.tsx`:
```ts
if (primaryRampCompletion && canTriggerMultiball()) {
  setMultifired();
  stateMachine.multiBallStart();
  scoring.setMultiplier(2);

  // Spawn bonus ball at table center upper third
  const bonusBall = spawnBall(world, 0, 0.5, -1.0);
  const bonusMesh = createBallMesh();
  scene.add(bonusMesh);
  activeBalls.push(bonusBall);
  ballMeshMap.set(bonusBall.id, bonusMesh);
  loop.addSyncPair({ body: bonusBall.body, mesh: bonusMesh });
  // Eject toward upper table (-Z)
  bonusBall.body.applyImpulse({ x: (Math.random() - 0.5) * 2, y: 1, z: -5 }, true);
}
```

- [ ] **Step 2: Reset multiplier on multiball end**

In `GameShell.tsx`, listen for multiBallEnd:
```ts
gameStore.on('multiBallEnd', () => scoring.setMultiplier(1));
```

- [ ] **Step 3: Verify multiball triggers after 3 ramp completions**

`npm run dev`. Complete a ramp 3 times — a second ball should appear and score should show 2×.

- [ ] **Step 4: Commit**

```bash
git add src/components/GameShell.tsx src/game/physics/ball.ts
git commit -m "feat: implement multiball spawn and 2x score multiplier"
```

---

## Task 23: Game Reset + Full Flow Polish

**Files:**
- Modify: `src/components/GameShell.tsx`
- Modify: `src/game/state/StateMachine.ts`

- [ ] **Step 1: Wire game over restart**

In `InputHandler.ts`, add restart on Space/Enter from GAME_OVER:
```ts
if ((e.code === 'Space' || e.code === 'Enter') && state === 'GAME_OVER') {
  e.preventDefault();
  scoring.reset();
  resetBallState();
  stateMachine.reset();
  return;
}
```

- [ ] **Step 2: Clean up balls and ball state on BALL_LOST**

In `GameShell.tsx`, listen for stateChange to BALL_LOST:
```ts
gameStore.on('stateChange', ({ state }) => {
  if (state === 'BALL_LOST' || state === 'GAME_OVER') {
    // Remove all balls from scene and physics
    activeBalls.forEach(b => {
      removeBall(world, b);
      loop.removeSyncPair(b.body);
      scene.remove(ballMeshMap.get(b.id)!);
    });
    activeBalls = [];
    ballMeshMap.clear();
    scoring.setMultiplier(1);
    resetBallState();
  }
  if (state === 'LAUNCHING') {
    // Spawn new ball in launcher
    currentBall = launcher.spawnBallInLauncher();
    const mesh = createBallMesh();
    scene.add(mesh);
    activeBalls = [currentBall];
    ballMeshMap.set(currentBall.id, mesh);
    loop.addSyncPair({ body: currentBall.body, mesh });
  }
});
```

- [ ] **Step 3: Full end-to-end test**

`npm run dev`. Play through a full game:
- Title screen → start → launch ball → hit bumpers → complete ramps → trigger multiball → drain all balls → game over → restart

- [ ] **Step 4: Commit**

```bash
git add src/components/GameShell.tsx src/game/state/StateMachine.ts src/game/input/InputHandler.ts
git commit -m "feat: wire full game flow — restart, ball cleanup, state reset"
```

---

## Task 24: Final Build Verification

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: builds with no errors. Warnings about bundle size are acceptable.

- [ ] **Step 2: Run built output**

```bash
npm start
```

Open browser. Play through the full game flow. Verify: loading screen, title screen, launcher charge, ball physics, bumper scoring, ramp scoring, trick hole, multiball, HUD updates, game over, high score persistence.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete space pinball game - all systems integrated"
```
