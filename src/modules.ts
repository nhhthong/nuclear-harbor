import { createAudioModule } from '@/audio';
import { createBossModule } from '@/boss';
import type { GameModule } from '@/core/GameModule';
import { createDebugModule } from '@/debug';
import { createDinosaurModule } from '@/dinosaur';
import { createEnemiesModule } from '@/enemies';
import { createFlowModule } from '@/flow';
import { createObjectivesModule } from '@/objectives';
import { createPickupsModule } from '@/pickups';
import { createPlayerModule } from '@/player';
import { createSandboxModule } from '@/sandbox';
import { createStructuresModule } from '@/structures';
import { createUiModule } from '@/ui';
import { createVfxModule } from '@/vfx';
import { createWeaponModule } from '@/weapon';
import { createWorldModule } from '@/world';

/**
 * The module registry. FOUNDATION-OWNED: feature tickets never edit this file. Every feature
 * already has its slot; a ticket only fills in `src/<feature>/index.ts`.
 *
 * Order = init order = fixedUpdate order = update order:
 *  level geometry -> player -> things that read the fresh player pose -> presentation -> flow.
 */
export function createModules(): GameModule[] {
  return [
    createSandboxModule(),
    createWorldModule(),
    createStructuresModule(),
    createPlayerModule(),
    createWeaponModule(),
    createEnemiesModule(),
    createBossModule(),
    createDinosaurModule(),
    createObjectivesModule(),
    createPickupsModule(),
    createVfxModule(),
    createAudioModule(),
    createUiModule(),
    createFlowModule(),
    createDebugModule(),
  ];
}
