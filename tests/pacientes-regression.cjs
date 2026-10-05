/* Offline regression tests. No real fetch, browser profile, credentials or Google services. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
let count=0;const evidence=[];
function check(name,fn){fn();count++;evidence.push(name)}
function boot(file,storage=new Map()){
 const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8'),nodes=new Map(),requests=[],db=new Map(),radios={};
 const el=s=>{if(!nodes.has(s))nodes.set(s,{value:'',style:{},dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},querySelectorAll(){return []}});return nodes.get(s)};
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 const srv={lista:null};const c={console,localStorage,sessionStorage:localStorage,document:{querySelector:el,querySelectorAll:()=>[],addEventListener(){},body:{classList:{add(){},remove(){}}}},window:{print(){},scrollTo(){}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},confirm:()=>true,alert(){},navigator:{},location:{},fetch:async(url,opt)=>{const q=JSON.parse(opt.body);requests.push(q);if(q.action==='save')db.set(q.registro.id,structuredClone(q.registro));if(q.action==='list')return {json:async()=>({ok:true,registros:structuredClone(srv.lista?srv.lista():c.DATA),pacientes:structuredClone(Object.values(c.PAC||{}))})};return {json:async()=>({ok:true,registro:q.registro,registros:[...db.values()]})}}};
 vm.createContext(c,{codeGeneration:{strings:false,wasm:false}});
 let code=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
 new vm.Script(code);code=code.slice(0,code.lastIndexOf('(function init(){'));
 vm.runInContext(code,c,{timeout:3000});c.CFG=c.loadCfg();c.DATA=[];c.PAC={};c.EGR=[];
 const messages=[];c.toast=t=>messages.push(t);
 for(const n of ['refreshAll','closeModal','fillDatalists','updateNavRem','clearForm','showWhatsappModal','refreshNro','mostrarWaCita','clearCita','renderPre'])c[n]=()=>{};
 c.getRadio=n=>radios[n]||'';c.esAdmin=()=>true;c.hoyISO=()=> '2026-10-02';
 return {c,el,requests,db,storage,html,radios,messages,srv};
}
const row=(o={})=>Object.assign({id:'FICTICIO-1',paciente:'Paciente Ficticio',ci:'TEST-001',nac:'1990-01-01',fecha:'2026-09-01',estado:'Atendido',total:100,acuenta:20,saldo:80,metodo:'Efectivo',pagos:[{metodo:'Efectivo',monto:20}],servicios:[],profesional:'Doctora Ficticia',celular:'00000000'},o);
function form(b,overrides={}){
 const {c,el,radios}=b;c.readSrv=()=>{};c.readPre=()=>{};c.preParaGuardar=()=>[];c.autoCerrarPresu=()=>0;
 c.EDIT_ID=null;c.SRV=[{nom:'Corona ficticia',cant:1,precio:100,lab:0}];
 Object.assign(radios,{canal:'Otro',estado:'Atendido',metodo:'Efectivo',origen:'Espontánea',tipo:'Nuevo'});
 const values={'#f-fecha':'2026-10-02','#f-prof':'Doctora Ficticia','#f-cel':'00000000','#f-paciente':'Paciente Ficticio','#f-ci':'TEST-001','#f-nac':'1990-01-01','#f-total':'100','#f-acuenta':'20','#f-saldo':'80','#f-plan':'','#f-prox':'',...overrides};
 for(const [s,v] of Object.entries(values))el(s).value=v;
}
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r))};
async function run(file){
 const b=boot(file),{c,el,radios}=b;const test=(n,f)=>check(file+': '+n,f);
 c.DATA=[row()];radios.cpmet='Efectivo';el('#cp-m').value='80';c.guardarPago('FICTICIO-1');await settle();await c.flushQueue();
 test('Pago posterior usa fecha real, conserva acumulado y no inventa visita',()=>{assert.equal(c.totalCobros(c.filasCajaDia('2026-10-02')),80);assert.equal(c.totalCobros(c.filasCajaMes('2026-09')),20);assert.equal(c.DATA.length,1);assert.equal(c.DATA[0].acuenta,100);assert.equal(c.DATA[0].saldo,0);assert.equal(c.DATA[0].cobrosPosteriores[0].fecha,'2026-10-02');assert.equal(b.db.get('FICTICIO-1').cobrosPosteriores[0].monto,80)});
 test('Histórico no fechado se señala, sin migrarlo',()=>{assert.equal(c.filasCajaMes('2026-09')[0]._cobroHistorico,true);assert.equal(c.DATA[0].cobroInicialFechado,undefined)});
 test('Caja, panel y resumen del día incluyen cobro de otra fecha',()=>{el('#c-rango').value='dia';el('#c-dia').value='2026-10-02';el('#p-rango').value='mes';el('#p-mes').value='2026-10';assert.equal(c.totalCobros(c.cajaRows()),80);assert.equal(c.totalCobros(c.filasCobrosPanel()),80);assert(c.txtResumenDia('2026-10-02','').includes(c.bs(80)));assert.equal(c.liquidacion(c.cajaRows())[0].n,0);assert.equal(c.liquidacion(c.cajaRows())[0].pagar,0)});
 const outputs=[];c.buildXlsx= sheets=>{outputs.push(sheets);return {}};c.descargar=()=>{};c.exportCaja(c.cajaRows());
 test('Excel de caja usa movimientos fechados',()=>{const sheets=outputs[0],mov=sheets.find(s=>s.name==='Movimientos');assert(mov);const txt=JSON.stringify(mov.rows);assert(txt.includes('2026-10-02'));assert(txt.includes('80'))});
 test('Resumen mensual impreso admite mes con cobros y sin visitas',()=>{c.imprimirInforme();assert(el('#print-area').innerHTML.includes(c.bs(80)));assert(el('#print-area').innerHTML.includes('Informe mensual'))});
 test('Vistas Caja y Panel renderizan con cobros sin visitas',()=>{c.renderCaja();c.renderPanel();assert(el('#cj-kpis').innerHTML.includes('0 atenciones'));assert(el('#p-kpis').innerHTML.includes(c.bs(80)))});
 const once=JSON.stringify(c.DATA);c.guardarPago('FICTICIO-1');await settle();test('Doble clic no duplica pago sobre saldo cero',()=>assert.equal(JSON.stringify(c.DATA),once));
 const old=row({saldo:70,total:100,acuenta:20});c.DATA=[old];el('#cp-m').value='30';c.guardarPago(old.id);await settle();test('Saldo corregido manualmente se reduce sin recalcular descuento',()=>assert.equal(c.DATA[0].saldo,40));
 c.DATA=[row()];form(b,{'#f-acuenta':'40','#f-saldo':'60'});c.EDIT_ID='FICTICIO-1';const legacyBefore=JSON.stringify(c.DATA);c.submitAtencion();await settle();test('No permite agregar pago retroactivo editando acumulado histórico',()=>assert.equal(JSON.stringify(c.DATA),legacyBefore));
 c.DATA=[];const r=row({prox:'2026-10-10',proxHora:'09:00',planId:'PLAN-A'});c.DATA.push(r);const cita=c.crearCitaDesde(r);r.proxHora='15:00';r.proxMotivo='Control';r.planId='PLAN-B';c.crearCitaDesde(r);
 test('Cita misma fecha actualiza hora, motivo y plan sin duplicar',()=>{assert.equal(cita.hora,'15:00');assert.equal(cita.proxMotivo,'Control');assert.equal(cita.planId,'PLAN-B');assert.equal(c.DATA.length,2)});
 r.prox='2026-10-11';c.crearCitaDesde(r);test('Cambio de fecha conserva ID de cita',()=>{assert.equal(cita.fecha,'2026-10-11');assert.equal(c.DATA.length,2)});
 r.prox='';c.crearCitaDesde(r);test('Quitar próxima cita cancela la derivada, conserva historial',()=>{assert.equal(cita.estado,'Canceló');assert.equal(c.DATA.length,2)});
 r.prox=cita.fecha;c.crearCitaDesde(r);test('Volver a poner la próxima cita quitada la reactiva',()=>{assert.equal(cita.estado,'Agendada');assert.equal(c.DATA.length,2)});cita.estado='Canceló';cita.obs='El paciente avisó que no viene';r.prox='';c.crearCitaDesde(r);r.prox=cita.fecha;c.crearCitaDesde(r);test('Una cita que canceló el paciente no se reactiva sola',()=>assert.equal(cita.estado,'Canceló'));
 r.prox='2026-10-12';const c2=c.crearCitaDesde(r);c2.estado='Atendido';const resolved=JSON.stringify(c2);r.prox='';c.crearCitaDesde(r);test('No cancela una cita ya atendida',()=>assert.equal(JSON.stringify(c2),resolved));
 c.DATA=[];c.PAC={};const p=c.pacBlanco('Paciente Ficticio');p.planes=[c.planNormalize({id:'PLAN-A',total:100,sesiones:[{desc:'Sesion ficticia'}]})];c.PAC[c.keyPac(p.nombre)]=p;
 c.DATA=[row({estado:'Agendada',acuenta:0,saldo:0,total:0,pagos:[],planId:'PLAN-A'})];
 form(b,{'#f-plan':'PLAN-A','#f-acuenta':'0','#f-saldo':'100'});c.EDIT_ID='FICTICIO-1';radios.estado='No asistió';c.submitAtencion();await settle();test('Guardar atención No asistió no consume sesión',()=>assert.equal(p.planes[0].sesiones[0].hecha,false));
 const rec=c.DATA[0];form(b,{'#f-plan':'PLAN-A','#f-acuenta':'0','#f-saldo':'100'});c.EDIT_ID=rec.id;radios.estado='Atendido';c.submitAtencion();await settle();test('Atendido consume una sesión',()=>assert.equal(p.planes[0].sesiones[0].hecha,true));
 c.submitAtencion();await settle();test('Guardar dos veces no consume dos sesiones',()=>assert.equal(p.planes[0].sesiones.filter(s=>s.hecha).length,1));
 radios.estado='No asistió';c.submitAtencion();await settle();test('Corregir atención libera su sesión',()=>assert.equal(p.planes[0].sesiones[0].hecha,false));
 c.DATA=[row()];c.PAC={};test('Fecha de nacimiento distinta para mismo nombre se bloquea; igual o vacía continúa',()=>{assert.equal(c.validarIdentidadPaciente('Paciente Ficticio','1990-01-02',null),false);assert.equal(c.validarIdentidadPaciente('Paciente Ficticio','1990-01-01',null),true);assert.equal(c.validarIdentidadPaciente('Paciente Ficticio','',null),true)});
 const before=JSON.stringify(c.DATA);form(b,{'#f-nac':'1990-01-02'});c.submitAtencion();await settle();test('Guardado real bloquea homónimo sin cambiar DATA',()=>assert.equal(JSON.stringify(c.DATA),before));
 for(const [s,v] of Object.entries({'#q-paciente':'Paciente Ficticio','#q-nac':'1990-01-02','#q-fecha':'2026-10-02','#q-cel':'00000000'}))el(s).value=v;
 radios.qagenda='Otro';radios.qcanal='Otro';c.confirmarChoque=()=>true;c.serviciosPrevistos=()=>[];c.guardarCita();test('Agenda también bloquea homónimo',()=>assert.equal(JSON.stringify(c.DATA),before));
 el('#q-nac').value='1990-01-01';c.guardarCita();test('Agenda acepta fecha verificada sin perderla',()=>{assert.equal(c.DATA.length,2);assert.equal(c.DATA[1].nac,'1990-01-01')});c.DATA=[row()];
 c.DATA.push(row({id:'FICTICIO-2',nac:'1990-01-02'}));test('Ambigüedad previa queda intacta y bloqueada',()=>{const saved=JSON.stringify(c.DATA);assert(c.identidadAmbigua('Paciente Ficticio'));assert.equal(c.validarIdentidadPaciente('Paciente Ficticio','1990-01-01',c.DATA[0]),false);assert.equal(JSON.stringify(c.DATA),saved)});
 c.DATA=[row({nac:''})];test('Historial sin fecha de nacimiento no bloquea una visita nueva',()=>assert.equal(c.validarIdentidadPaciente('Paciente Ficticio','1990-01-01',null),true));
 c.DATA=[];c.PAC={};form(b);c.CFG.precios=[{nom:'Corona ficticia',lab:90}];c.submitAtencion();await settle();test('Laboratorio cero persiste y reporta cero',()=>{assert.equal(c.DATA[0].servicios[0].lab,0);assert.equal(c.labDeAtencion(c.DATA[0]),0)});
 test('Laboratorio sin override conserva valor de catálogo',()=>assert.equal(c.labDe({nom:'Corona ficticia',cant:2}),180));
 const paid=c.DATA[0];el('#cp-m').value='30';c.guardarPago(paid.id);await settle();await c.flushQueue();form(b,{'#f-acuenta':'50','#f-saldo':'50'});c.EDIT_ID=paid.id;c.submitAtencion();await settle();test('Editar atención conserva cobros fechados',()=>assert.equal(c.DATA[0].cobrosPosteriores.length,1));
 const immutable=JSON.stringify(c.DATA);el('#f-acuenta').value='70';c.submitAtencion();await settle();test('Edición no pisa importes del libro de cobros',()=>assert.equal(JSON.stringify(c.DATA),immutable));
 c.DATA=[];c.PAC={};c.EGR=[];c.bind();
 function importBackup(j){c.FileReader=function(){this.readAsText=()=>{this.result=JSON.stringify(j);this.onload()}};el('#file-json').onchange({target:{files:[{name:'ficticio.json'}],value:'ficticio'}})}
 const foreign={schemaVersion:2,clinicaId:c.CLINICA_ID==='spadental'?'cosmetic':'spadental',data:[row()],pacientes:{},egresos:[]};
 const q=JSON.stringify(c.pend());importBackup(foreign);test('Importación otra clínica no cambia datos ni cola',()=>{assert.equal(c.DATA.length,0);assert.equal(JSON.stringify(c.pend()),q)});
 importBackup({data:[row()]});test('Respaldo legacy sin clínica se bloquea',()=>assert.equal(c.DATA.length,0));
 const own={...foreign,clinicaId:c.CLINICA_ID};importBackup(own);await c.flushQueue();test('Respaldo propio entra y sincroniza en backend ficticio',()=>{assert.equal(c.DATA.length,1);assert(b.db.has('FICTICIO-1'))});
 importBackup(own);test('Reimportación propia no duplica registros',()=>assert.equal(c.DATA.length,1));
 test('Exportación incluye identidad estable de clínica',()=>{c.CFG.clinica='Nombre editable';assert.equal(c.respaldoClinica().clinicaId,c.CLINICA_ID)});
 test('Bloquea fila marcada con otra clínica aunque el sobre sea propio',()=>assert(c.validarRespaldoClinica({...own,data:[{...row(),clinicaId:foreign.clinicaId}]})));
 c.DATA=[row({acuenta:20,saldo:80,cobroInicialFechado:true})];radios.cpmet='QR';el('#cp-m').value='30';c.guardarPago('FICTICIO-1');await settle();c.hoyISO=()=> '2026-11-03';radios.cpmet='Tarjeta';el('#cp-m').value='50';c.guardarPago('FICTICIO-1');await settle();
 test('Pagos mixtos, meses distintos y acumulado cuadran sin duplicar',()=>{assert.equal(c.totalCobros(c.filasCajaMes('2026-09')),20);assert.equal(c.totalCobros(c.filasCajaMes('2026-10')),30);assert.equal(c.totalCobros(c.filasCajaMes('2026-11')),50);assert.equal(c.totalCobros(c.filasCaja(c.DATA)),100);assert.equal(c.filasCajaMes('2026-10')[0].pagos[0].metodo,'QR');assert.equal(c.filasCajaMes('2026-11')[0].pagos[0].metodo,'Tarjeta')});
 const reload=c.normalize(JSON.parse(JSON.stringify(c.DATA[0])));test('Round-trip JSON conserva libro de cobros',()=>assert.equal(reload.cobrosPosteriores.length,2));
 c.hoyISO=()=> '2026-10-02';
 c.DATA=[row()];const enServidor=structuredClone(c.DATA);enServidor[0].acuenta=50;enServidor[0].saldo=50;enServidor[0].cobrosPosteriores=[{id:'OTRO-EQUIPO',fecha:'2026-10-02',metodo:'Efectivo',monto:30}];enServidor[0].pagos=[{metodo:'Efectivo',monto:50}];
 b.srv.lista=()=>enServidor;radios.cpmet='QR';el('#cp-m').value='20';c.guardarPago('FICTICIO-1');await settle();b.srv.lista=null;
 test('Pago desde pestaña vieja se suma al de otro equipo, no lo pisa',()=>{assert.equal(c.DATA[0].acuenta,70);assert.equal(c.DATA[0].saldo,30);assert.equal(c.DATA[0].cobrosPosteriores.length,2)});
 c.DATA=[row()];b.srv.lista=()=>[];el('#cp-m').value='10';c.guardarPago('FICTICIO-1');await settle();b.srv.lista=null;
 test('Atención borrada en otro equipo no revive al cobrar',()=>assert.equal(c.DATA.length,0));
 c.DATA=[row()];const enSrv2=structuredClone(c.DATA);enSrv2[0].acuenta=60;enSrv2[0].saldo=40;b.srv.lista=()=>enSrv2;form(b,{'#f-obs':'cambio'});c.EDIT_ID='FICTICIO-1';c.submitAtencion();await settle();b.srv.lista=null;
 test('Edición desde pestaña vieja no pisa un cobro de otro equipo',()=>{assert.equal(c.DATA[0].acuenta,60);assert.notEqual(c.DATA[0].obs,'cambio')});
 test('Montos con punto de miles y coma decimal',()=>{assert.equal(c.num('1.500'),1500);assert.equal(c.num('12.000'),12000);assert.equal(c.num('1.500,50'),1500.5);assert.equal(c.num('1500,5'),1500.5);assert.equal(c.num('1.5'),1.5);assert.equal(c.num(0.125),0.125);assert.equal(c.num('Bs 2.000'),2000)});
 c.DATA=[];form(b,{'#f-total':'300','#f-acuenta':'500','#f-saldo':'-200'});c.submitAtencion();await settle();test('No guarda cobrado mayor al total ni saldo negativo',()=>assert.equal(c.DATA.length,0));
 c.DATA=[row()];form(b,{'#f-acuenta':'20','#f-saldo':'80'});c.EDIT_ID='FICTICIO-1';radios.estado='No asistió';c.submitAtencion();await settle();radios.estado='Atendido';
 test('Una visita con cobro no pasa a No asistió',()=>assert.equal(c.DATA[0].estado,'Atendido'));
 test('Nombres iguales sin importar acentos ni espacios',()=>assert.equal(c.keyPac(' María  Pérez '),c.keyPac('maria perez')));
 test('Montos con letras se detectan',()=>{assert(c.montoRaro('15OO'));assert(c.montoRaro('1e3'));assert(!c.montoRaro('Bs. 1.500'));assert(!c.montoRaro('1.500,50'))});
 test('Montos con texto alrededor',()=>{assert.equal(c.num('5.000.'),5000);assert.equal(c.num('Bs. 1.500'),1500);assert.equal(c.num('1.500.-'),1500);assert.equal(c.num('-'),0)});
 c.DATA=[];form(b,{'#f-total':'100','#f-acuenta':'-50','#f-saldo':'150'});c.submitAtencion();await settle();test('No guarda un cobro negativo',()=>assert.equal(c.DATA.length,0));
 test('La cola junta cambios del mismo registro y conserva la base',()=>{c.setPend([]);c.SNAP_R['Q-1']=JSON.stringify(row({id:'Q-1'}));c.queue('save',row({id:'Q-1',obs:'a'}));c.queue('save',row({id:'Q-1',obs:'b'}));const q=c.pend();assert.equal(q.length,1);assert.equal(q[0].rec.obs,'b');assert.equal(q[0].base.obs,row().obs);c.setPend([])});
 test('Entorno sin red disponible',()=>{assert.equal(vm.runInContext('typeof require',c),'undefined');assert.equal(vm.runInContext('typeof XMLHttpRequest',c),'undefined')});
 return b;
}
(async()=>{const a=await run('pacientes.html'),b=await run('cosmetic/pacientes.html');check('Clínicas: claves y endpoints separados',()=>{for(const k of ['K_DATA','K_CFG','K_PEND','K_PASS','K_UNLOCK','K_PAC','K_EGR','K_MIPROF'])assert.notEqual(a.c[k],b.c[k]);assert.notEqual(a.c.SHEETS_URL,b.c.SHEETS_URL);assert.notEqual(a.c.CLINICA_ID,b.c.CLINICA_ID)});check('Ambas clínicas rechazan respaldo de la otra',()=>{assert(a.c.validarRespaldoClinica(b.c.respaldoClinica()));assert(b.c.validarRespaldoClinica(a.c.respaldoClinica()))});
 check('Motor corregido idéntico en las dos clínicas',()=>{for(const f of ['guardarPago','submitAtencion','crearCitaDesde','marcarSesionPlan','validarIdentidadPaciente','validarRespaldoClinica','filasCaja','cajaRows','renderPanel','exportCaja'])assert.equal(a.c[f].toString(),b.c[f].toString().replaceAll('Cosmetic_informe_caja','Ezequiel_Spadental_informe_caja'))});
 const shared=new Map(),sa=boot('pacientes.html',shared),sb=boot('cosmetic/pacientes.html',shared);sa.c.DATA=[row()];sa.c.saveLocal();sb.c.DATA=[row({id:'SOLO-COSMETIC',paciente:'Otra ficticia'})];sb.c.saveLocal();check('Mismo origen: localStorage de pacientes no se mezcla',()=>{assert.equal(sa.c.loadLocal()[0].id,'FICTICIO-1');assert.equal(sb.c.loadLocal()[0].id,'SOLO-COSMETIC')});
 for(const file of ['google-apps-script-pacientes.gs','cosmetic/google-apps-script-pacientes.gs']){
   const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);ctx.formatoFecha=x=>x;ctx.formatoHora=x=>x;
   const r=row({clinicaId:file.startsWith('cosmetic')?'cosmetic':'spadental',cobroInicialFechado:true,cobrosPosteriores:[{id:'P-FICTICIO',fecha:'2026-10-02',metodo:'QR',monto:30}],servicios:[{nom:'Corona ficticia',lab:0,precio:100,cant:1}]});
   /* el servidor junta cambios: hoja en memoria, sin red */
   const filas=[];ctx.getSheet=()=>({getLastRow:()=>filas.length+1,getRange:(r0,c0,nr,nc)=>({getValues:()=>filas.slice(r0-2,r0-2+nr).map(f=>f.slice(c0-1,c0-1+nc)),setValues:v=>{filas[r0-2]=v[0].slice()}}),appendRow:f=>filas.push(f.slice()),deleteRow:i=>filas.splice(i-2,1)});
   const b0=row({id:'J-1',acuenta:0,saldo:100,total:100});ctx.doSave(structuredClone(b0),null);
   const m1=structuredClone(b0);m1.acuenta=30;m1.saldo=70;m1.cobrosPosteriores=[{id:'c1',monto:30,metodo:'QR',fecha:'2026-10-02'}];
   const m2=structuredClone(b0);m2.acuenta=50;m2.saldo=50;m2.cobrosPosteriores=[{id:'c2',monto:50,metodo:'Efectivo',fecha:'2026-10-02'}];
   ctx.doSave(m1,structuredClone(b0));const fin=ctx.doSave(m2,structuredClone(b0)).registro;
   check(file+': dos cobros desde equipos distintos se suman en el servidor',()=>{assert.equal(fin.acuenta,80);assert.equal(fin.saldo,20);assert.equal(fin.cobrosPosteriores.length,2)});
   const viejo=structuredClone(b0);viejo.obs='nota';const fin2=ctx.doSave(viejo,structuredClone(b0)).registro;
   check(file+': una pantalla vieja que cambia una nota no borra cobros',()=>{assert.equal(fin2.acuenta,80);assert.equal(fin2.obs,'nota')});
   check(file+': no borra una atención que se cobró desde que se la vio',()=>assert.equal(ctx.doDelete({id:'J-1'},structuredClone(b0)).error,'cambio'));
   check(file+': un cambio viejo no revive una atención borrada',()=>{ctx.doDelete({id:'J-1'},null);assert.equal(ctx.doSave(structuredClone(b0),structuredClone(b0)).error,'borrada')});
   const b1=row({id:'J-2',acuenta:0,saldo:100,total:100});ctx.doSave(structuredClone(b1),null);
   const p1=structuredClone(b1);p1.acuenta=30;p1.saldo=70;p1.cobrosPosteriores=[{id:'k1',monto:30,metodo:'QR',fecha:'2026-10-02'}];
   ctx.doSave(structuredClone(p1),structuredClone(b1));const otra=ctx.doSave(structuredClone(p1),structuredClone(b1)).registro;
   check(file+': reintentar el mismo cobro no lo cuenta dos veces',()=>{assert.equal(otra.acuenta,30);assert.equal(otra.saldo,70)});
   const nueva=row({id:'J-3'});ctx.doSave(structuredClone(nueva),null);const conPago=structuredClone(nueva);conPago.acuenta=nueva.acuenta+50;conPago.saldo=nueva.saldo-50;conPago.cobrosPosteriores=[{id:'k9',monto:50,metodo:'QR',fecha:'2026-10-02'}];ctx.doSave(conPago,structuredClone(nueva));
   check(file+': un alta repetida (respuesta perdida) no borra el cobro de otro',()=>assert.equal(ctx.doSave(structuredClone(nueva),null).registro.acuenta,nueva.acuenta+50));
   const props={};ctx.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v}})};
   const cb={precios:[{nom:'x',precio:1}],canales:['A'],prof:['Dra. X']};ctx.doGuardarCfg(structuredClone(cb));ctx.doGuardarCfg({...structuredClone(cb),prof:['Dra. X','Dra. Y']},structuredClone(cb));
   check(file+': ajustes de dos equipos se juntan en el servidor',()=>{const c2=ctx.doGuardarCfg({...structuredClone(cb),canales:['A','B']},structuredClone(cb)).cfg;assert.deepEqual([...c2.prof],['Dra. X','Dra. Y']);assert.deepEqual([...c2.canales],['A','B'])});
   check(file+': fichas con y sin tilde se juntan sin perder la alergia',()=>{const f=ctx.fusionarFichas({nombre:'María Pérez',med:{alergias:'PENICILINA'},ts:'1'},{nombre:'Maria Perez',med:{notas:'x'},ts:'2'});assert.equal(f.med.alergias,'PENICILINA');assert.equal(ctx.fClavePac('María  Pérez'),'maria perez')});
   check(file+': fusión idéntica en panel y servidor',()=>{for(const fn of ['fIgual','fusion3','fCampo','fSesiones','fPorId','fMulti','fTexto3','fDesarmar','fArmar','fusionRegistro','fCambioParaBorrar','fusionarFichas','fClavePac'])assert.equal(ctx[fn].toString(),(file.startsWith('cosmetic')?b:a).c[fn].toString())});
   const roundtrip=ctx.registroDeFila(ctx.filaDeRegistro(r));check(file+': serialización real conserva nuevos campos y laboratorio cero',()=>{assert.deepEqual(JSON.parse(JSON.stringify(roundtrip.cobrosPosteriores)),r.cobrosPosteriores);assert.equal(roundtrip.clinicaId,r.clinicaId);assert.equal(roundtrip.servicios[0].lab,0);assert.equal(roundtrip.cobroInicialFechado,true)});
 }
 console.log(JSON.stringify({passed:count,networkRequests:0,evidence},null,2));})().catch(e=>{console.error(e);process.exitCode=1});
