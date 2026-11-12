import { Vector3 } from 'three';
import { spawnFor } from '@/config/level';
import { OBJECTIVES } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import { FlowState, mergeBest, parseBest, type BestResult } from './FlowState';
import { FLOW } from './tunables';

/**
 * Game flow: death, checkpoints, respawn, game over, victory, restart (GDD 8.2, 9.3, REVIEW #7).
 * Owned by ticket T-16. Decisions live in the pure `FlowState`; this module only wires events,
 * `ctx.state`, `ctx.player.revive` and LocalStorage.
 */

function readBest(): BestResult | null {
  try {
    return parseBest(globalThis.localStorage?.getItem(FLOW.storageKey) ?? null);
  } catch {
    return null;
  }
}

function writeBest(best: BestResult): void {
  try {
    globalThis.localStorage?.setItem(FLOW.storageKey, JSON.stringify(best));
  } catch {
    // storage unavailable (private window, quota): the run result is simply not remembered
  }
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createFlowModule(): GameModule {
  let ctx: GameContext | null = null;
  let flow: FlowState | null = null;
  let offs: Array<() => void> = [];
  /** Seconds left until `game:victory`, or null when no victory is pending. */
  let victoryTimer: number | null = null;
  /** Last known countdown value (tick or stopped event). */
  let remaining = 0;
  const scratch = new Vector3();

  function restart(): void {
    // Restart is offered from the pause menu and after a finished run. A request while the run is
    // still undecided and not paused (a game-over screen forced by someone other than flow) has
    // nothing to restart: ignore it. (T-06's e2e emits `game:over` synthetically and expects its
    // request to be observable without a reload; see docs/PLAYTEST.md issue 8.)
    if (flow && flow.status === 'running' && !ctx?.state.is('paused')) return;
    // Simple and leak-free for v1 (ticket step 3); T-17 may replace it with an in-place restart.
    globalThis.location.reload();
  }

  function overWith(reason: 'player-died' | 'countdown-expired'): void {
    if (!ctx) return;
    ctx.events.emit('game:over', { reason });
    ctx.state.set('gameOver');
  }

  function respawn(): boolean {
    if (!ctx || !flow) return false;
    const cp = flow.respawn();
    if (!cp) return false;
    ctx.player.revive({ x: cp.x, y: cp.y, z: cp.z }, cp.yaw);
    ctx.events.emit('game:respawn', { checkpointId: cp.id, position: scratch.set(cp.x, cp.y, cp.z) });
    ctx.state.set('playing');
    return true;
  }

  function completeVictory(): void {
    if (!ctx || !flow || !flow.completeVictory()) return;
    const best = mergeBest(readBest(), remaining);
    writeBest(best);
    ctx.events.emit('ui:toast', { text: `Best time remaining ${formatTime(best.bestTimeRemaining)}`, seconds: 4 });
    ctx.events.emit('game:victory', { timeRemaining: remaining });
    ctx.state.set('victory');
  }

  return {
    id: 'flow',

    init(c) {
      ctx = c;
      const spawn = spawnFor(c.flags.sandbox);
      flow = new FlowState({ id: 'spawn', x: spawn.position.x, y: spawn.position.y, z: spawn.position.z, yaw: spawn.yaw });
      victoryTimer = null;
      const raw = Number(c.flags.params.get('countdown'));
      remaining = c.flags.params.has('countdown') && Number.isFinite(raw) && raw > 0 ? raw : OBJECTIVES.countdownSeconds;

      offs = [
        c.events.on('game:checkpoint', (e) => flow?.setCheckpoint({ id: e.id, x: e.position.x, y: e.position.y, z: e.position.z, yaw: e.yaw })),
        c.events.on('player:died', () => {
          const d = flow?.onPlayerDied();
          if (d) overWith(d.over);
        }),
        c.events.on('countdown:expired', () => {
          const d = flow?.onCountdownExpired();
          if (d) overWith(d.over);
        }),
        c.events.on('countdown:tick', (e) => {
          remaining = e.remaining;
        }),
        c.events.on('countdown:stopped', (e) => {
          remaining = e.remaining;
        }),
        c.events.on('boss:defeated', () => {
          if (flow?.onBossDefeated()) victoryTimer = FLOW.victoryDelay;
        }),
        c.events.on('game:requestRespawn', () => {
          respawn();
        }),
        c.events.on('game:requestRestart', restart),
        // Menu -> Play after a finished run (Main menu button on game over / victory): fresh run.
        c.events.on('game:stateChanged', (e) => {
          if (e.from === 'menu' && e.to === 'playing' && flow && flow.status !== 'running' && flow.status !== 'victoryPending') restart();
        }),
        c.events.on('weapon:fired', () => flow?.addShot()),
        c.events.on('combat:hit', (e) => {
          if (e.targetKind !== 'player') flow?.addHit();
        }),
        c.events.on('enemy:destroyed', () => flow?.addKill()),
      ];

      c.testHooks.flow = {
        getCheckpoint: () => (flow ? { ...flow.checkpoint } : null),
        respawn: (): boolean => respawn(),
        stats: () => (flow ? flow.stats : null),
        getStatus: () => flow?.status ?? null,
        getBest: (): BestResult | null => readBest(),
      };
    },

    fixedUpdate(dt) {
      if (!flow) return;
      flow.addTime(dt);
      if (victoryTimer !== null) {
        victoryTimer -= dt;
        if (victoryTimer <= 0) {
          victoryTimer = null;
          completeVictory();
        }
      }
    },

    dispose() {
      for (const off of offs) off();
      offs = [];
      if (ctx) delete ctx.testHooks.flow;
      ctx = null;
      flow = null;
      victoryTimer = null;
    },
  };
}
