"""Resolve authored science curriculum evidence; editorial inventory, no app tests."""
from pathlib import Path
from collections import Counter
import json
ROOT=Path(__file__).resolve().parent.parent
S=ROOT/'docs/content/science-source'
items=[q for f in ['junior_science','junior_expansion'] for q in json.loads((ROOT/f'quiz-data/{f}.json').read_text()) if q.get('subject')=='理科' and q.get('school_level')=='中学']
byid={q['id']:q for q in items}
terms={q['term']:q for q in items if 'term' in q}
def resolve(selectors):
 result=[]
 for sel in selectors.split(';'):
  kind,value=sel.split(':',1)
  if kind=='T':found=[terms[value]] if value in terms else []
  elif kind=='P':found=[q for q in items if q.get('prompt','').startswith(value)]
  else:raise ValueError(sel)
  assert found,sel
  result.append(dict(selector=sel,sourceIds=[q['id'] for q in found]))
 return result
meta=dict(version=json.loads((ROOT/'package.json').read_text())['version'],date='2026-11-10',source=json.loads((S/'curriculum-blocks.json').read_text())['source'])
rows=[]
for l in (S/'curriculum-review.tsv').read_text().splitlines():
 if not l or l.startswith('#'):continue
 field,block,code,point,selectors,boundary=l.split('|')
 evidence=resolve(selectors)
 rows.append(dict(id=block+'.'+code,field=field,block=block,officialItem=code,point=point,category='知識の項目' if code.startswith('ア') else '思考・判断・表現の項目',status='基礎知識・短文判断の出題先あり',evidence=evidence,sourceIds=list(dict.fromkeys(s for e in evidence for s in e['sourceIds'])),outsideGame=boundary))
assert len(rows)==len({r['id'] for r in rows})
result=dict(**meta,scope='付録3「2 内容」のアの丸印付き最下位項目と各ブロックのイを編集単位として照合。出題例の存在は全語句・全入試・実技能の網羅や習得を意味しない。',countingRule='アの最下位項目71行とイ14行。行数は編集用の照合単位であり公式の網羅率の分母ではない。',counts=dict(total=len(rows),byField=dict(Counter(r['field'] for r in rows)),byCategory=dict(Counter(r['category'] for r in rows))),rows=rows,unresolvedSelectors=[])
(S/'curriculum-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
handling=[]
for l in (S/'handling-review.tsv').read_text().splitlines():
 if not l or l.startswith('#'):continue
 field,block,locator,point,selectors,boundary=l.split('|');evidence=resolve(selectors)
 handling.append(dict(field=field,block=block,officialLocator=locator,point=point,evidence=evidence,sourceIds=list(dict.fromkeys(s for e in evidence for s in e['sourceIds'])),outsideGame=boundary))
(S/'handling-review.json').write_text(json.dumps(dict(**meta,scope='内容の取扱いのうち学習内容を指定する項目を要約して照合。各分野の配当学年・授業の実施方法等は別記し、行数を網羅率としない。',rows=handling,gradeAllocation='各分野(1)(2)は中1、(3)(4)は中2、(5)〜(7)は中3。既存の暫定配当は変更しない。',practicalBoundary='実験・観察・作図・自由な表現の実施と達成はゲームの短文選択とは別練習。'),ensure_ascii=False,indent=2)+'\n')
md=['# 中学理科：公式内容の小項目との照合','','2026-11-10 / v'+meta['version'],'',result['scope'],'','文科省「中学校学習指導要領解説 理科編」付録3（第1分野：印刷頁150–156、第2分野：157–163）を参照。内容と取扱いは編集用の要約。出題IDは[機械用照合表](science-source/curriculum-review.json)へ保存。','',result['countingRule'],'','| 分野 | 小項目 | 観点 | 出題例 | 別に必要な練習 |','| --- | --- | --- | --- | --- |']
for r in rows:
 examples=[byid[e['sourceIds'][0]].get('term',byid[e['sourceIds'][0]].get('prompt','')) for e in r['evidence']]
 md.append('| '+' | '.join([r['field'],r['id'],r['point'],'／'.join(examples[:3]),r['outsideGame']])+' |')
md+=['','## 内容の取扱い','','学習内容に関する59観点を[取扱い照合](science-source/handling-review.json)へ整理。全反射・音速・重さと質量、粒子モデル、交流・放射線、同位体・電池、地質年代、細胞呼吸、水循環と大気の規模、遺伝と進化、惑星の比較、環境・災害調査などを確認した。','', '知識は文科省の本文・取扱いに沿った基礎を扱う。放射線の個別単位・種類、半減期、材料・電子部品の詳しい名称などは入門補足を含む。これらをすべて必修語句と扱わない。','', '## 完了判断の範囲','','暗記・短い条件比較・実験の着眼点の基礎版として一区切り。イの各項目は、探究方法や判断の着眼点を学ぶ出題例であり、探究活動そのものの代替ではない。全実験例・全語句・全入試問題・全技能の達成保証とはしない。','', '[完了範囲](science-completion.md)・[最新収録数](science-progress.json)。','']
(ROOT/'docs/content/science-curriculum-review.md').write_text('\n'.join(md))
print(json.dumps(dict(counts=result['counts'],handling=len(handling)),ensure_ascii=False))
