/* هسته‌ی پشه‌یاب: تشخیص غیرمستقیم پشه از ردهای فیزیکی (خط طیفی بال‌زدن، فاز استریو، ردیاب نوری ذره‌ی ریز)، ترکیب شواهد و تولید سیگنال آزمایشی (بدون وابستگی به مرورگر) */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MosquitoCore=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const sigmoid=x=>1/(1+Math.exp(-x));
const logit=p=>Math.log(p/(1-p));

/* ---------- FFT (بنیان ۲، درجا) ---------- */
function makeFFT(n){
  const lv=Math.round(Math.log2(n));if((1<<lv)!==n)throw new Error('n باید توانی از ۲ باشد');
  const cs=new Float64Array(n/2),sn=new Float64Array(n/2),rev=new Uint32Array(n);
  for(let i=0;i<n/2;i++){cs[i]=Math.cos(2*Math.PI*i/n);sn[i]=Math.sin(2*Math.PI*i/n)}
  for(let i=0;i<n;i++){let r=0;for(let b=0;b<lv;b++)r|=((i>>b)&1)<<(lv-1-b);rev[i]=r}
  return function(re,im){
    for(let i=0;i<n;i++){const j=rev[i];if(j>i){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
    for(let size=2;size<=n;size<<=1){
      const half=size>>1,step=n/size;
      for(let i=0;i<n;i+=size)for(let j=i,k=0;j<i+half;j++,k+=step){
        const l=j+half,tr=re[l]*cs[k]+im[l]*sn[k],ti=-re[l]*sn[k]+im[l]*cs[k];
        re[l]=re[j]-tr;im[l]=im[j]-ti;re[j]+=tr;im[j]+=ti;
      }
    }
  };
}

/* ---------- کاهش نرخ نمونه‌برداری (FIR سینک پنجره‌دار) ---------- */
const _firCache={};
function decimate(x,M){
  if(M<=1)return x;
  const taps=8*M+1,key=M;let h=_firCache[key];
  if(!h){h=new Float64Array(taps);const fc=.45/M;let s=0;
    for(let i=0;i<taps;i++){const m=i-(taps-1)/2,sinc=m===0?2*fc:Math.sin(2*Math.PI*fc*m)/(Math.PI*m);
      h[i]=sinc*(.5-.5*Math.cos(2*Math.PI*i/(taps-1)));s+=h[i]}
    for(let i=0;i<taps;i++)h[i]/=s;_firCache[key]=h}
  const out=new Float32Array(Math.floor(x.length/M)),half=(taps-1)/2;
  for(let o=0;o<out.length;o++){
    const c=o*M;let acc=0;
    for(let i=0;i<taps;i++){const idx=c+i-half;if(idx>=0&&idx<x.length)acc+=x[idx]*h[i]}
    out[o]=acc;
  }
  return out;
}

/* ---------- گونه‌ها: بازه‌های تقریبی بسامد بال‌زدن (راهنما، نه شناسایی) ---------- */
const WINGBEAT_HINTS=[
  {lo:300,hi:430,t:'معمولاً ماده‌ی کولکس و گونه‌های درشت‌تر'},
  {lo:430,hi:600,t:'معمولاً ماده‌ی آئدس / آنوفل (هم‌پوشان)'},
  {lo:600,hi:900,t:'معمولاً نر؛ نرها بال‌های سریع‌تر دارند'}
];
function hintFor(f){for(const h of WINGBEAT_HINTS)if(f>=h.lo&&f<h.hi)return h.t;return'خارج از بازه‌ی معمول بال‌زدن پشه'}

/* ---------- آشکارساز صوتی ---------- */
class AcousticDetector{
  constructor(o={}){
    const fs=this.fs=o.fs||16000,n=this.n=o.n||4096;
    this.hop=o.hop||n/2;this.dt=this.hop/fs;this.df=fs/n;
    this.win=new Float64Array(n);let sw=0;
    for(let i=0;i<n;i++){const w=.5-.5*Math.cos(2*Math.PI*i/n);this.win[i]=w;sw+=w*w}
    this.norm=1/sw;this.fft=makeFFT(n);this.re=new Float64Array(n);this.im=new Float64Array(n);
    this.P=new Float64Array(n/2+1);this.N0=new Float64Array(n/2+1);this.R=new Float64Array(n/2+1);
    this.kLo=Math.floor(150/this.df);this.kHi=Math.min(n/2-6,Math.ceil(3600/this.df));
    this.hw=Math.round(240/this.df);this.tmp=new Float64Array(2*this.hw+1);
    this.fMin=o.fMin||250;this.fMax=o.fMax||1000;
    this.W=Math.max(8,Math.round(6/this.dt));      // پنجره‌ی ۶ ثانیه‌ای شواهد
    this.P_=o.params||{};                           // پارامترهای مدل (برای آزمون و تنظیم)
    this.reset();
  }
  reset(){
    this.rec=[];this.run=0;this.t=0;this.prevF=null;this.f0hist=[];this.jumps=[];
    this.ctrl={on:false,N:0,gate:0,snr:[]};this.null=null;this.mask=null;
    this.best={llr:-1e9,t:0};
  }
  /* حالت زمانی را پاک می‌کند ولی نتیجه‌ی شاهد (و ماسک خطوط پس‌زمینه) را نگه می‌دارد */
  resetTrack(){const nl=this.null,mk=this.mask;this.reset();this.null=nl;this.mask=mk}
  prm(k,d){const v=this.P_[k];return v===undefined?d:v}
  /* طیف توان با پنجره‌ی هان؛ کف نوفه = میانه‌ی محلی (CFAR) */
  spectrum(x){
    const{n,win,re,im,P,norm}=this;
    for(let i=0;i<n;i++){re[i]=x[i]*win[i];im[i]=0}
    this.fft(re,im);
    for(let k=0;k<=n/2;k++)P[k]=(re[k]*re[k]+im[k]*im[k])*norm;
    const{kLo,kHi,hw,tmp,N0}=this;const LN2=Math.LN2;
    for(let k=kLo-3;k<=kHi+3;k++){
      const a=Math.max(1,k-hw),b=Math.min(this.n/2-1,k+hw),m=b-a+1;
      for(let i=0;i<m;i++)tmp[i]=P[a+i];
      const s=tmp.subarray(0,m);s.sort();
      N0[k]=Math.max(1e-30,s[m>>1]/LN2);         // میانگین نوفه‌ی نمایی = میانه / ln۲
    }
    // نسبت سیگنال به نوفه روی لوب اصلی ۵ بینی
    const R=this.R;
    for(let k=kLo;k<=kHi;k++){
      let sp=0,sn=0;for(let j=-2;j<=2;j++){sp+=P[k+j];sn+=N0[k+j]}
      R[k]=sp/sn;
    }
  }
  rdb(f,tol){
    const c=Math.round(f/this.df);let m=0;
    const mk=this.mask;
    for(let k=Math.max(this.kLo,c-tol);k<=Math.min(this.kHi,c+tol);k++)if((!mk||!mk[k])&&this.R[k]>m)m=this.R[k];
    return 10*Math.log10(m+1e-9);
  }
  /* یک فریم n‌نمونه‌ای را تحلیل می‌کند */
  push(x){
    this.spectrum(x);
    const{R,P,df,fMin,fMax}=this;this.t+=this.dt;
    const kA=Math.ceil(fMin/df),kB=Math.floor(fMax/df);
    let kb=-1,rb=0;
    const mk=this.mask;
    for(let k=kA;k<=kB;k++)if((!mk||!mk[k])&&R[k]>R[k-1]&&R[k]>=R[k+1]&&R[k]>rb){rb=R[k];kb=k}
    if(kb<0){kb=kA;rb=R[kA]}
    // بسامد به‌صورت مرکز ثقل لوب اصلی
    let sp=0,sf=0;for(let j=-2;j<=2;j++){sp+=P[kb+j];sf+=(kb+j)*P[kb+j]}
    const f0=sf/sp*df,snr=10*Math.log10(rb);
    const h2=this.rdb(2*f0,3),h3=this.rdb(3*f0,4),sub=this.rdb(f0/2,3),sub3=this.rdb(f0/3,3);
    // هارمونیک «هم‌توان» با پایه (در ۱۰ دسی‌بل پایه): نشانه‌ی صدای انسان/ساز؛ در پشه هارمونیک‌ها بسیار ضعیف‌تر از پایه‌اند
    let rich=0;const relT=Math.max(6,snr-10);for(let h=2;h<=6;h++)if(h*f0<=3500&&this.rdb(h*f0,h+1)>=relT)rich++;
    // قله‌های دیگر (غیرهارمونیک) در ۲۰۰–۱۵۰۰ هرتز
    let oth=0;const ex=[f0/2,f0/3,f0,2*f0,3*f0,4*f0,5*f0,6*f0],othT=Math.max(6.5,snr-12);
    for(let k=Math.ceil(200/df);k<=Math.min(this.kHi,Math.floor(1500/df));k++){
      if((!mk||!mk[k])&&R[k]>R[k-1]&&R[k]>=R[k+1]&&10*Math.log10(R[k])>=othT){
        let near=false;for(const e of ex)if(Math.abs(k*df-e)<5*df){near=true;break}
        if(!near)oth++;
      }
    }
    // پیوستگی با فریم قبل
    const prev=this.rec.length?this.rec[this.rec.length-1]:null;
    const cont=!!(prev&&prev.snr>=this.prm('contSnr',7)&&Math.abs(f0-prev.f0)<=this.prm('contHz',20));
    const tonal=snr>=this.prm('gateSnr',8);
    // لغزش بسامدی: اگر در ۲ ثانیه‌ی اخیر بسامد فریم‌به‌فریم زیاد بپرد، منبع گفتار/آژیر است
    if(prev&&prev.snr>=this.prm('contSnr',7)&&tonal)this.jumps.push(Math.abs(f0-prev.f0)>this.prm('contHz',20)?1:0);
    else if(!tonal)this.jumps.length=0;
    if(this.jumps.length>Math.round(2/this.dt))this.jumps.shift();
    const jn=this.jumps.length,jf=jn?this.jumps.reduce((a,b)=>a+b,0)/jn:0;
    this.run=(tonal&&cont)?this.run+1:(tonal?1:0);
    // پایداری بسامد: انحراف معیار روی ۲ ثانیه‌ی اخیر
    if(tonal&&(cont||this.f0hist.length===0)){this.f0hist.push(f0);if(this.f0hist.length>Math.round(2/this.dt))this.f0hist.shift()}
    else if(!tonal){this.f0hist.length=0}
    let sd=null;
    if(this.f0hist.length>=Math.round(1.5/this.dt)){
      let m=0;for(const v of this.f0hist)m+=v;m/=this.f0hist.length;
      let v=0;for(const q of this.f0hist)v+=(q-m)*(q-m);sd=Math.sqrt(v/this.f0hist.length);
    }
    // ----- لگاریتم نسبت درست‌نمایی در هر فریم (نایو بیز) -----
    let l=clamp(this.prm('aTone',.30)*(snr-this.prm('s0',9)),-1.2,2.5);
    l+=cont?(snr>8?.6:0):-.4;
    if(h2>=5)l+=.4;if(h3>=5)l+=.3;
    if(f0<330||f0>900)l-=.5;
    // قواعد ردّ (veto): ویژگی‌هایی که با فیزیک بال‌زدن‌ی تک‌منبعی پشه سازگار نیستند
    const why=[];let veto=false;
    if(sub>=5||sub3>=5){veto=true;why.push('زیرهارمونیک: منبع کم‌بسامدتر (صدا / همهمه)')}
    if(rich>=3){veto=true;why.push('هارمونیک‌های متعدد: صدای انسان یا ساز')}
    if(oth>=2){veto=true;why.push('چند تُن ناهم‌ریشه هم‌زمان (آکورد / محیط پُرتُن)')}
    let pure=false,unstable=false;
    if(sd!==null){
      if(sd<this.prm('sdMin',.4)){veto=true;pure=true;why.push('تُن بی‌نوسان: الکترونیکی (پشه ±چند هرتز می‌لرزد)')}
      else if(sd>this.prm('sdMax',30)){veto=true;unstable=true;why.push('بسامد ناپایدار')}
    }
    if(jn>=8&&jf>=.4){veto=true;unstable=true;why.push('بسامد فریم‌به‌فریم می‌پرد (گفتار / آژیر)')}
    if(veto)l=Math.min(l,-1);
    l=Math.min(l,3);
    const rec={t:this.t,f0,snr,h2,h3,sub,rich,oth,cont,tonal,l,sd,pure,why,A:10*Math.log10(P[kb]+1e-20)};
    this.rec.push(rec);if(this.rec.length>this.W*3)this.rec.shift();
    // پنجره‌ی شواهد: ۰٫۵ ضریب هم‌پوشانی ۵۰٪ فریم‌ها
    let sum=0;const from=Math.max(0,this.rec.length-this.W);
    for(let i=from;i<this.rec.length;i++)sum+=this.rec[i].l;
    const llr=.5*sum;
    // وضعیت
    const need2=Math.round(2/this.dt),need4=Math.round(4/this.dt);
    let state='none';
    if(llr>=this.prm('tSus',6))state='suspect';
    if(llr>=this.prm('tLik',18)&&this.run>=need2)state='likely';
    if(llr>=this.prm('tCon',34)&&this.run>=need4&&!pure)state='confirmed';
    // ثبت آمار شاهد
    const C=this.ctrl;if(C.on){C.N++;if(tonal&&cont)C.gate++;C.snr.push(snr);if(!C.acc)C.acc=new Float64Array(this.n/2+1);for(let k=this.kLo;k<=this.kHi;k++)C.acc[k]+=R[k]}
    if(llr>this.best.llr)this.best={llr,t:this.t};
    const post=sigmoid(logit(this.prm('prior',.05))+.25*llr);
    return{t:this.t,rec,llr,state,post,run:this.run,sd,pure,hint:hintFor(f0),
      track:{dur:this.run*this.dt,f0m:this.f0hist.length?this.f0hist.reduce((a,b)=>a+b,0)/this.f0hist.length:f0}};
  }
  /* ---------- نمونه‌ی شاهد: توزیع تهی ---------- */
  controlBegin(){this.ctrl={on:true,N:0,gate:0,snr:[]}}
  controlEnd(){
    const C=this.ctrl;C.on=false;if(C.N<30){this.null=null;this.mask=null;return null}
    const s=C.snr.slice().sort((a,b)=>a-b);
    // خطوط پایدار پس‌زمینه: میانگین نسبت سیگنال به نوفه در چند ده ثانیه‌ی بدون پشه بالاتر از ۴٫۸ دسی‌بل
    const mask=new Uint8Array(this.n/2+1),lines=[];let k=this.kLo;
    while(k<=this.kHi){
      if(C.acc[k]/C.N>=3){let a=k,pk=k;while(k<=this.kHi&&C.acc[k]/C.N>=3){if(C.acc[k]>C.acc[pk])pk=k;k++}
        for(let j=Math.max(this.kLo,a-3);j<=Math.min(this.kHi,k+3);j++)mask[j]=1;lines.push(Math.round(pk*this.df))}
      else k++;
    }
    this.mask=lines.length?mask:null;
    this.null={N:C.N,pc:Math.max(C.gate,1)/(C.N+1),gate:C.gate,median:s[s.length>>1],p95:s[Math.floor(s.length*.95)],max:s[s.length-1],lines};
    C.acc=null;return this.null;
  }
  /* آزمون دنباله: احتمال K فریم پیوسته‌ی گذرنده از دروازه، اگر فقط نوفه‌ی شاهد بود */
  runP(K,pc){
    pc=pc||(this.null&&this.null.pc)||.05;const Keff=Math.max(1,K/2);   // فریم‌های هم‌پوشان نیمه‌مستقل
    return Math.max(1e-12,Math.pow(pc,Keff));
  }
}

/* ---------- جهت‌یابی با اختلاف فاز دو میکروفون (استریو) ---------- */
function phaseBearing(a,b,fs,f0,d,c){
  c=c||343;const n=Math.min(a.length,b.length),B=8,m=Math.floor(n/B);
  if(m<64)return null;
  let cr=0,ci=0,pa=0,pb=0,sa=0,sb=0;
  for(let blk=0;blk<B;blk++){
    let ar=0,ai=0,br=0,bi=0;const o=blk*m;
    for(let i=0;i<m;i++){
      const w=.5-.5*Math.cos(2*Math.PI*i/m),ph=2*Math.PI*f0*(o+i)/fs,co=Math.cos(ph),si=-Math.sin(ph);
      ar+=a[o+i]*w*co;ai+=a[o+i]*w*si;br+=b[o+i]*w*co;bi+=b[o+i]*w*si;
    }
    cr+=ar*br+ai*bi;ci+=ai*br-ar*bi;               // X_a · conj(X_b)
    pa+=ar*ar+ai*ai;pb+=br*br+bi*bi;sa+=Math.sqrt((ar*ar+ai*ai)*(br*br+bi*bi));
  }
  const coh=Math.hypot(cr,ci)/(sa+1e-30);
  const dphi=Math.atan2(ci,cr);                      // فاز a نسبت به b
  const tau=dphi/(2*Math.PI*f0);                     // تأخیر a نسبت به b (ثانیه)
  const s=clamp(c*tau/d,-1,1);
  return{theta:Math.asin(s)*180/Math.PI,tau,coh,levelDiff:10*Math.log10((pa+1e-30)/(pb+1e-30)),ambiguous:true};
}

/* ---------- ردیاب نوری ذره‌ی ریز ---------- */
class OpticalTracker{
  constructor(w,h,o={}){
    this.w=w;this.h=h;this.bg=null;this.noise=3;this.tracks=[];this.nextId=1;this.t=0;
    this.mask=new Uint8Array(w*h);this.seen=new Uint8Array(w*h);this.stack=new Int32Array(w*h);
    this.maxArea=o.maxArea||Math.max(24,Math.round(w*h*.002));this.fps=o.fps||15;
    this.lbuf=[];this.W=Math.round(6*this.fps);this.shake=false;this.score=0;this.llr=0;
  }
  reset(){this.bg=null;this.tracks=[];this.lbuf=[];this.llr=0;this.t=0}
  update(L,dt){
    const{w,h}=this,n=w*h;this.t+=dt;
    if(!this.bg){this.bg=Float32Array.from(L);return this.out(0)}
    const thr=Math.max(9,4.5*this.noise);let act=0,qs=0,qn=0;const m=this.mask,bg=this.bg;
    for(let i=0;i<n;i++){const d=Math.abs(L[i]-bg[i]);if(d>thr){m[i]=1;act++}else{m[i]=0;qs+=d;qn++}}
    if(qn)this.noise+=(qs/qn*1.25-this.noise)*.05;
    this.shake=act/n>.2;const a=this.shake?.5:1-Math.exp(-dt/2);
    for(let i=0;i<n;i++)bg[i]+=(L[i]-bg[i])*a;
    if(this.shake){this.tracks=[];return this.out(-.02)}
    // ذرات ریز: مؤلفه‌های متصل با مساحت ۲ تا حداکثر
    const blobs=[],seen=this.seen,st=this.stack;seen.fill(0);
    for(let s0=0;s0<n;s0++){
      if(!m[s0]||seen[s0])continue;
      let sp=0,area=0,sx=0,sy=0;st[sp++]=s0;seen[s0]=1;
      while(sp){const p=st[--sp],x=p%w,y=(p/w)|0;area++;sx+=x;sy+=y;
        if(area>this.maxArea){sp=0;area=1e9;break}
        if(x>0&&m[p-1]&&!seen[p-1]){seen[p-1]=1;st[sp++]=p-1}
        if(x<w-1&&m[p+1]&&!seen[p+1]){seen[p+1]=1;st[sp++]=p+1}
        if(y>0&&m[p-w]&&!seen[p-w]){seen[p-w]=1;st[sp++]=p-w}
        if(y<h-1&&m[p+w]&&!seen[p+w]){seen[p+w]=1;st[sp++]=p+w}}
      if(area>=2&&area<=this.maxArea)blobs.push({cx:sx/area,cy:sy/area,area});
    }
    // پیوند نزدیک‌ترین همسایه
    const gate=.1*w,T=this.tracks,used=new Set(),pairs=[];
    for(let i=0;i<T.length;i++)for(let j=0;j<blobs.length;j++){
      const d=Math.hypot(T[i].cx-blobs[j].cx,T[i].cy-blobs[j].cy);if(d<gate)pairs.push([d,i,j]);
    }
    pairs.sort((p,q)=>p[0]-q[0]);const ut=new Set();
    for(const[,i,j]of pairs){
      if(ut.has(i)||used.has(j))continue;ut.add(i);used.add(j);
      const t=T[i],b=blobs[j];t.cx=b.cx;t.cy=b.cy;t.hits++;t.miss=0;t.age+=dt;t.path.push([b.cx,b.cy,this.t]);if(t.path.length>90)t.path.shift();
    }
    for(let i=T.length-1;i>=0;i--)if(!ut.has(i)){T[i].miss++;T[i].age+=dt;if(T[i].miss>4)T.splice(i,1)}
    for(let j=0;j<blobs.length;j++)if(!used.has(j))T.push({id:this.nextId++,cx:blobs[j].cx,cy:blobs[j].cy,hits:1,miss:0,age:0,path:[[blobs[j].cx,blobs[j].cy,this.t]]});
    // آمار مسیر: سرعت، نرخ چرخش، مستقیم‌بودن
    let best=0;
    for(const t of T){
      const P=t.path;if(P.length<8||t.age<1)continue;
      let len=0,turns=[],sp=[];let pv=null;
      for(let i=1;i<P.length;i++){
        const dx=P[i][0]-P[i-1][0],dy=P[i][1]-P[i-1][1],dtt=Math.max(1e-3,P[i][2]-P[i-1][2]),s=Math.hypot(dx,dy);
        len+=s;sp.push(s/dtt/w);
        if(s>.3){const ang=Math.atan2(dy,dx);if(pv!==null){let da=Math.abs(ang-pv);if(da>Math.PI)da=2*Math.PI-da;turns.push(da/dtt)}pv=ang}
      }
      if(!turns.length||len<1)continue;
      sp.sort((a,b)=>a-b);turns.sort((a,b)=>a-b);
      const speed=sp[sp.length>>1],turn=turns[turns.length>>1],net=Math.hypot(P[P.length-1][0]-P[0][0],P[P.length-1][1]-P[0][1]),straight=net/len;
      const cover=t.hits/Math.max(1,Math.round(t.age*this.fps));
      t.speed=speed;t.turn=turn;t.straight=straight;t.cover=cover;
      // سرعت کم‌تر از ۰٫۰۸ عرض تصویر در ثانیه: چرخش اندازه‌گیری‌شده فقط لرزش پیکسلی است (غبار)؛ چرخش‌های تند و مسیر پیچ‌درپیچ: پرواز آشفته
      t.erratic=speed>=.08&&speed<=1.2&&turn>=2.5&&straight<.5&&cover>.6;
      if(t.erratic)best=Math.max(best,Math.min(1,t.age/3));
    }
    return this.out(best>0?.12*best*(this.fps/15):-.02);
  }
  out(l){
    this.lbuf.push(l);if(this.lbuf.length>this.W)this.lbuf.shift();
    let s=0;for(const v of this.lbuf)s+=v;this.llr=Math.max(-5,.5*s);
    return{tracks:this.tracks.filter(t=>t.erratic),all:this.tracks,llr:this.llr,shake:this.shake,noise:this.noise};
  }
}

/* ---------- ترکیب شواهد ---------- */
const STATE_FA={none:'بدون شواهد',suspect:'مشکوک',likely:'احتمال بالا',confirmed:'تأییدشده',multi:'تأیید چندکاناله'};
function fuse(ac,optLlr,stereo,prior){
  prior=prior||.05;
  const wOpt=.5;let L=ac.llr+wOpt*Math.max(0,optLlr||0);
  let state=ac.state;
  if(ac.state==='confirmed'&&(optLlr||0)>=4)state='multi';
  return{state,llr:L,post:sigmoid(logit(prior)+.25*L)};
}

/* ---------- تولید سیگنال آزمایشی ---------- */
function rng(seed){let a=seed|0;return function(){a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function gauss(r){let u=0;while(u===0)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r())}
const Synth={
  rng,
  white(fs,dur,r){const x=new Float32Array(Math.round(fs*dur));for(let i=0;i<x.length;i++)x[i]=gauss(r);return x},
  pink(fs,dur,r){const x=new Float32Array(Math.round(fs*dur));let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for(let i=0;i<x.length;i++){const w=gauss(r);b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;
      x[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.2;b6=w*.115926}return x},
  brown(fs,dur,r){const x=new Float32Array(Math.round(fs*dur));let a=0;for(let i=0;i<x.length;i++){a=(a+.02*gauss(r))/1.0005;x[i]=a*3}return x},
  /* پشه: بسامد پایه با نوسان کند، هارمونیک‌های ضعیف‌تر، دامنه‌ی متغیر (جهت‌گیری و فاصله) */
  mosquito(fs,dur,o,r){
    o=o||{};const n=Math.round(fs*dur),f0=o.f0||480,jit=o.jitter===undefined?4:o.jitter,amps=o.harm||[1,.35,.15,.06];
    const x=new Float32Array(n);let ph=0,dev=0,am=0;const a1=Math.exp(-1/(fs*.5)),a2=Math.exp(-1/(fs*.8));
    for(let i=0;i<n;i++){
      dev=a1*dev+(1-a1)*gauss(r)*jit*Math.sqrt(2/(1-a1)*.5);am=a2*am+(1-a2)*gauss(r)*Math.sqrt(2/(1-a2)*.5);
      let f=f0+dev;
      if(o.glide)f+=o.glide*(i/n-.5);
      ph+=2*Math.PI*f/fs;let v=0;for(let h=0;h<amps.length;h++)v+=amps[h]*Math.sin((h+1)*ph+h*.7);
      const g=o.steadyAmp?1:Math.max(.15,1+.5*am);x[i]=v*g;
    }
    return x;
  },
  /* گفتار: سری هارمونیک با شکل‌دهی سازه‌ها، پوش هجایی و سکوت */
  speech(fs,dur,o,r){
    o=o||{};const n=Math.round(fs*dur),f0m=o.f0||120,H=Math.floor(Math.min(fs/2-200,4000)/f0m),x=new Float32Array(n);
    const forms=[[500,120],[1500,200],[2500,250]];let ph=new Float64Array(H+1),wt=new Float64Array(H+1),f0=f0m,cur=forms.map(f=>f[0]),tgt=cur.slice();
    const a=Math.exp(-1/(fs*.2));let env=0,envT=0,tn=0;
    for(let i=0;i<n;i++){
      if(i%Math.round(fs*.25)===0){envT=r()<.2?0:.4+r()*.6;tgt=[400+r()*500,1000+r()*1200,2200+r()*800]}
      env+=(envT-env)*(1/(fs*.04));
      f0+=(f0m*(1+.12*Math.sin(2*Math.PI*.7*i/fs+r()*.01)+.06*Math.sin(2*Math.PI*4.5*i/fs))-f0)*.001;
      for(let k=0;k<3;k++)cur[k]=a*cur[k]+(1-a)*tgt[k];
      if(i%32===0){for(let h=1;h<=H;h++){const fh=h*f0;wt[h]=(Math.exp(-Math.pow((fh-cur[0])/forms[0][1],2))+.7*Math.exp(-Math.pow((fh-cur[1])/forms[1][1],2))+.4*Math.exp(-Math.pow((fh-cur[2])/forms[2][1],2)))/Math.pow(h,.6)}}
      let v=0;
      for(let h=1;h<=H;h++){ph[h]+=2*Math.PI*h*f0/fs;v+=Math.sin(ph[h])*wt[h]}
      x[i]=v*env;
    }
    return x;
  },
  hum(fs,dur,o,r){o=o||{};const n=Math.round(fs*dur),fm=o.f||50,x=new Float32Array(n);
    for(let k=1;k*fm<fs/2-100&&k<60;k++){const a=1/Math.pow(k,.6),p=r()*6.28;for(let i=0;i<n;i++)x[i]+=a*Math.sin(2*Math.PI*k*fm*i/fs+p)}return x},
  tone(fs,dur,f,r){const n=Math.round(fs*dur),x=new Float32Array(n),p=r()*6.28;for(let i=0;i<n;i++)x[i]=Math.sin(2*Math.PI*f*i/fs+p);return x},
  chord(fs,dur,fl,r){const n=Math.round(fs*dur),x=new Float32Array(n);for(const f of fl){const p=r()*6.28;for(let i=0;i<n;i++)x[i]+=Math.sin(2*Math.PI*f*i/fs+p)/fl.length}return x},
  fan(fs,dur,r){const w=Synth.pink(fs,dur,r),b=Synth.hum(fs,dur,{f:118},r);for(let i=0;i<w.length;i++)w[i]=w[i]*1.2+b[i]*.35;return w},
  /* توان در باند (برای تنظیم SNR) از روی طیف یک پنجره‌ی بلند */
  bandPower(x,fs,f1,f2){
    const n=1<<Math.floor(Math.log2(Math.min(x.length,1<<18))),fft=makeFFT(n),re=new Float64Array(n),im=new Float64Array(n);
    for(let i=0;i<n;i++){const w=.5-.5*Math.cos(2*Math.PI*i/n);re[i]=x[i]*w;im[i]=0}
    fft(re,im);let s=0;const k1=Math.floor(f1*n/fs),k2=Math.ceil(f2*n/fs);
    for(let k=k1;k<=k2;k++)s+=re[k]*re[k]+im[k]*im[k];
    return s/(n*n*.375);
  },
  /* سیگنال را با نوفه‌ی داده‌شده ترکیب می‌کند تا SNR درون‌باند (۲۵۰–۲۰۰۰ هرتز) برابر snrDb شود */
  mix(sig,noise,fs,snrDb){
    const ps=Synth.bandPower(sig,fs,250,2000),pn=Synth.bandPower(noise,fs,250,2000);
    const g=Math.sqrt(ps/(pn*Math.pow(10,snrDb/10))),out=new Float32Array(sig.length);
    for(let i=0;i<out.length;i++)out[i]=sig[i]+g*noise[i];
    return out;
  },
  /* دو کانال با تأخیر زمانی (موج تخت از زاویه‌ی theta) برای آزمون جهت‌یابی */
  stereoDelay(fs,dur,f0,thetaDeg,d,r,noiseDb){
    const n=Math.round(fs*dur),a=new Float32Array(n),b=new Float32Array(n),tau=d*Math.sin(thetaDeg*Math.PI/180)/343,ng=Math.pow(10,(noiseDb||-40)/20);
    for(let i=0;i<n;i++){const t=i/fs;a[i]=Math.sin(2*Math.PI*f0*(t+tau/2))+ng*gauss(r);b[i]=Math.sin(2*Math.PI*f0*(t-tau/2))+ng*gauss(r)}
    return[a,b];
  }
};

return{makeFFT,decimate,AcousticDetector,phaseBearing,OpticalTracker,fuse,STATE_FA,WINGBEAT_HINTS,hintFor,Synth,sigmoid,logit};
});
