/* La sesión de 30 minutos se renueva mientras se usa el panel, también después
   de recargar la página (el iPad recarga solo al volver a la app). Si nadie lo
   usa por más de 30 minutos, se pide la clave. Chromium real, .gs real en memoria. */
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
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('se-duena-1'); server.ctx.guardarVerif(v);
  const T0 = new Date('2026-10-20T14:15:00Z').getTime(); let t = T0; server.reloj = () => t;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
  await page.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
    if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
    if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
  await page.clock.install({ time: new Date(T0) });
  await page.goto('file://' + FILE); await page.waitForTimeout(800);
  await page.fill('#gate-pass', 'se-duena-1'); await page.click('#gate-btn'); await page.waitForTimeout(2000);
  OK('entra con la clave', await page.evaluate(() => ROL === 'admin' && sesionViva()));
  const pasar = async (min) => { t += min * 60000; await page.clock.setSystemTime(new Date(t)); };
  const usar = () => page.evaluate(() => api('list').then(r => r && (r.ok ? 'ok' : r.error)));
  /* recarga (como el iPad al volver): la clave ya no está en memoria, la sesión sí */
  await pasar(5); await page.reload(); await page.waitForTimeout(1800);
  OK('al recargar sigue adentro sin pedir la clave', await page.evaluate(() => ROL === 'admin' && CLAVE_MEM === '' && !document.body.classList.contains('locked')));
  await pasar(20); OK('a los 25 minutos, usándolo, anda', await usar() === 'ok');
  await pasar(20); OK('a los 45 minutos, usándolo, sigue andando', await usar() === 'ok');
  await pasar(25); OK('a la hora y diez, usándolo, sigue andando', await usar() === 'ok');
  OK('y nunca pidió la clave', !(await page.locator('#ses-pedir').isVisible().catch(() => false)));
  await page.evaluate(() => pullServer()); await page.waitForTimeout(300);
  OK('el aviso dice «Al día con la hoja»', /Al día con la hoja/.test(await page.locator('.banner.conn').innerText()));
  /* sin usarlo más de 30 minutos: pide la clave y el aviso lo dice claro */
  await pasar(31); const r = await usar(); await page.waitForTimeout(300);
  OK('después de 31 minutos sin usarlo, pide la clave', r === 'sin_sesion' && await page.locator('#ses-pedir').isVisible(), r);
  await page.evaluate(() => pullServer()); await page.waitForTimeout(300);
  OK('y el aviso dice que falta la clave (no «sin respuesta»)', /Falta tu clave/.test(await page.locator('.banner.conn').innerText()));
  await ctx.close();
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
