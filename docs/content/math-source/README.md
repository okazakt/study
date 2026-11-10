# 数学の連続解法：作問・管理

2026-11-10 / v0.89.0。新方式の第1弾。公式小項目の最終照合は今後実施する。

- `sequences.tsv`：学年・分野・単元・生成器ID・管理用タイトル。生成器本体は `math-sequences.js`。数値の許容範囲と各段階の式・四択・短い解説を保持。
- `individual-choices.tsv`：連続化に向かない個別の判断問題。
- `node scripts/build-math-sequences.mjs`：当バッチのみ再生成。既存素材は維持する。
- `node scripts/report-math-sequences.mjs --export /tmp/math-variants.json`：実数・段階・技法を更新し、有限パラメータの全表示例を出力できる。
- `python scripts/check-math-sequence-algebra.py /tmp/math-variants.json`：SymPyによる独立した出題条件からの等価性確認。アプリにはSymPyを使わない。
- `node scripts/check-content-budget.mjs --file quiz-data/junior_math.json --batch math-sequences-20261110`：新規分の文字量・四択と構成。連続問題は全有限パターンを対象にする。

段階を飛ばして次の解を先に見せない。一連の値は一度だけ選び、途中・誤答・復習で固定する。正しい別解をダミーにしない。誤答候補どうしも等価にならないようにし、ゼロ除算等が起こる値は許容しない。数値違いは出題済み母数へ追加せず、段階別の正誤を安定キーで保持する。

新しい生成方式・進行ロジックを変更したときだけ必要な数式・継続・履歴等の確認を行う。同じ形式へのJSON追加では、新規分の必須項目・ID・四択・文脈・文字量を基本とし、全体テストや5分検証を繰り返さない。

数式はUnicodeの文字列で扱い、画像や特殊な数式描画は使わない。長い数式の四択は2列にする。代表表示と上限は [表示記録](layout-review.json) と [予算](../content-budget.json) へ保存。
