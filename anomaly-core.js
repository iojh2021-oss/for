/* هسته‌ی تشخیص ناهنجاری مغناطیسی و صوتی (بدون وابستگی به مرورگر، قابل تست) */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AnomalyCore=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const clamp=(x,a=0,b=1)=>x<a?a:x>b?b:x;
const median=a=>{if(!a.length)return NaN;const s=Array.from(a).sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const pct=(a,p)=>{const s=Array.from(a).sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.max(0,Math.round(p*(s.length-1))))]};
function norm(list){
  const s=list.reduce((a,c)=>a+c.s,0)||1;
  return list.map(c=>({t:c.t,p:Math.round(100*c.s/s)})).filter(c=>c.p>=5).sort((a,b)=>b.p-a.p).slice(0,4);
}
const hdiff=(a,b)=>{let d=Math.abs(a-b)%360;return d>180?360-d:d};

/* ---------- علت‌های محتمل (ابتکاری، نه قطعی) ---------- */
function magCauses(f){
  const big=f.peak>=150,mid=f.peak>=30&&f.peak<150,small=f.peak<30,still=!f.moving;
  return norm([
    {t:'حرکت یا چرخاندن خود گوشی',s:f.moving?.9:.04},
    {t:'آهنربا، قاب یا کیف آهنربایی، بلندگو یا هدفون نزدیک',s:still&&big?(f.returned?.7:.5):(still&&mid&&f.rise<.6?.2:.03)},
    {t:'جسم فلزی یا آهنی بزرگ نزدیک (خودرو، در فلزی، ابزار)',s:still&&(mid||big)?(f.rise>=.6?.55:.3):.05},
    {t:'موتور الکتریکی، ترانس یا کابل پرجریان نزدیک',s:f.osc>=1?.7:(f.osc>.4?.3:.05)},
    {t:'ورود به ساختمان، آسانسور یا سازه‌ی فلزی (تغییر تدریجی)',s:still&&!f.returned&&f.rise>=2?.45:.05},
    {t:'نوفه یا خطای کالیبراسیون سنسور',s:small?.35:.05}
  ]);
}
function headCauses(f){
  return norm([
    {t:'اختلال مغناطیسی نزدیک (فلز، آهنربا، دستگاه برقی)',s:f.moving?.1:.55},
    {t:'قطب‌نما کالیبره نیست (گوشی را به شکل ۸ بچرخان)',s:.25},
    {t:'جابه‌جایی جزئی گوشی',s:f.moving?.6:.1}
  ]);
}

/* ---------- آشکارساز مغناطیسی ---------- */
function MagDetector(o){
  this.thr=o.thr||10;this.cb=o.onEvent;this.rawOk=o.rawOk!==false;
  this.base=null;this.bv=null;this.sd=.5;this.ev=null;this.over=0;this.t0=null;this.last=0;
  this.motionBuf=[];this.heads=[];this.lastHeadEv=-99;this.headRef=null;
}
MagDetector.prototype.motion=function(t,gyro,acc){
  const b=this.motionBuf;b.push([t,gyro,acc]);while(b.length&&t-b[0][0]>40)b.shift();
};
MagDetector.prototype._motionStats=function(a,b){
  let n=0,g=0,gm=0,ac=0;
  for(const[t,gy,ax]of this.motionBuf)if(t>=a&&t<=b){n++;g+=gy;if(gy>gm)gm=gy;if(ax>ac)ac=ax}
  return n?{gyro:g/n,gmax:gm,acc:ac,n}:{gyro:0,gmax:0,acc:0,n:0};
};
MagDetector.prototype.heading=function(t,h){
  const H=this.heads;H.push([t,h]);while(H.length&&t-H[0][0]>40)H.shift();
  if(this.rawOk)return;
  // حالت جایگزین: فقط جهت قطب‌نما
  const win=H.filter(x=>t-x[0]<=2);if(win.length<5)return;
  let sp=0;for(const[,hh]of win)sp=Math.max(sp,hdiff(hh,h));
  const ms=this._motionStats(t-2,t);
  const thrDeg=Math.max(8,this.thr*1.2);
  if(sp>=thrDeg&&ms.n>=5&&ms.gyro<4&&t-this.lastHeadEv>6){
    this.lastHeadEv=t;
    const f={delta:sp,moving:ms.gmax>12};
    this.cb({kind:'heading',t:t-2,dur:2,delta:sp,to:h,gyro:ms.gyro,causes:headCauses(f)});
  }
};
MagDetector.prototype.mag=function(t,x,y,z){
  const m=Math.hypot(x,y,z);
  if(this.t0===null){this.t0=t;this.base=m;this.bv=[x,y,z];this.last=t;return}
  const dt=Math.min(1,Math.max(0,t-this.last));this.last=t;
  const calib=t-this.t0<4,d=m-this.base;
  if(!this.ev){
    const a=1-Math.exp(-dt/(calib?1:20));
    this.base+=(m-this.base)*a;this.bv[0]+=(x-this.bv[0])*a;this.bv[1]+=(y-this.bv[1])*a;this.bv[2]+=(z-this.bv[2])*a;
    if(Math.abs(d)<=Math.max(this.thr,5*this.sd))this.sd+=(Math.abs(d)-this.sd)*(1-Math.exp(-dt/10));
    if(!calib&&Math.abs(d)>Math.max(this.thr,5*this.sd)){
      const q=this.exc||(this.exc=[]);q.push(t);while(q.length&&t-q[0]>1)q.shift();
      this.over=q.length;
      if(this.over>=3){
        this.ev={t0:t-.1,tPeak:t,peak:d,peakM:m,peakV:[x,y,z],baseM:this.base,baseV:this.bv.slice(),s:[[t,m]],below:null,lastAbove:t};
        this.over=0;this.exc=[];
      }
    }else{if(this.exc){while(this.exc.length&&t-this.exc[0]>1)this.exc.shift()}this.over=this.exc?this.exc.length:0}
    return;
  }
  const e=this.ev;e.s.push([t,m]);if(e.s.length>3000)e.s.shift();
  const dd=m-e.baseM;
  if(Math.abs(dd)>Math.abs(e.peak)){e.peak=dd;e.tPeak=t;e.peakM=m;e.peakV=[x,y,z]}
  if(Math.abs(dd)<.5*Math.max(this.thr,5*this.sd)){
    if(e.below===null)e.below=t;
    if(t-e.below>=1)this._close(t,true);
  }else{e.below=null;e.lastAbove=t}
  if(this.ev&&t-e.t0>20)this._close(t,false);
};
MagDetector.prototype._close=function(t,returned){
  const e=this.ev;this.ev=null;
  const dur=Math.max(.1,e.lastAbove-e.t0),rise=Math.max(0,e.tPeak-e.t0);
  // نوسان: شمارش قله‌های پی‌درپی (فرکانس تقریبی تکرار)
  const vs=e.s.filter(p=>p[0]<=e.lastAbove),vals=vs.map(p=>p[1]),med=median(vals);
  const sm=vals.map((v,k)=>(v+(vals[k-1]===undefined?v:vals[k-1])+(vals[k+1]===undefined?v:vals[k+1]))/3);
  let mx=-1e9;for(const v of sm)if(v>mx)mx=v;
  let peaks=0,lastP=-9;
  for(let k=1;k<sm.length-1;k++){
    if(sm[k]>sm[k-1]&&sm[k]>=sm[k+1]&&sm[k]-med>.3*(mx-med)&&sm[k]-med>this.thr*.4&&vs[k][0]-lastP>=.12){peaks++;lastP=vs[k][0]}
  }
  const osc=peaks>1&&dur>0?(peaks-1)/dur:0;
  const ms=this._motionStats(e.t0-.5,e.lastAbove+.5);
  const moving=ms.gmax>12||ms.gyro>8||ms.acc>1.2;
  const a=e.baseV,b=e.peakV,na=Math.hypot(...a),nb=Math.hypot(...b);
  const angle=na&&nb?Math.acos(clamp((a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(na*nb),-1,1))*180/Math.PI:0;
  let hd=0;
  const hs=this.heads.filter(h=>h[0]>=e.t0-.5&&h[0]<=e.lastAbove+.5);
  if(hs.length>2){const h0=hs[0][1];for(const[,h]of hs)hd=Math.max(hd,hdiff(h,h0))}
  if(!returned){this.base=e.s[e.s.length-1][1];this.bv=e.peakV.slice()}
  const peak=Math.abs(e.peak);
  if(moving&&peak<40){this.ignoredMoving=(this.ignoredMoving||0)+1;return}
  const f={peak,dur,rise,returned,osc,moving,angle,headingDelta:hd};
  this.cb({kind:'mag',t:e.t0,dur,peak,signed:e.peak,peakM:e.peakM,baseM:e.baseM,rise,returned,osc,moving,angle,headingDelta:hd,
    baseV:e.baseV.map(v=>+v.toFixed(1)),peakV:e.peakV.map(v=>+v.toFixed(1)),gyro:ms.gyro,causes:magCauses(f)});
};

/* ---------- آشکارساز صدا ---------- */
function SoundDetector(o){
  this.sr=o.sampleRate;this.fft=o.fftSize;this.thr=o.thr||12;this.cb=o.onEvent;
  const bw=this.sr/this.fft,nb=96,fmin=20,fmax=Math.min(this.sr/2*.97,22000);
  this.nb=nb;this.edges=new Float32Array(nb+1);this.lo=[];this.hi=[];
  for(let i=0;i<=nb;i++)this.edges[i]=fmin*Math.pow(fmax/fmin,i/nb);
  for(let i=0;i<nb;i++){let a=Math.floor(this.edges[i]/bw),b=Math.ceil(this.edges[i+1]/bw)-1;if(b<a)b=a;this.lo.push(Math.max(1,a));this.hi.push(Math.max(1,b))}
  this.mu=new Float32Array(nb);this.vr=new Float32Array(nb).fill(4);this.v=new Float32Array(nb);this.EX=new Float32Array(nb);this.A=new Uint8Array(nb);
  this.n=0;this.t0=null;this.ev=null;this.pre=0;this.lastEv=-99;
  this.lb0=this.edges.findIndex(e=>e>=80);this.lb1=this.edges.findIndex(e=>e>=400);
}
SoundDetector.prototype.push=function(t,db){
  const nb=this.nb,V=this.v,mu=this.mu,vr=this.vr,EX=this.EX,A=this.A;
  if(this.t0===null)this.t0=t;
  for(let b=0;b<nb;b++){let m=-200;for(let i=this.lo[b];i<=this.hi[b];i++)if(db[i]>m)m=db[i];V[b]=m}
  if(t-this.t0<6){
    for(let b=0;b<nb;b++){if(this.n===0)mu[b]=V[b];else{mu[b]+=(V[b]-mu[b])*.2;vr[b]+=((V[b]-mu[b])**2-vr[b])*.1}}
    this.n++;return;
  }
  let act=0;
  for(let b=0;b<nb;b++){
    const sd=Math.max(2,Math.sqrt(vr[b])),ex=V[b]-mu[b];EX[b]=ex;
    A[b]=(ex>this.thr&&ex/sd>4.5)?1:0;act+=A[b];
  }
  for(let b=0;b<nb;b++)if(!A[b]&&!(this.ev&&EX[b]>this.thr*.5)){mu[b]+=(V[b]-mu[b])*.02;vr[b]+=((V[b]-mu[b])**2-vr[b])*.02}
  const broad=act>=Math.ceil(.3*nb);
  if(!this.ev){
    if(act>0){this.pre++;if(broad||this.pre>=2)this._open(t,broad,db)}else this.pre=0;
  }
  if(this.ev){
    const e=this.ev;
    if(e.t!==t)this._upd(t,act,db);
    if(e.gap>=4)this._close(t,false);
    else if(t-e.t0>30)this._close(t,true);
  }
};
SoundDetector.prototype._open=function(t,broad,db){
  this.ev={t0:t-(broad?0:.125),t:null,maxEx:new Float32Array(this.nb),cnt:new Uint16Array(this.nb),ticks:0,lowS:[],peakF:[],gap:0,lastAct:t,broad,actTicks:0,binF:new Float32Array(this.nb)};
  this._upd(t,1,db);
};
SoundDetector.prototype._upd=function(t,act,db){
  const e=this.ev,A=this.A,EX=this.EX,nb=this.nb;e.t=t;e.ticks++;
  let best=-1,bx=-1;const bw=this.sr/this.fft;
  if(act>0)e.actTicks++;
  for(let b=0;b<nb;b++)if(A[b]){
    e.cnt[b]++;
    if(EX[b]>e.maxEx[b]){e.maxEx[b]=EX[b];let bi=this.lo[b];for(let i=this.lo[b];i<=this.hi[b];i++)if(db[i]>db[bi])bi=i;e.binF[b]=bi*bw}
    if(EX[b]>bx){bx=EX[b];best=b}
  }
  let s=0,c=0;for(let b=this.lb0;b<this.lb1;b++){s+=this.v[b];c++}e.lowS.push(c?s/c:0);
  e.peakF.push(best>=0?(e.binF[best]||Math.sqrt(this.edges[best]*this.edges[best+1])):NaN);
  if(act>0){e.gap=0;e.lastAct=t}else e.gap++;
};
SoundDetector.prototype._close=function(t,forced){
  const e=this.ev;this.ev=null;this.pre=0;
  const nb=this.nb,sel=new Uint8Array(nb);let ns=0;
  for(let b=0;b<nb;b++)if(e.maxEx[b]>this.thr&&e.cnt[b]>=(e.broad?1:Math.min(2,e.actTicks))){sel[b]=1;ns++}
  if(forced){for(let b=0;b<nb;b++)if(sel[b])this.mu[b]=this.v[b]}
  if(!ns)return;
  const dur=Math.max(.125,e.lastAct-e.t0+.125),cl=[];
  for(let b=0;b<nb;b++){
    if(!sel[b])continue;let b1=b,w=0,bp=b;
    for(let k=b;k<nb&&k<=b1+2;k++)if(sel[k]){b1=k}
    for(let k=b;k<=b1;k++){w+=Math.max(0,e.maxEx[k]);if(e.maxEx[k]>e.maxEx[bp])bp=k}
    cl.push({b0:b,b1,w,bp});b=b1;
  }
  cl.sort((a,b)=>b.w-a.w);
  const clusters=cl.slice(0,3).map(c=>({fLow:+this.edges[c.b0].toFixed(0),fHigh:+this.edges[c.b1+1].toFixed(0),
    peakF:+(e.binF[c.bp]||Math.sqrt(this.edges[c.bp]*this.edges[c.bp+1])).toFixed(0),ex:+e.maxEx[c.bp].toFixed(1)}));
  const main=clusters[0],broadFrac=ns/nb,bwOct=Math.log2(main.fHigh/main.fLow);
  const pf=e.peakF.filter(x=>x===x);let sweepOct=0;
  if(pf.length>=6)sweepOct=Math.log2(pct(pf,.9)/pct(pf,.1));
  let mod=0;
  if(e.lowS.length>=16){
    const s=e.lowS,m=s.reduce((a,b)=>a+b,0)/s.length,x=s.map(v=>v-m);
    const r0=x.reduce((a,v)=>a+v*v,0);
    if(r0/s.length>4){for(let lag=2;lag<=Math.min(16,s.length-4);lag++){let r=0;for(let i=0;i+lag<x.length;i++)r+=x[i]*x[i+lag];mod=Math.max(mod,r/r0)}}
  }
  const imp=dur<.5&&broadFrac>=.3,ultra=main.fLow>=15000||main.peakF>=16000,lowF=main.peakF<120&&main.fHigh<400;
  const sweep=sweepOct>=.6&&dur>=1.5,tonal=bwOct<.7&&dur>=1&&clusters.length<=2&&!sweep;
  const gruntBand=main.fLow>=50&&main.fHigh<=700,grunt=gruntBand&&mod>.3&&dur>=1.5;
  const wide=broadFrac>=.3&&dur>=.5,pex=main.ex;
  const L=[];
  const lowG=lowF&&!grunt;
  L.push({t:'ضربه، کوبیدن یا بسته‌شدن ناگهانی در',s:imp?.45:.02});
  L.push({t:'صدای بلند ناگهانی (شکستن، انفجار یا شلیک)',s:imp&&pex>25?.3:.02});
  L.push({t:'لمس یا ضربه به خود گوشی و میکروفون',s:imp?.25:.02});
  L.push({t:'سنسور یا ماژول فراصوت، دافع حشرات',s:ultra?.4:.01});
  L.push({t:'شارژر، آداپتور یا منبع تغذیه‌ی سوئیچینگ',s:ultra&&tonal?.35:(ultra?.2:.01)});
  L.push({t:'سوت یا آلارم با هارمونیک بالا',s:ultra&&!tonal?.15:.01});
  L.push({t:'موتور، ژنراتور یا کمپرسور',s:lowG&&tonal?.5:(lowG?.2:.02)});
  L.push({t:'ترافیک سنگین، رعد یا لرزش سازه',s:lowG&&!tonal?.45:.02});
  L.push({t:'باد روی میکروفون',s:main.fHigh<300&&!tonal&&dur>.3?.2:.02});
  L.push({t:'دستگاه برقی (یخچال، ترانس، هواکش، اینورتر)',s:tonal&&!ultra&&main.peakF<1500?.55:.02});
  L.push({t:'آلارم، سوت یا بوق',s:tonal&&!ultra&&main.peakF>=1500?.45:.02});
  L.push({t:'آژیر یا صدای با فرکانس متغیر',s:sweep?.6:.02});
  L.push({t:'ناله یا غرغر انسان یا حیوان',s:grunt?.55:.02});
  L.push({t:'موتور یا دستگاه با نوسان دامنه',s:gruntBand&&mod>.3&&!grunt?.25:.02});
  L.push({t:'باد، باران، جمعیت یا خودرو (نویز پهن‌باند)',s:wide&&!imp?.5:.03});
  let cls='mixed';
  if(imp)cls='impulse';else if(sweep)cls='siren';else if(grunt)cls='grunt';else if(ultra)cls='ultra';else if(lowG)cls='low';else if(tonal)cls='tonal';else if(wide)cls='broad';
  this.cb({kind:'sound',t:e.t0,dur,peakF:main.peakF,fLow:main.fLow,fHigh:main.fHigh,bwOct,peakEx:pex,broadFrac,mod,sweepOct,clusters,cls,causes:norm(L)});
};
return{MagDetector,SoundDetector,magCauses,headCauses,hdiff};
});
