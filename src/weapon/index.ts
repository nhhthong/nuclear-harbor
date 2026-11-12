import type { GameModule } from '@/core/GameModule';

/**
 * Rifle: shooting, reload, ammo, recoil, procedural view model (GDD 5).
 *
 * Placeholder: implemented by ticket T-02 (docs/tickets). The ticket owns every file in this folder.
 * Keep the factory name and module id: src/modules.ts depends on them.
 */
export function createWeaponModule(): GameModule {
  return { id: 'weapon' };
}
