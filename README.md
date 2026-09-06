# ぼうさいネコ＠平泉

岩手県平泉町の消火栓オープンデータと猫目撃情報を活用した、スマートフォン向け地域参加型・防災3DアクションWebゲームの初期リポジトリです。

この初期構成には以下を含みます。

- Vite + React + TypeScript + Zustand のベース構成
- ESLint / Prettier / Playwright の開発環境
- `/public/data/` 配下のモックJSON
- Zod によるデータバリデーション
- `localStorage` の保存処理
- 画面の基本骨組み
  - S01: ローディング
  - S02: 2D猫えらび
  - S03: 3Dみまわり（初期スキャフォールド）
  - S04: リザルト
  - S05: エラー
- 緯度経度 → ローカル座標変換関数
- Cursor 用 `.cursorrules`
- 企画・開発仕様書の `docs/` 同梱

> 注意: このリポジトリは**実装着手用の初期ファイル一式**です。Leaflet / Three.js の本格組み込みはこれから行う前提で、現時点では軽量な画面スキャフォールドとデータ導線を優先しています。

---

## セットアップ

### 前提

- Node.js 22 系
- pnpm

### インストール

```bash
pnpm install
```

### 開発サーバ起動

```bash
pnpm dev
```

### ビルド

```bash
pnpm build
```

### 型チェック

```bash
pnpm check
```

### テスト

```bash
pnpm test
```

### Lint / Format

```bash
pnpm lint
pnpm format:check
```

### E2E（初回は Playwright ブラウザの導入が必要）

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

---

## ディレクトリ構成

```text
src/
  app/
    bootstrap/
    store/
  features/
    boot/
    map-selection/
    patrol-3d/
    result/
    error/
  components/
    ui/
  domain/
    cat/
    hydrant/
    session/
    common/
  services/
    api/
    storage/
    transform/
  styles/
public/
  data/
docs/
```

---

## 公開データ

`public/data/` 配下に以下のモックデータを配置しています。

- `cats.json`
- `hydrants.json`
- `game-config.json`
- `messages.json`

アプリ起動時にこれらを取得し、Zod でバリデーションした後に Zustand ストアへ格納します。

---

## 現在の実装方針

### MVPで優先していること

- ノンログインで即プレイできる
- データロードと状態管理の土台がある
- 仕様書に沿った型・JSON構造が揃っている
- 将来の Leaflet / Three.js 実装に差し込みやすい構造である

### 今後の実装候補

1. Leaflet マップの本実装
2. Three.js シーン・プレイヤー移動の本実装
3. 消火栓近接判定の3D連動
4. HUD 改善
5. 音・演出追加
6. Playwright E2E（スモークは整備済み。本編シナリオは今後）
7. 管理API / DB 側の整備

---

## 主要スクリプト

| コマンド            | 内容                  |
| ------------------- | --------------------- |
| `pnpm dev`          | 開発サーバ起動        |
| `pnpm build`        | 本番ビルド            |
| `pnpm preview`      | ビルド確認            |
| `pnpm check`        | TypeScript 型チェック |
| `pnpm lint`         | ESLint                |
| `pnpm format:check` | Prettier チェック     |
| `pnpm test`         | Vitest 実行           |
| `pnpm test:e2e`     | Playwright E2E        |

---

## 仕様書同梱

- `docs/ぼうさいネコ_更新版仕様書.md`
- `docs/ぼうさいネコ_開発仕様書.md`

---

## ライセンス

ライセンスは未確定です。公開前に決定してください。
