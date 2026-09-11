import { z } from 'zod';

/**
 * リザルト画面（S04）と猫えらび（S02）のシナリオ文言。
 * `{catName}` `{alias}` `{missing}` `{known}` `{total}` `{gained}` `{direction}` `{distance}`
 * `{hop}` `{sec}` `{prevSec}` `{prevInspected}` `{diff}` `{sleepingName}` `{sleepingAlias}`
 * `{durationSec}` を実行時に置換する。
 * 世界観に依存する語（からだ・はいる・記録・ねむる）はここに閉じ、
 * ロジック側（domain/scenario）には持ち込まない。
 */
export const ScenarioMessagesSchema = z.object({
  resultTitle: z.string(),
  nextSlide: z.string(),
  /** 5スライドの見出し: 切断 / 目(記録) / 鼻 / 足 / ねむり */
  slideLabels: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
  /** 各感覚の意味を一行で */
  senseHints: z.object({ map: z.string(), nose: z.string(), feet: z.string() }),

  // 切断（導入）
  disconnectIntro: z.string(),
  disconnectSub: z.string(),

  // 目（記録）
  progressLabel: z.string(),
  todayTag: z.string(),
  mapEmpty: z.string(),
  mapLow: z.string(),
  mapHigh: z.string(),
  mapComplete: z.string(),
  mapGained: z.string(),

  // 鼻
  noseNearest: z.string(),
  noseHop: z.string(),
  noseComplete: z.string(),
  noseSleeping: z.string(),

  // 足
  feetNone: z.string(),
  feetFirst: z.string(),
  feetFaster: z.string(),
  feetSame: z.string(),
  feetSlower: z.string(),
  feetMoreMarks: z.string(),
  feetFewerMarks: z.string(),
  feetBest: z.string(),
  feetPrev: z.string(),
  feetNowLabel: z.string(),
  feetPrevLabel: z.string(),

  // ねむり（締め）
  sleepIntro: z.string(),
  sleepSub: z.string(),
  sleepingBadge: z.string(),
  closingSleeping: z.string(),
  closingAllAwake: z.string(),
  closingOpen: z.string(),

  // 猫えらび（接続）
  selectIntro: z.string(),
  selectSleeping: z.string(),
  selectLockedTap: z.string(),
  selectConnectable: z.string()
});

export type ScenarioMessages = z.infer<typeof ScenarioMessagesSchema>;

export const defaultScenarioMessages: ScenarioMessages = {
  resultTitle: 'ねこの 記録',
  nextSlide: 'つぎへ',
  slideLabels: ['切断', '目', '鼻', '足', 'ねむり'],
  senseHints: {
    map: 'かりた 目。この なわばりで 見たもの、まだ 見ていないもの。',
    nose: 'かりた 鼻。まだ 見ていない 赤の、いちばん近い 方角。',
    feet: 'かりた 足。この からだで、どれだけ はやく まわれたか。'
  },

  disconnectIntro: 'ねこの時間、おわり。{catName}は、からだから でる。',
  disconnectSub: 'でる まえに、かりた 3つの かんかくで、きょうを のこす。',

  progressLabel: 'このなわばりで 見つけた 赤いしるし',
  todayTag: 'きょう',
  mapEmpty: '{alias}の 記録は、まだ しろい。',
  mapLow: '{alias}で、まだ しらない 赤が {missing}つ。',
  mapHigh: '記録の はんぶんより むこうが、見えた。まだ {missing}つ。',
  mapComplete: '{alias}の 記録は、できた。',
  mapGained: 'きょう、記録に ふえた しるし: {gained}つ。',

  noseNearest: 'いちばん近い「まだ」は、{direction} {distance}m。',
  noseHop: '{hop}の あとに まわると、ちかい。',
  noseComplete: 'この なわばりに、しらない においは ない。',
  noseSleeping: 'においは、{sleepingAlias}から。まだ、だれの 記録にも ない。',

  feetNone: 'この からだでは、まだ 走れていない。',
  feetFirst: 'この からだに、はじめて はいった。さいごの しるしまで {sec}秒。',
  feetFaster: 'からだが、みちを おぼえた。まえより はやい。{sec}秒。',
  feetSame: 'まえと おなじ 足。{sec}秒。',
  feetSlower: 'きょうは、まわりみちを した。{sec}秒。',
  feetMoreMarks: 'まえより {diff}つ おおく、しるしを 見た。{sec}秒。',
  feetFewerMarks: 'まえより {diff}つ すくない。しるしは、にげない。',
  feetBest: 'この からだの、いちばん はやい 足。{sec}秒。',
  feetPrev: 'まえ: {prevInspected}つ、{prevSec}秒。',
  feetNowLabel: 'きょう',
  feetPrevLabel: 'まえ',

  sleepIntro: 'ねこは ねむる。なにも おぼえていない。',
  sleepSub: '記録だけが、まちに のこる。',
  sleepingBadge: 'ねむりちゅう',
  closingSleeping:
    '{sleepingName}は、からだを まっている。まちの ひとが ねこを みつけたら、はいれる。',
  closingAllAwake: 'べつの なわばりの 記録も、まだ しろい。',
  closingOpen: 'つぎの ねこの時間まで、記録は のこる。',

  selectIntro: 'ねこの時間は、{durationSec}びょう。ひとつ えらんで、からだに はいる。',
  selectSleeping:
    '{sleepingName}は、まだ からだを まっている。まちの ひとが ねこを みつけたら、はいれる。',
  selectLockedTap:
    '{catName}は、からだを まっている。ねこを みつけたら、ほうこくで おしえてください。',
  selectConnectable: 'はいれる'
};

export const MessagesSchema = z.object({
  boundary: z.string(),
  timeUp: z.string(),
  inspectSuccess: z.string(),
  resultLow: z.string(),
  resultMid: z.string(),
  resultHigh: z.string(),
  obstacleHit: z.array(z.string()).min(1),
  // 既存の messages.json に無くても parse が通るよう default を持つ。
  scenario: ScenarioMessagesSchema.default(defaultScenarioMessages)
});

export type Messages = z.infer<typeof MessagesSchema>;

export const defaultMessages: Messages = {
  boundary: 'この先はなわばりじゃにゃい',
  timeUp: 'きょうはもうつかれた。みまわりはおわりだ。',
  inspectSuccess: '赤いしるし。きろくに、ひとつ。',
  resultLow: 'つぎはもっとたくさん見つけてみよう。',
  resultMid: 'この場所、ほんとうの町でもおぼえておこう。',
  resultHigh: 'みんなの見回りが、町のあんしんにつながる。',
  obstacleHit: [
    'あいたっ',
    'いたいニャー',
    'ぶつかったニャ',
    'とおれないニャ',
    'いたたたニャ',
    'ここはムリだニャ',
    'まえがふさがってるニャ',
    'ニャッ、いたっ'
  ],
  scenario: defaultScenarioMessages
};
