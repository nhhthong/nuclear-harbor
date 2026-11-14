import type { EventBus } from './EventBus';
import type { GameEvents } from './events';

/**
 * Logical actions (GDD 4). Physical inputs are identified by `KeyboardEvent.code` strings
 * ('KeyW', 'Space', 'ShiftLeft', ...) or 'Mouse0' / 'Mouse1' / 'Mouse2' for mouse buttons.
 */
export type Action =
  | 'moveForward'
  | 'moveBackward'
  | 'moveLeft'
  | 'moveRight'
  | 'fire'
  | 'reload'
  | 'jump'
  | 'sprint'
  | 'interact'
  | 'pause'
  | 'debugToggle';

export type Bindings = Record<Action, string[]>;

/** GDD 4 defaults. REVIEW #1: right mouse reloads (GDD), `R` is an alias. Space jumps (double jump); the grapple was removed. */
export const DEFAULT_BINDINGS: Bindings = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBackward: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  fire: ['Mouse0'],
  reload: ['Mouse2', 'KeyR'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  pause: ['Escape', 'KeyP'],
  debugToggle: ['F3', 'Backquote'],
};

export const ALL_ACTIONS = Object.keys(DEFAULT_BINDINGS) as Action[];

function mouseButtonCode(button: number): string {
  return `Mouse${button}`;
}

/**
 * Keyboard + mouse state with rebindable actions and pointer lock.
 *
 * Frame protocol (driven by Game): `endFrame()` is called once after all module updates of a
 * rendered frame; it clears the edge flags (`wasPressed` / `wasReleased`) and the look delta.
 *
 *  - Held state (`isDown`) may be read anywhere, including fixedUpdate.
 *  - Edges (`wasPressed`, `wasReleased`) and `consumeLookDelta()` must be read in `update()`
 *    (once per rendered frame), never in fixedUpdate (which runs 0..n times per frame).
 *
 * The class is DOM-free until `attach()` is called, so binding logic is unit-testable in Node
 * through `handleCode()`.
 */
export class InputManager {
  private bindings: Bindings;
  private readonly codeToActions = new Map<string, Action[]>();
  private readonly downCodes = new Set<string>();
  private readonly down = new Set<Action>();
  private readonly pressed = new Set<Action>();
  private readonly released = new Set<Action>();
  private lookX = 0;
  private lookY = 0;
  private element: HTMLElement | null = null;
  private detachFns: Array<() => void> = [];
  private _locked = false;
  /** When false, all actions read as released (menus). Look delta is dropped too. */
  enabled = true;

  constructor(
    private readonly events: EventBus<GameEvents>,
    bindings: Bindings = DEFAULT_BINDINGS,
  ) {
    this.bindings = cloneBindings(bindings);
    this.rebuildLookup();
  }

  // ---- queries ---------------------------------------------------------------------------

  isDown(action: Action): boolean {
    return this.enabled && this.down.has(action);
  }

  /** True during the frame in which the action went from up to down. */
  wasPressed(action: Action): boolean {
    return this.enabled && this.pressed.has(action);
  }

  wasReleased(action: Action): boolean {
    return this.enabled && this.released.has(action);
  }

  /** -1..1 on each axis: x = right - left, y = forward - backward (not normalised). */
  getMoveAxis(): { x: number; y: number } {
    const x = (this.isDown('moveRight') ? 1 : 0) - (this.isDown('moveLeft') ? 1 : 0);
    const y = (this.isDown('moveForward') ? 1 : 0) - (this.isDown('moveBackward') ? 1 : 0);
    return { x, y };
  }

  /** Mouse movement in pixels accumulated since the last endFrame(). x > 0 = right, y > 0 = down. */
  consumeLookDelta(): { x: number; y: number } {
    const delta = { x: this.enabled ? this.lookX : 0, y: this.enabled ? this.lookY : 0 };
    this.lookX = 0;
    this.lookY = 0;
    return delta;
  }

  get pointerLocked(): boolean {
    return this._locked;
  }

  // ---- bindings --------------------------------------------------------------------------

  getBindings(): Bindings {
    return cloneBindings(this.bindings);
  }

  setBindings(bindings: Bindings): void {
    this.bindings = cloneBindings(bindings);
    this.rebuildLookup();
    this.releaseAll();
  }

  /** Replace every code bound to `action`. Codes already bound to other actions stay bound there too. */
  rebind(action: Action, codes: string[]): void {
    this.bindings[action] = [...new Set(codes)];
    this.rebuildLookup();
    this.releaseAll();
  }

  actionsForCode(code: string): readonly Action[] {
    return this.codeToActions.get(code) ?? [];
  }

  // ---- frame protocol --------------------------------------------------------------------

  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.lookX = 0;
    this.lookY = 0;
  }

  /** Feed a physical key/button transition. Public for tests and for synthetic input (e2e). */
  handleCode(code: string, isDown: boolean): void {
    if (isDown) {
      if (this.downCodes.has(code)) return; // key repeat
      this.downCodes.add(code);
    } else {
      if (!this.downCodes.delete(code)) return;
    }
    for (const action of this.actionsForCode(code)) {
      if (isDown) {
        if (!this.down.has(action)) {
          this.down.add(action);
          this.pressed.add(action);
        }
      } else if (!this.bindings[action].some((c) => this.downCodes.has(c))) {
        // released only when no other code bound to the same action is still held
        if (this.down.delete(action)) this.released.add(action);
      }
    }
  }

  handleLook(dx: number, dy: number): void {
    this.lookX += dx;
    this.lookY += dy;
  }

  releaseAll(): void {
    for (const action of this.down) this.released.add(action);
    this.down.clear();
    this.downCodes.clear();
  }

  // ---- DOM -------------------------------------------------------------------------------

  attach(element: HTMLElement): void {
    this.detach();
    this.element = element;
    const doc = element.ownerDocument;
    const win = doc.defaultView ?? window;

    const onKeyDown = (e: KeyboardEvent): void => {
      if (this.actionsForCode(e.code).length > 0 && this._locked) e.preventDefault();
      this.handleCode(e.code, true);
    };
    const onKeyUp = (e: KeyboardEvent): void => this.handleCode(e.code, false);
    const onMouseDown = (e: MouseEvent): void => {
      if (!this._locked) return; // clicks on menus must not fire the weapon
      this.handleCode(mouseButtonCode(e.button), true);
    };
    const onMouseUp = (e: MouseEvent): void => this.handleCode(mouseButtonCode(e.button), false);
    const onMouseMove = (e: MouseEvent): void => {
      if (this._locked) this.handleLook(e.movementX, e.movementY);
    };
    const onContextMenu = (e: Event): void => e.preventDefault();
    const onBlur = (): void => this.releaseAll();
    const onLockChange = (): void => {
      const locked = doc.pointerLockElement === element;
      if (locked === this._locked) return;
      this._locked = locked;
      if (!locked) this.releaseAll();
      this.events.emit('input:pointerLockChanged', { locked });
    };

    doc.addEventListener('keydown', onKeyDown);
    doc.addEventListener('keyup', onKeyUp);
    element.addEventListener('mousedown', onMouseDown);
    doc.addEventListener('mouseup', onMouseUp);
    doc.addEventListener('mousemove', onMouseMove);
    element.addEventListener('contextmenu', onContextMenu);
    win.addEventListener('blur', onBlur);
    doc.addEventListener('pointerlockchange', onLockChange);

    this.detachFns = [
      () => doc.removeEventListener('keydown', onKeyDown),
      () => doc.removeEventListener('keyup', onKeyUp),
      () => element.removeEventListener('mousedown', onMouseDown),
      () => doc.removeEventListener('mouseup', onMouseUp),
      () => doc.removeEventListener('mousemove', onMouseMove),
      () => element.removeEventListener('contextmenu', onContextMenu),
      () => win.removeEventListener('blur', onBlur),
      () => doc.removeEventListener('pointerlockchange', onLockChange),
    ];
  }

  detach(): void {
    for (const fn of this.detachFns) fn();
    this.detachFns = [];
    this.element = null;
  }

  /** Must be called from a user gesture (click / key). Failures are swallowed (headless, denied). */
  requestPointerLock(): void {
    const el = this.element;
    if (!el || this._locked) return;
    try {
      const result = el.requestPointerLock() as unknown;
      if (result instanceof Promise) result.catch(() => undefined);
    } catch {
      // not supported / not allowed
    }
  }

  exitPointerLock(): void {
    if (this._locked) this.element?.ownerDocument.exitPointerLock();
  }

  private rebuildLookup(): void {
    this.codeToActions.clear();
    for (const action of ALL_ACTIONS) {
      for (const code of this.bindings[action] ?? []) {
        const list = this.codeToActions.get(code);
        if (list) list.push(action);
        else this.codeToActions.set(code, [action]);
      }
    }
  }
}

function cloneBindings(bindings: Bindings): Bindings {
  const out = {} as Bindings;
  for (const action of ALL_ACTIONS) out[action] = [...(bindings[action] ?? DEFAULT_BINDINGS[action])];
  return out;
}
