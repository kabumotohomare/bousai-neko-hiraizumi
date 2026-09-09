import { z } from 'zod';

export interface PatrolSession {
  catId: string;
  startedAt: string;
  remainingSec: number;
  score: number;
  inspectedHydrantIds: string[];
  lastHintAt?: string;
  finished: boolean;
  paused: boolean;
  dashSpeedMps: number;
}

export const LocalProgressSchema = z.object({
  unlockedCatIds: z.array(z.string()),
  inspectedHydrantIds: z.array(z.string()),
  playedTutorial: z.boolean(),
  lastSelectedCatId: z.string().nullable(),
  lastPlayedAt: z.string().nullable()
});

export type LocalProgress = z.infer<typeof LocalProgressSchema>;

export const defaultLocalProgress: LocalProgress = {
  unlockedCatIds: ['cat_001'],
  inspectedHydrantIds: [],
  playedTutorial: false,
  lastSelectedCatId: null,
  lastPlayedAt: null
};
