"""Build the complete editorial row review; never infer textbook senses from spelling.
Usage: python3 scripts/new-horizon-main-review.py /path/to/nh.xlsx
The source and previously reviewed entry meanings are pinned. Changed inputs require editorial re-review.
"""
import sys,json,hashlib,collections,re
from pathlib import Path
import openpyxl
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'docs/content'; REVIEW=D/'nh-review'
def read(p): return json.loads(p.read_text())
def sha(raw): return hashlib.sha256(raw).hexdigest()
def table(name,columns):
 result={}
 for line in (REVIEW/name).read_text().splitlines():
  if not line.strip() or line.startswith('#'): continue
  parts=line.split('\t'); assert len(parts)==columns,(name,line)
  row=int(parts[0]); assert row not in result,(name,row)
  result[row]=parts[1:]
 return result
source=Path(sys.argv[1]); digest=sha(source.read_bytes())
scope=read(REVIEW/'review-scope.json')
assert digest==scope['source']['sha256'],'Official source changed: review new edition before rebuilding'
sheet=openpyxl.load_workbook(source,data_only=True).worksheets[0]
assert sheet.title=='本文Word List 単語一覧'
items={q['id']:q for p in (ROOT/'quiz-data').glob('junior_*.json') for q in read(p)}
existing={r['row']:r for r in read(REVIEW/'existing-entries.json')}
lexical=table('lexical-additions.tsv',2); forms=table('forms-and-functions.tsv',4); senses=table('sense-expansions.tsv',2)
assert not(set(existing)&set(lexical) or set(existing)&set(forms) or set(lexical)&set(forms))
assert set(existing)|set(lexical)|set(forms)==set(range(2,1791))
assert set(senses)<=set(existing)
byword=collections.defaultdict(list)
for q in items.values():
 if q.get('english'): byword[q['english'].casefold()].append(q['id'])
# Explicit distinctions encoded by the source's notes, reviewed individually.
source_sense_gaps={533,822,869,872,909,915,1243,1254,1301}
source_forms={136:('become','becomeの過去分詞'),374:('cut','cutの過去分詞'),721:('hit','hitの過去'),854:('leave','leaveの過去・過去分詞'),862:('let','letの過去'),1177:('put','putの過去'),1199:('read','readの過去・過去分詞。綴りが同じでも発音が変わる'),1316:('set','setの過去'),1431:('spread','spreadの過去')}
proper_existing={74,96,182,220,266,267,393,491,549,611,633,772,798,802,803,804,811,813,908,916,947,1021,1031,1312,1553,1606,1681}
# Direct answer/phrase-blank evidence is supplementary and never a claim of full lexical sense coverage.
def norm(s): return str(s).strip().replace('’', "'").casefold()
answer_targets=collections.defaultdict(list)
for q in items.values():
 if q.get('subject')!='英語': continue
 for context in [q,*q.get('presentations',[])]:
  if isinstance(context.get('answer'),str): answer_targets[norm(context['answer'])].append(q['id'])
 for blank in q.get('phrase_blanks',[]):
  if isinstance(blank.get('answer'),str): answer_targets[norm(blank['answer'])].append(q['id'])
rows=[]
for row in range(2,1791):
 word=sheet.cell(row,2).value.strip(); note=sheet.cell(row,3).value
 assert sheet.cell(row,1).value==row-1
 record={'row':row,'number':sheet.cell(row,1).value,'headword':word,'sourceNoteHash':sha(str(note).encode()) if note is not None else None,'reviewStatus':'classified','sourceNoteInterpretationVerified':note is not None}
 if row in existing:
  old=existing[row]; assert old['headword']==word
  for entry in old['reviewedEntries']:
   q=items[entry['id']]
   assert q.get('english')==entry['english'] and q.get('japanese')==entry['japanese'],f"Previously reviewed material changed: {entry['id']}"
  record['existingEntries']=old['reviewedEntries']
  record['decision']='existing_basic_entry'
  record['meaning']=' / '.join(x['japanese'] for x in old['reviewedEntries'])
  record['action']='既存の基本語義を保持。教科書本文の特定用法まで一致したとは扱わない。'
  if row in proper_existing:
   record['decision']='existing_named_entry'
  if row in senses:
   record['additionalStudySense']=senses[row][0]
   record['senseRecommendation']='基本義以外の独立問題を補強。該当する教科書本文の用法は公開語彙表だけでは確定しない。'
  if row in source_sense_gaps:
   record['decision']='source_distinguished_sense_mismatch'
   record['meaning']=senses[row][0]
   record['action']='公式備考で区別された意味が既存の単語素材と異なる。関連する熟語・文法も確認し、既存IDを変更せず必要な別義・用法を補強する。'
   record['sourceNoteInterpretationVerified']=True
  elif row in source_forms:
   base,meaning=source_forms[row]
   record.update(decision='source_distinguished_inflection',meaning=meaning,baseHeadwords=[base],baseMaterialIds=byword[base.casefold()])
   record['action']='原形の意味問題とは分けて活用を学ぶ。原形素材の存在だけで活用形問題を収録済みとしない。'
 elif row in lexical:
  assert not byword.get(word.casefold()),f'New lexical material requires re-review of row {row}: {word}'
  record.update(decision='add_lexical_entry',meaning=lexical[row][0],action='独立した語・連語の教材を追加。類義語や問題文中の登場で代替しない。')
 else:
  assert not byword.get(word.casefold()),f'New material requires re-review of row {row}: {word}'
  category,meaning,base=forms[row]
  record.update(decision=category,meaning=meaning,baseHeadwords=base.split('|'))
  record['baseMaterialIds']=list(dict.fromkeys(i for b in base.split('|') for i in byword.get(b.casefold(),[])))
  record['action']={
   'inflection':'原形・活用関係を明示した文法または語形問題として補強。原形の意味問題とは別扱い。',
   'inflection_sense_gap':'出生の意味は動物のbearとは別。be bornのまとまりで補強し、クマの教材を根拠に使わない。',
   'degree':'原級と比較級・最上級の対応を文脈付きで問う。原級が未収録なら併せて補強。',
   'function':'単独の和訳4択より、用法を特定できる短文・穴埋めで扱う。既存文法全用法の充足は別監査。',
   'negative':'否定の作り方・意味を文脈付きで扱う。',
   'contraction':'展開形と使い方を文脈付きで扱う。複数の展開がある形を一意と誤認させない。',
   'ambiguous_form':'複数の品詞・原形候補を保存。本文文脈なしに片方へ決めない。必要な各用法を補強する。',
   'alias':'関連する既存語があっても別表記・別称の認識を別途扱う。',
   'abbreviation':'略語と意味・展開形を対応させて扱う。',
   'name':'地理・文化の補助語として扱う。一般語の必修不足件数とは分ける。',
   'name_alias':'固有名詞の略記として対応させる。一般語とは別集計。',
   'calendar':'曜日・年中行事の表現として補強する。地理固有名詞の一律除外へ混ぜない。',
   'productive':'特定の人名・年号を暗記させず、接辞・所有格・年代の規則を問う。'
  }[category]
 # Source notes fix only the stated distinction, not every sense in the textbook.
 if row in source_forms or (row in forms and row==599): record['sourceNoteInterpretationVerified']=True
 record['directAnswerOrPhraseBlankIds']=list(dict.fromkeys(answer_targets.get(norm(word),[])))
 record['evidenceScope']='正答文字列または熟語穴の正答として一致した独自素材。語義や全用法の一致を自動認定しない。'
 rows.append(record)
counts=dict(collections.Counter(r['decision'] for r in rows))
result={'checked':'2026-11-05','reference':'NEW HORIZON 2025 edition / 2026 use','source':scope['source'],'sheet':sheet.title,'totalRows':1789,'reviewedRows':len(rows),'unclassifiedRows':0,'reviewScope':'全行の見出し・原形関係・既存の代表語義・追加方針を精査。本文の語義を全件確認したという意味ではない。','sourceLimitation':'語義・品詞・掲載文脈は原則未収録。備考の区別以外の本文語義一致は判定不可。','counts':counts,'recommendedAdditionalSenseRows':len(senses),'sourceDistinguishedSenseMismatchRows':sorted(source_sense_gaps),'directAnswerOrPhraseBlankRows':sum(bool(r['directAnswerOrPhraseBlankIds']) for r in rows),'rows':rows}
(D/'new-horizon-main-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
# Human-readable, all rows, without requiring an Excel download.
lines=['# NEW HORIZON 本文Word List 全行レビュー','','公式Excelの行番号（見出し行を含む）。語義は独自の学習用説明。教科書本文の用法確認済みを意味しない。分類と対応の限界は [精査結果](new-horizon-review.md) を参照。','','| Excel行 | 見出し | 判断 | 既存の代表語義／補強対象 |','| ---: | --- | --- | --- |']
labels={'existing_basic_entry':'基本語義あり','existing_named_entry':'名称の教材あり','source_distinguished_sense_mismatch':'備考が区別する別義','source_distinguished_inflection':'同綴りの活用形','add_lexical_entry':'語彙追加','inflection':'活用形','inflection_sense_gap':'活用形＋原形の別義不足','degree':'比較変化','function':'文法語・機能語','negative':'否定形','contraction':'短縮形','ambiguous_form':'文脈で複数解釈','alias':'別表記・別称','abbreviation':'略語','name':'固有名詞など','name_alias':'固有名詞の略記','calendar':'曜日・行事','productive':'規則で生成する形'}
for r in rows:
 meaning=r['meaning']
 if r.get('additionalStudySense') and r['decision']!='source_distinguished_sense_mismatch': meaning+=' ／補強推奨：'+r['additionalStudySense']
 lines.append(f"| {r['row']} | {r['headword'].replace('|','／')} | {labels[r['decision']]} | {meaning.replace('|','／')} |")
(D/'new-horizon-main-rows.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'reviewedRows':len(rows),'counts':counts,'additionalSenseRows':len(senses)},ensure_ascii=False,indent=2))
