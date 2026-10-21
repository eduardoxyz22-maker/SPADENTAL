/* Recordatorios más limpio y la conexión como puntito (MODERNO · parte 92-recordatorios-conexion).
   (A) En 🔔 Recordatorios la fila #seg-rem y el select «Ver de» quedan ocultos (siguen mandando): las tarjetas
       son los filtros, «Mostrando … ✕» dice qué se ve, lo que no tiene tarjeta queda en botoncitos y las
       doctoras son chips con su color. Tocar tiene que dar EXACTAMENTE la misma lista que el radio/select viejo.
   (B) La franja #conn-banner de rutina no se ve: en el encabezado hay una pastilla verde/ámbar/roja con un
       globito. Los avisos que no son de rutina siguen en la franja.
   Chromium real, .gs real en memoria, datos ficticios. Sin red real.
   Uso: PANEL=spa|cos node -r ./netguard.js e2e-md-recordatorios.js   (SHOT=<carpeta> guarda capturas) */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const fs = require('fs');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const SHOT = process.env.SHOT || '', SUF = SPA ? 'spa' : 'cos';
if (SHOT) fs.mkdirSync(SHOT, { recursive: true });
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(78), x === undefined ? '' : JSON.stringify(x).slice(0, 400)); };
const dormir = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('rc-duena-1'); v.equipo = server.ctx.shaHex('rc-equipo-1');
  v.prof['Dra. Shirley'] = server.ctx.shaHex('rc-shirley-1'); server.ctx.guardarVerif(v);
  let caido = false, demora = 0;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const abrir = async (clave, w, h) => {
    const ctx = await b.newContext({ viewport: { width: w || 1366, height: h || 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) {
        if (caido) return r.abort('internetdisconnected');
        const body = JSON.parse(r.request().postData() || '{}');
        if (demora) await dormir(demora);
        if (caido) return r.abort('internetdisconnected');
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(body)) }); }
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
    await page.clock.install({ time: new Date('2026-10-21T22:20:00Z') });
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.fill('#gate-pass', clave); await page.click('#gate-btn'); await page.waitForTimeout(2000);
    /* sin el grito del anuncio ni globitos de Sonri tapando */
    await page.evaluate(() => { try { anuncioGritoCerrar(); } catch (e) {} });
    return page;
  };
  /* lo que muestra la lista (títulos de grupo y pacientes): la comparación de «filtra igual» */
  const lista = pg => pg.evaluate(() => [...document.querySelectorAll('#rem-list > h3, #rem-list .rem .who, #rem-list > .empty')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
  const radio = async (pg, val) => { await pg.evaluate(val => { const i = document.querySelector('#seg-rem input[value="' + val + '"]'); if (!i.checked) { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); } }, val); await pg.waitForTimeout(250); };
  const estado = pg => pg.evaluate(() => ({ f: getRadio('remf'), prof: $('#rem-prof').value,
    on: [...document.querySelectorAll('#v-agenda .kpi.md-rk.md-rk-on')].map(k => k.id),
    bar: ($('#md-rf-bar') || {}).innerText || '', x: !!document.querySelector('#md-rf-bar .md-rf-x') }));
  /* captura del encabezado (sin el foco del teclado encima) */
  const foto = async (pg, nombre, w, h) => { if (!SHOT) return; await pg.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await pg.screenshot({ path: path.join(SHOT, nombre), clip: { x: 0, y: 0, width: w, height: h } }); };
  const visible = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);

  /* ---------- la dueña siembra un poco de todo ---------- */
  const D = await abrir('rc-duena-1');
  await D.evaluate(() => {
    let i = 0;
    const fila = (pac, dias, prof, estado, extra) => { const r = normalize(Object.assign({ id: uid(), fecha: addDias(hoyISO(), dias), hora: '10:00', paciente: pac, profesional: prof, estado: estado || 'Agendada', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Programada', celular: '7006' + (i++), servicios: [], total: 0, acuenta: 0, saldo: 0, pagos: [], ts: new Date().toISOString() }, extra || {})); DATA.push(r); queue('save', r, null); };
    fila('Rc Vencida Mirna', -2, 'Dra. Mirna'); fila('Rc Hoy Shirley', 0, 'Dra. Shirley'); fila('Rc Hoy Brenda', 0, 'Dra. Brenda');
    fila('Rc Tres Brenda', 3, 'Dra. Brenda'); fila('Rc Cinco Shirley', 5, 'Dra. Shirley'); fila('Rc Doce Mirna', 12, 'Dra. Mirna');
    const at = (pac, dias, prof, total, pago) => fila(pac, dias, prof, 'Atendido', { origen: 'Espontánea', servicios: [{ nom: 'Limpieza dental', cant: 1, precio: total }], total, acuenta: pago, saldo: total - pago, metodo: pago ? 'Efectivo' : '', pagos: pago ? [{ metodo: 'Efectivo', monto: pago }] : [] });
    at('Rc Saldo Shirley', -10, 'Dra. Shirley', 300, 100); at('Rc Saldo Mirna', -20, 'Dra. Mirna', 250, 50);
    at('Rc Dormido Mirna', -260, 'Dra. Mirna', 150, 150); at('Rc Dormido Shirley', -300, 'Dra. Shirley', 150, 150);
    saveLocal(); return flushQueue(); });
  await D.waitForTimeout(1200);
  await D.evaluate(() => show('agenda')); await D.waitForTimeout(700);

  /* ---------- (A) Recordatorios ---------- */
  OK('la fila de botones #seg-rem quedó oculta (sigue en el DOM)', !(await visible(D, '#seg-rem')) && await D.evaluate(() => !!$('#seg-rem') && $$('#seg-rem input').length >= 9));
  OK('el select «Ver de» quedó oculto y aparecen los chips de doctoras', !(await visible(D, '#rem-prof')) && await visible(D, '#md-rf-docs') && await visible(D, '#md-rf-bar'));
  const ids = await D.evaluate(() => Object.keys(MD_RK).filter(id => $('#' + id)));
  OK('las 8 tarjetas están y son botones', ids.length === 8 && await D.evaluate(ids => ids.every(id => $('#' + id).getAttribute('role') === 'button' && $('#' + id).getAttribute('data-md-rf')), ids), ids);
  if (SHOT) await D.screenshot({ path: path.join(SHOT, 'rec-' + SUF + '-compu-inicio.png') });

  const titulos = {};
  for (const id of ids) {
    await radio(D, 'todos');
    await D.click('#' + id); await D.waitForTimeout(450);
    const s1 = await estado(D), l1 = await lista(D);
    const f = await D.evaluate(id => MD_RK[id][2], id);
    const t = await D.evaluate(id => $('#' + id + ' .k').textContent.trim(), id); titulos[id] = t;
    await radio(D, 'todos'); await radio(D, f); const l2 = await lista(D);
    OK('tarjeta ' + id + ' → «' + f + '»: misma lista que el radio, remarcada sola y «Mostrando ' + t + '»',
      s1.f === f && l1 === l2 && l1.length > 0 && s1.on.length === 1 && s1.on[0] === id && /Mostrando/.test(s1.bar) && s1.bar.includes(t) && s1.x, { f: s1.f, on: s1.on, bar: s1.bar.slice(0, 80), igual: l1 === l2 });
  }
  /* tocarla de nuevo y la ✕ vuelven a Todos */
  await radio(D, 'todos'); const lTodos = await lista(D);
  await D.click('#k-sem'); await D.waitForTimeout(350);
  if (SHOT) { await D.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await D.waitForTimeout(200); await D.screenshot({ path: path.join(SHOT, 'rec-' + SUF + '-compu.png') }); }
  await D.click('#k-sem'); await D.waitForTimeout(350); let s = await estado(D);
  const lOtraVez = await lista(D);
  OK('tocar la misma tarjeta otra vez → Todos (nada remarcado)', s.f === 'todos' && s.on.length === 0 && /Mostrando\s+todo/.test(s.bar) && lOtraVez === lTodos, [s, lOtraVez === lTodos ? '' : [lOtraVez, lTodos]]);
  await D.click('#k-saldos'); await D.waitForTimeout(350);
  await D.click('#md-rf-bar .md-rf-x'); await D.waitForTimeout(350); s = await estado(D);
  OK('la ✕ de «Mostrando» → Todos, misma lista que el radio «Todos»', s.f === 'todos' && s.on.length === 0 && !s.x && await lista(D) === lTodos, s);
  /* el arranque de siempre (Citas): las tres tarjetas de citas remarcadas; tocar una la elige sola */
  await radio(D, 'citas'); s = await estado(D);
  OK('con «Citas» elegido de otra forma, las tres tarjetas de citas quedan remarcadas', s.on.sort().join() === 'k-hoy,k-sem,k-venc' && /Citas/.test(s.bar), s.on);
  await D.click('#k-venc'); await D.waitForTimeout(350); s = await estado(D);
  OK('tocar «Citas vencidas» la deja sola remarcada (sigue en Citas)', s.f === 'citas' && s.on.join() === 'k-venc' && s.bar.includes(titulos['k-venc']), s);

  /* lo que no tiene tarjeta, a mano */
  const sinT = await D.evaluate(() => { const con = {}; Object.keys(MD_RK).forEach(id => { if ($('#' + id)) con[MD_RK[id][2]] = 1; }); return $$('#seg-rem input').map(i => i.value).filter(v => !con[v]); });
  OK('las opciones sin tarjeta son «Sin volver», «Cuotas vencidas» y «Todos»', sinT.sort().join() === 'cuotas,dormidos,todos', sinT);
  for (const val of sinT) {
    await radio(D, val === 'todos' ? 'citas' : 'todos');
    OK('«' + val + '» está a la vista', await visible(D, '#md-rf-bar [data-rf="' + val + '"]'));
    await D.click('#md-rf-bar [data-rf="' + val + '"]'); await D.waitForTimeout(350);
    const s1 = await estado(D), l1 = await lista(D);
    await radio(D, val === 'todos' ? 'citas' : 'todos'); await radio(D, val);
    OK('botoncito «' + val + '» filtra igual que el radio', s1.f === val && l1 === await lista(D) && s1.on.length === 0, { f: s1.f });
  }
  const nDorm = await D.evaluate(() => +((document.querySelector('#md-rf-bar [data-rf="dormidos"] em') || {}).textContent));
  await radio(D, 'dormidos');
  OK('«Sin volver» dice cuántos hay (como la lista)', nDorm === await D.evaluate(() => $$('#rem-list .rem').length) && nDorm >= 2, nDorm);
  const todas = await D.evaluate(() => { const con = {}; Object.keys(MD_RK).forEach(id => { if ($('#' + id)) con[MD_RK[id][2]] = 1; }); $$('#md-rf-bar [data-rf]').forEach(b => { con[b.getAttribute('data-rf')] = 1; }); return $$('#seg-rem input').every(i => con[i.value]); });
  OK('ninguna opción de #seg-rem quedó inalcanzable', todas);

  /* doctoras: chips con su color que manejan el select oculto */
  await radio(D, 'todos');
  const chips = await D.evaluate(() => [...document.querySelectorAll('#md-rf-docs .md-fe-doc')].map(c => [c.getAttribute('data-prof'), c.tagName, c.classList.contains('on'), (c.querySelector('i') || {}).style ? c.querySelector('i').style.background : '']));
  const profs = await D.evaluate(() => CFG.prof.slice());
  OK('chips: «Todas» (elegida) + cada doctora, con el mismo color que en Mi día/Agenda', chips[0][0] === '' && chips[0][2] && chips.length === profs.length + 1 &&
    await D.evaluate(() => [...document.querySelectorAll('#md-rf-docs .md-fe-doc[data-prof]:not([data-prof=""]) i')].every(i => { const p = i.parentNode.getAttribute('data-prof'); const t = document.createElement('i'); t.style.background = mdFeColor(p); return i.style.background === t.style.background; })), chips.map(c => c[0]));
  await D.click('#md-rf-docs .md-fe-doc[data-prof="Dra. Shirley"]'); await D.waitForTimeout(400);
  let e1 = await estado(D); const lChip = await lista(D);
  await D.click('#md-rf-docs .md-fe-doc[data-prof=""]'); await D.waitForTimeout(300);
  await D.evaluate(() => { $('#rem-prof').value = 'Dra. Shirley'; $('#rem-prof').dispatchEvent(new Event('change', { bubbles: true })); }); await D.waitForTimeout(400);
  const lSel = await lista(D);
  OK('el chip de Shirley escribe el select y filtra igual que el select', e1.prof === 'Dra. Shirley' && lChip === lSel && /Rc Saldo Shirley/.test(lChip) && !/Rc Saldo Mirna/.test(lChip), { prof: e1.prof, igual: lChip === lSel });
  OK('y el chip queda marcado cuando se elige con el select', await D.evaluate(() => $('#md-rf-docs .md-fe-doc[data-prof="Dra. Shirley"]').classList.contains('on') && !$('#md-rf-docs .md-fe-doc[data-prof=""]').classList.contains('on')));
  await D.click('#k-saldos'); await D.waitForTimeout(350); const lSalShi = await lista(D);
  OK('chip de doctora + tarjeta se combinan (saldos solo de Shirley)', /Rc Saldo Shirley/.test(lSalShi) && !/Rc Saldo Mirna/.test(lSalShi), lSalShi);
  await D.click('#md-rf-docs .md-fe-doc[data-prof=""]'); await D.waitForTimeout(300);
  OK('«Todas» vuelve a todas', (await estado(D)).prof === '' && /Rc Saldo Mirna/.test(await lista(D)));

  /* ---------- (B) la conexión como puntito ---------- */
  await D.evaluate(() => show('midia')); await D.waitForTimeout(300);
  await D.evaluate(() => pullServer()); await D.waitForTimeout(500);
  const pt = () => D.evaluate(() => { const p = $('#md-pt'), cb = $('#conn-banner'); return { vis: !!p && !p.hidden && p.getBoundingClientRect().width > 0, c: p ? p.className : '', t: p ? p.textContent.trim() : '',
    franja: !!cb && getComputedStyle(cb).display !== 'none' && cb.getBoundingClientRect().height > 0, banner: cb ? (cb.querySelector('.banner') || {}).className || '' : '', texto: cb ? cb.innerText || cb.textContent : '' }; });
  let p = await pt();
  OK('verde «Al día · HH:MM» en el encabezado', p.vis && /md-pt-ok/.test(p.c) && /^Al día · \d\d:\d\d$/.test(p.t), p);
  OK('la franja de rutina no se ve (pero sigue en el DOM con su texto)', !p.franja && /banner conn/.test(p.banner) && /Al día con la hoja/.test(await D.locator('.banner.conn').innerText()), p);
  OK('la pastilla está en el encabezado oscuro, en la línea de la fecha', await D.evaluate(() => { const p = $('#md-pt'), l = $('#md-linea'); const a = p.getBoundingClientRect(), c = l.getBoundingClientRect(); return !!p.closest('header .hd') && Math.abs((a.top + a.bottom) / 2 - (c.top + c.bottom) / 2) < 8 && a.left > c.left; }));
  await D.click('#md-pt'); await D.waitForTimeout(250);
  const globo = await D.evaluate(() => { const g = $('#md-pt-globo'); return g && !g.hidden ? g.innerText : ''; });
  OK('tocarla abre el globito con el texto completo y la hora del último refresco', /Conectado a la hoja de Google · lo que cargues se ve en todos los dispositivos/.test(globo) && /Último refresco con la hoja: \d\d:\d\d/.test(globo) && !/Reintentar/.test(globo), globo);
  await foto(D, 'hd-' + SUF + '-compu-globo.png', 1366, 330);
  await D.keyboard.press('Escape'); await D.waitForTimeout(150);
  OK('Esc lo cierra', await D.evaluate(() => $('#md-pt-globo').hidden));
  await foto(D, 'hd-' + SUF + '-compu-verde.png', 1366, 240);

  /* algo en la cola: ámbar «Subiendo 1…», sin franja mientras sube normal */
  demora = 2500;
  await D.evaluate(() => { const r = normalize({ id: uid(), fecha: hoyISO(), hora: '17:00', paciente: 'Rc Sube Uno', profesional: 'Dra. Mirna', estado: 'Agendada', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Programada', celular: '70069990', servicios: [], total: 0, acuenta: 0, saldo: 0, pagos: [], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); saveLocal(); flushQueue(); });
  await D.waitForTimeout(500); p = await pt();
  OK('con cola: ámbar «Subiendo 1…»', /md-pt-am/.test(p.c) && p.t === 'Subiendo 1…', p);
  OK('y mientras sube normal, la franja no salta', !p.franja, p.banner);
  await foto(D, 'hd-' + SUF + '-compu-ambar.png', 1366, 240);
  await D.waitForTimeout(3000); p = await pt(); demora = 0;
  OK('subió: vuelve a verde', /md-pt-ok/.test(p.c) && /^Al día/.test(p.t) && !p.franja, p);

  /* servidor caído: lo que no sube queda en espera; pasada la gracia sale la franja de siempre con «Reintentar» */
  caido = true;
  await D.evaluate(() => { const r = normalize({ id: uid(), fecha: hoyISO(), hora: '17:30', paciente: 'Rc Sube Dos', profesional: 'Dra. Mirna', estado: 'Agendada', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Programada', celular: '70069991', servicios: [], total: 0, acuenta: 0, saldo: 0, pagos: [], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); saveLocal(); return flushQueue(); });
  await D.waitForTimeout(300); p = await pt();
  OK('no subió: sigue ámbar «Subiendo 1…»', /md-pt-am/.test(p.c) && p.t === 'Subiendo 1…', p);
  await D.clock.runFor(7000); await D.waitForTimeout(200); p = await pt();
  OK('si no sube, la franja de siempre aparece con «Reintentar ahora»', p.franja && /banner pend/.test(p.banner) && /sin subir/.test(p.texto) && await visible(D, '#conn-banner .banner.pend button'), p);
  await D.evaluate(() => pullServer()); await D.waitForTimeout(500); p = await pt();
  OK('sin respuesta de la hoja: roja «Sin internet · 1 en espera»', /md-pt-ro/.test(p.c) && p.t === 'Sin internet · 1 en espera' && p.franja, p);
  await foto(D, 'hd-' + SUF + '-compu-roja.png', 1366, 300);
  await D.click('#md-pt'); await D.waitForTimeout(250);
  const g2 = await D.evaluate(() => $('#md-pt-globo').innerText);
  OK('el globito dice lo que pasa y ofrece «Reintentar»', /sin subir/.test(g2) && await visible(D, '#md-pt-reint'), g2);
  await foto(D, 'hd-' + SUF + '-compu-roja-globo.png', 1366, 360);
  caido = false;
  await D.click('#md-pt-reint'); await D.waitForTimeout(3500); p = await pt();
  OK('«Reintentar» (reintentarCola) sube la cola y trae lo último: verde otra vez', /md-pt-ok/.test(p.c) && /^Al día/.test(p.t) && !p.franja && await D.evaluate(() => pend().length === 0), p);
  OK('lo que estaba en espera llegó a la hoja', Object.keys(server.registros).map(k => server.registros[k].paciente).includes('Rc Sube Dos'), Object.keys(server.registros).length);
  await D.keyboard.press('Escape');
  /* un error sin cola: la franja de siempre con «Sin respuesta de la hoja» */
  caido = true; await D.evaluate(() => pullServer()); await D.waitForTimeout(500); p = await pt();
  OK('caída sin cola: roja «Sin internet» y la franja de error sigue saliendo', /md-pt-ro/.test(p.c) && p.t === 'Sin internet' && p.franja && /Sin respuesta de la hoja/.test(p.texto), p);
  caido = false; await D.evaluate(() => pullServer()); await D.waitForTimeout(500); p = await pt();
  OK('vuelve la hoja: verde y la franja se va', /md-pt-ok/.test(p.c) && !p.franja, p);
  /* el aparato sin internet */
  await D.context().setOffline(true); await D.waitForTimeout(300); p = await pt();
  OK('aparato sin internet (offline): roja «Sin internet»', /md-pt-ro/.test(p.c) && /^Sin internet/.test(p.t), p);
  await D.context().setOffline(false); await D.waitForTimeout(300); p = await pt();
  OK('vuelve internet: verde', /md-pt-ok/.test(p.c), p);
  /* modo local (sin hoja configurada): la franja de siempre, sin pastilla */
  const local = await D.evaluate(() => { const c = CONNECTED; CONNECTED = false; banner(); const r = { franja: getComputedStyle($('#conn-banner')).display !== 'none', txt: $('#conn-banner').innerText, pt: $('#md-pt').hidden }; CONNECTED = c; banner(); return r; });
  OK('sin hoja configurada (modo local): la franja sale como siempre y la pastilla se esconde', local.franja && /Modo local/.test(local.txt) && local.pt, local);

  /* ---------- celular ---------- */
  await D.setViewportSize({ width: 390, height: 844 }); await D.waitForTimeout(300);
  await D.evaluate(() => { show('agenda'); }); await D.waitForTimeout(500);
  await D.click('#k-sem'); await D.waitForTimeout(400);
  const cel = await D.evaluate(() => { const k = $('#v-agenda .kpis'), d = $('#md-rf-docs'); return { cols: getComputedStyle(k).gridTemplateColumns.split(' ').length, pagina: document.documentElement.scrollWidth <= 390, ov: getComputedStyle(d).overflowX, bar: $('#md-rf-bar').scrollWidth <= $('#md-rf-bar').clientWidth + 1 }; });
  OK('celular: tarjetas de a dos, chips que se deslizan y sin scroll horizontal', cel.cols === 2 && cel.pagina && cel.ov === 'auto' && cel.bar, cel);
  if (SHOT) { await D.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await D.waitForTimeout(200); await D.screenshot({ path: path.join(SHOT, 'rec-' + SUF + '-cel.png') });
    await D.evaluate(() => { const l = $('#md-rf-bar'); window.scrollTo({ top: l.getBoundingClientRect().top + window.pageYOffset - 420, behavior: 'instant' }); }); await D.waitForTimeout(200); await D.screenshot({ path: path.join(SHOT, 'rec-' + SUF + '-cel-2.png') }); }
  await D.evaluate(() => show('midia')); await D.waitForTimeout(300);
  const hdc = await D.evaluate(() => { const p = $('#md-pt').getBoundingClientRect(), h = $('header .hd'), hr = h.getBoundingClientRect(); return { dentro: p.right <= 390 && p.left >= 0 && p.bottom <= hr.bottom && p.top >= hr.top, sinDesborde: h.scrollWidth <= h.clientWidth + 1, pagina: document.documentElement.scrollWidth <= 390, alto: Math.round(hr.height) }; });
  OK('celular: la pastilla entra en el encabezado sin romperlo', hdc.dentro && hdc.sinDesborde && hdc.pagina && hdc.alto < 140, hdc);
  if (SHOT) {
    await D.screenshot({ path: path.join(SHOT, 'hd-' + SUF + '-cel-verde.png'), clip: { x: 0, y: 0, width: 390, height: 260 } });
    await D.click('#md-pt'); await D.waitForTimeout(250);
    await D.screenshot({ path: path.join(SHOT, 'hd-' + SUF + '-cel-globo.png'), clip: { x: 0, y: 0, width: 390, height: 420 } });
    await D.keyboard.press('Escape');
    caido = true; await D.evaluate(() => pullServer()); await D.waitForTimeout(500);
    await D.screenshot({ path: path.join(SHOT, 'hd-' + SUF + '-cel-roja.png'), clip: { x: 0, y: 0, width: 390, height: 300 } });
    caido = false; await D.evaluate(() => pullServer()); await D.waitForTimeout(400);
  }
  /* Sonri lo enseña */
  const sonri = await D.evaluate(() => {
    const nov = asisNovedades().map(n => n.id), q = t => asisBuscar(t).map(i => ASIS_AYUDA[i].q);
    return { nov, rec: q('cómo filtro los recordatorios con las tarjetas')[0], con: q('qué es el puntito de la conexión arriba')[0], sinInt: q('dice sin internet en espera')[0] }; });
  OK('Sonri trae las dos novedades', sonri.nov.includes('md-rem-tarjetas') && sonri.nov.includes('md-conexion-punto'), sonri.nov);
  OK('y las explica cuando se le pregunta', /tarjetas de Recordatorios/.test(sonri.rec) && /puntito de la conexión/.test(sonri.con) && /puntito de la conexión/.test(sonri.sinInt), sonri);
  await D.evaluate(() => { window.ASIS_PRUEBA = true; asisMontar(); }); await D.waitForTimeout(300);
  await D.evaluate(() => asisVerAyuda(/tarjetas de Recordatorios/)); await D.waitForTimeout(400);
  const ayu = await D.evaluate(() => { const p = $('#asis-panel'); return p && !p.hidden ? p.innerText : ''; });
  OK('la ayuda abierta (en la ventana de Sonri) cuenta lo de «Mostrando» y los botoncitos', /tarjetas de Recordatorios/.test(ayu) && /Mostrando/.test(ayu) && /«También»/.test(ayu), ayu.slice(0, 200));
  await D.evaluate(() => asisVerAyuda(/puntito de la conexión/)); await D.waitForTimeout(300);
  OK('y la del puntito de la conexión', /Sin internet · 3 en espera/.test(await D.evaluate(() => $('#asis-panel').innerText)));
  await D.evaluate(() => { try { asisCerrar(); } catch (e) {} });

  await D.context().close();

  if (SPA) {
    /* la doctora: lo mismo que veía antes (el select fijo en ella) */
    const S = await abrir('rc-shirley-1');
    await S.evaluate(() => show('agenda')); await S.waitForTimeout(600);
    const sd = await S.evaluate(() => ({ rol: ROL, prof: $('#rem-prof').value, dis: $('#rem-prof').disabled, chips: [...document.querySelectorAll('#md-rf-docs .md-fe-doc')].map(c => [c.getAttribute('data-prof'), c.tagName]) }));
    OK('doctora (Spa): un solo chip fijo con su nombre, sin «Todas», el select sigue clavado en ella', sd.rol === 'doctora' && sd.prof === 'Dra. Shirley' && sd.dis && sd.chips.length === 1 && sd.chips[0][0] === 'Dra. Shirley' && sd.chips[0][1] === 'SPAN', sd);
    await S.click('#md-rf-docs .md-fe-doc'); await S.waitForTimeout(200);
    OK('tocar su chip no cambia nada', await S.evaluate(() => $('#rem-prof').value === 'Dra. Shirley'));
    /* «lo mismo que veía antes»: la lista del renderRem original (sin MODERNO) contra la que dejan las tarjetas */
    const antes = async f => { await radio(S, f); return S.evaluate(() => { MD_ORIG.renderRem(); return [...document.querySelectorAll('#rem-list > h3, #rem-list .rem .who, #rem-list > .empty')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' | '); }); };
    for (const id of ['k-venc', 'k-hoy', 'k-sem', 'k-saldos', 'k-ctrl', 'k-presu']) {
      await radio(S, 'todos'); await S.click('#' + id); await S.waitForTimeout(350);
      const l1 = await lista(S), f = (await estado(S)).f;
      const l0 = await antes(f); await S.evaluate(() => renderRem()); await S.waitForTimeout(200);
      OK('doctora: tarjeta ' + id + ' → «' + f + '» = lo que mostraba antes, y nada de otras', l1 === l0 && !/Mirna|Brenda/.test(l1), l1.slice(0, 160));
    }
    await radio(S, 'todos'); const lt = await lista(S), lt0 = await antes('todos');
    OK('doctora: «Todos» igual que antes (sus saldos y sus pacientes sin volver)', lt === lt0 && /Rc Saldo Shirley/.test(lt) && /Rc Dormido Shirley/.test(lt) && !/Mirna|Brenda/.test(lt), lt.slice(0, 200));
    await S.context().close();
  } else {
    const E = await abrir('rc-equipo-1');
    await E.evaluate(() => show('agenda')); await E.waitForTimeout(600);
    const ed = await E.evaluate(() => ({ rol: ROL, dis: $('#rem-prof').disabled, n: document.querySelectorAll('#md-rf-docs button.md-fe-doc').length, nprof: CFG.prof.length }));
    OK('equipo (Cosmetic): ve «Todas» y todas las doctoras, como con el select', ed.rol === 'equipo' && !ed.dis && ed.n === ed.nprof + 1, ed);
    await E.click('#md-rf-docs .md-fe-doc[data-prof="Dra. Shirley"]'); await E.waitForTimeout(350);
    await E.click('#k-saldos'); await E.waitForTimeout(350);
    const le = await lista(E);
    OK('elige a Shirley + «Saldos»: solo lo de Shirley', /Rc Saldo Shirley/.test(le) && !/Mirna|Brenda/.test(le), le.slice(0, 160));
    await E.context().close();
  }
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
