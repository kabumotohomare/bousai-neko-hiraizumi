import { useMemo } from 'react';
import { useAppStore } from '../../app/store/useAppStore';

export function ResultScreen() {
  const currentSession = useAppStore((state) => state.currentSession);
  const cats = useAppStore((state) => state.cats);
  const messages = useAppStore((state) => state.messages);
  const goToMap = useAppStore((state) => state.goToMap);
  const replayPatrol = useAppStore((state) => state.replayPatrol);
  const gameConfig = useAppStore((state) => state.gameConfig);

  const selectedCat = useMemo(() => {
    if (!currentSession) {
      return null;
    }
    return cats.find((cat) => cat.id === currentSession.catId) ?? null;
  }, [cats, currentSession]);

  if (!currentSession) {
    return null;
  }

  const count = currentSession.inspectedHydrantIds.length;
  const resultMessage = count === 0 ? messages.resultLow : count <= 2 ? messages.resultMid : messages.resultHigh;

  return (
    <main className="app-shell stack">
      <section className="card stack">
        <h1 className="title">おさんぽ完了</h1>
        <p className="subtitle">{messages.timeUp}</p>
        <p className="subtitle">ねこ: {selectedCat?.name ?? '未設定'}</p>
        <p className="subtitle">点検数: {count}</p>
        <p className="subtitle">スコア: {currentSession.score}</p>
        <p className="subtitle">{resultMessage}</p>
        <p className="subtitle">報告フォーム: {gameConfig.reportFormUrl}</p>
      </section>

      <section className="card stack">
        <button className="primary-button" onClick={() => replayPatrol()}>
          もういちど遊ぶ
        </button>
        <button className="secondary-button" onClick={() => goToMap()}>
          べつのねこで遊ぶ
        </button>
        <a className="secondary-button" href={gameConfig.reportFormUrl} target="_blank" rel="noreferrer" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
          ねこの もくげきほうこくをする
        </a>
      </section>
    </main>
  );
}
