import { useState } from 'react';
import { useStudioStore } from '../../app/store';
import { canUseDirectoryPicker } from '../../services/fs/projectFs';

export function ProjectScreen() {
  const createProject = useStudioStore((s) => s.createProject);
  const openDirectory = useStudioStore((s) => s.openDirectory);
  const importZip = useStudioStore((s) => s.importZip);
  const importGameJson = useStudioStore((s) => s.importGameJson);
  const importBlenderFaces = useStudioStore((s) => s.importBlenderFaces);
  const setReferenceImage = useStudioStore((s) => s.setReferenceImage);
  const meta = useStudioStore((s) => s.meta);
  const gameCount = useStudioStore((s) => s.gameBuildings.length);
  const [name, setName] = useState('hiraizumi-textures');

  return (
    <div className="grid-2">
      <section className="panel stack">
        <h2>プロジェクト</h2>
        <p className="muted">
          ゲーム本体の buildings.json は読み取り専用で取り込みます。OSM や撮影状態は
          catalog/buildings.overlay.json に分離します。
        </p>
        <label className="field">
          新規プロジェクト名
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="button" className="primary" onClick={() => void createProject(name)}>
          新規作成（メモリ）
        </button>
        <button type="button" disabled={!canUseDirectoryPicker()} onClick={() => void openDirectory()}>
          フォルダを開く（Chrome / Edge）
        </button>
        <label className="field">
          zip を開く
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void importZip(file);
              }
            }}
          />
        </label>
      </section>
      <section className="panel stack">
        <h2>データ取り込み</h2>
        <p className="muted">ゲーム buildings.json 件数: {gameCount}</p>
        {meta ? (
          <p className="muted">
            基準画像: {meta.referenceImageRelPath ?? '未指定'}（scope: {meta.colorMatchScope}）
          </p>
        ) : (
          <p className="muted">先にプロジェクトを作成してください。</p>
        )}
        <button
          type="button"
          disabled={!meta}
          onClick={async () => {
            const res = await fetch('/samples/buildings.game.json');
            void importGameJson(await res.text());
          }}
        >
          サンプル buildings.json を取り込む
        </button>
        <label className="field">
          ゲームの buildings.json（読取専用コピー）
          <input
            type="file"
            accept="application/json,.json"
            disabled={!meta}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                void importGameJson(await file.text());
              }
            }}
          />
        </label>
        <label className="field">
          Blender faces.json
          <input
            type="file"
            accept="application/json,.json"
            disabled={!meta}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                void importBlenderFaces(await file.text());
              }
            }}
          />
        </label>
        <label className="field">
          色調の基準画像（プロジェクト単位・1枚）
          <input
            type="file"
            accept="image/*"
            disabled={!meta}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void setReferenceImage(file);
              }
            }}
          />
        </label>
      </section>
    </div>
  );
}
