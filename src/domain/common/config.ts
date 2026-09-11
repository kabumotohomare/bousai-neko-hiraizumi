import { z } from 'zod';

const LatLngSchema = z.object({ lat: z.number(), lng: z.number() });

export const MapBoundsSchema = z.object({
  southWest: LatLngSchema,
  northEast: LatLngSchema
});

export const GameConfigSchema = z.object({
  version: z.number(),
  gameDurationSec: z.number().default(90),
  playerMoveSpeedMps: z.number().default(2.2),
  targetClearSec: z.number().default(70),
  pathDetourFactor: z.number().default(1.35),
  dashSpeedMinMps: z.number().default(6),
  dashSpeedMaxMps: z.number().default(10),
  inspectRadiusMeters: z.number().default(2.0),
  territoryBoundaryMarginMeters: z.number().default(1.0),
  hintDelaySec: z.number().default(20),
  defaultMapCenter: LatLngSchema,
  defaultMapZoom: z.number().default(16),
  mapBounds: MapBoundsSchema,
  reportFormUrl: z.string().url(),
  enableHint: z.boolean().default(true)
});

export type GameConfig = z.infer<typeof GameConfigSchema>;

export const defaultGameConfig: GameConfig = {
  version: 1,
  gameDurationSec: 90,
  playerMoveSpeedMps: 2.2,
  targetClearSec: 70,
  pathDetourFactor: 1.35,
  dashSpeedMinMps: 6,
  dashSpeedMaxMps: 10,
  inspectRadiusMeters: 2.0,
  territoryBoundaryMarginMeters: 1.0,
  hintDelaySec: 20,
  defaultMapCenter: { lat: 38.9899314, lng: 141.1152492 },
  defaultMapZoom: 16,
  mapBounds: {
    southWest: { lat: 38.983, lng: 141.108 },
    northEast: { lat: 38.996, lng: 141.125 }
  },
  reportFormUrl: 'https://example.com/report',
  enableHint: true
};
