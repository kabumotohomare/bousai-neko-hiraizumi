import { z } from 'zod';

export const CatSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayAreaName: z.string(),
  // リザルトのシナリオで使う、固有名詞を含まない縄張りの呼び名（例: 「ひがしの なわばり」）。
  // 未設定なら「{name}の なわばり」で補う。
  aliasName: z.string().optional(),
  status: z.enum(['unlocked', 'locked']),
  center: z.object({ lat: z.number(), lng: z.number() }),
  radius: z.number(),
  spawn: z.object({ lat: z.number(), lng: z.number() }),
  photoUrl: z.string().optional(),
  // 猫が増えても名づけ主を書き忘れないよう必須にする。
  namedBy: z.string(),
  // 毛色ではなく、地図上で縄張りを見分けるための表示色。
  territoryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'territoryColor は #rrggbb 形式で指定してください'),
  lastUpdated: z.string(),
  version: z.number()
});

export const CatsSchema = z.array(CatSchema);

export type Cat = z.infer<typeof CatSchema>;
