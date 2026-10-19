'use strict';
const FAB = require('./lib.js').FAB;
/* s10: Corregir cobro + sesiones del servidor v6. Datos ficticios; servidor = el .gs real en
   memoria; netguard bloquea toda red real. */
const { abrir, entrar, R, close, sha, fakeServer } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(66), x === undefined ? '' : JSON.stringify(x)); };
const K = SPA ? { admin: FAB.admin, equipo: FAB.equipo } : { admin: FAB.admin, equipo: FAB.equipo };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer(); server.sesionDirecta = false; const H = b => server.handle(b);
  const hoy = new Date().toISOString().slice(0, 10);
  const hace6 = (() => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10); })();
  // ---- datos ficticios sembrados directo en la planilla simulada (como si existieran de antes)
  const base = { estado: 'Atendido', celular: '70000000', profesional: 'Dra. Mirna', canal: 'Facebook', tipo: 'Recurrente', origen: 'Espontánea', servicios: [{ nom: 'Limpieza dental', cant: 1, precio: 1000 }], cobrosPosteriores: [] };
  server.registros.imp1 = Object.assign({}, base, { id: 'imp1', fecha: hace6, paciente: 'Ficticia Importada', total: 1000, acuenta: 500, saldo: 500, pagos: [], metodo: '', obs: 'importado del cuaderno' });
  server.registros.ef1 = Object.assign({}, base, { id: 'ef1', fecha: hace6, paciente: 'Ficticio Efectivo', total: 1000, acuenta: 300, saldo: 700, pagos: [{ metodo: 'Efectivo', monto: 300 }], metodo: 'Efectivo', cobroInicialFechado: true });
  server.registros.cero1 = Object.assign({}, base, { id: 'cero1', fecha: hace6, paciente: 'Ficticia Cero', total: 1000, acuenta: 200, saldo: 800, pagos: [{ metodo: 'QR', monto: 200 }], metodo: 'QR', cobroInicialFechado: true });
  server.registros.post1 = Object.assign({}, base, { id: 'post1', fecha: hace6, paciente: 'Ficticio Posterior', total: 1000, acuenta: 300, saldo: 700, pagos: [{ metodo: 'Efectivo', monto: 100 }, { metodo: 'QR', monto: 200 }], metodo: 'Mixto', cobroInicialFechado: true,
    cobrosPosteriores: [{ id: 'cp1', fecha: hoy, metodo: 'QR', monto: 200 }] });
  server.registros.ant1 = { id: 'ant1', fecha: hace6, paciente: 'Ficticia Favor', estado: 'Anticipo', profesional: '', total: 0, acuenta: 500, saldo: 0, pagos: [{ metodo: 'Efectivo', monto: 500 }], metodo: 'Efectivo', anticipoPor: 'Recepción', servicios: [], cobrosPosteriores: [] };
  server.registros.fav1 = Object.assign({}, base, { id: 'fav1', fecha: hace6, paciente: 'Ficticia Favor', total: 1000, acuenta: 300, saldo: 700, pagos: [{ metodo: 'Efectivo', monto: 100 }, { metodo: 'Saldo a favor', monto: 200 }], metodo: 'Mixto', cobroInicialFechado: true });

  // ---- C1 escrituras anónimas
  for (const a of ['save', 'delete', 'bulk', 'cfg', 'pac', 'egreso', 'corregirCobro', 'clave'])
    OK('C1 anónimo "' + a + '" rechazado', H({ action: a, registro: { id: 'imp1', acuenta: 0 }, registros: [{ id: 'imp1', acuenta: 0 }], cfg: { precios: [1], canales: [1] } }).error === 'sin_sesion');
  const cg = JSON.stringify(H({ action: 'cfgGet' })) + JSON.stringify(H({ action: 'list' }).cfg);
  OK('C1 cfgGet/list sin hashes de claves', !/adminHash|passHash|clavesProf"/.test(cg) && !/[0-9a-f]{64}/.test(cg));
  OK('C1 leer pacientes sin sesión rechazado', H({ action: 'list' }).error === 'sin_sesion');
  OK('C1 GET ya no devuelve pacientes', !JSON.stringify(server.ctx.doGet({ parameter: {} }).t).includes('Ficticia'));
  OK('C1 login con clave mala', H({ action: 'login', clave: 'no-es' }).error === 'clave_incorrecta');
  const lf = H({ action: 'login', clave: K.admin });
  OK('C2 clave de fábrica entra pero marcada', lf.ok && lf.rol === 'admin' && lf.fabrica === true);
  OK('C2 fábrica no corrige (servidor)', H({ action: 'corregirCobro', token: lf.token, correccion: { id: 'imp1', idem: 'x', motivo: 'prueba larga', monto: 1 } }).error === 'clave_de_fabrica');
  const le = H({ action: 'login', clave: K.equipo });
  OK('C2 bulk de recepción rechazado', H({ action: 'bulk', token: le.token, registros: [{ id: 'imp1' }] }).error === 'sin_permiso');

  // ---- panel de la dueña con clave de fábrica → la cambia
  const A = await abrir({ server }); const w = A.w; const rol = await entrar(A, K.admin);
  await w.pullServer(); await A.tick(700);
  OK('C3 la dueña entra (fábrica) y ve el botón', rol === 'admin' && w.SESION.fabrica === true && w.puedeCorregirCobro(w.DATA.find(r => r.id === 'imp1')));
  w.corregirCobro('imp1'); OK('C3 con clave de fábrica no abre la corrección', /clave de fábrica/.test(A.toast()) && !A.$('#cc-monto')); close(A);
  w.show('config'); A.setVal('#c-pass-admin', 'duena-ficticia-1'); A.click('#btn-save-pass-admin'); await A.tick(80);
  OK('C4 cambia su clave por el servidor', /cambiada/.test(A.toast()) && w.SESION.fabrica === false, A.toast());
  OK('C4 la clave de fábrica ya no entra', H({ action: 'login', clave: K.admin }).error === 'clave_incorrecta');
  OK('C4 la vieja sesión de fábrica quedó inválida', H({ action: 'save', token: lf.token, registro: { id: 'zz' } }).error === 'sin_sesion');

  const corr = async (T, id, monto, met, motivo, mixto) => {
    T.w.corregirCobro(id); if (!T.$('#cc-monto')) return { toast: T.toast() };
    T.setVal('#cc-monto', String(monto)); T.radio('ccmet', met); if (mixto) T.$$('.cc-mx').forEach(i => { T.setVal(i, String(mixto[i.dataset.m] || '')); });
    T.setVal('#cc-motivo', motivo); T.w.revisarCorreccion(); const rev = T.$('#cc-rev').textContent;
    if (!T.$('#cc-ok')) { const t = T.toast(); close(T); return { toast: t, rev }; }
    T.w.confirmarCorreccion(); await T.tick(60); const t = T.toast(); close(T); return { toast: t, rev };
  };
  const caja = (T, f) => T.w.totalCobros(T.w.filasCajaDia(f));
  const c0 = { viejo: caja(A, hace6), hoy: caja(A, hoy) };
  const hoja = () => (server.ctx.getSpreadsheet().getSheetByName('_Correcciones') || { _rows: [] })._rows;

  // ---- C5 importado a la baja, sin dato
  let x = await corr(A, 'imp1', 300, 'Sin dato', 'En el cuaderno se anotó 500 pero pagó 300');
  let s = server.registros.imp1;
  OK('C5 revisar muestra antes → después', /500 → Bs 300/.test(x.rev.replace(/Bs /, '')) || /Bs 500 → Bs 300/.test(x.rev), x.rev.slice(0, 120));
  OK('C5 importado baja a 300 sin inventar forma de pago', s.acuenta === 300 && s.saldo === 700 && s.pagos.length === 0 && !s.metodo, { acuenta: s.acuenta, saldo: s.saldo, pagos: s.pagos, metodo: s.metodo, toast: x.toast });
  OK('C5 historia en la atención', (s.correccionesCobro || []).length === 1 && s.correccionesCobro[0].antes.cobrado === 500 && s.correccionesCobro[0].despues.cobrado === 300 && /Dueña/.test(s.correccionesCobro[0].por), s.correccionesCobro);
  OK('C5 historia aparte en _Correcciones', hoja().length === 2 && hoja()[1][2] === 'imp1' && hoja()[1][9].indexOf('cuaderno') >= 0);
  OK('C5 caja de ese día baja 200 y la de hoy no cambia', caja(A, hace6) === c0.viejo - 200 && caja(A, hoy) === c0.hoy, [c0, caja(A, hace6), caja(A, hoy)]);
  w.verFicha('imp1'); OK('C5 la ficha muestra la corrección', /Correcciones de cobro/.test(A.$('#modal').textContent) && /pero pagó 300/.test(A.$('#modal').textContent)); close(A);

  // ---- C6 al alza en efectivo
  x = await corr(A, 'ef1', 450, 'Efectivo', 'Faltaba anotar 150 en efectivo');
  s = server.registros.ef1;
  OK('C6 sube a 450 en efectivo', s.acuenta === 450 && s.saldo === 550 && JSON.stringify(s.pagos) === '[{"metodo":"Efectivo","monto":450}]', { s: [s.acuenta, s.saldo, s.pagos], t: x.toast });
  OK('C6 caja de ese día +150 y hoy igual', caja(A, hace6) === c0.viejo - 200 + 150 && caja(A, hoy) === c0.hoy);
  // ---- C7 a cero
  x = await corr(A, 'cero1', 0, 'Sin dato', 'No pagó nada ese día');
  s = server.registros.cero1;
  OK('C7 corrección a cero', s.acuenta === 0 && s.saldo === 1000 && s.pagos.length === 0, [s.acuenta, s.saldo, s.pagos]);
  // ---- C8 motivo vacío
  x = await corr(A, 'ef1', 400, 'Efectivo', '');
  OK('C8 sin motivo no se puede', /motivo/.test(x.toast) && server.registros.ef1.acuenta === 450, x.toast);
  OK('C8 servidor también exige motivo', H({ action: 'corregirCobro', token: w.SESION.token, correccion: { id: 'ef1', idem: 'm1', version: w.versionCobro(w.DATA.find(r => r.id === 'ef1')), monto: 1, pagos: [{ metodo: 'Efectivo', monto: 1 }], motivo: ' ' } }).error === 'falta_motivo');
  // ---- C9 doble clic
  w.corregirCobro('ef1'); A.setVal('#cc-monto', '420'); A.radio('ccmet', 'Efectivo'); A.setVal('#cc-motivo', 'Ajuste por doble clic'); w.revisarCorreccion();
  w.confirmarCorreccion(); w.confirmarCorreccion(); A.$('#cc-ok') && A.$('#cc-ok').click(); await A.tick(80); close(A);
  s = server.registros.ef1;
  OK('C9 doble clic corrige una sola vez', s.acuenta === 420 && (s.correccionesCobro || []).length === 2 && hoja().length === 5, [s.acuenta, (s.correccionesCobro || []).length, hoja().length]);
  // ---- C10 reintento con la misma clave de pedido
  const idem = s.correccionesCobro[1].id;
  const re = H({ action: 'corregirCobro', token: w.SESION.token, correccion: { id: 'ef1', idem, version: { x: 1 }, monto: 999, pagos: null, motivo: 'reintento igual' } });
  OK('C10 reintento no duplica', re.ok && re.repetida && server.registros.ef1.acuenta === 420 && hoja().length === 5);
  // ---- C11 conflicto entre dos equipos
  const B = await abrir({ server }); await entrar(B, 'duena-ficticia-1'); await B.w.pullServer(); await B.tick(700);
  B.w.corregirCobro('ef1'); B.setVal('#cc-monto', '410'); B.radio('ccmet', 'Efectivo'); B.setVal('#cc-motivo', 'B corrige con datos viejos'); B.w.revisarCorreccion();
  await corr(A, 'ef1', 430, 'Efectivo', 'A corrige primero');
  B.w.confirmarCorreccion(); await B.tick(60); const tb = B.toast();
  OK('C11 el segundo choca y ve lo nuevo', /otro equipo/.test(tb) && server.registros.ef1.acuenta === 430 && B.$('#cc-monto') && B.$('#cc-monto').value === '430', [tb, server.registros.ef1.acuenta]);
  close(B);
  // ---- C12 con saldo a favor
  const cr0 = w.creditoDe('Ficticia Favor');
  x = await corr(A, 'fav1', 50, 'Efectivo', 'Efectivo era 50, no 100');
  s = server.registros.fav1;
  OK('C12 saldo a favor intacto', s.acuenta === 250 && s.pagos.some(p => p.metodo === 'Saldo a favor' && p.monto === 200) && w.creditoDe('Ficticia Favor') === cr0, { s: s.pagos, a: s.acuenta, cr0, cr: w.creditoDe('Ficticia Favor') });
  // ---- C13 con cobro posterior
  const hoyAntes = caja(A, hoy);
  x = await corr(A, 'post1', 0, 'Sin dato', 'El primer día no pagó');
  s = server.registros.post1;
  OK('C13 cobro posterior no se toca', s.acuenta === 200 && s.cobrosPosteriores.length === 1 && caja(A, hoy) === hoyAntes, { a: s.acuenta, p: s.pagos, hoy: [hoyAntes, caja(A, hoy)] });
  // ---- C14 supera el total
  x = await corr(A, 'ef1', 5000, 'Efectivo', 'Pasarse del total');
  OK('C14 no deja pasarse del total', /más que el total/.test(x.toast) && server.registros.ef1.acuenta === 430, x.toast);
  // ---- C16 sin conexión y reintento
  w.corregirCobro('imp1'); A.setVal('#cc-monto', '350'); A.radio('ccmet', 'Efectivo'); A.setVal('#cc-motivo', 'Corte de internet a mitad'); w.revisarCorreccion();
  server.offline = true; w.confirmarCorreccion(); await A.tick(40); const toff = A.toast(); server.offline = false;
  OK('C16 sin conexión avisa y no corrige', /sin conexión/i.test(toff) && server.registros.imp1.acuenta === 300, toff);
  w.confirmarCorreccion(); await A.tick(60); close(A);
  OK('C16 al volver, corrige una vez', server.registros.imp1.acuenta === 350 && server.registros.imp1.correccionesCobro.length === 2);
  // ---- C17 un equipo viejo edita la nota: no pisa la corrección
  const C = await abrir({ server }); await entrar(C, 'duena-ficticia-1'); await C.w.pullServer(); await C.tick(700);
  C.w.editarId('cero1'); await corr(A, 'cero1', 100, 'QR', 'Sí pagó 100 por QR');
  C.setVal('#f-obs', 'nota desde equipo viejo'); C.click('#btn-save'); await C.tick(80); close(C);
  s = server.registros.cero1;
  const tC = C.toast();
  OK('C17 equipo viejo no pisa la corrección (avisa y recarga)', s.acuenta === 100 && s.correccionesCobro.length === 2 && /otro equipo cambió/.test(tC), { a: s.acuenta, n: (s.correccionesCobro || []).length, t: tC });
  C.setVal('#f-obs', 'nota desde equipo viejo'); C.click('#btn-save'); await C.tick(80); close(C); s = server.registros.cero1;
  OK('C17 al volver a guardar queda la nota y la corrección', s.acuenta === 100 && /equipo viejo/.test(s.obs || '') && s.correccionesCobro.length === 2, { a: s.acuenta, obs: s.obs, t: C.toast(), ed: C.w.EDIT_ID, f: C.$('#f-obs').value });
  // ---- C18 carga masiva no borra la historia
  const viejo = JSON.parse(JSON.stringify(server.registros.ef1)); delete viejo.correccionesCobro; viejo.acuenta = 300; viejo.obs = 'restaurado';
  H({ action: 'bulk', token: w.SESION.token, registros: [viejo] });
  OK('C18 bulk de la dueña conserva la historia', (server.registros.ef1.correccionesCobro || []).length >= 3 && hoja().length >= 9);
  // ---- C15 permisos por clínica
  w.show('config'); A.setVal('#c-pass-old', K.equipo); A.setVal('#c-pass-new', 'recep-ficticia-1'); A.setVal('#c-pass-new2', 'recep-ficticia-1');
  // la dueña cambia la clave del equipo (como recepción no podría si no sabe la actual)
  A.click('#btn-save-pass'); await A.tick(80);
  const E = await abrir({ server }); const rE = await entrar(E, 'recep-ficticia-1'); await E.w.pullServer(); await E.tick(700);
  const puedeE = E.w.puedeCorregirCobro(E.w.DATA.find(r => r.id === 'ef1'));
  OK('C15 recepción: ' + (SPA ? 'Spa no corrige' : 'Cosmetic corrige') + ' (pantalla)', rE === 'equipo' && puedeE === !SPA, [rE, puedeE]);
  const le2 = H({ action: 'login', clave: 'recep-ficticia-1' });
  const rr = H({ action: 'corregirCobro', token: le2.token, correccion: { id: 'ef1', idem: 'rec1', version: E.w.versionCobro(E.w.DATA.find(r => r.id === 'ef1')), monto: 431, pagos: [{ metodo: 'Efectivo', monto: 431 }], motivo: 'recepción corrige' } });
  OK('C15 recepción en servidor: ' + (SPA ? 'sin_permiso' : 'ok'), SPA ? rr.error === 'sin_permiso' : rr.ok, rr.error || rr.ok);
  if (!SPA) OK('C15 recepción figura como clave compartida', /compartida/.test(server.registros.ef1.correccionesCobro.slice(-1)[0].por));
  // doctora
  await (async () => { const r = await w.cambiarClaveServidor('prof', 'Dra. Brenda', 'brenda-ficticia-1'); OK('C15 la dueña asigna clave a una doctora', r && r.ok); })();
  const ld = H({ action: 'login', clave: 'brenda-ficticia-1' });
  OK('C15 doctora no corrige (servidor)', ld.rol === 'doctora' && H({ action: 'corregirCobro', token: ld.token, correccion: { id: 'ef1', idem: 'd1', version: {}, monto: 1, pagos: null, motivo: 'doctora intenta' } }).error === 'sin_permiso');
  OK('C15 doctora no toca atención de otra (servidor)', H({ action: 'save', token: ld.token, registro: Object.assign({}, server.registros.ef1, { obs: 'hack' }), base: server.registros.ef1 }).error === 'sin_permiso');
  OK('C15 doctora no hace bulk ni egresos', H({ action: 'bulk', token: ld.token, registros: [] }).error === 'sin_permiso' && H({ action: 'egreso', token: ld.token, registro: { id: 'e1', monto: 1 } }).error === 'sin_permiso');
  // ---- C19 panel sin clave en memoria: pide la clave y después sube
  w.olvidarSesion(); try { A.w.sessionStorage.removeItem(A.w.K_SES); } catch (e) {}
  const pac = w.DATA.find(r => r.id === 'imp1'); pac.obs = 'nota tras vencer'; w.persist(pac); await A.tick(60);
  OK('C19 sin sesión aparece el pedido de clave', !!A.$('#ses-pedir') && w.pend().length >= 1, w.pend().length);
  A.setVal('#ses-clave', 'duena-ficticia-1'); A.$('#ses-btn').click(); await A.tick(120);
  OK('C19 con la clave, se sube lo pendiente', !A.$('#ses-pedir') && w.pend().length === 0 && server.registros.imp1.obs === 'nota tras vencer', [w.pend().length, server.registros.imp1.obs]);
  // ---- C20 sesión vencida: se renueva sola con la clave en memoria
  const t0 = Date.now(); server.reloj = () => t0 + 31 * 60 * 1000;
  pac.obs = 'nota tras 31 minutos'; w.persist(pac); await A.tick(60);
  OK('C20 a los 31 min se renueva sola', server.registros.imp1.obs === 'nota tras 31 minutos' && w.pend().length === 0);
  server.reloj = null;
  R('errores', [A.errors.slice(0, 3), B.errors.slice(0, 3), C.errors.slice(0, 3), E.errors.slice(0, 3)]);
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
