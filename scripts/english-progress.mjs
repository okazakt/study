// Editorial targets are provisional; this is not a percentage of curriculum mastery.
import {readFileSync,writeFileSync} from 'node:fs';
import {makeQuestionQueue} from '../game.js';
const read=file=>JSON.parse(readFileSync(new URL(`../quiz-data/${file}.json`,import.meta.url)));
const items=[...read('junior_english'),...read('junior_expansion').filter(q=>q.subject==='英語'),...read('junior_english_core'),...read('junior_english_extended')];
const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).version;
const targets=[['英単語',2200,2500],['熟語',150,300],['英文法',120,240],['英文読解',30,60]];
const lines=['# 英語の完成に向けた進捗','',`v${version}時点。\`node scripts/english-progress.mjs\` で収録数を再生成する。**英語全体の網羅・2026年版教科書への対応は未完了。**`,'','## 現在の実数と数量の仮置き','','数量目標は前回の規模見積もりを作業用に分けたもの。公式な語彙リストでも、これに届けば必ず網羅できるという基準でもない。単語は小学校の復習語を含み、多義語・全出版社の差分で増減する。','','| 分類 | 現在の素材 | 生成問題数 | 数量目標の仮置き | 追加量の仮置き |','| --- | ---: | ---: | ---: | ---: |'];
for(const [field,min,max] of targets){const rows=items.filter(q=>q.field===field);lines.push(`| ${field} | ${rows.length} | ${makeQuestionQueue(rows,()=>.5).length} | ${min}〜${max} | ${Math.max(0,min-rows.length)}〜${Math.max(0,max-rows.length)} |`);}
lines.push('',`合計：${items.length}素材、${makeQuestionQueue(items,()=>.5).length}生成問題。`,'','第1回は621素材、第2回は単語581・熟語64の645素材を追加。第2回は中学の文章・会話で使う語、社会・科学・環境、行動・抽象語と頻出表現を優先。配当学年は暫定で、入試向けの発展語も含む。既存の素材IDと学習履歴は維持する。','','## 学年・単元ごとの収録','','配当学年は暫定の共通知識分類。2026年版教科書の掲載順や学年を保証しない。件数は独立した必須知識の数と同一ではない。','','| 学年 | 分類 | 単元 | 素材数 |','| --- | --- | --- | ---: |');
for(const grade of ['中1','中2','中3'])for(const [field] of targets){
 const rows=items.filter(q=>q.grade===grade&&q.field===field);
 for(const unit of [...new Set(rows.map(q=>q.unit))])lines.push(`| ${grade} | ${field} | ${unit} | ${rows.filter(q=>q.unit===unit).length} |`);
}
lines.push('','## 内容ごとの完了条件と残作業','','| 対象 | 現在 | 残る作業 |','| --- | --- | --- |',
'| 単語 | 家族・学校・生活・自然・基本動詞から社会・科学までの共通語彙を拡充 | 中学の新出語彙の候補一覧を確定し、未収録語・多義語・品詞・不規則な活用を追加。既存語の別の意味を単純複製しない |',
'| 熟語 | 日常動作・状態・位置・時・数量等を拡充。重要な1語を対象とする穴埋めも追加 | 頻出表現をさらに追加し、同義表現・複数の前置詞が正しくなるケースを継続点検 |',
'| 文法 | 基本文、疑問・否定、名詞・代名詞、時制、助動詞、不定詞・動名詞、比較、接続、完了、受け身、分詞・関係詞、間接疑問、仮定法、感嘆・文型等を収録 | 基本文法の細かな項目台帳との対応付け、抜けと重複の整理、同じポイントの別文脈パターン、不規則変化や語形・語順の適用例を充足 |',
'| 読解 | 指示語、時系列、理由、条件、否定の範囲、逆接、案内文、会話応答の短い適用例を追加 | 比較、主張と例、必要情報、言い換え、条件・数量の読み違いなどを追加。長文総合問題は通常プレイの対象外 |',
'| 表現パターン管理 | 英語の汎用的な内部バリエーション管理は未実装 | 同じ学習ポイントを複数の文脈で練習し、履歴と出題数を共通化する |',
'| 教科書対応 | 未収録 | 2026年版6種×3学年の書誌・単元・掲載語彙を実資料で照合し、対応表と単元選択へ反映。推測で対応済みにしない |',
'','## 作問と検証の方針','','- 語彙は意味の混同が起きにくい同分野の候補を編集し、new/fresh、cold/cool、learn/studyなどの重なる意味を相互の誤答にしない。多義語は今回問う意味を限定する。',
'- 語彙・熟語は両方向を生成し、単語の綴りは同じ文字数の候補に限定。熟語は文字分割をせず、意味が一意になる重要語・前置詞を選ぶ。',
'- 間違いなく文法的に正しい別解を誤答にしない。例えばCan I/May I、who/that、whether/if、covered with/in等の別表現に注意する。',
'- コンテンツ追加時は各問題の4択・綴り・文字量・履歴・出題フィルタを検証。5分プレイ全体の検証は進行処理・時間配分などを変更する場合に実施。自動テストは言語内容をすべて保証するものではなく、候補の文脈への代入と内容点検も行う。',
'- [文部科学省・外国語編](https://www.mext.go.jp/content/20210531-mxt_kyoiku01-100002608_010.pdf)を範囲の参照にする。問題文・候補・解説は独自に編集。掲載問題や教科書本文の転載、教科書準拠の未確認な表示は行わない。',
'','## 次に進める順序','','1. 中学新出語を優先して次の語彙群を追加し、今回の復習中心の語彙との偏りを補う。','2. 頻出熟語と不規則変化・基本構文の不足を充足する。','3. 文法・読解の同一ポイントに複数の適用文を用意する。','4. 教科書資料の照合と単元対応を並行して進め、確認できた範囲を反映する。','');
writeFileSync(new URL('../docs/content/english-progress.md',import.meta.url),lines.join('\n'));
console.log(`English inventory: ${items.length} materials, ${makeQuestionQueue(items,()=>.5).length} questions`);
