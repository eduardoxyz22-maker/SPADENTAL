'use strict';
const FAB = require('./lib.js').FAB;
/* s16: paquetes (A plantilla en Ajustes, B de la clínica, C el paquete entero
   cargado como una sola atención) y el caso de editar una atención y crear el
   plan desde ella. Datos ficticios; servidor = .gs real en memoria. */
const { abrir, entrar, R, close, sha, fakeServer } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
const K = SPA ? { admin: FAB.admin } : { admin: FAB.admin };
const SRV_PAQ = SPA ? 'Blanqueamiento láser' : 'Blanqueamiento dental · 3 sesiones';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
const btn = (T, re) => T.$$('#modal button').find(b => re.test(b.textContent));
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer();
  const A = await abrir({ server }); await entrar(A, K.admin); const w = A.w, hoy = w.hoyISO(), ayer = w.addDias(hoy, -1);
  w.show('config'); A.setVal('#c-pass-admin', 'duena-paq-1'); A.click('#btn-save-pass-admin'); await A.tick(80);
  OK('0 la dueña deja la clave de fábrica', w.SESION.fabrica === false, A.toast());
  w.CFG.clavesProf = { 'Dra. Mirna': sha('mirna-paq'), 'Dra. Shirley': sha('shirley-paq') }; w.saveCfg(true); await A.tick(30);
  OK('0 el servidor avisa que entiende paquetes', w.hayPaquetesSrv() === true);

  // ---------- A: plantilla en Ajustes ----------
  w.show('config'); w.renderConfig();
  A.setVal('#pq-nom', 'Blanqueamiento'); A.setVal('#pq-n', '3'); A.setVal('#pq-tot', '700');
  OK('A muestra cómo se reparte', /234.*233.*233/.test(A.$('#pq-rep').textContent), A.$('#pq-rep').textContent);
  w.guardarPaqueteTipo(); await A.tick(40);
  const tp = (w.CFG.planesTipo || []).find(t => t.paquete);
  OK('A paquete guardado con 234/233/233 y de la clínica', tp && tp.deClinica && tp.etapas.map(e => e.precio).join('/') === '234/233/233', tp && tp.etapas);
  OK('A la lista de Ajustes lo muestra', /Blanqueamiento/.test(A.$('#c-paquetes').textContent) && /de la clínica/.test(A.$('#c-paquetes').textContent));

  // ---------- C: paquete entero cobrado como una atención nueva ----------
  const cargar = async (T, o) => {
    const { setVal, radio, click, tick } = T;
    if (!o.editar) { T.w.show('atencion'); T.w.clearForm(); }
    if (o.fecha) setVal('#f-fecha', o.fecha);
    if (!T.$('#f-prof').readOnly && o.prof) setVal('#f-prof', o.prof);
    if (!o.editar) { setVal('#f-paciente', o.pac); setVal('#f-cel', '70001111'); }
    if (o.srv) {
      if (o.editar) { T.click('#btn-add-srv'); }
      const ns = T.$$('#srv-list .s-nom'), ps = T.$$('#srv-list .s-precio');
      setVal(ns[ns.length - 1], o.srv); await tick(5); setVal(T.$$('#srv-list .s-precio').slice(-1)[0], String(o.precio)); await tick(5);
    }
    if (o.acuenta != null) { setVal('#f-acuenta', String(o.acuenta)); radio('metodo', o.metodo || 'Efectivo'); }
    if (!T.w.getRadio('canal')) radio('canal', T.w.CFG.canales[0]);
  };
  const caja = (T, d) => T.w.totalCobros(T.w.filasCajaDia(d));
  const caja0 = caja(A, hoy);
  await cargar(A, { pac: 'Paciente Paquete', prof: 'Dra. Mirna', srv: SRV_PAQ, precio: 700, acuenta: 700, metodo: 'QR' });
  OK('C la fila ya dice «Paquete de 3 sesiones»', /Paquete de 3 sesiones/.test(A.$('#srv-list').textContent));
  A.click('#btn-save'); await A.tick(3000);
  close(A);
  const pl = w.planesDe('Paciente Paquete')[0];
  const at = w.DATA.find(r => r.paciente === 'Paciente Paquete' && w.esAtencion(r));
  const ants = () => w.DATA.filter(r => r.paciente === 'Paciente Paquete' && w.esAnticipo(r));
  OK('C quedó creado el paquete de la clínica', pl && pl.deClinica && pl.paquete && pl.sesiones.length === 3, pl && [pl.deClinica, pl.sesiones.length]);
  OK('C la atención quedó en 234 y es la sesión 1', at && at.total === 234 && at.acuenta === 234 && at.saldo === 0 && at.planId === pl.id && pl.sesiones[0].atencionId === at.id, at && [at.total, at.acuenta, at.saldo]);
  OK('C 466 quedan como pago del paquete, por QR, hoy', ants().length === 1 && ants()[0].acuenta === 466 && ants()[0].planId === pl.id && ants()[0].metodo === 'QR' && ants()[0].fecha === hoy, ants().map(a => [a.acuenta, a.metodo, a.fecha]));
  OK('C la caja de hoy no cambia: entraron 700', caja(A, hoy) === caja0 + 700, [caja0, caja(A, hoy)]);
  OK('C el plan: pagado 700, pendiente 0, 1/3', w.cobradoPlan(pl) === 700 && w.saldoPlan(pl) === 0 && w.avancePlan(pl).hechas === 1);
  const sAt = server.registros[at.id], sAn = Object.values(server.registros).filter(r => r.estado === 'Anticipo' && r.paciente === 'Paciente Paquete');
  OK('C el servidor tiene lo mismo', sAt && sAt.total === 234 && sAt.acuenta === 234 && sAn.length === 1 && sAn[0].acuenta === 466, sAt && [sAt.total, sAt.acuenta, sAn.length]);
  const facturadoDe = (T, prof) => T.w.DATA.filter(r => r.estado === 'Atendido' && r.profesional === prof && r.paciente === 'Paciente Paquete').reduce((a, r) => a + r.total, 0);
  OK('C facturado de Mirna en el paquete = 234', facturadoDe(A, 'Dra. Mirna') === 234);

  // ---------- B: Shirley atiende la sesión 2 ----------
  const S = await abrir({ server }); await entrar(S, 'shirley-paq'); await S.w.pullServer(); await S.tick(700);
  const plS = S.w.planesDe('Paciente Paquete')[0];
  OK('B Shirley ve el paquete y el paciente no le es ajeno', plS && S.w.planVisible(plS) && !S.w.pacAjeno('Paciente Paquete'));
  OK('B Shirley no puede editar ni borrar el paquete', !S.w.planEsMio(plS));
  S.w.verPlan('Paciente Paquete', plS.id);
  OK('B el plan dice «Marcar realizada» y quién hizo la 1', !!btn(S, /✓ Marcar realizada · Blanqueamiento · sesión 2/) && /Dra\. Mirna/.test(S.$('#modal').textContent));
  btn(S, /✓ Marcar realizada · Blanqueamiento · sesión 2/).click(); await S.tick(10);
  OK('B el formulario dice «¿Quién la hizo?» y es ella', /Quién la hizo/.test(S.$('#modal').textContent) && S.$('#ap-prof').value === 'Dra. Shirley');
  S.w.guardarAtencionPlan(); await S.tick(400); close(S);
  const at2 = Object.values(server.registros).find(r => r.paciente === 'Paciente Paquete' && r.profesional === 'Dra. Shirley');
  OK('B el servidor guardó la sesión 2 de Shirley: 233 pagados con lo del paquete', at2 && at2.total === 233 && at2.acuenta === 233 && at2.saldo === 0 && (at2.pagos || []).some(p => p.metodo === 'Saldo a favor'), at2 && [at2.total, at2.acuenta, at2.pagos]);
  OK('B sin pendientes ni rechazos', !(S.w.PEND || []).length, S.toast());
  const fichaSrv = Object.values(server.pacientes).find(p => /paciente paquete/i.test(p.nombre));
  const plSrv = fichaSrv && (fichaSrv.planes || [])[0];
  OK('B en el servidor la sesión 2 quedó marcada con su atención', plSrv && plSrv.sesiones[1].hecha && plSrv.sesiones[1].atencionId === at2.id && plSrv.deClinica, plSrv && plSrv.sesiones.map(s => s.hecha));
  OK('B la caja de hoy no suma la sesión 2 (ya estaba pagada)', caja(S, hoy) === caja(A, hoy), [caja(S, hoy), caja(A, hoy)]);
  OK('B facturado: Shirley 233', facturadoDe(S, 'Dra. Shirley') === 233);
  // Shirley intenta tocar el paquete
  const pS = S.w.pacDe('Paciente Paquete'); const p2 = JSON.parse(JSON.stringify(pS)); p2.planes[0].total = 1; p2.planes[0].prof = 'Dra. Shirley'; p2.planes[0].deClinica = false;
  const H = (b) => server.handle(b);
  const rS = H({ action: 'pac', token: S.w.SESION.token, registro: p2 });
  const plTras = Object.values(server.pacientes).find(p => /paciente paquete/i.test(p.nombre)).planes[0];
  OK('B el servidor no deja que Shirley cambie el paquete', plTras.total === 700 && plTras.deClinica === true && !plTras.prof, [rS.ok, plTras.total, plTras.deClinica]);
  // Mirna (doctora) marca la 3: también puede
  const M = await abrir({ server }); await entrar(M, 'mirna-paq'); await M.w.pullServer(); await M.tick(700);
  const plM = M.w.planesDe('Paciente Paquete')[0];
  M.w.atencionDePlan('Paciente Paquete', plM.id, 3); M.w.guardarAtencionPlan(); await M.tick(400); close(M);
  OK('B Mirna marca la 3: paquete completo, todo pagado', M.w.avancePlan(M.w.planesDe('Paciente Paquete')[0]).hechas === 3 && Object.values(server.registros).filter(r => r.paciente === 'Paciente Paquete' && r.estado === 'Atendido').length === 3);
  OK('B el saldo a favor del paciente queda en 0', Math.abs(M.w.creditoDe('Paciente Paquete')) < 0.01, M.w.creditoDe('Paciente Paquete'));

  // ---------- el caso del reporte: editar una atención y crear el plan desde ella ----------
  const c0 = (await (async () => { await cargar(A, { pac: 'Paciente Edita', prof: 'Dra. Mirna', srv: 'Limpieza dental', precio: 100, acuenta: 100, metodo: 'Efectivo', fecha: ayer }); A.click('#btn-save'); await A.tick(80); close(A); return w.DATA.find(r => r.paciente === 'Paciente Edita'); })());
  if (!c0) { OK('E se cargó la consulta de ayer', false); }
  const cajaAyer = caja(A, ayer), cajaHoy = caja(A, hoy);
  w.editarId(c0.id); await A.tick(5);
  await cargar(A, { editar: true, srv: SRV_PAQ, precio: 700, acuenta: 800, metodo: 'QR' });
  // abre Planes desde la atención y crea el paquete con un toque
  A.click('#btn-planes'); await A.tick(5);
  OK('E en Planes aparece el botón del paquete', !!btn(A, /📦 Blanqueamiento · 3 sesiones/));
  btn(A, /📦 Blanqueamiento · 3 sesiones/).click(); await A.tick(30);
  OK('E el paquete quedó elegido en la atención', A.$('#f-plan').value === w.planesDe('Paciente Edita')[0].id && /sesión 1/.test(A.toast()), A.toast());
  close(A);
  A.click('#btn-save'); await A.tick(30);
  OK('E al guardar pregunta por la sesión 1', A.modalOpen() && /sesión 1 de 3/.test(A.$('#modal').textContent));
  btn(A, /Sí, es la sesión 1/).click(); await A.tick(3000); close(A);
  const e1 = w.DATA.find(r => r.id === c0.id), plE = w.planesDe('Paciente Edita')[0];
  const antE = w.DATA.filter(r => r.paciente === 'Paciente Edita' && w.esAnticipo(r));
  OK('E la atención: consulta 100 + sesión 1 234 = 334', e1.total === 334 && e1.acuenta === 334 && e1.saldo === 0 && e1.planId === plE.id, [e1.total, e1.acuenta, e1.saldo]);
  OK('E 466 al paquete, hoy por QR (de lo que pagó hoy)', antE.length === 1 && antE[0].acuenta === 466 && antE[0].fecha === hoy && antE[0].metodo === 'QR', antE.map(a => [a.acuenta, a.fecha, a.metodo]));
  OK('E caja de ayer igual (100) y la de hoy +700', caja(A, ayer) === cajaAyer && caja(A, hoy) === cajaHoy + 700, [cajaAyer, caja(A, ayer), cajaHoy, caja(A, hoy)]);
  OK('E el plan: 1 de 3 hecha, quedan 2 para marcar', w.avancePlan(plE).hechas === 1 && w.proxSesion(plE).n === 2 && w.saldoPlan(plE) === 0);
  w.verPaciente('Paciente Edita'); await A.tick(5);
  OK('E la ficha ofrece «✓ Marcar realizada · sesión 2»', !!btn(A, /Marcar realizada · sesión 2/)); close(A);

  // ---------- dijo que no, y después lo pasa desde el plan ----------
  await cargar(A, { pac: 'Paciente Despues', prof: 'Dra. Mirna', srv: SRV_PAQ, precio: 700, acuenta: 700, metodo: 'Efectivo' });
  A.$('#srv-list .s-paq').click(); await A.tick(5);   // «No es un paquete»
  A.click('#btn-save'); await A.tick(80); close(A);
  const d1 = w.DATA.find(r => r.paciente === 'Paciente Despues');
  OK('N dijo que no: queda como estaba (700, sin paquete)', d1 && d1.total === 700 && !w.planesDe('Paciente Despues').length);
  w.crearPaquete('Paciente Despues', tp && w.CFG.planesTipo.indexOf(tp), true); await A.tick(30);
  const plD = w.planesDe('Paciente Despues')[0];
  w.editarId(d1.id); await A.tick(5); A.setVal('#f-plan', plD.id); await A.tick(5);
  A.click('#btn-save'); await A.tick(30);
  if (A.modalOpen() && btn(A, /No, se hizo todo hoy/)) { btn(A, /No, se hizo todo hoy/).click(); await A.tick(120); }
  close(A);
  w.verPlan('Paciente Despues', plD.id);
  OK('N el plan ofrece «📦 Pasar al paquete» en la sesión 1', !!btn(A, /Pasar al paquete/), A.toast());
  btn(A, /Pasar al paquete/).click(); await A.tick(200); close(A);
  const d2 = w.DATA.find(r => r.id === d1.id);
  OK('N pasado: la atención 234 y 466 al paquete en efectivo', d2.total === 234 && w.DATA.some(r => w.esAnticipo(r) && r.paciente === 'Paciente Despues' && r.acuenta === 466 && r.metodo === 'Efectivo'), [d2.total, d2.acuenta]);

  // ---------- servidor directo ----------
  const tokS = S.w.SESION.token;
  const otra = Object.values(server.registros).find(r => r.paciente === 'Paciente Despues' && r.estado === 'Atendido');
  OK('S doctora no pasa la atención de otra', H({ action: 'pasarAlPlan', token: tokS, pase: { id: otra.id, idem: 'x1', planId: plD.id, servicios: otra.servicios } }).error === 'sin_permiso');
  const rep = H({ action: 'pasarAlPlan', token: A.w.SESION.token, pase: { id: d1.id, idem: d1.id + '-paq-' + plD.id, planId: plD.id, servicios: d2.servicios } });
  OK('S repetir el pase no duplica', rep.ok && rep.repetida && Object.values(server.registros).filter(r => r.paciente === 'Paciente Despues' && r.estado === 'Anticipo').length === 1);
  const lf = H({ action: 'login', clave: FAB.equipo });
  if (lf.ok && lf.fabrica) OK('S con clave de fábrica no se mueve plata', H({ action: 'pasarAlPlan', token: lf.token, pase: { id: d1.id, idem: 'x2', planId: plD.id, servicios: d2.servicios } }).error === 'clave_de_fabrica');
  OK('S no se puede subir el total', H({ action: 'pasarAlPlan', token: A.w.SESION.token, pase: { id: otra.id, idem: 'x3', planId: plD.id, servicios: [{ nom: 'x', cant: 1, precio: 5000 }] } }).error === 'sube_total');

  // ---------- un paquete de una doctora (no de la clínica) sigue siendo suyo ----------
  w.nuevoPlan('Paciente Paquete'); await A.tick(5);
  A.setVal('#pl-nom', 'Ortodoncia de Mirna'); if (A.$('#pl-prof')) A.setVal('#pl-prof', 'Dra. Mirna');
  w.PL_ETAPAS = [{ desc: 'Control', cant: 2, precio: 100 }]; w.pintarEtapasEditor(); A.$('#pl-tot').value = '200';
  btn(A, /Guardar plan/).click(); await A.tick(60); close(A);
  await S.w.pullServer(); await S.tick(600);
  const orto = S.w.planesDe('Paciente Paquete').find(p => p.nombre === 'Ortodoncia de Mirna');
  OK('P el plan común de Mirna no lo ve Shirley', orto && !S.w.planVisible(orto));

  // ---------- un plan en 0 creado a mano: se reparte ----------
  await cargar(A, { pac: 'Paciente Cero', prof: 'Dra. Mirna', srv: SRV_PAQ, precio: 700, acuenta: 700, metodo: 'Efectivo' });
  A.click('#btn-planes'); await A.tick(5); btn(A, /Crear plan de tratamiento/).click(); await A.tick(5);
  A.setVal('#pl-nom', 'Blanqueo a mano'); w.PL_ETAPAS = [{ desc: 'Sesión', cant: 3, precio: 0 }]; w.pintarEtapasEditor(); A.$('#pl-tot').value = '700'; A.$('#pl-tot').dataset.touched = '1';
  btn(A, /Guardar plan/).click(); await A.tick(40); close(A);
  A.click('#btn-save'); await A.tick(30);
  OK('Z plan en 0: avisa que reparte', A.modalOpen() && /se reparte el precio/.test(A.$('#modal').textContent));
  btn(A, /Sí, es la sesión 1/).click(); await A.tick(3000); close(A);
  const z = w.DATA.find(r => r.paciente === 'Paciente Cero' && w.esAtencion(r)), plZ = w.planesDe('Paciente Cero')[0];
  OK('Z repartido 234/233/233 y la atención en 234', plZ.sesiones.map(s => s.precio).join('/') === '234/233/233' && z.total === 234, [plZ.sesiones.map(s => s.precio), z.total]);

  R('errores', [A.errors.slice(0, 3), S.errors.slice(0, 3), M.errors.slice(0, 3)]);
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
