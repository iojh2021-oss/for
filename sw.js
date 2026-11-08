const V='didehban-v7';
const FILES=['./','index.html','manifest.json','icon.svg','pupil-core.js','pupil.js','anomaly-core.js','anomaly.js','vision-core.js','vision.js','mosquito-core.js','mosquito.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok&&res.status===200){const copy=res.clone();caches.open(V).then(c=>c.put(e.request,copy))}
    return res
  }).catch(()=>caches.match('index.html'))));
});
