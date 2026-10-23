'use strict';
const FAB = require('./lib.js').FAB;
/* s09: anticipos como saldo a favor. Servidor = el .gs real en memoria; netguard bloquea red real. */
const { abrir, entrar, nueva, pagar, R, close, sha, fakeServer } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(64), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer();
  /* desde 2026-10-29-auditoria la clave de fábrica no borra: la dueña y recepción entran con claves propias (de prueba) */
  { const v = server.ctx.leerVerif(); v.admin = sha('prueba-duena-1'); v.equipo = sha('prueba-equipo-1'); server.ctx.guardarVerif(v); }
  const A = await abrir({ server }); await entrar(A, 'prueba-equipo-1'); const w = A.w, hoy = w.hoyISO();
  const cajaHoy = () => { const rows = w.filasCajaDia(hoy); return { cobr: w.totalCobros(rows), efe: rows.reduce((a, r) => a + w.pagosDe(r).filter(p => p.metodo === 'Efectivo').reduce((x, p) => x + p.monto, 0), 0), n: rows.filter(r => !r._soloCobro).length }; };
  const srvRow = pac => Object.values(server.registros).filter(r => r.paciente === pac);

  // base: una atención normal de otra paciente
  await nueva(A, { pac: 'Otra Paciente', total: 300, acuenta: 300, prof: 'Dra. Mirna' });
  const c0 = cajaHoy();

  // A1 anticipo desde Caja (paciente nuevo, sin historia)
  w.nuevoAnticipo(''); A.setVal('#an-pac', 'Ana Anticipo'); A.setVal('#an-monto', '1.000'); A.radio('anmet', 'Efectivo'); A.setVal('#an-nota', 'a cuenta de orto');
  A.$$('#modal button').find(b => /Guardar anticipo/.test(b.textContent)).click(); await A.tick(60);
  const ant = srvRow('Ana Anticipo').find(r => r.estado === 'Anticipo');
  OK('A1 anticipo llega al servidor como registro Anticipo', !!ant && ant.acuenta === 1000 && ant.total === 0 && ant.saldo === 0 && !ant.profesional, ant && { acuenta: ant.acuenta, metodo: ant.metodo, por: ant.anticipoPor });
  OK('A1 crédito 1000', w.creditoDe('Ana Anticipo') === 1000, w.creditoDe('Ana Anticipo'));
  const c1 = cajaHoy();
  OK('A2 caja: entra 1000 en efectivo, no suma atenciones', c1.cobr - c0.cobr === 1000 && c1.efe - c0.efe === 1000 && c1.n === c0.n, { c0, c1 });
  w.$('#l-tipo') && (w.$('#l-tipo').value = 'todo');
  OK('A2 no aparece en la lista', !w.filtrarLista().some(r => r.estado === 'Anticipo'));
  OK('A2 no es visita (idxPac)', (w.idxPac()['ana anticipo'] || { visitas: 0 }).visitas === 0, w.idxPac()['ana anticipo']);
  OK('A2 no aparece en Mi día ni en dormidos', !w.filasDelDia(hoy, '').some(w.esAnticipo) && !w.dormidos().some(d => d.paciente === 'Ana Anticipo'));
  OK('A2 no cuenta en liquidación', !w.liquidacion(w.filasCajaDia(hoy)).some(x => x.prof === 'Sin asignar'), w.liquidacion(w.filasCajaDia(hoy)).map(x => x.prof));
  w.verPaciente('Ana Anticipo'); const ficha = A.$('#modal') ? A.$('#modal').textContent : '';
  OK('A2 la ficha muestra el saldo a favor', /A favor/.test(ficha) && /Saldo a favor/.test(ficha), ficha.slice(0, 120)); close(A);

  // A3 atención 600 sin pago → al guardar ofrece usar saldo a favor
  w.show('atencion'); w.clearForm(); A.setVal('#f-prof', 'Dra. Mirna'); A.setVal('#f-paciente', 'Ana Anticipo'); A.setVal('#f-cel', '70001234');
  A.setVal('#srv-list .s-nom', 'Limpieza dental'); A.setVal('#srv-list .s-precio', '600'); if (!w.getRadio('canal')) A.radio('canal', w.CFG.canales[0]);
  OK('A3 el formulario avisa cuánto se descuenta', /se descuentan Bs 600/.test(A.$('#pago-tag').textContent) && /Queda pagado/.test(A.$('#pago-tag').textContent), A.$('#pago-tag').textContent);
  A.click('#btn-save'); await A.tick(80);
  const modal3 = A.$('#modal') ? A.$('#modal').textContent : '';
  OK('A3 al guardar avisa lo descontado y lo que queda', /Se descontaron Bs 600/.test(modal3) && /Le quedan Bs 400/.test(modal3) && /quedó pagada/.test(modal3), modal3.slice(0, 200));
  OK('A3 el WhatsApp dice lo descontado', /Descontado de su saldo a favor: Bs 600/.test(A.$('#wa-txt').textContent) && /Le queda a favor: Bs 400/.test(A.$('#wa-txt').textContent));
  close(A);
  const at1 = w.DATA.filter(r => r.paciente === 'Ana Anticipo' && r.estado === 'Atendido')[0];
  const s1 = server.registros[at1.id];
  OK('A3 servidor: atención pagada con saldo a favor sin tocar nada', s1.acuenta === 600 && s1.saldo === 0 && JSON.stringify(s1.pagos) === JSON.stringify([{ metodo: 'Saldo a favor', monto: 600 }]), { acuenta: s1.acuenta, saldo: s1.saldo, pagos: s1.pagos });
  OK('A3 crédito queda en 400', w.creditoDe('Ana Anticipo') === 400, w.creditoDe('Ana Anticipo'));
  const c3 = cajaHoy();
  OK('A3 caja: el saldo a favor no vuelve a entrar', c3.cobr === c1.cobr && c3.efe === c1.efe && c3.n === c1.n + 1, { c1, c3 });

  // A4 atención 800 con 100 en efectivo: se descuentan 400 solos y queda debiendo 300
  const p2 = await nueva(A, { pac: 'Ana Anticipo', total: 800, acuenta: 100, prof: 'Dra. Mirna' });
  let s2 = server.registros[p2.r.id];
  OK('A4 100 efectivo + 400 saldo automático, debe 300', s2.acuenta === 500 && s2.saldo === 300 && w.creditoDe('Ana Anticipo') === 0, { pagos: s2.pagos, saldo: s2.saldo });
  await pagar(A, p2.r.id, 300, 'Efectivo'); s2 = server.registros[p2.r.id];
  OK('A4 después paga 300 en efectivo', s2.acuenta === 800 && s2.saldo === 0, { pagos: s2.pagos });
  const c4 = cajaHoy();
  OK('A4 caja: solo entran los 400 en efectivo', c4.cobr - c3.cobr === 400 && c4.efe - c3.efe === 400, { c3, c4 });

  // A5 sin crédito: no se ofrece ni se acepta
  const p3 = await nueva(A, { pac: 'Ana Anticipo', total: 100, acuenta: 0, prof: 'Dra. Mirna' });
  w.cobrarSaldo(p3.r.id); OK('A5 sin crédito no aparece la opción', !A.$$('input[name="cpmet"]').some(i => i.value === 'Saldo a favor')); close(A);
  const t5 = (() => { w.aplicarPago(w.DATA.find(r => r.id === p3.r.id), 50, 'Saldo a favor'); return A.toast(); })(); await A.tick(30); close(A);
  OK('A5 aplicar a la fuerza se rechaza', /No le alcanza/.test(t5) && server.registros[p3.r.id].acuenta === 0, t5);

  // A6 editar la atención pagada con saldo (cambiar solo la observación) conserva el pago
  w.editarId(at1.id); A.setVal('#f-obs', 'control en 6 meses');
  OK('A6 el formulario muestra lo pagado con saldo', /pagados con saldo a favor/.test(A.$('#pago-tag').textContent), A.$('#pago-tag').textContent);
  A.click('#btn-save'); await A.tick(60); const t6 = A.toast(); close(A);
  const s6 = server.registros[at1.id];
  OK('A6 se guardó y conserva el saldo a favor', s6.obs === 'control en 6 meses' && s6.acuenta === 600 && JSON.stringify(s6.pagos) === JSON.stringify([{ metodo: 'Saldo a favor', monto: 600 }]), { t6, obs: s6.obs, pagos: s6.pagos, metodo: s6.metodo });
  OK('A6 crédito sigue en 0', w.creditoDe('Ana Anticipo') === 0, w.creditoDe('Ana Anticipo'));

  // A7 borrar anticipo ya usado: no; uno nuevo sin usar: sí
  const tB = (() => { const c = w.confirm; w.confirm = () => true; w.borrarAnticipo(ant.id); w.confirm = c; return A.toast(); })();
  OK('A7 anticipo usado no se borra', /ya se usó/.test(tB) && !!server.registros[ant.id], tB);
  w.nuevoAnticipo('Ana Anticipo'); A.setVal('#an-monto', '200'); A.radio('anmet', 'QR');
  A.$$('#modal button').find(b => /Guardar anticipo/.test(b.textContent)).click(); await A.tick(60);
  const ant2 = srvRow('Ana Anticipo').find(r => r.estado === 'Anticipo' && r.acuenta === 200);
  OK('A7 segundo anticipo (QR) desde la ficha', !!ant2 && w.creditoDe('Ana Anticipo') === 200);
  { const c = w.confirm; w.confirm = () => true; w.borrar(ant2.id); w.confirm = c; } await A.tick(60);
  OK('A7 anticipo sin usar se borra (servidor)', !server.registros[ant2.id] && w.creditoDe('Ana Anticipo') === 0);

  // A8 borrar la atención que usó saldo devuelve el crédito
  { const c = w.confirm; w.confirm = () => true; w.borrar(at1.id); w.confirm = c; } await A.tick(60);
  OK('A8 al borrar la atención el saldo vuelve', w.creditoDe('Ana Anticipo') === 600, w.creditoDe('Ana Anticipo'));

  // A9 otro equipo ve lo mismo
  const B = await abrir({ server }); await entrar(B, 'prueba-equipo-1'); await B.w.pullServer(); await B.tick(50);
  OK('A9 otro equipo ve el mismo saldo a favor', B.w.creditoDe('Ana Anticipo') === 600, B.w.creditoDe('Ana Anticipo'));
  OK('A9 otro equipo ve la misma caja', B.w.totalCobros(B.w.filasCajaDia(hoy)) === w.totalCobros(w.filasCajaDia(hoy)), [B.w.totalCobros(B.w.filasCajaDia(hoy)), w.totalCobros(w.filasCajaDia(hoy))]);

  // A10 doctoras
  const ADM = await abrir({ server }); await entrar(ADM, 'prueba-duena-1');
  ADM.w.CFG.clavesProf = { 'Dra. Brenda': sha('brenda-ant') }; ADM.w.saveCfg(true); await ADM.tick(30);
  await nueva(ADM, { pac: 'Paciente Brenda', total: 200, acuenta: 0, prof: 'Dra. Brenda' });
  const D = await abrir({ server }); await entrar(D, 'brenda-ant'); await D.w.pullServer(); await D.tick(700);
  OK('A10 doctora: permiso según clínica', D.w.puedeAnticipo() === SPA, D.w.puedeAnticipo());
  D.w.nuevoAnticipo('Ana Anticipo'); const tA = D.toast(); close(D);
  OK('A10 doctora no registra para paciente ajena', !D.$('#an-monto') || /otra doctora|recepción/.test(tA), tA);
  close(D); D.w.nuevoAnticipo('Paciente Brenda');
  if (SPA) {
    D.setVal('#an-monto', '150'); D.radio('anmet', 'Efectivo'); D.$$('#modal button').find(b => /Guardar anticipo/.test(b.textContent)).click(); await D.tick(60);
    const ad = Object.values(server.registros).find(r => r.paciente === 'Paciente Brenda' && r.estado === 'Anticipo');
    OK('A10 Spa: la doctora registra para su paciente', !!ad && ad.anticipoPor === 'Dra. Brenda', ad && ad.anticipoPor);
  } else OK('A10 Cosmetic: la doctora no puede', !D.$('#an-monto'), D.toast());
  R('errores', [A.errors.slice(0, 3), B.errors.slice(0, 3), D.errors.slice(0, 3)]);
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
