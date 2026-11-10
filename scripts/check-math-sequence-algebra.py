"""Independent symbolic check of the exported finite numerical presentations.
Usage: export generator/parameters/steps as JSON, then pass that path.
Authoring check only; no playback or app tests. Uses installed SymPy.
"""
import json,re,sys
import sympy as sp
from sympy.parsing.sympy_parser import parse_expr,standard_transformations,implicit_multiplication_application,convert_xor,rationalize
x,a_symbol,y,b_symbol,h,S,V=sp.symbols('x a y b h S V',real=True)
transforms=standard_transformations+(implicit_multiplication_application,convert_xor,rationalize)
def expr(s):
 s=s.replace('π','pi').replace('−','-').replace('＋','+').replace('×','*').replace('÷','/').replace('²','^2').replace('³','^3')
 s=re.sub(r'√(\d+)',r'sqrt(\1)',s)
 assert re.fullmatch(r'[0-9xaybhSVpi\s+\-*/()^sqrt.]+',s),s
 return parse_expr(s,local_dict={'x':x,'a':a_symbol,'y':y,'b':b_symbol,'h':h,'S':S,'V':V,'sqrt':sp.sqrt,'pi':sp.pi},transformations=transforms)
def solutions(s,positive=False,variable=x):
 if '，' in s and s.startswith('x＝'):
  return frozenset(expr(v) for v in s[2:].split('，'))
 result=set()
 for sign in [1,-1] if '±' in s else [1]:
  candidate=s.replace('±','＋' if sign==1 else '−');lhs,rhs=candidate.split('＝')
  result.update(sp.solve(expr(lhs)-expr(rhs),variable))
 return frozenset(v for v in result if not positive or v>0)
def coord(s):
 v=s.split('＝')[-1].strip('()').split(',')
 return tuple(expr(z) for z in v)
def expected(g,p,i):
 # Values here are derived independently from the numerical problem conditions.
 a=p.get('a');b=p.get('b');k=p.get('k');d=p.get('d')
 if g=='prime_factorization':return 'expr',p['N']
 if g=='proportional_equation':return 'roots',frozenset([sp.Integer(a*k)])
 if g=='sphere_area':return 'expr',4*p['r']**2*sp.pi
 if g=='sphere_volume':return 'expr',sp.Rational(4*p['r']**3,3)*sp.pi
 if g=='polynomial_divide':return 'expr',x*x+b*x
 if g=='monomial_distribute':return 'expr',a*x*(x+b)-x*x
 if g=='irrational_quadratic':return 'roots',frozenset([-a-sp.sqrt(d),-a+sp.sqrt(d)])
 if g=='similarity_area':return ('roots_S',frozenset([sp.Integer(9*k)])) if i==0 else ('expr',9*k)
 if g=='similarity_volume':return ('roots_V',frozenset([sp.Integer(k*b**3)])) if i==0 else ('expr',k*b**3)
 if g=='midsegment':return ('roots',frozenset([sp.Rational(b,2)])) if i==0 else ('expr',sp.Rational(b,2))
 if g=='experiment_probability':return 'expr',sp.Rational(p['M'],p['N'])
 if g=='cumulative_frequency':return 'expr',a+b if i==0 else sp.Rational(a+b,a+b+p['c'])
 if g=='quartiles':return ('pair',(sp.Integer(a+d),sp.Integer(a+4*d))) if i==0 else ('expr',3*d)
 if g=='sector_area':return 'expr',sp.Rational(p['r']**2,4)*sp.pi
 if g=='integer_proof':return ('expr',2*x+k) if i==0 else ('parity','奇数' if k%2 else '偶数')
 if g=='linear_word_model':return 'roots',frozenset([sp.Integer(k)])
 if g=='fraction_add':return 'expr',x/sp.Integer(d)+x/sp.Integer(p['e'])
 if g=='fraction_subtract':return 'expr',x/sp.Integer(d)-x/sp.Integer(p['e'])
 if g in ['decimal_equation','equation_two_sides']:return 'roots',frozenset([sp.Integer(p['x'])])
 if g=='evaluate_negative':return 'expr',-a*k+b
 if g=='literal_formula':return 'formula_h',frozenset([k*S/a_symbol])
 if g=='elimination_scale':
  if i==0:return 'linear_form',x+y-p['d']
  if i<3:return 'roots_y',frozenset([sp.Integer(p['y'])])
  return 'pair',(sp.Integer(p['x']),sp.Integer(p['y']))
 if g=='elimination_subtract':return ('pair',(sp.Integer(p['x']),sp.Integer(p['y']))) if i==2 else ('roots',frozenset([sp.Integer(p['x'])]))
 if g=='linear_intercept':return ('roots_b',frozenset([sp.Integer(b)])) if i==0 else ('expr',b)
 if g=='linear_interval':return ('pair',(sp.Integer(a*p['p']+b),sp.Integer(a*p['q']+b))) if i==0 else ('expr',a)
 if g=='quadratic_coefficient':return ('roots_a',frozenset([sp.Integer(a)])) if i==0 else ('expr',a)
 if g=='quadratic_rate':return ('pair',(sp.Integer(a*p['p']**2),sp.Integer(a*p['q']**2))) if i==0 else ('expr',a*(p['p']+p['q']))
 if g=='quadratic_range':return ('roots',frozenset([-sp.Integer(k)])) if i==0 else ('expr',a*k*k)
 if g=='quadratic_formula':return 'roots',frozenset([sp.Integer(p['u']),sp.Integer(p['v'])])
 if g=='roots_product':return 'expr',k*d
 if g=='roots_difference':return 'expr',sp.sqrt(d)
 if g=='root_quotient':return 'expr',k
 if g=='factor_negative':return 'expr',-(x+p['u'])*(x+p['v'])
 if g=='square_expansion':return 'expr',(x-a)**2
 if g=='sector_arc':return 'expr',sp.Rational(p['r'],2)*sp.pi
 if g=='cylinder_volume':return 'expr',p['r']**2*p['h']*sp.pi
 if g=='cone_volume':return 'expr',sp.Rational(p['r']**2*p['h'],3)*sp.pi
 if g=='pythagorean_leg':return 'positive_roots',frozenset([sp.Integer(a)])
 if g=='probability_complement':return 'expr',sp.Rational(1,2**k) if i==0 else sp.Rational(2**k-1,2**k)
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
 if kind=='parity':return s
 if kind=='pair':return coord(s)
 if kind in ['roots_y','roots_b','roots_a','roots_S','roots_V','formula_h']:
  return solutions(s,variable={'roots_y':y,'roots_b':b_symbol,'roots_a':a_symbol,'roots_S':S,'roots_V':V,'formula_h':h}[kind])
 if kind=='linear_form':
  lhs,rhs=s.split('＝');return sp.Poly(expr(lhs)-expr(rhs),x,y).monic().as_expr()
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
