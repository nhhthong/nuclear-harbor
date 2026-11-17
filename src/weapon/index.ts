import { Vector3 } from 'three';
import { ADS, CAMERA, WEAPON } from '@/config/tunables';
import { aimFovDeg, aimScale, stepAim } from '@/core/ads';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import { QueryGroups } from '@/physics/groups';
import { WeaponEffects } from './effects';
import { RecoilKick, SpreadModel, sampleSpread } from './recoil';
import { WEAPON_LOCAL } from './tunables';
import { createViewModel } from './viewmodel/createViewModel';
import type { ViewModel } from './viewmodel/ViewModel';
import { WeaponState, type WeaponInput, type WeaponStepResult } from './WeaponState';

const PITCH_LIMIT = Math.PI / 2 - 0.01;
const UP = new Vector3(0, 1, 0);

/**
 * Rifle: hitscan shooting, reload, ammo, spread/recoil, procedural view model and pooled effects
 * (GDD 5, 13.4). Pure logic lives in WeaponState.ts and recoil.ts.
 */
export function createWeaponModule(): GameModule {
  let ctx: GameContext | null = null;
  let state: WeaponState;
  let spread: SpreadModel;
  let recoil: RecoilKick;
  let viewModel: ViewModel | null = null;
  let effects: WeaponEffects | null = null;
  let cleanup: Array<() => void> = [];

  // edges latched in update(), consumed in fixedUpdate()
  let latchFire = false;
  let latchReload = false;
  let appliedFov: number = CAMERA.fovDeg;

  const input: WeaponInput = { fireHeld: false, firePressed: false, reloadPressed: false };
  const eye = new Vector3();
  const dir = new Vector3();
  const shotDir = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const muzzleWorld = new Vector3();
  const end = new Vector3();
  const ejectPos = new Vector3();
  const ejectVel = new Vector3();
  const tmp = new Vector3();
  const offset = { x: 0, y: 0 };

  function emitAmmo(): void {
    ctx?.events.emit('weapon:ammoChanged', {
      mag: state.mag,
      reserve: state.reserve,
      magSize: WEAPON.magazineSize,
      name: WEAPON.name,
    });
  }

  function canFire(c: GameContext): boolean {
    return c.player.alive && !c.player.controlsLocked;
  }

  function shoot(c: GameContext): void {
    c.player.getEyePosition(eye);
    c.player.getLookDirection(dir);

    // spread: perturb inside a cone around the look direction
    right.crossVectors(dir, UP);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    up.crossVectors(right, dir).normalize();
    sampleSpread(spread.currentDeg * aimScale(ADS.spreadScale, c.player.aimAmount), Math.random(), Math.random(), offset);
    shotDir.copy(dir).addScaledVector(right, offset.x).addScaledVector(up, offset.y).normalize();

    const hit = c.physics.raycast(eye, shotDir, WEAPON.range, { groups: QueryGroups.playerShot });

    c.events.emit('weapon:fired', { origin: eye, direction: shotDir, mag: state.mag, reserve: state.reserve });

    if (viewModel) {
      viewModel.object3d.updateWorldMatrix(true, false);
      muzzleWorld.copy(viewModel.muzzleLocalPosition);
      viewModel.object3d.localToWorld(muzzleWorld);
    } else {
      muzzleWorld.copy(eye);
    }
    if (hit) end.copy(hit.point);
    else end.copy(eye).addScaledVector(shotDir, WEAPON_LOCAL.effects.missTracerLength);
    effects?.spawnTracer(muzzleWorld, end);

    if (hit) {
      const target = hit.meta.damageable;
      if (target?.alive) {
        const result = target.applyDamage({
          amount: WEAPON.damage,
          zone: hit.meta.hitZone ?? 'body',
          source: 'player',
          point: hit.point,
          direction: shotDir,
        });
        c.events.emit('combat:hit', {
          targetId: target.id,
          targetKind: target.kind,
          zone: result.zone,
          dealt: result.dealt,
          killed: result.killed,
          absorbed: result.absorbed,
          point: hit.point,
          normal: hit.normal,
        });
      } else {
        c.events.emit('combat:impact', { point: hit.point, normal: hit.normal });
      }
    }

    // recoil + spread growth + presentation
    const kick = recoil.onShot(Math.random());
    const kickScale = aimScale(ADS.recoilScale, c.player.aimAmount);
    c.player.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, c.player.pitch + kick.pitchRad * kickScale));
    c.player.yaw += kick.yawRad * kickScale;
    spread.onShot();

    if (viewModel && effects) {
      viewModel.playFire();
      effects.spawnFlash(viewModel.muzzleLocalPosition);
      ejectPos.copy(viewModel.ejectionLocalPosition);
      viewModel.object3d.localToWorld(ejectPos);
      tmp.set(1, 0, 0).applyQuaternion(c.camera.quaternion);
      ejectVel.copy(tmp).multiplyScalar(
        WEAPON_LOCAL.effects.casingSpeedMin +
          Math.random() * (WEAPON_LOCAL.effects.casingSpeedMax - WEAPON_LOCAL.effects.casingSpeedMin),
      );
      ejectVel.y += 1.2 + Math.random() * 0.8;
      ejectVel.addScaledVector(c.player.velocity, 0.5);
      effects.spawnCasing(ejectPos, ejectVel);
    }
  }

  function handle(c: GameContext, r: WeaponStepResult): void {
    if (r.reloadStarted) {
      viewModel?.playReload(WEAPON.reloadDuration);
      c.events.emit('weapon:reloadStarted', { duration: WEAPON.reloadDuration });
    }
    if (r.shot) shoot(c);
    if (r.dryFire) c.events.emit('weapon:dryFire', {});
    if (r.reloadFinished) c.events.emit('weapon:reloadFinished', { mag: state.mag, reserve: state.reserve });
    if (r.changed) emitAmmo();
  }

  return {
    id: 'weapon',

    init(context: GameContext) {
      ctx = context;
      const c = context;
      const res = c.resources.scope('weapon');
      state = new WeaponState({
        magSize: WEAPON.magazineSize,
        startReserve: WEAPON.reserveAmmo,
        fireRate: WEAPON.fireRate,
        reloadDuration: WEAPON.reloadDuration,
        automatic: WEAPON.automatic,
        dryFireInterval: WEAPON_LOCAL.dryFireInterval,
      });
      spread = new SpreadModel(
        {
          minDeg: WEAPON.spreadMinDeg,
          maxDeg: WEAPON.spreadMaxDeg,
          perShotDeg: WEAPON.spreadPerShotDeg,
          recoveryDegPerSec: WEAPON.spreadRecoveryDegPerSec,
        },
        WEAPON_LOCAL,
      );
      recoil = new RecoilKick({
        pitchDeg: WEAPON.recoilPitchDeg,
        yawDeg: WEAPON.recoilYawDeg,
        recoveryPerSec: WEAPON.recoilRecoveryPerSec,
        recoverFraction: WEAPON_LOCAL.recoilRecoverFraction,
      });

      viewModel = createViewModel(res, c.flags.params);
      c.camera.add(viewModel.object3d);
      effects = new WeaponEffects(c.scene, viewModel.object3d, res);

      cleanup = [
        c.events.on('world:ready', () => emitAmmo()),
        c.events.on('weapon:grantAmmo', ({ amount }) => {
          if (state.grantAmmo(amount)) emitAmmo();
        }),
        c.events.on('game:respawn', () => {
          state.cancelReload();
          recoil.reset();
          latchFire = false;
          latchReload = false;
          state.ensureReserveFloor(WEAPON_LOCAL.respawnReserveFloor);
          emitAmmo();
        }),
        c.events.on('player:died', () => {
          state.cancelReload();
          latchFire = false;
          latchReload = false;
        }),
      ];

      c.testHooks.weapon = {
        getAmmo: () => ({ mag: state.mag, reserve: state.reserve }),
        isReloading: () => state.reloading,
        fireOnce: (): boolean => {
          if (!canFire(c)) return false;
          const r = state.step(0, { fireHeld: false, firePressed: true, reloadPressed: false });
          const shot = r.shot;
          handle(c, r);
          return shot;
        },
        getEffects: () => effects?.liveCounts,
        getSpreadDeg: () => spread.currentDeg,
      };
    },

    update(dt: number) {
      const c = ctx;
      if (!c || !viewModel || !effects) return;
      if (c.input.wasPressed('fire')) latchFire = true;
      if (c.input.wasPressed('reload')) latchReload = true;

      const free = canFire(c);
      viewModel.object3d.visible = free;
      const wantAim = free && !state.reloading && c.input.isDown('aim');
      c.player.aimAmount = stepAim(c.player.aimAmount, wantAim ? 1 : 0, dt);
      const fov = aimFovDeg(c.player.aimAmount);
      if (Math.abs(fov - appliedFov) > 1e-3) {
        appliedFov = fov;
        c.camera.fov = fov;
        c.camera.updateProjectionMatrix();
      }
      viewModel.update(dt, {
        speed: Math.hypot(c.player.velocity.x, c.player.velocity.z),
        sprinting: c.player.sprinting,
        time: c.clock.simTime,
        aim: c.player.aimAmount,
      });
      effects.update(dt);
    },

    fixedUpdate(dt: number) {
      const c = ctx;
      if (!c) return;
      if (!canFire(c)) {
        latchFire = false;
        latchReload = false;
        c.player.aimAmount = 0;
        spread.update(dt, { sprinting: false, moving: false });
        return;
      }
      const speed = Math.hypot(c.player.velocity.x, c.player.velocity.z);
      spread.update(dt, {
        sprinting: c.player.sprinting,
        moving: speed > WEAPON_LOCAL.moveSpeedThreshold,
      });
      const back = recoil.recover(dt);
      const backScale = aimScale(ADS.recoilScale, c.player.aimAmount);
      c.player.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, c.player.pitch + back.pitchRad * backScale));
      c.player.yaw += back.yawRad * backScale;

      input.fireHeld = c.input.isDown('fire');
      input.firePressed = latchFire;
      input.reloadPressed = latchReload;
      input.autoReload = c.settings.get('autoReload');
      latchFire = false;
      latchReload = false;
      handle(c, state.step(dt, input));
    },

    dispose() {
      for (const off of cleanup) off();
      cleanup = [];
      effects?.dispose();
      effects = null;
      viewModel?.dispose();
      viewModel = null;
      if (ctx) {
        ctx.player.aimAmount = 0;
        ctx.camera.fov = CAMERA.fovDeg;
        ctx.camera.updateProjectionMatrix();
        delete ctx.testHooks.weapon;
        ctx.resources.scope('weapon').dispose();
      }
      ctx = null;
    },
  };
}
