// Finite parameter domains keep every numerical arrangement small and auditable.
// No eval, arbitrary expressions, or external generation is used at runtime.
const range=(low,high)=>Array.from({length:high-low+1},(_,i)=>low+i);
const product=(...sets)=>sets.reduce((rows,set)=>rows.flatMap(row=>set.map(value=>[...row,value])),[[]]);
const number=value=>String(value).replace('-','−');
const term=(coefficient,variable='x')=>`${coefficient===1?'':coefficient===-1?'−':number(coefficient)}${variable}`;
const linear=(a,b)=>`${term(a)}${b<0?'−':'＋'}${Math.abs(b)}`;
const equation=(a,b,c)=>`${linear(a,b)}＝${number(c)}`;
const fraction=(a,d)=>`${term(a)}/${d}`;
const sumFractions=(a,b,d)=>`${fraction(a,d)}＋${fraction(b,d)}`;
const types={
 distribute_negative:{
  parameters:product([-5,-4,-3,-2],[-5,-4,-3,-2,2,3,4,5]).map(([a,b])=>({a,b})),
  render:({a,b})=>({prompt:`${a}(${linear(1,b)}) を展開した式は？`.replace('-','−'),answer:linear(a,a*b),
   dummies:[linear(a,-a*b),linear(a,b),linear(a,-b)],note:`${number(a)}をxにも${number(b)}にも掛ける。定数の項は${number(a)}×(${number(b)})＝${number(a*b)}。`})
 },
 equation_divide:{
  parameters:product([-5,-4,-3,-2],[-6,-5,-4,-3,-2,2,3,4,5,6]).map(([a,x])=>({a,x})),
  render:({a,x})=>({prompt:`${term(a)}＝${number(a*x)} の両辺を${number(a)}で割った式は？`,answer:`x＝${number(x)}`,
   dummies:[`x＝${number(-x)}`,`x＝${number(a*a*x)}`,`x＝${number(-a*a*x)}`],note:`両辺を係数${number(a)}で割る。${number(a*x)}÷(${number(a)})＝${number(x)}。`})
 },
 monomial_product:{
  parameters:product(range(2,6),range(2,6)).filter(([a,b])=>a*b!==a+b).map(([a,b])=>({a,b})),
  render:({a,b})=>({prompt:`${a}a×${b}a を計算した式は？`,answer:`${a*b}a²`,dummies:[`${a*b}a`,`${a+b}a²`,`${a+b}a`],
   note:`係数は${a}×${b}＝${a*b}、文字はa×a＝a²。係数も足さずに掛ける。`})
 },
 fraction_sum:{
  parameters:product([2,3,5,7],[2,3,5,7]).filter(([d,e])=>d!==e).map(([d,e])=>({d,e})),
  render:({d,e})=>({prompt:`x/${d}＋x/${e} を通分した式は？`,answer:sumFractions(e,d,d*e),
   dummies:[sumFractions(1,1,d*e),sumFractions(e+1,d,d*e),sumFractions(e,d+2,d*e)],
   note:`分母を${d*e}にそろえる。第1項の分子を${e}倍、第2項の分子を${d}倍し、それぞれ${e}xと${d}xにする。`})
 },
 clear_denominator:{
  parameters:product([2,3,5],[2,3,5],range(1,4)).filter(([d,e])=>d!==e).map(([d,e,k])=>({d,e,k})),
  render:({d,e,k})=>({prompt:`x/${d}＋${k}＝x/${e} の両辺に${d*e}を掛けた式は？`,answer:equation(e,d*e*k,`${d}x`),
   dummies:[equation(e,k,`${d}x`),equation(d*e,d*e*k,`${d*e}x`),equation(e,d*e*k,'x')],
   note:`すべての項に${d*e}を掛ける。分母のない${k}も${d*e*k}になり、${equation(e,d*e*k,`${d}x`)}。`})
 },
 word_equation:{
  parameters:product(range(2,5),[50,100,150,200]).map(([n,k])=>({n,k})),
  render:({n,k})=>({prompt:`1個x円の品物を${n}個買い、${k}円の袋を付けた代金を表す式は？`,answer:linear(n,k),
   dummies:[`${n}(${linear(1,k)})`,linear(1,n*k),linear(k,n)],note:`品物の代金は${n}x円。袋は1回分の${k}円なので、合計は${linear(n,k)}円。`})
 },
 factor_common:{
  parameters:product(range(2,5),range(2,6)).map(([a,b])=>({a,b})),
  render:({a,b})=>({prompt:`${linear(a,a*b)} を共通因数でくくった式は？`,answer:`${a}(${linear(1,b)})`,
   dummies:[`${a}(${linear(1,a*b)})`,`${a}(${linear(1,-b)})`,`${a*b}(${linear(1,1)})`],
   note:`共通の${a}を外へ出す。かっこ内は各項を${a}で割り、${linear(1,b)}になる。`})
 },
 complete_square:{
  parameters:product(range(3,6),[1,2,3,5,7]).map(([k,c])=>({k,c})),
  render:({k,c})=>({prompt:`x²＋${2*k}x＝${c} の左辺を平方の形にするため、両辺に加える数は？`,answer:String(k*k),
   dummies:[String(k),String(2*k),String(4*k*k)],note:`xの係数${2*k}の半分${k}を2乗し、${k*k}を両辺に加える。左辺は(x＋${k})²。`})
 },
 factor_sum_product:{
  parameters:product(range(1,6),range(1,6)).filter(([a,b])=>a<b).map(([a,b])=>({a,b})),
  render:({a,b})=>({prompt:`x²＋${a+b}x＋${a*b} を因数分解するとき探す2数は？`,answer:`和が${a+b}、積が${a*b}の2数`,
   dummies:[`和が${a*b}、積が${a+b}の2数`,`差が${a+b}、和が${a*b}の2数`,`差が${a*b}、積が${a+b}の2数`],
   note:`探す数は${a}と${b}。和がxの係数、積が定数の項になり、(x＋${a})(x＋${b})と表せる。`})
 },
 simplify_root:{
  parameters:product([2,3,5],[2,3,5,6,7]).filter(([s,n])=>s!==n).map(([s,n])=>({s,n})),
  render:({s,n})=>({prompt:`√${s*s*n} の根号の外に平方数の因数を取り出した式は？`,answer:`${s}√${n}`,
   dummies:[`${s*s}√${n}`,`${s}√${n+1}`,`${s*n}√${n}`],note:`${s*s*n}＝${s*s}×${n}。√${s*s}＝${s}なので、${s}√${n}と表す。`})
 },
 substitution:{
  parameters:product(range(2,4),range(1,3),range(2,4),range(1,3)).map(([a,b,c,x])=>({a,b,c,r:(a+c)*x+b})),
  render:({a,b,c,r})=>({prompt:`y＝${linear(a,b)} と ${term(c)}＋y＝${r}。yを代入した式は？`,answer:`${term(c)}＋(${linear(a,b)})＝${r}`,
   dummies:[`${term(c)}＋${term(a)}＝${r}`,`${term(c)}＋(${linear(a,-b)})＝${r}`,`${c}(${linear(a,b)})＋y＝${r}`],
   note:`yの場所を、yと等しい${linear(a,b)}で置き換える。かっこごと代入して項を落とさない。`})
 }
};
// Expose the finite domains for exhaustive checks and future content tooling.
export function mathVariantParameters(generator){
 if(!Object.hasOwn(types,generator))throw new Error(`Unknown math generator: ${generator}`);
 return types[generator].parameters.map(p=>({...p}));
}
export function mathVariantSignature(generator,parameters){return `${generator}:v1:${JSON.stringify(parameters)}`;}
export function materializeMathItem(item,random=Math.random,previousSignature=null){
 const generator=item.numeric_generator;
 if(!generator)return item;
 if(item.subject!=='数学'||!Object.hasOwn(types,generator))throw new Error(`${item.id}: unsupported math generator`);
 const spec=types[generator];
 const candidates=spec.parameters.filter(parameters=>mathVariantSignature(generator,parameters)!==previousSignature);
 const parameters=candidates[Math.min(candidates.length-1,Math.max(0,Math.floor(random()*candidates.length)))];
 return renderMathVariant(item,parameters);
}
export function renderMathVariant(item,parameters){
 const generator=item.numeric_generator,spec=types[generator];
 if(item.subject!=='数学'||!spec||!spec.parameters.some(p=>JSON.stringify(p)===JSON.stringify(parameters)))throw new Error(`${item.id}: invalid math parameters`);
 const rendered=spec.render(parameters),answers=[rendered.answer,...rendered.dummies];
 if(new Set(answers).size!==4)throw new Error(`${item.id}: ambiguous math choices`);
 return {...item,...rendered,variant:{generator,version:1,parameters:{...parameters},signature:mathVariantSignature(generator,parameters)}};
}
