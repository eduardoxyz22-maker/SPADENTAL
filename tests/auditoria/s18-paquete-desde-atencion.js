'use strict';
const FAB = require('./lib.js').FAB;
/* s18: el caso del reporte: paciente nuevo en «Nueva atención» → Planes → paquete.
   (a) hoy solo paga: no hace falta guardar atención; (b) hoy se hizo la sesión 1 y paga todo. */
const { abrir, entrar, close, sha, fakeServer } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
const btn = (T, re) => T.$$('#modal button').find(b => re.test(b.textContent));
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer();
  const A = await abrir({ server }); await entrar(A, FAB.admin); const w = A.w, hoy = w.hoyISO();
  const toasts = []; const t0 = w.toast; w.toast = function (m) { toasts.push(String(m)); return t0.apply(this, arguments); };
  w.show('config'); A.setVal('#c-pass-admin', 'duena-paq-2'); A.click('#btn-save-pass-admin'); await A.tick(80);
  w.CFG.planesTipo = [{ nombre: 'Blanqueamiento', total: 700, paquete: true, deClinica: true, etapas: w.etapasPaquete('Blanqueamiento', 3, 700) }]; w.saveCfg(true); await A.tick(30);
  const caja = () => w.totalCobros(w.filasCajaDia(hoy)), c0 = caja();
  const empezar = async (pac) => {
    w.show('atencion'); w.clearForm(); A.setVal('#f-prof', 'Dra. Mirna'); A.setVal('#f-paciente', pac); A.setVal('#f-cel', '651214545');
    A.radio('canal', w.CFG.canales[0]); await A.tick(5);
    A.click('#btn-planes'); await A.tick(5); btn(A, /📦 Blanqueamiento/).click(); await A.tick(30);
  };
  // (a) solo paga
  await empezar('Cliente Prueba X');
  OK('a pregunta «¿Hoy se hizo la sesión 1?»', A.modalOpen() && /Hoy se hizo la sesión 1/.test(A.$('#modal').textContent) && /no hace falta guardar ninguna atención/.test(A.$('#modal').textContent));
  btn(A, /No, hoy solo paga/).click(); await A.tick(10);
  OK('a abre el pago del paquete con 700 sugeridos', A.$('#an-monto') && A.$('#an-monto').value === '700', A.$('#an-monto') && A.$('#an-monto').value);
  A.radio('anmet', 'QR'); btn(A, /Guardar pago/).click(); await A.tick(120); close(A);
  const an = w.DATA.filter(r => r.paciente === 'Cliente Prueba X' && w.esAnticipo(r));
  OK('a pago de 700 al paquete, con celular y canal', an.length === 1 && an[0].acuenta === 700 && an[0].celular === '651214545' && an[0].canal === w.CFG.canales[0], an.map(a => [a.acuenta, a.celular, a.canal]));
  OK('a el formulario quedó limpio (no pide la atención)', A.$('#f-paciente').value === '' && toasts.some(x => /No hace falta guardar una atención/.test(x)), [A.$('#f-paciente').value, toasts.slice(-2)]);
  OK('a ninguna atención guardada', !w.DATA.some(r => r.paciente === 'Cliente Prueba X' && w.esAtencion(r)));
  OK('a caja +700', caja() === c0 + 700);
  // vuelve: Marcar realizada
  const pl = w.planesDe('Cliente Prueba X')[0];
  w.atencionDePlan('Cliente Prueba X', pl.id, 1); A.setVal('#ap-prof', 'Dra. Mirna'); w.guardarAtencionPlan(); await A.tick(200); close(A);
  const at = w.DATA.find(r => r.paciente === 'Cliente Prueba X' && w.esAtencion(r));
  OK('a sesión 1 marcada: 234 pagados con el paquete, celular, canal y «Nuevo»', at && at.total === 234 && at.saldo === 0 && at.celular === '651214545' && at.canal === w.CFG.canales[0] && at.tipo === 'Nuevo', at && [at.total, at.saldo, at.celular, at.canal, at.tipo]);
  OK('a la caja no suma de nuevo', caja() === c0 + 700);
  // (b) hoy se hizo la sesión 1 y paga todo
  await empezar('Cliente Prueba Y');
  btn(A, /Sí, hoy se hizo la sesión 1/).click(); await A.tick(20);
  const pY = w.planesDe('Cliente Prueba Y')[0];
  OK('b la atención quedó con el paquete elegido y la sesión 1 cargada', A.$('#f-plan').value === pY.id && A.$$('#srv-list .s-precio')[0].value === '234', [A.$('#f-plan').value === pY.id, A.$$('#srv-list .s-precio')[0].value]);
  A.setVal('#f-acuenta', '700'); A.radio('metodo', 'QR'); await A.tick(5);
  OK('b dice que 466 quedan como pago del plan', /466/.test(A.$('#pago-tag').textContent) && /pago del plan/.test(A.$('#pago-tag').textContent), A.$('#pago-tag').textContent);
  A.click('#btn-save'); await A.tick(150);
  const t = A.toast(); close(A);
  const aY = w.DATA.find(r => r.paciente === 'Cliente Prueba Y' && w.esAtencion(r)), anY = w.DATA.filter(r => r.paciente === 'Cliente Prueba Y' && w.esAnticipo(r));
  OK('b se guarda sin pedir nada más', !!aY && !A.modalOpen(), t);
  OK('b atención 234 QR + 466 al paquete QR', aY && aY.total === 234 && aY.acuenta === 234 && anY.length === 1 && anY[0].acuenta === 466 && anY[0].metodo === 'QR', aY && [aY.total, aY.acuenta, anY.map(a => a.acuenta)]);
  OK('b plan: 1/3, pagado 700', w.avancePlan(pY).hechas === 1 && w.cobradoPlan(pY) === 700 && w.saldoPlan(pY) === 0);
  OK('b caja +700 más', caja() === c0 + 1400, caja() - c0);
  OK('b el servidor tiene la atención y el pago', server.registros[aY.id] && server.registros[aY.id].total === 234 && Object.values(server.registros).filter(r => r.paciente === 'Cliente Prueba Y' && r.estado === 'Anticipo').length === 1);
  // (c) una visita suelta sigue sin poder cobrar de más
  w.show('atencion'); w.clearForm(); A.setVal('#f-prof', 'Dra. Mirna'); A.setVal('#f-paciente', 'Otro Suelto'); A.setVal('#f-cel', '7001');
  A.setVal('#srv-list .s-nom', 'Limpieza dental'); A.setVal('#srv-list .s-precio', '100'); A.setVal('#f-acuenta', '150'); A.radio('metodo', 'Efectivo'); A.radio('canal', w.CFG.canales[0]);
  A.click('#btn-save'); await A.tick(30);
  OK('c visita suelta con 150 de 100: sigue frenada', /es más que el total/.test(A.toast()) && !w.DATA.some(r => r.paciente === 'Otro Suelto'), A.toast());
  console.log(A.errors.slice(0, 3));
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
