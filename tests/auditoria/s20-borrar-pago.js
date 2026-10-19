'use strict';
const FAB = require('./lib.js').FAB;
/* s20: borrar un pago es inmediato (no baja la lista) y la paciente con pagos y ficha sale una sola vez. */
const { abrir, entrar, close, fakeServer } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer();
  const A = await abrir({ server }); await entrar(A, FAB.admin); const w = A.w;
  w.confirm = () => true;
  const toasts = []; const t0 = w.toast; w.toast = function (m) { toasts.push(String(m)); return t0.apply(this, arguments); };
  // paciente con ficha (plan) y un pago al plan, sin visitas
  const f = w.pacDe('Viviana Demo'); f.nombre = 'Viviana Demo'; f.planes.push(w.planNormalize({ nombre: 'Blanqueamiento', total: 700, deClinica: true, paquete: true, sesiones: [{ desc: 's1', precio: 234 }, { desc: 's2', precio: 233 }, { desc: 's3', precio: 233 }] })); w.savePac(f);
  const pl = w.planesDe('Viviana Demo')[0];
  w.registrarPagoPlan('Viviana Demo', pl.id, 467, 'Efectivo', w.hoyISO(), 'prueba'); await A.tick(80);
  w.show('pacientes'); w.renderPacientes();
  const filas = A.$$('#pc-body tr').filter(tr => /Viviana Demo/.test(tr.textContent));
  OK('1 sale una sola vez en Pacientes, marcada «sin visitas»', filas.length === 1 && /sin visitas/.test(filas[0].textContent), filas.length);
  const an = w.DATA.find(r => r.paciente === 'Viviana Demo' && w.esAnticipo(r));
  const nList = server.log ? server.log.filter(x => x.action === 'list').length : null;
  const antes = Date.now(); w.borrarAnticipo(an.id); const ms = Date.now() - antes; await A.tick(120);
  OK('2 al tocar Borrar avisa enseguida y confirma', toasts.some(t => /^Borrando/.test(t)) && toasts.some(t => /borrado ✅/.test(t)) && ms < 300, [ms, toasts.slice(-1)]);
  OK('2 el servidor lo borró', !server.registros[an.id]);
  OK('2 la ficha sigue (tiene el paquete)', A.modalOpen() && /Viviana Demo/.test(A.$('#modal').textContent)); close(A);
  // un pago ya usado desde otro equipo: el servidor no lo borra y avisa
  w.registrarPagoPlan('Viviana Demo', pl.id, 300, 'QR', w.hoyISO(), 'otro'); await A.tick(80);
  const an2 = w.DATA.find(r => r.paciente === 'Viviana Demo' && w.esAnticipo(r));
  // otro equipo lo usa: una atención pagada con saldo a favor directo en el servidor
  const B = await abrir({ server }); await entrar(B, FAB.admin); await B.w.pullServer(); await B.tick(600);
  B.w.atencionDePlan('Viviana Demo', pl.id, 1); B.setVal('#ap-prof', 'Dra. Mirna'); B.w.guardarAtencionPlan(); await B.tick(300);
  w.borrarAnticipo(an2.id); await A.tick(1500);
  OK('3 ya usado desde otro equipo: el servidor no lo borra y avisa (sin decir borrado)', !!server.registros[an2.id] && toasts.some(t => /ya se usó/.test(t)) && !toasts.some(t => /300 borrado/.test(t)), toasts.slice(-2));
  console.log(A.errors.slice(0, 3));
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
