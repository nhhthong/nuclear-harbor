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
