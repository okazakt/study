import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mathVariantParameters,materializeMathItem,renderMathVariant} from '../math-variants.js';
import {makeChoiceQuestion,makeQuestionQueue,Game,seededRandom,perfectReference} from '../game.js';
import {questionKey,questionCoverage,normalizeHistory,recordAnswer,createAdaptivePicker,missedQuestions} from '../progress.js';
const data=JSON.parse(readFileSync(new URL('../quiz-data/junior_expansion.json',import.meta.url)));
const items=data.filter(q=>q.numeric_generator);
// A small arithmetic parser independently checks the displayed expressions.
function value(source,variables={}){
 const tokens=source.replaceAll('−','-').replaceAll('＋','+').replaceAll('×','*').replaceAll('²','^2').match(/\d+|[a-z]|[+*/()^√-]/g)||[];
 let index=0;
 const atom=()=>{
  const token=tokens[index++];
  if(token==='('){const result=sum();assert.equal(tokens[index++],')');return result;}
  if(token==='√')return Math.sqrt(atom());
  if(/^\d+$/.test(token))return Number(token);
  assert.ok(Object.hasOwn(variables,token),`${source}: unknown ${token}`);return variables[token];
 };
 const power=()=>{let result=atom();if(tokens[index]==='^'){index++;result**=unary();}return result;};
 const unary=()=>tokens[index]==='-'?(index++,-unary()):tokens[index]==='+'?(index++,unary()):power();
 const term=()=>{
  let result=unary();
  while(index<tokens.length){const token=tokens[index];
   if(token==='*'){index++;result*=unary();}else if(token==='/'){index++;result/=unary();}
   else if(token==='('||token==='√'||/^[a-z\d]/.test(token))result*=unary();else break;
  }return result;
 };
 const sum=()=>{let result=term();while(['+','-'].includes(tokens[index])){const op=tokens[index++];result+=term()*(op==='+'?1:-1);}return result;};
 const result=sum();assert.equal(index,tokens.length,source);return result;
}
const equal=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<1e-8;
function correct(expression,item,p){
 const evaluate=(x=2)=>value(expression,{x,a:x});
 const eq=(x,y=0)=>{const [left,right]=expression.split('＝');return equal(value(left,{x,y}),value(right,{x,y}));};
 switch(item.numeric_generator){
  case 'distribute_negative':return [-3,-1,2,5].every(x=>equal(evaluate(x),p.a*(x+p.b)));
  case 'monomial_product':return [-3,-1,2,5].every(x=>equal(evaluate(x),p.a*p.b*x*x));
  case 'fraction_sum':return [-3,-1,2,5].every(x=>equal(evaluate(x),x/p.d+x/p.e));
  case 'factor_common':return [-3,-1,2,5].every(x=>equal(evaluate(x),p.a*x+p.a*p.b));
  case 'word_equation':return [1,2,5,10].every(x=>equal(evaluate(x),p.n*x+p.k));
  case 'simplify_root':return equal(evaluate(),Math.sqrt(p.s*p.s*p.n));
  case 'equation_divide':return eq(p.x);
  case 'clear_denominator':return eq(-p.d*p.e*p.k/(p.e-p.d));
  case 'substitution':{const x=(p.r-p.b)/(p.a+p.c);return eq(x,p.a*x+p.b);}
  case 'complete_square':return equal(evaluate(),p.k*p.k);
  case 'factor_sum_product':{
   const m=/^(和|差)が(\d+)、(和|積)が(\d+)の2数$/.exec(expression);assert.ok(m,expression);
   return (m[1]==='和'?p.a+p.b:Math.abs(p.a-p.b))===Number(m[2])&&(m[3]==='和'?p.a+p.b:p.a*p.b)===Number(m[4]);
  }
  default:throw Error(item.numeric_generator);
 }
}
test('every allowed numerical arrangement has exactly one mathematically correct answer and fits the text budget',()=>{
 assert.equal(items.length,11);let checked=0;
 for(const item of items)for(const parameters of mathVariantParameters(item.numeric_generator)){
  const q=renderMathVariant(item,parameters),answers=[q.answer,...q.dummies];checked++;
  assert.equal(answers.filter(expression=>correct(expression,item,parameters)).length,1,q.id+JSON.stringify(parameters));
  assert.ok(correct(q.answer,item,parameters));assert.equal(new Set(answers).size,4);
  assert.ok(Array.from(q.prompt+q.task+answers.join('')).length<=200,q.prompt);
  assert.ok(answers.every(a=>Array.from(a).length<=30),q.id);assert.ok(!q.note.includes('undefined'));
 }
 assert.equal(checked,296);
});
test('every appearance can change values, keeps stable coverage, and respects last values across sessions',()=>{
 for(const item of items){
  let history=normalizeHistory(null);const picker=createAdaptivePicker(makeQuestionQueue([item],()=>0),()=>history,()=>0);
  const a=picker()[0],b=picker()[0];assert.notEqual(a.variant.signature,b.variant.signature);assert.notEqual(a.prompt,b.prompt);
  assert.equal(questionKey(a),questionKey(b));assert.equal(questionCoverage([a,b],history).total,1);
  history=recordAnswer(history,b,{correct:true,chosen:b.answer,attempt:'first'});
  const fresh=createAdaptivePicker(makeQuestionQueue([item],()=>0),()=>normalizeHistory(JSON.parse(JSON.stringify(history))),()=>0)()[0];
  assert.notEqual(fresh.variant.signature,b.variant.signature);assert.equal(questionKey(fresh),questionKey(a));
 }
});
test('incorrect retries and review preserve the exact values, choices and explanation',()=>{
 const q=makeChoiceQuestion(items[0],()=>.25);const game=new Game([items[0]],[],0,()=>.25);
 game.questions=[q];game.changePhase('answer',0);const before=JSON.stringify(q);let now=2;
 const wrong=(q.correct+1)%4;
 for(let n=0;n<3;n++){now++;game.notes.push({target:now,lane:wrong,color:wrong,done:false});game.tap(wrong,now);}
 assert.equal(game.wrongCount,1);assert.equal(game.phase,'answer');assert.equal(JSON.stringify(game.question),before);
 const review=missedQuestions([{question:q,wrong:1,correct:false}])[0];assert.equal(JSON.stringify(review),before);
});
test('history snapshots retain actual numbers and all three recent appearances through normalization and legacy recovery',()=>{
 let history=normalizeHistory(null);const item=items.find(i=>i.numeric_generator==='equation_divide'),stored=[];
 for(let i=0;i<4;i++){
  const q=makeChoiceQuestion(item,()=>i/4);stored.push(q);
  history=recordAnswer(history,q,{correct:false,chosen:q.choices[(q.correct+1)%4],attempt:'attempt'+i,time:i*2+1});
  history=recordAnswer(history,q,{correct:true,chosen:q.answer,wrongBefore:1,attempt:'attempt'+i,time:i*2+2});
 }
 const restored=normalizeHistory(JSON.parse(JSON.stringify(history))),row=restored.questions[questionKey(stored[0])];
 assert.equal(row.answerCount,4);assert.equal(row.first,0);assert.equal(row.recent.length,3);
 assert.deepEqual(row.recent.map(r=>r.variant),stored.slice(1).map(q=>q.variant));
 for(let i=0;i<4;i++){
  const event=restored.events[i*2];assert.deepEqual(event.presentation,{prompt:stored[i].prompt,choices:stored[i].choices,note:stored[i].note});
  assert.equal(event.answer,stored[i].answer);assert.deepEqual(event.variant,stored[i].variant);
 }
 const recovered=normalizeHistory({...restored,questions:{[questionKey(stored[0])]:{...row,recent:undefined}}});
 assert.deepEqual(recovered.questions[questionKey(stored[0])].recent.map(r=>r.variant),stored.slice(1).map(q=>q.variant));
});
test('same seed and same history reproduce the ideal score reference and actual numerical questions',()=>{
 const make=()=>{
  const random=seededRandom(12345),history=normalizeHistory(null);
  const picker=createAdaptivePicker(makeQuestionQueue(items,random),()=>history,random);
  return new Game(items,Array.from({length:601},(_,i)=>({time:i*.5,bar:Math.floor(i/4),beatInBar:i%4+1,beatPosition:0,type:'beat'})),0,random,300,()=>true,picker,297,120);
 };
 const a=make(),b=make(),observedA=[],observedB=[];
 const referenceA=perfectReference(a,q=>observedA.push(q.variant));
 const referenceB=perfectReference(b,q=>observedB.push(q.variant));
 assert.deepEqual(referenceA,referenceB);assert.deepEqual(observedA,observedB);assert.ok(observedA.length>0);
 assert.equal(a.countedTaps,120);assert.equal(b.countedTaps,120);
});
test('non-numerical questions are unchanged and invalid generators or parameters are rejected',()=>{
 const fixed=data.find(q=>q.subject==='数学'&&!q.numeric_generator);
 assert.equal(materializeMathItem(fixed),fixed);assert.ok(!makeChoiceQuestion(fixed).variant);
 assert.throws(()=>materializeMathItem({...items[0],numeric_generator:'unknown'}));
 assert.throws(()=>renderMathVariant(items[0],{a:0,b:0}));
});
