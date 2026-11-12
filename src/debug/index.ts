import type { GameModule } from '@/core/GameModule';

/**
 * Performance monitor, debug overlay and quality presets (GDD 13.9, 16).
 *
 * Placeholder: implemented by ticket T-11 (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createDebugModule(): GameModule {
  return { id: 'debug' };
}
