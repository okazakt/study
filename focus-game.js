import {Game,RULES,SCORE,revealPlan,timingError} from './game.js?v=0.62.0';

// The chart's main beats are timing opportunities, without visible/moving notes.
export function focusReveal(question,speed){
  const base=revealPlan(question,speed);
  if(speed==='instant')return {...base,instant:true,duration:0,revealEnd:0,liftStart:0,liftSeconds:0};
  const charSeconds=speed==='fast'?1/12:speed==='normal'?revealPlan(question,'normal').charSeconds:RULES.charSeconds;
  const fadeSeconds=Math.min(.35,charSeconds*2);let cursor=0;
  const part=text=>{const start=cursor;cursor+=Array.from(text||'').length*charSeconds;return {start,end:cursor};};
  const context=question.continuation?{start:0,end:0}:part(question.context?question.task:'');
  const prompt=question.continuation?{start:0,end:0}:part(question.prompt);
  const choices=question.choices.map(part);
  return {...base,context,prompt,choices,charSeconds,fadeSeconds,instant:false,revealEnd:cursor,duration:cursor+fadeSeconds,liftStart:0,liftSeconds:0};
}
export class FocusGame extends Game {
  constructor(questions,events,offset=0,random=Math.random,endTime=Infinity,accept=()=>true,picker=null,questionEndTime=endTime,_goal=null,options={}){
    super(questions,events,offset,random,endTime,accept,picker,questionEndTime,null,{...options,rhythm:'focus'});
    this.focus=true;this.musicBeats=this.events.filter(e=>e.target>=0&&e.target+RULES.goodWindow<=endTime).map(e=>({...e,done:false}));
    this.beats=this.musicBeats.filter(e=>e.focusEligible!==false);
    this.beatCursor=0;this.focusWhite=0;this.focusColor=0;this.focusAnswer=0;this.changePhase('read',0);
  }
  get requiredTaps(){return 1;}
  refreshScore(){} // Focus uses direct points, not the normal mode's 120-note normalization.
  get scoreBreakdown(){return {netWhite:this.focusWhite||0,netColor:this.focusColor||0,baseAnswer:this.focusAnswer||0,
    whiteBonus:this.whiteComboBonus,colorBonus:this.colorComboBonus,answerBonus:this.answerComboBonus};}
  beatAfter(now,count=1){return this.musicBeats.filter(b=>b.target>now+1e-8)[count-1]?.target??Infinity;}
  pulse(now){let distance=Infinity;for(const b of this.beats){if(b.target>now+.2)break;distance=Math.min(distance,Math.abs(now-b.target));}return Math.max(0,1-distance/.16);}
  earliestCompletion(now){
    let time=now;
    for(let step=0;step<this.questions.length;step++){
      const q=this.questions[(this.questionIndex+step)%this.questions.length];
      if(step&&!(q.continuation&&q.sourceId===this.question.sourceId&&q.mode===this.question.mode))break;
      time=this.beats.find(b=>b.target>time+focusReveal(q,this.options.speed).duration+1e-8)?.target??Infinity;
      time=this.beatAfter(time,2);
    }return time;
  }
  changePhase(phase,now){
    if(phase==='read'){
      if(this.pickUnit&&this.questionIndex>=this.questions.length)this.questions.push(...this.pickUnit());
      if(!this.question.continuation&&this.earliestCompletion(now)>Math.min(this.endTime,this.questionEndTime))phase='outro';
    }
    this.phase=phase;this.phaseStart=now;
    if(phase==='read'){
      this.reveal=focusReveal(this.question,this.options.speed);this.counts=[0,0,0,0];this.firstTry=true;this.stageWrongCount=0;this.colorRowsUsed=0;this.quizResult=null;this.message='';
      this.startedQuestions.add(this.questionIndex);
    }
    if(phase==='answer')this.message='答えの色を1回タップ';
    if(phase==='feedback')this.nextQuestionAt=this.beatAfter(Math.max(now,this.answerBeat??now),2);
    if(phase==='outro'){this.quizResult=null;this.message='最後まで拍に合わせてタップ';}
  }
  update(now){
    this.time=now;if(this.phase==='ended')return;
    while(this.beatCursor<this.beats.length&&this.beats[this.beatCursor].target+RULES.goodWindow+1e-9<now){
      const b=this.beats[this.beatCursor++];if(!b.done){b.done=true;this.combo=0;this.missedNotes++;this.judge('MISS',now);}
    }
    if(this.phase==='read'&&now-this.phaseStart+1e-9>=this.reveal.duration)this.changePhase('answer',now);
    if(this.phase==='feedback'&&now+1e-9>=this.nextQuestionAt){this.questionIndex++;this.changePhase('read',now);if(this.reveal.duration===0&&this.phase==='read')this.changePhase('answer',now);}
  }
  tap(lane,now){
    this.update(now);if(this.phase==='ended'||lane< -1||lane>3)return null;
    if(lane>=0&&this.phase!=='answer')return null;
    const colored=lane>=0;
    const beat=this.beats.slice(this.beatCursor).find(b=>!b.done&&Math.abs(timingError(b.target,now))<=RULES.goodWindow+1e-9);
    let label='MISS';
    if(beat){
      beat.done=true;label=Math.abs(timingError(beat.target,now))<=RULES.perfectWindow+1e-9?'PERFECT':'GOOD';
      this.maxCombo=Math.max(this.maxCombo,++this.combo);
      const points=label==='PERFECT'?10:5;
      // Only the first color attempt at a stage earns rhythm points/bonus.
      if(!colored||this.stageWrongCount===0){
        if(colored){this.focusColor+=points;this.colorComboBonus+=this.combo;}else{this.focusWhite+=points;this.whiteComboBonus+=this.combo;}
      }
    }else{this.combo=0;this.emptyMisses++;}
    this.judge(label,now);
    const note={color:colored?lane:null,lane,target:beat?.target??now};
    if(colored){
      const oldScore=this.quizScore,wrong=this.stageWrongCount,oldCorrect=this.correctCount;
      this.answerBeat=beat?.target??now;super.submitAnswer(lane,now);
      if(this.correctCount>oldCorrect){const base=Math.round(50*SCORE.answerRates[Math.min(wrong,3)]),bonus=this.firstTry?this.quizCombo*10:0;
        this.focusAnswer+=base;this.answerComboBonus+=bonus;this.quizScore=oldScore+base+bonus;}
      if(this.phase==='answer')this.message='もう一度、答えの色を1回タップ';
    }
    this.rhythmScore=this.focusWhite+this.focusColor+this.whiteComboBonus+this.colorComboBonus;
    return note;
  }
}
