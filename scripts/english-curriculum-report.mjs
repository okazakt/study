// Report audited scope, never derive curriculum completion from material counts.
import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const curriculum=read('docs/content/english-curriculum-audit.json'),textbooks=read('textbook-data/english-2026.json'),audit=read('docs/content/english-textbook-audit.json');
const labels={has_examples:'代表問あり',partial:'一部支援',not_implemented:'未実装'};
const lines=['# 中学英語：指導要領・2026年度教科書の照合','','確認日：'+textbooks.checkedAt+'。数量目標の達成を必修範囲の網羅としない。**本アプリは暗記と短い判断の補助であり、英語科全体の学習・技能評価を代替しない。**','','## 一次資料','','- [文部科学省：平成29年告示・中学校学習指導要領 外国語編](https://www.mext.go.jp/content/20210531-mxt_kyoiku01-100002608_010.pdf)','- [文部科学省：令和8年度使用 中学校教科書目録](https://www.mext.go.jp/content/20250415-mxt_kyokasyo02-000041714_2.pdf)','- [東京書籍：令和7年度版 NEW HORIZON 掲載語彙データ](https://ten.tokyo-shoseki.co.jp/text/chu/eigo/download/)','- [教育出版：単語・連語データベース（2026年3月更新）](https://www.kyoiku-shuppan.co.jp/textbook/chuu/eigo/document/ducu3/docu304/index.html)','- [教育出版：令和7年度版 年間指導計画](https://www.kyoiku-shuppan.co.jp/textbook/chuu/eigo/document/ducu1/r7plan.html)','- [光村図書：単元系統一覧等](https://www.mitsumura-tosho.co.jp/kyokasho/c-eigo/shiryo)','- [啓林館：令和7年度版カリキュラム作成資料](https://www.shinko-keirin.co.jp/keirinkan/chu_r7/english/curriculum.html)','','取得元URL・ファイルのSHA-256・確認日は [対応データ](../../textbook-data/english-2026.json) に記録。原本はアプリに同梱せず、本文・訳文・音声・既存問題を転載しない。出題と解説は独自素材を使う。','','## 指導要領との照合','','指導要領は語数の目安、文・文構造・文法、音声や技能等を示している。語数だけから特定の単語集合の収録を証明できないため、語彙は各社資料との別照合とする。','','60観点を確認。代表問ありは、根拠IDをもつ問題が存在するという意味であり、全用法・文脈・技能の達成ではない。照合で見つけた文構造・比較・分詞・符号等の薄い箇所に18ポイント（各2例）を補充した。全項目と根拠IDは [指導要領照合台帳](english-curriculum-audit.json)。','','| 観点 | 指導要領の位置 | 現状 | 代表素材ID | 残る確認・支援範囲 |','| --- | --- | --- | --- | --- |'];
for(const row of curriculum.criteria)lines.push(`| ${row.label} | ${row.reference} | ${labels[row.status]} | ${row.evidenceIds.join('、') || '—'} | ${row.remaining} |`);
lines.push('','## 2026年度に使用する教科書','','使用年度2026と、教科書の版である2025（令和7年度版）を分離。目録の6シリーズ×3学年・18冊を登録。書名を登録しただけでは対応済みとしない。出版社の監修・公認を意味しない。','','| シリーズ | 確認資料と現在の対応 | 未完了 |','| --- | --- | --- |',
'| NEW HORIZON／東京書籍 | 公開語彙一覧を綴りで照合 | 取得済みExcelには単元・初出ページがないため単元未対応。公式の[Unit別追加教材](https://nh21.tokyo-shoseki.co.jp/crossword)を新たに確認したが、対応表への照合は未完了。綴り一致だけでは語義確認済みとしない |',
'| Sunshine／開隆堂 | 書誌確認 | [公式停止案内](https://www.kairyudo.co.jp/notice_20261023/)により特設サイト・資料DLが停止中。単元別語彙は未照合 |',
'| NEW CROWN／三省堂 | 書誌確認 | 単元と語義を結ぶ語彙資料は未照合。確認した紹介ページは取得時403。取得可能な公開資料の確認を継続する |',
'| ONE WORLD／教育出版 | 3学年の公開語彙DBと現行の年間計画を照合し、一部語彙の単元選択に対応 | 未一致語・語義・活用形・固有名詞・連語等の確認と素材補充。文法・読解の教科書紐付けは未対応 |',
`| Here We Go!／光村図書 | 文法${audit.hereWeGo.mappedMaterials}ポイントを3学年${audit.hereWeGo.playableUnits}単元から選択可能 | 部分対応。語彙・読解の単元対応、未収録文法と全用法の充足は未完了。3年Unit 8は既習材料とだけ示されるため推測で紐付けない |`,
'| BLUE SKY／啓林館 | 公式資料の取得が可能になり、3学年の単元一覧PDFを取得・確認 | 資料取得待ちから更新。文法・単元別語彙の問題対応表はまだ未作成、選択は未対応 |',
'','**全対応完了は0／6シリーズ。現在選択できる部分対応はONE WORLD（語彙）とHere We Go!（文法）の2シリーズ。** 書誌登録・資料取得・綴り一致を、出題対応完了とは数えない。','',`Here We Go!は${audit.hereWeGo.mappedMaterials}素材を${audit.hereWeGo.mappings}か所へ対応付け、同じポイントを受験用で重複出題しない。ページ情報は原資料にないため、表示・履歴ではnullとして推測しない。[行別文法確認台帳](../../textbook-data/here-we-go-grammar-reviewed.json)の原本・言語材料・素材ハッシュが変わったら再確認する。`,'','## 語彙照合の結果と限界','',`- ONE WORLD：文字列の語・語句${audit.oneWorld.totalEntries}件。語義確認済み${audit.oneWorld.senseConfirmed}件（正規化一致${audit.oneWorld.exactSenseConfirmed}件・行別の同義確認${audit.oneWorld.reviewedSenseConfirmed}件）、綴りは一致するが語義要確認${audit.oneWorld.senseReview}件、綴り未一致${audit.oneWorld.headwordUnmatched}件。`,
`- NEW HORIZON：3シート計${audit.newHorizon.totalEntries}行を照合し、綴り一致は${audit.newHorizon.headwordMatched}行。語義・単元の確認済み件数ではない。`,
'- 行数は異なる語義・活用形・固有名詞・連語等を含み、異なり語数や不足素材数とは異なる。未一致をそのまま必修の不足語数として扱わない。',
'- ONE WORLDは全単語・語句シートの主たる初出ページを、年間計画のページ範囲に当てる。欄外の別初出や、単元本文に再登場する既習語の全件対応ではない。暫定的な共通配当学年でなく、教科書の学年で絞る。',
'- care「世話」と既存の動詞「気にかける」、kind「種類」と既存の「親切な」等、綴りだけ一致する別義は紐付けない。正規化一致以外の同義語も自動承認しない。',
'__MAPPED_COUNTS__',
`- 行別確認は [語義確認台帳](../../textbook-data/one-world-reviewed.json) に保持。承認${textbooks.reviewLedger.approved}行、明示的保留${textbooks.reviewLedger.held}行。原本全体・原文語義・既存素材の語義をハッシュで固定し、変更時は再確認する。自動で同義語を展開しない。`,
'- 全行の分類・原シートの行番号・未解決候補は [語彙照合台帳](english-textbook-audit.json)。原本の日本語訳は公開台帳へ転載せず、対応先のIDと判断分類を保持。',
'','## 使い方','','設定で「中学英語の教科書（2026年度使用）」からONE WORLDまたはHere We Go!を選ぶ。ホームで学年または受験用を選び、教科書の単元を複数選択する。範囲はブラウザに保存。ONE WORLDは単語・熟語、Here We Go!は英文法に対応。確認済み形式だけを選べる。確認済み問題のない形式・単元は選べず、空選択で共通問題に戻すことはしない。共通問題へ戻すときは、設定で教科書指定を解除する。',
'','## 再現と更新','','原資料は取得元リンクから `/tmp/study-textbooks` 等へダウンロードし、`python3 scripts/textbook-audit.py /tmp/study-textbooks` で対応表を再生成（作業用にopenpyxlが必要。アプリには不要）。現行の可視シートだけを扱い、Excelに含まれる古い案や非表示シートを使わない。原本SHA-256が変わった場合は処理を止め、版・更新内容・語義・ページを確認してから対応表を更新する。',
'','年度更新は新しい対応データとして追加し、使用年度・版・教科書番号を確認して選択できるようにする。学習履歴は元の学習ポイントIDで共通化し、回答時の教科書・年度・単元・ページも記録する。新年度の単元へ旧年度の対応を推測でコピーしない。',
'','## 残る優先作業','','1. ONE WORLDの語義要確認と綴り未一致を、活用・別義・固有名詞・熟語・未収録候補に分けて確認する。','2. NEW HORIZONの単元・初出箇所を確認し、語義の照合を進める。','3. BLUE SKYの取得済み単元表から文法対応を作成。Here We Go!／NEW CROWNの語彙資料も確認し、Sunshineは公式公開の再開を確認する。','4. Here We Go!以外の文法、および各社の読解ポイントの単元対応を追加する。全言語技能への支援は、この暗記ゲームの範囲と分けて判断する。','');
// Derive correspondence counts from the actual manifest rather than editorial constants.
const owBooks=textbooks.books.filter(b=>b.series==='one-world');
const mapped=new Set(owBooks.flatMap(b=>b.units.flatMap(u=>u.items.map(r=>r.sourceId))));
const index=lines.findIndex(s=>s==='__MAPPED_COUNTS__');
if(index>=0)lines[index]=`- ${mapped.size}種類の既存素材に計${owBooks.reduce((n,b)=>n+b.units.reduce((m,u)=>m+u.items.length,0),0)}か所の確認済み初出対応を登録。学年別の対応は${[1,2,3].map(year=>`${year}年${owBooks.filter(b=>b.year===year).reduce((n,b)=>n+b.units.reduce((m,u)=>m+u.items.length,0),0)}`).join('、')}。語義一致${audit.oneWorld.senseConfirmed}行の一部はページ範囲外等のため、選択へ入れない。`;
writeFileSync(new URL('../docs/content/english-verification.md',import.meta.url),lines.join('\n'));
console.log(`Curriculum ${curriculum.criteria.length} criteria; textbook mapped ${mapped.size} materials`);
