const {MC,Synth,FS,runAcoustic}=require('./harness');
const r=Synth.rng(5);
console.log('f0 accuracy (steady tone with weak harmonics, SNR 10 dB):');
for(const f of [350,433,480,517,650,800]){
  const x=Synth.mix(Synth.mosquito(FS,12,{f0:f,jitter:0},r),Synth.pink(FS,12,r),FS,10);
  const {out}=runAcoustic(x);const v=out.slice(8).map(o=>o.rec.f0);const m=v.reduce((a,b)=>a+b,0)/v.length;
  console.log(' true',f,' mean est',m.toFixed(2),' bias',(m-f).toFixed(2),' sd',Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length).toFixed(2));
}
