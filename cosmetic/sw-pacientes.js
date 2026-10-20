/* El panel como app: siempre pide la versión nueva a la red y guarda una copia
   solo para abrir aunque no haya señal. Nunca toca los pedidos a Google
   (son POST y de otro dominio): los datos van y vienen como siempre. */
var CACHE='panel-pacientes-v1';
self.addEventListener('install',function(e){
  self.skipWaiting();
  /* una copia inicial, para que la primera vez sin señal ya abra */
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(['pacientes.html','pacientes.webmanifest'])}).catch(function(){}))});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',function(e){
  var r=e.request; if(r.method!=='GET')return;
  var u=new URL(r.url); if(u.origin!==self.location.origin)return;
  var base=self.registration.scope.replace(self.location.origin,'');
  if(u.pathname.indexOf(base)!==0)return;
  var resto=u.pathname.slice(base.length);
  if(!/^(pacientes\.html|pacientes\.webmanifest|iconos\/[\w.-]+\.png)?$/.test(resto))return;
  e.respondWith(fetch(r).then(function(res){
    if(res&&res.ok){var c=res.clone(); caches.open(CACHE).then(function(ca){ca.put(r,c)})}
    return res}).catch(function(){return caches.match(r).then(function(x){return x||caches.match(base+'pacientes.html')})}))});
