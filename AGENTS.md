# AGENTS.md

## Overview

"Upstream" is a **Three.js endless-runner browser game** (a cube sliding down a
procedurally generated river at night) with an embedded **YouTube playlist radio
HUD** (`.hud` element, styled by `public/radio.css`). Vanilla ES modules, no
framework, no TypeScript, no tests. Deployed to Vercel (`.vercel` in
`.gitignore`); remote is `git@github.com:inversepolarity/Upstream.git`.

Entry point is `index.html` → `src/imports.js`, which side-effect-imports every
game module (modules register their own window listeners / side effects), then
calls `init()` and `animate()` from `engine.js`.

## Commands (pnpm — lockfile is `pnpm-lock.yaml`)

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server with `--host` |
| `pnpm build` | Vite production build to `dist/` |
| `pnpm preview` | Preview the built bundle |
| `pnpm lint` | ESLint (flat config) |
| `pnpm lint:fix` | ESLint with autofix (`npx eslint . --fix --format=stylish`) |
| `pnpm format` | `prettier --write .` (entire repo) |

The husky pre-commit hook runs `pnpm format && pnpm lint`, so anything you
commit must be prettier-clean and lint-clean. Formatting rules: semicolons,
single quotes, es5 trailing commas, printWidth 100, 2-space tabs.

Lint notes: `no-unused-vars` is off; `unused-imports` plugin is the enforcer
(`vars`/`args` ignore pattern `^_`). GLSL files are imported via
`vite-plugin-glsl` and are **not** linted/formatted.

## Architecture & control flow

- **Single mutable global state**: everything lives on the `state` object in
  `src/state.js` (scene, camera, player, river, obstacles, flags...). Modules
  mutate it directly; there is no event bus or component class hierarchy.
- **Game loop**: `engine.js` `animate()` runs via `requestAnimationFrame`;
  per-frame it extends/prunes the river, moves the player, spawns/updates
  obstacles and gaps, resolves falls and collisions, lerps the camera, updates
  the starfield + river shader uniforms, and renders. Score = `playerDistance * 0.1`.
- **River**: procedural. `river.js` generates Catmull-Rom control points with
  self-intersection avoidance (`addControlPoint`), variable widths per point
  (0.2x–3x base), and rebuilds the river mesh (`createRiverMesh`) whenever
  control points are added/pruned or gaps spawn/despawn. All gameplay positions
  (player, obstacles, train cubes) are derived from the spline via
  `getRiverInfoByDistance` / `getRiverPositionWithCurve` (which adds the
  parabolic bank-curve to `position.y`).
- **Game flow / flags** (`rpo` is the "ready to play on" gate):
  1. Load: `gameOver=true`, `rpo=false` → title overlay (`newGameDisplay`).
  2. Press **Space**: `rpo=true`, game starts (`hideNewGameOverlay`).
  3. Holding **Space** = hyperdrive (train-cube mode, speed ×8); releasing
     reverts. **S/Down** slows to ×0.5.
  4. **W/Up** = jump (only when `!isJumping && !gameOver`).
  5. On death (`gameOver=true`): `gameOverDisplay()`; any key triggers a full
     restart: `input.js` disposes every mesh/material and calls `init()`.
  6. Restart caveat: when `gameOver && rpo`, the **keyup** of the restart key
     sets `rpo=false` and calls `init()` again — the restart effectively happens
     on keyup, and pressing a key while the overlay is up also triggers `init()`
     via the keydown handler. Expect `init()` to run twice per restart cycle.
- **Rendering**: main scene rendered with `autoClear=true`, then HUD
  (`state.hudScene`/`hudCamera`, orthographic) rendered on top with
  `autoClear=false`, then `autoClear` restored. HUD score is a canvas texture
  fed to a "liquid metal" vapourwave shader (`src/shaders/ui/`).

## Module map

| File | Responsibility |
|---|---|
| `src/imports.js` | Side-effect imports + bootstraps `init()`/`animate()` |
| `src/constants.js` | All tuning numbers in one multi-export statement (river width, speeds, jump, starfield, colors) |
| `src/state.js` | Global mutable state singleton + `resetState()` |
| `src/engine.js` | Game loop, movement, collisions, fall "dramatic physics" (3-phase), camera, hyperdrive, score |
| `src/river.js` | Spline generation, width variation, gaps, river mesh + edge meshes, position helpers |
| `src/player.js` | Hyperdrive train cubes (5 trailing cubes, superpos shader on the last) |
| `src/enemies.js` | Obstacle spawning (box/sphere/cone/cylinder, emissive colors) |
| `src/backdrop.js` | Starfield (Points) that follows/rotates with player |
| `src/hud.js` | Score display (canvas-texture shader plane), game-over / title overlays |
| `src/input.js` | Keyboard + resize listeners, start/restart flow, hyperdrive toggle |
| `src/radio.js` | YouTube IFrame API radio player + HUD controls + focus management |
| `src/shaders/**` | GLSL imported as strings; player (default/superpos), river, ui |

## Gotchas & non-obvious patterns

- **`state.riverWidths` is pushed twice per control point** in both
  `generateInitialRiver` and `extendRiverIfNeeded` (raw + smoothed). It's
  inconsistent between the two functions and out of sync with
  `riverControlPoints`; `getWidthAt` indexes it as if 1:1. Width tuning is
  fragile — change carefully.
- **`curveDepth` (2.5) is duplicated** in `river.js` (`createRiverMesh` +
  `getRiverCurveHeight`) and `enemies.js` (`spawnObstacle`, with a comment
  saying "Match the curveDepth from river.js"). Keeping them in sync is manual.
- **`init()` recreates the world**: removes the renderer DOM node (then
  re-appends it), rebuilds scene/camera/player/train/starfield, calls
  `resetState()`. Any state not covered by `resetState()` must be handled in
  `init()`. Some stale fields (e.g. `hudScene`, `hudCamera`, `scoreCanvas`) are
  cleaned up ad hoc; watch for leaks when adding new scene objects.
- **Collisions / death use magic thresholds**: `buffer = 0.94`, obstacle
  collision box is `dDist < PLAYER_SIZE*2` and `offsetDist < size + PLAYER_SIZE/2`,
  `maxSafeOffset` gets a "curvePenalty" past `normalizedOffset > 0.7`. Death only
  counts when `state.rpo` is true.
- **Player Y alignment**: player/train/obstacles sit on the curved river bed;
  the player adds `PLAYER_SIZE/2`, obstacles `size/2 + 0.3` on top of the curve
  height. `state.player.position.y` is overwritten every frame by river math —
  jump height is added on top of that in `animate()`.
- **Camera/hud resize**: resize handler re-derives HUD ortho extents from a
  fixed 16:9 height of 5.625 and repositions the score mesh to
  `(-width+4, height-1, 0)`. If you add HUD elements, mirror this logic.
- **Score formatting**: `updateScoreDisplay` renders the score with
  `toFixed(10)` into a 512×128 canvas; `updateScore` uses a smoothed
  velocity-based approach with `smallestUnit = 1e-10`. `initScoreState` is
  exported from both `state.js` and `hud.js` (hud's version is the one that
  runs; the state.js copy appears dead).
- **`radio.js` specifics**: YouTube IFrame API loaded from a `<script>` tag in
  `index.html`; playlist ID is hardcoded (`PLWT9NvDdpWqyoeoRhBsnva0EBG_JHmk9R`);
  starts muted at 50% volume. The `.hud` swallows keydowns and aggressively
  refocuses the canvas after pointer/keyboard interaction so game keys keep
  working — don't remove that focus management, gameplay input depends on it.
- **`input.js` only listens to keyboard** — the overlays advertise "LONG TAP TO
  START" but there are no pointer/touch handlers anywhere; on touch devices the
  game is effectively unstartable. Known gap, not wired up.
- **Leftover debug**: `console.log('reset state')` in `state.js`; commented-out
  `document.getElementById('gameover')...` lines scattered in `engine.js`.
- **Muted-by-default audio, `alert()` fallback** in `radio.js` on playlist load
  failure.
- The `constants.js` file uses a single `export const A = x, B = y, ...`
  statement — keep that style when adding constants.

## Naming / style conventions

- camelCase variables/functions; exports grouped per file; `createX` /
  `updateX` / `spawnX` / `getX` prefixes. File names are single words.
- `let` is preferred over `const` inside game code (heavy mutation of the shared
  state object); `*=`/`++` mutation style throughout.
- No framework, no classes for game entities — plain objects (`userData` on
  meshes holds distance/speed/fall state), arrays in `state` hold live entities
  that are spliced/removed in reverse order while iterating.
- Shaders are imported as default string imports (`import x from './x.glsl'`).
