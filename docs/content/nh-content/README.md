# 公開Word List対応用の編集入力

v0.64.0から `quiz-data/junior_english_new_horizon.json` に独自の語彙・語形問題を収録。本文Word List全1,789行の対応先を `row-material-map.json` に保持する。母数は公開一覧と備考の区別であり、教科書本文の全用法・全技能ではない。

- `vocabulary-groups.json`：新規語彙の共通単元・暫定学年・比較する候補群。数値の行番号は公式Excelの行。類義語を機械的に誤答へ展開しない。
- `primary-contexts.tsv`：新規語の代表的な一義と短い独自例文。同じ概念の言い換えと別義を分ける。
- `meaning-contexts.tsv`：既存語の別義。最終列の`meaningKey`は固定し、挿入や並べ替えで変えない。
- `new-secondary-meanings.tsv`：新規語の別義。同じく最終列が固定キー。
- `function-questions.tsv`／`abbreviation-questions.tsv`：機能語・略語の短い問題と明示的な誤答。

`python3 scripts/build-new-horizon-content.py`でこのバンクと行別対応先だけを再生成。旧問題ファイルを上書きしない。素材IDはExcel行＋固定の意味キー。異なる意味に既存キーを使い回さず、別キーを作る。意味・文脈・候補の言語的な正しさは編集時に確認する。

`node scripts/check-content-budget.mjs --file quiz-data/junior_english_new_horizon.json --batch <追加バッチ>` で追加分だけを確認し、`node scripts/new-horizon-coverage.mjs`で出題先の欠落・重複ID・素材ハッシュを確認する。以後の通常追加で毎回テストスイートや5分シミュレーションを実施しない。

歴史的な `new-horizon-main-review.json` と `nh-review/` はv0.63.0の精査時点の分類を保持する。追加済みの現況は最新の行別対応表と `new-horizon-coverage.json` を使う。原本の変更時はハッシュ・版・行の再照合が必要。
