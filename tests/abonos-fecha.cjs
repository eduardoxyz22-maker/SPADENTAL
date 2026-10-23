/* Sólo memoria: HTML y Apps Script reales, sin transporte ni pacientes reales.
   Spa por defecto; Cosmetic con PANEL=cos (su HTML, su Apps Script y su clinicaId). */
const COS=process.env.PANEL==='cos';
const HTML=COS?'cosmetic/pacientes.html':'pacientes.html',GSF=COS?'cosmetic/google-apps-script-pacientes.gs':'google-apps-script-pacientes.gs',CID=COS?'cosmetic':'spadental';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {gsServer}=require('./apps-script-en-memoria.cjs');
const harness=fs.readFileSync(__dirname+'/pacientes-regression.cjs','utf8');
const mod={exports:{}};
vm.runInNewContext(harness.slice(0,harness.indexOf('(async()=>'))+'\nmodule.exports={boot,row};',
 {require,module:mod,__dirname,console,structuredClone,setImmediate});
const {boot,row}=mod.exports;
const clone=x=>JSON.parse(JSON.stringify(x));
let passed=0;const checks=[];
function check(name,f){f();passed++;checks.push(name)}
const srv=gsServer(__dirname+'/../'+GSF);
const RealDate=Date;
class Clock extends RealDate {constructor(...a){super(...(a.length?a:['2026-10-23T16:00:00Z']))}static now(){return new RealDate('2026-10-23T16:00:00Z').valueOf()}}
srv.ctx.Date=Clock;
function setup(storage){const b=boot(HTML,storage);b.c.Date=Clock;b.c.hoyPago=()=> '2026-10-23';b.c.CONNECTED=true;
 Object.defineProperty(b.el('#cp-fecha'),'value',{value:'2026-10-23',writable:true,configurable:true});
 b.c.api=async(action,registro,cfg,base)=>srv.handle({action,registro,cfg,base});
 b.c.refreshAll=()=>{};b.c.repintarSuave=()=>{};b.c.esMia=()=>true;
 return b;}
function seed(b,id='TEST-PLACA'){const r=row({id,clinicaId:CID,fecha:'2026-10-15',total:1000,acuenta:250,saldo:750,
 pagos:[{metodo:'QR',monto:250}],metodo:'QR',cobroInicialFechado:true,cobrosPosteriores:[]});
 assert(srv.handle({action:'save',registro:r,base:null}).ok);b.c.DATA=[clone(srv.registros[id])];b.c.SNAP_R[id]=JSON.stringify(b.c.DATA[0]);return r;}
async function pay(b,id,m,fecha,met='QR'){b.el('#cp-m').value=String(m);b.el('#cp-fecha').value=fecha;b.radios.cpmet=met;await b.c.guardarPago(id);await b.c.flushQueue();}
function cash(c,fecha){return c.totalCobros(c.filasCajaDia(fecha))}
(async()=>{
 const b=setup();const r=seed(b);const confirms=[];b.c.confirm=t=>{confirms.push(t);return true};
 for(const [m,f,balance] of [[300,'2026-10-20',450],[200,'2026-10-22',250],[250,'2026-10-23',0]]){
  await pay(b,r.id,m,f);check('Abono '+m+' el '+f,()=>{assert.equal(srv.registros[r.id].saldo,balance);assert.equal(b.c.DATA.length,1);assert.equal(srv.registros[r.id].fecha,'2026-10-15')});
 }
 check('Caja por fecha efectiva y sin duplicación',()=>{for(const [f,m] of [['15',250],['20',300],['22',200],['23',250]])assert.equal(cash(b.c,'2026-10-'+f),m);assert.equal(b.c.totalCobros(b.c.filasCaja(b.c.DATA)),1000)});
 check('Confirmación explícita de fechas pasadas',()=>{assert.equal(confirms.length,2);assert(confirms[0].includes('20/10'));assert(confirms[0].includes('no a la de hoy'))});
 check('Auditoría servidor separada y persistida',()=>{for(const p of srv.registros[r.id].cobrosPosteriores){assert.equal(p.registradoEn,'2026-10-23T16:00:00.000Z');assert.equal(p.registradoPor,'admin')}});
 const reloaded=setup(b.storage);reloaded.c.DATA=reloaded.c.loadLocal().map(reloaded.c.normalize);
 check('Recarga desde almacenamiento conserva fechas y saldo',()=>{assert.equal(reloaded.c.DATA[0].saldo,0);assert.equal(cash(reloaded.c,'2026-10-20'),300);assert.equal(reloaded.c.DATA[0].cobrosPosteriores.length,3)});
 const d=setup();seed(d,'TEST-DOBLE');d.el('#cp-m').value='100';d.radios.cpmet='QR';
 const p=d.c.guardarPago('TEST-DOBLE');const p2=d.c.guardarPago('TEST-DOBLE');await Promise.all([p,p2]);
 check('Doble clic con saldo remanente: un solo abono',()=>{assert.equal(srv.registros['TEST-DOBLE'].saldo,650);assert.equal(srv.registros['TEST-DOBLE'].cobrosPosteriores.length,1)});
 const u=setup();seed(u,'TEST-RESPUESTA');let dropped=false;
 u.c.api=async(action,registro,cfg,base)=>{const res=srv.handle({action,registro,cfg,base});if(action==='save'&&!dropped){dropped=true;throw Error('respuesta perdida')}return res};
 u.el('#cp-m').value='300';u.radios.cpmet='QR';await u.c.guardarPago('TEST-RESPUESTA');
 check('Respuesta perdida: operación guardada una vez y cola pendiente',()=>{assert.equal(srv.registros['TEST-RESPUESTA'].saldo,450);assert.equal(u.c.pend().length,1)});
 await u.c.guardarPago('TEST-RESPUESTA');
 check('Bloquea nuevo abono mientras falta confirmar',()=>assert.equal(srv.registros['TEST-RESPUESTA'].cobrosPosteriores.length,1));
 const recovery=setup(u.storage);recovery.c.DATA=recovery.c.loadLocal().map(recovery.c.normalize);await recovery.c.flushQueue();
 check('Reintento después de recarga no duplica',()=>{assert.equal(srv.registros['TEST-RESPUESTA'].saldo,450);assert.equal(srv.registros['TEST-RESPUESTA'].cobrosPosteriores.length,1);assert.equal(recovery.c.pend().length,0)});
 const f=setup();seed(f,'TEST-FAVOR');const ant=row({id:'TEST-ANT',paciente:r.paciente,fecha:'2026-10-20',estado:'Anticipo',total:0,acuenta:300,saldo:0,pagos:[{metodo:'QR',monto:300}],cobroInicialFechado:true});
 srv.handle({action:'save',registro:ant,base:null});f.c.DATA.push(clone(srv.registros[ant.id]));const before=JSON.stringify(srv.registros[ant.id]);
 await pay(f,'TEST-FAVOR',300,'2026-10-23','Saldo a favor');
 check('Anticipo aplicado sin cambiar ingreso original',()=>{assert.equal(srv.registros['TEST-FAVOR'].saldo,450);assert.equal(cash(f.c,'2026-10-20'),300);assert.equal(cash(f.c,'2026-10-23'),0);assert.equal(JSON.stringify(srv.registros[ant.id]),before);assert.equal(f.c.creditoLibre(r.paciente),0)});
 const v=setup();seed(v,'TEST-VALIDAR');
 for(const [m,fecha,met] of [[751,'2026-10-23','QR'],[1,'','QR'],[1,'2026-02-30','QR'],[1,'2026-10-24','QR'],[1,'2026-10-14','QR'],[-1,'2026-10-23','QR'],[1.001,'2026-10-23','QR'],[1,'2026-10-20','Saldo a favor']]){
  await pay(v,'TEST-VALIDAR',m,fecha,met);check('UI rechaza '+[m,fecha,met].join('/'),()=>assert.equal(srv.registros['TEST-VALIDAR'].saldo,750));
 }
 v.c.confirm=()=>false;await pay(v,'TEST-VALIDAR',100,'2026-10-20');check('Cancelar confirmación no guarda',()=>assert.equal(srv.registros['TEST-VALIDAR'].saldo,750));
 function request(id,m,fecha,met='QR',base=srv.registros[id]){const n=clone(base);n.acuenta+=m;n.saldo-=m;n.pagos.push({metodo:met,monto:m});n.cobrosPosteriores.push({id:'TEST-'+Math.random(),monto:m,fecha,metodo:met});return {action:'save',registro:n,base:clone(base)}}
 for(const [m,fecha,error] of [[751,'2026-10-23','abono_exceso'],[1,'2026-02-30','abono_fecha'],[1,'2026-10-24','abono_fecha'],[-1,'2026-10-23','abono_monto']])check('Servidor rechaza '+error+'/'+m,()=>assert.equal(srv.handle(request('TEST-VALIDAR',m,fecha)).error,error));
 check('Servidor rechaza crédito insuficiente',()=>assert.equal(srv.handle(request('TEST-VALIDAR',301,'2026-10-23','Saldo a favor')).error,'abono_credito'));
 const race=clone(srv.registros['TEST-VALIDAR']);assert(srv.handle(request('TEST-VALIDAR',600,'2026-10-23','QR',race)).ok);
 check('Otro equipo no puede sobrecobrar con versión vieja',()=>{assert.equal(srv.handle(request('TEST-VALIDAR',200,'2026-10-23','QR',race)).error,'abono_exceso');assert.equal(srv.registros['TEST-VALIDAR'].saldo,150)});
 const legacy=row({id:'TEST-LEGACY',fecha:'2020-01-01',acuenta:30,saldo:70,cobrosPosteriores:[{fecha:'2020-01-02',metodo:'QR',monto:10}]});srv.handle({action:'save',registro:legacy,base:null});const old=clone(srv.registros[legacy.id]),note=clone(old);note.obs='nota ficticia';
 check('Históricos sin ID ni auditoría siguen editables sin migración',()=>{assert(srv.handle({action:'save',registro:note,base:old}).ok);assert.deepEqual(srv.registros[legacy.id].cobrosPosteriores,old.cobrosPosteriores)});
 check('Fecha Bolivia en límite UTC',()=>{b.c.Date=class extends Clock {static now(){return new RealDate('2026-10-24T02:00:00Z').valueOf()}};vm.runInContext('hoyPago = '+fs.readFileSync(__dirname+'/../'+HTML,'utf8').match(/function hoyPago\(\)\{[^\n]+/)[0],b.c);assert.equal(b.c.hoyPago(),'2026-10-23')});
 console.log(JSON.stringify({clinica:CID,passed,networkRequests:0,checks},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
