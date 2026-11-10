"""Independent symbolic check of the exported finite numerical presentations.
Usage: export generator/parameters/steps as JSON, then pass that path.
Authoring check only; no playback or app tests. Uses installed SymPy.
"""
import json,re,sys
import sympy as sp
from sympy.parsing.sympy_parser import parse_expr,standard_transformations,implicit_multiplication_application,convert_xor
x,a_symbol,y=sp.symbols('x a y',real=True)
transforms=standard_transformations+(implicit_multiplication_application,convert_xor)
def expr(s):
 s=s.replace('−','-').replace('＋','+').replace('×','*').replace('÷','/').replace('²','^2').replace('³','^3')
 s=re.sub(r'√(\d+)',r'sqrt(\1)',s)
 assert re.fullmatch(r'[0-9xay\s+\-*/()^sqrt.]+',s),s
 return parse_expr(s,local_dict={'x':x,'a':a_symbol,'y':y,'sqrt':sp.sqrt},transformations=transforms)
def solutions(s,positive=False):
 if '，' in s and s.startswith('x＝'):
  return frozenset(expr(v) for v in s[2:].split('，'))
 result=set()
 for sign in [1,-1] if '±' in s else [1]:
  candidate=s.replace('±','' if sign==1 else '−');lhs,rhs=candidate.split('＝')
  result.update(sp.solve(expr(lhs)-expr(rhs),x))
 return frozenset(v for v in result if not positive or v>0)
def coord(s):
 v=s.split('＝')[-1].strip('()').split(',')
 return tuple(expr(z) for z in v)
def expected(g,p,i):
 # Values here are derived independently from the numerical problem conditions.
 a=p.get('a');b=p.get('b');k=p.get('k');d=p.get('d')
 if g=='signed':return 'expr',-a+b+2
 if g=='distribute':return 'expr',a*(x+b)-x
 if g in ['linear','fraction_equation']:return 'roots',frozenset([sp.Integer(p['x'])])
 if g=='proportion':return ('expr',a*x) if i==0 else ('expr',a*p['z'])
 if g=='inverse':return ('expr',a/x) if i==0 else ('expr',sp.Rational(a,6))
 if g=='monomial':return 'expr',b*a_symbol
 if g=='elimination':return ('pair',(sp.Integer(p['x']),sp.Integer(p['y']))) if i==2 else ('roots',frozenset([sp.Integer(p['x'])]))
 if g=='substitution':return ('pair',(sp.Integer(p['x']),sp.Integer(p['y']))) if i==3 else ('roots',frozenset([sp.Integer(p['x'])]))
 if g=='function':return ('expr',a) if i==0 else ('expr',a*x+b)
 if g=='intersection':return ('pair',(sp.Integer(p['x']),sp.Integer(p['y']))) if i==2 else ('roots',frozenset([sp.Integer(p['x'])]))
 if g=='expansion':return 'expr',(x+a)*(x+b)
 if g=='factor':return 'expr',k*(x+a)*(x+b)
 if g=='difference':return 'roots',frozenset([-sp.Integer(a),sp.Integer(a)])
 if g=='radical':return 'expr',(k+1)*sp.sqrt(d)
 if g=='rationalize':return 'expr',a/sp.sqrt(d)
 if g=='quadratic_factor':return 'roots',frozenset([sp.Integer(a),sp.Integer(b)])
 if g=='quadratic_square':return 'roots',frozenset([-sp.Integer(a)-b,-sp.Integer(a)+b])
 if g=='similarity':return ('roots',frozenset([sp.Integer(a*b)])) if i==0 else ('expr',a*b)
 if g=='pythagoras':return 'positive_roots',frozenset([sp.Integer(p['c'])])
 if g=='angle':return ('roots',frozenset([sp.Integer(2*a)])) if i==0 else ('expr',2*a)
 if g=='probability':return 'expr', k if i==0 else sp.Rational(k,6)
 if g=='mean':return 'expr',3*a+3 if i==0 else a+1
 if g=='sampling':return 'expr',sp.Rational(a,10) if i==0 else sp.Rational(p['total']*a,10)
 raise ValueError(g)
def normalized(s,kind):
 if kind in ['roots','positive_roots']:return solutions(s,kind=='positive_roots')
 if kind=='pair':return coord(s)
 return sp.simplify(expr(s.split('＝')[-1]))
errors=[];stages=0
for row in json.load(open(sys.argv[1])):
 for i,step in enumerate(row['steps']):
  stages+=1;kind,answer=expected(row['generator'],row['parameters'],i)
  options=[step['answer']]+step['dummies']
  try:
   values=[normalized(s,kind) for s in options]
   matches=[v==answer if kind!='expr' else sp.simplify(v-answer)==0 for v in values]
   if matches!=[True,False,False,False]:errors.append([row['generator'],row['parameters'],i,'answer-equivalence',options,matches])
   if len(set(values))!=4:errors.append([row['generator'],row['parameters'],i,'equivalent-distractors',options])
  except Exception as e:errors.append([row['generator'],row['parameters'],i,str(e)])
print(json.dumps({'variants':len(json.load(open(sys.argv[1]))),'stages':stages,'errors':errors},ensure_ascii=False,indent=2))
if errors:sys.exit(1)
