import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { GameStateId } from '@/core/types';
import { createHud, el, type Hud } from './hud';
import { createScreens, type ScreenId, type Screens } from './screens';
import { UI_CSS } from './styles';

const SCREEN_FOR_STATE: Partial<Record<GameStateId, ScreenId>> = {
  menu: 'menu',
  paused: 'pause',
  gameOver: 'gameOver',
  victory: 'victory',
};

/**
 * UI module (GDD 10): HUD, main menu, pause, settings, game over and victory screens.
 * Pure DOM + scoped CSS; communicates through events and `ctx.state` only.
 */
export function createUiModule(): GameModule {
  let style: HTMLStyleElement | null = null;
  let root: HTMLElement | null = null;
  let hud: Hud | null = null;
  let screens: Screens | null = null;
  let offs: Array<() => void> = [];
  let hudShown = false;
  let ctxRef: GameContext | null = null;

  const applyState = (state: GameStateId): void => {
    if (!hud || !screens || !ctxRef) return;
    screens.show(SCREEN_FOR_STATE[state] ?? null);
    hudShown = state === 'playing' || state === 'paused' || state === 'gameOver';
    hud.root.classList.toggle('nh-hidden', !hudShown);
    // menus need the mouse cursor
    if (state === 'menu' || state === 'gameOver' || state === 'victory') ctxRef.input.exitPointerLock();
  };

  return {
    id: 'ui',

    init(ctx: GameContext) {
      ctxRef = ctx;
      style = document.createElement('style');
      style.dataset.nhUi = '';
      style.textContent = UI_CSS;
      document.head.appendChild(style);

      root = el(ctx.uiRoot, 'div', 'nh-root');
      hud = createHud(ctx, root);
      screens = createScreens(ctx, root);

      const onKeyDown = (e: KeyboardEvent): void => {
        if (e.repeat) return;
        if (screens?.current() === 'settings' && e.code === 'Escape') {
          screens.closeSettings();
          return;
        }
        if (!ctx.settings.get('bindings').pause.includes(e.code)) return;
        if (ctx.state.is('playing')) {
          ctx.state.set('paused');
          ctx.input.exitPointerLock();
        } else if (ctx.state.is('paused') && e.code !== 'Escape' && screens?.current() === 'pause') {
          ctx.input.requestPointerLock();
          ctx.state.set('playing');
        }
      };
      document.addEventListener('keydown', onKeyDown);

      // With ?autostart the game is already 'playing' without pointer lock: lock on first click.
      const onCanvasClick = (): void => {
        if (ctx.state.is('playing')) ctx.input.requestPointerLock();
      };
      ctx.canvas.addEventListener('click', onCanvasClick);

      offs = [
        ctx.events.on('game:stateChanged', ({ to }) => applyState(to)),
        () => document.removeEventListener('keydown', onKeyDown),
        () => ctx.canvas.removeEventListener('click', onCanvasClick),
      ];

      ctx.testHooks.ui = {
        getHudText: (): Record<string, string> => hud?.getText() ?? {},
        isVisible: (screen: string): boolean =>
          screen === 'hud' ? hudShown : (screens?.isVisible(screen as ScreenId) ?? false),
      };

      applyState(ctx.state.current);
    },

    update() {
      hud?.refresh();
    },

    dispose() {
      for (const fn of offs) fn();
      offs = [];
      hud?.dispose();
      screens?.dispose();
      root?.remove();
      style?.remove();
      if (ctxRef) delete ctxRef.testHooks.ui;
      hud = null;
      screens = null;
      root = null;
      style = null;
      ctxRef = null;
    },
  };
}
