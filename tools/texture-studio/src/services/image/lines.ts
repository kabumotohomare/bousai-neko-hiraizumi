import { defaultInsetQuad, intersectLines, Point, Quad } from './perspectiveMath';

type Line = { x1: number; y1: number; x2: number; y2: number; score: number; angle: number };

function toGray(image: ImageData): Float32Array {
  const gray = new Float32Array(image.width * image.height);
  const d = image.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
    gray[p] = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  }
  return gray;
}

function sobelMag(gray: Float32Array, width: number, height: number): Float32Array {
  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] +
        gray[i - width + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + width - 1] +
        gray[i + width + 1];
      const gy =
        -gray[i - width - 1] -
        2 * gray[i - width] -
        gray[i - width + 1] +
        gray[i + width - 1] +
        2 * gray[i + width] +
        gray[i + width + 1];
      mag[i] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

export function detectGuideLines(image: ImageData): {
  left: Line | null;
  right: Line | null;
  ground: Line | null;
  quad: Quad;
} {
  const { width, height } = image;
  const gray = toGray(image);
  const mag = sobelMag(gray, width, height);
  let maxMag = 1;
  for (const v of mag) {
    if (v > maxMag) {
      maxMag = v;
    }
  }
  const edgeThresh = maxMag * 0.18;
  const verticals: Line[] = [];
  const horizontals: Line[] = [];

  const thetaStep = (2 * Math.PI) / 180;
  for (let angle = -20; angle <= 20; angle += 2) {
    collectLines(mag, width, height, edgeThresh, 90 + angle, thetaStep, verticals);
  }
  for (let angle = -12; angle <= 12; angle += 2) {
    collectLines(mag, width, height, edgeThresh, angle, thetaStep, horizontals);
  }

  const left = bestInRange(verticals, 0, width * 0.45, true, width);
  const right = bestInRange(verticals, width * 0.55, width, true, width);
  const ground = bestInRange(horizontals, height * 0.55, height, false, height);

  const fallback = defaultInsetQuad(width, height);
  if (!left || !right) {
    return { left, right, ground, quad: fallback };
  }

  const top: [Point, Point] = [
    { x: 0, y: 0 },
    { x: width, y: 0 }
  ];
  const bottom: [Point, Point] = ground
    ? [
        { x: ground.x1, y: ground.y1 },
        { x: ground.x2, y: ground.y2 }
      ]
    : [
        { x: 0, y: height * 0.92 },
        { x: width, y: height * 0.92 }
      ];
  const l1 = { x: left.x1, y: left.y1 };
  const l2 = { x: left.x2, y: left.y2 };
  const r1 = { x: right.x1, y: right.y1 };
  const r2 = { x: right.x2, y: right.y2 };
  const tl = intersectLines(l1, l2, top[0], top[1]) ?? fallback[0];
  const tr = intersectLines(r1, r2, top[0], top[1]) ?? fallback[1];
  const br = intersectLines(r1, r2, bottom[0], bottom[1]) ?? fallback[2];
  const bl = intersectLines(l1, l2, bottom[0], bottom[1]) ?? fallback[3];
  return { left, right, ground, quad: [tl, tr, br, bl] };
}

function collectLines(
  mag: Float32Array,
  width: number,
  height: number,
  thresh: number,
  angleDeg: number,
  _thetaStep: number,
  out: Line[]
): void {
  const theta = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const acc = new Map<number, number>();
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      if (mag[y * width + x] < thresh) {
        continue;
      }
      const rho = Math.round(x * cos + y * sin);
      acc.set(rho, (acc.get(rho) ?? 0) + mag[y * width + x]);
    }
  }
  let bestRho = 0;
  let bestScore = 0;
  for (const [rho, score] of acc) {
    if (score > bestScore) {
      bestRho = rho;
      bestScore = score;
    }
  }
  if (bestScore <= 0) {
    return;
  }
  const x1 = 0;
  const y1 = sin === 0 ? 0 : (bestRho - x1 * cos) / sin;
  const x2 = width - 1;
  const y2 = sin === 0 ? height - 1 : (bestRho - x2 * cos) / sin;
  out.push({ x1, y1, x2, y2, score: bestScore, angle: angleDeg });
}

function bestInRange(
  lines: Line[],
  min: number,
  max: number,
  vertical: boolean,
  span: number
): Line | null {
  let best: Line | null = null;
  for (const line of lines) {
    const mid = vertical ? (line.x1 + line.x2) / 2 : (line.y1 + line.y2) / 2;
    if (mid < min || mid > max) {
      continue;
    }
    if (!best || line.score > best.score) {
      best = line;
    }
  }
  if (!best && span) {
    return null;
  }
  return best;
}

export type GuideLine = Line;
