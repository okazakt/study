import test from 'node:test';
import assert from 'node:assert/strict';
import {TimingCalibrator,calibrationPattern,matchCalibrationBeat,normalizeTiming,effectiveOffset,timingReport,analyzeTiming} from '../calibration.js';
test('slow playback samples normalize to the same real-world delay without applying the song offset twice',()=>{
 const beats=Array.from({length:20},(_,i)=>i*.5+.11733+.025);
 for(const rate of [.5,.75,1]){
  const m=matchCalibrationBeat(beats,beats[6]+.12*rate,rate,0);
  assert.equal(m.index,6);assert.ok(Math.abs(m.sampleMs-120)<1e-8);
  const aligned=matchCalibrationBeat(beats,beats[6]+.12*rate,rate,120);assert.ok(Math.abs(aligned.errorMs)<1e-8);
 }
});
test('gradual robust estimation rejects accidental taps and waits for enough stable data',()=>{
 const c=new TimingCalibrator(0);let previous=0;
 for(let i=0;i<80;i++){
  const out=c.add(i%11===0?400:120+[0,3,-3,1,-1][i%5],String(i));
  assert.ok(Math.abs(c.appliedMs-previous)<=12+1e-9);previous=c.appliedMs;
  if(i<31)assert.equal(out.ready,false);
 }
 const result=c.status();assert.equal(result.ready,true);assert.ok(Math.abs(result.estimateMs-120)<4);assert.ok(result.excluded>0);assert.ok(Math.abs(result.appliedMs-120)<12);
});
test('early offsets converge with the correct sign and erratic taps do not become stable',()=>{
 const early=new TimingCalibrator(0);for(let i=0;i<80;i++)early.add(-100+(i%3-1)*2,String(i));
 assert.equal(early.status().ready,true);assert.ok(early.status().estimateMs<0);
 const noisy=new TimingCalibrator();for(let i=0;i<80;i++)noisy.add(i%2===0?-150:200,String(i));assert.equal(noisy.status().ready,false);
});
test('warmup, duplicate presses, out-of-range taps and unmatched beats do not contaminate measurements',()=>{
 const beats=Array.from({length:20},(_,i)=>i*.5);
 assert.equal(matchCalibrationBeat(beats,beats[2],.5,0),null);
 const match=matchCalibrationBeat(beats,beats[5],.5,0,new Set(['0:5']));assert.equal(match,null);
 assert.equal(matchCalibrationBeat(beats,beats[5]+.25,.5,0),null);
 const c=new TimingCalibrator();assert.equal(c.add(100,'same').accepted,true);assert.equal(c.add(300,'same').accepted,false);assert.equal(c.add(NaN,'bad').accepted,false);assert.equal(c.add(501,'huge').accepted,false);assert.equal(c.status().count,1);
 assert.ok(matchCalibrationBeat(beats,beats[5],.5,0,new Set(['0:5']),1));
});
test('saved absolute values override a later common baseline rather than adding to it',()=>{
 const settings=normalizeTiming({version:1,activeOutput:'speaker',profiles:{speaker:{offsetMs:120,method:'calibrated'}}});
 assert.equal(effectiveOffset(settings,'speaker'),120);assert.equal(effectiveOffset(settings,'bluetooth'),92);
 assert.equal(normalizeTiming(JSON.parse(JSON.stringify(settings))).profiles.speaker.offsetMs,120);
 const report=timingReport(settings);assert.equal(report.recommendedBaselineMs,120);assert.equal(report.offsetMs,120);
});
test('manual legacy values migrate once, outputs remain independent, and invalid input falls back safely',()=>{
 const legacy=normalizeTiming(null,'-30');assert.equal(effectiveOffset(legacy),-30);
 assert.equal(effectiveOffset(legacy,'wired'),-30);
 const noProfile=normalizeTiming({version:1,activeOutput:'bluetooth',profiles:{}},'90');assert.equal(effectiveOffset(noProfile),92);
 assert.equal(normalizeTiming({version:1,activeOutput:'bad',profiles:{speaker:{offsetMs:900}}}).profiles.speaker.offsetMs,500);
 assert.equal(effectiveOffset(normalizeTiming(null,'not-a-number')),-101);
});

test('speaker and wired headphones share the pilot default while Bluetooth has its independent pilot baseline',()=>{
 const defaults=normalizeTiming(null);
 assert.equal(effectiveOffset(defaults,'speaker'),-101);assert.equal(effectiveOffset(defaults,'wired'),-101);
 assert.equal(effectiveOffset(defaults,'bluetooth'),92);assert.equal(effectiveOffset(defaults,'other'),0);
 defaults.profiles.speaker={offsetMs:-125,method:'calibrated'};defaults.profiles.bluetooth={offsetMs:80,method:'calibrated'};
 assert.equal(effectiveOffset(defaults,'wired'),-125);assert.equal(effectiveOffset(defaults,'bluetooth'),80);
 assert.equal(timingReport(defaults,'speaker').currentBaselineMs,-101);assert.equal(timingReport(defaults,'bluetooth').currentBaselineMs,92);
});
test('old wired output migrates to the shared active value without losing Bluetooth settings or adding the baseline',()=>{
 const old={version:1,activeOutput:'wired',profiles:{speaker:{offsetMs:0},wired:{offsetMs:-101,method:'calibrated'},bluetooth:{offsetMs:75}}};
 const migrated=normalizeTiming(old);assert.equal(migrated.activeOutput,'speaker');assert.equal(effectiveOffset(migrated),-101);
 assert.equal(effectiveOffset(migrated,'wired'),-101);assert.equal(effectiveOffset(migrated,'bluetooth'),75);
 const speaker=normalizeTiming({...old,activeOutput:'speaker'});assert.equal(effectiveOffset(speaker),0);
 const fallback=normalizeTiming({version:1,activeOutput:'bluetooth',profiles:{wired:{offsetMs:-115},bluetooth:{offsetMs:55}}});
 assert.equal(effectiveOffset(fallback,'speaker'),-115);assert.equal(effectiveOffset(fallback),55);
 assert.equal(effectiveOffset(normalizeTiming(JSON.parse(JSON.stringify(migrated)))),-101);
});


test('calibration patterns insert rests and isolated references with varying phrase lengths',()=>{
 const beats=Array.from({length:100},(_,i)=>i*.5),pattern=calibrationPattern(beats);
 assert.deepEqual(pattern.slice(0,5).map(p=>p.index),[4,5,6,7,12]);
 assert.deepEqual(pattern.filter(p=>p.anchor).slice(0,4).map(p=>p.index),[12,24,38,51]);
 assert.ok(!pattern.some(p=>p.index===9));
 for(const anchor of pattern.filter(p=>p.anchor))for(const p of pattern)if(p!==anchor)assert.ok(Math.abs(p.index-anchor.index)>=4);
 assert.deepEqual(calibrationPattern([]),[]);
});
test('rests and duplicate references are excluded while isolated taps detect an absolute one-beat shift',()=>{
 const beats=Array.from({length:100},(_,i)=>i*.5),pattern=calibrationPattern(beats);
 for(const rate of [.5,.75,1])for(const delay of [-400,400]){
  const m=matchCalibrationBeat(beats,beats[12]+delay/1000*rate,rate,delay>0?-100:100,new Set(),0,pattern);
  assert.equal(m.index,12);assert.equal(m.anchor,true);assert.ok(Math.abs(m.sampleMs-delay)<1e-7);
  assert.equal(matchCalibrationBeat(beats,beats[12]+delay/1000*rate,rate,0,new Set([m.id]),0,pattern),null);
 }
 assert.equal(matchCalibrationBeat(beats,beats[9],1,0,new Set(),0,pattern),null);
 assert.equal(matchCalibrationBeat(beats,beats[2],1,0,new Set(),0,pattern),null);
});
test('repeated continuous taps cannot enable saving without isolated reference confirmation',()=>{
 const c=new TimingCalibrator(0,true);
 for(let i=0;i<100;i++)c.add(100+(i%3-1),String(i));
 assert.equal(c.status().ready,false);assert.equal(c.status().anchorCount,0);
 for(let i=0;i<4;i++)c.add(100,'anchor'+i,true);
 assert.equal(c.status().ready,true);
});
test('references override a stable one-beat alias and eventually converge at every playback speed',()=>{
 const beats=Array.from({length:1600},(_,i)=>i*.5),pattern=calibrationPattern(beats);
 for(const rate of [.5,.75,1])for(const delay of [-400,400]){
  const c=new TimingCalibrator(delay>0?-100:100,true),used=new Set();
  let anchors=0;
  for(const p of pattern){
   const m=matchCalibrationBeat(beats,p.base+delay/1000*rate,rate,c.appliedMs,used,0,pattern);
   if(!m)continue;
   used.add(m.id);if(m.anchor)anchors++;
   c.add(m.sampleMs,m.id,m.anchor);
   if(anchors<4)assert.equal(c.status().ready,false);
  }
  assert.equal(c.status().ready,true,JSON.stringify({rate,delay,status:c.status()}));
  assert.ok(Math.abs(c.status().estimateMs-delay)<1e-6);assert.ok(Math.abs(c.appliedMs-delay)<12);assert.ok(c.status().referenceCorrections>0);
 }
});
test('erratic reference taps cannot validate an otherwise steady continuous rhythm',()=>{
 const c=new TimingCalibrator(0,true);
 for(let i=0;i<120;i++)c.add(0,'steady'+i);
 for(let i=0;i<16;i++)c.add(i%2?-400:400,'anchor'+i,true);
 assert.equal(c.status().anchorReady,false);assert.equal(c.status().ready,false);
});
