"""Authoring-only assembler from editorial tables. No runtime generation or textbook text."""
import json,re,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[1];D=R/'docs/content';A=D/'nh-content'
def read(p):return json.loads(p.read_text())
def write(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def tsv(name):return [s.split('\t') for s in (A/name).read_text().splitlines() if s.strip() and not s.startswith('#')]
review=read(D/'new-horizon-main-review.json');rows={r['row']:r for r in review['rows']}
groups=read(A/'vocabulary-groups.json');byrow={r:g for g in groups for r in g['rows']}
primary={int(r):(meaning,context) for r,meaning,context in tsv('primary-contexts.tsv')}
BATCH='english-new-horizon-1';words=[];grammar=[];mapping={}
def base(id,grade,field,unit):return {'id':id,'school_level':'中学','grade':grade,'subject':'英語','field':field,'unit':unit,'content_batch':BATCH}
def pairs(s):return [x.split(':',1) for x in s.split('|')]
def spelling(w):
 # Equal-length choices for every chunk prevent ambiguous alternative splits.
 segments=[];template='';start=0
 for i in range(0,len(w),3):
  ans=w[i:i+3];ds=[]
  for c in 'aeioustrn':
   wrong=ans[:-1]+c
   if wrong!=ans and wrong not in ds:ds.append(wrong)
   if len(ds)==3:break
  segments.append({'index':len(segments)+1,'answer':ans,'dummies':ds});template+='{{'+str(len(segments))+'}}'
 return template,segments
def word(row,word,meaning,pool,grade,unit,suffix='primary',context=''):
 # Pools are editorially selected contrast concepts; no synonym expansion.
 id=f'jr_en_nh_{row:04d}_{suffix}'
 choice=[(e,j) for e,j in pool if e.casefold()!=word.casefold() and j!=meaning]
 assert len(choice)>=3,(row,word)
 shift=row%len(choice);choice=(choice[shift:]+choice[:shift])[:3]
 q=base(id,grade,'熟語' if ' ' in word else '英単語',unit)
 q.update(english=word,japanese=meaning,english_dummies=[e for e,j in choice],japanese_dummies=[j for e,j in choice],note=f'{word}：{meaning}。この問題ではこの意味を確認する。',meaning_id=id,lexical_group=id,new_horizon_rows=[row])
 if context:q['meaning_context']=context
 if ' ' in word:
  tokens=word.split(' ');index=next((i for i,t in enumerate(tokens) if len(t)>2),0)
  # One important word per material; the rest remains visible.
  ds=[]
  for e,j in choice:
   token=e.split(' ')[0]
   if token!=tokens[index] and token not in ds:ds.append(token)
  for token in ['city','school','water','book']:
   if len(ds)==3:break
   if token!=tokens[index] and token not in ds:ds.append(token)
  q['phrase_blanks']=[{'index':index+1,'answer':tokens[index],'dummies':ds}]
 else:q['spelling_template'],q['spelling']=spelling(word)
 words.append(q);mapping.setdefault(row,[]).append(id)
 return q
def point(row,prompt,answer,dummies,unit='語形と文法語',note=None):
 id=f'jr_en_nh_{row:04d}_form'
 q=base(id,'中2','英文法',unit);q.update(kind='choice',task='適切なものを選ぼう',prompt=prompt,answer=answer,dummies=dummies,note=note or rows[row]['meaning'],new_horizon_rows=[row],learning_point=f'nh-form-{row}')
 grammar.append(q);mapping.setdefault(row,[]).append(id)
# Additional basic headwords, one meaning per material where senses differ.
for row,g in sorted(byrow.items()):
 r=rows[row];meaning,context=primary.get(row,(r['meaning'],''))
 if row==4:meaning='〜できる能力がある'
 assert not re.search(re.escape(r['headword']),meaning,re.I),(row,'answer leaks into Japanese')
 word(row,r['headword'],meaning,g['pool'],g['grade'],g['unit'],context=context)
# Known separate senses of existing and newly added headwords. Distinct stable IDs/history.
for name,label in [('meaning-contexts.tsv','sense'),('new-secondary-meanings.tsv','extra')]:
 counts={}
 for row,meaning,context,pool,meaningKey in tsv(name):
  row=int(row);counts[row]=counts.get(row,0)+1
  word(row,rows[row]['headword'],meaning,pairs(pool),'中2','文脈で区別する意味',meaningKey,context)
functions={int(row):(p,a,ds.split('|')) for row,p,a,ds in tsv('function-questions.tsv')}
abbreviations={int(row):(p,a,ds.split('|')) for row,p,a,ds in tsv('abbreviation-questions.tsv')}
for row,r in rows.items():
 c=r['decision'];w=r['headword']
 if c in ['existing_basic_entry','existing_named_entry','source_distinguished_sense_mismatch','add_lexical_entry']:continue
 if row in functions:
  p,a,ds=functions[row];point(row,p,a,ds);continue
 if row in abbreviations:
  p,a,ds=abbreviations[row];point(row,p,a,ds,'略語・時刻');continue
 if c in ['name','name_alias','calendar']:
  meaning=r['meaning'];meaning=meaning.split('。')[0]
  if row==50:meaning='アメリカ（地域名）'
  if row in [27,51,89,190,469]:meaning=meaning.split('・')[0]
  pool=pairs('India:インド|Canada:カナダ|Brazil:ブラジル|Germany:ドイツ|Italy:イタリア|Japan:日本')
  if row in [27,51,89,190,469]:pool=pairs('Japanese:日本の|Chinese:中国の|Italian:イタリアの|French:フランスの')
  if c=='calendar':pool=pairs('Monday:月曜日|Tuesday:火曜日|Wednesday:水曜日|Thursday:木曜日') if row in [1282,1472] else pairs('Sports Day:運動会|Culture Day:文化の日|New Year:新年|Easter:復活祭|Halloween:ハロウィーン')
  if row==50:pool=pairs('Europe:ヨーロッパ|Asia:アジア|Africa:アフリカ|Oceania:オセアニア')
  word(row,w,meaning,pool,'中1','地理・暦・文化');continue
 if c=='alias':
  meaning={157:'自転車（口語）',483:'電子メール',1039:'了解・よい'}[row]
  pool={157:'bus:バス|car:自動車|train:列車|boat:船',483:'letter:手紙|postcard:はがき|parcel:小包|telegram:電報',1039:'sorry:ごめんなさい|thanks:ありがとう|goodbye:さようなら|ouch:痛い'}[row]
  word(row,w,meaning,pairs(pool),'中1','別表記・口語');continue
 if c=='contraction':
  expansions=r['baseHeadwords']
  if row==1764:expansions=['here is']
  ans=' / '.join(expansions)
  if len(expansions)>1:ds=['主語 + will / can','主語 + was / were','主語 + do / did']
  elif expansions[0].endswith(' not'):ds=['is not','are not','was not','were not','do not','does not','did not','have not','has not','will not','would not','can not','could not','must not']
  else:ds=['I am','he is','we are','they have','you will','let us']
  ds=[x for x in ds if x not in expansions and x!=ans][:3]
  point(row,f'{w}：短縮前の形は？',ans,ds,'短縮形',r['meaning']);continue
 if c in ['inflection','source_distinguished_inflection']:
  original=r['baseHeadwords'][0];pool=['eat','go','buy','see','take','write','speak','have','do','make','come','give']
  if w in ['children','teeth']:pool=['child','tooth','foot','mouse','woman']
  point(row,f'{w}：対応する原形を選ぼう',original,[x for x in pool if x!=original][:3],'不規則な語形',r['meaning']);continue
 if c=='inflection_sense_gap':
  point(row,'be born の意味は？','生まれる',['成長する','生き残る','死ぬ'],'不規則な語形','bornは出生に関するbearの過去分詞。動物のクマとは区別する。');continue
 if c=='degree':
  ans={150:'good / well',152:'good / well',859:'little',955:'many / much',959:'many / much'}[row]
  ds=['bad / badly','few / little','far / late'] if row!=859 else ['few','much','many']
  point(row,f'{w}：対応する原級は？',ans,ds,'比較変化');continue
 if c=='ambiguous_form':
  options={882:('lifeの複数 / liveの三単現',['lifeの過去 / liveの複数','lieの過去 / liveの過去','liveの過去分詞 / lieの複数']),1264:('riseの過去形／バラ',['riseの過去分詞 / 百合の名詞','raiseの過去 / 蘭の名詞','riseの現在分詞 / 桜の名詞']),1549:('thinkの過去・過去分詞／思考',['teachの過去 / 授業の名詞','thinkの現在分詞 / 理由の名詞','thankの過去 / 感謝の名詞'])}
  a,ds=options[row];point(row,f'{w}の語形・意味は？',a,ds,'文脈で区別する語形');continue
 raise ValueError((row,c))
# Contrast-pool exceptions reviewed against overlapping senses and parent/subtype meanings.
exceptions={
 295:'material:材料|design:デザイン|fashion:流行',
 433:'yen:円|euro:ユーロ|pound:ポンド',
 548:'cause:原因|effect:効果|purpose:目的',
 578:'color:色|shape:形|texture:食感',
 652:'price:価格|discount:割引|profit:利益',
 658:'grandpa:おじいちゃん|uncle:おじ|aunt:おば',
 660:'grandma:おばあちゃん|uncle:おじ|aunt:おば',
 771:'responsibility:責任|equality:平等|cooperation:協力',
 821:'meter:メートル|centimeter:センチメートル|mile:マイル',
 879:'milliliter:ミリリットル|gallon:ガロン|gram:グラム',
 934:'kilometer:キロメートル|centimeter:センチメートル|mile:マイル',
 946:'daddy:パパ|sister:姉・妹|brother:兄・弟',
 1012:'opposition:反対|resistance:抵抗|agreement:合意',
 1096:'degree:度|fraction:分数|decimal:小数',
 1146:'voltage:電圧|current:電流|frequency:周波数',
 1178:'quantity:量|price:価格|size:大きさ',
 1261:'purpose:目的|method:方法|result:結果',
 1401:'daughter:娘|father:父|mother:母',
 1435:'visitor:訪問者|customer:客|applicant:応募者',
 1446:'textbook:教科書|uniform:制服|furniture:家具',
 1484:'growth:成長|evolution:進化|extinction:絶滅',
 1557:'frequency:頻度|speed:速さ|distance:距離',
 1568:'kilogram:キログラム|gram:グラム|pound:ポンド',
 1654:'owner:所有者|resident:居住者|manager:管理者',
 1728:'employer:雇用主|retiree:退職者|applicant:応募者',
 166:'brain:脳|skin:皮膚|blood:血液',
 411:'material:材料|signal:信号|method:方法',
 825:'queen:女王|prince:王子|president:大統領',
 1180:'king:王|princess:王女|empress:女帝',
 1313:'router:ルーター|browser:ブラウザー|keyboard:キーボード',
 1439:'result:結果|method:方法|purpose:目的',
 538:'heater:暖房器具|radio:ラジオ|lamp:ランプ',
 799:'price:価格|quantity:数量|quality:質',
 530:'budget:予算|staff:職員|policy:方針',
 328:'seller:売り手|producer:生産者|wholesaler:卸売業者',
 485:'queen:女王|prince:王子|princess:王女',
 1110:'cake:ケーキ|cookie:クッキー|pudding:プリン',
 776:'recipe:料理の作り方|menu:献立|portion:一人分',
 824:'honesty:正直さ|courage:勇気|patience:忍耐',
 807:'salary:給料|workplace:職場|employer:雇用主',
 111:'wallet:財布|ticket:切符|passport:旅券',
 712:'goodbye:さようなら|thanks:ありがとう|sorry:ごめんなさい',
 713:'goodbye:さようなら|thanks:ありがとう|sorry:ごめんなさい',
 1037:'goodbye:さようなら|thanks:ありがとう|sorry:ごめんなさい',
 1048:'thanks:ありがとう|goodbye:さようなら|yes:はい',
 1735:'ouch:痛い|hmm:うーん|shh:しーっ',
 1108:'poem:詩|rhythm:リズム|instrument:楽器',
 445:'melody:旋律|rhythm:リズム|instrument:楽器',
 1104:'poem:詩|melody:旋律|instrument:楽器',
 1641:'rate:割合|speed:速さ|average:平均',
 1069:'piece:一片|half:半分|whole:全体',
 1726:'sentence:文|letter:文字|paragraph:段落',
 670:'member:構成員|leader:指導者|individual:個人',
 893:'number:個数|total:合計|remainder:残り'
}
for q in words:
 if q['id'] in {'jr_en_nh_0915_extra1','jr_en_nh_1254_extra1','jr_en_nh_1687_extra1'}:q['content_batch']='english-new-horizon-senses-2'
 row=q['new_horizon_rows'][0]
 if q['id'].endswith('_primary') and row in exceptions:
  pool=pairs(exceptions[row]);q['english_dummies']=[e for e,j in pool];q['japanese_dummies']=[j for e,j in pool]
# An explicit mapping chooses the source-noted sense, not any same-spelling material.
for row,r in rows.items():
 if r['decision'] in ['existing_basic_entry','existing_named_entry']:
  mapping.setdefault(row,[]).insert(0,r['existingEntries'][0]['id'])
 elif r['decision']=='source_distinguished_sense_mismatch':
  assert any('_sense' in i for i in mapping.get(row,[])),row
assert set(mapping)==set(rows)
write(R/'quiz-data/junior_english_new_horizon.json',words+grammar)
write(A/'row-material-map.json',{'source':review['source'],'denominator':1789,'definition':'公開本文Word Listの各行に、代表語義・語形・略語等を直接学べる独自素材を対応。本文全用法の保証ではない。','rows':[{'row':row,'headword':rows[row]['headword'],'materialIds':ids} for row,ids in sorted(mapping.items())]})
print(json.dumps({'vocabulary':len(words),'grammar':len(grammar),'rowsMapped':len(mapping)},ensure_ascii=False))
