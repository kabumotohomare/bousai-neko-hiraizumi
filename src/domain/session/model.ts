import { z } from 'zod';

/**
 * 1回の見回りの要約。リザルト画面のシナリオ（「足」の前回比）で使う。
 * 猫ごとに直近1件だけ保持する。
 */
export const LastRunSchema = z.object({
  /** その回に点検したしるしの数 */
  inspected: z.number(),
  /** 最後のしるしを点検したときの経過秒。1本も点検していなければ null */
  lastMarkSec: z.number().nullable(),
  /** 全部点検した回のうち、最速の lastMarkSec。まだ全部点検していなければ null */
  bestLastMarkSec: z.number().nullable().default(null),
  /** 記録した日時（ISO 8601） */
  at: z.string()
});

export type LastRun = z.infer<typeof LastRunSchema>;

export interface PatrolSession {
  catId: string;
  startedAt: string;
  remainingSec: number;
  score: number;
  inspectedHydrantIds: string[];
  lastHintAt?: string;
  finished: boolean;
  paused: boolean;
  dashSpeedMps: number;
  /**
   * 各点検の経過秒（開始からの秒）。inspectedHydrantIds と同じ順番。
   * リザルトのシナリオ「足」で使う。省略時は空扱い。
   */
  inspectedAtSec?: number[];
  /** 見回り開始時点で既に記録済みだった消火栓ID。シナリオ「記録」の増分に使う。 */
  knownHydrantIdsAtStart?: string[];
  /** この猫での前回の見回り。初回は null。シナリオ「足」の前回比に使う。 */
  previousRun?: LastRun | null;
}

export const LocalProgressSchema = z.object({
  unlockedCatIds: z.array(z.string()),
  inspectedHydrantIds: z.array(z.string()),
  playedTutorial: z.boolean(),
  lastSelectedCatId: z.string().nullable(),
  lastPlayedAt: z.string().nullable(),
  // 既存の localStorage に無くても parse が通るよう default を持つ。
  lastRunByCat: z.record(z.string(), LastRunSchema).default({})
});

export type LocalProgress = z.infer<typeof LocalProgressSchema>;

export const defaultLocalProgress: LocalProgress = {
  unlockedCatIds: ['cat_001'],
  inspectedHydrantIds: [],
  playedTutorial: false,
  lastSelectedCatId: null,
  lastPlayedAt: null,
  lastRunByCat: {}
};
