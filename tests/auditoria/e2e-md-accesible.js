/* Accesible y delicias (MODERNO · parte 50): letra grande que se recuerda, modo noche «como el
   teléfono», foco visible, toques de 44 px, vibración al guardar/cobrar/cerrar, temporadas locales
   (Carnaval, 24 de septiembre, Navidad, Año Nuevo) que respetan la pref, el cumpleaños de la doctora
   en el saludo y el resumen del día como imagen. Chromium real, .gs real en memoria, datos ficticios,
   sin red real. SHOT_DIR=<carpeta> deja real-letra.png, real-temporada.png y real-resumen-img.jpg. */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path'), fs = require('fs');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(72), x === undefined ? '' : JSON.stringify(x)); };
const espera = async (page, fn, arg, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 6000)) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(120); } return false; };
/* ancho y alto de un JPEG, leyendo el marcador SOF */
const jpegDim = buf => { let p = 2; while (p < buf.length) { if (buf[p] !== 0xFF) { p++; continue; } const m = buf[p + 1]; if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: buf.readUInt16BE(p + 5), w: buf.readUInt16BE(p + 7) }; p += 2 + buf.readUInt16BE(p + 2); } return null; };
const SHOT = process.env.SHOT_DIR;
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('ac-duena-1'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const abrir = async (clave, opts) => {
    opts = opts || {};
    const ctx = await b.newContext({ viewport: opts.viewport || { width: 1366, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); window.__vib = []; navigator.vibrate = function (ms) { window.__vib.push(ms); return true; }; });
    if (opts.antes) await page.addInitScript(opts.antes);
    await page.clock.install({ time: new Date(opts.time || '2026-10-21T14:15:00Z') });
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.fill('#gate-pass', clave); await page.click('#gate-btn'); await page.waitForTimeout(2000);
    return page;
  };

  /* ================= A · accesibilidad ================= */
  const D = await abrir('ac-duena-1');
  OK('entra la dueña', await D.evaluate(() => ROL === 'admin'));
  const ids = await D.evaluate(() => {
    let i = 0; const at = (pac, fecha, saldo) => { const tot = 300; const r = normalize({ id: uid(), fecha, hora: '10:00', paciente: pac, profesional: CFG.prof[0], estado: 'Atendido', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Espontánea', celular: '7005' + (i++),
      servicios: [{ nom: 'Limpieza dental', cant: 1, precio: tot }], total: tot, acuenta: tot - saldo, saldo, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: tot - saldo }], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); return r.id; };
    window.__ids = [at('Acc Uno', hoyISO(), 0), at('Acc Dos', hoyISO(), 100), at('Acc Tres', '2026-10-15', 0)];
    EGR.push({ id: uid(), fecha: hoyISO(), cat: 'Insumos', desc: 'Guantes', monto: 40, metodo: 'Efectivo', ts: new Date().toISOString() }); queue('egreso', EGR[EGR.length - 1], null);
    saveLocal(); return flushQueue().then(() => window.__ids); });
  await D.waitForTimeout(1200);
  await D.evaluate(() => show('config')); await D.waitForTimeout(500); await D.evaluate(() => { try { mdAjGrupo('md-aj-apar'); } catch (e) {} }); await D.waitForTimeout(200);
  /* letra */
  OK('Apariencia tiene «Letra: normal / grande / muy grande» y «Como el teléfono»', await D.evaluate(() => document.querySelectorAll('#md-op-letra input[name="md-letra"]').length === 3 && !!document.querySelector('#md-op-noche input[value="aparato"]')));
  const fz0 = await D.evaluate(() => ({ body: parseFloat(getComputedStyle(document.body).fontSize), td: parseFloat(getComputedStyle(document.querySelector('#v-config table') || document.body).fontSize), btn: parseFloat(getComputedStyle(document.querySelector('#v-config .btn')).fontSize), hd: document.querySelector('header').offsetHeight }));
  await D.click('#md-op-letra input[value="xg"] + span'); await D.waitForTimeout(300);
  const fz1 = await D.evaluate(() => ({ body: parseFloat(getComputedStyle(document.body).fontSize), td: parseFloat(getComputedStyle(document.querySelector('#v-config table') || document.body).fontSize), btn: parseFloat(getComputedStyle(document.querySelector('#v-config .btn')).fontSize), hd: document.querySelector('header').offsetHeight, html: parseFloat(getComputedStyle(document.documentElement).fontSize), cls: document.documentElement.classList.contains('md-letra-xg') && document.body.classList.contains('md-letra-xg') }));
  OK('letra muy grande: el texto, las tablas y los botones crecen ×1.25', fz1.cls && Math.abs(fz1.body / fz0.body - 1.25) < 0.02 && Math.abs(fz1.td / fz0.td - 1.25) < 0.02 && Math.abs(fz1.btn / fz0.btn - 1.25) < 0.02 && fz1.html === 20, { antes: fz0, despues: fz1 });
  OK('…y el encabezado oscuro casi no cambia de alto (solo su línea de texto)', Math.abs(fz1.hd - fz0.hd) <= 8, [fz0.hd, fz1.hd]);
  OK('se recuerda en este aparato (localStorage)', await D.evaluate(() => mdPref('LETRA') === 'xg'));
  await D.reload(); await D.waitForTimeout(2000);
  OK('al recargar sigue en letra muy grande', await D.evaluate(() => document.documentElement.classList.contains('md-letra-xg') && document.body.classList.contains('md-letra')));
  await D.evaluate(() => show('config')); await D.waitForTimeout(500);
  OK('y la casilla de Ajustes la muestra marcada', await D.evaluate(() => document.querySelector('#md-op-letra input[value="xg"]').checked));
  await D.click('#md-op-letra input[value="g"] + span'); await D.waitForTimeout(200);
  OK('letra grande: ×1.12', await D.evaluate(() => Math.abs(parseFloat(getComputedStyle(document.documentElement).fontSize) - 17.92) < 0.1 && mdPref('LETRA') === 'g'));
  const ancho = await D.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  OK('sin scroll horizontal con la letra grande', ancho);
  /* modo noche como el teléfono */
  await D.click('#md-op-noche input[value="aparato"] + span'); await D.waitForTimeout(200);
  OK('«como el teléfono» guarda la pref y de día (claro) no oscurece', await D.evaluate(() => mdPref('NOCHE') === 'aparato' && !document.body.classList.contains('md-noche')));
  await D.emulateMedia({ colorScheme: 'dark' }); await D.waitForTimeout(300);
  OK('el teléfono pasa a oscuro → el panel también (theme-color oscuro)', await D.evaluate(() => document.body.classList.contains('md-noche') && document.querySelector('meta[name="theme-color"]').getAttribute('content') === '#0B0C09'));
  await D.emulateMedia({ colorScheme: 'light' }); await D.waitForTimeout(300);
  OK('vuelve a claro → vuelve el panel claro', await D.evaluate(() => !document.body.classList.contains('md-noche')));
  await D.emulateMedia({ colorScheme: 'dark' }); await D.waitForTimeout(200);
  await D.evaluate(() => show('midia')); await D.waitForTimeout(300); await D.evaluate(() => show('config')); await D.waitForTimeout(400);
  OK('al volver a Ajustes la casilla sigue en «Como el teléfono» (no en Apagado)', await D.evaluate(() => document.querySelector('#md-op-noche input[value="aparato"]').checked && !document.querySelector('#md-op-noche input[value="no"]').checked));
  await D.click('#md-op-noche input[value="no"] + span'); await D.waitForTimeout(200);
  OK('«Apagado» manda aunque el teléfono esté oscuro', await D.evaluate(() => !document.body.classList.contains('md-noche')));
  await D.emulateMedia({ colorScheme: 'light' });
  /* foco visible */
  const lime = await D.evaluate(() => { const s = document.createElement('span'); s.style.color = getComputedStyle(document.body).getPropertyValue('--lime').trim(); document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; });
  await D.evaluate(() => show('caja')); await D.waitForTimeout(500);
  await D.evaluate(() => { const b = $('#btn-xls-caja'); b.scrollIntoView(); });
  await D.keyboard.press('Tab'); await D.evaluate(() => $('#btn-xls-caja').focus()); await D.waitForTimeout(100);
  const foco = await D.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { id: e.id, fv: e.matches(':focus-visible'), color: s.outlineColor, w: s.outlineWidth, st: s.outlineStyle }; });
  OK('el botón enfocado con el teclado muestra el anillo del color de la clínica (3px)', foco.fv && foco.color === lime && foco.w === '3px' && foco.st === 'solid', { foco, lime });
  await D.evaluate(() => $('#cj-q').focus()); await D.waitForTimeout(100);
  const focoI = await D.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { id: e.id, fv: e.matches(':focus-visible'), color: s.outlineColor, w: s.outlineWidth }; });
  OK('el campo de texto enfocado también (2px, mismo color)', focoI.fv && focoI.color === lime && focoI.w === '2px', focoI);
  await D.evaluate(() => show('lista')); await D.waitForTimeout(600);
  const fila = await D.evaluate(() => { const tr = document.querySelector('#l-body tr[onclick]'); return tr ? { ti: tr.getAttribute('tabindex'), n: document.querySelectorAll('#l-body tr[onclick][tabindex="0"]').length } : null; });
  OK('las filas clicables de Atenciones se pueden enfocar (tabindex 0)', fila && fila.ti === '0' && fila.n > 0, fila);
  await D.evaluate(() => { const tr = document.querySelector('#l-body tr[onclick]'); tr.focus(); });
  const focoF = await D.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { tag: e.tagName, color: s.outlineColor, w: s.outlineWidth }; });
  await D.keyboard.press('Enter'); await D.waitForTimeout(400);
  OK('Enter sobre la fila la abre (y la fila enfocada tiene el anillo)', focoF.tag === 'TR' && focoF.color === lime && focoF.w === '3px' && await D.evaluate(() => $('#ov').classList.contains('on')), focoF);
  await D.evaluate(() => closeModal());
  /* vibración: cobrar y guardar */
  await D.evaluate(id => { window.__vib = []; cobrarSaldo(id); }, ids[1]); await D.waitForTimeout(300);
  await D.fill('#cp-m', '100'); await D.evaluate(() => setRadio('cpmet', 'Efectivo')); await D.evaluate(id => guardarPago(id), ids[1]);
  OK('cobrar: vibra 12 ms cuando el pago quedó registrado', await espera(D, () => window.__vib.length === 1 && window.__vib[0] === 12 && !$('#ov').classList.contains('on'), null, 5000), await D.evaluate(() => window.__vib));
  OK('…y el pago es real: la atención quedó sin saldo', await D.evaluate(id => num(DATA.filter(r => r.id === id)[0].saldo) === 0, ids[1]));
  await D.evaluate(id => { window.__vib = []; const r = DATA.filter(x => x.id === id)[0]; showWhatsappModal(r, null, 0, 0, '', false); }, ids[0]);
  OK('guardar una atención (el modal «Atención guardada») vibra', await D.evaluate(() => window.__vib.length === 1 && window.__vib[0] === 12 && /Guardad|Atenci[oó]n guardada/.test($('#modal h3').textContent)));
  await D.evaluate(() => closeModal());
  await D.evaluate(() => show('caja')); await D.waitForTimeout(500);
  await D.evaluate(() => { window.__vib = []; });
  const hayCierre = await D.evaluate(() => !!$('#md-contado'));
  if (hayCierre) {
    await D.fill('#md-contado', '260');
    if (await D.locator('#md-ci-btn').count()) await D.click('#md-ci-btn'); else await D.dispatchEvent('#md-contado', 'change');
    await D.waitForTimeout(600);
  }
  OK('cerrar la caja vibra (y sin contar nada, no)', hayCierre && await D.evaluate(() => window.__vib.length === 1), await D.evaluate(() => window.__vib));
  await D.evaluate(() => { window.__vib = []; });
  OK('la vibración es corta: 12 ms y solo si el aparato la tiene', await D.evaluate(() => { const v = navigator.vibrate; navigator.vibrate = undefined; try { mdAccVibrar(); } finally { navigator.vibrate = v; } return window.__vib.length === 0; }));
  /* el resumen del día como imagen */
  OK('en Caja, junto al resumen por WhatsApp, está «Como imagen»', await D.evaluate(() => { const b = $('#md-acc-res-img'); return !!b && b.previousElementSibling && b.previousElementSibling.id === 'btn-resumen-dia'; }));
  await D.evaluate(() => { $('#c-rango').value = 'dia'; $('#c-rango').dispatchEvent(new Event('change', { bubbles: true })); $('#c-dia').value = hoyISO(); $('#c-dia').dispatchEvent(new Event('change', { bubbles: true })); renderCaja(); });
  const [dl] = await Promise.all([D.waitForEvent('download', { timeout: 15000 }), D.click('#md-acc-res-img')]);
  const img = fs.readFileSync(await dl.path()); const dim = jpegDim(img);
  OK('se descarga un JPEG de 1080×1350 (sin «compartir» en la compu) con nombre con la fecha', !!dim && dim.w === 1080 && dim.h === 1350 && img.length > 15000 && /Resumen del dia 2026-10-21/.test(dl.suggestedFilename()) && img[0] === 0xFF && img[1] === 0xD8, { dim, bytes: img.length, nombre: dl.suggestedFilename() });
  if (SHOT) fs.copyFileSync(await dl.path(), path.join(SHOT, 'real-resumen-img.jpg'));
  const datos = await D.evaluate(() => mdAccResumenDatos(hoyISO(), ''));
  OK('los números de la imagen son los del texto de WhatsApp', datos.at === 2 && datos.cobr === 600 && datos.porM.Efectivo === 600 && datos.egr === 40 && datos.neto === 560 && datos.deuda === 0 && await D.evaluate(() => { const t = txtResumenDia(hoyISO(), ''); return /Atendidos: \*2\*/.test(t) && /Cobrado: \*Bs 600\*/.test(t) && /Egresos: Bs 40/.test(t); }), datos);
  await D.evaluate(() => abrirResumenDia(hoyISO(), '')); await D.waitForTimeout(300);
  OK('el modal del resumen también tiene «Como imagen»', await D.locator('#modal .md-acc-res-m').count() === 1);
  await D.evaluate(() => closeModal());
  /* el cumpleaños de la doctora: el campo en Ajustes › Profesionales */
  await D.evaluate(() => show('config')); await D.waitForTimeout(500); await D.evaluate(() => { try { mdAjGrupo('md-aj-equipo'); } catch (e) {} }); await D.waitForTimeout(200);
  const MIA = await D.evaluate(() => mdQuienSaludo()), P0 = await D.evaluate(() => CFG.prof[0]), P1 = await D.evaluate(() => CFG.prof[1] || CFG.prof[0]);
  OK('cada fila de doctora tiene el botón 🎂 «Cumple (dd/mm)»', await D.evaluate(() => document.querySelectorAll('#md-aj-prof .md-aj-fila[data-k="prof"]').length > 0 && document.querySelectorAll('#md-aj-prof .md-aj-fila[data-k="prof"] .md-acc-cb').length === document.querySelectorAll('#md-aj-prof .md-aj-fila[data-k="prof"]').length));
  await D.click('#md-aj-prof .md-aj-fila[data-n="' + P0 + '"] .md-acc-cb'); await D.fill('#md-aj-prof .md-aj-fila[data-n="' + P0 + '"] .md-acc-ci', '99/99'); await D.click('#md-aj-prof .md-aj-fila[data-n="' + P0 + '"] .md-acc-ok'); await D.waitForTimeout(300);
  OK('una fecha imposible no se guarda', await D.evaluate(() => !(CFG.profCumple && Object.keys(CFG.profCumple).length) && /día\/mes/.test($('#toast').textContent)));
  await D.fill('#md-aj-prof .md-aj-fila[data-n="' + P0 + '"] .md-acc-ci', '21/10'); await D.press('#md-aj-prof .md-aj-fila[data-n="' + P0 + '"] .md-acc-ci', 'Enter'); await D.waitForTimeout(1200);
  OK('cumple 21/10 → CFG.profCumple y el servidor lo guardan', await D.evaluate(p => CFG.profCumple && CFG.profCumple[p] === '21/10', P0) && server.cfg.profCumple && server.cfg.profCumple[P0] === '21/10', server.cfg.profCumple);
  OK('la fila lo muestra', /cumple el 21\/10/.test(await D.locator('#md-aj-prof .md-aj-fila[data-n="' + P0 + '"]').innerText()));
  await D.evaluate(() => mdEncabezado());
  const logo = await D.locator('.hd .logo').innerText(), linea = await D.locator('#md-linea').innerText();
  if (MIA && P0.indexOf(MIA) === 0) OK('hoy cumple la que saluda: «¡Feliz cumpleaños! 🎂» en el saludo del header', /Feliz cumpleaños! 🎂/.test(logo) && new RegExp(MIA).test(logo), logo);
  else OK('hoy cumple una doctora: el header lo dice', /🎂 Hoy cumple la /.test(linea), linea);
  if (P1 !== P0) {
    await D.click('#md-aj-prof .md-aj-fila[data-n="' + P1 + '"] .md-acc-cb'); await D.fill('#md-aj-prof .md-aj-fila[data-n="' + P1 + '"] .md-acc-ci', '21/10'); await D.click('#md-aj-prof .md-aj-fila[data-n="' + P1 + '"] .md-acc-ok'); await D.waitForTimeout(1200);
    await D.evaluate(() => mdEncabezado());
    OK('otra doctora que cumple hoy va en la línea del header («Hoy cumple la …»)', new RegExp('🎂 Hoy cumple la ' + P1.replace(/\./g, '\\.')).test(await D.locator('#md-linea').innerText()), await D.locator('#md-linea').innerText());
  }
  await D.click('#md-aj-prof .md-aj-fila[data-n="' + P0 + '"] .md-acc-cb'); await D.fill('#md-aj-prof .md-aj-fila[data-n="' + P0 + '"] .md-acc-ci', ''); await D.click('#md-aj-prof .md-aj-fila[data-n="' + P0 + '"] .md-acc-ok'); await D.waitForTimeout(1200);
  OK('vaciar el campo lo borra', await D.evaluate(p => !(CFG.profCumple || {})[p], P0) && !(server.cfg.profCumple || {})[P0]);
  OK('el cumple no se confunde con otro día', await D.evaluate(() => { const pc = CFG.profCumple; CFG.profCumple = { 'Dra. Zeta Ficticia': '22/10' }; const n = mdAccCumpleHoy().length; CFG.profCumple = pc; return n === 0; }));
  await D.context().close();

  /* ---- el celular: letra muy grande a 390 px y toques de 44 px ---- */
  const C = await abrir('ac-duena-1', { viewport: { width: 390, height: 844 }, antes: () => { try { localStorage.setItem(Object.keys(localStorage).filter(k => /_MD_LETRA$/.test(k))[0] || '', '"xg"'); } catch (e) {} } });
  await C.evaluate(() => { mdPref('LETRA', 'xg'); mdAccAplicarLetra(); show('caja'); }); await C.waitForTimeout(600);
  const cel = await C.evaluate(() => ({ xg: document.body.classList.contains('md-letra-xg'), scroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
    btn: Math.min.apply(null, [...document.querySelectorAll('#v-caja .btn.sm')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height)),
    hd: document.querySelector('header').offsetHeight, barra: !!$('#md-barra') && getComputedStyle($('#md-barra')).display !== 'none' }));
  OK('a 390 px con letra muy grande no hay scroll horizontal y el header/barra siguen', cel.xg && cel.scroll && cel.hd < 400 && cel.barra, cel);
  await C.evaluate(() => show('config')); await C.waitForTimeout(500); await C.evaluate(() => { try { mdAjGrupo('md-aj-trat'); } catch (e) {} }); await C.waitForTimeout(300);
  const seg = await C.evaluate(() => { const l = [...document.querySelectorAll('#v-config .seg span')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height); return l.length ? Math.min.apply(null, l) : -1; });
  OK('los botones chicos y los selectores miden al menos 44 px de alto', cel.btn >= 44 && seg >= 44, { btn: cel.btn, seg });
  const celdas = await C.evaluate(() => { const tr = [...document.querySelectorAll('#v-config table:not(.md-tc) tbody tr')].filter(t => t.offsetParent); return tr.length ? Math.min.apply(null, tr.map(t => t.getBoundingClientRect().height)) : -1; });
  OK('las filas de las tablas viejas que siguen siendo tablas miden al menos 44 px', celdas === -1 || celdas >= 44, celdas);
  await C.evaluate(() => show('midia')); await C.waitForTimeout(600);
  if (SHOT) { await C.screenshot({ path: path.join(SHOT, 'real-letra.png'), fullPage: false }); }
  await C.context().close();

  /* ================= B · temporadas con el reloj ================= */
  const temporada = async (time, esperado, extra) => {
    const P = await abrir('ac-duena-1', Object.assign({ time }, extra || {}));
    await P.waitForTimeout(900);
    const r = await P.evaluate(() => ({ tema: mdTema(), clases: [...document.body.classList].filter(c => /^md-tema-/.test(c)), decor: !!$('#md-decor'), band: !!document.querySelector('#md-decor .md-acc-band'), fuego: !!document.querySelector('#md-decor .md-acc-fuego'), toast: $('#toast').textContent, linea: $('#md-linea').textContent, logo: $('.hd .logo').textContent }));
    return { P, r };
  };
  let t = await temporada('2026-09-24T14:00:00Z');
  OK('24 de septiembre: tema «santacruz», banderín verde y blanco y saludo', t.r.tema === 'santacruz' && t.r.clases.join() === 'md-tema-santacruz' && t.r.band && /Feliz aniversario, Santa Cruz/.test(t.r.toast) && /Feliz aniversario, Santa Cruz/.test(t.r.linea), t.r);
  if (SHOT) { await t.P.evaluate(() => show('midia')); await t.P.waitForTimeout(400); await t.P.screenshot({ path: path.join(SHOT, 'real-temporada.png'), clip: { x: 0, y: 0, width: 1366, height: 420 } }); }
  await t.P.context().close();
  t = await temporada('2026-09-25T14:00:00Z');
  OK('el 25 vuelve la primavera de siempre', t.r.tema === 'primavera' && !t.r.band, t.r);
  await t.P.context().close();
  const carn = await (async () => { const P = await abrir('ac-duena-1', { time: '2027-02-08T14:00:00Z' }); await P.waitForTimeout(900);
    const r = await P.evaluate(() => { const p = mdPascua(2027); return { tema: mdTema(), pascua: p.getMonth() + 1 + '/' + p.getDate(), carn: document.body.classList.contains('md-tema-carnaval'), decor: !!document.querySelector('#md-decor .md-antifaz'), toast: $('#toast').textContent }; }); await P.context().close(); return r; })();
  OK('lunes de Carnaval 2027 (Pascua 28/3 → 47 días antes es el martes 9/2): antifaz y saludo', carn.pascua === '3/28' && carn.tema === 'carnaval' && carn.carn && carn.decor && /Feliz Carnaval cruceño/.test(carn.toast), carn);
  t = await temporada('2026-12-05T14:00:00Z');
  OK('5 de diciembre: todavía no es Navidad', t.r.tema === '' && !t.r.clases.length && !t.r.decor, t.r);
  await t.P.context().close();
  t = await temporada('2026-12-20T14:00:00Z');
  OK('20 de diciembre: Navidad (árbol y copos de siempre, saludo)', t.r.tema === 'navidad' && t.r.clases.join() === 'md-tema-navidad' && t.r.decor && /Felices fiestas/.test(t.r.toast) && /Felices fiestas/.test(t.r.linea), t.r);
  await t.P.context().close();
  t = await temporada('2027-01-04T14:00:00Z');
  OK('4 de enero: sigue la Navidad (hasta el 6)', t.r.tema === 'navidad' && t.r.decor, t.r);
  await t.P.context().close();
  t = await temporada('2026-12-31T14:00:00Z');
  OK('31 de diciembre: Año Nuevo, chispas y saludo', t.r.tema === 'anionuevo' && t.r.clases.join() === 'md-tema-anionuevo' && t.r.fuego && /Feliz Año Nuevo/.test(t.r.toast) && /Feliz Año Nuevo/.test(t.r.linea), t.r);
  await t.P.context().close();
  t = await temporada('2027-01-08T14:00:00Z');
  OK('8 de enero: nada', t.r.tema === '' && !t.r.decor && !/Feliz/.test(t.r.toast), t.r);
  await t.P.context().close();
  /* con la pref de temporada apagada, nada de esto */
  t = await temporada('2026-09-24T14:00:00Z', null, { antes: () => { try { const k = Object.keys(localStorage).filter(k => /_MD_TEMP$/.test(k))[0]; localStorage.setItem(k || (location.pathname.indexOf('cosmetic') >= 0 ? 'CD_MD_TEMP' : 'SP_MD_TEMP'), '0'); } catch (e) {} } });
  const off = await t.P.evaluate(() => { mdPref('TEMP', 0); mdAplicarTema(); mdEncabezado(); const r = { pref: mdTemporadaSi(), tema: mdTema(), clases: [...document.body.classList].filter(c => /^md-tema-/.test(c)), decor: !!$('#md-decor'), linea: $('#md-linea').textContent }; return r; });
  OK('temporada apagada: ni banderín ni saludo en la línea (24 de septiembre)', !off.pref && off.tema === '' && !off.clases.length && !off.decor && !/aniversario/.test(off.linea), off);
  OK('…y el toast de bienvenida tampoco', !/aniversario/.test(t.r.toast), t.r.toast);
  await t.P.evaluate(() => { mdPref('TEMP', 1); mdAplicarTema(); mdEncabezado(); });
  OK('al prenderla vuelve el banderín', await t.P.evaluate(() => mdTema() === 'santacruz' && !!document.querySelector('#md-decor .md-acc-band')));
  await t.P.context().close();

  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
