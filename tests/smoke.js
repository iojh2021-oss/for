const {MC,Synth,FS,runAcoustic,summarize}=require('./harness');
// 1) FFT vs naive DFT
const n=64,fft=MC.makeFFT(n),re=new Float64Array(n),im=new Float64Array(n),x=[];
for(let i=0;i<n;i++){x.push(Math.sin(2*Math.PI*5*i/n)+.3*Math.cos(2*Math.PI*11*i/n));re[i]=x[i]}
fft(re,im);let err=0;
for(let k=0;k<n;k++){let r=0,m=0;for(let i=0;i<n;i++){r+=x[i]*Math.cos(2*Math.PI*k*i/n);m-=x[i]*Math.sin(2*Math.PI*k*i/n)}err=Math.max(err,Math.hypot(r-re[k],m-im[k]))}
console.log('FFT max error vs DFT:',err.toExponential(2));
const r=Synth.rng(1);
let t0=Date.now();
const noise=Synth.pink(FS,20,r),mos=Synth.mosquito(FS,20,{f0:480},r);
for(const snr of [-10,-5,0,5,10]){
  const x=Synth.mix(mos,noise,FS,snr),{out}=runAcoustic(x);
  const s=summarize(out),last=out[out.length-1];
  console.log('SNR',snr,'dB  state max',s.mx,'tLik',s.tLik&&s.tLik.toFixed(1),'tCon',s.tCon&&s.tCon.toFixed(1),'finalLLR',last.llr.toFixed(1),'f0',last.rec.f0.toFixed(1),'snrFrame',last.rec.snr.toFixed(1));
}
const {out}=runAcoustic(Synth.pink(FS,20,Synth.rng(2)));console.log('pink only: max state',summarize(out).mx,'final LLR',out[out.length-1].llr.toFixed(1),'median l',out.map(o=>o.rec.l).sort((a,b)=>a-b)[out.length>>1].toFixed(2));
console.log('elapsed ms',Date.now()-t0,'per frame ms',((Date.now()-t0)/(out.length*6)).toFixed(2));
