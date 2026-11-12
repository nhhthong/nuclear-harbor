import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import { OBJECTIVES } from '@/config/tunables';
import { NuclearCountdown } from './NuclearCountdown';
import { TowerManager } from './TowerManager';

/**
 * Four activation towers and the nuclear countdown (GDD 8). Ticket T-08.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createObjectivesModule(): GameModule {
  let ctx: GameContext | null = null;
  let towers: TowerManager | null = null;
  let countdown: NuclearCountdown | null = null;
  let stopped = false;
  const offs: Array<() => void> = [];

  function stopCountdown(): void {
    if (!ctx || !countdown || stopped || countdown.isExpired) return;
    stopped = true;
    countdown.stop();
    ctx.events.emit('countdown:stopped', { remaining: countdown.remaining });
    ctx.events.emit('objectives:allActivated', { timeRemaining: countdown.remaining });
  }

  return {
    id: 'objectives',

    init(c) {
      ctx = c;
      const res = c.resources.scope('objectives');
      towers = new TowerManager(c, res);
      towers.onAllActivated = stopCountdown;

      const raw = Number(c.flags.params.get('countdown'));
      const seconds = c.flags.params.has('countdown') && Number.isFinite(raw) && raw > 0 ? raw : OBJECTIVES.countdownSeconds;
      countdown = new NuclearCountdown(seconds, OBJECTIVES.countdownCriticalSeconds);

      const pre = Number(c.flags.params.get('towers'));
      offs.push(
        c.events.on('world:ready', () => {
          towers?.registerAll();
          if (c.flags.params.has('towers') && Number.isFinite(pre)) {
            const n = Math.min(Math.max(0, Math.floor(pre)), towers?.total ?? 0);
            const ids = towers?.getState().map((t) => t.id) ?? [];
            for (let i = 0; i < n; i++) towers?.forceActivate(ids[i]!);
          }
        }),
        c.events.on('player:died', () => towers?.onPlayerDied()),
        // game:respawn intentionally does NOT reset the countdown (REVIEW #7)
      );
      res.onDispose(() => {
        for (const off of offs.splice(0)) off();
      });

      c.testHooks.objectives = {
        getState: () => ({ towers: towers?.getState() ?? [], remaining: countdown?.remaining ?? 0 }),
        forceActivate: (id: number) => towers?.forceActivate(id) ?? false,
        setRemaining: (s: number) => countdown?.setRemaining(s),
      };
    },

    fixedUpdate(dt) {
      if (!ctx || !towers || !countdown) return;
      towers.fixedUpdate(dt);
      const step = countdown.step(dt);
      for (const t of step.ticks) ctx.events.emit('countdown:tick', t);
      if (step.expired) ctx.events.emit('countdown:expired', {});
    },

    update(dt) {
      towers?.update(dt);
    },

    dispose() {
      for (const off of offs.splice(0)) off();
      if (ctx) ctx.player.damageTakenMultiplier = 1;
      ctx = null;
      towers = null;
      countdown = null;
    },
  };
}
