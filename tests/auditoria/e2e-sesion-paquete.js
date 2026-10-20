/* Sesiones de un paquete de la clínica marcadas por la doctora, en Chromium real con el .gs real en memoria.
   El caso: la atención se mandaba después de la marca de la sesión y el servidor, que todavía no veía la
   atención, devolvía el paquete sin la marca. Datos ficticios; sin red real. */
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
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('sp-duena-1'); v.prof['Dra. Shirley'] = server.ctx.shaHex('sp-shirley-1'); v.equipo = server.ctx.shaHex('sp-equipo-1'); server.ctx.guardarVerif(v);
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
  const PAC = 'Paciente Paquete Sp';
  const avance = (P) => P.evaluate((n) => { const p = planesDe(n)[0]; return p ? { h: avancePlan(p).hechas, est: p.estado, cola: pend().length } : null; }, PAC);
  /* la dueña arma el paquete de la clínica y lo vende hace dos semanas, con la sesión 1 hecha */
  const D = await abrir('sp-duena-1');
  await D.click('nav button[data-v="config"]'); await D.waitForTimeout(400); await D.evaluate(() => { try { mdAjGrupo('md-aj-trat'); } catch (e) {} });
  await D.fill('#pq-nom', 'Blanqueamiento'); await D.fill('#pq-n', '3'); await D.fill('#pq-tot', '700');
  await D.locator('#c-paquetes button', { hasText: /Guardar paquete/ }).first().click(); await D.waitForTimeout(400);
  await D.click('nav button[data-v="atencion"]'); await D.evaluate(() => clearForm());
  await D.fill('#f-prof', 'Dra. Shirley'); await D.fill('#f-paciente', PAC); await D.fill('#f-cel', '70011122');
  await D.evaluate(() => { $('#f-fecha').value = addDias(hoyISO(), -14); const i = document.querySelector('#seg-canal input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await D.click('#btn-planes'); await D.locator('#modal button', { hasText: /📦 Blanqueamiento/ }).first().click(); await D.waitForTimeout(400);
  await D.locator('#modal button', { hasText: /Sí, hoy se hizo la sesión 1/ }).first().click(); await D.waitForTimeout(400);
  await D.fill('#f-acuenta', '700'); await D.dispatchEvent('#f-acuenta', 'input'); await D.evaluate(() => { setRadio('metodo', 'QR'); recalcSaldo(); });
  await D.click('#btn-save'); await D.waitForTimeout(1500); await D.evaluate(() => closeModal());
  OK('0 paquete vendido con la sesión 1 hecha', JSON.stringify(await avance(D)) === JSON.stringify({ h: 1, est: 'activo', cola: 0 }), await avance(D));
  await D.context().close();

  /* vuelve: la doctora lo atiende desde Nueva atención y elige el paquete */
  const P = await abrir(SPA ? 'sp-shirley-1' : 'sp-equipo-1');
  await P.click('nav button[data-v="atencion"]'); await P.evaluate(() => clearForm());
  if (!SPA) await P.fill('#f-prof', 'Dra. Shirley');
  await P.fill('#f-paciente', PAC); await P.dispatchEvent('#f-paciente', 'change'); await P.waitForTimeout(700);
  const ops = await P.evaluate(() => [...$('#f-plan').options].map(o => o.textContent));
  OK('1 pregunta si la visita es una sesión del paquete', ops.length === 2 && /Blanqueamiento · 1\/3/.test(ops[1]), ops);
  await P.evaluate(() => { const s = $('#f-plan'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); }); await P.waitForTimeout(500);
  const hint = await P.evaluate(() => $('#plan-hint').textContent);
  OK('1 avisa: sesión 2 y ya pagada', /sesión 2 de 3/.test(hint) && /pagados para esta sesión/.test(hint), hint);
  await P.click('#btn-save'); await P.waitForTimeout(1500); await P.evaluate(() => closeModal());
  OK('1 en el panel de la doctora: 2/3 y nada pendiente', JSON.stringify(await avance(P)) === JSON.stringify({ h: 2, est: 'activo', cola: 0 }), await avance(P));
  const D2 = await abrir('sp-duena-1');
  OK('1 en la hoja (otro equipo): 2/3', (await avance(D2) || {}).h === 2, await avance(D2));
  await D2.context().close();

  /* la sesión 3 desde la ficha: «Marcar realizada» */
  await P.evaluate((n) => { const p = planesDe(n)[0]; atencionDePlan(n, p.id, 3); }, PAC); await P.waitForTimeout(500);
  await P.evaluate(() => { const e = $('#ap-prof'); if (e && !e.readOnly && !e.value) { e.value = 'Dra. Shirley'; e.dispatchEvent(new Event('change', { bubbles: true })); } });
  await P.click('#ap-ok'); await P.waitForTimeout(1500); await P.evaluate(() => closeModal());
  OK('2 en el panel de la doctora: 3/3 terminado', JSON.stringify(await avance(P)) === JSON.stringify({ h: 3, est: 'terminado', cola: 0 }), await avance(P));
  const D3 = await abrir('sp-duena-1');
  const fin = await avance(D3);
  OK('2 en la hoja (otro equipo): 3/3 terminado', fin && fin.h === 3 && fin.est === 'terminado', fin);
  const cuentas = await D3.evaluate((n) => { const p = planesDe(n)[0]; return [cobradoPlan(p), saldoPlan(p)]; }, PAC);
  OK('2 cuentas: 700 pagados, no debe nada', cuentas[0] === 700 && cuentas[1] === 0, cuentas);
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
