import { create } from 'zustand';
import { bootAppData, normalizeBootError } from '../bootstrap/bootApp';
import { Cat } from '../../domain/cat/model';
import { defaultGameConfig, GameConfig } from '../../domain/common/config';
import { AppError } from '../../domain/common/error';
import { defaultMessages, Messages } from '../../domain/common/messages';
import { Hydrant } from '../../domain/hydrant/model';
import { defaultLocalProgress, LocalProgress, PatrolSession } from '../../domain/session/model';
import { saveLocalProgress } from '../../services/storage/localProgress';

export interface AppState {
  bootStatus: 'idle' | 'loading' | 'ready' | 'error';
  currentScreen: 'loading' | 'map' | 'patrol' | 'result' | 'error';
  selectedCatId: string | null;
  cats: Cat[];
  hydrants: Hydrant[];
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
  goToMap: () => void;
  replayPatrol: () => void;
}

const initialState: AppState = {
  bootStatus: 'idle',
  currentScreen: 'loading',
  selectedCatId: null,
  cats: [],
  hydrants: [],
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
      const { cats, hydrants, gameConfig, messages, localProgress } = await bootAppData();

      set({
        bootStatus: 'ready',
        currentScreen: 'map',
        cats,
        hydrants,
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
        finished: false
      }
    });
  },

  tickPatrol: () => {
    const state = get();
    if (!state.currentSession || state.currentScreen !== 'patrol') {
      return;
    }

    const nextRemaining = state.currentSession.remainingSec - 1;

    if (nextRemaining <= 0) {
      const completedProgress: LocalProgress = {
        ...state.localProgress,
        lastPlayedAt: new Date().toISOString()
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
    if (!state.currentSession || state.currentSession.finished) {
      return;
    }

    if (state.currentSession.inspectedHydrantIds.includes(hydrantId)) {
      return;
    }

    const inspectedHydrantIds = [...state.currentSession.inspectedHydrantIds, hydrantId];
    const globalInspected = Array.from(new Set([...state.localProgress.inspectedHydrantIds, hydrantId]));

    const nextProgress: LocalProgress = {
      ...state.localProgress,
      inspectedHydrantIds: globalInspected,
      lastPlayedAt: new Date().toISOString()
    };

    saveLocalProgress(nextProgress);

    set({
      localProgress: nextProgress,
      currentSession: {
        ...state.currentSession,
        inspectedHydrantIds,
        score: state.currentSession.score + 100
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

  replayPatrol: () => {
    const { startPatrol } = get();
    startPatrol();
  }
}));
