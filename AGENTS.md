# リポジトリの作業ルール

## PWAの仕様

PWAの実装・変更前に必ず [docs/pwa-spec.md](docs/pwa-spec.md) を読み、仕様に従ってください。未決定事項は確定済みとして扱わず、決定・変更した仕様は同ファイルへ反映してください。

## 公開バージョン

アプリを公開更新する際は `package.json` の `version` を更新し、`index.html` のトップ画面のバージョン表示と `sw.js` のキャッシュ名（`study-beat-v<version>`）を同じ値に揃えてください。`version.json`の`version`も更新してください。仕様書のバージョン説明も更新してください。`app.js`と`sw.js`の`VERSION`、`index.html`のCSS・JS URL、`app.js`のgame.js importの`?v=`も同じ値に揃えてください。

## 音楽データの管理

`music-data/` の楽曲追加・変更・同期調整を行う際は、作業前に必ず [music-data/README.md](music-data/README.md) を読み、その管理ルールに従ってください。

- 楽曲ファイルは `music-data/<楽曲ID>/` に格納し、楽曲情報は `music-data/index.json` に登録します。楽曲IDは `0001` のように先頭の0を保持する文字列として扱います。
- 曲ごとの追加補正はインデックスの `timing.chartToAudioOffsetMs` にミリ秒単位で保持します。譜面へ適用済みの補正を重複適用しないでください。
- 音源との同期検証とMIDI・JSON間の一致確認を区別し、未検証の値を検証済みと記録しないでください。
- 端末依存の補正はPWAのユーザー設定として別途保存する設計です。
