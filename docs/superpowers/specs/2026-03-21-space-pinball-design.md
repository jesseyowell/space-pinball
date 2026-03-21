# Space Pinball — Design Spec

**Date:** 2026-03-21
**Stack:** Next.js, Three.js, Rapier (WASM physics)
**Theme:** Space / sci-fi

---

## Overview

A space-themed 3D pinball game built as a Next.js web app. Three.js handles WebGL rendering; Rapier provides realistic physics simulation. React is used only for the HUD and UI overlays — the game loop runs entirely outside React's render cycle.

**Scope note:** Keyboard-only controls. Mobile/touch support is explicitly out of scope for v1.

---

## Architecture

```
Next.js App
├── Loading screen   → Rapier WASM init (async, before any game state)
├── React layer      → HUD, score display, start/game-over screens
├── Game canvas      → Three.js WebGL renderer (full-screen canvas)
├── Physics world    → Rapier WASM simulation
└── Game loop        → rAF loop: physics step → sync positions → render
```

- Rapier WASM is initialized asynchronously during a loading screen shown before the `IDLE` state. Initialization is triggered client-side via a `useEffect` in the root Client Component: `import init from '@dimforge/rapier3d'; useEffect(() => { init().then(() => setReady(true)) }, [])`. A loading gate (`if (!ready) return <LoadingScreen />`) prevents the canvas from mounting until the physics world is available.
- Rapier rigid bodies are the source of truth for all object positions.
- Three.js meshes follow physics bodies each frame.
- A plain JS `gameStore` (event emitter) bridges game state to the React HUD — no useState during active gameplay to avoid re-renders.

---

## Physics Setup

**Coordinate system:** Y-axis is the table normal (pointing away from the table surface, perpendicular to the playfield). Z-axis is the drain direction (positive Z = toward drain). X-axis is left-right across the table.

The table is a flat XZ-plane collider with a Y-up surface normal. Gravity is rotated to simulate the ~6.5° physical tilt without tilting the collider geometry:

```
gravity = [0, -9.81 * cos(6.5°), 9.81 * sin(6.5°)]
        ≈ [0, -9.76, 1.11]
```

The Y component holds the ball against the table surface; the +Z component rolls the ball toward the drain. All game object colliders are placed on the XZ plane. The camera is angled (top-down with slight Z offset) to show the full playfield as a player would view it.

---

## Game Components

### Table
- Static rigid body: flat XZ-plane surface + four walls + drain zone sensor.
- Drain zone is a sensor strip at the high-Z end of the table; triggering it fires `BALL_DRAINED`.
- Dark metallic surface with subtle space-grid texture.

### Flippers
- Two motorized rigid bodies (left/right) driven by Rapier revolute joints with motor torque.
- Controls: `←` / `→` arrow keys or `Z` / `/`.
- Styled as sleek chrome paddles with blue edge glow.

### Ball
- Dynamic sphere rigid body with high restitution (bounciness) and low friction.
- Emissive white/blue material with short motion blur trail.
- Each ball is assigned an incrementing integer ID at spawn time (0, 1, 2…). This ID is stored on the ball object and used for ramp entrance/exit pairing and multiball drain tracking.
- **Primary ball:** defined as the ball with the lowest currently-active ID. At game start, ball 0 is primary. If the primary ball drains during MULTIBALL, the remaining ball (next-lowest active ID) becomes primary.
- **Simultaneous drain handling:** if two balls drain in the same physics step, `BALL_DRAINED` events are queued and processed sequentially in ascending ball ID order. Each event is fully resolved (state updated, primary promoted if needed) before the next is processed. A `BALL_DRAINED` event received while already in `BALL_LOST` state is silently discarded.
- Multiball: spawns one additional ball instance with identical physics properties.

### Bumpers
- Static circular colliders styled as planets or asteroids.
- Collision event listener applies an impulse to the ball on contact.
- On hit: particle spark burst + point light pulse + score award.

### Ramps
- Angled static mesh colliders forming two tunnels on the playfield.
- Styled as neon warp tunnels with flowing inner glow.
- Two sensors per ramp: entrance (low-Z side) and exit (high-Z side).
- **Ramp completion:** a completion is recorded when the same ball (by ball ID) triggers a ramp's entrance sensor and then its exit sensor within 5 seconds. Each ball maintains its own per-ramp entrance timestamp independently — a different ball triggering the exit does not count. Awards points on completion. If the 5-second window expires without the exit being triggered, the attempt is discarded silently.

### Trick Shot Hole
- Small circular opening on the playfield, styled as a black hole / wormhole with a swirling vortex shader effect.
- Implemented as a Rapier sensor (overlap trigger, not a collision body).
- Positioned at the center of the table in X, in the upper third in Z — spatially separated from the launcher (lower-right, far from table center) to avoid sensor overlap.
- On trigger: ball velocity set to zero → "sucked in" scale-down animation → points awarded (base × multiplier) → ball teleported to a fixed safe eject point at table center and given an impulse in the −Z direction (toward the drain side, into active play). The eject point and impulse are chosen so the ball re-enters play away from the launcher sensor zone.

### Launcher
- Rapier prismatic joint in the lower-right gutter (low-X, high-Z corner); joint body is kinematically driven.
- Active only in `LAUNCHING` state. `Space` keypresses are ignored in all other states.
- Hold `Space` to charge; charge accumulates linearly over 2 seconds and does not increase further.
- Release `Space` to fire: impulse magnitude scales linearly from a defined minimum to maximum based on hold duration.
- A sensor just above the launcher detects when the ball has left; on trigger it resets the prismatic joint to resting position.

### HUD (React overlay)
- Current score
- High score (persisted to `localStorage`)
- Ball number (out of 3)
- Multiball indicator
- Launch charge indicator (visible only in `LAUNCHING` state)
- Subscribes to `gameStore` events — updates independently of render loop.

---

## Visuals & Post-Processing

Post-processing uses vanilla Three.js `EffectComposer` (`three/examples/jsm/postprocessing`) — not `@react-three/postprocessing`, which requires React Three Fiber.

- **Starfield** — particle system (thousands of drifting points) + distant nebula skydome texture.
- **Bloom** — `UnrealBloomPass` on all emissive surfaces.
- **Bumper hit** — burst of particles + pulsing point light.
- **Trick shot hole** — swirling vortex shader, camera shake + flash on trigger.
- **Camera** — fixed perspective above and behind the table showing full playfield; slight shake on high-value hits.
- **Lighting** — ambient base light + per-bumper point lights that pulse on contact.

---

## Scoring

All point values are multiplied by the current score multiplier (1× normally, 2× during MULTIBALL). The multiplier applies to every scoring event.

| Element            | Base Points | With 2× Multiball |
|--------------------|-------------|-------------------|
| Bumper hit         | 100         | 200               |
| Ramp completed     | 500         | 1,000             |
| Trick shot hole    | 1,000       | 2,000             |
| Drain              | —           | —                 |

**High score** is written to `localStorage` on every scoring event where the running score exceeds the stored value, ensuring it is preserved if the browser is closed mid-game.

---

## Game States

```
                                [ramp_count>=3 && !multifired]   [active_balls<2]
                     ┌──────────────────────────────────────┐  ┌────────────────┐
                     ▼                                      │  ▼                │
IDLE ──[Space/Enter]──→ LAUNCHING → PLAYING ─────────────→ MULTIBALL ──────────┘
                                      │                          │
                                      │                [last ball drains]
                                      └──────────────────────────→ BALL_LOST
                                                                        │
                                                               (balls remaining?)
                                                              yes ↓         ↓ no
                                                           LAUNCHING    GAME_OVER
```

| State      | Description |
|------------|-------------|
| IDLE       | Title screen, awaiting player input |
| LAUNCHING  | Ball in launcher, player charging shot |
| PLAYING    | Normal single-ball gameplay |
| MULTIBALL  | 2+ balls active, 2× score multiplier |
| BALL_LOST  | 1.5s pause, resets per-ball state, determines next state |
| GAME_OVER  | Final score displayed, high score saved |

**IDLE → LAUNCHING:** `Space` or `Enter` starts the game. The keydown event that triggers this transition is consumed and does NOT begin launcher charging. Charge accumulates only from a fresh keydown fired while already in `LAUNCHING` state.

**Multiball trigger condition:** `ramp_count >= 3 && multifired == false`. When true, transitions to `MULTIBALL`: bonus ball spawned at table center (X=0, Z=middle of playfield) and auto-ejected with a fixed impulse in the −Z direction (toward the upper playfield area, away from the drain). The ramp counter resets to 0 and `multifired` is set to `true`.

**MULTIBALL → PLAYING:** when active ball count drops to 1 (bonus ball drains). Multiplier resets to 1×. Ramp counter is NOT reset here (it was already reset to 0 when multiball triggered; there is no accumulated value to clear).

**Ball pool accounting:** Bonus ball does not consume from the 3-ball allotment. The allotment decrements only on `BALL_LOST`.

**BALL_LOST (1.5s pause):** All Rapier body velocities zeroed. Ramp counter reset to 0. `multifired` flag reset to `false`. Multiplier reset to 1×. After 1.5s → `LAUNCHING` (if balls remain) or `GAME_OVER`.

**3 balls per game.**

---

## Controls

| Key | Action |
|-----|--------|
| `Space` or `Enter` | Start game (IDLE only; event consumed on transition) |
| `←` or `Z` | Left flipper |
| `→` or `/` | Right flipper |
| `Space` (hold/release) | Charge and launch ball (LAUNCHING state only) |

---

## Tech Stack

| Concern | Library |
|---------|---------|
| App framework | Next.js (App Router) |
| 3D rendering | Three.js |
| Physics | Rapier (`@dimforge/rapier3d`) |
| Post-processing | Three.js `EffectComposer` (`three/examples/jsm/postprocessing`) |
| State | Plain JS event emitter (`gameStore`) |
| Persistence | `localStorage` (high score) |
