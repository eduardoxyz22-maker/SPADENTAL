/* Ajustes nuevos (MODERNO · parte 10): Profesionales y Canales como listas (agregar, apagar,
   ordenar, color) y claves por rol (una tarjeta por rol, cambio en el lugar). Chromium real,
   .gs real en memoria, datos ficticios, sin red real. SHOT_DIR=<carpeta> deja real-01.png y real-05.png. */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
/* la clave de fábrica del equipo se lee del propio HTML, como en lib.js */
const FAB_EQUIPO = (fs.readFileSync(FILE, 'utf8').match(/Clave por defecto:\s*([^\s(]+)/) || [])[1];
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
const espera = async (page, fn, arg, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 6000)) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(120); } return false; };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  if (!FAB_EQUIPO) { console.log('FALLAS: no encuentro la clave de fábrica del equipo'); process.exit(1); }
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('aj-duena-1'); server.ctx.guardarVerif(v);
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
  const D = await abrir('aj-duena-1');
  OK('entra la dueña', await D.evaluate(() => ROL === 'admin'));
  /* datos ficticios del mes: dos doctoras con atenciones, nuevos por dos canales */
  await D.evaluate(() => {
    let i = 0; const at = (pac, fecha, prof, canal, tipo) => { const r = normalize({ id: uid(), fecha, hora: '10:00', paciente: pac, profesional: prof, estado: 'Atendido', tipo: tipo || 'Nuevo', canal, origen: 'Espontánea', celular: '7004' + (i++),
      servicios: [{ nom: 'Limpieza dental', cant: 1, precio: 150 }], total: 150, acuenta: 150, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 150 }], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); };
    const P0 = CFG.prof[0], P1 = CFG.prof[1] || CFG.prof[0], C0 = CFG.canales[0], C1 = CFG.canales[1] || CFG.canales[0];
    at('Aj Uno', '2026-10-03', P0, C0); at('Aj Dos', '2026-10-05', P0, C0); at('Aj Dos', '2026-10-12', P0, C1, 'Recurrente');
    at('Aj Tres', '2026-10-07', P1, C1); at('Aj Viejo', '2026-07-02', P1, C0);
    saveLocal(); return flushQueue(); });
  await D.waitForTimeout(1200);
  const profs = await D.evaluate(() => CFG.prof.slice()), canales = await D.evaluate(() => CFG.canales.slice());
  await D.click('nav button[data-v="config"]'); await D.waitForTimeout(500); await D.evaluate(() => { try { mdAjGrupo('md-aj-equipo'); } catch (e) {} }); await D.waitForTimeout(300);

  /* ---- 01 · Profesionales ---- */
  OK('el textarea viejo y su botón quedan escondidos', !(await D.locator('#c-prof').isVisible()) && !(await D.locator('#btn-save-prof').isVisible()) && await D.locator('#c-prof').count() === 1);
  OK('una fila por doctora, con pill de clave y atenciones del mes', await D.locator('#md-aj-prof .md-aj-fila').count() === profs.length
    && /sin clave/.test(await D.locator('#md-aj-prof .md-aj-fila').first().innerText()) && /3 atenciones este mes/.test(await D.locator('#md-aj-prof .md-aj-fila').first().innerText()), await D.locator('#md-aj-prof .md-aj-fila').first().innerText());
  OK('el subtítulo viejo con estilo pegado ahora es una clase', await D.evaluate(() => document.querySelectorAll('#v-config h3[style*="uppercase"]').length === 0 && document.querySelectorAll('#v-config h3.md-aj-sub').length > 0));
  /* agregar */
  await D.click('#md-aj-prof-add'); await D.fill('#md-aj-prof-in', 'Dra. Prueba Ficticia'); await D.click('#md-aj-prof-ok'); await D.waitForTimeout(1200);
  const NUEVA = 'Dra. Prueba Ficticia';
  OK('agregar: queda al final de CFG.prof y en el servidor', await D.evaluate(n => CFG.prof[CFG.prof.length - 1] === n, NUEVA) && (server.cfg.prof || []).indexOf(NUEVA) >= 0, server.cfg.prof);
  OK('agregar: la atención nueva ya la ofrece', await D.evaluate(n => [...document.querySelectorAll('#dl-prof option')].some(o => o.value === n), NUEVA));
  await D.click('#md-aj-prof-add'); await D.fill('#md-aj-prof-in', 'dra. prueba ficticia'); await D.click('#md-aj-prof-ok'); await D.waitForTimeout(300);
  OK('agregar la misma dos veces no la duplica', await D.evaluate(n => CFG.prof.filter(p => keyPac(p) === keyPac(n)).length === 1, NUEVA) && await D.evaluate(() => CFG.prof.length) === profs.length + 1, await D.evaluate(() => CFG.prof));
  await D.evaluate(() => { $('#md-aj-prof-nuevo').hidden = true; });
  /* color */
  await D.click('#md-aj-prof .md-aj-fila[data-n="' + NUEVA + '"] .md-aj-pal button[data-c="#B83E73"]'); await D.waitForTimeout(900);
  OK('color: va a CFG.profColor y el servidor lo conserva', await D.evaluate(n => CFG.profColor && CFG.profColor[n] === '#B83E73', NUEVA) && server.cfg.profColor && server.cfg.profColor[NUEVA] === '#B83E73', server.cfg.profColor);
  OK('color: la fila lo marca y el avatar lo usa', await D.evaluate(n => { const f = document.querySelector('#md-aj-prof .md-aj-fila[data-n="' + n + '"]'); return f.querySelector('.md-aj-pal button.on').getAttribute('data-c') === '#B83E73' && /B83E73/i.test(f.querySelector('.md-aj-av').getAttribute('style')); }, NUEVA));
  /* ordenar con ▲ (celular) */
  await D.click('#md-aj-prof .md-aj-fila[data-n="' + NUEVA + '"] summary'); await D.click('#md-aj-prof .md-aj-fila[data-n="' + NUEVA + '"] [data-a="up"]'); await D.waitForTimeout(900);
  OK('▲ la sube un lugar (y el servidor también)', await D.evaluate(a => CFG.prof[a.i] === a.n, { n: NUEVA, i: profs.length - 1 }) && server.cfg.prof[profs.length - 1] === NUEVA, server.cfg.prof);
  /* ordenar arrastrando (compu) */
  const primera = profs[0];
  /* los eventos de arrastre HTML5, con un DataTransfer real (el DnD por mouse de Playwright es inestable) */
  { const dt = await D.evaluateHandle(() => new DataTransfer()); const de = '#md-aj-prof .md-aj-fila[data-n="' + NUEVA + '"]', a = '#md-aj-prof .md-aj-fila[data-n="' + primera + '"]';
    await D.dispatchEvent(de, 'dragstart', { dataTransfer: dt }); await D.dispatchEvent(a, 'dragover', { dataTransfer: dt });
    OK('al pasar por encima la fila destino se marca', await D.evaluate(a => document.querySelector(a).classList.contains('md-aj-sobre'), a));
    await D.dispatchEvent(a, 'drop', { dataTransfer: dt }); await D.dispatchEvent(de, 'dragend', { dataTransfer: dt }); await D.waitForTimeout(900); }
  OK('arrastrar la deja primera', await D.evaluate(n => CFG.prof[0] === n, NUEVA) && server.cfg.prof[0] === NUEVA, await D.evaluate(() => CFG.prof));
  /* apagar */
  const antesN = await D.evaluate(p => DATA.filter(r => r.profesional === p).length, primera);
  await D.click('#md-aj-prof .md-aj-fila[data-n="' + primera + '"] .md-aj-sw'); await D.waitForTimeout(900);
  OK('apagar: sale de CFG.prof, va a CFG.profOff, sus atenciones siguen', await D.evaluate(p => CFG.prof.indexOf(p) < 0 && CFG.profOff.indexOf(p) >= 0, primera) && antesN === await D.evaluate(p => DATA.filter(r => r.profesional === p).length, primera) && antesN > 0);
  OK('apagar: el servidor conserva profOff', (server.cfg.profOff || []).indexOf(primera) >= 0 && (server.cfg.prof || []).indexOf(primera) < 0, server.cfg.profOff);
  OK('apagar: la fila sigue, apagada, y dice que sus datos viejos se conservan', /apagada/.test(await D.locator('#md-aj-prof .md-aj-fila.off[data-n="' + primera + '"]').innerText()) && new RegExp(antesN + ' atenciones viejas se conservan').test(await D.locator('#md-aj-prof .md-aj-fila.off[data-n="' + primera + '"]').innerText()));
  OK('apagar: la atención nueva no la ofrece (aunque tenga atenciones viejas), a la nueva sí', await D.evaluate(a => { const o = [...document.querySelectorAll('#dl-prof option')].map(x => x.value); return o.indexOf(a.p) < 0 && o.indexOf(a.n) >= 0; }, { p: primera, n: NUEVA }));
  await D.evaluate(() => show('atencion')); await D.waitForTimeout(200);
  OK('…tampoco en el formulario de atención', await D.evaluate(a => { const o = [...document.querySelectorAll('#dl-prof option')].map(x => x.value); return o.indexOf(a.p) < 0 && o.indexOf(a.n) >= 0; }, { p: primera, n: NUEVA }));
  await D.evaluate(() => show('config')); await D.waitForTimeout(400); await D.evaluate(() => { try { mdAjGrupo('md-aj-equipo'); } catch (e) {} });
  /* encender de nuevo */
  await D.click('#md-aj-prof .md-aj-fila[data-n="' + primera + '"] .md-aj-sw'); await D.waitForTimeout(900);
  OK('encender: vuelve a CFG.prof y sale de profOff', await D.evaluate(p => CFG.prof.indexOf(p) >= 0 && CFG.profOff.indexOf(p) < 0, primera) && (server.cfg.prof || []).indexOf(primera) >= 0);
  OK('no deja apagar la última doctora', await D.evaluate(() => { const antes = CFG.prof.slice(); const ok = mdAjGuardar('prof', [], CFG.prof.slice()); return ok === false && JSON.stringify(CFG.prof) === JSON.stringify(antes); }));
  await D.click('#md-aj-prof .md-aj-fila[data-n="' + primera + '"] .md-aj-sw'); await D.waitForTimeout(900);   /* la dejamos apagada para la captura */
  /* las claves por doctora solo listan a las encendidas */
  OK('en claves solo aparecen las encendidas', await D.evaluate(p => ![...document.querySelectorAll('#md-aj-roles .md-aj-rol[data-rol="prof"]')].some(c => c.getAttribute('data-prof') === p), primera));

  /* ---- 01 · Canales ---- */
  await D.evaluate(() => { try { mdAjGrupo('md-aj-msj'); } catch (e) {} }); await D.waitForTimeout(300);
  OK('canales: el textarea viejo escondido, una fila por canal', !(await D.locator('#c-canal').isVisible()) && await D.locator('#md-aj-canal .md-aj-fila').count() === canales.length);
  const f0 = await D.locator('#md-aj-canal .md-aj-fila[data-n="' + canales[0] + '"]').innerText();
  OK('canales: cuenta pacientes nuevos del mes (Aj Uno y Aj Dos por ' + canales[0] + ', no el recurrente ni el de julio)', /2 pacientes este mes/.test(f0), f0);
  OK('canales: ' + canales[1] + ' trajo 1 (Aj Tres; Aj Dos ahí fue recurrente)', /1 paciente este mes/.test(await D.locator('#md-aj-canal .md-aj-fila[data-n="' + canales[1] + '"]').innerText()));
  await D.click('#md-aj-canal-add'); await D.fill('#md-aj-canal-in', 'Radio ficticia'); await D.press('#md-aj-canal-in', 'Enter'); await D.waitForTimeout(900);
  OK('canal agregado (con Enter) y en el servidor', await D.evaluate(() => CFG.canales[CFG.canales.length - 1] === 'Radio ficticia') && (server.cfg.canales || []).indexOf('Radio ficticia') >= 0);
  const c1 = canales[1];
  await D.click('#md-aj-canal .md-aj-fila[data-n="' + c1 + '"] .md-aj-sw'); await D.waitForTimeout(900);
  OK('canal apagado: fuera de CFG.canales, en canalesOff, el servidor lo conserva', await D.evaluate(c => CFG.canales.indexOf(c) < 0 && CFG.canalesOff.indexOf(c) >= 0, c1) && (server.cfg.canalesOff || []).indexOf(c1) >= 0);
  OK('canal apagado: la atención nueva ofrece solo los encendidos', await D.evaluate(() => { const r = [...document.querySelectorAll('#seg-canal input')].map(i => i.value); return JSON.stringify(r) === JSON.stringify(CFG.canales); }) && await D.evaluate(c => ![...document.querySelectorAll('#seg-canal input')].some(i => i.value === c), c1));
  await D.click('#md-aj-canal .md-aj-fila[data-n="Radio ficticia"] summary'); await D.click('#md-aj-canal .md-aj-fila[data-n="Radio ficticia"] [data-a="up"]'); await D.waitForTimeout(900);
  OK('▲ sube el canal un lugar', await D.evaluate(() => CFG.canales[CFG.canales.length - 2] === 'Radio ficticia') && server.cfg.canales[server.cfg.canales.length - 2] === 'Radio ficticia', server.cfg.canales);
  OK('no quedan cosas sin subir', await espera(D, () => pend().length === 0, null, 8000));
  /* lo nuevo sobrevive al viaje completo: lo que el servidor devuelve en cfgGet y en list */
  const cg = server.handle({ action: 'cfgGet', token: server.ctx.nuevaSesion({ rol: 'admin', prof: '', h: server.ctx.leerVerif().admin, fabrica: false }) }, { panel: true });
  OK('cfgGet devuelve profColor, profOff y canalesOff', cg.ok && cg.cfg && cg.cfg.profColor && cg.cfg.profColor[NUEVA] === '#B83E73' && cg.cfg.profOff.indexOf(primera) >= 0 && cg.cfg.canalesOff.indexOf(c1) >= 0);

  /* el color elegido se ve donde el panel ya dibuja a la doctora: la dona «Quién produjo» */
  const DX = await D.evaluate(() => CFG.prof.filter(p => DATA.some(r => r.profesional === p && r.estado === 'Atendido'))[0]);
  await D.evaluate(p => { CFG.profColor = Object.assign({}, CFG.profColor || {}); CFG.profColor[p] = '#16807A'; mdAjGuardar('prof'); }, DX); await D.waitForTimeout(600);
  await D.evaluate(() => show('panel')); await D.waitForTimeout(800);
  OK('el Panel pinta a ' + DX + ' con su color en la dona', await D.evaluate(p => { const li = [...document.querySelectorAll('#md-pvis .md-dona ul li')].filter(l => (l.querySelector('span') || {}).textContent === p)[0]; return !!li && /22,\s*128,\s*122/.test(getComputedStyle(li.querySelector('i')).backgroundColor); }, DX));
  await D.evaluate(() => show('config')); await D.waitForTimeout(400);
  /* captura 01: Profesionales + Canales (los dos en pantalla, a 1366 px) */
  if (process.env.SHOT_DIR) {
    await D.evaluate(() => { mdAjGrupo('md-aj-equipo'); const g = document.querySelector('#md-aj-equipo'); const pc = document.querySelector('#c-prof').closest('.card'), cc = document.querySelector('#c-canal').closest('.card');
      cc.setAttribute('data-shot-vuelve', '1'); pc.parentNode.insertBefore(cc, pc.nextSibling); [...g.querySelectorAll(':scope > .card')].forEach(c => { if (c !== pc && c !== cc) c.setAttribute('data-shot-oculta', '1'), c.style.display = 'none'; }); });
    await D.setViewportSize({ width: 1366, height: 2400 }); await D.evaluate(() => { window.scrollTo(0, 0); $('#toast').className = ''; }); await D.waitForTimeout(600);
    await D.locator('#md-aj-equipo').screenshot({ path: path.join(process.env.SHOT_DIR, 'real-01.png') });
    await D.setViewportSize({ width: 1366, height: 900 });
    await D.evaluate(() => { const cc = document.querySelector('[data-shot-vuelve]'); document.querySelector('#md-aj-msj').appendChild(cc); cc.removeAttribute('data-shot-vuelve'); [...document.querySelectorAll('[data-shot-oculta]')].forEach(c => { c.style.display = ''; c.removeAttribute('data-shot-oculta'); }); });
  }

  /* ---- 05 · claves por rol ---- */
  await D.evaluate(() => { try { mdAjGrupo('md-aj-equipo'); } catch (e) {} }); await D.waitForTimeout(300);
  const nOn = await D.evaluate(() => CFG.prof.length);
  OK('una tarjeta por rol: equipo, dueña y cada doctora encendida', await D.locator('#md-aj-roles .md-aj-rol').count() === 2 + nOn && await D.locator('#md-aj-roles .md-aj-rol[data-rol="equipo"]').count() === 1 && await D.locator('#md-aj-roles .md-aj-rol[data-rol="admin"]').count() === 1);
  OK('lo viejo (campos, subtítulos, Bloquear) quedó escondido pero existe', !(await D.locator('#c-pass-old').isVisible()) && !(await D.locator('#btn-lock').isVisible()) && !(await D.locator('#claves-prof-lista').isVisible()) && await D.locator('#btn-save-claves-prof').count() === 1);
  OK('la tarjeta se llama «Quién entra y con qué clave»', /Quién entra y con qué clave/.test(await D.locator('#md-aj-claves h2').innerText()));
  OK('del equipo no hay dato en este aparato (el servidor no manda su hash); la dueña tiene la suya ✓', /Sin dato en este aparato/.test(await D.locator('#md-aj-roles .md-aj-rol[data-rol="equipo"]').innerText()) && /Clave propia/.test(await D.locator('#md-aj-roles .md-aj-rol[data-rol="admin"]').innerText()));
  OK('cada doctora sin clave ofrece «Asignar clave»', await D.locator('#md-aj-roles .md-aj-rol[data-rol="prof"] .md-aj-cambiar', { hasText: 'Asignar clave' }).count() === nOn);
  OK('«Bloquear ahora» en su propia tarjeta, explicado', await D.locator('#md-aj-bloquear').count() === 1 && /Cierra el panel en este aparato/.test(await D.locator('#md-aj-bloquear').innerText()) && await D.locator('#md-aj-indice .md-aj-it', { hasText: 'Bloquear ahora' }).count() === 1);
  /* equipo: cambiar en el lugar (la validación y el pedido «clave» son los de siempre) */
  await D.click('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-cambiar');
  OK('«Cambiar» abre el formulario en la tarjeta', await D.locator('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-frm').count() === 1);
  await D.fill('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-act', 'equivocada-1'); await D.fill('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-n1', 'aj-equipo-1'); await D.fill('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-n2', 'aj-equipo-1');
  await D.click('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-ok-b'); await D.waitForTimeout(600);
  OK('clave actual equivocada: lo dice en la tarjeta y no cambia nada', /no coincide/.test(await D.locator('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-err').innerText()) && server.ctx.leerVerif().equipo === server.ctx.EQUIPO_FABRICA);
  await D.fill('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-act', FAB_EQUIPO);
  await D.click('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-ok-b');
  OK('equipo: la clave nueva queda en el servidor (acción «clave») y la tarjeta pasa a ✓', await espera(D, () => !document.querySelector('#md-aj-roles .md-aj-frm')) && server.ctx.leerVerif().equipo === sha('aj-equipo-1') && server.calls('clave').some(c => c.body.quien === 'equipo') && /Clave propia/.test(await D.locator('#md-aj-roles .md-aj-rol[data-rol="equipo"]').innerText()));
  /* doctora: asignar */
  const DRA = await D.evaluate(() => CFG.prof[1]);
  await D.click('#md-aj-roles .md-aj-rol[data-prof="' + DRA + '"] .md-aj-cambiar');
  await D.fill('#md-aj-roles .md-aj-rol[data-prof="' + DRA + '"] .md-aj-n1', 'aj-dra-1'); await D.fill('#md-aj-roles .md-aj-rol[data-prof="' + DRA + '"] .md-aj-n2', 'aj-dra-2');
  await D.click('#md-aj-roles .md-aj-rol[data-prof="' + DRA + '"] .md-aj-ok-b'); await D.waitForTimeout(300);
  OK('doctora: si no coinciden, avisa en la tarjeta', /no coinciden/.test(await D.locator('#md-aj-roles .md-aj-rol[data-prof="' + DRA + '"] .md-aj-err').innerText()));
  await D.fill('#md-aj-roles .md-aj-rol[data-prof="' + DRA + '"] .md-aj-n2', 'aj-dra-1'); await D.click('#md-aj-roles .md-aj-rol[data-prof="' + DRA + '"] .md-aj-ok-b');
  OK('doctora: clave asignada en el servidor y la tarjeta pasa a ✓ con «Cambiar»', await espera(D, () => !document.querySelector('#md-aj-roles .md-aj-frm')) && server.ctx.leerVerif().prof[DRA] === sha('aj-dra-1') && /Clave propia/.test(await D.locator('#md-aj-roles .md-aj-rol[data-prof="' + DRA + '"]').innerText()) && await D.locator('#md-aj-roles .md-aj-rol[data-prof="' + DRA + '"] .md-aj-cambiar', { hasText: /^Cambiar$/ }).count() === 1);
  /* otra doctora con la misma clave: el servidor dice que no y se ve en la tarjeta */
  const DRA2 = await D.evaluate(() => CFG.prof[0]);
  await D.click('#md-aj-roles .md-aj-rol[data-prof="' + DRA2 + '"] .md-aj-cambiar');
  await D.fill('#md-aj-roles .md-aj-rol[data-prof="' + DRA2 + '"] .md-aj-n1', 'aj-dra-1'); await D.fill('#md-aj-roles .md-aj-rol[data-prof="' + DRA2 + '"] .md-aj-n2', 'aj-dra-1');
  await D.click('#md-aj-roles .md-aj-rol[data-prof="' + DRA2 + '"] .md-aj-ok-b');
  OK('clave repetida: el motivo queda al lado, el formulario sigue abierto', await espera(D, p => !!(document.querySelector('#md-aj-roles .md-aj-rol[data-prof="' + p + '"] .md-aj-err') || {}).textContent, DRA2) && /Ya la usa/.test(await D.locator('#md-aj-roles .md-aj-rol[data-prof="' + DRA2 + '"] .md-aj-err').innerText()) && !server.ctx.leerVerif().prof[DRA2]);
  await D.click('#md-aj-roles .md-aj-rol[data-prof="' + DRA2 + '"] .md-aj-no-b');
  OK('Cancelar cierra el formulario', await D.locator('#md-aj-roles .md-aj-frm').count() === 0);
  /* captura 05 */
  if (process.env.SHOT_DIR) {
    await D.click('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-cambiar'); await D.fill('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-act', 'xxxxxxxx'); await D.fill('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-n1', 'xxxxxxxx'); await D.fill('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-n2', 'xxxxxxxx');
    await D.evaluate(() => { [...document.querySelectorAll('#md-aj-equipo > .card')].forEach(c => { if (c.id !== 'md-aj-claves' && c.id !== 'md-aj-bloquear') c.setAttribute('data-shot-oculta', '1'), c.style.display = 'none'; }); });
    await D.setViewportSize({ width: 1366, height: 2400 }); await D.evaluate(() => { window.scrollTo(0, 0); $('#toast').className = ''; }); await D.waitForTimeout(600);
    await D.locator('#md-aj-equipo').screenshot({ path: path.join(process.env.SHOT_DIR, 'real-05.png') });
    await D.setViewportSize({ width: 1366, height: 900 });
    await D.evaluate(() => { [...document.querySelectorAll('[data-shot-oculta]')].forEach(c => { c.style.display = ''; c.removeAttribute('data-shot-oculta'); }); });
    await D.click('#md-aj-roles .md-aj-rol[data-rol="equipo"] .md-aj-no-b');
  }
  /* dueña: cambia la suya */
  await D.click('#md-aj-roles .md-aj-rol[data-rol="admin"] .md-aj-cambiar');
  await D.fill('#md-aj-roles .md-aj-rol[data-rol="admin"] .md-aj-n1', 'aj-duena-2'); await D.fill('#md-aj-roles .md-aj-rol[data-rol="admin"] .md-aj-n2', 'aj-duena-2');
  await D.press('#md-aj-roles .md-aj-rol[data-rol="admin"] .md-aj-n2', 'Enter');
  OK('dueña: clave cambiada en el servidor (con Enter)', await espera(D, () => !document.querySelector('#md-aj-roles .md-aj-frm')) && server.ctx.leerVerif().admin === sha('aj-duena-2'));
  OK('el refresco de Ajustes no pisa un formulario abierto', await D.evaluate(() => { document.querySelector('#md-aj-roles .md-aj-rol[data-rol="admin"] .md-aj-cambiar').click(); const f = document.querySelector('#md-aj-roles .md-aj-frm'); f.querySelector('.md-aj-n1').value = 'a-medio'; renderConfig(); const f2 = document.querySelector('#md-aj-roles .md-aj-frm'); const ok = f2 === f && f2.querySelector('.md-aj-n1').value === 'a-medio'; f2.querySelector('.md-aj-no-b').click(); return ok; }));
  /* bloquear desde la tarjeta nueva */
  await D.click('#md-aj-lock'); await D.waitForTimeout(300);
  OK('«Bloquear ahora» cierra el panel (reusa #btn-lock)', await D.evaluate(() => document.body.classList.contains('locked') && !$('#gate').classList.contains('off')));
  await D.context().close();

  /* las claves nuevas abren, cada una con su rol */
  const E = await abrir('aj-equipo-1');
  OK('la clave nueva del equipo entra como recepción', await E.evaluate(() => ROL === 'equipo'));
  await E.evaluate(() => show('config')); await E.waitForTimeout(400); await E.evaluate(() => { try { mdAjGrupo('md-aj-equipo'); } catch (e) {} });
  OK('recepción ve su tarjeta con ✓ Clave propia (lo sabe por su propia sesión)', /Clave propia/.test(await E.locator('#md-aj-roles .md-aj-rol[data-rol="equipo"]').innerText()));
  OK('…y con la de fábrica ya no se entra', (server.handle({ action: 'login', clave: FAB_EQUIPO }, { panel: true }) || {}).ok !== true);
  await E.context().close();
  const R = await abrir('aj-dra-1');
  OK('la doctora entra con su clave y ve solo lo suyo', await R.evaluate(d => ROL === 'doctora' && PROF_ACTUAL === d, DRA));
  await R.evaluate(() => show('config')); await R.waitForTimeout(400);
  OK('la doctora ve las listas pero sin interruptores ni colores', await R.locator('#md-aj-prof .md-aj-fila').count() > 0 && await R.locator('#md-aj-prof .md-aj-sw').count() === 0 && await R.locator('#md-aj-prof .md-aj-pal').count() === 0);
  OK('…y no puede guardar aunque lo intente', await R.evaluate(() => { const a = CFG.prof.slice(); const ok = mdAjGuardar('prof', ['Dra. Colada']); return ok === false && JSON.stringify(CFG.prof) === JSON.stringify(a); }));
  await R.context().close();
  const A2 = await abrir('aj-duena-2');
  OK('la dueña entra con la clave nueva', await A2.evaluate(() => ROL === 'admin'));
  await A2.evaluate(() => show('config')); await A2.waitForTimeout(400);
  OK('al volver a entrar: lo apagado sigue apagado y el color sigue (viene del servidor)', await A2.evaluate(a => CFG.profOff.indexOf(a.p) >= 0 && CFG.prof.indexOf(a.p) < 0 && CFG.profColor[a.n] === '#B83E73', { p: primera, n: NUEVA }));
  OK('…y las tarjetas de claves muestran a quién ya le asignó (la del equipo, sin dato en un aparato nuevo)', /Clave propia/.test(await A2.locator('#md-aj-roles .md-aj-rol[data-prof="' + DRA + '"]').innerText()) && /Sin dato en este aparato/.test(await A2.locator('#md-aj-roles .md-aj-rol[data-rol="equipo"]').innerText()));
  await A2.context().close();
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
