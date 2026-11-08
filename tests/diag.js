const {MC,Synth,FS}=require('./harness');
for(const f0 of [420,540,650,760]){
  const r=Synth.rng(3000+f0),DUR=20;
  const cx=Synth.fan(FS,DUR,Synth.rng(1)),d=new MC.AcousticDetector({fs:FS});
  d.controlBegin();for(let o=0;o+d.n<=cx.length;o+=d.hop)d.push(cx.subarray(o,o+d.n));const nl=d.controlEnd();d.resetTrack();
  const x=Synth.mix(Synth.mosquito(FS,DUR,{f0},r),Synth.fan(FS,DUR,r),FS,5);
  const why={};let n=0,tonal=0,fmed=[];let last;
  for(let o=0;o+d.n<=x.length;o+=d.hop){last=d.push(x.subarray(o,o+d.n));n++;if(last.rec.tonal)tonal++;for(const w of last.rec.why)why[w]=(why[w]||0)+1;fmed.push(last.rec.f0)}
  fmed.sort((a,b)=>a-b);
  console.log('f0',f0,'lines masked:',nl.lines.slice(0,12).join(','),'| frames',n,'tonal',tonal,'median f0 est',fmed[fmed.length>>1].toFixed(0),'finalLLR',last.llr.toFixed(0),last.state);
  console.log('   vetoes:',JSON.stringify(why));
}
