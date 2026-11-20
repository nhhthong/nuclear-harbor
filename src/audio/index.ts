import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { GameEvents } from '@/core/events';
import { Vector3 } from 'three';
import { AudioEngine } from './AudioEngine';
import { SOUND_IDS, type SoundId } from './catalogue';
import { EVENT_ROUTES, ROUTED_EVENTS, type RouteEnv, type RoutedEvent, type SoundRequest } from './eventMap';
import { beaconInterval } from './math';
import { heartbeatRate, lowHealthLevel } from './rules';
import { WAREHOUSE } from '@/config/warehouse';
import { AUDIO } from './tunables';

const MODULE_ID = 'audio';

const scratchPos = new Vector3();
const scratchFwd = new Vector3();
const scratchUp = new Vector3();

interface Tower {
  x: number;
  y: number;
  z: number;
}

/**
 * Procedural Web Audio (GDD 11): every sound is synthesised and driven by events. Silent but
 * error-free until the first user gesture or when Web Audio is unavailable.
 */
export function createAudioModule(): GameModule {
  const engine = new AudioEngine();
  let ctx: GameContext | null = null;
  let cleanedUp = false;
  const offs: Array<() => void> = [];
  const towers = new Map<number, Tower>();
  let beaconTimer = 0;
  let panel: HTMLElement | null = null;
  const env: RouteEnv = {};
  // spec 32: low-health layer (heartbeat + breathing), smoothed level; procedural heartbeat fallback timer
  let lowHealth = 0;
  let heartbeatTimer = 0;
  let creakTimer: number = AUDIO.creak.minInterval;

  const dispatch = (out: SoundRequest | SoundRequest[] | null): void => {
    if (!out || !ctx || ctx.state.is('paused')) return;
    if (Array.isArray(out)) for (const r of out) engine.play(r.id, r);
    else engine.play(out.id, out);
  };

  const applyState = (state: string): void => {
    if (state === 'playing') {
      engine.resume();
      engine.setAmbienceLevel(AUDIO.ambience.playingLevel, AUDIO.ambience.fadeIn);
    } else if (state === 'paused') {
      engine.setAmbienceLevel(AUDIO.ambience.duckedLevel, AUDIO.ambience.fadeOut);
      engine.suspend();
    } else {
      engine.resume();
      engine.setAmbienceLevel(AUDIO.ambience.duckedLevel, AUDIO.ambience.fadeOut);
    }
  };

  const onGesture = (): void => {
    engine.unlock();
    // a context created after the state already changed still needs the right ambience level
    if (ctx) applyState(ctx.state.current);
  };

  const bind = <K extends RoutedEvent>(name: K): void => {
    const route = EVENT_ROUTES[name] as (e: GameEvents[K], env?: RouteEnv) => SoundRequest | SoundRequest[] | null;
    offs.push(ctx!.events.on(name, (e) => {
      env.player = ctx?.player.position;
      dispatch(route(e, env));
    }));
  };

  const cleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    for (const t of AUDIO.gestureEvents) window.removeEventListener(t, onGesture, true);
    for (const off of offs) off();
    offs.length = 0;
    panel?.remove();
    panel = null;
    towers.clear();
    engine.dispose();
  };

  return {
    id: MODULE_ID,

    init(context) {
      ctx = context;
      const res = context.resources.scope(MODULE_ID);
      res.onDispose(cleanup);

      engine.setMasterVolume(context.settings.get('masterVolume'));
      for (const t of AUDIO.gestureEvents) window.addEventListener(t, onGesture, true);

      for (const name of ROUTED_EVENTS) bind(name);

      offs.push(
        context.events.on('settings:changed', (e) => {
          if (e.key === 'masterVolume') engine.setMasterVolume(context.settings.get('masterVolume'));
        }),
        context.events.on('game:stateChanged', (e) => applyState(e.to)),
        context.events.on('tower:registered', (e) => towers.set(e.towerId, { x: e.position.x, y: e.position.y, z: e.position.z })),
        context.events.on('tower:activated', (e) => {
          towers.delete(e.towerId);
          engine.stopHum();
        }),
        context.events.on('tower:activationStarted', () => engine.startHum()),
        context.events.on('tower:activationProgress', (e) => {
          engine.startHum();
          engine.setHumProgress(e.progress);
        }),
        context.events.on('tower:activationCancelled', () => engine.stopHum()),
        context.events.on('objectives:allActivated', () => towers.clear()),
      );
      applyState(context.state.current);

      context.testHooks[MODULE_ID] = {
        contextState: (): string => engine.state,
        activeVoices: (): number => engine.activeVoices,
        playedCount: (id: string): number => engine.playedCount(id as SoundId),
        peakVoices: (): number => engine.peakVoices,
        liveNodes: (): number => engine.liveNodes,
        masterVolume: (): number => engine.masterVolume,
        ambienceLevel: (): number => engine.ambienceLevel,
        voiceCap: AUDIO.voiceCap,
        // spec 32
        play: (id: string): boolean => {
          engine.unlock();
          const p = context.player.position;
          return SOUND_IDS.includes(id as SoundId) && engine.play(id as SoundId, { position: { x: p.x + 3, y: p.y + 1, z: p.z } });
        },
        samplePlays: (): number => engine.samplePlays,
        samples: () => engine.sampleSummary(),
        sampleReady: (file: string): boolean => engine.sampleReady(file),
        lowHealthLevel: (): number => lowHealth,
      };

      if (context.flags.params.has('audiotest')) panel = buildPanel(context, engine);
    },

    update(dt) {
      const c = ctx;
      if (!c) return;
      updateLowHealth(c, dt);
      updateCreaks(c, dt);
      c.camera.getWorldPosition(scratchPos);
      c.camera.getWorldDirection(scratchFwd);
      scratchUp.set(0, 1, 0).applyQuaternion(c.camera.quaternion);
      engine.setListener(
        scratchPos.x, scratchPos.y, scratchPos.z,
        scratchFwd.x, scratchFwd.y, scratchFwd.z,
        scratchUp.x, scratchUp.y, scratchUp.z,
      );

      // beacon: ping from the nearest inactive tower, faster when closer (GDD 8 direction hint)
      let nearest: Tower | null = null;
      let best = Infinity;
      const p = c.player.position;
      for (const t of towers.values()) {
        const d = Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z);
        if (d < best) {
          best = d;
          nearest = t;
        }
      }
      if (!nearest) {
        beaconTimer = 0;
        return;
      }
      beaconTimer -= dt;
      if (beaconTimer <= 0) {
        engine.play('beacon', { position: nearest });
        beaconTimer = beaconInterval(best);
      }
    },

    dispose() {
      cleanup();
    },
  };

  /** Heartbeat and breathing loops follow HP below 35 % (spec 32); procedural beats when not decoded. */
  function updateLowHealth(c: GameContext, dt: number): void {
    const playing = c.state.is('playing') && c.player.alive;
    const target = playing ? lowHealthLevel(c.player.hp, c.player.maxHp) : 0;
    const k = Math.min(1, dt / AUDIO.lowHealth.smoothing);
    lowHealth += (target - lowHealth) * k;
    if (lowHealth < 0.002) lowHealth = target === 0 ? 0 : lowHealth;
    const rate = heartbeatRate(lowHealth);
    const looped = engine.setLoop('heartbeat', lowHealth, rate);
    engine.setLoop('breath', lowHealth * AUDIO.lowHealth.breathShare, 1);
    if (looped || lowHealth <= 0.01) {
      heartbeatTimer = 0;
      return;
    }
    heartbeatTimer -= dt;
    if (heartbeatTimer <= 0) {
      engine.play('heartbeat', { intensity: lowHealth });
      heartbeatTimer = AUDIO.lowHealth.fallbackPeriod / rate;
    }
  }

  /** Occasional metal creaks from the warehouse structure while the player is inside it. */
  function updateCreaks(c: GameContext, dt: number): void {
    const p = c.player.position;
    const f = WAREHOUSE.footprint;
    if (!c.state.is('playing') || p.x < f.minX || p.x > f.maxX || p.z < f.minZ || p.z > f.maxZ) return;
    creakTimer -= dt;
    if (creakTimer > 0) return;
    const { minInterval, maxInterval } = AUDIO.creak;
    creakTimer = minInterval + Math.random() * (maxInterval - minInterval);
    const x = f.minX + Math.random() * (f.maxX - f.minX);
    const z = f.minZ + Math.random() * (f.maxZ - f.minZ);
    engine.play('metalCreak', { position: { x, y: WAREHOUSE.eaveHeight - 1, z } });
  }
}

/** `?audiotest`: one button per sound id plus a cycle button. */
function buildPanel(ctx: GameContext, engine: AudioEngine): HTMLElement {
  const el = document.createElement('div');
  el.className = 'interactive';
  el.style.cssText =
    'position:absolute;top:8px;right:8px;max-height:90vh;overflow:auto;background:#000a;color:#fff;font:12px monospace;padding:6px;z-index:50;display:flex;flex-direction:column;gap:2px';
  const play = (id: SoundId): void => {
    engine.unlock();
    const pos = ctx.player.position;
    engine.play(id, { position: { x: pos.x + 4, y: pos.y + 1, z: pos.z }, duration: 1.2, intensity: 1, variant: 0 });
  };
  const cycle = document.createElement('button');
  cycle.textContent = 'cycle all';
  cycle.onclick = () => SOUND_IDS.forEach((id, i) => window.setTimeout(() => play(id), i * 1500));
  el.append(cycle);
  for (const id of SOUND_IDS) {
    const b = document.createElement('button');
    b.textContent = id;
    b.onclick = () => play(id);
    el.append(b);
  }
  ctx.uiRoot.append(el);
  return el;
}
