import { describe, expect, it } from 'vitest';
import { defaultScenarioMessages } from '../common/messages';
import { ScenarioContext, ScenarioMark } from './context';
import {
  fill,
  resolveClosingBranch,
  resolveFeetBranch,
  resolveFoundBranch,
  resolveMapBranch,
  selectLines
} from './lines';

function mark(id: string, label: string, known: boolean): ScenarioMark {
  const [direction, distance] = label.split(' ');
  return {
    id,
    direction: direction as ScenarioMark['direction'],
    distanceM: Number.parseInt(distance, 10),
    label,
    inspectedThisRun: known,
    knownBefore: false,
    known
  };
}

function ctx(overrides: Partial<ScenarioContext> = {}): ScenarioContext {
  const marks = [
    mark('a', 'みなみ 50m', false),
    mark('b', 'みなみにし 70m', false),
    mark('c', 'きた 80m', false),
    mark('d', 'きたにし 120m', false)
  ];
  return {
    catId: 'cat_002',
    catName: 'タキザワ',
    alias: 'ひがしの なわばり',
    total: 4,
    marks,
    inspectedCount: 0,
    knownCount: 0,
    knownBeforeCount: 0,
    gained: 0,
    knownRate: 0,
    missing: 4,
    nearestMissed: marks[0],
    nextHop: marks[1],
    lastMarkSec: null,
    secPerMark: null,
    previousRun: null,
    sleepingCats: [],
    otherCats: [],
    otherTerritoriesUnfinished: false,
    ...overrides
  };
}

const m = defaultScenarioMessages;

describe('fill', () => {
  it('replaces known placeholders and leaves unknown ones', () => {
    expect(fill('{a} と {b} と {c}', { a: 1, b: 'に' })).toBe('1 と に と {c}');
  });
});

describe('resolveMapBranch (mood)', () => {
  it('splits by known rate', () => {
    expect(resolveMapBranch(ctx({ knownRate: 0 }))).toBe('empty');
    expect(resolveMapBranch(ctx({ knownRate: 0.25 }))).toBe('low');
    expect(resolveMapBranch(ctx({ knownRate: 0.5 }))).toBe('high');
    expect(resolveMapBranch(ctx({ knownRate: 0.75 }))).toBe('high');
    expect(resolveMapBranch(ctx({ knownRate: 1 }))).toBe('complete');
  });
});

describe('resolveFoundBranch', () => {
  it('uses this run for empty/found and the whole record for complete', () => {
    expect(resolveFoundBranch(ctx())).toBe('empty');
    // 前の回で 2 本知っていても、今日 0 本なら「見つからなかった」
    expect(resolveFoundBranch(ctx({ knownCount: 2, knownRate: 0.5 }))).toBe('empty');
    expect(resolveFoundBranch(ctx({ inspectedCount: 1, knownCount: 1, knownRate: 0.25 }))).toBe(
      'found'
    );
    expect(resolveFoundBranch(ctx({ inspectedCount: 1, knownCount: 4, knownRate: 1 }))).toBe(
      'complete'
    );
  });
});

describe('resolveFeetBranch', () => {
  const prev = { inspected: 4, lastMarkSec: 60, bestLastMarkSec: 60, at: '' };

  it('is none without any inspection', () => {
    expect(resolveFeetBranch(ctx())).toBe('none');
  });

  it('is first without a previous run', () => {
    expect(resolveFeetBranch(ctx({ inspectedCount: 2, lastMarkSec: 40 }))).toBe('first');
    expect(
      resolveFeetBranch(
        ctx({
          inspectedCount: 2,
          lastMarkSec: 40,
          previousRun: { inspected: 0, lastMarkSec: null, bestLastMarkSec: null, at: '' }
        })
      )
    ).toBe('first');
  });

  it('is best when all marks are cleared faster than the previous best', () => {
    expect(resolveFeetBranch(ctx({ inspectedCount: 4, lastMarkSec: 55, previousRun: prev }))).toBe(
      'best'
    );
    // 最速との差が閾値未満なら best にならない
    expect(resolveFeetBranch(ctx({ inspectedCount: 4, lastMarkSec: 59, previousRun: prev }))).toBe(
      'notFaster'
    );
    // 全部点検していなければ best にならない（前回より速ければ faster）
    expect(
      resolveFeetBranch(
        ctx({ inspectedCount: 3, lastMarkSec: 20, previousRun: { ...prev, inspected: 3 } })
      )
    ).toBe('faster');
  });

  it('is faster only with the same or more marks and a clearly shorter time', () => {
    // 過去の最速（45秒）には届かないが、前回（60秒）より速い
    expect(
      resolveFeetBranch(
        ctx({ inspectedCount: 4, lastMarkSec: 50, previousRun: { ...prev, bestLastMarkSec: 45 } })
      )
    ).toBe('faster');
    // 本数が増えて、かつ速い（前回は全部点検していないので自己ベストは未記録）
    expect(
      resolveFeetBranch(
        ctx({
          inspectedCount: 4,
          lastMarkSec: 50,
          previousRun: { ...prev, inspected: 3, bestLastMarkSec: null }
        })
      )
    ).toBe('faster');
    // 本数が減った短縮は速いと数えない
    expect(resolveFeetBranch(ctx({ inspectedCount: 2, lastMarkSec: 20, previousRun: prev }))).toBe(
      'notFaster'
    );
  });

  it('treats same or slower time as notFaster (2s dead zone)', () => {
    expect(resolveFeetBranch(ctx({ inspectedCount: 4, lastMarkSec: 59, previousRun: prev }))).toBe(
      'notFaster'
    );
    expect(resolveFeetBranch(ctx({ inspectedCount: 4, lastMarkSec: 60, previousRun: prev }))).toBe(
      'notFaster'
    );
    expect(resolveFeetBranch(ctx({ inspectedCount: 4, lastMarkSec: 70, previousRun: prev }))).toBe(
      'notFaster'
    );
  });
});

describe('resolveClosingBranch', () => {
  const shirayama = { id: 'cat_001', name: 'シラヤマ', alias: 'にしの なわばり' };
  it('prefers a sleeping (locked) cat, then another playable cat, else none', () => {
    expect(resolveClosingBranch(ctx({ sleepingCats: [shirayama] }))).toBe('sleeping');
    expect(resolveClosingBranch(ctx({ otherCats: [shirayama] }))).toBe('nextCat');
    expect(resolveClosingBranch(ctx())).toBe('none');
  });
});

describe('selectLines', () => {
  it('0 marks: not found, nearest hint with hop, no feet, no cat guide', () => {
    const lines = selectLines(ctx(), m);

    expect(lines.foundBranch).toBe('empty');
    expect(lines.mapLine).toBe('きょうは 見つからなかったニャ');
    expect(lines.mapGainedLine).toBeNull();
    expect(lines.noseLines).toEqual([
      'つぎは みなみ 50m に あるニャ',
      'その あとは みなみにし 70mニャ'
    ]);
    expect(lines.feetBranch).toBe('none');
    expect(lines.feetLine).toBe('つぎは 時間内に 見つけるニャ');
    expect(lines.feetPrevLine).toBeNull();
    expect(lines.closingBranch).toBe('none');
    expect(lines.closingLine).toBeNull();
  });

  it('partial first run: found count, no gained line (same number), first time', () => {
    const lines = selectLines(
      ctx({
        inspectedCount: 1,
        knownCount: 1,
        gained: 1,
        knownRate: 0.25,
        missing: 3,
        lastMarkSec: 30
      }),
      m
    );

    expect(lines.mapLine).toBe('消火栓を 1こ みつけられたニャ');
    expect(lines.mapGainedLine).toBeNull();
    expect(lines.feetLine).toBe('はじめての タイムだニャ。30秒');
  });

  it('partial with an earlier record: gained line appears', () => {
    const lines = selectLines(
      ctx({
        inspectedCount: 2,
        knownBeforeCount: 1,
        knownCount: 2,
        gained: 1,
        knownRate: 0.5,
        missing: 2,
        lastMarkSec: 30,
        previousRun: { inspected: 1, lastMarkSec: 40, bestLastMarkSec: 40, at: '' }
      }),
      m
    );

    expect(lines.mapLine).toBe('消火栓を 2こ みつけられたニャ');
    expect(lines.mapGainedLine).toBe('あたらしく 見つけたのは 1こニャ');
    expect(lines.feetBranch).toBe('faster');
    expect(lines.feetLine).toBe('前回よりも 早く できたニャ。30秒');
    expect(lines.feetPrevLine).toBe('まえ: 1こ、40秒');
  });

  it('complete with a sleeping cat: no nose lines, best time, locked cat guide', () => {
    const lines = selectLines(
      ctx({
        inspectedCount: 4,
        knownCount: 4,
        gained: 4,
        knownRate: 1,
        missing: 0,
        nearestMissed: null,
        nextHop: null,
        lastMarkSec: 66,
        secPerMark: 17,
        previousRun: { inspected: 4, lastMarkSec: 75, bestLastMarkSec: 75, at: '' },
        sleepingCats: [{ id: 'cat_001', name: 'シラヤマ', alias: 'にしの なわばり' }]
      }),
      m
    );

    expect(lines.mapLine).toBe('ぜんぶ 見つけたニャ！');
    expect(lines.noseLines).toEqual([]);
    expect(lines.feetBranch).toBe('best');
    expect(lines.feetLine).toBe('自己ベストだニャ！ 66秒');
    expect(lines.feetPrevLine).toBe('まえ: 4こ、75秒');
    expect(lines.closingBranch).toBe('sleeping');
    expect(lines.closingLine).toBe('にしの なわばりにも ねこが いるニャ。見かけたら おしえてニャ');
  });

  it('another playable cat: suggests it by name', () => {
    const lines = selectLines(
      ctx({ otherCats: [{ id: 'cat_001', name: 'シラヤマ', alias: 'にしの なわばり' }] }),
      m
    );
    expect(lines.closingBranch).toBe('nextCat');
    expect(lines.closingLine).toBe('次は シラヤマで プレーしてみようニャ');
  });

  it('single missing mark has no hop line', () => {
    const marks = [
      mark('a', 'みなみ 50m', true),
      mark('b', 'みなみにし 70m', true),
      mark('c', 'きた 80m', true),
      mark('d', 'きたにし 120m', false)
    ];
    const lines = selectLines(
      ctx({
        marks,
        inspectedCount: 3,
        knownCount: 3,
        gained: 3,
        knownRate: 0.75,
        missing: 1,
        nearestMissed: marks[3],
        nextHop: null,
        lastMarkSec: 50
      }),
      m
    );

    expect(lines.mapLine).toBe('消火栓を 3こ みつけられたニャ');
    expect(lines.noseLines).toEqual(['つぎは きたにし 120m に あるニャ']);
  });
});
