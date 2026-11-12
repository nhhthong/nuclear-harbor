import { PERFORMANCE } from '@/config/tunables';
import type { ResourceCounts } from './benchmark';
import type { PerfSnapshot } from './snapshot';

const MAX_LINES = 32;

/** DOM overlay: a fixed pool of line elements whose text is rewritten at a low rate. */
export class Overlay {
  readonly element: HTMLDivElement;
  private readonly lines: HTMLDivElement[] = [];
  private visible = false;

  constructor(parent: HTMLElement) {
    const el = document.createElement('div');
    el.id = 'nh-debug-overlay';
    el.setAttribute('data-testid', 'debug-overlay');
    el.style.cssText =
      'position:fixed;top:6px;left:6px;z-index:9999;padding:6px 8px;background:rgba(0,0,0,0.65);color:#cfe;' +
      'font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;pointer-events:none;white-space:pre;display:none;' +
      'border-radius:3px;max-width:60vw';
    for (let i = 0; i < MAX_LINES; i++) {
      const line = document.createElement('div');
      line.style.display = 'none';
      el.appendChild(line);
      this.lines.push(line);
    }
    parent.appendChild(el);
    this.element = el;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  setVisible(value: boolean): void {
    this.visible = value;
    this.element.style.display = value ? 'block' : 'none';
  }

  render(s: PerfSnapshot, delta: ResourceCounts, bench: string | null): void {
    const fmt = (n: number, d = 1): string => (Number.isFinite(n) ? n.toFixed(d) : 'n/a');
    const flagged = new Set(s.warnings.map((w) => w.key));
    const e = s.enemies;
    const rows: Array<[string, boolean]> = [
      [`FPS ${fmt(s.fps, 0)}  avg ${fmt(s.avgMs, 2)} ms  1%low ${fmt(s.onePercentLowFps, 0)}  max ${fmt(s.maxMs, 1)} ms`, flagged.has('fps')],
      [`ticks/s ${fmt(s.fixedTicksPerSec, 0)}  state ${s.gameState}  quality ${s.quality}  canvas ${s.canvasWidth}x${s.canvasHeight}`, false],
      [`draw calls ${s.drawCalls} / ${PERFORMANCE.maxDrawCalls}`, flagged.has('drawCalls')],
      [`triangles ${s.triangles} / ${PERFORMANCE.maxTriangles}`, flagged.has('triangles')],
      [`geometries ${s.geometries}  textures ${s.textures}  programs ${s.programs}`, false],
      [`JS heap ${fmt(s.heapMb, 0)} MB / ${PERFORMANCE.jsHeapWarnMb}`, flagged.has('heap')],
      [`colliders ${s.colliders}  anchors ${s.anchors}`, false],
      [`enemies ${e.total} (active ${e.active} / simpl ${e.simplified} / dormant ${e.dormant})`, false],
      [`tracked ${s.trackedTotal}: ${scopesText(s.trackedScopes)}`, false],
      [`player ${fmt(s.player.x)}, ${fmt(s.player.y)}, ${fmt(s.player.z)} zone ${s.player.zone}`, false],
      [`delta since F6: geo ${signed(delta.geometries)} tex ${signed(delta.textures)} tracked ${signed(delta.tracked)}`, delta.geometries > 0 || delta.textures > 0 || delta.tracked > 0],
    ];
    for (const [key, value] of Object.entries(s.hookNumbers)) rows.push([`${key} ${value}`, false]);
    for (const w of s.warnings) rows.push([`WARN ${w.message}`, true]);
    if (bench) rows.push([bench, false]);
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line) continue;
      const row = rows[i];
      if (!row) {
        line.style.display = 'none';
        continue;
      }
      line.style.display = 'block';
      line.textContent = row[0];
      line.style.color = row[1] ? '#ff6b5b' : '';
      line.style.fontWeight = row[1] ? 'bold' : '';
    }
  }

  dispose(): void {
    this.element.remove();
    this.lines.length = 0;
  }
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function scopesText(scopes: Record<string, number>): string {
  let out = '';
  for (const [name, count] of Object.entries(scopes)) {
    if (name === 'root' || count === 0) continue;
    out += `${name.replace('root/', '')}=${count} `;
  }
  return out.trim() || '-';
}
