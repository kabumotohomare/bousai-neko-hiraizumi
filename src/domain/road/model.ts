import { z } from 'zod';

export const ROAD_HIGHWAY_TYPES = [
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'service'
] as const;

export const RoadHighwaySchema = z.enum(ROAD_HIGHWAY_TYPES);

export const RoadSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  name: z.string().optional(),
  highway: RoadHighwaySchema,
  width: z.number().positive(),
  path: z.array(z.object({ lat: z.number(), lng: z.number() })).min(2)
});

export const RoadsSchema = z.array(RoadSchema);

export type RoadHighway = z.infer<typeof RoadHighwaySchema>;
export type Road = z.infer<typeof RoadSchema>;

export const ROAD_WIDTH_BY_HIGHWAY: Record<RoadHighway, number> = {
  trunk: 7,
  primary: 6.5,
  secondary: 6,
  tertiary: 5.5,
  unclassified: 5,
  residential: 4.5,
  living_street: 4,
  service: 3.2
};
