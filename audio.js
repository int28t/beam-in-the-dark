const SOUNDS={step:[90,45,.075,.025,'triangle'],click:[200,85,.055,.035,'square'],
  key:[660,990,.3,.065,'sine'],battery:[330,660,.2,.05,'sine'],
  caught:[140,38,.6,.09,'sawtooth'],complete:[520,1040,.6,.055,'sine']};

export function createAudio({Context=globalThis.AudioContext??globalThis.webkitAudioContext}={}) {
  let context=null,muted=false,disposed=false,drone=null,stepTimer=0;
  const voices=new Set();
  function voice(frequency,endFrequency,duration,volume,type='sine'){
    if(disposed||muted||!context||context.state!=='running'||voices.size>=16)return null;
    const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
    let active=true;
    const node={stop(){if(!active)return;try{oscillator.stop();}catch{}cleanup();}};
    function cleanup(){if(!active)return;active=false;oscillator.disconnect();gain.disconnect();voices.delete(node);if(drone===node)drone=null;}
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,now);
    if(duration!==null)oscillator.frequency.exponentialRampToValueAtTime(endFrequency,now+duration);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.015);
    if(duration!==null)gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    oscillator.connect(gain);gain.connect(context.destination);oscillator.onended=cleanup;
    voices.add(node);oscillator.start();if(duration!==null)oscillator.stop(now+duration+.02);
    return node;
  }
  function pause(){for(const node of [...voices])node.stop();stepTimer=0;}
  return {
    async unlock(){
      if(disposed||!Context||muted)return false;
      try{if(!context)context=new Context();if(context.state!=='running')await context.resume();return !disposed&&context.state==='running';}
      catch{return false;}
    },
    play(event){const sound=SOUNDS[event];if(sound)voice(...sound);},
    update(dt,{threat=false,walking=false}={}){
      if(threat){if(!drone)drone=voice(58,58,null,.025,'triangle');}
      else drone?.stop();
      stepTimer-=dt;
      if(walking&&stepTimer<=0){const sound=SOUNDS.step;voice(...sound);stepTimer=.34;}
      if(!walking)stepTimer=0;
    },
    setMuted(value){muted=Boolean(value);if(muted)pause();},
    pause,
    dispose(){if(disposed)return;disposed=true;pause();if(context)context.close().catch(()=>{});},
  };
}
