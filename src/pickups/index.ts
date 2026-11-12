import type { GameModule } from '@/core/GameModule';

/**
 * Ammo crates, medkits and enemy drops (GDD 5.4).
 *
 * Placeholder: implemented by ticket T-09 (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createPickupsModule(): GameModule {
  return { id: 'pickups' };
}
