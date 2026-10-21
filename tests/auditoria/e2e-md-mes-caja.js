/* Mejora 5 · la barra de periodo de Panel y Caja («◀ Octubre 2026 ▶», botones por cada periodo del select, «Este mes»,
   «vs. septiembre: ▲ x% cobrado») y Mejora 7 · la franja «Entró, Salió, Queda» de la Caja con la dona por forma de pago.
   Chromium real, .gs real en memoria, sesión de la dueña. Sin red real. Datos ficticios.
   Lo que se compara: la barra mueve los controles viejos (que siguen en el DOM, ocultos) y da lo mismo que moverlos a mano;
   los números de la franja son los mismos que los de #cj-kpis (oculto) en cada periodo, y después de un cobro y un egreso.
   Uso: PANEL=spa|cos node -r ./netguard.js e2e-md-mes-caja.js   (SHOT=carpeta para las capturas) */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const fs = require('fs');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const SHOT_DIR = process.env.SHOT || '';
const SHOT = SHOT_DIR ? (n => { fs.mkdirSync(SHOT_DIR, { recursive: true }); return path.join(SHOT_DIR, n + (SPA ? '-spa' : '-cos') + '.png'); }) : null;
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(78), x === undefined ? '' : JSON.stringify(x)); };
const num = s => +String(s || '').replace(/[^\d-]/g, '') || 0;
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('pa-duena-1'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const D = await ctx.newPage();
  D.on('pageerror', e => errs.push(e.message)); D.on('dialog', d => d.accept());
  await D.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
    if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
    if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
  await D.clock.install({ time: new Date('2026-10-20T14:15:00Z') });   /* martes 20/10/2026 */
  await D.goto('file://' + FILE); await D.waitForTimeout(800);
  await D.fill('#gate-pass', 'pa-duena-1'); await D.click('#gate-btn'); await D.waitForTimeout(2000);
  const ocultar = on => D.evaluate(on => { ['header', '#md-barra', '#toast', '#asis'].forEach(s => { const e = document.querySelector(s); if (e) e.style.visibility = on ? 'hidden' : ''; }); }, on);

  /* ---------- datos ficticios: octubre con las cuatro formas de pago, un saldo, uno sin forma, uno del cuaderno, septiembre y 2025 ---------- */
  await D.evaluate(() => {
    let i = 0;
    const at = (pac, fecha, total, metodo, o) => { o = o || {};
      const r = normalize(Object.assign({ id: uid(), fecha, hora: '10:00', paciente: pac, profesional: 'Dra. Valeria Rojas', estado: 'Atendido', tipo: 'Recurrente', canal: CFG.canales[0], origen: 'Espontánea',
        celular: '7012' + String(3400 + (i++)).slice(-4), servicios: [{ nom: 'Tratamiento', cant: 1, precio: total }], total, acuenta: total, saldo: 0, metodo, pagos: metodo ? [{ metodo, monto: total }] : [], ts: new Date().toISOString() }, o));
      DATA.push(r); queue('save', r, null); return r; };
    at('Pac Uno', '2026-10-03', 1800, 'QR'); at('Pac Dos', '2026-10-05', 2200, 'Efectivo'); at('Pac Tres', '2026-10-07', 1400, 'Tarjeta');
    at('Pac Cuatro', '2026-10-08', 150, 'Transferencia'); at('Pac Cinco', '2026-10-19', 600, 'Efectivo'); at('Pac Seis', '2026-10-20', 300, 'QR');
    at('Mario Justiniano', '2026-10-18', 1000, 'Efectivo', { acuenta: 400, saldo: 600, pagos: [{ metodo: 'Efectivo', monto: 400 }] });
    at('Sofía Terrazas', '2026-10-13', 700, '', { metodo: '', pagos: [] });                                          /* entró y no se anotó cómo */
    at('Raúl Montero', '2026-10-16', 200, 'Mixto', { pagos: [{ metodo: 'QR', monto: 120 }] });                       /* 80 sin identificar */
    at('Del Cuaderno', '2026-10-02', 300, '', { metodo: '', pagos: [], obs: 'Importado del cuaderno 2025' });         /* histórico: no se puede recuperar */
    at('Pac Sep Uno', '2026-09-10', 1800, 'QR'); at('Pac Sep Dos', '2026-09-20', 900, 'Efectivo'); at('Pac Sep Tres', '2026-09-28', 500, 'Tarjeta');
    at('Pac Viejo', '2025-11-10', 2000, 'Efectivo');
    guardarEgreso({ fecha: '2026-10-02', categoria: 'Alquiler', detalle: 'Alquiler del consultorio', proveedor: 'Inmobiliaria Sur', monto: 2500, metodo: 'Transferencia' });
    guardarEgreso({ fecha: '2026-10-07', categoria: 'Laboratorio', detalle: 'Corona 36', proveedor: 'Lab. Dental Norte', monto: 450, metodo: 'Efectivo' });
    guardarEgreso({ fecha: '2026-10-19', categoria: 'Otro', detalle: 'Agua y limpieza', proveedor: '', monto: 120, metodo: 'Efectivo' });
    guardarEgreso({ fecha: '2026-09-28', categoria: 'Publicidad', detalle: 'Pauta de septiembre', proveedor: 'Meta', monto: 600, metodo: 'Tarjeta' });
    saveLocal(); return flushQueue(); });
  await D.waitForTimeout(1500);

  /* lectores: los KPIs viejos (el número final, aunque esté contando animado) y la franja nueva */
  const kpisCaja = () => D.evaluate(() => { const o = {}; document.querySelectorAll('#cj-kpis .kpi').forEach(k => { const v = k.querySelector('.v'); o[k.querySelector('.k').textContent.trim()] = (v.getAttribute('data-md-contado') || v.textContent).trim(); }); return o; });
  const franja = () => D.evaluate(() => { const f = $('#md-mc-caja'); if (!f) return null; const t = s => { const e = f.querySelector(s); return e ? e.textContent.trim() : null; };
    return { entro: t('[data-k="entro"] b'), salio: t('[data-k="salio"] b'), queda: t('[data-k="queda"] b'), porCobrar: t('[data-k="porcobrar"]'), sinIdent: t('[data-k="sinident"]'),
      sinIdentV: +(f.querySelector('[data-k="sinident"]') || {}).dataset.v, salioSub: t('[data-k="salio"] em'), titulo: t('h3'),
      ley: [...f.querySelectorAll('.md-mc-don li[data-m]')].map(l => ({ m: l.dataset.m, v: +l.dataset.v, txt: l.querySelector('b').textContent })),
      centro: [...f.querySelectorAll('.md-mc-don svg text')].map(x => x.textContent).join(' '), totalDona: +f.querySelector('.md-mc-don').dataset.total,
      banco: +f.querySelector('.md-mc-banco').dataset.banco, cajon: +f.querySelector('.md-mc-banco').dataset.cajon, bancoTxt: t('.md-mc-banco'),
      visible: f.getBoundingClientRect().height > 0, kpisOcultos: getComputedStyle($('#cj-kpis')).display === 'none' }; });
  const bs = n => 'Bs ' + Math.round(n).toLocaleString('es-BO');
  /* la franja contra los KPIs viejos: Entró = Cobrado, Salió = Egresos, Queda = Caja neta, Por cobrar, Sin identificar,
     la dona suma lo cobrado y banco/cajón = «QR + Transf.» / «Efectivo» */
  const coincide = async (txt) => {
    const K = await kpisCaja(), F = await franja();
    const sinK = K['Sin identificar'], conc = num(sinK) === 0;
    const ok = F && F.entro === K['Cobrado'] && F.salio === K['➖ Egresos'] && F.queda === K['Caja neta'] && F.porCobrar === '⏳ Por cobrar ' + K['Por cobrar'] &&
      (conc ? /Todo conciliado/.test(F.sinIdent) : F.sinIdent.indexOf('Sin identificar ' + sinK) >= 0) &&
      Math.abs(F.ley.reduce((a, l) => a + l.v, 0) - num(K['Cobrado'])) < 1 && Math.abs(F.totalDona - num(K['Cobrado'])) < 1 && F.centro.indexOf(K['Cobrado']) >= 0 &&
      bs(F.banco) === K['📱 QR + 🏦 Transf.'] && bs(F.cajon) === K['💵 Efectivo'] && F.visible && F.kpisOcultos;
    OK(txt, ok, ok ? [F.entro, F.salio, F.queda, F.porCobrar, F.sinIdent] : { K, F });
    return { K, F };
  };
  const barra = k => D.evaluate(k => { const b = $('#md-mc-bar-' + k); if (!b) return null; const vis = e => !!e && e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'none';
    return { visible: vis(b), segs: [...b.querySelectorAll('.md-mc-seg button')].map(x => x.textContent), on: (b.querySelector('.md-mc-seg button.on') || {}).textContent, label: b.querySelector('.md-mc-l').textContent,
      flechas: vis(b.querySelector('[data-d="-1"]')) && vis(b.querySelector('[data-d="1"]')), hoy: vis(b.querySelector('.md-mc-hoy')) ? b.querySelector('.md-mc-hoy').textContent : null, hoyYa: b.querySelector('.md-mc-hoy').classList.contains('ya'),
      cmp: vis(b.querySelector('.md-mc-cmp')) ? b.querySelector('.md-mc-cmp').textContent : null, der: [...b.querySelectorAll('.md-mc-der button')].filter(vis).map(x => (x.id || '') + ':' + x.textContent.trim()) }; }, k);
  const click = async (k, sel, txt) => { const L = txt ? D.locator('#md-mc-bar-' + k + ' ' + sel, { hasText: txt }) : D.locator('#md-mc-bar-' + k + ' ' + sel); await L.first().click(); await D.waitForTimeout(350); };
  const optsTxt = sel => D.evaluate(sel => [...document.querySelectorAll(sel + ' option')].map(o => o.textContent.trim().replace(/^(un|una)\s+/i, '').replace(/^./, c => c.toUpperCase())), sel);
  const cobradoPanel = () => D.evaluate(() => { const k = [...document.querySelectorAll('#p-kpis .kpi')].find(x => /^Cobrado/.test(x.querySelector('.k').textContent)); const v = k.querySelector('.v'); return { v: (v.getAttribute('data-md-contado') || v.textContent).trim(), mom: (k.querySelector('.mom') || {}).textContent || '' }; });

  /* ================= PANEL ================= */
  await D.evaluate(() => show('panel')); await D.waitForTimeout(600);
  let B = await barra('panel');
  const viejoPanel = await D.evaluate(() => ({ rango: $('#p-rango').getBoundingClientRect().height, mes: $('#p-mes').getBoundingClientRect().height, enDom: !!$('#p-rango') && !!$('#p-mes') && !!$('#p-anio') }));
  OK('Panel: aparece la barra y los controles viejos quedan en el DOM pero no se ven', B && B.visible && viejoPanel.enDom && viejoPanel.rango === 0 && viejoPanel.mes === 0, { B, viejoPanel });
  OK('los botones son exactamente los periodos que tiene el select (sin inventar ninguno)', JSON.stringify(B.segs) === JSON.stringify(await optsTxt('#p-rango')) && B.on === 'Mes' && !B.segs.includes('Semana'), B.segs);
  OK('«◀ Octubre 2026 ▶», «Este mes» (ya en el actual) e «Informe del mes» a la derecha (el mismo botón)', B.label === 'Octubre 2026' && B.flechas && B.hoy === 'Este mes' && B.hoyYa && B.der.length === 1 && /^btn-informe:🖨 Informe del mes/.test(B.der[0]), B);
  let CP = await cobradoPanel();
  const momPanel = /([▲▼] \d+(?:[.,]\d)?%) vs (\S+)/.exec(CP.mom);
  OK('la comparación con septiembre es la misma que la del KPI «Cobrado» del Panel', momPanel && B.cmp === 'vs. ' + momPanel[2] + ': ' + momPanel[1] + ' cobrado', { cmp: B.cmp, kpi: CP.mom });
  await click('panel', '[data-d="-1"]'); B = await barra('panel'); CP = await cobradoPanel();
  const pm = await D.evaluate(() => $('#p-mes').value);
  OK('◀ pasa a septiembre: el control viejo cambia y el Panel se repinta', pm === '2026-09' && B.label === 'Septiembre 2026' && !B.hoyYa && num(CP.v) === 3200, { pm, label: B.label, CP });
  /* lo mismo, a mano con el control viejo */
  await D.evaluate(() => { const e = $('#p-mes'); e.value = '2026-10'; e.dispatchEvent(new Event('input', { bubbles: true })); e.value = '2026-09'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await D.waitForTimeout(300);
  const CPmano = await cobradoPanel(), Bmano = await barra('panel');
  OK('…y da lo mismo que cambiar el control viejo a mano (la barra lo sigue)', CPmano.v === CP.v && Bmano.label === 'Septiembre 2026', [CP.v, CPmano.v]);
  await click('panel', '[data-d="1"]'); await click('panel', '[data-d="1"]'); B = await barra('panel');
  OK('▶ ▶ llega a noviembre 2026', B.label === 'Noviembre 2026' && await D.evaluate(() => $('#p-mes').value) === '2026-11', B.label);
  await click('panel', '.md-mc-hoy'); B = await barra('panel');
  OK('«Este mes» vuelve a octubre', B.label === 'Octubre 2026' && B.hoyYa && await D.evaluate(() => $('#p-mes').value) === '2026-10');
  await click('panel', '.md-mc-seg button', 'Año'); B = await barra('panel');
  let st = await D.evaluate(() => ({ r: $('#p-rango').value, a: $('#p-anio').value, wrap: $('#wrap-p-anio').style.display, wm: $('#wrap-p-mes').style.display }));
  OK('«Año»: el select viejo pasa a «anio» (su propio aviso corre) y la barra dice 2026', st.r === 'anio' && st.a === '2026' && st.wrap === '' && st.wm === 'none' && B.label === '2026' && B.hoy === 'Este año' && B.on === 'Año', { st, B });
  OK('en el año compara con 2025', /^vs\. 2025: [▲▼] \d+(?:[.,]\d)?% cobrado$/.test(B.cmp || ''), B.cmp);
  await click('panel', '[data-d="-1"]'); B = await barra('panel');
  OK('◀ en el año → 2025', B.label === '2025' && await D.evaluate(() => $('#p-anio').value) === '2025');
  await click('panel', '.md-mc-hoy'); B = await barra('panel');
  OK('«Este año» vuelve a 2026', B.label === '2026' && B.hoyYa);
  await click('panel', '.md-mc-seg button', 'Todo'); B = await barra('panel');
  OK('«Todo»: sin flechas, sin «Este…» y sin comparación', B.label === 'Todo el historial' && !B.flechas && B.hoy === null && B.cmp === null && await D.evaluate(() => $('#p-rango').value) === 'todo', B);
  await click('panel', '.md-mc-seg button', 'Mes'); B = await barra('panel');
  OK('y «Mes» vuelve a octubre', B.label === 'Octubre 2026' && await D.evaluate(() => $('#p-rango').value) === 'mes');
  if (SHOT) { await ocultar(true); await D.evaluate(() => window.scrollTo(0, 0)); await D.waitForTimeout(500);
    const r = await D.evaluate(() => { const c = $('#v-panel > .card'), r = c.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY - 10), width: 1366, height: r.height + 20 }; });
    await D.screenshot({ path: SHOT('mes-panel-compu'), clip: r, fullPage: true }); await ocultar(false); }

  /* ================= CAJA ================= */
  await D.evaluate(() => show('caja')); await D.waitForTimeout(700);
  B = await barra('caja');
  const viejoCaja = await D.evaluate(() => ({ rango: $('#c-rango').getBoundingClientRect().height, mes: $('#c-mes').getBoundingClientRect().height, enDom: ['#c-rango', '#c-dia', '#c-mes', '#c-quin', '#c-anio', '#cj-kpis'].every(s => !!$(s)) }));
  OK('Caja: aparece la barra y los controles viejos quedan en el DOM pero no se ven', B && B.visible && viejoCaja.enDom && viejoCaja.rango === 0 && viejoCaja.mes === 0, { B, viejoCaja });
  OK('un botón por cada periodo del select de la Caja (Día, Quincena, Mes, Año, Todo)', JSON.stringify(B.segs) === JSON.stringify(await optsTxt('#c-rango')) && B.segs.join() === 'Día,Quincena,Mes,Año,Todo' && B.on === 'Mes', B.segs);
  OK('«◀ Octubre 2026 ▶» y «Este mes»', B.label === 'Octubre 2026' && B.flechas && B.hoy === 'Este mes' && B.hoyYa, B);
  let R = await coincide('octubre: Entró/Salió/Queda/Por cobrar/Sin identificar y la dona = #cj-kpis');
  const oct = R;
  OK('octubre a mano: entró 8.050, salió 3.070, queda 4.980, por cobrar 600, sin identificar 1.080 (700 + 80 + 300 del cuaderno)', R.F.entro === 'Bs 8.050' && R.F.salio === 'Bs 3.070' && R.F.queda === 'Bs 4.980' && /Bs 600/.test(R.F.porCobrar) && /Bs 1\.080/.test(R.F.sinIdent) && /2 por completar · 1 del cuaderno/.test(R.F.sinIdent) && R.F.salioSub === '3 egresos', R.F);
  OK('la dona: Efectivo 3.200, QR 2.220, Tarjeta 1.400, Transferencia 150 y Sin identificar 1.080', JSON.stringify(R.F.ley.map(l => [l.m, l.v])) === JSON.stringify([['Efectivo', 3200], ['QR', 2220], ['Tarjeta', 1400], ['Transferencia', 150], ['Sin identificar', 1080]]), R.F.ley);
  OK('🏦 banco 2.370 (QR + transferencias) · 💵 cajón 3.200 · 💳 tarjeta 1.400', /En el banco debería haber Bs 2\.370 · 💵 en el cajón Bs 3\.200 · 💳 por tarjeta Bs 1\.400/.test(R.F.bancoTxt) && /salieron Bs 570 en egresos/.test(R.F.bancoTxt), R.F.bancoTxt);
  OK('el título dice el periodo', /^Octubre 2026 · lo que pasó con la plata$/i.test(R.F.titulo), R.F.titulo);
  /* «vs. septiembre»: lo cobrado de octubre contra septiembre (los dos sacados de los KPIs viejos) */
  B = await barra('caja');
  await click('caja', '[data-d="-1"]');
  const sep = await coincide('◀ septiembre: la franja sigue igual a #cj-kpis');
  B = await barra('caja');
  const st2 = await D.evaluate(() => [$('#c-rango').value, $('#c-mes').value]);
  OK('◀ movió el control viejo a 2026-09 y la barra dice «Septiembre 2026»', st2.join() === 'mes,2026-09' && B.label === 'Septiembre 2026', st2);
  await D.evaluate(() => { const e = $('#c-mes'); e.value = '2026-10'; e.dispatchEvent(new Event('input', { bubbles: true })); e.value = '2026-09'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await D.waitForTimeout(400);
  const sepMano = await kpisCaja();
  OK('…y los números son los mismos que cambiando el control viejo a mano', JSON.stringify(sepMano) === JSON.stringify(sep.K) && (await franja()).entro === sep.F.entro, { mano: sepMano.Cobrado, barra: sep.K.Cobrado });
  await click('caja', '.md-mc-hoy'); B = await barra('caja');
  const pct = (num(oct.K['Cobrado']) - num(sep.K['Cobrado'])) / num(sep.K['Cobrado']) * 100;
  const esperadoCmp = 'vs. septiembre: ' + (pct > 0 ? '▲' : '▼') + ' ' + (Math.abs(pct) >= 10 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)) + '% cobrado';
  OK('«Este mes» vuelve a octubre y compara con septiembre (' + esperadoCmp + ')', B.label === 'Octubre 2026' && B.hoyYa && B.cmp === esperadoCmp && await D.evaluate(() => $('#c-mes').value) === '2026-10', B.cmp);
  /* cada periodo del select */
  await click('caja', '.md-mc-seg button', 'Día'); B = await barra('caja');
  st = await D.evaluate(() => ({ r: $('#c-rango').value, d: $('#c-dia').value, w: $('#wrap-c-dia').style.display }));
  OK('«Día»: el select viejo pasa a «dia» y la barra dice «Martes 20 de octubre» con «Hoy»', st.r === 'dia' && st.d === '2026-10-20' && st.w === '' && B.label === 'Martes 20 de octubre' && B.hoy === 'Hoy' && B.hoyYa, { st, B });
  OK('el día compara con ayer', /^vs\. ayer: [▲▼=]/.test(B.cmp || ''), B.cmp);
  await coincide('hoy: la franja = #cj-kpis');
  await click('caja', '[data-d="-1"]'); B = await barra('caja');
  R = await coincide('◀ ayer (lunes 19): la franja = #cj-kpis');
  OK('ayer: «Lunes 19 de octubre», entró 600 y salió 120', B.label === 'Lunes 19 de octubre' && R.F.entro === 'Bs 600' && R.F.salio === 'Bs 120' && await D.evaluate(() => $('#c-dia').value) === '2026-10-19', [B.label, R.F.entro, R.F.salio]);
  await click('caja', '.md-mc-hoy'); OK('«Hoy» vuelve al 20', await D.evaluate(() => $('#c-dia').value) === '2026-10-20');
  await click('caja', '.md-mc-seg button', 'Quincena'); B = await barra('caja');
  st = await D.evaluate(() => ({ r: $('#c-rango').value, m: $('#c-mes').value, q: $('#c-quin').value }));
  OK('«Quincena»: la que se está viviendo, «16 al 31 de octubre 2026»', st.r === 'quincena' && st.q === '2' && st.m === '2026-10' && B.label === '16 al 31 de octubre 2026' && B.hoy === 'Esta quincena' && B.hoyYa, { st, B });
  await coincide('2ª quincena de octubre: la franja = #cj-kpis');
  await click('caja', '[data-d="-1"]'); B = await barra('caja');
  OK('◀ → «1 al 15 de octubre 2026»', B.label === '1 al 15 de octubre 2026' && await D.evaluate(() => $('#c-quin').value) === '1', B.label);
  await coincide('1ª quincena de octubre: la franja = #cj-kpis');
  await click('caja', '[data-d="-1"]'); B = await barra('caja');
  st = await D.evaluate(() => ({ m: $('#c-mes').value, q: $('#c-quin').value }));
  OK('◀ otra vez → «16 al 30 de septiembre 2026» (cambia el mes y la quincena)', B.label === '16 al 30 de septiembre 2026' && st.m === '2026-09' && st.q === '2', { st, l: B.label });
  await coincide('2ª quincena de septiembre: la franja = #cj-kpis');
  await click('caja', '.md-mc-hoy'); st = await D.evaluate(() => ({ m: $('#c-mes').value, q: $('#c-quin').value }));
  OK('«Esta quincena» vuelve a la 2ª de octubre', st.m === '2026-10' && st.q === '2', st);
  await click('caja', '.md-mc-seg button', 'Año'); B = await barra('caja');
  OK('«Año» → 2026, compara con 2025', B.label === '2026' && B.hoy === 'Este año' && /^vs\. 2025: [▲▼]/.test(B.cmp || '') && await D.evaluate(() => $('#c-rango').value) === 'anio', B);
  await coincide('2026: la franja = #cj-kpis');
  await click('caja', '[data-d="-1"]'); R = await coincide('◀ 2025: la franja = #cj-kpis');
  OK('2025: entró 2.000 en efectivo, sin egresos', R.F.entro === 'Bs 2.000' && R.F.salio === 'Bs 0' && R.F.ley.length === 1 && R.F.ley[0].m === 'Efectivo', R.F);
  await click('caja', '.md-mc-seg button', 'Todo'); B = await barra('caja');
  OK('«Todo»: sin flechas ni comparación', B.label === 'Todo el historial' && !B.flechas && B.cmp === null && B.hoy === null);
  await coincide('todo: la franja = #cj-kpis');
  await click('caja', '.md-mc-seg button', 'Mes'); await click('caja', '.md-mc-hoy');
  OK('vuelta a «Mes» de octubre', (await barra('caja')).label === 'Octubre 2026' && await D.evaluate(() => $('#c-rango').value + $('#c-mes').value) === 'mes2026-10');
  /* el ⓘ del histórico */
  const info = await D.evaluate(() => { const b = document.querySelector('#md-mc-caja [data-k="historico"]'); const p = $('#md-mc-exp'); const antes = p && p.hidden; if (b) b.click(); return { hay: !!b, title: b && b.title, antes, despues: p && $('#md-mc-exp').hidden, txt: p && p.textContent }; });
  OK('el texto suelto del histórico ahora es un «ⓘ» que se despliega (y tiene el mismo texto)', info.hay && info.antes === true && info.despues === false && info.txt.indexOf(await D.evaluate(() => AVISO_COBROS_HISTORICOS)) >= 0 && info.title === await D.evaluate(() => AVISO_COBROS_HISTORICOS), info);
  OK('ningún monto muestra NaN ni undefined', !/NaN|undefined/.test(await D.evaluate(() => $('#md-mc-caja').innerText + $('#md-mc-bar-caja').innerText + $('#md-mc-bar-panel').innerText)));
  if (SHOT) { await ocultar(true); await D.evaluate(() => window.scrollTo(0, 0)); await D.waitForTimeout(900);
    const r = await D.evaluate(() => { const a = $('#v-caja > .card').getBoundingClientRect(), z = $('#md-mc-caja').getBoundingClientRect(); return { x: 0, y: Math.max(0, a.top + scrollY - 10), width: 1366, height: z.bottom - a.top + 20 }; });
    await D.screenshot({ path: SHOT('mes-caja-compu'), clip: r, fullPage: true }); await ocultar(false); }

  /* ---------- un cobro y un egreso: la franja se repinta con la caja ---------- */
  const antes = await franja();
  await D.locator('#cj-deuda .md-pc-d', { hasText: 'Mario Justiniano' }).locator('button', { hasText: 'Cobrar' }).click(); await D.waitForTimeout(400);
  await D.evaluate(() => { $('#cp-m').value = '600'; const r = document.querySelector('input[name="cpmet"][value="Tarjeta"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
  await D.locator('#modal button', { hasText: 'Guardar pago' }).first().click(); await D.waitForTimeout(1600);
  R = await coincide('después de un cobro de 600 con tarjeta: la franja = #cj-kpis');
  OK('Entró sube 600, Por cobrar baja 600 y la Tarjeta de la dona sube 600', num(R.F.entro) === num(antes.entro) + 600 && num(R.F.porCobrar) === num(antes.porCobrar) - 600 && R.F.ley.find(l => l.m === 'Tarjeta').v === antes.ley.find(l => l.m === 'Tarjeta').v + 600, [antes.entro, R.F.entro, R.F.porCobrar]);
  await D.click('#btn-nuevo-egreso'); await D.waitForTimeout(300);
  await D.fill('#eg-monto', '250'); await D.fill('#eg-det', 'Resinas'); await D.evaluate(() => { const r = document.querySelector('input[name="egmet"][value="QR"]'); r.checked = true; });
  await D.locator('#modal button', { hasText: 'Guardar egreso' }).click(); await D.waitForTimeout(1600);
  const R2 = await coincide('después de un egreso de 250: la franja = #cj-kpis');
  OK('Salió sube 250 y Queda baja 250', num(R2.F.salio) === num(R.F.salio) + 250 && num(R2.F.queda) === num(R.F.queda) - 250 && R2.F.salioSub === '4 egresos', [R.F.salio, R2.F.salio, R2.F.queda]);

  /* ---------- Sonri lo enseña ---------- */
  const sonri = await D.evaluate(() => ({ nov: ASIS_NOVEDADES.some(n => n.id === 'md-mes-caja' && n.si() && n.ayuda.test('¿Cómo veo cuánto entró, salió y queda en un mes?')),
    ay: ASIS_AYUDA.some(a => a.q === '¿Cómo veo cuánto entró, salió y queda en un mes?' && a.solo === 'adm'),
    busca: asisBuscar('cambiar el mes de la caja').map(i => ASIS_AYUDA[i].q).concat(asisBuscar('cuanto entro y salio').map(i => ASIS_AYUDA[i].q)),
    vieja: (ASIS_AYUDA.find(a => a.q === '¿Dónde veo la caja del día?') || {}).f }));
  OK('Sonri lo enseña: novedad (dueña/recepción) y pregunta frecuente que se encuentra buscando', sonri.nov && sonri.ay && sonri.busca.some(q => /entró, salió y queda/.test(q)), sonri);
  OK('y la ayuda vieja «¿Dónde veo la caja del día?» ahora señala la franja', Array.isArray(sonri.vieja) && sonri.vieja[0] === '#md-mc-caja', sonri.vieja);

  /* ---------- celular (390 px) ---------- */
  await D.setViewportSize({ width: 390, height: 844 });
  for (const k of ['panel', 'caja']) {
    await D.evaluate(k => { show(k); window.scrollTo(0, 0); }, k); await D.waitForTimeout(700);
    const cel = await D.evaluate(k => { const b = $('#md-mc-bar-' + k), fuera = [...b.querySelectorAll('button, .md-mc-cmp')].filter(e => e.getBoundingClientRect().height > 0 && (e.getBoundingClientRect().right > 391 || e.getBoundingClientRect().left < -1)).map(e => e.textContent);
      const f = $('#md-mc-caja'), n = f ? [...f.querySelectorAll('.md-mc-n')].map(x => Math.round(x.getBoundingClientRect().left)) : [];
      const iz = f && f.querySelector('.md-mc-iz').getBoundingClientRect(), de = f && f.querySelector('.md-mc-de').getBoundingClientRect();
      return { sinScroll: document.documentElement.scrollWidth <= 390, fuera, columna: !f || (n.length === 3 && n[0] === n[1] && n[1] === n[2] && de.top >= iz.bottom - 1) }; }, k);
    OK('celular · ' + k + ': sin scroll horizontal, la barra entra entera' + (k === 'caja' ? ' y la franja va en columna' : ''), cel.sinScroll && !cel.fuera.length && cel.columna, cel);
    if (SHOT) { await ocultar(true); await D.waitForTimeout(500);
      const r = await D.evaluate(k => { const a = $('#v-' + k + ' > .card').getBoundingClientRect(), z = (k === 'caja' ? $('#md-mc-caja') : $('#v-' + k + ' > .card')).getBoundingClientRect(); return { x: 0, y: Math.max(0, a.top + scrollY - 10), width: 390, height: z.bottom - a.top + 20 }; }, k);
      await D.screenshot({ path: SHOT('mes-' + k + '-celu'), clip: r, fullPage: true }); await ocultar(false); }
  }
  await D.setViewportSize({ width: 1366, height: 900 });

  OK('no quedan cosas sin subir', await D.evaluate(() => pend().length) === 0);
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await ctx.close(); await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
