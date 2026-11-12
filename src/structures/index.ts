import type { GameModule } from '@/core/GameModule';

/**
 * Cranes, beams, lamp posts, perches and grapple anchors + coverage debug (GDD 7.4).
 *
 * Placeholder: implemented by ticket T-04 (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createStructuresModule(): GameModule {
  return { id: 'structures' };
}
