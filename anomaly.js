/* ثبت ناهنجاری مغناطیسی، قطب‌نما و صدا: حسگرها، رابط و ذخیره‌سازی محلی */
(()=>{
'use strict';
const AC=window.AnomalyCore;if(!AC)return;
const $=(s,r=document)=>r.querySelector(s);
const fa=(n,d=0)=>(+n).toFixed(d).replace(/\d/g,x=>'۰۱۲۳۴۵۶۷۸۹'[x]).replace('.','٫');
const clamp=(x,a=0,b=1)=>x<a?a:x>b?b:x;
const nowS=()=>performance.now()/1000;
const T0=Date.now()-performance.now();           // تبدیل ثانیه‌ی عملکرد به زمان واقعی
const CLS={impulse:'ضربه‌ای',siren:'آژیر / فرکانس متغیر',grunt:'ناله / غرغر',ultra:'فراصوت',low:'کم‌بسامد',tonal:'تُن ثابت',broad:'پهن‌باند',mixed:'ترکیبی'};

/* ---------- ظاهر ---------- */
const css=document.createElement('style');
css.textContent=`
#bAnom{width:100%;min-height:60px;border:1px solid var(--rust);border-radius:12px;background:var(--panel);font-size:17px;font-weight:800}
#bAnom.rec{border-color:var(--signal)}
#anApp{position:fixed;inset:0;z-index:30;background:var(--ink);color:var(--bone);overflow:auto;padding:12px 16px calc(24px + env(safe-area-inset-bottom));display:none}
#anApp.on{display:block}#anApp.dim{filter:brightness(.25)}
#anApp .in{max-width:480px;margin:0 auto;display:grid;gap:12px}
#anApp h2{margin:0;font-size:22px}
#anApp .hd{display:flex;justify-content:space-between;align-items:center;gap:8px}
#anApp button{font:inherit;color:inherit;min-height:48px;border-radius:10px;border:1px solid var(--rust);background:var(--panel);padding:0 12px}
#anApp button[aria-pressed=true]{background:var(--rust);border-color:var(--amber);font-weight:800}
#aStart{min-height:64px;background:var(--signal)!important;color:#190503!important;border:0!important;font-size:20px;font-weight:900}
#aStart[aria-pressed=true]{background:var(--bone)!important;color:var(--ink)!important}
#aSens{margin:0;font-size:13.5px;color:var(--dim)}
.aLive{background:var(--panel);border-radius:12px;padding:10px 12px;font-size:15px;display:grid;gap:6px}
#aSpec{width:100%;height:110px;background:#000;border-radius:8px;display:block}
.aRow{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;font-size:14px;color:var(--dim)}
.aRow input{width:100%;accent-color:var(--signal)}.aRow b{color:var(--bone);min-width:4.5em;text-align:left}
.aTabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#aList{list-style:none;margin:0;padding:0;display:grid;gap:8px}
#aList li{background:var(--panel);border-radius:10px;border-inline-start:5px solid var(--amber)}
#aList li.snd{border-color:var(--signal)}
#aList summary{padding:10px 12px;cursor:pointer;font-size:14.5px;line-height:1.7}
#aList .dt{display:block;color:var(--dim);font-size:12.5px}
#aList .bd{padding:0 12px 10px;font-size:13.5px;color:var(--bone)}
#aList .bd p{margin:3px 0}#aList .bd ul{margin:4px 0 0;padding-inline-start:20px;color:var(--amber)}
.aAct{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#aToast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);background:var(--bone);color:var(--ink);
  padding:10px 16px;border-radius:10px;font-weight:700;opacity:0;pointer-events:none;transition:opacity .2s;z-index:50;max-width:90vw}
#aToast.on{opacity:1}
`;
document.head.appendChild(css);

const app=document.createElement('div');app.id='anApp';
app.innerHTML=`<div class="in">
 <div class="hd"><h2>ثبت ناهنجاری</h2><button id="aClose">بستن</button></div>
 <button id="aStart" aria-pressed="false">شروع ثبت</button>
 <p id="aSens"></p>
 <div class="aLive"><div id="aMag">میدان مغناطیسی: —</div><div id="aHead">قطب‌نما: —</div><canvas id="aSpec"></canvas><div id="aSnd">صدا: —</div></div>
 <label class="aRow"><span>آستانه‌ی مغناطیس</span><input id="aThrM" type="range" min="4" max="60" step="1" value="10"><b id="aThrMv">۱۰ µT</b></label>
 <label class="aRow"><span>آستانه‌ی صدا</span><input id="aThrS" type="range" min="6" max="25" step="1" value="12"><b id="aThrSv">۱۲ dB</b></label>
 <button id="aDim" aria-pressed="false">کم‌نور کردن صفحه (ثبت ادامه دارد)</button>
 <div class="aTabs"><button id="tAll" aria-pressed="true">همه</button><button id="tMag" aria-pressed="false">مغناطیس</button><button id="tSnd" aria-pressed="false">صدا</button></div>
 <ul id="aList"></ul>
 <div class="aAct"><button id="aJson">خروجی JSON</button><button id="aCsv">خروجی CSV</button><button id="aClear">پاک کردن</button></div>
 <p style="margin:0;font-size:12.5px;color:var(--dim)">علت‌ها فقط حدس آماری‌اند و قطعی نیستند. گوشی نمی‌تواند طوفان ژئومغناطیسی را ببیند؛ فقط منابع نزدیک (آهنربا، فلز، موتور) را تشخیص می‌دهد. برای ثبت پیوسته، صفحه باید روشن بماند.</p>
</div><div id="aToast"></div>`;
document.body.appendChild(app);
const openBtn=document.createElement('button');openBtn.id='bAnom';openBtn.textContent='ثبت ناهنجاری مغناطیسی و صدا';
const nav=$('.actions');nav.parentNode.insertBefore(openBtn,nav);

let toastT;
function toast(t){const e=$('#aToast');e.textContent=t;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),2600)}

/* ---------- ذخیره‌سازی ---------- */
const DB={db:null,
  open(){return new Promise((res,rej)=>{const r=indexedDB.open('didehban-anom',1);
    r.onupgradeneeded=()=>{r.result.createObjectStore('events',{keyPath:'id',autoIncrement:true}).createIndex('ts','ts')};
    r.onsuccess=()=>{this.db=r.result;res()};r.onerror=()=>rej(r.error)})},
  req(mode,fn){return new Promise((res,rej)=>{const t=this.db.transaction('events',mode),rq=fn(t.objectStore('events'));t.oncomplete=()=>res(rq&&rq.result);t.onerror=()=>rej(t.error)})},
  all(){return this.req('readonly',s=>s.getAll())},
  add(o){return this.req('readwrite',s=>s.add(o))},
  clear(){return this.req('readwrite',s=>s.clear())},
  async trim(max){const a=await this.all();if(a.length<=max)return;a.sort((x,y)=>x.ts-y.ts);const del=a.slice(0,a.length-max);await this.req('readwrite',s=>{for(const x of del)s.delete(x.id)})}
};
function stamp(ts){
  const d=new Date(ts);
  return{ts,iso:d.toISOString(),
    day:d.toLocaleDateString('fa-IR',{weekday:'long'}),
    date:d.toLocaleDateString('fa-IR',{year:'numeric',month:'2-digit',day:'2-digit'}),
    time:d.toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})};
}

/* ---------- حسگرها ---------- */
const ST={running:false,MD:null,SD:null,thrM:10,thrS:12,rawOk:false,mic:null,micCtx:null,an:null,fb:null,timer:null,mag:null,
  live:{B:null,H:null,lvl:null},wake:null,events:[],filter:'all',lastSound:{}};
function emit(ev){
  const ts=Math.round(T0+ev.t*1000);
  if(ev.kind==='sound'){
    const last=ST.lastSound[ev.cls]||0;if(ts-last<1500)return;ST.lastSound[ev.cls]=ts;
  }
  const rec={kind:ev.kind,...stamp(ts),data:ev};
  DB.add(rec).then(id=>{rec.id=id;ST.events.unshift(rec);render();DB.trim(1000)}).catch(()=>{});
  if(navigator.vibrate)navigator.vibrate(ev.kind==='sound'?[60]:[40,40,40]);
  toast(ev.kind==='mag'?'ناهنجاری مغناطیسی ثبت شد':ev.kind==='heading'?'انحراف قطب‌نما ثبت شد':'ناهنجاری صوتی ثبت شد');
}
function onMotion(e){
  const r=e.rotationRate,a=e.acceleration;
  const g=r?Math.hypot(r.alpha||0,r.beta||0,r.gamma||0):0,ac=a&&a.x!=null?Math.hypot(a.x,a.y,a.z):0;
  ST.MD.motion(nowS(),g,ac);
}
function onOriAbs(e){ST.gotAbs=true;if(e.alpha==null)return;feedHeading((360-e.alpha)%360)}
function onOri(e){
  if(e.webkitCompassHeading!=null)feedHeading(e.webkitCompassHeading);
  else if(!ST.gotAbs&&e.absolute&&e.alpha!=null)feedHeading((360-e.alpha)%360);
}
function feedHeading(h){ST.live.H=h;if(ST.MD)ST.MD.heading(nowS(),h)}
function nativeSensors(){const C=window.Capacitor;return C&&C.isNativePlatform&&C.isNativePlatform()&&C.Plugins&&C.Plugins.NativeSensors}
async function startMag(){
  const NS=nativeSensors();
  if(NS){
    try{
      const r=await NS.start();
      if(r&&r.available){
        ST.magH=await NS.addListener('mag',d=>{ST.live.B=Math.hypot(d.x,d.y,d.z);ST.MD.mag(nowS(),d.x,d.y,d.z)});
        ST.rawOk=true;ST.MD.rawOk=true;ST.native=true;setSens();return;
      }
    }catch{}
  }
  try{
    if(typeof Magnetometer==='undefined')throw new Error('none');
    const s=new Magnetometer({frequency:20,referenceFrame:'device'});
    s.addEventListener('reading',()=>{ST.rawOk=true;ST.MD.rawOk=true;ST.live.B=Math.hypot(s.x,s.y,s.z);ST.MD.mag(nowS(),s.x,s.y,s.z)});
    s.addEventListener('error',()=>{ST.rawOk=false;ST.MD.rawOk=false;setSens()});
    s.start();ST.mag=s;
  }catch{ST.rawOk=false;ST.MD.rawOk=false}
  setSens();
}
function setSens(){
  const m=[];
  m.push(ST.mic?'میکروفون: فعال':'میکروفون: غیرفعال یا اجازه داده نشد');
  if(ST.rawOk)m.push(ST.native?'مغناطیس‌سنج بومی اندروید: فعال (µT)':'مغناطیس‌سنج: فعال (شدت میدان بر حسب µT)');
  else m.push('مغناطیس‌سنج خام در این مرورگر فعال نیست؛ فقط انحراف قطب‌نما ثبت می‌شود. در Chrome می‌توانی chrome://flags/#enable-generic-sensor-extra-classes را روشن کنی.');
  $('#aSens').textContent=m.join(' | ');
}
async function startMic(){
  try{
    ST.mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    const C=ST.micCtx=new (window.AudioContext||window.webkitAudioContext)();if(C.state==='suspended')C.resume();
    const an=ST.an=C.createAnalyser();an.fftSize=4096;an.smoothingTimeConstant=0;an.minDecibels=-120;an.maxDecibels=0;
    C.createMediaStreamSource(ST.mic).connect(an);
    ST.fb=new Float32Array(an.frequencyBinCount);
    ST.SD=new AC.SoundDetector({sampleRate:C.sampleRate,fftSize:4096,thr:ST.thrS,onEvent:emit});
    ST.timer=setInterval(()=>{
      an.getFloatFrequencyData(ST.fb);const f=ST.fb;let pk=-200;
      for(let i=0;i<f.length;i++){if(!(f[i]>-120))f[i]=-120;if(f[i]>pk)pk=f[i]}
      ST.live.lvl=pk;ST.SD.push(nowS(),f);
    },125);
  }catch{ST.mic=null}
}
async function start(){
  if(ST.running)return;
  ST.running=true;ST.gotAbs=false;ST.rawOk=false;
  ST.MD=new AC.MagDetector({thr:ST.thrM,onEvent:emit,rawOk:false});
  try{
    if(typeof DeviceMotionEvent!=='undefined'&&DeviceMotionEvent.requestPermission)await DeviceMotionEvent.requestPermission();
    if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission)await DeviceOrientationEvent.requestPermission();
  }catch{}
  window.addEventListener('devicemotion',onMotion);
  window.addEventListener('deviceorientationabsolute',onOriAbs);
  window.addEventListener('deviceorientation',onOri);
  await startMag();await startMic();setSens();
  try{if('wakeLock' in navigator)ST.wake=await navigator.wakeLock.request('screen')}catch{}
  syncBtns();
  toast('ثبت شروع شد؛ ۶ ثانیه اول فقط محیط را کالیبره می‌کند');
}
function stop(){
  if(!ST.running)return;ST.running=false;
  clearInterval(ST.timer);
  if(ST.mic)ST.mic.getTracks().forEach(t=>t.stop());ST.mic=null;
  try{ST.micCtx&&ST.micCtx.close()}catch{}
  try{ST.mag&&ST.mag.stop()}catch{}ST.mag=null;
  if(ST.magH){try{ST.magH.remove()}catch{}ST.magH=null;const NS=nativeSensors();if(NS)NS.stop().catch(()=>{});ST.native=false}
  window.removeEventListener('devicemotion',onMotion);
  window.removeEventListener('deviceorientationabsolute',onOriAbs);
  window.removeEventListener('deviceorientation',onOri);
  try{ST.wake&&ST.wake.release()}catch{}
  ST.live={B:null,H:null,lvl:null};syncBtns();setSens();
}
function syncBtns(){
  $('#aStart').setAttribute('aria-pressed',ST.running);$('#aStart').textContent=ST.running?'توقف ثبت':'شروع ثبت';
  openBtn.classList.toggle('rec',ST.running);openBtn.textContent=ST.running?'ثبت ناهنجاری (در حال ثبت ●)':'ثبت ناهنجاری مغناطیسی و صدا';
}

/* ---------- نمایش زنده ---------- */
const spec=$('#aSpec'),sg=spec.getContext('2d');
function live(){
  requestAnimationFrame(live);
  if(!app.classList.contains('on'))return;
  const L=ST.live;
  $('#aMag').textContent='میدان مغناطیسی: '+(L.B!=null?fa(L.B,1)+' µT':'—');
  $('#aHead').textContent='قطب‌نما: '+(L.H!=null?fa(L.H)+'°':'—');
  $('#aSnd').textContent='صدا: '+(L.lvl!=null?'اوج '+fa(L.lvl)+' dBFS':'—');
  const w=spec.clientWidth,h=spec.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
  if(spec.width!==Math.round(w*dpr)){spec.width=Math.round(w*dpr);spec.height=Math.round(h*dpr)}
  sg.setTransform(dpr,0,0,dpr,0,0);sg.clearRect(0,0,w,h);
  const SD=ST.SD;if(!SD||!ST.running)return;
  const nb=SD.nb,bwid=w/nb,Y=v=>h-clamp((v+120)/100)*h;
  for(let b=0;b<nb;b++){
    sg.fillStyle=SD.A[b]?'#ff3b2e':'#a8958a';
    const y=Y(SD.v[b]);sg.fillRect(b*bwid+.5,y,Math.max(1,bwid-1),h-y);
    sg.fillStyle='#ffb23e';sg.fillRect(b*bwid,Y(SD.mu[b]),bwid,1.5);
  }
}

/* ---------- فهرست رویدادها ---------- */
function line(parent,text){const p=document.createElement('p');p.textContent=text;parent.appendChild(p)}
function render(){
  const ul=$('#aList');ul.innerHTML='';
  const list=ST.events.filter(e=>ST.filter==='all'||(ST.filter==='mag'&&e.kind!=='sound')||(ST.filter==='snd'&&e.kind==='sound'));
  if(!list.length){const li=document.createElement('li');li.style.padding='12px';li.textContent='هنوز رویدادی ثبت نشده.';ul.appendChild(li);return}
  for(const e of list.slice(0,200)){
    const d=e.data,li=document.createElement('li');if(e.kind==='sound')li.className='snd';
    const det=document.createElement('details'),sm=document.createElement('summary');
    let title;
    if(e.kind==='mag')title='مغناطیسی: تغییر '+fa(d.peak)+' µT، '+fa(d.dur,1)+' ثانیه';
    else if(e.kind==='heading')title='قطب‌نما: انحراف '+fa(d.delta)+' درجه';
    else title='صدا ('+CLS[d.cls]+'): '+fa(d.fLow)+' تا '+fa(d.fHigh)+' هرتز، اوج '+fa(d.peakF)+' هرتز';
    const top=d.causes&&d.causes[0]?'  ← محتمل‌ترین: '+d.causes[0].t+' ('+fa(d.causes[0].p)+'٪)':'';
    sm.textContent=title+top;
    const dt=document.createElement('span');dt.className='dt';dt.textContent=e.day+' '+e.date+'، ساعت '+e.time;sm.appendChild(dt);
    det.appendChild(sm);
    const bd=document.createElement('div');bd.className='bd';
    if(e.kind==='mag'){
      line(bd,'پیک میدان: '+fa(d.peakM,1)+' µT (پایه '+fa(d.baseM,1)+' µT، '+(d.signed>=0?'افزایش':'کاهش')+')');
      line(bd,'مدت: '+fa(d.dur,1)+' ثانیه، زمان رسیدن به پیک: '+fa(d.rise,1)+' ثانیه');
      line(bd,d.returned?'به حالت عادی برگشت':'به حالت قبلی برنگشت (تغییر ماندگار)');
      line(bd,'چرخش جهت میدان: '+fa(d.angle)+' درجه'+(d.headingDelta?'، تغییر قطب‌نما: '+fa(d.headingDelta)+' درجه':''));
      if(d.osc>=.4)line(bd,'نوسان تکرارشونده: حدود '+fa(d.osc,1)+' بار در ثانیه');
      line(bd,d.moving?'هم‌زمان با حرکت گوشی':'گوشی ثابت بود');
    }else if(e.kind==='heading'){
      line(bd,'جهت جدید: '+fa(d.to)+'° در حالی که گوشی ثابت بود');
    }else{
      line(bd,'بازه‌ی فرکانسی اصلی: '+fa(d.fLow)+' تا '+fa(d.fHigh)+' هرتز (پهنا '+fa(d.bwOct,1)+' اکتاو)');
      line(bd,'فرکانس اوج: '+fa(d.peakF)+' هرتز، '+fa(d.peakEx)+' دسی‌بل بالاتر از محیط، مدت '+fa(d.dur,1)+' ثانیه');
      if(d.clusters.length>1)line(bd,'بازه‌های دیگر: '+d.clusters.slice(1).map(c=>fa(c.fLow)+' تا '+fa(c.fHigh)+' هرتز').join('، '));
      if(d.mod>=.3)line(bd,'دامنه به‌صورت تناوبی نوسان می‌کرد');
      if(d.sweepOct>=.6)line(bd,'فرکانس در حال تغییر بود ('+fa(d.sweepOct,1)+' اکتاو)');
    }
    if(d.causes&&d.causes.length){const t=document.createElement('p');t.textContent='علل محتمل (تخمین، نه قطعی):';bd.appendChild(t);
      const u=document.createElement('ul');for(const c of d.causes){const x=document.createElement('li');x.style.background='none';x.style.borderInline='0';x.textContent=fa(c.p)+'٪ '+c.t;u.appendChild(x)}bd.appendChild(u)}
    det.appendChild(bd);li.appendChild(det);ul.appendChild(li);
  }
}
async function load(){try{await DB.open();ST.events=(await DB.all()).sort((a,b)=>b.ts-a.ts);render()}catch{}}

/* ---------- خروجی ---------- */
async function download(name,text,type){
  const C=window.Capacitor;
  if(C&&C.isNativePlatform&&C.isNativePlatform()&&C.Plugins&&C.Plugins.Filesystem&&C.Plugins.Share){
    try{
      const r=await C.Plugins.Filesystem.writeFile({path:name,data:text,directory:'CACHE',encoding:'utf8'});
      await C.Plugins.Share.share({title:name,files:[r.uri]});return;
    }catch{toast('ذخیره‌ی فایل ممکن نشد')}
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
function fname(ext){return'didehban-anomalies-'+new Date().toISOString().slice(0,10)+'.'+ext}
$('#aJson').onclick=()=>{if(!ST.events.length)return toast('رویدادی نیست');download(fname('json'),JSON.stringify(ST.events,null,1),'application/json')};
$('#aCsv').onclick=()=>{
  if(!ST.events.length)return toast('رویدادی نیست');
  const q=s=>'"'+String(s).replace(/"/g,'""')+'"',rows=[['id','تاریخ','روز','ساعت','نوع','شدت','بازه_فرکانسی_هرتز','فرکانس_اوج','مدت_ثانیه','علت_محتمل','احتمال_درصد']];
  for(const e of ST.events){const d=e.data,c=d.causes&&d.causes[0]||{t:'',p:''};
    rows.push([e.id,e.date,e.day,e.time,e.kind==='mag'?'مغناطیس':e.kind==='heading'?'قطب‌نما':'صدا',
      e.kind==='mag'?d.peak.toFixed(1)+' µT':e.kind==='heading'?d.delta.toFixed(0)+' درجه':d.peakEx+' dB',
      e.kind==='sound'?d.fLow+'-'+d.fHigh:'',e.kind==='sound'?d.peakF:'',d.dur.toFixed(1),c.t,c.p])}
  download(fname('csv'),'\ufeff'+rows.map(r=>r.map(q).join(',')).join('\n'),'text/csv;charset=utf-8');
};
$('#aClear').onclick=async()=>{if(!confirm('همه‌ی رویدادهای ثبت‌شده پاک شود؟'))return;await DB.clear();ST.events=[];render()};

/* ---------- رویدادهای رابط ---------- */
$('#aStart').onclick=()=>ST.running?stop():start();
$('#aThrM').oninput=e=>{ST.thrM=+e.target.value;$('#aThrMv').textContent=fa(ST.thrM)+' µT';if(ST.MD)ST.MD.thr=ST.thrM};
$('#aThrS').oninput=e=>{ST.thrS=+e.target.value;$('#aThrSv').textContent=fa(ST.thrS)+' dB';if(ST.SD)ST.SD.thr=ST.thrS};
$('#aDim').onclick=()=>{const on=!app.classList.contains('dim');app.classList.toggle('dim',on);$('#aDim').setAttribute('aria-pressed',on)};
for(const[id,f]of[['tAll','all'],['tMag','mag'],['tSnd','snd']])$('#'+id).onclick=()=>{ST.filter=f;for(const[i]of[['tAll'],['tMag'],['tSnd']])$('#'+i).setAttribute('aria-pressed',i===id);render()};
openBtn.onclick=()=>{app.classList.add('on');load();setSens()};
$('#aClose').onclick=()=>app.classList.remove('on');
requestAnimationFrame(live);syncBtns();
})();
