import { z } from 'zod';

export const BuildingSchema = z.object({
  id: z.string(),
  kind: z.enum(['landmark', 'generic']),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  // 北を 0°、時計回り。GLB の正面は北向きで書き出す。
  headingDeg: z.number().default(0),
  // town: 町全体メッシュ。自動スケールせず、縄張り外でも読み込む。
  placement: z.enum(['building', 'town']).default('building'),
  modelUrl: z.string().optional(),
  width: z.number().optional(),
  depth: z.number().optional(),
  height: z.number().optional()
});

export const BuildingsSchema = z.array(BuildingSchema);

export type Building = z.infer<typeof BuildingSchema>;
