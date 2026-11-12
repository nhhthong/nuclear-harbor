import type { EventBus } from './EventBus';
import type { GameEvents } from './events';
import type { GameStateId } from './types';

/** Allowed transitions of the top-level game state. */
const TRANSITIONS: Record<GameStateId, readonly GameStateId[]> = {
  loading: ['menu', 'playing'],
  menu: ['playing'],
  playing: ['paused', 'gameOver', 'victory', 'menu'],
  paused: ['playing', 'menu'],
  gameOver: ['playing', 'menu'],
  victory: ['playing', 'menu'],
};

/**
 * Top-level game state. Simulation (fixedUpdate/update of modules) only runs in 'playing'.
 * Anyone may request a transition through `ctx.state.set(...)`; illegal transitions are ignored
 * and return false.
 */
export class GameStateMachine {
  private _current: GameStateId = 'loading';

  constructor(private readonly events: EventBus<GameEvents>) {}

  get current(): GameStateId {
    return this._current;
  }

  is(state: GameStateId): boolean {
    return this._current === state;
  }

  canSet(next: GameStateId): boolean {
    return next !== this._current && TRANSITIONS[this._current].includes(next);
  }

  set(next: GameStateId): boolean {
    if (!this.canSet(next)) return false;
    const from = this._current;
    this._current = next;
    this.events.emit('game:stateChanged', { from, to: next });
    return true;
  }
}
