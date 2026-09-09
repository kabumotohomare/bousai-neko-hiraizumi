import { useStudioStore } from '../../app/store';
import { toExportFileName } from '../../domain/catalog';

export function ExportScreen() {
  const overlay = useStudioStore((s) => s.overlay);
  const downloadZip = useStudioStore((s) => s.downloadZip);
  const faces =
    overlay?.buildings.flatMap((building) =>
      building.faces.map((face) => ({
        buildingId: building.building_id,
        pending: building.pendingGameId,
        face
      }))
    ) ?? [];

  return (
    <section className="panel">
      <h2>書き出し確認</h2>
      <p className="muted">
        {'ファイル名は building_{building_id}_face_{face_id}.png です。zip に JSON と画像が含まれます。Drive への送信は手動です。'}
      </p>
      <table className="face-table">
        <thead>
          <tr>
            <th>building_id</th>
            <th>face_id</th>
            <th>状態</th>
            <th>形式</th>
            <th>bytes</th>
            <th>ファイル</th>
          </tr>
        </thead>
        <tbody>
          {faces.map(({ buildingId, pending, face }) => (
            <tr key={`${buildingId}-${face.face_id}`}>
              <td>
                {buildingId}
                {pending ? ' (仮)' : ''}
              </td>
              <td>{face.face_id}</td>
              <td>{face.status}</td>
              <td>{face.lastExportFormat ?? '—'}</td>
              <td>{face.lastExportBytes ?? '—'}</td>
              <td>
                <code>{face.exportRelPath ?? toExportFileName(buildingId, face.face_id)}</code>
                {face.lastExportWarning ? (
                  <>
                    <br />
                    <span className="muted">{face.lastExportWarning}</span>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <button type="button" className="primary" onClick={() => void downloadZip()}>
          プロジェクトを zip で保存
        </button>
      </p>
    </section>
  );
}
