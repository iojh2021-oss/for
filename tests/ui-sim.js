// اجرای واقعی mosquito.js روی یک DOM ساختگی، با جریان صدای 48kHz ساختگی از مسیر دقیق برنامه
const MC=require('../mosquito-core.js');global.window=global;window.MosquitoCore=MC;window.__dbg=true;
const els={},log=[];
function mk(tag){const e={tag,style:{},children:[],_html:'',_text:'',classList:{s:new Set(),add(c){this.s.add(c)},remove(c){this.s.delete(c)},toggle(c,f){f?this.s.add(c):this.s.delete(c)},contains(c){return this.s.has(c)}},
  appendChild(c){this.children.push(c);return c},setAttribute(){},addEventListener(){},querySelectorAll(){return[]},querySelector(sel){return q(sel)},
  insertBefore(c){return c},get parentNode(){return e},width:320,height:150,value:'14',dataset:{},disabled:false,
  getContext(){return{drawImage(){},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}},putImageData(){},fillRect(){},getImageData(w,h){return{data:new Uint8ClampedArray(160*120*4)}},clearRect(){},strokeRect(){},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){}}}};
  Object.defineProperty(e,'innerHTML',{get(){return this._html},set(v){this._html=v;if(tag==='li')log.push(v.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}});
  Object.defineProperty(e,'textContent',{get(){return this._text},set(v){this._text=v}});return e}
function q(sel){const k=sel;return els[k]||(els[k]=mk('x'))}
global.document={createElement:mk,head:{appendChild(){}},body:{appendChild(){}},querySelector:q,querySelectorAll(){return[]},addEventListener(){},hidden:false};
global.localStorage={getItem(){return null},setItem(){}};global.navigator={vibrate(){}};global.setTimeout=setTimeout;
require('../mosquito.js');
(async()=>{
  // 1) آزمون خودکار داخل برنامه
  const t0=Date.now();await els['#moTest'].onclick();
  console.log('--- self-test in UI code ('+((Date.now()-t0)/1000).toFixed(1)+' s) ---');log.filter(l=>l.startsWith('✓')||l.startsWith('✗')||l.includes('شناسایی')).forEach(l=>console.log(l));
  console.log(els['#moTestSum']._text);
  // 2) مسیر زنده با جریان ۴۸kHz: grab → decimate → push → render
  const mo=window.__mo,S=mo.S,FS=48000,Sy=MC.Synth,r=Sy.rng(5),DUR=25;
  const sig=Sy.mix(Sy.mosquito(FS,DUR,{f0:520},r),Sy.pink(FS,DUR,r),FS,0);
  let pos=16384;S.ac={sampleRate:48000};S.decim=3;S.fs=16000;S.stereo=false;S.cam=null;
  S.det=new MC.AcousticDetector({fs:16000});
  S.an=[{fftSize:16384,getFloatTimeDomainData(b){b.set(sig.subarray(pos-16384,pos))}}];
  let last;const hop=S.det.n/2*S.decim;
  for(;pos+hop<sig.length;pos+=hop){mo.step()}
  const rep=mo.makeReport();
  console.log('\n--- live path (48 kHz -> decimate x3 -> detector -> UI render) ---');
  console.log('state:',rep.state,' f0:',rep.f0Hz,'Hz (true 520) snr:',rep.snrDb,'dB sustained:',rep.sustainedSec,'s posterior:',rep.posterior);
  console.log('criteria:',rep.criteria.map(c=>(c.ok===null?'—':c.ok?'✓':'✗')).join(' '));
  console.log('UI state text:',els['#moState']._text,'| f0 text:',els['#moF0']._text);
  // 3) استریو ساختگی با کانال‌های متفاوت
  const [a,b]=Sy.stereoDelay(FS,25,520,25,.14,Sy.rng(8),-30);const m=Sy.mix(Sy.mosquito(FS,25,{f0:520},Sy.rng(9)),Sy.pink(FS,25,Sy.rng(10)),FS,5);
  const A=new Float32Array(m.length),Bc=new Float32Array(m.length);const tau=.14*Math.sin(25*Math.PI/180)/343,d=Math.round(tau*FS);
  for(let i=0;i<m.length;i++){A[i]=m[i];Bc[i]=m[Math.max(0,i-d)]}
  pos=16384;S.an=[{fftSize:16384,getFloatTimeDomainData(bb){bb.set(A.subarray(pos-16384,pos))}},{fftSize:16384,getFloatTimeDomainData(bb){bb.set(Bc.subarray(pos-16384,pos))}}];
  S.det=new MC.AcousticDetector({fs:16000});S.bearingHist=[];
  for(;pos+hop<A.length;pos+=hop)mo.step();
  console.log('\n--- stereo path --- stereo detected:',S.stereo,' bearing est:',S.bearing?S.bearing.theta.toFixed(1)+'° (applied delay ~25° at 3-sample resolution)':'none','coh',S.bearing&&S.bearing.coh.toFixed(2));
})();
