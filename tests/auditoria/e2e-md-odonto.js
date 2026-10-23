/* 🦷 El odontograma con colores en la ficha del paciente: leyenda; piezas «hecho» (visitas atendidas y sesiones
   hechas de un plan), «en el plan» (sesión pendiente de un plan activo, o un recomendado que nombra la pieza),
   «caries / a tratar» y «ausente» marcadas a mano desde la ventana de la pieza; la marca vive en med.odonto de la
   ficha y el servidor la conserva (otro aparato la ve, dos aparatos marcan a la vez, guardar otra cosa de la ficha
   no la borra); quitar la marca; caries + visita posterior → hecho; una doctora no marca piezas de un paciente de
   otra (ni en el panel ni en el servidor); la clave de pauta no recibe las marcas; el formulario de atención sigue
   eligiendo piezas igual (la caries solo como puntito de ayuda); Sonri lo enseña. Chromium real, .gs real en
   memoria, datos ficticios, sin red real.
   Uso: PANEL=spa|cos node -r ./netguard.js e2e-md-odonto.js   (SHOT=carpeta para las capturas) */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const CL = SPA ? 'spa' : 'cos';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const SHOT = process.env.SHOT || '';
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(78), x === undefined ? '' : JSON.stringify(x)); };
const PAC = 'Paciente Odonto Uno', AJENO = 'Paciente Odonto Ajeno', DRA = 'Dra. Shirley', OTRA = 'Dra. Brenda';
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('od-duena-1'); v.equipo = server.ctx.shaHex('od-equipo-1');
  v.prof[DRA] = server.ctx.shaHex('od-doc-a'); v.prof[OTRA] = server.ctx.shaHex('od-doc-b'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  /* cada contexto es otro aparato, con su propio localStorage */
  const abrir = async (clave, vp) => {
    const ctx = await b.newContext({ viewport: vp || { width: 1366, height: 900 } });
    const P = await ctx.newPage();
    P.on('pageerror', e => errs.push(e.message)); P.on('dialog', d => d.accept());
    await P.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'), { panel: true })) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await P.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
    await P.clock.install({ time: new Date('2026-10-21T13:00:00Z') });
    await P.goto('file://' + FILE); await P.waitForTimeout(800);
    await P.fill('#gate-pass', clave); await P.click('#gate-btn'); await P.waitForTimeout(2000);
    await P.evaluate(() => { try { asisTourFin(); } catch (e) {} try { closeModal(); } catch (e) {} window.TOASTS = []; const t = toast; toast = function (m) { TOASTS.push(String(m)); return t.apply(this, arguments); }; });
    return P;
  };
  const ficha = async (P, n) => { await P.evaluate((n) => { closeModal(); verPaciente(n); }, n || PAC); await P.waitForTimeout(250); };
  /* el estado de cada pieza en la ficha abierta: {16:'c', 46:'h', …} y si se pueden tocar */
  const piezas = (P) => P.evaluate(() => { const o = {}, todas = []; document.querySelectorAll('#modal .odon .di').forEach(d => {
    const c = d.querySelector('.num').textContent, m = /md-odo-([hpca])\b/.exec(d.className); if (m) o[c] = m[1];
    todas.push({ c, dis: d.disabled, on: d.getAttribute('onclick') || '' }); }); return { est: o, todas }; });
  const pieza = async (P, c) => { await P.click('#modal .odon .di[onclick="verDientePac(\'' + c + '\')"]'); await P.waitForTimeout(250); return P.locator('#modal').innerText(); };
  const srvOdo = () => { const p = server.pacientes[PAC.toLowerCase()]; return (p && p.med && p.med.odonto) || {}; };
  /* para las capturas: sin globitos ni avisos encima */
  const limpio = (P) => P.evaluate(() => { if (!document.getElementById('od-sin-avisos')) document.head.insertAdjacentHTML('beforeend', '<style id="od-sin-avisos">#toast,#asis-globo{visibility:hidden!important}</style>'); });
  const esperar = async (P) => { await P.evaluate(() => flushQueue()); await P.waitForTimeout(900); };

  /* ---------- datos ficticios: dos visitas con piezas, un plan con dos sesiones pendientes, un recomendado, una cita ---------- */
  const D = await abrir('od-duena-1');
  await D.evaluate(({ PAC, AJENO, DRA, OTRA }) => {
    const at = (pac, fecha, prof, srv, o) => { const tot = srv.reduce((a, s) => a + s.precio, 0); const r = normalize(Object.assign({ id: uid(), fecha, hora: '10:00', paciente: pac, profesional: prof, estado: 'Atendido', tipo: 'Recurrente', canal: CFG.canales[0], origen: 'Espontánea', celular: '70011223',
      servicios: srv.map(s => Object.assign({ cant: 1 }, s)), total: tot, acuenta: tot, saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: tot }], ts: new Date(Date.now() - 86400000 * 30).toISOString() }, o || {})); DATA.push(r); queue('save', r, null); return r; };
    at(PAC, '2026-09-06', DRA, [{ nom: 'Endodoncia', det: '', precio: 900, piezas: ['46'] }]);
    at(PAC, '2026-10-12', DRA, [{ nom: 'Restauración de caries', det: 'pieza 15', precio: 260 }], { presu: [{ nom: 'Carilla pieza 11', monto: 300 }] });
    at(PAC, '2026-10-27', DRA, [], { estado: 'Agendada', total: 0, acuenta: 0, pagos: [], metodo: '', hora: '16:00' });
    at(AJENO, '2026-10-10', OTRA, [{ nom: 'Resina', det: '', precio: 200, piezas: ['21'] }]);
    const f = pacDe(PAC); f.nombre = PAC;
    f.planes.push(planNormalize({ nombre: 'Rehabilitación', total: 1000, prof: DRA, fecha: '2026-10-12', sesiones: [{ desc: 'Corona de zirconio pieza 36', precio: 800 }, { desc: 'Resina pieza 24', precio: 200 }] }));
    savePac(f); saveLocal(); return flushQueue(); }, { PAC, AJENO, DRA, OTRA });
  await D.waitForTimeout(1500);
  OK('los datos de prueba están en la hoja (visitas y ficha con plan)', !!server.pacientes[PAC.toLowerCase()] && server.pacientes[PAC.toLowerCase()].planes.length === 1);

  /* ---------- la ficha: leyenda y colores ---------- */
  await ficha(D);
  const leg = await D.evaluate(() => { const l = $('#md-odo-leg'), od = $('#modal .odon'); return l ? { txt: l.innerText.replace(/\s+/g, ' '), antes: !!(l.compareDocumentPosition(od) & Node.DOCUMENT_POSITION_FOLLOWING), ayuda: l.previousElementSibling.innerText } : null; });
  OK('la leyenda aparece arriba del odontograma con los 4 estados', leg && leg.antes && /Hecho/.test(leg.txt) && /En el plan/.test(leg.txt) && /Caries \/ a tratar/.test(leg.txt) && /Ausente/.test(leg.txt), leg);
  OK('el texto de ayuda dice que se puede marcar caries o ausente', leg && /marcar caries o ausente/.test(leg.ayuda), leg && leg.ayuda);
  let pz = await piezas(D);
  OK('las piezas con visita atendida salen «hecho» (46 con piezas, 15 escrita en el detalle)', pz.est['46'] === 'h' && pz.est['15'] === 'h', pz.est);
  OK('las piezas de las sesiones pendientes del plan salen «en el plan» (36 y 24)', pz.est['36'] === 'p' && pz.est['24'] === 'p', pz.est);
  OK('el recomendado sin respuesta que nombra la pieza 11 también sale «en el plan»', pz.est['11'] === 'p', pz.est);
  OK('las demás no tienen color (18, 21)', !pz.est['18'] && !pz.est['21']);
  OK('en la ficha todas las piezas se pueden tocar, aunque no tengan nada', pz.todas.length === 32 && pz.todas.every(t => !t.dis && t.on === "verDientePac('" + t.c + "')"), pz.todas.filter(t => t.dis).length);
  OK('la leyenda cuenta: Hecho 2 · En el plan 3', /Hecho 2/.test(leg.txt) && /En el plan 3/.test(leg.txt), leg.txt);

  /* ---------- la ventana de una pieza ---------- */
  let txt = await pieza(D, '36');
  OK('pieza 36: «En el plan», nombre de la pieza, la sesión pendiente y la cita del 27/10', /Pieza 36/.test(txt) && /En el plan/.test(txt) && /primer molar inferior izquierdo/.test(txt) && /Corona de zirconio pieza 36/.test(txt) && /Rehabilitación, sesión 1/.test(txt) && /cita el 27\/10/.test(txt), txt.slice(0, 300));
  await ficha(D); txt = await pieza(D, '46');
  OK('pieza 46: lo hecho con fecha y doctora (Endodoncia · 06/09 · ' + DRA + ')', /Hecho/.test(txt) && /Endodoncia/.test(txt) && /06\/09/.test(txt) && txt.includes(DRA) && /No figura en ninguna sesión pendiente/.test(txt), txt.slice(0, 300));
  OK('…con los botones «Marcar caries / a tratar» y «Marcar ausente», sin «Quitar marca»', await D.locator('#modal .md-odo-bc').count() === 1 && await D.locator('#modal .md-odo-ba').count() === 1 && await D.locator('#modal .md-odo-bq').count() === 0);
  await ficha(D); txt = await pieza(D, '11');
  OK('pieza 11: el recomendado («Recomendado: Carilla pieza 11»)', /Recomendado: Carilla pieza 11/.test(txt), txt.slice(0, 300));

  /* ---------- marcar caries (16) y ausente (48) desde la ventana ---------- */
  await ficha(D); await pieza(D, '16');
  await D.click('#modal .md-odo-bc'); await D.waitForTimeout(300);
  txt = await D.locator('#modal').innerText();
  OK('marcar caries: la ventana queda en la pieza, dice «Caries / a tratar», quién y cuándo, y aparece «Quitar marca»', /Pieza 16/.test(txt) && /Caries \/ a tratar/.test(txt) && /Marcada caries \/ a tratar/.test(txt) && /21\/10 · Dueña/.test(txt) && await D.locator('#modal .md-odo-bq').count() === 1, txt.slice(0, 260));
  OK('avisa «Pieza 16 marcada: caries / a tratar»', await D.evaluate(() => TOASTS.some(t => /Pieza 16 marcada: caries/.test(t))));
  const loc = await D.evaluate((n) => pacDe(n).med.odonto, PAC);
  OK('en la ficha: med.odonto = {"16": {e:"caries", f:"2026-10-21", por, ts}}', loc && loc['16'] && loc['16'].e === 'caries' && loc['16'].f === '2026-10-21' && loc['16'].por === 'Dueña' && !!loc['16'].ts, loc);
  if (SHOT) { await D.waitForTimeout(150); await limpio(D); await D.screenshot({ path: path.join(SHOT, 'odonto-' + CL + '-pieza-compu.png') }); }
  await ficha(D); await pieza(D, '48'); await D.click('#modal .md-odo-ba'); await D.waitForTimeout(300);
  await esperar(D);
  let so = srvOdo();
  OK('la hoja (columna _med_json) guarda las dos marcas: 16 caries y 48 ausente', so['16'] && so['16'].e === 'caries' && so['48'] && so['48'].e === 'ausente', so);
  OK('lo demás de la ficha sigue igual (el plan)', server.pacientes[PAC.toLowerCase()].planes.length === 1);
  await ficha(D); pz = await piezas(D);
  OK('en la ficha: 16 rojo (caries) y 48 gris (ausente)', pz.est['16'] === 'c' && pz.est['48'] === 'a', pz.est);

  /* ---------- otro aparato (recepción) las ve iguales; también después de recargar ---------- */
  const E = await abrir('od-equipo-1');
  await ficha(E); pz = await piezas(E);
  OK('otro aparato (recepción) ve 16 caries y 48 ausente', pz.est['16'] === 'c' && pz.est['48'] === 'a' && pz.est['46'] === 'h' && pz.est['36'] === 'p', pz.est);
  await E.reload(); await E.waitForTimeout(1500);
  if (await E.locator('#gate-pass').isVisible()) { await E.fill('#gate-pass', 'od-equipo-1'); await E.click('#gate-btn'); }
  await E.waitForTimeout(1500);
  await E.evaluate(() => { try { asisTourFin(); } catch (e) {} window.TOASTS = []; const t = toast; toast = function (m) { TOASTS.push(String(m)); return t.apply(this, arguments); }; });
  await ficha(E); pz = await piezas(E);
  OK('después de recargar la página (lo guardado en el aparato + la hoja) siguen iguales', pz.est['16'] === 'c' && pz.est['48'] === 'a', pz.est);

  /* ---------- dos aparatos marcan a la vez y otro guarda otra cosa de la ficha: no se pisa ---------- */
  await ficha(E); await pieza(E, '26'); await E.click('#modal .md-odo-bc'); await E.waitForTimeout(200); await esperar(E);
  /* la dueña no refrescó: marca 38 ausente sobre su versión vieja */
  await ficha(D); await pieza(D, '38'); await D.click('#modal .md-odo-ba'); await D.waitForTimeout(200); await esperar(D);
  so = srvOdo();
  OK('dos aparatos sin refrescar: quedan las marcas de los dos (16, 48, 26 de recepción y 38 de la dueña)', so['16'] && so['48'] && so['26'] && so['26'].e === 'caries' && so['26'].por === 'Recepción' && so['38'] && so['38'].e === 'ausente', Object.keys(so));
  await E.evaluate((n) => { const f = pacDe(n); f.med.alergias = 'Penicilina'; savePac(f); }, PAC); await esperar(E);
  so = srvOdo();
  OK('guardar la alergia desde otro aparato (versión sin 38) no borra ninguna marca', server.pacientes[PAC.toLowerCase()].med.alergias === 'Penicilina' && ['16', '48', '26', '38'].every(c => so[c]), Object.keys(so));
  /* el servidor: fusionarFichas (dos filas del mismo paciente) conserva la marca aunque la fila nueva no la traiga */
  const fu = server.ctx.fusionarFichas({ nombre: PAC, med: { alergias: 'x' }, planes: [], ts: '2026-10-21T15:00:00Z' }, { nombre: PAC, med: { odonto: { '17': { e: 'caries', f: '2026-10-01' } } }, planes: [], ts: '2026-10-01T10:00:00Z' });
  OK('servidor: fusionarFichas conserva med.odonto de la fila vieja', fu.med.odonto && fu.med.odonto['17'].e === 'caries');
  const f3 = server.ctx.fusion3({ med: { odonto: { '16': { e: 'caries', f: '1' } } } }, { med: { odonto: { '16': { e: 'caries', f: '1' }, '27': { e: 'ausente', f: '2' } } } }, { med: { odonto: { '16': { e: 'caries', f: '1' }, '13': { e: 'caries', f: '3' } } } }, '', []);
  OK('servidor: fusion3 junta pieza por pieza (27 mío + 13 del otro)', f3.med.odonto['27'] && f3.med.odonto['13'] && f3.med.odonto['16']);
  await D.evaluate(() => pullServer()); await D.waitForTimeout(600);
  await ficha(D); pz = await piezas(D);
  OK('la dueña refresca y ve las 4 marcas', pz.est['16'] === 'c' && pz.est['48'] === 'a' && pz.est['26'] === 'c' && pz.est['38'] === 'a', pz.est);
  if (SHOT) {
    await D.evaluate(() => { const h = [...document.querySelectorAll('#modal h4')].find(x => /^odontograma$/i.test(x.textContent.trim())); h.scrollIntoView({ block: 'center' }); });
    await D.waitForTimeout(200); await limpio(D); await D.screenshot({ path: path.join(SHOT, 'odonto-' + CL + '-ficha-compu.png') });
  }

  /* ---------- quitar una marca ---------- */
  await ficha(E); await E.evaluate(() => pullServer()); await E.waitForTimeout(500); await ficha(E);
  await pieza(E, '48'); await E.click('#modal .md-odo-bq'); await E.waitForTimeout(200);
  OK('«Quitar marca»: la ventana ya no ofrece quitar y avisa', await E.locator('#modal .md-odo-bq').count() === 0 && await E.evaluate(() => TOASTS.some(t => /Marca de la pieza 48 quitada/.test(t))));
  await esperar(E); so = srvOdo();
  OK('en la hoja ya no está la 48 (las otras sí)', !so['48'] && so['16'] && so['26'] && so['38'], Object.keys(so));
  await D.evaluate(() => pullServer()); await D.waitForTimeout(600); await ficha(D); pz = await piezas(D);
  OK('la dueña refresca: 48 sin color', !pz.est['48'] && pz.est['38'] === 'a', pz.est);

  /* ---------- caries + visita: anterior a la marca sigue roja; posterior → hecho ---------- */
  await D.evaluate((n) => { const r = normalize({ id: uid(), fecha: '2026-10-20', hora: '09:00', paciente: n, profesional: 'Dra. Shirley', estado: 'Atendido', tipo: 'Recurrente', canal: CFG.canales[0], origen: 'Espontánea', celular: '70011223',
    servicios: [{ nom: 'Limpieza dental', det: '', cant: 1, precio: 150, piezas: ['16'] }], total: 150, acuenta: 150, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 150 }], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); return flushQueue(); }, PAC);
  await D.waitForTimeout(600); await ficha(D); pz = await piezas(D);
  OK('una visita en la 16 de ANTES de la marca no la trata: sigue caries', pz.est['16'] === 'c', pz.est['16']);
  await D.evaluate((n) => { const r = normalize({ id: uid(), fecha: '2026-10-23', hora: '11:00', paciente: n, profesional: 'Dra. Shirley', estado: 'Atendido', tipo: 'Recurrente', canal: CFG.canales[0], origen: 'Espontánea', celular: '70011223',
    servicios: [{ nom: 'Restauración de caries', det: '', cant: 1, precio: 260, piezas: ['16'] }], total: 260, acuenta: 260, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 260 }], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); return flushQueue(); }, PAC);
  await D.waitForTimeout(600); await ficha(D); pz = await piezas(D);
  OK('caries + visita atendida posterior en esa pieza → se ve «hecho»', pz.est['16'] === 'h', pz.est['16']);
  txt = await pieza(D, '16');
  OK('la ventana cuenta la historia: marcada caries el 21/10 y «Ya se trató: Restauración de caries» el 23/10', /Marcada caries \/ a tratar/.test(txt) && /Ya se trató: Restauración de caries/.test(txt) && /23\/10/.test(txt) && /Volver a marcar caries/.test(txt), txt.slice(0, 400));
  OK('la marca no se borra: queda como historia', (await D.evaluate((n) => pacDe(n).med.odonto['16'].e, PAC)) === 'caries');
  /* el mismo día: marcada a la mañana y tratada en una visita cargada después */
  await ficha(D); await pieza(D, '17'); await D.click('#modal .md-odo-bc'); await D.waitForTimeout(200);
  await D.evaluate((n) => { const r = normalize({ id: uid(), fecha: '2026-10-21', hora: '15:00', paciente: n, profesional: 'Dra. Shirley', estado: 'Atendido', tipo: 'Recurrente', canal: CFG.canales[0], origen: 'Espontánea', celular: '70011223',
    servicios: [{ nom: 'Resina', det: 'pieza 17', cant: 1, precio: 200 }], total: 200, acuenta: 200, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 200 }], ts: new Date(Date.now() + 60000).toISOString() }); DATA.push(r); queue('save', r, null); return flushQueue(); }, PAC);
  await D.waitForTimeout(600); await ficha(D); pz = await piezas(D);
  OK('el mismo día: marcada caries y después una visita en esa pieza → «hecho»', pz.est['17'] === 'h', pz.est['17']);

  /* ---------- la sesión del plan se marca realizada → deja de estar «en el plan» (y queda hecha) ---------- */
  const planId = await D.evaluate((n) => planesDe(n)[0].id, PAC);
  await D.evaluate(({ n, id }) => { closeModal(); atencionDePlan(n, id, 1); }, { n: PAC, id: planId }); await D.waitForTimeout(400);
  await D.evaluate((d) => { const s = $('#ap-prof'); if (s.tagName === 'SELECT') s.value = d; }, DRA);
  await D.click('#ap-ok'); await D.waitForTimeout(1500);
  OK('la sesión 1 del plan quedó hecha', await D.evaluate((n) => planesDe(n)[0].sesiones[0].hecha === true, PAC));
  await ficha(D); pz = await piezas(D);
  OK('la 36 ya no está «en el plan»: queda «hecho» (la sesión realizada); la 24 sigue en el plan', pz.est['36'] === 'h' && pz.est['24'] === 'p', { 36: pz.est['36'], 24: pz.est['24'] });
  txt = await pieza(D, '36');
  OK('la ventana de la 36 muestra la sesión hecha con la fecha de hoy', /Corona de zirconio pieza 36/.test(txt) && /21\/10/.test(txt) && /No figura en ninguna sesión pendiente/.test(txt), txt.slice(0, 300));

  /* ---------- el formulario de atención: elegir piezas sigue igual; la caries marcada, solo como puntito ---------- */
  await D.evaluate((n) => { closeModal(); show('atencion'); clearForm(); $('#f-paciente').value = n; SRV = [{ nom: 'Resina', det: '', cant: 1, precio: 200, lab: '', piezas: [] }]; renderSrv(); abrirPiezas(0); }, PAC);
  await D.waitForTimeout(300);
  const fo = await D.evaluate(() => { const ds = [...document.querySelectorAll('#modal .odon .di')]; return { n: ds.length, on: ds.every(d => d.getAttribute('onclick') === "togglePieza('" + d.querySelector('.num').textContent + "')" && !d.disabled),
    fc: ds.filter(d => /md-odo-fc/.test(d.className)).map(d => d.querySelector('.num').textContent), fa: ds.filter(d => /md-odo-fa/.test(d.className)).map(d => d.querySelector('.num').textContent),
    colores: ds.filter(d => /md-odo-[hpca]\b/.test(d.className)).length, nota: ($('#md-odo-fnota') || {}).innerText || '' }; });
  OK('elegir piezas: 32 piezas, todas con togglePieza como siempre, sin los colores de la ficha', fo.n === 32 && fo.on && fo.colores === 0, fo);
  OK('la caries vigente (26) sale con su puntito y nota; la tratada (16) no; la ausente (38) aparte', fo.fc.join() === '26' && fo.fa.join() === '38' && /Caries marcada en la ficha: 26/.test(fo.nota) && /Ausente: 38/.test(fo.nota), fo);
  await D.click('#modal .odon .di[onclick="togglePieza(\'26\')"]'); await D.waitForTimeout(100);
  await D.click('#modal .odon .di[onclick="togglePieza(\'27\')"]'); await D.waitForTimeout(100);
  await D.click('#modal .odon .di[onclick="togglePieza(\'38\')"]'); await D.waitForTimeout(100);
  await D.click('#modal .odon .di[onclick="togglePieza(\'38\')"]'); await D.waitForTimeout(100);
  const sel = await D.evaluate(() => ({ pz: PZ_SEL.slice(), sel: [...document.querySelectorAll('#modal .odon .di.sel')].map(d => d.querySelector('.num').textContent), txt: $('#pz-elegidas').innerText, punto: !!document.querySelector('#modal .odon .di.sel.md-odo-fc') }));
  OK('tocar 26, 27 y 38 dos veces: elegidas 26 y 27 (la de caries se elige igual)', sel.pz.join() === '26,27' && sel.sel.join() === '26,27' && /Elegidas: 26, 27/.test(sel.txt) && sel.punto, sel);
  await D.click('#modal .btn:has-text("Listo")'); await D.waitForTimeout(200);
  OK('«Listo» deja las piezas en el servicio, como siempre', await D.evaluate(() => SRV[0].piezas.join() === '26,27'));
  await D.evaluate(() => abrirPiezas(0)); await D.waitForTimeout(200);
  OK('al volver a abrir, siguen elegidas 26 y 27', await D.evaluate(() => PZ_SEL.join() === '26,27' && [...document.querySelectorAll('#modal .odon .di.sel')].length === 2));
  await D.evaluate(() => { closeModal(); clearForm(); });

  /* ---------- una doctora: marca a sus pacientes, no a los de otra ---------- */
  const M = await abrir('od-doc-a');
  OK('la doctora entró con su clave', await M.evaluate(() => ROL === 'doctora' && PROF_ACTUAL === 'Dra. Shirley'));
  await ficha(M); pz = await piezas(M);
  OK('la doctora ve los colores de su paciente', pz.est['26'] === 'c' && pz.est['24'] === 'p' && pz.est['46'] === 'h', pz.est);
  await pieza(M, '25'); await M.click('#modal .md-odo-bc'); await M.waitForTimeout(200); await esperar(M);
  so = srvOdo();
  OK('marca caries en la 25 de su paciente y llega a la hoja con su nombre', so['25'] && so['25'].e === 'caries' && so['25'].por === DRA, so['25']);
  const ajeno = await M.evaluate((n) => { TOASTS = []; verDiente(n, '21'); const r = { txt: $('#modal').innerText, bts: document.querySelectorAll('#modal .md-odo-acc button').length, candado: !!$('#modal .md-odo-candado') };
    odoMarcar(n, '21', 'caries'); r.toast = TOASTS.slice(); r.od = pacDe(n).med.odonto || null; r.cola = pend().filter(q => q.action === 'pac' && keyPac(q.rec.nombre) === keyPac(n)).length; return r; }, AJENO);
  OK('paciente de otra doctora: la ventana no tiene botones (🔐) y marcar avisa «es de otra doctora»', ajeno.bts === 0 && ajeno.candado && ajeno.toast.some(t => /otra doctora/.test(t)) && !ajeno.od && ajeno.cola === 0, ajeno);
  const tokM = server.ctx.nuevaSesion({ rol: 'doctora', prof: DRA, h: v.prof[DRA], fabrica: false });
  const rs = server.handle({ action: 'pac', token: tokM, registro: { nombre: AJENO, nac: '', med: { odonto: { '21': { e: 'caries', f: '2026-10-21' } } }, planes: [], ts: new Date().toISOString() } }, { panel: true });
  OK('el servidor tampoco deja: sin_permiso y la hoja no tiene ficha con marcas del ajeno', rs.ok === false && rs.error === 'sin_permiso' && !((server.pacientes[AJENO.toLowerCase()] || {}).med || {}).odonto, rs);

  /* ---------- la clave de pauta no recibe las fichas médicas ---------- */
  const lp = JSON.parse(JSON.stringify(server.ctx.doList({ rol: 'pauta', prof: '' })));
  const pp = (lp.pacientes || []).filter(p => p.nombre === PAC)[0];
  OK('la lista para la clave de pauta trae la ficha sin med (sin marcas)', pp && (pp.med === undefined || JSON.stringify(pp.med) === '{}'), pp && pp.med);
  OK('en la pauta el odontograma no se toca (odoPuedeVer es falso con ROL pauta)', await M.evaluate(() => { const r0 = ROL; ROL = 'pauta'; const r = odoPuedeVer(); ROL = r0; return r === false; }));

  /* ---------- Sonri lo enseña ---------- */
  OK('Sonri: novedad «El odontograma con colores» y la pregunta de cómo marcar caries o ausente', await D.evaluate(() => ASIS_NOVEDADES.some(n => n.id === 'odonto-colores' && asisNovedades().some(x => x.id === 'odonto-colores')) && ASIS_AYUDA.some(a => /marco una caries o una pieza ausente/.test(a.q))));
  OK('Sonri: «caries» encuentra la ayuda', await D.evaluate(() => { const a = ASIS_AYUDA.filter(x => /caries/.test(x.k)); return a.length >= 1 && /odontograma/i.test(a[0].q); }));

  /* ---------- celular ---------- */
  const C = await abrir('od-duena-1', { width: 390, height: 844 });
  await ficha(C);
  const cel = await C.evaluate(() => { const l = $('#md-odo-leg').getBoundingClientRect(); return { l: l.left, r: l.right, vw: innerWidth, sw: document.documentElement.scrollWidth }; });
  OK('en el celular la leyenda entra en la pantalla y la página no se corre de costado', cel.l >= 0 && cel.r <= cel.vw + 1 && cel.sw <= cel.vw + 1, cel);
  if (SHOT) {
    await C.evaluate(() => { const h = [...document.querySelectorAll('#modal h4')].find(x => /^odontograma$/i.test(x.textContent.trim())); h.scrollIntoView({ block: 'center' }); });
    await C.waitForTimeout(200); await limpio(C); await C.screenshot({ path: path.join(SHOT, 'odonto-' + CL + '-ficha-celular.png') });
  }
  await pieza(C, '26');
  const cv = await C.evaluate(() => { const r = $('#modal .md-odo-pz').getBoundingClientRect(); return { l: r.left, r: r.right, vw: innerWidth }; });
  OK('en el celular la ventana de la pieza entra entera', cv.l >= 0 && cv.r <= cv.vw + 1, cv);
  if (SHOT) { await limpio(C); await C.screenshot({ path: path.join(SHOT, 'odonto-' + CL + '-pieza-celular.png') }); }

  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
