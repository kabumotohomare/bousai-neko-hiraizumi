export function applyBsc(
  r: number,
  g: number,
  b: number,
  brightness: number,
  contrast: number,
  saturation: number
): [number, number, number] {
  const bright = (brightness / 100) * 255;
  let nr = r + bright;
  let ng = g + bright;
  let nb = b + bright;

  const c = contrast / 100;
  const factor = c >= 0 ? 1 + c : 1 + c * 0.5;
  nr = (nr - 128) * factor + 128;
  ng = (ng - 128) * factor + 128;
  nb = (nb - 128) * factor + 128;

  const luma = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;
  const s = 1 + saturation / 100;
  nr = luma + (nr - luma) * s;
  ng = luma + (ng - luma) * s;
  nb = luma + (nb - luma) * s;

  return [clampByte(nr), clampByte(ng), clampByte(nb)];
}

export function applyBscToImageData(
  source: ImageData,
  brightness: number,
  contrast: number,
  saturation: number
): ImageData {
  const out = new ImageData(source.width, source.height);
  const s = source.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    const [r, g, b] = applyBsc(s[i], s[i + 1], s[i + 2], brightness, contrast, saturation);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = s[i + 3];
  }
  return out;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function autoBscHints(image: ImageData): {
  brightness: number;
  contrast: number;
  saturation: number;
} {
  const { data } = image;
  let sum = 0;
  let count = 0;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 16) {
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += y;
    min = Math.min(min, y);
    max = Math.max(max, y);
    count += 1;
  }
  const mean = count ? sum / count : 128;
  const brightness = Math.round(((128 - mean) / 128) * 30);
  const range = Math.max(1, max - min);
  const contrast = Math.round(((180 - range) / 180) * 20);
  return {
    brightness: Math.max(-40, Math.min(40, brightness)),
    contrast: Math.max(-20, Math.min(40, contrast)),
    saturation: 0
  };
}
