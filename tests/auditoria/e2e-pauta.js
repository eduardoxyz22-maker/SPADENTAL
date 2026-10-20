/* Pestaña «📣 Pauta»: solo con la clave de pauta (solo lectura), reportes por mes de llegada y red.
   Chromium real, .gs real en memoria. La clave de prueba reemplaza al verificador del script. Sin red real. */
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
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('pa-duena-1'); server.ctx.guardarVerif(v);
  server.ctx.VERIF_PAUTA = server.ctx.shaHex('pa-pauta-prueba-1');
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const abrir = async (clave) => {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await page.clock.install({ time: new Date('2026-10-20T14:15:00Z') });
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.fill('#gate-pass', clave); await page.click('#gate-btn'); await page.waitForTimeout(2000);
    return page;
  };
  /* la dueña carga tres meses: Facebook de agosto y septiembre que vuelven, Instagram de octubre, y uno de antes */
  const D = await abrir('pa-duena-1');
  await D.evaluate(() => {
    let i = 0; const at = (pac, fecha, canal, srv, tot) => { const r = normalize({ id: uid(), fecha, hora: '10:00', paciente: pac, profesional: 'Dra. Mirna', estado: 'Atendido', tipo: 'Nuevo', canal, origen: 'Espontánea', celular: '7004' + (i++),
      servicios: srv, total: tot, acuenta: tot, saldo: 0, metodo: 'QR', pagos: tot ? [{ metodo: 'QR', monto: tot }] : [], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); };
    const C = n => CFG.canales.find(c => new RegExp(n, 'i').test(c)) || n;
    const cons = [{ nom: 'Consulta / Valoración', cant: 1, precio: 150 }], blq = [{ nom: 'Blanqueamiento dental · 3 sesiones', cant: 1, precio: 700 }], lim = [{ nom: 'Limpieza dental', cant: 1, precio: 150 }];
    at('Fb Sep Uno', '2026-09-05', C('face'), cons, 150); at('Fb Sep Uno', '2026-10-02', C('antig') , blq, 700);
    at('Fb Sep Dos', '2026-09-12', C('face'), cons, 150); at('Fb Sep Dos', '2026-10-08', C('antig'), blq, 700);
    at('Fb Sep Tres', '2026-09-20', C('face'), lim, 150);
    at('Fb Ago Uno', '2026-08-10', C('face'), cons, 150); at('Fb Ago Uno', '2026-09-01', C('antig'), lim, 150); at('Fb Ago Uno', '2026-10-15', C('antig'), lim, 150);
    at('Ig Oct Uno', '2026-10-03', C('insta'), blq, 700); at('Ig Oct Dos', '2026-10-09', C('insta'), cons, 150);
    at('Viejo Antes', '2026-05-02', C('antig'), lim, 150); at('Viejo Antes', '2026-10-11', C('antig'), lim, 150);
    saveLocal(); return flushQueue(); });
  await D.waitForTimeout(1500);
  OK('la dueña no ve la pestaña Pauta', !(await D.locator('#nav-pauta').isVisible()));
  await D.evaluate(() => show('pauta')); await D.waitForTimeout(300);
  OK('y si la pide, va a Mi día', await D.evaluate(() => $('#v-midia').classList.contains('on') && !$('#v-pauta').classList.contains('on')));
  await D.context().close();

  const P = await abrir('pa-pauta-prueba-1');
  OK('con la clave de pauta entra a la pestaña Pauta', await P.evaluate(() => ROL === 'pauta' && $('#v-pauta').classList.contains('on') && document.body.classList.contains('rol-pauta')));
  const visibles = await P.evaluate(() => [...document.querySelectorAll('header nav button')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.id || x.dataset.v));
  OK('solo se ven Pauta y el botón de sesión', JSON.stringify(visibles) === JSON.stringify(['nav-pauta', 'nav-duena']), visibles);
  if (process.env.SHOT) { await P.setViewportSize({ width: 1366, height: 2600 }); await P.waitForTimeout(400); await P.locator('#v-pauta').screenshot({ path: process.env.SHOT }); await P.setViewportSize({ width: 1366, height: 900 }); }
  const txt = await P.locator('#pauta-box').innerText();
  OK('reporte: llegaron en septiembre por Facebook, 3 nuevos', /LLEGARON EN SEPTIEMBRE/.test(txt) && await P.evaluate(() => { const c = mdPautaCohortes(3).celdas['2026-09|' + (CFG.canales.find(c => /face/i.test(c)) || 'Facebook')]; return c && c.n === 3 && c.m[0] === 450 && c.m[1] === 1400 && c.tot === 1850 && c.vol === 2; }));
  OK('la pauta que más rindió: Facebook de septiembre', /Facebook de septiembre: 3 nuevos que ya dejaron Bs 1[.,]?850/.test(txt), txt.slice(0, 300));
  OK('los que volvieron en octubre, por dónde habían llegado', /volvieron en octubre/.test(txt) && /Facebook · septiembre/.test(txt) && /Facebook · agosto/.test(txt) && /Sin dato · mayo/.test(txt));
  OK('cuánto tardan en hacerse el tratamiento', /Cuánto tardan/.test(txt));
  OK('los que más dejan con podio y red de llegada', await P.locator('#pauta-box .md-pt-pod .md-pt-pd').count() === 3 && /Los que más dejan/.test(txt));
  OK('y la tabla por servicio', await P.locator('#md-pauta-tab .md-pa-c').count() > 0);
  await P.locator('.md-pt-sel button', { hasText: 'Últimos 6 meses' }).click(); await P.waitForTimeout(300);
  OK('6 meses muestra también agosto', /LLEGARON EN AGOSTO/.test(await P.locator('#pauta-box').innerText()));
  const [dl] = await Promise.all([P.waitForEvent('download'), P.locator('.md-pt-csv').click()]);
  const csv = require('fs').readFileSync(await dl.path(), 'utf8');
  OK('descarga para Excel con los meses y los pacientes', /Mes de llegada;Red;Nuevos/.test(csv) && /Fb Sep Uno/.test(csv), dl.suggestedFilename());
  /* no puede escribir nada, aunque lo intente */
  const w = await P.evaluate(() => Promise.all(['save', 'pac', 'cfg', 'foto', 'delete'].map(a => api(a, { id: 'zz', paciente: 'X' }, {}, undefined, { foto: {} }).then(r => r && r.error))));
  OK('el servidor no deja escribir con la clave de pauta', w.every(e => e === 'sin_permiso'), w);
  await P.reload(); await P.waitForTimeout(1800);
  OK('al recargar sigue en Pauta (misma sesión)', await P.evaluate(() => ROL === 'pauta' && $('#v-pauta').classList.contains('on')));
  OK('no quedan cosas sin subir', await P.evaluate(() => pend().length) === 0);
  await P.context().close();
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
