// All music uses one AudioContext clock. Schedule decoded songs ahead of time
// so a source/network change cannot insert a gap at the boundary.
export class MusicPlayer {
  constructor(context,output){this.context=context;this.output=output;this.buffers=new Map();this.sources=[];this.startedAt=null;this.stoppedTime=0;}
  async prepare(playlist,fetchAudio=fetch){
    const needed=new Map(playlist.tracks.map(track=>[track.files.audio,track]));
    for(const key of this.buffers.keys())if(!needed.has(key))this.buffers.delete(key);
    for(const [key] of needed){
      if(this.buffers.has(key))continue;
      const response=await fetchAudio(`./music-data/${key}`);
      if(!response.ok)throw new Error('Music download failed');
      const buffer=await this.context.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(key,buffer);
    }
  }
  start(playlist,endTime){
    this.stop();this.stoppedTime=0;this.startedAt=this.context.currentTime+.05;
    for(const track of playlist.tracks){
      if(track.start>=endTime)break;
      const buffer=this.buffers.get(track.files.audio);
      if(!buffer)throw new Error('Music not prepared');
      const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.output);
      const duration=Math.min(track.durationSeconds,endTime-track.start,buffer.duration-track.mediaStart);
      if(duration<=0)throw new Error('Invalid music duration');
      const when=this.startedAt+track.start;
      // Tiny edge ramps avoid clicks while keeping the next song contiguous.
      const gain=this.context.createGain();source.disconnect();source.connect(gain);gain.connect(this.output);
      gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(1,when+.005);
      gain.gain.setValueAtTime(1,when+Math.max(.005,duration-.005));gain.gain.linearRampToValueAtTime(0,when+duration);
      source.start(when,track.mediaStart,duration);this.sources.push({source,gain});
    }
  }
  get running(){return this.startedAt!==null;}
  get time(){return this.startedAt===null?this.stoppedTime:Math.max(0,this.context.currentTime-this.startedAt);}
  stop(){
    this.stoppedTime=this.time;this.startedAt=null;
    for(const {source,gain} of this.sources){try{source.stop();}catch{}source.disconnect();gain.disconnect();}
    this.sources=[];
  }
}
