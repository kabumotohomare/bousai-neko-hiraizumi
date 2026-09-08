export interface RoadRibbon {
  positions: number[];
  uvs: number[];
  indices: number[];
}

const MIN_SEGMENT_M = 0.05;
const TEXTURE_METERS = 8;
const MITER_LIMIT = 4;

function normalize(x: number, z: number): { x: number; z: number } {
  const length = Math.hypot(x, z);
  if (length < 1e-6) {
    return { x: 0, z: 0 };
  }
  return { x: x / length, z: z / length };
}

function dedupePath(path: { x: number; z: number }[]): { x: number; z: number }[] {
  const points: { x: number; z: number }[] = [];
  for (const point of path) {
    const previous = points[points.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.z - previous.z) >= MIN_SEGMENT_M) {
      points.push(point);
    }
  }
  return points;
}

function tangentAt(points: { x: number; z: number }[], index: number): { x: number; z: number } {
  if (index === 0) {
    return normalize(points[1].x - points[0].x, points[1].z - points[0].z);
  }
  if (index === points.length - 1) {
    const previous = points[index - 1];
    const current = points[index];
    return normalize(current.x - previous.x, current.z - previous.z);
  }
  return normalize(points[index + 1].x - points[index - 1].x, points[index + 1].z - points[index - 1].z);
}

// 進行方向 (dx, dz) の右側。北向き (0, -1) なら東 (1, 0)。
function rightNormal(tangent: { x: number; z: number }): { x: number; z: number } {
  return { x: -tangent.z, z: tangent.x };
}

export function toRoadRibbon(
  path: { x: number; z: number }[],
  width: number,
  y = 0
): RoadRibbon {
  const points = dedupePath(path);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  if (points.length < 2 || width <= 0) {
    return { positions, uvs, indices };
  }

  const halfWidth = width / 2;
  let distance = 0;

  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) {
      distance += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    }

    const tangent = tangentAt(points, i);
    const right = rightNormal(tangent);
    let miter = 1;
    if (i > 0 && i < points.length - 1) {
      const incoming = normalize(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
      const incomingRight = rightNormal(incoming);
      const alignment = incomingRight.x * right.x + incomingRight.z * right.z;
      if (Math.abs(alignment) > 1e-4) {
        miter = Math.min(MITER_LIMIT, 1 / alignment);
      }
    }

    const offset = halfWidth * miter;
    const leftX = points[i].x - right.x * offset;
    const leftZ = points[i].z - right.z * offset;
    const rightX = points[i].x + right.x * offset;
    const rightZ = points[i].z + right.z * offset;
    const v = distance / TEXTURE_METERS;

    positions.push(leftX, y, leftZ, rightX, y, rightZ);
    uvs.push(0, v, 1, v);

    if (i > 0) {
      const base = (i - 1) * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  return { positions, uvs, indices };
}
