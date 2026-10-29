# 音楽データと同期

`index.json` はフォルダIDごとの楽曲情報です。`durationSeconds` は秒、`baseBpm` は基本テンポです。

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
