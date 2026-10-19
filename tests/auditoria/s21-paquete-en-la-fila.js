'use strict';
const FAB = require('./lib.js').FAB;
/* s21: consulta + paquete en la misma atención, sin abrir Planes. */
const { abrir, entrar, close, fakeServer } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
const PAQ = SPA ? null : 'Blanqueamiento dental · 3 sesiones';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer();
  const A = await abrir({ server }); await entrar(A, FAB.admin); const w = A.w, hoy = w.hoyISO();
  w.prompt = () => '3'; w.confirm = () => true;
  const consulta = w.CFG.precios.find(p => /consulta|valoraci/i.test(p.nom)).nom;
  const blanq = PAQ || w.CFG.precios.find(p => /blanqueamiento/i.test(p.nom)).nom;
  const caja = () => w.totalCobros(w.filasCajaDia(hoy)), c0 = caja();
  const cargar = async (pac, filas, pago, met) => {
    w.show('atencion'); w.clearForm(); A.setVal('#f-prof', 'Dra. Mirna'); A.setVal('#f-paciente', pac); A.setVal('#f-cel', '70044455'); A.radio('canal', w.CFG.canales[0]);
    for (let k = 0; k < filas.length; k++) {
      if (k) { A.click('#btn-add-srv'); await A.tick(5); }
      A.setVal(A.$$('#srv-list .s-nom')[k], filas[k][0]); await A.tick(5); A.setVal(A.$$('#srv-list .s-precio')[k], String(filas[k][1])); await A.tick(5);
      if (filas[k][2]) { A.$$('#srv-list .srv')[k].querySelector('.s-paq').click(); await A.tick(5); }
      if (filas[k][3]) { const r = A.$$('#srv-list .s-hoy').find(x => x.value === '0'); r.checked = true; r.dispatchEvent(new A.w.Event('change', { bubbles: true })); await A.tick(5); }
    }
    if (pago) { A.setVal('#f-acuenta', String(pago)); A.radio('metodo', met || 'QR'); }
  };
  // 1 consulta + paquete, hoy la sesión 1, paga todo
  await cargar('Fila Uno', [[consulta, 100], [blanq, 700, SPA]], 800, 'QR');
  OK('1 la fila dice «Paquete de 3 sesiones» con la sesión 1 marcada', /Paquete de 3 sesiones/.test(A.$('#srv-list').textContent) && A.$$('#srv-list .s-hoy').find(x => x.value === '1').checked);
  A.click('#btn-save'); await A.tick(200); close(A);
  const a1 = w.DATA.find(r => r.paciente === 'Fila Uno' && w.esAtencion(r)), p1 = w.planesDe('Fila Uno')[0], x1 = w.DATA.filter(r => r.paciente === 'Fila Uno' && w.esAnticipo(r));
  OK('1 sin preguntas: atención = consulta 100 + sesión 1 234', a1 && a1.total === 334 && a1.acuenta === 334 && a1.servicios.length === 2, a1 && [a1.total, a1.acuenta]);
  OK('1 paquete creado y 466 a su pago', p1 && p1.sesiones.length === 3 && x1.length === 1 && x1[0].acuenta === 466 && x1[0].planId === p1.id, [p1 && p1.sesiones.length, x1.map(x => x.acuenta)]);
  OK('1 plan: 1/3, pagado 700, pendiente 0, sin saldo a favor de más', w.avancePlan(p1).hechas === 1 && w.cobradoPlan(p1) === 700 && w.saldoPlan(p1) === 0 && w.creditoLibre('Fila Uno') === 0, [w.cobradoPlan(p1), w.creditoLibre('Fila Uno')]);
  OK('1 caja +800', caja() === c0 + 800);
  // 2 consulta + paquete, hoy solo paga
  await cargar('Fila Dos', [[consulta, 100], [blanq, 700, SPA, true]], 800, 'Efectivo');
  A.click('#btn-save'); await A.tick(200); close(A);
  const a2 = w.DATA.find(r => r.paciente === 'Fila Dos' && w.esAtencion(r)), p2 = w.planesDe('Fila Dos')[0], x2 = w.DATA.filter(r => r.paciente === 'Fila Dos' && w.esAnticipo(r));
  OK('2 atención solo consulta 100, paquete 0/3 con 700 pagados', a2 && a2.total === 100 && a2.acuenta === 100 && !a2.planId && p2 && w.avancePlan(p2).hechas === 0 && x2.length === 1 && x2[0].acuenta === 700, [a2 && a2.total, x2.map(x => x.acuenta)]);
  // 3 solo el paquete, solo paga: no hay atención
  await cargar('Fila Tres', [[blanq, 700, SPA, true]], 700, 'Tarjeta');
  A.click('#btn-save'); await A.tick(200); close(A);
  OK('3 solo paga el paquete: sin atención, pago 700, formulario limpio', !w.DATA.some(r => r.paciente === 'Fila Tres' && w.esAtencion(r)) && w.DATA.some(r => r.paciente === 'Fila Tres' && w.esAnticipo(r) && r.acuenta === 700 && r.celular === '70044455') && A.$('#f-paciente').value === '');
  // 4 consulta paga, el paquete queda debiendo
  await cargar('Fila Cuatro', [[consulta, 100], [blanq, 700, SPA]], 100, 'Efectivo');
  A.click('#btn-save'); await A.tick(200); close(A);
  const a4 = w.DATA.find(r => r.paciente === 'Fila Cuatro' && w.esAtencion(r)), p4 = w.planesDe('Fila Cuatro')[0];
  OK('4 pagó solo la consulta: la sesión 1 debe 234, el plan 700', a4 && a4.total === 334 && a4.saldo === 234 && w.cobradoPlan(p4) === 0 && w.saldoPlan(p4) === 700, a4 && [a4.total, a4.saldo, w.cobradoPlan(p4)]);
  // 5 cualquier servicio: «Es de varias sesiones»
  await cargar('Fila Cinco', [[consulta, 300, true]], 300, 'QR');
  A.click('#btn-save'); await A.tick(200); close(A);
  const p5 = w.planesDe('Fila Cinco')[0], a5 = w.DATA.find(r => r.paciente === 'Fila Cinco' && w.esAtencion(r));
  OK('5 marcado a mano en 3 sesiones: 100 hoy y 200 al paquete', p5 && p5.sesiones.length === 3 && a5.total === 100 && w.DATA.some(r => r.paciente === 'Fila Cinco' && w.esAnticipo(r) && r.acuenta === 200), p5 && [p5.sesiones.length, a5.total]);
  // 9 consulta + adelanto parcial, hoy la sesión 1: pagó 450 de 850
  await cargar('Fila Nueve', [[consulta, 150], [blanq, 700, SPA]], 450, 'QR');
  A.click('#btn-save'); await A.tick(250); close(A);
  const a9 = w.DATA.find(r => r.paciente === 'Fila Nueve' && w.esAtencion(r)), p9 = w.planesDe('Fila Nueve')[0];
  OK('9 parcial con sesión: atención 384 pagada, 66 adelantados, pagado 300, falta 400', a9 && a9.total === 384 && a9.saldo === 0 && w.cuentasPlan(p9).queda === 66 && w.cobradoPlan(p9) === 300 && w.saldoPlan(p9) === 400, a9 && [a9.total, a9.saldo, w.cuentasPlan(p9).queda, w.cobradoPlan(p9), w.saldoPlan(p9)]);
  w.atencionDePlan('Fila Nueve', p9.id, 2); A.setVal('#ap-prof', 'Dra. Mirna'); w.guardarAtencionPlan(); await A.tick(250); close(A);
  const s9 = w.DATA.find(r => r.paciente === 'Fila Nueve' && r.planEtapa === 2);
  OK('9 sesión 2: usa los 66 y debe 167', s9 && s9.total === 233 && w.usoSaldoDe(s9) === 66 && s9.saldo === 167 && w.cuentasPlan(w.planesDe('Fila Nueve')[0]).queda === 0, s9 && [w.usoSaldoDe(s9), s9.saldo]);
  // 10 consulta + adelanto parcial, hoy solo paga: pagó 450
  await cargar('Fila Diez', [[consulta, 150], [blanq, 700, SPA, true]], 450, 'Efectivo');
  A.click('#btn-save'); await A.tick(250); close(A);
  const a10 = w.DATA.find(r => r.paciente === 'Fila Diez' && w.esAtencion(r)), p10 = w.planesDe('Fila Diez')[0];
  OK('10 parcial sin sesión: atención consulta 150 pagada, 300 adelantados, falta 400', a10 && a10.total === 150 && a10.saldo === 0 && w.cuentasPlan(p10).queda === 300 && w.saldoPlan(p10) === 400 && w.avancePlan(p10).hechas === 0, a10 && [a10.total, w.cuentasPlan(p10).queda, w.saldoPlan(p10)]);
  OK('9-10 caja: entró lo que pagaron (450 + 450)', w.totalCobros(w.filasCajaDia(hoy).filter(r => /Fila (Nueve|Diez)/.test(r.paciente))) === 900);
  // 7 el caso real: consulta 150 + paquete 700, pagó 850; después sesiones 2 y 3
  await cargar('Fila Siete', [[consulta, 150], [blanq, 700, SPA]], 850, 'Efectivo');
  A.click('#btn-save'); await A.tick(200); close(A);
  const p7 = w.planesDe('Fila Siete')[0];
  for (const n of [2, 3]) { w.atencionDePlan('Fila Siete', p7.id, n); A.setVal('#ap-prof', 'Dra. Mirna'); w.guardarAtencionPlan(); await A.tick(200); close(A); }
  const c7 = w.cuentasPlan(w.planesDe('Fila Siete')[0]);
  OK('7 pagado del paquete 700 (no 850): la consulta no cuenta', w.cobradoPlan(w.planesDe('Fila Siete')[0]) === 700, w.cobradoPlan(w.planesDe('Fila Siete')[0]));
  OK('7 cuentas: 234 en la atención, 466 adelantado, usado 466, queda 0', c7.enAtenciones === 234 && c7.adelantado === 466 && c7.usado === 466 && c7.queda === 0, c7);
  OK('7 sin saldo a favor de más', w.creditoDe('Fila Siete') === 0 && w.creditoLibre('Fila Siete') === 0);
  w.verPlan('Fila Siete', p7.id);
  OK('7 el plan explica las cuentas y la sesión 1 dice 234', /Cuentas del paquete/.test(A.$('#modal').textContent) && /Bs 234 pagados en la atención/.test(A.$('#modal').textContent) && /Bs 233 del adelanto/.test(A.$('#modal').textContent), A.$('#modal').textContent.slice(0, 0));
  close(A);
  // 8 los datos ya cargados así (atención 384 enlazada + adelanto 466): se leen bien
  const f8 = w.pacDe('Fila Ocho'); f8.nombre = 'Fila Ocho';
  const pl8 = w.planNormalize({ nombre: 'BLANQUEAMIENTO', total: 700, paquete: true, sesiones: [{ desc: 's1', precio: 234 }, { desc: 's2', precio: 233 }, { desc: 's3', precio: 233 }] }); f8.planes.push(pl8); w.savePac(f8);
  const r8 = w.normalize({ id: 'r8', clinicaId: w.CLINICA_ID, fecha: hoy, hora: '10:00', profesional: 'Dra. Mirna', paciente: 'Fila Ocho', celular: '7', estado: 'Atendido', servicios: [{ nom: 's1', cant: 1, precio: 234 }, { nom: consulta, cant: 1, precio: 150 }], total: 384, acuenta: 384, saldo: 0, pagos: [{ metodo: 'Efectivo', monto: 384 }], metodo: 'Efectivo', planId: pl8.id, planEtapa: 1, cobrosPosteriores: [], cobroInicialFechado: true });
  w.DATA.push(r8); w.marcarSesionPlan(r8); w.registrarPagoPlan('Fila Ocho', pl8.id, 466, 'Efectivo', hoy, 'x');
  OK('8 lo ya cargado: pagado 700, adelanto 466 sin usar, nada suelto', w.cobradoPlan(w.planesDe('Fila Ocho')[0]) === 700 && w.cuentasPlan(w.planesDe('Fila Ocho')[0]).queda === 466 && w.creditoLibre('Fila Ocho') === 0, [w.cobradoPlan(w.planesDe('Fila Ocho')[0]), w.creditoLibre('Fila Ocho')]);
  // servidor
  await A.tick(300);
  const srv = Object.values(server.registros).filter(r => /^Fila /.test(r.paciente) && r.id !== 'r8');
  OK('6 el servidor tiene todo, sin pendientes', srv.length === w.DATA.filter(r => /^Fila /.test(r.paciente) && r.id !== 'r8').length && !w.pend().length, [srv.length, w.pend().length]);
  console.log(A.errors.slice(0, 3));
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
