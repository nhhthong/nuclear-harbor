import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { BOSS } from '@/config/tunables';
import { BOSS_ARENA } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { BossAttackId, DamageResult } from '@/core/types';
import { BossBody, BODY_R, BODY_Y, EYE_LOCAL } from './BossBody';
import type { BodyAnim } from './BossBody';
import {
  AttackScheduler,
  angleDelta,
  clampToArena,
  inSlamDanger,
  inSplash,
  missileTargets,
  predictTarget,
  rangeIntent,
} from './BossAttacks';
import type { AttackStep, BossAttackKind, XZ } from './BossAttacks';
import { BossColliders } from './BossColliders';
import type { ZoneHandlers } from './BossColliders';
import { canSkip, cinematicFrame, newCinematicFrame } from './cinematic';
import { CinematicFx } from './CinematicFx';
import { pickLandingSpot } from './landing';
import type { LandingObstacle } from './landing';
import { QueryGroups } from '@/physics/groups';
import { BossModel, DEFAULT_BOSS_MODEL_CONFIG } from './BossModel';
import { resetArmorTextures } from './BossTextures';
import type { BossModelEvent, HitOutcome } from './BossModel';
import { BossProjectiles } from './BossProjectiles';
import type { ExplodeKind } from './BossProjectiles';
import { BOSS_LOCAL } from './tunables';

const ATTACK_IDS: readonly BossAttackKind[] = ['heavy-cannon', 'ground-slam', 'missile-barrage'];

// module-level scratch, no per-frame allocation
const evPos = new Vector3();
/** Copy of the player position for `game:checkpoint` (event payloads must not carry live vectors). */
const checkpointPos = new Vector3();
const muzzle = new Vector3();
const aim = new Vector3();
const missileFrom = new Vector3();
const missileTo = new Vector3();
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

/**
 * TITAN-04 boss fight (GDD 9). Rules live in BossModel / BossAttacks (pure, unit tested); this
 * module glues them to the scene, physics, pools and the event bus.
 */
export function createBossModule(): GameModule {
  let ctx: GameContext | null = null;
  const offs: Array<() => void> = [];
  const model = new BossModel({ ...DEFAULT_BOSS_MODEL_CONFIG, awakeningDuration: BOSS_LOCAL.cinematic.duration });
  const destroyed: boolean[] = [false, false, false, false];

  let scale = 1;
  let origin: XZ = { x: BOSS_ARENA.center.x, z: BOSS_ARENA.center.z };
  let arenaRadius: number = BOSS_ARENA.radius;
  let scheduler = new AttackScheduler(1);

  let fx: CinematicFx | null = null;
  const cin = { active: false, t: 0, impacted: false, ended: false, frame: newCinematicFrame() };
  const landing = { x: 0, z: 0, clear: true };
  const hiddenCamChildren: Array<{ o: { visible: boolean }; was: boolean }> = [];

  let body: BossBody | null = null;
  let colliders: BossColliders | null = null;
  let projectiles: BossProjectiles | null = null;

  let spawned = false;
  let spawnRequested = false;
  let bootDelay = -1;
  let elapsed = 0;
  let collapseElapsed = 0;
  let nextBurst = 0;
  let defeatedEmitted = false;

  const pos = { x: 0, y: 0, z: 0 };
  let yaw = 0;
  let walk = 0;
  const anim: BodyAnim = { walk: 0, travelled: 0, dirX: 0, dirZ: -1, slamRaise: 0, cannonCharge: 0, collapse: 0 };

  // attack in progress
  let pendingAttack: BossAttackKind | null = null;
  let telegraphTime = 0;
  let telegraphDuration = 0;
  const pendingTarget = new Vector3();
  const pendingMissiles: XZ[] = [];
  let pendingMissileCount = 0;
  const missileScratch: XZ[] = [];

  // ---- helpers -------------------------------------------------------------------------

  /** Body-space point to world space (scaled, yawed). */
  function worldPoint(local: Vector3, out: Vector3): Vector3 {
    const lx = local.x * scale;
    const ly = local.y * scale;
    const lz = local.z * scale;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return out.set(pos.x + lx * c + lz * s, pos.y + ly, pos.z - lx * s + lz * c);
  }

  function bossCentre(out: Vector3): Vector3 {
    return out.set(pos.x, pos.y + BODY_Y * scale, pos.z);
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
        case 'weakPointDamaged':
          body?.setWeakPoint(e.index, e.hp, e.maxHp);
          c.events.emit('boss:weakPointDamaged', { index: e.index, hp: e.hp, maxHp: e.maxHp });
          break;
        case 'weakPointDestroyed': {
          destroyed[e.index] = true;
          body?.setWeakPoint(e.index, 0, BOSS.weakPointHp);
          colliders?.removeWeakPoint(e.index);
          if (body) tmpLocal.copy(body.kneeRoot[e.index] ?? tmpLocal);
          worldPoint(tmpLocal, evPos);
          c.events.emit('boss:weakPointDestroyed', { index: e.index, remaining: e.remaining, position: evPos });
          vfx('explosion', evPos, 2 * scale);
          break;
        }
        case 'coreExposed':
          colliders?.addCore();
          body?.setCoreExposed(true);
          c.events.emit('boss:coreExposed', {});
          break;
        case 'coreDamaged':
          c.events.emit('boss:coreDamaged', { hp: e.hp, maxHp: e.maxHp });
          break;
        case 'defeated':
          // announced when the collapse has played (see fixedUpdate)
          break;
      }
    }
  }

  function outcome(out: HitOutcome, zone: DamageResult['zone']): DamageResult {
    handleEvents(out.events);
    return { dealt: out.dealt, zone, killed: out.killed, absorbed: out.absorbed };
  }

  const handlers: ZoneHandlers = {
    armor: (info) => outcome(model.hitArmor(info.amount), 'armor'),
    weakPoint: (i, info) => outcome(model.hitWeakPoint(i, info.amount), 'weakpoint'),
    core: (info) => outcome(model.hitCore(info.amount), 'core'),
    alive: () => model.phase !== 'destroyed',
  };

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
          const k = i === 0 ? 0 : r * 0.85;
          probe.x = x + Math.cos(a) * k;
          probe.z = z + Math.sin(a) * k;
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
    body = new BossBody(res, scale);
    c.scene.add(body.root);
    colliders = new BossColliders(c.physics, scale, handlers, body.kneeRoot, body.restBones);
    projectiles = new BossProjectiles(res, c.scene, c.physics, scale);
    fx = new CinematicFx(res, c.scene, c.uiRoot, scale);

    chooseLanding(c);
    pos.x = landing.x;
    pos.z = landing.z;
    pos.y = BOSS_LOCAL.cinematic.skyHeight * scale;
    yaw = Math.atan2(-(c.player.position.x - pos.x), -(c.player.position.z - pos.z));

    if (c.flags.params.get('bossphase') === 'core') {
      model.destroyAllWeakPointsSilently();
      for (let i = 0; i < BOSS.weakPointCount; i++) {
        destroyed[i] = true;
        body.setWeakPoint(i, 0, BOSS.weakPointHp);
        colliders.removeWeakPoint(i);
      }
    }
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
    c.events.emit('boss:spawned', { name: BOSS.name, coreHp: BOSS.coreHp, weakPoints: BOSS.weakPointCount, position: evPos });
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
    const k = dist * (1 - push);
    camPos.set(landing.x + dx * k, cfg.cameraHeight * s, landing.z + dz * k);
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

  function beginCollapse(): void {
    collapseElapsed = 0;
    nextBurst = 0;
    scheduler.reset();
    projectiles?.releaseAll();
    pendingAttack = null;
    anim.slamRaise = 0;
    anim.cannonCharge = 0;
  }

  function applyPose(): void {
    colliders?.setPose(pos.x, pos.y, pos.z, yaw);
  }

  function onRespawn(): void {
    scheduler.reset();
    projectiles?.releaseAll();
    pendingAttack = null;
    anim.slamRaise = 0;
    anim.cannonCharge = 0;
  }

  // ---- attacks -------------------------------------------------------------------------

  function startTelegraph(step: AttackStep): void {
    const c = ctx;
    if (!c || !projectiles) return;
    const player = c.player;
    pendingAttack = step.attack;
    telegraphTime = 0;
    telegraphDuration = step.duration;
    const kind: BossAttackId = step.attack;

    if (step.attack === 'heavy-cannon') {
      const t = predictTarget(player.position, player.velocity, step.duration);
      pendingTarget.set(t.x, player.position.y, t.z);
      muzzleWorld(muzzle);
      const travel = muzzle.distanceTo(pendingTarget) / BOSS.heavyCannon.projectileSpeed;
      projectiles.addMarker(pendingTarget.x, pendingTarget.y, pendingTarget.z, step.radius, step.duration + travel + 0.2, false);
      c.events.emit('boss:attackTelegraph', { attack: kind, position: pendingTarget, radius: step.radius, duration: step.duration });
    } else if (step.attack === 'ground-slam') {
      projectiles.addMarker(pos.x, pos.y, pos.z, step.radius, step.duration, true);
      evPos.set(pos.x, pos.y, pos.z);
      c.events.emit('boss:attackTelegraph', { attack: kind, position: evPos, radius: step.radius, duration: step.duration });
      vfx('telegraph-ring', evPos, step.radius);
    } else {
      const spread = BOSS_LOCAL.missile.spread * scale;
      pendingTarget.set(player.position.x, player.position.y, player.position.z);
      pendingMissileCount = step.count;
      const list = missileTargets(step.count, pendingTarget, spread, Math.random, missileScratch);
      pendingMissiles.length = 0;
      for (const p of list) {
        pendingMissiles.push({ x: p.x, z: p.z });
        projectiles.addMarker(p.x, 0, p.z, step.radius, step.duration + BOSS_LOCAL.missile.flightTime + 0.1, false);
      }
      c.events.emit('boss:attackTelegraph', { attack: kind, position: pendingTarget, radius: spread, duration: step.duration });
    }
  }

  /** The cannon fires from the eye. */
  function muzzleWorld(out: Vector3): Vector3 {
    return worldPoint(EYE_LOCAL, out);
  }

  function impact(step: AttackStep): void {
    const c = ctx;
    if (!c || !projectiles) return;
    const player = c.player;
    anim.slamRaise = 0;
    anim.cannonCharge = 0;
    pendingAttack = null;
    const kind: BossAttackId = step.attack;

    if (step.attack === 'heavy-cannon') {
      c.events.emit('boss:attack', { attack: kind, position: pendingTarget, radius: step.radius });
      muzzleWorld(muzzle);
      aim.copy(pendingTarget);
      projectiles.fireShot(muzzle, aim, BOSS.heavyCannon.projectileSpeed);
    } else if (step.attack === 'ground-slam') {
      evPos.set(pos.x, pos.y, pos.z);
      c.events.emit('boss:attack', { attack: kind, position: evPos, radius: step.radius });
      vfx('dust', evPos, step.radius);
      if (inSlamDanger(player.position, pos, step.radius, BOSS_LOCAL.groundSlam.safeHeight)) {
        blastDir.set(player.position.x - pos.x, 0, player.position.z - pos.z);
        if (blastDir.lengthSq() < 1e-6) blastDir.set(0, 0, 1);
        blastDir.normalize();
        player.applyDamage({ amount: BOSS.groundSlam.damage, zone: 'body', source: 'boss', direction: blastDir });
        impulse.copy(blastDir).multiplyScalar(BOSS_LOCAL.groundSlam.knockback);
        impulse.y = BOSS_LOCAL.groundSlam.knockbackUp;
        player.addImpulse(impulse);
      }
    } else {
      c.events.emit('boss:attack', { attack: kind, position: pendingTarget, radius: BOSS_LOCAL.missile.spread * scale });
      for (let i = 0; i < pendingMissileCount; i++) {
        const t = pendingMissiles[i];
        if (!t) continue;
        const a = (i / pendingMissileCount) * Math.PI * 2 + yaw;
        missileFrom.set(
          pos.x + Math.cos(a) * BODY_R * 0.5 * scale,
          pos.y + BOSS_LOCAL.missile.spawnHeight * scale,
          pos.z + Math.sin(a) * BODY_R * 0.5 * scale,
        );
        missileTo.set(t.x, 0, t.z);
        projectiles.fireMissile(missileFrom, missileTo, BOSS_LOCAL.missile.flightTime);
      }
    }
  }

  function onExplode(point: Vector3, kind: ExplodeKind): void {
    const c = ctx;
    if (!c) return;
    const cannon = kind === 'cannon';
    const radius = cannon ? BOSS.heavyCannon.splashRadius : BOSS.missileBarrage.splashRadius;
    const damage = cannon ? BOSS.heavyCannon.damage : BOSS.missileBarrage.damage;
    vfx('explosion', point, radius / 3);
    playerCentre.set(c.player.position.x, c.player.position.y + BOSS_LOCAL.playerCentreHeight, c.player.position.z);
    if (inSplash(point, playerCentre, radius)) {
      blastDir.copy(playerCentre).sub(point);
      if (blastDir.lengthSq() < 1e-6) blastDir.set(0, 1, 0);
      blastDir.normalize();
      c.player.applyDamage({ amount: damage, zone: 'body', source: 'boss', point, direction: blastDir });
    }
  }

  function schedulerInput(): { phase: typeof model.phase; destroyed: boolean[]; playerDistance: number } {
    const c = ctx;
    const d = c ? Math.hypot(c.player.position.x - pos.x, c.player.position.z - pos.z) : 0;
    return { phase: model.phase, destroyed, playerDistance: d };
  }

  function route(step: AttackStep | null): void {
    if (!step) return;
    if (step.kind === 'telegraph') startTelegraph(step);
    else impact(step);
  }

  // ---- module --------------------------------------------------------------------------

  return {
    id: 'boss',

    init(context) {
      ctx = context;
      const sandbox = context.flags.sandbox;
      scale = sandbox ? BOSS_LOCAL.sandbox.scale : 1;
      scheduler = new AttackScheduler(scale);
      if (sandbox) {
        origin = { x: BOSS_LOCAL.sandbox.position.x, z: BOSS_LOCAL.sandbox.position.z };
        arenaRadius = BOSS_LOCAL.sandbox.arenaRadius;
      }
      offs.push(context.events.on('objectives:allActivated', () => {
        spawnRequested = true;
      }));
      offs.push(context.events.on('game:respawn', onRespawn));
      if (context.flags.params.has('boss') || context.flags.params.has('bossphase')) bootDelay = BOSS_LOCAL.bootSpawnDelay;

      context.testHooks.boss = {
        getState: () => ({
          phase: model.phase,
          weakPoints: [...model.weakPoints],
          coreHp: model.coreHp,
          scale,
          position: { x: pos.x, y: pos.y, z: pos.z },
          spawned,
          liveShots: projectiles?.liveShots ?? 0,
          liveMissiles: projectiles?.liveMissiles ?? 0,
          droppedShots: projectiles?.droppedShots ?? 0,
          meshCount: countMeshes(),
          fxDrawCalls: fx?.drawCalls ?? 0,
          kneeWorld: body ? body.kneeRoot.map((k) => ({ ...worldPoint(k, new Vector3()) })) : [],
          yaw,
          height: body?.measuredHeight ?? 0,
          landing: { x: landing.x, z: landing.z, clear: landing.clear },
          cinematic: { active: cin.active, ended: cin.ended, t: cin.t, stage: cin.frame.stage, impacted: cin.impacted, duration: BOSS_LOCAL.cinematic.duration },
        }),
        skipCinematic: (): boolean => skipCinematic(true),
        damageWeakPoint: (i: number, amount: number): DamageResult => outcome(model.hitWeakPoint(i, amount), 'weakpoint'),
        damageCore: (amount: number): DamageResult => outcome(model.hitCore(amount), 'core'),
        forceAttack: (id: string): boolean => {
          const kind = ATTACK_IDS.find((k) => k === id);
          if (!kind) return false;
          const step = scheduler.force(kind, schedulerInput());
          route(step);
          return step !== null;
        },
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
        if (spawnRequested) spawn();
        if (!spawned) return;
      }
      elapsed += dt;
      const phase = model.phase;

      if (phase === 'destroyed') {
        collapseStep(dt);
        projectiles?.fixedStep(dt, onExplode);
        return;
      }

      if (cin.active) {
        cinematicStep(dt, c);
      } else {
        handleEvents(model.update(dt));
      }

      if (model.phase !== 'awakening' && !cin.active) {
        pos.y = 0;
        walkStep(dt, c);
        route(scheduler.update(dt, schedulerInput()));
      }

      if (pendingAttack) {
        telegraphTime += dt;
        const k = Math.min(1, telegraphTime / Math.max(0.001, telegraphDuration));
        if (pendingAttack === 'ground-slam') anim.slamRaise = k;
        else if (pendingAttack === 'heavy-cannon') anim.cannonCharge = k;
      }

      projectiles?.fixedStep(dt, onExplode);
      applyPose();
      if (body) colliders?.syncWeakPoints(body.kneeRoot);
    },

    update(dt) {
      if (!spawned || !body) return;
      const c = ctx;
      if (!c) return;
      body.root.position.set(pos.x, pos.y, pos.z);
      body.root.rotation.y = yaw;
      body.update(c.clock.simTime, dt, anim);
      anim.travelled = 0;
      projectiles?.update();
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
      projectiles = null;
      ctx = null;
    },
  };

  // ---- movement and collapse (hoisted helpers) ------------------------------------------

  function walkStep(dt: number, c: GameContext): void {
    const dx = c.player.position.x - pos.x;
    const dz = c.player.position.z - pos.z;
    const dist = Math.hypot(dx, dz);
    // turn slowly towards the player
    const target = Math.atan2(-dx, -dz);
    const maxTurn = BOSS_LOCAL.turnRate * dt;
    const delta = angleDelta(yaw, target);
    yaw += Math.max(-maxTurn, Math.min(maxTurn, delta));

    let moved = 0;
    let mx = 0;
    let mz = 0;
    const intent = rangeIntent(dist, BOSS_LOCAL.rangeMin * scale, BOSS_LOCAL.rangeMax * scale);
    if (intent !== 0 && dist > 1e-3 && !pendingAttack) {
      const step = BOSS.speed * scale * dt * intent;
      const nx = pos.x + (dx / dist) * step;
      const nz = pos.z + (dz / dist) * step;
      const clamped = clampToArena({ x: nx, z: nz }, origin, arenaRadius, BOSS_LOCAL.arenaMargin * scale);
      mx = clamped.x - pos.x;
      mz = clamped.z - pos.z;
      pos.x = clamped.x;
      pos.z = clamped.z;
      moved = Math.hypot(mx, mz);
    }
    walk += ((moved > 0 ? 1 : 0) - walk) * Math.min(1, dt * 4);
    anim.walk = walk;
    anim.travelled += moved / scale;
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
    pos.y = -p * BOSS_LOCAL.collapseSink * scale;
    applyPose();
    if (collapseElapsed >= nextBurst) {
      nextBurst += 0.5;
      bossCentre(evPos);
      evPos.x += (Math.sin(collapseElapsed * 7) * BODY_R * scale) / 2;
      evPos.z += (Math.cos(collapseElapsed * 5) * BODY_R * scale) / 2;
      vfx('explosion', evPos, 2.5 * scale);
    }
    if (p >= 1) {
      defeatedEmitted = true;
      bossCentre(evPos);
      vfx('big-explosion', evPos, scale);
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
