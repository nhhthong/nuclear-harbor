import { describe, expect, it } from 'vitest';
import { isBoxedIn, pickEscapeHeading, StuckTracker } from './unstuck';

describe('StuckTracker', () => {
  it('fires once when a walker that wants to move stays put for the window', () => {
    const t = new StuckTracker(3, 1);
    let fired = 0;
    for (let i = 0; i < 400; i++) if (t.update(0.0167, true, 5, 5)) fired++;
    expect(fired).toBeGreaterThanOrEqual(1);
    expect(fired).toBeLessThanOrEqual(2);
  });

  it('does not fire while it makes progress', () => {
    const t = new StuckTracker(3, 1);
    for (let i = 0; i < 600; i++) expect(t.update(0.0167, true, i * 0.07, 0)).toBe(false);
  });

  it('does not fire when it does not want to move (standing, attacking)', () => {
    const t = new StuckTracker(3, 1);
    for (let i = 0; i < 600; i++) expect(t.update(0.0167, false, 5, 5)).toBe(false);
  });

  it('pauses while it is not trying to walk, so short walking spells between skills add up', () => {
    const t = new StuckTracker(3, 1);
    let fired = false;
    for (let spell = 0; spell < 4 && !fired; spell++) {
      for (let i = 0; i < 60; i++) fired = t.update(0.0167, true, 0, 0) || fired; // 1 s of trying
      for (let i = 0; i < 300; i++) expect(t.update(0.0167, false, 0, 0)).toBe(false); // 5 s of skill
    }
    expect(fired).toBe(true);
  });
});

describe('pickEscapeHeading', () => {
  it('takes the clearest heading', () => {
    expect(pickEscapeHeading([1, 1, 6, 1, 1, 1, 1, 1], 0)).toBe(2);
  });

  it('among equally open headings prefers the one nearest the preferred index', () => {
    // 8 headings, 3 and 7 are both open; preferring 6 picks 7
    expect(pickEscapeHeading([1, 1, 1, 5, 1, 1, 1, 5], 6)).toBe(7);
  });

  it('wraps around the ring when measuring distance', () => {
    expect(pickEscapeHeading([5, 1, 1, 1, 1, 1, 1, 5], 7)).toBe(7);
    expect(pickEscapeHeading([5, 1, 1, 1, 1, 1, 1, 1], 7)).toBe(0);
  });
});

describe('isBoxedIn', () => {
  it('is true when every heading is shorter than needed', () => {
    expect(isBoxedIn([0.2, 0.4, 0.1], 1)).toBe(true);
    expect(isBoxedIn([0.2, 3, 0.1], 1)).toBe(false);
  });
});
