import json,hashlib,collections
from pathlib import Path
root=Path(__file__).resolve().parent.parent
version=json.loads((root/'package.json').read_text())['version']
items=[q for name in ['junior_japanese','junior_expansion','junior_japanese_kanji','junior_japanese_extended'] for q in json.load(open(root/f'quiz-data/{name}.json')) if q.get('subject')=='国語' and q['school_level']=='中学']
# Each row below corresponds to a leaf in 第2・2内容. 書写 parents are replaced by their inner items.
raw='''
1|K1-a|音声の働きと仕組み|t:sound|
1|K1-b|常用漢字300〜400字程度を加えて読む・小学漢字900字程度を書く|kanji|小学配当漢字の実書は小学の部へ保留
1|K1-c|事象・行為・心情の語彙と辞書的意味・文脈上の意味|t:vocabulary;p:語の辞書的な意味|
1|K1-d|単語の類別・指示する語句・接続する語句|k:自立語;k:接続詞;p:指示語の内容|
1|K1-e|比喩・反復・倒置・体言止め|t:rhetoric;k:直喩;k:倒置法|
1|K2-a|原因と結果・意見と根拠|t:relations;p:事実と意見|
1|K2-b|比較・分類・関係付け・引用と出典|t:organize;t:quotation|
1|K3-a|音読に必要な文語のきまり・訓読と古典のリズム|t:classical-form;t:kanbun-reading|音読の実践は別練習
1|K3-b|古典の様々な種類|t:classical-culture|作品を読む活動は別練習
1|K3-c|共通語と方言の役割|t:dialect|
1|K3-d-a|字形・大きさ・配列を整えて楷書で書く|t:shosha|実際の硬筆・毛筆による書写は別練習
1|K3-d-b|漢字の行書の基礎と身近な字の行書|t:shosha|実際の硬筆・毛筆による書写は別練習
1|K3-e|読書で知識を得て考えを広げる意義|t:reading-life|実際の読書は別練習
1|A1-a|日常生活から話題を選び材料を整理|t:speaking-topic|実際の話題選び・調査・発表は別練習
1|A1-b|中心と補足・事実と意見を踏まえた話の構成|t:speaking-structure|実際の発表は別練習
1|A1-c|相手の反応を踏まえた表現の工夫|p:聞き手に要点を;t:speaking-structure|相手の反応を見て話す実践は別練習
1|A1-d|記録・質問・共通点相違点から自分の考えをまとめる|t:listening|音声の聞き取りと質問は別練習
1|A1-e|話題と展開を捉え発言を結び付ける話し合い|t:discussion|実際の話し合いは別練習
1|B1-a|目的に応じた題材・材料の整理と伝える中心|t:writing-plan|実際の構想と作文は別練習
1|B1-b|中心を明確にする段落の役割と文章の構成|p:段落の要点;p:文章全体;t:writing-plan|実際の作文は別練習
1|B1-c|根拠を明確にする表現|p:意見を伝える文章で|実際の作文は別練習
1|B1-d|読み手を考えた表記・用法・叙述の推敲|t:revision|実際の推敲は別練習
1|B1-e|根拠についての助言を生かした改善|t:revision|助言を受けて書き直す実践は別練習
1|C1-a|中心と補足・事実と意見・要旨|t:expository-reading;p:段落の要点;p:事実と意見|
1|C1-b|場面・人物関係・心情変化と描写|t:literary-reading;p:人物の心情|
1|C1-c|目的に応じた要約・場面や描写の関連付け|t:expository-reading;t:literary-reading|長文の実読は別練習
1|C1-d|構成・展開・表現の効果を根拠から考える|t:rhetoric|長文の実読は別練習
1|C1-e|読んだ理解を基に自分の考えを確かにする|t:critical-reading;t:reading-life|実際の読書と意見形成は別練習
2|K1-a|言葉が相手の行動を促す働き|t:language-functions|
2|K1-b|話し言葉と書き言葉の特徴|p:話し言葉で補えるが;p:書き言葉の文|
2|K1-c|常用漢字350〜450字程度を加えて読む・小学漢字を書く|kanji|小学配当漢字の実書は小学の部へ保留
2|K1-d|抽象語彙・類義反義・同音異義・多義|t:vocabulary;p:近い意味;p:同音異義;k:類義語;k:対義語|
2|K1-e|活用・助詞助動詞・順序照応・構成展開|t:inflection;t:particles;p:文の主語と|
2|K1-f|敬語の働きと使用|t:respect;k:尊敬語;k:謙譲語|
2|K2-a|意見と根拠・具体と抽象|t:abstraction;p:根拠と|
2|K2-b|情報の関係の様々な表し方|t:organize|
2|K3-a|作品の特徴を生かした古典の朗読|t:kanbun-culture;t:classical-form|古文・漢文の実際の朗読は別練習
2|K3-b|現代語訳や語注から古典の見方考え方を知る|t:classical-culture|作品を読む活動は別練習
2|K3-c-a|行書と調和した仮名・読みやすく速い書写|t:shosha|実際の硬筆・毛筆による書写は別練習
2|K3-c-b|目的に応じた楷書・行書の選択|t:shosha|実際の書写は別練習
2|K3-d|様々な立場や考えを知り読書へ生かす|t:reading-life|実際の読書は別練習
2|A1-a|社会生活から話題を選び異なる立場を想定|t:speaking-topic|実際の調査・発表は別練習
2|A1-b|立場と根拠・論理が明確な話の構成|t:speaking-structure|実際の発表は別練習
2|A1-c|資料や機器を用いた表現の工夫|t:speaking-structure|資料を用いる実際の発表は別練習
2|A1-d|論理に注意し聞いた意見と自分の考えを比較|t:listening|音声を聞く実践は別練習
2|A1-e|互いの立場を尊重し結論を導く話し合い|t:discussion|実際の討論は別練習
2|B1-a|多様な方法による材料の収集と中心の明確化|t:writing-plan|実際の調査と作文は別練習
2|B1-b|段落相互の関係を明確にした構成展開|t:writing-plan|実際の作文は別練習
2|B1-c|根拠・例・描写の効果を工夫した表現|t:writing-expression|実際の作文は別練習
2|B1-d|読み手から表現の効果を確かめて推敲|t:revision|実際の推敲は別練習
2|B1-e|表現の工夫と効果についての助言を生かした改善|t:revision|助言を受けた書き直しは別練習
2|C1-a|全体と部分・主張と例示・人物の設定|t:expository-reading;t:literary-reading|
2|C1-b|複数情報の整理・言動の意味の解釈|t:multiple-sources;t:literary-reading|長文の実読は別練習
2|C1-c|文章と図表の関係を踏まえた解釈|t:multiple-sources|複雑な図表と長文の実読は別練習
2|C1-d|観点を明確にした文章の比較と効果の検討|t:critical-reading;p:複数の本を比べて|
2|C1-e|読みを知識や経験に結び付け考えを広げ深める|t:reading-life;t:critical-reading|実際の読書は別練習
3|K1-a|常用漢字の大体を読む・小学漢字を使い慣れる|kanji|小学配当漢字の実書は小学の部へ保留
3|K1-b|慣用句四字熟語・和語漢語外来語等の使用|t:idioms;p:和語;k:和語;k:漢語;k:外来語|
3|K1-c|話や文章の種類と特徴|p:文章の種類;t:classical-culture|
3|K1-d|敬語など相手や場に応じた言葉遣い|t:respect|
3|K2-a|具体と抽象の関係の理解を深める|t:abstraction|
3|K2-b|情報の信頼性を確かめる|t:credibility|
3|K3-a|歴史的背景に注意した古典の読解|t:classical-culture|古典作品の実読は別練習
3|K3-b|親しまれた言葉・古典の一節の引用活用|t:classical-culture|実際の文章での引用使用は別練習
3|K3-c|時代や世代による言葉の違い|t:language-change|
3|K3-d-a|多様な文字文化に触れ効果的に文字を書く|t:shosha|実際の書写や作品制作は別練習
3|K3-e|生き方や社会との関わりを支える読書|t:reading-life|実際の読書は別練習
3|A1-a|多様な考えを想定し話題と材料を検討|t:speaking-topic|実際の調査と発表は別練習
3|A1-b|相手を説得する論理と話の構成|t:speaking-structure|実際の発表は別練習
3|A1-c|場の状況に応じた言葉の選択|t:speaking-structure;t:respect|実際の対話は別練習
3|A1-d|展開を予測し聞いた内容や表現を評価|t:listening|音声の聞き取りは別練習
3|A1-e|進行や発言を生かした合意形成|t:discussion|実際の討論は別練習
3|B1-a|材料の客観性と信頼性・伝える中心|t:credibility|実際の調査と作文は別練習
3|B1-b|文章の種類と多様な読み手を考えた説得|t:writing-plan;t:writing-expression|実際の作文は別練習
3|B1-c|表現や資料の引用による明確化|t:quotation;t:writing-expression|実際の作文は別練習
3|B1-d|目的や意図に照らした文章全体の推敲|t:revision|実際の推敲は別練習
3|B1-e|論理の展開についての助言を生かす改善|t:revision|助言を受けて書き直す実践は別練習
3|C1-a|文章の種類を踏まえた論理・物語の展開|t:expository-reading;t:literary-reading|
3|C1-b|批判的に読みものの見方や考え方を考える|t:critical-reading|
3|C1-c|構成・論理・表現の評価|t:critical-reading;t:expository-reading|
3|C1-d|読後の考えを広げ自分の意見をもつ|t:critical-reading;t:reading-life|長文の実読と意見形成は別練習
'''
activities='''
1|A2-a|紹介や報告を話し質問や意見を述べる|t:speaking-topic;t:listening
1|A2-b|少人数で互いの考えを伝え話し合う|t:discussion
1|B2-a|資料や図表を引用した説明・記録を書く|t:quotation
1|B2-b|案内や報告の文章を書く|t:practical-writing
1|B2-c|詩や随筆を創作する|t:rhetoric
1|C2-a|説明や記録を読み報告・文章にまとめる|t:expository-reading
1|C2-b|小説や随筆を読み考えを記録・共有|t:literary-reading
1|C2-c|学校図書館などで情報を得て資料にまとめる|t:reading-life
2|A2-a|説明・提案を話し質問や助言を述べる|t:speaking-topic;t:listening
2|A2-b|立場を踏まえ議論や討論をする|t:discussion
2|B2-a|様々な考えができる事柄について意見を書く|t:writing-expression
2|B2-b|相手や媒体に応じた手紙やメールを書く|t:practical-writing
2|B2-c|短歌・俳句・物語を創作する|t:classical-form;t:literary-reading
2|C2-a|報告や解説を読み理解や考えを説明する|t:expository-reading
2|C2-b|詩歌や小説を読み引用して解説する|t:literary-reading;t:quotation
2|C2-c|新聞・本・ネットの情報を出典付きで活用|t:quotation;t:reading-life
3|A2-a|提案や主張を話し質問・評価を述べる|t:speaking-structure;t:listening
3|A2-b|互いの考えを生かし議論・討論|t:discussion
3|B2-a|関心のある事柄を批評する文章を書く|t:writing-expression
3|B2-b|情報を編集し文章にまとめる|t:practical-writing
3|C2-a|論説や報道を比較して討論・文章化する|t:critical-reading
3|C2-b|詩歌や小説を読み批評や考えを共有|t:literary-reading;t:critical-reading
3|C2-c|実用文を読み生活への生かし方を考える|t:multiple-sources
'''
def text(q):return q.get('prompt') or q.get('term') or ''
def resolve(refs,g):
 out=[]
 for token in refs.split(';'):
  if token=='kanji':matches=[q for q in items if q['kind']=='kanji' and q.get('reading_enabled') is not False]
  elif token.startswith('t:'):matches=[q for q in items if token[2:] in q.get('curriculum_topics',[])]
  elif token.startswith('p:'):matches=[q for q in items if token[2:] in text(q)]
  elif token.startswith('k:'):matches=[q for q in items if q.get('term')==token[2:]]
  else:raise ValueError(token)
  out.extend(q['id'] for q in matches if q['grade']=='中'+str(g))
 return list(dict.fromkeys(out))
rows=[]
for l in raw.strip().splitlines():
 g,code,label,refs,outside=l.split('|');g=int(g);key=f'g{g}-{code}';evidence=resolve(refs,g)
 evidence+= [q['id'] for q in items if key in q.get('official_items',[]) and q['grade']==f'中{g}']
 rows.append({'key':key,'grade':f'中{g}','section':code,'requirement':label,'materialIds':list(dict.fromkeys(evidence)),'actualActivity':outside or '学習内容を実際の言語活動で使うことは別練習','elementaryWritingDeferred':refs=='kanji','status':'knowledge-supported' if evidence else 'knowledge-gap'})
acts=[]
for l in activities.strip().splitlines():
 g,code,label,refs=l.split('|');g=int(g);key=f'g{g}-{code}';evidence=resolve(refs,g)+[q['id'] for q in items if key in q.get('official_items',[]) and q['grade']==f'中{g}']
 acts.append({'key':key,'grade':f'中{g}','section':code,'activityExample':label,'supportingMaterialIds':list(dict.fromkeys(evidence)),'status':'knowledge-support-only','actualActivity':'実際に話す・聞く・書く・読む言語活動はゲーム外で行う'})
assert len(rows)==81 and len(acts)==23
report={'version':version,'date':'2026-11-08','source':json.load(open(root/'docs/content/japanese-curriculum-review.json'))['source'],'countingRule':'第2・各学年2内容の知識及び技能とA/B/C(1)をイロハ細目で数える。書写は親項目を内側の細目に置き換えるため81行。A/B/C(2)の言語活動例23行は別記。公式が完了率用に定義した項目数ではない。目標・授業時数など指導計画は出題項目数へ算入しない。','gradeRule':'同じ学年のコースに出る素材のみを対応IDとして掲載する。知識ポイントの出題先を示し、実技能の履修・習熟の代替ではない。','rows':rows,'activityExamples':acts,'summary':{'instructionLeaves':len(rows),'knowledgeSupported':sum(bool(x['materialIds']) for x in rows),'knowledgeGaps':[x['key'] for x in rows if not x['materialIds']],'activityExamples':len(acts)}}
(root/'docs/content/japanese-official-items.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
for r in rows:
 if not r['materialIds']:print('GAP',r['key'],r['requirement'])
print(report['summary'])

lines=['# 中学国語：学年別の公式項目との対応', '', '更新：2026-11-08 / v'+version, '', '文部科学省『中学校学習指導要領解説 国語編』付録3、印刷頁158〜163を参照。項目名は要約で、全文転載ではない。', '', report['countingRule'], '', report['gradeRule'], '', '**81項目すべてに同学年の知識・判断問題を対応付けた。各項目の全要素・用例や実技を網羅したという完了判定ではない。** 小学漢字の実書はユーザー指定により保留。中学漢字の学年配当は暫定分類で、文科省による字別固定配当ではない。', '', 'v0.77.0で学年別の不足へ26素材を追加。v0.78.0で追加音訓・付表語の補強と内容確認を実施し、[基礎版整備を一区切り](japanese-completion.md)とした。既存のIDと回答履歴、選択肢は維持。', '', '[公式資料]('+report['source']['url']+') / [機械用の素材ID一覧](japanese-official-items.json)', '', '| 学年 | 項目 | 内容の要約 | 同学年の対応素材数 | 別途練習・留意事項 |', '| --- | --- | --- | ---: | --- |']
for r in rows:lines.append('| '+ ' | '.join([r['grade'],r['section'],r['requirement'],str(len(r['materialIds'])),r['actualActivity']])+' |')
lines+=['', '## 言語活動例（実技の完了数にはしない）', '', '以下23例はポイントを覚える支援と実際の活動を区別する。関連素材の存在はその活動をゲーム内で実施できるという意味ではない。', '', '| 学年 | 項目 | 活動例の要約 | 関連素材数 |', '| --- | --- | --- | ---: |']
for r in acts:lines.append('| '+' | '.join([r['grade'],r['section'],r['activityExample'],str(len(r['supportingMaterialIds']))])+' |')
(root/'docs/content/japanese-official-items.md').write_text('\n'.join(lines)+'\n')
