# 【開発仕様書】ぼうさいネコ＠平泉

- **作成日:** 2026-08-26
- **作成目的:** 更新版仕様書をもとに、エンジニアがそのまま実装設計・着手できる粒度まで具体化する
- **参照元:** `SPECIFICATION (更新中).md` / `ぼうさいネコ@平泉_フィードバック.md` / 更新版仕様書
- **対象リリース:** MVP v1.0

---

## 1. 開発方針

本書では、**プレイヤー向けWebアプリは静的配信中心**、**運営用データ管理は将来API/DB拡張可能**という前提で仕様を定義する。

MVPでは以下を採用する。

- プレイヤーは**ログイン不要**
- プレイ進行は**`localStorage` 保存**
- プレイヤー向け公開データは **JSON ファイル配信**
- 運営用の猫目撃情報は、当面 **外部フォーム + 手動確認 + 公開JSON反映**
- ただし将来の運用自動化に備え、**管理API / DB スキーマを先に定義**する

これにより、初期実装は軽く、将来の拡張余地も保持する。

---

## 2. スコープ

## 2.1 MVPで実装する範囲

1. 2Dマップ上で猫を選択できる
2. 選択した猫の縄張りを可視化できる
3. 3D空間へ遷移できる
4. 90秒の制限時間内で移動できる
5. 消火栓に接近すると点検ボタンが有効化される
6. 点検演出・スコア加算が行われる
7. 縄張り外へ出ようとすると押し戻される
8. リザルト画面が表示される
9. 進行状況を `localStorage` に保存する
10. 外部フォームへの遷移導線を設ける

## 2.2 MVPで実装しない範囲

1. プレイヤーアカウント機能
2. ランキング機能
3. リアルタイム多人数同期
4. プレイヤーによるゲーム内からの直接投稿
5. 高度な管理画面
6. 自動モデレーション

---

## 3. 推奨技術スタック

実装ブレを減らすため、以下を推奨する。

### 3.1 フロントエンド

- ビルド: **Vite**
- 言語: **TypeScript**
- UI: **React**
- 状態管理: **Zustand** または React Context + Reducer
- 2Dマップ: **Leaflet.js**
- 3D描画: **Three.js**
- スタイル: CSS Modules または Tailwind CSS
- バリデーション: **Zod**
- テスト: **Vitest**, **React Testing Library**, **Playwright**

### 3.2 データ配信

- 公開配信: GitHub Pages / Cloudflare Pages / Netlify のいずれか
- 公開データ: `/public/data/*.json`
- 将来の管理API: Node.js + Express / Hono / Cloudflare Workers 想定
- DB: PostgreSQL 想定

### 3.3 開発基準

- Node.js: 22系推奨
- package manager: pnpm 推奨
- Lint: ESLint
- Format: Prettier

---

## 4. システム構成

```text
[プレイヤー端末]
  ├─ React UI
  ├─ Leaflet Map
  ├─ Three.js Scene
  ├─ localStorage
  └─ fetch('/data/*.json')

[静的ホスティング]
  ├─ index.html
  ├─ app bundle
  └─ public/data/
      ├─ cats.json
      ├─ hydrants.json
      ├─ game-config.json
      └─ messages.json

[運営系]
  ├─ 外部フォーム（猫目撃報告）
  ├─ 管理用DB（将来）
  ├─ 管理API（将来）
  └─ 公開JSON生成バッチ（将来）
```

---

## 5. 画面一覧

| 画面ID | 画面名 | 役割 |
|---|---|---|
| S01 | ローディング画面 | 必要JSON読み込み、初期化 |
| S02 | 2D猫えらび画面 | 猫選択、縄張り確認 |
| S03 | 3Dみまわり画面 | プレイ本体 |
| S04 | おさんぽ完了画面 | リザルト表示 |
| S05 | エラー画面/ダイアログ | 通信失敗やデータ不整合の通知 |
| S06 | 外部フォーム遷移 | 猫目撃報告への導線 |

---

## 6. 画面遷移図（テキスト版）

```text
[S01 ローディング]
  ├─ 初期化成功 → [S02 2D猫えらび]
  └─ 初期化失敗 → [S05 エラー]

[S02 2D猫えらび]
  ├─ 猫を選択 → 同画面内で選択状態更新
  ├─ スタート押下 → [S03 3Dみまわり]
  ├─ データ再読み込み → [S01 ローディング]
  └─ エラー発生 → [S05 エラー]

[S03 3Dみまわり]
  ├─ 90秒経過 → [S04 おさんぽ完了]
  ├─ 任意リタイア（将来） → [S04 おさんぽ完了]
  ├─ 戻る操作 → 確認ダイアログ → [S02] or 継続
  └─ 致命的エラー → [S05 エラー]

[S04 おさんぽ完了]
  ├─ もういちど遊ぶ → [S03 3Dみまわり] ※同じ猫で再開
  ├─ べつのねこで遊ぶ → [S02 2D猫えらび]
  ├─ ねこの もくげきほうこくをする → [S06 外部フォーム]
  └─ トップにもどる → [S02 2D猫えらび]

[S05 エラー]
  ├─ 再試行 → [S01 ローディング]
  └─ トップへ → [S02 2D猫えらび] ※最低限データがある場合のみ
```

---

## 7. URL設計

SPA前提のため、URLは以下を推奨する。

| パス | 用途 |
|---|---|
| `/` | アプリ本体 |
| `/?screen=map` | 2D猫えらびへのディープリンク |
| `/?screen=patrol&catId=cat_001` | 指定猫の見回り開始準備 |
| `/report` | 外部フォームへの案内ページ（任意） |

※ 実装上は React Router を使ってもよいが、MVPでは単一ページ状態遷移でも可。

---

## 8. 機能仕様詳細

## 8.1 S01 ローディング画面

### 目的
起動時に公開JSONを読み込み、ゲームを開始可能な状態にする。

### 取得対象
- `/data/game-config.json`
- `/data/cats.json`
- `/data/hydrants.json`
- `/data/messages.json`

### 処理順
1. 設定ファイル読み込み
2. 猫データ読み込み
3. 消火栓データ読み込み
4. ローカル保存データ読み込み
5. 正規化・バリデーション
6. 初期画面決定

### エラー時
- 1回目失敗: 自動再試行 1回
- 2回失敗: エラーダイアログ表示
- `cats.json` は成功 / `hydrants.json` 失敗の場合はプレイ不可として S05 へ

---

## 8.2 S02 2D猫えらび画面

### 表示要素
- Leaflet 地図
- 猫ピン
- 選択中猫カード
- 縄張り円
- スタートボタン
- 更新情報バナー（任意）

### 操作
- 猫ピンタップで選択
- 選択中の猫に応じて縄張り円を描画
- スタート押下で S03 へ

### 描画条件
- ピンは `cats.status === 'unlocked'` を優先表示
- `locked` を将来使う場合は半透明表示可
- 地図の初期中心は `game-config.defaultMapCenter`

### バリデーション
- 猫未選択ではスタート不可
- 猫データ不備時は選択不可

---

## 8.3 S03 3Dみまわり画面

### プレイ開始時初期化
- 選択猫IDを受け取る
- 猫の `center` と `radius` をもとにプレイ領域確定
- 該当縄張り内または一定範囲近傍の消火栓のみ抽出
- プレイヤー初期位置を `cat.center` 近傍に配置
- タイマーを90秒に設定
- スコア 0、点検数 0 で開始

### 操作仕様
- 左下の仮想パッドで前後左右移動
- 初期版では視点の手動回転を最小限に抑える
- 画面右下の「てんけんする」は条件成立時のみ活性

### 点検成立条件
以下をすべて満たした場合に成立する。

1. 対象消火栓が未点検
2. プレイヤーと消火栓の距離が `inspectRadiusMeters` 以下
3. クールダウン中でない
4. タイマー残時間 > 0

### デフォルト数値
- `gameDurationSec`: 90
- `playerMoveSpeedMps`: 2.2
- `inspectRadiusMeters`: 2.0
- `territoryBoundaryMarginMeters`: 1.0
- `hintDelaySec`: 20
- `interactionCooldownMs`: 800

### スコア仕様（MVP）
- 1基点検ごとに **100点**
- 連続ボーナスなし
- 初回チュートリアル補正なし

### 点検演出仕様
- ボタン押下直後 100ms 以内にUI反応
- 消火栓キャップ開きアニメ: 0.4〜0.8秒
- スコアポップ表示: 0.8秒
- 点検済みマーク常駐
- 同一オブジェクト再点検不可

### 縄張り制御
- 境界外へ進もうとした場合、次フレームの移動をキャンセル
- 必要なら内向き法線方向へ 0.5〜1.0m 押し戻す
- メッセージ: 「ここからそとは、ぼくのなわばりじゃない」
- メッセージは 1.5秒表示、連打抑制 3秒

### ヒント表示
- 開始後20秒間点検ゼロなら最寄り消火栓方向を示すヒント表示
- ヒントON/OFFは `game-config` で切替可能

### 終了条件
- 残り時間が0になる
- 終了演出後、S04へ遷移

---

## 8.4 S04 おさんぽ完了画面

### 表示項目
- 選択猫名
- 点検数
- スコア
- コメント
- 防災メッセージ
- 新猫/更新告知（存在時）

### リザルト文言生成ルール
- 点検数 0: 励まし文言
- 点検数 1〜2: 基本称賛 + 学習文言
- 点検数 3以上: 強めの称賛 + 地域貢献文言

### ボタン遷移
- もういちど遊ぶ: 同じ `catId` で S03 再初期化
- べつのねこで遊ぶ: S02
- ねこの もくげきほうこくをする: 外部フォームURLを開く

---

## 8.5 S05 エラー表示

### 想定エラーコード
| コード | 内容 |
|---|---|
| E1001 | game-config 読み込み失敗 |
| E1002 | cats 読み込み失敗 |
| E1003 | hydrants 読み込み失敗 |
| E1004 | JSON schema 不正 |
| E2001 | 指定catId不正 |
| E3001 | 3D初期化失敗 |

### 表示方針
- ユーザー向けには技術詳細を出さない
- 開発ログには詳細出力する

---

## 9. 状態管理仕様

## 9.1 グローバル状態

```ts
interface AppState {
  bootStatus: 'idle' | 'loading' | 'ready' | 'error';
  currentScreen: 'loading' | 'map' | 'patrol' | 'result' | 'error';
  selectedCatId: string | null;
  cats: Cat[];
  hydrants: Hydrant[];
  gameConfig: GameConfig;
  messages: Messages;
  localProgress: LocalProgress;
  currentSession: PatrolSession | null;
  error: AppError | null;
}
```

## 9.2 プレイセッション状態

```ts
interface PatrolSession {
  catId: string;
  startedAt: string;
  remainingSec: number;
  score: number;
  inspectedHydrantIds: string[];
  lastHintAt?: string;
  finished: boolean;
}
```

---

## 10. データモデル

## 10.1 公開JSONスキーマ

### cats.json

```json
[
  {
    "id": "cat_001",
    "name": "シラヤマ",
    "displayAreaName": "志羅山地区",
    "status": "unlocked",
    "center": { "lat": 38.987472, "lng": 141.115946 },
    "radius": 300,
    "spawn": { "lat": 38.987500, "lng": 141.115900 },
    "photoUrl": "/images/cats/shirayama.png",
    "namedBy": "Code for hiraizumi",
    "territoryColor": "#4f46e5",
    "lastUpdated": "2026-08-25",
    "version": 1
  }
]
```

### hydrants.json

```json
[
  {
    "id": "hydrant_0001",
    "sourceId": "1-1",
    "name": "平泉第1消火栓",
    "lat": 38.987800,
    "lng": 141.116100,
    "type": "ground",
    "status": "active"
  }
]
```

### game-config.json

```json
{
  "version": 1,
  "gameDurationSec": 90,
  "playerMoveSpeedMps": 2.2,
  "inspectRadiusMeters": 2.0,
  "territoryBoundaryMarginMeters": 1.0,
  "hintDelaySec": 20,
  "boundaryMessageCooldownSec": 3,
  "defaultMapCenter": { "lat": 38.9869, "lng": 141.1170 },
  "defaultMapZoom": 16,
  "mapBounds": {
    "southWest": { "lat": 38.983, "lng": 141.108 },
    "northEast": { "lat": 38.996, "lng": 141.125 }
  },
  "reportFormUrl": "https://example.com/report",
  "enableHint": true,
  "enableSfx": true
}
```

### messages.json

```json
{
  "boundary": "ここからそとは、ぼくのなわばりじゃない",
  "timeUp": "きょうはもうつかれた。みまわりはおわりだ。",
  "inspectSuccess": "てんけんできた！",
  "resultLow": "つぎはもっとたくさん見つけてみよう。",
  "resultMid": "この場所、ほんとうの町でもおぼえておこう。",
  "resultHigh": "みんなの見回りが、町のあんしんにつながる。"
}
```

---

## 11. 座標変換仕様

3D空間はローカル平面座標系で扱う。原点は `game-config.defaultMapCenter` または選択猫 `spawn` を採用できるが、**MVPでは defaultMapCenter を固定原点**とする。

### 11.1 変換式

```ts
const metersPerLat = 111320;
const metersPerLng = 111320 * Math.cos(originLat * Math.PI / 180);

x = (lng - originLng) * metersPerLng;
z = -1 * (lat - originLat) * metersPerLat;
```

### 11.2 採用理由
- 実装が単純
- 平泉町内の限定範囲では十分な精度
- GIS依存を避けられる

### 11.3 距離計算
縄張り判定・接近判定は meter 単位で `Vector2(x, z)` 距離を使う。

---

## 12. localStorage仕様

キーは名前衝突回避のためプレフィックスを持つ。

### 12.1 保存キー

- `bousaiNeko.progress`
- `bousaiNeko.settings`
- `bousaiNeko.sessionDraft`

### 12.2 progress スキーマ

```json
{
  "unlockedCatIds": ["cat_001"],
  "inspectedHydrantIds": ["hydrant_0001"],
  "playedTutorial": true,
  "lastSelectedCatId": "cat_001",
  "lastPlayedAt": "2026-08-26T09:00:00Z"
}
```

### 12.3 settings スキーマ

```json
{
  "sfxEnabled": true,
  "hintEnabled": true
}
```

### 12.4 sessionDraft スキーマ

```json
{
  "catId": "cat_001",
  "remainingSec": 54,
  "score": 200,
  "inspectedHydrantIds": ["hydrant_0001", "hydrant_0002"],
  "savedAt": "2026-08-26T09:01:00Z"
}
```

### 12.5 セッションドラフト方針
- MVPでは**リロード時にセッション復元しない**
- `sessionDraft` は将来拡張用の予約キー
- 現時点では保存しても復元しない、または実装しない

---

## 13. API定義

本プロダクトはMVPでは静的JSONでも成立するが、将来の更新自動化・管理画面実装に備えてAPIを以下の通り定義する。

## 13.1 公開API

### GET `/api/v1/game-config`
ゲーム設定を返す。

**Response 200**
```json
{
  "version": 1,
  "gameDurationSec": 90,
  "playerMoveSpeedMps": 2.2,
  "inspectRadiusMeters": 2.0,
  "reportFormUrl": "https://example.com/report"
}
```

### GET `/api/v1/cats`
公開中の猫一覧を返す。

**Query**
- `status=unlocked` 任意

**Response 200**
```json
{
  "items": [
    {
      "id": "cat_001",
      "name": "シラヤマ",
      "displayAreaName": "志羅山地区",
      "center": { "lat": 38.987472, "lng": 141.115946 },
      "radius": 300,
      "photoUrl": "/images/cats/shirayama.png",
      "namedBy": "Code for hiraizumi",
      "territoryColor": "#4f46e5"
    }
  ]
}
```

### GET `/api/v1/hydrants`
公開中の消火栓一覧を返す。

**Query**
- `catId=cat_001` 任意。指定時は縄張り近傍だけ返す
- `bbox=minLng,minLat,maxLng,maxLat` 任意

**Response 200**
```json
{
  "items": [
    {
      "id": "hydrant_0001",
      "name": "平泉第1消火栓",
      "lat": 38.987800,
      "lng": 141.116100,
      "type": "ground"
    }
  ]
}
```

### GET `/api/v1/game-bundle?catId=cat_001`
プレイ開始に必要な最小セットをまとめて返す。将来の高速化用。

**Response 200**
```json
{
  "cat": {
    "id": "cat_001",
    "name": "シラヤマ",
    "center": { "lat": 38.987472, "lng": 141.115946 },
    "radius": 300
  },
  "hydrants": [
    { "id": "hydrant_0001", "lat": 38.987800, "lng": 141.116100 }
  ],
  "config": {
    "gameDurationSec": 90,
    "inspectRadiusMeters": 2.0
  }
}
```

## 13.2 管理API（将来実装）

### POST `/api/v1/admin/sightings`
住民報告を登録する。

**Request**
```json
{
  "observedAt": "2026-08-25T07:30:00+09:00",
  "lat": 38.987400,
  "lng": 141.115800,
  "photoUrl": "https://example.com/cat.jpg",
  "memo": "黒猫、しっぽ長め"
}
```

### GET `/api/v1/admin/sightings?status=pending`
未処理報告一覧を返す。

### PATCH `/api/v1/admin/sightings/{sightingId}`
報告のステータスを更新する。

**Request**
```json
{
  "status": "approved"
}
```

### POST `/api/v1/admin/cats`
新規猫を登録する。

### PATCH `/api/v1/admin/cats/{catId}`
猫情報や縄張りを更新する。

### POST `/api/v1/admin/publish`
公開JSONを再生成・反映する。

**Response 200**
```json
{
  "published": true,
  "version": 12,
  "publishedAt": "2026-08-26T10:00:00Z"
}
```

---

## 14. DBスキーマ（推奨）

プレイヤーは非ログインのため、DBは**運営データの正本管理用**として定義する。

## 14.1 ER概要

```text
cats 1 --- n cat_territories
cats 1 --- n cat_sightings
hydrants_master n --- n cat_territories_hydrants
publish_releases 1 --- n published_assets
```

## 14.2 テーブル定義

### cats

```sql
CREATE TABLE cats (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  display_area_name VARCHAR(100) NOT NULL,
  photo_url TEXT,
  named_by VARCHAR(100) NOT NULL DEFAULT '',
  territory_color CHAR(7) NOT NULL DEFAULT '#4f46e5',
  status VARCHAR(20) NOT NULL DEFAULT 'unlocked',
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  spawn_lat DOUBLE PRECISION,
  spawn_lng DOUBLE PRECISION,
  radius_m INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### cat_territories

```sql
CREATE TABLE cat_territories (
  id BIGSERIAL PRIMARY KEY,
  cat_id VARCHAR(50) NOT NULL REFERENCES cats(id),
  territory_type VARCHAR(20) NOT NULL DEFAULT 'circle',
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_m INTEGER,
  polygon_geojson JSONB,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### hydrants_master

```sql
CREATE TABLE hydrants_master (
  id VARCHAR(50) PRIMARY KEY,
  source_id VARCHAR(100) NOT NULL,
  name VARCHAR(150),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  hydrant_type VARCHAR(30) NOT NULL DEFAULT 'ground',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### cat_sightings

```sql
CREATE TABLE cat_sightings (
  id BIGSERIAL PRIMARY KEY,
  observed_at TIMESTAMPTZ,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  photo_url TEXT,
  memo TEXT,
  reporter_channel VARCHAR(30) NOT NULL DEFAULT 'google_form',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  linked_cat_id VARCHAR(50) REFERENCES cats(id),
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### cat_territories_hydrants

```sql
CREATE TABLE cat_territories_hydrants (
  territory_id BIGINT NOT NULL REFERENCES cat_territories(id),
  hydrant_id VARCHAR(50) NOT NULL REFERENCES hydrants_master(id),
  PRIMARY KEY (territory_id, hydrant_id)
);
```

### publish_releases

```sql
CREATE TABLE publish_releases (
  id BIGSERIAL PRIMARY KEY,
  version INTEGER NOT NULL,
  note TEXT,
  published_by VARCHAR(100),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### published_assets

```sql
CREATE TABLE published_assets (
  id BIGSERIAL PRIMARY KEY,
  release_id BIGINT NOT NULL REFERENCES publish_releases(id),
  asset_type VARCHAR(30) NOT NULL,
  asset_path TEXT NOT NULL,
  checksum VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 15. フロントエンド実装ルール

## 15.1 ディレクトリ構成（推奨）

```text
src/
  app/
    store/
    router/
  features/
    boot/
    map-selection/
    patrol-3d/
    result/
    error/
  components/
    ui/
    map/
    three/
  domain/
    cat/
    hydrant/
    session/
  services/
    api/
    storage/
    transform/
  assets/
  styles/
public/
  data/
    cats.json
    hydrants.json
    game-config.json
    messages.json
```

## 15.2 命名ルール
- 画面コンポーネント: `PascalCase`
- hooks: `useXxx`
- Zustand store: `useAppStore`
- データ変換: `toHydrantWorldPosition()` など動詞始まり

---

## 16. 3D実装仕様

## 16.1 座標系
- Y軸を高さ
- XZ平面を地面
- 北方向を `-Z` とする

## 16.2 オブジェクト
- プレイヤー: カメラ追従オブジェクト
- 消火栓: 低ポリ MeshGroup または GLB
- 建物: BoxGeometry 中心
- 地名: Sprite / Billboard

## 16.3 カメラ
- 高さ: 地面から 0.35〜0.5m
- FOV: 60前後
- 揺れなし
- ロール回転禁止

## 16.4 当たり判定
- プレイヤー: 半径 0.4m 想定
- 消火栓接近判定: 中心距離 2.0m 以下
- 縄張り境界: 円形距離判定

## 16.5 レンダリング最適化
- 影は必要最小限
- 1画面あたり消火栓表示数が多い場合は距離カリング
- 建物テクスチャ多用を避ける
- ポストエフェクト禁止

---

## 17. バッチ/公開データ生成仕様

将来的にDBから公開JSONを生成する場合、以下の順で行う。

1. 公開対象の猫を抽出
2. 公開対象縄張りを抽出
3. 縄張り内近傍の消火栓を抽出
4. `cats.json` / `hydrants.json` / `game-config.json` を生成
5. checksum を作成
6. `publish_releases` 記録
7. 静的ホスティングへデプロイ

---

## 18. エラーハンドリング

## 18.1 API/JSON取得失敗
- 初回読み込み時にリトライ 1回
- 失敗時は S05 表示
- 通信断の可能性を示す文言を表示

## 18.2 localStorage異常
- JSON parse 失敗時は破棄して初期化
- 例外は console と監視へ送る

## 18.3 データ不整合
- 猫中心座標欠落 → 当該猫を非表示
- 消火栓座標欠落 → 当該レコードを除外

---

## 19. セキュリティ・プライバシー

1. プレイヤー個人情報は保持しない
2. 投稿写真URLは公開範囲を管理者が確認する
3. 管理APIはプレイヤー向けホストと分離推奨
4. 管理系は認証必須
5. 公開JSONには投稿者識別情報を含めない

---

## 20. 非機能要件（実装基準）

| 項目 | 基準 |
|---|---|
| 初回ロード | 4G相当で 5秒以内を目標 |
| 3Dフレームレート | 30fps以上 |
| ボタン最小サイズ | 48x48px 以上 |
| 同時タッチ考慮 | 移動と点検の同時操作に配慮 |
| Lighthouse | Performance / Accessibility を重視 |

---

## 21. テスト観点

## 21.1 単体テスト
- 座標変換が正しい
- 距離判定が正しい
- スコア加算が正しい
- リザルト文言分岐が正しい
- localStorage 保存/復元が正しい

## 21.2 結合テスト
- JSON読み込みから初期画面表示まで
- 猫選択から3D遷移まで
- 点検成功で点数加算される
- 時間切れでリザルトへ遷移する

## 21.3 E2Eテスト
- 初回アクセス → 猫選択 → 1基点検 → リザルト
- 境界外移動 → 押し戻しメッセージ確認
- 通信失敗時 → エラー表示確認

---

## 22. 受け入れ条件（MVP）

1. 1匹以上の猫を選択して見回り開始できる
2. 90秒タイマーが正常動作する
3. 1基以上の消火栓を点検できる
4. 点検済み状態が視覚的に分かる
5. 縄張り外に出られない
6. リザルト画面へ遷移できる
7. `localStorage` に最低限の進行情報が保存される
8. 外部フォーム導線が機能する

---

## 23. 未確定事項・実装判断待ち

以下は開発開始前にPM/企画側で最終判断すると、実装のやり直しが減る。

1. 移動方式を**完全自由移動**にするか、**半誘導型**にするか
2. 消火栓モデルを **GLB** にするか、**Three.jsプリミティブ**にするか
3. 投稿写真を必須にするか
4. 初回チュートリアルを別画面にするか、オーバーレイにするか
5. スコア固定100点のままにするか、将来ボーナスを入れるか
6. 公開JSON手動更新で始めるか、管理APIまで初期実装するか

---

## 24. 実装着手順（推奨）

1. `game-config.json`, `cats.json`, `hydrants.json` のモック作成
2. S01/S02 のみ先に実装
3. 座標変換関数と 3D空間配置を実装
4. タイマー・移動・接近判定を実装
5. 点検アクションとリザルトを実装
6. localStorage 保存を実装
7. 境界制御・ヒント表示・エラー処理を追加
8. テスト整備

---

## 25. 補足

本開発仕様書は、**MVPを最短で形にするための具体仕様**として作成している。したがって、プレイヤー向け体験の中心である **猫選択 → 3D見回り → 点検 → リザルト** に重点を置き、管理系は最小限の将来拡張前提で定義した。

実装開始時は、まず **公開JSONベースでプレイヤー体験を成立**させ、その後必要に応じて **管理API / DB / 公開バッチ** を追加する段階的進行を推奨する。
