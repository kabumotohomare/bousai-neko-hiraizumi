import { distanceXZ, Vec2 } from '../cat/territory';

const TWO_OPT_MAX_ITERATIONS = 100;

export function nearestNeighborOrder(start: Vec2, points: Vec2[]): number[] {
  const remaining = points.map((_, index) => index);
  const order: number[] = [];
  let current = start;

  while (remaining.length > 0) {
    let bestRemainingAt = 0;
    let bestDistance = distanceXZ(current, points[remaining[0]]);

    for (let i = 1; i < remaining.length; i += 1) {
      const distance = distanceXZ(current, points[remaining[i]]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestRemainingAt = i;
      }
    }

    const nextIndex = remaining.splice(bestRemainingAt, 1)[0];
    order.push(nextIndex);
    current = points[nextIndex];
  }

  return order;
}

export function pathLengthMeters(start: Vec2, points: Vec2[], order: number[]): number {
  let length = 0;
  let current = start;

  for (const index of order) {
    length += distanceXZ(current, points[index]);
    current = points[index];
  }

  return length;
}

export function improveRouteWith2Opt(start: Vec2, points: Vec2[], order: number[]): number[] {
  let best = [...order];
  let bestLength = pathLengthMeters(start, points, best);
  let improved = true;
  let iterations = 0;

  while (improved && iterations < TWO_OPT_MAX_ITERATIONS) {
    improved = false;
    iterations += 1;

    for (let i = 0; i < best.length - 1; i += 1) {
      for (let j = i + 1; j < best.length; j += 1) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const candidateLength = pathLengthMeters(start, points, candidate);
        if (candidateLength + 1e-9 < bestLength) {
          best = candidate;
          bestLength = candidateLength;
          improved = true;
          break;
        }
      }
      if (improved) {
        break;
      }
    }
  }

  return best;
}

export function estimatePatrolPathMeters(start: Vec2, points: Vec2[]): number {
  if (points.length === 0) {
    return 0;
  }

  const initial = nearestNeighborOrder(start, points);
  const improved = improveRouteWith2Opt(start, points, initial);
  return pathLengthMeters(start, points, improved);
}

export function requiredDashSpeedMps(input: {
  pathMeters: number;
  targetClearSec: number;
  pathDetourFactor: number;
  minMps: number;
  maxMps: number;
}): number {
  if (input.targetClearSec <= 0 || input.pathMeters <= 0) {
    return input.minMps;
  }

  const required = (input.pathMeters * input.pathDetourFactor) / input.targetClearSec;
  return Math.min(input.maxMps, Math.max(input.minMps, required));
}
