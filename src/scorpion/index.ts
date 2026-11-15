import { Vector3 } from 'three';
import { isOnLand } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { HitZone } from '@/core/types';
import { QueryGroups } from '@/physics/groups';
import { createDecals, Scorpion, type ScorpionDecals, type ScorpionHooks } from './Scorpion';
import { createScorpionAssets, type ScorpionAssets } from './ScorpionModel';
import { ScorpionAudio } from './scorpionAudio';
import { ScorpionDrops } from './drops';
import type { ScorpionSkill } from './events';
import './events';
import { pickGuardTowers, seedFromParams } from './guards';
import { SCORPION } from './tunables';

const MODULE_ID = 'scorpion';

interface TowerRef {
  id: number;
  position: Vector3;
}

const evPos = new Vector3();
const DIRS = 8;

/**
 * Mecha scorpion semi-boss (STINGER-7): guards the relay tower, rises out of the ground on its far
 * side when the player first comes within SCORPION.triggerRadius, and runs the fight. It is not an
 * `Enemy` in `ctx.enemies` (the robot roster stays as configured). In `?sandbox` the module only acts
 * with `?scorpion`.
 */
export function createScorpionModule(): GameModule {
  let ctx: GameContext | null = null;
  let assets: ScorpionAssets | null = null;
  let decals: ScorpionDecals | null = null;
  let audio: ScorpionAudio | null = null;
  let drops: ScorpionDrops | null = null;
  let barEl: HTMLDivElement | null = null;
  let barFill: HTMLDivElement | null = null;
  let barText = '';
  let seed = 0;
  let enabled = true;
  const towers: TowerRef[] = [];
  let guardIds: number[] = [];
  const spawned = new Set<number>();
  const scorpions: Scorpion[] = [];
  const offs: Array<() => void> = [];
  let shakeAmp = 0;
  let shakeLeft = 0;
  let shakeTotal = 1;
  let serialSpawns = 0;
  let passiveAll = false;

  const hooks: ScorpionHooks = {
    shake(amplitude, seconds, x, z) {
      if (!ctx) return;
      const p = ctx.player.position;
      const falloff = Math.max(0, 1 - Math.hypot(p.x - x, p.z - z) / SCORPION.shakeRange);
      const amp = amplitude * falloff;
      if (amp > shakeAmp * (shakeLeft / shakeTotal)) {
        shakeAmp = amp;
        shakeLeft = seconds;
        shakeTotal = seconds;
      }
    },
    defeated(scorpion) {
      if (!ctx || !drops) return;
      drops.dropLoot(scorpion.position.x, scorpion.position.z);
    },
  };

  /** A free ground spot around the tower, preferring the side the player comes from. */
  function findSpot(tower: TowerRef): { x: number; z: number } {
    const c = ctx as GameContext;
    const p = c.player.position;
    const base = Math.atan2(p.z - tower.position.z, p.x - tower.position.x);
    const ring = SCORPION.spawnRing;
    const r = SCORPION.spawnClearRadius;
    let fallback: { x: number; z: number } | null = null;
    // far side of the tower first: it rises behind the relay, facing the player
    for (const off of [Math.PI, 2.4, -2.4, 1.6, -1.6, 0.8, -0.8, 0]) {
      const a = base + off;
      const x = tower.position.x + Math.cos(a) * ring;
      const z = tower.position.z + Math.sin(a) * ring;
      if (!isOnLand(x, z) || !isOnLand(x + r, z + r) || !isOnLand(x - r, z - r)) continue;
      fallback ??= { x, z };
      let free = true;
      for (let i = 0; i < DIRS && free; i++) {
        const da = (i / DIRS) * Math.PI * 2;
        const dx = Math.cos(da);
        const dz = Math.sin(da);
        for (const h of [1.5, 5]) {
          if (c.physics.raycast({ x, y: h, z }, { x: dx, y: 0, z: dz }, r, { groups: QueryGroups.worldOnly })) {
            free = false;
            break;
          }
        }
      }
      if (free) return { x, z };
    }
    return fallback ?? { x: tower.position.x + ring, z: tower.position.z };
  }

  function spawn(towerId: number, x: number, z: number): Scorpion | null {
    if (!ctx || !assets || !decals || !audio) return null;
    const res = ctx.resources.scope(MODULE_ID);
    const d = new Scorpion(ctx, assets, decals, audio, res, towerId, x, z, hooks);
    d.passive = passiveAll;
    scorpions.push(d);
    serialSpawns++;
    spawned.add(towerId);
    ctx.events.emit('scorpion:spawned', { id: d.id, towerId, position: evPos.set(x, 0, z) });
    ctx.events.emit('scorpion:roar', { id: d.id, position: evPos.set(x, 4, z), shake: SCORPION.spawn.shake, duration: SCORPION.spawn.shakeSeconds });
    ctx.events.emit('vfx:spawn', { kind: 'dust', position: evPos.set(x, 0.3, z), scale: 4 });
    ctx.events.emit('vfx:spawn', { kind: 'telegraph-ring', position: evPos.set(x, 0.1, z), scale: 10 });
    ctx.events.emit('ui:toast', { text: 'STINGER-7 GUARDS THE RELAY', seconds: 3 });
    hooks.shake(SCORPION.spawn.shake, SCORPION.spawn.shakeSeconds, x, z);
    audio.roar();
    return d;
  }

  function onTowerRegistered(e: { towerId: number; position: Vector3; total: number }): void {
    towers.push({ id: e.towerId, position: e.position.clone() });
    if (towers.length < e.total) return;
    towers.sort((a, b) => a.id - b.id);
    // Tower 1 stands inside the 10 m warehouse hall: a 9 m scorpion does not fit there, so only the
    // outdoor towers can be guarded (the sandbox has a single tower and keeps it).
    const outdoor = towers.length > 1 ? towers.filter((t) => t.id !== 1) : towers;
    const idx = pickGuardTowers(seed, outdoor.length, Math.min(SCORPION.guardCount, outdoor.length));
    guardIds = idx.map((i) => (outdoor[i] as TowerRef).id).sort((a, b) => a - b);
  }

  function buildBar(c: GameContext): void {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;left:50%;bottom:20vh;transform:translateX(-50%);width:min(52vh,60vw);display:none;pointer-events:none;font:700 1.5vh "Bahnschrift","Segoe UI",system-ui,sans-serif;color:#ffe2cf;text-align:center;letter-spacing:.34em;text-shadow:0 1px 4px #000';
    const label = document.createElement('div');
    label.textContent = 'STINGER-7 // RELAY GUARDIAN';
    const track = document.createElement('div');
    track.style.cssText = 'margin-top:.6vh;height:1.1vh;background:rgba(8,6,10,.7);border-left:3px solid #3dff4e;clip-path:polygon(0 0,100% 0,calc(100% - .8vh) 100%,0 100%);overflow:hidden';
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%;width:100%;background:linear-gradient(90deg,#0f9a2c,#7dff6a);box-shadow:0 0 1.2vh #3dff4e;transition:width .12s';
    track.appendChild(fill);
    el.append(label, track);
    c.uiRoot.appendChild(el);
    barEl = el;
    barFill = fill;
  }

  function updateBar(): void {
    if (!ctx || !barEl || !barFill) return;
    let best: Scorpion | null = null;
    let bestD: number = SCORPION.hpBarRange;
    for (const d of scorpions) {
      if (!d.alive) continue;
      const dist = Math.hypot(d.position.x - ctx.player.position.x, d.position.z - ctx.player.position.z);
      if (dist < bestD) {
        best = d;
        bestD = dist;
      }
    }
    if (!best) {
      if (barText !== 'hidden') {
        barEl.style.display = 'none';
        barText = 'hidden';
      }
      return;
    }
    const w = `${((best.hp / best.maxHp) * 100).toFixed(1)}%`;
    if (barText !== w) {
      barText = w;
      barFill.style.width = w;
      barEl.style.display = 'block';
    }
  }

  return {
    id: MODULE_ID,

    init(c) {
      ctx = c;
      const res = c.resources.scope(MODULE_ID);
      enabled = !c.flags.sandbox || c.flags.params.has('scorpion');
      seed = seedFromParams(c.flags.params, Date.now());
      assets = createScorpionAssets();
      res.onDispose(() => assets?.dispose());
      decals = createDecals();
      const dg = decals;
      res.onDispose(() => dg.dispose());
      audio = new ScorpionAudio(() => c.settings.get('masterVolume'));
      drops = new ScorpionDrops(c, res);
      buildBar(c);

      offs.push(
        c.events.on('tower:registered', onTowerRegistered),
        c.events.on('game:respawn', () => {
          for (const d of scorpions) d.resetToGuard();
        }),
      );

      c.testHooks[MODULE_ID] = {
        seed: () => seed,
        enabled: () => enabled,
        guards: () => [...guardIds],
        towers: () => towers.map((t) => ({ id: t.id, x: t.position.x, y: t.position.y, z: t.position.z })),
        spawnedTowers: () => [...spawned],
        list: () =>
          scorpions.map((d) => ({
            id: d.id,
            towerId: d.towerId,
            state: d.state,
            skill: d.currentSkill,
            hp: d.hp,
            maxHp: d.maxHp,
            alive: d.alive,
            yaw: d.yaw,
            position: { x: d.position.x, y: d.position.y, z: d.position.z },
            drawCalls: d.drawCalls,
            cooldowns: d.cooldownSnapshot,
          })),
        spawnAt: (x: number, z: number, towerId = 0) => spawn(towerId, x, z)?.id ?? null,
        passive: (on: boolean) => {
          passiveAll = on;
          for (const d of scorpions) d.passive = on;
        },
        force: (skill: ScorpionSkill) => scorpions.find((d) => d.alive)?.forceSkill(skill) ?? false,
        damage: (amount: number, zone: HitZone = 'body') =>
          scorpions.find((d) => d.alive)?.applyDamage({ amount, zone, source: 'player' }) ?? null,
        drops: () => drops?.list() ?? [],
        shake: () => shakeAmp * (shakeLeft / shakeTotal),
        spawnCount: () => serialSpawns,
      };
    },

    fixedUpdate(dt) {
      if (!ctx || !enabled) return;
      const p = ctx.player;
      if (p.alive && guardIds.length > 0) {
        for (const t of towers) {
          if (spawned.has(t.id) || !guardIds.includes(t.id)) continue;
          if (Math.hypot(p.position.x - t.position.x, p.position.z - t.position.z) <= SCORPION.triggerRadius) {
            const spot = findSpot(t);
            spawn(t.id, spot.x, spot.z);
          }
        }
      }
      for (const d of scorpions) d.fixedUpdate(dt);
      drops?.fixedUpdate(dt);
    },

    update(dt) {
      if (!ctx) return;
      for (let i = scorpions.length - 1; i >= 0; i--) {
        const d = scorpions[i] as Scorpion;
        d.animate(dt);
        if (d.removable) {
          d.dispose();
          scorpions.splice(i, 1);
        }
      }
      drops?.update(ctx.clock.simTime);
      if (shakeLeft > 0) {
        shakeLeft = Math.max(0, shakeLeft - dt);
        const a = shakeAmp * (shakeLeft / shakeTotal);
        ctx.camera.position.x += (Math.random() - 0.5) * 2 * a;
        ctx.camera.position.y += (Math.random() - 0.5) * 2 * a;
        ctx.camera.position.z += (Math.random() - 0.5) * 2 * a;
      }
      updateBar();
    },

    dispose() {
      for (const off of offs.splice(0)) off();
      for (const d of scorpions) d.dispose();
      scorpions.length = 0;
      drops?.dispose();
      drops = null;
      audio?.dispose();
      audio = null;
      barEl?.remove();
      barEl = null;
      barFill = null;
      towers.length = 0;
      guardIds = [];
      spawned.clear();
      if (ctx) {
        delete ctx.testHooks[MODULE_ID];
        ctx.resources.scope(MODULE_ID).dispose();
      }
      assets = null;
      decals = null;
      ctx = null;
    },
  };
}
