/* «🔗 Ya se hizo en una visita»: la sesión se cargó como visita suelta (sin elegir el plan) y después se
   vincula. El caso real: blanqueamiento cargado el primer día dentro de una atención de consulta + paquete,
   un plan de una etapa con un pago adelantado, y las sesiones siguientes como visitas en Bs 0.
   Chromium real, .gs real en memoria, datos ficticios, sin red real. */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(66), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('vv-duena-1'); v.prof['Dra. Shirley'] = server.ctx.shaHex('vv-shirley-1'); v.equipo = server.ctx.shaHex('vv-equipo-1'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const abrir = async (clave) => {
    const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.fill('#gate-pass', clave); await page.click('#gate-btn'); await page.waitForTimeout(1800);
    return page;
  };
  /* datos como quedan en la hoja (ficticios) */
  const D = await abrir('vv-duena-1');
  await D.evaluate(() => {
    const hoy = hoyISO();
    const at = (pac, d, prof, srv, total, ps, planId, etapa) => { const r = normalize({ id: uid(), fecha: addDias(hoy, d), hora: '10:00', paciente: pac, profesional: prof, estado: 'Atendido', tipo: 'Recurrente', canal: 'Facebook', origen: 'Espontánea',
      celular: '70000001', servicios: srv, total: total, acuenta: total, saldo: 0, metodo: ps[0] ? ps[0].metodo : '', pagos: ps, planId: planId || '', planEtapa: etapa || '', ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); return r; };
    const pago = (pac, pl) => { const an = normalize({ id: uid(), fecha: addDias(hoy, -7), hora: '10:05', paciente: pac, profesional: 'Dra. Shirley', estado: 'Anticipo', planId: pl.id, servicios: [], total: 0, acuenta: 700, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 700 }], obs: 'Pago al plan', ts: new Date().toISOString() }); DATA.push(an); queue('save', an, null); };
    const plan = (pac, ses) => { const f = pacDe(pac); f.nombre = pac; const pl = planNormalize({ nombre: 'blanqueamiento', total: 700, prof: 'Dra. Shirley', fecha: addDias(hoy, -7), sesiones: ses }); f.planes.push(pl); savePac(f); return pl; };
    /* A y B: un paquete de 3 sesiones con pago adelantado; las sesiones en visitas de Bs 0 */
    for (const [pac, conPlan] of [['Paciente Vincular A', true], ['Paciente Vincular B', false]]) {
      const pl = plan(pac, [{ desc: 'sesión 1', precio: 233 }, { desc: 'sesión 2', precio: 233 }, { desc: 'sesión 3', precio: 234 }]); pago(pac, pl);
      at(pac, -7, 'Dra. Shirley', [{ nom: 'Consulta / Valoración', cant: 1, precio: 150 }], 150, [{ metodo: 'QR', monto: 150 }]);
      at(pac, -5, 'Dra. Shirley', [{ nom: 'Blanqueamiento dental · 1 sesión', cant: 1, precio: 0 }], 0, [], conPlan ? pl.id : '');
      at(pac, -4, 'Dra. Shirley', [{ nom: 'Blanqueamiento dental · 1 sesión', cant: 1, precio: 0 }], 0, [], conPlan ? pl.id : '');
    }
    /* E y F, el caso real: plan de una etapa, 850 en la primera visita (150 consulta + 700 blanqueamiento), 2da y 3ra en Bs 0 con el plan */
    for (const pac of ['Paciente Vincular E', 'Paciente Vincular F']) {
      const pl = plan(pac, [{ desc: 'sesiones blanqueamiento', precio: 700 }]); pago(pac, pl);
      const a1 = at(pac, -7, 'Dra. Shirley', [{ nom: 'Consulta / Valoración', cant: 1, precio: 150 }, { nom: 'Blanqueamiento dental · 3 sesiones', cant: 1, precio: 700 }], 850, [{ metodo: 'QR', monto: 850 }]);
      at(pac, -5, 'Dra. Shirley', [{ nom: 'Blanqueamiento dental · 1 sesión', det: '2da sesion', cant: 1, precio: 0 }], 0, [], pl.id);
      at(pac, -4, 'Dra. Mirna', [{ nom: 'Consulta / Valoración', det: 'BLANQUEAMIENTO SESION 3/3', cant: 1, precio: 0 }], 0, [], pl.id);
      if (pac === 'Paciente Vincular F') { /* F: ya habían vinculado la primera visita a la única etapa */
        a1.planId = pl.id; a1.planEtapa = 1; const f = pacDe(pac); const p2 = f.planes.find(x => x.id === pl.id); p2.sesiones[0].hecha = true; p2.sesiones[0].fecha = a1.fecha; p2.sesiones[0].atencionId = a1.id; savePac(f); queue('save', a1, null); }
    }
    saveLocal(); return flushQueue();
  });
  await D.waitForTimeout(1500); await D.context().close();

  const P = await abrir(SPA ? 'vv-shirley-1' : 'vv-equipo-1');
  const estadoEn = (pg, pac) => pg.evaluate((n) => { const p = planesDe(n)[0]; const c = cuentasPlan(p);
    return { h: avancePlan(p).hechas, t: avancePlan(p).total, est: p.estado, pagado: cobradoPlan(p), falta: saldoPlan(p), queda: c.queda, favor: creditoLibre(n),
      filas: filasPlan(n, p).map(f => [f.estado, f.abonado, f.saldo]), precios: p.sesiones.map(s => s.precio || 0),
      fechas: p.sesiones.map(s => { const a = DATA.find(r => r.id === s.atencionId); return a ? a.fecha.slice(8) : ''; }),
      sinMarcar: visitasSinMarcar(n, p).length, cola: pend().length, caja: DATA.filter(r => r.paciente === n).reduce((a, r) => a + num(r.acuenta) - usoSaldoDe(r), 0) }; }, pac);
  const estado = (pac) => estadoEn(P, pac);
  const ficha = async (pg, pac) => { await pg.evaluate((n) => verPaciente(n), pac); await pg.waitForTimeout(500); };
  const boton = (pg, re) => pg.locator('#modal button', { hasText: re });

  /* A: visitas guardadas con el plan elegido y sin su sesión marcada */
  let e0 = await estado('Paciente Vincular A');
  OK('A antes: 0/3, 2 visitas del plan sin marcar', e0.h === 0 && e0.sinMarcar === 2, e0);
  await ficha(P, 'Paciente Vincular A');
  OK('A la ficha avisa y ofrece «Marcar sus sesiones»', await boton(P, /Marcar sus sesiones/).count() === 1 && /2 visitas cargadas con este plan/.test(await P.locator('#modal').innerText()));
  if (process.env.SHOT) { await boton(P, /Marcar sus sesiones/).first().scrollIntoViewIfNeeded(); await P.screenshot({ path: process.env.SHOT + '-a.png' }); }
  await boton(P, /Marcar sus sesiones/).first().click(); await P.waitForTimeout(1500);
  let e1 = await estado('Paciente Vincular A');
  OK('A 2/3; el adelanto cubre las dos sesiones hechas y la 3ra', e1.h === 2 && e1.est === 'activo' && e1.pagado === 700 && e1.falta === 0 && JSON.stringify(e1.filas) === JSON.stringify([['hecha', 233, 0], ['hecha', 233, 0], ['pendiente', 234, 0]]), e1);
  OK('A la caja no cambió', e1.caja === e0.caja && e1.cola === 0, [e0.caja, e1.caja]);
  await P.evaluate(() => closeModal());

  /* B: las sesiones se cargaron como visitas sueltas: se elige una para la sesión que sigue */
  e0 = await estado('Paciente Vincular B');
  await ficha(P, 'Paciente Vincular B');
  OK('B la ficha ofrece «🔗 Ya se hizo en una visita»', await boton(P, /Ya se hizo en una visita/).count() === 1);
  await boton(P, /Ya se hizo en una visita/).first().click(); await P.waitForTimeout(400);
  OK('B lista las 3 visitas sueltas', await boton(P, /^Es esta$/).count() === 3);
  await boton(P, /^Es esta$/).nth(1).click(); await P.waitForTimeout(1500);
  e1 = await estado('Paciente Vincular B');
  OK('B 1/3 con la visita elegida; caja igual', e1.h === 1 && e1.fechas[0] !== '' && e1.caja === e0.caja && e1.cola === 0, e1);
  await P.evaluate(() => closeModal());
  await P.context().close();

  /* E y F (la dueña): pagó 850 en la primera visita y los 700 también quedaron como «Pago al plan».
     Borra el pago repetido y elige las 3 visitas: una sesión por visita, el importe en la primera. */
  const D2 = await abrir('vv-duena-1');
  for (const pac of ['Paciente Vincular E', 'Paciente Vincular F']) {
    const L = pac.slice(-1);
    const d0 = await estadoEn(D2, pac);
    OK(L + ' antes: la caja suma 1550 (700 dos veces)', d0.caja === 1550, d0);
    await ficha(D2, pac);
    OK(L + ' la ficha ofrece «🧩 Se hizo en varias visitas» (y no los otros dos)', await boton(D2, /Se hizo en varias visitas/).count() === 1 && await boton(D2, /Marcar sus sesiones|Ya se hizo en una visita/).count() === 0);
    await boton(D2, /Borrar/).first().click(); await D2.waitForTimeout(1500);
    const d1 = await estadoEn(D2, pac);
    OK(L + ' sin el pago repetido: caja 850', d1.caja === 850 && d1.cola === 0, d1);
    await ficha(D2, pac); await boton(D2, /Se hizo en varias visitas/).first().click(); await D2.waitForTimeout(400);
    const marcadas = await D2.locator('#modal .vv-chk:checked').count();
    OK(L + ' las 3 visitas del blanqueamiento vienen marcadas', marcadas === 3 && await D2.locator('#modal .vv-chk').count() === 3, marcadas);
    if (process.env.SHOT && L === 'E') await D2.screenshot({ path: process.env.SHOT + '-e1.png' });
    await boton(D2, /Guardar las sesiones/).first().click(); await D2.waitForTimeout(6000);
    const d2 = await estadoEn(D2, pac);
    const tot = await D2.evaluate((n) => DATA.filter(r => r.paciente === n && esAtencion(r)).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(r => [r.total, r.acuenta - usoSaldoDe(r), usoSaldoDe(r), r.saldo]), pac);
    OK(L + ' 3/3 terminado: 13, 15 y 16, con lo pagado repartido 234/233/233', d2.h === 3 && d2.t === 3 && d2.est === 'terminado' && JSON.stringify(d2.fechas.map(Boolean)) === '[true,true,true]' && JSON.stringify(d2.precios) === '[234,233,233]', d2);
    OK(L + ' visitas: 13/10 = 150 + 234 en efectivo/QR; 15 y 16 = 233 con lo adelantado', JSON.stringify(tot) === JSON.stringify([[384, 384, 0, 0], [233, 0, 233, 0], [233, 0, 233, 0]]), tot);
    OK(L + ' cada sesión pagada; pagado 700, falta 0, sin saldo a favor, caja 850', JSON.stringify(d2.filas) === JSON.stringify([['hecha', 234, 0], ['hecha', 233, 0], ['hecha', 233, 0]]) && d2.pagado === 700 && d2.falta === 0 && d2.queda === 0 && d2.favor === 0 && d2.caja === 850 && d2.cola === 0, d2);
    if (process.env.SHOT && L === 'E') { await D2.evaluate((n) => { const p = planesDe(n)[0]; verPlan(n, p.id); }, pac); await D2.waitForTimeout(600); await D2.screenshot({ path: process.env.SHOT + '-e2.png' }); }
    await D2.evaluate(() => closeModal());
  }
  await D2.context().close();
  /* otro equipo ve lo mismo (quedó en la hoja) */
  const D3 = await abrir('vv-duena-1');
  const otra = await D3.evaluate(() => ['Paciente Vincular E', 'Paciente Vincular F'].map(n => { const p = planesDe(n)[0]; return [avancePlan(p).hechas, avancePlan(p).total, p.estado, creditoLibre(n), cobradoPlan(p)]; }));
  OK('en la hoja (otro equipo) se ve igual', JSON.stringify(otra) === JSON.stringify([[3, 3, 'terminado', 0, 700], [3, 3, 'terminado', 0, 700]]), otra);
  const cajaHoja = await D3.evaluate(() => ['Paciente Vincular E', 'Paciente Vincular F'].map(n => totalCobros(filasCaja(DATA).filter(r => r.paciente === n))));
  OK('la caja del panel (Caja) cuenta 850 por cada una', JSON.stringify(cajaHoja) === '[850,850]', cajaHoja);
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
