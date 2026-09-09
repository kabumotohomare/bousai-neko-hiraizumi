import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CatSchema } from '../cat/model';
import { GameConfigSchema } from '../common/config';
import { isHydrantInTerritory } from '../hydrant/inTerritory';
import { HydrantSchema } from '../hydrant/model';
import { latLngToWorldPosition } from '../../services/transform/latLngToWorldPosition';
import {
  estimatePatrolPathMeters,
  improveRouteWith2Opt,
  nearestNeighborOrder,
  pathLengthMeters,
  requiredDashSpeedMps
} from './patrolPath';

describe('nearestNeighborOrder', () => {
  it('returns an empty order when there are no points', () => {
    expect(nearestNeighborOrder({ x: 0, z: 0 }, [])).toEqual([]);
  });

  it('picks the smaller index when two hydrants are equally near', () => {
    const points = [
      { x: 1, z: 0 },
      { x: 0, z: 1 }
    ];
    expect(nearestNeighborOrder({ x: 0, z: 0 }, points)).toEqual([0, 1]);
  });
});

describe('pathLengthMeters', () => {
  it('returns 0 for an empty route', () => {
    expect(pathLengthMeters({ x: 0, z: 0 }, [{ x: 3, z: 0 }], [])).toBe(0);
  });

  it('returns the distance to a single point', () => {
    expect(pathLengthMeters({ x: 0, z: 0 }, [{ x: 3, z: 0 }], [0])).toBe(3);
  });

  it('sums nearest-neighbor edges for two points', () => {
    const start = { x: 0, z: 0 };
    const points = [
      { x: 2, z: 0 },
      { x: 2, z: 4 }
    ];
    const order = nearestNeighborOrder(start, points);
    expect(order).toEqual([0, 1]);
    expect(pathLengthMeters(start, points, order)).toBe(6);
  });
});

describe('improveRouteWith2Opt', () => {
  it('shortens a crossing route', () => {
    const start = { x: 0, z: 0 };
    const points = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 1, z: 1 }
    ];
    const crossing = [1, 0, 2];
    const improved = improveRouteWith2Opt(start, points, crossing);
    expect(pathLengthMeters(start, points, improved)).toBeCloseTo(3);
    expect(pathLengthMeters(start, points, improved)).toBeLessThan(
      pathLengthMeters(start, points, crossing)
    );
  });
});

describe('estimatePatrolPathMeters', () => {
  it('returns 0 when there are no hydrants', () => {
    expect(estimatePatrolPathMeters({ x: 0, z: 0 }, [])).toBe(0);
  });
});

describe('requiredDashSpeedMps', () => {
  const bounds = { minMps: 6, maxMps: 10, pathDetourFactor: 1 };

  it('lifts a slow required speed up to minMps', () => {
    expect(
      requiredDashSpeedMps({
        ...bounds,
        pathMeters: 350,
        targetClearSec: 70
      })
    ).toBe(6);
  });

  it('hits the max exactly at 700m / 70s', () => {
    expect(
      requiredDashSpeedMps({
        ...bounds,
        pathMeters: 700,
        targetClearSec: 70
      })
    ).toBe(10);
  });

  it('clamps above the max', () => {
    expect(
      requiredDashSpeedMps({
        pathMeters: 1000,
        targetClearSec: 70,
        pathDetourFactor: 1.35,
        minMps: 6,
        maxMps: 10
      })
    ).toBe(10);
  });

  it('returns minMps when the target time is 0', () => {
    expect(
      requiredDashSpeedMps({
        ...bounds,
        pathMeters: 350,
        targetClearSec: 0
      })
    ).toBe(6);
  });
});

describe('public patrol data', () => {
  it('clamps each cat dash speed between min and max', () => {
    const cats = CatSchema.array().parse(JSON.parse(readFileSync(resolve('public/data/cats.json'), 'utf8')));
    const hydrants = HydrantSchema.array().parse(
      JSON.parse(readFileSync(resolve('public/data/hydrants.json'), 'utf8'))
    );
    const gameConfig = GameConfigSchema.parse(
      JSON.parse(readFileSync(resolve('public/data/game-config.json'), 'utf8'))
    );
    const origin = gameConfig.defaultMapCenter;

    for (const cat of cats) {
      const catWorld = latLngToWorldPosition(cat.center.lat, cat.center.lng, origin);
      const spawnWorld = latLngToWorldPosition(cat.spawn.lat, cat.spawn.lng, origin);
      const points = hydrants
        .filter((hydrant) => hydrant.status === 'active')
        .map((hydrant) => latLngToWorldPosition(hydrant.lat, hydrant.lng, origin))
        .filter((hydrantWorld) => isHydrantInTerritory(hydrantWorld, catWorld, cat.radius));
      const pathMeters = estimatePatrolPathMeters(spawnWorld, points);
      const dashSpeedMps = requiredDashSpeedMps({
        pathMeters,
        targetClearSec: gameConfig.targetClearSec,
        pathDetourFactor: gameConfig.pathDetourFactor,
        minMps: gameConfig.dashSpeedMinMps,
        maxMps: gameConfig.dashSpeedMaxMps
      });

      expect(dashSpeedMps).toBeGreaterThanOrEqual(gameConfig.dashSpeedMinMps);
      expect(dashSpeedMps).toBeLessThanOrEqual(gameConfig.dashSpeedMaxMps);
      expect(pathMeters).toBeGreaterThan(0);
      // 猫ごとの実測値をテストログに残す。
      console.log(`${cat.name}: path=${pathMeters.toFixed(1)}m dash=${dashSpeedMps.toFixed(2)}m/s n=${points.length}`);
    }
  });
});
