/* La barra de fecha compartida de Mi día y Agenda (MODERNO · parte 30-fecha): ◀ Hoy ▶, el calendario del mes
   con puntitos en los días con citas y las doctoras como chips. Tiene que alimentar los mismos inputs que
   renderMiDia y renderCitasProximas, compartir fecha y doctora entre las dos pestañas, respetar el rol doctora
   y dejar vivos los botones viejos (ocultos). Chromium real, .gs real en memoria, datos ficticios. Sin red real.
   Uso: PANEL=spa|cos node -r ./netguard.js e2e-md-fecha.js   (SHOT=... SHOT_CEL=... guardan capturas) */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('fe-duena-1'); v.equipo = server.ctx.shaHex('fe-equipo-1');
  v.prof['Dra. Shirley'] = server.ctx.shaHex('fe-shirley-1'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const abrir = async (clave, w) => {
    const ctx = await b.newContext({ viewport: { width: w || 1366, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
    await page.clock.install({ time: new Date('2026-10-20T14:15:00Z') });
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.fill('#gate-pass', clave); await page.click('#gate-btn'); await page.waitForTimeout(2000);
    return page;
  };
  /* lo que ve la barra y lo que ven los inputs viejos, en la vista que está a la vista */
  const estado = (pg) => pg.evaluate(() => {
    const en = document.querySelector('#v-cita').classList.contains('on') ? 'cita' : 'midia';
    const bar = document.querySelector('#md-fe'), ch = [...document.querySelectorAll('#md-fe .md-fe-doc')];
    return { en, dentro: bar ? (bar.closest('.view') || {}).id : null, texto: (document.querySelector('#md-fe-cal span') || {}).textContent,
      mdia: $('#m-dia').value, mprof: $('#m-prof').value, qdia: $('#q-dia').value, qprof: $('#q-filtro-prof').value,
      chips: ch.map(c => [c.getAttribute('data-prof'), +c.querySelector('em').textContent, c.classList.contains('on'), c.tagName]),
      viejoOculto: ['#m-dia', '#q-dia'].every(s => getComputedStyle($(s).closest('.grid')).display === 'none'),
      lista: [...document.querySelectorAll('#m-lista .rem')].length, agenda: [...document.querySelectorAll('#q-lista-dia .rem')].length };
  });

  /* ---------- la dueña siembra citas en varios días y doctoras ---------- */
  const D = await abrir('fe-duena-1');
  const hoy = await D.evaluate(() => hoyISO());
  const F = await D.evaluate(() => ({ m2: addDias(hoyISO(), -2), m1: addDias(hoyISO(), -1), h: hoyISO(), p1: addDias(hoyISO(), 1), p3: addDias(hoyISO(), 3), p5: addDias(hoyISO(), 5) }));
  await D.evaluate((F) => {
    let i = 0;
    const cita = (pac, fecha, hora, prof, estado) => { const r = normalize({ id: uid(), fecha, hora, paciente: pac, profesional: prof, estado: estado || 'Agendada', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Programada', celular: '7005' + (i++), servicios: [], total: 0, acuenta: 0, saldo: 0, pagos: [], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); };
    cita('Fe Hoy Mirna A', F.h, '09:00', 'Dra. Mirna'); cita('Fe Hoy Mirna B', F.h, '10:00', 'Dra. Mirna');
    cita('Fe Hoy Shirley', F.h, '11:00', 'Dra. Shirley'); cita('Fe Hoy Brenda', F.h, '12:00', 'Dra. Brenda');
    cita('Fe Manana Shirley', F.p1, '09:30', 'Dra. Shirley'); cita('Fe Manana Brenda', F.p1, '15:00', 'Dra. Brenda');
    cita('Fe Tres Mirna', F.p3, '10:00', 'Dra. Mirna'); cita('Fe Tres Shirley', F.p3, '16:00', 'Dra. Shirley');
    cita('Fe Antes Mirna', F.m2, '10:00', 'Dra. Mirna', 'Atendido');
    /* una cancelada no cuenta ni pinta puntito */
    cita('Fe Cancelada Brenda', F.p5, '10:00', 'Dra. Brenda', 'Canceló');
    /* una atención sin cita (espontánea): cuenta en Mi día, no en la Agenda */
    const at = normalize({ id: uid(), fecha: F.h, hora: '08:30', paciente: 'Fe Espontanea Mirna', profesional: 'Dra. Mirna', estado: 'Atendido', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Espontánea', celular: '70059999',
      servicios: [{ nom: 'Limpieza dental', cant: 1, precio: 150 }], total: 150, acuenta: 150, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 150 }], ts: new Date().toISOString() }); DATA.push(at); queue('save', at, null);
    saveLocal(); return flushQueue(); }, F);
  await D.waitForTimeout(1200);
  await D.evaluate(() => show('midia')); await D.waitForTimeout(400);
  /* conteos de referencia con las funciones del panel (lo que listaría cada vista) */
  const ref = (pg, dia, prof, vista) => pg.evaluate(([dia, prof, vista]) => filasDelDia(dia, prof).filter(r => !/^(Cancel|Reprogram)/.test(r.estado) && (vista !== 'cita' || r.origen === 'Programada')).length, [dia, prof, vista]);

  let e = await estado(D);
  OK('Mi día: la barra está en Mi día y los selectores viejos quedaron ocultos', e.dentro === 'v-midia' && e.viejoOculto && e.en === 'midia', [e.dentro, e.viejoOculto]);
  OK('la fecha sale en palabras (hoy)', e.texto === await D.evaluate(() => mdFeTexto(hoyISO())) && /^[a-zá-ú]{3} \d{1,2} [a-z]{3}$/.test(e.texto), e.texto);
  const todas = await ref(D, hoy, '', 'midia'), mir = await ref(D, hoy, 'Dra. Mirna', 'midia'), shi = await ref(D, hoy, 'Dra. Shirley', 'midia');
  const chip = (e, p) => e.chips.find(c => c[0] === p);
  OK('chips: «Todas» con el total del día y cada doctora con las suyas (Mi día cuenta la espontánea)', chip(e, '')[1] === todas && todas === 5 && chip(e, 'Dra. Mirna')[1] === mir && mir === 3 && chip(e, 'Dra. Shirley')[1] === shi && chip(e, '')[2], e.chips);
  OK('los chips llevan el color de la doctora', await D.evaluate(() => [...document.querySelectorAll('#md-fe .md-fe-doc i')].every(i => i.style.background) && new Set([...document.querySelectorAll('#md-fe .md-fe-doc i')].map(i => i.style.background)).size >= 3));

  /* ◀ ▶ Hoy mueven el día de Mi día */
  await D.click('#md-fe-manana'); await D.waitForTimeout(250); e = await estado(D);
  OK('▶ pasa a mañana en #m-dia y la lista cambia', e.mdia === F.p1 && e.lista === await ref(D, F.p1, '', 'midia') && e.lista === 2 && e.texto === await D.evaluate(f => mdFeTexto(f), F.p1), [e.mdia, e.lista]);
  await D.click('#md-fe-ayer'); await D.click('#md-fe-ayer'); await D.waitForTimeout(250); e = await estado(D);
  OK('◀ ◀ vuelve a ayer', e.mdia === F.m1 && e.lista === 0, e.mdia);
  await D.click('#md-fe-hoy'); await D.waitForTimeout(250); e = await estado(D);
  OK('Hoy vuelve a hoy (y el botón queda marcado)', e.mdia === hoy && await D.evaluate(() => $('#md-fe-hoy').classList.contains('on')));

  /* el calendario del mes */
  await D.click('#md-fe-cal'); await D.waitForTimeout(250);
  const cal = await D.evaluate(() => { const p = $('#md-fe-pop'); return { ok: !p.hidden && getComputedStyle(p).display !== 'none', titulo: p.querySelector('.md-fe-mh b').textContent,
    con: [...p.querySelectorAll('.md-fe-d.con')].map(x => x.getAttribute('data-f')).sort(), hoy: [...p.querySelectorAll('.md-fe-d.hy')].map(x => x.getAttribute('data-f')), sel: [...p.querySelectorAll('.md-fe-d.sel')].map(x => x.getAttribute('data-f')), n: p.querySelectorAll('.md-fe-d:not(.mt)').length }; });
  const conRef = await D.evaluate(() => { const m = hoyISO().slice(0, 7), s = {}; DATA.forEach(r => { if (r.fecha.slice(0, 7) === m && !esAnticipo(r) && !/^(Cancel|Reprogram)/.test(r.estado)) s[r.fecha] = 1; }); return Object.keys(s).sort(); });
  OK('el calendario se abre en el mes de hoy', cal.ok && /Octubre 2026/.test(cal.titulo) && cal.n === 31, cal.titulo);
  OK('los puntitos coinciden con los días con citas (la cancelada no pinta)', JSON.stringify(cal.con) === JSON.stringify(conRef) && conRef.length === 4 && !cal.con.includes(F.p5), [cal.con, conRef]);
  OK('hoy marcado y el día elegido también', cal.hoy[0] === hoy && cal.sel[0] === hoy, [cal.hoy, cal.sel]);
  if (process.env.SHOT) { const bb = await D.locator('#v-midia .card').first().boundingBox(); await D.screenshot({ path: process.env.SHOT, clip: { x: 0, y: Math.max(0, bb.y - 8), width: 1366, height: bb.height + 430 } }); }
  await D.click('#md-fe-pop .md-fe-d[data-f="' + F.p3 + '"]'); await D.waitForTimeout(300); e = await estado(D);
  OK('tocar un día del calendario lo elige, cierra el calendario y repinta Mi día', e.mdia === F.p3 && e.lista === 2 && await D.evaluate(() => $('#md-fe-pop').hidden), [e.mdia, e.lista]);
  await D.click('#md-fe-cal'); await D.waitForTimeout(200); await D.click('#md-fe-pop .md-fe-mb[data-m="1"]'); await D.waitForTimeout(200);
  OK('‹ › cambian de mes sin cambiar el día', /Noviembre 2026/.test(await D.locator('#md-fe-pop .md-fe-mh b').textContent()) && (await estado(D)).mdia === F.p3);
  await D.click('#md-fe-pop .md-fe-irhoy'); await D.waitForTimeout(250); e = await estado(D);
  OK('«Ir a hoy» vuelve a hoy', e.mdia === hoy && await D.evaluate(() => $('#md-fe-pop').hidden));

  /* la doctora elegida filtra igual que el select viejo */
  await D.click('#md-fe .md-fe-doc[data-prof="Dra. Shirley"]'); await D.waitForTimeout(300); e = await estado(D);
  const porChip = await D.evaluate(() => $('#m-lista').innerText);
  OK('elegir a Shirley escribe #m-prof y deja solo lo suyo', e.mprof === 'Dra. Shirley' && chip(e, 'Dra. Shirley')[2] && !chip(e, '')[2] && e.lista === shi && /Fe Hoy Shirley/.test(porChip) && !/Mirna/.test(porChip), [e.mprof, e.lista]);
  await D.click('#md-fe .md-fe-doc[data-prof=""]'); await D.waitForTimeout(250);
  await D.evaluate(() => { $('#m-prof').value = 'Dra. Shirley'; $('#m-prof').dispatchEvent(new Event('change', { bubbles: true })); }); await D.waitForTimeout(300);
  const porSelect = await D.evaluate(() => $('#m-lista').innerText); e = await estado(D);
  OK('el select viejo (oculto) sigue filtrando y la barra lo sigue: misma lista', porSelect === porChip && chip(e, 'Dra. Shirley')[2], e.chips.filter(c => c[2]));
  await D.evaluate(() => $('#m-ayer').click()); await D.waitForTimeout(300); e = await estado(D);
  OK('el ◀ viejo (oculto) sigue vivo y la barra muestra ayer', e.mdia === F.m1 && e.texto === await D.evaluate(f => mdFeTexto(f), F.m1));
  await D.evaluate(() => $('#m-hoy').click()); await D.waitForTimeout(300);

  /* pasar a Agenda: mismo día y misma doctora, con la cuenta de la Agenda */
  await D.click('#md-fe-manana'); await D.waitForTimeout(250);
  await D.click('nav button[data-v="cita"]'); await D.waitForTimeout(500); e = await estado(D);
  OK('Agenda: la barra se mudó y trae el mismo día y la misma doctora', e.en === 'cita' && e.dentro === 'v-cita' && e.qdia === F.p1 && e.qprof === 'Dra. Shirley' && e.viejoOculto, [e.dentro, e.qdia, e.qprof]);
  OK('y la agenda lista lo de ese día y esa doctora', e.agenda === await ref(D, F.p1, 'Dra. Shirley', 'cita') && e.agenda === 1 && /Fe Manana Shirley/.test(await D.evaluate(() => $('#q-lista-dia').innerText)), e.agenda);
  await D.click('#md-fe-hoy'); await D.waitForTimeout(300); e = await estado(D);
  OK('en Agenda los chips cuentan solo lo agendado (la espontánea no)', chip(e, 'Dra. Mirna')[1] === await ref(D, hoy, 'Dra. Mirna', 'cita') && chip(e, 'Dra. Mirna')[1] === 2 && chip(e, '')[1] === 4, e.chips);
  await D.click('#md-fe .md-fe-doc[data-prof=""]'); await D.click('#md-fe-manana'); await D.waitForTimeout(300); e = await estado(D);
  OK('«Todas» y ▶ en Agenda escriben #q-filtro-prof y #q-dia', e.qprof === '' && e.qdia === F.p1 && e.agenda === 2, [e.qprof, e.qdia, e.agenda]);
  await D.evaluate(() => $('#btn-dia-hoy').click()); await D.waitForTimeout(300); e = await estado(D);
  OK('el «Hoy» viejo de la Agenda (oculto) sigue vivo y la barra lo sigue', e.qdia === hoy && e.texto === await D.evaluate(() => mdFeTexto(hoyISO())));
  await D.click('#md-fe-cal'); await D.waitForTimeout(200);
  const calA = await D.evaluate(() => [...document.querySelectorAll('#md-fe-pop .md-fe-d.con')].map(x => x.getAttribute('data-f')).sort());
  OK('el calendario también se abre en la Agenda, con sus puntitos', JSON.stringify(calA) === JSON.stringify([F.m2, hoy, F.p1, F.p3].sort()), calA);
  await D.click('#md-fe-pop .md-fe-d[data-f="' + F.p3 + '"]'); await D.waitForTimeout(300);
  await D.click('#md-fe .md-fe-doc[data-prof="Dra. Mirna"]'); await D.waitForTimeout(300);
  await D.click('nav button[data-v="midia"]'); await D.waitForTimeout(500); e = await estado(D);
  OK('de vuelta en Mi día: el día y la doctora elegidos en la Agenda se mantienen', e.en === 'midia' && e.mdia === F.p3 && e.mprof === 'Dra. Mirna' && e.lista === 1, [e.mdia, e.mprof, e.lista]);
  /* se recuerdan en este aparato */
  const pref = await D.evaluate(() => mdPref('FECHA'));
  OK('quedan guardados con mdPref', pref && pref.dia === F.p3 && pref.prof === 'Dra. Mirna' && pref.t === hoy, pref);
  await D.reload(); await D.waitForTimeout(2200); e = await estado(D);
  OK('al recargar siguen el mismo día y la misma doctora', e.mdia === F.p3 && e.mprof === 'Dra. Mirna' && e.qdia === F.p3 && e.qprof === 'Dra. Mirna', [e.mdia, e.mprof, e.qdia, e.qprof]);
  OK('si lo guardado es de otro día, arranca en hoy', await D.evaluate(() => { mdPref('FECHA', { dia: '2026-10-02', prof: '', t: '2026-10-01' }); $('#m-dia').value = ''; $('#q-dia').value = ''; return !mdFeArrancar() || true; }) && await D.evaluate(() => $('#m-dia').value === hoyISO() && $('#q-dia').value === hoyISO()));
  /* en el celular se apila y los chips se deslizan */
  await D.setViewportSize({ width: 390, height: 844 }); await D.waitForTimeout(400);
  await D.evaluate(() => { show('midia'); mdFeFijar(hoyISO(), ''); }); await D.waitForTimeout(300);
  const cel = await D.evaluate(() => { const b = $('#md-fe'), d = $('#md-fe-docs'); return { col: getComputedStyle(b).flexDirection, ov: getComputedStyle(d).overflowX, wrap: getComputedStyle(d).flexWrap, ancho: b.scrollWidth <= b.clientWidth + 1, pagina: document.documentElement.scrollWidth <= 390 }; });
  OK('en 390 px la barra se apila, los chips scrollean horizontal y nada desborda', cel.col === 'column' && cel.ov === 'auto' && cel.wrap === 'nowrap' && cel.ancho && cel.pagina, cel);
  if (process.env.SHOT_CEL) { await D.click('#md-fe-cal'); await D.waitForTimeout(250); const bb = await D.locator('#v-midia .card').first().boundingBox(); await D.screenshot({ path: process.env.SHOT_CEL, clip: { x: 0, y: Math.max(0, bb.y - 8), width: 390, height: bb.height + 420 } }); await D.click('#md-fe-cal'); }
  await D.context().close();

  if (SPA) {
    /* la doctora entra con su clave: ve solo lo suyo y no puede elegir a otra */
    const S = await abrir('fe-shirley-1');
    await S.evaluate(() => show('midia')); await S.waitForTimeout(400); e = await estado(S);
    OK('doctora (Spa): un solo chip fijo con su nombre y sus citas, sin «Todas»', await S.evaluate(() => ROL === 'doctora') && e.chips.length === 1 && e.chips[0][0] === 'Dra. Shirley' && e.chips[0][3] === 'SPAN' && e.chips[0][1] === 1 && e.mprof === 'Dra. Shirley' && await S.evaluate(() => $('#m-prof').disabled), e.chips);
    await S.click('#md-fe .md-fe-doc'); await S.waitForTimeout(200); e = await estado(S);
    OK('tocar el chip no cambia nada', e.mprof === 'Dra. Shirley' && e.lista === 1);
    await S.click('#md-fe-manana'); await S.waitForTimeout(300); e = await estado(S);
    OK('▶ le muestra su mañana', e.mdia === F.p1 && e.lista === 1 && /Fe Manana Shirley/.test(await S.evaluate(() => $('#m-lista').innerText)));
    await S.click('nav button[data-v="cita"]'); await S.waitForTimeout(500); e = await estado(S);
    OK('en la Agenda sigue clavada en ella, mismo día', e.qprof === 'Dra. Shirley' && e.qdia === F.p1 && e.chips.length === 1 && e.agenda === 1 && await S.evaluate(() => $('#q-filtro-prof').disabled), [e.qprof, e.qdia]);
    await S.context().close();
  } else {
    /* el equipo (recepción) de Cosmetic: maneja la barra entera */
    const E = await abrir('fe-equipo-1');
    await E.evaluate(() => show('midia')); await E.waitForTimeout(400); e = await estado(E);
    OK('equipo (Cosmetic): entra con acceso completo y ve todos los chips', await E.evaluate(() => ROL === 'equipo') && e.chips.length >= 4 && chip(e, '')[2] && chip(e, '')[1] === 5, e.chips);
    await E.click('#md-fe .md-fe-doc[data-prof="Dra. Brenda"]'); await E.waitForTimeout(300); e = await estado(E);
    OK('elige a Brenda y Mi día filtra', e.mprof === 'Dra. Brenda' && e.lista === 1 && /Fe Hoy Brenda/.test(await E.evaluate(() => $('#m-lista').innerText)));
    await E.click('#md-fe-manana'); await E.click('nav button[data-v="cita"]'); await E.waitForTimeout(500); e = await estado(E);
    OK('y en la Agenda sigue Brenda, mañana', e.qprof === 'Dra. Brenda' && e.qdia === F.p1 && e.agenda === 1, [e.qprof, e.qdia]);
    await E.context().close();
  }
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
