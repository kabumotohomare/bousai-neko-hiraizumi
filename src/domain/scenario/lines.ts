import { ScenarioMessages } from '../common/messages';
import { ScenarioContext } from './context';

/**
 * フラグ（ScenarioContext）から表示する文を選ぶ。
 * 文言そのものは messages.json の scenario ブロックが正本。ここは分岐だけ。
 */

export type MapBranch = 'empty' | 'low' | 'high' | 'complete';
export type FeetBranch =
  'none' | 'first' | 'faster' | 'same' | 'slower' | 'moreMarks' | 'fewerMarks';

export interface ScenarioLines {
  mapBranch: MapBranch;
  mapLine: string;
  /** この回で記録が増えたときだけ入る */
  mapGainedLine: string | null;
  noseLines: string[];
  feetBranch: FeetBranch;
  feetLine: string;
  /** 前回があるときだけ入る */
  feetPrevLine: string | null;
  closingLine: string;
}

/** 前回比で「速い／遅い」と判定する最小差（秒） */
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

export function resolveFeetBranch(ctx: ScenarioContext): FeetBranch {
  if (ctx.inspectedCount === 0 || ctx.lastMarkSec === null) return 'none';
  const prev = ctx.previousRun;
  if (!prev || prev.inspected === 0 || prev.lastMarkSec === null) return 'first';
  if (ctx.inspectedCount > prev.inspected) return 'moreMarks';
  if (ctx.inspectedCount < prev.inspected) return 'fewerMarks';
  const diff = ctx.lastMarkSec - prev.lastMarkSec;
  if (diff <= -FEET_DIFF_THRESHOLD_SEC) return 'faster';
  if (diff >= FEET_DIFF_THRESHOLD_SEC) return 'slower';
  return 'same';
}

export function selectLines(ctx: ScenarioContext, m: ScenarioMessages): ScenarioLines {
  const sleeping = ctx.sleepingCats[0] ?? null;

  const vars: Record<string, string | number> = {
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
    diff: Math.abs(ctx.inspectedCount - (ctx.previousRun?.inspected ?? 0)),
    direction: ctx.nearestMissed?.direction ?? '',
    distance: ctx.nearestMissed?.distanceM ?? 0,
    hop: ctx.nearestMissed?.label ?? '',
    sleepingName: sleeping?.name ?? '',
    sleepingAlias: sleeping?.alias ?? ''
  };

  // 記録（地図）
  const mapBranch = resolveMapBranch(ctx);
  const mapTemplate = {
    empty: m.mapEmpty,
    low: m.mapLow,
    high: m.mapHigh,
    complete: m.mapComplete
  }[mapBranch];
  const mapLine = fill(mapTemplate, vars);
  const mapGainedLine = ctx.gained > 0 ? fill(m.mapGained, vars) : null;

  // 鼻（次の一手）
  const noseLines: string[] = [];
  if (ctx.nearestMissed) {
    noseLines.push(fill(m.noseNearest, vars));
    if (ctx.nextHop) {
      noseLines.push(
        fill(m.noseHop, {
          ...vars,
          hop: ctx.nearestMissed.label,
          direction: ctx.nextHop.direction,
          distance: ctx.nextHop.distanceM
        })
      );
    }
  } else {
    noseLines.push(fill(m.noseComplete, vars));
    if (sleeping) {
      noseLines.push(fill(m.noseSleeping, vars));
    }
  }

  // 足（効率・前回比）
  const feetBranch = resolveFeetBranch(ctx);
  const feetTemplate = {
    none: m.feetNone,
    first: m.feetFirst,
    faster: m.feetFaster,
    same: m.feetSame,
    slower: m.feetSlower,
    moreMarks: m.feetMoreMarks,
    fewerMarks: m.feetFewerMarks
  }[feetBranch];
  const feetLine = fill(feetTemplate, vars);
  const hasPrev = ctx.previousRun !== null && ctx.previousRun.inspected > 0;
  const feetPrevLine = hasPrev ? fill(m.feetPrev, vars) : null;

  // 締め
  const closingLine = fill(sleeping ? m.closingSleeping : m.closingOpen, vars);

  return {
    mapBranch,
    mapLine,
    mapGainedLine,
    noseLines,
    feetBranch,
    feetLine,
    feetPrevLine,
    closingLine
  };
}
