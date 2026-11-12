import type { GameContext } from './GameContext';

/**
 * A feature module. One per `src/<feature>/index.ts`, registered in `src/modules.ts`.
 *
 * Lifecycle (all optional except `id`):
 *  - `init(ctx)`        once at boot, in registry order; may be async. Build static content here.
 *                       After ALL modules are initialised the `world:ready` event fires.
 *  - `fixedUpdate(dt)`  fixed 60 Hz step, only while the game state is 'playing'. Runs BEFORE the
 *                       physics step of the same tick. Gameplay logic, AI, timers, movement.
 *  - `update(dt, a)`    once per rendered frame while 'playing', before render. Visuals, camera,
 *                       input edges (`wasPressed`), interpolation with alpha `a`.
 *  - `dispose()`        teardown: release everything (ResourceTracker scope, listeners, DOM).
 *
 * State changes (pause, game over, respawn...) arrive as events; subscribe in `init`.
 */
export interface GameModule {
  readonly id: string;
  init?(ctx: GameContext): void | Promise<void>;
  fixedUpdate?(dt: number): void;
  update?(dt: number, alpha: number): void;
  dispose?(): void;
}
