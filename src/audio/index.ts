import type { GameModule } from '@/core/GameModule';

/**
 * Procedural Web Audio: all sounds are synthesised and driven by events (GDD 11).
 *
 * Placeholder: implemented by ticket T-07 (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createAudioModule(): GameModule {
  return { id: 'audio' };
}
