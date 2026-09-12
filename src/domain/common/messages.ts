import { z } from 'zod';

/**
 * リザルト画面（S04）と猫えらび（S02）の文言。
 * `{catName}` `{alias}` `{missing}` `{known}` `{total}` `{gained}` `{inspected}` `{direction}`
 * `{distance}` `{hop}` `{sec}` `{prevSec}` `{prevInspected}` `{bestSec}` `{sleepingName}`
 * `{sleepingAlias}` `{nextCatName}` `{durationSec}` を実行時に置換する。
 *
 * 1周目に見える文は、「猫が消火栓を見て回った」だけの理解で読める語にする
 * （からだ・はいる・かりた・切断 などの設定語は置かない）。
 * 文言はここに閉じ、ロジック側（domain/scenario）には持ち込まない。
 */
export const ScenarioMessagesSchema = z.object({
  resultTitle: z.string(),
  nextSlide: z.string(),
  /** 4スライドの見出し: 終わり / 結果1(見つけた・のこってる) / 結果2(タイム) / 再挑戦 */
  slideLabels: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  /** 結果1・結果2 の区画見出し */
  sectionLabels: z.object({ found: z.string(), remaining: z.string(), feet: z.string() }),

  // 終わり（導入）
  disconnectIntro: z.string(),
  disconnectSub: z.string(),

  // 結果1: 見つけた（目）
  progressLabel: z.string(),
  todayTag: z.string(),
  mapEmpty: z.string(),
  mapFound: z.string(),
  mapComplete: z.string(),
  mapGained: z.string(),

  // 結果1: のこってる（鼻）
  noseNearest: z.string(),
  noseHop: z.string(),

  // 結果2: タイム（足）
  feetNone: z.string(),
  feetFirst: z.string(),
  feetBest: z.string(),
  feetFaster: z.string(),
  feetNotFaster: z.string(),
  feetPrev: z.string(),
  feetNowLabel: z.string(),
  feetPrevLabel: z.string(),
  feetBestLabel: z.string(),

  // 再挑戦
  retryTitle: z.string(),
  retryAgain: z.string(),
  retryLeave: z.string(),
  nextCatUnlocked: z.string(),
  nextCatLocked: z.string(),
  reportLink: z.string(),

  // 猫えらび
  sleepingBadge: z.string(),
  selectIntro: z.string(),
  selectSleeping: z.string(),
  selectLockedTap: z.string(),
  selectConnectable: z.string()
});

export type ScenarioMessages = z.infer<typeof ScenarioMessagesSchema>;

export const defaultScenarioMessages: ScenarioMessages = {
  resultTitle: 'みまわりの 結果',
  nextSlide: 'つぎへ',
  slideLabels: ['終わり', '結果1', '結果2', '再挑戦'],
  sectionLabels: { found: '見つけた 消火栓', remaining: 'のこってる 消火栓', feet: 'タイム' },

  disconnectIntro: '{catName}の みまわり、おわりニャ',
  disconnectSub: 'きょうの 結果を 見るニャ',

  progressLabel: 'この なわばりの 消火栓',
  todayTag: 'きょう',
  mapEmpty: 'きょうは 見つからなかったニャ',
  mapFound: '消火栓を {inspected}こ みつけられたニャ',
  mapComplete: 'ぜんぶ 見つけたニャ！',
  mapGained: 'あたらしく 見つけたのは {gained}こニャ',

  noseNearest: 'つぎは {direction} {distance}m に あるニャ',
  noseHop: 'その あとは {hop}ニャ',

  feetNone: 'つぎは 時間内に 見つけるニャ',
  feetFirst: 'はじめての タイムだニャ。{sec}秒',
  feetBest: '自己ベストだニャ！ {sec}秒',
  feetFaster: '前回よりも 早く できたニャ。{sec}秒',
  feetNotFaster: 'もっと 早く 走れたニャ。{sec}秒',
  feetPrev: 'まえ: {prevInspected}こ、{prevSec}秒',
  feetNowLabel: 'きょう',
  feetPrevLabel: 'まえ',
  feetBestLabel: 'いちばん 早い',

  retryTitle: 'もう一回 やるニャ？',
  retryAgain: 'もう一回 挑戦するにゃ。',
  retryLeave: '今日もう帰るにゃ',
  nextCatUnlocked: '次は {nextCatName}で プレーしてみようニャ',
  nextCatLocked: '{sleepingAlias}にも ねこが いるニャ。見かけたら おしえてニャ',
  reportLink: 'ねこの もくげきほうこく',

  sleepingBadge: 'まだ いない',
  selectIntro: '1回の みまわりは {durationSec}秒ニャ。ねこを えらぶニャ。',
  selectSleeping: '{sleepingName}は まだ 見つかっていないニャ。',
  selectLockedTap: '{catName}は まだ 見つかっていないニャ。見かけたら おしえてニャ',
  selectConnectable: 'えらべる'
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
  inspectSuccess: '赤いやつが 見つかったニャ',
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
