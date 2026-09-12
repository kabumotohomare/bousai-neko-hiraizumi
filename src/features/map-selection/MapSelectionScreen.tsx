import { useCallback, useEffect, useMemo, useState } from 'react';
import { CatSelectionMap } from '../../components/map/CatSelectionMap';
import { useAppStore } from '../../app/store/useAppStore';
import { fill } from '../../domain/scenario/lines';
import { preloadGltf } from '../../services/three/gltfCache';

/**
 * S02 猫えらび（接続）。
 * unlocked = 選べる猫（えらべる）。locked = まだ見つかっていない猫（まだ いない）。
 * locked はグレー表示で選べない。タップすると案内と通報リンクを出す。
 */
export function MapSelectionScreen() {
  const cats = useAppStore((state) => state.cats);
  const buildings = useAppStore((state) => state.buildings);
  const selectedCatId = useAppStore((state) => state.selectedCatId);
  const gameConfig = useAppStore((state) => state.gameConfig);
  const messages = useAppStore((state) => state.messages);
  const selectCat = useAppStore((state) => state.selectCat);
  const startPatrol = useAppStore((state) => state.startPatrol);

  // みまわり画面（PatrolScene）で建物モデルを読み込むと、開始直後の
  // 「3,2,1,スタート」表示より読み込みが長引いた分だけ建物の表示が遅れる。
  // 猫を選んでいる待ち時間を使ってあらかじめ取得・パースしておくことで、
  // みまわり開始時点ではキャッシュ済みになっている状態を目指す。
  useEffect(() => {
    for (const building of buildings) {
      if (building.kind === 'landmark' && building.modelUrl) {
        preloadGltf(building.modelUrl);
      }
    }
  }, [buildings]);

  const [lockedNote, setLockedNote] = useState<string | null>(null);
  const s = messages.scenario;

  const selectedCat = useMemo(
    () => cats.find((cat) => cat.id === selectedCatId) ?? null,
    [cats, selectedCatId]
  );
  const sleepingCat = useMemo(() => cats.find((cat) => cat.status === 'locked') ?? null, [cats]);

  const handleSelect = useCallback(
    (catId: string) => {
      const cat = cats.find((item) => item.id === catId);
      if (!cat) {
        return;
      }
      if (cat.status !== 'unlocked') {
        setLockedNote(fill(s.selectLockedTap, { catName: cat.name }));
        return;
      }
      setLockedNote(null);
      selectCat(catId);
    },
    [cats, s.selectLockedTap, selectCat]
  );

  return (
    <main className="app-shell stack">
      <section className="card stack">
        <h1 className="title">猫をえらぶ</h1>
        <p className="subtitle">猫を選んで、縄張りを確認してから見回りを始めます。</p>
        <p className="select-intro">
          {fill(s.selectIntro, { durationSec: gameConfig.gameDurationSec })}
          {sleepingCat ? ` ${fill(s.selectSleeping, { sleepingName: sleepingCat.name })}` : ''}
        </p>
        <CatSelectionMap
          cats={cats}
          selectedCatId={selectedCatId}
          center={gameConfig.defaultMapCenter}
          zoom={gameConfig.defaultMapZoom}
          mapBounds={gameConfig.mapBounds}
          onSelectCat={handleSelect}
        />
      </section>

      <section className="card stack">
        <h2 className="title">猫一覧</h2>
        <div className="cat-list">
          {cats.map((cat) => {
            const selected = selectedCatId === cat.id;
            const locked = cat.status !== 'unlocked';
            return (
              <button
                key={cat.id}
                type="button"
                className={`cat-item ${selected ? 'selected' : ''} ${locked ? 'cat-item--locked' : ''}`}
                aria-disabled={locked || undefined}
                onClick={() => handleSelect(cat.id)}
              >
                <span className="cat-item__visual" aria-hidden="true">
                  {cat.photoUrl ? (
                    <img className="cat-item__photo" src={cat.photoUrl} alt="" />
                  ) : null}
                  {cat.illustUrl ? (
                    <img className="cat-item__persona" src={cat.illustUrl} alt="" />
                  ) : null}
                </span>
                <span className="cat-item__body">
                  <span className={`cat-item__badge${locked ? '' : ' cat-item__badge--open'}`}>
                    {locked ? s.sleepingBadge : s.selectConnectable}
                  </span>
                  <strong>{cat.name}</strong>
                  <span>{cat.aliasName ?? cat.displayAreaName}</span>
                  {locked ? null : <span>縄張り半径: {cat.radius}m</span>}
                  <span className="cat-item__credit">（名づけ主：{cat.namedBy}）</span>
                </span>
              </button>
            );
          })}
        </div>
        {lockedNote ? (
          <p className="select-locked-note" role="status">
            {lockedNote}{' '}
            <a href={gameConfig.reportFormUrl} target="_blank" rel="noreferrer">
              {s.reportLink}
            </a>
          </p>
        ) : null}
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
