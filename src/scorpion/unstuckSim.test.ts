import { describe, expect, it } from 'vitest';
import { ResourceTracker } from '@/assets/ResourceTracker';
import { addGround, makeTestWorld } from '@/enemies/testUtils';
import { createDecals, Scorpion, type ScorpionHooks } from './Scorpion';
import { createScorpionAssets } from './ScorpionModel';
import type { ScorpionAudio } from './scorpionAudio';
import { SCORPION } from './tunables';

const hooks: ScorpionHooks = { shake() {}, defeated() {} };
const audio = new Proxy({}, { get: () => () => undefined }) as unknown as ScorpionAudio;

/** A scorpion in the yard (x -20, z -10 is open land), the player 15 m north, walls placed by `walls`. */
async function setup(walls: Array<{ x: number; z: number; hx: number; hz: number }>, playerZ = -26): Promise<{ s: Scorpion; step: (n: number) => void }> {
  const w = await makeTestWorld({ sandbox: false });
  addGround(w.physics, 60);
  for (const b of walls) w.physics.addStaticBox({ center: { x: b.x, y: 3, z: b.z }, halfExtents: { x: b.hx, y: 3, z: b.hz } });
  w.physics.syncQueries();
  w.ctx.player.position.set(-20, 0, playerZ);
  const s = new Scorpion(w.ctx, createScorpionAssets(null), createDecals(), audio, new ResourceTracker('t'), 1, -20, -10, hooks);
  // skip the rise out of the ground
  for (let i = 0; i < Math.ceil((SCORPION.spawn.riseSeconds + 0.5) * 60); i++) s.fixedUpdate(1 / 60);
  return {
    s,
    step: (n: number) => {
      for (let i = 0; i < n; i++) {
        s.fixedUpdate(1 / 60);
        w.physics.step(1 / 60);
      }
    },
  };
}

describe('scorpion gets out of a wedge (spec 33)', () => {
  it('crawls back out of a pocket that is closed towards the player', async () => {
    // pocket: wall across the north (towards the player), side walls; open to the south
    const { s, step } = await setup([
      { x: -20, z: -14.5, hx: 6, hz: 0.5 },
      { x: -25, z: -10, hx: 0.5, hz: 5 },
      { x: -15, z: -10, hx: 0.5, hz: 5 },
    ]);
    const startZ = s.position.z;
    step(60 * 40);
    // it must have recorded at least one escape and be out of (south of) the pocket's mouth line or relocated
    expect(s.unstuckCount).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(s.position.x + s.position.z)).toBe(true);
    expect(Math.hypot(s.position.x + 20, s.position.z - startZ)).toBeGreaterThan(1);
  });

  it('is moved to a free spot when it is boxed in on every side', async () => {
    // a 4.6 m pocket around the start (the body is 4.4 m across): every heading is blocked
    const { s, step } = await setup([
      { x: -20, z: -12.8, hx: 3.5, hz: 0.5 },
      { x: -20, z: -7.2, hx: 3.5, hz: 0.5 },
      { x: -22.8, z: -10, hx: 0.5, hz: 3.5 },
      { x: -17.2, z: -10, hx: 0.5, hz: 3.5 },
    ], 60);
    // it guards a spot 20 m north of the pocket and the player is far away: it tries to walk there
    s.spot.set(-20, 0, -30);
    step(60 * 40);
    expect(s.unstuckCount).toBeGreaterThanOrEqual(1);
    const inside = s.position.x > -22.3 && s.position.x < -17.7 && s.position.z > -12.3 && s.position.z < -7.7;
    expect(inside).toBe(false);
  });
});
