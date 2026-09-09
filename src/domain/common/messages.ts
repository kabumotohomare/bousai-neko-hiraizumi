import { z } from 'zod';

export const MessagesSchema = z.object({
  boundary: z.string(),
  timeUp: z.string(),
  inspectSuccess: z.string(),
  resultLow: z.string(),
  resultMid: z.string(),
  resultHigh: z.string(),
  obstacleHit: z.array(z.string()).min(1)
});

export type Messages = z.infer<typeof MessagesSchema>;

export const defaultMessages: Messages = {
  boundary: 'ここからそとは、ぼくのなわばりじゃない',
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
  ]
};
