/* هسته‌ی اندازه‌گیری مردمک: بدون وابستگی به مرورگر، قابل تست در Node */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PupilCore=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const N=128,R0=36,IRIS_MM=11.7;
const clamp=(x,a=0,b=1)=>x<a?a:x>b?b:x;
function median(a){if(!a.length)return NaN;const s=Array.from(a).sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2}
function mad(a,m){return median(a.map(x=>Math.abs(x-m)))*1.4826}
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------- پردازش تصویر ---------- */
function gauss(src,w,h,s){
  const r=Math.max(1,Math.ceil(s*3)),k=new Float32Array(2*r+1);let sum=0;
  for(let i=-r;i<=r;i++){k[i+r]=Math.exp(-i*i/(2*s*s));sum+=k[i+r]}
  for(let i=0;i<k.length;i++)k[i]/=sum;
  const t=new Float32Array(w*h),o=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let a=0;for(let i=-r;i<=r;i++){const xx=Math.min(w-1,Math.max(0,x+i));a+=src[y*w+xx]*k[i+r]}t[y*w+x]=a}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let a=0;for(let i=-r;i<=r;i++){const yy=Math.min(h-1,Math.max(0,y+i));a+=t[yy*w+x]*k[i+r]}o[y*w+x]=a}
  return o;
}
function bil(img,w,h,x,y){
  if(x<0||y<0||x>w-1||y>h-1)return NaN;
  const x0=x|0,y0=y|0,x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;
  return img[y0*w+x0]*(1-fx)*(1-fy)+img[y0*w+x1]*fx*(1-fy)+img[y1*w+x0]*(1-fx)*fy+img[y1*w+x1]*fx*fy;
}
function dilate(m,w,h,r){
  const t=new Uint8Array(w*h),o=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let i=-r;i<=r&&!v;i++){const xx=x+i;if(xx>=0&&xx<w&&m[y*w+xx])v=1}t[y*w+x]=v}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let i=-r;i<=r&&!v;i++){const yy=y+i;if(yy>=0&&yy<h&&t[yy*w+x])v=1}o[y*w+x]=v}
  return o;
}
/* لکه‌های روشن بزرگ حذف می‌شوند (مردمک روشن در نور چراغ)، فقط انعکاس‌های کوچک می‌مانند */
function keepSmall(m,w,h,maxArea){
  const seen=new Uint8Array(w*h);
  for(let s=0;s<w*h;s++){
    if(!m[s]||seen[s])continue;
    const st=[s],comp=[];seen[s]=1;
    while(st.length){const p=st.pop();comp.push(p);const x=p%w,y=(p/w)|0;
      for(const q of[x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&m[q]&&!seen[q]){seen[q]=1;st.push(q)}}
    if(comp.length>maxArea)for(const p of comp)m[p]=0;
  }
}
function fillHoles(img,spec,w,h){
  const o=Float32Array.from(img);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(!spec[y*w+x])continue;let s=0,c=0;
    for(let j=-5;j<=5;j++)for(let i=-5;i<=5;i++){const xx=x+i,yy=y+j;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!spec[yy*w+xx]){s+=img[yy*w+xx];c++}}
    if(c)o[y*w+x]=s/c;
  }
  return o;
}

/* ---------- برازش دایره ---------- */
function fitCircle(P){
  const n=P.length;let mx=0,my=0;for(const p of P){mx+=p.x;my+=p.y}mx/=n;my/=n;
  let Sxx=0,Sxy=0,Syy=0,Sxz=0,Syz=0,Sz=0;
  for(const p of P){const x=p.x-mx,y=p.y-my,z=x*x+y*y;Sxx+=x*x;Sxy+=x*y;Syy+=y*y;Sxz+=x*z;Syz+=y*z;Sz+=z}
  const det=Sxx*Syy-Sxy*Sxy;if(Math.abs(det)<1e-9)return null;
  const a=(Sxz*Syy-Syz*Sxy)/det,b=(Syz*Sxx-Sxz*Sxy)/det;
  const cx=a/2,cy=b/2,r=Math.sqrt(Math.max(0,Sz/n+cx*cx+cy*cy));
  return{x:cx+mx,y:cy+my,r};
}
function circ3(p,q,s){
  const d=2*(p.x*(q.y-s.y)+q.x*(s.y-p.y)+s.x*(p.y-q.y));if(Math.abs(d)<1e-6)return null;
  const p2=p.x*p.x+p.y*p.y,q2=q.x*q.x+q.y*q.y,s2=s.x*s.x+s.y*s.y;
  const x=(p2*(q.y-s.y)+q2*(s.y-p.y)+s2*(p.y-q.y))/d,y=(p2*(s.x-q.x)+q2*(p.x-s.x)+s2*(q.x-p.x))/d;
  return{x,y,r:Math.hypot(p.x-x,p.y-y)};
}

/* ---------- اندازه‌گیری مردمک در یک تصویر ۱۲۸×۱۲۸ ----------
   img: کانال قرمز (۰..۲۵۵)، mask: ۱ برای ناحیه‌ی چشمِ باز
   شعاع عنبیه به R0=36 پیکسل نرمال شده است.                  */
function measurePupil(img,mask,o){
  o=o||{};const w=N,h=N,n=w*h,cx0=o.cx==null?64:o.cx,cy0=o.cy==null?64:o.cy;
  const fail=why=>({ok:false,q:0,why});
  const spec=new Uint8Array(n);for(let i=0;i<n;i++)if(img[i]>=245)spec[i]=1;
  keepSmall(spec,w,h,Math.round(.04*Math.PI*R0*R0));
  const spec2=dilate(spec,w,h,2),spec3=dilate(spec,w,h,3);
  const b=gauss(fillHoles(img,spec2,w,h),w,h,1.2);
  const core=[],ring=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;if(!mask[i]||spec2[i])continue;const d=Math.hypot(x-cx0,y-cy0);
    if(d<.15*R0)core.push(b[i]);else if(d>=.8*R0&&d<=.94*R0)ring.push(b[i]);
  }
  if(core.length<8||ring.length<40)return fail('داده کافی نیست');
  const cm=median(core),am=median(ring),contrast=Math.abs(am-cm),pol=cm<am?1:-1;
  if(contrast<8)return fail('کنتراست مردمک کم است');
  let cx=cx0,cy=cy0;
  for(let it=0;it<3;it++){
    let sw=0,sx=0,sy=0;const rr=(it?.7:.55)*R0;
    for(let y=Math.max(0,Math.floor(cy-rr));y<=Math.min(h-1,Math.ceil(cy+rr));y++)
      for(let x=Math.max(0,Math.floor(cx-rr));x<=Math.min(w-1,Math.ceil(cx+rr));x++){
        const i=y*w+x;if(!mask[i]||spec2[i]||Math.hypot(x-cx,y-cy)>rr)continue;
        const g=pol*(am-b[i])-.5*contrast;if(g>0){sw+=g;sx+=g*x;sy+=g*y}
      }
    if(sw>0){cx=sx/sw;cy=sy/sw}
  }
  const NR=48,step=.5,rmin=.1*R0,rmax=.85*R0,m=Math.floor((rmax-rmin)/step)+1;
  const prof=new Float32Array(m),e=new Float32Array(m),P=[];
  for(let k=0;k<NR;k++){
    const a=2*Math.PI*k/NR,ca=Math.cos(a),sa=Math.sin(a);let bad=false;
    for(let i=0;i<m;i++){const r=rmin+i*step,v=bil(b,w,h,cx+r*ca,cy+r*sa);if(v!==v){bad=true;break}prof[i]=v}
    if(bad)continue;
    let emax=0;e.fill(0);
    for(let i=2;i<m-2;i++){e[i]=pol*(prof[i+2]-prof[i-2]);if(e[i]>emax)emax=e[i]}
    if(emax<.25*contrast)continue;
    let pick=-1;
    for(let i=3;i<m-3;i++)if(e[i]>=.6*emax&&e[i]>=e[i-1]&&e[i]>=e[i+1]){pick=i;break}
    if(pick<0)continue;
    const den=e[pick-1]-2*e[pick]+e[pick+1],dl=den<0?clamp(.5*(e[pick-1]-e[pick+1])/den,-.5,.5):0;
    const rs=rmin+(pick+dl)*step,px=cx+rs*ca,py=cy+rs*sa;
    const ox=Math.round(cx+(rs+2)*ca),oy=Math.round(cy+(rs+2)*sa),ex=Math.round(px),ey=Math.round(py);
    if(ox<0||oy<0||ox>=w||oy>=h||ex<0||ey<0||ex>=w||ey>=h)continue;
    if(!mask[oy*w+ox]||!mask[ey*w+ex]||spec3[ey*w+ex])continue;
    P.push({x:px,y:py,a});
  }
  if(P.length<10)return fail('لبه‌ی مردمک کم است');
  const rnd=rng(12345);let best=null,bc=-1;
  const count=(c,tol)=>{let k=0;for(const p of P)if(Math.abs(Math.hypot(p.x-c.x,p.y-c.y)-c.r)<tol)k++;return k};
  for(let it=0;it<120;it++){
    const i=(rnd()*P.length)|0;let j=(rnd()*P.length)|0,l=(rnd()*P.length)|0;if(i===j||j===l||i===l)continue;
    const c=circ3(P[i],P[j],P[l]);if(!c||c.r<.12*R0||c.r>.8*R0||Math.hypot(c.x-cx,c.y-cy)>.35*R0)continue;
    const k=count(c,1);if(k>bc){bc=k;best=c}
  }
  if(!best||bc<8)return fail('دایره‌ی مناسب پیدا نشد');
  let c=best;
  for(let it=0;it<2;it++){
    const inl=P.filter(p=>Math.abs(Math.hypot(p.x-c.x,p.y-c.y)-c.r)<(it?.9:1.1));
    if(inl.length<8)return fail('دایره‌ی مناسب پیدا نشد');
    const f=fitCircle(inl);if(!f)return fail('برازش ناموفق');c=f;
  }
  const inl=P.filter(p=>Math.abs(Math.hypot(p.x-c.x,p.y-c.y)-c.r)<.9);
  if(inl.length<8||c.r<.12*R0||c.r>.8*R0)return fail('شعاع نامعتبر');
  let rs=0;for(const p of inl){const d=Math.hypot(p.x-c.x,p.y-c.y)-c.r;rs+=d*d}
  const rms=Math.sqrt(rs/inl.length);
  const angs=inl.map(p=>p.a).sort((x,y)=>x-y);let gap=angs[0]+2*Math.PI-angs[angs.length-1];
  for(let i=1;i<angs.length;i++)gap=Math.max(gap,angs[i]-angs[i-1]);
  const span=360-gap*180/Math.PI;
  const q=clamp((inl.length/NR-.2)/.5)*clamp((span-90)/150)*clamp(1-rms/1.2)*clamp(contrast/25);
  return{ok:true,r:c.r,cx:c.x,cy:c.y,q,inl:inl.length,span,rms,contrast,pol};
}

/* ---------- تحلیل سری زمانی (رفلکس نوری مردمک) ---------- */
function resample(t,d,q,fs,qmin){
  const T=[],D=[];for(let i=0;i<t.length;i++)if(q[i]>=qmin&&d[i]===d[i]){T.push(t[i]);D.push(d[i])}
  if(T.length<8)return null;
  // حذف پرت با Hampel
  const keep=[];
  for(let i=0;i<D.length;i++){
    const w=D.slice(Math.max(0,i-3),Math.min(D.length,i+4)),m=median(w),s=mad(w,m);
    keep.push(Math.abs(D[i]-m)<=3*s+.006);
  }
  const t2=[],d2=[];for(let i=0;i<D.length;i++)if(keep[i]){t2.push(T[i]);d2.push(D[i])}
  const t0=t[0],t1=t[t.length-1],n=Math.floor((t1-t0)*fs)+1,out=new Float32Array(n).fill(NaN);
  let j=0;
  for(let i=0;i<n;i++){
    const tt=t0+i/fs;while(j<t2.length-2&&t2[j+1]<tt)j++;
    if(t2.length<2)break;
    const a=t2[j],b=t2[j+1];
    if(tt<a-.12||tt>b+.12)continue;
    if(b-a>.3&&tt>a+.12&&tt<b-.12)continue;
    const f=b>a?clamp((tt-a)/(b-a)):0;out[i]=d2[j]*(1-f)+d2[j+1]*f;
  }
  return{t0,fs,x:out};
}
function smooth(x,sig){
  const r=Math.ceil(sig*3),o=new Float32Array(x.length).fill(NaN);
  for(let i=0;i<x.length;i++){let s=0,c=0,wsum=0;
    for(let k=-r;k<=r;k++){const v=x[i+k];if(v===v){const w=Math.exp(-k*k/(2*sig*sig));s+=v*w;wsum+=w;c++}}
    if(c>=3&&x[i]===x[i])o[i]=s/wsum;
  }
  return o;
}
function analyzePLR(series,onset,offset,opt){
  opt=opt||{};const fs=30;
  const rs=resample(series.t,series.d,series.q,fs,.35);
  if(!rs)return{ok:false,why:'داده‌ی معتبر کافی نیست'};
  const sm=smooth(rs.x,1.5),T=i=>rs.t0+i/fs,I=t=>Math.round((t-rs.t0)*fs);
  const valid=(a,b)=>{let c=0;for(let i=Math.max(0,I(a));i<=Math.min(sm.length-1,I(b));i++)if(sm[i]===sm[i])c++;return c};
  const baseA=onset-1.5;
  const base=[],raw=[];
  for(let i=Math.max(0,I(baseA));i<=Math.min(sm.length-1,I(onset));i++)if(sm[i]===sm[i]){base.push(sm[i]);if(rs.x[i]===rs.x[i])raw.push(rs.x[i])}
  if(base.length<12)return{ok:false,why:'خط پایه‌ی معتبر نیست'};
  const D0=median(base),noise=Math.max(.002,mad(raw,median(raw)));
  const winEnd=Math.min(offset,onset+3.2);
  let Dmin=Infinity,imin=-1;
  // کف منحنی با میانگین ۷ نمونه‌ای تا اثر نوفه کم شود
  for(let i=I(onset)+3;i<=Math.min(sm.length-4,I(winEnd));i++){
    let s=0,c=0;for(let k=-3;k<=3;k++){const v=sm[i+k];if(v===v){s+=v;c++}}
    if(c>=5&&s/c<Dmin){Dmin=s/c;imin=i}
  }
  const respValid=valid(onset,winEnd)/Math.max(1,I(winEnd)-I(onset)+1);
  if(imin<0||respValid<.5)return{ok:false,why:'واکنش در زمان تحریک دیده نشد'};
  const constr=(D0-Dmin)/D0;
  const thr=D0-Math.max(2.5*noise,.03*D0);
  let lat=null;
  for(let i=I(onset);i<=imin;i++){
    if(sm[i]<thr){let ok=true;for(let k=1;k<=3;k++)if(!(sm[i+k]<thr)){ok=false;break}
      if(ok){const a=sm[i-1],b=sm[i];const fr=(a===a&&a>b)?clamp((a-thr)/(a-b)):1;lat=T(i-1+fr)-onset;break}}
  }
  let mcv=0;
  for(let i=Math.max(1,I(onset));i<=imin&&i<sm.length-1;i++){const dv=(sm[i+1]-sm[i-1])*fs/2;if(dv===dv&&-dv>mcv)mcv=-dv}
  mcv=mcv/D0*100;
  let t75=null;
  if(constr>.05){
    const target=Dmin+.75*(D0-Dmin);
    for(let i=Math.max(I(offset),imin);i<sm.length;i++)if(sm[i]===sm[i]&&sm[i]>=target){t75=T(i)-offset;break}
  }
  const bsd=1.4826*mad(base,D0);
  let conf=100*clamp(1-noise/.03)*clamp(respValid)*clamp(base.length/40)*clamp(opt.sizeQ==null?1:opt.sizeQ);
  return{ok:true,D0,Dmin,constr:constr*100,lat,mcv,t75,noise,conf,
    D0mm:D0*IRIS_MM,Dminmm:Dmin*IRIS_MM,respValid,
    curve:{t0:rs.t0,fs,x:Array.from(sm)}};
}

/* ---------- ارزیابی ----------
   آستانه‌ها تجربی‌اند و روی داده‌ی بالینی کالیبره نشده‌اند. */
function eyeStatus(m){
  if(!m||!m.ok||m.conf<40)return{k:'unk',t:'نامشخص'};
  const slowLat=m.lat==null||m.lat>.8;
  if(m.constr>=14&&!slowLat)return{k:'ok',t:'واکنشی'};
  if(m.constr>=7)return{k:'weak',t:'ضعیف / کند'};
  return{k:'fixed',t:'بدون واکنش'};
}
function zscore(x,arr){
  if(arr.length<2)return null;const m=arr.reduce((a,b)=>a+b,0)/arr.length;
  const sd=Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/(arr.length-1));return{m,sd,z:(x-m)/Math.max(sd,1e-6)};
}
function verdict(L,R,hist){
  const sL=eyeStatus(L),sR=eyeStatus(R),flags=[];
  const have=[sL,sR].filter(s=>s.k!=='unk');
  let code,text,adv;
  if(!have.length){code='unk';text='نامشخص';adv='کیفیت اندازه‌گیری کافی نبود. نور محیط را کم کن، فاصله را ۲۵ تا ۳۵ سانت نگه دار و دوباره بسنج.'}
  else if(have.every(s=>s.k==='ok')){code='ok';text='طبیعی: مردمک به نور واکنش دارد';adv='نشانه‌ی قوی از زنده بودن و هوشیاری عصبی. این بررسی فقط یک سیگنال است، نه تشخیص پزشکی.'}
  else if(have.every(s=>s.k==='fixed')){code='fixed';text='بدون واکنش به نور';adv='این به‌تنهایی «زامبی» یا مرگ نیست: مواد، دارو، آسیب مغزی و نور ناکافی هم همین را می‌دهند. بررسی نبض و تنفس را هم انجام بده.'}
  else{code='weak';text='واکنش ضعیف یا ناهمگون';adv='دوباره بسنج و نتیجه را با نبض و رفتار فرد مقایسه کن.'}
  if(L&&R&&L.ok&&R.ok){
    if(Math.abs(L.D0mm-R.D0mm)>=1)flags.push('تفاوت اندازه‌ی دو مردمک بیش از ۱ میلی‌متر');
    if(Math.abs(L.constr-R.constr)>15)flags.push('واکنش دو چشم همسان نیست');
  }
  if(hist&&hist.length>=2){
    const zc=zscore((L&&L.ok&&R&&R.ok)?(L.constr+R.constr)/2:NaN,hist.map(h=>h.constr));
    if(zc&&zc.z<-2.5)flags.push('انقباض به‌طور معناداری کمتر از حالت عادی همین فرد');
  }
  return{code,text,adv,flags,left:sL,right:sR};
}
return{N,R0,IRIS_MM,measurePupil,analyzePLR,verdict,eyeStatus,median,mad,clamp};
});
