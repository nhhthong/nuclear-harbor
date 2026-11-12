import type { GameContext } from '@/core/GameContext';
import type { HitZone } from '@/core/types';
import { OBJECTIVES, WEAPON } from '@/config/tunables';
import {
  ammoText,
  compassX,
  formatCountdown,
  hpRatio,
  nearestInactive,
  relativeBearingDeg,
  bearingDeg,
  type TowerPoint,
} from './format';

const COMPASS_FOV_DEG = 120;

export function el<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement | null,
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

/** A text node whose DOM is only touched when the value changes. */
class Cell {
  private last: string;
  constructor(
    private readonly node: HTMLElement,
    initial: string,
  ) {
    this.last = initial;
    node.textContent = initial;
  }
  set(value: string): void {
    if (value === this.last) return;
    this.last = value;
    this.node.textContent = value;
  }
  get value(): string {
    return this.last;
  }
}

export interface Hud {
  readonly root: HTMLElement;
  /** Per-frame refresh of HP, compass (only writes on change). */
  refresh(): void;
  getText(): Record<string, string>;
  dispose(): void;
}

export function createHud(ctx: GameContext, parent: HTMLElement): Hud {
  const offs: Array<() => void> = [];
  const timers = new Set<number>();
  const on: typeof ctx.events.on = (event, handler) => {
    const off = ctx.events.on(event, handler);
    offs.push(off);
    return off;
  };
  const later = (fn: () => void, ms: number): number => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const root = el(parent, 'div', 'nh-hud');

  // ---- overlays ----
  const vignette = el(root, 'div', 'nh-vignette');
  const dmg = el(root, 'div', 'nh-dmg');
  el(root, 'div', 'nh-crosshair');
  const hit = el(root, 'div', 'nh-hit');

  // ---- bottom left: HP ----
  const bl = el(root, 'div', 'nh-panel nh-bl');
  el(bl, 'div', 'nh-small', 'Integrity');
  const hpCell = new Cell(el(bl, 'div', 'nh-big'), `${Math.ceil(ctx.player.hp)}`);
  const hpBar = el(bl, 'div', 'nh-hp-bar');
  const hpFill = el(hpBar, 'div', 'nh-hp-fill');

  // ---- bottom right: ammo ----
  const br = el(root, 'div', 'nh-panel nh-br');
  const weaponCell = new Cell(el(br, 'div', 'nh-small'), WEAPON.name);
  const ammoCell = new Cell(el(br, 'div', 'nh-big'), ammoText(WEAPON.magazineSize, WEAPON.reserveAmmo));
  const reloadCell = new Cell(el(br, 'div', 'nh-small nh-reload'), '');

  // ---- top: countdown + towers ----
  const top = el(root, 'div', 'nh-panel nh-top');
  const countNode = el(top, 'div', 'nh-count');
  const countCell = new Cell(countNode, formatCountdown(OBJECTIVES.countdownSeconds));
  const pipsRow = el(top, 'div', 'nh-pips');
  const towersCell = new Cell(el(top, 'div', 'nh-small'), `0/${OBJECTIVES.towerCount}`);
  let pips: HTMLElement[] = [];
  const buildPips = (n: number): void => {
    for (const p of pips) p.remove();
    pips = [];
    for (let i = 0; i < n; i++) pips.push(el(pipsRow, 'div', 'nh-pip'));
  };
  buildPips(OBJECTIVES.towerCount);
  let towerTotal: number = OBJECTIVES.towerCount;

  // ---- compass ----
  const compass = el(root, 'div', 'nh-compass nh-hidden');
  const marker = el(compass, 'div', 'nh-marker', '▼');
  const compassCell = new Cell(el(compass, 'span', 'nh-hidden'), '');

  // ---- prompt ----
  const promptBox = el(root, 'div', 'nh-prompt nh-hidden');
  const promptCell = new Cell(el(promptBox, 'div'), '');
  const promptBar = el(promptBox, 'div', 'nh-bar nh-hidden');
  const promptFill = el(promptBar, 'div', 'nh-fill');

  // ---- grapple ----
  const grapple = el(root, 'div', 'nh-grapple ready', 'G');
  const grappleCell = new Cell(grapple, 'G');

  // ---- toast ----
  const toast = el(root, 'div', 'nh-toast');
  const toastCell = new Cell(toast, '');

  // ---- boss ----
  const boss = el(root, 'div', 'nh-panel nh-boss nh-hidden');
  const bossName = new Cell(el(boss, 'div', 'nh-small'), '');
  const wpRow = el(boss, 'div', 'nh-wp');
  let wpBoxes: HTMLElement[] = [];
  let wpFills: HTMLElement[] = [];
  let wpHp: number[] = [];
  const coreBar = el(boss, 'div', 'nh-bar');
  const coreFill = el(coreBar, 'div', 'nh-fill locked');
  const bossCore = new Cell(el(boss, 'div', 'nh-core'), '');
  let coreMax: number = ctx.tunables.BOSS.coreHp;
  const bossWp = new Cell(el(boss, 'span', 'nh-hidden'), '');

  const buildBoss = (name: string, count: number, coreHp: number): void => {
    for (const b of wpBoxes) b.remove();
    wpBoxes = [];
    wpFills = [];
    wpHp = [];
    for (let i = 0; i < count; i++) {
      const box = el(wpRow, 'div');
      wpFills.push(el(box, 'i'));
      wpBoxes.push(box);
      wpHp.push(ctx.tunables.BOSS.weakPointHp);
    }
    coreMax = coreHp;
    coreFill.classList.add('locked');
    coreFill.style.transform = 'scaleX(1)';
    bossName.set(name);
    bossCore.set('CORE LOCKED');
    bossWp.set(wpHp.join(','));
    boss.classList.remove('nh-hidden');
  };

  // ---- state ----
  const towers = new Map<number, TowerPoint>();
  const towerList: TowerPoint[] = [];
  const active = new Set<number>();
  let lastHp = -1;
  let lastCompass = '';
  let progress = 0;
  let promptText: string | null = null;

  const showPrompt = (): void => {
    const visible = !!promptText || progress > 0;
    promptBox.classList.toggle('nh-hidden', !visible);
    promptCell.set(promptText ?? (progress > 0 ? 'Activating...' : ''));
    promptBar.classList.toggle('nh-hidden', progress <= 0);
    promptFill.style.transform = `scaleX(${progress.toFixed(3)})`;
  };

  const flash = (kind: string): void => {
    hit.className = `nh-hit on ${kind}`;
    if (hitTimer !== 0) window.clearTimeout(hitTimer);
    hitTimer = later(() => {
      hit.className = 'nh-hit';
      hitTimer = 0;
    }, 140);
  };
  let hitTimer = 0;
  let toastTimer = 0;
  const showToast = (text: string, seconds = 2.5): void => {
    toastCell.set(text);
    toast.classList.add('on');
    if (toastTimer !== 0) window.clearTimeout(toastTimer);
    toastTimer = later(() => {
      toast.classList.remove('on');
      toastTimer = 0;
    }, seconds * 1000);
  };

  const setTowerPip = (id: number, kind: 'inactive' | 'activating' | 'active', p = 0): void => {
    const pip = pips[id];
    if (!pip) return;
    pip.className = `nh-pip ${kind === 'inactive' ? '' : kind}`;
    if (kind === 'activating') pip.style.setProperty('--p', p.toFixed(2));
  };

  const refresh = (): void => {
    const p = ctx.player;
    if (p.hp !== lastHp) {
      lastHp = p.hp;
      const r = hpRatio(p.hp, p.maxHp);
      hpCell.set(`${Math.ceil(p.hp)}`);
      hpFill.style.transform = `scaleX(${r.toFixed(3)})`;
      hpFill.classList.toggle('low', r < 0.3);
      vignette.style.opacity = r < 0.3 ? ((0.3 - r) / 0.3).toFixed(2) : '0';
    }
    // compass
    const nearest = nearestInactive(
      towerList,
      active,
      p.position.x,
      p.position.z,
    );
    if (nearest === null) {
      if (lastCompass !== 'hidden') {
        lastCompass = 'hidden';
        compass.classList.add('nh-hidden');
        compassCell.set('');
      }
    } else {
      const t = towers.get(nearest);
      if (t) {
        const b = bearingDeg(p.position.x, p.position.z, t.x, t.z, p.yaw);
        const x = Math.round(compassX(b, COMPASS_FOV_DEG) * 18 * 10) / 10;
        const key = `${nearest}:${x}`;
        if (key !== lastCompass) {
          compass.classList.remove('nh-hidden');
          lastCompass = key;
          marker.style.transform = `translateX(${x}vh)`;
          compassCell.set(`${Math.round(b)}`);
        }
      }
    }
  };

  // ---- events ----
  on('player:damaged', (e) => {
    lastHp = -1;
    refresh();
    if (e.direction) {
      const angle = relativeBearingDeg(-e.direction.x, -e.direction.z, ctx.player.yaw);
      dmg.style.transform = `rotate(${angle.toFixed(0)}deg)`;
      dmg.classList.add('on');
      later(() => dmg.classList.remove('on'), 80);
    }
  });
  on('player:healed', () => {
    lastHp = -1;
    refresh();
  });
  on('game:stateChanged', ({ to }) => {
    if (to === 'playing') {
      lastHp = -1;
      refresh();
    }
  });
  on('game:respawn', () => {
    lastHp = -1;
    refresh();
  });
  on('weapon:ammoChanged', (e) => {
    ammoCell.set(ammoText(e.mag, e.reserve));
    weaponCell.set(e.name);
  });
  on('weapon:reloadStarted', () => reloadCell.set('Reloading'));
  on('weapon:reloadFinished', (e) => {
    reloadCell.set('');
    ammoCell.set(ammoText(e.mag, e.reserve));
  });
  on('combat:hit', (e) => {
    if (e.targetKind === 'player') return;
    const zone: HitZone = e.absorbed ? 'armor' : e.zone;
    flash(e.killed && !e.absorbed ? 'kill' : zone === 'core' ? 'weakpoint' : zone);
  });
  on('grapple:cooldown', ({ remaining, total }) => {
    const ready = remaining <= 0 || total <= 0;
    const frac = ready ? 1 : Math.round((1 - remaining / total) * 50) / 50;
    grapple.classList.toggle('ready', ready);
    grapple.style.setProperty('--p', frac.toFixed(2));
    grappleCell.set(ready ? 'G' : remaining.toFixed(1));
  });
  on('grapple:failed', ({ reason }) => {
    if (reason === 'out-of-range') showToast('Out of grapple range', 1.2);
    else if (reason === 'no-target' || reason === 'not-grappleable') showToast('No grapple target', 1.2);
  });
  on('tower:registered', (e) => {
    if (towers.has(e.towerId)) {
      // a new run re-registers the towers
      active.clear();
      for (let i = 0; i < pips.length; i++) setTowerPip(i, 'inactive');
      towersCell.set(`0/${e.total}`);
    }
    const point = { id: e.towerId, x: e.position.x, z: e.position.z };
    towers.set(e.towerId, point);
    const at = towerList.findIndex((t) => t.id === e.towerId);
    if (at >= 0) towerList[at] = point;
    else towerList.push(point);
    if (e.total !== towerTotal) {
      towerTotal = e.total;
      buildPips(e.total);
      for (const id of active) setTowerPip(id, 'active');
      towersCell.set(`${active.size}/${e.total}`);
    }
    lastCompass = '';
  });
  on('tower:activationProgress', (e) => {
    progress = e.progress;
    if (!active.has(e.towerId)) setTowerPip(e.towerId, 'activating', e.progress);
    showPrompt();
  });
  on('tower:activationCancelled', (e) => {
    progress = 0;
    if (!active.has(e.towerId)) setTowerPip(e.towerId, 'inactive');
    showPrompt();
  });
  on('tower:activated', (e) => {
    progress = 0;
    active.add(e.towerId);
    setTowerPip(e.towerId, 'active');
    towersCell.set(`${e.activatedCount}/${e.total}`);
    showPrompt();
    showToast(`Tower ${e.towerId + 1} activated (${e.activatedCount}/${e.total})`);
    lastCompass = '';
  });
  on('objectives:allActivated', () => showToast('All towers online - the TITAN approaches', 4));
  on('countdown:tick', (e) => {
    countCell.set(formatCountdown(e.remaining));
    countNode.classList.toggle('critical', e.critical);
  });
  on('countdown:stopped', (e) => {
    countCell.set(formatCountdown(e.remaining));
    countNode.classList.remove('critical');
  });
  on('interact:prompt', (e) => {
    promptText = e.text;
    showPrompt();
  });
  on('pickup:collected', (e) => {
    showToast(e.kind === 'ammo' ? `+${e.amount} ammo` : `+${e.amount} HP`, 1.5);
  });
  on('ui:toast', (e) => showToast(e.text, e.seconds));

  on('boss:spawned', (e) => buildBoss(e.name, e.weakPoints, e.coreHp));
  on('boss:weakPointDamaged', (e) => {
    const f = wpFills[e.index];
    if (!f) return;
    wpHp[e.index] = e.hp;
    f.style.transform = `scaleX(${hpRatio(e.hp, e.maxHp).toFixed(3)})`;
    bossWp.set(wpHp.join(','));
  });
  on('boss:weakPointDestroyed', (e) => {
    const f = wpFills[e.index];
    if (!f) return;
    wpHp[e.index] = 0;
    f.style.transform = 'scaleX(0)';
    wpBoxes[e.index]?.classList.add('dead');
    bossWp.set(wpHp.join(','));
    showToast(`Weak point destroyed (${e.remaining} left)`, 2);
  });
  on('boss:coreExposed', () => {
    coreFill.classList.remove('locked');
    bossCore.set(`CORE ${coreMax} / ${coreMax}`);
    showToast('Core exposed - shoot it!', 3);
  });
  on('boss:coreDamaged', (e) => {
    coreFill.classList.remove('locked');
    coreMax = e.maxHp;
    coreFill.style.transform = `scaleX(${hpRatio(e.hp, e.maxHp).toFixed(3)})`;
    bossCore.set(`CORE ${Math.ceil(e.hp)} / ${e.maxHp}`);
  });
  on('boss:defeated', () => bossCore.set('DEFEATED'));

  refresh();

  return {
    root,
    refresh,
    getText: () => ({
      hp: hpCell.value,
      ammo: ammoCell.value,
      weapon: weaponCell.value,
      reload: reloadCell.value,
      countdown: countCell.value,
      towers: towersCell.value,
      compass: compass.classList.contains('nh-hidden') ? '' : compassCell.value,
      prompt: promptBox.classList.contains('nh-hidden') ? '' : promptCell.value,
      toast: toast.classList.contains('on') ? toastCell.value : '',
      grapple: grappleCell.value,
      bossName: boss.classList.contains('nh-hidden') ? '' : bossName.value,
      bossCore: boss.classList.contains('nh-hidden') ? '' : bossCore.value,
      bossWeakPoints: boss.classList.contains('nh-hidden') ? '' : bossWp.value,
    }),
    dispose() {
      for (const off of offs) off();
      offs.length = 0;
      for (const t of timers) window.clearTimeout(t);
      timers.clear();
      root.remove();
    },
  };
}
