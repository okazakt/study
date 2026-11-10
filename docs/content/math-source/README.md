# 数学の連続解法：作問・管理

2026-11-10 / v0.90.0。連続解法を補強済み。公式の23区分で残作業を整理し、小項目の最終照合は次段階。

- `sequences.tsv`：学年・分野・単元・生成器ID・管理用タイトル。生成器本体は `math-sequences.js`。数値の許容範囲と各段階の式・四択・短い解説を保持。
- `individual-choices.tsv`：連続化に向かない個別の判断問題。
- `node scripts/build-math-sequences.mjs`：当バッチのみ再生成。既存素材は維持する。
- `node scripts/report-math-sequences.mjs --export /tmp/math-variants.json`：実数・段階・技法を更新し、有限パラメータの全表示例を出力できる。
- `python scripts/check-math-sequence-algebra.py /tmp/math-variants.json`：SymPyによる独立した出題条件からの等価性確認。アプリにはSymPyを使わない。
- `node scripts/check-content-budget.mjs --file quiz-data/junior_math.json --batch math-sequences-20261110`：新規分の文字量・四択と構成。連続問題は全有限パターンを対象にする。

段階を飛ばして次の解を先に見せない。一連の値は一度だけ選び、途中・誤答・復習で固定する。正しい別解をダミーにしない。誤答候補どうしも等価にならないようにし、ゼロ除算等が起こる値は許容しない。数値違いは出題済み母数へ追加せず、段階別の正誤を安定キーで保持する。

新しい生成方式・進行ロジックを変更したときだけ必要な数式・継続・履歴等の確認を行う。同じ形式へのJSON追加では、新規分の必須項目・ID・四択・文脈・文字量を基本とし、全体テストや5分検証を繰り返さない。

数式はUnicodeの文字列で扱い、画像や特殊な数式描画は使わない。長い数式の四択は2列にする。代表表示と上限は [表示記録](layout-review.json) と [予算](../content-budget.json) へ保存。

## v0.90.0：連続解法の補強

`advanced-sequences.tsv` 24連続素材・55段階、`advanced-choices.tsv` 40個別問題。バッチ `math-advanced-20261110`。再生成スクリプトは2バッチを管理し、元素材と過去バッチの内容・IDを保持する。新規147数値パターン・361段階の正答と候補を独立に照合し、既存の表示範囲内に短縮した。進行・採点・保存・表示の仕組み自体は変更しない。

新規分の文字量は `node scripts/check-content-budget.mjs --file quiz-data/junior_math.json --batch math-advanced-20261110` で確認。全体テスト・5分検証・ブラウザ再確認は行わない。

文科省数学編付録3の大分類は `curriculum-outline.tsv/json` と [残作業表](../math-curriculum-plan.md) で管理。これは小項目の最終照合表ではない。学年別の下位項目・取扱い・数学的活動の着眼点を照合してから完了を判断する。
