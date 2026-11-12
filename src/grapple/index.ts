import type { GameModule } from '@/core/GameModule';

/**
 * Grappling hook (GDD 4.1).
 *
 * Placeholder: implemented by ticket T-12 (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createGrappleModule(): GameModule {
  return { id: 'grapple' };
}
