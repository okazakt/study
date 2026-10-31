// Shared speaker/wired baseline from the pilot; Bluetooth stays independent.
// Saved absolute device values always override their output baseline.
export const DEFAULT_TIMING_OFFSET_MS = -101;
export const DEFAULT_TIMING_OFFSETS_MS = Object.freeze({speaker:DEFAULT_TIMING_OFFSET_MS,bluetooth:108,other:0});
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
// Four consecutive taps, then a widely isolated reference tap. Vary the
// phrase length so a whole-pattern shift cannot look consistently correct.
export function calibrationPattern(beats){
  const pattern=[];let start=4,cycle=0;
  while(start<beats.length){
    for(const offset of [0,1,2,3,8])if(start+offset<beats.length)pattern.push({index:start+offset,base:beats[start+offset],anchor:offset===8});
    start += [12,14,13][cycle++%3];
  }
  return pattern;
}
export class TimingCalibrator {
  constructor(initialMs=0,requireAnchors=false){this.requireAnchors=requireAnchors;this.anchors=[];this.referenceCorrections=0;this.appliedMs=clampOffset(initialMs);this.samples=[];this.used=new Set();this.centers=[];this.accepted=0;}
  add(sampleMs,id,anchor=false){
    if(!Number.isFinite(sampleMs)||Math.abs(sampleMs)>500||this.used.has(id))return {accepted:false,...this.status()};
    if(anchor){this.anchors.push(sampleMs);if(this.anchors.length>16)this.anchors.shift();}
    this.used.add(id);this.samples.push(sampleMs);if(this.samples.length>64)this.samples.shift();this.accepted++;
    const reference=this.analysis();
    if(this.requireAnchors && reference.anchorReady && Math.abs(reference.estimateMs-this.appliedMs)>100){
      this.appliedMs=clampOffset(reference.estimateMs);this.centers=[];this.referenceCorrections++;
    }
    if(this.accepted>=8 && this.accepted%4===0){
      const analysis=this.analysis();
      this.appliedMs=Math.max(-500,Math.min(500,this.appliedMs+Math.max(-12,Math.min(12,(analysis.estimateMs-this.appliedMs)*.25))));
      this.centers.push(analysis.estimateMs);if(this.centers.length>3)this.centers.shift();
    }
    return {accepted:true,...this.status()};
  }
  analysis(){
    const anchors=analyzeTiming(this.anchors);
    const anchorReady=anchors.inliers>=4 && anchors.inliers>=this.anchors.length*.75 && anchors.spreadMs<=35;
    const samples=this.requireAnchors && anchorReady ? this.samples.filter(v=>Math.abs(v-anchors.estimateMs)<=100) : this.samples;
    const stats=analyzeTiming(samples);
    return {...stats,excluded:this.samples.length-stats.inliers,anchorCount:anchors.inliers,anchorReady};
  }
  status(){
    const stats=this.analysis(),stable=this.centers.length===3 && Math.max(...this.centers)-Math.min(...this.centers)<=20;
    const ready=(!this.requireAnchors || stats.anchorReady) && stats.inliers>=32 && stats.inliers>=this.samples.length*.75 && stats.spreadMs<=35 && stable && Math.abs(stats.estimateMs-this.appliedMs)<=12;
    return {...stats,appliedMs:this.appliedMs,count:this.accepted,referenceCorrections:this.referenceCorrections,ready};
  }
}
// base times already include the song's correction. Device delay is a wall-clock
// duration, so its song-clock representation scales with playbackRate.
export function matchCalibrationBeat(beats, now, rate, appliedMs, used=new Set(), round=0,pattern=null){
  if(!Number.isFinite(now)||!Number.isFinite(rate)||rate<=0)return null;
  if(pattern){
    // Isolated taps identify the absolute beat even with a one-beat error
    // in the current estimate. Their surrounding rests prevent aliasing.
    const anchor=pattern.filter(p=>p.anchor && Math.abs((now-p.base)/rate*1000)<=500+1e-7).sort((a,b)=>Math.abs(now-a.base)-Math.abs(now-b.base))[0];
    if(anchor){
      const id=`${round}:${anchor.index}`;
      if(used.has(id))return null;
      const sampleMs=(now-anchor.base)/rate*1000;
      return {...anchor,id,sampleMs,errorMs:sampleMs-appliedMs};
    }
  }
  let best=null;
  for(let i=0;i<beats.length;i++){
    const errorMs=(now-beats[i])/rate*1000-appliedMs;
    if(!best || Math.abs(errorMs)<Math.abs(best.errorMs))best={index:i,id:`${round}:${i}`,base:beats[i],errorMs,sampleMs:(now-beats[i])/rate*1000};
  }
  if(!best || best.index<4 || used.has(best.id))return null;
  if(pattern && !pattern.some(p=>p.index===best.index && !p.anchor))return null;
  const i=best.index, interval=Math.min(i?beats[i]-beats[i-1]:Infinity,i+1<beats.length?beats[i+1]-beats[i]:Infinity);
  return Math.abs(best.errorMs)<=Math.min(490,interval/rate*1000*.49)?best:null;
}
export function timingReport(settings, output=settings.activeOutput){
  output=outputKey(output);
  const profile=settings.profiles[output];
  return profile ? {type:'study-beat-timing',algorithm:1,output,offsetMs:profile.offsetMs,recommendedBaselineMs:profile.offsetMs,currentBaselineMs:defaultTimingOffset(output),...profile} : null;
}
