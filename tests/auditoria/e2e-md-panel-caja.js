/* Panel «Qué hizo cada doctora» y «Los que más faltan» como barras/filas, y la mitad de abajo de la Caja
   (totales, chips, cuentas por cobrar, egresos, sin forma de pago, no cuadran) como filas con botones.
   Chromium real, .gs real en memoria, sesión de la dueña. Sin red real. Datos ficticios.
   Los números nuevos se comparan con los que daban las tablas viejas (quedan en MD_PC.viejo) y con las
   mismas funciones del panel (acumularPanel, periodoRowsTodo, cajaRows, egresosRango, saldosNoCuadran).
   Uso: PANEL=spa|cos node -r ./netguard.js e2e-md-panel-caja.js   (SHOT_DIR=carpeta para las capturas) */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const SHOT = process.env.SHOT_DIR ? (n => path.join(process.env.SHOT_DIR, n + (SPA ? '' : '-cos') + '.png')) : null;
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
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
  await D.clock.install({ time: new Date('2026-10-20T14:15:00Z') });
  await D.goto('file://' + FILE); await D.waitForTimeout(800);
  await D.fill('#gate-pass', 'pa-duena-1'); await D.click('#gate-btn'); await D.waitForTimeout(2000);
  /* para las capturas: el encabezado fijo y la barra de abajo se esconden; el recorte va en coordenadas de la página entera */
  const ocultar = on => D.evaluate(on => { ['header', '#md-barra', '#toast'].forEach(s => { const e = document.querySelector(s); if (e) e.style.visibility = on ? 'hidden' : ''; }); }, on);
  const clip = (sel, card) => D.evaluate(([sel, card]) => { let e = document.querySelector(sel); if (card) e = e.closest('.card'); const r = e.getBoundingClientRect(); return { x: Math.max(0, r.left - 6), y: Math.max(0, r.top + window.scrollY - 6), width: r.width + 12, height: r.height + 12 }; }, [sel, card]);

  /* ---------- datos ficticios: tres doctoras, citas perdidas, saldos de distintas edades, egresos, cobros sin forma, saldos que no cuadran ---------- */
  await D.evaluate(() => {
    let i = 0;
    const S = (nom, precio, cant) => ({ nom, cant: cant || 1, precio });
    const at = (pac, fecha, prof, srv, o) => { o = o || {}; const tot = srv.reduce((a, s) => a + s.precio * (s.cant || 1), 0);
      const r = normalize(Object.assign({ id: uid(), fecha, hora: '10:00', paciente: pac, profesional: prof, estado: 'Atendido', tipo: 'Recurrente', canal: CFG.canales[0], origen: 'Espontánea',
        celular: '7012' + String(3400 + (i++)).slice(-4), servicios: srv, total: tot, acuenta: tot, saldo: 0, metodo: 'QR', pagos: tot ? [{ metodo: 'QR', monto: tot }] : [], ts: new Date().toISOString() }, o));
      DATA.push(r); queue('save', r, null); return r; };
    const V = 'Dra. Valeria Rojas', C = 'Dra. Camila Ortiz', L = 'Dra. Lucía Peña';
    /* qué hizo cada doctora en octubre (9 servicios distintos, para que haya «Otros») */
    at('Pac Uno', '2026-10-03', V, [S('Corona de porcelana', 1800)]); at('Pac Dos', '2026-10-05', V, [S('Carillas', 2200)]);
    at('Pac Tres', '2026-10-07', V, [S('Blanqueamiento', 1400)]); at('Pac Cuatro', '2026-10-08', V, [S('Limpieza', 150)]);
    at('Pac Cinco', '2026-10-04', C, [S('Corona de porcelana', 3600)]); at('Pac Seis', '2026-10-06', C, [S('Limpieza', 150, 2)]); at('Pac Siete', '2026-10-09', C, [S('Endodoncia', 900)]);
    at('Pac Ocho', '2026-10-10', L, [S('Carillas', 2200)]); at('Pac Nueve', '2026-10-12', L, [S('Endodoncia', 900)]); at('Pac Diez', '2026-10-13', L, [S('Extracción', 200)]);
    at('Pac Once', '2026-10-14', L, [S('Resina', 250)]); at('Pac Doce', '2026-10-15', L, [S('Consulta', 100)]); at('Pac Trece', '2026-10-16', L, [S('Radiografía', 80)]);
    at('Pac Septiembre', '2026-09-20', V, [S('Corona de porcelana', 1800)]);                       /* fuera del mes */
    at('Pac No Vino', '2026-10-11', V, [S('Carillas', 2200)], { estado: 'No asistió', origen: 'Programada', acuenta: 0, pagos: [], metodo: '' }); /* no se hizo: no cuenta en servicios */
    /* los que más faltan: solo citas con origen «Programada» */
    const falta = (pac, fecha, prof, est, cel) => at(pac, fecha, prof, [], { estado: est, origen: 'Programada', agendaPor: 'WhatsApp', total: 0, acuenta: 0, pagos: [], metodo: '', celular: cel });
    falta('Jorge Paz', '2026-10-02', V, 'No asistió', '70123400'); falta('Jorge Paz', '2026-10-09', V, 'No asistió', '70123400'); falta('Jorge Paz', '2026-10-12', V, 'Canceló', '70123400'); falta('Jorge Paz', '2026-10-15', V, 'No asistió', '70123400');
    falta('Jorge Paz', '2026-10-17', V, 'Reprogramó', '70123400');                                   /* reprogramar no es faltar */
    falta('Jorge Paz', '2026-10-25', V, 'Agendada', '70123400');                                     /* su próxima cita: el WhatsApp la confirma */
    falta('Rosa Ibáñez', '2026-10-06', C, 'No asistió', '70123411'); falta('Rosa Ibáñez', '2026-10-13', C, 'No asistió', '70123411'); falta('Rosa Ibáñez', '2026-10-08', C, 'Canceló', '70123411');
    falta('Luis Arce', '2026-10-01', L, 'No asistió', '70123422'); falta('Luis Arce', '2026-10-08', L, 'No asistió', '70123422');
    falta('Elena Guzmán', '2026-10-16', V, 'No asistió', '70123433'); falta('Elena Guzmán', '2026-10-05', V, 'Canceló', '70123433');
    falta('Viejo Faltón', '2026-09-10', V, 'No asistió', '70123444');                                 /* septiembre: solo cuenta en el año */
    at('Pepe Espontaneo', '2026-10-07', V, [], { estado: 'No asistió', origen: 'Espontánea', total: 0, acuenta: 0, pagos: [], metodo: '' }); /* sin cita: no cuenta */
    /* cuentas por cobrar, de distintas edades (hoy es 20/10/2026) */
    const debe = (pac, fecha, prof, srv, acuenta, saldo, o) => at(pac, fecha, prof, srv, Object.assign({ acuenta, saldo, pagos: acuenta ? [{ metodo: 'Efectivo', monto: acuenta }] : [], metodo: acuenta ? 'Efectivo' : '' }, o || {}));
    debe('Mario Justiniano', '2026-10-05', C, [S('Corona de porcelana', 1200)], 400, 800, { celular: '70120001' });  /* 15 días */
    debe('Mario Justiniano', '2026-10-18', C, [S('Limpieza', 150)], 50, 100, { celular: '70120001' });               /* 2 días: debe 900 en total */
    debe('Carla Méndez', '2026-07-13', L, [S('Carillas', 1500)], 800, 700, { celular: '70120002' });                  /* 99 días */
    debe('Ana Cuéllar', '2026-09-29', V, [S('Endodoncia', 900)], 400, 500, { celular: '70120003' });                   /* 21 días */
    debe('Beto Medio', '2026-09-05', C, [S('Limpieza', 450)], 150, 300, { celular: '70120007' });                       /* 45 días */
    debe('Pedro Suárez', '2026-10-14', V, [S('Resina', 250)], 100, 150, { celular: '70120004' });                       /* 6 días */
    debe('Dora Futuro', '2026-11-02', V, [S('Consulta', 100)], 0, 100, { celular: '70120005' });                        /* fecha futura: la tabla vieja no la contaba */
    /* saldos que no cuadran: el saldo anotado supera lo que falta pagar */
    debe('Elena Guzmán', '2026-10-08', V, [S('Endodoncia', 900)], 600, 900, { celular: '70123433' });                  /* falta 300, dice 900 */
    debe('Tomás Rivero', '2026-10-03', L, [S('Resina', 250)], 250, 250, { celular: '70120006' });                      /* pagó todo, dice 250 */
    /* entró plata y no se anotó cómo */
    at('Sofía Terrazas', '2026-10-13', C, [S('Blanqueamiento', 700)], { metodo: '', pagos: [] });
    at('Raúl Montero', '2026-10-16', L, [S('Extracción', 200)], { metodo: 'Mixto', pagos: [{ metodo: 'QR', monto: 120 }] });
    at('Del Cuaderno', '2026-10-02', V, [S('Limpieza', 300)], { metodo: '', pagos: [], obs: 'Importado del cuaderno 2025' }); /* histórico: no se puede recuperar */
    /* egresos de octubre y uno de septiembre */
    guardarEgreso({ fecha: '2026-10-02', categoria: 'Alquiler', detalle: 'Alquiler del consultorio', proveedor: 'Inmobiliaria Sur', monto: 2500, metodo: 'Transferencia' });
    guardarEgreso({ fecha: '2026-10-07', categoria: 'Laboratorio', detalle: 'Corona 36', proveedor: 'Lab. Dental Norte', monto: 450, metodo: 'Efectivo' });
    guardarEgreso({ fecha: '2026-10-10', categoria: 'Insumos y materiales', detalle: 'Guantes, resina, anestesia', proveedor: 'Dental Import', monto: 380, metodo: 'QR' });
    guardarEgreso({ fecha: '2026-10-15', categoria: 'Otro', detalle: 'Agua y limpieza', proveedor: '', monto: 120, metodo: 'Efectivo' });
    guardarEgreso({ fecha: '2026-09-28', categoria: 'Publicidad', detalle: 'Pauta de septiembre', proveedor: 'Meta', monto: 600, metodo: 'Tarjeta' });
    saveLocal(); return flushQueue(); });
  await D.waitForTimeout(1500);

  /* ================= PANEL · Servicios · Qué hizo cada doctora ================= */
  await D.evaluate(() => show('panel')); await D.waitForTimeout(500);
  await D.evaluate(() => { $('#p-rango').value = 'mes'; $('#p-rango').dispatchEvent(new Event('change', { bubbles: true })); $('#p-mes').value = '2026-10'; setRadio('psec', 'servicios'); renderPanel(); });
  await D.waitForTimeout(400);
  const esperadoDoc = await D.evaluate(() => { const A = acumularPanel(periodoRows()), o = {}; Object.keys(A.srvProf).forEach(d => { let t = 0; Object.keys(A.srvProf[d]).forEach(s => t += A.srvProf[d][s].bs); o[d] = Math.round(t); }); return o; });
  const nuevoDoc = await D.evaluate(() => { const o = {}; document.querySelectorAll('#p-srv-prof .md-pc-drow').forEach(r => o[r.dataset.doc] = +r.dataset.tot); return o; });
  const viejoDoc = await D.evaluate(() => { const d = new DOMParser().parseFromString(MD_PC.viejo.srvProf, 'text/html'); const ths = [...d.querySelectorAll('thead th')].map(t => t.textContent.trim()); const tot = [...d.querySelectorAll('tr.tot td')].map(t => +t.textContent.replace(/\./g, '')); const o = {}; ths.slice(1, -1).forEach((h, i) => o[h] = tot[i + 1]); return o; });
  OK('Servicios: una barra por doctora, con el mismo total que acumularPanel', Object.keys(nuevoDoc).length === 3 && Object.keys(esperadoDoc).every(d => nuevoDoc[d] === esperadoDoc[d]), { nuevoDoc, esperadoDoc });
  OK('y el mismo total que daba la fila TOTAL de la matriz vieja', Object.keys(viejoDoc).length === 3 && Object.keys(nuevoDoc).every(d => viejoDoc[d.replace('Dra. ', '')] === nuevoDoc[d]), viejoDoc);
  OK('Valeria 7.000 · Camila 6.850 · Lucía 4.180 de octubre (septiembre, julio, la de noviembre y la cita a la que no vino quedan afuera)', nuevoDoc['Dra. Valeria Rojas'] === 7000 && nuevoDoc['Dra. Camila Ortiz'] === 6850 && nuevoDoc['Dra. Lucía Peña'] === 4180, nuevoDoc);
  const srvUi = await D.evaluate(() => ({ ley: [...document.querySelectorAll('#p-srv-prof .md-pc-ley span')].map(s => s.textContent.trim()), segs: document.querySelectorAll('#p-srv-prof .md-pc-seg').length,
    dona: !!document.querySelector('#p-srv-prof .md-pc-dona svg'), centro: document.querySelector('#p-srv-prof .md-pc-dona text').textContent, rep: document.querySelector('#p-srv-prof .md-pc-dona small').textContent,
    cab: document.querySelector('#p-srv-prof').closest('.card').querySelector('h2').className, periodo: document.querySelector('#p-srv-prof').closest('.card').querySelector('.md-pc-chip').textContent }));
  OK('leyenda con 6 servicios + Otros, tramos clicables, dona con el total del mes y el reparto por doctora', srvUi.ley.length === 7 && srvUi.ley[6] === 'Otros' && srvUi.segs >= 9 && srvUi.dona && srvUi.centro === '18.030' && /Valeria 39%/.test(srvUi.rep) && /md-h-lima/.test(srvUi.cab) && /octubre 2026/.test(srvUi.periodo), srvUi);
  await D.locator('#p-srv-prof .md-pc-drow[data-doc="Dra. Valeria Rojas"] .md-pc-seg').first().click(); await D.waitForTimeout(300);
  let m = await D.locator('#modal').innerText();
  OK('tocar un tramo lista esas atenciones (Corona · Valeria → Pac Uno, Bs 1.800)', /Corona de porcelana · Dra. Valeria Rojas/.test(m) && /Pac Uno/.test(m) && /Bs 1\.800/.test(m) && !/Pac Cinco/.test(m), m.slice(0, 120));
  await D.evaluate(() => closeModal());

  /* ================= PANEL · Agenda · Los que más faltan ================= */
  await D.evaluate(() => { setRadio('psec', 'agenda'); renderPanel(); }); await D.waitForTimeout(400);
  const falt = await D.evaluate(() => [...document.querySelectorAll('#p-ag-faltones .md-pc-f')].map(f => ({ pac: f.dataset.pac, no: +f.dataset.no, can: +f.dataset.can, tot: +f.querySelector('.md-pc-fn').textContent,
    rojos: f.querySelectorAll('.md-pc-fbar i.no').length, ambar: f.querySelectorAll('.md-pc-fbar i.can').length, cuad: f.querySelectorAll('.md-pc-fbar i').length, sub: f.querySelector('.md-pc-tx small').textContent,
    wa: (f.querySelector('.md-pc-ib.wa') || {}).href || '', pills: [...f.querySelectorAll('.pill')].map(p => p.textContent.trim()) })));
  const viejoFalt = await D.evaluate(() => { const d = new DOMParser().parseFromString(MD_PC.viejo.faltones, 'text/html'); return [...d.querySelectorAll('tbody tr')].map(tr => ({ pac: tr.cells[0].textContent.trim(), no: +tr.cells[2].textContent, can: +tr.cells[3].textContent, tot: +tr.cells[4].textContent })); });
  const esperadoFalt = await D.evaluate(() => { const o = {}; periodoRowsTodo().filter(r => r.origen === 'Programada').forEach(r => { if (r.estado !== 'No asistió' && r.estado !== 'Canceló') return; const k = r.paciente.trim(); o[k] = o[k] || { no: 0, can: 0 }; if (r.estado === 'No asistió') o[k].no++; else o[k].can++; }); return o; });
  OK('Agenda: los mismos pacientes y conteos que la tabla vieja (citas «Programada» no asistidas o canceladas)', falt.length === viejoFalt.length && falt.every(f => { const o = viejoFalt.find(x => x.pac === f.pac); return o && o.no === f.no && o.can === f.can && o.tot === f.tot && f.tot === f.no + f.can; }), { falt: falt.map(f => [f.pac, f.no, f.can]), viejoFalt });
  OK('y que la cuenta directa con periodoRowsTodo', Object.keys(esperadoFalt).length === falt.length && falt.every(f => esperadoFalt[f.pac] && esperadoFalt[f.pac].no === f.no && esperadoFalt[f.pac].can === f.can), esperadoFalt);
  const J = falt[0];
  OK('Jorge Paz primero con 4: 3 cuadritos rojos y 1 ámbar, última falta 15/10, Dra. Valeria y celular', J && J.pac === 'Jorge Paz' && J.tot === 4 && J.rojos === 3 && J.ambar === 1 && J.cuad === 4 && /última falta 15\/10 · Dra\. Valeria Rojas · 70123400/.test(J.sub) && J.pills.join('|') === '✖ 3 no vino|🚫 1 canceló', J);
  OK('el espontáneo que no vino y el reprogramado no cuentan; el de septiembre tampoco en el mes', !falt.some(f => /Pepe|Viejo/.test(f.pac)) && !/Reprogram/.test(JSON.stringify(falt)));
  OK('WhatsApp de Jorge confirma su próxima cita; el de Rosa propone reagendar', /wa\.me\/59170123400/.test(J.wa) && /Le%20recordamos%20su%20cita/.test(J.wa) && /No%20pudimos%20verle/.test(falt.find(f => f.pac === 'Rosa Ibáñez').wa), [J.wa.slice(0, 80)]);
  await D.locator('#p-ag-faltones .md-pc-f[data-pac="Jorge Paz"] button', { hasText: 'Ficha' }).click(); await D.waitForTimeout(400);
  m = await D.locator('#modal').innerText();
  OK('«Ficha» abre la ficha del paciente', /Jorge Paz/.test(m), m.slice(0, 60)); await D.evaluate(() => closeModal());
  if (SHOT) {   /* captura real 02: las dos tarjetas juntas (la de doctoras ya está pintada en su sección) */
    await D.setViewportSize({ width: 1366, height: 1100 }); await ocultar(true);
    await D.evaluate(() => { const cs = $('#p-srv-prof').closest('.card'), cf = $('#p-ag-faltones').closest('.card'); const w = document.createElement('div'); w.id = 'md-shot'; cf.parentNode.insertBefore(w, cf); w.appendChild(cs); w.appendChild(cf); window.scrollTo(0, 0); });
    await D.waitForTimeout(1200);
    await D.screenshot({ path: SHOT('real-02'), clip: await clip('#md-shot'), fullPage: true });
    await D.evaluate(() => { const w = $('#md-shot'), cs = w.firstChild, cf = w.lastChild; w.parentNode.insertBefore(cf, w); document.querySelector('.psec[data-sec="servicios"]').appendChild(cs); w.remove(); });
    await ocultar(false); await D.setViewportSize({ width: 1366, height: 900 });
  }
  await D.evaluate(() => { $('#p-rango').value = 'anio'; $('#p-rango').dispatchEvent(new Event('change', { bubbles: true })); $('#p-anio').value = '2026'; renderPanel(); }); await D.waitForTimeout(400);
  OK('al cambiar el periodo al año aparece el faltón de septiembre', await D.evaluate(() => !!document.querySelector('#p-ag-faltones .md-pc-f[data-pac="Viejo Faltón"]') && /el año 2026/.test(document.querySelector('#p-ag-faltones').closest('.card').querySelector('.md-pc-chip').textContent)));
  await D.evaluate(() => { $('#p-rango').value = 'mes'; $('#p-rango').dispatchEvent(new Event('change', { bubbles: true })); renderPanel(); }); await D.waitForTimeout(300);
  OK('las otras secciones del Panel siguen como estaban (tabla por canal, KPIs)', await D.evaluate(() => !!document.querySelector('#p-ag-canal table') && document.querySelectorAll('#p-ag-kpis .kpi').length === 6 && !document.querySelector('#p-ag-canal .md-pc-lista')));

  /* ================= CAJA · la mitad de abajo ================= */
  await D.evaluate(() => show('caja')); await D.waitForTimeout(500);
  await D.evaluate(() => { $('#c-rango').value = 'mes'; $('#c-rango').dispatchEvent(new Event('change', { bubbles: true })); $('#c-mes').value = '2026-10'; renderCaja(); }); await D.waitForTimeout(400);
  const K = await D.evaluate(() => [...document.querySelectorAll('#md-pc-kpis .kpi')].map(k => ({ f: k.dataset.f, k: k.querySelector('.k').textContent.trim(), v: k.querySelector('.v').textContent.trim(), d: k.querySelector('.d').textContent.trim() })));
  OK('Caja: cuatro totales arriba (egresos, por cobrar, sin forma de pago, no cuadran)', K.length === 4 && K[0].v === 'Bs 3.450' && /4 movimientos · Bs 570 en efectivo/.test(K[0].d) && K[1].v === 'Bs 3.700' && /7 pacientes · 1 deuda vieja/.test(K[1].d) && K[2].v === '2' && /Bs 780 sin saber/.test(K[2].d) && K[3].v === '2' && /Bs 850 de más/.test(K[3].d), K);
  const viejoCaja = await D.evaluate(() => { const p = h => new DOMParser().parseFromString(h, 'text/html'); const td = (h, re) => { const tr = [...p(h).querySelectorAll('tr')].find(t => re.test(t.textContent)); return tr ? tr.textContent : ''; };
    return { deuda: td(MD_PC.viejo.deuda, /TOTAL POR COBRAR/), egr: td(MD_PC.viejo.egresos, /^\s*TOTAL/), nc: (p(MD_PC.viejo.nocuadra).querySelector('p.mini') || {}).textContent || '', sm: [...p(MD_PC.viejo.sinmetodo).querySelectorAll('tbody tr')].map(t => t.cells[1].textContent) }; });
  OK('los totales coinciden con las tablas viejas (3.700 por cobrar, 3.450 de egresos, 850 de más, 2 sin forma)', /3\.700/.test(viejoCaja.deuda) && /3\.450/.test(viejoCaja.egr) && /Bs 850/.test(viejoCaja.nc) && viejoCaja.sm.length === 2 && viejoCaja.sm.indexOf('Sofía Terrazas') >= 0, viejoCaja);
  if (SHOT) {   /* captura real 03: de los cuatro totales a las dos tarjetas chicas, sin la liquidación que queda en el medio */
    await D.setViewportSize({ width: 1366, height: 1100 }); await ocultar(true);
    await D.evaluate(() => { MD_PC.cards.cEg.nextElementSibling.style.display = 'none'; window.scrollTo(0, 0); }); await D.waitForTimeout(1200);
    const a = await clip('#md-pc-top'), z = await clip('.md-pc-g2');
    await D.screenshot({ path: SHOT('real-03'), clip: { x: a.x, y: a.y, width: a.width, height: z.y + z.height - a.y }, fullPage: true });
    await D.evaluate(() => { MD_PC.cards.cEg.nextElementSibling.style.display = ''; });
    await ocultar(false); await D.setViewportSize({ width: 1366, height: 900 });
  }
  OK('«Registrar egreso» y «Registrar anticipo» están en la barra nueva', await D.evaluate(() => !!document.querySelector('#md-pc-top #btn-nuevo-egreso') && !!document.querySelector('#md-pc-top #btn-nuevo-anticipo')));
  await D.click('#btn-nuevo-egreso'); await D.waitForTimeout(300);
  OK('…y el de egreso sigue abriendo el formulario', await D.evaluate(() => !!$('#eg-monto') && $('#ov').classList.contains('on'))); await D.evaluate(() => closeModal());
  await D.click('#btn-nuevo-anticipo'); await D.waitForTimeout(300);
  OK('…y el de anticipo también', /nticipo/.test(await D.locator('#modal').innerText())); await D.evaluate(() => closeModal());
  const vis = () => D.evaluate(() => { const C = MD_PC.cards; const on = e => getComputedStyle(e).display !== 'none'; return { de: on(C.cDe), eg: on(C.cEg), sm: on(C.cSm), nc: on(C.cNc), chip: (document.querySelector('#md-pc-chips button.on') || {}).textContent }; });
  await D.locator('#md-pc-chips button', { hasText: 'Por cobrar' }).click(); await D.waitForTimeout(200); let vv = await vis();
  OK('chip «Por cobrar»: queda solo esa tarjeta', vv.de && !vv.eg && !vv.sm && !vv.nc && /Por cobrar/.test(vv.chip), vv);
  await D.locator('#md-pc-chips button', { hasText: 'No cuadran' }).click(); await D.waitForTimeout(200); vv = await vis();
  OK('chip «No cuadran»: solo esa', !vv.de && !vv.eg && !vv.sm && vv.nc, vv);
  await D.locator('#md-pc-kpis .kpi[data-f="egresos"]').click(); await D.waitForTimeout(200); vv = await vis();
  OK('tocar el total de egresos filtra a egresos', !vv.de && vv.eg && !vv.sm && !vv.nc, vv);
  await D.locator('#md-pc-chips button', { hasText: 'Todo' }).click(); await D.waitForTimeout(200); vv = await vis();
  OK('«Todo» vuelve a mostrar las cuatro', vv.de && vv.eg && vv.sm && vv.nc, vv);
  /* cuentas por cobrar */
  const deu = () => D.evaluate(() => [...document.querySelectorAll('#cj-deuda .md-pc-d')].map(r => ({ pac: r.querySelector('b').textContent, dias: +r.dataset.dias, saldo: +r.dataset.saldo, pill: r.querySelector('.pill').className.replace('pill', '').trim(), ptxt: r.querySelector('.pill').textContent, wa: (r.querySelector('.md-pc-ib.wa') || {}).href || '', sub: r.querySelector('small').textContent })));
  let L = await deu();
  OK('Cuentas por cobrar: de a 6, las más viejas primero, con pill verde ≤30 / ámbar ≤90 / rojo >90', L.length === 6 && L[0].pac === 'Carla Méndez' && L[0].pill === 'bad' && L[0].ptxt === '99 días' && L[1].pac === 'Beto Medio' && L[1].pill === 'warn' && L.find(x => x.pac === 'Ana Cuéllar').pill === 'ok' && L.find(x => x.saldo === 800).pill === 'ok' && !L.some(x => x.pac === 'Dora Futuro' || x.pac === 'Pedro Suárez'), L.map(x => [x.pac, x.dias, x.pill]));
  OK('cada fila dice qué fue, cuándo y con quién', /Carillas · 13\/07 · Dra\. Lucía Peña/.test(L[0].sub), L[0].sub);
  OK('WhatsApp va con el monto: Carla Bs 700; Mario con lo que debe en total (Bs 900)', /Bs%20700/.test(L[0].wa) && /wa\.me\/59170120002/.test(L[0].wa) && /Bs%20900/.test(L.find(x => x.saldo === 800).wa), [L[0].wa.slice(0, 90)]);
  await D.locator('#cj-deuda .md-pc-ver').click(); await D.waitForTimeout(200); L = await deu();
  OK('«Ver los 8 saldos» muestra todos (3.700 en total, Pedro incluido)', L.length === 8 && L.reduce((a, x) => a + x.saldo, 0) === 3700 && L.some(x => x.pac === 'Pedro Suárez') && /Total por cobrar Bs 3\.700 de 7 pacientes/.test(await D.locator('#cj-deuda p.mini').innerText()));
  await D.locator('#v-caja h2 .md-pc-chips button', { hasText: 'Más plata' }).click(); await D.waitForTimeout(200); L = await deu();
  OK('«Más plata» ordena por monto (Elena 900, Mario 800, Carla 700…)', L[0].saldo === 900 && L[1].saldo === 800 && L[2].saldo === 700, L.map(x => x.saldo));
  await D.locator('#cj-deuda .md-pc-d', { hasText: 'Carla Méndez' }).locator('button', { hasText: 'Cobrar' }).click(); await D.waitForTimeout(300);
  OK('«Cobrar» abre el cobro de esa atención con su saldo', await D.evaluate(() => !!$('#cp-m') && +$('#cp-m').value === 700 && /Carla Méndez/.test($('#modal').innerText))); await D.evaluate(() => closeModal());
  /* egresos */
  const E = await D.evaluate(() => [...document.querySelectorAll('#cj-egresos .md-pc-e')].map(r => ({ t: r.querySelector('b').textContent, sub: r.querySelector('small').textContent, pill: r.querySelector('.pill').textContent, cls: r.querySelector('.pill').className, monto: r.querySelector('.md-pc-num').textContent, ico: !!r.querySelector('.md-pc-catb svg') })));
  OK('Egresos: 4 filas del mes con ícono por categoría, pill de forma de pago y el monto en rojo', E.length === 4 && E.every(e => e.ico) && E[0].t === 'Agua y limpieza' && /Efectivo/.test(E[0].pill) && /ok/.test(E[0].cls) && E[3].t === 'Alquiler del consultorio' && /Transferencia/.test(E[3].pill) && /info/.test(E[3].cls) && E[3].monto === '− Bs 2.500' && /02\/10 · Inmobiliaria Sur · Alquiler/.test(E[3].sub) && !E.some(e => /Pauta de septiembre/.test(e.t)), E);
  OK('con el total del periodo en el título y el desglose en efectivo', /Bs 3\.450.*en octubre 2026/.test(await D.evaluate(() => MD_PC.cards.cEg.querySelector('h2').textContent)) && /En efectivo salieron Bs 570/.test(await D.locator('#cj-egresos').innerText()));
  await D.locator('#cj-egresos .md-pc-e', { hasText: 'Alquiler del consultorio' }).locator('.md-pc-ib[title="Editar"]').click(); await D.waitForTimeout(300);
  OK('el lápiz abre el egreso para editarlo', await D.evaluate(() => !!$('#eg-monto') && +$('#eg-monto').value === 2500 && $('#eg-prov').value === 'Inmobiliaria Sur')); await D.evaluate(() => closeModal());
  /* sin forma de pago */
  const SM = await D.evaluate(() => ({ filas: [...document.querySelectorAll('#cj-sinmetodo .md-pc-c')].map(r => [r.querySelector('b').textContent, r.querySelector('.pill').textContent, r.querySelector('small').textContent]), txt: document.querySelector('#cj-sinmetodo').textContent }));
  OK('Sin forma de pago: Sofía (700) y Raúl (80, con 120 ya anotado); el del cuaderno va aparte como aviso', SM.filas.length === 2 && SM.filas[0][0] === 'Sofía Terrazas' && SM.filas[0][1] === 'Bs 700' && SM.filas[1][0] === 'Raúl Montero' && SM.filas[1][1] === 'Bs 80' && /120 sí anotado/.test(SM.filas[1][2]) && /1 atenciones.*cuadernos|cuadernos/.test(SM.txt) && !/Del Cuaderno/.test(SM.filas.join()), SM.filas);
  await D.locator('#cj-sinmetodo .md-pc-c', { hasText: 'Sofía Terrazas' }).locator('button', { hasText: 'Completar' }).click(); await D.waitForTimeout(300);
  m = await D.locator('#modal').innerText();
  OK('«Completar» abre la ficha de esa atención, que marca «sin anotar»', /Sofía Terrazas/.test(m) && /sin anotar/.test(m), m.slice(0, 80)); await D.evaluate(() => closeModal());
  /* no cuadran */
  const NC = await D.evaluate(() => [...document.querySelectorAll('#cj-nocuadra .md-pc-c')].map(r => [r.querySelector('b').textContent, r.querySelector('.pill').textContent, r.querySelector('button').textContent, r.querySelector('small').textContent]));
  OK('No cuadran: Tomás (pagó todo, dice 250 → Dejar en 0) y Elena (600 de 900, dice 900 → Dejar en 300)', NC.length === 2 && NC[0][0] === 'Tomás Rivero' && NC[0][1] === 'dice 250' && NC[0][2] === 'Dejar en 0' && /pagó todo/.test(NC[0][3]) && NC[1][0] === 'Elena Guzmán' && NC[1][2] === 'Dejar en 300' && /pagó 600 de 900/.test(NC[1][3]), NC);
  OK('el texto de la tarjeta sigue nombrando a los pacientes (como lee la prueba s11)', await D.evaluate(() => /Tomás Rivero/.test($('#cj-nocuadra').textContent) && /Elena Guzmán/.test($('#cj-nocuadra').textContent)));
  /* el KPI cuenta animado hasta 1,1 s: se espera a que termine antes de leer el número */
  await D.locator('#cj-nocuadra .md-pc-c', { hasText: 'Elena Guzmán' }).locator('button').click(); await D.waitForTimeout(1800);
  const despues = await D.evaluate(() => ({ saldo: DATA.filter(r => r.paciente === 'Elena Guzmán' && r.total === 900)[0].saldo, filas: document.querySelectorAll('#cj-nocuadra .md-pc-c').length, kpi: document.querySelector('#md-pc-kpis .kpi[data-f="nocuadra"] .v').textContent, deuda: document.querySelector('#md-pc-kpis .kpi[data-f="deuda"] .v').textContent }));
  OK('«Dejar en 300» corrige el saldo con arreglarSaldo y la fila se va; los totales se actualizan', despues.saldo === 300 && despues.filas === 1 && despues.kpi === '1' && despues.deuda === 'Bs 3.100', despues);
  await D.locator('#cj-nocuadra .md-pc-c', { hasText: 'Tomás Rivero' }).locator('button').click(); await D.waitForTimeout(800);
  OK('con todos corregidos vuelve el mensaje de siempre («…cuadran…»)', /cuadran/.test(await D.evaluate(() => $('#cj-nocuadra').textContent)) && (await D.evaluate(() => document.querySelectorAll('#cj-nocuadra .md-pc-c').length)) === 0);
  OK('la liquidación y los movimientos siguen en su lugar', await D.evaluate(() => !!document.querySelector('#cj-liq table') && document.querySelectorAll('#cj-body tr').length > 5));
  OK('ningún monto muestra NaN ni undefined', !/NaN|undefined/.test(await D.locator('#v-caja').innerText()));

  /* ---------- la versión celular (390 px) ---------- */
  await D.setViewportSize({ width: 390, height: 844 }); await D.evaluate(() => { show('panel'); setRadio('psec', 'agenda'); renderPanel(); }); await D.waitForTimeout(500);
  const cel = await D.evaluate(() => { const f = document.querySelector('#p-ag-faltones .md-pc-f'), wa = f.querySelector('.md-pc-ib.wa'); return { tarjeta: getComputedStyle(f).borderRadius, boton: getComputedStyle(wa.querySelector('span')).display, ancho: wa.getBoundingClientRect().width, texto: wa.textContent.trim(), sinScroll: document.documentElement.scrollWidth <= 390 }; });
  OK('en el celular cada faltón es una tarjeta con el botón grande de WhatsApp, sin scroll horizontal', cel.tarjeta === '16px' && cel.boton !== 'none' && cel.ancho > 200 && /Confirmar por WhatsApp/.test(cel.texto) && cel.sinScroll, cel);
  if (SHOT) { await ocultar(true); await D.evaluate(() => window.scrollTo(0, 0)); await D.waitForTimeout(600); await D.screenshot({ path: SHOT('real-02-cel'), clip: await clip('#p-ag-faltones', true), fullPage: true }); await ocultar(false); }
  await D.evaluate(() => { show('caja'); renderCaja(); }); await D.waitForTimeout(400);
  OK('y la Caja tampoco se sale de la pantalla', await D.evaluate(() => document.documentElement.scrollWidth <= 390 && document.querySelectorAll('#md-pc-kpis .kpi').length === 4));
  await D.setViewportSize({ width: 1366, height: 900 });

  OK('no quedan cosas sin subir', await D.evaluate(() => pend().length) === 0);
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await ctx.close(); await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
