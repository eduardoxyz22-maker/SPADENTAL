'use strict';
const FAB = require('./lib.js').FAB;
/* s12: planes de tratamiento en una sola pantalla. Datos ficticios; servidor = .gs real en memoria. */
const { abrir, entrar, nueva, R, close, sha, fakeServer } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(66), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer();
  const A = await abrir({ server }); await entrar(A, FAB.admin); const w = A.w, hoy = w.hoyISO();
  const conf = (f) => { const c = w.confirm; w.confirm = () => true; try { return f(); } finally { w.confirm = c; } };
  const caja = () => w.totalCobros(w.filasCajaDia(hoy));
  const plan = (pac, id) => w.planesDe(pac).find(p => p.id === id);
  const srvPlan = (pac, id) => (server.pacientes[pac.toLowerCase()] || { planes: [] }).planes.find(p => p.id === id);
  await nueva(A, { pac: 'Orto Sinpago', total: 100, acuenta: 100, prof: 'Dra. Mirna' });
  await nueva(A, { pac: 'Orto Adelantado', total: 100, acuenta: 100, prof: 'Dra. Mirna' });
  const c0 = caja();

  // ---- 1 crear plan de ortodoncia desde la plantilla, sin pagos
  w.verPaciente('Orto Sinpago'); A.$$('#modal button').find(b => /Planes/.test(b.textContent)).click(); await A.tick(5);
  A.$$('#modal button').find(b => /Crear plan de tratamiento/.test(b.textContent)).click(); await A.tick(5);
  const optO = A.$$('#pl-tipo option').find(o => /Ortodoncia/.test(o.textContent));
  OK('1 la plantilla Ortodoncia está disponible', !!optO);
  A.$('#pl-tipo').value = optO.value; A.$('#pl-tipo').dispatchEvent(new A.w.Event('change')); await A.tick(5);
  const fila = (txt) => A.$$('#pl-etapas .pl-et').find(d => d.querySelector('[data-k="desc"]').value === txt);
  const setP = (txt, v) => { const i = fila(txt).querySelector('[data-k="precio"]'); A.setVal(i, String(v)); i.dispatchEvent(new A.w.Event('input')); };
  setP('Evaluación y diagnóstico', 200); setP('Instalación de brackets', 3000); setP('Retiro de brackets', 500); setP('Retenedores', 800);
  OK('1 el presupuesto se arma solo con las etapas', A.$('#pl-tot').value === '4500', A.$('#pl-tot').value);
  A.$$('#modal button').find(b => /Guardar plan/.test(b.textContent)).click(); await A.tick(60);
  const p1 = w.planesDe('Orto Sinpago')[0];
  OK('1 se guardó en la ficha (servidor) con 16 etapas', !!p1 && srvPlan('Orto Sinpago', p1.id) && srvPlan('Orto Sinpago', p1.id).sesiones.length === 16, p1 && p1.sesiones.length);
  OK('1 abre la pantalla del plan: 0 pagado, 4500 pendiente, 0/16', /Presupuesto acordado/.test(A.$('#modal').textContent) && w.cobradoPlan(p1) === 0 && w.saldoPlan(p1) === 4500 && w.avancePlan(p1).hechas === 0);
  OK('1 cada etapa tiene Registrar atención / Registrar pago', A.$$('#modal button').filter(b => /Marcar realizada$/.test(b.textContent)).length === 16 && A.$$('#modal button').filter(b => /Pago adelantado o cuota|Adelantar esta sesión/.test(b.textContent)).length >= 1);
  const nCalls0 = server.log.length;
  w.verPresupuesto('Orto Sinpago', p1.id);
  OK('1 WhatsApp es aparte: abrirlo no guarda nada', server.log.length === nCalls0 && /no lo acepta ni lo cobra/.test(A.$('#modal').textContent));
  OK('1 el mensaje lleva etapas e importes', /Instalación de brackets — Bs 3.000/.test(A.$('#wa-txt').textContent));

  // ---- 2 atender etapa 1 sin pagar → queda debiendo esa atención
  w.atencionDePlan('Orto Sinpago', p1.id, 1); A.setVal('#ap-obs', 'Rx y modelos');
  OK('2 formulario corto con paciente/plan/etapa/precio cargados', /Orto Sinpago/.test(A.$('#modal').textContent) && /Evaluación y diagnóstico/.test(A.$('#modal').textContent) && /Bs 200/.test(A.$('#modal').textContent));
  w.guardarAtencionPlan(); w.guardarAtencionPlan(); await A.tick(60);
  const at1 = Object.values(server.registros).filter(r => r.planId === p1.id && r.estado === 'Atendido');
  OK('2 una sola atención (doble clic) enlazada a la etapa 1', at1.length === 1 && at1[0].planEtapa === 1 && at1[0].total === 200 && at1[0].saldo === 200, at1.map(r => [r.total, r.saldo, r.planEtapa]));
  OK('2 la etapa 1 queda hecha y apunta a esa atención', plan('Orto Sinpago', p1.id).sesiones[0].hecha && plan('Orto Sinpago', p1.id).sesiones[0].atencionId === at1[0].id);
  OK('2 la caja no cambia (no pagó)', caja() === c0);
  // ---- 3 pago parcial de esa etapa
  w.verPlan('Orto Sinpago', p1.id);
  const bPago = A.$$('#modal .pl-fila').find(tr => /Evaluación/.test(tr.textContent)).querySelectorAll('button');
  [...bPago].find(b => /Cobrar lo que debe/.test(b.textContent)).click(); await A.tick(5);
  A.setVal('#cp-m', '100'); A.radio('cpmet', 'Efectivo'); w.guardarPago(at1[0].id); await A.tick(60); close(A);
  OK('3 abona 100: la atención debe 100', server.registros[at1[0].id].saldo === 100 && caja() === c0 + 100);
  // ---- 4 pago al plan (cuota) que cubre varias etapas
  w.pagoAlPlan('Orto Sinpago', p1.id); A.setVal('#an-monto', '2000'); A.radio('anmet', 'QR');
  A.$$('#modal button').find(b => /Guardar pago/.test(b.textContent)).click(); await A.tick(60);
  const pp = plan('Orto Sinpago', p1.id);
  OK('4 pago al plan: entra a la caja hoy', caja() === c0 + 2100, caja() - c0);
  OK('4 plan: pagado 2100, pendiente 2400', w.cobradoPlan(pp) === 2100 && w.saldoPlan(pp) === 2400, [w.cobradoPlan(pp), w.saldoPlan(pp)]);
  OK('4 la pantalla muestra lo que ya cubre en la etapa pendiente', /2.000/.test(A.$$('#modal .pl-fila').find(tr => /Instalación/.test(tr.textContent)).textContent));
  // ---- 5 atender instalación: se descuenta sola del pago al plan
  w.atencionDePlan('Orto Sinpago', p1.id, 2); w.guardarAtencionPlan(); await A.tick(80);
  const at2 = Object.values(server.registros).find(r => r.planId === p1.id && r.planEtapa === 2);
  OK('5 instalación 3000: 2000 del pago al plan, debe 1000', at2 && at2.acuenta === 2000 && at2.saldo === 1000 && at2.pagos.some(p => p.metodo === 'Saldo a favor' && p.monto === 2000), at2 && at2.pagos);
  OK('5 la caja no vuelve a sumar', caja() === c0 + 2100);
  OK('5 plan sigue con 2100 pagado (sin contar dos veces)', w.cobradoPlan(plan('Orto Sinpago', p1.id)) === 2100);
  // ---- 6 control incluido: sin deuda; pago que sobra va al plan
  w.atencionDePlan('Orto Sinpago', p1.id, 3); A.setVal('#ap-monto', '700'); A.radio('apmet', 'Efectivo'); w.guardarAtencionPlan(); await A.tick(80);
  const at3 = Object.values(server.registros).find(r => r.planId === p1.id && r.planEtapa === 3);
  OK('6 control incluido: atención en 0, sin deuda', at3 && at3.total === 0 && at3.saldo === 0 && at3.acuenta === 0);
  OK('6 los 700 de ese día quedan como pago al plan', Object.values(server.registros).some(r => r.estado === 'Anticipo' && r.planId === p1.id && r.acuenta === 700) && caja() === c0 + 2800);
  OK('6 plan: pagado 2800', w.cobradoPlan(plan('Orto Sinpago', p1.id)) === 2800, w.cobradoPlan(plan('Orto Sinpago', p1.id)));

  // ---- 7 plan pagado por adelantado (3 sesiones de 1000)
  w.nuevoPlan('Orto Adelantado'); A.setVal('#pl-nom', 'Blanqueamiento en 3 sesiones');
  const i0 = A.$('#pl-etapas [data-k="desc"]'); A.setVal(i0, 'Sesión de blanqueamiento'); i0.dispatchEvent(new A.w.Event('input'));
  const c0i = A.$('#pl-etapas [data-k="cant"]'); A.setVal(c0i, '3'); c0i.dispatchEvent(new A.w.Event('input'));
  const p0i = A.$('#pl-etapas [data-k="precio"]'); A.setVal(p0i, '1000'); p0i.dispatchEvent(new A.w.Event('input'));
  A.$$('#modal button').find(b => /Guardar plan/.test(b.textContent)).click(); await A.tick(60);
  const p2 = w.planesDe('Orto Adelantado')[0];
  OK('7 cantidad 3 → 3 etapas, presupuesto 3000', p2 && p2.sesiones.length === 3 && p2.total === 3000, p2 && [p2.sesiones.map(s => s.desc), p2.total]);
  w.pagoAlPlan('Orto Adelantado', p2.id); A.setVal('#an-monto', '3000'); A.radio('anmet', 'Transferencia');
  A.$$('#modal button').find(b => /Guardar pago/.test(b.textContent)).click(); await A.tick(60);
  const c7 = caja();
  // una atención suelta del mismo paciente NO usa el pago del plan
  const suelta = await nueva(A, { pac: 'Orto Adelantado', total: 200, acuenta: 0, prof: 'Dra. Mirna' });
  OK('7 una atención suelta no usa lo pagado al plan', server.registros[suelta.r.id].saldo === 200, server.registros[suelta.r.id].pagos);
  for (const n of [1, 2, 3]) { w.atencionDePlan('Orto Adelantado', p2.id, n); w.guardarAtencionPlan(); await A.tick(80); }
  const ats2 = Object.values(server.registros).filter(r => r.planId === p2.id && r.estado === 'Atendido');
  OK('7 las 3 sesiones quedan pagadas con el adelanto', ats2.length === 3 && ats2.every(r => r.saldo === 0 && r.acuenta === 1000));
  const pp2 = plan('Orto Adelantado', p2.id);
  OK('7 plan: pagado 3000, pendiente 0, terminado', w.cobradoPlan(pp2) === 3000 && w.saldoPlan(pp2) === 0 && pp2.estado === 'terminado', [w.cobradoPlan(pp2), pp2.estado]);
  OK('7 la caja solo sumó los 3000 del adelanto', caja() === c7);

  // ---- 8 usa la cita agendada del día (no duplica)
  w.show('cita'); w.clearCita(); A.setVal('#q-fecha', hoy); A.setVal('#q-hora', '18:00'); A.setVal('#q-prof', 'Dra. Mirna');
  A.setVal('#q-paciente', 'Orto Sinpago'); A.setVal('#q-cel', '70009999'); A.radio('qagenda', 'WhatsApp'); A.click('#btn-save-cita'); await A.tick(40); close(A);
  const cita = w.DATA.find(r => r.paciente === 'Orto Sinpago' && r.estado === 'Agendada');
  w.atencionDePlan('Orto Sinpago', p1.id, 4); w.guardarAtencionPlan(); await A.tick(80);
  OK('8 la cita de hoy se convierte en la atención del control', server.registros[cita.id].estado === 'Atendido' && server.registros[cita.id].planEtapa === 4 && !Object.values(server.registros).some(r => r.paciente === 'Orto Sinpago' && r.estado === 'Agendada'));

  // ---- 9 editar el plan: agregar etapa sin perder lo hecho; no se puede quitar lo atendido
  w.editarPlan('Orto Sinpago', p1.id); w.agregarEtapaEditor('Control extra');
  const ult = A.$$('#pl-etapas .pl-et').slice(-1)[0];
  A.setVal(ult.querySelector('[data-k="precio"]'), '150'); ult.querySelector('[data-k="precio"]').dispatchEvent(new A.w.Event('input'));
  ult.querySelector('[data-k="aparte"]').checked = true; ult.querySelector('[data-k="aparte"]').dispatchEvent(new A.w.Event('change'));
  A.$$('#modal button').find(b => /Guardar plan/.test(b.textContent)).click(); await A.tick(60);
  const pe = plan('Orto Sinpago', p1.id);
  OK('9 se agregó un control aparte y lo hecho sigue enlazado', pe.sesiones.length === 17 && pe.sesiones[16].aparte && pe.sesiones[0].atencionId === at1[0].id && pe.sesiones[1].atencionId === at2.id && pe.total === 4500, [pe.sesiones.length, pe.total]);
  OK('9 no tiene botón para quitar una etapa atendida', (() => { w.editarPlan('Orto Sinpago', p1.id); const r = !A.$$('#pl-etapas .pl-et')[0].querySelector('button'); close(A); return r; })());

  // ---- 10 recomendado → plan
  const rr = await nueva(A, { pac: 'Reco Ficticia', total: 100, acuenta: 100, prof: 'Dra. Mirna' });
  const rec = w.DATA.find(r => r.id === rr.r.id); rec.presu = [w.preNormalize({ nom: 'Diseño de sonrisa', monto: 5000 })]; w.persist(rec); await A.tick(40);
  w.planDesdeRecomendado(rec.id, rec.presu[0].id);
  OK('10 "Armar plan" abre el editor con el recomendado', A.$('#pl-nom').value === 'Diseño de sonrisa' && A.$('#pl-tot').value === '5000');
  A.$$('#modal button').find(b => /Guardar plan/.test(b.textContent)).click(); await A.tick(60);
  OK('10 queda guardado como plan', w.planesDe('Reco Ficticia').length === 1 && w.planesDe('Reco Ficticia')[0].total === 5000);

  // ---- 11 plan viejo (sin importes por etapa) sigue igual
  const pv = w.pacDe('Viejo Ficticio'); pv.nombre = 'Viejo Ficticio';
  pv.planes.push(w.planNormalize({ id: 'pv1', nombre: 'Plan viejo', total: 1500, sesiones: [{ desc: 'a' }, { desc: 'b' }] })); w.savePac(pv); await A.tick(40);
  const v1 = await nueva(A, { pac: 'Viejo Ficticio', total: 700, acuenta: 400, prof: 'Dra. Mirna', planId: 'pv1' });
  OK('11 plan viejo: cobrado = lo cobrado en sus atenciones', w.cobradoPlan(plan('Viejo Ficticio', 'pv1')) === 400 && plan('Viejo Ficticio', 'pv1').sesiones[0].hecha);
  // ---- 12 borrar una atención de etapa devuelve la etapa y el adelanto
  const credAntes = w.creditoPara('Orto Adelantado', p2.id);
  conf(() => w.borrar(ats2[2].id)); await A.tick(60);
  OK('12 borrar la atención: etapa pendiente otra vez y el adelanto vuelve', !plan('Orto Adelantado', p2.id).sesiones[2].hecha && w.creditoPara('Orto Adelantado', p2.id) === credAntes + 1000 && w.cobradoPlan(plan('Orto Adelantado', p2.id)) === 3000);
  // ---- 13 otro equipo ve lo mismo
  const B = await abrir({ server }); await entrar(B, FAB.admin); await B.w.pullServer(); await B.tick(400);
  const pB = B.w.planesDe('Orto Sinpago').find(p => p.id === p1.id);
  OK('13 otro equipo ve el plan, pagos y etapas iguales', pB && B.w.cobradoPlan(pB) === w.cobradoPlan(plan('Orto Sinpago', p1.id)) && B.w.avancePlan(pB).hechas === 4, pB && [B.w.cobradoPlan(pB), B.w.avancePlan(pB).hechas]);
  R('errores', [A.errors.slice(0, 3), B.errors.slice(0, 3)]);
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
