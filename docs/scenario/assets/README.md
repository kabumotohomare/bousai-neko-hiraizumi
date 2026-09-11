# assets

キャラクターイラストの置き場。正本は `character-sheet.png`（ぼうさいネコ キャラデザ、1536×1024）。ほかは全てそこからの切り出し。

| ファイル | 内容 | LP での用途 |
| --- | --- | --- |
| `character-sheet.png` | タキザワ／シラヤマ 2 人格のキャラクターシート全体 | 正本（直接は参照しない） |
| `takizawa-sheet.png` / `shirayama-sheet.png` | シートを左右半分に割ったもの | 人格カードの「CHARACTER SHEET」折りたたみ |
| `takizawa-figure.png` / `shirayama-figure.png` | 正面の全身（縦長） | 人格カードのメインビジュアル |
| `takizawa-face.png` / `shirayama-face.png` | 顔（正方形） | ヒーローの接続パネル、人格→体の結びつき、モック |
| `takizawa-exp1..4.png` | 表情：にっこり／きりっ／びっくり／ねむい | 表情モニター（LINK 中は自動で切り替わる） |
| `shirayama-exp1..4.png` | 表情：にっこり／やさしい／びっくり／すこしむすっ | 表情モニター（ねむりちゅうは手動のみ） |
| `takizawa-walk.png` / `shirayama-walk.png` | ポーズ：あるく | 一周の流れ（S03）、物語の朝 |
| `takizawa-sleep.png` / `shirayama-sleep.png` | ポーズ：ねる | 一周の流れ（ねむり）、モック E |

アプリ側は `public/images/characters/` に顔と寝ポーズだけを置く（`cats.json` の `illustUrl` / `sleepIllustUrl`）。無い場合は写真（`photoUrl`）にフォールバックする。

切り出しは macOS の `sips` で行った（例: `sips -c 280 280 --cropOffset 50 336 character-sheet.png --out takizawa-face.png`）。
