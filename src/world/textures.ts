import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/** Procedural concrete tile: subtle noise, expansion joints and painted dashed lane lines. */
export function createConcreteTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = '#8d8f8e';
    g.fillRect(0, 0, size, size);
    const img = g.getImageData(0, 0, size, size);
    let seed = 1337;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = ((seed >>> 24) / 255 - 0.5) * 22;
      img.data[i] = Math.max(0, Math.min(255, (img.data[i] ?? 0) + n));
      img.data[i + 1] = Math.max(0, Math.min(255, (img.data[i + 1] ?? 0) + n));
      img.data[i + 2] = Math.max(0, Math.min(255, (img.data[i + 2] ?? 0) + n));
    }
    g.putImageData(img, 0, 0);
    // expansion joints on the tile border
    g.strokeStyle = 'rgba(40,42,42,0.55)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, size, size);
    // painted dashed lane line across the tile
    g.strokeStyle = 'rgba(225,225,215,0.75)';
    g.lineWidth = 6;
    g.setLineDash([48, 32]);
    g.beginPath();
    g.moveTo(0, size / 2);
    g.lineTo(size, size / 2);
    g.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function canvasOf(size: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, g: canvas.getContext('2d') };
}

function dataTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Corrugated steel sheet as a height map (use as `bumpMap`): vertical ribs with a rounded profile
 * plus a frame at the tile border. One tile = one box face.
 */
export function createCorrugatedBump(ribs = 22): CanvasTexture {
  const size = 256;
  const { canvas, g } = canvasOf(size);
  if (g) {
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        // trapezoid-ish rib profile
        const wave = Math.sin(u * ribs * Math.PI * 2);
        let h = 128 + Math.max(-1, Math.min(1, wave * 1.6)) * 70;
        const border = Math.min(x, y, size - 1 - x, size - 1 - y);
        if (border < 6) h = 210; // corner posts / rails stand proud
        const i = (y * size + x) * 4;
        img.data[i] = h;
        img.data[i + 1] = h;
        img.data[i + 2] = h;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }
  return dataTexture(canvas);
}

/**
 * Worn paint roughness (use as `roughnessMap`; three reads the green channel): mostly matte with
 * glossier scuffed streaks and darker grime near the bottom edge.
 */
export function createWornRoughness(): CanvasTexture {
  const size = 256;
  const { canvas, g } = canvasOf(size);
  if (g) {
    g.fillStyle = 'rgb(0,170,0)';
    g.fillRect(0, 0, size, size);
    let seed = 4242;
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed >>> 8) / 16777216;
    };
    for (let i = 0; i < 260; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const len = 8 + rnd() * 60;
      const v = Math.floor(70 + rnd() * 70);
      g.strokeStyle = `rgba(0,${v},0,${0.25 + rnd() * 0.4})`;
      g.lineWidth = 1 + rnd() * 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 6, y + len);
      g.stroke();
    }
    const grad = g.createLinearGradient(0, size * 0.75, 0, size);
    grad.addColorStop(0, 'rgba(0,230,0,0)');
    grad.addColorStop(1, 'rgba(0,230,0,0.6)');
    g.fillStyle = grad;
    g.fillRect(0, size * 0.75, size, size * 0.25);
  }
  return dataTexture(canvas);
}

/**
 * Ground roughness for one concrete tile: rough concrete with a few smooth, puddle-like patches that
 * mirror the sky (dawn after rain). Green channel = roughness.
 */
export function createGroundRoughness(): CanvasTexture {
  const size = 512;
  const { canvas, g } = canvasOf(size);
  if (g) {
    g.fillStyle = 'rgb(0,225,0)';
    g.fillRect(0, 0, size, size);
    let seed = 90210;
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed >>> 8) / 16777216;
    };
    for (let i = 0; i < 9; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 28 + rnd() * 70;
      const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r);
      grad.addColorStop(0, 'rgba(0,28,0,0.95)');
      grad.addColorStop(0.7, 'rgba(0,60,0,0.7)');
      grad.addColorStop(1, 'rgba(0,225,0,0)');
      g.fillStyle = grad;
      g.save();
      g.translate(x, y);
      g.scale(1 + rnd() * 0.8, 0.6 + rnd() * 0.5);
      g.translate(-x, -y);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  return dataTexture(canvas);
}
