import { Cat } from '../cat/model';
import { distanceXZ, Vec2 } from '../cat/territory';
import { Hydrant } from '../hydrant/model';
import { isHydrantInTerritory } from '../hydrant/inTerritory';
import { hydrantWorldPosition } from '../hydrant/worldPosition';
import { LastRun, PatrolSession } from '../session/model';
import { latLngToWorldPosition } from '../../services/transform/latLngToWorldPosition';

/**
 * ゲーム側とシナリオ側の合流点。
 * ゲーム結果（セッション・進捗・データ）を、文言選択に必要なフラグへ変換する。
 * ここには世界観の語を書かない。数字と真偽値だけを持つ。
 */

export const DIRECTION_LABELS = [
  'きた',
  'きたひがし',
  'ひがし',
  'みなみひがし',
  'みなみ',
  'みなみにし',
  'にし',
  'きたにし'
] as const;

export type DirectionLabel = (typeof DIRECTION_LABELS)[number];

export interface ScenarioMark {
  id: string;
  /** スタート地点からの方角（8方位） */
  direction: DirectionLabel;
  /** スタート地点からの距離（10m 丸め） */
  distanceM: number;
  /** 「{direction} {distance}m」 */
  label: string;
  /** この回に点検したか */
  inspectedThisRun: boolean;
  /** この回の開始時点で既に記録済みだったか */
  knownBefore: boolean;
  /** 現時点で記録済みか（knownBefore || inspectedThisRun） */
  known: boolean;
}

export interface SleepingCat {
  id: string;
  name: string;
  alias: string;
}

export interface ScenarioContext {
  catId: string;
  catName: string;
  alias: string;
  /** 縄張り内の対象しるし数 */
  total: number;
  marks: ScenarioMark[];
  /** この回に点検した数 */
  inspectedCount: number;
  /** 現時点で記録済みの数 */
  knownCount: number;
  /** 開始時点で記録済みだった数 */
  knownBeforeCount: number;
  /** この回で記録に増えた数 */
  gained: number;
  /** knownCount / total（total=0 のとき 1） */
  knownRate: number;
  /** total - knownCount */
  missing: number;
  /** 未記録のうちスタートから最も近いしるし */
  nearestMissed: ScenarioMark | null;
  /** 未記録のうち2番目に近いしるし（「〜の あとに まわると ちかい」用） */
  nextHop: ScenarioMark | null;
  /** 最後のしるしを点検した経過秒。0本なら null */
  lastMarkSec: number | null;
  /** 1しるしあたりの秒。0本なら null */
  secPerMark: number | null;
  /** この猫での前回。初回は null */
  previousRun: LastRun | null;
  /** まだ体（猫）が見つかっていない人格 = status: locked */
  sleepingCats: SleepingCat[];
  /** 体を持つ他の人格のうち、なわばりの記録がまだ埋まっていないものがあるか */
  otherTerritoriesUnfinished: boolean;
}

export interface BuildScenarioContextInput {
  cat: Cat;
  cats: Cat[];
  hydrants: Hydrant[];
  session: PatrolSession;
  origin: { lat: number; lng: number };
}

export function catAlias(cat: Pick<Cat, 'name' | 'aliasName'>): string {
  return cat.aliasName ?? `${cat.name}の なわばり`;
}

/** 北=0°・時計回り。ワールド座標は +x=東、-z=北。 */
export function headingDeg(from: Vec2, to: Vec2): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const deg = (Math.atan2(dx, -dz) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function directionLabel(from: Vec2, to: Vec2): DirectionLabel {
  const index = Math.round(headingDeg(from, to) / 45) % 8;
  return DIRECTION_LABELS[index];
}

export function roundDistance(meters: number): number {
  return Math.max(10, Math.round(meters / 10) * 10);
}

export function buildScenarioContext(input: BuildScenarioContextInput): ScenarioContext {
  const { cat, cats, hydrants, session, origin } = input;

  const catWorld = latLngToWorldPosition(cat.center.lat, cat.center.lng, origin);
  const spawnWorld = latLngToWorldPosition(cat.spawn.lat, cat.spawn.lng, origin);

  const inspectedThisRun = new Set(session.inspectedHydrantIds);
  const knownBefore = new Set(session.knownHydrantIdsAtStart ?? []);

  const marks: ScenarioMark[] = hydrants
    .filter((hydrant) => hydrant.status === 'active')
    .map((hydrant) => {
      const world = hydrantWorldPosition(hydrant, origin);
      return { hydrant, world, rawDistance: distanceXZ(spawnWorld, world) };
    })
    .filter(({ world }) => isHydrantInTerritory(world, catWorld, cat.radius))
    .sort((a, b) => a.rawDistance - b.rawDistance)
    .map(({ hydrant, world, rawDistance }) => {
      const direction = directionLabel(spawnWorld, world);
      const distanceM = roundDistance(rawDistance);
      const wasKnown = knownBefore.has(hydrant.id);
      const inspected = inspectedThisRun.has(hydrant.id);
      return {
        id: hydrant.id,
        direction,
        distanceM,
        label: `${direction} ${distanceM}m`,
        inspectedThisRun: inspected,
        knownBefore: wasKnown,
        known: wasKnown || inspected
      };
    });

  const total = marks.length;
  const inspectedCount = marks.filter((mark) => mark.inspectedThisRun).length;
  const knownCount = marks.filter((mark) => mark.known).length;
  const knownBeforeCount = marks.filter((mark) => mark.knownBefore).length;
  const missed = marks.filter((mark) => !mark.known);

  const inspectedAtSec = session.inspectedAtSec ?? [];
  const lastMarkSec = inspectedAtSec.length > 0 ? inspectedAtSec[inspectedAtSec.length - 1] : null;

  const sleepingCats: SleepingCat[] = cats
    .filter((item) => item.status === 'locked' && item.id !== cat.id)
    .map((item) => ({ id: item.id, name: item.name, alias: catAlias(item) }));

  const activeHydrantWorlds = hydrants
    .filter((hydrant) => hydrant.status === 'active')
    .map((hydrant) => ({
      id: hydrant.id,
      world: hydrantWorldPosition(hydrant, origin)
    }));
  const knownNow = new Set([...knownBefore, ...inspectedThisRun]);
  const otherTerritoriesUnfinished = cats
    .filter((item) => item.status === 'unlocked' && item.id !== cat.id)
    .some((item) => {
      const center = latLngToWorldPosition(item.center.lat, item.center.lng, origin);
      return activeHydrantWorlds
        .filter(({ world }) => isHydrantInTerritory(world, center, item.radius))
        .some(({ id }) => !knownNow.has(id));
    });

  return {
    catId: cat.id,
    catName: cat.name,
    alias: catAlias(cat),
    total,
    marks,
    inspectedCount,
    knownCount,
    knownBeforeCount,
    gained: knownCount - knownBeforeCount,
    knownRate: total === 0 ? 1 : knownCount / total,
    missing: total - knownCount,
    nearestMissed: missed[0] ?? null,
    nextHop: missed[1] ?? null,
    lastMarkSec,
    secPerMark:
      lastMarkSec !== null && inspectedCount > 0 ? Math.round(lastMarkSec / inspectedCount) : null,
    previousRun: session.previousRun ?? null,
    sleepingCats,
    otherTerritoriesUnfinished
  };
}
