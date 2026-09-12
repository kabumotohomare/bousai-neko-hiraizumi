import { create } from 'zustand';
import { bootAppData, normalizeBootError } from '../bootstrap/bootApp';
import { Building } from '../../domain/building/model';
import { Cat } from '../../domain/cat/model';
import { defaultGameConfig, GameConfig } from '../../domain/common/config';
import { AppError } from '../../domain/common/error';
import { defaultMessages, Messages } from '../../domain/common/messages';
import { isHydrantInTerritory } from '../../domain/hydrant/inTerritory';
import { Hydrant } from '../../domain/hydrant/model';
import { hydrantWorldPosition } from '../../domain/hydrant/worldPosition';
import { Road } from '../../domain/road/model';
import { defaultLocalProgress, LocalProgress, PatrolSession } from '../../domain/session/model';
import { estimatePatrolPathMeters, requiredDashSpeedMps } from '../../domain/session/patrolPath';
import { stopThemeSong } from '../../services/audio/themeSong';
import { saveLocalProgress } from '../../services/storage/localProgress';
import { latLngToWorldPosition } from '../../services/transform/latLngToWorldPosition';
import { pauseBgm, pausePatrolBgm, playPatrolBgm, resumeBgm, stopPatrolBgm } from '../../services/audio/bgm';

export interface AppState {
  bootStatus: 'idle' | 'loading' | 'ready' | 'error';
  currentScreen: 'loading' | 'opening' | 'map' | 'patrol' | 'result' | 'ending' | 'error';
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
  finishOpening: () => void;
  selectCat: (catId: string) => void;
  startPatrol: () => void;
  tickPatrol: () => void;
  inspectHydrant: (hydrantId: string) => void;
  pausePatrol: () => void;
  resumePatrol: () => void;
  goToMap: () => void;
  goHome: () => void;
  finishEnding: () => void;
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

      // 前回選んだ猫が「からだを まっている」（locked）なら復元しない。
      const lastCat = cats.find((cat) => cat.id === localProgress.lastSelectedCatId);
      const selectedCatId = lastCat && lastCat.status === 'unlocked' ? lastCat.id : null;

      set({
        bootStatus: 'ready',
        currentScreen: 'opening',
        cats,
        hydrants,
        buildings,
        roads,
        gameConfig,
        messages,
        localProgress,
        selectedCatId,
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

  finishOpening: () => {
    if (get().currentScreen !== 'opening') {
      return;
    }
    set({ currentScreen: 'map' });
  },

  selectCat: (catId: string) => {
    const state = get();
    const cat = state.cats.find((item) => item.id === catId);
    // locked（からだを まっている人格）は選べない。UI 側でも案内するが、store 側でも守る。
    if (!cat || cat.status !== 'unlocked') {
      return;
    }

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

    // ユーザー操作(このアクションを呼んだボタンのクリック)と同じ呼び出しの中で
    // 同期的に再生を開始する。自動再生ポリシー対策のため。
    // main の劇中歌(themeSong)と本PRの見回りBGMが重複するため、見回りBGMに統一する。
    stopThemeSong();

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
    void playPatrolBgm();
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
      const inspected = state.currentSession.inspectedHydrantIds.length;
      const lastMarkSec =
        inspectedAtSec.length > 0 ? inspectedAtSec[inspectedAtSec.length - 1] : null;
      const total = countTerritoryHydrants(state, state.currentSession.catId);
      const previousBest = state.currentSession.previousRun?.bestLastMarkSec ?? null;
      // 全部点検した回だけ「いちばん はやい 足」の候補になる。
      const clearedNow = total > 0 && inspected >= total && lastMarkSec !== null;
      const bestLastMarkSec = clearedNow
        ? previousBest === null
          ? lastMarkSec
          : Math.min(previousBest, lastMarkSec)
        : previousBest;

      const completedProgress: LocalProgress = {
        ...state.localProgress,
        lastPlayedAt: finishedAt,
        lastRunByCat: {
          ...state.localProgress.lastRunByCat,
          [state.currentSession.catId]: {
            inspected,
            lastMarkSec,
            bestLastMarkSec,
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
      pausePatrolBgm();
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
    pausePatrolBgm();
  },

  resumePatrol: () => {
    const state = get();
    if (!state.currentSession || state.currentSession.finished || !state.currentSession.paused) {
      return;
    }

    // ユーザー操作(「つづきから」ボタンのクリック)と同じ呼び出しの中で
    // 同期的に再生を再開する。自動再生ポリシー対策のため。
    set({
      currentSession: {
        ...state.currentSession,
        paused: false
      }
    });
    void playPatrolBgm({ restart: false });
  },

  goToMap: () => {
    stopThemeSong();
    set({
      currentScreen: 'map',
      currentSession: null,
      error: null
    });
    stopPatrolBgm();
    resumeBgm();
  },

  /** リザルトの「今日もう帰るにゃ」→ エンディング映像＋BGM */
  goHome: () => {
    stopThemeSong();
    set({
      currentScreen: 'ending',
      currentSession: null,
      error: null
    });
    stopPatrolBgm();
    pauseBgm();
  },

  finishEnding: () => {
    if (get().currentScreen !== 'ending') {
      return;
    }
    set({
      currentScreen: 'map',
      currentSession: null,
      error: null
    });
    resumeBgm();
  },

  failScene: (cause?: unknown) => {
    stopThemeSong();
    set({
      currentScreen: 'error',
      error: {
        code: 'E3001',
        message: '3D空間の初期化に失敗しました。',
        cause
      }
    });
    stopPatrolBgm();
  },

  replayPatrol: () => {
    const { startPatrol } = get();
    startPatrol();
  }
}));

function territoryHydrantWorlds(state: AppState, cat: Cat): { x: number; z: number }[] {
  const origin = state.gameConfig.defaultMapCenter;
  const catWorld = latLngToWorldPosition(cat.center.lat, cat.center.lng, origin);
  return state.hydrants
    .filter((hydrant) => hydrant.status === 'active')
    .map((hydrant) => hydrantWorldPosition(hydrant, origin))
    .filter((hydrantWorld) => isHydrantInTerritory(hydrantWorld, catWorld, cat.radius));
}

function countTerritoryHydrants(state: AppState, catId: string): number {
  const cat = state.cats.find((item) => item.id === catId);
  if (!cat) {
    return 0;
  }
  try {
    return territoryHydrantWorlds(state, cat).length;
  } catch {
    return 0;
  }
}

function resolveDashSpeedMps(state: AppState): number {
  const fallback = state.gameConfig.dashSpeedMinMps;
  const cat = state.cats.find((item) => item.id === state.selectedCatId);
  if (!cat) {
    return fallback;
  }

  try {
    const origin = state.gameConfig.defaultMapCenter;
    const spawnWorld = latLngToWorldPosition(cat.spawn.lat, cat.spawn.lng, origin);
    const points = territoryHydrantWorlds(state, cat);
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
