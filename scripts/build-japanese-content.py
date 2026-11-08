"""Build editorial TSV additions only; no network, full-bank tests or playback."""
import json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'docs/content/japanese-source'
batch='japanese-core-20261107'
def rows(name):
 for n,line in enumerate((SOURCE/name).read_text().splitlines(),1):
  if not line or line.startswith('#'):continue
  yield n,line.split('|')
def base(kind,grade,field,unit,key):
 return dict(id='jr_jp_core_'+hashlib.sha256((kind+'|'+field+'|'+key).encode()).hexdigest()[:12],school_level='中学',grade=grade,subject='国語',field=field,unit=unit,kind=kind,content_batch=batch)
bank=[]
for n,r in rows('grammar-additions.tsv'):
 assert len(r)==9,(n,r)
 grade,field,unit,term,terms,template,answer,dummies,note=r
 q=base('grammar',grade,field,unit,term)
 q.update(term=term,term_dummies=terms.split(','),explanation_template=template,blanks=[dict(index=1,answer=answer,dummies=dummies.split(','))],note=note,cloze_context=term,cloze_context_reason='説明対象を特定するための用語。穴の正答そのものは含めない。')
 # Retain useful context, but omit an answer literally printed in the theme.
 if answer in term:q['cloze_context']='';q['cloze_context_reason']='用語に穴の正答が記載されているため省略。'
 bank.append(q)
for name in ['choice-additions.tsv','application-additions.tsv','language-practice-additions.tsv']:
 for n,r in rows(name):
  assert len(r)==9,(name,n,r)
  grade,field,unit,prompt,answer,*rest=r;dummies=rest[:3];note=rest[3]
  q=base('choice',grade,field,unit,prompt);q.update(prompt=prompt,answer=answer,dummies=dummies,note=note,task='適切なものを選ぼう')
  if name=='application-additions.tsv':q['content_batch']='japanese-application-20261107'
  if name=='language-practice-additions.tsv':q['content_batch']='japanese-language-practice-20261107'
  bank.append(q)
idioms=[r for _,r in rows('idiom-additions.tsv')]
# These related pairs are never offered against one another as interchangeable distractors.
related=[['因果応報','自業自得'],['一心不乱','無我夢中'],['公明正大','正々堂々'],['五里霧中','右往左往'],['頭が下がる','舌を巻く'],['鼻が高い','鼻にかける'],['油を売る','道草を食う'],['猿も木から落ちる','弘法にも筆の誤り'],['石の上にも三年','継続は力なり'],['転ばぬ先の杖','備えあれば憂いなし'],['七転び八起き','失敗は成功のもと'],['論より証拠','百聞は一見にしかず']]
for i,(grade,unit,term,definition) in enumerate(idioms):
 same=[r for r in idioms if r[1]==unit];pos=next(j for j,r in enumerate(same) if r[2]==term)
 others=[]
 for offset in [4,11,19,*range(1,len(same))]:
  r=same[(pos+offset)%len(same)]
  if r[2]!=term and r not in others and not any(term in pair and r[2] in pair for pair in related):others.append(r)
  if len(others)==3:break
 q=base('idiom',grade,'熟語・四字熟語',unit,term);q.update(term=term,definition=definition,term_dummies=[r[2] for r in others],definition_dummies=[r[3] for r in others],note=f'{term}：{definition}')
 if unit=='ことわざ':q.update(content_batch='japanese-application-20261107',note=definition)
 bank.append(q)

print('Japanese core additions:',len(bank),'materials')

kanji=[]
for n,r in rows('kanji-readings.tsv'):
 assert len(r)==6,(n,r)
 c,word,reading,dummies,grade,coverage=r
 item=dict(id=f'jr_jp_joyo_{ord(c):x}',school_level='中学',grade=grade,subject='国語',field='漢字',unit='常用漢字の読み',kind='kanji',word=word,character=c,reading=reading,reading_dummies=dummies.split(','),sentence='語句の読みを選ぼう。',writing_hint='',writing_target_index=word.index(c),writing_parts=[],note=f'{word}（{reading}）。',content_batch='japanese-joyo-20261107',kanji_scope='secondary-1110',reading_sources=['bunka-joyo','jmdict-furigana-20261025'])
 if coverage.split(',')!=[c]:item['coverage_characters']=coverage.split(',')
 kanji.append(item)

print('Japanese kanji reading additions:',len(kanji),'materials')

# Add writing to existing character IDs; elementary review gets a new source only
# when that character has no source. Reading words/answers of upgraded IDs stay intact.
old_kanji={q['character']:q for f in ['junior_japanese','junior_expansion'] for q in json.loads((ROOT/f'quiz-data/{f}.json').read_text()) if q.get('subject')=='国語' and q.get('kind')=='kanji'}
kanji_by_char={q['character']:q for q in kanji}
scope={q['character']:q['elementary'] for q in json.loads((SOURCE/'joyo-scope.json').read_text())}
glyph_options=json.loads((SOURCE/'writing-glyph-groups.json').read_text());groups=glyph_options['groups']
# Variant forms are not offered against one another as if they were wrong glyphs.
aliases=[set(s) for s in glyph_options['equivalentForms']]
shape_revisions=json.loads((SOURCE/'writing-shape-revisions.json').read_text())
writing_deferred=json.loads((SOURCE/'writing-deferred.json').read_text())
def glyph_dummies(answer,character,option_groups=None):
 pool=next((list(g) for g in (groups if option_groups is None else option_groups) if answer in g),list('目田白自未末本木由甲申寺吉古合谷各共兵具良艮鬼豆角舟石示辛章央失矢里重'))
 result=[]
 for c in pool+list('目田白自未末本木由甲申寺吉古合谷各共兵具良艮鬼豆角舟石示辛章央失矢里重'):
  if c in {answer,character} or c in result or any(answer in pair and c in pair for pair in aliases+[set(s) for s in glyph_options.get('parentEquivalentForms',{}).get(character,[])]):continue
  result.append(c)
  if len(result)==3:return result
 raise ValueError('insufficient distinct glyphs for '+answer)
writing_batch='japanese-writing-20261107'
elementary_grades=json.loads((SOURCE/'elementary-grades.json').read_text())
writing_rows=[(name,n,r) for name in ['writing-additions.tsv','secondary-writing-additions.tsv','secondary-writing-2.tsv'] for n,r in rows(name)]
for name,n,r in writing_rows:
 writing_batch={'writing-additions.tsv':'japanese-writing-20261107','secondary-writing-additions.tsv':'japanese-secondary-writing-20261107','secondary-writing-2.tsv':'japanese-secondary-writing-2-20261107'}[name]
 assert len(r)==7,(n,r)
 c,word,reading,hint,left,right,reading_dummies=r
 assert c in scope and c not in old_kanji and c not in hint,(n,c)
 if name.startswith('secondary-writing'):assert not scope[c],f'{c}: elementary additions are disabled for this batch'
 assert word.count(c)==1 and len(left)==1 and 1<=len(right.split('/'))<=2,(n,c)
 if c in kanji_by_char:
  item=kanji_by_char[c]
 else:
  assert scope[c],f'{c}: shared secondary reading source needs explicit writing mapping'
  item=dict(id=f'jr_jp_write_{ord(c):x}',school_level='小学',grade='小'+str(elementary_grades[c]),subject='国語',field='漢字',unit='漢字',content_status='reserved-for-elementary',kind='kanji',character=c,word=word,reading=reading,reading_dummies=reading_dummies.split(','),sentence=hint,note=f'{word}（{reading}）。',content_batch=writing_batch)
  bank.append(item)
 item.update(writing_word=word,writing_reading=reading,writing_hint=hint,writing_target_index=word.index(c),writing_note=f'{word}（{reading}）。',writing_batch=writing_batch,writing_profile='lr-parts-v1',writing_scope='elementary-1026' if scope[c] else 'secondary-1110')
 radicals='日言氵亻木忄阝扌糸禾土舟金貝月王'
 if name.startswith('secondary-writing'):radicals+='女冫彳山巾弓口子歹'
 width=40 if left in set(radicals) else 60
 parts=[dict(position='左',answer=left,dummies=glyph_dummies(left,c),box=[0,0,width,100])]
 rights=right.split('/')
 for i,a in enumerate(rights):
  assert len(a)==1 and ord(a)<=0xffff,(n,a)
  parts.append(dict(position='右' if len(rights)==1 else '右上' if i==0 else '右下',answer=a,dummies=glyph_dummies(a,c),box=[width,0 if i==0 else 50,100-width,100 if len(rights)==1 else 50]))
 item['writing_parts']=parts
 if c in shape_revisions:item['writing_revision']=shape_revisions[c]
 if c in writing_deferred:item.update(writing_parts=[],writing_status='pending-glyph-assets',writing_deferred_reason=writing_deferred[c]['reason'])
# Up/down writing reuses the existing rectangular puzzle renderer.
vertical_groups=json.loads((SOURCE/'vertical-glyph-groups.json').read_text())['groups']+groups
vertical_rows=list(rows('vertical-writing.tsv'))
for n,r in vertical_rows:
 assert len(r)==7,(n,r)
 c,word,reading,hint,top,bottom,_=r
 assert c in kanji_by_char and not scope[c] and c not in hint,(n,c)
 item=kanji_by_char[c]
 assert not item['writing_parts'] and c not in writing_deferred,(n,c)
 assert word.count(c)==1 and len(top)==len(bottom)==1 and max(ord(top),ord(bottom))<=0xffff,(n,c)
 height=40 if top in '艹宀穴雨冖罒亠爫竹' else 50
 item.update(writing_word=word,writing_reading=reading,writing_hint=hint,writing_target_index=word.index(c),writing_note=f'{word}（{reading}）。',writing_batch='japanese-vertical-writing-20261107',writing_profile='tb-parts-v1',writing_scope='secondary-1110',writing_parts=[
  dict(position='上',answer=top,dummies=glyph_dummies(top,c,vertical_groups),box=[0,0,100,height]),
  dict(position='下',answer=bottom,dummies=glyph_dummies(bottom,c,vertical_groups),box=[0,height,100,100-height])])
# Additional bounded arrangements; all glyph answers remain in the existing IDs.
compound_layouts=json.loads((SOURCE/'compound-writing-layouts.json').read_text())
compound_groups=json.loads((SOURCE/'compound-glyph-groups.json').read_text())['groups']+vertical_groups
compound_rows=list(rows('compound-writing.tsv'))
for n,r in compound_rows:
 assert len(r)==6,(n,r)
 c,word,reading,hint,layout,answers=r;answers=answers.split('/')
 assert c in kanji_by_char and not scope[c] and c not in hint,(n,c)
 item=kanji_by_char[c]
 assert not item['writing_parts'] and c not in writing_deferred,(n,c)
 assert word.count(c)==1 and all(len(a)==1 and (0x3400<=ord(a)<=0x9fff or 0x30a0<=ord(a)<=0x30ff) for a in answers),(n,c)
 profile='compound-parts-v1'
 if layout=='tb':
  assert len(answers)==2
  h=40 if answers[0] in '艹宀穴雨冖罒亠爫竹' else 50
  positions=['上','下'];boxes=[[0,0,100,h],[0,h,100,100-h]];profile='tb-parts-v1'
 elif layout=='lr-right-split':
  assert len(answers)==3
  positions=['左','右上','右下'];boxes=[[0,0,40,100],[40,0,60,50],[40,50,60,50]];profile='lr-parts-v1'
 else:
  positions=compound_layouts[layout]['positions'];boxes=compound_layouts[layout]['boxes']
 assert len(answers)==len(boxes)==len(positions)
 item.update(writing_word=word,writing_reading=reading,writing_hint=hint,writing_target_index=word.index(c),writing_note=f'{word}（{reading}）。',writing_batch='japanese-compound-writing-20261107',writing_profile=profile,writing_scope='secondary-1110',writing_parts=[dict(position=pos,answer=a,dummies=glyph_dummies(a,c,compound_groups),box=box) for pos,a,box in zip(positions,answers,boxes)])
# Whole-character selection for shapes that should not be split into rectangles.
whole_rows=json.loads((SOURCE/'whole-writing-additions.json').read_text())
for r in whole_rows:
 c=r['character'];word=r['word'];reading=r['reading'];hint=r['context'];options=r['distractors']
 assert c in kanji_by_char and not scope[c],c
 item=kanji_by_char[c];assert not item['writing_parts'],c
 assert word.count(c)==1 and len(options)==4,c
 assert len(hint)<=24 and len(word)<=3 and len(reading)<=6 and (len(reading)+2)*20+len(word)*32+14<=250,(c,'whole-writing display budget')
 values=[x['value'] for x in options]
 assert len(set(values+[c]))==5 and all(len(x)==1 for x in values),c
 roles={role:[x['value'] for x in options if x['role']==role] for role in ['b','c','d']}
 assert list(map(len,roles.values()))==[2,1,1],c
 visible=hint+word.replace(c,'')
 assert not any(x in visible for x in values+[c]),(c,'answer/distractor leaked in prompt')
 item.update(writing_format='whole',writing_word=word,writing_reading=reading,writing_hint=hint,writing_target_index=word.index(c),writing_note=f'{word}（{reading}）。',writing_dummies=values,writing_distractor_groups=roles,writing_batch=r.get('content_batch','japanese-whole-writing-20261108'),writing_scope='secondary-1110')
 item.pop('writing_status',None);item.pop('writing_deferred_reason',None);item.pop('writing_profile',None)
(ROOT/'quiz-data/junior_japanese_extended.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n')
(ROOT/'quiz-data/junior_japanese_kanji.json').write_text(json.dumps(kanji,ensure_ascii=False,indent=2)+'\n')
print('Writing targets compiled:',len(writing_rows)+len(vertical_rows)+len(compound_rows)+len(whole_rows),'(existing character IDs upgraded:',sum(r[0] in kanji_by_char for _,_,r in writing_rows)+len(vertical_rows)+len(compound_rows),')')
