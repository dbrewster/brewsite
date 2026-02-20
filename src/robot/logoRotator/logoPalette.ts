export type LogoPalette = {
  primary: string;
  quadrants: string[];
};

const toHex = (value: number) => value.toString(16).padStart(2, '0');

const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

const averageColor = (pixels: Array<{ r: number; g: number; b: number }>) => {
  if (pixels.length === 0) return rgbToHex(245, 245, 245);
  let tr = 0;
  let tg = 0;
  let tb = 0;
  for (const p of pixels) {
    tr += p.r;
    tg += p.g;
    tb += p.b;
  }
  return rgbToHex(
    Math.round(tr / pixels.length),
    Math.round(tg / pixels.length),
    Math.round(tb / pixels.length),
  );
};

const cache = new Map<string, Promise<LogoPalette>>();

export const loadLogoPalette = (url: string, grid = 2): Promise<LogoPalette> => {
  if (cache.has(url)) return cache.get(url) as Promise<LogoPalette>;
  const promise = new Promise<LogoPalette>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ primary: rgbToHex(245, 245, 245), quadrants: [] });
        return;
      }
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      const cell = size / grid;
      const buckets: Array<Array<{ r: number; g: number; b: number }>> = Array.from({ length: grid * grid }, () => []);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const idx = (y * size + x) * 4;
          const alpha = data[idx + 3] ?? 0;
          if (alpha < 20) continue;
          const col = Math.min(grid - 1, Math.floor(x / cell));
          const row = Math.min(grid - 1, Math.floor(y / cell));
          const bucket = row * grid + col;
          buckets[bucket]?.push({
            r: data[idx] ?? 245,
            g: data[idx + 1] ?? 245,
            b: data[idx + 2] ?? 245,
          });
        }
      }
      const quadrants = buckets.map(averageColor);
      const primary = averageColor(buckets.flat());
      resolve({ primary, quadrants });
    };
    img.onerror = () => resolve({ primary: rgbToHex(245, 245, 245), quadrants: [] });
    img.src = url;
  });
  cache.set(url, promise);
  return promise;
};
