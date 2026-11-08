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
- 公式例の字と辞書側の字の違い、促音化、語尾の分割、例語なし等の25件は `reading-review.json` に初期の個別確認を記録。最終の採用例語はTSVを正とする。𠮟は公式字形を維持。弥生・朕など例語の補足も同記録で追跡する。
- 複数の読みがある語は、今回選ばなかった既知の読みを `reading-review.json` に記録して誤答から排除する。ただし全ての固有名詞・辞書未収録の読みまで保証するとはしない。
- 次回の語彙更新時は公開最新版で読み・別読を再照合し、版と変更内容を記録する。辞書検索サービスや原辞書のミラーではなく、特定日の独自学習問題集として提供する。
- アプリのホーム最下部「漢字データの出典」からクレジット・ライセンス画面へ移動できる。

## 編集・再生成

- `grammar-additions.tsv`：用語・穴埋めの正答と、それぞれ独立した誤答候補。
- `choice-additions.tsv`：一方向の適用・読解・古典知識。正解をテーマに印字しない。
- `idiom-additions.tsv`：慣用句40・四字熟語40。類似しすぎる組合せは生成スクリプトの除外対で排除する。両方向の候補は同じ意味の対応を使う。
- `kanji-readings.tsv`：第1段階の読み1,094素材（v0.67.0ではうち59素材に書きを追加）。既存問題のIDは `kanji-reading-map.json` に登録し、重複追加しない。読み専用素材は `writing_parts: []` とし、漢字書きフィルタの対象にしない。
- `python3 scripts/build-japanese-content.py` でこの2つの問題JSONを再生成できる。
- `node scripts/japanese-progress.mjs` で字種の欠落と国語の収録状況を集計する。全音訓・部品選択・手書き・長文記述は別の充足項目として管理する。

## 表示確認の再利用

文字数は従来の編集上限内。高さ推定330pxを超えた表示は136件で、長い本文・選択肢・合計文字量・2列／4列の境界を代表する7例だけを320/390×844・通常/学習集中で確認（28表示）。横あふれ、問題パネル内の縦あふれ、選択肢内のあふれはなし。実測最大パネル高416px。文字サイズやCSSは変更していない。

`layout-review.json` に例と計測結果を保存し、`content-budget.json` の `japanese-core-text-20261107` に条件を登録。国語・文字のみ・各項目/合計が今回の最大値以内・推定390px以内の場合だけ、高さ330pxの再確認を不要にする。図・画像・新しい表・実装変更・この文字量範囲外は従来どおり確認対象。他教科の上限を一律に広げない。

同じ語・同じ読みの素材を重複登録しない。別の公式例語を選べる字は別語にし、憬→既存の憧憬、挨・拶→挨拶、沙・汰→沙汰、瑠・璃→浄瑠璃は一つの問題で対応する。新規問題の `coverage_characters` と字種対応表で追跡し、字種数と素材数を区別する。

## 漢字書きと適用の第2段階（v0.67.0）

- `writing-additions.tsv` は282字。小学配当223字は新規素材、既存の小学以外59字は元の読みIDへ書きを追加する。独体字を無理に分解せず、左右の構成を確認できたものを採用した。例文に正答字を出さない。
- `writing_word`／`writing_reading`／`writing_note` が、読み用の語・読み・解説と異なる場合を扱う。前からある読み問題の内容・IDは変更しない。
- `writing-glyph-groups.json` は字形が似た候補と、互いを誤答にしない互換形を保持。全体の正答字を候補へ出さない。部品の位置と候補は独自編集し、字形構成の補助照合に [cjkvi-ids](https://github.com/cjkvi/cjkvi-ids) を参照。元のIDSデータ／描画コードはアプリへ同梱していない。現代日本の字体と異なる旧字体構成などは除外・修正した。
- `writing-reading-review.json` は今回の例語の読み・別読をJMdict/JmdictFuriganaで照合した記録。読みを加工した `writing-additions.tsv` と追加した漢字素材（`junior_japanese_extended.json` の `kind: kanji` を含む）は、上記の著作権表示を保持してCC BY-SA 4.0で提供する。他の独自の文法・解説データ全体に同じライセンスを拡大しない。
- `application-additions.tsv` は文法43・古文20・漢文10。`idiom-additions.tsv` のことわざ20件は両方向。意味が同じことわざは互いを誤答にせず、長い説明は表示確認後に短縮した。
- 新規／変更分だけの簡易データ確認は [差分記録](writing-change-audit.json)。基礎テスト・全問表示・5分進行は実施しない。新しい部品構成・境界8例の32表示、正答表示4件と復習の途中／完成を確認。結果は [表示記録](writing-layout-review.json)、再利用条件は `content-budget.json` の構造プロファイルと長い熟語見出しの規則に保持する。

## 中学に限定した第3段階（v0.68.0）

- 小学漢字の追加を停止する。`elementary-grades.json` は文科省の音訓割り振り表から小学配当の学年を抽出した事実データ。既存235素材を小学へ分類して保管し、中学の出題・進捗には含めない。元のID・読み・書き・履歴は維持する。小学のUIはまだ作成しない。
- `secondary-writing-additions.tsv` は小学配当を除いた1,110字から選んだ300字。全て既存の読みIDへ書きを追加する。`secondary-writing-reading-review.json` に語の読みと別読の照合を記録。新しい例語の読みも上記JMdict/JmdictFuriganaのクレジット・CC BY-SA 4.0で扱う。左右の字形構成は補助資料でも照合し、既存の `lr-parts-v1` 範囲内。新しい表示構成や文字量の超過はなく、基本テスト・画面の再確認・5分進行は行わない。
- 今回の追加は `--batch japanese-secondary-writing-20261107` で差分だけチェックする。小学用の旧TSVは再生成で保管分を復元するために残し、行を増やさない。小学配当字を今回の中学TSVへ入れると生成時にエラーにする。
- [今回の確認記録](secondary-writing-audit.json)・[現在の対象と残件](../japanese-progress.md)。

## 中学書き第4段階（v0.69.0）

`secondary-writing-2.tsv` に252字を追加。中学書き621/1,110字、残り489字。日本の字形を優先し、精密な字形素材が必要な僅・敷は `writing-deferred.json` で書きのみ保留する。読みと履歴は削除しない。修正5字は `writing-shape-revisions.json` のrevisionを生成した書きID末尾へ付ける。復帰時にも旧構成の履歴を混同しないrevisionを設定する。

小学の保管分は変更しない。新規分は `--batch japanese-secondary-writing-2-20261107` で簡易確認できる。既存の確認済み左右2/3部品構成内。辞書読みの記録は `secondary-writing-2-reading-review.json`、差分集計は `secondary-writing-2-audit.json`。同等字形は `writing-glyph-groups.json` の全体／字別の同等形から誤答候補を除外する。

## 上下構成の漢字書き（v0.70.0）

`vertical-writing.tsv` の153字は中学の既存読み素材へ書きのみ追加する。上下の2部品を順に回答。日本の字形はCJKVI/CHISEの構成情報と照合し、参考資料の原データは同梱しない。語と読み153組はJmdictFuriganaで確認（既存の出典・ライセンス表示を適用）。読みの内容とIDは変更しない。書きの語を変える場合も元の読みへ影響させない。

専用の `vertical-glyph-groups.json` は既存の候補を変えず、新規の上下問題だけに使う。`vertical-writing-reading-review.json`・`vertical-writing-audit.json` に確認を記録。差分確認は `--batch japanese-vertical-writing-20261107`。`tb-parts-v1` は上40/50%、下残り、幅100%の2部品と既存の文字量条件に限定。範囲内は再表示確認不要。中学書き774/1,110字、残り336字。小学分は追加・変更しない。

## 複合構成の漢字書き（v0.71.0）

`compound-writing.tsv` の67字を既存の中学読みIDへ追加。2〜4部品を順に全て問う。上下3段・左右3列・片側分割の6配置は `compound-writing-layouts.json` の固定位置を使用する。選択肢は専用 `compound-glyph-groups.json` と既存グループから選び、古い素材の候補を変更しない。小学分は変更しない。

書きは841/1,110字、残り269字は `japanese-progress.json` の `writing.secondaryMissing`。囲みや独体字を不正確な分割で埋めず、専用の表示・出題方法を整えてから追加する。作問時は日本の字形と、辞書の語・読みを照合する。原資料のIDS全体は同梱せず、採用した事実上の構成と独自文脈を保持する。従来の辞書データ出典・ライセンス表示を適用。

`compound-writing-reading-review.json`・`compound-writing-audit.json` に照合を記録。新配置の確認は `compound-writing-layout-review.json`。差分確認は `--batch japanese-compound-writing-20261107`。確認済み配置・文字量の範囲内なら表示確認は繰り返さない。

## 国語の適用問題81問（v0.72.0）

`language-practice-additions.tsv` の現代文法43・古文19・漢文19は、既存のchoice形式で一方向に出題する独自の短い例題。既存素材・ID・小学保管分は変更しない。語句の定義をそのまま聞く形式だけでなく、用例の品詞・活用・文脈や、訓読・句法・漢詩の見方を確認する。

反語は否定疑問から肯定を強める例も含むため「常に否定へ訳す」と教えない。現代の「れる」「そうだ」は意味が特定できる文脈を添える。長文読解や論述の代替とはしない。中学の共通分類で、漢文の再読文字等には補足・発展事項も含む。全項目が必修という表記はしない。

差分は `--batch japanese-language-practice-20261107` で確認。既存の文字のみ構成の範囲内なので再表示確認は不要。[確認記録](language-practice-audit.json)。

## 漢字の完成字選択（v0.73.0）

`whole-writing-additions.json` は、長方形の部品配置で表しにくい字の完成字選択。初回50字を既存の読みIDへ追加する。`writing_format: whole` と `writing_dummies` の4候補、`writing_distractor_groups` のb2/c1/d1を保存する。bは正解と字形が似る2字、cは読み・意味で混同する1字、dはcに字形が似る1字。作問元には分類理由も残す。

問題生成は従来の候補シャッフル→3つ抽出を使用し、必ず正解＋ダミー3つの4択。モードは書きの `kanji_component` を再利用するが、IDは `:kanji_whole` とし、旧部品問題の履歴と混ぜない。読み問題は不変。部品図を出さず、□を含む語と読みを表示し、正解後に完成させる。

例文と表示済みの字に正解・ダミーを漏らさず、文脈で別の正答になる字も候補にしない。候補には寅・碗等の身近な常用外の字を含む場合があるが、中学の正答字種の対応数へは加えない。書き選択891/1,110字、残り219字。小学分・元の読み・過去の回答履歴は維持する。

差分確認は `--batch japanese-whole-writing-20261108`。新しい完成字表示は代表確認済み。本文24字・語3字・読み6字と横幅式250px以内、1文字のBMP漢字4択という条件内では再表示確認不要。新しい補助画像・配置・範囲外の字形は確認対象。

## 完成字選択の第2追加（v0.74.0）

`whole-writing-additions.json` に100字を追加し、今回分へ `content_batch: japanese-whole-writing-2-20261108` を付ける。ビルダーは従来50字のbatchを維持し、今回のbatchのみを `writing_batch` に反映する。差分確認は同じbatchで実行する。書き選択は991/1,110字、残り119字。

b2/c1/d1の保存4候補から3つ選ぶ4択を維持。例文・読み・熟語の見えている字を合わせて確認し、候補がそのまま本文へ出る場合は書き用の語や文脈を調整する。舟／船のような別の正答を混ぜない。既存の読み問題・部品選択・完成字50字・小学保管分を変更しない。

今回100素材は確認済みの完成字レイアウト内。データ・ID・4候補・文字量だけ確認し、画面・全体テスト・5分進行は繰り返さない。語と読み・文脈上の正答、候補の方向は作問時に確認。[差分記録](whole-writing-2-audit.json)。
