import { z } from 'zod';

export const GameConfigSchema = z.object({
  version: z.number(),
  gameDurationSec: z.number().default(90),
  playerMoveSpeedMps: z.number().default(2.2),
  inspectRadiusMeters: z.number().default(2.0),
  territoryBoundaryMarginMeters: z.number().default(1.0),
  hintDelaySec: z.number().default(20),
  defaultMapCenter: z.object({ lat: z.number(), lng: z.number() }),
  defaultMapZoom: z.number().default(16),
  reportFormUrl: z.string().url(),
  enableHint: z.boolean().default(true)
});

export type GameConfig = z.infer<typeof GameConfigSchema>;

export const defaultGameConfig: GameConfig = {
  version: 1,
  gameDurationSec: 90,
  playerMoveSpeedMps: 2.2,
  inspectRadiusMeters: 2.0,
  territoryBoundaryMarginMeters: 1.0,
  hintDelaySec: 20,
  defaultMapCenter: { lat: 38.9869, lng: 141.117 },
  defaultMapZoom: 16,
  reportFormUrl: 'https://example.com/report',
  enableHint: true
};
