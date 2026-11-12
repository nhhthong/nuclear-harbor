import { describe, expect, it } from 'vitest';
import { WEAPON } from '@/config/tunables';
import { RecoilKick, SpreadModel, sampleSpread } from './recoil';
import { WEAPON_LOCAL } from './tunables';

const still = { sprinting: false, moving: false };
const spreadCfg = {
  minDeg: WEAPON.spreadMinDeg,
  maxDeg: WEAPON.spreadMaxDeg,
  perShotDeg: WEAPON.spreadPerShotDeg,
  recoveryDegPerSec: WEAPON.spreadRecoveryDegPerSec,
};

describe('SpreadModel', () => {
  it('grows per shot up to the max and recovers over time', () => {
    const s = new SpreadModel(spreadCfg, WEAPON_LOCAL);
    expect(s.currentDeg).toBe(WEAPON.spreadMinDeg);
    for (let i = 0; i < 100; i++) s.onShot();
    expect(s.currentDeg).toBe(WEAPON.spreadMaxDeg);
    s.update(0.1, still);
    expect(s.currentDeg).toBeCloseTo(WEAPON.spreadMaxDeg - 0.6, 5);
    for (let i = 0; i < 60; i++) s.update(0.1, still);
    expect(s.currentDeg).toBe(WEAPON.spreadMinDeg);
  });

  it('is larger while moving and sprinting', () => {
    const s = new SpreadModel(spreadCfg, WEAPON_LOCAL);
    s.update(0.016, still);
    const base = s.currentDeg;
    s.update(0.016, { sprinting: false, moving: true });
    const moving = s.currentDeg;
    s.update(0.016, { sprinting: true, moving: true });
    expect(moving).toBeGreaterThan(base);
    expect(s.currentDeg).toBeGreaterThan(moving);
    expect(s.currentDeg).toBeLessThanOrEqual(WEAPON.spreadMaxDeg);
  });
});

describe('sampleSpread', () => {
  it('stays inside the cone', () => {
    const out = { x: 0, y: 0 };
    const maxR = Math.tan((2 * Math.PI) / 180);
    for (let i = 0; i < 200; i++) {
      sampleSpread(2, Math.random(), Math.random(), out);
      expect(Math.hypot(out.x, out.y)).toBeLessThanOrEqual(maxR + 1e-9);
    }
    sampleSpread(2, 0, 0.3, out);
    expect(Math.hypot(out.x, out.y)).toBe(0);
  });
});

describe('RecoilKick', () => {
  const cfg = {
    pitchDeg: WEAPON.recoilPitchDeg,
    yawDeg: WEAPON.recoilYawDeg,
    recoveryPerSec: WEAPON.recoilRecoveryPerSec,
    recoverFraction: WEAPON_LOCAL.recoilRecoverFraction,
  };

  it('kicks up per shot with yaw inside the configured bound', () => {
    const k = new RecoilKick(cfg);
    const kick = k.onShot(1);
    expect(kick.pitchRad).toBeCloseTo((WEAPON.recoilPitchDeg * Math.PI) / 180, 8);
    expect(Math.abs(kick.yawRad)).toBeLessThanOrEqual((WEAPON.recoilYawDeg * Math.PI) / 180 + 1e-9);
  });

  it('recovers only its own accumulated share', () => {
    const k = new RecoilKick(cfg);
    let net = 0;
    for (let i = 0; i < 10; i++) net += k.onShot(0.5).pitchRad;
    for (let i = 0; i < 120; i++) net += k.recover(1 / 60).pitchRad;
    const total = (10 * WEAPON.recoilPitchDeg * Math.PI) / 180;
    expect(net).toBeCloseTo(total * (1 - cfg.recoverFraction), 4);
    expect(k.pendingPitchRad).toBeLessThan(1e-4);
  });
});
