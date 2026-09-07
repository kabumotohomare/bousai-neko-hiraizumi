import { useMemo } from 'react';
import { CatSelectionMap } from '../../components/map/CatSelectionMap';
import { useAppStore } from '../../app/store/useAppStore';

export function MapSelectionScreen() {
  const cats = useAppStore((state) => state.cats);
  const selectedCatId = useAppStore((state) => state.selectedCatId);
  const gameConfig = useAppStore((state) => state.gameConfig);
  const selectCat = useAppStore((state) => state.selectCat);
  const startPatrol = useAppStore((state) => state.startPatrol);

  const selectedCat = useMemo(
    () => cats.find((cat) => cat.id === selectedCatId) ?? null,
    [cats, selectedCatId]
  );

  return (
    <main className="app-shell stack">
      <section className="card stack">
        <h1 className="title">猫をえらぶ</h1>
        <p className="subtitle">猫を選んで、縄張りを確認してから見回りを始めます。</p>
        <CatSelectionMap
          cats={cats}
          selectedCatId={selectedCatId}
          center={gameConfig.defaultMapCenter}
          zoom={gameConfig.defaultMapZoom}
          mapBounds={gameConfig.mapBounds}
          onSelectCat={selectCat}
        />
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
                {cat.photoUrl ? (
                  <img className="cat-item__photo" src={cat.photoUrl} alt="" />
                ) : null}
                <span className="cat-item__body">
                  <strong>{cat.name}</strong>
                  <span>{cat.displayAreaName}</span>
                  <span>縄張り半径: {cat.radius}m</span>
                  <span className="cat-item__credit">（名づけ主：{cat.namedBy}）</span>
                </span>
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
            <p className="subtitle">縄張り半径: {selectedCat.radius}m</p>
            <p className="subtitle">（名づけ主：{selectedCat.namedBy}）</p>
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
