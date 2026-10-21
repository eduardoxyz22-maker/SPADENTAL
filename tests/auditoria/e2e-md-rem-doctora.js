/* Recordatorios filtrados por doctora: citasPend() da {r, dias} y el filtro «Ver de» tiene que mirar la cita (c.r).
   Antes, con una doctora elegida (o una doctora que entra con su clave) las citas quedaban en 0.
   Chromium real, .gs real en memoria, datos ficticios, sin red real. */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(72), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('rd-duena-1'); v.prof['Dra. Shirley'] = server.ctx.shaHex('rd-shirley-1'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const abrir = async (clave) => {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
    await page.clock.install({ time: new Date('2026-10-21T14:15:00Z') });
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.fill('#gate-pass', clave); await page.click('#gate-btn'); await page.waitForTimeout(2000);
    return page;
  };
  /* lo que muestra la vista: las tres tarjetas de citas y los nombres de la lista */
  const vista = pg => pg.evaluate(() => {
    const n = id => +(document.querySelector(id + ' .v') || {}).textContent;
    return { venc: n('#k-venc'), hoy: n('#k-hoy'), sem: n('#k-sem'), prof: $('#rem-prof').value, dis: $('#rem-prof').disabled,
      quien: [...document.querySelectorAll('#rem-list .rem .who')].map(x => x.textContent.trim()).filter(t => /^Rc /.test(t)).sort(),
      vacio: /Nada pendiente/.test($('#rem-list').textContent) };
  });
  const verCitas = async (pg, prof) => { await pg.evaluate(p => { show('agenda'); setRadio('remf', 'citas'); if (p !== undefined) $('#rem-prof').value = p; renderRem(); }, prof); await pg.waitForTimeout(400); return vista(pg); };

  const D = await abrir('rd-duena-1');
  OK('entra la dueña', await D.evaluate(() => ROL === 'admin'));
  /* citas de varias doctoras: Shirley (vencida, hoy, en 5 días), Mirna (hoy, en 3 días), Brenda (en 2 días) y una «Por definir» */
  await D.evaluate(() => {
    const hoy = hoyISO(), C = CFG.canales[0];
    const cita = (pac, prof, d, hora) => { const r = normalize({ id: uid(), fecha: addDias(hoy, d), hora, paciente: pac, profesional: prof, estado: 'Agendada', tipo: 'Recurrente', canal: C, origen: 'Programada', celular: '70012345',
      servicios: [], total: 0, acuenta: 0, saldo: 0, pagos: [], proxMotivo: 'Control', ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); };
    cita('Rc Vencida Shirley', 'Dra. Shirley', -2, '09:00'); cita('Rc Hoy Shirley', 'Dra. Shirley', 0, '16:00'); cita('Rc Cinco Shirley', 'Dra. Shirley', 5, '11:00');
    cita('Rc Hoy Mirna', 'Dra. Mirna', 0, '17:00'); cita('Rc Tres Mirna', 'Dra. Mirna', 3, '10:00'); cita('Rc Dos Brenda', 'Dra. Brenda', 2, '12:00');
    cita('Rc Libre', 'Por definir', 1, '15:00');
    saveLocal(); flushQueue(); });
  await D.waitForTimeout(1200);
  const SHIRLEY = ['Rc Cinco Shirley', 'Rc Hoy Shirley', 'Rc Libre', 'Rc Vencida Shirley'];

  /* ---- A · la dueña con todas las doctoras ---- */
  const dT = await verCitas(D, '');
  OK('A la dueña ve todas las citas', dT.quien.length === 7 && dT.venc === 1 && dT.hoy === 2 && dT.sem === 4, dT);

  /* ---- B · la dueña elige a Shirley en «Ver de» ---- */
  const dS = await verCitas(D, 'Dra. Shirley');
  OK('B el select quedó en Shirley', dS.prof === 'Dra. Shirley' && !dS.dis, dS.prof);
  OK('B ve las citas de Shirley y la «Por definir»', JSON.stringify(dS.quien) === JSON.stringify(SHIRLEY), dS.quien);
  OK('B no ve las de Mirna ni Brenda', !dS.quien.some(q => /Mirna|Brenda/.test(q)));
  OK('B las tarjetas cuentan las de Shirley (1 vencida, 1 hoy, 2 en 7 días)', dS.venc === 1 && dS.hoy === 1 && dS.sem === 2 && !dS.vacio, dS);
  const dM = await verCitas(D, 'Dra. Mirna');
  OK('B con Mirna ve las de Mirna y no las de Shirley', dM.quien.includes('Rc Hoy Mirna') && dM.quien.includes('Rc Tres Mirna') && !dM.quien.some(q => /Shirley|Brenda/.test(q)) && dM.hoy === 1, dM);

  /* ---- C · Shirley entra con su clave ---- */
  const S = await abrir('rd-shirley-1');
  OK('C entra Shirley como doctora', await S.evaluate(() => esDoctora() && PROF_ACTUAL === 'Dra. Shirley'));
  const sS = await verCitas(S);
  OK('C el select queda fijo en ella', sS.prof === 'Dra. Shirley' && sS.dis, sS.prof);
  OK('C ve «Rc Hoy Shirley» y «Rc Cinco Shirley»', sS.quien.includes('Rc Hoy Shirley') && sS.quien.includes('Rc Cinco Shirley'), sS.quien);
  OK('C ve exactamente lo suyo y la «Por definir»', JSON.stringify(sS.quien) === JSON.stringify(SHIRLEY), sS.quien);
  OK('C no ve las de otras doctoras', !sS.quien.some(q => /Mirna|Brenda/.test(q)));
  OK('C las tarjetas no dicen 0 (1 vencida, 1 hoy, 2 en 7 días) y la lista no está vacía', sS.venc === 1 && sS.hoy === 1 && sS.sem === 2 && !sS.vacio, sS);
  /* lo que la vista moderna pinta encima tiene que coincidir con el renderRem de base */
  const orig = await S.evaluate(() => { MD_ORIG.renderRem(); return [...document.querySelectorAll('#rem-list .rem .who')].map(x => x.textContent.trim()).filter(t => /^Rc /.test(t)).sort(); });
  OK('C el renderRem original da lo mismo', JSON.stringify(orig) === JSON.stringify(sS.quien), orig);
  OK('C el contador del menú cuenta sus citas que asoman', await S.evaluate(() => totalPendientes() >= 3 && +$('#nav-rem').textContent >= 3), await S.evaluate(() => $('#nav-rem').textContent));

  OK('sin errores de página', errs.length === 0, errs.slice(0, 3));
  OK('sin red de verdad', red.length === 0, red.slice(0, 3));
  await b.close();
  console.log(fallas ? '\n' + fallas + ' FALLAS' : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
