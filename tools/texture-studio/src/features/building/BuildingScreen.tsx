import { useStudioStore } from '../../app/store';
import { toExportFileName } from '../../domain/catalog';

export function BuildingScreen() {
  const overlay = useStudioStore((s) => s.overlay);
  const selectedBuildingId = useStudioStore((s) => s.selectedBuildingId);
  const selectBuilding = useStudioStore((s) => s.selectBuilding);
  const selectFace = useStudioStore((s) => s.selectFace);
  const selectedFaceId = useStudioStore((s) => s.selectedFaceId);
  const addFace = useStudioStore((s) => s.addFace);
  const attachPhoto = useStudioStore((s) => s.attachPhoto);
  const setOsmId = useStudioStore((s) => s.setOsmId);
  const setShootTarget = useStudioStore((s) => s.setShootTarget);
  const setScreen = useStudioStore((s) => s.setScreen);
  const patchFace = useStudioStore((s) => s.patchFace);

  const building = overlay?.buildings.find((b) => b.building_id === selectedBuildingId) ?? null;

  if (!overlay) {
    return <p className="muted">プロジェクトがありません。</p>;
  }

  if (!building) {
    return (
      <section className="panel stack">
        <h2>建物</h2>
        <p className="muted">地図から建物を選ぶか、一覧から選んでください。</p>
        <div className="building-list">
          {overlay.buildings.map((b) => (
            <button key={b.building_id} type="button" className="building-row" onClick={() => selectBuilding(b.building_id)}>
              <span>{b.name ?? b.building_id}</span>
              <span>{b.faces.length}面</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="grid-2">
      <section className="panel stack">
        <h2>{building.name ?? building.building_id}</h2>
        <p className="muted">building_id: {building.building_id}</p>
        <label className="field">
          OSM_ID（任意・主キーではない）
          <input
            value={building.osm_id ?? ''}
            onChange={(e) => setOsmId(building.building_id, e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={building.isShootTarget}
            onChange={(e) => setShootTarget(building.building_id, e.target.checked)}
          />{' '}
          撮影対象
        </label>
        {building.pendingGameId ? (
          <p className="muted">この ID はゲーム buildings.json にまだありません。</p>
        ) : null}
        <button type="button" onClick={() => addFace(building.building_id)}>
          面を追加（face_id 自動採番）
        </button>
      </section>
      <section className="panel">
        <h3>面</h3>
        <table className="face-table">
          <thead>
            <tr>
              <th>face_id</th>
              <th>Blender</th>
              <th>状態</th>
              <th>写真</th>
              <th>出力名</th>
            </tr>
          </thead>
          <tbody>
            {building.faces.map((face) => (
              <tr key={face.face_id}>
                <td>
                  <button
                    type="button"
                    className={selectedFaceId === face.face_id ? 'primary' : ''}
                    onClick={() => selectFace(face.face_id)}
                  >
                    {face.face_id}
                  </button>
                </td>
                <td>
                  <input
                    value={face.blenderObjectName ?? ''}
                    placeholder="オブジェクト名"
                    onChange={(e) =>
                      patchFace(building.building_id, face.face_id, {
                        blenderObjectName: e.target.value
                      })
                    }
                  />
                </td>
                <td>{face.status}</td>
                <td>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void attachPhoto(building.building_id, face.face_id, file);
                      }
                    }}
                  />
                </td>
                <td>
                  <code>{toExportFileName(building.building_id, face.face_id)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">ポリゴン番号は ID にしません。Blender 側はカスタムプロパティとオブジェクト名で照合します。</p>
        <button
          type="button"
          className="primary"
          disabled={!selectedFaceId}
          onClick={() => setScreen('pipeline')}
        >
          選択中の面を加工
        </button>
      </section>
    </div>
  );
}
