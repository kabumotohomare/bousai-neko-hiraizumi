import { z } from 'zod';

export const CatSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayAreaName: z.string(),
  status: z.enum(['unlocked', 'locked']),
  center: z.object({ lat: z.number(), lng: z.number() }),
  radius: z.number(),
  spawn: z.object({ lat: z.number(), lng: z.number() }),
  info: z.string(),
  color: z.string(),
  lastUpdated: z.string(),
  version: z.number()
});

export const CatsSchema = z.array(CatSchema);

export type Cat = z.infer<typeof CatSchema>;
