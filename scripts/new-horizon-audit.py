"""Authoring-only spelling inventory. Usage: python3 scripts/new-horizon-audit.py /path/to/official/files"""
import sys,json,hashlib,re
from pathlib import Path
import openpyxl
root=Path(__file__).resolve().parents[1]; source=Path(sys.argv[1])
items=[q for p in (root/'quiz-data').glob('junior_*.json') for q in json.loads(p.read_text()) if q.get('subject')=='英語']
known={}
for q in items:
 if q.get('english'): known.setdefault(q['english'].casefold(),[]).append(q['id'])
report={'checked':'2026-11-05','reference':'NEW HORIZON 2025 edition / 2026 use','scope':'Internal audit only; spelling matches do not verify meaning or completeness.','sources':[],'sheets':[]}
for name,url in [('nh.xlsx','https://ten.tokyo-shoseki.co.jp/text/chu/eigo/download/documents/eigo_19goidata.xlsx')]+[(f'plan{g}.xlsx',f'https://ten.tokyo-shoseki.co.jp/text/chu/eigo/download/documents/R7eigo_saian_{g}_2502.xlsx?20250130') for g in range(1,4)]:
 report['sources'].append({'file':name,'url':url,'sha256':hashlib.sha256((source/name).read_bytes()).hexdigest()})
for s in openpyxl.load_workbook(source/'nh.xlsx',data_only=True).worksheets:
 rows=[]
 for r in range(2,s.max_row+1):
  word=s.cell(r,2).value
  if not isinstance(word,str) or not word.strip(): continue
  word=word.strip(); ids=known.get(word.casefold(),[])
  rows.append({'row':r,'headword':word,'candidateIds':ids,'status':'spelling_match_only' if ids else 'needs_review'})
 report['sheets'].append({'sheet':s.title,'total':len(rows),'spellingMatched':sum(bool(x['candidateIds']) for x in rows),'rows':rows})
report['grammarSourceRows']=[]
for g in range(1,4):
 s=openpyxl.load_workbook(source/f'plan{g}.xlsx',data_only=True).worksheets[0]
 header=next(c.column for c in s[2] if c.value and '文法事項' in str(c.value))
 report['grammarSourceRows'].append({'grade':g,'sheet':s.title,'column':header,'rows':[r for r in range(5,s.max_row+1) if s.cell(r,header).value]})
priority=['job','advice','good','great','danger','trouble','bake','beauty','favorite']
report['priorityLexicalCandidates']=[w for w in priority if w not in known]
report['mainReview']={'path':'new-horizon-main-review.json','scope':'本文Word Listの編集上の最終判断は全行精査台帳を参照。このファイルのstatusは綴り候補段階の状態。'}
(root/'docs/content/new-horizon-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sheets':[{k:v for k,v in s.items() if k!='rows'} for s in report['sheets']],'priority':report['priorityLexicalCandidates']},ensure_ascii=False))
