import type { GameModule } from '@/core/GameModule';

/**
 * Game flow: death, checkpoints, respawn, game over, victory, restart (GDD 8.2, REVIEW #7).
 *
 * Placeholder: implemented by ticket T-16 (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createFlowModule(): GameModule {
  return { id: 'flow' };
}
