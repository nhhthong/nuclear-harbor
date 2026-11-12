import type { GameModule } from '@/core/GameModule';

/**
 * Harbor greybox: ground, containers, warehouse, dock, ocean, lighting, ship backdrop (GDD 7).
 *
 * Placeholder: implemented by ticket T-03 (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createWorldModule(): GameModule {
  return { id: 'world' };
}
