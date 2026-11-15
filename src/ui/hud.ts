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
/** Radius shown by the radar (m). */
const RADAR_RANGE = 42;

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
  const bl = el(root, 'div', 'nh-bl');
  const hpHead = el(bl, 'div', 'nh-stat-head');
  el(hpHead, 'span', 'nh-glyph nh-glyph-hp');
  el(hpHead, 'span', 'nh-small', 'Integrity');
  const hpRow = el(bl, 'div', 'nh-stat-row');
  const hpCell = new Cell(el(hpRow, 'div', 'nh-big'), `${Math.ceil(ctx.player.hp)}`);
  el(hpRow, 'div', 'nh-sub2', `/ ${Math.ceil(ctx.player.maxHp)}`);
  const hpBar = el(bl, 'div', 'nh-hp-bar');
  // the ghost lags behind the fill (CSS transition) so a hit shows how much was lost
  const hpGhost = el(hpBar, 'div', 'nh-hp-ghost');
  const hpFill = el(hpBar, 'div', 'nh-hp-fill');

  // ---- bottom right: ammo ----
  const br = el(root, 'div', 'nh-br');
  const weaponCell = new Cell(el(br, 'div', 'nh-small'), WEAPON.name);
  const ammoRow = el(br, 'div', 'nh-stat-row');
  const magCell = new Cell(el(ammoRow, 'div', 'nh-big'), `${WEAPON.magazineSize}`);
  const reserveCell = new Cell(el(ammoRow, 'div', 'nh-sub2'), `/ ${WEAPON.reserveAmmo}`);
  // kept for tests and screen readers; the split cells above are what is shown
  const ammoCell = new Cell(el(br, 'div', 'nh-hidden'), ammoText(WEAPON.magazineSize, WEAPON.reserveAmmo));
  const magBar = el(br, 'div', 'nh-mag');
  const magFill = el(magBar, 'div', 'nh-mag-fill');
  const reloadFill = el(magBar, 'div', 'nh-reload-fill');
  const reloadCell = new Cell(el(br, 'div', 'nh-small nh-reload'), '');
  let magSize: number = WEAPON.magazineSize;
  const setAmmo = (mag: number, reserve: number): void => {
    ammoCell.set(ammoText(mag, reserve));
    magCell.set(`${mag}`);
    reserveCell.set(`/ ${reserve}`);
    const r = magSize > 0 ? mag / magSize : 0;
    magFill.style.transform = `scaleX(${r.toFixed(3)})`;
    br.classList.toggle('low', r <= 0.25);
    br.classList.toggle('empty', mag === 0 && reserve === 0);
  };

  // ---- top: countdown + towers ----
  const top = el(root, 'div', 'nh-top');
  el(top, 'div', 'nh-small nh-top-label', 'Reactor meltdown');
  const countNode = el(top, 'div', 'nh-count');
  const countCell = new Cell(countNode, formatCountdown(OBJECTIVES.countdownSeconds));
  const timeBar = el(top, 'div', 'nh-time');
  const timeFill = el(timeBar, 'div', 'nh-time-fill');
  const relayRow = el(top, 'div', 'nh-relay');
  el(relayRow, 'span', 'nh-small', 'Relay');
  const pipsRow = el(relayRow, 'div', 'nh-pips');
  const towersCell = new Cell(el(relayRow, 'span', 'nh-small'), `0/${OBJECTIVES.towerCount}`);
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
  const marker = el(compass, 'div', 'nh-marker', '◆');
  const compassCell = new Cell(el(compass, 'span', 'nh-hidden'), '');
  // heading tape: eight labels slide with the yaw; it stays visible when no tower is left
  const tape = el(root, 'div', 'nh-tape');
  const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  const tapeLabels = CARDINALS.map((c, i) => el(tape, 'span', i % 2 === 0 ? 'major' : '', c));
  let lastHeading = 1e9;

  // ---- radar (top left): robots, relay tower, bosses; up = where the player looks ----
  const radarBox = el(root, 'div', 'nh-radar');
  const radar = el(radarBox, 'canvas');
  const RADAR_PX = 176;
  radar.width = RADAR_PX;
  radar.height = RADAR_PX;
  const rg = radar.getContext('2d');
  const radarCount = new Cell(el(radarBox, 'div', 'nh-radar-count'), '');
  let radarFrame = 0;
  let bossAt: { x: number; z: number } | null = null;
  const drawRadar = (): void => {
    if (!rg) return;
    const p = ctx.player;
    const c = RADAR_PX / 2;
    const R = c - 6;
    const scale = R / RADAR_RANGE;
    const cos = Math.cos(p.yaw);
    const sin = Math.sin(p.yaw);
    // world -> radar: forward (-Z rotated by yaw) points up
    const map = (x: number, z: number): [number, number, boolean] => {
      const dx = x - p.position.x;
      const dz = z - p.position.z;
      let rx = (dx * cos - dz * sin) * scale;
      let ry = (dx * sin + dz * cos) * scale;
      const d = Math.hypot(rx, ry);
      const out = d > R;
      if (out) {
        rx = (rx / d) * R;
        ry = (ry / d) * R;
      }
      return [c + rx, c + ry, out];
    };
    rg.clearRect(0, 0, RADAR_PX, RADAR_PX);
    rg.fillStyle = 'rgba(10,9,14,0.55)';
    rg.beginPath();
    rg.arc(c, c, R, 0, Math.PI * 2);
    rg.fill();
    rg.lineWidth = 1;
    rg.strokeStyle = 'rgba(255,255,255,0.14)';
    for (const f of [1 / 3, 2 / 3]) {
      rg.beginPath();
      rg.arc(c, c, R * f, 0, Math.PI * 2);
      rg.stroke();
    }
    rg.beginPath();
    rg.moveTo(c, c - R);
    rg.lineTo(c, c + R);
    rg.moveTo(c - R, c);
    rg.lineTo(c + R, c);
    rg.stroke();
    // view cone
    rg.fillStyle = 'rgba(255,176,102,0.10)';
    rg.beginPath();
    rg.moveTo(c, c);
    rg.arc(c, c, R, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
    rg.fill();
    rg.strokeStyle = 'rgba(255,150,70,0.75)';
    rg.lineWidth = 2;
    rg.beginPath();
    rg.arc(c, c, R, 0, Math.PI * 2);
    rg.stroke();
    // towers: diamonds (amber = offline, green = online)
    for (const t of towerList) {
      const [x, y] = map(t.x, t.z);
      rg.fillStyle = active.has(t.id) ? '#3dff8a' : '#ffd23a';
      rg.beginPath();
      rg.moveTo(x, y - 6);
      rg.lineTo(x + 5, y);
      rg.lineTo(x, y + 6);
      rg.lineTo(x - 5, y);
      rg.fill();
    }
    // robots
    const robots = ctx.enemies.alive();
    let near = 0;
    rg.fillStyle = '#ff4a3a';
    for (const e of robots) {
      const [x, y, out] = map(e.position.x, e.position.z);
      if (out) continue;
      near++;
      if (e.type === 'samurai') {
        // elites: a bright upward triangle
        rg.fillStyle = '#ffb066';
        rg.beginPath();
        rg.moveTo(x, y - 5.5);
        rg.lineTo(x + 4.8, y + 3.6);
        rg.lineTo(x - 4.8, y + 3.6);
        rg.fill();
        rg.fillStyle = '#ff4a3a';
        continue;
      }
      rg.beginPath();
      rg.arc(x, y, e.type === 'army' ? 3.6 : 2.6, 0, Math.PI * 2);
      rg.fill();
    }
    // large machines: the relay guardian (read through its debug hook) and the final boss
    const big: Array<{ x: number; z: number }> = [];
    const scorpion = ctx.testHooks.scorpion as { list?: () => Array<{ alive: boolean; position: { x: number; z: number } }> } | undefined;
    for (const d of scorpion?.list?.() ?? []) if (d.alive) big.push(d.position);
    if (bossAt) big.push(bossAt);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    for (const b of big) {
      const [x, y] = map(b.x, b.z);
      near++;
      rg.strokeStyle = `rgba(255,74,58,${(0.5 + 0.5 * pulse).toFixed(2)})`;
      rg.lineWidth = 2;
      rg.beginPath();
      rg.arc(x, y, 6.5 + pulse * 2, 0, Math.PI * 2);
      rg.stroke();
      rg.fillStyle = '#ff4a3a';
      rg.beginPath();
      rg.arc(x, y, 4, 0, Math.PI * 2);
      rg.fill();
    }
    // player
    rg.fillStyle = '#fff4e6';
    rg.beginPath();
    rg.moveTo(c, c - 7);
    rg.lineTo(c + 5, c + 5);
    rg.lineTo(c, c + 2);
    rg.lineTo(c - 5, c + 5);
    rg.fill();
    radarCount.set(near > 0 ? `${near} contact${near > 1 ? 's' : ''}` : 'clear');
    radarBox.classList.toggle('hot', near > 0);
  };

  // ---- prompt ----
  const promptBox = el(root, 'div', 'nh-prompt nh-hidden');
  const promptCell = new Cell(el(promptBox, 'div'), '');
  const promptBar = el(promptBox, 'div', 'nh-bar nh-hidden');
  const promptFill = el(promptBar, 'div', 'nh-fill');

  // ---- air-jump indicator (lit while the mid-air jump is available) ----
  const jumpPip = el(root, 'div', 'nh-jump ready', '');
  const jumpCell = new Cell(jumpPip, '');
  jumpCell.set('2x');

  // ---- toast ----
  const toast = el(root, 'div', 'nh-toast');
  const toastCell = new Cell(toast, '');

  // ---- boss ----
  const boss = el(root, 'div', 'nh-boss nh-hidden');
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

  /** Tower ids are 1-based in the level layout: pips follow the sorted position of the id. */
  const pipIndex = (id: number): number => {
    const ids = [...new Set([...towerList.map((t) => t.id), id])].sort((a, b) => a - b);
    return ids.indexOf(id);
  };
  const setPipById = (id: number, kind: 'inactive' | 'activating' | 'active', p = 0): void =>
    setTowerPip(pipIndex(id), kind, p);

  const refresh = (): void => {
    const p = ctx.player;
    if (p.hp !== lastHp) {
      lastHp = p.hp;
      const r = hpRatio(p.hp, p.maxHp);
      hpCell.set(`${Math.ceil(p.hp)}`);
      hpFill.style.transform = `scaleX(${r.toFixed(3)})`;
      hpGhost.style.transform = `scaleX(${r.toFixed(3)})`;
      hpFill.classList.toggle('low', r < 0.3);
      bl.classList.toggle('low', r < 0.3);
      vignette.style.opacity = r < 0.3 ? ((0.3 - r) / 0.3).toFixed(2) : '0';
    }
    // heading tape (only when the yaw moved by half a degree) and radar (every 4th frame)
    const heading = (((-p.yaw * 180) / Math.PI) % 360 + 360) % 360;
    if (Math.abs(heading - lastHeading) > 0.5) {
      lastHeading = heading;
      for (let i = 0; i < tapeLabels.length; i++) {
        const rel = ((i * 45 - heading + 540) % 360) - 180;
        const label = tapeLabels[i] as HTMLElement;
        const shown = Math.abs(rel) < COMPASS_FOV_DEG / 2;
        label.style.opacity = shown ? (1 - Math.abs(rel) / (COMPASS_FOV_DEG / 2)).toFixed(2) : '0';
        if (shown) label.style.transform = `translateX(${(compassX(rel, COMPASS_FOV_DEG) * 18).toFixed(1)}vh)`;
      }
    }
    if (radarFrame++ % 4 === 0) drawRadar();
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
    magSize = e.magSize;
    setAmmo(e.mag, e.reserve);
    weaponCell.set(e.name);
  });
  on('weapon:reloadStarted', (e) => {
    reloadCell.set('Reloading');
    // the bar fills over the reload time
    reloadFill.style.transition = 'none';
    reloadFill.style.transform = 'scaleX(0)';
    reloadFill.style.opacity = '1';
    void reloadFill.offsetWidth;
    reloadFill.style.transition = `transform ${e.duration.toFixed(2)}s linear`;
    reloadFill.style.transform = 'scaleX(1)';
  });
  on('weapon:reloadFinished', (e) => {
    reloadCell.set('');
    reloadFill.style.opacity = '0';
    setAmmo(e.mag, e.reserve);
  });
  on('combat:hit', (e) => {
    if (e.targetKind === 'player') return;
    const zone: HitZone = e.absorbed ? 'armor' : e.zone;
    flash(e.killed && !e.absorbed ? 'kill' : zone === 'core' ? 'weakpoint' : zone);
  });
  on('player:jumped', ({ airJumpsLeft }) => {
    jumpPip.classList.toggle('ready', airJumpsLeft > 0);
    jumpCell.set(airJumpsLeft > 0 ? '2x' : '');
  });
  on('player:landed', () => {
    jumpPip.classList.add('ready');
    jumpCell.set('2x');
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
      for (const id of active) setPipById(id, 'active');
      towersCell.set(`${active.size}/${e.total}`);
    }
    lastCompass = '';
  });
  on('tower:activationProgress', (e) => {
    progress = e.progress;
    if (!active.has(e.towerId)) setPipById(e.towerId, 'activating', e.progress);
    showPrompt();
  });
  on('tower:activationCancelled', (e) => {
    progress = 0;
    if (!active.has(e.towerId)) setPipById(e.towerId, 'inactive');
    showPrompt();
  });
  on('tower:activated', (e) => {
    progress = 0;
    active.add(e.towerId);
    setPipById(e.towerId, 'active');
    towersCell.set(`${e.activatedCount}/${e.total}`);
    showPrompt();
    showToast(`Tower ${pipIndex(e.towerId) + 1} activated (${e.activatedCount}/${e.total})`);
    lastCompass = '';
  });
  on('objectives:allActivated', () => showToast('All towers online - the TITAN approaches', 4));
  on('countdown:tick', (e) => {
    countCell.set(formatCountdown(e.remaining));
    countNode.classList.toggle('critical', e.critical);
    top.classList.toggle('critical', e.critical);
    timeFill.style.transform = `scaleX(${Math.max(0, Math.min(1, e.remaining / OBJECTIVES.countdownSeconds)).toFixed(4)})`;
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

  on('boss:spawned', (e) => {
    buildBoss(e.name, e.weakPoints, e.coreHp);
    bossAt = { x: e.position.x, z: e.position.z };
  });
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
  on('boss:defeated', () => {
    bossCore.set('DEFEATED');
    bossAt = null;
  });

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
      jump: jumpCell.value,
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
