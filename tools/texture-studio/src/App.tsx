import { useStudioStore } from './app/store';
import { BuildingScreen } from './features/building/BuildingScreen';
import { ExportScreen } from './features/export/ExportScreen';
import { MapScreen } from './features/map/MapScreen';
import { PipelineScreen } from './features/pipeline/PipelineScreen';
import { ProjectScreen } from './features/project/ProjectScreen';

const NAV = [
  { id: 'project', label: 'プロジェクト' },
  { id: 'map', label: '地図' },
  { id: 'building', label: '建物' },
  { id: 'pipeline', label: '加工' },
  { id: 'export', label: '書き出し' }
] as const;

export function App() {
  const screen = useStudioStore((s) => s.screen);
  const setScreen = useStudioStore((s) => s.setScreen);
  const meta = useStudioStore((s) => s.meta);
  const error = useStudioStore((s) => s.error);
  const clearError = useStudioStore((s) => s.clearError);
  const save = useStudioStore((s) => s.save);
  const downloadZip = useStudioStore((s) => s.downloadZip);
  const dirty = useStudioStore((s) => s.dirty);
  const fsKind = useStudioStore((s) => s.fsKind);

  return (
    <div className="studio">
      <header className="studio-header">
        <div>
          <h1>平泉・街並みテクスチャ制作支援</h1>
          <p>
            {meta ? meta.name : 'プロジェクト未作成'}
            {dirty ? ' ・ 未保存' : ''}
            {meta ? ` ・ 保存: ${fsKind === 'directory' ? 'フォルダ' : 'メモリ/zip'}` : ''}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" disabled={!meta} onClick={() => void save()}>
            保存
          </button>
          <button type="button" disabled={!meta} onClick={() => void downloadZip()}>
            zip書き出し
          </button>
        </div>
      </header>
      <nav className="studio-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={screen === item.id ? 'active' : ''}
            onClick={() => setScreen(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {error ? (
        <p className="banner">
          {error}{' '}
          <button type="button" onClick={clearError}>
            閉じる
          </button>
        </p>
      ) : null}
      <main className="studio-main">
        {screen === 'project' ? <ProjectScreen /> : null}
        {screen === 'map' ? <MapScreen /> : null}
        {screen === 'building' ? <BuildingScreen /> : null}
        {screen === 'pipeline' ? <PipelineScreen /> : null}
        {screen === 'export' ? <ExportScreen /> : null}
      </main>
    </div>
  );
}
