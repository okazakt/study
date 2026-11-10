// Short solution chains share one finite parameter choice for every stage.
// This module is pure: no eval, storage, clock, audio, or DOM access.
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const product=(...sets)=>sets.reduce((rows,set)=>rows.flatMap(row=>set.map(v=>[...row,v])),[[]]);
const n=v=>String(v).replaceAll('-','−');
const t=(a,v='x')=>a===0?'0':`${a===1?'':a===-1?'−':n(a)}${v}`;
const lin=(a,b,v='x')=>`${t(a,v)}${b<0?'−':'＋'}${Math.abs(b)}`;
const eq=(a,b,c)=>`${lin(a,b)}＝${n(c)}`;
const s=(prompt,answer,dummies,note,skill,task='この式を適切に進めよう')=>({prompt,answer:String(answer),dummies:dummies.map(String),note,skill,task});
const numeric=(prompt,value,note,skill,task)=>s(prompt,n(value),[n(value+1),n(value-1),n(value+2)],note,skill,task);
const roots=(a,b)=>`x＝${n(Math.min(a,b))}，${n(Math.max(a,b))}`;
const pair=(x,y)=>`(x,y)＝(${n(x)},${n(y)})`;
const fraction=(a,b)=>`${n(a)}/${n(b)}`;
const specs={
 fraction_add:{parameters:[[2,3],[2,5],[3,5]].map(([d,e])=>({d,e})),render:({d,e})=>[
  s(`x/${d}＋x/${e}`,`(${e}x＋${d}x)/${d*e}`,[`−x/${d*e}`,`(${d}x＋${e}x)/${d+e}`,`(${e}x−${d}x)/${d*e}`],'分母と分子に同じ数を掛ける。','文字式の通分'),
  s(`(${e}x＋${d}x)/${d*e}`,`${d+e}x/${d*e}`,[`${d*e}x/${d+e}`,`${e-d}x/${d*e}`,`${d+e}x/${d+e}`],'同じ分母の分子をまとめる。','分数式の加法')
 ]},
 fraction_subtract:{parameters:[[2,3],[2,5],[3,5]].map(([d,e])=>({d,e})),render:({d,e})=>[
  s(`x/${d}−x/${e}`,`(${e}x−${d}x)/${d*e}`,[`(x−x)/${d*e}`,`(${d}x−${e}x)/${d*e}`,`(${e}x＋${d}x)/${d*e}`],'引くときも分母をそろえる。','減法の通分'),
  s(`(${e}x−${d}x)/${d*e}`,`${e-d}x/${d*e}`,[`${d-e}x/${d*e}`,`${e+d}x/${d*e}`,`${e-d}x/${e-d}`],'分子の符号を保って整理する。','分数式の減法')
 ]},
 decimal_equation:{parameters:product([2,3,4],[1,3],[2,3]).map(([a,b,x])=>({a,b,x,c:a*x+b})),render:({a,b,x,c})=>[
  s(`${a/10}x＋${b/10}＝${c/10}`,eq(a,b,c),[eq(a,b,c/10),eq(a,b/10,c),eq(a/10,b,c)],'全ての項を10倍して整数にする。','小数を含む方程式'),
  s(eq(a,b,c),`${t(a)}＝${a*x}`,[`${t(a)}＝${c+b}`,`${t(a)}＝${c}`,`${t(a)}＝${c-b-1}`],'両辺から定数の項を引く。','移項'),
  s(`${t(a)}＝${a*x}`,`x＝${x}`,[`x＝${-x}`,`x＝${x+1}`,`x＝${a*a*x}`],'係数で両辺を割る。','係数による除法')
 ]},
 equation_two_sides:{parameters:product([3,4],[1,2],[1,2],[2,3]).filter(([a,c])=>a>c).map(([a,c,b,x])=>({a,c,b,x,d:(a-c)*x+b})),render:({a,c,b,x,d})=>[
  s(`${lin(a,b)}＝${lin(c,d)}`,`${t(a-c)}＝${d-b}`,[`${t(a+c)}＝${d-b}`,`${t(a-c)}＝${d+b}`,`${t(a-c)}＝${d-b+1}`],'文字の項と定数をまとめる。','両辺に文字のある方程式'),
  s(`${t(a-c)}＝${d-b}`,`x＝${x}`,[`x＝${-x}`,`x＝${x+1}`,`x＝${x+2}`],'文字の係数で割る。','方程式の解')
 ]},
 evaluate_negative:{parameters:product([2,3],[1,2],[2,3]).map(([a,b,k])=>({a,b,k})),render:({a,b,k})=>[
  s(`${lin(a,b)}，x＝−${k}`,`${a}×(−${k})＋${b}`,[`${a}×${k}＋${b}`,`${a}×(−${k})−${b}`,`${a}＋(−${k})＋${b}`],'負の値は括弧に入れて代入する。','負の数の代入'),
  numeric(`${a}×(−${k})＋${b}`,-a*k+b,'乗法を先に計算する。','式の値')
 ]},
 literal_formula:{parameters:[2,3,4].map(k=>({k})),render:({k})=>[
  s(`S＝ah/${k}（a≠0）`,`${k}S＝ah`,[`S＝${k}ah`,`${k}S＝−ah`,`S＝ah`],'等式全体を同じ数倍する。','文字式の分母払い','hについて式を整えよう'),
  s(`${k}S＝ah（a≠0）`,`h＝${k}S/a`,[`h＝a/(${k}S)`,`h＝${k}aS`,`h＝S/(${k}a)`],'aが0でないので両辺をaで割る。','文字について解く','hについて式を整えよう')
 ]},
 elimination_scale:{parameters:product([2,3],[1,2],[1,2,3]).map(([a,x,y])=>({a,x,y,c:a*x+y,d:x+y})),render:({a,x,y,c,d})=>[
  s(`${t(a)}＋y＝${c}\nx＋y＝${d}`,`${t(a)}＋${t(a,'y')}＝${a*d}`,[`${t(a)}＋y＝${a*d}`,`${t(a)}＋${t(a,'y')}＝${d}`,`x＋${t(a,'y')}＝${a*d}`],'一つの式の全項を同じ数倍する。','加減法の係数合わせ'),
  s(`${t(a)}＋y＝${c}\n${t(a)}＋${t(a,'y')}＝${a*d}`,`${t(a-1,'y')}＝${a*d-c}`,[`${t(a+1,'y')}＝${a*d-c}`,`${t(a-1,'y')}＝${a*d+c}`,`${t(a-1,'y')}＝${a*d-c+1}`],'係数をそろえた二式を引く。','連立方程式の消去'),
  s(`${t(a-1,'y')}＝${a*d-c}`,`y＝${y}`,[`y＝${-y}`,`y＝${y+1}`,`y＝${y+2}`],'残った文字の係数で割る。','消去後の方程式'),
  s(`y＝${y}，x＋y＝${d}`,pair(x,y),[pair(-x,y),pair(x+1,y),pair(x,-y)],'元の式へ戻してもう一方を求める。','連立の解の確定','解を求めよう')
 ]},
 elimination_subtract:{parameters:product([2,3],[1,2],[2,3],[1,2]).map(([a,b,x,y])=>({a,b,x,y,c:a*x+b*y,d:x+b*y})),render:({a,b,x,y,c,d})=>[
  s(`${t(a)}＋${t(b,'y')}＝${c}\nx＋${t(b,'y')}＝${d}`,`${t(a-1)}＝${c-d}`,[`${t(a+1)}＝${c-d}`,`${t(a-1)}＝${c+d}`,`${t(a-1)}＝${c-d+1}`],'同じ係数の文字を引いて消す。','減法による消去'),
  s(`${t(a-1)}＝${c-d}`,`x＝${x}`,[`x＝${-x}`,`x＝${x+1}`,`x＝${x+2}`],'係数で割ってxを求める。','消去後の解'),
  s(`x＝${x}，x＋${t(b,'y')}＝${d}`,pair(x,y),[pair(-x,y),pair(x,-y),pair(x,y+1)],'xを代入してyを求める。','連立の解の確認','解を求めよう')
 ]},
 linear_intercept:{parameters:product([2,3],[1,2],[2,3]).map(([a,b,x])=>({a,b,x,v:a*x+b})),render:({a,b,x,v})=>[
  s(`y＝${a}x＋b，点(${x},${v})`,`${v}＝${a}×${x}＋b`,[`${v}＝${a}×${x}−b`,`${v}＝−${a}×${x}＋b`,`${v}＝${a}×${x}＋2b`],'通る点のxとyを式へ代入する。','一次関数の条件式'),
  numeric(`${v}＝${a*x}＋b`,b,'定数を移して切片を求める。','切片の決定','bの値を求めよう')
 ]},
 linear_interval:{parameters:product([2,3],[1,2],[1,2]).map(([a,b,p])=>({a,b,p,q:p+2})),render:({a,b,p,q})=>[
  s(`y＝${lin(a,b)}，x：${p}→${q}`,`(${a*p+b},${a*q+b})`,[`(${a*p},${a*q})`,`(${a*q+b},${a*p+b})`,`(${a*p-b},${a*q-b})`],'区間の両端をそれぞれ代入する。','一次関数の両端の値','両端のyの値を選ぼう'),
  numeric(`x：${p}→${q}，y：${a*p+b}→${a*q+b}`,a,'yの増加量をxの増加量で割る。','一次関数の変化の割合','変化の割合を求めよう')
 ]},
 quadratic_coefficient:{parameters:product([-2,2,3],[2,3]).map(([a,k])=>({a,k,v:a*k*k})),render:({a,k,v})=>[
  s(`y＝ax²，点(${k},${n(v)})`, `a＝${n(v)}/${k}²`,[`a＝${n(v)}/${k}`,`a＝${n(v)}×${k}²`,`a＝${k}²/(${n(v)})`],'点を代入し二乗の値で割る。','二乗比例の比例定数'),
  numeric(`a＝${n(v)}/${k}²`,a,'二乗を先に計算する。','比例定数の計算','aの値を求めよう')
 ]},
 quadratic_rate:{parameters:product([2,3],[1,2]).map(([a,p])=>({a,p,q:p+2})),render:({a,p,q})=>[
  s(`y＝${a}x²，x：${p}→${q}`,`(${a*p*p},${a*q*q})`,[`(${a*p},${a*q})`,`(${a*q*q},${a*p*p})`,`(${p*p},${q*q})`],'区間の両端を代入する。','二乗比例の両端の値','両端のyの値を選ぼう'),
  s(`x：${p}→${q}，y：${a*p*p}→${a*q*q}`,`${a*q*q-a*p*p}/${q-p}`,[`${a*q*q+a*p*p}/${q-p}`,`${a*q*q-a*p*p}/${q+p}`,`${q-p}/${a*q*q-a*p*p}`],'yの増加量をxの増加量で割る。','二乗比例の変化の割合','変化の割合の式を選ぼう'),
  numeric(`${a*q*q-a*p*p}/${q-p}`,a*(p+q),'増加量どうしの比を計算する。','変化の割合の計算','値を求めよう')
 ]},
 quadratic_range:{parameters:product([2,3],[2,3]).map(([a,k])=>({a,k})),render:({a,k})=>[
  s(`y＝${a}x²，−${k}≦x≦${k-1}`,`x＝−${k}`,[`x＝${k-1}`,`x＝0`,`x＝${k}`],'原点から遠い方の端で最大になる。','二乗比例の最大値の位置','yが最大になるxは？'),
  numeric(`y＝${a}x²，x＝−${k}`,a*k*k,'選んだxを二乗して代入する。','二乗比例の最大値','yの最大値を求めよう')
 ]},
 quadratic_formula:{parameters:product([1,2],[1,2],[3,4]).map(([a,u,v])=>({a,u,v,b:-a*(u+v),c:a*u*v,D:a*a*(v-u)**2})),render:({a,u,v,b,c,D})=>[
  s(`${a===1?'':a}x²${n(b)}x＋${c}＝0`,`${t(2*a)}＝${-b}±√${D}`,[`${t(2*a)}＝${b}±√${D}`,`${t(2*a)}＝${-b}±√${D+1}`,`${t(2*a)}＝${-b}±√${D+2}`],'解の公式の分子と根号内を求める。','解の公式の適用'),
  s(`${t(2*a)}＝${-b}±√${D}`,`${t(2*a)}＝${-b}±${a*(v-u)}`,[`${t(2*a)}＝${-b}±${a*(v-u)+2}`,`${t(2*a)}＝${b}±${a*(v-u)}`,`${t(2*a)}＝${-b}±${a*(v-u)+1}`],'根号の値を整理する。','解の公式の根号整理'),
  s(`${t(2*a)}＝${-b}±${a*(v-u)}`,roots(u,v),[roots(-v,-u),roots(u,v+1),roots(u+1,v+1)],'正負の両方で係数を割る。','解の公式から二解へ')
 ]},
 roots_product:{parameters:product([2,3,5],[2,3]).filter(([d,k])=>d!==k).map(([d,k])=>({d,k})),render:({d,k})=>[
  s(`√${d}×√${k*k*d}`,`√${k*k*d*d}`,[`√${d+k*k*d}`,`√${k*d*d}`,`√${k*k*d}`],'根号内どうしを掛ける。','平方根の乗法'),
  numeric(`√${k*k*d*d}`,k*d,'平方数の平方根を求める。','平方根の値')
 ]},
 roots_difference:{parameters:product([2,3,5],[2,3]).map(([d,k])=>({d,k})),render:({d,k})=>[
  s(`${k+1}√${d}−√${k*k*d}`,`${k+1}√${d}−${k}√${d}`,[`${k+1}√${d}＋${k}√${d}`,`${k+1}√${d}−${k*k}√${d}`,`${k+1}√${d}−${k}√${d+1}`],'平方数の因数を外へ出す。','平方根の減法の準備'),
  s(`${k+1}√${d}−${k}√${d}`,`√${d}`,[`${2*k+1}√${d}`,`√${2*d}`,`${k}√${d}`],'同じ根号の係数を引く。','平方根の減法')
 ]},
 factor_negative:{parameters:product([1,2],[3,4]).map(([u,v])=>({u,v})),render:({u,v})=>[
  s(`−x²−${u+v}x−${u*v}`,`−(x²＋${u+v}x＋${u*v})`,[`−(x²−${u+v}x＋${u*v})`,`−(x²＋${u+v}x−${u*v})`,`x²＋${u+v}x＋${u*v}`],'負の符号を全項からくくる。','負の共通因数'),
  s(`−(x²＋${u+v}x＋${u*v})`,`−(x＋${u})(x＋${v})`,[`−(x−${u})(x−${v})`,`−(x＋${u})(x−${v})`,`(x＋${u})(x＋${v})`],'括弧の中を因数分解する。','負の因数と二次式')
 ]},
 square_expansion:{parameters:[2,3,4].map(a=>({a})),render:({a})=>[
  s(`(x−${a})²`,`x²−${a}x−${a}x＋${a*a}`,[`x²＋${a}x−${a}x＋${a*a}`,`x²−${a}x−${a}x−${a*a}`,`x²−${a}x＋${a*a}`],'二つの括弧の各項を掛ける。','差の平方の展開'),
  s(`x²−${a}x−${a}x＋${a*a}`,`x²−${2*a}x＋${a*a}`,[`x²−${a}x＋${a*a}`,`x²＋${2*a}x＋${a*a}`,`x²−${2*a}x−${a*a}`],'中央の二つの項をまとめる。','差の平方の整理')
 ]},
 root_quotient:{parameters:product([2,3,5],[2,3]).filter(([d,k])=>d!==k).map(([d,k])=>({d,k})),render:({d,k})=>[
  s(`√${k*k*d}/√${d}`,`√${k*k}`,[`√${k*k*d}`,`√${k*d}`,`√${k*k+d}`],'根号内どうしを割る。','平方根の除法'),
  numeric(`√${k*k}`,k,'正の平方根を求める。','平方根の簡単化')
 ]},
 sector_arc:{parameters:[4,6,8].map(r=>({r})),render:({r})=>[
  s(`半径${r}，90°の扇形。弧の長さは？`,`${2*r}π/4`,[`${2*r}π/3`,`${2*r}π`,`${2*r}π/2`],'円周に中心角の割合を掛ける。','扇形の弧の立式'),
  s(`${2*r}π/4`,`${r/2}π`,[`${r}π`,`${2*r}π`,`${r/2+1}π`],'係数を約分する。','扇形の弧の計算')
 ]},
 cylinder_volume:{parameters:product([3,4],[2,3]).filter(([r,h])=>r!==h*h).map(([r,h])=>({r,h})),render:({r,h})=>[
  s(`半径${r}，高さ${h}の円柱の体積は？`,`${r}²π×${h}`,[`${r}π×${h}`,`${r}²π＋${h}`,`${r}²π/${h}`],'底面積に高さを掛ける。','円柱の体積の立式'),
  s(`${r}²π×${h}`,`${r*r*h}π`,[`${r*h}π`,`${r*r+h}π`,`${r*r*h+1}π`],'半径を二乗して計算する。','円柱の体積の計算')
 ]},
 cone_volume:{parameters:product([3,6],[2,3]).map(([r,h])=>({r,h})),render:({r,h})=>[
  s(`半径${r}，高さ${h}の円錐の体積は？`,`${r}²π×${h}/3`,[`${r}²π×${h}`,`${r}²π×${h}/2`,`${r}²π/(3×${h})`],'同じ底面・高さの柱体の1/3。','円錐の体積の立式'),
  s(`${r}²π×${h}/3`,`${r*r*h/3}π`,[`${r*r*h}π`,`${r*r*h/3-1}π`,`${r*r*h/3+1}π`],'三つの因数と分母を整理する。','円錐の体積の計算')
 ]},
 pythagorean_leg:{parameters:[[3,4,5],[5,12,13],[6,8,10]].map(([a,b,c])=>({a,b,c})),render:({a,b,c})=>[
  s(`直角三角形。斜辺${c}，他の辺${b}とx`,`x²＝${c}²−${b}²`,[`x²＝${c}²＋${b}²`,`x²＝${b}²−${c}²`,`x²＝${c}²−${b}`],'斜辺²から既知の辺²を引く。','三平方で短い辺を求める'),
  s(`x²＝${c}²−${b}²`,`x²＝${a*a}`,[`x²＝${c-b}`,`x²＝${c*c+b*b}`,`x²＝${c*c-b}`],'それぞれ二乗して引く。','二乗の差の計算'),
  s(`x²＝${a*a}，xは長さ`,`x＝${a}`,[`x＝${-a}`,`x＝${a*a}`,`x＝${a+1}`],'長さの条件から正の値を選ぶ。','長さの解の選択')
 ]},
 probability_complement:{parameters:[3,4].map(k=>({k})),render:({k})=>[
  s(`公平な硬貨${k}回。全て裏の確率は？`,`1/${2**k}`,[`1/${k}`,`${2**k-1}/${2**k}`,`1/${2**k+1}`],'各回を独立として場合を数える。','余事象の確率'),
  s(`全て裏は1/${2**k}。表が1回以上の確率は？`,`${2**k-1}/${2**k}`,[`1/${2**k}`,`${2**k-2}/${2**k}`,`1/${k}`],'全体の1から余事象の確率を引く。','余事象の利用')
 ]},

 signed:{parameters:product(range(2,5),range(2,5)).map(([a,b])=>({a,b})),render:({a,b})=>[
  s(`−${a}−(−${b})＋2`,`−${a}＋${b}＋2`,[`−${a}−${b}＋2`,`${a}＋${b}＋2`,`−${a}＋${b}＋3`],'負の数を引くと加法になる。','負の数の減法'),
  numeric(`−${a}＋${b}＋2`,-a+b+2,'符号に注意して足し合わせる。','正負の加法')
 ]},
 distribute:{parameters:product([2,3,4],[2,3,5]).filter(([a,b])=>a*b!==a+b).map(([a,b])=>({a,b})),render:({a,b})=>[
  s(`${a}(x＋${b})−x`,`${t(a)}＋${a*b}−x`,[`${t(a)}＋${b}−x`,`${t(a)}−${a*b}−x`,`${t(a)}＋${a+b}−x`],'括弧内の両項に係数を掛ける。','分配法則'),
  s(`${t(a)}＋${a*b}−x`,lin(a-1,a*b),[lin(a+1,a*b),lin(a-1,-a*b),lin(a,a*b-1)],'文字の項どうしをまとめる。','同類項の整理')
 ]},
 linear:{parameters:product([2,3,4],[2,3],[-2,2,4]).map(([a,b,x])=>({a,b,x,c:a*(x+b)+1})),render:({a,b,x,c})=>[
  s(`${a}(x＋${b})＋1＝${c}`,`${t(a)}＋${a*b}＋1＝${c}`,[`${t(a)}＋${b}＋1＝${c}`,`${t(a)}−${a*b}＋1＝${c}`,`${t(a)}＋${a*b}＋2＝${c}`],'括弧内の両項に係数を掛ける。','分配法則'),
  s(`${t(a)}＋${a*b}＋1＝${c}`,`${t(a)}＝${n(a*x)}`,[`${t(a)}＝${n(c+a*b+1)}`,`${t(a)}＝${n(c-a*b+1)}`,`${t(a)}＝${n(c+a*b-1)}`],'定数を整理し両辺から引く。','移項と整理'),
  s(`${t(a)}＝${n(a*x)}`,`x＝${n(x)}`,[`x＝${n(-x)}`,`x＝${n(a*a*x)}`,`x＝${n(x+1)}`],'両辺を文字の係数で割る。','係数による除法')
 ]},
 fraction_equation:{parameters:product([2,3,4],[1,2,3]).map(([d,k])=>({d,k,x:d*k})),render:({d,k,x})=>[
  s(`x/${d}＋${k}＝${2*k}`,`x＋${d*k}＝${2*d*k}`,[`x＋${k}＝${2*d*k}`,`x＋${d*k}＝${2*k}`,`${d}x＋${d*k}＝${2*d*k}`],'分母を払うとき全項に掛ける。','分母払い'),
  s(`x＋${d*k}＝${2*d*k}`,`x＝${x}`,[`x＝${3*d*k}`,`x＝${k}`,`x＝${-d*k}`],'両辺から定数の項を引く。','等式の性質')
 ]},
 proportion:{parameters:product([2,3,4],[2,3],[4,5]).map(([a,x,z])=>({a,x,z})),render:({a,x,z})=>[
  s(`yはxに比例。x＝${x}でy＝${a*x}`,`y＝${t(a)}`,[`y＝${t(a*x)}`,`y＝x＋${a}`,`y＝${a}/x`],'yをxで割り比例定数を求める。','比例の立式','関係を式で表そう'),
  numeric(`y＝${t(a)}，x＝${z}のときyは？`,a*z,'xの値を式へ代入する。','代入','値を求めよう')
 ]},
 inverse:{parameters:product([12,18,24],[2,3]).map(([a,x])=>({a,x})),render:({a,x})=>[
  s(`yはxに反比例。x＝${x}でy＝${a/x}`,`y＝${a}/x`,[`y＝${a/x}/x`,`y＝${a}x`,`y＝${a+x}/x`],'xとyの積が比例定数になる。','反比例の立式','関係を式で表そう'),
  numeric(`y＝${a}/x，x＝6のときyは？`,a/6,'分母のxへ値を代入する。','反比例の代入','値を求めよう')
 ]},
 monomial:{parameters:product([2,3,4],[2,3]).filter(([a,b])=>a*b!==a+b).map(([a,b])=>({a,b})),render:({a,b})=>[
  s(`${a}a×${b}a÷(${a}a)`,`${a*b}a²÷(${a}a)`,[`${a+b}a²÷(${a}a)`,`${a*b}a÷(${a}a)`,`${a-b}a²÷(${a}a)`],'係数と文字をそれぞれ掛ける。','単項式の乗法'),
  s(`${a*b}a²÷(${a}a)（a≠0）`,`${b}a`,[`${b}a²`,`${a*b}a`,`${a*b}a²`],'係数も文字も割って整理する。','単項式の除法')
 ]},
 elimination:{parameters:product([2,3],[1,2],[2,3]).filter(([a,x,y])=>x!==y&&y!==2*a*x/(a-1)).map(([a,x,y])=>({a,x,y,c:a*x+y,d:x-y})),render:({a,x,y,c,d})=>[
  s(`${t(a)}＋y＝${c}\nx−y＝${n(d)}`,`${t(a+1)}＝${n(c+d)}`,[`${t(a-1)}＝${n(c+d)}`,`${t(a+1)}＝${n(c-d)}`,`${t(a+1)}＝${n(c+d+1)}`],'両式を足すとyの項が消える。','加減法'),
  s(`${t(a+1)}＝${n(c+d)}`,`x＝${x}`,[`x＝${-x}`,`x＝${x+1}`,`x＝${(a+1)**2*x}`],'両辺をxの係数で割る。','係数による除法'),
  s(`x＝${x}，x−y＝${n(d)}`,pair(x,y),[pair(x,-y),pair(x,y+1),pair(-x,y)],'求めたxを元の式へ代入する。','連立の解の確定','解を求めよう')
 ]},
 substitution:{parameters:product([2,3],[1,2],[2,3]).map(([a,b,x])=>({a,b,x,y:a*x+b,c:(a+1)*x+b})),render:({a,b,x,y,c})=>[
  s(`y＝${lin(a,b)}\nx＋y＝${c}`,`x＋(${lin(a,b)})＝${c}`,[`x＋(${lin(a,-b)})＝${c}`,`${a}x＝${c}`,`x＋${b}＝${c}`],'yを等しい式で置き換える。','代入法'),
  s(`x＋(${lin(a,b)})＝${c}`,`${t(a+1)}＝${c-b}`,[`${t(a-1)}＝${c-b}`,`${t(a+1)}＝${c+b}`,`${t(a+1)}＝${c}`],'同類項をまとめ定数を移す。','同類項と移項'),
  s(`${t(a+1)}＝${c-b}`,`x＝${x}`,[`x＝${-x}`,`x＝${x+1}`,`x＝${(a+1)*x}`],'両辺を文字の係数で割る。','係数による除法'),
  s(`x＝${x}，y＝${lin(a,b)}`,pair(x,y),[pair(-x,y),pair(x,y-b),pair(x,-y)],'xを元の式へ代入してyを求める。','連立の解の確定','解を求めよう')
 ]},
 function:{parameters:product([2,3],[1,2],[2,3]).filter(([a,b])=>a!==b).map(([a,b,x])=>({a,b,x})),render:({a,b,x})=>[
  numeric(`直線が(0,${b})，(${x},${a*x+b})を通る。傾きは？`,a,'yの増加量をxの増加量で割る。','変化の割合','値を求めよう'),
  s(`傾き${a}で(0,${b})を通る直線`, `y＝${lin(a,b)}`,[`y＝${lin(b,a)}`,`y＝${lin(a,-b)}`,`y＝${a*b}x`],'xが0のときのyが切片になる。','一次関数の決定','関係を式で表そう')
 ]},
 intersection:{parameters:product([2,3],[1,2],[2,3]).map(([a,b,x])=>({a,b,x,c:(a-1)*x+b,y:a*x+b})),render:({a,b,x,c,y})=>[
  s(`y＝${lin(a,b)}\ny＝x＋${c}`,`${lin(a,b)}＝x＋${c}`,[`${lin(a,-b)}＝x＋${c}`,`${lin(a,b)}＝x−${c}`,`${lin(a,b)}＝${c}`],'交点では両式のyが等しい。','交点の立式'),
  s(`${lin(a,b)}＝x＋${c}`,`x＝${x}`,[`x＝${-x}`,`x＝${x+1}`,`x＝${c+b}`],'xの項と定数を整理する。','交点のx座標'),
  s(`x＝${x}，y＝${lin(a,b)}`,`(${x},${y})`,[`(${y},${x})`,`(${x},${-y})`,`(${x+1},${y})`],'xを代入してyも求める。','交点の座標','交点の座標を選ぼう')
 ]},
 expansion:{parameters:product([1,2],[3,4]).map(([a,b])=>({a,b})),render:({a,b})=>[
  s(`(x＋${a})(x＋${b})`,`x²＋${b}x＋${a}x＋${a*b}`,[`x²＋${b}x＋${a}x＋${a+b}`,`x²−${b}x＋${a}x＋${a*b}`,`x²＋${b}x−${a}x＋${a*b}`],'それぞれの項を掛け合わせる。','多項式の乗法'),
  s(`x²＋${b}x＋${a}x＋${a*b}`,`x²＋${a+b}x＋${a*b}`,[`x²＋${a*b}x＋${a*b}`,`x²＋${a+b}x＋${a+b}`,`x²−${a+b}x＋${a*b}`],'xの項をまとめる。','展開後の整理')
 ]},
 factor:{parameters:product([2,3],[1,2],[3,4]).map(([k,a,b])=>({k,a,b})),render:({k,a,b})=>[
  s(`${k}x²＋${k*(a+b)}x＋${k*a*b}`,`${k}(x²＋${a+b}x＋${a*b})`,[`${k}(x²＋${k*(a+b)}x＋${a*b})`,`${k}(x²＋${a+b}x−${a*b})`,`${k}(x²−${a+b}x＋${a*b})`],'全項の共通因数をくくる。','共通因数'),
  s(`${k}(x²＋${a+b}x＋${a*b})`,`${k}(x＋${a})(x＋${b})`,[`${k}(x−${a})(x−${b})`,`${k}(x＋${a})(x−${b})`,`${k}(x＋${a+b})(x＋${a*b})`],'和と積が合う2数を探す。','二次式の因数分解')
 ]},
 difference:{parameters:[2,3,4,5].map(a=>({a})),render:({a})=>[
  s(`x²−${a*a}＝0`,`(x＋${a})(x−${a})＝0`,[`(x−${a})²＝0`,`(x＋${a})²＝0`,`(x＋${a*a})(x−${a*a})＝0`],'二乗の差の形を見分ける。','平方の差'),
  s(`(x＋${a})(x−${a})＝0`,roots(-a,a),[roots(0,a),roots(-a,0),roots(-a*a,a*a)],'どちらかの因数が0になる。','積が0の性質','解を求めよう')
 ]},
 radical:{parameters:product([2,3,5],[2,3,4]).map(([d,k])=>({d,k})),render:({d,k})=>[
  s(`√${k*k*d}＋√${d}`,`${k}√${d}＋√${d}`,[`${k*k}√${d}＋√${d}`,`${k}√${d+1}＋√${d}`,`${k}√${d}−√${d}`],'平方数の因数を根号の外へ出す。','平方根の簡単化'),
  s(`${k}√${d}＋√${d}`,`${k+1}√${d}`,[`${k}√${2*d}`,`${k+2}√${d}`,`${k-1}√${d}`],'同じ根号の係数を足す。','平方根の加法')
 ]},
 rationalize:{parameters:product([2,3,5],[2,3]).map(([d,a])=>({d,a})),render:({d,a})=>[
  s(`${a}/√${d}`,`${a}√${d}/(√${d}×√${d})`,[`${a}/(√${d}×√${d})`,`${a}√${d}/(${d}＋1)`,`${a}√${d}/(${d}×${d})`],'分子と分母に同じ根号を掛ける。','分母の有理化'),
  s(`${a}√${d}/(√${d}×√${d})`,`${a}√${d}/${d}`,[`${a}√${d}`,`${a}/${d}`,`${a}/(${d}√${d})`],'分母の根号の積を計算する。','平方根の乗法')
 ]},
 quadratic_factor:{parameters:product([1,2],[3,4]).map(([a,b])=>({a,b})),render:({a,b})=>[
  s(`x²−${a+b}x＋${a*b}＝0`,`(x−${a})(x−${b})＝0`,[`(x＋${a})(x＋${b})＝0`,`(x＋${a})(x−${b})＝0`,`(x−${a+b})(x−${a*b})＝0`],'和と積を見て因数分解する。','二次方程式の因数分解'),
  s(`(x−${a})(x−${b})＝0`,roots(a,b),[roots(-b,-a),roots(-a,b),roots(a,b+1)],'各因数が0になる場合を考える。','二次方程式の解')
 ]},
 quadratic_square:{parameters:product([1,2,3],[2,3]).filter(([a,b])=>a!==b).map(([a,b])=>({a,b,c:b*b-a*a})),render:({a,b,c})=>[
  s(`x²＋${2*a}x＝${n(c)}`,`(x＋${a})²＝${b*b}`,[`(x＋${a})²＝${c}`,`(x＋${a})²＝${b*b+1}`,`(x−${a})²＝${b*b}`],'係数の半分の二乗を両辺に加える。','平方完成'),
  s(`(x＋${a})²＝${b*b}`,`x＋${a}＝±${b}`,[`x＋${a}＝${b}`,`x＋${a}＝±${b*b}`,`x−${a}＝±${b}`],'正と負の平方根を考える。','平方根からの解'),
  s(`x＋${a}＝±${b}`,roots(-a-b,-a+b),[roots(a-b,a+b),roots(-a-b,-a+b+1),roots(-a-b-1,-a+b)],'両方の場合で定数を移す。','二つの解の整理')
 ]},
 similarity:{parameters:product([2,3],[4,5]).map(([a,b])=>({a,b})),render:({a,b})=>[
  s(`相似比1：${a}。辺の比${b}：x`,`x＝${a}×${b}`,[`x＝${b}/${a}`,`x＝${a}＋${b}`,`x＝${a*b+1}`],'対応する辺を同じ順に比べる。','相似比の立式'),
  numeric(`x＝${a}×${b}`,a*b,'対応する長さの倍率を使う。','相似の長さ')
 ]},
 pythagoras:{parameters:[[3,4,5],[6,8,10],[5,12,13]].map(([a,b,c])=>({a,b,c})),render:({a,b,c})=>[
  s(`直角を挟む辺が${a}，${b}。斜辺はx`,`x²＝${a}²＋${b}²`,[`x²＝${b}²−${a}²`,`x＝${a}＋${b}`,`x²＝${a}²×${b}²`],'斜辺の二乗は他の二辺の二乗の和。','三平方の立式'),
  s(`x²＝${a}²＋${b}²`,`x²＝${c*c}`,[`x²＝${c*c+1}`,`x²＝${b*b-a*a}`,`x²＝${(a+b)**2}`],'それぞれ二乗して足す。','平方の計算'),
  s(`x²＝${c*c}，xは長さ`,`x＝${c}`,[`x＝${-c}`,`x＝${c*c}`,`x＝${c+1}`],'長さなので正の値を選ぶ。','長さと平方根')
 ]},
 angle:{parameters:[30,40,50,60,70].map(a=>({a})),render:({a})=>[
  s(`同じ弧の円周角が${a}°。中心角はx°`,`x＝2×${a}`,[`x＝${a}/2`,`x＝360−${a}`,`x＝${a}`],'同じ弧の中心角は円周角の2倍。','円周角の定理'),
  numeric(`x＝2×${a}`,2*a,'式を計算して角度を求める。','角度の計算')
 ]},
 probability:{parameters:[2,3,4].map(k=>({k})),render:({k})=>[
  numeric(`1〜6のカード1枚。${k}以下は何枚？`,k,'条件に合うカードを数える。','場合の数','枚数を求めよう'),
  s(`全6通り，条件に合うのは${k}通り`,fraction(k,6),[fraction(k+1,6),fraction(k,5),fraction(k-1,6)],'同様に確からしい場合で比べる。','確率の比','確率を選ぼう')
 ]},
 mean:{parameters:[2,3,4,5].map(a=>({a})),render:({a})=>[
  numeric(`データ${a}，${a+1}，${a+2}の合計は？`,3*a+3,'全ての値を足す。','データの合計','値を求めよう'),
  numeric(`データ3個，合計${3*a+3}。平均値は？`,a+1,'合計をデータ数で割る。','平均値','値を求めよう')
 ]},
 sampling:{parameters:product([2,3,4],[100,200]).map(([a,total])=>({a,total})),render:({a,total})=>[
  s(`無作為標本10人中${a}人が該当。割合は？`,fraction(a,10),[fraction(a+1,10),fraction(a,9),fraction(a-1,10)],'標本の該当数を標本数で割る。','標本の割合','割合を選ぼう'),
  numeric(`標本割合${a}/10，母集団${total}人。推定は？`,total*a/10,'標本の割合を母集団へ当てはめる。','母集団の推定','人数を推定しよう')
 ]}
};
export function mathSequenceParameters(generator){
 const spec=Object.hasOwn(specs,generator)?specs[generator]:null;if(!spec)throw Error(`Unknown math sequence: ${generator}`);
 return spec.parameters.map(p=>({...p}));
}
export function renderMathSequence(item,parameters){
 const spec=Object.hasOwn(specs,item.sequence_generator)?specs[item.sequence_generator]:null;
 if(item.subject!=='数学'||!spec||!spec.parameters.some(p=>JSON.stringify(p)===JSON.stringify(parameters)))throw Error(`${item.id}: invalid sequence parameters`);
 const steps=spec.render(parameters);
 for(const step of steps){if(new Set([step.answer,...step.dummies]).size!==4)throw Error(`${item.id}: duplicate sequence choices`);}
 return {...item,steps,variant:{generator:`math_sequence:${item.sequence_generator}`,version:1,parameters:{...parameters},signature:`math_sequence:${item.sequence_generator}:v1:${JSON.stringify(parameters)}`}};
}
export function makeMathSequenceQuestions(item,random=Math.random,previousSignature=null){
 const parameters=mathSequenceParameters(item.sequence_generator);
 const candidates=parameters.filter(p=>`math_sequence:${item.sequence_generator}:v1:${JSON.stringify(p)}`!==previousSignature);
 const rendered=renderMathSequence(item,candidates[Math.min(candidates.length-1,Math.max(0,Math.floor(random()*candidates.length)))]);
 const {steps,...base}=rendered;
 return steps.map((step,i)=>{
  const choices=[step.answer,...step.dummies];
  for(let j=choices.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[choices[j],choices[k]]=[choices[k],choices[j]];}
  return {...base,...step,sequenceSource:item,id:`${item.id}:step:${i+1}`,sourceId:item.id,mode:'math_sequence',
   blankIndex:i+1,blankPosition:i+1,blankTotal:steps.length,continuation:i>0,refreshPrompt:true,
   context:'',term:item.title,choices,correct:choices.indexOf(step.answer),
   targetLabel:`次の答えを選ぼう（${i+1} / ${steps.length}）`,reviewLabel:`${item.title} · ${step.skill}（${i+1} / ${steps.length}）`};
 });
}
