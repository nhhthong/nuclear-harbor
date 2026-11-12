import type { GameModule } from '@/core/GameModule';

/**
 * Four activation towers and the nuclear countdown (GDD 8).
 *
 * Placeholder: implemented by ticket T-08 (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createObjectivesModule(): GameModule {
  return { id: 'objectives' };
}
