import { describe, expect, it } from 'vitest';
import { PLAYER } from '@/config/tunables';
import { QueryGroups } from './groups';
import { PhysicsWorld } from './PhysicsWorld';

describe('PhysicsWorld', () => {
  it('raycasts static boxes and returns their metadata', async () => {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox({ center: { x: 0, y: -0.5, z: 0 }, halfExtents: { x: 20, y: 0.5, z: 20 } });
    physics.addStaticBox({
      center: { x: 0, y: 5, z: -10 },
      halfExtents: { x: 1, y: 5, z: 1 },
      meta: { kind: 'static', grappleable: true },
    });
    physics.syncQueries();

    const hit = physics.raycast({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: -1 }, 40, { groups: QueryGroups.grapple });
    expect(hit).not.toBeNull();
    expect(hit!.distance).toBeCloseTo(9, 3);
    expect(hit!.meta.grappleable).toBe(true);
    expect(hit!.normal.z).toBeCloseTo(1, 3);

    const down = physics.raycast({ x: 5, y: 1.6, z: 5 }, { x: 0, y: -1, z: 0 }, 10);
    expect(down?.meta.grappleable).toBeUndefined();
    expect(physics.hasLineOfSight({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -20 })).toBe(false);
    expect(physics.hasLineOfSight({ x: 5, y: 1, z: 0 }, { x: 5, y: 1, z: -20 })).toBe(true);
    physics.dispose();
  });

  it('moves a character capsule, blocked by walls and resting on the ground', async () => {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox({ center: { x: 0, y: -0.5, z: 0 }, halfExtents: { x: 20, y: 0.5, z: 20 } });
    physics.addStaticBox({ center: { x: 0, y: 2, z: -5 }, halfExtents: { x: 10, y: 2, z: 0.5 } });
    const character = physics.createCharacter({
      position: { x: 0, y: 0.5, z: 0 },
      radius: PLAYER.capsuleRadius,
      halfHeight: PLAYER.capsuleHalfHeight,
      snapToGround: PLAYER.snapToGround,
      maxStepHeight: PLAYER.maxStepHeight,
    });
    physics.syncQueries();

    const dt = 1 / 60;
    for (let i = 0; i < 180; i++) {
      character.move({ x: 0, y: -10 * dt, z: -PLAYER.walkSpeed * dt });
      physics.step(dt);
    }
    const p = character.getPosition();
    expect(character.grounded).toBe(true);
    expect(p.y).toBeGreaterThan(-0.05);
    expect(p.y).toBeLessThan(0.1);
    // wall face at z = -4.5, capsule radius 0.35 => stops around z = -4.15
    expect(p.z).toBeGreaterThan(-4.5 + PLAYER.capsuleRadius - 0.05);
    expect(p.z).toBeLessThan(-4.0);
    physics.dispose();
  });
});
