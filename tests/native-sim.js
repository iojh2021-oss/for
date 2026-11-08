// آزمون مسیر بومی اندروید: افزونه‌ی NativeAudio ساختگی، بسته‌های PCM ۱۶بیتی درهم‌آمیخته‌ی Base64، اجرای واقعی mosquito.js
const MC=require('../mosquito-core.js');global.window=global;window.MosquitoCore=MC;window.__dbg=true;
const els={},log=[];
function mk(tag){const e={tag,style:{},children:[],_html:'',_text:'',classList:{s:new Set(),add(c){this.s.add(c)},remove(c){this.s.delete(c)},toggle(c,f){f?this.s.add(c):this.s.delete(c)},contains(c){return this.s.has(c)}},
  appendChild(c){this.children.push(c);return c},setAttribute(){},addEventListener(){},querySelectorAll(){return[]},querySelector(sel){return q(sel)},
  insertBefore(c){return c},get parentNode(){return e},width:320,height:150,value:'auto',dataset:{},disabled:false,
  getContext(){return{drawImage(){},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}},putImageData(){},fillRect(){},getImageData(w,h){return{data:new Uint8ClampedArray(160*120*4)}},clearRect(){},strokeRect(){},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){}}}};
  Object.defineProperty(e,'innerHTML',{get(){return this._html},set(v){this._html=v}});
  Object.defineProperty(e,'textContent',{get(){return this._text},set(v){this._text=v}});return e}
function q(sel){return els[sel]||(els[sel]=mk('x'))}
global.document={createElement:mk,head:{appendChild(){}},body:{appendChild(){}},querySelector:q,querySelectorAll(){return[]},addEventListener(){},hidden:false};
global.localStorage={getItem(){return null},setItem(){}};Object.defineProperty(global,'navigator',{configurable:true,value:{vibrate(){}}});

// ---- افزونه‌ی ساختگی
const handlers={},calls=[];let CH=2,FAIL=false;
const na={
  addListener(ev,cb){handlers[ev]=cb;return Promise.resolve({remove(){calls.push('remove:'+ev);delete handlers[ev]}})},
  start(o){calls.push('start:'+JSON.stringify(o));if(FAIL)return Promise.reject(new Error('x'));return Promise.resolve({sampleRate:48000,channels:CH,source:'UNPROCESSED',unprocessed:true,effects:'AGC خاموش'})},
  stop(){calls.push('stop');return Promise.resolve()},
  ping(){calls.push('ping');return Promise.resolve()}
};
global.Capacitor={isNativePlatform:()=>true,Plugins:{NativeAudio:na}};
require('../mosquito.js');
const mo=window.__mo,S=mo.S,Sy=MC.Synth,FS=48000;

function toChunks(chans,sizes){ // chans: Float32Array[] → رشته‌ی بسته‌ها
  const n=chans[0].length,out=[];let mx=0;for(const c of chans)for(let i=0;i<n;i+=11)mx=Math.max(mx,Math.abs(c[i]));
  const g=.3*32767/mx;let pos=0,seq=0,k=0;
  while(pos<n){
    const f=Math.min(sizes(k++),n-pos),buf=new Int16Array(f*chans.length);
    for(let i=0;i<f;i++)for(let c=0;c<chans.length;c++)buf[i*chans.length+c]=Math.round(chans[c][pos+i]*g);
    out.push({seq:seq++,n:buf.length,data:Buffer.from(buf.buffer).toString('base64')});pos+=f;
  }
  return out;
}
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++};
(async()=>{
  // ===== ۱) استریو ۴۸kHz با تأخیر دو کانال ≈ ۲۵°
  const DUR=25,m=Sy.mix(Sy.mosquito(FS,DUR,{f0:520},Sy.rng(9)),Sy.pink(FS,DUR,Sy.rng(10)),FS,5);
  const d=Math.round(.14*Math.sin(25*Math.PI/180)/343*FS),A=Float32Array.from(m),B=new Float32Array(m.length);
  for(let i=0;i<m.length;i++)B[i]=m[Math.max(0,i-d)];
  ok(await els['#moListen'].onclick()===undefined,'شروع شنود از دکمه');
  ok(!!S.nat&&S.nat.chs===2&&S.ac.sampleRate===48000,'مسیر بومی فعال شد (۲ کانال، ۴۸ کیلوهرتز)');
  ok(calls[0]==='remove:pcm'?false:calls.some(c=>c.startsWith('start:')&&c.includes('"stereo":true')),'درخواست استریو به افزونه رفت');
  let steps=0;const origPush=S.det.push.bind(S.det);S.det.push=x=>{steps++;return origPush(x)};
  const chunks=toChunks([A,B],()=>2048);
  for(const c of chunks)handlers.pcm(c);
  let rep=mo.makeReport();
  console.log('   state',rep.state,'f0',rep.f0Hz,'snr',rep.snrDb,'run',rep.sustainedSec,'s  bearing',rep.stereo&&rep.stereo.thetaDeg,'coh',rep.stereo&&rep.stereo.coherence,'capture',JSON.stringify(rep.method.capture));
  ok(rep.state==='confirmed'||rep.state==='multi','وضعیت «تأییدشده»');
  ok(Math.abs(rep.f0Hz-520)<1.5,'بسامد ≈ ۵۲۰ هرتز');
  ok(rep.stereo&&Math.abs(rep.stereo.thetaDeg-25)<4,'جهت استریو ≈ ۲۵° (۴ درجه تحمل)');
  const need=S.det.n*S.decim,hop=S.det.hop*S.decim,total=A.length,exp=Math.floor((total-need)/hop)+1;
  ok(steps===exp,`تعداد گام‌ها دقیقاً ${exp} است (به‌دست‌آمده ${steps}) — قاب‌بندی برحسب نمونه`);
  ok(rep.method.capture.native===true&&rep.method.capture.lostChunks===0,'گزارش، مشخصات ضبط بومی را دارد و بسته‌ای جا نیفتاده');

  // ===== ۲) توقف: ping، شنونده و میکروفون آزاد می‌شوند
  await els['#moListen'].onclick();
  ok(S.nat===null&&calls.includes('stop')&&calls.includes('remove:pcm')&&!handlers.pcm,'توقف: stop بومی، حذف شنونده و پاک شدن S.nat');
  const pingsBefore=calls.filter(c=>c==='ping').length;await new Promise(r=>setTimeout(r,1300));
  ok(calls.filter(c=>c==='ping').length===pingsBefore,'بعد از توقف، دیگر ping ارسال نمی‌شود');

  // ===== ۳) تک‌کانال با اندازه‌ی بسته‌ی نامنظم
  CH=1;calls.length=0;await els['#moListen'].onclick();
  ok(S.nat&&S.nat.chs===1&&S.an.length===1,'تک‌کانال: یک تحلیل‌گر');
  steps=0;const o2=S.det.push.bind(S.det);S.det.push=x=>{steps++;return o2(x)};
  const m2=Sy.mix(Sy.mosquito(FS,DUR,{f0:430},Sy.rng(21)),Sy.pink(FS,DUR,Sy.rng(22)),FS,3);
  let rr=12345;const rnd=()=>{rr=(rr*1103515245+12345)&0x7fffffff;return rr/0x7fffffff};
  for(const c of toChunks([Float32Array.from(m2)],()=>512+Math.floor(rnd()*3500)))handlers.pcm(c);
  rep=mo.makeReport();
  console.log('   state',rep.state,'f0',rep.f0Hz,'snr',rep.snrDb);
  ok(rep.state==='confirmed'||rep.state==='multi','بسته‌های نامنظم: «تأییدشده»');
  const xo=MC.decimate(Float32Array.from(m2),3),dto=new MC.AcousticDetector({fs:16000});
  for(let o=0;o+dto.n<=xo.length;o+=dto.hop)dto.push(xo.subarray(o,o+dto.n));
  const fo=dto.rec.slice(-Math.round(2/dto.dt)).map(r=>r.f0).sort((x,y)=>x-y),f0off=fo[fo.length>>1];
  ok(Math.abs(rep.f0Hz-f0off)<0.05,`بسامد مسیر بومی با آشکارساز آفلاین یکی است (${rep.f0Hz} در برابر ${f0off.toFixed(2)})`);
  ok(Math.abs(rep.f0Hz-430)<3,'بسامد در ۳ هرتز از مقدار واقعی ۴۳۰ (خطای معمول برآوردگر در نوفه)');
  ok(steps===Math.floor((m2.length-need)/hop)+1,'تعداد گام‌ها مستقل از اندازه‌ی بسته');
  ok(S.stereo===false,'تک‌کانال: استریو خاموش');

  // ===== ۴) بسته‌ی جاافتاده: خط زمانی با سکوت جبران می‌شود و خطایی نیست
  const before=S.nat.total;const ch=toChunks([Float32Array.from(m2.subarray(0,48000))],()=>2048);
  handlers.pcm(ch[0]);handlers.pcm(ch[2]); // ch[1] گم شد
  ok(S.nat.lost===1&&S.nat.total-before===3*2048,'یک بسته‌ی گم‌شده شمرده و با سکوت جبران شد');
  await els['#moListen'].onclick();

  // ===== ۵) شکست افزونه: بازگشت به مسیر مرورگر بدون خطا
  FAIL=true;calls.length=0;await els['#moListen'].onclick();
  ok(S.nat===null&&!handlers.pcm,'شکست start: بدون S.nat و شنونده‌ی باقی‌مانده');
  console.log(fails?`\n${fails} آزمون ناموفق`:'\nهمه‌ی آزمون‌های مسیر بومی درست بود');process.exit(fails?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(1)});
