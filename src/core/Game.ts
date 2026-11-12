import { Fog, Scene } from 'three';
import { ResourceTracker } from '@/assets/ResourceTracker';
import { TUNABLES } from '@/config/tunables';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { EventBus } from './EventBus';
import type { GameEvents } from './events';
import type { GameClock, GameContext, GameFlags } from './GameContext';
import { GameLoop } from './GameLoop';
import type { GameModule } from './GameModule';
import { GameStateMachine } from './GameState';
import { InputManager } from './InputManager';
import { minFrameIntervalMs } from './quality';
import { PlayerState } from './PlayerState';
import { EnemyRegistry, GrappleAnchorRegistry } from './registries';
import { Renderer } from './Renderer';
import { Settings, safeLocalStorage } from './Settings';

export interface GameOptions {
  canvas: HTMLCanvasElement;
  uiRoot: HTMLElement;
  modules: readonly GameModule[];
  /** Defaults to `window.location.search`. */
  search?: string;
}

export function parseFlags(search: string): GameFlags {
  const params = new URLSearchParams(search);
  const on = (name: string): boolean => params.has(name) && params.get(name) !== '0' && params.get(name) !== 'false';
  return { sandbox: on('sandbox'), autostart: on('autostart'), debug: on('debug'), params };
}

/**
 * Bootstrap and frame orchestration. Owns the context, the module list and the loop; contains no
 * gameplay. Order of a fixed tick: every module.fixedUpdate (registry order) -> physics.step.
 */
export class Game {
  readonly ctx: GameContext;
  readonly loop: GameLoop;
  private readonly modules: readonly GameModule[];
  private readonly initialised: GameModule[] = [];
  private offHandlers: Array<() => void> = [];

  private constructor(ctx: GameContext, modules: readonly GameModule[], clock: MutableClock) {
    this.ctx = ctx;
    this.modules = modules;
    this.loop = new GameLoop({
      fixedUpdate: (dt) => {
        for (const m of this.initialised) m.fixedUpdate?.(dt);
        ctx.physics.step(dt);
        clock.simTime = this.loop.simTime + dt;
        clock.fixedTick++;
      },
      update: (dt, alpha) => {
        for (const m of this.initialised) m.update?.(dt, alpha);
      },
      render: () => ctx.renderer.render(ctx.scene),
      endFrame: () => {
        ctx.input.endFrame();
        clock.frame++;
      },
    });
    clock.fixedDt = this.loop.fixedDt;
  }

  static async create(options: GameOptions): Promise<Game> {
    const flags = parseFlags(options.search ?? window.location.search);
    const events = new EventBus<GameEvents>();
    const settings = new Settings(events, safeLocalStorage());
    const renderer = new Renderer(options.canvas);
    renderer.applyQuality(settings.get('quality'));
    const physics = await PhysicsWorld.create();
    const input = new InputManager(events, settings.get('bindings'));
    input.attach(options.canvas);
    const scene = new Scene();
    scene.add(renderer.camera);
    const clock: MutableClock = { simTime: 0, fixedDt: 1 / TUNABLES.SIM.fixedHz, frame: 0, fixedTick: 0 };

    const ctx: GameContext = {
      scene,
      camera: renderer.camera,
      renderer,
      canvas: options.canvas,
      uiRoot: options.uiRoot,
      physics,
      input,
      events,
      settings,
      state: new GameStateMachine(events),
      player: new PlayerState(events),
      enemies: new EnemyRegistry(),
      grappleAnchors: new GrappleAnchorRegistry(),
      resources: new ResourceTracker('root'),
      tunables: TUNABLES,
      flags,
      clock,
      testHooks: {},
    };

    const game = new Game(ctx, options.modules, clock);
    await game.init();
    return game;
  }

  private async init(): Promise<void> {
    const { ctx } = this;
    this.wireCoreBehaviour();

    for (const module of this.modules) {
      await module.init?.(ctx);
      this.initialised.push(module);
    }
    ctx.physics.syncQueries();
    ctx.events.emit('world:ready', {});

    this.loop.simulationPaused = true;
    ctx.state.set(ctx.flags.autostart ? 'playing' : 'menu');
    this.loop.start();
  }

  /** Cross-cutting behaviour that belongs to no feature module. */
  private wireCoreBehaviour(): void {
    const { ctx } = this;
    const applyFpsCap = (): void => {
      const cap = ctx.settings.get('fpsCap');
      this.loop.minFrameIntervalMs = minFrameIntervalMs(cap);
    };
    applyFpsCap();
    // fog range follows the preset's view distance (T-17)
    const applyFog = (): void => {
      if (!(ctx.scene.fog instanceof Fog)) return;
      const r = ctx.renderer.fogRange;
      ctx.scene.fog.near = r.near;
      ctx.scene.fog.far = r.far;
    };

    this.offHandlers.push(
      ctx.events.on('game:stateChanged', ({ to }) => {
        const playing = to === 'playing';
        ctx.renderer.shadowDynamicActive = playing;
        this.loop.simulationPaused = !playing;
        ctx.input.enabled = playing;
        if (playing) this.loop.resetTiming();
        else ctx.input.releaseAll();
      }),
      // Losing pointer lock while playing (Esc, alt-tab) pauses the game.
      ctx.events.on('world:ready', () => {
        applyFog();
        ctx.renderer.markShadowsDirty();
      }),
      ctx.events.on('input:pointerLockChanged', ({ locked }) => {
        if (!locked && ctx.state.is('playing')) ctx.state.set('paused');
      }),
      ctx.events.on('settings:changed', ({ key }) => {
        if (key === 'quality') {
          ctx.renderer.applyQuality(ctx.settings.get('quality'));
          applyFog();
        }
        if (key === 'fpsCap') applyFpsCap();
        if (key === 'bindings') ctx.input.setBindings(ctx.settings.get('bindings'));
      }),
    );
  }

  dispose(): void {
    this.loop.stop();
    for (const module of [...this.initialised].reverse()) {
      try {
        module.dispose?.();
      } catch (error) {
        console.error(`[Game] dispose of module "${module.id}" failed`, error);
      }
    }
    this.initialised.length = 0;
    for (const off of this.offHandlers) off();
    this.offHandlers = [];
    const { ctx } = this;
    ctx.input.detach();
    ctx.resources.dispose();
    ctx.enemies.clear();
    ctx.grappleAnchors.clear();
    ctx.events.clear();
    ctx.physics.dispose();
    ctx.renderer.dispose();
  }
}

type MutableClock = { -readonly [K in keyof GameClock]: GameClock[K] };
