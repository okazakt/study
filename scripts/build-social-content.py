"""Compile independently authored social content. No app tests or playback."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'docs/content/social-source'
SOURCES=[('social-foundation-20261108','foundation'),('social-regions-20261108','regions'),('social-geography-20261108','geography')]
MANAGED={batch for batch,_ in SOURCES}
path=ROOT/'quiz-data/junior_social.json'
prior=json.loads(path.read_text())
bank=[q for q in prior if q.get('content_batch') not in MANAGED]
added=[];group=[];header=None
region_overrides=json.loads((SOURCE/'regions-overrides.json').read_text())
def emit():
 if not group:return
 assert len(group)==4,(header,len(group))
 grade,field,unit,official=header
 for row in group:
  term,template,answer,dummies,note=row[:5]
  others=row[5].split(',') if len(row)==6 else [r[0] for r in group if r[0]!=term]
  assert len(others)==3 and len(set([term]+others))==4,term
  assert template.count('{{1}}')==1 and '{{2}}' not in template,term
  assert len(set([answer]+dummies.split(',')))==4,term
  hint=answer in term
  q=dict(id='jr_social_'+hashlib.sha256((field+'|'+term).encode()).hexdigest()[:12],subject='社会',school_level='中学',grade=grade,field=field,unit=unit,term=term,term_dummies=others,explanation_template=template,blanks=[dict(index=1,answer=answer,dummies=dummies.split(','))],note=note,cloze_context='' if hint else term,cloze_context_reason='用語に穴の正答そのものが含まれるため省略。' if hint else '用語は説明の対象を特定するために表示。穴の正答の直接記載はない。',content_batch=BATCH,official_blocks=[official],content_reviewed='2026-11-08')
  if BATCH=='social-regions-20261108':
   override=region_overrides.get(term,{})
   assert set(override)<= {'grade','unit','official_blocks','cloze_context','cloze_context_reason'},term
   q.update(override)
  added.append(q)
for BATCH,prefix in SOURCES:
 group=[];header=None
 for n,line in enumerate((SOURCE/(prefix+'-terms.tsv')).read_text().splitlines(),1):
  if not line or line.startswith('#'):continue
  if line.startswith('@'):
   emit();group=[];header=line[1:].split('|');assert len(header)==4,(n,line)
  else:
   parts=line.split('|');assert len(parts) in [5,6],(n,line);group.append(parts)
 emit()
 for n,line in enumerate((SOURCE/(prefix+'-choices.tsv')).read_text().splitlines(),1):
  if not line or line.startswith('#'):continue
  r=line.split('|');assert len(r)==10,(n,r)
  grade,field,unit,official,prompt,answer,a,b,c,note=r
  assert len(set([answer,a,b,c]))==4,(n,prompt)
  added.append(dict(id='jr_social_case_'+hashlib.sha256((field+'|'+prompt).encode()).hexdigest()[:12],subject='社会',school_level='中学',grade=grade,field=field,unit=unit,kind='choice',task='適切なものを選ぼう',prompt=prompt,answer=answer,dummies=[a,b,c],note=note,content_batch=BATCH,official_blocks=[official],content_reviewed='2026-11-08'))
 # Reuse already-authored city items for three seats; add only the remaining 44.
 if prefix=='geography':
  capital_rows=[line.split('|') for line in (SOURCE/'prefecture-capitals.tsv').read_text().splitlines() if line and not line.startswith('#')]
  assert len(capital_rows)==47 and len({r[0] for r in capital_rows})==47
  for prefecture,seat,distractors,existing_id in capital_rows:
   if existing_id!='-':
    prior_item=next((q for q in bank+added if q['id']==existing_id),None)
    assert prior_item and prior_item.get('term')==seat,(prefecture,existing_id)
    continue
   office='府庁' if prefecture.endswith('府') else '県庁'
   prompt='東京都庁がある特別区は？' if prefecture=='東京都' else f'{prefecture}の{office}所在地は？'
   dummies=distractors.split(',');assert len(dummies)==3 and len(set([seat]+dummies))==4
   note='地図では「東京」とも表記。都庁は新宿区。' if prefecture=='東京都' else '都道府県名と所在都市を結び付ける。'
   added.append(dict(id='jr_social_case_'+hashlib.sha256(('地理|'+prompt).encode()).hexdigest()[:12],subject='社会',school_level='中学',grade='中2',field='地理',unit='都道府県と県庁所在地',kind='choice',task='適切なものを選ぼう',prompt=prompt,answer=seat,dummies=dummies,note=note,content_batch=BATCH,official_blocks=['geo-A1'],content_reviewed='2026-11-08',capital_prefecture=prefecture))
assert not ({q['id'] for q in bank}&{q['id'] for q in added})
assert len({q['id'] for q in added})==len(added)
assert len({q['term'] for q in bank+added if 'term' in q})==sum('term' in q for q in bank+added),'duplicate term'
path.write_text(json.dumps(bank+added,ensure_ascii=False,indent=2)+'\n')
print('Added',len(added),'materials;',sum('term' in q for q in added),'paired terms and',sum(q.get('kind')=='choice' for q in added),'cases')
