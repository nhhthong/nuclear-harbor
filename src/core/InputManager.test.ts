import { describe, expect, it } from 'vitest';
import { EventBus } from './EventBus';
import type { GameEvents } from './events';
import { DEFAULT_BINDINGS, InputManager } from './InputManager';

const make = () => new InputManager(new EventBus<GameEvents>());

describe('InputManager', () => {
  it('uses the GDD defaults with R as a reload alias (REVIEW #1)', () => {
    expect(DEFAULT_BINDINGS.fire).toEqual(['Mouse0']);
    expect(DEFAULT_BINDINGS.reload).toEqual(['Mouse2', 'KeyR']);
    expect(DEFAULT_BINDINGS.jump).toEqual(['Space']);
    expect(DEFAULT_BINDINGS.interact).toEqual(['KeyE']);
    expect(DEFAULT_BINDINGS.sprint).toContain('ShiftLeft');
  });

  it('reports held state, edges and clears edges at endFrame', () => {
    const input = make();
    input.handleCode('KeyW', true);
    expect(input.isDown('moveForward')).toBe(true);
    expect(input.wasPressed('moveForward')).toBe(true);
    input.endFrame();
    expect(input.isDown('moveForward')).toBe(true);
    expect(input.wasPressed('moveForward')).toBe(false);
    input.handleCode('KeyW', false);
    expect(input.wasReleased('moveForward')).toBe(true);
    expect(input.getMoveAxis()).toEqual({ x: 0, y: 0 });
  });

  it('keeps an action down while any alias is held', () => {
    const input = make();
    input.handleCode('Mouse2', true);
    input.handleCode('KeyR', true);
    input.handleCode('Mouse2', false);
    expect(input.isDown('reload')).toBe(true);
    input.handleCode('KeyR', false);
    expect(input.isDown('reload')).toBe(false);
  });

  it('rebinds actions', () => {
    const input = make();
    input.rebind('reload', ['KeyT']);
    input.handleCode('KeyR', true);
    expect(input.isDown('reload')).toBe(false);
    input.handleCode('KeyT', true);
    expect(input.isDown('reload')).toBe(true);
  });

  it('reads as released while disabled and accumulates look delta', () => {
    const input = make();
    input.handleCode('Mouse0', true);
    input.handleLook(3, -2);
    input.handleLook(1, 1);
    expect(input.consumeLookDelta()).toEqual({ x: 4, y: -1 });
    expect(input.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    input.enabled = false;
    expect(input.isDown('fire')).toBe(false);
  });
});
