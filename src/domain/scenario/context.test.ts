import { describe, expect, it } from 'vitest';
import { Cat } from '../cat/model';
import { Hydrant } from '../hydrant/model';
import { PatrolSession } from '../session/model';
import {
  buildScenarioContext,
  catAlias,
  directionLabel,
  headingDeg,
  roundDistance
} from './context';

const origin = { lat: 38.99, lng: 141.115 };
const metersPerLat = 111320;
const metersPerLng = 111320 * Math.cos((origin.lat * Math.PI) / 180);

/** 原点から東へ x[m]・北へ north[m] ずらした緯度経度 */
function offset(eastM: number, northM: number) {
  return { lat: origin.lat + northM / metersPerLat, lng: origin.lng + eastM / metersPerLng };
}

function cat(overrides: Partial<Cat> = {}): Cat {
  return {
    id: 'cat_test',
    name: 'テスト',
    displayAreaName: 'どこか',
    aliasName: 'ひがしの なわばり',
    status: 'unlocked',
    center: origin,
    radius: 150,
    spawn: origin,
    namedBy: 'test',
    territoryColor: '#ea580c',
    lastUpdated: '2026-01-01',
    version: 1,
    ...overrides
  };
}

function hydrant(
  id: string,
  eastM: number,
  northM: number,
  status: Hydrant['status'] = 'active'
): Hydrant {
  const { lat, lng } = offset(eastM, northM);
  return { id, sourceId: id, name: id, lat, lng, type: 'ground', status };
}

function session(overrides: Partial<PatrolSession> = {}): PatrolSession {
  return {
    catId: 'cat_test',
    startedAt: '2026-01-01T00:00:00.000Z',
    remainingSec: 0,
    score: 0,
    inspectedHydrantIds: [],
    finished: true,
    paused: false,
    dashSpeedMps: 6,
    inspectedAtSec: [],
    knownHydrantIdsAtStart: [],
    previousRun: null,
    ...overrides
  };
}

const hydrants: Hydrant[] = [
  hydrant('south', 0, -48),
  hydrant('southwest', -52, -52),
  hydrant('north', 0, 82),
  hydrant('northwest', -85, 85),
  hydrant('far', 400, 0),
  hydrant('inactive', 10, 10, 'inactive')
];

describe('directionLabel / headingDeg', () => {
  const from = { x: 0, z: 0 };

  it('treats -z as north and goes clockwise', () => {
    expect(headingDeg(from, { x: 0, z: -10 })).toBe(0);
    expect(headingDeg(from, { x: 10, z: 0 })).toBe(90);
    expect(headingDeg(from, { x: 0, z: 10 })).toBe(180);
    expect(headingDeg(from, { x: -10, z: 0 })).toBe(270);
  });

  it('maps to 8 compass labels', () => {
    expect(directionLabel(from, { x: 0, z: -10 })).toBe('きた');
    expect(directionLabel(from, { x: 10, z: -10 })).toBe('きたひがし');
    expect(directionLabel(from, { x: 10, z: 0 })).toBe('ひがし');
    expect(directionLabel(from, { x: 0, z: 10 })).toBe('みなみ');
    expect(directionLabel(from, { x: -10, z: 10 })).toBe('みなみにし');
    expect(directionLabel(from, { x: -10, z: -10 })).toBe('きたにし');
  });
});

describe('roundDistance', () => {
  it('rounds to 10m and never below 10', () => {
    expect(roundDistance(48)).toBe(50);
    expect(roundDistance(74)).toBe(70);
    expect(roundDistance(2)).toBe(10);
  });
});

describe('catAlias', () => {
  it('falls back to name-based alias', () => {
    expect(catAlias({ name: 'タキザワ', aliasName: undefined })).toBe('タキザワの なわばり');
    expect(catAlias({ name: 'タキザワ', aliasName: 'ひがしの なわばり' })).toBe(
      'ひがしの なわばり'
    );
  });
});

describe('buildScenarioContext', () => {
  it('counts only active hydrants inside the territory, sorted by distance', () => {
    const ctx = buildScenarioContext({
      cat: cat(),
      cats: [cat()],
      hydrants,
      session: session(),
      origin
    });

    expect(ctx.total).toBe(4);
    expect(ctx.marks.map((mark) => mark.id)).toEqual(['south', 'southwest', 'north', 'northwest']);
    expect(ctx.marks[0].label).toBe('みなみ 50m');
    expect(ctx.marks[1].direction).toBe('みなみにし');
    expect(ctx.marks[2].label).toBe('きた 80m');
    expect(ctx.marks[3].direction).toBe('きたにし');
  });

  it('reports an empty record when nothing was inspected', () => {
    const ctx = buildScenarioContext({
      cat: cat(),
      cats: [cat()],
      hydrants,
      session: session(),
      origin
    });

    expect(ctx.inspectedCount).toBe(0);
    expect(ctx.knownRate).toBe(0);
    expect(ctx.missing).toBe(4);
    expect(ctx.nearestMissed?.id).toBe('south');
    expect(ctx.nextHop?.id).toBe('southwest');
    expect(ctx.lastMarkSec).toBeNull();
    expect(ctx.secPerMark).toBeNull();
  });

  it('merges known-before and inspected-this-run into the record', () => {
    const ctx = buildScenarioContext({
      cat: cat(),
      cats: [cat()],
      hydrants,
      session: session({
        inspectedHydrantIds: ['north'],
        inspectedAtSec: [40],
        knownHydrantIdsAtStart: ['south']
      }),
      origin
    });

    expect(ctx.inspectedCount).toBe(1);
    expect(ctx.knownBeforeCount).toBe(1);
    expect(ctx.knownCount).toBe(2);
    expect(ctx.gained).toBe(1);
    expect(ctx.knownRate).toBe(0.5);
    expect(ctx.missing).toBe(2);
    expect(ctx.nearestMissed?.id).toBe('southwest');
    expect(ctx.nextHop?.id).toBe('northwest');
    expect(ctx.lastMarkSec).toBe(40);
    expect(ctx.secPerMark).toBe(40);
  });

  it('has no next hop when everything is recorded', () => {
    const ctx = buildScenarioContext({
      cat: cat(),
      cats: [cat()],
      hydrants,
      session: session({
        inspectedHydrantIds: ['south', 'southwest', 'north', 'northwest'],
        inspectedAtSec: [10, 25, 50, 66]
      }),
      origin
    });

    expect(ctx.knownRate).toBe(1);
    expect(ctx.nearestMissed).toBeNull();
    expect(ctx.nextHop).toBeNull();
    expect(ctx.lastMarkSec).toBe(66);
    expect(ctx.secPerMark).toBe(17);
  });

  it('lists locked cats as sleeping, excluding the current one', () => {
    const other = cat({
      id: 'cat_other',
      name: 'ほか',
      aliasName: 'にしの なわばり',
      status: 'locked'
    });
    const ctx = buildScenarioContext({
      cat: cat(),
      cats: [cat(), other],
      hydrants,
      session: session(),
      origin
    });

    expect(ctx.sleepingCats).toEqual([{ id: 'cat_other', name: 'ほか', alias: 'にしの なわばり' }]);
  });

  it('flags other awake territories whose record is not yet complete', () => {
    // 東に 400m 離れた別の猫（unlocked）。その縄張りには 'far' だけが入る。
    const farCenter = offset(400, 0);
    const other = cat({
      id: 'cat_other',
      name: 'ほか',
      status: 'unlocked',
      center: farCenter,
      spawn: farCenter,
      radius: 50
    });

    const unfinished = buildScenarioContext({
      cat: cat(),
      cats: [cat(), other],
      hydrants,
      session: session(),
      origin
    });
    expect(unfinished.otherTerritoriesUnfinished).toBe(true);

    const finished = buildScenarioContext({
      cat: cat(),
      cats: [cat(), other],
      hydrants,
      session: session({ knownHydrantIdsAtStart: ['far'] }),
      origin
    });
    expect(finished.otherTerritoriesUnfinished).toBe(false);

    // locked の猫は対象外
    const locked = buildScenarioContext({
      cat: cat(),
      cats: [cat(), { ...other, status: 'locked' }],
      hydrants,
      session: session(),
      origin
    });
    expect(locked.otherTerritoriesUnfinished).toBe(false);
  });

  it('carries the previous run through untouched', () => {
    const previousRun = {
      inspected: 3,
      lastMarkSec: 70,
      bestLastMarkSec: null,
      at: '2026-01-01T00:00:00.000Z'
    };
    const ctx = buildScenarioContext({
      cat: cat(),
      cats: [cat()],
      hydrants,
      session: session({ previousRun }),
      origin
    });

    expect(ctx.previousRun).toEqual(previousRun);
  });
});
