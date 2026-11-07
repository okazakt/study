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
for n,r in rows('choice-additions.tsv'):
 assert len(r)==9,(n,r)
 grade,field,unit,prompt,answer,*rest=r;dummies=rest[:3];note=rest[3]
 q=base('choice',grade,field,unit,prompt);q.update(prompt=prompt,answer=answer,dummies=dummies,note=note,task='適切なものを選ぼう');bank.append(q)
idioms=[r for _,r in rows('idiom-additions.tsv')]
# These related pairs are never offered against one another as interchangeable distractors.
related=[['因果応報','自業自得'],['一心不乱','無我夢中'],['公明正大','正々堂々'],['五里霧中','右往左往'],['頭が下がる','舌を巻く'],['鼻が高い','鼻にかける'],['油を売る','道草を食う']]
for i,(grade,unit,term,definition) in enumerate(idioms):
 same=[r for r in idioms if r[1]==unit];pos=next(j for j,r in enumerate(same) if r[2]==term)
 others=[]
 for offset in [4,11,19,*range(1,len(same))]:
  r=same[(pos+offset)%len(same)]
  if r[2]!=term and r not in others and not any(term in pair and r[2] in pair for pair in related):others.append(r)
  if len(others)==3:break
 q=base('idiom',grade,'熟語・四字熟語',unit,term);q.update(term=term,definition=definition,term_dummies=[r[2] for r in others],definition_dummies=[r[3] for r in others],note=f'{term}：{definition}');bank.append(q)
(ROOT/'quiz-data/junior_japanese_extended.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n')
print('Japanese core additions:',len(bank),'materials')

kanji=[]
for n,r in rows('kanji-readings.tsv'):
 assert len(r)==5,(n,r)
 c,word,reading,dummies,grade=r
 item=dict(id=f'jr_jp_joyo_{ord(c):x}',school_level='中学',grade=grade,subject='国語',field='漢字',unit='常用漢字の読み',kind='kanji',word=word,character=c,reading=reading,reading_dummies=dummies.split(','),sentence='語句の読みを選ぼう。',writing_hint='',writing_target_index=word.index(c),writing_parts=[],note=f'{word}（{reading}）。',content_batch='japanese-joyo-20261107',kanji_scope='secondary-1110',reading_sources=['bunka-joyo','jmdict-furigana-20261025'])
 kanji.append(item)
(ROOT/'quiz-data/junior_japanese_kanji.json').write_text(json.dumps(kanji,ensure_ascii=False,indent=2)+'\n')
print('Japanese kanji reading additions:',len(kanji),'materials')
