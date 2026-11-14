import { Vector3 } from 'three';
import { isOnLand } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { HitZone } from '@/core/types';
import { QueryGroups } from '@/physics/groups';
import { createDecals, Dinosaur, type DinoDecals, type DinoHooks } from './Dinosaur';
import { createDinoAssets, type DinoAssets } from './DinoModel';
import { DinoAudio } from './dinoAudio';
import { DinoDrops } from './drops';
import type { DinoSkill } from './events';
import './events';
import { pickGuardTowers, seedFromParams } from './guards';
import { DINO } from './tunables';

const MODULE_ID = 'dinosaur';

interface TowerRef {
  id: number;
  position: Vector3;
}

const evPos = new Vector3();
const DIRS = 8;

/**
 * Dinosaur semi-boss (T-21): picks 2 of the 4 towers with a seeded RNG (`?seed=`), spawns a ~9 m
 * mecha T-Rex when the player first comes within 35 m of one, and runs the fight. The dinosaur is
 * not an `Enemy` in `ctx.enemies` (population totals stay 14 / 10 / 6). In `?sandbox` the module
 * only acts with `?dino`.
 */
export function createDinosaurModule(): GameModule {
  let ctx: GameContext | null = null;
  let assets: DinoAssets | null = null;
  let decals: DinoDecals | null = null;
  let audio: DinoAudio | null = null;
  let drops: DinoDrops | null = null;
  let barEl: HTMLDivElement | null = null;
  let barFill: HTMLDivElement | null = null;
  let barText = '';
  let seed = 0;
  let enabled = true;
  const towers: TowerRef[] = [];
  let guardIds: number[] = [];
  const spawned = new Set<number>();
  const dinos: Dinosaur[] = [];
  const offs: Array<() => void> = [];
  let shakeAmp = 0;
  let shakeLeft = 0;
  let shakeTotal = 1;
  let serialSpawns = 0;
  let passiveAll = false;

  const hooks: DinoHooks = {
    shake(amplitude, seconds, x, z) {
      if (!ctx) return;
      const p = ctx.player.position;
      const falloff = Math.max(0, 1 - Math.hypot(p.x - x, p.z - z) / DINO.shakeRange);
      const amp = amplitude * falloff;
      if (amp > shakeAmp * (shakeLeft / shakeTotal)) {
        shakeAmp = amp;
        shakeLeft = seconds;
        shakeTotal = seconds;
      }
    },
    defeated(dino) {
      if (!ctx || !drops) return;
      drops.dropLoot(dino.position.x, dino.position.z);
    },
  };

  /** A free ground spot around the tower, preferring the side the player comes from. */
  function findSpot(tower: TowerRef): { x: number; z: number } {
    const c = ctx as GameContext;
    const p = c.player.position;
    const base = Math.atan2(p.z - tower.position.z, p.x - tower.position.x);
    const ring = DINO.spawnRing;
    const r = DINO.spawnClearRadius;
    let fallback: { x: number; z: number } | null = null;
    for (const off of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
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

  function spawn(towerId: number, x: number, z: number): Dinosaur | null {
    if (!ctx || !assets || !decals || !audio) return null;
    const res = ctx.resources.scope(MODULE_ID);
    const d = new Dinosaur(ctx, assets, decals, audio, res, towerId, x, z, hooks);
    d.passive = passiveAll;
    dinos.push(d);
    serialSpawns++;
    spawned.add(towerId);
    ctx.events.emit('dino:spawned', { id: d.id, towerId, position: evPos.set(x, 0, z) });
    ctx.events.emit('dino:roar', { id: d.id, position: evPos.set(x, 4, z), shake: DINO.spawn.shake, duration: DINO.spawn.shakeSeconds });
    ctx.events.emit('vfx:spawn', { kind: 'dust', position: evPos.set(x, 0.3, z), scale: 4 });
    ctx.events.emit('vfx:spawn', { kind: 'telegraph-ring', position: evPos.set(x, 0.1, z), scale: 10 });
    ctx.events.emit('ui:toast', { text: 'MECHA T-REX GUARDIAN', seconds: 3 });
    hooks.shake(DINO.spawn.shake, DINO.spawn.shakeSeconds, x, z);
    audio.roar();
    return d;
  }

  function onTowerRegistered(e: { towerId: number; position: Vector3; total: number }): void {
    towers.push({ id: e.towerId, position: e.position.clone() });
    if (towers.length < e.total) return;
    towers.sort((a, b) => a.id - b.id);
    // Tower 1 stands inside the 10 m warehouse hall: a 9 m dinosaur does not fit there, so only the
    // outdoor towers can be guarded (the sandbox has a single tower and keeps it).
    const outdoor = towers.length > 1 ? towers.filter((t) => t.id !== 1) : towers;
    const idx = pickGuardTowers(seed, outdoor.length, Math.min(DINO.guardCount, outdoor.length));
    guardIds = idx.map((i) => (outdoor[i] as TowerRef).id).sort((a, b) => a - b);
  }

  function buildBar(c: GameContext): void {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;left:50%;top:132px;transform:translateX(-50%);width:min(360px,60vw);display:none;pointer-events:none;font:600 12px system-ui,sans-serif;color:#ffd9c7;text-align:center;letter-spacing:.12em;text-shadow:0 1px 3px #000';
    const label = document.createElement('div');
    label.textContent = 'MECHA T-REX';
    const track = document.createElement('div');
    track.style.cssText = 'margin-top:3px;height:8px;background:rgba(0,0,0,.55);border:1px solid #ff5a2a;border-radius:2px;overflow:hidden';
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%;width:100%;background:linear-gradient(90deg,#ff3a10,#ff8a3a)';
    track.appendChild(fill);
    el.append(label, track);
    c.uiRoot.appendChild(el);
    barEl = el;
    barFill = fill;
  }

  function updateBar(): void {
    if (!ctx || !barEl || !barFill) return;
    let best: Dinosaur | null = null;
    let bestD: number = DINO.hpBarRange;
    for (const d of dinos) {
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
      enabled = !c.flags.sandbox || c.flags.params.has('dino');
      seed = seedFromParams(c.flags.params, Date.now());
      assets = createDinoAssets();
      res.onDispose(() => assets?.dispose());
      decals = createDecals();
      const dg = decals;
      res.onDispose(() => {
        dg.disc.dispose();
        dg.strip.dispose();
      });
      audio = new DinoAudio(() => c.settings.get('masterVolume'));
      drops = new DinoDrops(c, res);
      buildBar(c);

      offs.push(
        c.events.on('tower:registered', onTowerRegistered),
        c.events.on('game:respawn', () => {
          for (const d of dinos) d.resetToGuard();
        }),
      );

      c.testHooks[MODULE_ID] = {
        seed: () => seed,
        enabled: () => enabled,
        guards: () => [...guardIds],
        towers: () => towers.map((t) => ({ id: t.id, x: t.position.x, y: t.position.y, z: t.position.z })),
        spawnedTowers: () => [...spawned],
        list: () =>
          dinos.map((d) => ({
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
          for (const d of dinos) d.passive = on;
        },
        force: (skill: DinoSkill) => dinos.find((d) => d.alive)?.forceSkill(skill) ?? false,
        damage: (amount: number, zone: HitZone = 'body') =>
          dinos.find((d) => d.alive)?.applyDamage({ amount, zone, source: 'player' }) ?? null,
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
          if (Math.hypot(p.position.x - t.position.x, p.position.z - t.position.z) <= DINO.triggerRadius) {
            const spot = findSpot(t);
            spawn(t.id, spot.x, spot.z);
          }
        }
      }
      for (const d of dinos) d.fixedUpdate(dt);
      drops?.fixedUpdate(dt);
    },

    update(dt) {
      if (!ctx) return;
      for (let i = dinos.length - 1; i >= 0; i--) {
        const d = dinos[i] as Dinosaur;
        d.animate(dt);
        if (d.removable) {
          d.dispose();
          dinos.splice(i, 1);
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
      for (const d of dinos) d.dispose();
      dinos.length = 0;
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
