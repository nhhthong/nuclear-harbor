import type { GameModule } from '@/core/GameModule';

/**
 * TITAN-04 boss fight (GDD 9).
 *
 * Placeholder: implemented by ticket T-15 (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createBossModule(): GameModule {
  return { id: 'boss' };
}
