import { CanvasTexture, RepeatWrapping, SRGBColorSpace, ClampToEdgeWrapping } from 'three';

/**
 * Generated armour textures of the reference walker (docs/reference-models/final_boss.html): white
 * paint with red tactical stripes, panel lines and scratches. Created ONCE and shared by every boss
 * body (the module's resource scope disposes them with the materials).
 */

export interface ArmorTextures {
  armor: { map: CanvasTexture; roughness: CanvasTexture; bump: CanvasTexture };
  leg: { map: CanvasTexture; bump: CanvasTexture };
}

let cache: ArmorTextures | null = null;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('2d canvas unavailable');
  return { c, g };
}

function armor(): ArmorTextures['armor'] {
  const S = 1024;
  const rand = rng(404);
  const a = canvas(S);
  const r = canvas(S);
  const b = canvas(S);
  a.g.fillStyle = '#cfcfd2';
  a.g.fillRect(0, 0, S, S);
  r.g.fillStyle = '#888888';
  r.g.fillRect(0, 0, S, S);
  b.g.fillStyle = '#808080';
  b.g.fillRect(0, 0, S, S);
  for (let i = 0; i < 6000; i++) {
    const s = 1 + rand() * 2;
    a.g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(60,60,65,0.04)';
    a.g.fillRect(rand() * S, rand() * S, s, s);
  }
  // red stripes: a ring around the eye (u = 0.25) and a belt around the equator
  a.g.fillStyle = '#c42222';
  r.g.fillStyle = '#6e6e6e';
  for (const g of [a.g, r.g]) {
    g.beginPath();
    g.arc(S * 0.25, S * 0.53, 215, 0, Math.PI * 2);
    g.arc(S * 0.25, S * 0.53, 138, 0, Math.PI * 2, true);
    g.fill();
    g.fillRect(0, S * 0.49, S, 46);
  }
  const line = (x1: number, y1: number, x2: number, y2: number, lw: number): void => {
    b.g.strokeStyle = '#252525';
    b.g.lineWidth = lw;
    b.g.beginPath();
    b.g.moveTo(x1, y1);
    b.g.lineTo(x2, y2);
    b.g.stroke();
    a.g.strokeStyle = 'rgba(45,45,50,0.55)';
    a.g.lineWidth = lw * 0.75;
    a.g.beginPath();
    a.g.moveTo(x1, y1);
    a.g.lineTo(x2, y2);
    a.g.stroke();
  };
  for (let i = 0; i < 8; i++) line((S / 8) * i, 120, (S / 8) * i, 900, 3);
  line(0, 310, S, 310, 3.5);
  line(0, 710, S, 710, 3.5);
  const scratches = (cx: number, cy: number, count: number, sx: number, sy: number, max: number): void => {
    for (let i = 0; i < count; i++) {
      const x = cx + (rand() - 0.5) * sx;
      const y = cy + (rand() - 0.5) * sy;
      const w = 2 + rand() * max;
      const h = 1.5 + rand() * max * 0.6;
      const ang = (rand() - 0.5) * 1.4;
      for (const [g, col] of [
        [a.g, rand() > 0.3 ? '#4b4d52' : '#63666c'],
        [r.g, '#333333'],
        [b.g, '#4a4a4a'],
      ] as const) {
        g.save();
        g.translate(x, y);
        g.rotate(ang);
        g.fillStyle = col;
        g.fillRect(-w / 2, -h / 2, w, h);
        g.restore();
      }
    }
  };
  scratches(S * 0.25, S * 0.67, 95, 140, 65, 16);
  scratches(S * 0.22, S * 0.27, 65, 160, 70, 14);
  scratches(S * 0.31, S * 0.32, 55, 120, 60, 12);
  for (let k = 0; k < 14; k++) scratches(rand() * S, 200 + rand() * 620, 28, 90, 70, 11);

  const map = new CanvasTexture(a.c);
  map.colorSpace = SRGBColorSpace;
  const roughness = new CanvasTexture(r.c);
  const bump = new CanvasTexture(b.c);
  for (const t of [map, roughness, bump]) {
    t.wrapS = RepeatWrapping;
    t.wrapT = ClampToEdgeWrapping;
  }
  return { map, roughness, bump };
}

function leg(): ArmorTextures['leg'] {
  const rand = rng(405);
  const a = canvas(512);
  const b = canvas(512);
  a.g.fillStyle = '#d1d1d4';
  a.g.fillRect(0, 0, 512, 512);
  b.g.fillStyle = '#808080';
  b.g.fillRect(0, 0, 512, 512);
  a.g.fillStyle = '#c42222';
  a.g.beginPath();
  a.g.moveTo(0, 0);
  a.g.lineTo(512, 0);
  a.g.lineTo(512, 165);
  a.g.quadraticCurveTo(256, 210, 0, 150);
  a.g.closePath();
  a.g.fill();
  b.g.strokeStyle = '#282828';
  b.g.lineWidth = 4;
  b.g.beginPath();
  b.g.moveTo(0, 240);
  b.g.lineTo(512, 260);
  b.g.stroke();
  a.g.strokeStyle = 'rgba(40,40,45,0.45)';
  a.g.lineWidth = 2.5;
  a.g.beginPath();
  a.g.moveTo(0, 240);
  a.g.lineTo(512, 260);
  a.g.stroke();
  for (let i = 0; i < 140; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const w = 2 + rand() * 12;
    const h = 1.5 + rand() * 6;
    a.g.fillStyle = '#4e5056';
    a.g.fillRect(x, y, w, h);
    b.g.fillStyle = '#484848';
    b.g.fillRect(x, y, w, h);
  }
  const map = new CanvasTexture(a.c);
  map.colorSpace = SRGBColorSpace;
  return { map, bump: new CanvasTexture(b.c) };
}

/** Shared textures (built on first use). */
export function getArmorTextures(): ArmorTextures {
  cache ??= { armor: armor(), leg: leg() };
  return cache;
}

/** Forget the cache after the owning scope disposed the textures (module dispose). */
export function resetArmorTextures(): void {
  cache = null;
}
