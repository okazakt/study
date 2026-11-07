# 中学国語の出典・作問元（2026-11-07）

## 対応母数

- [文科省・中学校学習指導要領解説 国語編（平成29年告示）](https://www.mext.go.jp/component/a_menu/education/micro_detail/__icsFiles/afieldfile/2019/03/18/1387018_002.pdf)：現行の知識・技能、読む・書く・話す／聞くの各事項を参照。小学校1,026字以外の常用漢字1,110字を読みの字種母数とする。「大体を読む」という規定を、安全側で全字種の出題先登録として管理する。全音訓を一度ずつ収録したという意味ではない。
- [文化庁・常用漢字表の音訓索引](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/joyokanjisakuin/)：本表2,136字と音訓・例語をHTML表から独自に抽出。事実データを `joyo-scope.json` に保持。
- [文科省・音訓の小・中・高等学校段階別割り振り表（平成29年3月）](https://www.mext.go.jp/a_menu/shotou/new-cs/__icsFiles/afieldfile/2017/05/15/1385768.pdf)：小学配当の数字を持つ字を独立抽出したところ1,026字。`joyo-scope.json` の小学集合と完全一致。差集合1,110字を確定した。
- 初期抽出の補助として [OtterSou・常用漢字表JSON](https://gist.github.com/OtterSou/0b5b72094e53f6cd321e393c157dcec1) を参照したが、字種・音訓・例語と小学集合は上記公式資料で照合。中1／中2／中3は公式の固定配当ではなく共通分類の暫定配置。教科書準拠とはしない。

## 読みの照合・ライセンス

例語の全体の読み・別の読みは、[JmdictFurigana](https://github.com/Doublevil/JmdictFurigana) の公開版 `2.3.1+2026-10-25`（2026-11-07取得）で照合した。JmdictFurigana is maintained by Doublevil and contributors and is based on JMdict. JMdict/EDICT copyright belongs to **James William Breen and the Electronic Dictionary Research and Development Group (EDRDG)**. 使用・加工した読みデータおよびそこから作った `kanji-readings.tsv` / `junior_japanese_kanji.json` は [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/) で提供する。

- [JMdictの説明](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project)・[EDRDGの利用条件](https://www.edrdg.org/edrdg/licence.html)・[JmdictFuriganaの説明とライセンス](https://github.com/Doublevil/JmdictFurigana#licence)。原資料の著作権表示を維持する。アプリや独自の国語解説全体のライセンス変更を意味しない。
- 加工内容：文化庁の例語から短い語を選択し、語の読みを照合。読み間違い候補を独自に作成し、辞書にある同じ語の全読みを誤答候補から除外。表示指示・ID・学年・選択肢・解説を付与。原辞書の全文は同梱しない。
- 公式例の字と辞書側の字の違い、促音化、語尾の分割、例語なし等の25件は `reading-review.json` に個別選択を記録。𠮟は公式字形を維持。弥生・朕など例語の補足も同記録で追跡する。
- 複数の読みがある語は、今回選ばなかった既知の読みを `reading-review.json` に記録して誤答から排除する。ただし全ての固有名詞・辞書未収録の読みまで保証するとはしない。
- 次回の語彙更新時は公開最新版で読み・別読を再照合し、版と変更内容を記録する。辞書検索サービスや原辞書のミラーではなく、特定日の独自学習問題集として提供する。
- アプリのホーム最下部「漢字データの出典」からクレジット・ライセンス画面へ移動できる。

## 編集・再生成

- `grammar-additions.tsv`：用語・穴埋めの正答と、それぞれ独立した誤答候補。
- `choice-additions.tsv`：一方向の適用・読解・古典知識。正解をテーマに印字しない。
- `idiom-additions.tsv`：慣用句40・四字熟語40。類似しすぎる組合せは生成スクリプトの除外対で排除する。両方向の候補は同じ意味の対応を使う。
- `kanji-readings.tsv`：今回追加の読み専用1,098素材。既存12字のIDは `kanji-reading-map.json` に登録し、重複追加しない。読み専用素材は `writing_parts: []` とし、漢字書きフィルタの対象にしない。
- `python3 scripts/build-japanese-content.py` でこの2つの問題JSONを再生成できる。
- `node scripts/japanese-progress.mjs` で字種の欠落と国語の収録状況を集計する。全音訓・部品選択・手書き・長文記述は別の充足項目として管理する。

## 表示確認の再利用

文字数は従来の編集上限内。高さ推定330pxを超えた表示は136件で、長い本文・選択肢・合計文字量・2列／4列の境界を代表する7例だけを320/390×844・通常/学習集中で確認（28表示）。横あふれ、問題パネル内の縦あふれ、選択肢内のあふれはなし。実測最大パネル高416px。文字サイズやCSSは変更していない。

`layout-review.json` に例と計測結果を保存し、`content-budget.json` の `japanese-core-text-20261107` に条件を登録。国語・文字のみ・各項目/合計が今回の最大値以内・推定390px以内の場合だけ、高さ330pxの再確認を不要にする。図・画像・新しい表・実装変更・この文字量範囲外は従来どおり確認対象。他教科の上限を一律に広げない。
