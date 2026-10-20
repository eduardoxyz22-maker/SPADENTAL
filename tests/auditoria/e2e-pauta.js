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
    let i = 0; const at = (pac, fecha, canal, srv, tot, tipo) => { const r = normalize({ id: uid(), fecha, hora: '10:00', paciente: pac, profesional: 'Dra. Mirna', estado: 'Atendido', tipo: tipo || 'Nuevo', canal, origen: 'Espontánea', celular: '7004' + (i++),
      servicios: srv, total: tot, acuenta: tot, saldo: 0, metodo: 'QR', pagos: tot ? [{ metodo: 'QR', monto: tot }] : [], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); };
    const C = n => CFG.canales.find(c => new RegExp(n, 'i').test(c)) || n;
    const cons = [{ nom: 'Consulta / Valoración', cant: 1, precio: 150 }], blq = [{ nom: 'Blanqueamiento dental · 3 sesiones', cant: 1, precio: 700 }], lim = [{ nom: 'Limpieza dental', cant: 1, precio: 150 }];
    at('Fb Sep Uno', '2026-09-05', C('face'), cons, 150); at('Fb Sep Uno', '2026-10-02', C('antig') , blq, 700);
    at('Fb Sep Dos', '2026-09-12', C('face'), cons, 150); at('Fb Sep Dos', '2026-10-08', C('antig'), blq, 700);
    at('Fb Sep Tres', '2026-09-20', C('face'), lim, 150);
    at('Fb Ago Uno', '2026-08-10', C('face'), cons, 150); at('Fb Ago Uno', '2026-09-01', C('antig'), lim, 150); at('Fb Ago Uno', '2026-10-15', C('antig'), lim, 150);
    at('Ig Oct Uno', '2026-10-03', C('insta'), blq, 700); at('Ig Oct Dos', '2026-10-09', C('insta'), cons, 150);
    at('Viejo Antes', '2026-05-02', C('antig'), lim, 150); at('Viejo Antes', '2026-10-11', C('antig'), lim, 150);
    /* octubre: dos referidos que dejan mucho y dos de Facebook (los referidos no se pautan) */
    const consR = [{ nom: 'Consulta / Valoración', cant: 1, precio: 1500 }];
    at('Ref Oct Uno', '2026-10-04', C('referid'), consR, 1500); at('Ref Oct Dos', '2026-10-06', C('referid'), consR, 1500);
    at('Fb Oct Uno', '2026-10-05', C('face'), cons, 150); at('Fb Oct Dos', '2026-10-07', C('face'), cons, 150);
    /* ya era paciente antes del panel: su primera visita cargada no es «Nuevo» */
    at('Ya Era Antes', '2026-09-15', C('antig'), lim, 150, 'Recurrente'); at('Ya Era Antes', '2026-10-12', C('antig'), lim, 150, 'Recurrente');
    saveLocal(); return flushQueue(); });
  await D.waitForTimeout(1500);
  /* Caja › Movimientos: el buscador por paciente deja solo sus pagos del periodo */
  await D.evaluate(() => show('caja')); await D.waitForTimeout(600);
  await D.evaluate(() => { $('#c-rango').value = 'mes'; $('#c-rango').dispatchEvent(new Event('change', { bubbles: true })); $('#c-mes').value = '2026-10'; $('#c-mes').dispatchEvent(new Event('change', { bubbles: true })); renderCaja(); });
  await D.waitForTimeout(300);
  const antes = await D.evaluate(() => document.querySelectorAll('#cj-body tr').length);
  await D.fill('#cj-q', 'fb sep uno'); await D.dispatchEvent('#cj-q', 'input'); await D.waitForTimeout(300);
  const cj = await D.evaluate(() => ({ n: document.querySelectorAll('#cj-body tr').length, pacs: [...document.querySelectorAll('#cj-body tr td:nth-child(2)')].map(t => t.innerText.trim()), res: $('#cj-q-res').innerText }));
  OK('Caja: buscar «fb sep uno» deja solo sus pagos de octubre, con el resumen', antes > 1 && cj.n === 1 && cj.pacs.every(p => /Fb Sep Uno/.test(p)) && /1 movimiento de Fb Sep Uno · total Bs 700 · cobrado Bs 700/.test(cj.res), cj);
  await D.evaluate(() => { $('#c-rango').value = 'anio'; $('#c-rango').dispatchEvent(new Event('change', { bubbles: true })); $('#c-anio').value = '2026'; $('#c-anio').dispatchEvent(new Event('change', { bubbles: true })); renderCaja(); }); await D.waitForTimeout(300);
  const cj2 = await D.evaluate(() => ({ n: document.querySelectorAll('#cj-body tr').length, res: $('#cj-q-res').innerText }));
  OK('Caja: en el año son sus 2 visitas (850)', cj2.n === 2 && /2 movimientos de Fb Sep Uno · total Bs 850 · cobrado Bs 850/.test(cj2.res), cj2);
  if (process.env.SHOT_CAJA) { await D.evaluate(() => { const c = [...document.querySelectorAll('#v-caja .card')].filter(x => /Movimientos del periodo/.test(x.textContent))[0]; c.scrollIntoView(); }); await D.waitForTimeout(300); await D.locator('#v-caja .card', { hasText: 'Movimientos del periodo' }).first().screenshot({ path: process.env.SHOT_CAJA }); }
  await D.fill('#cj-q', 'mirna'); await D.dispatchEvent('#cj-q', 'input'); await D.waitForTimeout(300);
  const cj3 = await D.evaluate(() => ({ n: document.querySelectorAll('#cj-body tr').length, docs: [...new Set([...document.querySelectorAll('#cj-body tr td:nth-child(3)')].map(t => t.innerText.trim()))], res: $('#cj-q-res').innerText }));
  OK('Caja: buscar «mirna» deja todo lo que cobró la Dra. Mirna en el año', cj3.n > 2 && cj3.docs.length === 1 && /Dra\. Mirna/.test(cj3.docs[0]) && /movimientos de Dra\. Mirna · \d+ pacientes/.test(cj3.res), cj3);
  await D.locator('#cj-q-res button', { hasText: /Ver todos/ }).click(); await D.waitForTimeout(300);
  OK('«✕ Ver todos» vuelve a la lista completa', await D.evaluate(() => $('#cj-q').value === '' && document.querySelectorAll('#cj-body tr').length > 2));
  await D.fill('#cj-q', 'zzzz'); await D.dispatchEvent('#cj-q', 'input'); await D.waitForTimeout(200);
  OK('si no hay nadie, lo dice', /Nadie con «zzzz»/.test(await D.evaluate(() => $('#cj-q-res').innerText)));
  await D.fill('#cj-q', ''); await D.dispatchEvent('#cj-q', 'input');
  await D.evaluate(() => show('midia')); await D.waitForTimeout(300);
  OK('la dueña no ve la pestaña Pauta', !(await D.locator('#nav-pauta').isVisible()));
  await D.evaluate(() => show('panel')); await D.waitForTimeout(800);
  const rp = await D.locator('#md-pauta .md-pa-rec').innerText();
  OK('el Panel recomienda pautar en una red de pauta, no en Referido', /Pautar Consulta \/ Valoración en Facebook/i.test(rp) && /referidos .*no se pauta/i.test(rp), rp.slice(0, 200));
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
  OK('cuánto tardan en hacerse el tratamiento', /Cuánto tardan/.test(txt) && /el mismo día/.test(txt));
  OK('el que ya era paciente no cuenta como nuevo de la pauta', await P.evaluate(() => { const C = mdPautaCohortes(3); return !Object.keys(C.celdas).some(k => C.celdas[k].pacs.some(p => p.nombre === 'Ya Era Antes')) && !C.celdas['2026-09|Sin dato']; }));
  OK('pero aparece entre los que volvieron, como paciente de antes', /Ya eran pacientes antes del panel/.test(txt));
  await P.locator('#pauta-box tr.md-pt-clic[onclick*="2026-09"]', { hasText: 'Facebook' }).locator('td').first().click(); await P.waitForTimeout(300);
  let m = await P.locator('#modal').innerText();
  OK('tocar la fila muestra quiénes son', /llegaron en septiembre/.test(m) && /Fb Sep Uno/.test(m) && /Fb Sep Dos/.test(m) && /Fb Sep Tres/.test(m), m.slice(0, 120));
  await P.evaluate(() => closeModal());
  await P.locator('#pauta-box tr.md-pt-clic[onclick*="2026-09"]', { hasText: 'Facebook' }).locator('td', { hasText: '2 de 3' }).click(); await P.waitForTimeout(300);
  m = await P.locator('#modal').innerText();
  OK('tocar «2 de 3 volvieron» muestra solo los que volvieron', /los que volvieron/.test(m) && /Fb Sep Uno/.test(m) && /Fb Sep Dos/.test(m) && !/Fb Sep Tres/.test(m), m.slice(0, 160));
  await P.evaluate(() => closeModal());
  await P.locator('#pauta-box .md-pt-f.md-pt-clic', { hasText: 'Ya eran pacientes' }).click(); await P.waitForTimeout(300);
  m = await P.locator('#modal').innerText();
  OK('y los que volvieron este mes también se pueden ver', /Ya Era Antes/.test(m));
  await P.evaluate(() => closeModal());
  OK('si el rango pasa de lo cargado, avisa desde cuándo hay datos', await P.evaluate(() => { MD_PT_N = 12; renderPautaTab(); const t = $('#pauta-box').innerText; MD_PT_N = 3; renderPautaTab(); return /datos desde mayo/i.test(t) && !/LLEGARON EN ABRIL/.test(t); }));
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
