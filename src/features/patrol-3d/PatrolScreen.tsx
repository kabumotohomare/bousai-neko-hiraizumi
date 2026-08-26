import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../../app/store/useAppStore';
import { distance2d, latLngToWorldPosition } from '../../services/transform/latLngToWorldPosition';

export function PatrolScreen() {
  const cats = useAppStore((state) => state.cats);
  const hydrants = useAppStore((state) => state.hydrants);
  const gameConfig = useAppStore((state) => state.gameConfig);
  const currentSession = useAppStore((state) => state.currentSession);
  const messages = useAppStore((state) => state.messages);
  const tickPatrol = useAppStore((state) => state.tickPatrol);
  const inspectHydrant = useAppStore((state) => state.inspectHydrant);
  const goToMap = useAppStore((state) => state.goToMap);
  const lastInspectAtRef = useRef(0);

  const selectedCat = useMemo(() => {
    if (!currentSession) {
      return null;
    }
    return cats.find((cat) => cat.id === currentSession.catId) ?? null;
  }, [cats, currentSession]);

  const nearbyHydrants = useMemo(() => {
    if (!selectedCat) {
      return [];
    }

    const origin = gameConfig.defaultMapCenter;
    const catWorld = latLngToWorldPosition(selectedCat.center.lat, selectedCat.center.lng, origin);

    return hydrants
      .filter((hydrant) => hydrant.status === 'active')
      .filter((hydrant) => {
        const hydrantWorld = latLngToWorldPosition(hydrant.lat, hydrant.lng, origin);
        return distance2d(catWorld, hydrantWorld) <= selectedCat.radius + 30;
      });
  }, [gameConfig.defaultMapCenter, hydrants, selectedCat]);

  const nextInspectable = useMemo(() => {
    if (!currentSession) {
      return null;
    }

    return nearbyHydrants.find(
      (hydrant) => !currentSession.inspectedHydrantIds.includes(hydrant.id)
    ) ?? null;
  }, [currentSession, nearbyHydrants]);

  useEffect(() => {
    if (!currentSession || currentSession.finished) {
      return;
    }

    const timer = window.setInterval(() => {
      tickPatrol();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentSession, tickPatrol]);

  if (!currentSession || !selectedCat) {
    return null;
  }

  const handleInspect = () => {
    if (!nextInspectable || currentSession.remainingSec <= 0) {
      return;
    }

    const now = Date.now();
    if (now - lastInspectAtRef.current < 800) {
      return;
    }

    lastInspectAtRef.current = now;
    inspectHydrant(nextInspectable.id);
  };

  return (
    <main className="app-shell stack">
      <section className="hud">
        <div className="card">
          <div>残り時間</div>
          <strong>{currentSession.remainingSec}s</strong>
        </div>
        <div className="card">
          <div>点検数</div>
          <strong>{currentSession.inspectedHydrantIds.length}</strong>
        </div>
        <div className="card">
          <div>スコア</div>
          <strong>{currentSession.score}</strong>
        </div>
      </section>

      <section className="card stack">
        <h1 className="title">3Dみまわり（初期スキャフォールド）</h1>
        <p className="subtitle">{selectedCat.name} / {selectedCat.displayAreaName}</p>
        <div className="scene-placeholder">
          Three.js シーン実装予定エリア。現時点ではデータ導線とゲーム状態管理を優先しています。
        </div>
      </section>

      <section className="card stack">
        <h2 className="title">見回り対象</h2>
        <p className="subtitle">近傍の消火栓候補: {nearbyHydrants.length}件</p>
        <div className="hydrant-list">
          {nearbyHydrants.map((hydrant) => {
            const inspected = currentSession.inspectedHydrantIds.includes(hydrant.id);
            return (
              <div key={hydrant.id} className={`hydrant-item ${inspected ? 'selected' : ''}`}>
                <strong>{hydrant.name}</strong>
                <div>{hydrant.id}</div>
                <div>{inspected ? '点検済み' : '未点検'}</div>
              </div>
            );
          })}
        </div>
        <button className="primary-button" disabled={!nextInspectable} onClick={handleInspect}>
          てんけんする
        </button>
        <p className="subtitle">{nextInspectable ? messages.inspectSuccess : messages.timeUp}</p>
        <button className="secondary-button" onClick={() => goToMap()}>
          ねこえらびにもどる
        </button>
      </section>
    </main>
  );
}
