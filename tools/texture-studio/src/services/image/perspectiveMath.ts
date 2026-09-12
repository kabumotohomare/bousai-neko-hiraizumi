export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];

export function invert3(m: number[]): number[] | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) {
    return null;
  }
  const inv = 1 / det;
  return [A, D, G, B, E, H, C, F, I].map((v) => v * inv);
}

function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(m[pivot][col]) < 1e-10) {
      return null;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const div = m[col][col];
    for (let j = col; j <= n; j += 1) {
      m[col][j] /= div;
    }
    for (let row = 0; row < n; row += 1) {
      if (row === col) {
        continue;
      }
      const factor = m[row][col];
      for (let j = col; j <= n; j += 1) {
        m[row][j] -= factor * m[col][j];
      }
    }
  }
  return m.map((row) => row[n]);
}

export function getPerspectiveTransform(src: Quad, dst: Quad): number[] | null {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const s = src[i];
    const d = dst[i];
    a.push([s.x, s.y, 1, 0, 0, 0, -d.x * s.x, -d.x * s.y]);
    b.push(d.x);
    a.push([0, 0, 0, s.x, s.y, 1, -d.y * s.x, -d.y * s.y]);
    b.push(d.y);
  }
  const h = solveLinear(a, b);
  if (!h) {
    return null;
  }
  return [...h, 1];
}

function mul3(m: number[], p: Point): Point | null {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  if (Math.abs(w) < 1e-12) {
    return null;
  }
  return {
    x: (m[0] * p.x + m[1] * p.y + m[2]) / w,
    y: (m[3] * p.x + m[4] * p.y + m[5]) / w
  };
}

function sampleBilinear(src: ImageData, x: number, y: number): [number, number, number, number] {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 >= src.width - 1 || y0 >= src.height - 1) {
    return [0, 0, 0, 0];
  }
  const dx = x - x0;
  const dy = y - y0;
  const idx = (xx: number, yy: number) => (yy * src.width + xx) * 4;
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const i00 = idx(x0, y0);
  const i10 = idx(x0 + 1, y0);
  const i01 = idx(x0, y0 + 1);
  const i11 = idx(x0 + 1, y0 + 1);
  const d = src.data;
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c += 1) {
    const v0 = mix(d[i00 + c], d[i10 + c], dx);
    const v1 = mix(d[i01 + c], d[i11 + c], dx);
    out[c] = mix(v0, v1, dy);
  }
  return out;
}

export function warpPerspective(source: ImageData, srcQuad: Quad, outWidth: number, outHeight: number): ImageData {
  const dst: Quad = [
    { x: 0, y: 0 },
    { x: outWidth - 1, y: 0 },
    { x: outWidth - 1, y: outHeight - 1 },
    { x: 0, y: outHeight - 1 }
  ];
  const forward = getPerspectiveTransform(srcQuad, dst);
  if (!forward) {
    return new ImageData(outWidth, outHeight);
  }
  const inverse = invert3(forward);
  if (!inverse) {
    return new ImageData(outWidth, outHeight);
  }
  const out = new ImageData(outWidth, outHeight);
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const src = mul3(inverse, { x, y });
      const i = (y * outWidth + x) * 4;
      if (!src) {
        continue;
      }
      const [r, g, b, a] = sampleBilinear(source, src.x, src.y);
      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
      out.data[i + 3] = a;
    }
  }
  return out;
}

export function defaultInsetQuad(width: number, height: number): Quad {
  const ix = width * 0.12;
  const iy = height * 0.1;
  return [
    { x: ix, y: iy },
    { x: width - ix, y: iy },
    { x: width - ix, y: height - iy },
    { x: ix, y: height - iy }
  ];
}

export function intersectLines(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point
): Point | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const det = dax * dby - day * dbx;
  if (Math.abs(det) < 1e-8) {
    return null;
  }
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / det;
  return { x: a1.x + t * dax, y: a1.y + t * day };
}
