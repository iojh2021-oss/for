const {MC,Synth,FS,runAcoustic,summarize}=require('./harness');
const NT=process.env.NOISE||'pink',SEEDS=+(process.env.SEEDS||4),DUR=20;
const noises={pink:(r)=>Synth.pink(FS,DUR,r),white:(r)=>Synth.white(FS,DUR,r),fan:(r)=>Synth.fan(FS,DUR,r)};
const F0S=(process.env.F0S||'350,480,650,800').split(',').map(Number),SNRS=(process.env.SNRS||'-8,-6,-4,-2,0,5').split(',').map(Number);
console.log('noise:',NT,' (SNR is in-band 250-2000 Hz, 20 s trials, '+F0S.length*SEEDS+' trials per SNR)');
console.log('SNR(dB) | likely<=10s | confirmed<=20s | median t_confirm(s) | median f0 error(Hz)');
for(const snr of SNRS){
  let lik=0,con=0,N=0;const tc=[],fe=[];
  for(const f0 of F0S)for(let s=1;s<=SEEDS;s++){
    const r=Synth.rng(1000*s+f0+Math.round(snr*7)+7);
    const x=Synth.mix(Synth.mosquito(FS,DUR,{f0},r),noises[NT](r),FS,snr);
    let det0=null;
    if(process.env.CTRL){const cr=Synth.rng(777+s);const cx=noises[NT](cr);const d=new MC.AcousticDetector({fs:FS});d.controlBegin();for(let o=0;o+d.n<=cx.length;o+=d.hop)d.push(cx.subarray(o,o+d.n));d.controlEnd();d.resetTrack();det0=d}
    const run=det0?(()=>{const out=[];for(let o=0;o+det0.n<=x.length;o+=det0.hop)out.push(det0.push(x.subarray(o,o+det0.n)));return{out}})():runAcoustic(x);
    const {out}=run,sm=summarize(out);N++;
    if(sm.tLik!==null&&sm.tLik<=10)lik++;
    if(sm.tCon!==null){con++;tc.push(sm.tCon)}
    const late=out.slice(-30).map(o=>o.rec.f0).sort((a,b)=>a-b);fe.push(Math.abs(late[late.length>>1]-f0));
  }
  tc.sort((a,b)=>a-b);fe.sort((a,b)=>a-b);
  console.log(String(snr).padStart(6),'  |',(lik+'/'+N).padStart(8),'   |',(con+'/'+N).padStart(8),'      |',(tc.length?tc[tc.length>>1].toFixed(1):'-').padStart(8),'            |',fe[fe.length>>1].toFixed(1));
}
