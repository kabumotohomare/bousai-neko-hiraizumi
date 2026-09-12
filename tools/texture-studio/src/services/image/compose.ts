import { applyBscToImageData } from './adjust';
import { applyMaskToImage, maskBBox } from './mask';
import { Quad, warpPerspective } from './perspectiveMath';

export function matchMeanColor(source: ImageData, reference: ImageData, strength = 0.65): ImageData {
  const sMean = meanRgb(source);
  const rMean = meanRgb(reference);
  const out = new ImageData(source.width, source.height);
  out.data.set(source.data);
  const dr = (rMean[0] - sMean[0]) * strength;
  const dg = (rMean[1] - sMean[1]) * strength;
  const db = (rMean[2] - sMean[2]) * strength;
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3] < 8) {
      continue;
    }
    out.data[i] = clamp(out.data[i] + dr);
    out.data[i + 1] = clamp(out.data[i + 1] + dg);
    out.data[i + 2] = clamp(out.data[i + 2] + db);
  }
  return out;
}

function meanRgb(image: ImageData): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const d = image.data;
  for (let i = 0; i < d.length; i += 16) {
    if (d[i + 3] < 8) {
      continue;
    }
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
    n += 1;
  }
  if (!n) {
    return [128, 128, 128];
  }
  return [r / n, g / n, b / n];
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function applyRegionFilter(
  image: ImageData,
  region: Uint8Array,
  strength: number
): ImageData {
  const out = new ImageData(image.width, image.height);
  out.data.set(image.data);
  const t = Math.max(0, Math.min(1, strength / 100));
  for (let p = 0; p < region.length; p += 1) {
    if (!region[p]) {
      continue;
    }
    const i = p * 4;
    const y = 0.2126 * out.data[i] + 0.7152 * out.data[i + 1] + 0.0722 * out.data[i + 2];
    out.data[i] = clamp(out.data[i] * (1 - t) + y * t);
    out.data[i + 1] = clamp(out.data[i + 1] * (1 - t) + y * t);
    out.data[i + 2] = clamp(out.data[i + 2] * (1 - t) + y * t);
  }
  return out;
}

export function composeFaceTexture(
  source: ImageData,
  mask: Uint8Array,
  quad: Quad,
  brightness: number,
  contrast: number,
  saturation: number,
  reference: ImageData | null,
  matchColor: boolean,
  filterMask: Uint8Array | null,
  filterStrength: number
): ImageData {
  let prepared = source;
  if (filterMask && filterStrength > 0 && filterMask.length === source.width * source.height) {
    prepared = applyRegionFilter(source, filterMask, filterStrength);
  }
  const masked = applyMaskToImage(prepared, mask);
  const box = maskBBox(mask, source.width, source.height);
  const warped = warpPerspective(masked, quad, box?.w ?? source.width, box?.h ?? source.height);
  let next = applyBscToImageData(warped, brightness, contrast, saturation);
  if (matchColor && reference) {
    next = matchMeanColor(next, reference);
  }
  return next;
}
