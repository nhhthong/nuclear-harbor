import { describe, expect, it } from 'vitest';
import { WEAPON } from '@/config/tunables';
import { type WeaponInput, WeaponState } from './WeaponState';

const DT = 1 / 60;
const cfg = {
  magSize: WEAPON.magazineSize,
  startReserve: WEAPON.reserveAmmo,
  fireRate: WEAPON.fireRate,
  reloadDuration: WEAPON.reloadDuration,
  automatic: true,
  dryFireInterval: 0.25,
};
const idle: WeaponInput = { fireHeld: false, firePressed: false, reloadPressed: false };
const hold: WeaponInput = { fireHeld: true, firePressed: false, reloadPressed: false };
const reload: WeaponInput = { fireHeld: false, firePressed: false, reloadPressed: true };

function run(w: WeaponState, seconds: number, input: WeaponInput) {
  const totals = { shots: 0, dry: 0, started: 0, finished: 0 };
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    const r = w.step(DT, input);
    if (r.shot) totals.shots++;
    if (r.dryFire) totals.dry++;
    if (r.reloadStarted) totals.started++;
    if (r.reloadFinished) totals.finished++;
  }
  return totals;
}

describe('WeaponState', () => {
  it('starts with 30 + 180', () => {
    const w = new WeaponState(cfg);
    expect([w.mag, w.reserve]).toEqual([30, 180]);
  });

  it('fires 8 rounds per second while held (+-1 over 2 s)', () => {
    const w = new WeaponState(cfg);
    const { shots } = run(w, 2, hold);
    expect(shots).toBeGreaterThanOrEqual(15);
    expect(shots).toBeLessThanOrEqual(17);
    expect(w.mag).toBe(30 - shots);
  });

  it('does not fire without the trigger; semi-auto needs a fresh press', () => {
    expect(run(new WeaponState(cfg), 1, idle).shots).toBe(0);
    const semi = new WeaponState({ ...cfg, automatic: false });
    expect(run(semi, 1, hold).shots).toBe(0);
    expect(semi.step(DT, { ...idle, firePressed: true }).shot).toBe(true);
  });

  it('empties the magazine, then auto-reloads when reserve remains', () => {
    const w = new WeaponState(cfg);
    run(w, 4.5, hold);
    expect(w.mag).toBe(0);
    expect(w.reloading).toBe(true);
    expect(w.reserve).toBe(180);
  });

  it('dry-fires on empty magazine and empty reserve', () => {
    const w = new WeaponState({ ...cfg, startReserve: 0 });
    run(w, 4.5, hold);
    expect(w.mag).toBe(0);
    const t = run(w, 1, hold);
    expect(t.shots).toBe(0);
    expect(t.dry).toBeGreaterThan(0);
    expect(w.reloading).toBe(false);
  });

  it('reload takes 1.8 s and moves min(magSize - mag, reserve) rounds', () => {
    const w = new WeaponState(cfg);
    run(w, 1, hold);
    const fired = 30 - w.mag;
    expect(w.step(DT, reload).reloadStarted).toBe(true);
    const t = run(w, 1.75, idle);
    expect(w.reloading).toBe(true);
    expect(t.finished).toBe(0);
    run(w, 0.1, idle);
    expect(w.reloading).toBe(false);
    expect([w.mag, w.reserve]).toEqual([30, 180 - fired]);
  });

  it('reload cannot be interrupted by firing', () => {
    const w = new WeaponState(cfg);
    run(w, 0.5, hold);
    w.step(DT, reload);
    expect(run(w, 1.5, hold).shots).toBe(0);
    expect(w.reloading).toBe(true);
  });

  it('refuses reload when full or reserve empty', () => {
    const full = new WeaponState(cfg);
    expect(full.step(DT, reload).reloadStarted).toBe(false);
    const none = new WeaponState({ ...cfg, startReserve: 0 });
    run(none, 0.3, hold);
    expect(none.step(DT, reload).reloadStarted).toBe(false);
  });

  it('a small reserve only fills what is left', () => {
    const w = new WeaponState({ ...cfg, startReserve: 5 });
    run(w, 4.5, hold);
    expect(w.mag).toBe(0);
    run(w, 2, idle);
    expect([w.mag, w.reserve]).toEqual([5, 0]);
  });

  it('grantAmmo and ensureReserveFloor', () => {
    const w = new WeaponState(cfg);
    expect(w.grantAmmo(30)).toBe(true);
    expect(w.reserve).toBe(210);
    expect(w.grantAmmo(0)).toBe(false);
    expect(w.ensureReserveFloor(60)).toBe(false);
    w.reserve = 10;
    expect(w.ensureReserveFloor(60)).toBe(true);
    expect(w.reserve).toBe(60);
  });

  it('cancelReload aborts a reload', () => {
    const w = new WeaponState(cfg);
    run(w, 0.5, hold);
    w.step(DT, reload);
    w.cancelReload();
    expect(w.reloading).toBe(false);
  });
});
