import { create } from 'zustand';
import { bootAppData, normalizeBootError } from '../bootstrap/bootApp';
import { Building } from '../../domain/building/model';
import { Cat } from '../../domain/cat/model';
import { defaultGameConfig, GameConfig } from '../../domain/common/config';
import { AppError } from '../../domain/common/error';
import { defaultMessages, Messages } from '../../domain/common/messages';
import { isHydrantInTerritory } from '../../domain/hydrant/inTerritory';
import { Hydrant } from '../../domain/hydrant/model';
import { Road } from '../../domain/road/model';
import { defaultLocalProgress, LocalProgress, PatrolSession } from '../../domain/session/model';
import { estimatePatrolPathMeters, requiredDashSpeedMps } from '../../domain/session/patrolPath';
import { saveLocalProgress } from '../../services/storage/localProgress';
import { latLngToWorldPosition } from '../../services/transform/latLngToWorldPosition';

export interface AppState {
  bootStatus: 'idle' | 'loading' | 'ready' | 'error';
  currentScreen: 'loading' | 'map' | 'patrol' | 'result' | 'error';
  selectedCatId: string | null;
  cats: Cat[];
  hydrants: Hydrant[];
  buildings: Building[];
  roads: Road[];
  gameConfig: GameConfig;
  messages: Messages;
  localProgress: LocalProgress;
  currentSession: PatrolSession | null;
  error: AppError | null;
}

interface AppActions {
  bootApp: () => Promise<void>;
  selectCat: (catId: string) => void;
  startPatrol: () => void;
  tickPatrol: () => void;
  inspectHydrant: (hydrantId: string) => void;
  pausePatrol: () => void;
  resumePatrol: () => void;
  goToMap: () => void;
  replayPatrol: () => void;
  failScene: (cause?: unknown) => void;
}

const initialState: AppState = {
  bootStatus: 'idle',
  currentScreen: 'loading',
  selectedCatId: null,
  cats: [],
  hydrants: [],
  buildings: [],
  roads: [],
  gameConfig: defaultGameConfig,
  messages: defaultMessages,
  localProgress: defaultLocalProgress,
  currentSession: null,
  error: null
};

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  ...initialState,

  bootApp: async () => {
    set({ bootStatus: 'loading', currentScreen: 'loading', error: null });

    try {
      const { cats, hydrants, buildings, roads, gameConfig, messages, localProgress } =
        await bootAppData();

      set({
        bootStatus: 'ready',
        currentScreen: 'map',
        cats,
        hydrants,
        buildings,
        roads,
        gameConfig,
        messages,
        localProgress,
        selectedCatId: localProgress.lastSelectedCatId,
        error: null
      });
    } catch (error) {
      set({
        bootStatus: 'error',
        currentScreen: 'error',
        error: normalizeBootError(error)
      });
    }
  },

  selectCat: (catId: string) => {
    const state = get();
    const nextProgress: LocalProgress = {
      ...state.localProgress,
      lastSelectedCatId: catId
    };

    saveLocalProgress(nextProgress);

    set({
      selectedCatId: catId,
      localProgress: nextProgress
    });
  },

  startPatrol: () => {
    const state = get();
    if (!state.selectedCatId) {
      set({
        currentScreen: 'error',
        error: { code: 'E2001', message: '見回りに使う猫が選択されていません。' }
      });
      return;
    }

    set({
      currentScreen: 'patrol',
      currentSession: {
        catId: state.selectedCatId,
        startedAt: new Date().toISOString(),
        remainingSec: state.gameConfig.gameDurationSec,
        score: 0,
        inspectedHydrantIds: [],
        finished: false,
        paused: false,
        dashSpeedMps: resolveDashSpeedMps(state),
        inspectedAtSec: [],
        knownHydrantIdsAtStart: [...state.localProgress.inspectedHydrantIds],
        previousRun: state.localProgress.lastRunByCat[state.selectedCatId] ?? null
      }
    });
  },

  tickPatrol: () => {
    const state = get();
    if (!state.currentSession || state.currentScreen !== 'patrol' || state.currentSession.paused) {
      return;
    }

    const nextRemaining = state.currentSession.remainingSec - 1;

    if (nextRemaining <= 0) {
      const finishedAt = new Date().toISOString();
      const inspectedAtSec = state.currentSession.inspectedAtSec ?? [];
      const completedProgress: LocalProgress = {
        ...state.localProgress,
        lastPlayedAt: finishedAt,
        lastRunByCat: {
          ...state.localProgress.lastRunByCat,
          [state.currentSession.catId]: {
            inspected: state.currentSession.inspectedHydrantIds.length,
            lastMarkSec:
              inspectedAtSec.length > 0 ? inspectedAtSec[inspectedAtSec.length - 1] : null,
            at: finishedAt
          }
        }
      };
      saveLocalProgress(completedProgress);

      set({
        currentScreen: 'result',
        localProgress: completedProgress,
        currentSession: {
          ...state.currentSession,
          remainingSec: 0,
          finished: true
        }
      });
      return;
    }

    set({
      currentSession: {
        ...state.currentSession,
        remainingSec: nextRemaining
      }
    });
  },

  inspectHydrant: (hydrantId: string) => {
    const state = get();
    if (!state.currentSession || state.currentSession.finished || state.currentSession.paused) {
      return;
    }

    if (state.currentSession.inspectedHydrantIds.includes(hydrantId)) {
      return;
    }

    const inspectedHydrantIds = [...state.currentSession.inspectedHydrantIds, hydrantId];
    const globalInspected = Array.from(
      new Set([...state.localProgress.inspectedHydrantIds, hydrantId])
    );

    const nextProgress: LocalProgress = {
      ...state.localProgress,
      inspectedHydrantIds: globalInspected,
      lastPlayedAt: new Date().toISOString()
    };

    saveLocalProgress(nextProgress);

    const elapsedSec = state.gameConfig.gameDurationSec - state.currentSession.remainingSec;

    set({
      localProgress: nextProgress,
      currentSession: {
        ...state.currentSession,
        inspectedHydrantIds,
        inspectedAtSec: [...(state.currentSession.inspectedAtSec ?? []), elapsedSec],
        score: state.currentSession.score + 100
      }
    });
  },

  pausePatrol: () => {
    const state = get();
    if (!state.currentSession || state.currentSession.finished || state.currentSession.paused) {
      return;
    }

    set({
      currentSession: {
        ...state.currentSession,
        paused: true
      }
    });
  },

  resumePatrol: () => {
    const state = get();
    if (!state.currentSession || state.currentSession.finished || !state.currentSession.paused) {
      return;
    }

    set({
      currentSession: {
        ...state.currentSession,
        paused: false
      }
    });
  },

  goToMap: () => {
    set({
      currentScreen: 'map',
      currentSession: null,
      error: null
    });
  },

  failScene: (cause?: unknown) => {
    set({
      currentScreen: 'error',
      error: {
        code: 'E3001',
        message: '3D空間の初期化に失敗しました。',
        cause
      }
    });
  },

  replayPatrol: () => {
    const { startPatrol } = get();
    startPatrol();
  }
}));

function resolveDashSpeedMps(state: AppState): number {
  const fallback = state.gameConfig.dashSpeedMinMps;
  const cat = state.cats.find((item) => item.id === state.selectedCatId);
  if (!cat) {
    return fallback;
  }

  try {
    const origin = state.gameConfig.defaultMapCenter;
    const catWorld = latLngToWorldPosition(cat.center.lat, cat.center.lng, origin);
    const spawnWorld = latLngToWorldPosition(cat.spawn.lat, cat.spawn.lng, origin);
    const points = state.hydrants
      .filter((hydrant) => hydrant.status === 'active')
      .map((hydrant) => latLngToWorldPosition(hydrant.lat, hydrant.lng, origin))
      .filter((hydrantWorld) => isHydrantInTerritory(hydrantWorld, catWorld, cat.radius));
    const pathMeters = estimatePatrolPathMeters(spawnWorld, points);
    return requiredDashSpeedMps({
      pathMeters,
      targetClearSec: state.gameConfig.targetClearSec,
      pathDetourFactor: state.gameConfig.pathDetourFactor,
      minMps: state.gameConfig.dashSpeedMinMps,
      maxMps: state.gameConfig.dashSpeedMaxMps
    });
  } catch {
    return fallback;
  }
}
