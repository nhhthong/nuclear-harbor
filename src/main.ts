import { Game } from '@/core/Game';
import { createModules } from '@/modules';
import { registerOffline } from '@/offline/register';

declare global {
  interface Window {
    /** Debug / test handle (smoke and e2e scripts read it). */
    __NH__?: {
      game: Game | null;
      ready: boolean;
      error: string | null;
      /** Dispose the running game and build a fresh one in the same page (leak check, T-17). */
      restart?: () => Promise<Game>;
    };
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game-canvas');
  const uiRoot = document.getElementById('ui-root');
  if (!(canvas instanceof HTMLCanvasElement) || !uiRoot) throw new Error('index.html is missing #game-canvas or #ui-root');

  const start = async (): Promise<Game> => {
    const game = await Game.create({ canvas, uiRoot, modules: createModules() });
    if (window.__NH__) window.__NH__.game = game;
    return game;
  };

  window.__NH__ = { game: null, ready: false, error: null };
  window.__NH__.restart = async (): Promise<Game> => {
    window.__NH__?.game?.dispose();
    if (window.__NH__) window.__NH__.game = null;
    return start();
  };
  await start();
  window.__NH__.ready = true;
  registerOffline();
}

boot().catch((error: unknown) => {
  console.error('[boot] failed to start', error);
  const message = error instanceof Error ? error.message : String(error);
  window.__NH__ = { game: null, ready: false, error: message };
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;inset:0;margin:0;padding:24px;color:#ff8a80;background:#0b0e12;white-space:pre-wrap;';
  el.textContent = `Failed to start the game.\n\n${message}`;
  document.body.appendChild(el);
});
