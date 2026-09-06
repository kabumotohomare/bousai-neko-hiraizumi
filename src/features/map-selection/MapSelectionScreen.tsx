import { useMemo } from 'react';
import { useAppStore } from '../../app/store/useAppStore';

export function MapSelectionScreen() {
  const cats = useAppStore((state) => state.cats);
  const selectedCatId = useAppStore((state) => state.selectedCatId);
  const selectCat = useAppStore((state) => state.selectCat);
  const startPatrol = useAppStore((state) => state.startPatrol);

  const selectedCat = useMemo(
    () => cats.find((cat) => cat.id === selectedCatId) ?? null,
    [cats, selectedCatId]
  );

  return (
    <main className="app-shell stack">
      <section className="card stack">
        <h1 className="title">2D猫えらび</h1>
        <p className="subtitle">猫を選んで、縄張りを確認してから見回りを始めます。</p>
        <div className="map-placeholder">
          Leaflet マップ実装予定エリア。現在はスキャフォールドです。
        </div>
      </section>

      <section className="card stack">
        <h2 className="title">猫一覧</h2>
        <div className="cat-list">
          {cats.map((cat) => {
            const selected = selectedCatId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`cat-item ${selected ? 'selected' : ''}`}
                onClick={() => selectCat(cat.id)}
              >
                <strong>{cat.name}</strong>
                <div>{cat.displayAreaName}</div>
                <div>{cat.info}</div>
                <div>縄張り半径: {cat.radius}m</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card stack">
        <h2 className="title">選択中の猫</h2>
        {selectedCat ? (
          <>
            <p className="subtitle">
              {selectedCat.name} / {selectedCat.displayAreaName}
            </p>
            <p className="subtitle">{selectedCat.info}</p>
          </>
        ) : (
          <p className="subtitle">まだ猫が選ばれていません。</p>
        )}
        <button className="primary-button" disabled={!selectedCat} onClick={() => startPatrol()}>
          このねこでみまわりスタート
        </button>
      </section>
    </main>
  );
}
