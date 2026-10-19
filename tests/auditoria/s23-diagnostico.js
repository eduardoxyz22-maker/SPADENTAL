'use strict';
/* s23: los tres defectos del diagnóstico del 19/10 (ASTRA), corregidos.
   1) el adelanto de un plan paga solo la sesión, no la consulta, y todas las cuentas dicen lo mismo;
   2) el mismo saldo a favor no se puede usar dos veces desde dos equipos (lo frena el servidor);
   3) la dueña de un plan viejo se calcula igual en el panel y en el servidor.
   Datos ficticios; servidor = .gs real en memoria. */
const { abrir, entrar, close, sha, fakeServer, FAB } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(72), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer();
  const A = await abrir({ server }); await entrar(A, FAB.admin); const w = A.w, hoy = w.hoyISO();
  w.confirm = () => true;
  w.CFG.clavesProf = { 'Dra. Mirna': sha('d23-mirna'), 'Dra. Shirley': sha('d23-shirley') }; w.saveCfg(true); await A.tick(40);
  const consulta = w.CFG.precios.find(p => /consulta|valoraci/i.test(p.nom)).nom;
  const H = b => server.handle(b);

  // ---------- 1 adelanto 700, consulta 150 + sesión 234 sin plata en mano ----------
  const f = w.pacDe('Diag Uno'); f.nombre = 'Diag Uno';
  const pl = w.planNormalize({ nombre: 'Paquete', total: 700, paquete: true, prof: 'Dra. Mirna', sesiones: [{ desc: 'Paquete · sesión 1', precio: 234 }, { desc: 'Paquete · sesión 2', precio: 233 }, { desc: 'Paquete · sesión 3', precio: 233 }] });
  f.planes.push(pl); w.savePac(f); await A.tick(40);
  w.registrarPagoPlan('Diag Uno', pl.id, 700, 'Efectivo', hoy, 'adelanto'); await A.tick(60);
  w.show('atencion'); w.clearForm(); A.setVal('#f-prof', 'Dra. Mirna'); A.setVal('#f-paciente', 'Diag Uno'); A.setVal('#f-cel', '7001'); A.radio('canal', w.CFG.canales[0]); await A.tick(5);
  A.setVal('#f-plan', pl.id); await A.tick(5);
  A.setVal('#srv-list .s-nom', consulta); await A.tick(5); A.setVal('#srv-list .s-precio', '150'); await A.tick(5);
  A.click('#btn-add-srv'); await A.tick(5);
  const n2 = A.$$('#srv-list .s-nom')[1]; const o = A.w.document.createElement('option'); o.value = o.textContent = 'Paquete · sesión 1'; n2.appendChild(o);
  A.setVal(n2, 'Paquete · sesión 1'); await A.tick(5); A.setVal(A.$$('#srv-list .s-precio')[1], '234'); await A.tick(5);
  A.click('#btn-save'); await A.tick(300); close(A);
  const at = w.DATA.find(r => r.paciente === 'Diag Uno' && w.esAtencion(r)), p1 = w.planesDe('Diag Uno')[0], c1 = w.cuentasPlan(p1), cr = w.creditosEn(w.DATA, 'Diag Uno');
  OK('1 del adelanto se usan 234 (la sesión), no 384', at && w.usoSaldoDe(at) === 234 && at.saldo === 150, at && [w.usoSaldoDe(at), at.saldo]);
  OK('1 la consulta queda debiendo 150', at && at.total === 384 && at.saldo === 150);
  OK('1 todas las cuentas dicen lo mismo: quedan 466 en el plan', c1.usado === 234 && c1.queda === 466 && Math.round(cr.planes[p1.id]) === 466 && cr.general === 0, [c1.usado, c1.queda, cr.planes[p1.id], cr.general]);
  OK('1 cobrar lo que debe: el adelanto del plan no paga la consulta', w.creditoParaAtencion(at) === 0, w.creditoParaAtencion(at));
  OK('1 la sesión 2 todavía puede usar el adelanto', w.creditoPara('Diag Uno', p1.id) === 466);
  // ---------- 2 el mismo saldo a favor desde dos equipos ----------
  w.nuevoAnticipo(''); A.setVal('#an-pac', 'Diag Dos'); A.setVal('#an-monto', '100'); A.radio('anmet', 'Efectivo');
  A.$$('#modal button').find(b => /Guardar anticipo/.test(b.textContent)).click(); await A.tick(80); close(A);
  const B = await abrir({ server }); await entrar(B, FAB.admin); await B.w.pullServer(); await B.tick(600);
  const C = await abrir({ server }); await entrar(C, FAB.admin); await C.w.pullServer(); await C.tick(600);
  const toastsC = []; const tC = C.w.toast; C.w.toast = function (m) { toastsC.push(String(m)); return tC.apply(this, arguments); };
  // los dos leyeron 100 a favor antes de que el otro guardara
  [B, C].forEach(T => { T.w.creditoFresco = () => Promise.resolve(100); });
  const cargar = async (T) => { T.w.show('atencion'); T.w.clearForm(); T.setVal('#f-prof', 'Dra. Mirna'); T.setVal('#f-paciente', 'Diag Dos'); T.setVal('#f-cel', '7002'); T.radio('canal', T.w.CFG.canales[0]);
    T.setVal('#srv-list .s-nom', consulta); await T.tick(5); T.setVal('#srv-list .s-precio', '100'); await T.tick(5); T.click('#btn-save'); await T.tick(250); close(T); };
  await cargar(B); await cargar(C);
  const visitas = Object.values(server.registros).filter(r => r.paciente === 'Diag Dos' && r.estado === 'Atendido');
  const usado = visitas.reduce((a, r) => a + (r.pagos || []).filter(p => p.metodo === 'Saldo a favor').reduce((x, p) => x + p.monto, 0), 0);
  OK('2 el servidor guardó las dos visitas', visitas.length === 2);
  OK('2 el saldo a favor se usó una sola vez (100), no 200', usado === 100, usado);
  OK('2 la segunda quedó debiendo 100', visitas.some(r => r.saldo === 100 && r.acuenta === 0), visitas.map(r => [r.acuenta, r.saldo]));
  OK('2 el segundo equipo ve el aviso y la atención actualizada', toastsC.some(t => /ya se había usado/.test(t)) && C.w.DATA.some(r => r.paciente === 'Diag Dos' && w.esAtencion(r) && r.saldo === 100), toastsC.slice(-2));
  const tok = A.w.SESION.token;
  const directo = H({ action: 'save', token: tok, registro: { id: 'd23-x', clinicaId: w.CLINICA_ID, fecha: hoy, hora: '10:00', profesional: 'Dra. Mirna', paciente: 'Diag Dos', celular: '7002', estado: 'Atendido',
    servicios: [{ nom: consulta, cant: 1, precio: 50 }], total: 50, acuenta: 50, saldo: 0, metodo: 'Saldo a favor', pagos: [{ metodo: 'Saldo a favor', monto: 50 }], cobrosPosteriores: [], cobroInicialFechado: true } });
  OK('2 servidor directo: sin saldo, el saldo a favor se recorta y queda debiendo', directo.ok && directo.ajusteFavor === 50 && directo.registro.saldo === 50 && directo.registro.acuenta === 0, [directo.ajusteFavor, directo.registro && directo.registro.saldo]);
  // ---------- 3 dueña de un plan viejo: la misma en panel y servidor ----------
  const visita = (id, prof) => ({ id, clinicaId: w.CLINICA_ID, fecha: hoy, hora: '09:00', profesional: prof, paciente: 'Diag Tres', celular: '7003', estado: 'Atendido', servicios: [{ nom: consulta, cant: 1, precio: 10 }], total: 10, acuenta: 10, saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 10 }], cobrosPosteriores: [], cobroInicialFechado: true });
  for (const [id, pr] of [['d3a', 'Dra. Mirna'], ['d3b', 'Dra. Mirna'], ['d3c', 'Dra. Shirley']]) H({ action: 'save', token: tok, registro: visita(id, pr) });
  const f3 = { nombre: 'Diag Tres', nac: '', med: {}, planes: [{ id: 'pv1', nombre: 'Plan viejo', fecha: hoy, estado: 'activo', total: 300, sesiones: [{ n: 1, desc: 'a' }, { n: 2, desc: 'b' }], cuotas: [], notas: '', prof: '' },
    { id: 'pv2', nombre: 'Plan con sesiones', fecha: hoy, estado: 'activo', total: 300, sesiones: [{ n: 1, desc: 'a', hecha: true, atencionId: 'd3a' }, { n: 2, desc: 'b', hecha: true, atencionId: 'd3b' }, { n: 3, desc: 'c', hecha: true, atencionId: 'd3c' }], cuotas: [], notas: '', prof: '' }] };
  H({ action: 'pac', token: tok, registro: f3 });
  await A.w.pullServer(); await A.tick(500);
  const srvDueno = id => server.ctx.duenoPlanSrv(f3.planes.find(p => p.id === id), server.ctx.filasPacSrv(server.ctx.fClavePac('Diag Tres')));
  const pv1 = A.w.planesDe('Diag Tres').find(p => p.id === 'pv1'), pv2 = A.w.planesDe('Diag Tres').find(p => p.id === 'pv2');
  OK('3 plan viejo sin sesiones y dos doctoras: ninguna dueña en los dos lados', A.w.duenaPlan(pv1) === '' && srvDueno('pv1') === '', [A.w.duenaPlan(pv1), srvDueno('pv1')]);
  OK('3 plan con sesiones 2 Mirna / 1 Shirley: Mirna en los dos lados', A.w.duenaPlan(pv2) === 'Dra. Mirna' && srvDueno('pv2') === 'Dra. Mirna', [A.w.duenaPlan(pv2), srvDueno('pv2')]);
  A.w.verPlan('Diag Tres', 'pv1');
  OK('3 a la dueña se le pide asignar la doctora del plan sin dueña', /no tiene doctora clara/.test(A.$('#modal').textContent)); close(A);
  const M = await abrir({ server }); await entrar(M, 'd23-mirna'); await M.w.pullServer(); await M.tick(600);
  OK('3 la doctora no ve "Pago adelantado" en el plan sin dueña (el servidor lo rechazaría)', !M.w.puedePagoPlan('Diag Tres', 'pv1'), M.w.puedePagoPlan('Diag Tres', 'pv1'));
  console.log(A.errors.slice(0, 3), B.errors.slice(0, 3), C.errors.slice(0, 3));
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
