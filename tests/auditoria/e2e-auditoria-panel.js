'use strict';
/* Arreglos de la auditoría del 27/10 en la BASE del panel (fuera del bloque
   MODERNO): XSS por ids, saldo negativo en Caja, plan terminado con adelanto,
   borrar plan con pagos (liberarPagos), vender un paquete desde una cita,
   cambiar de plan una sesión pagada con el adelanto, borrar una sesión
   (la ficha sale después del delete), rechazos nuevos de la cola y renombrar a
   un nombre ocupado. Panel en jsdom con el Apps Script real en memoria
   (2026-10-29-auditoria), datos ficticios, sin red real (netguard).
   PANEL=spa|cos. Termina con TODO OK / FALLAS: n. */
const { abrir, entrar, fakeServer, close } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
let fallas = 0, pendientes = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(78), x === undefined ? '' : JSON.stringify(x).slice(0, 260)); };
/* lo que depende del bloque MODERNO (otro agente) o del servidor: se informa, no cuenta como falla de la base */
const PEND = (t, c, x) => { if (!c) pendientes++; console.log((c ? 'PASS ' : 'PENDIENTE ') + String(t).padEnd(73), x === undefined ? '' : JSON.stringify(x).slice(0, 260)); };
/* las funciones definidas dentro del bloque MODERNO del HTML (para saber de quién es cada onclick) */
const HTML = require('fs').readFileSync(SPA ? require('path').join(__dirname, '..', '..', 'pacientes.html') : require('path').join(__dirname, '..', '..', 'cosmetic/pacientes.html'), 'utf8');
const MOD_FN = (() => { const a = HTML.indexOf('/* ===== MODERNO INI ====='), b = HTML.indexOf('/* ===== MODERNO FIN ===== */', a); const out = {}; if (a < 0 || b < 0) return out;
  HTML.slice(a, b).replace(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g, (m, n) => { out[n] = 1; return m; }); return out; })();
const esModerno = (onclick) => { const m = /^\s*(?:closeModal\(\);)?\s*([A-Za-z_$][\w$]*)\s*\(/.exec(onclick || ''); return !!(m && MOD_FN[m[1]]); };
const crudo = (onclick) => /[^\\]'\);window\.__pwn/.test(onclick || '');
const clone = x => JSON.parse(JSON.stringify(x));
const HOY = new Date().toISOString().slice(0, 10);
const MAL_ID = "RX');window.__pwn=1;//";
const MAL_PLAN = "PX');window.__pwn=2;//";
const MAL_EGR = "EX');window.__pwn=3;//";
const at = (o) => Object.assign({ ts: new Date().toISOString(), fecha: HOY, hora: '10:00', profesional: 'Dra. Mirna', estado: 'Atendido', tipo: 'Nuevo', canal: 'Instagram', celular: '70000001',
  servicios: [{ nom: 'Limpieza dental', cant: 1, precio: 100 }], total: 100, acuenta: 100, saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 100 }], cobrosPosteriores: [], cobroInicialFechado: true }, o);

/* servidor con una dueña real (la clave de fábrica no puede borrar ni renombrar) y una doctora */
function servidor() {
  const s = fakeServer(); s.shimClaves = false; s.sesionDirecta = true;
  const v = s.ctx.leerVerif(); v.admin = s.ctx.shaHex('au-duena-1'); v.prof = { 'Dra. Shirley': s.ctx.shaHex('au-shirley-1') }; s.ctx.guardarVerif(v);
  return s;
}
async function panel(s, clave) { const T = await abrir({ server: s }); await entrar(T, clave || 'au-duena-1'); await T.tick(s.latency ? s.latency * 3 + 200 : 150); await T.w.pullServer(); await T.tick(s.latency ? s.latency * 2 + 200 : 200); return T; }
const srvCred = (s, nom) => s.ctx.creditosSrv(s.ctx.fClavePac(nom));
const conPwn = (T) => T.$$('[onclick]').filter(el => /__pwn/.test(el.getAttribute('onclick') || ''));

(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const s0 = servidor();
  OK('el servidor en memoria es el nuevo (login.auditoria === true)', s0.handle({ action: 'login', clave: 'au-duena-1' }).auditoria === true);

  /* ===== 1. XSS por ids: lo que viene de la hoja y lo que ya está en DATA ===== */
  {
    const s = servidor();
    /* filas viejas con id hostil, directo en la hoja (el servidor nuevo ya no deja crearlas) */
    s.ctx.getSheet().appendRow(s.ctx.filaDeRegistro(at({ id: MAL_ID, paciente: 'Au Id Raro', prox: HOY, proxHora: '15:00', proxMotivo: 'control' })));
    s.ctx.getSheet().appendRow(s.ctx.filaDeRegistro(at({ id: "CX');window.__pwn=4;//", paciente: 'Au Id Raro', estado: 'Agendada', servicios: [], total: 0, acuenta: 0, saldo: 0, metodo: '', pagos: [], hora: '16:00' })));
    s.ctx.getSheet().appendRow(s.ctx.filaDeRegistro(at({ id: "AX');window.__pwn=5;//", paciente: 'Au Id Raro', estado: 'Anticipo', servicios: [], total: 0, acuenta: 50, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 50 }], planId: MAL_PLAN })));
    s.ctx.getSheetPac().appendRow(s.ctx.filaDePaciente({ nombre: 'Au Id Raro', med: { alergias: '' }, planes: [{ id: MAL_PLAN, nombre: 'Plan raro', total: 500, estado: 'activo', prof: 'Dra. Mirna', fecha: HOY, sesiones: [{ n: 1, desc: 'Etapa 1', precio: 250, hecha: true, fecha: HOY, atencionId: MAL_ID }, { n: 2, desc: 'Etapa 2', precio: 250 }] }] }));
    s.ctx.getSheetEgr().appendRow(s.ctx.filaDeEgreso({ id: MAL_EGR, fecha: HOY, categoria: 'Insumos', detalle: 'guantes', monto: 30, metodo: 'Efectivo' }));
    const T = await panel(s); const w = T.w;
    const raros = w.DATA.filter(r => r.paciente === 'Au Id Raro');
    OK('1 las 3 filas con id hostil llegaron y el panel les cambió el id por uno seguro (normalize)', raros.length === 3 && raros.every(r => w.ID_OK.test(r.id)), raros.map(r => r.id));
    const pl = w.planesDe('Au Id Raro')[0];
    OK('1 el plan con id hostil también, y el pago al plan y la sesión apuntan al mismo id seguro', !!pl && w.ID_OK.test(pl.id) && raros.filter(r => r.estado === 'Anticipo')[0].planId === pl.id && pl.sesiones[0].atencionId === raros.filter(r => r.estado === 'Atendido')[0].id, pl && [pl.id, pl.sesiones[0].atencionId]);
    OK('1 el egreso con id hostil quedó con id seguro', w.EGR.length === 1 && w.ID_OK.test(w.EGR[0].id), w.EGR.map(e => e.id));
    OK('1 el id seguro es el mismo en dos cargas (determinista)', w.idSeguro(MAL_ID) === w.idSeguro(MAL_ID) && w.idSeguro(MAL_ID) !== w.idSeguro(MAL_PLAN) && w.idSeguro('abc') === 'abc' && w.idSeguro('a1') === 'a1', [w.idSeguro(MAL_ID)]);
    /* y lo que ya está en memoria sin normalizar (una pantalla vieja, una fila metida a mano): jss() en cada onclick */
    w.DATA.push(at({ id: MAL_ID, paciente: 'Au Id Crudo', prox: HOY, proxHora: '15:00', proxMotivo: 'control', saldo: 20, acuenta: 80, pagos: [{ metodo: 'Efectivo', monto: 80 }] }));
    w.DATA.push(at({ id: "CX');window.__pwn=4;//", paciente: 'Au Id Crudo', estado: 'Agendada', servicios: [], total: 0, acuenta: 0, saldo: 0, metodo: '', pagos: [], hora: '16:00' }));
    w.DATA.push(at({ id: "NX');window.__pwn=6;//", paciente: 'Au Id Crudo', total: 100, acuenta: 100, saldo: 30 }));   // no cuadra → Caja
    const kc = w.keyPac('Au Id Crudo'); w.PAC[kc] = w.pacBlanco('Au Id Crudo'); w.PAC[kc].nombre = 'Au Id Crudo';
    w.PAC[kc].planes = [{ id: MAL_PLAN, nombre: 'Plan crudo', total: 500, estado: 'activo', prof: 'Dra. Mirna', fecha: HOY, cuotas: [], notas: '', sesiones: [{ n: 1, desc: 'Etapa 1', precio: 250, hecha: false, fecha: '', atencionId: '' }, { n: 2, desc: 'Etapa 2', precio: 250, hecha: false, fecha: '', atencionId: '' }] }];
    w.EGR.push({ id: MAL_EGR, fecha: HOY, categoria: 'Insumos', detalle: 'guantes', monto: 30, metodo: 'Efectivo', prof: '', ts: '' });
    let clics = 0, errs0 = T.errors.length;
    const pintarYTocar = async (que, fn) => {
      try { fn(); } catch (e) { console.log('  ' + que + ': ' + String(e).slice(0, 120)); }
      await T.tick(150);
      const els = conPwn(T); clics += els.length;
      const crudos = els.filter(el => crudo(el.getAttribute('onclick')));
      const base = crudos.filter(el => !esModerno(el.getAttribute('onclick'))), mod = crudos.filter(el => esModerno(el.getAttribute('onclick')));
      /* se tocan primero los de la base (si corre algo, es nuestro); los del bloque MODERNO aparte */
      w.__pwn = undefined;
      els.filter(el => !esModerno(el.getAttribute('onclick'))).forEach(el => { try { el.click(); } catch (e) {} });
      await T.tick(80);
      OK('1 ' + que + ': en la base los ids hostiles van escapados y al tocarlos no corre nada (' + els.length + ' botones)', base.length === 0 && w.__pwn === undefined && !T.$('img[src="x"]'), { pwn: w.__pwn, crudos: base.slice(0, 2).map(el => el.getAttribute('onclick').slice(0, 60)) });
      if (mod.length) { w.__pwn = undefined; mod.forEach(el => { try { el.click(); } catch (e) {} }); await T.tick(80);
        PEND('1 ' + que + ': bloque MODERNO sin jss() en el id (lo arregla el otro agente)', false, { pwn: w.__pwn, ej: mod.slice(0, 3).map(el => el.getAttribute('onclick').slice(0, 50)) }); w.__pwn = undefined; }
      if (T.modalOpen()) w.closeModal();
    };
    await pintarYTocar('Atenciones', () => w.show('lista'));
    await pintarYTocar('Mi día', () => { w.show('midia'); T.setVal('#m-dia', HOY); w.renderMiDia(); });
    await pintarYTocar('Recordatorios', () => { w.show('agenda'); });
    await pintarYTocar('Citas', () => { w.show('cita'); });
    await pintarYTocar('Caja', () => { w.show('caja'); T.setVal('#c-rango', 'mes'); T.setVal('#c-mes', HOY.slice(0, 7)); w.renderCaja(); });
    await pintarYTocar('Ficha de la atención', () => w.verFicha(MAL_ID));
    await pintarYTocar('Ficha del paciente', () => w.verPaciente('Au Id Crudo'));
    await pintarYTocar('Planes', () => w.abrirPlanes('Au Id Crudo'));
    await pintarYTocar('El plan', () => w.verPlan('Au Id Crudo', MAL_PLAN));
    await pintarYTocar('Pacientes', () => w.show('pacientes'));
    OK('1 se tocaron botones con el id hostil en varias pantallas y no hubo errores de JS nuevos', clics >= 6 && T.errors.length === errs0, { clics, errs: T.errors.slice(errs0, errs0 + 2) });
    close(T); T.close();
  }

  /* ===== 2. Saldo negativo en Caja → «No cuadran», «Dejar en 0», «pagó Bs X de más» ===== */
  {
    const s = servidor();
    s.handle({ action: 'save', registro: at({ id: 'au-neg-1', fecha: '2026-10-10', paciente: 'Au Saldo Negativo', servicios: [{ nom: 'Limpieza dental', cant: 1, precio: 200 }], total: 150, acuenta: 200, saldo: -50, pagos: [{ metodo: 'Efectivo', monto: 200 }] }) });
    s.handle({ action: 'save', registro: at({ id: 'au-ok-1', fecha: '2026-10-10', paciente: 'Au Debe', servicios: [{ nom: 'Limpieza dental', cant: 1, precio: 200 }], total: 200, acuenta: 100, saldo: 100, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 100 }] }) });
    s.handle({ action: 'save', registro: at({ id: 'au-mas-1', fecha: '2026-10-11', paciente: 'Au Saldo De Mas', servicios: [{ nom: 'Limpieza dental', cant: 1, precio: 200 }], total: 200, acuenta: 200, saldo: 40, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 200 }] }) });
    const T = await panel(s); const w = T.w;
    const neg = w.DATA.filter(r => r.id === 'au-neg-1')[0];
    OK('2 saldoNoCuadra detecta el saldo negativo (y sigue detectando el saldo de más)', w.saldoNoCuadra(neg) && w.saldosNoCuadran().map(r => r.id).join() === 'au-neg-1,au-mas-1' && !w.saldoNoCuadra(w.DATA.filter(r => r.id === 'au-ok-1')[0]), w.saldosNoCuadran().map(r => r.id));
    OK('2 faltaPagar sigue en 0 y pagoDeMas dice 50', w.faltaPagar(neg) === 0 && w.pagoDeMas(neg) === 50);
    w.show('caja'); T.setVal('#c-rango', 'mes'); T.setVal('#c-mes', '2026-10'); w.renderCaja(); await T.tick(100);
    const nc = T.$('#cj-nocuadra').textContent.replace(/\s+/g, ' ');
    OK('2 Caja «No cuadran» la lista con «Dejar en 0»', /Au Saldo Negativo/.test(nc) && /Dejar en 0/.test(nc) && /Au Saldo De Mas/.test(nc), nc.slice(0, 300));
    PEND('2 Caja «No cuadran» dice «pagó Bs 50 de más» y no resta el negativo del total (lo pinta el bloque MODERNO: usar pagoDeMas(r))', /pagó Bs 50 de más/.test(nc) && !/Bs -10/.test(nc), nc.slice(0, 200));
    w.verFicha('au-neg-1'); await T.tick(50); const fh = T.modalText().replace(/\s+/g, ' ');
    OK('2 la ficha de la atención avisa que no cuadra y que pagó de más', /Este saldo no cuadra/.test(fh) && /pagó Bs 50 de más/.test(fh), (fh.match(/Este saldo.{0,160}/) || [''])[0]);
    T.dialogs.confirmAnswer = true; w.arreglarSaldo('au-neg-1'); await T.tick(300);
    OK('2 el confirm explica que pagó de más', /pagó Bs 50 de más/.test(T.dialogs.confirm.slice(-1)[0] || ''), T.dialogs.confirm.slice(-1)[0]);
    const fin = s.handle({ action: 'list' }).registros.filter(r => r.id === 'au-neg-1')[0];
    OK('2 «Dejar en 0»: saldo 0, cobro y total intactos, anotado en obs', fin && fin.saldo === 0 && fin.acuenta === 200 && fin.total === 150 && /Saldo ajustado de Bs -50 a Bs 0/.test(fin.obs) && /pagó Bs 50 de más/.test(fin.obs), fin && { saldo: fin.saldo, acuenta: fin.acuenta, obs: fin.obs });
    w.renderCaja(); await T.tick(50);
    OK('2 ya no figura en «No cuadran» (queda la otra)', !/Au Saldo Negativo/.test(T.$('#cj-nocuadra').textContent) && /Au Saldo De Mas/.test(T.$('#cj-nocuadra').textContent));
    close(T); T.close();
  }

  /* ===== 3. Plan terminado con adelanto sin usar → saldo a favor libre ===== */
  {
    const s = servidor(); const PAC = 'Au Plan Terminado';
    const plan = { id: 'au-pt-1', nombre: 'BLANQUEAMIENTO', fecha: '2026-10-01', estado: 'activo', prof: '', deClinica: true, paquete: true, total: 700, cuotas: [], notas: '',
      sesiones: [{ n: 1, desc: 's1', precio: 234, hecha: true, fecha: '2026-10-01', atencionId: 'au-v1' }, { n: 2, desc: 's2', precio: 233, hecha: true, fecha: '2026-10-08', atencionId: 'au-v2' }, { n: 3, desc: 's3', precio: 233 }] };
    s.handle({ action: 'pac', registro: { nombre: PAC, med: {}, planes: [plan] } });
    s.handle({ action: 'save', registro: at({ id: 'au-a1', fecha: '2026-10-01', paciente: PAC, estado: 'Anticipo', servicios: [], total: 0, acuenta: 700, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 700 }], planId: 'au-pt-1', anticipoPor: 'Recepción' }) });
    s.handle({ action: 'save', registro: at({ id: 'au-v1', fecha: '2026-10-01', paciente: PAC, servicios: [{ nom: 's1', cant: 1, precio: 234 }], total: 234, acuenta: 234, saldo: 0, metodo: 'Saldo a favor', pagos: [{ metodo: 'Saldo a favor', monto: 234 }], planId: 'au-pt-1', planEtapa: 1 }) });
    s.handle({ action: 'save', registro: at({ id: 'au-v2', fecha: '2026-10-08', paciente: PAC, servicios: [{ nom: 's2', cant: 1, precio: 233 }], total: 233, acuenta: 233, saldo: 0, metodo: 'Saldo a favor', pagos: [{ metodo: 'Saldo a favor', monto: 233 }], planId: 'au-pt-1', planEtapa: 2 }) });
    const T = await panel(s); const w = T.w;
    let p = w.planesDe(PAC)[0];
    OK('3 antes: 233 reservados al plan, 0 libres', w.creditosEn(w.DATA, PAC).planes['au-pt-1'] === 233 && w.creditoLibre(PAC) === 0 && w.cuentasPlan(p).queda === 233);
    T.dialogs.confirmAnswer = false; w.cerrarPlan(PAC, 'au-pt-1'); await T.tick(100);
    OK('3 «Dar por terminado» avisa «Quedan Bs 233 adelantados: pasan a saldo a favor libre» y con «Cancelar» no cierra', /Quedan Bs 233 adelantados: pasan a saldo a favor libre del paciente/.test(T.dialogs.confirm.slice(-1)[0] || '') && w.planesDe(PAC)[0].estado === 'activo', T.dialogs.confirm.slice(-1)[0]);
    T.dialogs.confirmAnswer = true; w.cerrarPlan(PAC, 'au-pt-1'); await T.tick(300);
    p = w.planesDe(PAC)[0];
    const c = w.creditosEn(w.DATA, PAC), cp = w.cuentasPlan(p);
    OK('3 terminado: los 233 pasan al bolsillo libre (creditosEn) y una visita suelta los puede usar', p.estado === 'terminado' && c.general === 233 && !(c.planes['au-pt-1'] > 0) && w.creditoLibre(PAC) === 233 && w.creditoParaAtencion({ id: '__nueva', paciente: PAC, planId: '', total: 150, acuenta: 0, pagos: [] }) === 233, c);
    OK('3 cuentasPlan: queda 0 adelantado y 233 «liberado»; el plan sigue como pagado', cp.queda === 0 && cp.liberado === 233 && w.cobradoPlan(p) === 700, cp);
    OK('3 el servidor dice lo mismo (creditosSrv: general 233)', srvCred(s, PAC).general === 233, srvCred(s, PAC));
    if (T.modalOpen()) w.closeModal(); await T.tick(50); w.verPlan(PAC, 'au-pt-1'); await T.tick(150); const vp = T.modalText().replace(/\s+/g, ' ');
    OK('3 la ventana del plan: «Adelanto sin usar Bs 0» y «Además tiene Bs 233 de saldo a favor suelto»', /Adelanto sin usar\s*Bs 0/.test(vp) && /Además tiene Bs 233 de saldo a favor suelto/.test(vp), vp.slice(0, 200));
    PEND('3 las cuentas del plan dicen «pasó a saldo a favor libre (plan terminado) Bs 233» (cuentasPlanHtml de la base; el bloque MODERNO la reemplaza: usar cuentasPlan(p).liberado)', /pasó a saldo a favor libre del paciente \(plan terminado\)\s*Bs 233/i.test(vp), (vp.match(/Queda adelantado.{0,60}/) || [''])[0]);
    /* un plan cancelado, igual */
    w.closeModal(); const f = w.pacDe(PAC); f.planes[0].estado = 'cancelado'; w.savePac(f); await T.tick(200);
    OK('3 cancelado: también libre (panel y servidor)', w.creditoLibre(PAC) === 233 && srvCred(s, PAC).general === 233);
    close(T); T.close();
  }

  /* ===== 4. Borrar un plan con pagos: liberarPagos:true; panel viejo → plan_con_pagos sin reintento ===== */
  {
    const s = servidor(); const PAC = 'Au Plan Con Pagos';
    const plan = () => ({ id: 'au-pp-1', nombre: 'ORTODONCIA', fecha: '2026-10-01', estado: 'activo', prof: 'Dra. Mirna', total: 3000, cuotas: [], notas: '', sesiones: [{ n: 1, desc: 'Etapa 1', precio: 1500 }, { n: 2, desc: 'Etapa 2', precio: 1500 }] });
    s.handle({ action: 'pac', registro: { nombre: PAC, med: {}, planes: [plan()] } });
    s.handle({ action: 'save', registro: at({ id: 'au-pg-1', fecha: '2026-10-02', paciente: PAC, estado: 'Anticipo', servicios: [], total: 0, acuenta: 300, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 300 }], planId: 'au-pp-1', anticipoPor: 'Recepción' }) });
    s.handle({ action: 'save', registro: at({ id: 'au-pg-2', fecha: '2026-10-05', paciente: PAC, estado: 'Anticipo', servicios: [], total: 0, acuenta: 400, saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 400 }], planId: 'au-pp-1', anticipoPor: 'Recepción' }) });
    const T = await panel(s); const w = T.w;
    /* a) un panel viejo (sin liberarPagos) manda la ficha sin el plan: el servidor lo frena y la cola no insiste */
    const conPlan = clone(w.PAC[w.keyPac(PAC)]), sinPlan = clone(conPlan); sinPlan.planes = [];
    w.queue('pac', sinPlan, conPlan); const nPac0 = s.calls('pac').length;
    await w.flushQueue(); await T.tick(400);
    const ultimo = s.calls('pac').slice(-1)[0];
    OK('4a sin liberarPagos el servidor responde plan_con_pagos (2 pagos, Bs 700)', s.calls('pac').length === nPac0 + 1 && ultimo.body.liberarPagos !== true && s.ctx.doList().pacientes[0].planes.length === 1);
    OK('4a la cola no reintenta, avisa y el plan vuelve a verse', w.pend().length === 0 && /No se borró el plan: tiene 2 pagos por Bs 700/.test(T.toast()) && w.planesDe(PAC).length === 1, T.toast());
    await w.flushQueue(); await T.tick(200);
    OK('4a ...y no lo volvió a mandar', s.calls('pac').length === nPac0 + 1);
    /* b) «🗑 Borrar plan» de este panel: avisa cuántos pagos y manda liberarPagos:true */
    T.dialogs.confirmAnswer = true; w.borrarPlan(PAC, 'au-pp-1'); await T.tick(400);
    const conf = T.dialogs.confirm.slice(-1)[0] || '', pac2 = s.calls('pac').slice(-1)[0];
    OK('4b el confirm dice «Tiene 2 pagos al plan por Bs 700» y que quedan como saldo a favor libre', /Tiene 2 pagos al plan por Bs 700/.test(conf) && /saldo a favor libre/.test(conf), conf);
    OK('4b la ficha viajó con liberarPagos:true y el servidor borró el plan', pac2 && pac2.body.liberarPagos === true && pac2.body.action === 'pac' && s.ctx.doList().pacientes[0].planes.length === 0 && w.pend().length === 0, pac2 && { liberarPagos: pac2.body.liberarPagos });
    OK('4b los 700 quedan libres (panel y servidor)', w.creditoLibre(PAC) === 700 && srvCred(s, PAC).general === 700, srvCred(s, PAC));
    const corr = s.ctx.hojaCorr(); const ult = corr.getRange(corr.getLastRow(), 1, 1, 11).getValues()[0];
    OK('4b queda anotado en _Correcciones', /Plan borrado con pagos/.test(String(ult[9])), ult[9]);
    close(T); T.close();
  }

  /* ===== 5. Vender un paquete cuando se atiende una CITA (EDIT_ID = la cita) ===== */
  async function citaPaquete(paga, hoy, cons) {
    const s = servidor(); const PAC = 'Au Cita Paquete ' + paga + (hoy ? 'h' : 'n') + (cons ? 'c' : '');
    const T = await panel(s); const w = T.w;
    w.CFG.planesTipo = [{ nombre: 'BLANQUEAMIENTO', total: 700, paquete: true, deClinica: true, sesiones: ['s1', 's2', 's3'], etapas: [{ desc: 'BLANQUEAMIENTO · sesión 1', cant: 1, precio: 234 }, { desc: 'BLANQUEAMIENTO · sesión 2', cant: 1, precio: 233 }, { desc: 'BLANQUEAMIENTO · sesión 3', cant: 1, precio: 233 }], cuotas: null }];
    w.saveCfg(); await T.tick(100);
    const cita = { id: 'au-cita-1', clinicaId: w.CLINICA_ID, ts: new Date().toISOString(), fecha: HOY, hora: '10:00', nroDia: 1, profesional: 'Dra. Mirna', paciente: PAC, celular: '70000004', estado: 'Agendada', origen: 'Programada', agendaPor: 'WhatsApp', servicios: [], total: 0, acuenta: 0, saldo: 0, metodo: '', pagos: [], cobrosPosteriores: [], canal: 'Instagram', tipo: 'Nuevo' };
    w.DATA.push(cita); w.persist(cita); await T.tick(200);
    w.resolverCita('au-cita-1', 'Atendido'); await T.tick(100);
    T.setVal('#f-cel', '70000004'); T.radio('canal', w.CFG.canales[0]);
    w.venderPaqueteForm(0); await T.tick(50);
    const abre = !!T.$('#vp-paga');
    T.checkbox('#vp-hoy', hoy); if (T.$('#vp-cons')) T.checkbox('#vp-cons', !!cons); if (cons) T.setVal('#vp-cons-p', '150'); w.vpCambio();
    w.vpPaga(paga); w.setRadio('vp-met', 'QR'); w.vpCambio();
    w.vpOk(); await T.tick(50);
    T.click('#btn-save'); await T.tick(600);
    let paso = 0;
    while (T.modalOpen() && paso < 4) {
      const mt = T.modalText().replace(/\s+/g, ' ');
      const bs = Array.prototype.slice.call(T.$$('#modal button'));
      const b = bs.filter(x => /Sí|sesión 1|Pasar|Guardar/.test(x.textContent))[0] || bs[0];
      if (!b || /WhatsApp|Cerrar/.test(mt.slice(0, 40))) break;
      b.click(); await T.tick(800); paso++;
    }
    if (T.modalOpen()) w.closeModal();
    await T.tick(1200);
    const atn = w.DATA.filter(r => r.paciente === PAC && r.estado === 'Atendido'), an = w.DATA.filter(r => r.paciente === PAC && r.estado === 'Anticipo'), p = w.planesDe(PAC)[0];
    const srv = s.handle({ action: 'list' }).registros.filter(r => r.paciente === PAC);
    close(T); T.close();
    return { abre, at: atn, an, p, w, srv, cita: w.DATA.filter(r => r.id === 'au-cita-1')[0], libre: w.creditoLibre(PAC), srvLibre: srvCred(s, PAC).general, pend: w.pend().length };
  }
  {
    let r = await citaPaquete(850, true, true);
    OK('5 cita + 850/hoy/consulta: la cita queda como atención de 384 pagada, 466 al paquete, sesión 1 hecha', r.abre && r.at.length === 1 && r.at[0].id === 'au-cita-1' && r.at[0].total === 384 && r.at[0].acuenta === 384 && r.an.length === 1 && r.an[0].acuenta === 466 && r.p && r.p.sesiones[0].hecha && r.pend === 0, { at: r.at.map(x => [x.id, x.total, x.acuenta]), an: r.an.map(x => x.acuenta) });
    r = await citaPaquete(850, true, false);
    OK('5 cita + 850/hoy/sin consulta (paga 150 de más): se guarda; sesión 1 de 234, 616 al paquete y 150 quedan libres', r.at.length === 1 && r.at[0].total === 234 && r.at[0].acuenta === 234 && r.an.length === 1 && r.an[0].acuenta === 616 && r.p && r.p.sesiones[0].hecha && r.libre === 150 && r.srvLibre === 150, { at: r.at.map(x => [x.total, x.acuenta, x.saldo]), an: r.an.map(x => x.acuenta), libre: r.libre, srvLibre: r.srvLibre });
    r = await citaPaquete(700, false, false);
    OK('5 cita + 700/hoy NO se hizo sesión: 700 como pago al paquete, ninguna sesión hecha, la cita queda como visita sin plan y sin precio', r.an.reduce((a, x) => a + x.acuenta, 0) === 700 && r.p && !r.p.sesiones.some(x => x.hecha) && r.at.length === 1 && !r.at[0].planId && r.at[0].total === 0 && r.at[0].acuenta === 0 && !r.w.DATA.some(x => x.id === 'au-cita-1' && x.estado === 'Agendada'), { at: r.at.map(x => [x.total, x.acuenta, x.planId ? 'plan' : '', (x.servicios || []).map(s => s.nom).join('/')]), an: r.an.map(x => x.acuenta), ses: r.p && r.p.sesiones.map(x => !!x.hecha) });
    OK('5 ...y en la hoja también (sin cola pendiente)', r.srv.filter(x => x.estado === 'Anticipo').reduce((a, x) => a + x.acuenta, 0) === 700 && r.srv.filter(x => x.estado === 'Atendido').length === 1 && r.pend === 0, r.srv.map(x => [x.estado, x.total, x.acuenta]));
    r = await citaPaquete(150, true, true);
    OK('5 cita + 150/hoy/consulta: atención 384 con 150 pagados, debe 234, sin anticipo', r.at.length === 1 && r.at[0].total === 384 && r.at[0].acuenta === 150 && r.at[0].saldo === 234 && r.an.length === 0 && r.p && r.p.sesiones[0].hecha, r.at.map(x => [x.total, x.acuenta, x.saldo]));
  }

  /* ===== 6. Cambiar de plan una sesión pagada con el adelanto: se frena ===== */
  {
    const s = servidor(); const PAC = 'Au Cambio De Plan';
    const pl = (id, nom) => ({ id, nombre: nom, fecha: '2026-10-01', estado: 'activo', prof: 'Dra. Mirna', total: 200, cuotas: [], notas: '', sesiones: [{ n: 1, desc: nom + ' · sesión 1', precio: 100 }, { n: 2, desc: nom + ' · sesión 2', precio: 100 }] });
    s.handle({ action: 'pac', registro: { nombre: PAC, med: {}, planes: [pl('au-plA', 'Plan A'), pl('au-plB', 'Plan B')] } });
    s.handle({ action: 'save', registro: at({ id: 'au-anA', fecha: '2026-10-01', paciente: PAC, estado: 'Anticipo', servicios: [], total: 0, acuenta: 100, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 100 }], planId: 'au-plA', anticipoPor: 'Recepción' }) });
    const T = await panel(s); const w = T.w;
    w.atencionDePlan(PAC, 'au-plA', 1); await T.tick(50);
    T.setVal('#ap-fecha', '2026-10-05'); if (T.$('#ap-prof').tagName === 'SELECT') T.setVal('#ap-prof', 'Dra. Mirna');
    w.guardarAtencionPlan(); await T.tick(400);
    const v = w.DATA.filter(r => r.planId === 'au-plA' && r.estado === 'Atendido')[0];
    OK('6 la sesión 1 de A se pagó con los 100 adelantados', v && v.acuenta === 100 && w.usoSaldoDe(v) === 100 && w.creditoPara(PAC, 'au-plA') === 0, v && v.pagos);
    w.closeModal(); w.editarId(v.id); await T.tick(50);
    T.setVal('#f-plan', 'au-plB'); await T.tick(50); T.click('#btn-save'); await T.tick(400);
    let v2 = w.DATA.filter(r => r.id === v.id)[0];
    OK('6 cambiarla al plan B se frena con el aviso de corregir el cobro', /se pagó con el adelanto del plan «Plan A»: para moverla, primero corregí el cobro/.test(T.toast()) && v2.planId === 'au-plA', T.toast());
    T.setVal('#f-plan', ''); await T.tick(50); T.click('#btn-save'); await T.tick(400);
    v2 = w.DATA.filter(r => r.id === v.id)[0];
    OK('6 sacarla del plan («visita suelta») también se frena', /se pagó con el adelanto del plan «Plan A»/.test(T.toast()) && v2.planId === 'au-plA', T.toast());
    OK('6 los bolsillos siguen sanos (A usado, nada libre) y el servidor igual', w.creditosEn(w.DATA, PAC).general === 0 && !(w.creditosEn(w.DATA, PAC).planes['au-plA'] > 0) && srvCred(s, PAC).general === 0, srvCred(s, PAC));
    /* editarla sin tocar el plan (una nota) sí se puede */
    T.setVal('#f-plan', 'au-plA'); T.setVal('#f-obs', 'nota nueva'); T.click('#btn-save'); await T.tick(400);
    OK('6 editarla sin cambiar el plan sigue andando', /Atención actualizada/.test(T.toast()) && w.DATA.filter(r => r.id === v.id)[0].obs === 'nota nueva', T.toast());
    close(T); T.close();
  }

  /* ===== 7. Una doctora borra su sesión: la ficha sale DESPUÉS del delete (con Google tardando) ===== */
  {
    const s = servidor(); const PAC = 'Au Borrar Sesion';
    const plan = { id: 'au-pb-1', nombre: 'BLANQUEAMIENTO', fecha: '2026-10-01', estado: 'activo', prof: '', deClinica: true, paquete: true, total: 700, cuotas: [], notas: '', sesiones: [{ n: 1, desc: 's1', precio: 234 }, { n: 2, desc: 's2', precio: 233 }, { n: 3, desc: 's3', precio: 233 }] };
    s.handle({ action: 'pac', registro: { nombre: PAC, med: {}, planes: [plan] } });
    s.handle({ action: 'save', registro: at({ id: 'au-pb-a1', fecha: '2026-10-01', profesional: '', paciente: PAC, estado: 'Anticipo', servicios: [], total: 0, acuenta: 700, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 700 }], planId: 'au-pb-1', anticipoPor: 'Recepción' }) });
    s.handle({ action: 'cfg', cfg: Object.assign({}, s.ctx.leerCfg() || {}, { prof: ['Dra. Mirna', 'Dra. Shirley'], precios: [{ cat: 'G', nom: 'Limpieza dental', precio: 100, lab: 0 }], canales: ['Instagram'], ts: new Date().toISOString() }) });
    s.latency = 250;
    const T = await panel(s, 'au-shirley-1'); const w = T.w;
    OK('7 entró la doctora', w.ROL === 'doctora' && w.PROF_ACTUAL === 'Dra. Shirley', [w.ROL, w.PROF_ACTUAL]);
    w.atencionDePlan(PAC, 'au-pb-1', 1); await T.tick(50);
    T.setVal('#ap-fecha', HOY); w.guardarAtencionPlan(); await T.tick(1500);
    const v1 = w.DATA.filter(r => r.planId === 'au-pb-1' && r.estado === 'Atendido')[0];
    const ses0 = s.ctx.doList().pacientes[0].planes[0].sesiones[0];
    OK('7 la sesión 1 quedó marcada en la hoja con su atención (pagada con el adelanto)', v1 && w.usoSaldoDe(v1) === 234 && ses0.hecha && ses0.atencionId === v1.id && w.pend().length === 0, ses0);
    const n0 = s.log.length;
    T.dialogs.confirmAnswer = true; w.borrar(v1.id); await T.tick(1500);
    const desp = s.log.slice(n0).map(x => x.action);
    OK('7 al servidor llegó primero el delete y recién después la ficha (pac)', desp.indexOf('delete') >= 0 && desp.indexOf('pac') > desp.indexOf('delete'), desp);
    const fin = s.ctx.doList(), s1 = fin.pacientes[0].planes[0].sesiones[0];
    OK('7 la atención quedó borrada, la plata volvió al plan (700) y no quedó nada en la cola', !fin.registros.some(r => r.id === v1.id) && srvCred(s, PAC).planes['au-pb-1'] === 700 && w.pend().length === 0, { cred: srvCred(s, PAC) });
    PEND('7 el servidor acepta que la doctora libere su sesión después del delete (plata-5 B: doGuardarPac/planesSinTocarAjenos, lo arregla el otro agente)', !s1.hecha && !s1.atencionId, s1);
    close(T); T.close();
  }

  /* ===== 8. Rechazos nuevos del servidor en la cola: sin reintento, aviso claro ===== */
  {
    const s = servidor();
    s.handle({ action: 'save', registro: at({ id: 'au-cc-1', fecha: '2026-10-10', paciente: 'Au Cobro Cambio', metodo: 'QR', pagos: [{ metodo: 'QR', monto: 100 }] }) });
    const T = await panel(s); const w = T.w;
    /* cobro_cambio: cambiar QR → Efectivo con un guardado común */
    w.editarId('au-cc-1'); await T.tick(50); T.radio('metodo', 'Efectivo'); T.click('#btn-save'); await T.tick(500);
    const cc = w.DATA.filter(r => r.id === 'au-cc-1')[0], ccSrv = s.handle({ action: 'list' }).registros.filter(r => r.id === 'au-cc-1')[0];
    OK('8 cobro_cambio: no se reintenta, vuelve lo del servidor (QR) y avisa «Corregir cobro»', w.pend().length === 0 && cc.pagos[0].metodo === 'QR' && ccSrv.pagos[0].metodo === 'QR' && /Para cambiar cómo se pagó usá ✏️ Corregir cobro/.test(T.toast()), T.toast());
    /* cfg_no_guardada con «too large» */
    s.respuestaForzada = (b) => b.action === 'cfg' ? { ok: false, error: 'cfg_no_guardada', detalle: 'Exception: Argument too large: value' } : null;
    w.CFG.metaMes = 12345; w.saveCfg(); await w.flushQueue(); await T.tick(300);
    OK('8 cfg_no_guardada: sale de la cola y el aviso dice que la configuración es demasiado grande', w.pend().length === 0 && /La configuración no se guardó en la nube: la configuración es demasiado grande/.test(T.toast()), T.toast());
    /* id_invalido en un alta */
    s.respuestaForzada = (b) => b.action === 'save' ? { ok: false, error: 'id_invalido', id: b.registro && b.registro.id } : null;
    const nuevo = w.normalize(at({ id: 'au-inv-1', paciente: 'Au Id Invalido' })); w.DATA.push(nuevo); w.persist(nuevo); await T.tick(400);
    OK('8 id_invalido: sin reintento, la fila se saca de este aparato y se avisa', w.pend().length === 0 && !w.DATA.some(r => r.id === 'au-inv-1') && /identificador inválido/.test(T.toast()), T.toast());
    /* clave_de_fabrica en un borrado */
    s.respuestaForzada = (b) => b.action === 'delete' ? { ok: false, error: 'clave_de_fabrica' } : null;
    T.dialogs.confirmAnswer = true; w.borrar('au-cc-1'); await T.tick(500);
    OK('8 clave_de_fabrica: sin reintento, avisa que la dueña ponga su clave y la atención vuelve', w.pend().length === 0 && /clave de fábrica/.test(T.toast()) && w.DATA.some(r => r.id === 'au-cc-1'), T.toast());
    /* nombre_ocupado y plan_con_pagos como rechazos sueltos de la cola */
    s.respuestaForzada = (b) => b.action === 'pac' ? { ok: false, error: 'nombre_ocupado', nombre: 'x' } : null;
    const f = w.pacDe('Au Cobro Cambio'); f.nombre = 'Au Cobro Cambio'; f.med.notas = 'nota'; w.savePac(f); await T.tick(400);
    OK('8 nombre_ocupado: sin reintento y aviso', w.pend().length === 0 && /Ya hay otro paciente con ese nombre/.test(T.toast()), T.toast());
    s.respuestaForzada = null;
    close(T); T.close();
  }

  /* ===== 9. Renombrar a un nombre que ya es de otra persona ===== */
  {
    const s = servidor();
    s.handle({ action: 'save', registro: at({ id: 'au-rq-1', fecha: '2026-09-01', paciente: 'Au Rosa Quispe', celular: '70000011' }) });
    s.handle({ action: 'save', registro: at({ id: 'au-rq-2', fecha: '2026-10-01', paciente: 'Au Rosa Quispe Mamani', celular: '70000012' }) });
    s.handle({ action: 'save', registro: at({ id: 'au-rq-3', fecha: '2026-10-02', paciente: 'Au Maria Perez', celular: '70000013' }) });
    const T = await panel(s); const w = T.w;
    OK('9 el panel sabe que el servidor renombra', w.srvRenombra());
    /* a) la otra persona está cargada en este aparato: la ventana ya ofrece unir y manda unir:true */
    w.corregirNombre('Au Rosa Quispe'); await T.tick(50);
    T.setVal('#cn-nom', 'Au Rosa Quispe Mamani'); w.cnVer();
    OK('9a la ventana avisa «Ya hay un paciente» y el botón pasa a «unir y corregir»', /Ya hay un paciente «Au Rosa Quispe Mamani»/.test(T.$('#cn-info').textContent) && /unir y corregir/.test(T.$('#cn-ok').textContent));
    const nR0 = s.calls('renombrar').length; w.cnOk(); await T.tick(500);
    const rn = s.calls('renombrar').slice(-1)[0];
    OK('9a viajó con unir:true y el servidor unió las dos historias', s.calls('renombrar').length === nR0 + 1 && rn.body.renombre.unir === true && s.ctx.doList().registros.filter(r => r.paciente === 'Au Rosa Quispe Mamani').length === 2 && !s.ctx.doList().registros.some(r => r.paciente === 'Au Rosa Quispe'), rn.body.renombre);
    w.closeModal();
    /* b) la otra persona existe solo en la hoja (la cargó otro equipo recién): el servidor dice nombre_ocupado, no se une solo */
    s.handle({ action: 'save', registro: at({ id: 'au-rq-4', fecha: '2026-10-03', paciente: 'Au Juana Flores', celular: '70000014' }) });
    w.corregirNombre('Au Maria Perez'); await T.tick(50);
    T.setVal('#cn-nom', 'Au Juana Flores'); w.cnVer();
    OK('9b este aparato no la tiene: ofrece «Corregir nombre» a secas', /Corregir nombre/.test(T.$('#cn-ok').textContent) && !/unir/.test(T.$('#cn-ok').textContent));
    const nR1 = s.calls('renombrar').length; w.cnOk(); await T.tick(500);
    const rn2 = s.calls('renombrar').slice(-1)[0];
    OK('9b viajó sin unir, el servidor contestó nombre_ocupado y no cambió nada', s.calls('renombrar').length === nR1 + 1 && rn2.body.renombre.unir === false && s.ctx.doList().registros.some(r => r.paciente === 'Au Maria Perez') && s.ctx.doList().registros.filter(r => r.paciente === 'Au Juana Flores').length === 1, rn2.body.renombre);
    OK('9b avisa «Ya hay otro paciente con ese nombre» y vuelve a la ventana, ahora ofreciendo unir', /Ya hay otro paciente con ese nombre/.test(T.toast()) && T.modalOpen() && !!T.$('#cn-nom') && /unir y corregir/.test(T.$('#cn-ok').textContent) && /no está cargado en este aparato/.test(T.$('#cn-info').textContent), [T.toast(), T.$('#cn-ok') && T.$('#cn-ok').textContent]);
    w.cnOk(); await T.tick(500);
    const rn3 = s.calls('renombrar').slice(-1)[0];
    OK('9b la dueña elige unir: viaja unir:true y quedan unidas', rn3.body.renombre.unir === true && s.ctx.doList().registros.filter(r => r.paciente === 'Au Juana Flores').length === 2 && !s.ctx.doList().registros.some(r => r.paciente === 'Au Maria Perez'), rn3.body.renombre);
    close(T); T.close();
  }

  console.log((fallas ? 'FALLAS: ' + fallas : 'TODO OK') + (pendientes ? ' · PENDIENTES (bloque MODERNO / servidor): ' + pendientes : '')); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
