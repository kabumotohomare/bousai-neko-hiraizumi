import { useAppStore } from '../../app/store/useAppStore';

export function ErrorScreen() {
  const error = useAppStore((state) => state.error);
  const bootApp = useAppStore((state) => state.bootApp);

  return (
    <main className="app-shell">
      <section className="card stack">
        <h1 className="title">エラーが発生しました</h1>
        <p className="subtitle">{error?.message ?? '不明なエラーです。'}</p>
        <p className="subtitle">エラーコード: {error?.code ?? 'UNKNOWN'}</p>
        <button className="primary-button" onClick={() => void bootApp()}>
          再読み込みする
        </button>
      </section>
    </main>
  );
}
