/* Sonri: cuando se juntan más de 10 avisos sin mirar, cada 5 minutos golpea la
   pantalla y dice «¡Oye, leeme!». Al abrirla se calma. Chromium real, .gs real en memoria. */
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
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('so-duena-1'); server.ctx.guardarVerif(v);
  const T0 = new Date('2026-10-20T14:15:00Z').getTime(); let t = T0; server.reloj = () => t;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const P = await ctx.newPage();
  P.on('pageerror', e => errs.push(e.message)); P.on('dialog', d => d.accept());
  await P.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
    if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
    if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
  await P.addInitScript(() => { window.ASIS_PRUEBA = true; HTMLMediaElement.prototype.play = () => Promise.resolve(); });
  await P.clock.install({ time: new Date(T0) });
  await P.goto('file://' + FILE); await P.waitForTimeout(800);
  await P.fill('#gate-pass', 'so-duena-1'); await P.click('#gate-btn'); await P.waitForTimeout(2000);
  await P.evaluate(() => { try { asisTourFin() } catch (e) {} try { closeModal() } catch (e) {} });
  /* citas de hace días sin resolver, para que se junten avisos de sobra */
  await P.evaluate(() => { const hoy = hoyISO();
    for (let i = 1; i <= 14; i++) { const r = normalize({ id: uid(), fecha: addDias(hoy, -i), hora: '10:00', paciente: 'Cita Vieja ' + i, profesional: 'Dra. Mirna', estado: 'Agendada', tipo: 'Nuevo', canal: 'Facebook', origen: 'Programada', celular: '7005000' + i, servicios: [], total: 0, acuenta: 0, saldo: 0, pagos: [], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); }
    saveLocal(); return flushQueue(); });
  await P.waitForTimeout(1200);
  await P.evaluate(() => { try { closeModal() } catch (e) {} $('#asis-globo').hidden = true; asisRefrescar(); });
  const n = await P.evaluate(() => asisAvisos().length);
  OK('hay más de 10 avisos juntos', n > 10, n);
  OK('recién abierto el panel, todavía no golpea', await P.evaluate(() => !$('#asis-globo').classList.contains('asis-oye')));
  const pasar = async (min) => { t += min * 60000; await P.clock.setSystemTime(new Date(t)); await P.evaluate(() => asisRefrescar()); await P.waitForTimeout(400); };
  await pasar(3);
  OK('a los 3 minutos, nada todavía', await P.evaluate(() => !$('#asis-globo').classList.contains('asis-oye')));
  await pasar(3);
  const g = await P.evaluate(() => ({ oye: $('#asis-globo').classList.contains('asis-oye'), vis: !$('#asis-globo').hidden, txt: $('#asis-globo').innerText, golpea: $('#asis-yo').classList.contains('asis-golpea') || document.body.classList.contains('asis-tiembla') }));
  if (process.env.SHOT) await P.screenshot({ path: process.env.SHOT, clip: { x: 866, y: 600, width: 500, height: 300 } });
  OK('a los 6 minutos golpea la pantalla y dice «¡Oye, leeme!» con la cantidad', g.oye && g.vis && /¡Oye, leeme!/.test(g.txt) && new RegExp('Tenés ' + n + ' avisos').test(g.txt) && g.golpea, g);
  const t1 = await P.evaluate(() => ASIS_OYE_T);
  await pasar(2);
  OK('no repite antes de otros 5 minutos', await P.evaluate(() => ASIS_OYE_T) === t1);
  await P.locator('#asis-globo button', { hasText: /Ver los avisos/ }).click(); await P.waitForTimeout(400);
  OK('«Ver los avisos» abre a Sonri en sus avisos y el globo se va', await P.evaluate(() => ASIS.abierto && ASIS.tab === 'avisos' && $('#asis-globo').hidden));
  await P.evaluate(() => asisCerrar());
  await pasar(3);
  OK('después de mirarla, cuenta los 5 minutos de nuevo', await P.evaluate(() => !$('#asis-globo').classList.contains('asis-oye')));
  await pasar(3);
  OK('y a los 5 minutos vuelve a golpear', await P.evaluate(() => $('#asis-globo').classList.contains('asis-oye') && !$('#asis-globo').hidden));
  /* si abre Sonri, no golpea mientras está abierta */
  await P.evaluate(() => asisAbrir('avisos')); await pasar(6);
  OK('con Sonri abierta no golpea', await P.evaluate(() => $('#asis-globo').hidden));
  await P.evaluate(() => asisCerrar());
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
