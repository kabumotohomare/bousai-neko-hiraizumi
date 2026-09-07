import { AppError } from '../../domain/common/error';
import { loadGameData } from '../../services/api/loadGameData';
import { loadLocalProgress } from '../../services/storage/localProgress';

export async function bootAppData() {
  const gameData = await loadGameData();
  const localProgress = loadLocalProgress();

  return {
    ...gameData,
    localProgress
  };
}

export function normalizeBootError(error: unknown): AppError {
  if (error instanceof Error) {
    if (error.message.includes('cats.json')) {
      return { code: 'E1002', message: '猫データの読み込みに失敗しました。', cause: error };
    }
    if (error.message.includes('hydrants.json')) {
      return { code: 'E1003', message: '消火栓データの読み込みに失敗しました。', cause: error };
    }
    if (error.message.includes('buildings.json')) {
      return { code: 'E1004', message: '建物データの読み込みに失敗しました。', cause: error };
    }
    if (error.message.includes('game-config.json')) {
      return { code: 'E1001', message: 'ゲーム設定の読み込みに失敗しました。', cause: error };
    }
    return { code: 'E1004', message: 'データ形式に不整合があります。', cause: error };
  }

  return { code: 'E3001', message: '初期化に失敗しました。', cause: error };
}
