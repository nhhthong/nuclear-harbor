import { AnimationClip, Object3D, VectorKeyframeTrack } from 'three';
import { describe, expect, it } from 'vitest';
import { ClipPlayer } from './clipPlayer';

function rig(): { node: Object3D; player: ClipPlayer } {
  const node = new Object3D();
  node.name = 'root';
  const slide = new AnimationClip('slide', 1, [new VectorKeyframeTrack('root.position', [0, 1], [0, 0, 0, 10, 0, 0])]);
  const rise = new AnimationClip('rise', 1, [new VectorKeyframeTrack('root.position', [0, 1], [0, 0, 0, 0, 4, 0])]);
  const player = new ClipPlayer(node, new Map([['slide', slide], ['rise', rise]]));
  return { node, player };
}

describe('ClipPlayer', () => {
  it('plays a looping clip and scales its speed in place', () => {
    const { node, player } = rig();
    expect(player.play('slide', { fade: 0 })).toBe(true);
    player.update(0.25);
    expect(node.position.x).toBeCloseTo(2.5);
    player.setTimeScale(2);
    player.update(0.25);
    expect(node.position.x).toBeCloseTo(7.5);
    player.update(0.25); // wraps around
    expect(node.position.x).toBeCloseTo(2.5);
    expect(player.name).toBe('slide');
  });

  it('keeps the same action when asked again, only changing the time scale', () => {
    const { node, player } = rig();
    player.play('slide', { fade: 0 });
    player.update(0.5);
    player.play('slide', { timeScale: 0.5 });
    player.update(0.5);
    expect(node.position.x).toBeCloseTo(7.5);
  });

  it('plays a one-shot once and holds its last pose', () => {
    const { node, player } = rig();
    player.play('slide', { once: true, fade: 0 });
    player.update(0.6);
    player.update(0.6);
    expect(node.position.x).toBeCloseTo(10);
    player.update(1);
    expect(node.position.x).toBeCloseTo(10);
    expect(player.progress).toBeGreaterThanOrEqual(0);
  });

  it('can restart a one-shot that is already the active clip', () => {
    const { node, player } = rig();
    player.play('slide', { once: true, fade: 0 });
    player.update(1);
    player.play('slide', { once: true, fade: 0, restart: true });
    player.update(0.5);
    expect(node.position.x).toBeCloseTo(5);
  });

  it('cross-fades to another clip', () => {
    const { node, player } = rig();
    player.play('slide', { fade: 0 });
    player.update(0.5);
    player.play('rise', { fade: 0.4 });
    player.update(0.2);
    // half way through the fade both clips contribute
    expect(node.position.x).toBeGreaterThan(0);
    expect(node.position.y).toBeGreaterThan(0);
    player.update(0.5);
    expect(node.position.x).toBeCloseTo(0, 5);
    expect(player.name).toBe('rise');
  });

  it('plays backwards with a negative time scale', () => {
    const { node, player } = rig();
    player.play('slide', { fade: 0, timeScale: -1 });
    player.update(0.25);
    expect(node.position.x).toBeCloseTo(7.5);
  });

  it('starts a loop at a random phase when asked', () => {
    const { node, player } = rig();
    const xs = new Set<number>();
    for (let i = 0; i < 6; i++) {
      player.play(i % 2 === 0 ? 'slide' : 'rise', { fade: 0, randomPhase: true });
      player.update(0);
      xs.add(Math.round((node.position.x + node.position.y) * 1000));
    }
    expect(xs.size).toBeGreaterThan(1);
  });

  it('reports unknown clips and stops after dispose', () => {
    const { node, player } = rig();
    expect(player.play('nope')).toBe(false);
    expect(player.has('slide')).toBe(true);
    expect(player.duration('slide')).toBe(1);
    expect(player.duration('nope')).toBe(0);
    player.play('slide', { fade: 0 });
    player.dispose();
    player.update(0.5);
    expect(node.position.x).toBe(0);
    expect(player.play('slide')).toBe(false);
    player.dispose(); // idempotent
  });
});
