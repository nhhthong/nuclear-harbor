import type { GameContext } from '@/core/GameContext';
import { ALL_ACTIONS, type Action } from '@/core/InputManager';
import type { GameOverReason } from '@/core/types';
import type { QualityPreset } from '@/config/tunables';
import { CREDITS } from './credits';
import { codeLabel, formatCountdown } from './format';
import { el } from './hud';

export type ScreenId = 'menu' | 'pause' | 'settings' | 'credits' | 'gameOver' | 'victory';

const ACTION_LABELS: Record<Action, string> = {
  moveForward: 'Move forward',
  moveBackward: 'Move backward',
  moveLeft: 'Move left',
  moveRight: 'Move right',
  fire: 'Fire',
  reload: 'Reload',
  jump: 'Jump / double jump',
  sprint: 'Sprint',
  interact: 'Interact / hold',
  pause: 'Pause',
  debugToggle: 'Debug overlay',
};

const REASON_TEXT: Record<GameOverReason, string> = {
  'player-died': 'You were destroyed',
  'countdown-expired': 'The reactor countdown reached zero',
};

const FPS_CAPS = [0, 30, 60, 120] as const;

export interface Screens {
  readonly root: HTMLElement;
  show(id: ScreenId | null): void;
  /** Currently visible screen (settings counts as its own screen). */
  current(): ScreenId | null;
  isVisible(id: ScreenId): boolean;
  openSettings(): void;
  closeSettings(): void;
  dispose(): void;
}

export function createScreens(ctx: GameContext, parent: HTMLElement): Screens {
  const root = el(parent, 'div', 'nh-screens');
  const offs: Array<() => void> = [];
  const listen = (
    target: EventTarget,
    type: string,
    handler: (e: never) => void,
    options?: boolean | AddEventListenerOptions,
  ): void => {
    target.addEventListener(type, handler as EventListener, options);
    offs.push(() => target.removeEventListener(type, handler as EventListener, options));
  };

  const button = (parentEl: HTMLElement, label: string, onClick: () => void, id?: string): HTMLButtonElement => {
    const b = el(parentEl, 'button', 'nh-btn interactive', label);
    b.type = 'button';
    if (id) b.dataset.action = id;
    listen(b, 'click', onClick);
    return b;
  };
  const screen = (id: ScreenId, className = ''): HTMLElement => {
    const s = el(root, 'div', `nh-screen nh-hidden ${className}`.trim());
    s.dataset.screen = id;
    return s;
  };

  const resumeGame = (): void => {
    ctx.input.requestPointerLock();
    ctx.state.set('playing');
  };
  /**
   * Ask the flow module to act. The flow module owns the state change (respawn sets `playing`,
   * restart reloads); the UI never forces `playing` itself, so a refused request changes nothing.
   * If flow did resume the game, grab the pointer (this runs inside the click gesture).
   */
  const request = (event: 'game:requestRespawn' | 'game:requestRestart'): void => {
    ctx.events.emit(event, {});
    if (ctx.state.is('playing')) ctx.input.requestPointerLock();
  };

  // ---- main menu ----
  const menu = screen('menu');
  el(menu, 'div', 'nh-title', 'Last Stand');
  el(menu, 'div', 'nh-sub', 'Nuclear Harbor');
  button(menu, 'Play', resumeGame, 'play');
  button(menu, 'Settings', () => openSettings(), 'settings');
  button(menu, 'Credits', () => show('credits'), 'credits');
  const controls = el(menu, 'div', 'nh-controls');
  const renderControls = (): void => {
    controls.textContent = '';
    const b = ctx.input.getBindings();
    for (const action of ALL_ACTIONS) {
      if (action === 'debugToggle') continue;
      el(controls, 'span', '', ACTION_LABELS[action]);
      el(controls, 'b', '', b[action].map(codeLabel).join(' / '));
    }
  };

  // ---- pause ----
  const pause = screen('pause');
  el(pause, 'div', 'nh-title', 'Paused');
  button(pause, 'Resume', resumeGame, 'resume');
  button(pause, 'Settings', () => openSettings(), 'settings');
  button(pause, 'Restart', () => request('game:requestRestart'), 'restart');
  button(pause, 'Quit to menu', () => ctx.state.set('menu'), 'quit');

  // ---- game over ----
  const over = screen('gameOver');
  el(over, 'div', 'nh-title', 'Game over');
  const reason = el(over, 'div', 'nh-reason');
  const respawnBtn = button(over, 'Respawn at checkpoint', () => request('game:requestRespawn'), 'respawn');
  button(over, 'Restart', () => request('game:requestRestart'), 'restart');
  button(over, 'Main menu', () => ctx.state.set('menu'), 'quit');

  // ---- victory ----
  const victory = screen('victory');
  el(victory, 'div', 'nh-title', 'Victory');
  const timeLine = el(victory, 'div', 'nh-reason');
  timeLine.style.color = '#7dffb0';
  button(victory, 'Restart', () => request('game:requestRestart'), 'restart');
  button(victory, 'Main menu', () => ctx.state.set('menu'), 'quit');

  // ---- settings ----
  const settings = screen('settings', 'nh-settings');
  el(settings, 'div', 'nh-title', 'Settings');
  const syncers: Array<() => void> = [];

  const sliderRow = (
    label: string,
    key: 'mouseSensitivity' | 'masterVolume',
    min: number,
    max: number,
    step: number,
    fmt: (v: number) => string,
  ): void => {
    const row = el(settings, 'label', 'nh-row');
    el(row, 'span', '', label);
    const input = el(row, 'input', 'interactive');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.dataset.setting = key;
    const out = el(row, 'span', '');
    listen(input, 'input', () => {
      ctx.settings.set(key, Number(input.value));
      out.textContent = fmt(Number(input.value));
    });
    syncers.push(() => {
      const v = ctx.settings.get(key);
      input.value = String(v);
      out.textContent = fmt(v);
    });
  };
  sliderRow('Mouse sensitivity', 'mouseSensitivity', 0.2, 3, 0.05, (v) => v.toFixed(2));
  sliderRow('Master volume', 'masterVolume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`);

  const selectRow = (label: string, key: 'quality' | 'fpsCap', options: Array<[string, string]>): void => {
    const row = el(settings, 'label', 'nh-row');
    el(row, 'span', '', label);
    const select = el(row, 'select', 'interactive');
    select.dataset.setting = key;
    for (const [value, text] of options) {
      const o = el(select, 'option', '', text);
      o.value = value;
    }
    el(row, 'span', '');
    listen(select, 'change', () => {
      if (key === 'quality') ctx.settings.set('quality', select.value as QualityPreset);
      else ctx.settings.set('fpsCap', Number(select.value) as (typeof FPS_CAPS)[number]);
    });
    syncers.push(() => {
      select.value = String(ctx.settings.get(key));
    });
  };
  selectRow(
    'Graphics quality',
    'quality',
    Object.keys(ctx.tunables.PERFORMANCE.quality).map((q) => [q, q.charAt(0).toUpperCase() + q.slice(1)]),
  );
  selectRow(
    'FPS cap',
    'fpsCap',
    FPS_CAPS.map((c) => [String(c), c === 0 ? 'Uncapped' : String(c)]),
  );

  // key rebinding
  const binds = el(settings, 'div', 'nh-binds');
  const keyButtons = new Map<Action, HTMLButtonElement>();
  let listening: { action: Action; btn: HTMLButtonElement } | null = null;
  const syncBindLabels = (): void => {
    const b = ctx.settings.get('bindings');
    for (const [action, btn] of keyButtons) btn.textContent = (b[action] ?? []).map(codeLabel).join(' / ') || '-';
  };
  const stopListening = (): void => {
    if (!listening) return;
    listening.btn.classList.remove('listening');
    listening = null;
    syncBindLabels();
  };
  const applyBinding = (code: string): void => {
    if (!listening) return;
    const { action } = listening;
    const next = ctx.input.getBindings();
    next[action] = [code];
    ctx.input.rebind(action, [code]);
    ctx.settings.set('bindings', next);
    stopListening();
  };
  for (const action of ALL_ACTIONS) {
    const row = el(binds, 'div', 'nh-row');
    el(row, 'span', '', ACTION_LABELS[action]);
    const btn = el(row, 'button', 'nh-key interactive');
    btn.type = 'button';
    btn.dataset.bind = action;
    keyButtons.set(action, btn);
    listen(btn, 'click', (e: MouseEvent) => {
      e.stopPropagation();
      stopListening();
      listening = { action, btn };
      btn.classList.add('listening');
      btn.textContent = 'press a key or mouse button';
    });
  }
  // capture phase so a rebinding key never reaches the pause handler or the game
  listen(
    document,
    'keydown',
    (e: KeyboardEvent) => {
      if (!listening) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') stopListening();
      else applyBinding(e.code);
    },
    true,
  );
  listen(
    document,
    'mousedown',
    (e: MouseEvent) => {
      if (!listening || e.target === listening.btn) return;
      e.preventDefault();
      e.stopPropagation();
      applyBinding(`Mouse${e.button}`);
    },
    true,
  );

  button(
    settings,
    'Reset to defaults',
    () => {
      stopListening();
      ctx.settings.resetToDefaults();
      ctx.input.setBindings(ctx.settings.get('bindings'));
    },
    'reset',
  );
  button(settings, 'Back', () => closeSettings(), 'back');

  const syncSettings = (): void => {
    for (const s of syncers) s();
    syncBindLabels();
  };
  offs.push(
    ctx.events.on('settings:changed', () => {
      if (current === 'settings') syncSettings();
    }),
  );

  // ---- credits ----
  const credits = screen('credits', 'nh-credits');
  el(credits, 'div', 'nh-title', 'Credits');
  for (const c of CREDITS) {
    const row = el(credits, 'div', 'nh-credit');
    el(row, 'b', '', c.name);
    el(row, 'span', '', ` - ${c.role}`);
    if (c.note) el(row, 'div', 'nh-credit-note', c.note);
  }
  button(credits, 'Back', () => show('menu'), 'back');

  // ---- show/hide ----
  const all: Record<ScreenId, HTMLElement> = { menu, pause, settings, credits, gameOver: over, victory };
  let current: ScreenId | null = null;
  let settingsReturn: ScreenId | null = null;

  const show = (id: ScreenId | null): void => {
    stopListening();
    current = id;
    for (const key of Object.keys(all) as ScreenId[]) all[key].classList.toggle('nh-hidden', key !== id);
    if (id === 'menu') renderControls();
    if (id === 'settings') syncSettings();
    if (id === 'gameOver') {
      // reason text is set by setGameOver
    }
    if (id) {
      const first = all[id].querySelector<HTMLElement>('button.nh-btn');
      first?.focus({ preventScroll: true });
    }
  };
  function openSettings(): void {
    if (current === 'settings') return;
    settingsReturn = current;
    show('settings');
  }
  function closeSettings(): void {
    if (current !== 'settings') return;
    show(settingsReturn ?? 'menu');
    settingsReturn = null;
  }

  const setGameOver = (r: GameOverReason): void => {
    reason.textContent = REASON_TEXT[r];
    respawnBtn.classList.toggle('nh-hidden', r !== 'player-died');
  };
  const setVictory = (timeRemaining: number): void => {
    timeLine.textContent = `Time remaining ${formatCountdown(timeRemaining)}`;
  };
  offs.push(ctx.events.on('game:over', (e) => setGameOver(e.reason)));
  offs.push(ctx.events.on('game:victory', (e) => setVictory(e.timeRemaining)));
  setGameOver('player-died');
  setVictory(0);

  return {
    root,
    show,
    current: () => current,
    isVisible: (id) => current === id,
    openSettings,
    closeSettings,
    dispose() {
      for (const off of offs) off();
      offs.length = 0;
      listening = null;
      root.remove();
    },
  };
}
