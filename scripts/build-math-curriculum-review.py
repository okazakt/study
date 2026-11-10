"""Resolve authored curriculum evidence; inventory only, no gameplay tests."""
from pathlib import Path
from collections import Counter
import json
ROOT=Path(__file__).resolve().parent.parent
S=ROOT/'docs/content/math-source'
items=[q for f in ['junior_math','junior_expansion']for q in json.loads((ROOT/f'quiz-data/{f}.json').read_text())if q.get('subject')=='数学'and q.get('school_level')=='中学']
byid={q['id']:q for q in items}
def resolve(selectors):
 evidence=[]
 for sel in selectors.split(';'):
  kind,value=sel.split(':',1)
  found=[q for q in items if kind=='S'and q.get('sequence_generator')==value or kind=='I'and q['id']==value or kind=='P'and q.get('prompt','').startswith(value)]
  assert found,sel
  evidence.append(dict(selector=sel,sourceIds=[q['id']for q in found]))
 return evidence
version=json.loads((ROOT/'package.json').read_text())['version']
source=json.loads((S/'curriculum-outline.json').read_text())['source']
source.update(reviewed='2026-11-10',locator='付録3、第2 各学年の目標及び内容。印刷頁190〜198。',verification='取得したPDF本文の各学年の内容・用語記号・取扱い・数学的活動を読み、編集用の要約と代表出題IDを対応。')
rows=[]
for l in (S/'curriculum-review.tsv').read_text().splitlines():
 if not l or l.startswith('#'):continue
 grade,block,code,point,selectors,boundary=l.split('|');evidence=resolve(selectors)
 rows.append(dict(id=f'{grade}.{block}.{code}',grade=grade,block=block,officialItem=code,point=point,category='知識・技能'if code.startswith('ア')else'思考・判断・表現'if code.startswith('イ')else'数学的活動',status='基礎知識・解法の一手・判断の出題先あり',evidence=evidence,sourceIds=list(dict.fromkeys(s for e in evidence for s in e['sourceIds'])),outsideGame=boundary))
assert len(rows)==len({r['id']for r in rows})
meta=dict(version=version,date='2026-11-10',source=source)
counts=dict(total=len(rows),byGrade=dict(Counter(r['grade']for r in rows)),byCategory=dict(Counter(r['category']for r in rows)))
result=dict(**meta,scope='各学年「2 内容」の知識技能・思考判断表現の最下位項目と数学的活動を編集単位として照合。出題先の存在は全語句・全入試や実技能の網羅・習得を表さない。',countingRule='知識技能55・思考判断表現43の98小項目と数学的活動9の計107編集行。下位の全語句・指導例の母数や公式の達成率ではない。',counts=counts,rows=rows,unresolvedSelectors=[])
(S/'curriculum-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
handling=[]
for l in (S/'handling-review.tsv').read_text().splitlines():
 if not l or l.startswith('#'):continue
 grade,locator,point,selectors,boundary=l.split('|');evidence=resolve(selectors)
 handling.append(dict(grade=grade,officialLocator=locator,point=point,evidence=evidence,sourceIds=list(dict.fromkeys(s for e in evidence for s in e['sourceIds'])),outsideGame=boundary))
(S/'handling-review.json').write_text(json.dumps(dict(**meta,scope='各学年「3 内容の取扱い」11項目と「用語・記号」の10グループ。用語は関連する出題の文脈・式・解説で扱い、用語名だけの逆問題は追加しない。',rows=handling,counts=dict(handling=sum(r['officialLocator'].startswith('3(')for r in handling),terminologyGroups=sum(r['officialLocator'].startswith('用語')for r in handling))),ensure_ascii=False,indent=2)+'\n')
md=['# 中学数学：公式内容の小項目との照合','','2026-11-10 / v'+version,'',result['scope'],'','文科省[数学編解説](%s)付録3（印刷頁190〜198）を参照。記載は編集用の要約。対応IDは[機械用照合表](math-source/curriculum-review.json)に保存。'%source['url'],'',result['countingRule'],'','| 学年 | 小項目 | 観点 | 出題例 | 別に必要な練習 |','| --- | --- | --- | --- | --- |']
for r in rows:
 examples=[]
 for e in r['evidence'][:3]:
  q=byid[e['sourceIds'][0]];examples.append(q.get('title',q.get('term',q.get('prompt',''))))
 md.append('| '+' | '.join([r['grade'],r['block']+'.'+r['officialItem'],r['point'],'／'.join(examples),r['outsideGame']])+' |')
md+=['','## 内容の取扱い・用語記号','','[照合記録](math-source/handling-review.json)へ、取扱い11項目と用語記号の10グループを整理。用語の出現だけを習得や全語義の網羅の証明としない。','', '## 完了判断の範囲','','暗記・短い解法の連続・判断の基礎版として一区切り。数学的活動や思考判断表現への対応は、条件・方法・根拠・振返りの着眼点を短文で学ぶ範囲であり、実際の活動や自由な記述を代替しない。図形の作図・グラフ作成・図の実読取り・長い計算・証明の自力記述・調査や討論は別練習。','', '[基礎版の完了範囲](math-completion.md)。','']
(ROOT/'docs/content/math-curriculum-review.md').write_text('\n'.join(md))
outline=json.loads((S/'curriculum-outline.json').read_text());outline.update(version=version,source=source,completion=True,estimate='暗記・解法ポイントの基礎版は一区切り。次の拡張は応用・別表現・図資料等の任意枠。')
for area in outline['rows']:
 matched=[r for r in rows if r['grade']==area['grade']and r['block']==area['officialGroup']]
 assert matched,area['id']
 area['sourceIds']=list(dict.fromkeys(s for r in matched for s in r['sourceIds']))
 area['status']='基礎版の小項目対応を照合済み';area.pop('pending',None)
 area['outsideGame']='実技能・自由な説明等は別練習。詳細は小項目照合表。'

outline['completionScope']='暗記・短い解法・判断の基礎版。全語句・全入試や実技能の達成ではない。'
(S/'curriculum-outline.tsv').write_text('# 最新の概要。詳細は curriculum-review.tsv/json と handling-review.tsv/json。\n'+'\n'.join('|'.join([area['grade'],area['officialGroup'],area['title'],','.join(area['sourceIds']),area['status']])for area in outline['rows'])+'\n')
(S/'curriculum-outline.json').write_text(json.dumps(outline,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(counts=counts,handling=len(handling)),ensure_ascii=False))
