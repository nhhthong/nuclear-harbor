import type { GameModule } from '@/core/GameModule';

/**
 * Robot framework: manager, AI scheduler, navigation, robot types (GDD 6, 13.7).
 *
 * Placeholder: implemented by ticket T-05 (framework + sphere), T-13 (spider), T-14 (charger) (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createEnemiesModule(): GameModule {
  return { id: 'enemies' };
}
