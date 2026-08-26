import { z } from 'zod';

export const HydrantSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  type: z.enum(['ground', 'above']),
  status: z.enum(['active', 'inactive'])
});

export const HydrantsSchema = z.array(HydrantSchema);

export type Hydrant = z.infer<typeof HydrantSchema>;
