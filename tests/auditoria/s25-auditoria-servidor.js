'use strict';
/* s25: los 18 hallazgos de la auditoría del 29/10 en el servidor (versión
   2026-10-29-auditoria). .gs real en memoria, sesiones de prueba, datos
   ficticios, sin red. Corre en las dos clínicas: PANEL=spa | PANEL=cos. */
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const GS = process.env.GSFILE || path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const MIA = SPA ? 'spadental' : 'cosmetic';
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(78), x === undefined ? '' : JSON.stringify(x).slice(0, 260)); };
const clone = x => JSON.parse(JSON.stringify(x));
console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');

/* un servidor limpio con la dueña, recepción y dos doctoras */
function nuevo() {
  const s = gsServer(GS); s.shimClaves = false; s.sesionDirecta = false;
  const v = s.ctx.leerVerif(); v.admin = s.ctx.shaHex('t-duena'); v.equipo = s.ctx.shaHex('t-equipo');
  v.prof = { 'Dra. A': s.ctx.shaHex('t-a'), 'Dra. B': s.ctx.shaHex('t-b') }; s.ctx.guardarVerif(v);
  const tok = k => { const r = s.handle({ action: 'login', clave: k }, { panel: true }); if (!r.ok) throw new Error('login ' + k + ' ' + JSON.stringify(r)); return r.token; };
  s.T = { D: tok('t-duena'), A: tok('t-a'), B: tok('t-b'), E: tok('t-equipo') };
  s.H = (t, b) => s.handle(Object.assign({ token: t }, b), { panel: true });
  s.lista = (t) => s.H(t || s.T.D, { action: 'list' });
  s.reg = (id) => (s.lista().registros || []).find(r => r.id === id);
  s.ficha = (n) => (s.lista().pacientes || []).find(p => p.nombre === n);
  s.cred = (n) => s.ctx.creditosSrv(s.ctx.fClavePac(n));
  s.corr = () => { const sh = s.ctx.getSpreadsheet().getSheetByName('_Correcciones'); return sh ? sh._rows.slice(1) : []; };
  return s;
}
let n = 0;
const at = (o) => Object.assign({ id: 'at' + (++n) + 'x', clinicaId: MIA, ts: '2026-10-20T10:00:00.000Z', fecha: '2026-10-20', hora: '10:00', estado: 'Atendido', profesional: 'Dra. A', paciente: 'Pac Uno', celular: '70000000',
  servicios: [{ nom: 'Consulta', cant: 1, precio: 100 }], total: 100, acuenta: 100, saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 100 }], cobrosPosteriores: [], cobroInicialFechado: true }, o);
const anticipo = (o) => at(Object.assign({ estado: 'Anticipo', servicios: [], total: 0, saldo: 0, anticipoPor: 'Dueña', profesional: '' }, o));
const plan = (id, precio, k, extra) => Object.assign({ id, nombre: 'Plan ' + id, fecha: '2026-10-01', estado: 'activo', prof: 'Dra. A', total: precio * (k || 2), cuotas: [], notas: '',
  sesiones: Array.from({ length: k || 2 }, (_, i) => ({ n: i + 1, desc: 'Sesión ' + (i + 1), precio })) }, extra || {});

/* ---------- 0. versión y marcas ---------- */
{
  const s = nuevo();
  OK('0 VERSION_SCRIPT 2026-10-29-auditoria', s.ctx.VERSION_SCRIPT === '2026-10-29-auditoria' && s.handle({ action: 'info' }, { panel: true }).version === '2026-10-29-auditoria');
  OK('0 login devuelve auditoria:true', s.handle({ action: 'login', clave: 't-duena' }, { panel: true }).auditoria === true);
  s.H(s.T.D, { action: 'cfg', cfg: { precios: [], canales: ['X'], prof: ['Dra. A'] } });
  OK('0 cfgPublica lleva auditoria:true y no se guarda en la config', s.H(s.T.D, { action: 'cfgGet' }).cfg.auditoria === true && s.ctx.leerCfg().auditoria === undefined && s.ctx.leerCfg().renombrar === undefined);
}

/* ---------- 1. ids válidos ---------- */
{
  const s = nuevo();
  const malos = ['<img src=x>', 'a"b', 'a.b', 'x'.repeat(61), '=1+1', 'a b', 123];
  OK('1 save rechaza ids raros con id_invalido', malos.every(id => s.H(s.T.D, { action: 'save', registro: at({ id }), base: null }).error === 'id_invalido'));
  OK('1 ids legítimos pasan (uid, importados con sufijo)', ['a' + Date.now().toString(36) + 'k3f9q', 'xc0001', 'amv0123-p19901015', 'at9x'].every(id => s.H(s.T.D, { action: 'save', registro: at({ id }), base: null }).ok));
  OK('1 nada raro quedó en la hoja', !s.lista().registros.some(r => /[^A-Za-z0-9_-]/.test(String(r.id))));
  OK('1 bulk con un id raro se rechaza entero', s.H(s.T.D, { action: 'bulk', registros: [at({ id: 'bulk1x' }), at({ id: '<b>' })] }).error === 'id_invalido' && !s.reg('bulk1x'));
  OK('1 delete con id raro', s.H(s.T.D, { action: 'delete', registro: { id: '<svg onload=1>' } }).error === 'id_invalido');
  OK('1 pac: plan con id raro', s.H(s.T.D, { action: 'pac', registro: { nombre: 'Pac Plan', med: {}, planes: [plan('<x>', 100)] }, base: null }).error === 'id_invalido');
  const pl = plan('planok1', 100); pl.sesiones[0] = Object.assign(pl.sesiones[0], { hecha: true, fecha: '2026-10-01', atencionId: 'a"b' });
  OK('1 pac: sesión con atencionId raro', s.H(s.T.D, { action: 'pac', registro: { nombre: 'Pac Plan', med: {}, planes: [pl] }, base: null }).error === 'id_invalido');
  OK('1 pac: plan e ids sanos pasan', s.H(s.T.D, { action: 'pac', registro: { nombre: 'Pac Plan', med: {}, planes: [plan('planok1', 100)] }, base: null }).ok);
  const r = s.reg('at9x');
  OK('1 corregirCobro: id e idem raros', s.H(s.T.D, { action: 'corregirCobro', correccion: { id: '<x>', idem: 'cc01', motivo: 'motivo largo', monto: 50, pagos: null } }).error === 'id_invalido' &&
    s.H(s.T.D, { action: 'corregirCobro', correccion: { id: r.id, idem: 'c c', motivo: 'motivo largo', monto: 50, pagos: null } }).error === 'id_invalido');
  OK('1 pasarAlPlan: id raro', s.H(s.T.D, { action: 'pasarAlPlan', pase: { id: '<x>', idem: 'pp01', planId: 'planok1', servicios: [{ nom: 'S', precio: 1 }] } }).error === 'id_invalido');
  OK('1 fotos: id raro al ver/cambiar/borrar y al cargar', ['fotoVer', 'fotoCambiar', 'fotoBorrar'].every(a => s.H(s.T.D, { action: a, consulta: { id: '<x>' } }).error === 'id_invalido') &&
    s.H(s.T.D, { action: 'foto', foto: { paciente: 'Pac Uno', datos: 'AAAA', id: 'a b' } }).error === 'id_invalido');
}

/* ---------- 2. configuración partida en trozos, cfg_no_guardada, clave antes/después ---------- */
{
  const s = nuevo();
  const cfg0 = { v: 4, prof: ['Dra. A'], canales: ['WhatsApp'], precios: [{ cat: 'G', nom: 'Limpieza', precio: 100, lab: 0 }], metaMes: 1000, ts: '2026-10-20T00:00:00Z', plantillasWa: [] };
  for (let i = 0; i < 40; i++) cfg0.plantillasWa.push({ k: 'p' + i, t: 'Hola {nombre}, te recordamos tu cita el {fecha} a las {hora}. Traé tu carnet y llegá 10 minutos antes. '.repeat(6) });
  const bytes = JSON.stringify(cfg0).length;
  const r = s.H(s.T.D, { action: 'cfg', cfg: cfg0 });
  const K = s.ctx.K_CFG, p = s.props;
  OK('2 una cfg de ' + bytes + ' bytes se guarda partida (trozos de 8.000)', r.ok && Number(p[K + '_n']) >= 3 && p[K].length === 8000 && p[K + '_2'].length === 8000 && !p[K + '_' + (Number(p[K + '_n']) + 1)], [p[K + '_n'], p[K].length]);
  OK('2 ningún trozo pasa los 9 KB', Object.keys(p).filter(k => k.indexOf(K) === 0).every(k => p[k].length <= 9000));
  OK('2 se lee entera y vuelve por cfgGet', JSON.stringify(s.ctx.leerCfg().plantillasWa) === JSON.stringify(cfg0.plantillasWa) && s.H(s.T.D, { action: 'cfgGet' }).cfg.plantillasWa.length === 40);
  const nAntes = Number(p[K + '_n']);
  OK('2 una cfg chica después borra los trozos que sobraban', s.H(s.T.D, { action: 'cfg', cfg: Object.assign({}, cfg0, { plantillasWa: [] }) }).ok && p[K + '_n'] === '1' && !(K + '_2' in p) && !(K + '_' + nAntes in p), Object.keys(p).filter(k => k.indexOf(K) === 0));
  /* compatibilidad: una config vieja, en una sola propiedad y sin _n */
  delete p[K + '_n']; p[K] = JSON.stringify({ precios: [{ nom: 'Vieja', precio: 1 }], canales: ['X'] });
  OK('2 una config vieja (sin _n) se sigue leyendo', s.ctx.leerCfg().precios[0].nom === 'Vieja');
  OK('2 RENOMBRES_DIAS = 3', s.ctx.RENOMBRES_DIAS === 3);
  const grande = Object.assign({}, cfg0, { plantillasWa: [] }); for (let i = 0; i < 400; i++) grande.plantillasWa.push({ k: 'g' + i, t: 'x'.repeat(600) });
  OK('2 más de 200.000 caracteres: cfg_muy_grande', s.H(s.T.D, { action: 'cfg', cfg: grande }).error === 'cfg_muy_grande');
  /* Google no deja escribir: la respuesta lo dice y la clave no cambia a medias */
  s.H(s.T.D, { action: 'cfg', cfg: cfg0 });
  const ps = s.ctx.PropertiesService.getScriptProperties;
  s.ctx.PropertiesService.getScriptProperties = () => { const o = ps(); const sp = o.setProperty; o.setProperty = (k, v) => { if (k.indexOf(K) === 0) throw new Error('Exception: Argument too large: value'); return sp(k, v); }; return o; };
  const rf = s.H(s.T.D, { action: 'cfg', cfg: cfg0 });
  OK('2 si falla la escritura: cfg_no_guardada con detalle', rf.error === 'cfg_no_guardada' && /too large/.test(rf.detalle), rf);
  const vAntes = s.ctx.leerVerif().equipo;
  const rc = s.H(s.T.D, { action: 'clave', quien: 'equipo', clave: 'nueva-clave-equipo' });
  OK('2 cambiar clave con la cfg que no se guarda: error y el verificador NO cambió', rc.error === 'cfg_no_guardada' && s.ctx.leerVerif().equipo === vAntes, rc.error);
  s.ctx.PropertiesService.getScriptProperties = ps;
  const rc2 = s.H(s.T.D, { action: 'clave', quien: 'equipo', clave: 'nueva-clave-equipo' });
  OK('2 con la cfg sana la clave cambia y la cfg guardada lleva el hash nuevo', rc2.ok && s.ctx.leerVerif().equipo === s.ctx.shaHex('nueva-clave-equipo') && s.ctx.leerCfg().passHash === s.ctx.shaHex('nueva-clave-equipo') && s.handle({ action: 'login', clave: 'nueva-clave-equipo' }, { panel: true }).rol === 'equipo');
}

/* ---------- 3. cambiar el paciente de una atención pagada con saldo a favor ---------- */
{
  const s = nuevo();
  s.H(s.T.D, { action: 'save', registro: anticipo({ paciente: 'Pac Con Anticipo', acuenta: 100, pagos: [{ metodo: 'Efectivo', monto: 100 }] }), base: null });
  const r = s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Pac Con Anticipo', metodo: 'Saldo a favor', pagos: [{ metodo: 'Saldo a favor', monto: 100 }] }), base: null });
  OK('3 la atención usa los 100 de saldo a favor', r.ok && !r.ajusteFavor && r.registro.acuenta === 100);
  const e = s.H(s.T.D, { action: 'save', registro: Object.assign(clone(r.registro), { paciente: 'Pac Sin Nada' }), base: r.registro });
  OK('3 al pasarla a un paciente sin saldo, se recorta: ajusteFavor 100, queda debiendo 100', e.ok && e.ajusteFavor === 100 && e.registro.paciente === 'Pac Sin Nada' && e.registro.acuenta === 0 && e.registro.saldo === 100, [e.ajusteFavor, e.registro && e.registro.acuenta]);
  OK('3 el crédito del primer paciente vuelve a 100 y no se puede gastar dos veces', s.ctx.creditoPacienteSrv(s.ctx.fClavePac('Pac Con Anticipo')) === 100 && s.ctx.creditoPacienteSrv(s.ctx.fClavePac('Pac Sin Nada')) === 0);
  /* si el paciente nuevo sí tiene saldo, se usa el suyo */
  s.H(s.T.D, { action: 'save', registro: anticipo({ paciente: 'Pac Con Otro', acuenta: 60, pagos: [{ metodo: 'QR', monto: 60 }] }), base: null });
  const r2 = s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Pac Con Anticipo', metodo: 'Saldo a favor', pagos: [{ metodo: 'Saldo a favor', monto: 100 }] }), base: null });
  const e2 = s.H(s.T.D, { action: 'save', registro: Object.assign(clone(r2.registro), { paciente: 'Pac Con Otro' }), base: r2.registro });
  OK('3 con saldo en el paciente nuevo (60): usa 60 y debe 40', e2.ok && e2.ajusteFavor === 40 && e2.registro.acuenta === 60 && e2.registro.saldo === 40 && s.cred('Pac Con Otro').general === 0, [e2.ajusteFavor, e2.registro && e2.registro.acuenta]);
}

/* ---------- 4. plan borrado con pagos al plan ---------- */
{
  const s = nuevo();
  const f0 = s.H(s.T.D, { action: 'pac', registro: { nombre: 'Pac Paq', med: {}, planes: [plan('plan-x1', 400, 4, { total: 1650 })] }, base: null }).paciente;
  s.H(s.T.D, { action: 'save', registro: anticipo({ paciente: 'Pac Paq', acuenta: 1650, pagos: [{ metodo: 'Efectivo', monto: 1650 }], planId: 'plan-x1' }), base: null });
  s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Pac Paq', total: 400, servicios: [{ nom: 'Sesión', cant: 1, precio: 400 }], acuenta: 400, metodo: 'Saldo a favor', pagos: [{ metodo: 'Saldo a favor', monto: 400 }], planId: 'plan-x1', planEtapa: 1 }), base: null });
  OK('4 antes: bolsillo del plan 1.250', s.cred('Pac Paq').planes['plan-x1'] === 1250, s.cred('Pac Paq'));
  const sin = clone(f0); sin.planes = [];
  const r1 = s.H(s.T.D, { action: 'pac', registro: sin, base: f0 });
  OK('4 quitar el plan sin confirmar: plan_con_pagos con planId, pagos y monto', r1.error === 'plan_con_pagos' && r1.planId === 'plan-x1' && r1.pagos === 1 && r1.monto === 1650, r1);
  OK('4 el plan sigue en la ficha', s.ficha('Pac Paq').planes.length === 1);
  OK('4 una doctora no quita un plan con pagos: sin_permiso', s.H(s.T.A, { action: 'pac', registro: sin, base: f0, liberarPagos: true }).error === 'sin_permiso' && s.ficha('Pac Paq').planes.length === 1);
  const r2 = s.H(s.T.D, { action: 'pac', registro: sin, base: f0, liberarPagos: true });
  const fila = s.corr().find(x => /Plan borrado con pagos/.test(String(x[9])));
  OK('4 con liberarPagos:true la dueña lo quita y queda en _Correcciones', r2.ok && s.ficha('Pac Paq').planes.length === 0 && fila && /Bs 1650 quedan como saldo a favor libre/.test(fila[9]) && /Dueña/.test(fila[10]), fila && fila[9]);
  OK('4 lo que quedaba del plan pasa a saldo a favor libre', s.cred('Pac Paq').general === 1250 && !s.cred('Pac Paq').planes['plan-x1'], s.cred('Pac Paq'));
  /* un plan sin pagos se quita sin preguntar */
  const f1 = s.H(s.T.D, { action: 'pac', registro: { nombre: 'Pac Libre', med: {}, planes: [plan('plan-l1', 100)] }, base: null }).paciente;
  OK('4 un plan sin pagos se quita como siempre', s.H(s.T.D, { action: 'pac', registro: Object.assign(clone(f1), { planes: [] }), base: f1 }).ok);
}

/* ---------- 5. el bolsillo de un plan terminado o cancelado pasa a libre ---------- */
{
  for (const estado of ['terminado', 'cancelado']) {
    const s = nuevo(), PAC = 'Pac ' + estado;
    const pt = plan('plan-t1', 233, 3, { prof: '', deClinica: true, paquete: true, total: 700 }); pt.sesiones[0].precio = 234;
    s.H(s.T.D, { action: 'pac', registro: { nombre: PAC, med: {}, planes: [pt] }, base: null });
    s.H(s.T.D, { action: 'save', registro: anticipo({ paciente: PAC, acuenta: 700, pagos: [{ metodo: 'QR', monto: 700 }], planId: 'plan-t1' }), base: null });
    s.H(s.T.D, { action: 'save', registro: at({ id: 'v01' + estado.slice(0, 1), paciente: PAC, total: 234, servicios: [{ nom: 's1', cant: 1, precio: 234 }], acuenta: 234, metodo: 'Saldo a favor', pagos: [{ metodo: 'Saldo a favor', monto: 234 }], planId: 'plan-t1', planEtapa: 1 }), base: null });
    s.H(s.T.D, { action: 'save', registro: at({ id: 'v02' + estado.slice(0, 1), paciente: PAC, total: 233, servicios: [{ nom: 's2', cant: 1, precio: 233 }], acuenta: 233, metodo: 'Saldo a favor', pagos: [{ metodo: 'Saldo a favor', monto: 233 }], planId: 'plan-t1', planEtapa: 2 }), base: null });
    OK('5 activo: quedan 233 en el bolsillo del plan, 0 libres', s.cred(PAC).planes['plan-t1'] === 233 && s.cred(PAC).general === 0, s.cred(PAC));
    const f = s.ficha(PAC); const f2 = clone(f); f2.planes[0].estado = estado;
    s.H(s.T.D, { action: 'pac', registro: f2, base: f });
    OK('5 plan ' + estado + ': los 233 quedan libres (general)', s.cred(PAC).general === 233 && !s.cred(PAC).planes['plan-t1'], s.cred(PAC));
    const r = s.H(s.T.D, { action: 'save', registro: at({ paciente: PAC, total: 150, servicios: [{ nom: 'Limpieza', cant: 1, precio: 150 }], acuenta: 150, metodo: 'Saldo a favor', pagos: [{ metodo: 'Saldo a favor', monto: 150 }] }), base: null });
    OK('5 y una visita suelta los puede usar', r.ok && !r.ajusteFavor && r.registro.saldo === 0, r.ajusteFavor);
  }
}

/* ---------- 6. consulta + sesión en la misma atención: misma cuenta que el panel ---------- */
{
  const s = nuevo(), PAC = 'Pac Consulta Y Sesion';
  const p1 = plan('plan-p1', 233, 3, { prof: '', deClinica: true, paquete: true, total: 700 }); p1.sesiones[0] = { n: 1, desc: 'sesión 1', precio: 234, hecha: true, fecha: '2026-10-01', atencionId: 'v01x' };
  s.H(s.T.D, { action: 'pac', registro: { nombre: PAC, med: {}, planes: [p1] }, base: null });
  s.H(s.T.D, { action: 'save', registro: at({ id: 'v01x', paciente: PAC, servicios: [{ nom: 'Consulta', cant: 1, precio: 150 }, { nom: 'BLANQUEAMIENTO', det: 'sesión 1 de 3', cant: 1, precio: 234 }], total: 384, acuenta: 384, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 384 }], planId: 'plan-p1', planEtapa: 1 }), base: null });
  s.H(s.T.D, { action: 'save', registro: anticipo({ id: 'a01x', paciente: PAC, acuenta: 466, pagos: [{ metodo: 'QR', monto: 466 }], planId: 'plan-p1' }), base: null });
  const c = s.cred(PAC);
  OK('6 consulta 150 + sesión 234 pagadas + 466 adelantados → {general:0, planes:{plan-p1:466}}', c.general === 0 && c.planes['plan-p1'] === 466, c);
  const r = s.H(s.T.D, { action: 'save', registro: at({ paciente: PAC, fecha: '2026-10-05', total: 150, servicios: [{ nom: 'Limpieza', cant: 1, precio: 150 }], acuenta: 150, metodo: 'Saldo a favor', pagos: [{ metodo: 'Saldo a favor', monto: 150 }] }), base: null });
  OK('6 una visita suelta no puede usar lo del plan: ajusteFavor 150', r.ok && r.ajusteFavor === 150 && r.registro.saldo === 150, [r.ajusteFavor, r.registro && r.registro.saldo]);
  /* pago parcial: lo cobrado paga primero la consulta y después la sesión */
  const s2 = nuevo(), P2 = 'Pac Parcial';
  s2.H(s2.T.D, { action: 'pac', registro: { nombre: P2, med: {}, planes: [plan('plan-q1', 200, 2)] }, base: null });
  s2.H(s2.T.D, { action: 'save', registro: at({ paciente: P2, servicios: [{ nom: 'Consulta', cant: 1, precio: 150 }, { nom: 'Sesión', cant: 1, precio: 200 }], total: 350, acuenta: 250, saldo: 100, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 250 }], planId: 'plan-q1', planEtapa: 1 }), base: null });
  s2.H(s2.T.D, { action: 'save', registro: anticipo({ paciente: P2, acuenta: 400, pagos: [{ metodo: 'QR', monto: 400 }], planId: 'plan-q1' }), base: null });
  OK('6 cobro parcial 250 de 350: a la sesión le tocan 100; del adelanto (400) sobran 100 libres', s2.cred(P2).planes['plan-q1'] === 300 && s2.cred(P2).general === 100, s2.cred(P2));
  /* sesión sin precio (plan viejo): cuenta todo lo cobrado, como antes */
  const s3 = nuevo(), P3 = 'Pac Plan Viejo';
  s3.H(s3.T.D, { action: 'pac', registro: { nombre: P3, med: {}, planes: [plan('plan-v1', 0, 2, { total: 300 })] }, base: null });
  s3.H(s3.T.D, { action: 'save', registro: at({ paciente: P3, total: 200, servicios: [{ nom: 'Sesión', cant: 1, precio: 200 }], acuenta: 200, pagos: [{ metodo: 'Efectivo', monto: 200 }], planId: 'plan-v1', planEtapa: 1 }), base: null });
  s3.H(s3.T.D, { action: 'save', registro: anticipo({ paciente: P3, acuenta: 150, pagos: [{ metodo: 'QR', monto: 150 }], planId: 'plan-v1' }), base: null });
  OK('6 plan viejo sin precios: 200 + 150 contra 300 → 50 libres', s3.cred(P3).planes['plan-v1'] === 100 && s3.cred(P3).general === 50, s3.cred(P3));
}

/* ---------- 7. un pendiente con base null no pisa el descuento ni el perdón ---------- */
{
  const s = nuevo();
  const r0 = s.H(s.T.D, { action: 'save', registro: at({ servicios: [{ nom: 'Limpieza', cant: 1, precio: 200 }], total: 200, acuenta: 100, saldo: 100 }), base: null }).registro;
  const conDesc = s.H(s.T.D, { action: 'save', registro: Object.assign(clone(r0), { total: 170, saldo: 70 }), base: r0 }).registro;
  OK('7 el servidor tiene descuento 30 (total 170)', conDesc.total === 170 && conDesc.saldo === 70);
  const r = s.H(s.T.D, { action: 'save', registro: Object.assign(clone(r0), { obs: 'pendiente de otra pantalla' }), base: null });
  OK('7 un pendiente viejo (total 200, base null) no pisa el descuento: sigue 170 / 70 y trae la nota', r.ok && r.registro.total === 170 && r.registro.saldo === 70 && r.registro.obs === 'pendiente de otra pantalla', [r.registro.total, r.registro.saldo]);
  const r2 = s.H(s.T.D, { action: 'save', registro: Object.assign(clone(r0), { total: 150, saldo: 50 }), base: null });
  OK('7 si el que llega trae un descuento mayor (50), gana ese: 150 / 50', r2.ok && r2.registro.total === 150 && r2.registro.saldo === 50, [r2.registro.total, r2.registro.saldo]);
  const s2 = nuevo();
  const q0 = s2.H(s2.T.D, { action: 'save', registro: at({ servicios: [{ nom: 'Limpieza', cant: 1, precio: 200 }], total: 200, acuenta: 100, saldo: 100 }), base: null }).registro;
  s2.H(s2.T.D, { action: 'save', registro: Object.assign(clone(q0), { saldo: 0 }), base: q0 });
  const q = s2.H(s2.T.D, { action: 'save', registro: Object.assign(clone(q0), { obs: 'x' }), base: null });
  OK('7 tampoco pisa el perdón: el saldo sigue en 0', q.ok && q.registro.saldo === 0 && q.registro.acuenta === 100, q.registro.saldo);
}

/* ---------- 8. aislamiento de doctora también al editar y al borrar ---------- */
{
  const s = nuevo();
  s.H(s.T.D, { action: 'save', registro: at({ id: 'miaA1', paciente: 'Paciente De A', profesional: 'Dra. A' }), base: null });
  s.H(s.T.D, { action: 'save', registro: at({ id: 'deB01', paciente: 'Paciente De B', profesional: 'Dra. B', obs: 'secreto de B' }), base: null });
  const mia = s.reg('miaA1'); const mov = clone(mia); mov.paciente = 'Paciente De B';
  OK('8a Dra. A no mueve su visita a un paciente de B', s.H(s.T.A, { action: 'save', registro: mov, base: mia }).error === 'sin_permiso' && s.reg('miaA1').paciente === 'Paciente De A');
  OK('8a sí la mueve a un paciente nuevo (de nadie)', s.H(s.T.A, { action: 'save', registro: Object.assign(clone(mia), { paciente: 'Paciente Nuevo' }), base: mia }).ok);
  const cita = at({ id: 'citaB1', paciente: 'Paciente De B', profesional: 'Por definir', estado: 'Agendada', acuenta: 0, pagos: [], saldo: 100, metodo: '', fecha: '2026-11-05' });
  s.H(s.T.D, { action: 'save', registro: cita, base: null });
  const g = s.reg('citaB1'); const m = Object.assign(clone(g), { profesional: 'Dra. A', estado: 'Atendido', acuenta: 100, pagos: [{ metodo: 'Efectivo', monto: 100 }], metodo: 'Efectivo', saldo: 0 });
  OK('8b Dra. A no atiende la cita «Por definir» de un paciente de B', s.H(s.T.A, { action: 'save', registro: m, base: g }).error === 'sin_permiso' && s.reg('citaB1').estado === 'Agendada');
  OK('8b Dra. B sí la atiende', s.H(s.T.B, { action: 'save', registro: Object.assign(clone(m), { profesional: 'Dra. B' }), base: g }).ok);
  const citaN = at({ id: 'citaN1', paciente: 'Paciente Nadie', profesional: 'Por definir', estado: 'Agendada', acuenta: 0, pagos: [], saldo: 100, metodo: '', fecha: '2026-11-06' });
  s.H(s.T.D, { action: 'save', registro: citaN, base: null });
  const gn = s.reg('citaN1');
  OK('8b la cita «Por definir» de un paciente de nadie la toma cualquiera', s.H(s.T.A, { action: 'save', registro: Object.assign(clone(gn), { profesional: 'Dra. A', estado: 'Atendido', acuenta: 100, pagos: [{ metodo: 'Efectivo', monto: 100 }], metodo: 'Efectivo', saldo: 0 }), base: gn }).ok);
  const ga = s.reg('citaN1');
  OK('8c Dra. A no deja su visita sin doctora ni a nombre de otra', s.H(s.T.A, { action: 'save', registro: Object.assign(clone(ga), { profesional: '' }), base: ga }).error === 'sin_permiso' &&
    s.H(s.T.A, { action: 'save', registro: Object.assign(clone(ga), { profesional: 'Dra. B' }), base: ga }).error === 'sin_permiso' && s.reg('citaN1').profesional === 'Dra. A');
  OK('8c la dueña sí puede reasignarla', s.H(s.T.D, { action: 'save', registro: Object.assign(clone(ga), { profesional: 'Dra. B' }), base: ga }).ok);
  const cita2 = at({ id: 'citaB2', paciente: 'Paciente De B', profesional: 'Por definir', estado: 'Agendada', acuenta: 0, pagos: [], saldo: 0, metodo: '', fecha: '2026-11-07' });
  s.H(s.T.D, { action: 'save', registro: cita2, base: null });
  OK('8 delete: Dra. A no borra la cita «Por definir» de un paciente de B', s.H(s.T.A, { action: 'delete', registro: { id: 'citaB2' }, base: null }).error === 'sin_permiso' && !!s.reg('citaB2'));
  OK('8 delete: Dra. B sí', s.H(s.T.B, { action: 'delete', registro: { id: 'citaB2' }, base: null }).ok && !s.reg('citaB2'));
  OK('8 la ficha y las fotos del paciente de B siguen cerradas para A', s.H(s.T.A, { action: 'pac', registro: { nombre: 'Paciente De B', med: { alergias: 'x' }, planes: [] }, base: null }).error === 'sin_permiso');
  /* la misma cita de un paciente de nadie atendida por dos doctoras sigue siendo dos visitas */
  const s2 = nuevo();
  s2.H(s2.T.D, { action: 'save', registro: anticipo({ paciente: 'Pac Compartido', acuenta: 100, pagos: [{ metodo: 'Efectivo', monto: 100 }] }), base: null });
  const c0 = s2.H(s2.T.D, { action: 'save', registro: at({ id: 'citaC1', paciente: 'Pac Compartido', profesional: 'Por definir', estado: 'Agendada', acuenta: 0, pagos: [], saldo: 0, metodo: '', servicios: [], total: 0 }), base: null }).registro;
  const ma = Object.assign(clone(c0), { profesional: 'Dra. A', estado: 'Atendido', servicios: [{ nom: 'X', cant: 1, precio: 100 }], total: 100, acuenta: 100, pagos: [{ metodo: 'Efectivo', monto: 100 }], metodo: 'Efectivo', saldo: 0 });
  const mb = Object.assign(clone(ma), { profesional: 'Dra. B' });
  const ra = s2.H(s2.T.A, { action: 'save', registro: ma, base: c0 }), rb = s2.H(s2.T.B, { action: 'save', registro: mb, base: c0 });
  OK('8 cita compartida de un paciente de nadie: la segunda doctora queda como visita separada', ra.ok && rb.ok && rb.separada && rb.separada.profesional === 'Dra. B', rb.error);
}

/* ---------- 9. cambiar la forma de pago exige corrección (cobro_cambio) ---------- */
{
  const s = nuevo();
  const g = s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Pepe Caja' }), base: null }).registro;
  const r1 = s.H(s.T.A, { action: 'save', registro: Object.assign(clone(g), { metodo: 'QR', pagos: [{ metodo: 'QR', monto: 100 }] }), base: g });
  OK('9 Efectivo 100 → QR 100 con un save: cobro_cambio y devuelve el registro', r1.error === 'cobro_cambio' && r1.registro && r1.registro.id === g.id && s.reg(g.id).pagos[0].metodo === 'Efectivo', r1.error);
  OK('9 Efectivo 100 → Efectivo 50 + QR 50: cobro_cambio', s.H(s.T.D, { action: 'save', registro: Object.assign(clone(g), { metodo: 'Mixto', pagos: [{ metodo: 'Efectivo', monto: 50 }, { metodo: 'QR', monto: 50 }] }), base: g }).error === 'cobro_cambio');
  s.H(s.T.D, { action: 'save', registro: anticipo({ paciente: 'Pepe Caja', acuenta: 100, pagos: [{ metodo: 'Efectivo', monto: 100 }] }), base: null });
  OK('9 Efectivo 100 → «Saldo a favor» 100: cobro_cambio', s.H(s.T.D, { action: 'save', registro: Object.assign(clone(g), { metodo: 'Saldo a favor', pagos: [{ metodo: 'Saldo a favor', monto: 100 }] }), base: g }).error === 'cobro_cambio');
  const aA = Object.assign(clone(g), { estado: 'Anticipo', anticipoPor: 'Dueña', servicios: [], total: 0, saldo: 0 });
  OK('9 una atención cobrada no pasa a Anticipo con un save', s.H(s.T.D, { action: 'save', registro: aA, base: g }).error === 'cobro_cambio' && s.reg(g.id).estado === 'Atendido');
  const an = s.H(s.T.D, { action: 'save', registro: anticipo({ paciente: 'Lola Credito', acuenta: 100, pagos: [{ metodo: 'Efectivo', monto: 100 }] }), base: null }).registro;
  OK('9 ni un anticipo pasa a Atendido', s.H(s.T.D, { action: 'save', registro: Object.assign(clone(an), { estado: 'Atendido', servicios: [{ nom: 'X', cant: 1, precio: 100 }], total: 100 }), base: an }).error === 'cobro_cambio');
  /* sumar un pago nuevo del día (cobro posterior) sí pasa: lo del día de la atención no cambia */
  const suma = Object.assign(clone(g), { acuenta: 350, total: 350, saldo: 0, servicios: g.servicios.concat([{ nom: 'Limpieza', cant: 1, precio: 250 }]), metodo: 'Mixto',
    pagos: [{ metodo: 'Efectivo', monto: 100 }, { metodo: 'QR', monto: 250 }], cobrosPosteriores: [{ id: 'cp001', fecha: '2026-10-21', metodo: 'QR', monto: 250 }] });
  const rs = s.H(s.T.D, { action: 'save', registro: suma, base: g });
  OK('9 editar sumando un pago (cobro posterior de hoy) sigue pasando', rs.ok && rs.registro.acuenta === 350 && rs.registro.cobrosPosteriores.length === 1, rs.error);
  /* completar una forma de pago vacía sí pasa */
  const sf = s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Sin Forma', metodo: '', pagos: [] }), base: null }).registro;
  OK('9 «Sin forma de pago → Completar»: pasa', s.H(s.T.D, { action: 'save', registro: Object.assign(clone(sf), { metodo: 'QR', pagos: [{ metodo: 'QR', monto: 100 }] }), base: sf }).ok);
  const viejo = s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Fila Vieja', metodo: 'Efectivo', pagos: [] }), base: null }).registro;
  OK('9 una fila vieja con solo «metodo»: cambiarlo también es cobro_cambio', s.H(s.T.D, { action: 'save', registro: Object.assign(clone(viejo), { metodo: 'QR', pagos: [{ metodo: 'QR', monto: 100 }] }), base: viejo }).error === 'cobro_cambio');
  const cita = s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Cita Cobra', estado: 'Agendada', acuenta: 0, saldo: 100, metodo: '', pagos: [] }), base: null }).registro;
  OK('9 una cita que se atiende y cobra: pasa', s.H(s.T.D, { action: 'save', registro: Object.assign(clone(cita), { estado: 'Atendido', acuenta: 100, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 100 }] }), base: cita }).ok);
}

/* ---------- 10. sesión repetida también entre filas (sin la marca en la ficha) ---------- */
{
  const s = nuevo(), PAC = 'Pac Carrera';
  const pc = plan('plan-c1', 233, 3, { prof: '', deClinica: true, paquete: true, total: 700 }); pc.sesiones[0] = { n: 1, desc: 's1', precio: 234, hecha: true, fecha: '2026-10-01', atencionId: 'v01x' };
  s.H(s.T.D, { action: 'pac', registro: { nombre: PAC, med: {}, planes: [pc] }, base: null });
  s.H(s.T.D, { action: 'save', registro: at({ id: 'v01x', paciente: PAC, total: 234, servicios: [{ nom: 's1', cant: 1, precio: 234 }], acuenta: 234, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 234 }], planId: 'plan-c1', planEtapa: 1 }), base: null });
  const ses2 = id => at({ id, paciente: PAC, fecha: '2026-10-10', total: 233, servicios: [{ nom: 's2', cant: 1, precio: 233 }], acuenta: 233, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 233 }], planId: 'plan-c1', planEtapa: 2 });
  const rA = s.H(s.T.D, { action: 'save', registro: ses2('vA1x'), base: null }), rB = s.H(s.T.D, { action: 'save', registro: ses2('vB1x'), base: null });
  OK('10 pantalla A marca la sesión 2', rA.ok);
  OK('10 pantalla B, la misma sesión 2 antes de que llegue la ficha: sesion_repetida con fecha y atencionId de A', !rB.ok && rB.error === 'sesion_repetida' && rB.etapa === 2 && rB.atencionId === 'vA1x' && rB.fecha === '2026-10-10', rB);
  OK('10 no quedó guardada', !s.reg('vB1x'));
  OK('10 el reintento de A (misma fila) pasa', s.H(s.T.D, { action: 'save', registro: ses2('vA1x'), base: null }).ok);
  OK('10 la sesión 3 pasa', s.H(s.T.D, { action: 'save', registro: Object.assign(ses2('vC1x'), { planEtapa: 3 }), base: null }).ok);
  OK('10 editar A (una nota) pasa', s.H(s.T.D, { action: 'save', registro: Object.assign(clone(s.reg('vA1x')), { obs: 'nota' }), base: s.reg('vA1x') }).ok);
  OK('10 la etapa como texto «2» también se detecta', s.H(s.T.D, { action: 'save', registro: Object.assign(ses2('vD1x'), { planEtapa: '2' }), base: null }).error === 'sesion_repetida');
}

/* ---------- 11. clave de fábrica ---------- */
{
  const s = nuevo(); const v = s.ctx.leerVerif(); v.admin = s.ctx.ADMIN_FABRICA; s.ctx.guardarVerif(v);
  const TF = s.ctx.nuevaSesion({ rol: 'admin', prof: '', h: s.ctx.ADMIN_FABRICA, fabrica: true });
  const g = s.H(TF, { action: 'save', registro: at({ paciente: 'Fab Caja' }), base: null });
  s.H(TF, { action: 'egreso', registro: { id: 'egr01', clinicaId: MIA, fecha: '2026-10-20', monto: 5, concepto: 'x' }, base: null });
  OK('11 con clave de fábrica se atiende, se guarda ficha, egreso, cierre y se lee', g.ok && s.H(TF, { action: 'pac', registro: { nombre: 'Fab Caja', med: {}, planes: [] }, base: null }).ok &&
    s.H(TF, { action: 'cierre', registro: { fecha: '2026-10-20', contado: 1, esperado: 1 } }).ok && s.H(TF, { action: 'list' }).ok && s.reg('egr01') === undefined && s.H(TF, { action: 'list' }).egresos.length === 1);
  const bloq = {
    renombrar: s.H(TF, { action: 'renombrar', renombre: { de: 'Fab Caja', a: 'Fab Caja Dos', idem: 'rn001' } }).error,
    delete: s.H(TF, { action: 'delete', registro: { id: g.registro.id }, base: null }).error,
    egresoDel: s.H(TF, { action: 'egresoDel', registro: { id: 'egr01' }, base: null }).error,
    bulk: s.H(TF, { action: 'bulk', registros: [at({})] }).error,
    corregirCobro: s.H(TF, { action: 'corregirCobro', correccion: { id: g.registro.id, idem: 'cc001', motivo: 'motivo largo', monto: 50, pagos: null } }).error,
    pasarAlPlan: s.H(TF, { action: 'pasarAlPlan', pase: { id: g.registro.id, idem: 'pp001', planId: 'plan001', servicios: [{ nom: 'S', precio: 1 }] } }).error };
  OK('11 renombrar, delete, egresoDel, bulk, corregirCobro y pasarAlPlan: clave_de_fabrica', Object.keys(bloq).every(k => bloq[k] === 'clave_de_fabrica'), bloq);
  const lf = s.H(TF, { action: 'list' }), rf = (lf.registros || []).find(x => x.id === g.registro.id);
  OK('11 nada se borró ni cambió', !!rf && rf.paciente === 'Fab Caja' && lf.egresos.length === 1 && s.ctx.leerVerif().admin === s.ctx.ADMIN_FABRICA, [!!rf, lf.egresos.length]);
  /* cambiar la clave sí: es la única forma de dejar la de fábrica */
  const rc = s.H(TF, { action: 'clave', quien: 'admin', clave: 'clave-propia-123' });
  OK('11 con la clave de fábrica la dueña SÍ puede poner la suya', rc.ok && s.ctx.leerVerif().admin === s.ctx.shaHex('clave-propia-123') && s.handle({ action: 'login', clave: 'clave-propia-123' }, { panel: true }).fabrica === false, rc);
  OK('11 y la sesión de fábrica vieja ya no sirve', s.H(TF, { action: 'list' }).error === 'sin_sesion');
}

/* ---------- 12. pasarAlPlan respeta CORRIGEN ---------- */
{
  const s = nuevo();
  s.H(s.T.D, { action: 'pac', registro: { nombre: 'Pac Pase', med: {}, planes: [plan('plan-pq1', 250, 3, { total: 700 })] }, base: null });
  const r0 = s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Pac Pase', servicios: [{ nom: 'Blanq', cant: 1, precio: 700 }], total: 700, acuenta: 700, pagos: [{ metodo: 'Efectivo', monto: 700 }] }), base: null }).registro;
  const pase = idem => ({ id: r0.id, idem, planId: 'plan-pq1', servicios: [{ nom: 'Sesión 1', cant: 1, precio: 250 }], etapa: 1, version: { acuenta: 700, ncp: 0 } });
  const rA = s.H(s.T.A, { action: 'pasarAlPlan', pase: pase('pp-a1') }), rE = s.H(s.T.E, { action: 'pasarAlPlan', pase: pase('pp-e1') });
  OK('12 una doctora no pasa al paquete (CORRIGEN=' + JSON.stringify(s.ctx.CORRIGEN) + ')', rA.error === 'sin_permiso');
  OK('12 recepción: ' + (SPA ? 'sin_permiso en Spadental' : 'sí en Cosmetic'), SPA ? rE.error === 'sin_permiso' : (rE.ok && rE.movido === 450), rE.error || rE.movido);
  if (SPA) OK('12 la dueña sí', s.H(s.T.D, { action: 'pasarAlPlan', pase: pase('pp-d1') }).ok);
}

/* ---------- 13. la clave de pauta recibe solo lo que necesita ---------- */
{
  const s = nuevo(); s.ctx.VERIF_PAUTA = s.ctx.shaHex('t-pauta-s25');
  s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Paciente De B', profesional: 'Dra. B', celular: '70011122', ci: '1234567', obs: 'nota clínica', proxMotivo: 'control', presu: [{ nom: 'x' }], canal: 'Facebook', tipo: 'Nuevo' }), base: null });
  s.H(s.T.D, { action: 'pac', registro: { nombre: 'Paciente De B', nac: '1990-01-01', med: { alergias: 'Penicilina', notas: 'nota médica' }, planes: [{ id: 'plan-e1', nombre: 'Endodoncia', total: 900, estado: 'activo', prof: 'Dra. B', sesiones: [{ n: 1, desc: 'Conducto 16', hecha: false, precio: 900 }], cuotas: [], notas: 'privado' }] }, base: null });
  const TP = s.handle({ action: 'login', clave: 't-pauta-s25' }, { panel: true }).token;
  const lp = s.H(TP, { action: 'list' }); const rp = lp.registros[0], pp = lp.pacientes[0];
  OK('13 pauta: la atención llega sin obs, celular, ci, proxMotivo, presu ni correccionesCobro', lp.ok && rp.obs === '' && rp.celular === '' && rp.ci === '' && rp.proxMotivo === '' && rp.presu === '' && !rp.correccionesCobro, [rp.obs, rp.celular, rp.ci, rp.proxMotivo]);
  OK('13 pauta: pero sí lo que mide la pauta (fecha, paciente, canal, tipo, total, estado)', rp.fecha === '2026-10-20' && rp.paciente === 'Paciente De B' && rp.canal === 'Facebook' && rp.tipo === 'Nuevo' && rp.total === 100 && rp.estado === 'Atendido');
  OK('13 pauta: la ficha solo trae nombre, planes y ts', JSON.stringify(Object.keys(pp).sort()) === JSON.stringify(['nombre', 'planes', 'ts']) && pp.nombre === 'Paciente De B', Object.keys(pp));
  const pl = pp.planes[0];
  OK('13 pauta: el plan sin desc, prof ni notas; sesiones con n, hecha, fecha y precio', JSON.stringify(Object.keys(pl).sort()) === JSON.stringify(['estado', 'id', 'nombre', 'sesiones', 'total']) && JSON.stringify(Object.keys(pl.sesiones[0]).sort()) === JSON.stringify(['fecha', 'hecha', 'n', 'precio']), pl);
  const ld = s.lista();
  OK('13 la dueña sigue viendo todo', ld.registros[0].obs === 'nota clínica' && ld.registros[0].celular === '70011122' && ld.pacientes[0].med.alergias === 'Penicilina' && ld.pacientes[0].planes[0].sesiones[0].desc === 'Conducto 16');
}

/* ---------- 14. intentos fallidos por clave, no globales ---------- */
{
  const s = nuevo(); let t = Date.parse('2026-10-20T10:00:00Z'); s.reloj = () => t;
  for (let i = 0; i < 14; i++) s.handle({ action: 'login', clave: 'vieja-en-un-celular' }, { panel: true });
  OK('14 con 14 fallas la misma clave todavía responde clave_incorrecta', s.handle({ action: 'login', clave: 'vieja-en-un-celular' }, { panel: true }).error === 'clave_incorrecta');
  OK('14 a la 15 esa clave queda bloqueada', s.handle({ action: 'login', clave: 'vieja-en-un-celular' }, { panel: true }).error === 'muchos_intentos');
  OK('14 ...y la dueña, la doctora y otra clave mala siguen entrando normal', s.handle({ action: 'login', clave: 't-duena' }, { panel: true }).ok && s.handle({ action: 'login', clave: 't-a' }, { panel: true }).ok && s.handle({ action: 'login', clave: 'otra-mala' }, { panel: true }).error === 'clave_incorrecta');
  OK('14 el contador vive en LOGIN_FALLAS_<prefijo> y no en uno global', Object.keys(s.cacheMem).some(k => /^LOGIN_FALLAS_[0-9a-f]{8}$/.test(k)) && !('LOGIN_FALLAS' in s.cacheMem));
  t += 11 * 60000;
  OK('14 a los 10 min se libera', s.handle({ action: 'login', clave: 'vieja-en-un-celular' }, { panel: true }).error === 'clave_incorrecta');
  for (let i = 0; i < 15; i++) s.H(s.T.E, { action: 'clave', quien: 'equipo', clave: 'nueva-larga', vieja: 'mal-recordada' });
  OK('14 recepción equivocando su clave vieja 15 veces se bloquea a sí misma, no a la dueña', s.H(s.T.E, { action: 'clave', quien: 'equipo', clave: 'nueva-larga', vieja: 'mal-recordada' }).error === 'muchos_intentos' && s.handle({ action: 'login', clave: 't-duena' }, { panel: true }).ok);
}

/* ---------- 15. fórmulas: un texto que empieza con «=» no se ejecuta ---------- */
{
  const s = nuevo();
  const r = s.H(s.T.D, { action: 'save', registro: at({ paciente: '=1+1', obs: '=HYPERLINK("http://x";"clic")', canalDetalle: '=IMPORTXML(1)' }), base: null });
  const fila = s.ctx.getSheet()._rows.find(x => x[0] === r.registro.id);
  OK('15 atención: en la hoja va con apóstrofo y vuelve tal cual', fila[6] === "'=1+1" && fila[23].indexOf("'=") === 0 && fila[12] === "'=IMPORTXML(1)" && r.registro.paciente === '=1+1' && s.reg(r.registro.id).obs === '=HYPERLINK("http://x";"clic")', [fila[6], fila[23]]);
  OK('15 nada en la hoja de atenciones empieza con «=»', !s.ctx.getSheet()._rows.some(x => x.some(c => typeof c === 'string' && c.charAt(0) === '=')));
  const p = s.H(s.T.D, { action: 'pac', registro: { nombre: '=SUM(A1:A9)', med: { alergias: '=x', notas: '=y' }, planes: [] }, base: null });
  const fp = s.ctx.getSheetPac()._rows[1];
  OK('15 ficha: nombre y alergias protegidos y leídos bien', fp[0] === "'=SUM(A1:A9)" && fp[2] === "'=x" && p.paciente.nombre === '=SUM(A1:A9)' && s.ficha('=SUM(A1:A9)').med.alergias === '=x', [fp[0], fp[2]]);
  const e = s.H(s.T.D, { action: 'egreso', registro: { id: 'egr01', clinicaId: MIA, fecha: '2026-10-20', monto: 5, detalle: '=cmd', proveedor: '=x' }, base: null });
  OK('15 egreso', s.ctx.getSheetEgr()._rows[1][3] === "'=cmd" && e.registro.detalle === '=cmd' && s.lista().egresos[0].proveedor === '=x');
  const c = s.H(s.T.D, { action: 'cierre', registro: { fecha: '2026-10-20', contado: 1, esperado: 1, nota: '=rm', quien: '=yo' } });
  OK('15 cierre', s.ctx.getSheetCierres()._rows[1][5] === "'=rm" && c.cierre.nota === '=rm' && c.cierres[0].quien === '=yo');
  s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Juan Normal' }), base: null });
  const rn = s.H(s.T.D, { action: 'renombrar', renombre: { de: 'Juan Normal', a: '=Juan', idem: 'rn001' } });
  OK('15 renombrar a un nombre con «=» también se protege', rn.ok && s.ctx.getSheet()._rows.some(x => x[6] === "'=Juan") && s.lista().registros.some(x => x.paciente === '=Juan'));
}

/* ---------- 16. renombrar: no_existe antes de escribir, nombre_ocupado / unir, doctora no une ---------- */
{
  const s = nuevo();
  s.H(s.T.D, { action: 'save', registro: at({ paciente: 'ana lopez' }), base: null });
  s.H(s.T.D, { action: 'pac', registro: { nombre: 'ana lopez', med: {}, planes: [] }, base: null });
  const r3 = s.H(s.T.D, { action: 'renombrar', renombre: { de: 'Nadie Existe', a: 'Ana López', idem: 'rn003' } });
  OK('16a de=inexistente: no_existe y NO reescribe nada', r3.error === 'no_existe' && s.lista().registros[0].paciente === 'ana lopez' && s.lista().pacientes[0].nombre === 'ana lopez' && s.corr().length === 0);
  s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Juan Perez' }), base: null });
  s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Juan Perez', profesional: 'Dra. B' }), base: null });
  s.H(s.T.D, { action: 'pac', registro: { nombre: 'Juan Perez', med: { alergias: 'Penicilina' }, planes: [] }, base: null });
  s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Juan Pérez Gómez', profesional: 'Dra. B' }), base: null });
  s.H(s.T.D, { action: 'pac', registro: { nombre: 'Juan Pérez Gómez', med: { alergias: 'Látex' }, planes: [] }, base: null });
  const r = s.H(s.T.D, { action: 'renombrar', renombre: { de: 'Juan Perez', a: 'Juan Pérez Gómez', idem: 'rn004' } });
  OK('16b «a» ya es otra persona y no se pidió unir: nombre_ocupado con nombre y filas', r.error === 'nombre_ocupado' && r.nombre === 'Juan Pérez Gómez' && r.filas === 1, r);
  OK('16b nada cambió', s.lista().registros.filter(x => x.paciente === 'Juan Perez').length === 2 && s.lista().pacientes.length === 3 && s.corr().length === 0);
  OK('16b solo con ficha ocupada (sin filas) también pide unir', (() => { s.H(s.T.D, { action: 'pac', registro: { nombre: 'Solo Ficha', med: {}, planes: [] }, base: null }); const x = s.H(s.T.D, { action: 'renombrar', renombre: { de: 'ana lopez', a: 'Solo Ficha', idem: 'rn005' } }); return x.error === 'nombre_ocupado' && x.filas === 0; })());
  const ru = s.H(s.T.D, { action: 'renombrar', renombre: { de: 'Juan Perez', a: 'Juan Pérez Gómez', idem: 'rn004', unir: true } });
  OK('16b con unir:true se unen las historias', ru.ok && ru.unidos === true && s.lista().registros.filter(x => x.paciente === 'Juan Pérez Gómez').length === 3 && /Penicilina/.test(s.ficha('Juan Pérez Gómez').med.alergias) && /Látex/.test(s.ficha('Juan Pérez Gómez').med.alergias));
  OK('16 un cambio de grafía (mismo paciente) no pide unir', s.H(s.T.D, { action: 'renombrar', renombre: { de: 'ana lopez', a: 'Ana López', idem: 'rn006' } }).ok);
  const s2 = nuevo();
  s2.H(s2.T.D, { action: 'save', registro: at({ paciente: 'De A', profesional: 'Dra. A' }), base: null });
  s2.H(s2.T.D, { action: 'save', registro: at({ paciente: 'De A Tambien', profesional: 'Dra. A' }), base: null });
  OK('16c una doctora nunca une dos historias (unir:true o no): sin_permiso', s2.H(s2.T.A, { action: 'renombrar', renombre: { de: 'De A', a: 'De A Tambien', idem: 'rn007', unir: true } }).error === 'sin_permiso' && s2.H(s2.T.A, { action: 'renombrar', renombre: { de: 'De A', a: 'De A Tambien', idem: 'rn008' } }).error === 'sin_permiso');
  OK('16c pero sí corrige la grafía de su paciente', s2.H(s2.T.A, { action: 'renombrar', renombre: { de: 'De A', a: 'De Á', idem: 'rn009' } }).ok);
}

/* ---------- 17. fotos de doctora: el permiso se mira una vez por paciente ---------- */
{
  const s = nuevo();
  s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Con Fotos', profesional: 'Dra. A' }), base: null });
  s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Otra Con Fotos', profesional: 'Dra. B' }), base: null });
  for (let i = 0; i < 6; i++) s.H(s.T.D, { action: 'foto', foto: { paciente: i < 4 ? 'Con Fotos' : 'Otra Con Fotos', datos: 'data:image/jpeg;base64,' + Buffer.from('f' + i).toString('base64'), tipo: 'antes' } });
  const orig = s.ctx.pacienteDeOtra; let veces = 0; s.ctx.pacienteDeOtra = function () { veces++; return orig.apply(this, arguments); };
  const f = s.H(s.T.A, { action: 'fotos', consulta: {} });
  OK('17 6 fotos de 2 pacientes: pacienteDeOtra se calcula 2 veces, no 6; A ve solo las 4 suyas', f.ok && f.fotos.length === 4 && veces === 2, [f.fotos.length, veces]);
  veces = 0; const f2 = s.H(s.T.A, { action: 'fotos', consulta: { paciente: 'Con Fotos' } });
  OK('17 por paciente: una sola vez', f2.fotos.length === 4 && veces === 1, veces);
  veces = 0; const fv = s.H(s.T.A, { action: 'fotoVer', consulta: { id: f.fotos[0].id } });
  OK('17 ver una foto: una sola vez, y de un paciente ajeno sin_permiso', fv.ok && veces === 1 && s.H(s.T.A, { action: 'fotoVer', consulta: { id: s.H(s.T.D, { action: 'fotos', consulta: { paciente: 'Otra Con Fotos' } }).fotos[0].id } }).error === 'sin_permiso', veces);
  s.ctx.pacienteDeOtra = orig;
}

/* ---------- 17b. renombrar y después llega otra persona con el nombre viejo ---------- */
{
  const s = nuevo();
  s.H(s.T.D, { action: 'save', registro: at({ paciente: 'Ana Lopez' }), base: null });
  s.H(s.T.D, { action: 'pac', registro: { nombre: 'Ana Lopez', med: { alergias: 'Penicilina' }, planes: [] }, base: null });
  OK('17b renombrar Ana Lopez → Ana Lopez Garcia', s.H(s.T.D, { action: 'renombrar', renombre: { de: 'Ana Lopez', a: 'Ana Lopez Garcia', idem: 'rn17b' } }).ok);
  const viejaVista = s.ficha('Ana Lopez Garcia');
  /* una pantalla vieja guarda la ficha que conocía (con base): va a la corregida */
  const vieja = Object.assign(clone(viejaVista), { nombre: 'Ana Lopez' }); vieja.med.notas = 'desde pantalla vieja';
  const rv = s.H(s.T.D, { action: 'pac', registro: vieja, base: Object.assign(clone(viejaVista), { nombre: 'Ana Lopez' }) });
  OK('17b pantalla vieja con base: va a la ficha corregida', rv.ok && rv.paciente.nombre === 'Ana Lopez Garcia', rv.paciente && rv.paciente.nombre);
  /* otra persona con el nombre viejo: su ficha queda aparte y sus ediciones no se desvían */
  s.H(s.T.D, { action: 'pac', registro: { nombre: 'Ana Lopez', nac: '1990-05-05', med: { alergias: 'Nueces' }, planes: [] }, base: null });
  const nueva = s.ficha('Ana Lopez'); const ed = clone(nueva); ed.med.alergias = 'Nueces, Maní';
  const re = s.H(s.T.D, { action: 'pac', registro: ed, base: nueva });
  OK('17b la persona nueva edita su ficha y queda en la suya', re.ok && re.paciente.nombre === 'Ana Lopez' && /Man/.test(s.ficha('Ana Lopez').med.alergias) && !/Man/.test(s.ficha('Ana Lopez Garcia').med.alergias), [re.paciente && re.paciente.nombre, s.ficha('Ana Lopez Garcia').med.alergias]);
}

/* ---------- 18. cierre con fecha real ---------- */
{
  const s = nuevo();
  OK('18 2026-13-45 y 2026-02-30: fecha_invalida', s.H(s.T.D, { action: 'cierre', registro: { fecha: '2026-13-45', contado: 1, esperado: 1 } }).error === 'fecha_invalida' && s.H(s.T.D, { action: 'cierre', registro: { fecha: '2026-02-30', contado: 1, esperado: 1 } }).error === 'fecha_invalida');
  OK('18 una fecha real pasa', s.H(s.T.D, { action: 'cierre', registro: { fecha: '2026-10-20', contado: 100, esperado: 90 } }).ok);
}

console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
process.exit(fallas ? 1 : 0);
