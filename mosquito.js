/* پشه‌یاب: تشخیص غیرمستقیم پشه با ردهای فیزیکی (صدای بال‌زدن، فاز استریو، ردیاب نوری) و گزارش شواهد */
(()=>{
'use strict';
const MC=window.MosquitoCore;if(!MC)return;
const $=(s,r=document)=>r.querySelector(s);
const fa=(n,d=0)=>(+n).toFixed(d).replace(/\d/g,x=>'۰۱۲۳۴۵۶۷۸۹'[x]).replace('.','٫').replace('-','−');
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const ORDER={none:0,suspect:1,likely:2,confirmed:3,multi:4};
const STATE_COLOR={none:'var(--dim)',suspect:'var(--amber)',likely:'var(--orange)',confirmed:'var(--signal)',multi:'var(--signal)'};

/* ---------- ظاهر ---------- */
const css=document.createElement('style');
css.textContent=`
#bMosq{width:100%;min-height:60px;border:1px solid var(--rust);border-radius:12px;background:var(--panel);font-size:17px;font-weight:800}
#moApp{position:fixed;inset:0;z-index:30;background:var(--ink);color:var(--bone);overflow:auto;padding:10px 12px calc(24px + env(safe-area-inset-bottom));display:none}
#moApp.on{display:block}
#moApp .in{max-width:520px;margin:0 auto;display:grid;gap:10px}
#moApp h2{margin:0;font-size:22px}#moApp .hd{display:flex;justify-content:space-between;align-items:center}
#moApp button,#moApp select,#moApp input[type=number]{font:inherit;color:inherit;min-height:46px;border-radius:10px;border:1px solid var(--rust);background:var(--panel);padding:0 12px}
#moApp button[aria-pressed=true]{background:var(--rust);border-color:var(--amber);font-weight:800}
#moApp .tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}#moApp .tabs button{padding:0 2px;font-size:14px}
#moApp .card{background:var(--panel);border:1px solid var(--rust);border-radius:12px;padding:10px 12px;display:grid;gap:8px}
#moApp .st{display:flex;justify-content:space-between;align-items:center;gap:8px}
#moApp .big{font-size:24px;font-weight:800}
#moApp .bar{height:8px;border-radius:4px;background:#0006;overflow:hidden}#moApp .bar i{display:block;height:100%;width:0;background:var(--amber)}
#moApp .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}
#moApp .grid b{display:block;font-size:19px}#moApp .grid span{font-size:12px;color:var(--dim)}
#moApp canvas{display:block;width:100%;background:#000;border-radius:8px;image-rendering:pixelated}
#moApp .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#moApp ul{margin:0;padding:0;list-style:none;display:grid;gap:6px;font-size:14px}
#moApp li{display:flex;gap:8px;align-items:flex-start}#moApp li i{font-style:normal;min-width:20px;text-align:center}
#moApp .ok{color:#7fe08a}#moApp .no{color:var(--dim)}#moApp .bad{color:var(--signal)}
#moApp small,#moApp p{color:var(--dim);font-size:13px;line-height:1.9;margin:0}
#moApp details{background:var(--panel);border-radius:10px;padding:2px 12px}#moApp summary{min-height:44px;display:flex;align-items:center;font-weight:700}
#moApp .pane{display:none;gap:10px}#moApp .pane.on{display:grid}
#moApp .vid{position:relative}#moApp .vid canvas{position:static}#moApp #moOv{position:absolute;inset:0;pointer-events:none;background:transparent}
#moToast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#000c;color:var(--bone);padding:8px 14px;border-radius:10px;opacity:0;transition:.2s;z-index:40;pointer-events:none;font-size:14px}
#moToast.on{opacity:1}
`;
document.head.appendChild(css);

const app=document.createElement('div');app.id='moApp';
app.innerHTML=`<div class="in">
 <div class="hd"><h2>پشه‌یاب</h2><button id="moClose">بستن</button></div>
 <div class="tabs" role="tablist">
  <button data-t="live" aria-pressed="true">آنی</button><button data-t="ev" aria-pressed="false">شواهد</button>
  <button data-t="test" aria-pressed="false">آزمون</button><button data-t="help" aria-pressed="false">راهنما</button></div>

 <div class="pane on" data-p="live">
  <div class="card">
   <div class="st"><span class="big" id="moState">آماده</span><span id="moPost">—</span></div>
   <div class="bar"><i id="moBar"></i></div>
   <div class="grid"><div><b id="moF0">—</b><span>بسامد بال‌زدن (هرتز)</span></div><div><b id="moSnr">—</b><span>نسبت سیگنال به نوفه (dB)</span></div><div><b id="moRun">—</b><span>پایداری (ثانیه)</span></div></div>
   <small id="moHint">میکروفون را روشن کنید و گوشی را در اتاق ساکت، نزدیک محل احتمالی پشه بگذارید.</small>
  </div>
  <canvas id="moSpec" width="320" height="150"></canvas>
  <div class="two"><button id="moListen">شروع شنود</button><button id="moCam">ردیاب نوری: خاموش</button></div>
  <div class="card" id="moCamBox" style="display:none"><div class="vid"><canvas id="moVid" width="160" height="120"></canvas><canvas id="moOv" width="160" height="120"></canvas></div>
   <small id="moOpt">گوشی را ثابت و رو به یک سطح روشن و یک‌دست (دیوار، پنجره‌ی پرنور) بگذارید.</small></div>
  <div class="card" id="moSt" style="display:none"><div class="st"><span>جهت‌یابی استریو</span><b id="moBr">—</b></div><small id="moBrN"></small></div>
  <label class="card" id="moSrcBox" style="display:none"><span>منبع میکروفون (اندروید بومی)</span>
   <select id="moSrc"><option value="auto">خودکار (خام ← میکروفون دوربین ← تشخیص گفتار)</option><option value="unprocessed">خام بدون پردازش (UNPROCESSED)</option><option value="camcorder">میکروفون دوربین (اغلب استریو)</option><option value="recognition">تشخیص گفتار (بدون AGC)</option></select>
   <small>اگر استریو «در دسترس نیست» نوشت، «میکروفون دوربین» را امتحان کن و شنود را دوباره شروع کن.</small></label>
  <small id="moDev"></small>
 </div>

 <div class="pane" data-p="ev">
  <div class="card"><b>معیارهای اثبات</b><ul id="moCrit"></ul><small id="moVerdict"></small></div>
  <div class="card"><b>نمونه‌ی شاهد (اتاق بدون پشه)</b>
   <small>۲۰ ثانیه از همان اتاق ضبط می‌شود؛ خطوط ثابت پس‌زمینه (پنکه، همهمه‌ی برق) شناسایی و کنار گذاشته می‌شوند و نرخ آلارم کاذب اندازه‌گیری می‌شود.</small>
   <button id="moCtrl">ثبت نمونه‌ی شاهد</button><small id="moCtrlRes"></small></div>
  <div class="card"><b>قاعده‌های ردّ فعال</b><small id="moWhy">—</small></div>
  <div class="two"><button id="moSave">ذخیره‌ی گزارش</button><button id="moList">گزارش‌های ذخیره‌شده</button></div>
  <div class="card" id="moRep" style="display:none"></div>
  <label class="card"><span>فاصله‌ی دو میکروفون (سانتی‌متر، برای جهت‌یابی)</span><input id="moSp" type="number" min="3" max="30" step="0.5"></label>
 </div>

 <div class="pane" data-p="test">
  <div class="card"><b>آزمون خودکار روی همین دستگاه</b>
   <small>سیگنال‌های ساختگی (پشه، صدای انسان، بوق، آکورد، همهمه، نوفه) به همین الگوریتم داده می‌شود تا درستی کد روی گوشی شما سنجیده شود. این آزمون میکروفون را نمی‌سنجد.</small>
   <button id="moTest">اجرای آزمون</button><ul id="moTestRes"></ul><small id="moTestSum"></small></div>
  <div class="card"><b>نتایج اندازه‌گیری‌شده‌ی توسعه‌دهنده (شبیه‌سازی)</b>
   <small>منفی‌ها: ۴۶ دقیقه صدای غیرپشه (نوفه‌ی سفید/صورتی/قهوه‌ای، همهمه ۵۰ و ۶۰ هرتز، پنکه، بوق، آکورد، آژیر، گفتار بم، ماده و کودک): هیچ «احتمال بالا» یا «تأییدشده‌ای» ثبت نشد.<br>
   مثبت‌ها (۱۶ آزمایش در هر ردیف): نوفه‌ی سفید تا ‎−۶ dB ← ۱۶ از ۱۶. نوفه‌ی صورتی: ‎−۲ dB و بالاتر ۱۶ از ۱۶، ‎−۴ dB ← ۱۲ از ۱۶، ‎−۶ dB ← ۸ از ۱۶. پشه کنار پنکه (با نمونه‌ی شاهد) ← ۸ از ۸. بدون نمونه‌ی شاهد کنار پنکه تشخیص ضعیف است.<br>
   دقت بسامد ≈ ۰٫۱ هرتز؛ جهت‌یابی استریو در SNR صفر ≈ ۰° خطا و تا ≈ ۹° در ‎−۲۰ dB.<br>
   این اعداد روی سیگنال شبیه‌سازی‌شده‌اند، نه ضبط میدانی. با داده‌ی واقعی باید دوباره سنجیده شوند.</small></div>
 </div>

 <div class="pane" data-p="help">
  <details open><summary>این ابزار چه می‌کند؟</summary><p>پشه را نمی‌بیند؛ ردّ فیزیکی‌اش را اندازه می‌گیرد (استنباط غیرمستقیم): بال‌های پشه ۳۰۰ تا ۹۰۰ بار در ثانیه می‌زنند و یک تُن باریک و کمی لرزان با هارمونیک‌های ضعیف می‌سازند. الگوریتم این خط طیفی را از نوفه جدا می‌کند و فقط وقتی هشدار می‌دهد که چند شرط هم‌زمان برقرار باشد.</p></details>
  <details><summary>پنج ردّ و وضعیت هرکدام</summary><p>
   ۱. صدا: اصلی‌ترین کانال؛ کاملاً پیاده‌سازی شده.<br>
   ۲. فاز استریو: اگر گوشی دو میکروفون مجزا بدهد، از اختلاف فاز، زاویه‌ی تقریبی (با ابهام جلو/عقب) برآورد می‌شود. بسیاری از مرورگرها فقط یک کانال می‌دهند و آن‌گاه این بخش خاموش می‌ماند.<br>
   ۳. ردیاب نوری: ذره‌ی ریزِ با مسیر پیچ‌درپیچ جلوی پس‌زمینه‌ی روشن؛ شاهد ضعیف و فقط کمکی.<br>
   ۴. حرکت هوا و ۵. رد حرارتی: گوشی حسگر مناسبی برای این دو ندارد (دوربین گوشی دمای واقعی نمی‌سنجد و حرکت هوای ناشی از یک پشه از حد حسگرهای گوشی کوچک‌تر است)، پس این‌جا ادعا نمی‌شوند.</p></details>
  <details><summary>پروتکل اثبات</summary><p>۱) نمونه‌ی شاهد ۲۰ ثانیه در اتاق بدون پشه. ۲) شنود ادامه یابد. ۳) معیارها: خط باریک ۳۰۰–۹۰۰ هرتز با SNR ≥ ۱۰ dB، پیوستگی ≥ ۴ ثانیه، بدون قاعده‌ی ردّ، نوسان طبیعی (نه تُن الکترونیکی)، و احتمال تصادفی‌بودن کوچک نسبت به شاهد. هرچه معیارهای بیشتری برقرار باشد، شاهد قوی‌تر است.</p></details>
  <details><summary>گونه و جنس</summary><p>بسامد بال‌زدن با گونه، جنس، اندازه‌ی بدن و دما تغییر می‌کند و بازه‌ها هم‌پوشان‌اند. نشانه‌ی «ماده/نر» فقط یک گرایش کلی است و جایگزین شناسایی گونه نیست.</p></details>
  <details><summary>محدودیت‌ها</summary><p>بُرد مؤثر معمولاً چند ده سانتی‌متر تا حدود یک متر در اتاق ساکت است. حذف نوفه، تقویت خودکار یا «بهبود صدا»ی سیستم عامل ممکن است تُن را از بین ببرد. تُن دیگری با همان بسامد (مثلاً بوق) تنها با ویژگی‌های ردّ جدا می‌شود و نه همیشه. این ابزار برای تشخیص بیماری یا اثبات حقوقی نیست.</p></details>
  <details><summary>در بازی</summary><p>همین منطق در بازی «پشه‌ی جهان وارونه» استفاده شده: صدا، سایه، ذرات هوا و ردّ گرمایی، و اطمینان با جمع شدن شواهد بالا می‌رود.</p></details>
 </div>
</div><div id="moToast"></div>`;
document.body.appendChild(app);
const openBtn=document.createElement('button');openBtn.id='bMosq';openBtn.textContent='پشه‌یاب';
const nav=$('.actions');nav.parentNode.insertBefore(openBtn,nav);
let toastT;const toast=t=>{const e=$('#moToast');e.textContent=t;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),2600)};

/* ---------- زیرتب‌ها ---------- */
app.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
  app.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-pressed',x===b));
  app.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.dataset.p===b.dataset.t));
});

/* ---------- وضعیت ---------- */
const S={ac:null,stream:null,an:[],timer:0,det:null,fs:16000,decim:3,stereo:false,ctrlT:0,ctrlLeft:0,
  bearing:null,bearingHist:[],cam:null,camTimer:0,opt:null,optLlr:0,last:null,why:{},fresh:null};
let spacing=14;try{spacing=+(localStorage.getItem('didehban-mosq-sp')||14)||14}catch{}
$('#moSp').value=spacing;$('#moSp').onchange=()=>{spacing=clamp(+$('#moSp').value||14,3,30);try{localStorage.setItem('didehban-mosq-sp',spacing)}catch{}};

/* ---------- صدای بومی اندروید (AudioRecord خام) ---------- */
const nativeAudio=()=>{const C=window.Capacitor;return(C&&C.isNativePlatform&&C.isNativePlatform()&&C.Plugins&&C.Plugins.NativeAudio)||null};
const RMASK=(1<<16)-1;
async function startNative(){
  const na=nativeAudio();if(!na)return false;
  let handle=null,N=null;
  try{
    handle=await na.addListener('pcm',e=>onPcm(e));
    const r=await na.start({sampleRate:48000,stereo:true,source:($('#moSrc')&&$('#moSrc').value)||'auto'});
    const chs=r.channels||1,sr=r.sampleRate||48000;
    N={na,chs,sr,ring:[],total:0,end:0,nextEnd:0,hop:0,seq:-1,lost:0,h:handle,ping:0,srcName:r.source||'?',unprocessed:!!r.unprocessed};
    for(let c=0;c<chs;c++)N.ring.push(new Float32Array(RMASK+1));
    S.nat=N;S.ac={sampleRate:sr,close(){}};            // جایگزین AudioContext؛ بقیه‌ی کد بدون تغییر کار می‌کند
    S.an=N.ring.map(ring=>({fftSize:16384,getFloatTimeDomainData(buf){
      const L=buf.length,e=N.end;for(let i=0;i<L;i++){const k=e-L+i;buf[i]=k>=0?ring[k&RMASK]:0}}}));
    S.decim=Math.max(1,Math.round(sr/16000));S.fs=sr/S.decim;
    S.det=new MC.AcousticDetector({fs:S.fs});S.stereo=false;S.bearingHist=[];S.why={};
    N.hop=S.det.hop*S.decim;N.nextEnd=S.det.n*S.decim;
    N.ping=setInterval(()=>{try{na.ping()}catch{}},1000);  // نگهبان: اگر صفحه متوقف شود، بومی میکروفون را رها می‌کند
    $('#moDev').textContent=`بومی اندروید: ${fa(sr)} هرتز، ${fa(chs)} کانال، منبع ${N.srcName}`+(r.effects?` — ${r.effects}`:'')+(N.unprocessed?'':' — این دستگاه منبع خام ندارد؛ پردازش سیستم ممکن است تُن را بکاهد.');
    return true;
  }catch(e){
    try{handle&&handle.remove()}catch{}
    try{await na.stop()}catch{}
    S.nat=null;toast('میکروفون بومی در دسترس نیست؛ مسیر مرورگر استفاده می‌شود');return false;
  }
}
function onPcm(e){
  const N=S.nat;if(!N||!e||!e.data)return;
  const bin=atob(e.data),nSamp=bin.length>>1,frames=(nSamp/N.chs)|0;
  if(N.seq>=0&&e.seq>N.seq+1){                          // بسته‌ی جاافتاده: با سکوت جبران می‌شود تا خط زمانی بهم نخورد
    const miss=(e.seq-N.seq-1)*frames;N.lost+=e.seq-N.seq-1;
    for(let f=0;f<miss;f++)for(let c=0;c<N.chs;c++)N.ring[c][(N.total+f)&RMASK]=0;N.total+=miss;
  }
  N.seq=e.seq;
  for(let f=0;f<frames;f++)for(let c=0;c<N.chs;c++){
    const j=(f*N.chs+c)*2;let v=bin.charCodeAt(j)|(bin.charCodeAt(j+1)<<8);if(v>32767)v-=65536;
    N.ring[c][(N.total+f)&RMASK]=v/32768;
  }
  N.total+=frames;
  while(S.nat===N&&N.total>=N.nextEnd){                 // هر hop دقیقاً یک بار، مستقل از اندازه‌ی بسته و تأخیر تایمر
    N.end=N.nextEnd;N.nextEnd+=N.hop;
    try{step()}catch(err){if(window.__dbg)console.error(err)}
  }
}
function stopNative(){
  const N=S.nat;if(!N)return;S.nat=null;clearInterval(N.ping);
  try{N.h&&N.h.remove()}catch{}
  try{const p=N.na.stop();p&&p.catch&&p.catch(()=>{})}catch{}
}
async function saveFile(name,text){
  const C=window.Capacitor;
  if(C&&C.isNativePlatform&&C.isNativePlatform()&&C.Plugins&&C.Plugins.Filesystem&&C.Plugins.Share){
    try{const f=await C.Plugins.Filesystem.writeFile({path:name,data:text,directory:'CACHE',encoding:'utf8'});await C.Plugins.Share.share({title:name,files:[f.uri]});return true}catch{}
  }
  try{const b=new Blob([text],{type:'application/json'}),u=URL.createObjectURL(b),l=document.createElement('a');
    l.href=u;l.download=name;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);return true}catch{return false}
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- صدا ---------- */
async function startListen(){
  if(window.__dh&&window.__dh.running())window.__dh.stop();
  if(nativeAudio()&&await startNative())return true;     // اندروید بومی؛ در صورت شکست، همان مسیر مرورگر
  try{
    S.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:2}},video:false});
  }catch(e){toast('دسترسی میکروفون داده نشد');return false}
  const AC=window.AudioContext||window.webkitAudioContext;S.ac=new AC();try{await S.ac.resume()}catch{}
  const trk=S.stream.getAudioTracks()[0],set=trk.getSettings?trk.getSettings():{};
  const src=S.ac.createMediaStreamSource(S.stream);S.an=[];
  const two=(set.channelCount||src.channelCount||1)>=2;
  if(two){const sp=S.ac.createChannelSplitter(2);src.connect(sp);for(let c=0;c<2;c++){const a=S.ac.createAnalyser();a.fftSize=16384;a.smoothingTimeConstant=0;sp.connect(a,c);S.an.push(a)}}
  else{const a=S.ac.createAnalyser();a.fftSize=16384;a.smoothingTimeConstant=0;src.connect(a);S.an.push(a)}
  S.decim=Math.max(1,Math.round(S.ac.sampleRate/16000));S.fs=S.ac.sampleRate/S.decim;
  S.det=new MC.AcousticDetector({fs:S.fs});S.stereo=false;S.bearingHist=[];S.why={};
  const proc=[set.echoCancellation&&'حذف پژواک',set.noiseSuppression&&'حذف نوفه',set.autoGainControl&&'تقویت خودکار'].filter(Boolean);
  $('#moDev').textContent=`نمونه‌برداری ${fa(S.ac.sampleRate)} هرتز، ${fa(S.an.length)} کانال`+(proc.length?` — هشدار: سیستم هنوز ${proc.join('، ')} را روشن نگه داشته؛ ممکن است تُن پشه را بکاهد.`:'');
  loop();return true;
}
function stopListen(){
  clearTimeout(S.timer);S.timer=0;stopNative();
  if(S.stream)S.stream.getTracks().forEach(t=>t.stop());S.stream=null;
  if(S.ac)try{S.ac.close()}catch{};S.ac=null;S.an=[];
}
function grab(i){
  const a=S.an[i],n=S.det.n*S.decim,buf=new Float32Array(a.fftSize);a.getFloatTimeDomainData(buf);
  return MC.decimate(buf.subarray(buf.length-n),S.decim);
}
function loop(){
  if(!S.ac)return;
  try{step()}catch(e){if(window.__dbg)console.error(e)}
  S.timer=setTimeout(loop,S.det.dt*1000);
}
function step(){
  const x0=grab(0);let x=x0;
  const res=S.det.push(x0);S.last=res;
  for(const w of res.rec.why)S.why[w]=(S.why[w]||0)+1;
  // استریو: فقط اگر دو کانال واقعاً متفاوت باشند
  if(S.an.length===2){
    const x1=grab(1);let diff=0,e=0;for(let i=0;i<x0.length;i+=7){diff+=Math.abs(x0[i]-x1[i]);e+=Math.abs(x0[i])}
    S.stereo=e>1e-6&&diff/e>.02;
    if(S.stereo&&res.rec.snr>=10&&ORDER[res.state]>=1){
      const b=MC.phaseBearing(x0,x1,S.fs,res.rec.f0,spacing/100);
      if(b&&b.coh>.6){S.bearingHist.push(b.theta);if(S.bearingHist.length>12)S.bearingHist.shift();S.bearing=b}
    }
  }
  drawSpec(res);render(res);
}

/* ---------- طیف‌نگار ---------- */
const spec=$('#moSpec'),sctx=spec.getContext('2d'),F_LO=200,F_HI=1100;sctx.fillStyle='#000';sctx.fillRect(0,0,spec.width,spec.height);
function drawSpec(res){
  const det=S.det,W=spec.width,H=spec.height;sctx.drawImage(spec,-1,0);
  const col=sctx.createImageData(1,H),R=det.R,mk=det.mask;
  for(let y=0;y<H;y++){
    const f=F_HI-y/(H-1)*(F_HI-F_LO),k=Math.round(f/det.df),db=clamp(10*Math.log10(R[k]+1e-9),0,22)/22;
    const o=y*4;let r=db*255*1.2,g=db*db*220,b=60*db;
    if(mk&&mk[k]){r*=.35;g*=.35;b=90+b}
    col.data[o]=clamp(r,0,255);col.data[o+1]=clamp(g,0,255);col.data[o+2]=clamp(b,0,255);col.data[o+3]=255;
  }
  const r=res.rec;if(r.tonal&&r.f0>=F_LO&&r.f0<=F_HI){const y=Math.round((F_HI-r.f0)/(F_HI-F_LO)*(H-1));col.data[y*4]=80;col.data[y*4+1]=255;col.data[y*4+2]=255}
  sctx.putImageData(col,W-1,0);
}

/* ---------- نمایش ---------- */
function criteria(res){
  const r=res.rec,det=S.det,list=[];
  const inBand=r.f0>=300&&r.f0<=900;
  list.push(['خط طیفی باریک در ۳۰۰–۹۰۰ هرتز با SNR ≥ ۱۰ dB',inBand&&r.snr>=10,`${fa(r.f0)} هرتز، ${fa(r.snr,1)} dB`]);
  list.push(['پیوستگی زمانی ≥ ۴ ثانیه',res.run*det.dt>=4,fa(res.run*det.dt,1)+' ثانیه']);
  list.push(['بدون قاعده‌ی ردّ (زیرهارمونیک، چند تُن، گفتار/ساز)',r.why.length===0&&r.tonal,r.why[0]||'']);
  list.push(['نوسان طبیعی (نه تُن الکترونیکی، نه ناپایدار)',res.sd!==null&&!res.pure&&res.sd<=30,res.sd===null?'داده‌ی کافی نیست':`σ ≈ ${fa(res.sd,1)} هرتز`]);
  let nullOk=null,nullTxt='نمونه‌ی شاهد ثبت نشده';
  if(det.null){const p=det.runP(res.run);nullOk=p<1e-6;nullTxt=`احتمال تصادفی بودن ≈ ${p<1e-11?'<۱۰⁻¹۱':p.toExponential(1).replace(/\d/g,x=>'۰۱۲۳۴۵۶۷۸۹'[x])}`}
  list.push(['احتمال تصادف نسبت به نمونه‌ی شاهد < ۱۰⁻⁶',nullOk===null?null:nullOk&&res.run>=8,nullTxt]);
  list.push(['هم‌فازی استریو (اختیاری)',S.stereo?(S.bearing&&S.bearing.coh>.7):null,S.stereo&&S.bearing?`${fa(S.bearing.theta)}° ، همدوسی ${fa(S.bearing.coh,2)}`:S.stereo?'—':'استریو در دسترس نیست']);
  list.push(['ردیاب نوری (اختیاری)',S.cam?S.optLlr>=4:null,S.cam?`LLR ${fa(S.optLlr,1)}`:'خاموش']);
  return list;
}
function render(res){
  const r=res.rec;let fused=MC.fuse(res,S.cam?S.optLlr:0);
  const st=fused.state;S.fresh={res,fused};
  const e=$('#moState');e.textContent=MC.STATE_FA[st];e.style.color=STATE_COLOR[st];
  $('#moPost').textContent='احتمال '+fa(fused.post*100)+'٪';
  $('#moBar').style.width=clamp(res.llr/34*100,0,100)+'%';$('#moBar').style.background=STATE_COLOR[st];
  $('#moF0').textContent=r.tonal?fa(r.f0):'—';$('#moSnr').textContent=fa(r.snr,1);$('#moRun').textContent=fa(res.run*S.det.dt,1);
  $('#moHint').textContent=r.tonal?res.hint+(r.why.length?' — ردّ: '+r.why[0]:''):'تُن مشخصی در بازه‌ی ۲۵۰–۱۰۰۰ هرتز دیده نمی‌شود.';
  if(S.stereo){$('#moSt').style.display='';
    const m=S.bearingHist.slice().sort((a,b)=>a-b)[S.bearingHist.length>>1];
    $('#moBr').textContent=S.bearing&&m!==undefined?fa(m)+'°':'—';
    $('#moBrN').textContent=`زاویه نسبت به محور میکروفون‌ها، با ابهام جلو/عقب، با فرض فاصله‌ی ${fa(spacing,1)} سانتی‌متر.`}
  else $('#moSt').style.display='none';
  // تب شواهد
  const crit=criteria(res);let okN=0,app_=0;
  $('#moCrit').innerHTML=crit.map(([t,v,d])=>{if(v!==null){app_++;if(v)okN++}
    return`<li><i class="${v===null?'no':v?'ok':'bad'}">${v===null?'—':v?'✓':'✗'}</i><span>${t}<br><small>${d}</small></span></li>`}).join('');
  $('#moVerdict').textContent=`${fa(okN)} معیار از ${fa(app_)} معیار قابل‌اعمال برقرار است. وضعیت: ${MC.STATE_FA[st]}.`;
  const why=Object.entries(S.why).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>k+' ('+fa(v)+' فریم)').join('\n');
  $('#moWhy').style.whiteSpace='pre-line';$('#moWhy').textContent=why||'تاکنون قاعده‌ای فعال نشده است.';
  if(ORDER[st]>=2&&!S._alerted){S._alerted=true;if(navigator.vibrate)navigator.vibrate([200,100,200])}
  if(ORDER[st]<2)S._alerted=false;
}

/* ---------- نمونه‌ی شاهد ---------- */
$('#moCtrl').onclick=()=>{
  if(!S.det){toast('ابتدا شنود را شروع کنید');return}
  if(S.ctrlLeft>0)return;
  S.det.controlBegin();S.ctrlLeft=20;$('#moCtrl').disabled=true;
  const tm=setInterval(()=>{
    S.ctrlLeft--;$('#moCtrl').textContent='در حال ضبط شاهد… '+fa(S.ctrlLeft);
    if(S.ctrlLeft<=0||!S.det){clearInterval(tm);S.ctrlLeft=0;$('#moCtrl').disabled=false;$('#moCtrl').textContent='ثبت نمونه‌ی شاهد';
      if(!S.det)return;const nl=S.det.controlEnd();S.det.resetTrack();S.why={};
      $('#moCtrlRes').textContent=nl?`${fa(nl.N)} فریم؛ نرخ عبور تصادفی از دروازه ${fa(nl.pc*100,1)}٪؛ خطوط ثابت پس‌زمینه: ${nl.lines.length?nl.lines.map(fa).join('، ')+' هرتز':'ندارد'}.`:'داده‌ی کافی نبود.';
      toast('نمونه‌ی شاهد ثبت شد')}
  },1000);
  $('#moCtrl').textContent='در حال ضبط شاهد… ۲۰';toast('تا پایان ضبط، پشه را از اتاق دور نگه دارید');
};

/* ---------- ردیاب نوری ---------- */
async function startCam(){
  try{S.cam=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:320},height:{ideal:240},frameRate:{ideal:15}},audio:false})}
  catch(e){toast('دسترسی دوربین داده نشد');S.cam=null;return false}
  const v=document.createElement('video');v.muted=true;v.playsInline=true;v.srcObject=S.cam;await v.play().catch(()=>{});S.vid=v;
  S.opt=new MC.OpticalTracker(160,120,{fps:15});S.optLlr=0;$('#moCamBox').style.display='';
  const c=$('#moVid').getContext('2d',{willReadFrequently:true}),ov=$('#moOv').getContext('2d'),L=new Float32Array(160*120);
  S.camTimer=setInterval(()=>{
    c.drawImage(v,0,0,160,120);const d=c.getImageData(0,0,160,120).data;
    for(let i=0,j=0;i<L.length;i++,j+=4)L[i]=.299*d[j]+.587*d[j+1]+.114*d[j+2];
    const o=S.opt.update(L,1/15);S.optLlr=S.opt.llr;ov.clearRect(0,0,160,120);
    ov.strokeStyle='#ff3b2e';ov.lineWidth=1.5;
    for(const t of o.tracks)ov.strokeRect(t.cx-6,t.cy-6,12,12);
    $('#moOpt').textContent=o.shake?'لرزش دوربین: گوشی را ثابت کنید.':(o.tracks.length?'ذره‌ی ریز با پرواز آشفته دیده شد.':'ردّ پروازی دیده نمی‌شود.')+` شاهد نوری: ${fa(S.optLlr,1)}`;
  },66);
  return true;
}
function stopCam(){clearInterval(S.camTimer);if(S.cam)S.cam.getTracks().forEach(t=>t.stop());S.cam=null;S.opt=null;$('#moCamBox').style.display='none'}

/* ---------- گزارش ---------- */
function makeReport(){
  if(!S.fresh)return null;const{res,fused}=S.fresh,det=S.det,recent=det.rec.slice(-Math.round(2/det.dt)).map(x=>x.f0).sort((a,b)=>a-b);
  return{when:new Date().toISOString(),state:fused.state,posterior:+fused.post.toFixed(4),llr:+fused.llr.toFixed(2),
    f0Hz:+(recent[recent.length>>1]||res.rec.f0).toFixed(2),snrDb:+res.rec.snr.toFixed(1),sustainedSec:+(res.run*det.dt).toFixed(1),
    f0SdHz:res.sd===null?null:+res.sd.toFixed(2),hint:res.hint,control:det.null?{frames:det.null.N,gatePassRate:+det.null.pc.toFixed(4),lines:det.null.lines,runP:det.runP(res.run)}:null,
    vetoCounts:S.why,stereo:S.stereo&&S.bearing?{thetaDeg:+S.bearing.theta.toFixed(1),coherence:+S.bearing.coh.toFixed(2),spacingCm:spacing}:null,
    opticalLlr:S.cam?+S.optLlr.toFixed(2):null,criteria:criteria(res).map(([t,v,d])=>({t,ok:v,d})),
    method:{fsHz:S.fs,fft:det.n,band:[det.fMin,det.fMax],note:'استنباط غیرمستقیم؛ نه شناسایی گونه',
      capture:S.nat?{native:true,sampleRateHz:S.nat.sr,channels:S.nat.chs,source:S.nat.srcName,unprocessed:S.nat.unprocessed,lostChunks:S.nat.lost}:{native:false}}};
}
const KEY='didehban-mosq';
const loadReps=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
$('#moSave').onclick=()=>{
  const r=makeReport();if(!r){toast('هنوز داده‌ای نیست');return}
  const a=loadReps();a.unshift(r);try{localStorage.setItem(KEY,JSON.stringify(a.slice(0,20)))}catch{}
  saveFile('mosquito-report-'+Date.now()+'.json',JSON.stringify(r,null,2));
  toast('گزارش ذخیره شد');
};
$('#moList').onclick=()=>{
  const box=$('#moRep'),a=loadReps();box.style.display=box.style.display==='none'?'':'none';
  box.innerHTML=a.length?a.map(r=>`<div><b>${esc(MC.STATE_FA[r.state]||r.state)}</b> — ${fa(r.f0Hz)} هرتز، ${fa(r.snrDb,1)} dB، ${fa(r.sustainedSec,1)} ثانیه<br><small>${new Date(r.when).toLocaleString('fa-IR')}</small></div>`).join(''):'<small>گزارشی ذخیره نشده است.</small>';
};

/* ---------- آزمون خودکار ---------- */
$('#moTest').onclick=async()=>{
  const b=$('#moTest');b.disabled=true;const ul=$('#moTestRes');ul.innerHTML='';$('#moTestSum').textContent='';
  const FS=16000,Sy=MC.Synth,D=20,pk=r=>Sy.pink(FS,D,r);
  const sc=[
   ['پشه ۴۸۰ هرتز روی نوفه‌ی صورتی (SNR صفر)',true,r=>Sy.mix(Sy.mosquito(FS,D,{f0:480},r),pk(r),FS,0)],
   ['پشه ۶۵۰ هرتز (SNR ‎−۴)',true,r=>Sy.mix(Sy.mosquito(FS,D,{f0:650},r),Sy.white(FS,D,r),FS,-4)],
   ['پشه ۴۲۰ هرتز کنار پنکه (با نمونه‌ی شاهد)',true,r=>Sy.mix(Sy.mosquito(FS,D,{f0:420},r),Sy.fan(FS,D,r),FS,5),'fan'],
   ['گفتار بم',false,r=>Sy.mix(Sy.speech(FS,D,{f0:110},r),pk(r),FS,12)],
   ['صدای کودک',false,r=>Sy.mix(Sy.speech(FS,D,{f0:330},r),pk(r),FS,12)],
   ['بوق خالص ۵۰۰ هرتز',false,r=>Sy.mix(Sy.tone(FS,D,500,r),pk(r),FS,10)],
   ['آکورد',false,r=>Sy.mix(Sy.chord(FS,D,[440,554.4,659.3],r),pk(r),FS,10)],
   ['همهمه‌ی برق ۵۰ هرتز',false,r=>Sy.mix(Sy.hum(FS,D,{f:50},r),pk(r),FS,10)],
   ['نوفه‌ی صورتی',false,r=>pk(r)]];
  let pass=0;
  for(let i=0;i<sc.length;i++){
    const[name,pos,gen,ctl]=sc[i],li=document.createElement('li');li.innerHTML='<i class="no">…</i><span>'+name+'</span>';ul.appendChild(li);
    await new Promise(r=>setTimeout(r,30));
    const det=new MC.AcousticDetector({fs:FS});
    if(ctl){const cx=Sy.fan(FS,D,Sy.rng(777));det.controlBegin();for(let o=0;o+det.n<=cx.length;o+=det.hop)det.push(cx.subarray(o,o+det.n));det.controlEnd();det.resetTrack()}
    const x=gen(Sy.rng(11+i));let mx=0,t=null;
    for(let o=0;o+det.n<=x.length;o+=det.hop){const r=det.push(x.subarray(o,o+det.n));if(ORDER[r.state]>mx)mx=ORDER[r.state];if(ORDER[r.state]>=2&&t===null)t=r.t}
    const ok=pos?mx>=2:mx<2;if(ok)pass++;
    li.innerHTML=`<i class="${ok?'ok':'bad'}">${ok?'✓':'✗'}</i><span>${name}<br><small>${pos?(t===null?'شناسایی نشد':'شناسایی در '+fa(t,1)+' ثانیه'):(mx>=2?'هشدار کاذب':'هشداری داده نشد')}</small></span>`;
  }
  $('#moTestSum').textContent=`${fa(pass)} از ${fa(sc.length)} آزمون درست بود.`;b.disabled=false;
};

/* ---------- باز و بسته ---------- */
$('#moListen').onclick=async()=>{
  if(S.ac){stopListen();$('#moListen').textContent='شروع شنود';return}
  if(await startListen())$('#moListen').textContent='توقف شنود';
};
$('#moCam').onclick=async()=>{
  if(S.cam){stopCam();$('#moCam').textContent='ردیاب نوری: خاموش';return}
  if(await startCam())$('#moCam').textContent='ردیاب نوری: روشن';
};
function open(){if(window.__dh&&window.__dh.running())window.__dh.stop();$('#moSrcBox').style.display=nativeAudio()?'':'none';app.classList.add('on')}
function close(){stopListen();stopCam();$('#moListen').textContent='شروع شنود';$('#moCam').textContent='ردیاب نوری: خاموش';app.classList.remove('on')}
if(window.__dbg)window.__mo={S,step,render,criteria,makeReport,onPcm,startNative,stopListen,startListen};
openBtn.onclick=open;$('#moClose').onclick=close;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&app.classList.contains('on')){stopListen();stopCam();$('#moListen').textContent='شروع شنود';$('#moCam').textContent='ردیاب نوری: خاموش'}});
})();
