import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { GameStateId } from '@/core/types';

/**
 * UI module (GDD 10): HUD, menus, settings.
 *
 * FOUNDATION PLACEHOLDER: a bare "click to play / paused" overlay so that the state machine and
 * pointer lock are usable. Ticket T-06 replaces this file and owns every file in this folder.
 * Keep the factory name and module id.
 */
export function createUiModule(): GameModule {
  let overlay: HTMLDivElement | null = null;
  let off: Array<() => void> = [];

  const LABELS: Partial<Record<GameStateId, string>> = {
    menu: 'LAST STAND: NUCLEAR HARBOR — click to play',
    paused: 'Paused — click to resume',
    gameOver: 'Game over',
    victory: 'Victory',
  };

  return {
    id: 'ui',

    init(ctx: GameContext) {
      overlay = document.createElement('div');
      overlay.id = 'placeholder-overlay';
      overlay.className = 'interactive';
      overlay.style.cssText =
        'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(8,10,14,0.55);font-size:20px;letter-spacing:0.04em;cursor:pointer;';
      ctx.uiRoot.appendChild(overlay);

      const refresh = (state: GameStateId): void => {
        if (!overlay) return;
        const label = LABELS[state];
        overlay.style.display = label ? 'flex' : 'none';
        overlay.textContent = label ?? '';
      };
      const onClick = (): void => {
        if (ctx.state.is('menu') || ctx.state.is('paused')) {
          ctx.input.requestPointerLock();
          ctx.state.set('playing');
        }
      };
      overlay.addEventListener('click', onClick);
      // With ?autostart the game is already 'playing' without pointer lock: lock on first click.
      const onCanvasClick = (): void => {
        if (ctx.state.is('playing')) ctx.input.requestPointerLock();
      };
      ctx.canvas.addEventListener('click', onCanvasClick);

      off = [
        ctx.events.on('game:stateChanged', ({ to }) => refresh(to)),
        () => overlay?.removeEventListener('click', onClick),
        () => ctx.canvas.removeEventListener('click', onCanvasClick),
      ];
      refresh(ctx.state.current);
    },

    dispose() {
      for (const fn of off) fn();
      off = [];
      overlay?.remove();
      overlay = null;
    },
  };
}
