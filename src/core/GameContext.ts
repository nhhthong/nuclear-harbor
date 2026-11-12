import type { PerspectiveCamera, Scene } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import type { TUNABLES } from '@/config/tunables';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import type { EventBus } from './EventBus';
import type { GameEvents } from './events';
import type { GameStateMachine } from './GameState';
import type { InputManager } from './InputManager';
import type { PlayerState } from './PlayerState';
import type { EnemyRegistry, GrappleAnchorRegistry } from './registries';
import type { Renderer } from './Renderer';
import type { Settings } from './Settings';

export interface GameFlags {
  /** `?sandbox`: build the small foundation test scene instead of the harbor (see docs/PLAN.md). */
  readonly sandbox: boolean;
  /** `?autostart`: skip the menu and go straight to 'playing' (dev, smoke tests). */
  readonly autostart: boolean;
  /** `?debug`: debug overlays on from the start. */
  readonly debug: boolean;
  /** Raw query parameters for module-specific switches (e.g. `?boss` to jump to the boss fight). */
  readonly params: URLSearchParams;
}

export interface GameClock {
  /** Simulated seconds since the run started (only advances in 'playing'). */
  readonly simTime: number;
  readonly fixedDt: number;
  readonly frame: number;
  readonly fixedTick: number;
}

/**
 * Everything a module may touch. Passed to `GameModule.init`; keep the reference.
 * Modules communicate ONLY through this object (events, registries, player state), never by
 * importing each other.
 */
export interface GameContext {
  readonly scene: Scene;
  /** Main FPS camera. Posed by the player module; children (view model) may be attached to it. */
  readonly camera: PerspectiveCamera;
  readonly renderer: Renderer;
  readonly canvas: HTMLCanvasElement;
  /** Root element for DOM UI (HUD, menus, debug overlays). */
  readonly uiRoot: HTMLElement;
  readonly physics: PhysicsWorld;
  readonly input: InputManager;
  readonly events: EventBus<GameEvents>;
  readonly settings: Settings;
  readonly state: GameStateMachine;
  readonly player: PlayerState;
  readonly enemies: EnemyRegistry;
  readonly grappleAnchors: GrappleAnchorRegistry;
  /** Root resource tracker; use `ctx.resources.scope('<module id>')`. */
  readonly resources: ResourceTracker;
  readonly tunables: typeof TUNABLES;
  readonly flags: GameFlags;
  readonly clock: GameClock;
  /**
   * Read-only inspection hooks for browser tests and the debug overlay, keyed by module id
   * (e.g. `ctx.testHooks.weapon = { getAmmo: () => ... }`). Each module writes only its own key.
   * Gameplay code MUST NOT read another module's hooks: use events and registries instead.
   */
  readonly testHooks: Record<string, unknown>;
}
