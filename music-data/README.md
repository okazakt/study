# 音楽データと同期

`index.json` はフォルダIDごとの楽曲情報です。`durationSeconds` は秒、`baseBpm` は基本テンポです。

## 曲ごとのアジャスト値

各曲の `index.json` エントリに `timing.chartToAudioOffsetMs` を必ず保持します。今後追加する曲も初期値は0とし、未検証であることを `chartToAudioOffsetStatus` に記録します。音源との同期確認後は補正値と検証状態を更新してください。

- 単位はミリ秒です。正の値は譜面を遅らせ、負の値は早めます。例えば `25` は25ミリ秒遅らせ、`-25` は25ミリ秒早めます。
- `chartToAudioOffsetAppliesTo` は `files` 内の対象キーを列挙します。0001ではJSON譜面（`chart`）とMIDI（`midi`）の両方に同じ補正を1回適用します。MIDIは先にテンポマップを使って秒へ変換します。
- この値は曲全体の一定のズレを調整するものです。途中で変わるズレは譜面のイベント時刻を修正します。
- 譜面JSONへ同じ追加補正を重複保存しません。譜面時刻へ補正を焼き込んだ場合は、インデックスの補正値をリセットまたは再計測します。
- 端末補正はPWAの設定としてユーザー・端末・音声出力ごとに保存します。インデックスの `deviceCalibrationOffsetMs: null` は未計測の説明であり、ユーザー設定の保存先ではありません。

```js
// deviceOffsetMs はPWA設定から取得。正なら判定対象時刻を遅らせる仕様。
const songOffsetMs = track.timing.chartToAudioOffsetMs ?? 0;
const targetAudioTimeSeconds = event.time + (songOffsetMs + deviceOffsetMs) / 1000;
```

補正は判定・表示で一貫した規約を使い、同じ補正を二度適用しないでください。

## 0001: Fallin For You / Flehmann

PWAのタップ判定にはJSONの `events[].time`（秒）を推奨します。MIDIも利用できますが、テンポマップとtickから秒への変換が必要です。両形式の605イベントの音符番号は一致し、時刻差は最大0.52ミリ秒です。MIDIは480 ticks/四分音符、120 BPMなので1 tickは約1.041667ミリ秒で、この差は丸めの範囲です。

譜面JSONはMP3先頭を基準とする時刻を保持しています。`offsetSeconds: 0.11733`（117.33ミリ秒）は拍グリッドの開始位置で、各イベントの時刻に既に含まれます。`syncCorrectionMs` も適用済みです。いずれも再加算しないでください。

追加のファイル補正は `timing.chartToAudioOffsetMs` で保持します。正なら譜面を遅らせます。

```js
const targetAudioTimeSeconds = event.time + track.timing.chartToAudioOffsetMs / 1000;
```

現状の0ミリ秒は、譜面の時間基準の記述に基づく暫定値です。MIDIとJSONの一致は確認しましたが、音声の拍と譜面の一致を独立に測定した結果ではありません。JSONに元からある拍検出誤差（中央値7.23ミリ秒、最大37.65ミリ秒）も、今回再測定した値ではありません。MP3は48 kHz、開始時刻0秒、長さ233.0672秒でした。

MP3を再生し、その再生位置を唯一の時間基準としてイベントを処理してください。MIDIやJavaScriptのタイマーを別々に起動する方式は避けます。HTMLAudioElementなら `currentTime` を参照し、Web Audioなら音源の開始時刻と同じAudioContextの時計でスケジュールします。MIDIはタップイベントの入力データとして扱い、音声再生は不要です。

端末・音声出力・Bluetooth・入力・描画による遅延はファイルだけでは確定できません。`deviceCalibrationOffsetMs` は未計測のためnullです。PWAで実際にタップして調整し、端末と音声出力ごとに保存する想定です。音源補正と端末補正を重複適用しないようにしてください。


## 0002: American Western Country / The_Mountain

ユーザー提供のMP3・JSON・MIDIを原本のまま格納しています。MP3は44.1kHz、開始時刻0秒、長さ138.788563秒（ffprobe）。JSONは420イベントで、主拍211件（beat 158、accent 53）、offbeat 205、fill 4です。基本テンポは95.703 BPMですが、実行時に一定BPMから再計算せず、音源先頭基準のevents[].timeをそのまま使います。

`beatPosition` はありません。PWAはtypeがbeatまたはaccentのイベントを主拍として選択します。offbeatとfillは現在の難易度では使用しません。譜面メタデータには小節位相が推定値である旨の記載があります。追加補正は暫定0ms。音声との独立した同期測定・MIDIとJSONの一致検証は未実施であり、検証済みとは扱いません。

PWAの暫定プレイリストは0001→0002。曲ごとの秒を「先行曲のdurationSeconds合計 + 現在曲のaudio.currentTime」へ変換し、問題・得点・回答進捗を継続します。曲の追加補正は各曲のイベントに一度、端末補正は全イベントに一度加えます。JSONやMIDIの原本へ補正を焼き込みません。
