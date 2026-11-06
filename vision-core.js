/* هسته‌ی بینایی شب: پالت‌های رنگی، تقویت تصویر، تشخیص حرکت و سایه، ردیاب (بدون وابستگی به مرورگر) */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.VisionCore=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const clamp=(x,a,b)=>x<a?a:x>b?b:x;

/* ---------- پالت‌ها ---------- */
function makeLut(stops){
  const out=new Uint8ClampedArray(768);
  for(let i=0;i<256;i++){
    const t=i/255;let k=0;while(k<stops.length-2&&t>stops[k+1][0])k++;
    const a=stops[k],b=stops[k+1],f=clamp((t-a[0])/(b[0]-a[0]||1),0,1);
    for(let c=0;c<3;c++)out[i*3+c]=a[1][c]+(b[1][c]-a[1][c])*f;
  }
  return out;
}
const PALETTES=[
  {id:'color',name:'رنگی (عادی)',lut:null},
  {id:'white',name:'سفید-داغ',lut:makeLut([[0,[0,0,0]],[1,[255,255,255]]])},
  {id:'black',name:'سیاه-داغ',lut:makeLut([[0,[255,255,255]],[1,[0,0,0]]])},
  {id:'green',name:'دید شب سبز',lut:makeLut([[0,[0,4,0]],[.5,[10,140,30]],[1,[190,255,190]]])},
  {id:'red',name:'دید شب قرمز',lut:makeLut([[0,[0,0,0]],[.5,[140,0,0]],[1,[255,120,100]]])},
  {id:'amber',name:'کهربایی',lut:makeLut([[0,[10,4,0]],[.5,[150,80,0]],[1,[255,220,140]]])},
  {id:'purple',name:'حرارتی بنفش',lut:makeLut([[0,[2,0,16]],[.18,[40,8,96]],[.36,[98,18,150]],[.52,[168,28,150]],[.66,[226,60,110]],[.8,[255,140,40]],[.92,[255,218,90]],[1,[255,255,235]]])},
  {id:'iron',name:'آیرنبو',lut:makeLut([[0,[0,0,0]],[.15,[20,0,110]],[.35,[120,0,150]],[.55,[200,20,70]],[.72,[250,110,10]],[.88,[255,200,40]],[1,[255,255,230]]])},
  {id:'jet',name:'رنگین‌کمان',lut:makeLut([[0,[0,0,131]],[.125,[0,60,255]],[.375,[0,255,255]],[.625,[255,255,0]],[.875,[255,0,0]],[1,[128,0,0]]])},
  {id:'lava',name:'گدازه',lut:makeLut([[0,[0,0,0]],[.3,[90,0,0]],[.6,[220,60,0]],[.85,[255,190,0]],[1,[255,255,200]]])},
  {id:'ice',name:'یخی',lut:makeLut([[0,[0,0,20]],[.3,[10,40,120]],[.6,[40,160,220]],[.85,[170,230,255]],[1,[255,255,255]]])}
];

/* ---------- تُن: کشش خودکار، روشنایی، کنتراست، گاما ---------- */
function percentiles(hist,total,pl,ph){
  let c=0,lo=0,hi=255;const a=total*pl,b=total*ph;let gotLo=false;
  for(let i=0;i<256;i++){c+=hist[i];if(!gotLo&&c>=a){lo=i;gotLo=true}if(c>=b){hi=i;break}}
  return{lo,hi};
}
function buildTone(lo,hi,p){
  const lut=new Uint8ClampedArray(256);
  if(hi-lo<32)hi=Math.min(255,lo+32);              // سقف تقویت ≈ ۸ برابر
  const g=1/clamp(p.gamma,.2,4);
  for(let i=0;i<256;i++){
    let x=clamp((i-lo)/(hi-lo),0,1);
    x=Math.pow(x,g);x=(x-.5)*p.contrast+.5+p.brightness/255;
    lut[i]=clamp(x,0,1)*255;
  }
  return lut;
}

/* ---------- تقویت محلی کنتراست (CLAHE) ---------- */
function clahe(src,w,h,tx,ty,clip,out){
  const tw=Math.ceil(w/tx),th=Math.ceil(h/ty),maps=new Uint8Array(tx*ty*256),hist=new Uint32Array(256);
  for(let j=0;j<ty;j++)for(let i=0;i<tx;i++){
    hist.fill(0);const x0=i*tw,x1=Math.min(w,x0+tw),y0=j*th,y1=Math.min(h,y0+th);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)hist[src[y*w+x]]++;
    const n=Math.max(1,(x1-x0)*(y1-y0)),lim=Math.max(1,Math.floor(clip*n/256));let ex=0;
    for(let k=0;k<256;k++)if(hist[k]>lim){ex+=hist[k]-lim;hist[k]=lim}
    const add=Math.floor(ex/256),rem=ex-add*256;
    let cdf=0;const base=(j*tx+i)*256;
    for(let k=0;k<256;k++){hist[k]+=add+(k<rem?1:0);cdf+=hist[k];maps[base+k]=Math.round(255*cdf/(n+ex))}
  }
  for(let y=0;y<h;y++){
    const gy=y/th-.5;let j0=Math.floor(gy);const fy=gy-j0;let j1=j0+1;j0=clamp(j0,0,ty-1);j1=clamp(j1,0,ty-1);
    for(let x=0;x<w;x++){
      const gx=x/tw-.5;let i0=Math.floor(gx);const fx=gx-i0;let i1=i0+1;i0=clamp(i0,0,tx-1);i1=clamp(i1,0,tx-1);
      const v=src[y*w+x];
      const a=maps[(j0*tx+i0)*256+v],b=maps[(j0*tx+i1)*256+v],c=maps[(j1*tx+i0)*256+v],d=maps[(j1*tx+i1)*256+v];
      out[y*w+x]=(a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
    }
  }
}

/* ---------- محو جعبه‌ای (برای میانگین محلی و تیز کردن) ---------- */
function boxBlur(src,w,h,r,out,tmp){
  const inv=1/(2*r+1);
  for(let y=0;y<h;y++){
    const b=y*w;let s=0;for(let k=-r;k<=r;k++)s+=src[b+clamp(k,0,w-1)];
    for(let x=0;x<w;x++){tmp[b+x]=s*inv;s+=src[b+clamp(x+r+1,0,w-1)]-src[b+clamp(x-r,0,w-1)]}
  }
  for(let x=0;x<w;x++){
    let s=0;for(let k=-r;k<=r;k++)s+=tmp[clamp(k,0,h-1)*w+x];
    for(let y=0;y<h;y++){out[y*w+x]=s*inv;s+=tmp[clamp(y+r+1,0,h-1)*w+x]-tmp[clamp(y-r,0,h-1)*w+x]}
  }
}

/* ---------- ماسک: باز کردن مورفولوژیک و اجزای متصل ---------- */
function open3(m,w,h,tmp){
  tmp.fill(0);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(m[i]&&m[i-1]&&m[i+1]&&m[i-w]&&m[i+w])tmp[i]=1}
  m.fill(0);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(tmp[i]||tmp[i-1]||tmp[i+1]||tmp[i-w]||tmp[i+w])m[i]=1}
}
function components(m,w,h,minArea,maxFrac){
  const seen=new Uint8Array(w*h),st=new Int32Array(w*h),out=[];
  for(let s=0;s<w*h;s++){
    if(!m[s]||seen[s])continue;
    let sp=0,area=0,sx=0,sy=0,x0=w,y0=h,x1=0,y1=0;st[sp++]=s;seen[s]=1;
    while(sp){
      const p=st[--sp],x=p%w,y=(p/w)|0;area++;sx+=x;sy+=y;
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      if(x>0&&m[p-1]&&!seen[p-1]){seen[p-1]=1;st[sp++]=p-1}
      if(x<w-1&&m[p+1]&&!seen[p+1]){seen[p+1]=1;st[sp++]=p+1}
      if(y>0&&m[p-w]&&!seen[p-w]){seen[p-w]=1;st[sp++]=p-w}
      if(y<h-1&&m[p+w]&&!seen[p+w]){seen[p+w]=1;st[sp++]=p+w}
    }
    if(area>=minArea&&area<=maxFrac*w*h)out.push({area,cx:sx/area,cy:sy/area,x0,y0,x1,y1});
  }
  return out;
}

/* ---------- تشخیص حرکت (تفریق پس‌زمینه) ---------- */
class Motion{
  constructor(w,h){this.w=w;this.h=h;this.bg=null;this.t=0;this.noise=3;this.mask=new Uint8Array(w*h);this.tmp=new Uint8Array(w*h)}
  update(L,dt,p){
    const n=this.w*this.h,bg=this.bg,m=this.mask;
    if(!bg){this.bg=Float32Array.from(L);return{blobs:[],shake:false}}
    const thr=Math.max(30-2.5*p.sens,3.2*this.noise);
    let act=0,qs=0,qn=0;
    for(let i=0;i<n;i++){const d=Math.abs(L[i]-bg[i]);if(d>thr){m[i]=1;act++}else{m[i]=0;qs+=d;qn++}}
    if(qn)this.noise+=(qs/qn-this.noise)*.05;
    this.t+=dt;const warm=this.t<1.2;          // یک‌ثانیه‌ی اول: پس‌زمینه سریع یاد گرفته می‌شود تا «شبح» نماند
    const shake=act/n>.5,a=shake?.5:(warm?1-Math.exp(-dt/.25):1-Math.exp(-dt/Math.max(.3,p.tau)));
    for(let i=0;i<n;i++)bg[i]+=(L[i]-bg[i])*a;
    if(shake||warm)return{blobs:[],shake};
    open3(m,this.w,this.h,this.tmp);
    return{blobs:components(m,this.w,this.h,Math.max(4,p.minAreaFrac*n),.4),shake:false};
  }
}
/* ---------- تشخیص سایه: ناحیه‌ی تیره‌تر از میانگین محلی ---------- */
class Shadow{
  constructor(w,h){this.w=w;this.h=h;this.loc=new Float32Array(w*h);this.tmp=new Float32Array(w*h);this.mask=new Uint8Array(w*h);this.tm=new Uint8Array(w*h)}
  update(L,p){
    const{w,h}=this,n=w*h;boxBlur(L,w,h,Math.max(3,Math.round(w/10)),this.loc,this.tmp);
    const m=this.mask;
    for(let i=0;i<n;i++)m[i]=(L[i]<this.loc[i]-p.shadowThr&&this.loc[i]>40)?1:0;
    open3(m,w,h,this.tm);
    return components(m,w,h,Math.max(8,p.minAreaFrac*2*n),.35);
  }
}

/* ---------- ردیاب ---------- */
class Tracker{
  constructor(o){this.tracks=[];this.nextId=1;this.gate=o.gate||.12;this.maxMiss=o.maxMiss||10;this.minHits=o.minHits||4;this.kind=o.kind||'m'}
  update(blobs,dt,w,h,trailMax){
    const T=this.tracks,diag=Math.hypot(w,h),pairs=[];
    for(let i=0;i<T.length;i++)for(let j=0;j<blobs.length;j++){
      const t=T[i],b=blobs[j],d=Math.hypot(t.cx+t.vx*dt-b.cx,t.cy+t.vy*dt-b.cy)/diag;
      if(d<this.gate)pairs.push([d+.03*Math.abs(Math.log((b.area+1)/(t.area+1))),i,j]);
    }
    pairs.sort((a,b)=>a[0]-b[0]);
    const ut=new Set(),ub=new Set();
    for(const[,i,j]of pairs){
      if(ut.has(i)||ub.has(j))continue;ut.add(i);ub.add(j);
      const t=T[i],b=blobs[j],px=t.cx,py=t.cy;
      t.cx=t.cx*.5+b.cx*.5;t.cy=t.cy*.5+b.cy*.5;
      const vx=(t.cx-px)/dt,vy=(t.cy-py)/dt;t.vx=t.vx*.7+vx*.3;t.vy=t.vy*.7+vy*.3;
      t.area=b.area;t.box=[b.x0,b.y0,b.x1,b.y1];t.hits++;t.miss=0;
      t.trail.push([t.cx,t.cy]);while(t.trail.length>trailMax)t.trail.shift();
      t.moved=Math.hypot(t.cx-t.x0,t.cy-t.y0)/w;t.age+=dt;
    }
    for(let i=T.length-1;i>=0;i--)if(!ut.has(i)){T[i].miss++;T[i].age+=dt;if(T[i].miss>this.maxMiss)T.splice(i,1)}
    // (ایندکس‌های ut پیش از حذف محاسبه شده‌اند؛ حذف از انتها انجام می‌شود تا ایندکس‌ها جابه‌جا نشوند)
    for(let j=0;j<blobs.length;j++)if(!ub.has(j)){
      const b=blobs[j];
      T.push({id:this.nextId++,kind:this.kind,cx:b.cx,cy:b.cy,x0:b.cx,y0:b.cy,vx:0,vy:0,area:b.area,box:[b.x0,b.y0,b.x1,b.y1],hits:1,miss:0,age:0,moved:0,trail:[[b.cx,b.cy]]});
    }
    for(const t of T){const s=Math.hypot(t.vx,t.vy)/w;t.speed=s;t.cls=s<.02?'still':s<.12?'slow':s<.35?'walk':'run'}
    return T.filter(t=>t.hits>=this.minHits&&t.miss<=2);
  }
}
const CLS_FA={still:'ساکن',slow:'آهسته / لنگان',walk:'راه‌رفتن',run:'دویدن'};
return{PALETTES,makeLut,percentiles,buildTone,clahe,boxBlur,open3,components,Motion,Shadow,Tracker,CLS_FA};
});
