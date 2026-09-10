import { z } from 'zod';

/**
 * リザルト画面のシナリオ文言。
 * `{alias}` `{missing}` `{known}` `{total}` `{direction}` `{distance}` `{hop}`
 * `{sec}` `{prevSec}` `{diff}` `{sleepingName}` `{sleepingAlias}` を実行時に置換する。
 * 世界観に依存する語はここに閉じ、ロジック側（domain/scenario）には持ち込まない。
 */
export const ScenarioMessagesSchema = z.object({
  resultTitle: z.string(),
  resultIntro: z.string(),
  slideLabels: z.tuple([z.string(), z.string(), z.string()]),
  nextSlide: z.string(),
  progressLabel: z.string(),

  mapEmpty: z.string(),
  mapLow: z.string(),
  mapHigh: z.string(),
  mapComplete: z.string(),
  mapGained: z.string(),

  noseNearest: z.string(),
  noseHop: z.string(),
  noseComplete: z.string(),
  noseSleeping: z.string(),

  feetNone: z.string(),
  feetFirst: z.string(),
  feetFaster: z.string(),
  feetSame: z.string(),
  feetSlower: z.string(),
  feetMoreMarks: z.string(),
  feetFewerMarks: z.string(),
  feetPrev: z.string(),

  closingSleeping: z.string(),
  closingOpen: z.string()
});

export type ScenarioMessages = z.infer<typeof ScenarioMessagesSchema>;

export const defaultScenarioMessages: ScenarioMessages = {
  resultTitle: 'ねこの 記録',
  resultIntro: 'ねこの時間、おわり。きろくを ひらく。',
  slideLabels: ['記録', '鼻', '足'],
  nextSlide: 'つぎへ',
  progressLabel: 'このなわばりで 見つけた 赤いしるし',

  mapEmpty: '{alias}の 記録は、まだ しろい。',
  mapLow: '{alias}で、まだ しらない 赤が {missing}つ。',
  mapHigh: '記録の はんぶんより むこうが、見えた。まだ {missing}つ。',
  mapComplete: '{alias}の 記録は、できた。',
  mapGained: 'きょう、記録に ふえた しるし: {gained}つ。',

  noseNearest: 'いちばん近い「まだ」は、{direction} {distance}m。',
  noseHop: '{hop}の あとに まわると、ちかい。',
  noseComplete: 'この なわばりに、しらない においは ない。',
  noseSleeping: 'つぎの においは、{sleepingAlias}から。まだ、だれの 記録にも ない。',

  feetNone: 'この からだでは、まだ 走れていない。',
  feetFirst: 'この からだに、はじめて はいった。さいごの しるしまで {sec}秒。',
  feetFaster: 'からだが、みちを おぼえた。さいごの しるしまで {sec}秒。',
  feetSame: 'まえと おなじ 足。さいごの しるしまで {sec}秒。',
  feetSlower: 'きょうは、まわりみちを した。さいごの しるしまで {sec}秒。',
  feetMoreMarks: 'まえより {diff}つ おおく、しるしを 見た。',
  feetFewerMarks: 'まえより {diff}つ すくない。しるしは、にげない。',
  feetPrev: 'まえ: {prevInspected}つ、{prevSec}秒。',

  closingSleeping:
    '{sleepingName}は、まだ からだを まっている。まちの ひとが ねこを 見つけたら、はいれる。',
  closingOpen: 'つぎの ねこの時間まで、記録は のこる。'
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
  inspectSuccess: 'てんけんできた！',
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
