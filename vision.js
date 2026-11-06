/* بینایی شب و حرارت‌نما (رنگ‌نگاری شدت نور): دوربین جلو/عقب، پالت‌ها، تقویت کم‌نور، ردیابی حرکت و سایه */
(()=>{
'use strict';
const VC=window.VisionCore;if(!VC)return;
const {PALETTES,CLS_FA}=VC;
const $=(s,r=document)=>r.querySelector(s);
const fa=(n,d=0)=>(+n).toFixed(d).replace(/\d/g,x=>'۰۱۲۳۴۵۶۷۸۹'[x]).replace('.','٫');
const clamp=(x,a,b)=>x<a?a:x>b?b:x;

/* ---------- تنظیمات ---------- */
const DEF={pal:'purple',res:320,autoGain:true,brightness:0,contrast:1,gamma:1.4,clahe:.4,sharp:.3,stack:.4,invert:false,zoom:1,
  trackMode:'both',sens:5,minArea:.3,shadowThr:22,onlyMoving:true,trail:30,tau:3,boxes:true,trails:true,labels:true,alert:false,grid:false,cross:false,hist:false};
const PRESETS=[
  {n:'شب عمیق',v:{pal:'green',autoGain:true,gamma:1.9,clahe:.55,sharp:.4,stack:.75,contrast:1.1,brightness:5,trackMode:'both'}},
  {n:'حرارتی بنفش',v:{pal:'purple',autoGain:true,gamma:1.3,clahe:.3,sharp:.3,stack:.4,contrast:1.2,brightness:0,trackMode:'motion'}},
  {n:'ردیابی سایه',v:{pal:'white',autoGain:true,gamma:1.6,clahe:.8,sharp:.5,stack:.3,contrast:1.2,trackMode:'shadow',onlyMoving:true,trails:true}},
  {n:'روز',v:{pal:'color',autoGain:false,gamma:1,clahe:0,sharp:0,stack:0,contrast:1,brightness:0,trackMode:'off'}}
];
let P=Object.assign({},DEF);
try{Object.assign(P,JSON.parse(localStorage.getItem('didehban-vision')||'{}'))}catch{}
const save=()=>{try{localStorage.setItem('didehban-vision',JSON.stringify(P))}catch{}};
const SL=[
  ['img','brightness','روشنایی',-100,100,1],['img','contrast','کنتراست',.5,3,.05],['img','gamma','بالا بردن سایه‌ها (گاما)',.5,3,.05],
  ['img','clahe','تقویت محلی کنتراست',0,1,.05],['img','sharp','تیزی',0,2,.1],['img','stack','پشته‌سازی فریم (کم‌نور)',0,.92,.02],['img','zoom','زوم دیجیتال',1,4,.1],
  ['trk','sens','حساسیت حرکت',1,10,1],['trk','minArea','کمینه‌ی اندازه‌ی جسم (٪ تصویر)',.05,2,.05],['trk','shadowThr','حساسیت سایه (آستانه‌ی تیرگی)',8,60,1],
  ['trk','trail','طول رد حرکت',0,60,1],['trk','tau','فراموشی پس‌زمینه (ثانیه)',.5,10,.5]
];
const TG=[['img','autoGain','تنظیم خودکار روشنایی'],['img','invert','معکوس'],['trk','onlyMoving','فقط سایه‌های متحرک'],['trk','boxes','کادر'],['trk','trails','رد حرکت'],
  ['trk','labels','برچسب'],['trk','alert','هشدار لرزشی برای هدف متحرک'],['view','grid','شبکه‌ی سه‌گانه'],['view','cross','هدف‌گیر مرکزی'],['view','hist','نمودار روشنایی']];

/* ---------- ظاهر ---------- */
const css=document.createElement('style');
css.textContent=`
#bVision{width:100%;min-height:60px;border:1px solid var(--rust);border-radius:12px;background:var(--panel);font-size:17px;font-weight:800}
#viApp{position:fixed;inset:0;z-index:30;background:var(--ink);color:var(--bone);overflow:auto;padding:10px 12px calc(24px + env(safe-area-inset-bottom));display:none}
#viApp.on{display:block}
#viApp .in{max-width:520px;margin:0 auto;display:grid;gap:10px}
#viApp h2{margin:0;font-size:22px}#viApp .hd{display:flex;justify-content:space-between;align-items:center}
#viApp button,#viApp select{font:inherit;color:inherit;min-height:46px;border-radius:10px;border:1px solid var(--rust);background:var(--panel);padding:0 12px}
#viApp button[aria-pressed=true]{background:var(--rust);border-color:var(--amber);font-weight:800}
.viStage{position:relative;background:#000;border-radius:10px;overflow:hidden;border:1px solid var(--rust)}
.viStage canvas{display:block;width:100%;height:auto}
#viOv{position:absolute;inset:0;pointer-events:none}
#viStat{position:absolute;right:6px;top:6px;font-size:12px;background:rgba(0,0,0,.55);padding:2px 8px;border-radius:6px;color:var(--bone)}
.viChips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.viChips button{flex:0 0 auto;min-width:92px;display:grid;gap:4px;padding:6px 10px;text-align:center;font-size:13px}
.viChips i{display:block;height:8px;border-radius:4px}
.viRow{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.viPre{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.viPre button{font-size:13px;padding:0 4px}
#viApp details{background:var(--panel);border-radius:10px;padding:2px 12px}
#viApp summary{min-height:44px;display:flex;align-items:center;font-weight:800;cursor:pointer}
.viS{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;margin:6px 0;font-size:13.5px}
.viS input[type=range]{grid-column:1/-1;width:100%;accent-color:var(--signal)}.viS b{color:var(--bone)}
.viT{display:flex;gap:10px;align-items:center;min-height:40px;font-size:14px}.viT input{width:22px;height:22px;accent-color:var(--signal)}
.viSel{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;margin:6px 0;font-size:13.5px}
#viNote{margin:0;font-size:12.5px;color:var(--dim)}
#viToast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);background:var(--bone);color:var(--ink);padding:10px 16px;border-radius:10px;font-weight:700;opacity:0;pointer-events:none;transition:opacity .2s;z-index:50;max-width:90vw}
#viToast.on{opacity:1}
`;
document.head.appendChild(css);

const app=document.createElement('div');app.id='viApp';
app.innerHTML=`<div class="in">
 <div class="hd"><h2>بینایی شب و حرارت‌نما</h2><button id="viClose">بستن</button></div>
 <div class="viStage" id="viStage"><canvas id="viMain"></canvas><canvas id="viOv"></canvas><span id="viStat">…</span></div>
 <div class="viChips" id="viChips" role="group" aria-label="پالت رنگی"></div>
 <div class="viRow"><button id="viFlip">جلو / عقب</button><button id="viTorch" aria-pressed="false">چراغ</button><button id="viFreeze" aria-pressed="false">ثابت</button><button id="viSnap">عکس</button></div>
 <div class="viPre" id="viPre"></div>
 <details open><summary>تصویر و تقویت شب</summary><div id="gImg"></div></details>
 <details><summary>ردیابی حرکت و سایه</summary><div id="gTrk"></div></details>
 <details><summary>نمایش</summary><div id="gView"></div></details>
 <details><summary>تنظیمات سخت‌افزار دوربین</summary><div id="viHW"></div></details>
 <div class="viRow" style="grid-template-columns:1fr 1fr"><button id="viFull">تمام‌صفحه</button><button id="viReset">بازنشانی تنظیمات</button></div>
 <p id="viNote">«حرارت‌نما» فقط رنگ‌نگاری شدت نور است، نه دمای واقعی: دوربین گوشی فروسرخ دور نمی‌بیند. برای دمای واقعی دوربین حرارتی سخت‌افزاری لازم است. در تاریکی مطلق هم تصویری ساخته نمی‌شود؛ پشته‌سازی و تقویت فقط نور موجود را آشکار می‌کنند. سرعت‌ها نسبت به عرض تصویرند.</p>
</div><div id="viToast"></div>`;
document.body.appendChild(app);
const openBtn=document.createElement('button');openBtn.id='bVision';openBtn.textContent='بینایی شب و حرارت‌نما';
const nav=$('.actions');nav.parentNode.insertBefore(openBtn,nav);
let toastT;const toast=t=>{const e=$('#viToast');e.textContent=t;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),2400)};

/* ---------- ساخت کنترل‌ها ---------- */
function ctlSlider(g,k,label,min,max,step){
  const d=document.createElement('label');d.className='viS';
  const s=document.createElement('span');s.textContent=label;const b=document.createElement('b');
  const r=document.createElement('input');r.type='range';r.min=min;r.max=max;r.step=step;r.value=P[k];r.dataset.k=k;
  const upd=()=>{b.textContent=fa(P[k],step<1?(step<.1?2:1):0)};upd();
  r.oninput=()=>{P[k]=+r.value;upd();save()};
  d.append(s,b,r);$('#g'+g[0].toUpperCase()+g.slice(1)).appendChild(d);
}
function ctlToggle(g,k,label){
  const d=document.createElement('label');d.className='viT';
  const c=document.createElement('input');c.type='checkbox';c.checked=!!P[k];c.dataset.k=k;
  c.onchange=()=>{P[k]=c.checked;save()};
  const s=document.createElement('span');s.textContent=label;d.append(c,s);$('#g'+g[0].toUpperCase()+g.slice(1)).appendChild(d);
}
function ctlSelect(g,k,label,opts){
  const d=document.createElement('label');d.className='viSel';const s=document.createElement('span');s.textContent=label;
  const sel=document.createElement('select');sel.dataset.k=k;
  for(const[v,t]of opts){const o=document.createElement('option');o.value=v;o.textContent=t;sel.appendChild(o)}
  sel.value=String(P[k]);sel.onchange=()=>{P[k]=isNaN(+sel.value)?sel.value:+sel.value;save();if(k==='res')alloc()};
  d.append(s,sel);$('#g'+g[0].toUpperCase()+g.slice(1)).appendChild(d);
}
function buildControls(){
  for(const id of['gImg','gTrk','gView'])$('#'+id).innerHTML='';
  ctlSelect('img','res','کیفیت پردازش (سرعت در برابر جزئیات)',[[240,'سریع (۲۴۰)'],[320,'متعادل (۳۲۰)'],[480,'دقیق (۴۸۰)'],[640,'بسیار دقیق (۶۴۰)']]);
  for(const s of SL.filter(x=>x[0]==='img'))ctlSlider(...s);
  for(const t of TG.filter(x=>x[0]==='img'))ctlToggle(...t);
  ctlSelect('trk','trackMode','حالت ردیابی',[['off','خاموش'],['motion','حرکت'],['shadow','سایه'],['both','هر دو']]);
  for(const s of SL.filter(x=>x[0]==='trk'))ctlSlider(...s);
  for(const t of TG.filter(x=>x[0]==='trk'))ctlToggle(...t);
  for(const t of TG.filter(x=>x[0]==='view'))ctlToggle(...t);
  // چیپ‌های پالت
  const ch=$('#viChips');ch.innerHTML='';
  for(const p of PALETTES){
    const b=document.createElement('button');b.dataset.id=p.id;b.setAttribute('aria-pressed',P.pal===p.id);
    const i=document.createElement('i'),sp=document.createElement('span');sp.textContent=p.name;
    if(p.lut){const st=[0,.25,.5,.75,1].map(t=>{const k=Math.round(t*255)*3;return`rgb(${p.lut[k]},${p.lut[k+1]},${p.lut[k+2]}) ${t*100}%`});i.style.background='linear-gradient(90deg,'+st.join(',')+')'}
    else i.style.background='linear-gradient(90deg,#c0392b,#27ae60,#2980b9)';
    b.append(i,sp);b.onclick=()=>{P.pal=p.id;save();for(const x of ch.children)x.setAttribute('aria-pressed',x.dataset.id===p.id)};
    ch.appendChild(b);
  }
  const pr=$('#viPre');pr.innerHTML='';
  for(const p of PRESETS){const b=document.createElement('button');b.textContent=p.n;b.onclick=()=>{Object.assign(P,p.v);save();buildControls();alloc();toast('پیش‌تنظیم «'+p.n+'» اعمال شد')};pr.appendChild(b)}
}

/* ---------- دوربین ---------- */
const S={facing:'environment',stream:null,track:null,video:document.createElement('video'),running:false,gen:0,frozen:false,wake:null,torch:false,
  W:0,H:0,aspect:0,last:0,fps:20,lo:0,hi:255,noise:0,alerted:new Set(),tm:[],ts:[],ms:0};
S.video.playsInline=true;S.video.muted=true;
const main=$('#viMain'),ov=$('#viOv'),mctx=main.getContext('2d'),octx=ov.getContext('2d');
const wk=document.createElement('canvas'),wctx=wk.getContext('2d',{willReadFrequently:true});
let B={};
function alloc(){
  const vw=S.video.videoWidth||4,vh=S.video.videoHeight||3;
  const W=P.res,H=Math.max(2,Math.round(W*vh/vw));
  S.W=W;S.H=H;S.aspect=vw/vh;main.width=W;main.height=H;wk.width=W;wk.height=H;
  const n=W*H;
  B={n,aR:null,aG:null,aB:null,Y:new Float32Array(n),L1:new Uint8ClampedArray(n),L2:new Float32Array(n),L3:new Uint8ClampedArray(n),Lb:new Float32Array(n),tmp:new Float32Array(n),
     img:mctx.createImageData(W,H),hist:new Uint32Array(256),M:new VC.Motion(W,H),SH:new VC.Shadow(W,H),
     TM:new VC.Tracker({kind:'m',minHits:4}),TS:new VC.Tracker({kind:'s',minHits:5,maxMiss:12})};
}
async function openCam(){
  closeCam();
  S.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:S.facing},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false});
  S.video.srcObject=S.stream;await S.video.play();S.track=S.stream.getVideoTracks()[0];
  S.torch=false;$('#viTorch').setAttribute('aria-pressed',false);
  alloc();buildHW();S.running=true;S.last=performance.now();next();
}
function closeCam(){
  S.running=false;S.gen++;
  if(S.stream)S.stream.getTracks().forEach(t=>t.stop());S.stream=S.track=null;
}
function next(){
  if(!S.running)return;const g=S.gen;
  if(S.video.requestVideoFrameCallback)S.video.requestVideoFrameCallback(t=>{if(g===S.gen)frame(t)});
  else requestAnimationFrame(t=>{if(g===S.gen)frame(t)});
}
async function applyAdv(o){
  try{await S.track.applyConstraints({advanced:[o]});return true}catch{toast('این تنظیم در این دوربین پشتیبانی نمی‌شود');return false}
}
function buildHW(){
  const box=$('#viHW');box.innerHTML='';
  const caps=S.track.getCapabilities?S.track.getCapabilities():{},set=S.track.getSettings?S.track.getSettings():{};let any=false;
  const sl=(key,label,fmt)=>{
    const c=caps[key];if(!c||c.min===undefined)return;any=true;
    const d=document.createElement('label');d.className='viS';const s=document.createElement('span');s.textContent=label;const b=document.createElement('b');
    const r=document.createElement('input');r.type='range';r.min=c.min;r.max=c.max;r.step=c.step||(c.max-c.min)/100;r.value=set[key]!=null?set[key]:c.min;
    b.textContent=fmt(+r.value);
    r.oninput=async()=>{b.textContent=fmt(+r.value);
      if((key==='iso'||key==='exposureTime')&&caps.exposureMode&&caps.exposureMode.includes('manual'))await applyAdv({exposureMode:'manual'});
      if(key==='focusDistance'&&caps.focusMode&&caps.focusMode.includes('manual'))await applyAdv({focusMode:'manual'});
      applyAdv({[key]:+r.value})};
    d.append(s,b,r);box.appendChild(d);
  };
  sl('zoom','زوم سخت‌افزاری',v=>fa(v,1)+'×');sl('exposureCompensation','جبران نوردهی',v=>fa(v,1));sl('iso','ISO',v=>fa(v));
  sl('exposureTime','زمان نوردهی',v=>fa(v));sl('focusDistance','فاصله‌ی فوکوس',v=>fa(v,2));sl('colorTemperature','دمای رنگ',v=>fa(v));
  for(const[key,label]of[['exposureMode','حالت نوردهی'],['focusMode','حالت فوکوس'],['whiteBalanceMode','تعادل سفیدی']]){
    const c=caps[key];if(!Array.isArray(c)||c.length<2)continue;any=true;
    const d=document.createElement('label');d.className='viSel';const s=document.createElement('span');s.textContent=label;
    const sel=document.createElement('select');for(const v of c){const o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o)}
    if(set[key])sel.value=set[key];sel.onchange=()=>applyAdv({[key]:sel.value});d.append(s,sel);box.appendChild(d);
  }
  S.hasTorch=!!caps.torch;
  if(!any){const p=document.createElement('p');p.style.cssText='margin:6px 0;font-size:13px;color:var(--dim)';p.textContent='این مرورگر کنترل سخت‌افزاری دوربین را نمی‌دهد؛ از زوم و تقویت نرم‌افزاری استفاده کن.';box.appendChild(p)}
}

/* ---------- پردازش هر فریم ---------- */
function frame(now){
  const dt=clamp((now-S.last)/1000,.02,.5);S.last=now;S.fps=S.fps*.9+(1/dt)*.1;
  const t0=performance.now();
  try{
    const vw=S.video.videoWidth,vh=S.video.videoHeight;
    if(vw&&Math.abs(vw/vh-S.aspect)>.01)alloc();
    if(!S.frozen)process(dt,vw,vh);
    drawOverlay();
  }catch(e){S.err=e}
  S.ms=S.ms*.9+(performance.now()-t0)*.1;next();
}
function process(dt,vw,vh){
  const{W,H}=S,n=B.n,z=P.zoom,sw=vw/z,sh=vh/z;
  wctx.save();if(S.facing==='user'){wctx.translate(W,0);wctx.scale(-1,1)}
  wctx.drawImage(S.video,(vw-sw)/2,(vh-sh)/2,sw,sh,0,0,W,H);wctx.restore();
  const d=wctx.getImageData(0,0,W,H).data;
  if(!B.aR){B.aR=new Float32Array(n);B.aG=new Float32Array(n);B.aB=new Float32Array(n);for(let i=0,p=0;i<n;i++,p+=4){B.aR[i]=d[p];B.aG[i]=d[p+1];B.aB[i]=d[p+2]}}
  const k=P.stack,aR=B.aR,aG=B.aG,aB=B.aB,Y=B.Y,hist=B.hist;hist.fill(0);let nz=0;
  for(let i=0,p=0;i<n;i++,p+=4){
    const r=d[p],g=d[p+1],b=d[p+2];
    const ay=.299*aR[i]+.587*aG[i]+.114*aB[i],fy=.299*r+.587*g+.114*b,df=fy-ay;
    const w=k>0?k*Math.exp(-df*df/648):0,iw=1-w;      // پشته‌سازی تطبیقی: لبه‌های متحرک محفوظ می‌ماند
    aR[i]=aR[i]*w+r*iw;aG[i]=aG[i]*w+g*iw;aB[i]=aB[i]*w+b*iw;
    const y=.299*aR[i]+.587*aG[i]+.114*aB[i];Y[i]=y;hist[Math.min(255,y+.5|0)]++;
  }
  // تُن
  let lo=0,hi=255;if(P.autoGain){const pc=VC.percentiles(hist,n,.005,.995);lo=pc.lo;hi=pc.hi}
  S.lo+=(lo-S.lo)*.15;S.hi+=(hi-S.hi)*.15;
  const lut=VC.buildTone(S.lo,S.hi,P),L1=B.L1,L2=B.L2,L3=B.L3;
  for(let i=0;i<n;i++)L1[i]=lut[Math.min(255,Y[i]+.5|0)];
  if(P.clahe>0){
    VC.clahe(L1,W,H,8,Math.max(4,Math.round(8*H/W)),3,L2);
    const s=P.clahe;for(let i=0;i<n;i++)L2[i]=L1[i]*(1-s)+L2[i]*s;
  }else for(let i=0;i<n;i++)L2[i]=L1[i];
  if(P.sharp>0){VC.boxBlur(L2,W,H,1,B.Lb,B.tmp);const a=P.sharp;for(let i=0;i<n;i++)L3[i]=L2[i]+a*(L2[i]-B.Lb[i])}
  else for(let i=0;i<n;i++)L3[i]=L2[i];
  // رنگ‌نگاری
  const o=B.img.data,pal=PALETTES.find(p=>p.id===P.pal),inv=P.invert;
  if(!pal||!pal.lut){
    for(let i=0,p=0;i<n;i++,p+=4){
      const ratio=(L3[i]+1)/(Y[i]+1),r=clamp(aR[i]*ratio,0,255),g=clamp(aG[i]*ratio,0,255),b=clamp(aB[i]*ratio,0,255);
      o[p]=inv?255-r:r;o[p+1]=inv?255-g:g;o[p+2]=inv?255-b:b;o[p+3]=255;
    }
  }else{
    const L=pal.lut;
    for(let i=0,p=0;i<n;i++,p+=4){const v=(inv?255-L3[i]:L3[i])*3;o[p]=L[v];o[p+1]=L[v+1];o[p+2]=L[v+2];o[p+3]=255}
  }
  mctx.putImageData(B.img,0,0);
  // تحلیل
  const mode=P.trackMode;let mb=[],sb=[],shake=false;
  if(mode==='motion'||mode==='both'){const r=B.M.update(L3,dt,{sens:P.sens,tau:P.tau,minAreaFrac:P.minArea/100});mb=r.blobs;shake=r.shake;S.noise=B.M.noise}
  if(mode==='shadow'||mode==='both')sb=B.SH.update(L3,{shadowThr:P.shadowThr,minAreaFrac:P.minArea/100});
  S.shake=shake;S.tm=mode==='off'||mode==='shadow'?[]:B.TM.update(mb,dt,W,H,P.trail);
  S.ts=mode==='off'||mode==='motion'?[]:B.TS.update(sb,dt,W,H,P.trail);
  if(P.alert){
    for(const t of S.tm)if(t.cls!=='still'&&t.moved>.08&&t.age>1.5&&!S.alerted.has(t.id)){
      S.alerted.add(t.id);if(navigator.vibrate)navigator.vibrate([80,60,80]);toast('هدف متحرک شماره‌ی '+fa(t.id)+' ('+CLS_FA[t.cls]+')');
    }
  }
}
const COL={still:'#9a8f86',slow:'#ffb23e',walk:'#ff7a2e',run:'#ff3b2e'};
function drawOverlay(){
  const cw=main.clientWidth,ch=main.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
  if(!cw)return;
  if(ov.width!==Math.round(cw*dpr)||ov.height!==Math.round(ch*dpr)){ov.width=Math.round(cw*dpr);ov.height=Math.round(ch*dpr)}
  const g=octx,k=cw/S.W;g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,cw,ch);
  g.lineWidth=1;g.strokeStyle='rgba(255,255,255,.35)';
  if(P.grid){g.beginPath();for(let i=1;i<3;i++){g.moveTo(cw*i/3,0);g.lineTo(cw*i/3,ch);g.moveTo(0,ch*i/3);g.lineTo(cw,ch*i/3)}g.stroke()}
  if(P.cross){g.strokeStyle='rgba(255,255,255,.7)';g.beginPath();g.moveTo(cw/2-14,ch/2);g.lineTo(cw/2+14,ch/2);g.moveTo(cw/2,ch/2-14);g.lineTo(cw/2,ch/2+14);g.stroke()}
  g.font='bold 12px system-ui,Tahoma,sans-serif';g.textBaseline='top';
  const list=[];
  for(const t of S.tm)list.push(t);
  for(const t of S.ts)if(!P.onlyMoving||t.moved>.05||t.speed>.03)list.push(t);
  for(const t of list){
    const sh=t.kind==='s',col=sh?'#4fc3f7':COL[t.cls],[x0,y0,x1,y1]=t.box;
    if(P.trails&&t.trail.length>1){
      for(let i=1;i<t.trail.length;i++){g.globalAlpha=i/t.trail.length;g.strokeStyle=col;g.lineWidth=2;
        g.beginPath();g.moveTo(t.trail[i-1][0]*k,t.trail[i-1][1]*k);g.lineTo(t.trail[i][0]*k,t.trail[i][1]*k);g.stroke()}
      g.globalAlpha=1;
    }
    if(P.boxes){
      g.strokeStyle=col;g.lineWidth=2;g.setLineDash(sh?[6,4]:[]);g.strokeRect(x0*k,y0*k,(x1-x0)*k,(y1-y0)*k);g.setLineDash([]);
      // بردار سرعت
      if(t.speed>.02){g.beginPath();g.moveTo(t.cx*k,t.cy*k);g.lineTo((t.cx+t.vx*.5)*k,(t.cy+t.vy*.5)*k);g.stroke()}
    }
    if(P.labels){
      const txt=(sh?'سایه ':'هدف ')+fa(t.id)+' · '+CLS_FA[t.cls],w=g.measureText(txt).width+8;
      g.fillStyle='rgba(0,0,0,.65)';g.fillRect(x0*k,Math.max(0,y0*k-17),w,16);g.fillStyle=col;g.fillText(txt,x0*k+4,Math.max(0,y0*k-16));
    }
  }
  if(P.hist){
    const h=B.hist,bx=cw-70,by=ch-6;let mx=1;for(let i=0;i<256;i++)if(h[i]>mx)mx=h[i];
    g.fillStyle='rgba(0,0,0,.5)';g.fillRect(bx-3,by-43,66,46);g.fillStyle='#eadfd0';
    for(let i=0;i<64;i++){let s=0;for(let j=0;j<4;j++)s+=h[i*4+j];g.fillRect(bx+i,by-Math.min(40,s/mx*160),1,Math.min(40,s/mx*160))}
  }
  $('#viStat').textContent=fa(S.fps)+' fps · '+fa(S.ms,0)+' ms · هدف '+fa(S.tm.length)+' · سایه '+fa(S.ts.length)+(S.shake?' · گوشی را ثابت نگه دار':'');
}

/* ---------- عکس، چراغ و رابط ---------- */
async function snapshot(){
  const c=document.createElement('canvas');c.width=main.width*2;c.height=main.height*2;const g=c.getContext('2d');
  g.imageSmoothingQuality='high';g.drawImage(main,0,0,c.width,c.height);g.drawImage(ov,0,0,c.width,c.height);
  const name='didehban-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)+'.png';
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(!blob)return toast('ذخیره ممکن نشد');
  const C=window.Capacitor;
  if(C&&C.isNativePlatform&&C.isNativePlatform()&&C.Plugins&&C.Plugins.Filesystem&&C.Plugins.Share){
    try{
      const b64=await new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(String(f.result).split(',')[1]);f.onerror=rej;f.readAsDataURL(blob)});
      const r=await C.Plugins.Filesystem.writeFile({path:name,data:b64,directory:'CACHE'});
      await C.Plugins.Share.share({title:name,files:[r.uri]});return;
    }catch{toast('ذخیره‌ی فایل ممکن نشد')}
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
$('#viFlip').onclick=async()=>{S.facing=S.facing==='user'?'environment':'user';try{await openCam()}catch{toast('دسترسی دوربین ممکن نشد')}};
$('#viTorch').onclick=async()=>{
  if(!S.hasTorch)return toast('این دوربین چراغ ندارد یا مرورگر اجازه نمی‌دهد');
  const on=!S.torch;if(await applyAdv({torch:on})){S.torch=on;$('#viTorch').setAttribute('aria-pressed',on)}
};
$('#viFreeze').onclick=()=>{S.frozen=!S.frozen;$('#viFreeze').setAttribute('aria-pressed',S.frozen)};
$('#viSnap').onclick=snapshot;
$('#viFull').onclick=()=>{const e=$('#viStage');try{document.fullscreenElement?document.exitFullscreen():e.requestFullscreen()}catch{toast('تمام‌صفحه پشتیبانی نشد')}};
$('#viReset').onclick=()=>{P=Object.assign({},DEF);save();buildControls();alloc();toast('تنظیمات بازنشانی شد')};
async function open(){
  if(window.__dh&&window.__dh.running())window.__dh.stop();
  app.classList.add('on');buildControls();
  try{if('wakeLock' in navigator)S.wake=await navigator.wakeLock.request('screen')}catch{}
  try{await openCam()}catch(e){if(window.__dbg)console.error('openCam fail',e);toast('دسترسی دوربین داده نشد')}
}
function close(){
  closeCam();S.frozen=false;$('#viFreeze').setAttribute('aria-pressed',false);
  try{S.wake&&S.wake.release()}catch{}app.classList.remove('on');
}
openBtn.onclick=open;$('#viClose').onclick=close;
})();
