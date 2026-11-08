const {MC,Synth}=require('./harness');
const FS=16000;
console.log('== Stereo bearing (phase difference, f0=480 Hz, mic spacing d=0.14 m) ==');
console.log('true°  est°(SNR 20 dB)  est°(SNR 0 dB)  coherence(20/0)');
for(const th of [-60,-30,-10,0,10,30,60]){
  const row=[th];const coh=[];
  for(const nd of [-20,0]){
    const errs=[];let c=0;
    for(let s=1;s<=10;s++){
      const [a,b]=Synth.stereoDelay(FS,1,480,th,.14,Synth.rng(s*13+th+99),-nd);
      const r=MC.phaseBearing(a,b,FS,480,.14);errs.push(r.theta);c+=r.coh;
    }
    errs.sort((x,y)=>x-y);row.push(errs[errs.length>>1].toFixed(1));coh.push((c/10).toFixed(2));
  }
  console.log(String(row[0]).padStart(4),'    ',row[1].padStart(8),'        ',row[2].padStart(8),'        ',coh.join(' / '));
}
{const r=Synth.rng(4),m=Synth.mosquito(FS,1,{f0:480},r),res=MC.phaseBearing(m,m,FS,480,.14);console.log('identical channels (mono duplicated): est',res.theta.toFixed(1),'deg, coherence',res.coh.toFixed(3),'-> UI must treat as "no stereo info"');}

console.log('\n== Optical speck tracker (160x120, 15 fps, 12 s trials) ==');
const W=160,H=120,FPS=15;
function frames(kind,seed){
  const r=Synth.rng(seed),N=FPS*12,out=[];let x=40+r()*80,y=30+r()*60,hd=r()*6.28,sp=0.3*W;
  for(let i=0;i<N;i++){
    const f=new Float32Array(W*H);const g=Synth.rng(seed*7+i);
    const lamp=kind==='flicker'?1+.08*Math.sin(i*.9):1,shx=kind==='shake'&&i%20>10?3:0;
    for(let p=0;p<W*H;p++)f[p]=(128+(p%W)*.1)*lamp+ (Synth.rng((seed+i)*131+p)()-.5)*7;
    if(kind==='mosq'||kind==='dust'||kind==='fly'){
      if(kind==='mosq'){if(i%3===0)hd+=(r()-.5)*2.6;sp=(.12+r()*.25)*W}
      if(kind==='dust'){sp=.035*W;}
      if(kind==='fly'){sp=.5*W;if(i%25===0)hd=r()*6.28}
      x+=Math.cos(hd)*sp/FPS;y+=Math.sin(hd)*sp/FPS;
      if(x<8||x>W-8){hd=Math.PI-hd;x=Math.max(8,Math.min(W-8,x))}if(y<8||y>H-8){hd=-hd;y=Math.max(8,Math.min(H-8,y))}
      const sz=kind==='mosq'?1.6:2;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){if(dx*dx+dy*dy<=sz*sz)f[(Math.round(y)+dy)*W+Math.round(x)+dx]-=70}
    }
    if(shx){const o=new Float32Array(f.length);for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++)o[yy*W+xx]=f[yy*W+Math.min(W-1,xx+shx)];out.push(o)}else out.push(f);
  }
  return out;
}
for(const kind of ['mosq','noise','dust','flicker','shake','fly']){
  let hit=0,N=5,meds=[];const st=[];
  for(let s=1;s<=N;s++){
    const T=new MC.OpticalTracker(W,H,{fps:FPS});let last,mx=-9;
    for(const f of frames(kind,s*17+kind.length)){last=T.update(f,1/FPS);if(T.llr>mx)mx=T.llr}
    const tt=T.tracks.filter(t=>t.speed!==undefined).sort((a,b)=>b.age-a.age)[0];if(tt)st.push('sp'+tt.speed.toFixed(2)+'/turn'+tt.turn.toFixed(1)+'/str'+tt.straight.toFixed(2)+'/cov'+tt.cover.toFixed(2));
    meds.push(mx);if(mx>=4)hit++;
  }
  console.log(kind.padEnd(8),'longest track:',st.slice(0,3).join(' ; '));console.log(kind.padEnd(8),'max optical LLR per trial:',meds.map(v=>v.toFixed(1)).join(' '),' | flagged(>=4):',hit+'/'+N);
}
