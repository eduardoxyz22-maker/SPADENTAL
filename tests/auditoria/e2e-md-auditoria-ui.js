/* Auditoría de pantalla del bloque MODERNO: los arreglos de la ronda del 23/10.
   Dos clínicas, Chromium real, el .gs real en memoria, datos ficticios (un paciente con comillas en el
   nombre y otro en MAYÚSCULAS), roles dueña / recepción / doctora / pauta, en 1366, 1280 y 390 px.
   Cubre: el menú entra sin deslizar (1366 y 1280, cuatro roles); mdLindo única y en «Tu próximo paciente»;
   los envoltorios de verFicha/abrirPlanes/verPaciente no tocan #modal si la base no abrió (doctora con
   atención ajena; anticipo); la pastilla vuelve a verde tras reingresar la clave; la hoja «Más» sin
   contadores; la ficha en 390 con lugar para el texto; #md-pt de 32 px sin agrandar el encabezado;
   la barra del celular para la clave de pauta; «atención» con tilde; Sonri (novedades ↔ ayuda, f: en el
   DOM, pasos nuevos de Agenda, anuncio solo dueña/recepción); #modal sin md-ficha al cerrar; y la barra de
   pasos de Nueva atención legible (sus etiquetas chocaban con el estilo de la pastilla).
   Uso: PANEL=spa|cos node -r ./netguard.js e2e-md-auditoria-ui.js   (SHOT=<carpeta> guarda capturas)
   Termina en «TODO OK» o «FALLAS: n». */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const fs = require('fs');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const SHOT = process.env.SHOT || '', SUF = SPA ? 'spa' : 'cos';
if (SHOT) fs.mkdirSync(SHOT, { recursive: true });
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(84), x === undefined ? '' : JSON.stringify(x).slice(0, 300)); };
const PAC = 'D\'Angelo "Tito" O\'Neil', MAYUS = 'MARIA JOSE PEREZ GOMEZ';
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const html = fs.readFileSync(FILE, 'utf8');
  OK('mdLindo está definida una sola vez en el HTML', (html.match(/function mdLindo\(/g) || []).length === 1);
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('au-duena-1'); v.equipo = server.ctx.shaHex('au-equipo-1'); server.ctx.guardarVerif(v);
  server.ctx.VERIF_PAUTA = server.ctx.shaHex('au-pauta-1');
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const errs = [];
  const abrir = async (clave, w, h) => {
    w = w || 1366; h = h || (w < 500 ? 844 : 900);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: 1 });
    const P = await ctx.newPage();
    P.on('pageerror', e => errs.push(clave + '@' + w + ': ' + e.message.slice(0, 200))); P.on('dialog', d => d.accept());
    await P.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
      return r.abort(); });
    await P.addInitScript(() => { window.ASIS_PRUEBA = true; HTMLMediaElement.prototype.play = () => Promise.resolve(); });
    await P.clock.install({ time: new Date('2026-10-21T14:20:00-04:00') });
    await P.goto('file://' + FILE); await P.waitForTimeout(700);
    await P.fill('#gate-pass', clave); await P.click('#gate-btn'); await P.waitForTimeout(2000);
    await P.evaluate(() => { try { asisTourFin() } catch (e) {} try { closeModal() } catch (e) {} try { anuncioGritoCerrar() } catch (e) {} });
    return P;
  };
  const navOk = P => P.evaluate(() => { const n = document.querySelector('header nav'); return { sw: n.scrollWidth, cw: n.clientWidth, sl: n.scrollLeft, cls: n.className, disp: getComputedStyle(n).display, ok: n.scrollWidth <= n.clientWidth }; });

  /* ---------- la dueña siembra ---------- */
  const D = await abrir('au-duena-1');
  const S = await D.evaluate(({ PAC, MAYUS }) => {
    const hoy = hoyISO(), DRA = CFG.prof[0], OTRA = CFG.prof[1] || CFG.prof[0], srv = CFG.precios[1].nom;
    const mk = (o) => { const r = normalize(Object.assign({ id: uid(), fecha: hoy, hora: '10:00', paciente: PAC, profesional: DRA, estado: 'Atendido', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Espontánea', celular: '70012345', servicios: [{ nom: srv, cant: 1, precio: 200 }], total: 200, acuenta: 200, saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 200 }], ts: new Date().toISOString() }, o)); DATA.push(r); queue('save', r, null); return r; };
    const a1 = mk({ fecha: addDias(hoy, -10), acuenta: 150, saldo: 50, pagos: [{ metodo: 'Efectivo', monto: 150 }] });
    mk({ paciente: MAYUS, fecha: addDias(hoy, -2), celular: '70022222' });
    const citaM = mk({ paciente: MAYUS, hora: '16:30', estado: 'Agendada', origen: 'Programada', servicios: [], total: 0, acuenta: 0, pagos: [], metodo: '', celular: '70022222' });
    const propia = mk({ paciente: 'Propia Uno', hora: '11:00', celular: '70000001' });
    const ajena = mk({ paciente: 'Ajena Dos', profesional: OTRA, hora: '12:00', estado: 'Agendada', origen: 'Programada', servicios: [], total: 0, acuenta: 0, pagos: [], metodo: '', celular: '70000002' });
    mk({ paciente: 'Ajena Dos', profesional: OTRA, fecha: addDias(hoy, -5), celular: '70000002' });
    const f = pacDe(PAC); f.nombre = PAC; f.nac = '1990-05-05'; f.med = Object.assign(f.med || {}, { alergias: 'Penicilina' });
    f.planes.push(planNormalize({ nombre: 'Ortodoncia', total: 3000, prof: DRA, fecha: addDias(hoy, -5), cuotas: 6, cadaDias: 30, sesiones: [{ desc: 'Colocación', precio: 1000 }, { desc: 'Control 1', precio: 500 }] }));
    savePac(f);
    const fa = pacDe('Ajena Dos'); fa.nombre = 'Ajena Dos'; fa.planes.push(planNormalize({ nombre: 'Ortodoncia', total: 3000, prof: OTRA, fecha: addDias(hoy, -5), sesiones: [{ desc: 'Colocación', precio: 1000 }] })); savePac(fa);
    saveLocal(); flushQueue();
    return { DRA, OTRA, a1: a1.id, citaM: citaM.id, propia: propia.id, ajena: ajena.id, plan: f.planes[0].id, planAjena: fa.planes[0].id };
  }, { PAC, MAYUS });
  await D.waitForTimeout(1500);
  { const vv = server.ctx.leerVerif(); vv.prof[S.DRA] = server.ctx.shaHex('au-doc-1'); server.ctx.guardarVerif(vv); }
  await D.evaluate(() => { try { closeModal() } catch (e) {} });

  /* ---------- 2 · el menú entra (dueña 1366) ---------- */
  await D.evaluate(() => show('midia')); await D.waitForTimeout(400);
  let n = await navOk(D); OK('dueña 1366: header nav entra entero (scrollWidth <= clientWidth)', n.ok, n);
  OK('dueña 1366: la primera pestaña no queda cortada (scrollLeft 0)', n.sl === 0, n.sl);
  await D.evaluate(() => show('caja')); await D.waitForTimeout(500);
  n = await navOk(D); OK('dueña 1366: abrir Caja no desliza el menú (mdIndicador no hace scrollTo si entra)', n.ok && n.sl === 0, n);
  const txtAt = await D.evaluate(() => (document.querySelector('header nav button[data-v="atencion"] .md-nav-t') || {}).textContent);
  OK('la pestaña de la atención dice «Nueva atención» o «Atención» según el ancho', /^(Nueva atención|Atención)$/.test(txtAt || ''), txtAt);
  if (SHOT) { await D.evaluate(() => show('midia')); await D.waitForTimeout(400); await D.screenshot({ path: path.join(SHOT, SUF + '-menu-1366-duena.png'), clip: { x: 0, y: 0, width: 1366, height: 180 } }); }
  /* el nombre en MAYÚSCULAS en «Tu próximo paciente» */
  await D.evaluate(() => show('midia')); await D.waitForTimeout(500);
  const lindo = await D.evaluate((M) => ({ fn: mdLindo(M), prox: (document.querySelector('#md-prox .md-px-h b') || {}).textContent, hay: !!document.querySelector('#md-prox') }), MAYUS);
  OK('mdLindo prolija el nombre: «MARIA JOSE PEREZ GOMEZ» → «Maria Jose Perez Gomez»', lindo.fn === 'Maria Jose Perez Gomez', lindo.fn);
  OK('«Tu próximo paciente» muestra el nombre prolijo', lindo.hay && lindo.prox === 'Maria Jose Perez Gomez', lindo);
  const pasos = await D.evaluate(() => { show('atencion'); const s = document.querySelector('#md-pasos-at button:not(.on) .md-pt'); if (!s) return null; const cs = getComputedStyle(s); return { color: cs.color, bg: cs.backgroundColor, border: cs.borderStyle }; });
  OK('la barra de pasos de Nueva atención no hereda el estilo de la pastilla #md-pt (letra legible)', pasos && pasos.color !== 'rgb(233, 242, 198)' && /rgba\(0, 0, 0, 0\)|transparent/.test(pasos.bg), pasos);

  /* ---------- 4 · envoltorios con anticipo (dueña) ---------- */
  const ant = await D.evaluate(() => { try { show('pacientes'); verPaciente('Propia Uno'); const b = $$('#modal .btn').filter(x => /Anticipo/.test(x.textContent))[0]; if (!b) return 'sin botón'; b.click(); const m = $('#an-monto'); if (!m) return 'sin campo ' + $('#modal').innerText.slice(0, 60); m.value = '100'; m.dispatchEvent(new Event('input', { bubbles: true })); setRadio('anmet', 'Efectivo'); const g = $$('#modal .btn').filter(x => /Guardar anticipo/.test(x.textContent))[0]; if (!g) return 'sin guardar'; g.click(); return 'ok ' + $('#toast').textContent.slice(0, 40); } catch (e) { return 'ERR ' + e.message } });
  await D.waitForTimeout(1000);
  const antId = await D.evaluate(() => { const a = DATA.filter(r => esAnticipo(r) && r.paciente === 'Propia Uno')[0]; return a ? a.id : null; });
  if (antId) {
    await D.evaluate(() => closeModal());
    const r1 = await D.evaluate((id) => { verFicha(id); const m = $('#modal'); return { ov: $('#ov').classList.contains('on'), fcCab: !!m.querySelector('.md-fc-cab'), fichaCab: !!m.querySelector('.md-ficha-cab'), recibo: !!m.querySelector('.md-recibo'), prAt: !!m.querySelector('#md-pr-at') }; }, antId);
    OK('verFicha(anticipo) abre la ficha del paciente y NO la retoca como atención', r1.ov && r1.fichaCab && !r1.fcCab && !r1.recibo && !r1.prAt, r1);
    await D.evaluate(() => closeModal());
  } else OK('se pudo registrar un anticipo para probar verFicha(anticipo)', false, ant);
  /* #modal sin md-ficha al cerrar */
  const cls = await D.evaluate((P) => { verPaciente(P); const a = $('#modal').className; closeModal(); return { abierta: a, cerrada: $('#modal').className, ov: $('#ov').classList.contains('on') }; }, PAC);
  OK('al cerrar la ficha, #modal no se queda con la clase md-ficha', /md-ficha/.test(cls.abierta) && !/md-ficha/.test(cls.cerrada) && !cls.ov, cls);

  /* ---------- 5 · la pastilla vuelve a verde tras reingresar la clave ---------- */
  await D.evaluate(() => { show('midia'); SESION.token = 'token-roto'; SESION.exp = Date.now() + 3600000; CLAVE_MEM = ''; guardarSesion(); });
  await D.evaluate(() => pullServer()); await D.waitForTimeout(1200);
  const antes = await D.evaluate(() => ({ pedir: !!$('#ses-pedir'), pt: ($('#md-pt') || {}).className, txt: ($('#md-pt') || {}).textContent, sinc: MD_SINC.estado }));
  OK('con la sesión vencida aparece la franja de la clave y la pastilla queda roja («Falta tu clave»)', antes.pedir && /md-pt-ro/.test(antes.pt) && /Falta tu clave/.test(antes.txt), antes);
  const foco = await D.evaluate(() => { const a = ASIS_AYUDA.filter(x => /clave otra vez/.test(x.q))[0]; const el = asisPrimero(a.f); return { f: a.f, id: el ? el.id : null, p: a.p.join(' ') }; });
  OK('«Me pide la clave otra vez» señala la franja real y nombra su texto', foco.id === 'ses-pedir' && /volvé a escribir tu clave para guardar en la nube/.test(foco.p), foco);
  await D.fill('#ses-clave', 'au-duena-1'); await D.click('#ses-btn'); await D.waitForTimeout(1800);
  const despues = await D.evaluate(() => ({ pedir: !!$('#ses-pedir'), pt: ($('#md-pt') || {}).className, txt: ($('#md-pt') || {}).textContent, sinc: MD_SINC.estado }));
  OK('tras la clave, la franja se va y la pastilla vuelve a verde (pullServer pedido)', !despues.pedir && /md-pt-ok/.test(despues.pt) && despues.sinc === 'ok', despues);
  const foco2 = await D.evaluate(() => { const a = ASIS_AYUDA.filter(x => /clave otra vez/.test(x.q))[0]; const el = asisPrimero(a.f); return el ? el.id : null; });
  OK('sin la franja, la misma ayuda señala la pastilla de la conexión (existe en el celular también)', foco2 === 'md-pt', foco2);

  /* ---------- 11 · Sonri: novedades ↔ ayuda y cada f: en el DOM ---------- */
  const son = await D.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const nov = ASIS_NOVEDADES.filter(n => n.ayuda).map(n => ({ id: n.id, ok: ASIS_AYUDA.some(a => n.ayuda.test(a.q)) }));
    const navs = $$('nav button[data-v]').map(b => b.dataset.v);
    const ay = [];
    for (let i = 0; i < ASIS_AYUDA.length; i++) {
      const a = ASIS_AYUDA[i]; if (a.tour || !a.f) continue;
      try { closeModal() } catch (e) {} try { mdAgendarCerrar() } catch (e) {}
      if (navs.indexOf(a.v) >= 0) { try { show(a.v) } catch (e) {} await sleep(250); }
      const sels = [].concat(a.f); let existe = false; const det = [];
      sels.forEach(s => { let el = null; try { el = document.querySelector(s) } catch (e) { det.push(s + ':inválido'); return } if (el) existe = true; det.push(s + ':' + (el ? 'ok' : 'NO')); });
      ay.push({ q: a.q, v: a.v, existe, det });
    }
    try { closeModal() } catch (e) {} try { mdAgendarCerrar() } catch (e) {}
    const por = q => ASIS_AYUDA.filter(a => a.q === q)[0] || {};
    return { nov, ay, anuncio: por('¿Cómo pongo un anuncio para todo el equipo?').solo, hueco: (por('¿Cómo agendo en un hueco de la semana?').p || [])[2], repro: (por('No vino o hay que reprogramar la cita').p || []).join(' '), agendo: (por('¿Cómo agendo una cita?').p || []).join(' '), buscaserv: (ASIS_NOVEDADES.filter(n => n.id === 'md-buscaserv')[0] || {}).ayuda + '', anuNov: (ASIS_NOVEDADES.filter(n => n.id === 'anuncio')[0] || {}).ayuda + '' };
  });
  OK('cada ASIS_NOVEDADES con ayuda: matchea alguna pregunta de ASIS_AYUDA', son.nov.every(x => x.ok), son.nov.filter(x => !x.ok));
  /* las que dependen de un estado que no está en la prueba */
  const EXC = { '¿Me apareció «Hay una versión nueva del panel», ¿qué hago?': '#md-version solo existe cuando hay una versión nueva publicada (http/https)',
    'Me apareció «Hay una versión nueva del panel», ¿qué hago?': '#md-version solo existe cuando hay una versión nueva publicada (http/https)' };
  const sinF = son.ay.filter(x => !x.existe && !EXC[x.q]);
  OK('cada ASIS_AYUDA con f: tiene al menos un selector en el DOM (en su pestaña, con datos; excepciones listadas)', sinF.length === 0, sinF);
  son.ay.filter(x => !x.existe && EXC[x.q]).forEach(x => console.log('       excepción: «' + x.q + '» → ' + EXC[x.q]));
  OK('la ayuda del anuncio es solo para dueña/recepción (solo:\'adm\')', son.anuncio === 'adm', son.anuncio);
  OK('novedad md-buscaserv matchea «¿Cómo busco un servicio escribiendo?»', /busco un servicio/.test(son.buscaserv), son.buscaserv);
  OK('novedad anuncio matchea «¿Cómo pongo un anuncio para todo el equipo?»', /anuncio para todo el equipo/.test(son.anuNov), son.anuNov);
  OK('«hueco de la semana» paso 3: se abre el panel lateral «Agendar»', /panel lateral «Agendar»/.test(son.hueco || ''), son.hueco);
  OK('«No vino o hay que reprogramar»: Reprogramar está dentro de «⋯ Más»', /«⋯ Más»/.test(son.repro) && /Reprogramar/.test(son.repro), son.repro.slice(0, 120));
  OK('«¿Cómo agendo una cita?» menciona «＋ Agendar cita» y el panel lateral', /＋ Agendar cita/.test(son.agendo) && /panel/.test(son.agendo), son.agendo.slice(0, 120));
  /* ---------- 10 · «atención» con tilde en Ajustes › Equipo ---------- */
  const tx = await D.evaluate(() => { show('config'); try { mdAjGrupo('md-aj-equipo') } catch (e) {} const el = $('#md-aj-equipo') || $('#v-config'); return el.innerText; });
  OK('Ajustes › Equipo: «atención» con tilde (el plural «atenciones» no la lleva)', !/\batencion\b/.test(tx) && /atenci(ón|ones) este mes/.test(tx), (tx.match(/.{0,30}atenci.{0,20}/g) || []).slice(0, 3));
  const md = await D.evaluate(() => { const s = ($$('script').map(x => x.textContent).join('\n')); const i = s.indexOf('/* ===== MODERNO INI'); const t = s.slice(i); const m = t.match(/'[^'\n]*\batencion\b[^'\n]*'/g) || []; /* los k: de Sonri son palabras clave sin tildes a propósito (todo minúsculas): no se ven */ return m.filter(x => /[A-ZÁÉÍÓÚÑ«»:.,]/.test(x.replace(/'/g, '')) && !/data-|md-|v-atencion|#atencion|show\(|'atencion'/.test(x)); });
  OK('en el bloque no quedan textos visibles con «atencion» sin tilde', md.length === 0, md.slice(0, 4));
  await D.evaluate(() => show('midia'));

  /* ---------- 2 · el menú en 1280 (dueña) y en los otros roles ---------- */
  for (const [rol, clave] of [['dueña', 'au-duena-1'], ['recepción', 'au-equipo-1'], ['doctora', 'au-doc-1'], ['pauta', 'au-pauta-1']]) {
    for (const w of [1366, 1280]) {
      if (rol === 'dueña' && w === 1366) continue;
      const P = await abrir(clave, w);
      const r = await navOk(P);
      OK(rol + ' ' + w + ': el menú entra entero y sin deslizar', r.ok && r.sl === 0, r);
      if (rol === 'pauta' && w === 1366) {
        const hoja = await P.evaluate(() => ({ rol: ROL, duena: (document.querySelector('#nav-duena .md-sr') || {}).textContent }));
        OK('pauta: el botón de sesión dice «Sesión» (no «Recepción»)', hoja.rol === 'pauta' && hoja.duena === 'Sesión', hoja);
      }
      await P.context().close();
    }
  }

  /* ---------- 4 · doctora: verFicha/abrirPlanes/verPaciente de una ajena no tocan #modal ---------- */
  const M = await abrir('au-doc-1');
  const r2 = await M.evaluate((S) => {
    show('pacientes'); verPaciente('Propia Uno'); const h1 = $('#modal').innerHTML; closeModal();
    const t0 = $('#toast').textContent; verFicha(S.ajena); const m = $('#modal');
    const out = { rol: ROL, propiaAbrio: /md-ficha-cab/.test(h1), igual: m.innerHTML === h1, ov: $('#ov').classList.contains('on'), fcCab: !!m.querySelector('.md-fc-cab'), toast: $('#toast').textContent.slice(0, 60), cambioToast: $('#toast').textContent !== t0 };
    verPaciente('Propia Uno'); verDiente('Propia Uno', '11'); const h2 = $('#modal').innerHTML; closeModal(); verFicha(S.ajena);
    out.pieza = { igual: $('#modal').innerHTML === h2, fcCab: !!$('#modal').querySelector('.md-fc-cab'), ov: $('#ov').classList.contains('on') };
    closeModal(); const h3 = $('#modal').innerHTML; try { abrirPlanes('Ajena Dos') } catch (e) { out.errPlanes = e.message } out.planes = { igual: $('#modal').innerHTML === h3, ov: $('#ov').classList.contains('on'), vid: $$('#modal .md-vid-link').length };
    try { verPaciente('Ajena Dos') } catch (e) { out.errPac = e.message } out.pac = { igual: $('#modal').innerHTML === h3, ov: $('#ov').classList.contains('on') };
    try { verPlan('Ajena Dos', S.planAjena) } catch (e) { out.errPlan = e.message } out.plan = { igual: $('#modal').innerHTML === h3, ov: $('#ov').classList.contains('on') };
    try { cobrarSaldo(S.ajena) } catch (e) { out.errCobro = e.message } out.cobro = { igual: $('#modal').innerHTML === h3, ov: $('#ov').classList.contains('on') };
    return out; }, S);
  OK('doctora: verFicha(ajena) avisa y deja #modal como estaba (sin cabecera de cita, sin abrir)', r2.rol === 'doctora' && r2.propiaAbrio && r2.igual && !r2.ov && !r2.fcCab, r2);
  OK('doctora: con la ventana vieja = pieza, verFicha(ajena) tampoco la toca', r2.pieza.igual && !r2.pieza.fcCab && !r2.pieza.ov, r2.pieza);
  OK('doctora: abrirPlanes(ajena) no abre ni agrega videos', r2.planes.igual && !r2.planes.ov, r2.planes);
  OK('doctora: verPaciente(ajena) y verPlan(ajena) no tocan #modal', r2.pac.igual && !r2.pac.ov && r2.plan.igual && !r2.plan.ov, { pac: r2.pac, plan: r2.plan, e: [r2.errPac, r2.errPlan] });
  OK('doctora: cobrarSaldo(ajena) no toca #modal', r2.cobro.igual && !r2.cobro.ov, r2.cobro);
  const r3 = await M.evaluate((S) => { verFicha(S.propia); const m = $('#modal'); const out = { ov: $('#ov').classList.contains('on'), fcCab: !!m.querySelector('.md-fc-cab'), recibo: !!m.querySelector('.md-recibo') || !!m.querySelector('.md-fc-est') }; closeModal(); return out; }, S);
  OK('doctora: su propia atención sí se abre con la cara nueva', r3.ov && r3.fcCab, r3);
  await M.context().close();

  /* ---------- 390 · hoja «Más», ficha, pastilla, pauta ---------- */
  const C = await abrir('au-duena-1', 390);
  const hoja = await C.evaluate(() => { show('midia'); mdAbrirHoja(); return [...document.querySelectorAll('#md-hoja button[data-i]')].map(x => x.textContent); });
  OK('hoja «Más» (390): los nombres van sin el contador («Agenda», no «Agenda 2»)', hoja.length > 5 && hoja.every(t => !/\d/.test(t)) && hoja.indexOf('Mi día') >= 0 && hoja.indexOf('Nueva atención') >= 0, hoja);
  if (SHOT) { await C.waitForTimeout(700); await C.evaluate(() => { const t = $('#toast'); if (t) t.classList.remove('md-t-on', 'on'); }); await C.screenshot({ path: path.join(SHOT, SUF + '-hoja-mas-390.png') }); }
  await C.evaluate(() => mdCerrarHoja());
  const pt = await C.evaluate(() => { const p = $('#md-pt'), hd = $('header'); const r = p.getBoundingClientRect(); const h1 = hd.getBoundingClientRect().height; p.style.cssText = 'min-height:0;padding:3px 11px;margin:0'; const h0 = hd.getBoundingClientRect().height; const r0 = p.getBoundingClientRect(); p.style.cssText = ''; return { alto: Math.round(r.height), header: Math.round(h1), conViejo: Math.round(h0), altoViejo: Math.round(r0.height) }; });
  OK('390: #md-pt mide al menos 32 px de alto y no agranda el encabezado (vs. la pastilla de 25 px)', pt.alto >= 32 && pt.header - pt.conViejo <= 1, pt);
  const ptD = await D.evaluate(() => { const p = $('#md-pt'), hd = $('header'); const r = p.getBoundingClientRect(); const h1 = hd.getBoundingClientRect().height; p.style.cssText = 'min-height:0;padding:3px 11px;margin:0'; const h0 = hd.getBoundingClientRect().height; const r0 = p.getBoundingClientRect(); p.style.cssText = ''; return { alto: Math.round(r.height), header: Math.round(h1), conViejo: Math.round(h0), altoViejo: Math.round(r0.height) }; });
  OK('1366: #md-pt mide al menos 32 px de alto y no agranda el encabezado (vs. la pastilla de 25 px)', ptD.alto >= 32 && ptD.header - ptD.conViejo <= 1, ptD);
  const ficha = await C.evaluate((M) => { show('pacientes'); verPaciente(M); const cab = document.querySelector('.md-ficha-cab'), t = document.querySelector('.md-ficha-txt'), wa = document.querySelector('.md-ficha-cab .md-wa'); if (!cab || !t) return null; const rc = cab.getBoundingClientRect(), rt = t.getBoundingClientRect(), rw = wa ? wa.getBoundingClientRect() : null; return { cab: Math.round(rc.width), txt: Math.round(rt.width), pct: Math.round(rt.width / rc.width * 100), waAbajo: rw ? rw.top >= rt.top + 20 : null, h3: ($('#modal h3') || {}).textContent }; }, MAYUS);
  OK('ficha en 390: el texto tiene al menos el 60 % del ancho y WhatsApp baja de fila', ficha && ficha.pct >= 60 && ficha.waAbajo !== false, ficha);
  OK('ficha en 390: el título prolijo (mdLindo)', ficha && ficha.h3 === 'Maria Jose Perez Gomez', ficha && ficha.h3);
  if (SHOT) { await C.waitForTimeout(900); await C.evaluate(() => { const t = $('#toast'); if (t) t.classList.remove('md-t-on', 'on'); }); await C.screenshot({ path: path.join(SHOT, SUF + '-ficha-390.png') }); }
  await C.evaluate(() => closeModal());
  await C.context().close();
  const Q = await abrir('au-pauta-1', 390);
  const barra = await Q.evaluate(() => ({ rol: ROL, barra: [...document.querySelectorAll('#md-barra button')].map(x => x.dataset.md), vista: asisVista(), hoja: (() => { mdAbrirHoja(); const t = [...document.querySelectorAll('#md-hoja button[data-i]')].map(x => x.textContent); mdCerrarHoja(); return t; })() }));
  OK('pauta en el celular: la barra ofrece solo Pauta y «Más» (sesión), nada que no haga nada', barra.rol === 'pauta' && barra.barra.join(',') === 'pauta,mas' && barra.hoja.every(t => /Pauta|Sesión/.test(t)), barra);
  await Q.context().close();
  await D.context().close();
  OK('sin errores de JavaScript en ninguna pantalla', errs.length === 0, errs.slice(0, 5));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
