'use strict';
const FAB = require('./lib.js').FAB;
/* s22: el caso real, con Google tardando: ya había un «BLANQUEAMIENTO» sin empezar;
   después consulta 150 + paquete 700, pagó 850. Tiene que quedar UN paquete, con la
   sesión 1 hecha y 466 adelantados; la sesión 2 se paga sola. */
const { abrir, entrar, close, fakeServer } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
const btn = (T, re) => T.$$('#modal button').find(b => re.test(b.textContent));
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer();
  const A = await abrir({ server }); await entrar(A, FAB.admin); const w = A.w, hoy = w.hoyISO();
  w.confirm = () => true; w.prompt = () => '3';
  w.CFG.planesTipo = [{ nombre: 'BLANQUEAMIENTO', total: 700, paquete: true, deClinica: true, etapas: w.etapasPaquete('BLANQUEAMIENTO', 3, 700) }]; w.saveCfg(true); await A.tick(40);
  server.latency = 1500;
  const consulta = w.CFG.precios.find(p => /consulta|valoraci/i.test(p.nom)).nom;
  const blanq = SPA ? w.CFG.precios.find(p => /blanqueamiento/i.test(p.nom)).nom : 'Blanqueamiento dental · 3 sesiones';
  // 0 una prueba anterior dejó un paquete sin empezar
  w.show('atencion'); w.clearForm(); A.setVal('#f-prof', 'Dra. Mirna'); A.setVal('#f-paciente', 'Caso Real'); A.setVal('#f-cel', '70099911'); A.radio('canal', w.CFG.canales[0]);
  A.click('#btn-planes'); await A.tick(5); btn(A, /📦 BLANQUEAMIENTO/).click(); await A.tick(20); close(A);
  await A.tick(2500);
  OK('0 quedó un paquete sin empezar', w.planesDe('Caso Real').length === 1 && w.avancePlan(w.planesDe('Caso Real')[0]).hechas === 0);
  // 1 la atención: consulta + paquete, pagó 850
  w.show('atencion'); w.clearForm(); A.setVal('#f-prof', 'Dra. Mirna'); A.setVal('#f-paciente', 'Caso Real'); A.setVal('#f-cel', '70099911'); A.radio('canal', w.CFG.canales[0]);
  A.setVal('#srv-list .s-nom', consulta); await A.tick(5); A.setVal('#srv-list .s-precio', '150'); await A.tick(5);
  A.click('#btn-add-srv'); await A.tick(5);
  A.setVal(A.$$('#srv-list .s-nom')[1], blanq); await A.tick(5); A.setVal(A.$$('#srv-list .s-precio')[1], '700'); await A.tick(5);
  if (!/Paquete de 3 sesiones/.test(A.$('#srv-list').textContent)) { A.$$('#srv-list .srv')[1].querySelector('.s-paq').click(); await A.tick(5); }
  A.setVal('#f-acuenta', '850'); A.radio('metodo', 'Efectivo');
  A.click('#btn-save'); await A.tick(200); close(A);
  await A.tick(6000);
  const ps = w.planesDe('Caso Real'), pl = ps[0];
  OK('1 sigue habiendo UN solo paquete (se usó el que había)', ps.length === 1, ps.length);
  const at = w.DATA.find(r => r.paciente === 'Caso Real' && w.esAtencion(r));
  OK('1 atención 384 pagada, enlazada como sesión 1', at && at.total === 384 && at.saldo === 0 && at.planId === pl.id && pl.sesiones[0].hecha && pl.sesiones[0].atencionId === at.id, at && [at.total, at.saldo, pl.sesiones[0].hecha]);
  OK('1 466 adelantados a ese paquete', w.cuentasPlan(pl).queda === 466 && w.cobradoPlan(pl) === 700 && w.creditoLibre('Caso Real') === 0, w.cuentasPlan(pl));
  OK('1 sin pendientes en la cola', !w.pend().length, w.pend().length);
  // 2 lo que quedó en el servidor (otro equipo que recarga)
  server.latency = 0;
  const B = await abrir({ server }); await entrar(B, FAB.admin); await B.w.pullServer(); await B.tick(700);
  const pB = B.w.planesDe('Caso Real');
  OK('2 en el servidor: un paquete, sesión 1 hecha, adelanto 466', pB.length === 1 && pB[0].sesiones[0].hecha && B.w.cuentasPlan(pB[0]).queda === 466, [pB.length, pB[0] && pB[0].sesiones.map(s => s.hecha)]);
  // 3 la sesión 2 se paga sola (con Google tardando)
  server.latency = 1500;
  B.w.atencionDePlan('Caso Real', pB[0].id, 2); B.setVal('#ap-prof', 'Dra. Mirna'); B.w.guardarAtencionPlan(); await B.tick(5000); close(B);
  const a2 = B.w.DATA.find(r => r.paciente === 'Caso Real' && r.planEtapa === 2);
  OK('3 sesión 2: 233 pagados con el adelanto, sin deuda', a2 && a2.total === 233 && a2.saldo === 0, a2 && [a2.total, a2.saldo]);
  OK('3 queda adelantado 233', B.w.cuentasPlan(B.w.planesDe('Caso Real')[0]).queda === 233);
  // 4 si igual hay dos iguales, la ficha avisa
  const f = w.pacDe('Caso Real'); f.planes.push(w.planNormalize({ nombre: 'BLANQUEAMIENTO', total: 700, sesiones: [{ desc: 'a', precio: 350 }, { desc: 'b', precio: 350 }] })); 
  w.verPaciente('Caso Real'); await A.tick(5);
  OK('4 con dos iguales activos, la ficha avisa', /dos «BLANQUEAMIENTO» activos/.test(A.$('#modal').textContent)); close(A);
  console.log(A.errors.slice(0, 3), B.errors.slice(0, 3));
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
