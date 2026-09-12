# 平泉・街並みテクスチャ制作支援

ゲーム本体（ぼうさいネコ＠平泉）とは分離した制作支援 Web アプリです。

## 起動

```bash
cd tools/texture-studio
pnpm install
pnpm dev
```

ブラウザで http://localhost:5174 を開きます（Chrome / Edge 推奨。フォルダ保存は File System Access API）。

## 作業の流れ

1. プロジェクトを新規作成する
2. ゲームの `public/data/buildings.json` を取り込む（ゲーム側ファイルは上書きしない）
3. 地図で建物をクリックし、撮影対象に登録する
4. 面（face_id）を追加し、現地写真を紐付ける
5. 加工画面で領域抽出（自動＋ブラシ）、パース（垂直検出＋四隅）、明度・彩度・コントラストを調整する
6. 500×500 PNG8 を書き出す（失敗時は PNG32）
7. zip を保存し、Google Drive 等へは手動で渡す

## プロジェクトフォルダ

- `project.json`
- `catalog/buildings.game.json`（読取専用スナップショット）
- `catalog/buildings.overlay.json`（OSM / 撮影状態 / 面）
- `photos/raw` `photos/work` `photos/export`
- `blender/faces.json`

`building_id` はゲーム JSON の `id` と同一です。面 ID はポリゴン番号を使いません。

## Blender（後半機能）

`blender/addon/hiraizumi_texture_link.py` を Blender にインストールします。

オブジェクトにカスタムプロパティ `building_id` / `face_id` を付け、`faces.json` を書き出して本アプリへ読み込みます。書き出し PNG フォルダからファイル名でテクスチャを割り当てます。UV は cube project のあと `uv_offset_*` 等で調整します。
