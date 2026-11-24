import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { BOSS } from '@/config/tunables';
import { BOSS_ARENA } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { DamageResult } from '@/core/types';
import { BossBody, BODY_Y } from './BossBody';
import type { BodyAnim } from './BossBody';
import { angleDelta, clampToArena, rangeIntent } from './BossAttacks';
import type { XZ } from './BossAttacks';
import { BossColliders } from './BossColliders';
import { BossEffects } from './BossEffects';
import { canSkip, cinematicFrame, newCinematicFrame } from './cinematic';
import { CinematicFx } from './CinematicFx';
import { CrabBody } from './CrabBody';
import type { BossVisual } from './CrabBody';
import { fallbackBones, loadBossAssets } from './crabAssets';
import type { BossAssets, LegBone } from './crabAssets';
import { Drones } from './Drones';
import { pickLandingSpot } from './landing';
import type { LandingObstacle } from './landing';
import { BossModel, DEFAULT_BOSS_MODEL_CONFIG } from './BossModel';
import type { BossModelEvent, HitOutcome } from './BossModel';
import { resetArmorTextures } from './BossTextures';
import {
  SKILL_ATTACK,
  SKILLS,
  QuakeWaves,
  SkillScheduler,
  TickTimer,
  beamAngles,
  beamHitsPlayer,
  bombDamage,
  bombPattern,
  clawPoint,
  droneReleaseCount,
  grabCarry,
  grabConnects,
  laserBase,
  lungeEnd,
  quakeDuration,
} from './skills';
import type { SkillId } from './skills';
import { BOSS_LOCAL, CRAB } from './tunables';
import { QueryGroups } from '@/physics/groups';

// module-level scratch, no per-frame allocation
const evPos = new Vector3();
/** Copy of the player position for `game:checkpoint` (event payloads must not carry live vectors). */
const checkpointPos = new Vector3();
const bayPos = new Vector3();
const mortarPos = new Vector3();
const impulse = new Vector3();
const blastDir = new Vector3();
const playerCentre = new Vector3();
const tmpLocal = new Vector3();
const camPos = new Vector3();
const camTarget = new Vector3();
const camQ = new Quaternion();
const playerQ = new Quaternion();
const playerEuler = new Euler();
const lookM = new Matrix4();
const UP = new Vector3(0, 1, 0);
const CAM_ROLL = new Quaternion();
const ROLL_AXIS = new Vector3(0, 0, 1);
const probe = { x: 0, y: 0, z: 0 };
const DOWN = { x: 0, y: -1, z: 0 };
const beamRay = { x: 0, y: 0, z: 0 };
const beamOrigin = { x: 0, y: 0, z: 0 };
const bossXZ: XZ = { x: 0, z: 0 };
const playerXZ: XZ = { x: 0, z: 0 };
const dronePos = new Vector3();
const clawXZ: XZ = { x: 0, z: 0 };
const lungeXZ: XZ = { x: 0, z: 0 };

interface SkillRun {
  skill: SkillId | null;
  phase: 'telegraph' | 'active';
  t: number;
  /** Length of the current phase (s). */
  duration: number;
  // laser
  laserStart: number;
  laserDir: 1 | -1;
  clipTimer: number;
  // bombs
  bombsLeft: number;
  // claw grab (spec 34): `sub` is the stage of the active phase
  sub: 'lunge' | 'carry' | 'recover';
  lungeFromX: number;
  lungeFromZ: number;
  lungeToX: number;
  lungeToZ: number;
  locked: boolean;
  carry: number;
  carried: boolean;
  slammed: boolean;
  // claw quake: pounds fired so far
  pounds: number;
}

/**
 * Final boss: the Gunslinger Crab Mech (spec 27-crab-boss). Rules live in BossModel / skills (pure, unit
 * tested); this module glues them to the scene, physics, pools and the event bus.
 */
export function createBossModule(): GameModule {
  let ctx: GameContext | null = null;
  const offs: Array<() => void> = [];
  const model = new BossModel({ ...DEFAULT_BOSS_MODEL_CONFIG, awakeningDuration: BOSS_LOCAL.cinematic.duration });

  /** Cinematic scale (harbor 0.5, sandbox 0.4); `k` is the same as a size factor relative to the harbor. */
  let scale = 1;
  let k = 1;
  let origin: XZ = { x: BOSS_ARENA.center.x, z: BOSS_ARENA.center.z };
  let arenaRadius: number = BOSS_ARENA.radius;
  const scheduler = new SkillScheduler();
  const quake = new QuakeWaves();
  const ticks = new TickTimer();
  const angles: number[] = [];
  const lengths: number[] = [0, 0, 0, 0];

  let fx: CinematicFx | null = null;
  const cin = { active: false, t: 0, impacted: false, ended: false, frame: newCinematicFrame() };
  const landing = { x: 0, z: 0, clear: true };
  const hiddenCamChildren: Array<{ o: { visible: boolean }; was: boolean }> = [];

  let body: BossVisual | null = null;
  let usingCrab = false;
  let colliders: BossColliders | null = null;
  let effects: BossEffects | null = null;
  let drones: Drones | null = null;
  let assets: BossAssets | null = null;
  let assetWait = 0;

  let spawned = false;
  let spawnRequested = false;
  let bootDelay = -1;
  let elapsed = 0;
  let collapseElapsed = 0;
  let nextBurst = 0;
  let defeatedEmitted = false;
  let aiPaused = false;

  const pos = { x: 0, y: 0, z: 0 };
  let yaw = 0;
  let walk = 0;
  let strafeDir: 1 | -1 = 1;
  let strafeTimer = 0;
  const anim: BodyAnim = { walk: 0, travelled: 0, dirX: 0, dirZ: -1, slamRaise: 0, cannonCharge: 0, collapse: 0, claw: 0, charge: 0 };
  const run: SkillRun = { skill: null, phase: 'telegraph', t: 0, duration: 0, laserStart: 0, laserDir: 1, clipTimer: 0, bombsLeft: 0, sub: 'lunge', lungeFromX: 0, lungeFromZ: 0, lungeToX: 0, lungeToZ: 0, locked: false, carry: 0, carried: false, slammed: false, pounds: 0 };

  // ---- helpers -------------------------------------------------------------------------

  /** Body-space point (crab metres) to world space (sized, yawed). */
  function worldPoint(lx: number, ly: number, lz: number, out: Vector3): Vector3 {
    const x = lx * k;
    const y = ly * k;
    const z = lz * k;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return out.set(pos.x + x * c + z * s, pos.y + y, pos.z - x * s + z * c);
  }

  function bossCentre(out: Vector3): Vector3 {
    return out.set(pos.x, pos.y + (usingCrab ? CRAB.hull.y * k : BODY_Y * scale), pos.z);
  }

  function vfx(kind: 'explosion' | 'big-explosion' | 'dust' | 'telegraph-ring' | 'smoke', at: Vector3, size?: number): void {
    ctx?.events.emit('vfx:spawn', { kind, position: at, scale: size });
  }

  function handleEvents(events: BossModelEvent[]): void {
    const c = ctx;
    if (!c) return;
    for (const e of events) {
      switch (e.type) {
        case 'phaseChanged':
          c.events.emit('boss:phaseChanged', { phase: e.phase });
          if (e.phase === 'destroyed') beginCollapse();
          break;
        case 'damaged':
          c.events.emit('boss:coreDamaged', { hp: e.hp, maxHp: e.maxHp });
          break;
        case 'defeated':
          // announced when the collapse has played (see collapseStep)
          break;
      }
    }
  }

  function outcome(out: HitOutcome): DamageResult {
    handleEvents(out.events);
    return { dealt: out.dealt, zone: 'body', killed: out.killed, absorbed: out.absorbed };
  }

  // ---- lifecycle -----------------------------------------------------------------------

  /** Landing spot: first clear candidate away from the player, robots and probed props. */
  function chooseLanding(c: GameContext): void {
    const obstacles: LandingObstacle[] = [];
    for (const e of c.enemies.alive()) {
      obstacles.push({ x: e.position.x, z: e.position.z, r: BOSS_LOCAL.landing.enemyRadius * scale });
    }
    const L = BOSS_LOCAL.landing;
    const spot = pickLandingSpot({
      centre: origin,
      arenaRadius,
      footprint: BOSS_LOCAL.footprintRadius * scale,
      player: { x: c.player.position.x, z: c.player.position.z },
      obstacles,
      clearance: L.clearance * scale,
      blocked: (x, z, r) => {
        for (let i = 0; i < 9; i++) {
          const a = (i / 8) * Math.PI * 2;
          const kk = i === 0 ? 0 : r * 0.85;
          probe.x = x + Math.cos(a) * kk;
          probe.z = z + Math.sin(a) * kk;
          probe.y = L.probeHeight;
          const hit = c.physics.raycast(probe, DOWN, L.probeHeight + 2, { groups: QueryGroups.worldOnly });
          if (hit && hit.point.y > L.probeMaxGround) return true;
        }
        return false;
      },
    });
    landing.x = spot.x;
    landing.z = spot.z;
    landing.clear = spot.clear;
  }

  function spawn(): void {
    const c = ctx;
    if (!c || spawned) return;
    spawned = true;
    const res = c.resources.scope('boss');
    const crab = assets?.crab ?? null;
    usingCrab = crab !== null;
    body = crab ? new CrabBody(res, crab, k) : new BossBody(res, scale);
    c.scene.add(body.root);
    const bones: Map<string, LegBone> = crab ? crab.bones : fallbackBones();
    colliders = new BossColliders(c.physics, k, { hit: (info) => outcome(model.hit(info.amount)), alive: () => model.phase !== 'destroyed' }, bones.values(), crab ? crab.arms.values() : []);
    effects = new BossEffects(res, c.scene, c.physics, k);
    drones = new Drones(res, c.scene, c.physics, assets?.drone ?? null, k, {
      onKilled: (p) => {
        vfx('explosion', p, 1.6);
        vfx('smoke', p, 1.4);
      },
      // spec 34: a drone shot down drops ammo or health
      onShotDown: (p) => {
        c.events.emit('boss:droneDestroyed', { position: dronePos.copy(p) });
      },
      onFire: (from, to) => {
        effects?.fireBolt(from, to);
      },
    });
    fx = new CinematicFx(res, c.scene, c.uiRoot, scale);

    chooseLanding(c);
    pos.x = landing.x;
    pos.z = landing.z;
    pos.y = BOSS_LOCAL.cinematic.skyHeight * scale;
    yaw = Math.atan2(-(c.player.position.x - pos.x), -(c.player.position.z - pos.z));

    // `?bossphase=low` (or the old `core`): the fight starts with a fifth of the HP left
    const phaseParam = c.flags.params.get('bossphase');
    if (phaseParam === 'low' || phaseParam === 'core') model.setHpFraction(0.2);
    applyPose();

    c.events.emit('game:checkpoint', { id: 'boss-start', position: checkpointPos.copy(c.player.position), yaw: c.player.yaw });
    handleEvents(model.spawn());
    beginCinematic(c);
  }

  // ---- cinematic -----------------------------------------------------------------------

  function beginCinematic(c: GameContext): void {
    cin.active = true;
    cin.t = 0;
    cin.impacted = false;
    cin.ended = false;
    c.player.controlsLocked = true;
    c.player.velocity.set(0, 0, 0);
    c.player.pendingImpulse.set(0, 0, 0);
    hiddenCamChildren.length = 0;
    for (const o of c.camera.children) {
      hiddenCamChildren.push({ o, was: o.visible });
      o.visible = false;
    }
    cinematicFrame(0, cin.frame);
  }

  function endCinematic(): void {
    const c = ctx;
    if (!c || !cin.active) return;
    cin.active = false;
    cin.ended = true;
    c.player.controlsLocked = false;
    c.player.invulnerableFor = Math.max(c.player.invulnerableFor, BOSS_LOCAL.cinematic.graceAfter);
    for (const h of hiddenCamChildren) h.o.visible = h.was;
    hiddenCamChildren.length = 0;
    fx?.update(null, pos.x, pos.y, pos.z, 0, false);
    handleEvents(model.finishAwakening());
  }

  function impactMoment(c: GameContext): void {
    cin.impacted = true;
    const s = scale;
    evPos.set(pos.x, 0.5, pos.z);
    fx?.startShock(pos.x, pos.z);
    vfx('explosion', evPos, 5 * s);
    const R = BOSS_LOCAL.footprintRadius * s;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      evPos.set(pos.x + Math.cos(a) * R, 0.3, pos.z + Math.sin(a) * R);
      vfx('dust', evPos, 14 * s);
    }
    bossCentre(evPos);
    c.events.emit('boss:spawned', { name: BOSS.name, coreHp: BOSS.hp, weakPoints: 0, position: evPos });
  }

  /** Jump to the release stage (E after the skip delay, or the test hook). */
  function skipCinematic(force: boolean): boolean {
    if (!cin.active) return false;
    if (!force && !canSkip(cin.t)) return false;
    const target = BOSS_LOCAL.cinematic.duration - 0.5;
    if (cin.t >= target) return false;
    cin.t = target;
    return true;
  }

  function cinematicStep(dt: number, c: GameContext): void {
    cin.t = Math.min(BOSS_LOCAL.cinematic.duration, cin.t + dt);
    cinematicFrame(cin.t, cin.frame);
    pos.y = cin.frame.height * BOSS_LOCAL.cinematic.skyHeight * scale;
    c.player.invulnerableFor = Math.max(c.player.invulnerableFor, 0.5);
    c.player.velocity.x = 0;
    c.player.velocity.z = 0;
    if (cin.frame.impacted && !cin.impacted) impactMoment(c);
    handleEvents(model.update(dt));
    if (cin.t >= BOSS_LOCAL.cinematic.duration || (model.phase !== 'awakening' && cin.active)) endCinematic();
  }

  /** Camera for this frame: leaves the player, looks up at the fall, then at the landed boss. */
  function cinematicCamera(c: GameContext): void {
    const f = cin.frame;
    const cfg = BOSS_LOCAL.cinematic;
    const s = scale;
    let dx = c.player.position.x - landing.x;
    let dz = c.player.position.z - landing.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) {
      dx = 0;
      dz = 1;
    } else {
      dx /= d;
      dz /= d;
    }
    const dist = Math.min(cfg.cameraDistance * s, Math.max(d, 30 * s));
    const push = f.stage === 'title' || f.stage === 'release' ? 0.12 * Math.min(1, (f.t - cfg.impactAt) / 2) : 0;
    const kk = dist * (1 - push);
    camPos.set(landing.x + dx * kk, cfg.cameraHeight * s, landing.z + dz * kk);
    camTarget.set(pos.x, pos.y + BODY_Y * s, pos.z);
    if (f.impacted) camTarget.y = Math.min(camTarget.y, BODY_Y * 1.15 * s);
    c.player.getEyePosition(tmpLocal);
    const leave = f.leave;
    const shake = f.shake * cfg.shakeAmount * s;
    const t = c.clock.simTime;
    c.camera.position.set(
      tmpLocal.x + (camPos.x - tmpLocal.x) * leave + Math.sin(t * 61) * shake,
      tmpLocal.y + (camPos.y - tmpLocal.y) * leave + Math.cos(t * 53) * shake,
      tmpLocal.z + (camPos.z - tmpLocal.z) * leave + Math.sin(t * 47 + 1) * shake,
    );
    lookM.lookAt(camPos, camTarget, UP);
    camQ.setFromRotationMatrix(lookM);
    playerEuler.set(c.player.pitch, c.player.yaw, 0, 'YXZ');
    playerQ.setFromEuler(playerEuler);
    c.camera.quaternion.copy(playerQ).slerp(camQ, leave);
    CAM_ROLL.setFromAxisAngle(ROLL_AXIS, Math.sin(t * 37) * 0.02 * f.shake);
    c.camera.quaternion.multiply(CAM_ROLL);
  }

  function resetSkill(): void {
    releasePlayer();
    run.skill = null;
    run.carried = false;
    anim.claw = 0;
    anim.charge = 0;
    effects?.setBeams('off', 0, 0, 0, null, null, 0);
    effects?.clearRings();
    quake.reset();
    ticks.reset();
  }

  /** Lets go of a player held by the claws (skill over, boss dead, respawn). */
  function releasePlayer(): void {
    const c = ctx;
    if (!c || !run.carried) return;
    run.carried = false;
    c.player.controlsLocked = false;
    c.player.velocity.set(0, 0, 0);
  }

  function beginCollapse(): void {
    collapseElapsed = 0;
    nextBurst = 0;
    scheduler.reset();
    resetSkill();
    effects?.releaseAll();
    drones?.killAll(true);
  }

  function applyPose(): void {
    colliders?.setPose(pos.x, pos.y, pos.z, yaw);
  }

  function onRespawn(): void {
    scheduler.reset();
    resetSkill();
    effects?.releaseAll();
    drones?.killAll(false);
  }

  // ---- skills --------------------------------------------------------------------------

  function dronesAlive(): number {
    return drones?.alive ?? 0;
  }

  function startSkill(skill: SkillId): void {
    const c = ctx;
    if (!c || !effects) return;
    run.skill = skill;
    run.phase = 'telegraph';
    run.t = 0;
    const C = CRAB;
    const attack = SKILL_ATTACK[skill];
    let radius = 1;
    switch (skill) {
      case 'bombs':
        run.duration = C.bombs.telegraph;
        radius = C.bombs.radius * k;
        evPos.set(c.player.position.x, c.player.position.y, c.player.position.z);
        break;
      case 'drones':
        run.duration = C.drones.telegraph;
        radius = 2.5 * k;
        evPos.copy(worldPoint(bayLocal().x, bayLocal().y, bayLocal().z, bayPos));
        vfx('telegraph-ring', evPos, 3 * k);
        break;
      case 'grab':
        run.duration = C.grab.telegraph;
        run.locked = false;
        run.carried = false;
        run.slammed = false;
        radius = C.grab.reach * k;
        evPos.set(pos.x, pos.y, pos.z);
        vfx('telegraph-ring', evPos, radius * 0.6);
        break;
      case 'quake':
        run.duration = C.quake.telegraph;
        run.pounds = 0;
        quake.reset();
        radius = C.quake.maxRadius * k;
        evPos.set(pos.x, pos.y, pos.z);
        effects.addMarker(pos.x, pos.y, pos.z, C.quake.startRadius * 2.4 * k, C.quake.telegraph, false, true);
        vfx('telegraph-ring', evPos, C.quake.startRadius * 2 * k);
        break;
      case 'laser': {
        run.duration = C.laser.telegraph;
        radius = C.laser.length * k;
        evPos.set(pos.x, pos.y, pos.z);
        // one beam starts on the player (a fair telegraph), the sweep turns a random way
        run.laserStart = Math.atan2(-(c.player.position.x - pos.x), -(c.player.position.z - pos.z));
        run.laserDir = Math.random() < 0.5 ? 1 : -1;
        run.clipTimer = 0;
        break;
      }
    }
    c.events.emit('boss:attackTelegraph', { attack, position: evPos, radius, duration: run.duration });
  }

  function bayLocal(): { x: number; y: number; z: number } {
    const b = assets?.crab?.bay;
    return b ? b : CRAB.bay;
  }

  function mortarLocal(): { x: number; y: number; z: number } {
    const m = assets?.crab?.mortar;
    return m ? m : CRAB.mortar;
  }

  function beginActive(): void {
    const c = ctx;
    if (!c || !effects || !run.skill) return;
    run.phase = 'active';
    run.t = 0;
    const C = CRAB;
    const attack = SKILL_ATTACK[run.skill];
    switch (run.skill) {
      case 'bombs': {
        const m = mortarLocal();
        worldPoint(m.x, m.y, m.z, mortarPos);
        bossXZ.x = pos.x;
        bossXZ.z = pos.z;
        playerXZ.x = c.player.position.x;
        playerXZ.z = c.player.position.z;
        const pattern = bombPattern(bossXZ, playerXZ, k, Math.random);
        let last = 0;
        run.bombsLeft = 0;
        for (const b of pattern) {
          if (effects.scheduleBomb(mortarPos, b.x, b.z, b.delay)) run.bombsLeft++;
          last = Math.max(last, b.delay);
        }
        run.duration = last + C.bombs.markerTime + 0.4;
        evPos.set(playerXZ.x, c.player.position.y, playerXZ.z);
        c.events.emit('boss:attack', { attack, position: evPos, radius: C.bombs.radius * k });
        break;
      }
      case 'drones': {
        const b = bayLocal();
        worldPoint(b.x, b.y, b.z, bayPos);
        const n = droneReleaseCount(dronesAlive(), Math.random());
        drones?.release(n, bayPos, c.player.position);
        run.duration = 0.7;
        c.events.emit('boss:attack', { attack, position: bayPos, radius: 2.5 * k });
        break;
      }
      case 'grab': {
        run.sub = 'lunge';
        run.duration = C.grab.lungeTime;
        run.lungeFromX = pos.x;
        run.lungeFromZ = pos.z;
        const end = lungeEnd({ x: pos.x, z: pos.z }, { x: run.lungeToX, z: run.lungeToZ }, k, lungeXZ);
        const clamped = clampToArena({ x: end.x, z: end.z }, origin, arenaRadius, BOSS_LOCAL.arenaMargin * scale);
        run.lungeToX = clamped.x;
        run.lungeToZ = clamped.z;
        evPos.set(pos.x, pos.y, pos.z);
        c.events.emit('boss:attack', { attack, position: evPos, radius: C.grab.radius * k });
        break;
      }
      case 'quake':
        run.duration = quakeDuration(k);
        run.pounds = 0;
        quake.reset();
        evPos.set(pos.x, pos.y, pos.z);
        c.events.emit('boss:attack', { attack, position: evPos, radius: C.quake.maxRadius * k });
        break;
      case 'laser':
        run.duration = C.laser.duration;
        ticks.reset();
        evPos.set(pos.x, pos.y, pos.z);
        c.events.emit('boss:attack', { attack, position: evPos, radius: C.laser.length * k });
        break;
    }
  }

  function endSkill(): void {
    scheduler.finish(Math.random);
    resetSkill();
  }

  /** Clip each beam against the static world (containers stop it). */
  function clipBeams(base: number, c: GameContext): void {
    const L = CRAB.laser;
    beamAngles(base, L.beams, angles);
    beamOrigin.x = pos.x;
    beamOrigin.y = L.height * k;
    beamOrigin.z = pos.z;
    for (let i = 0; i < L.beams; i++) {
      const a = angles[i] ?? 0;
      beamRay.x = -Math.sin(a);
      beamRay.y = 0;
      beamRay.z = -Math.cos(a);
      const max = L.length * k;
      const hit = c.physics.raycast(beamOrigin, beamRay, max, { groups: QueryGroups.worldOnly });
      lengths[i] = hit ? hit.distance : max;
    }
  }

  function skillStep(dt: number, c: GameContext): void {
    if (!run.skill || !effects) return;
    run.t += dt;
    const C = CRAB;
    if (run.phase === 'telegraph') {
      const f = Math.min(1, run.t / Math.max(0.001, run.duration));
      anim.charge = f;
      if (run.skill === 'grab' || run.skill === 'quake') anim.claw = f;
      if (run.skill === 'grab') {
        // the lunge target follows the player until `lockAt`, then it is fixed (the warning the player can dodge)
        if (run.t < C.grab.lockAt) {
          run.lungeToX = c.player.position.x;
          run.lungeToZ = c.player.position.z;
        } else if (!run.locked) {
          run.locked = true;
          clawAtTarget(c);
        }
      }
      if (run.skill === 'laser') {
        clipBeams(run.laserStart, c);
        effects.setBeams('warn', pos.x, C.laser.height * k, pos.z, angles, lengths, C.laser.startRadius * k);
      }
      if (run.t >= run.duration) {
        if (run.skill === 'laser') effects.setBeams('off', 0, 0, 0, null, null, 0);
        beginActive();
      }
      return;
    }
    // active
    switch (run.skill) {
      case 'bombs':
        anim.charge = 0.4;
        break;
      case 'drones':
        anim.charge = 0.6 * (1 - run.t / run.duration);
        break;
      case 'grab':
        grabStep(dt, c);
        return;
      case 'quake':
        quakeStep(dt, c);
        break;
      case 'laser': {
        anim.charge = 0.8;
        const base = laserBase(run.laserStart, run.laserDir, run.t);
        run.clipTimer -= dt;
        if (run.clipTimer <= 0) {
          run.clipTimer = 1 / C.laser.clipHz;
          clipBeams(base, c);
        } else {
          beamAngles(base, C.laser.beams, angles);
        }
        effects.setBeams('fire', pos.x, C.laser.height * k, pos.z, angles, lengths, C.laser.startRadius * k);
        bossXZ.x = pos.x;
        bossXZ.z = pos.z;
        let hit = false;
        for (let i = 0; i < C.laser.beams; i++) {
          if (beamHitsPlayer(bossXZ, angles[i] ?? 0, lengths[i] ?? 0, c.player.position, C.laser.startRadius * k)) hit = true;
        }
        const n = ticks.step(dt, hit);
        if (n > 0) {
          blastDir.set(c.player.position.x - pos.x, 0, c.player.position.z - pos.z);
          if (blastDir.lengthSq() < 1e-6) blastDir.set(0, 0, 1);
          blastDir.normalize();
          c.player.applyDamage({ amount: C.laser.tickDamage * n, zone: 'body', source: 'boss', direction: blastDir });
        }
        break;
      }
    }
    if (run.t >= run.duration) endSkill();
  }

  /** Marks where the claws will land once the lunge target is locked. */
  function clawAtTarget(c: GameContext): void {
    if (!effects) return;
    const G = CRAB.grab;
    const end = lungeEnd({ x: pos.x, z: pos.z }, { x: run.lungeToX, z: run.lungeToZ }, k, lungeXZ);
    const dx = run.lungeToX - end.x;
    const dz = run.lungeToZ - end.z;
    const d = Math.hypot(dx, dz) || 1;
    // the claw point lands on the target unless the lunge was capped: mark where it really lands
    const reach = Math.min(G.reach * k, Math.hypot(run.lungeToX - pos.x, run.lungeToZ - pos.z));
    void d;
    const lx = end.x + (dx / d) * Math.min(reach, G.reach * k);
    const lz = end.z + (dz / d) * Math.min(reach, G.reach * k);
    effects.addMarker(lx, pos.y, lz, G.radius * k, G.telegraph - G.lockAt + G.lungeTime, false, true);
    void c;
  }

  /** Claw grab, active phase: lunge, then carry (lift, hold, slam) or a miss, then a short recovery. */
  function grabStep(dt: number, c: GameContext): void {
    const G = CRAB.grab;
    if (run.sub === 'lunge') {
      const u = Math.min(1, run.t / G.lungeTime);
      const e = 1 - (1 - u) * (1 - u);
      pos.x = run.lungeFromX + (run.lungeToX - run.lungeFromX) * e;
      pos.z = run.lungeFromZ + (run.lungeToZ - run.lungeFromZ) * e;
      anim.claw = 1 - 0.4 * u;
      anim.charge = 0.8;
      anim.walk = 0;
      if (u >= 1) {
        bossXZ.x = pos.x;
        bossXZ.z = pos.z;
        clawPoint(bossXZ, yaw, k, clawXZ);
        if (grabConnects(clawXZ, c.player.position, k)) {
          run.sub = 'carry';
          run.carry = 0;
          run.carried = true;
          c.player.controlsLocked = true;
          c.player.velocity.set(0, 0, 0);
          evPos.set(clawXZ.x, 1, clawXZ.z);
          vfx('dust', evPos, 2 * k);
          c.events.emit('ui:toast', { text: 'GRABBED', seconds: 1 });
        } else {
          run.sub = 'recover';
          run.t = 0;
          run.duration = G.recoverMiss;
          evPos.set(clawXZ.x, 0.3, clawXZ.z);
          vfx('dust', evPos, 3 * k);
          vfx('explosion', evPos, 1.5 * k);
        }
        if (run.sub === 'carry') {
          run.t = 0;
          run.duration = Number.POSITIVE_INFINITY;
        }
      }
      return;
    }
    if (run.sub === 'carry') {
      run.carry += dt;
      const h = grabCarry(run.carry, k);
      bossXZ.x = pos.x;
      bossXZ.z = pos.z;
      clawPoint(bossXZ, yaw, k, clawXZ);
      anim.claw = h.stage === 'slam' ? 1 - Math.min(1, (run.carry - G.liftTime - G.holdTime) / G.slamTime) * 1.4 : 1;
      anim.charge = 0.9;
      c.player.teleport({ x: clawXZ.x, y: h.y, z: clawXZ.z });
      if (h.stage === 'done') {
        slamImpact(c);
        run.sub = 'recover';
        run.t = 0;
        run.duration = G.recoverHit;
      }
      return;
    }
    // recover: the boss stands, claws down
    anim.claw = (anim.claw ?? 0) * (1 - Math.min(1, dt * 6));
    anim.charge = 0.2;
    if (run.t >= run.duration) endSkill();
  }

  function slamImpact(c: GameContext): void {
    const G = CRAB.grab;
    releasePlayer();
    c.player.invulnerableFor = 0;
    blastDir.set(0, -1, 0);
    c.player.applyDamage({ amount: G.damage, zone: 'body', source: 'boss', direction: blastDir });
    c.player.invulnerableFor = Math.max(c.player.invulnerableFor, G.graceAfter);
    impulse.set(0, G.knockbackUp, 0);
    c.player.addImpulse(impulse);
    evPos.set(clawXZ.x, 0.3, clawXZ.z);
    vfx('big-explosion', evPos, 2.2 * k);
    vfx('dust', evPos, 5 * k);
    c.events.emit('boss:attack', { attack: 'claw-grab', position: evPos, radius: G.radius * k });
  }

  /** Claw quake, active phase: `count` pounds `interval` s apart, each sending a ring out from the body. */
  function quakeStep(dt: number, c: GameContext): void {
    const Q = CRAB.quake;
    // pound i at t = i * interval
    while (run.pounds < Q.count && run.t >= run.pounds * Q.interval) {
      run.pounds++;
      quake.launch(k);
      effects?.launchRing(pos.x, pos.z, Q.maxRadius * k, Q.speed * k);
      evPos.set(pos.x, 0.3, pos.z);
      vfx('explosion', evPos, 2.5 * k);
      vfx('dust', evPos, 8 * k);
      c.events.emit('boss:attack', { attack: 'claw-quake', position: evPos, radius: Q.maxRadius * k });
    }
    // arms: raised, slammed down on every pound (1 s beat)
    const beat = (run.t % Q.interval) / Q.interval;
    anim.claw = run.pounds >= Q.count && run.t >= (Q.count - 1) * Q.interval + 0.5 ? 0 : 1 - Math.min(1, beat * 6) * 1.2 + beat * 0.2;
    anim.charge = 0.7;
    const dist = Math.hypot(c.player.position.x - pos.x, c.player.position.z - pos.z);
    const hits = quake.step(dt, dist, c.player.position.y, k);
    if (hits > 0) {
      blastDir.set(c.player.position.x - pos.x, 0, c.player.position.z - pos.z);
      if (blastDir.lengthSq() < 1e-6) blastDir.set(0, 0, 1);
      blastDir.normalize();
      c.player.applyDamage({ amount: Q.damage * hits, zone: 'body', source: 'boss', direction: blastDir });
      impulse.copy(blastDir).multiplyScalar(Q.knockback);
      impulse.y = Q.knockbackUp;
      c.player.addImpulse(impulse);
    }
  }

  function onBomb(point: Vector3): void {
    const c = ctx;
    if (!c) return;
    const radius = CRAB.bombs.radius * k;
    vfx('explosion', point, radius / 2.2);
    playerCentre.set(c.player.position.x, c.player.position.y + CRAB.playerCentreHeight, c.player.position.z);
    const d = playerCentre.distanceTo(point);
    const dmg = bombDamage(d, radius);
    if (dmg > 0) {
      blastDir.copy(playerCentre).sub(point);
      if (blastDir.lengthSq() < 1e-6) blastDir.set(0, 1, 0);
      blastDir.normalize();
      c.player.applyDamage({ amount: dmg, zone: 'body', source: 'boss', point, direction: blastDir });
    }
  }

  function onBolt(point: Vector3): boolean {
    const c = ctx;
    if (!c) return false;
    playerCentre.set(c.player.position.x, c.player.position.y + CRAB.playerCentreHeight, c.player.position.z);
    if (playerCentre.distanceTo(point) > CRAB.drones.bolt.radius * k + 0.5) return false;
    blastDir.copy(playerCentre).sub(point).normalize();
    c.player.applyDamage({ amount: CRAB.drones.bolt.damage, zone: 'body', source: 'boss', point, direction: blastDir });
    return true;
  }

  function skillInput(): { distance: number; aliveDrones: number; k: number; hpFraction: number } {
    const c = ctx;
    const d = c ? Math.hypot(c.player.position.x - pos.x, c.player.position.z - pos.z) : 0;
    return { distance: d, aliveDrones: dronesAlive(), k, hpFraction: model.hpFraction };
  }

  function forceSkill(id: string): boolean {
    const skill = SKILLS.find((s) => s === id || SKILL_ATTACK[s] === id);
    if (!skill || model.phase !== 'fight' || !scheduler.force(skill)) return false;
    startSkill(skill);
    return true;
  }

  // ---- module --------------------------------------------------------------------------

  return {
    id: 'boss',

    init(context) {
      ctx = context;
      const sandbox = context.flags.sandbox;
      scale = sandbox ? BOSS_LOCAL.sandbox.scale : BOSS_LOCAL.harborScale;
      k = scale / BOSS_LOCAL.harborScale;
      if (sandbox) {
        origin = { x: BOSS_LOCAL.sandbox.position.x, z: BOSS_LOCAL.sandbox.position.z };
        arenaRadius = BOSS_LOCAL.sandbox.arenaRadius;
      }
      offs.push(context.events.on('objectives:allActivated', () => {
        spawnRequested = true;
      }));
      offs.push(context.events.on('game:respawn', onRespawn));
      if (context.flags.params.has('boss') || context.flags.params.has('bossphase')) bootDelay = BOSS_LOCAL.bootSpawnDelay;

      // the GLBs load while the player plays; the spawn waits for them (at most `loadWaitSeconds`)
      if (typeof document !== 'undefined' && !context.flags.params.has('procedural-boss')) {
        void loadBossAssets().then((a) => {
          assets = a;
        });
      } else {
        assets = { crab: null, drone: null };
      }

      context.testHooks.boss = {
        getState: () => ({
          phase: model.phase,
          hp: model.hp,
          maxHp: model.maxHp,
          scale,
          position: { x: pos.x, y: pos.y, z: pos.z },
          spawned,
          skill: run.skill,
          skillPhase: run.skill ? run.phase : null,
          skillTime: run.t,
          drones: drones?.alive ?? 0,
          dronePositions: drones?.positions() ?? [],
          liveBombs: effects?.liveBombs ?? 0,
          liveBolts: effects?.liveBolts ?? 0,
          liveMarkers: effects?.liveMarkers ?? 0,
          liveRings: effects?.liveRings ?? 0,
          grabSub: run.skill === 'grab' && run.phase === 'active' ? run.sub : null,
          playerCarried: run.carried,
          pounds: run.pounds,
          beamsActive: effects?.beamsActive ?? false,
          meshCount: countMeshes(),
          fxDrawCalls: fx?.drawCalls ?? 0,
          colliders: colliders?.colliderCount ?? 0,
          crabModel: usingCrab,
          droneModel: assets?.drone != null,
          yaw,
          landing: { x: landing.x, z: landing.z, clear: landing.clear },
          cooldowns: { ...scheduler.cooldowns },
          cinematic: { active: cin.active, ended: cin.ended, t: cin.t, stage: cin.frame.stage, impacted: cin.impacted, duration: BOSS_LOCAL.cinematic.duration },
        }),
        skipCinematic: (): boolean => skipCinematic(true),
        damage: (amount: number): DamageResult => outcome(model.hit(amount)),
        setHp: (hp: number): void => {
          model.setHpFraction(hp / model.maxHp);
          ctx?.events.emit('boss:coreDamaged', { hp: model.hp, maxHp: model.maxHp });
        },
        pauseAi: (paused: boolean): void => {
          aiPaused = paused;
        },
        /** `bombs` | `drones` | `laser` | `grab` | `quake` (or the event ids `carpet-bombs`, `claw-grab`, ...). */
        force: (id: string): boolean => forceSkill(id),
        forceAttack: (id: string): boolean => forceSkill(id),
        teleportBoss: (x: number, z: number): void => {
          pos.x = x;
          pos.z = z;
          applyPose();
        },
        killDrones: (): void => drones?.killAll(true),
      };
    },

    fixedUpdate(dt) {
      const c = ctx;
      if (!c) return;
      if (!spawned) {
        if (bootDelay >= 0) {
          bootDelay -= dt;
          if (bootDelay < 0) spawnRequested = true;
        }
        if (spawnRequested) {
          // wait for the GLBs, but not for ever (then the procedural body is used)
          assetWait += dt;
          if (assets || assetWait >= CRAB.loadWaitSeconds) {
            if (!assets) assets = { crab: null, drone: null };
            spawn();
          }
        }
        if (!spawned) return;
      }
      elapsed += dt;
      const phase = model.phase;

      if (phase === 'destroyed') {
        collapseStep(dt);
        effects?.fixedStep(dt, onBomb, onBolt);
        return;
      }

      if (cin.active) {
        cinematicStep(dt, c);
      } else {
        handleEvents(model.update(dt));
      }

      if (model.phase === 'fight' && !cin.active) {
        pos.y = 0;
        if (!aiPaused) {
          if (run.skill) skillStep(dt, c);
          else {
            const pick = scheduler.update(dt, skillInput(), Math.random);
            if (pick) startSkill(pick);
          }
        }
        walkStep(dt, c);
        drones?.fixedStep(dt, c.player.position, CRAB.playerCentreHeight);
      }

      effects?.fixedStep(dt, onBomb, onBolt);
      applyPose();
    },

    update(dt) {
      if (!spawned || !body) return;
      const c = ctx;
      if (!c) return;
      body.root.position.set(pos.x, pos.y, pos.z);
      body.root.rotation.y = yaw;
      body.update(c.clock.simTime, dt, anim);
      anim.travelled = 0;
      effects?.update();
      drones?.update(c.clock.simTime);
      if (cin.active) {
        if (c.input.wasPressed('interact')) skipCinematic(false);
        cinematicCamera(c);
      }
      fx?.update(cin.active ? cin.frame : null, pos.x, pos.y, pos.z, dt, canSkip(cin.t));
    },

    dispose() {
      for (const off of offs) off();
      offs.length = 0;
      if (ctx) {
        delete ctx.testHooks.boss;
        colliders?.dispose();
        fx?.dispose();
        if (cin.active) {
          ctx.player.controlsLocked = false;
          for (const h of hiddenCamChildren) h.o.visible = h.was;
        }
        resetArmorTextures();
        ctx.resources.scope('boss').dispose();
      }
      body = null;
      fx = null;
      colliders = null;
      effects = null;
      drones = null;
      ctx = null;
    },
  };

  // ---- movement and collapse (hoisted helpers) ------------------------------------------

  function walkStep(dt: number, c: GameContext): void {
    const dx = c.player.position.x - pos.x;
    const dz = c.player.position.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const busy = run.skill !== null;
    const grabbing = run.skill === 'grab' && run.phase === 'active';
    // turn slowly towards the player (not during the grab lunge; the laser keeps its heading)
    if (!grabbing && run.skill !== 'laser') {
      const target = Math.atan2(-dx, -dz);
      const maxTurn = BOSS_LOCAL.turnRate * dt;
      const delta = angleDelta(yaw, target);
      yaw += Math.max(-maxTurn, Math.min(maxTurn, delta));
    }

    let moved = 0;
    let mx = 0;
    let mz = 0;
    if (!busy && dist > 1e-3) {
      const intent = rangeIntent(dist, BOSS_LOCAL.rangeMin * scale, BOSS_LOCAL.rangeMax * scale);
      let vx = 0;
      let vz = 0;
      if (intent !== 0) {
        vx = (dx / dist) * intent * CRAB.walkSpeed * k;
        vz = (dz / dist) * intent * CRAB.walkSpeed * k;
      } else {
        // inside the band: strafe around the player
        strafeTimer -= dt;
        if (strafeTimer <= 0) {
          strafeDir = strafeDir === 1 ? -1 : 1;
          strafeTimer = CRAB.strafeFlip[0] + Math.random() * (CRAB.strafeFlip[1] - CRAB.strafeFlip[0]);
        }
        vx = (-dz / dist) * strafeDir * CRAB.strafeSpeed * k;
        vz = (dx / dist) * strafeDir * CRAB.strafeSpeed * k;
      }
      const clamped = clampToArena({ x: pos.x + vx * dt, z: pos.z + vz * dt }, origin, arenaRadius, BOSS_LOCAL.arenaMargin * scale);
      mx = clamped.x - pos.x;
      mz = clamped.z - pos.z;
      pos.x = clamped.x;
      pos.z = clamped.z;
      moved = Math.hypot(mx, mz);
    }
    walk += ((moved > 0 ? 1 : 0) - walk) * Math.min(1, dt * 4);
    anim.walk = walk;
    anim.travelled += moved / k;
    if (moved > 0) {
      const cs = Math.cos(yaw);
      const sn = Math.sin(yaw);
      anim.dirX = (mx * cs - mz * sn) / moved;
      anim.dirZ = (mx * sn + mz * cs) / moved;
    }
  }

  function collapseStep(dt: number): void {
    const c = ctx;
    if (!c || defeatedEmitted) return;
    collapseElapsed += dt;
    const p = Math.min(1, collapseElapsed / BOSS_LOCAL.collapseDuration);
    anim.collapse = p;
    anim.walk = 0;
    anim.claw = 0;
    anim.charge = 0;
    pos.y = -p * (usingCrab ? CRAB.sink * k : BOSS_LOCAL.collapseSink * scale);
    applyPose();
    if (collapseElapsed >= nextBurst) {
      nextBurst += 0.5;
      bossCentre(evPos);
      evPos.x += Math.sin(collapseElapsed * 7) * 2.5 * k;
      evPos.z += Math.cos(collapseElapsed * 5) * 2.5 * k;
      vfx('explosion', evPos, 5 * k);
    }
    if (p >= 1) {
      defeatedEmitted = true;
      bossCentre(evPos);
      vfx('big-explosion', evPos, 2 * k);
      c.events.emit('boss:defeated', { position: evPos });
    }
  }

  function countMeshes(): number {
    let n = 0;
    body?.root.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh && o.visible) n++;
    });
    return n;
  }
}
