"""Resolve authored curriculum evidence. Inventory only, no gameplay tests."""
from pathlib import Path
from collections import Counter
import json
ROOT=Path(__file__).resolve().parent.parent
S=ROOT/'docs/content/social-source'
items=[q for name in ['junior_social','junior_expansion'] for q in json.loads((ROOT/f'quiz-data/{name}.json').read_text()) if q.get('subject')=='社会']
terms={q['term']:q for q in items if 'term'in q}
rows=[]
for line in (S/'curriculum-review.tsv').read_text().splitlines():
 if not line or line.startswith('#'):continue
 field,block,code,label,selectors,boundary=line.split('|')
 evidence=[]
 for sel in selectors.split(';'):
  kind,value=sel.split(':',1)
  if kind=='T':found=[terms[value]] if value in terms else []
  elif kind=='U':found=[q for q in items if q['unit']==value]
  elif kind=='P':found=[q for q in items if q.get('prompt','').startswith(value)]
  else:raise ValueError(sel)
  assert found,(block,code,sel)
  evidence.append({'selector':sel,'sourceIds':[q['id'] for q in found]})
 row=dict(id=block+'.'+code,field=field,block=block,officialItem=code,point=label,category='アの項目' if code.startswith('ア') else 'イの項目',status='基礎知識・短文判断の出題先あり',evidence=evidence,sourceIds=list(dict.fromkeys(x for e in evidence for x in e['sourceIds'])),outsideGame=boundary)
 if '技能' in boundary or '実際' in boundary or code.startswith('イ') or block=='civics-D2':row['practicalMastery']='出題先の存在は技能・論述・実践の達成を意味しない'
 rows.append(row)
assert len({r['id'] for r in rows})==len(rows)
result=dict(version=json.loads((ROOT/'package.json').read_text())['version'],date='2026-11-09',source=json.loads((S/'curriculum-blocks.json').read_text())['source'],scope='付録3各分野「2 内容」のア・イの小項目を編集単位として照合。知識・方法の基礎と短文判断の出題先を示し、全語句・全入試・実技能の完全網羅や公式の達成率とはしない。',countingRule='アの列挙項目とイの列挙項目を各一行とし、直接記述のイや探究のアも一行。下位の全語句・全指導例を独立計数したものではない。',rows=rows,counts=dict(total=len(rows),byField=dict(Counter(r['field'] for r in rows)),byCategory=dict(Counter(r['category'] for r in rows))),unresolvedSelectors=[])
(S/'curriculum-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
md=['# 中学社会：公式内容の小項目との照合','','更新：2026-11-09 / v'+result['version'],'',result['scope'],'','文科省「中学校学習指導要領解説 社会編」付録3（地理：印刷頁202–206、歴史：207–213、公民：213–217）を参照。記載は編集用の要約。出題IDは [機械用照合表](social-source/curriculum-review.json) に全件保存。','',result['countingRule'],'','| 分野 | 小項目 | 観点 | 出題例 | 別に必要な練習 |','| --- | --- | --- | --- | --- |']
byid={q['id']:q for q in items}
for r in rows:
 examples=[]
 for e in r['evidence']:
  q=byid[e['sourceIds'][0]];examples.append(q.get('term',q.get('prompt')))
 md.append('| '+' | '.join([r['field'],r['id'],r['point'],'／'.join(examples[:3]),r['outsideGame']])+' |')
md+=['','## 完了判断の範囲','','暗記・短い条件比較・因果判断の基礎版として出題先を整備した。各行の代表例があることを、授業全体の到達や全受験問題の網羅とは扱わない。特に地図・雨温図・写真の実読取り、地図や年表の作成、現地調査、長い史料の読解、自由な論述・討論・社会参画は別練習。','', '## 取扱いの具体的な確認','','[取扱いと地域・技能の境界](social-source/handling-review.json) に、六州・七地方・都道府県、思想文化や領域、平和と金融等の確認先を保存。授業の配当時間・教材選択・実際の活動計画は本ゲームのコンテンツ確認の対象外。','']
(ROOT/'docs/content/social-curriculum-review.md').write_text('\n'.join(md))
handling=[]
for line in (S/'handling-review-source.tsv').read_text().splitlines():
 if not line or line.startswith('#'):continue
 field,locator,point,selectors,boundary=line.split('|')
 ids=[]
 for sel in selectors.split(';'):
  kind,value=sel.split(':',1)
  found=[q for q in items if (kind=='T' and q.get('term')==value) or (kind=='U' and q['unit']==value) or (kind=='P' and q.get('prompt','').startswith(value))]
  assert found,(locator,sel)
  ids.extend(q['id'] for q in found)
 handling.append(dict(field=field,officialLocator=locator,point=point,selectors=selectors.split(';'),sourceIds=list(dict.fromkeys(ids)),scope=boundary))
positions=[q for q in items if q['unit']=='都道府県の位置']
assert len(positions)==47 and len({q['answer'] for q in positions})==47
capitals=json.loads((S/'prefecture-capitals-review.json').read_text())['rows']
assert {r['prefecture'] for r in capitals}=={q['answer'] for q in positions}
assert all(r['sourceId'] in {q['id'] for q in items} for r in capitals)
region_units=['北海道地方','東北地方','関東地方','中部地方','近畿地方','中国・四国地方','九州地方']
world_units=['アジア州','ヨーロッパ州','アフリカ州','北アメリカ州','南アメリカ州','オセアニア州']
region_evidence={u:[q['id'] for q in items if q['unit']==u] for u in region_units+world_units}
assert all(region_evidence.values())
(S/'handling-review.json').write_text(json.dumps(dict(version=result['version'],date=result['date'],scope='内容の取扱いのうち学習内容に関わる観点を編集用に統合した確認。行数は公式項目の分母ではない。授業時間・学校ごとの教材選択・活動実施は対象外。',rows=handling,regions=region_evidence,prefecturePositions={q['answer']:q['id'] for q in positions},prefectureCapitals={r['prefecture']:r['sourceId'] for r in capitals},practicalBoundary='位置の短文と所在都市の知識であり、地図上での指示・読図・作図技能の完了とは扱わない。'),ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result['counts'],ensure_ascii=False))
