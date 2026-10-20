/* Caso real (Cosmetic, 20/10): dos pantallas abiertas; una marcó la sesión 2 y la
   otra, sin refrescar, la volvió a marcar: quedó una visita de más con deuda.
   Ahora: antes de marcar se trae lo último de la hoja, el servidor rechaza una
   etapa ya hecha en otra visita, y la ficha señala una repetida si quedó.
   Chromium real, .gs real en memoria. */
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
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('sr-duena-1'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [], toasts = [];
  const abrir = async () => {
    const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.evaluate(() => { const t = window.toast; window.TOASTS = []; window.toast = function (m, e) { window.TOASTS.push(String(m)); return t.apply(this, arguments); }; });
    await page.fill('#gate-pass', 'sr-duena-1'); await page.click('#gate-btn'); await page.waitForTimeout(1800);
    return page;
  };
  const PAC = 'Paciente Dos Pantallas';
  const plan = (P) => P.evaluate((n) => { const p = planesDe(n)[0]; return p ? { ses: p.sesiones.map(s => [s.n, !!s.hecha, s.fecha || '']), vis: DATA.filter(r => r.paciente === n && esAtencion(r)).length, deuda: DATA.filter(r => r.paciente === n).reduce((a, r) => a + num(r.saldo), 0), cola: pend().length } : null; }, PAC);
  /* pantalla A: vende el paquete con la sesión 1 */
  const A = await abrir();
  await A.click('nav button[data-v="config"]'); await A.waitForTimeout(400); await A.evaluate(() => { try { mdAjGrupo('md-aj-trat'); } catch (e) {} });
  await A.fill('#pq-nom', 'HAIR LOSS CONTROL'); await A.fill('#pq-n', '4'); await A.fill('#pq-tot', '2200');
  await A.locator('#c-paquetes button', { hasText: /Guardar paquete/ }).first().click(); await A.waitForTimeout(400);
  await A.click('nav button[data-v="atencion"]'); await A.evaluate(() => clearForm());
  await A.fill('#f-prof', 'Dra. Mirna'); await A.fill('#f-paciente', PAC); await A.fill('#f-cel', '70011155'); await A.dispatchEvent('#f-paciente', 'change'); await A.waitForTimeout(500);
  await A.evaluate(() => { $('#f-fecha').value = addDias(hoyISO(), -19); const i = document.querySelector('#seg-canal input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await A.click('#btn-paq-srv'); await A.waitForTimeout(400); await A.locator('#modal button', { hasText: /📦 HAIR LOSS CONTROL/ }).first().click(); await A.waitForTimeout(400);
  await A.fill('#vp-cons-p', '150'); await A.dispatchEvent('#vp-cons-p', 'input'); await A.evaluate(() => { setRadio('vp-met', 'QR'); vpCambio(); });
  await A.locator('#modal button', { hasText: /Cargar en la atención/ }).click(); await A.waitForTimeout(400);
  await A.click('#btn-save'); await A.waitForTimeout(1800); await A.evaluate(() => closeModal());
  OK('A vendió el paquete: sesión 1 hecha, 2.350 pagados, nada debe', JSON.stringify((await plan(A)).ses.map(x => x[1])) === '[true,false,false,false]' && (await plan(A)).deuda === 0, await plan(A));
  /* pantalla B se abre ahora y ve lo mismo */
  const B = await abrir();
  OK('B ve el paquete con la sesión 1 hecha', JSON.stringify((await plan(B)).ses.map(x => x[1])) === '[true,false,false,false]');
  /* A marca la sesión 2 desde la ficha */
  await A.evaluate((n) => { const p = planesDe(n)[0]; atencionDePlan(n, p.id, 2); }, PAC); await A.waitForTimeout(2200);
  await A.evaluate(() => { const e = $('#ap-prof'); if (e && !e.readOnly && !e.value) { e.value = 'Dra. Mirna'; e.dispatchEvent(new Event('change', { bubbles: true })); } $('#ap-fecha').value = addDias(hoyISO(), -14); });
  await A.click('#ap-ok'); await A.waitForTimeout(1800); await A.evaluate(() => closeModal());
  OK('A marcó la sesión 2 (visita de hace 14 días)', JSON.stringify((await plan(A)).ses.map(x => x[1])) === '[true,true,false,false]' && (await plan(A)).cola === 0, await plan(A));
  OK('B todavía no se enteró (pantalla sin refrescar)', JSON.stringify((await plan(B)).ses.map(x => x[1])) === '[true,false,false,false]');
  /* B intenta marcar la sesión 2 otra vez: antes de abrir se trae lo último y la rechaza */
  await B.evaluate((n) => { const p = planesDe(n)[0]; atencionDePlan(n, p.id, 2); }, PAC); await B.waitForTimeout(2500);
  const tB = await B.evaluate(() => TOASTS.slice(-3));
  OK('B: «Esa etapa ya está hecha (visita del …)» y no abre la ventana', tB.some(t => /ya está hecha \(visita del/.test(t)) && await B.locator('#ap-ok').count() === 0, tB);
  OK('B ya ve la sesión 2 hecha', JSON.stringify((await plan(B)).ses.map(x => x[1])) === '[true,true,false,false]');
  await B.evaluate(() => closeModal());
  /* el botón de Servicios también se actualiza antes de decir qué sesión toca */
  await B.click('nav button[data-v="atencion"]'); await B.evaluate(() => clearForm());
  await B.fill('#f-prof', 'Dra. Mirna'); await B.fill('#f-paciente', PAC); await B.dispatchEvent('#f-paciente', 'change'); await B.waitForTimeout(500);
  await B.click('#btn-paq-srv'); await B.waitForTimeout(2500);
  OK('B: «📦 Sesión de un paquete o plan» dice que hoy sería la sesión 3', /Hoy sería: HAIR LOSS CONTROL · sesión 3/.test(await B.locator('#modal').innerText()), (await B.locator('#modal').innerText()).slice(0, 200));
  await B.evaluate(() => closeModal());
  /* y si igual llega una sesión repetida (pantalla vieja, sin conexión en ese momento), el servidor la rechaza */
  const tok = server.ctx.nuevaSesion({ rol: 'admin', prof: '', h: server.ctx.leerVerif().admin, fabrica: false });
  const dup = await A.evaluate((n) => { const p = planesDe(n)[0]; return normalize({ id: uid(), fecha: hoyISO(), hora: '17:43', paciente: n, profesional: 'Dra. Shirley', estado: 'Atendido', tipo: 'Recurrente', canal: 'Facebook', origen: 'Programada', celular: '70011155', planId: p.id, planEtapa: 2, servicios: [{ nom: 'HAIR LOSS CONTROL · sesión 2', det: 'HAIR LOSS CONTROL', cant: 1, precio: 550 }], total: 550, acuenta: 0, saldo: 550, pagos: [], ts: new Date().toISOString() }); }, PAC);
  const rs = server.handle({ action: 'save', registro: dup, token: tok }, { panel: true });
  OK('el servidor rechaza la sesión 2 repetida y dice en qué visita está', rs && rs.ok === false && rs.error === 'sesion_repetida' && rs.etapa === 2 && rs.fecha === (await plan(A)).ses[1][2], rs);
  const rs3 = server.handle({ action: 'save', registro: Object.assign({}, dup, { id: dup.id + 'b', planEtapa: 3 }), token: tok }, { panel: true });
  OK('pero una sesión que falta (la 3) sí la acepta', rs3 && rs3.ok === true, rs3 && rs3.error);
  server.handle({ action: 'delete', pedido: { id: dup.id + 'b' }, token: tok }, { panel: true });
  /* en el panel: la cola no insiste, saca la visita local y avisa */
  await B.evaluate((d) => { DATA.push(normalize(d)); saveLocal(); queue('save', normalize(d), null); return flushQueue(); }, dup); await B.waitForTimeout(1500);
  const tB2 = await B.evaluate(() => TOASTS.slice(-3));
  OK('B: «No se guardó: la sesión 2 ya está marcada en la visita del …», sin cola y sin la visita', tB2.some(t => /No se guardó: la sesión 2 del paquete ya está marcada en la visita del/.test(t)) && (await plan(B)).cola === 0 && (await plan(B)).vis === 2, [tB2, await plan(B)]);
  /* una repetida que ya quedó guardada (de antes del arreglo) se ve en rojo en la ficha */
  server.ctx.getSheet().appendRow(server.ctx.filaDeRegistro(dup));
  await B.evaluate(() => pullServer()); await B.waitForTimeout(800);
  await B.evaluate((n) => verPaciente(n), PAC); await B.waitForTimeout(600);
  const filas = await B.evaluate(() => [...document.querySelectorAll('#modal table tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')));
  OK('la ficha marca «⚠ sesión 2 repetida · el paquete ya la tiene el …»', filas.some(t => /⚠ sesión 2 repetida · el paquete ya la tiene el/.test(t)), filas);
  await B.evaluate(() => closeModal());
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
