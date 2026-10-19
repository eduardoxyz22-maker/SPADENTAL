'use strict';
const FAB = require('./lib.js').FAB;
/* s13: la doctora del plan registra los pagos de su plan (también en Cosmetic,
   donde los anticipos sueltos siguen siendo de la dueña y recepción).
   Datos ficticios; servidor = .gs real en memoria. */
const { abrir, entrar, nueva, R, close, sha, fakeServer } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(66), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer();
  const ADM = await abrir({ server }); await entrar(ADM, FAB.admin);
  ADM.w.CFG.clavesProf = { 'Dra. Brenda': sha('brenda-plan') }; ADM.w.saveCfg(true); await ADM.tick(30);
  await nueva(ADM, { pac: 'Pac Brenda', total: 100, acuenta: 100, prof: 'Dra. Brenda' });
  await nueva(ADM, { pac: 'Pac Mirna', total: 100, acuenta: 100, prof: 'Dra. Mirna' });
  // la dueña arma un plan para cada doctora
  const armar = async (pac, prof) => {
    ADM.w.nuevoPlan(pac); await ADM.tick(5);
    const i = ADM.w.plantillasPlan().findIndex(t => t.nombre === 'Ortodoncia'); ADM.$('#pl-tipo').value = String(i); ADM.w.aplicarPlantilla(i);
    if (ADM.$('#pl-prof')) ADM.setVal('#pl-prof', prof);
    ADM.w.PL_ETAPAS.forEach(e => { if (/Instalación/.test(e.desc)) e.precio = 3000; });
    ADM.w.pintarEtapasEditor(); ADM.$('#pl-tot').value = ADM.w.sumaEtapas();
    ADM.$$('#modal button').find(b => /Guardar plan/.test(b.textContent)).click(); await ADM.tick(60); close(ADM);
    return ADM.w.planesDe(pac)[0];
  };
  const pB = await armar('Pac Brenda', 'Dra. Brenda'), pM = await armar('Pac Mirna', 'Dra. Mirna');
  OK('0 planes creados con su doctora', pB && pM && pB.prof === 'Dra. Brenda' && pM.prof === 'Dra. Mirna', [pB && pB.prof, pM && pM.prof]);
  OK('0 el servidor avisa que acepta pagos de plan de doctoras', ADM.w.CFG.pagoPlanDoctoras === true);

  const D = await abrir({ server }); await entrar(D, 'brenda-plan'); await D.w.pullServer(); await D.tick(700);
  const w = D.w, hoy = w.hoyISO();
  OK('1 anticipo suelto: igual que antes según clínica', w.puedeAnticipo() === SPA, w.puedeAnticipo());
  OK('1 su plan: puede registrar pagos', w.puedePagoPlan('Pac Brenda', pB.id) === true);
  OK('1 plan de otra doctora: no (en ninguna clínica: el servidor lo rechaza)', w.puedePagoPlan('Pac Mirna', pM.id) === false);
  w.verPlan('Pac Brenda', pB.id);
  OK('2 la pantalla del plan muestra "Pago adelantado o cuota"', D.$$('#modal button').some(b => /Pago adelantado o cuota/.test(b.textContent)));
  close(D);
  // pago al plan desde la pantalla
  w.pagoAlPlan('Pac Brenda', pB.id);
  OK('3 abre el formulario de pago al plan', !!D.$('#an-monto'), D.toast());
  D.setVal('#an-monto', '1200'); D.radio('anmet', 'QR');
  D.$$('#modal button').find(b => /Guardar pago/.test(b.textContent)).click(); await D.tick(80);
  const enSrv = () => Object.values(server.registros).filter(r => r.paciente === 'Pac Brenda' && r.estado === 'Anticipo');
  OK('3 el servidor guardó el pago al plan a su nombre', enSrv().length === 1 && enSrv()[0].planId === pB.id && enSrv()[0].anticipoPor === 'Dra. Brenda', enSrv().map(r => [r.planId === pB.id, r.anticipoPor]));
  OK('3 sin pendientes ni rechazos', !(w.PEND || []).length && !/sin_permiso|rechaz/i.test(D.toast()), D.toast());
  // control incluido con cuota mensual: la plata sobrante va al plan
  const ctrl = w.planesDe('Pac Brenda')[0].sesiones.find(s => /Control mensual 1$/.test(s.desc));
  w.atencionDePlan('Pac Brenda', pB.id, ctrl.n); D.setVal('#ap-monto', '300'); D.radio('apmet', 'Efectivo');
  w.guardarAtencionPlan(); await D.tick(80);
  OK('4 control incluido + Bs 300: queda pago al plan en el servidor', enSrv().length === 2 && enSrv().some(r => r.acuenta === 300), enSrv().map(r => r.acuenta));
  OK('4 el control quedó atendido', w.planesDe('Pac Brenda')[0].sesiones.find(s => s.n === ctrl.n).hecha === true);
  OK('4 pagado del plan = 1500', w.cobradoPlan(w.planesDe('Pac Brenda')[0]) === 1500, w.cobradoPlan(w.planesDe('Pac Brenda')[0]));
  OK('4b lo pagado al plan no figura como saldo a favor suelto', w.creditoLibre('Pac Brenda') === 0 && w.creditoDe('Pac Brenda') === 1500, [w.creditoLibre('Pac Brenda'), w.creditoDe('Pac Brenda')]);
  w.verPaciente('Pac Brenda'); await D.tick(5);
  OK('4b la ficha lo explica aparte', /adelantados a sus planes/.test(D.$('#modal').textContent));
  close(D);
  // instalación: se descuenta sola del pago al plan
  const inst = w.planesDe('Pac Brenda')[0].sesiones.find(s => /Instalación/.test(s.desc));
  w.atencionDePlan('Pac Brenda', pB.id, inst.n); w.guardarAtencionPlan(); await D.tick(80);
  const at = Object.values(server.registros).find(r => r.planId === pB.id && r.planEtapa === inst.n);
  OK('5 instalación: descuenta 1500 del plan y debe 1500', at && at.saldo === 1500, at && [at.acuenta, at.saldo]);
  // el servidor sigue frenando un anticipo suelto de una doctora en Cosmetic
  const n0 = Object.keys(server.registros).length;
  const suelto = { id: w.uid(), clinicaId: w.CLINICA_ID, ts: new Date().toISOString(), fecha: hoy, hora: '10:00', profesional: '', paciente: 'Pac Brenda',
    estado: 'Anticipo', servicios: [], total: 0, acuenta: 50, saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 50 }],
    cobrosPosteriores: [], cobroInicialFechado: true, obs: 'prueba', anticipoPor: 'Dra. Brenda' };
  w.DATA.push(suelto); w.persist(suelto); await D.tick(80);
  const llego = !!server.registros[suelto.id];
  OK('6 servidor: anticipo suelto de doctora ' + (SPA ? 'aceptado (Spa)' : 'rechazado (Cosmetic)'), llego === SPA, [llego, Object.keys(server.registros).length - n0]);
  // pago a un plan ajeno forzado: el panel no lo ofrece
  close(D); w.nuevoAnticipo('Pac Mirna', pM.id);
  OK('7 plan de otra doctora: no abre el formulario', !D.$('#an-monto') || !SPA && false, D.toast());
  close(D);
  // con el Apps Script anterior (sin la marca) el panel no ofrece el pago
  const flag = w.CFG.pagoPlanDoctoras, fs0 = w.SESION.pagoPlan; delete w.CFG.pagoPlanDoctoras; w.SESION.pagoPlan = false;
  OK('8 Apps Script anterior: ' + (SPA ? 'Spa sigue pudiendo' : 'Cosmetic no lo ofrece'), w.puedePagoPlan('Pac Brenda', pB.id) === SPA);
  w.CFG.pagoPlanDoctoras = flag; w.SESION.pagoPlan = fs0;
  // borra su propio pago si no se usó: el de 300 se usó en la instalación, el panel lo frena
  const caja = w.totalCobros(w.filasCajaDia(hoy));
  OK('9 caja de hoy: 1200 + 300 (+ 50 en Spa) más lo de antes', caja >= 1500, caja);
  R('errores', [ADM.errors.slice(0, 3), D.errors.slice(0, 3)]);
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
