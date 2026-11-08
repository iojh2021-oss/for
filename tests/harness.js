const MC=require('../mosquito-core.js');const {Synth,AcousticDetector}=MC;
const FS=16000;
function runAcoustic(x,params,fs=FS){
  const det=new AcousticDetector({fs,params}),n=det.n,hop=det.hop,out=[];
  for(let s=0;s+n<=x.length;s+=hop){out.push(det.push(x.subarray(s,s+n)))}
  return {det,out};
}
const ORDER={none:0,suspect:1,likely:2,confirmed:3,multi:4};
function summarize(out){
  let mx=0,tLik=null,tCon=null,fa=0;
  for(const r of out){const o=ORDER[r.state];if(o>mx)mx=o;if(o>=2&&tLik===null)tLik=r.t;if(o>=3&&tCon===null)tCon=r.t}
  return {mx,tLik,tCon};
}
module.exports={MC,Synth,FS,runAcoustic,summarize,ORDER};
