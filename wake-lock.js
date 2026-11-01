// A generation prevents an old, asynchronous request from holding the screen
// awake after the player has left the play screen.
export class ScreenWakeLock {
  constructor(api,visible=()=>true){this.api=api;this.visible=visible;this.enabled=false;this.generation=0;this.lock=null;this.pending=null;}
  setEnabled(enabled){
    if(this.enabled!==enabled){this.enabled=enabled;this.generation++;}
    if(!enabled){const lock=this.lock;this.lock=null;return Promise.resolve(lock?.release()).catch(()=>false);}
    return this.acquire();
  }
  acquire(){
    if(!this.enabled||!this.visible()||!this.api?.request)return Promise.resolve(false);
    if(this.lock&&!this.lock.released)return Promise.resolve(true);
    const generation=this.generation;
    if(this.pending?.generation===generation)return this.pending.promise;
    const pending={generation};this.pending=pending;
    pending.promise=Promise.resolve().then(()=>this.api.request('screen')).then(async lock=>{
      if(!this.enabled||generation!==this.generation||!this.visible()){await lock.release();return false;}
      this.lock=lock;
      lock.addEventListener('release',()=>{
        if(this.lock!==lock)return;
        this.lock=null;
        if(this.enabled&&this.visible())this.acquire();
      },{once:true});
      return true;
    }).catch(()=>false).finally(()=>{if(this.pending===pending)this.pending=null;});
    return pending.promise;
  }
}
