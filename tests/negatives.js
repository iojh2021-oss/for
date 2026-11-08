const {MC,Synth,FS,runAcoustic,summarize}=require('./harness');
const params=process.env.PARAMS?JSON.parse(process.env.PARAMS):undefined;
const DUR=+(process.env.DUR||60),SEEDS=+(process.env.SEEDS||5);
const gens={
 white:(r)=>Synth.white(FS,DUR,r),
 pink:(r)=>Synth.pink(FS,DUR,r),
 brown:(r)=>Synth.brown(FS,DUR,r),
 hum50:(r)=>Synth.mix(Synth.hum(FS,DUR,{f:50},r),Synth.pink(FS,DUR,r),FS,10),
 hum60:(r)=>Synth.mix(Synth.hum(FS,DUR,{f:60},r),Synth.pink(FS,DUR,r),FS,10),
 speechMale:(r)=>Synth.mix(Synth.speech(FS,DUR,{f0:110},r),Synth.pink(FS,DUR,r),FS,12),
 speechFemale:(r)=>Synth.mix(Synth.speech(FS,DUR,{f0:210},r),Synth.pink(FS,DUR,r),FS,12),
 speechChild:(r)=>Synth.mix(Synth.speech(FS,DUR,{f0:330},r),Synth.pink(FS,DUR,r),FS,12),
 fan:(r)=>Synth.fan(FS,DUR,r),
 beep500:(r)=>Synth.mix(Synth.tone(FS,DUR,500,r),Synth.pink(FS,DUR,r),FS,10),
 chord:(r)=>Synth.mix(Synth.chord(FS,DUR,[440,554.4,659.3],r),Synth.pink(FS,DUR,r),FS,10),
 siren:(r)=>{const n=Math.round(FS*DUR),x=new Float32Array(n);let ph=0;for(let i=0;i<n;i++){const t=i/FS,f=650+250*Math.sin(2*Math.PI*.4*t);ph+=2*Math.PI*f/FS;x[i]=Math.sin(ph)+.3*Math.sin(2*ph)}return Synth.mix(x,Synth.pink(FS,DUR,r),FS,10)},
 bandNoise:(r)=>{const w=Synth.white(FS,DUR,r),x=new Float32Array(w.length);let a=0,b=0;// band-pass ~450-550 Hz via two one-pole filters
   for(let i=0;i<w.length;i++){a+=(w[i]-a)*.19;b+=(a-b)*.19;x[i]=a-b}return Synth.mix(x,Synth.pink(FS,DUR,r),FS,10)}
};
const only=process.env.TYPES?process.env.TYPES.split(','):null;const rows=[];let total=0,fa=0;
for(const k of Object.keys(gens)){ if(only&&!only.includes(k))continue;
  let flagged=0,maxL=-1e9,maxS=0,sumLik=0;
  for(let s=1;s<=SEEDS;s++){
    const x=gens[k](Synth.rng(100*s+k.length)),{out}=runAcoustic(x,params),sm=summarize(out);
    if(sm.mx>=2)flagged++;maxS=Math.max(maxS,sm.mx);
    for(const o of out){if(o.llr>maxL)maxL=o.llr;if(o.state==='likely'||o.state==='confirmed')sumLik++}
  }
  total+=SEEDS;fa+=flagged;
  rows.push(`${k.padEnd(13)} flagged ${flagged}/${SEEDS}  maxState ${maxS}  maxLLR ${maxL.toFixed(1)}`);
  console.log(rows[rows.length-1]);
}
console.log(`TOTAL false-alarm runs: ${fa}/${total} (${DUR}s each = ${(total*DUR/60).toFixed(0)} min of negative audio)`);
