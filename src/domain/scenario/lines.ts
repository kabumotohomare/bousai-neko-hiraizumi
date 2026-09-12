import { ScenarioMessages } from '../common/messages';
import { ScenarioContext } from './context';

/**
 * フラグ（ScenarioContext）から表示する文を選ぶ。
 * 文言そのものは messages.json の scenario ブロックが正本。ここは分岐だけ。
 *
 * リザルトは 4 スライド:
 *   終わり → 結果1（見つけた＝目 / のこってる＝鼻）→ 結果2（タイム＝足）→ 再挑戦
 */

/** 記録の埋まり具合。画面の色（data-mood）にも使う */
export type MapBranch = 'empty' | 'low' | 'high' | 'complete';
/** 今回の「見つけた」一行の分岐 */
export type FoundBranch = 'empty' | 'found' | 'complete';
export type FeetBranch = 'none' | 'first' | 'best' | 'faster' | 'notFaster';
/** 再挑戦スライドの猫案内 */
export type ClosingBranch = 'sleeping' | 'nextCat' | 'none';

export interface ScenarioLines {
  mapBranch: MapBranch;
  foundBranch: FoundBranch;
  mapLine: string;
  /** 前からの記録があり、この回で新しく増えたときだけ入る */
  mapGainedLine: string | null;
  /** のこってる消火栓がないときは空 */
  noseLines: string[];
  feetBranch: FeetBranch;
  feetLine: string;
  /** 前回があるときだけ入る */
  feetPrevLine: string | null;
  closingBranch: ClosingBranch;
  closingLine: string | null;
}

/** 前回比で「速い」と判定する最小差（秒） */
export const FEET_DIFF_THRESHOLD_SEC = 2;

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

export function resolveMapBranch(ctx: ScenarioContext): MapBranch {
  if (ctx.knownRate >= 1) return 'complete';
  if (ctx.knownRate <= 0) return 'empty';
  if (ctx.knownRate < 0.5) return 'low';
  return 'high';
}

export function resolveFoundBranch(ctx: ScenarioContext): FoundBranch {
  if (ctx.knownRate >= 1) return 'complete';
  if (ctx.inspectedCount === 0) return 'empty';
  return 'found';
}

/**
 * タイムの分岐。
 * - none: 1本も点検していない
 * - first: この猫で初めて（比べる前回がない）
 * - best: 全部点検して、これまでの最速を閾値以上 上回った
 * - faster: 前回と同じ本数以上を、前回より閾値以上 速く回った
 * - notFaster: それ以外（同じ・遅い・本数が減った）
 */
export function resolveFeetBranch(ctx: ScenarioContext): FeetBranch {
  if (ctx.inspectedCount === 0 || ctx.lastMarkSec === null) return 'none';
  const prev = ctx.previousRun;
  if (!prev || prev.inspected === 0 || prev.lastMarkSec === null) return 'first';

  const clearedAll = ctx.total > 0 && ctx.inspectedCount >= ctx.total;
  const prevBest = prev.bestLastMarkSec ?? null;
  if (clearedAll && prevBest !== null && ctx.lastMarkSec <= prevBest - FEET_DIFF_THRESHOLD_SEC) {
    return 'best';
  }

  const sameOrMoreMarks = ctx.inspectedCount >= prev.inspected;
  if (sameOrMoreMarks && ctx.lastMarkSec <= prev.lastMarkSec - FEET_DIFF_THRESHOLD_SEC) {
    return 'faster';
  }
  return 'notFaster';
}

export function resolveClosingBranch(ctx: ScenarioContext): ClosingBranch {
  if (ctx.sleepingCats.length > 0) return 'sleeping';
  if (ctx.otherCats.length > 0) return 'nextCat';
  return 'none';
}

export function buildScenarioVars(ctx: ScenarioContext): Record<string, string | number> {
  const sleeping = ctx.sleepingCats[0] ?? null;
  const nextCat = ctx.otherCats[0] ?? null;
  return {
    alias: ctx.alias,
    catName: ctx.catName,
    total: ctx.total,
    known: ctx.knownCount,
    missing: ctx.missing,
    gained: ctx.gained,
    inspected: ctx.inspectedCount,
    sec: ctx.lastMarkSec ?? 0,
    secPerMark: ctx.secPerMark ?? 0,
    prevSec: ctx.previousRun?.lastMarkSec ?? 0,
    prevInspected: ctx.previousRun?.inspected ?? 0,
    bestSec: ctx.previousRun?.bestLastMarkSec ?? 0,
    diff: Math.abs(ctx.inspectedCount - (ctx.previousRun?.inspected ?? 0)),
    direction: ctx.nearestMissed?.direction ?? '',
    distance: ctx.nearestMissed?.distanceM ?? 0,
    hop: ctx.nextHop?.label ?? '',
    sleepingName: sleeping?.name ?? '',
    sleepingAlias: sleeping?.alias ?? '',
    nextCatName: nextCat?.name ?? ''
  };
}

export function selectLines(ctx: ScenarioContext, m: ScenarioMessages): ScenarioLines {
  const vars = buildScenarioVars(ctx);

  // 結果1: 見つけた（目）
  const mapBranch = resolveMapBranch(ctx);
  const foundBranch = resolveFoundBranch(ctx);
  const mapTemplate = {
    empty: m.mapEmpty,
    found: m.mapFound,
    complete: m.mapComplete
  }[foundBranch];
  const mapLine = fill(mapTemplate, vars);
  // 「見つけた {inspected}こ」と同じ数を繰り返さないよう、前からの記録があるときだけ
  const mapGainedLine = ctx.gained > 0 && ctx.knownBeforeCount > 0 ? fill(m.mapGained, vars) : null;

  // 結果1: のこってる（鼻）。全部見つけたら区画ごと出さない
  const noseLines: string[] = [];
  if (ctx.nearestMissed) {
    noseLines.push(fill(m.noseNearest, vars));
    if (ctx.nextHop) {
      noseLines.push(fill(m.noseHop, vars));
    }
  }

  // 結果2: タイム（足）
  const feetBranch = resolveFeetBranch(ctx);
  const feetTemplate = {
    none: m.feetNone,
    first: m.feetFirst,
    best: m.feetBest,
    faster: m.feetFaster,
    notFaster: m.feetNotFaster
  }[feetBranch];
  const feetLine = fill(feetTemplate, vars);
  const hasPrev = ctx.previousRun !== null && ctx.previousRun.inspected > 0;
  const feetPrevLine = hasPrev ? fill(m.feetPrev, vars) : null;

  // 再挑戦: 猫案内
  const closingBranch = resolveClosingBranch(ctx);
  const closingLine = {
    sleeping: () => fill(m.nextCatLocked, vars),
    nextCat: () => fill(m.nextCatUnlocked, vars),
    none: () => null
  }[closingBranch]();

  return {
    mapBranch,
    foundBranch,
    mapLine,
    mapGainedLine,
    noseLines,
    feetBranch,
    feetLine,
    feetPrevLine,
    closingBranch,
    closingLine
  };
}
