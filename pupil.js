/* اسکن مردمک: رابط، دوربین، مدل چهره، ذخیره‌سازی محلی */
(()=>{
'use strict';
const PC=window.PupilCore;if(!PC)return;
const {N,R0,IRIS_MM,clamp}=PC;
const $=(s,r=document)=>r.querySelector(s);
const fa=(n,d=0)=>(+n).toFixed(d).replace(/\d/g,x=>'۰۱۲۳۴۵۶۷۸۹'[x]).replace('.','٫');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const nowS=()=>performance.now()/1000;

const EYES={
  R:{name:'چشم راست',iris:468,ring:[469,470,471,472],corner:[33,133],
     contour:[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],ear:[[159,145],[158,153],[33,133]]},
  L:{name:'چشم چپ',iris:473,ring:[474,475,476,477],corner:[263,362],
     contour:[362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398],ear:[[386,374],[385,380],[263,362]]}
};

/* ---------- ظاهر ---------- */
const css=document.createElement('style');
css.textContent=`
#bPupil{width:100%;min-height:60px;border:1px solid var(--amber);border-radius:12px;background:var(--panel);font-size:17px;font-weight:800}
#pupilApp{position:fixed;inset:0;z-index:30;background:var(--ink);color:var(--bone);overflow:auto;padding:12px 16px calc(24px + env(safe-area-inset-bottom));display:none}
#pupilApp.on{display:block}
#pupilApp .in{max-width:480px;margin:0 auto;display:grid;gap:12px}
#pupilApp h2{margin:0;font-size:24px}
#pupilApp .hd{display:flex;justify-content:space-between;align-items:center}
#pupilApp button,#pupilApp select{font:inherit;color:inherit;min-height:48px;border-radius:10px;border:1px solid var(--rust);background:var(--panel);padding:0 12px}
#pupilApp .seg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#pupilApp .seg button[aria-pressed=true]{background:var(--rust);border-color:var(--amber);font-weight:800}
#pupilApp .prof{display:grid;grid-template-columns:1fr auto auto;gap:8px}
#pvc{width:100%;display:block;background:#000;border-radius:10px;border:1px solid var(--rust)}
#pChecks{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:14px}
#pChecks li{color:var(--dim)} #pChecks li.ok{color:var(--bone)} #pChecks li::before{content:"✗ ";color:var(--signal)} #pChecks li.ok::before{content:"✓ ";color:var(--amber)}
#pLive{font-size:15px;color:var(--bone);min-height:1.7em}
#pMsg{font-size:15px;color:var(--dim)}
#pGo{min-height:64px;background:var(--signal);color:#190503;border:0;font-size:20px;font-weight:900}
#pGo:disabled{background:var(--panel);color:var(--dim);border:1px solid var(--rust)}
#pRes{display:none;gap:12px}#pRes.on{display:grid}
#pVerdict{padding:14px;border-radius:12px;background:var(--panel);border-inline-start:6px solid var(--bone)}
#pVerdict.weak{border-color:var(--amber)}#pVerdict.fixed{border-color:var(--signal)}#pVerdict.unk{border-color:var(--dim)}
#pVerdict b{font-size:20px;display:block}
#pVerdict ul{margin:6px 0 0;padding-inline-start:20px;color:var(--amber)}
.eyeCard{background:var(--panel);border-radius:12px;padding:10px 12px;font-size:14px}
.eyeCard h3{margin:0 0 4px;font-size:16px}
.eyeCard dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:0}.eyeCard dd{margin:0;font-weight:700}
#pChart{width:100%;height:170px;background:#000;border-radius:10px}
#pHist{list-style:none;margin:0;padding:0;font-size:13px;color:var(--dim)}#pHist li{padding:4px 0;border-bottom:1px solid var(--rust)}
#pstim{position:fixed;inset:0;z-index:40;display:none;background:#1b1b1b;color:#777;text-align:center;font-size:18px}
#pstim.on{display:block}
#pstim i{position:absolute;top:calc(env(safe-area-inset-top) + 6px);left:50%;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:#b33;border:2px solid #fff3}
#pstim span{position:absolute;top:30%;left:0;right:0;font-size:64px;font-weight:900}
#pstim small{position:absolute;bottom:calc(20px + env(safe-area-inset-bottom));left:0;right:0}
`;
document.head.appendChild(css);

const app=document.createElement('div');app.id='pupilApp';
app.innerHTML=`<div class="in">
 <div class="hd"><h2>اسکن مردمک</h2><button id="pClose2">بستن</button></div>
 <div class="seg"><button id="mFront" aria-pressed="true">دوربین جلو<br><small>همکاری فرد</small></button><button id="mRear" aria-pressed="false">دوربین پشت + چراغ<br><small>بررسی دیگران</small></button></div>
 <div class="prof"><select id="pSel" aria-label="پروفایل"></select><button id="pAdd">افزودن</button><button id="pDel">حذف</button></div>
 <canvas id="pvc" width="480" height="640"></canvas>
 <ul id="pChecks"></ul>
 <div id="pLive" aria-live="polite"></div>
 <button id="pGo" disabled>شروع اسکن</button>
 <p id="pMsg"></p>
 <section id="pRes">
  <div id="pVerdict"></div>
  <div id="pCards"></div>
  <canvas id="pChart"></canvas>
  <div class="seg"><button id="pSave">ذخیره در پروفایل</button><button id="pAgain">اسکن مجدد</button></div>
  <ul id="pHist"></ul>
 </section>
 <p class="foot" style="font-size:12.5px;color:var(--dim);margin:0">این ابزار تشخیص پزشکی نیست. آستانه‌ها تجربی‌اند و دقت به نور، فاصله و رنگ چشم بستگی دارد. فقط عدد اندازه‌گیری ذخیره می‌شود، نه تصویر چشم، و همه‌چیز روی همین گوشی می‌ماند.</p>
</div>`;
document.body.appendChild(app);
const stim=document.createElement('div');stim.id='pstim';stim.innerHTML='<i></i><span id="pBig"></span><small id="pStimMsg">برای لغو لمس کن</small>';
document.body.appendChild(stim);
const openBtn=document.createElement('button');openBtn.id='bPupil';openBtn.textContent='اسکن مردمک (نشانه‌ی زنده بودن)';
const nav=$('.actions');nav.parentNode.insertBefore(openBtn,nav);

const CHECKS=[['face','چهره پیدا شد'],['open','چشم‌ها باز است'],['size','فاصله مناسب'],['light','نور مناسب'],['stable','ثابت است'],['gaze','نگاه مستقیم'],['pupil','مردمک قابل اندازه‌گیری']];
$('#pChecks').innerHTML=CHECKS.map(([k,t])=>`<li data-k="${k}">${t}</li>`).join('');

/* ---------- ذخیره‌سازی محلی ---------- */
const DB={db:null,
  open(){return new Promise((res,rej)=>{const r=indexedDB.open('didehban-pupil',1);
    r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('profiles',{keyPath:'id',autoIncrement:true});d.createObjectStore('scans',{keyPath:'id',autoIncrement:true}).createIndex('pid','pid')};
    r.onsuccess=()=>{this.db=r.result;res()};r.onerror=()=>rej(r.error)})},
  req(store,mode,fn){return new Promise((res,rej)=>{const t=this.db.transaction(store,mode),rq=fn(t.objectStore(store));t.oncomplete=()=>res(rq&&rq.result);t.onerror=()=>rej(t.error)})},
  profiles(){return this.req('profiles','readonly',s=>s.getAll())},
  addProfile(name){return this.req('profiles','readwrite',s=>s.add({name,ts:Date.now()}))},
  scans(pid){return this.req('scans','readonly',s=>s.index('pid').getAll(pid))},
  addScan(o){return this.req('scans','readwrite',s=>s.add(o))},
  async delProfile(pid){
    const sc=await this.scans(pid);
    await this.req('scans','readwrite',s=>{for(const x of sc)s.delete(x.id)});
    await this.req('profiles','readwrite',s=>s.delete(pid));
  }
};

/* ---------- وضعیت ---------- */
const video=document.createElement('video');video.playsInline=true;video.muted=true;
const cc=document.createElement('canvas');cc.width=cc.height=N;const cctx=cc.getContext('2d',{willReadFrequently:true});
const mc=document.createElement('canvas');mc.width=mc.height=N;const mctx=mc.getContext('2d',{willReadFrequently:true});
const pv=$('#pvc'),pctx=pv.getContext('2d');
const ST={gen:0,mode:'front',stream:null,track:null,running:false,LM:null,lastTs:0,rec:null,scanning:false,abort:false,
  eyes:{R:{rs:null,hist:[]},L:{rs:null,hist:[]}},ready:{},readySince:0,last:null,pid:null,wake:null,result:null,torchOk:false};

async function loadLM(){
  if(ST.LM)return ST.LM;
  const mod=await import('./mp/vision_bundle.mjs');
  const fs=await mod.FilesetResolver.forVisionTasks('./mp/wasm');
  const mk=d=>mod.FaceLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:'./mp/face_landmarker.task',delegate:d},
    runningMode:'VIDEO',numFaces:1,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5,minTrackingConfidence:.5});
  try{ST.LM=await mk('GPU')}catch{ST.LM=await mk('CPU')}
  return ST.LM;
}
async function openCam(){
  closeCam();
  ST.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:ST.mode==='front'?'user':'environment'},
    width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30}},audio:false});
  video.srcObject=ST.stream;await video.play();ST.track=ST.stream.getVideoTracks()[0];
  const cap=ST.track.getCapabilities?ST.track.getCapabilities():{};ST.torchOk=!!cap.torch;
  pv.width=480;pv.height=Math.round(480*video.videoHeight/video.videoWidth);
  ST.eyes.R={rs:null,hist:[]};ST.eyes.L={rs:null,hist:[]};
}
function closeCam(){
  ST.running=false;ST.gen++;
  if(ST.stream)ST.stream.getTracks().forEach(t=>t.stop());
  ST.stream=ST.track=null;
}
async function torch(on){
  if(!ST.torchOk)return false;
  try{await ST.track.applyConstraints({advanced:[{torch:on}]});return true}catch{return false}
}

/* ---------- پردازش هر فریم ---------- */
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function processEye(key,lm,vw,vh){
  const E=EYES[key],S=ST.eyes[key],pt=i=>({x:lm[i].x*vw,y:lm[i].y*vh});
  const c=pt(E.iris);let rr=0;for(const i of E.ring)rr+=dist(pt(i),c);rr/=E.ring.length;
  if(!(rr>4))return null;
  S.rs=S.rs?S.rs*.85+rr*.15:rr;
  const s=R0/S.rs,side=N/s,sx=c.x-side/2,sy=c.y-side/2;
  cctx.drawImage(video,sx,sy,side,side,0,0,N,N);
  const id=cctx.getImageData(0,0,N,N).data,img=new Float32Array(N*N);let lum=0;
  for(let i=0,p=0;i<N*N;i++,p+=4){img[i]=id[p];lum+=.3*id[p]+.59*id[p+1]+.11*id[p+2]}
  lum/=N*N;
  mctx.fillStyle='#000';mctx.fillRect(0,0,N,N);mctx.fillStyle='#fff';mctx.beginPath();
  E.contour.forEach((i,k)=>{const p=pt(i),x=(p.x-sx)*s,y=(p.y-sy)*s;k?mctx.lineTo(x,y):mctx.moveTo(x,y)});
  mctx.closePath();mctx.fill();
  const md=mctx.getImageData(0,0,N,N).data,mask=new Uint8Array(N*N);
  for(let i=0,p=0;i<N*N;i++,p+=4)mask[i]=md[p]>128?1:0;
  const m=PC.measurePupil(img,mask,{cx:N/2,cy:N/2});
  const v1=dist(pt(E.ear[0][0]),pt(E.ear[0][1])),v2=dist(pt(E.ear[1][0]),pt(E.ear[1][1])),h=dist(pt(E.ear[2][0]),pt(E.ear[2][1]));
  const ear=(v1+v2)/(2*h);
  const c0=pt(E.corner[0]),c1=pt(E.corner[1]);
  const pos=((c.x-c0.x)*(c1.x-c0.x)+(c.y-c0.y)*(c1.y-c0.y))/((c1.x-c0.x)**2+(c1.y-c0.y)**2);
  S.hist.push(c);if(S.hist.length>8)S.hist.shift();
  let mx=0,my=0;for(const p of S.hist){mx+=p.x;my+=p.y}mx/=S.hist.length;my/=S.hist.length;
  let sd=0;for(const p of S.hist)sd=Math.max(sd,Math.hypot(p.x-mx,p.y-my));
  return{key,c,rs:S.rs,irisD:2*S.rs,m,ratio:m.ok?m.r/R0:NaN,q:m.ok?m.q:0,ear,pos,lum,sd:sd/(2*S.rs),
    px:m.ok?sx+m.cx/s:null,py:m.ok?sy+m.cy/s:null,pr:m.ok?m.r/s:null};
}
function frame(now,meta){
  if(!ST.running)return;
  const t0=performance.now();
  try{
    const vw=video.videoWidth,vh=video.videoHeight;
    let ts=Math.round(now);if(ts<=ST.lastTs)ts=ST.lastTs+1;ST.lastTs=ts;
    const res=ST.LM.detectForVideo(video,ts);
    const lm=res&&res.faceLandmarks&&res.faceLandmarks[0];
    const tsec=(meta&&meta.captureTime&&Math.abs(meta.captureTime-now)<500?meta.captureTime:now)/1000;
    let out=null;
    if(lm&&lm.length>=478){out={R:processEye('R',lm,vw,vh),L:processEye('L',lm,vw,vh),lm,vw,vh}}
    ST.last=out;
    evalReady(out);
    if(ST.rec&&out){
      for(const k of['R','L']){const e=out[k];if(!e)continue;
        const bl=e.ear<.15,S=ST.rec.series[k];S.t.push(tsec-ST.rec.t0);S.d.push(e.ratio);S.q.push(bl?0:e.q)}
      if(out.R)ST.rec.sizes.push(out.R.irisD);if(out.L)ST.rec.sizes.push(out.L.irisD);
    }
    if(!ST.scanning||ST.mode==='rear')draw(out);
  }catch(e){ST.err=e}
  ST.fps=.9*(ST.fps||20)+.1*(1000/Math.max(1,performance.now()-t0));
  next();
}
function next(){
  if(!ST.running)return;
  const g=ST.gen;
  if(video.requestVideoFrameCallback)video.requestVideoFrameCallback((n,m)=>{if(g===ST.gen)frame(n,m)});
  else requestAnimationFrame(t=>{if(g===ST.gen)frame(t,null)});
}
function evalReady(o){
  const R={};R.face=!!o&&!!o.R&&!!o.L;
  if(R.face){
    const E=[o.R,o.L];
    R.open=E.every(e=>e.ear>.17);
    R.size=E.every(e=>e.irisD>=30);
    R.light=E.every(e=>e.lum>30&&e.lum<215);
    R.stable=E.every(e=>e.sd<.35);
    R.gaze=ST.mode==='rear'||E.every(e=>e.pos>.3&&e.pos<.7);
    R.pupil=E.every(e=>e.q>=.4);
  }
  ST.ready=R;
  const all=CHECKS.every(([k])=>R[k]);
  if(all){if(!ST.readySince)ST.readySince=nowS()}else ST.readySince=0;
}
function draw(o){
  const w=pv.width,h=pv.height,k=w/o_vw();
  pctx.save();
  if(ST.mode==='front'){pctx.translate(w,0);pctx.scale(-1,1)}
  pctx.drawImage(video,0,0,w,h);
  if(o){
    for(const key of['R','L']){const e=o[key];if(!e)continue;
      pctx.lineWidth=2;pctx.strokeStyle='#ffb23e';pctx.beginPath();pctx.arc(e.c.x*k,e.c.y*k,e.rs*k,0,6.2832);pctx.stroke();
      if(e.m.ok){pctx.strokeStyle='#ff3b2e';pctx.beginPath();pctx.arc(e.px*k,e.py*k,e.pr*k,0,6.2832);pctx.stroke()}}
  }
  pctx.restore();
  for(const[kk]of CHECKS){const li=$('#pChecks [data-k='+kk+']');li.classList.toggle('ok',!!ST.ready[kk])}
  const r=ST.ready,live=[];
  if(o&&o.R&&o.L&&r.face){
    for(const key of['R','L']){const e=o[key];live.push(EYES[key].name+': '+(e.m.ok?fa(e.ratio*IRIS_MM,1)+' mm':'—'))}
    $('#pLive').textContent=live.join('  |  ');
    const bad=CHECKS.find(([k])=>!r[k]);
    if(bad){const hint={open:'چشم‌ها را کامل باز کن',size:'گوشی را نزدیک‌تر بیاور',light:'نور را تنظیم کن (نه خیلی تاریک، نه خیلی روشن)',
      stable:'گوشی و سر را ثابت نگه دار',gaze:'مستقیم به دوربین نگاه کن',pupil:'کمی جابه‌جا شو تا مردمک واضح شود'}[bad[0]];
      if(hint)$('#pLive').textContent=hint}
  }else $('#pLive').textContent='صورت را در کادر بیاور';
  $('#pGo').disabled=ST.scanning||!(ST.readySince&&nowS()-ST.readySince>.8);
}
function o_vw(){return video.videoWidth||1}

/* ---------- اسکن ---------- */
async function setStim(on){
  if(ST.mode==='front'){stim.style.background=on?'#fff':'#1b1b1b';stim.style.color=on?'#999':'#777';return true}
  return torch(on);
}
function big(t){$('#pBig').textContent=t;$('#pMsg').textContent=t?('…'+t):''}
async function scan(){
  if(ST.scanning)return;
  if(ST.mode==='rear'&&!ST.torchOk){$('#pMsg').textContent='این دوربین کنترل چراغ را به مرورگر نمی‌دهد؛ حالت دوربین جلو را امتحان کن.';return}
  ST.scanning=true;ST.abort=false;$('#pGo').disabled=true;$('#pRes').classList.remove('on');
  if(ST.mode==='front'){stim.classList.add('on');stim.style.background='#1b1b1b'}
  const stop=async msg=>{ST.rec=null;await setStim(false);stim.classList.remove('on');ST.scanning=false;$('#pMsg').textContent=msg};
  stim.onclick=()=>{ST.abort=true};
  for(let n=3;n>0;n--){big(String(n));await sleep(1000);if(ST.abort)return stop('لغو شد.')}
  big('');
  const rec={t0:nowS(),series:{R:{t:[],d:[],q:[]},L:{t:[],d:[],q:[]}},sizes:[],onset:0,offset:0};
  ST.rec=rec;
  await sleep(2500);if(ST.abort)return stop('لغو شد.');
  const okOn=await setStim(true);rec.onset=nowS()-rec.t0;
  if(!okOn)return stop('روشن کردن چراغ ممکن نشد.');
  await sleep(3000);if(ST.abort)return stop('لغو شد.');
  await setStim(false);rec.offset=nowS()-rec.t0;
  await sleep(3500);
  ST.rec=null;stim.classList.remove('on');ST.scanning=false;
  await finish(rec);
}
async function finish(rec){
  const sizes=rec.sizes.filter(x=>x>0),sizeQ=clamp((PC.median(sizes)-24)/18);
  const aR=PC.analyzePLR(rec.series.R,rec.onset,rec.offset,{sizeQ}),aL=PC.analyzePLR(rec.series.L,rec.onset,rec.offset,{sizeQ});
  const hist=ST.pid?(await DB.scans(ST.pid)).filter(s=>s.code==='ok').map(s=>({constr:s.constr})):[];
  const v=PC.verdict(aL,aR,hist);
  ST.result={rec,aL,aR,v,ts:Date.now()};
  showResult();
}
function showResult(){
  const {aL,aR,v,rec}=ST.result;
  $('#pRes').classList.add('on');
  const vd=$('#pVerdict');vd.className=v.code;
  vd.innerHTML='<b></b><p style="margin:6px 0 0"></p>';
  vd.querySelector('b').textContent=v.text;vd.querySelector('p').textContent=v.adv;
  if(v.flags.length){const ul=document.createElement('ul');for(const f of v.flags){const li=document.createElement('li');li.textContent=f;ul.appendChild(li)}vd.appendChild(ul)}
  const cards=$('#pCards');cards.innerHTML='';cards.style.display='grid';cards.style.gap='8px';
  for(const [key,a,s] of[['L',aL,v.left],['R',aR,v.right]]){
    const d=document.createElement('div');d.className='eyeCard';
    const h=document.createElement('h3');h.textContent=EYES[key].name+': '+s.t;d.appendChild(h);
    if(a&&a.ok){
      const rows=[['قطر پایه',fa(a.D0mm,1)+' mm'],['انقباض',fa(a.constr)+'٪'],['تأخیر',a.lat==null?'دیده نشد':fa(a.lat*1000)+' ms'],
        ['سرعت انقباض',fa(a.mcv)+'٪ بر ثانیه'],['بازگشت ۷۵٪',a.t75==null?'—':fa(a.t75,1)+' s'],['اطمینان',fa(a.conf)+'٪']];
      const dl=document.createElement('dl');for(const[k,x]of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=x;dl.append(dt,dd)}
      d.appendChild(dl);
    }else{const p=document.createElement('p');p.style.margin='0';p.textContent=(a&&a.why)||'داده‌ی کافی نبود';d.appendChild(p)}
    cards.appendChild(d);
  }
  chart(rec,aL,aR);loadHist();
  $('#pSave').disabled=false;
}
function chart(rec,aL,aR){
  const cv=$('#pChart'),w=cv.clientWidth,h=cv.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
  cv.width=w*dpr;cv.height=h*dpr;const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
  const T=Math.max(rec.offset+3.5,9),X=t=>t/T*(w-12)+6,lo=.55,hi=1.12,Y=v=>h-8-(v-lo)/(hi-lo)*(h-16);
  g.fillStyle='rgba(255,178,62,.15)';g.fillRect(X(rec.onset),0,X(rec.offset)-X(rec.onset),h);
  g.strokeStyle='#6b2f27';g.lineWidth=1;g.beginPath();g.moveTo(0,Y(1));g.lineTo(w,Y(1));g.stroke();
  for(const [a,col] of[[aL,'#eadfd0'],[aR,'#ff3b2e']]){
    if(!a||!a.ok)continue;g.strokeStyle=col;g.lineWidth=2;g.beginPath();let pen=false;
    a.curve.x.forEach((v,i)=>{if(v!==v){pen=false;return}const t=a.curve.t0+i/a.curve.fs,y=Y(clamp(v/a.D0,lo,hi));pen?g.lineTo(X(t),y):g.moveTo(X(t),y);pen=true});
    g.stroke();
  }
}
async function loadHist(){
  const ul=$('#pHist');ul.innerHTML='';
  if(!ST.pid){const li=document.createElement('li');li.textContent='برای دیدن روند و مقایسه با حالت عادی، یک پروفایل بساز و نتیجه را ذخیره کن.';ul.appendChild(li);return}
  const sc=(await DB.scans(ST.pid)).sort((a,b)=>b.ts-a.ts).slice(0,8);
  for(const s of sc){const li=document.createElement('li');
    li.textContent=new Date(s.ts).toLocaleString('fa-IR')+' — '+s.text+(s.constr!=null?' (انقباض '+fa(s.constr)+'٪)':'');ul.appendChild(li)}
}
async function save(){
  if(!ST.result)return;
  if(!ST.pid){$('#pMsg').textContent='اول یک پروفایل انتخاب کن یا بساز.';return}
  const {aL,aR,v,ts}=ST.result;
  const pick=a=>a&&a.ok?{D0mm:a.D0mm,constr:a.constr,lat:a.lat,mcv:a.mcv,t75:a.t75,conf:a.conf}:null;
  const both=aL&&aL.ok&&aR&&aR.ok;
  await DB.addScan({pid:ST.pid,ts,mode:ST.mode,code:v.code,text:v.text,flags:v.flags,L:pick(aL),R:pick(aR),constr:both?(aL.constr+aR.constr)/2:null});
  $('#pSave').disabled=true;$('#pMsg').textContent='ذخیره شد.';loadHist();
}

/* ---------- پروفایل و حالت ---------- */
async function refreshProfiles(){
  const sel=$('#pSel'),list=await DB.profiles();sel.innerHTML='';
  const o0=document.createElement('option');o0.value='';o0.textContent='بدون پروفایل';sel.appendChild(o0);
  for(const p of list){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;sel.appendChild(o)}
  if(ST.pid&&list.some(p=>p.id===ST.pid))sel.value=ST.pid;else{ST.pid=null;sel.value=''}
}
$('#pSel').onchange=e=>{ST.pid=e.target.value?+e.target.value:null;loadHist()};
$('#pAdd').onclick=async()=>{const n=(prompt('نام فرد:')||'').trim();if(!n)return;ST.pid=await DB.addProfile(n);await refreshProfiles();loadHist()};
$('#pDel').onclick=async()=>{if(!ST.pid)return;if(!confirm('پروفایل و همه‌ی اسکن‌هایش حذف شود؟'))return;await DB.delProfile(ST.pid);ST.pid=null;await refreshProfiles();loadHist()};
async function setMode(m){
  if(ST.scanning)return;ST.mode=m;
  $('#mFront').setAttribute('aria-pressed',m==='front');$('#mRear').setAttribute('aria-pressed',m==='rear');
  $('#pMsg').textContent=m==='front'
    ?'گوشی را ۲۵ تا ۳۵ سانتی‌متر جلوی صورت، هم‌سطح چشم نگه دار. روشنایی صفحه حداکثر، نور اتاق کم (نه تاریک کامل). هنگام اسکن به نقطه‌ی بالای صفحه نگاه کن و پلک نزن.'
    :'گوشی را ۲۵ تا ۳۵ سانتی‌متر جلوی صورت فرد نگه دار، هم‌سطح چشم‌ها و رو به دوربین پشت. نور محیط کم باشد. چراغ در میانه‌ی اسکن ۳ ثانیه روشن می‌شود. اگر فرد پلک می‌زند، دوباره بسنج.';
  ST.readySince=0;
  try{await openCam();ST.running=true;next()}catch{$('#pMsg').textContent='دسترسی دوربین داده نشد.'}
}
$('#mFront').onclick=()=>setMode('front');$('#mRear').onclick=()=>setMode('rear');
$('#pGo').onclick=scan;$('#pAgain').onclick=()=>{$('#pRes').classList.remove('on');app.scrollTo(0,0)};$('#pSave').onclick=save;

async function openApp(){
  if(window.__dh&&window.__dh.running())window.__dh.stop();
  app.classList.add('on');$('#pRes').classList.remove('on');
  try{if('wakeLock' in navigator)ST.wake=await navigator.wakeLock.request('screen')}catch{}
  $('#pMsg').textContent='در حال بارگذاری مدل چهره…';
  try{await DB.open();await refreshProfiles();loadHist()}catch{}
  try{await loadLM()}catch(e){
    $('#pMsg').innerHTML='';
    const p=document.createElement('span');
    p.textContent='فایل‌های مدل چهره کنار اپ نیستند. در ترموکس داخل پوشه‌ی ریپو این را اجرا کن: sh fetch-mp.sh  و بعد: git add -A && git commit -m mp && git push';
    $('#pMsg').appendChild(p);return;
  }
  await setMode(ST.mode);
}
function closeApp(){
  ST.abort=true;closeCam();stim.classList.remove('on');ST.scanning=false;ST.rec=null;
  try{ST.wake&&ST.wake.release()}catch{}
  app.classList.remove('on');
}
openBtn.onclick=openApp;$('#pClose2').onclick=closeApp;
})();
