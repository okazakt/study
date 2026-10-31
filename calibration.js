// Shared speaker/wired baseline from the pilot; Bluetooth stays independent.
// Saved absolute device values always override their output baseline.
export const DEFAULT_TIMING_OFFSET_MS = -101;
export const DEFAULT_TIMING_OFFSETS_MS = Object.freeze({speaker:DEFAULT_TIMING_OFFSET_MS,bluetooth:0,other:0});
export const outputKey = output => output === 'wired' ? 'speaker' : output;
export const defaultTimingOffset = output => DEFAULT_TIMING_OFFSETS_MS[outputKey(output)] ?? 0;
export const TIMING_KEY = 'study-beat-timing-v1';
export const OUTPUTS = [['speaker','スピーカー・有線ヘッドホン'],['bluetooth','Bluetooth'],['other','その他']];
export const clampOffset = value => Math.max(-500,Math.min(500,Math.round(value)));
const median = values => { const a=[...values].sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length ? (a.length%2?a[i]:(a[i-1]+a[i])/2) : 0; };
export function normalizeTiming(raw, legacy = null) {
  const profiles={};
  if(raw?.version===1)for(const [key] of OUTPUTS){
    let p=raw.profiles?.[key];
    if(key==='speaker'){
      const ordered=raw.activeOutput==='wired'?[raw.profiles?.wired,p]:[p,raw.profiles?.wired];
      p=ordered.find(profile=>profile && Number.isFinite(profile.offsetMs));
    }
    if(p && Number.isFinite(p.offsetMs))profiles[key]={...p,offsetMs:clampOffset(p.offsetMs)};
  }
  const requested=outputKey(raw?.activeOutput);
  const activeOutput=OUTPUTS.some(([key])=>key===requested)?requested:'speaker';
  if(raw?.version!==1 && legacy!==null && legacy!=='' && Number.isFinite(Number(legacy)))profiles[activeOutput]={offsetMs:clampOffset(Number(legacy)),method:'manual'};
  return {version:1,activeOutput,profiles};
}
export const effectiveOffset = (settings, output=settings.activeOutput) => settings.profiles[outputKey(output)]?.offsetMs ?? defaultTimingOffset(output);
export function analyzeTiming(values) {
  const center=median(values),mad=median(values.map(v=>Math.abs(v-center))),limit=Math.max(25,3*1.4826*mad);
  const inliers=values.filter(v=>Math.abs(v-center)<=limit);
  const estimate=median(inliers),spread=median(inliers.map(v=>Math.abs(v-estimate)));
  return {estimateMs:estimate,spreadMs:spread,inliers:inliers.length,excluded:values.length-inliers.length};
}
export class TimingCalibrator {
  constructor(initialMs=0){this.appliedMs=clampOffset(initialMs);this.samples=[];this.used=new Set();this.centers=[];this.accepted=0;}
  add(sampleMs,id){
    if(!Number.isFinite(sampleMs)||Math.abs(sampleMs)>500||this.used.has(id))return {accepted:false,...this.status()};
    this.used.add(id);this.samples.push(sampleMs);if(this.samples.length>64)this.samples.shift();this.accepted++;
    if(this.accepted>=8 && this.accepted%4===0){
      const analysis=analyzeTiming(this.samples);
      this.appliedMs=Math.max(-500,Math.min(500,this.appliedMs+Math.max(-12,Math.min(12,(analysis.estimateMs-this.appliedMs)*.25))));
      this.centers.push(analysis.estimateMs);if(this.centers.length>3)this.centers.shift();
    }
    return {accepted:true,...this.status()};
  }
  status(){
    const stats=analyzeTiming(this.samples),stable=this.centers.length===3 && Math.max(...this.centers)-Math.min(...this.centers)<=20;
    const ready=stats.inliers>=32 && stats.inliers>=this.samples.length*.75 && stats.spreadMs<=35 && stable && Math.abs(stats.estimateMs-this.appliedMs)<=12;
    return {...stats,appliedMs:this.appliedMs,count:this.accepted,ready};
  }
}
// base times already include the song's correction. Device delay is a wall-clock
// duration, so its song-clock representation scales with playbackRate.
export function matchCalibrationBeat(beats, now, rate, appliedMs, used=new Set(), round=0){
  if(!Number.isFinite(now)||!Number.isFinite(rate)||rate<=0)return null;
  let best=null;
  for(let i=0;i<beats.length;i++){
    const errorMs=(now-beats[i])/rate*1000-appliedMs;
    if(!best || Math.abs(errorMs)<Math.abs(best.errorMs))best={index:i,id:`${round}:${i}`,base:beats[i],errorMs,sampleMs:(now-beats[i])/rate*1000};
  }
  if(!best || best.index<4 || used.has(best.id))return null;
  const i=best.index, interval=Math.min(i?beats[i]-beats[i-1]:Infinity,i+1<beats.length?beats[i+1]-beats[i]:Infinity);
  return Math.abs(best.errorMs)<=Math.min(490,interval/rate*1000*.49)?best:null;
}
export function timingReport(settings, output=settings.activeOutput){
  output=outputKey(output);
  const profile=settings.profiles[output];
  return profile ? {type:'study-beat-timing',algorithm:1,output,offsetMs:profile.offsetMs,recommendedBaselineMs:profile.offsetMs,currentBaselineMs:defaultTimingOffset(output),...profile} : null;
}
