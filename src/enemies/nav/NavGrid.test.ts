import { describe, expect, it } from 'vitest';
import { NavGrid } from './NavGrid';

function grid(): NavGrid {
  return new NavGrid({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, 1.5);
}

function pathClear(nav: NavGrid, sx: number, sz: number, path: { x: number; z: number }[]): boolean {
  let ax = sx;
  let az = sz;
  for (const p of path) {
    if (!nav.lineWalkable(ax, az, p.x, p.z)) return false;
    ax = p.x;
    az = p.z;
  }
  return true;
}

describe('NavGrid', () => {
  it('finds a straight path on open ground', () => {
    const nav = grid();
    const path = nav.findPath(-10, -10, 10, 10);
    expect(path).not.toBeNull();
    expect(path).toHaveLength(1);
  });

  it('routes around a wall and every segment stays on walkable cells', () => {
    const nav = grid();
    nav.blockRect(-2, -15, 2, 12); // wall with a gap at the +Z end
    const path = nav.findPath(-10, 0, 10, 0);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(1);
    expect(pathClear(nav, -10, 0, path!)).toBe(true);
    for (const p of path!) expect(nav.isWalkable(p.x, p.z)).toBe(true);
  });

  it('returns null when the goal is sealed off', () => {
    const nav = grid();
    nav.blockRect(-2, -20, 2, 20);
    expect(nav.findPath(-10, 0, 10, 0)).toBeNull();
  });

  it('does not cut corners between two diagonal blocked cells', () => {
    const nav = new NavGrid({ minX: 0, maxX: 6, minZ: 0, maxZ: 6 }, 1);
    // checkerboard pair: cells (2,3) and (3,2) blocked; the diagonal (2,2)->(3,3) must be refused
    nav.setBlocked(2, 3);
    nav.setBlocked(3, 2);
    nav.blockRect(0, 0, 6, 0.5); // keep it simple: nothing else interferes
    const path = nav.findPath(2.5, 2.5, 3.5, 3.5);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(1);
    expect(pathClear(nav, 2.5, 2.5, path!)).toBe(true);
  });

  it('snaps a blocked goal to the nearest walkable cell', () => {
    const nav = grid();
    nav.blockRect(8, -2, 14, 2);
    const path = nav.findPath(-10, 0, 10, 0);
    expect(path).not.toBeNull();
    const end = path![path!.length - 1]!;
    expect(nav.isWalkable(end.x, end.z)).toBe(true);
  });

  it('raycastGrid reports where a line is first blocked', () => {
    const nav = grid();
    nav.blockRect(0, -20, 1, 20);
    expect(nav.raycastGrid(-10, 0, 10, 0)).toBeGreaterThan(0.2);
    expect(nav.raycastGrid(-10, 0, 10, 0)).toBeLessThan(0.6);
    expect(nav.raycastGrid(-10, 0, -5, 0)).toBe(1);
  });

  it('treats cells outside the grid as blocked', () => {
    const nav = grid();
    expect(nav.isWalkable(100, 0)).toBe(false);
    expect(nav.findPath(0, 0, 100, 0)?.at(-1)).toBeDefined();
  });
});
