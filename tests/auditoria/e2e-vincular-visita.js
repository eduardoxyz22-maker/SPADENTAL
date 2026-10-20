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
  /* la dueña deja los datos como quedaron: atención de consulta + paquete (850), plan de una etapa con
     pago adelantado de 700, y las sesiones 2 y 3 en Bs 0 (con el plan elegido o como visitas sueltas) */
  const D = await abrir('vv-duena-1');
  await D.evaluate(() => {
    const hoy = hoyISO();
    const caso = (pac, conPlan) => {
      const f = pacDe(pac); f.nombre = pac;
      const pl = planNormalize({ nombre: 'blanqueamiento', total: 700, prof: 'Dra. Shirley', fecha: addDias(hoy, -7), sesiones: [{ desc: 'sesiones blanqueamiento', precio: 700 }] });
      f.planes.push(pl); savePac(f);
      const at = (d, srv, total, ps, planId) => { const r = normalize({ id: uid(), fecha: addDias(hoy, d), hora: '10:00', paciente: pac, profesional: 'Dra. Shirley', estado: 'Atendido', tipo: 'Recurrente', canal: 'Facebook', origen: 'Espontánea',
        celular: '70000001', servicios: srv, total: total, acuenta: total, saldo: 0, metodo: ps[0] ? ps[0].metodo : '', pagos: ps, planId: planId || '', ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); return r; };
      at(-7, [{ nom: 'Consulta / Valoración', cant: 1, precio: 150 }, { nom: 'Blanqueamiento dental · 3 sesiones', cant: 1, precio: 700 }], 850, [{ metodo: 'QR', monto: 850 }]);
      const an = normalize({ id: uid(), fecha: addDias(hoy, -7), hora: '10:05', paciente: pac, profesional: 'Dra. Shirley', estado: 'Anticipo', planId: pl.id, servicios: [], total: 0, acuenta: 700, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 700 }], obs: 'Pago al plan', ts: new Date().toISOString() });
      DATA.push(an); queue('save', an, null);
      at(-5, [{ nom: 'Blanqueamiento dental · 1 sesión', det: '2da sesion', cant: 1, precio: 0 }], 0, [], conPlan ? pl.id : '');
      at(-4, [{ nom: 'Consulta / Valoración', det: 'BLANQUEAMIENTO SESION 3/3', cant: 1, precio: 0 }], 0, [], conPlan ? pl.id : '');
    };
    caso('Paciente Vincular A', true); caso('Paciente Vincular B', false); caso('Paciente Vincular C', false); caso('Paciente Vincular D', true);
    saveLocal(); return flushQueue();
  });
  await D.waitForTimeout(1500); await D.context().close();

  const P = await abrir(SPA ? 'vv-shirley-1' : 'vv-equipo-1');
  const estado = (pac) => P.evaluate((n) => { const p = planesDe(n)[0]; const c = cuentasPlan(p), fl = filasPlan(n, p)[0];
    return { h: avancePlan(p).hechas, est: p.estado, pagado: cobradoPlan(p), falta: saldoPlan(p), queda: c.queda, favor: creditoLibre(n), fila: [fl.abonado, fl.saldo],
      sinMarcar: visitasSinMarcar(n, p).length, cola: pend().length, caja: DATA.filter(r => r.paciente === n).reduce((a, r) => a + num(r.acuenta) - usoSaldoDe(r), 0) }; }, pac);
  const ficha = async (pac) => { await P.evaluate((n) => verPaciente(n), pac); await P.waitForTimeout(500); };
  const boton = (re) => P.locator('#modal button', { hasText: re });

  /* A: las visitas tienen el plan elegido pero la sesión no quedó marcada */
  let e0 = await estado('Paciente Vincular A');
  OK('A antes: 0/1, adelanto sin usar 700, 2 visitas del plan sin marcar', e0.h === 0 && e0.queda === 700 && e0.sinMarcar === 2, e0);
  await ficha('Paciente Vincular A');
  if (process.env.SHOT) { await P.locator('#modal button', { hasText: /Marcar sus sesiones/ }).first().scrollIntoViewIfNeeded(); await P.screenshot({ path: process.env.SHOT + '-a.png' }); }
  OK('A la ficha avisa y ofrece «Marcar sus sesiones»', await boton(/Marcar sus sesiones/).count() === 1 && /2 visitas cargadas con este plan/.test(await P.locator('#modal').innerText()));
  await boton(/Marcar sus sesiones/).first().click(); await P.waitForTimeout(1500);
  let e1 = await estado('Paciente Vincular A');
  OK('A 1/1 terminado; el adelanto pagó la sesión (queda 0, no debe)', e1.h === 1 && e1.est === 'terminado' && e1.pagado === 700 && e1.falta === 0 && e1.queda === 0 && e1.favor === 0 && e1.fila[1] === 0, e1);
  OK('A la caja no cambió y no quedó nada sin subir', e1.caja === e0.caja && e1.cola === 0, [e0.caja, e1.caja, e1.cola]);
  OK('A el aviso ya no aparece', await boton(/Marcar sus sesiones/).count() === 0);
  if (process.env.SHOT) { await P.evaluate((n) => { const p = planesDe(n)[0]; verPlan(n, p.id); }, 'Paciente Vincular A'); await P.waitForTimeout(600); await P.screenshot({ path: process.env.SHOT + '-a2.png' }); }
  await P.evaluate(() => closeModal());

  /* B: las sesiones se cargaron como visitas sueltas: se elige la del 2do día */
  e0 = await estado('Paciente Vincular B');
  await ficha('Paciente Vincular B');
  OK('B la ficha ofrece «🔗 Ya se hizo en una visita»', await boton(/Ya se hizo en una visita/).count() === 1);
  await boton(/Ya se hizo en una visita/).first().click(); await P.waitForTimeout(400);
  if (process.env.SHOT) await P.screenshot({ path: process.env.SHOT + '-b.png' });
  OK('B lista las 3 visitas sueltas', await boton(/^Es esta$/).count() === 3);
  await boton(/^Es esta$/).nth(1).click(); await P.waitForTimeout(1500);
  e1 = await estado('Paciente Vincular B');
  OK('B 1/1 terminado; el adelanto pagó la sesión', e1.h === 1 && e1.est === 'terminado' && e1.pagado === 700 && e1.queda === 0 && e1.favor === 0 && e1.fila[1] === 0, e1);
  OK('B la caja no cambió', e1.caja === e0.caja && e1.cola === 0, [e0.caja, e1.caja]);
  await P.evaluate(() => closeModal());

  /* C: se elige la visita del primer día, que ya traía el paquete: los 700 anotados dos veces quedan a la vista */
  e0 = await estado('Paciente Vincular C');
  await ficha('Paciente Vincular C'); await boton(/Ya se hizo en una visita/).first().click(); await P.waitForTimeout(400);
  await boton(/^Es esta$/).first().click(); await P.waitForTimeout(1500);
  e1 = await estado('Paciente Vincular C');
  OK('C 1/1 terminado y los 700 de más quedan a favor del paciente', e1.h === 1 && e1.est === 'terminado' && e1.pagado === 1400 && e1.favor === 700, e1);
  OK('C la caja no cambió', e1.caja === e0.caja && e1.cola === 0, [e0.caja, e1.caja]);
  await P.evaluate(() => closeModal());

  /* D, el caso real: pagó 850 (150 consulta + 700 del blanqueamiento) y los 700 quedaron anotados dos veces.
     La dueña borra el «Pago al plan» repetido y vincula la visita del primer día a la etapa. */
  const D2 = await abrir('vv-duena-1');
  const est2 = (pac) => D2.evaluate((n) => { const p = planesDe(n)[0];
    return { h: avancePlan(p).hechas, est: p.estado, pagado: cobradoPlan(p), falta: saldoPlan(p), queda: cuentasPlan(p).queda, favor: creditoLibre(n),
      caja: DATA.filter(r => r.paciente === n).reduce((a, r) => a + num(r.acuenta) - usoSaldoDe(r), 0), cola: pend().length }; }, pac);
  const d0 = await est2('Paciente Vincular D');
  OK('D antes: la caja suma 1550 (700 dos veces)', d0.caja === 1550, d0);
  await D2.evaluate((n) => verPaciente(n), 'Paciente Vincular D'); await D2.waitForTimeout(500);
  await D2.locator('#modal button', { hasText: /Borrar/ }).first().click(); await D2.waitForTimeout(1500);
  const d1 = await est2('Paciente Vincular D');
  OK('D sin el pago repetido: caja 850', d1.caja === 850 && d1.cola === 0, d1);
  await D2.evaluate((n) => verPaciente(n), 'Paciente Vincular D'); await D2.waitForTimeout(500);
  await D2.locator('#modal button', { hasText: /Ya se hizo en una visita/ }).first().click(); await D2.waitForTimeout(400);
  const primera = await D2.locator('#modal').innerText();
  OK('D la lista arranca por la visita del primer día (850)', /850/.test(primera.split('Es esta')[0]), primera.slice(0, 300));
  await D2.locator('#modal button', { hasText: /^Es esta$/ }).first().click(); await D2.waitForTimeout(1500);
  const d2 = await est2('Paciente Vincular D');
  OK('D 1/1 terminado, pagado 700 dentro de la atención, sin saldo a favor', d2.h === 1 && d2.est === 'terminado' && d2.pagado === 700 && d2.falta === 0 && d2.queda === 0 && d2.favor === 0, d2);
  OK('D la caja sigue en 850', d2.caja === 850 && d2.cola === 0, d2);
  await D2.context().close();
  /* otro equipo ve lo mismo (quedó en la hoja) */
  const D3 = await abrir('vv-duena-1');
  const otra = await D3.evaluate(() => ['Paciente Vincular A', 'Paciente Vincular B', 'Paciente Vincular C', 'Paciente Vincular D'].map(n => { const p = planesDe(n)[0]; return [avancePlan(p).hechas, p.estado, creditoLibre(n), cobradoPlan(p)]; }));
  OK('en la hoja (otro equipo) se ve igual', JSON.stringify(otra) === JSON.stringify([[1, 'terminado', 0, 700], [1, 'terminado', 0, 700], [1, 'terminado', 700, 1400], [1, 'terminado', 0, 700]]), otra);
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
