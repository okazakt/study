# 中学英語：指導要領・2026年度教科書の照合

確認日：2026-11-01。数量目標の達成を必修範囲の網羅としない。**本アプリは暗記と短い判断の補助であり、英語科全体の学習・技能評価を代替しない。**

## 一次資料

- [文部科学省：平成29年告示・中学校学習指導要領 外国語編](https://www.mext.go.jp/content/20210531-mxt_kyoiku01-100002608_010.pdf)
- [文部科学省：令和8年度使用 中学校教科書目録](https://www.mext.go.jp/content/20250415-mxt_kyokasyo02-000041714_2.pdf)
- [東京書籍：令和7年度版 NEW HORIZON 掲載語彙データ](https://ten.tokyo-shoseki.co.jp/text/chu/eigo/download/)
- [教育出版：単語・連語データベース（2026年3月更新）](https://www.kyoiku-shuppan.co.jp/textbook/chuu/eigo/document/ducu3/docu304/index.html)
- [教育出版：令和7年度版 年間指導計画](https://www.kyoiku-shuppan.co.jp/textbook/chuu/eigo/document/ducu1/r7plan.html)
- [光村図書：単元系統一覧等](https://www.mitsumura-tosho.co.jp/kyokasho/c-eigo/shiryo)

取得元URL・ファイルのSHA-256・確認日は [対応データ](../../textbook-data/english-2026.json) に記録。原本はアプリに同梱せず、本文・訳文・音声・既存問題を転載しない。出題と解説は独自素材を使う。

## 指導要領との照合

指導要領は語数の目安、文・文構造・文法、音声や技能等を示している。語数だけから特定の単語集合の収録を証明できないため、語彙は各社資料との別照合とする。

60観点を確認。代表問ありは、根拠IDをもつ問題が存在するという意味であり、全用法・文脈・技能の達成ではない。照合で見つけた文構造・比較・分詞・符号等の薄い箇所に18ポイント（各2例）を補充した。全項目と根拠IDは [指導要領照合台帳](english-curriculum-audit.json)。

| 観点 | 指導要領の位置 | 現状 | 代表素材ID | 残る確認・支援範囲 |
| --- | --- | --- | --- | --- |
| 標準的な発音 | 2(1)ア | 未実装 | — | 英語音声の出題・聞き取り・発音評価は未実装。音楽やタップ音は英語音声の学習とは数えない。 |
| 語の連結による音の変化 | 2(1)ア | 未実装 | — | 英語音声の出題・聞き取り・発音評価は未実装。音楽やタップ音は英語音声の学習とは数えない。 |
| 語・句・文の強勢 | 2(1)ア | 未実装 | — | 英語音声の出題・聞き取り・発音評価は未実装。音楽やタップ音は英語音声の学習とは数えない。 |
| イントネーション | 2(1)ア | 未実装 | — | 英語音声の出題・聞き取り・発音評価は未実装。音楽やタップ音は英語音声の学習とは数えない。 |
| 文の区切り | 2(1)ア | 未実装 | — | 英語音声の出題・聞き取り・発音評価は未実装。音楽やタップ音は英語音声の学習とは数えない。 |
| 小学校既習の文字・大文字小文字・語の区切り | 2(1) 小学校内容との接続 | 一部支援 | jr_en_core_word_father | 綴り選択は支援するが、アルファベット全般・書写・自由書きの技能を確認済みとはしない。 |
| 小学校既習の基本文・主語と動詞の語順 | 2(1)エ 小学校内容との接続 | 代表問あり | jr_english_core_be、jr_en_core_grammar_do_question、jr_en_core_grammar_lets | 基本文と命令・疑問等に代表問あり。小学校の全学習活動を代替しない。 |
| 感嘆符・引用符等 | 2(1)イ | 代表問あり | jr_en_curriculum_symbol_exclamation、jr_en_curriculum_symbol_quotation | 代表問あり。運用技能の評価とは区別する。 |
| 小学校既習語と中学新出語 | 2(1)ウ(ア) | 一部支援 | — | 国の語数目安と単純な収録数を同一視しない。出版社語彙一覧の語義・活用形・固有名詞等を別に照合する。 |
| 頻用の連語 | 2(1)ウ(イ) | 一部支援 | jr_en_ext_phrase_take_part_in | 代表例を収録。各社の連語・使われ方まで全件一致した状態ではない。 |
| 頻用の慣用表現 | 2(1)ウ(ウ) | 一部支援 | jr_en_ext_phrase_make_sure | 代表例を収録。会話機能・定型表現の不足を照合する。 |
| 重文・複文 | 2(1)エ 文ア | 代表問あり | jr_en_app_reading_but_contrast、jr_en_core_grammar_before_clause | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 助動詞で始まる疑問 | 2(1)エ 文イ | 代表問あり | jr_en_core_grammar_may_permission、jr_en_core_grammar_or_question | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| which・whoseの疑問 | 2(1)エ 文イ | 代表問あり | jr_en_curriculum_which_question、jr_en_core_grammar_whose | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 基本的な感嘆文 | 2(1)エ 文ウ | 代表問あり | jr_en_core_grammar_exclamation_what、jr_en_core_grammar_exclamation_how | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| be以外の動詞と名詞の補語 | 2(1)エ 文構造a | 代表問あり | jr_en_curriculum_svc_noun | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| be以外の動詞と形容詞の補語 | 2(1)エ 文構造a | 代表問あり | jr_en_app_grammar_look_adjective | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 動名詞を目的語にする | 2(1)エ 文構造b(a) | 代表問あり | jr_english_core_gerund | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| to不定詞を目的語にする | 2(1)エ 文構造b(a) | 代表問あり | jr_english_core_infinitive | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 疑問詞＋to不定詞を目的語にする | 2(1)エ 文構造b(a) | 代表問あり | jr_en_curriculum_svo_how_full | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| that節を目的語にする | 2(1)エ 文構造b(b) | 代表問あり | jr_en_core_grammar_that_clause | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 疑問詞節を目的語にする | 2(1)エ 文構造b(b) | 代表問あり | jr_english_core_indirect | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 人と物を二つの目的語にする | 2(1)エ 文構造c(a) | 代表問あり | jr_en_app_grammar_give_order | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 直接目的語が代名詞 | 2(1)エ 文構造c(a) | 代表問あり | jr_en_curriculum_svoo_pronoun | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 人＋疑問詞to不定詞 | 2(1)エ 文構造c(b) | 代表問あり | jr_en_curriculum_svoo_how | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 人＋that節 | 2(1)エ 文構造c(c) | 代表問あり | jr_en_curriculum_svoo_that | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 人＋疑問詞節 | 2(1)エ 文構造c(c) | 代表問あり | jr_en_curriculum_svoo_wh | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 目的語を名詞で説明 | 2(1)エ 文構造d(a) | 代表問あり | jr_en_curriculum_svoc_noun | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 目的語を形容詞で説明 | 2(1)エ 文構造d(a) | 代表問あり | jr_english_core_make_object | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 目的語と原形不定詞 | 2(1)エ 文構造d(b) | 代表問あり | jr_en_core_grammar_bare_infinitive、jr_en_app_grammar_make_person_verb | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| There＋be | 2(1)エ 文構造e(a) | 代表問あり | jr_en_core_grammar_there_is、jr_en_core_grammar_there_are | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| It＋be＋形容詞＋for人＋to不定詞 | 2(1)エ 文構造e(b) | 代表問あり | jr_en_app_grammar_infinitive_for_person | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| tell・want＋人＋to不定詞 | 2(1)エ 文構造e(c) | 代表問あり | jr_en_app_grammar_tell_to、jr_en_app_grammar_want_person_to | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 主語＋be＋形容詞＋that節 | 2(1)エ 文構造e(d) | 代表問あり | jr_en_curriculum_be_adj_that | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 人称・指示・疑問・数量の代名詞 | 2(1)エ 文法a(a) | 代表問あり | jr_en_core_grammar_possessive_pronoun、jr_en_core_grammar_demonstrative_plural、jr_en_app_grammar_one_replacement | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 主格のthat・which・who | 2(1)エ 文法a(b) | 代表問あり | jr_en_curriculum_relative_which_subject、jr_en_app_grammar_relative_subject_keep、jr_english_core_relative_subject | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 目的格のthat・whichと接触節 | 2(1)エ 文法a(b) | 代表問あり | jr_english_core_relative_object、jr_en_core_grammar_relative_omit | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 接続詞 | 2(1)エ 文法b | 代表問あり | jr_en_core_grammar_that_clause、jr_en_app_grammar_if_future_present、jr_en_app_grammar_when_future_present | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 助動詞 | 2(1)エ 文法c | 代表問あり | jr_english_core_can、jr_english_core_must_not、jr_en_core_grammar_should、jr_en_app_grammar_could_request | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 前置詞 | 2(1)エ 文法d | 代表問あり | jr_en_core_grammar_at_clock、jr_en_app_grammar_in_month、jr_english_core_preposition_day | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 現在・過去と疑問否定 | 2(1)エ 文法e | 代表問あり | jr_en_core_grammar_do_negative、jr_en_core_grammar_past_question、jr_en_app_grammar_past_went | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 現在・過去の進行 | 2(1)エ 文法e | 代表問あり | jr_en_app_grammar_progressive_now、jr_en_core_grammar_past_progressive | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 現在完了 | 2(1)エ 文法e | 代表問あり | jr_en_core_grammar_perfect_for、jr_en_app_grammar_perfect_never、jr_en_app_grammar_perfect_already | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 現在完了進行 | 2(1)エ 文法e | 代表問あり | jr_en_app_grammar_perfect_continuous | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 助動詞等の未来表現 | 2(1)エ 文法e | 代表問あり | jr_en_core_grammar_going_to、jr_en_app_grammar_will_negative | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 形容詞の原級・比較級・最上級 | 2(1)エ 文法f | 代表問あり | jr_en_app_grammar_comparative_as、jr_en_core_grammar_more_comparative、jr_en_core_grammar_superlative | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 副詞の比較と不規則変化 | 2(1)エ 文法f | 代表問あり | jr_en_curriculum_comparative_adverb_er、jr_en_curriculum_comparative_adverb_more、jr_en_curriculum_comparative_adverb_well | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 名詞・形容詞・副詞としてのto不定詞 | 2(1)エ 文法g | 代表問あり | jr_en_core_grammar_noun_infinitive、jr_en_core_grammar_adjective_infinitive、jr_english_core_infinitive_purpose、jr_en_curriculum_infinitive_emotion | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 主語・目的語・前置詞後の動名詞 | 2(1)エ 文法h | 代表問あり | jr_en_curriculum_gerund_subject、jr_english_core_gerund、jr_en_core_grammar_gerund_preposition | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 前置・後置で修飾する現在／過去分詞 | 2(1)エ 文法i | 代表問あり | jr_en_curriculum_participle_before、jr_en_core_grammar_past_participle_modifier、jr_english_core_participle | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 受け身 | 2(1)エ 文法j | 代表問あり | jr_en_core_grammar_passive_past、jr_en_app_grammar_passive_future | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 基本的な仮定法 | 2(1)エ 文法k | 代表問あり | jr_english_core_subjunctive、jr_en_core_grammar_wish_could、jr_en_app_grammar_wish_were | 代表問との対応を確認。否定・疑問・用法・文脈の全バリエーションまで充足したという判定ではない。 |
| 聞くこと | 1 領域別目標 | 未実装 | — | 英語音声を聞いて解く課題は未実装。 |
| 読むこと | 1 領域別目標 | 一部支援 | jr_en_app_reading_notice_time、jr_en_app_reading_summary、jr_en_app_reading_only_scope | 短文の必要情報・概要・要点の支援を収録。長文読解の総合評価ではない。 |
| 話すこと・やり取り | 1 領域別目標 | 未実装 | jr_en_app_reading_response_offer | 応答を選ぶ補助問題はあるが、音声で即興にやり取りする技能は評価していない。 |
| 話すこと・発表 | 1 領域別目標 | 未実装 | — | 口頭発表を生成・評価する課題は未実装。 |
| 書くこと | 1 領域別目標 | 一部支援 | jr_en_curriculum_svoo_wh | 語順・綴り選択は補助。自由にまとまりのある文章を書く技能は評価していない。 |
| 情報整理・根拠・考えの形成 | 2(2) | 一部支援 | jr_en_app_reading_inference_limit、jr_en_app_reading_opinion_fact | 根拠や事実と意見を判別する短文課題で支援。自分の意見の生成は未実装。 |
| 言語活動と場面・働き | 2(3) | 一部支援 | jr_en_app_reading_invitation_decline_reason、jr_en_app_grammar_why_dont_we | 依頼・断り・提案等の選択は支援。実際の発話・作文の活動を代替しない。 |
| 文化的背景と相手への配慮 | 3 指導計画と内容の取扱い | 一部支援 | jr_en_app_reading_response_permission | 定型的な丁寧な応答は扱う。文化理解・他者理解全般の達成は保証しない。 |

## 2026年度に使用する教科書

使用年度2026と、教科書の版である2025（令和7年度版）を分離。目録の6シリーズ×3学年・18冊を登録。書名を登録しただけでは対応済みとしない。出版社の監修・公認を意味しない。

| シリーズ | 確認資料と現在の対応 | 未完了 |
| --- | --- | --- |
| NEW HORIZON／東京書籍 | 公開語彙一覧を綴りで照合 | 一覧に単元・初出ページがないため、単元絞り込みは未対応。語義も綴り一致だけでは確認済みとしない |
| Sunshine／開隆堂 | 書誌確認 | [公式停止案内](https://www.kairyudo.co.jp/notice_20261023/)により特設サイト・資料DLが停止中。単元別語彙は未照合 |
| NEW CROWN／三省堂 | 書誌確認 | 単元と語義を結ぶ語彙資料は未照合。確認した紹介ページは取得時403。取得可能な公開資料の確認を継続する |
| ONE WORLD／教育出版 | 3学年の公開語彙DBと現行の年間計画を照合し、一部語彙の単元選択に対応 | 未一致語・語義・活用形・固有名詞・連語等の確認と素材補充。文法・読解の教科書紐付けは未対応 |
| Here We Go!／光村図書 | 単元系統表を取得・版を確認 | 単元別語彙の照合と対応は未完了 |
| BLUE SKY／啓林館 | 書誌確認 | [公式メンテナンス表示](https://www.shinko-keirin.co.jp/maintenance.html)へ転送されるため、単元別語彙は未照合 |

## 語彙照合の結果と限界

- ONE WORLD：文字列の語・語句2778件。語義確認済み1058件（正規化一致724件・行別の同義確認334件）、綴りは一致するが語義要確認168件、綴り未一致1552件。
- NEW HORIZON：3シート計2402行を照合し、綴り一致は1344行。語義・単元の確認済み件数ではない。
- 行数は異なる語義・活用形・固有名詞・連語等を含み、異なり語数や不足素材数とは異なる。未一致をそのまま必修の不足語数として扱わない。
- ONE WORLDは全単語・語句シートの主たる初出ページを、年間計画のページ範囲に当てる。欄外の別初出や、単元本文に再登場する既習語の全件対応ではない。暫定的な共通配当学年でなく、教科書の学年で絞る。
- care「世話」と既存の動詞「気にかける」、kind「種類」と既存の「親切な」等、綴りだけ一致する別義は紐付けない。正規化一致以外の同義語も自動承認しない。
- 906種類の既存素材に計906か所の確認済み初出対応を登録。学年別の対応は1年495、2年248、3年163。語義一致1058行の一部はページ範囲外等のため、選択へ入れない。
- 行別確認は [語義確認台帳](../../textbook-data/one-world-reviewed.json) に保持。承認334行、明示的保留14行。原本全体・原文語義・既存素材の語義をハッシュで固定し、変更時は再確認する。自動で同義語を展開しない。
- 全行の分類・原シートの行番号・未解決候補は [語彙照合台帳](english-textbook-audit.json)。原本の日本語訳は公開台帳へ転載せず、対応先のIDと判断分類を保持。

## 使い方

設定で「中学英語の教科書（2026年度使用）」からONE WORLDを選ぶ。ホームで学年または受験用を選び、教科書の単元を複数選択する。範囲はブラウザに保存。単語英和・和英・綴り等の形式と併用できる。確認済み問題のない形式・単元は選べず、空選択で共通問題に戻すことはしない。共通問題へ戻すときは、設定で教科書指定を解除する。

## 再現と更新

原資料は取得元リンクから `/tmp/study-textbooks` 等へダウンロードし、`python3 scripts/textbook-audit.py /tmp/study-textbooks` で対応表を再生成（作業用にopenpyxlが必要。アプリには不要）。現行の可視シートだけを扱い、Excelに含まれる古い案や非表示シートを使わない。原本SHA-256が変わった場合は処理を止め、版・更新内容・語義・ページを確認してから対応表を更新する。

年度更新は新しい対応データとして追加し、使用年度・版・教科書番号を確認して選択できるようにする。学習履歴は元の学習ポイントIDで共通化し、回答時の教科書・年度・単元・ページも記録する。新年度の単元へ旧年度の対応を推測でコピーしない。

## 残る優先作業

1. ONE WORLDの語義要確認と綴り未一致を、活用・別義・固有名詞・熟語・未収録候補に分けて確認する。
2. NEW HORIZONの単元・初出箇所を確認し、語義の照合を進める。
3. Here We Go!／NEW CROWNの単元別語彙資料を確認し、停止中の2社は公式公開の再開後に取得する。
4. 文法・読解の教科書単元対応を追加する。全言語技能への支援は、この暗記ゲームの範囲と分けて判断する。
