import { describe, expect, it } from 'vitest';
import { defaultScenarioMessages } from '../common/messages';
import { ScenarioContext, ScenarioMark } from './context';
import { fill, resolveFeetBranch, resolveMapBranch, selectLines } from './lines';

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

describe('resolveMapBranch', () => {
  it('splits by known rate', () => {
    expect(resolveMapBranch(ctx({ knownRate: 0 }))).toBe('empty');
    expect(resolveMapBranch(ctx({ knownRate: 0.25 }))).toBe('low');
    expect(resolveMapBranch(ctx({ knownRate: 0.5 }))).toBe('high');
    expect(resolveMapBranch(ctx({ knownRate: 0.75 }))).toBe('high');
    expect(resolveMapBranch(ctx({ knownRate: 1 }))).toBe('complete');
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
    // 最速との差が閾値未満なら best ではなく same
    expect(resolveFeetBranch(ctx({ inspectedCount: 4, lastMarkSec: 59, previousRun: prev }))).toBe(
      'same'
    );
    // 全部点検していなければ best にならない
    expect(
      resolveFeetBranch(
        ctx({ inspectedCount: 3, lastMarkSec: 20, previousRun: { ...prev, inspected: 3 } })
      )
    ).toBe('faster');
  });

  it('compares mark counts before time', () => {
    expect(resolveFeetBranch(ctx({ inspectedCount: 3, lastMarkSec: 30, previousRun: prev }))).toBe(
      'fewerMarks'
    );
    expect(
      resolveFeetBranch(
        ctx({ inspectedCount: 4, lastMarkSec: 80, previousRun: { ...prev, inspected: 3 } })
      )
    ).toBe('moreMarks');
  });

  it('compares time when mark counts match, with a 2s dead zone', () => {
    // 過去の最速（45秒）には届かないが、前回（60秒）より速い
    expect(
      resolveFeetBranch(
        ctx({ inspectedCount: 4, lastMarkSec: 50, previousRun: { ...prev, bestLastMarkSec: 45 } })
      )
    ).toBe('faster');
    expect(resolveFeetBranch(ctx({ inspectedCount: 4, lastMarkSec: 59, previousRun: prev }))).toBe(
      'same'
    );
    expect(resolveFeetBranch(ctx({ inspectedCount: 4, lastMarkSec: 61, previousRun: prev }))).toBe(
      'same'
    );
    expect(resolveFeetBranch(ctx({ inspectedCount: 4, lastMarkSec: 70, previousRun: prev }))).toBe(
      'slower'
    );
  });
});

describe('selectLines', () => {
  it('0 marks: white record, nearest hint, no feet, open closing', () => {
    const lines = selectLines(ctx(), m);

    expect(lines.mapBranch).toBe('empty');
    expect(lines.mapLine).toBe('ひがしの なわばりの 記録は、まだ しろい。');
    expect(lines.mapGainedLine).toBeNull();
    expect(lines.noseLines).toEqual([
      'いちばん近い「まだ」は、みなみ 50m。',
      'みなみ 50mの あとに まわると、ちかい。'
    ]);
    expect(lines.feetBranch).toBe('none');
    expect(lines.feetPrevLine).toBeNull();
    expect(lines.closingLine).toBe('つぎの ねこの時間まで、記録は のこる。');
  });

  it('partial: fills missing count and gained count', () => {
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

    expect(lines.mapLine).toBe('ひがしの なわばりで、まだ しらない 赤が 3つ。');
    expect(lines.mapGainedLine).toBe('きょう、記録に ふえた しるし: 1つ。');
    expect(lines.feetLine).toBe('この からだに、はじめて はいった。さいごの しるしまで 30秒。');
  });

  it('complete with a sleeping cat: no hint, sleeping nose and closing', () => {
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

    expect(lines.mapLine).toBe('ひがしの なわばりの 記録は、できた。');
    expect(lines.noseLines).toEqual([
      'この なわばりに、しらない においは ない。',
      'においは、にしの なわばりから。まだ、だれの 記録にも ない。'
    ]);
    expect(lines.feetBranch).toBe('best');
    expect(lines.feetLine).toBe('この からだの、いちばん はやい 足。66秒。');
    expect(lines.feetPrevLine).toBe('まえ: 4つ、75秒。');
    expect(lines.closingBranch).toBe('sleeping');
    expect(lines.closingLine).toBe(
      'シラヤマは、からだを まっている。まちの ひとが ねこを みつけたら、はいれる。'
    );
  });

  it('closing: all awake but other territories unfinished', () => {
    const lines = selectLines(ctx({ otherTerritoriesUnfinished: true }), m);
    expect(lines.closingBranch).toBe('allAwake');
    expect(lines.closingLine).toBe('べつの なわばりの 記録も、まだ しろい。');
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

    expect(lines.mapLine).toBe('記録の はんぶんより むこうが、見えた。まだ 1つ。');
    expect(lines.noseLines).toEqual(['いちばん近い「まだ」は、きたにし 120m。']);
  });
});
