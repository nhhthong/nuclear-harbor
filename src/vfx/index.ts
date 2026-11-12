import type { GameModule } from '@/core/GameModule';

/**
 * Pooled particles and effects driven by events (GDD 13.4).
 *
 * Placeholder: implemented by ticket T-10 (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createVfxModule(): GameModule {
  return { id: 'vfx' };
}
