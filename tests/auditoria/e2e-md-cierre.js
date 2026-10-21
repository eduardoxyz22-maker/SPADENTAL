/* Cierre de caja que queda en la hoja «_Cierres»: la dueña cierra desde una pantalla y recepción lo ve desde otra
   (dos contextos = dos aparatos), la diferencia la calcula el servidor, una doctora no puede cerrar, el aviso
   «ayer no se cerró», el motivo al editar o borrar un cobro de un día ya cerrado, la cola sin conexión y el
   Apps Script viejo (accion_desconocida → aviso y cierre local). Chromium real, .gs real en memoria. Sin red real.
   Uso: PANEL=spa|cos node -r ./netguard.js e2e-md-cierre.js   (SHOT=ruta.png para la captura de la tarjeta) */
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
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('pa-duena-1'); v.equipo = server.ctx.shaHex('pa-equipo-1'); v.prof = { 'Dra. Mirna': server.ctx.shaHex('pa-doc-1') }; server.ctx.guardarVerif(v);
  const filasCierres = () => (server.ctx.getSheetCierres()._rows.slice(1)).map(f => ({ fecha: f[0], quien: f[1], contado: f[2], esperado: f[3], diferencia: f[4], nota: f[5], rol: f[7] }));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  /* cada contexto es otro aparato: su propio localStorage. Los diálogos: prompt contesta con `page.resp` (null = cancelar) */
  const abrir = async (clave) => {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage(); page.resp = ''; page.dialogs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('dialog', d => { page.dialogs.push({ t: d.type(), m: d.message() }); if (d.type() === 'prompt') return page.resp === null ? d.dismiss() : d.accept(page.resp); return d.accept(); });
    await page.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'), { panel: true })) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await page.clock.install({ time: new Date('2026-10-20T14:15:00Z') });   /* martes 20/10: ayer hábil = lunes 19/10 */
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.fill('#gate-pass', clave); await page.click('#gate-btn'); await page.waitForTimeout(2000);
    await page.evaluate(() => { window.__toasts = []; const _t = toast; toast = function (m) { __toasts.push(String(m)); return _t.apply(this, arguments); }; });
    return page;
  };
  const caja = async (p) => { await p.evaluate(() => show('caja')); await p.waitForTimeout(500); };
  const tarjeta = (p) => p.evaluate(() => { const c = $('#md-cierre'); return c ? { txt: c.innerText, esp: +$('#md-ci-esp').getAttribute('data-v'), est: ($('#md-cierre .md-ci-est') || {}).textContent || '', aviso: !!c.querySelector('.md-ci-aviso'),
    chips: [...c.querySelectorAll('.md-ci-chip')].map(x => ({ f: x.dataset.f, cls: x.className.replace('md-ci-chip', '').trim(), txt: x.innerText.replace(/\n/g, ' | ') })), viejo: !!c.querySelector('.md-ci-viejo'),
    luz: ['r', 'a', 'v'].filter(k => c.querySelector('.md-semaforo .' + k + '.on')).join('') } : null; });
  const cerrar = async (p, contado, nota) => { await p.fill('#md-contado', String(contado)); await p.dispatchEvent('#md-contado', 'input'); if (nota !== undefined) await p.fill('#md-ci-nota', nota); await p.click('#md-ci-btn'); await p.waitForTimeout(900); };

  /* ---------- la dueña carga el día: efectivo 100 + 250, QR 300, un egreso en efectivo de 50 → el panel espera Bs 300; ayer hubo un cobro y nadie cerró ---------- */
  const D = await abrir('pa-duena-1');
  await D.evaluate(() => {
    let i = 0; window.at = (pac, fecha, met, tot, o) => { const r = normalize(Object.assign({ id: uid(), fecha, hora: '10:00', paciente: pac, profesional: 'Dra. Mirna', estado: 'Atendido', tipo: 'Recurrente', canal: CFG.canales[0], origen: 'Espontánea', celular: '7009' + String(1000 + (i++)).slice(-4),
      servicios: [{ nom: 'Limpieza dental', cant: 1, precio: tot }], total: tot, acuenta: tot, saldo: 0, metodo: met, pagos: tot ? [{ metodo: met, monto: tot }] : [], ts: new Date().toISOString() }, o || {})); DATA.push(r); queue('save', r, null); return r.id; };
    at('Efe Uno', '2026-10-20', 'Efectivo', 100); at('Efe Dos', '2026-10-20', 'Efectivo', 250); at('Qr Tres', '2026-10-20', 'QR', 300);
    window.ID_DUP = at('Dup Hoy', '2026-10-20', 'Efectivo', 0, { servicios: [{ nom: 'Consulta', cant: 1, precio: 100 }], total: 100, acuenta: 100, pagos: [{ metodo: 'Efectivo', monto: 100 }] });
    window.ID_DEBE = at('Debe Algo', '2026-10-20', 'Efectivo', 0, { servicios: [{ nom: 'Corona', cant: 1, precio: 500 }], total: 500, acuenta: 100, saldo: 400, pagos: [{ metodo: 'Efectivo', monto: 100 }] });
    at('Ayer Efe', '2026-10-19', 'Efectivo', 200);
    guardarEgreso({ fecha: '2026-10-20', categoria: 'Insumos', detalle: 'Guantes', proveedor: 'Dental Sur', monto: 50, metodo: 'Efectivo' });
    saveLocal(); return flushQueue(); });
  await D.waitForTimeout(1200);
  OK('el servidor ya sabe de cierres (list trae «cierres»)', await D.evaluate(() => MD_CI.srv === true));
  OK('días hábiles: antes del lunes viene el sábado; antes del domingo también', await D.evaluate(() => mdCiDiaHabilAnterior('2026-10-19') === '2026-10-17' && mdCiDiaHabilAnterior('2026-10-25') === '2026-10-24' && mdCiDiaHabilAnterior('2026-10-20') === '2026-10-19'));
  await caja(D);
  let t = await tarjeta(D);
  OK('la tarjeta espera Bs 500 de efectivo (100+250+100+100 − 50 de egreso) y está sin cerrar', t && t.esp === 500 && /Sin cerrar/.test(t.est) && t.luz === '', t && [t.esp, t.est, t.luz]);
  OK('avisa que ayer (lun 19/10) no se cerró, con el botón para cerrarlo', t && t.aviso && /Ayer no se cerró la caja/.test(t.txt) && /lun 19\/10/.test(t.txt) && /Cerrar el 19\/10/.test(t.txt));
  OK('todavía no hay cierres en la tira', t && t.chips.length === 0 && /Todavía no hay cierres/.test(t.txt));
  /* el semáforo se mueve mientras escribe, sin guardar */
  await D.fill('#md-contado', '500'); await D.dispatchEvent('#md-contado', 'input');
  OK('escribir 500 pone el semáforo en verde sin guardar nada', (await tarjeta(D)).luz === 'v' && filasCierres().length === 0 && await D.evaluate(() => /Cuadra/.test($('#md-ci-msg').textContent)));
  await cerrar(D, 480, 'faltó un vuelto');
  const f1 = filasCierres();
  OK('«Cerrar el día» deja una fila en _Cierres: 20/10, Dueña, contado 480, esperado 500, diferencia −20, nota, rol admin', f1.length === 1 && f1[0].fecha === '2026-10-20' && f1[0].quien === 'Dueña' && f1[0].contado === 480 && f1[0].esperado === 500 && f1[0].diferencia === -20 && f1[0].nota === 'faltó un vuelto' && f1[0].rol === 'admin', f1);
  t = await tarjeta(D);
  OK('la tarjeta dice quién cerró y a qué hora, semáforo rojo con «Faltan Bs 20»', t && /Cerró Dueña a las \d\d:\d\d/.test(t.est) && t.luz === 'r' && /Faltan Bs 20 en la caja/.test(t.txt), t && [t.est, t.luz]);
  OK('la tira muestra el cierre de hoy en rojo con −Bs 20 y quién', t && t.chips.length === 1 && /mal/.test(t.chips[0].cls) && /mar 20\/10 \| Dueña \| −Bs 20/.test(t.chips[0].txt), t && t.chips);
  OK('no quedó nada en la cola', await D.evaluate(() => pend().length) === 0);
  OK('los avisos: anotado con cuánto faltó, y después guardado en la hoja', await D.evaluate(() => __toasts.some(m => /Cierre del 20\/10\/2026 anotado: faltan Bs 20/.test(m)) && __toasts.some(m => /Cierre del 20\/10\/2026 guardado en la hoja/.test(m))), await D.evaluate(() => __toasts.slice(-3)));

  /* ---------- recepción, desde otro aparato: lo ve, cierra ayer desde el aviso y vuelve a cerrar hoy ---------- */
  const E = await abrir('pa-equipo-1');
  OK('recepción entra con su clave', await E.evaluate(() => ROL === 'equipo'));
  await caja(E);
  t = await tarjeta(E);
  OK('desde otro aparato recepción ve que hoy lo cerró la Dueña con −Bs 20', t && /Cerró Dueña/.test(t.est) && t.chips.length === 1 && /Dueña \| −Bs 20/.test(t.chips[0].txt) && await E.evaluate(() => MD_CI.lista[0].quien === 'Dueña' && MD_CI.lista[0].diferencia === -20), t && [t.est, t.chips]);
  OK('y el campo trae lo contado por la dueña (480) y su nota', await E.evaluate(() => $('#md-contado').value === '480' && $('#md-ci-nota').value === 'faltó un vuelto'));
  OK('recepción también ve el aviso de ayer', t && t.aviso);
  await E.click('#md-cierre .md-ci-aviso button'); await E.waitForTimeout(500);
  OK('el botón del aviso lleva la Caja al 19/10', await E.evaluate(() => $('#c-rango').value === 'dia' && $('#c-dia').value === '2026-10-19' && +$('#md-ci-esp').getAttribute('data-v') === 200 && /Cierre de caja · 19\/10\/2026/.test($('#md-cierre h2').textContent)));
  await cerrar(E, 200);
  const f2 = filasCierres();
  OK('el cierre del 19/10 queda con Recepción, diferencia 0, rol equipo', f2.length === 2 && f2.some(f => f.fecha === '2026-10-19' && f.quien === 'Recepción' && f.contado === 200 && f.esperado === 200 && f.diferencia === 0 && f.rol === 'equipo'), f2);
  t = await tarjeta(E);
  OK('ya no avisa que ayer no se cerró; la tira tiene los dos, el 19 en verde «✓ cuadró»', t && !t.aviso && t.chips.length === 2 && t.chips.some(c => c.f === '2026-10-19' && /ok/.test(c.cls) && /Recepción \| ✓ cuadró/.test(c.txt)), t && t.chips);
  /* volver a cerrar hoy reemplaza la fila (no la duplica) y la diferencia la calcula el servidor */
  await E.click('#md-cierre .md-ci-chip[data-f="2026-10-20"]'); await E.waitForTimeout(400);
  await cerrar(E, 510, '');
  const f3 = filasCierres();
  OK('volver a cerrar hoy con 510 reemplaza la fila: una sola por fecha, Recepción, +10', f3.length === 2 && f3.filter(f => f.fecha === '2026-10-20').length === 1 && f3.some(f => f.fecha === '2026-10-20' && f.quien === 'Recepción' && f.contado === 510 && f.diferencia === 10), f3);
  t = await tarjeta(E);
  OK('la tarjeta dice «Sobran Bs 10» y el chip +Bs 10 en rojo', t && /Sobran Bs 10/.test(t.txt) && t.chips.some(c => c.f === '2026-10-20' && /mal/.test(c.cls) && /\+Bs 10/.test(c.txt)));
  /* el servidor no se cree la diferencia que manda el panel */
  const tokE = server.ctx.nuevaSesion({ rol: 'equipo', prof: '', h: v.equipo, fabrica: false });
  const rr = server.handle({ action: 'cierre', token: tokE, registro: { fecha: '2026-10-17', contado: 90, esperado: 100, diferencia: 999, quien: 'Recepción' } }, { panel: true });
  OK('la diferencia la calcula el servidor (contado − esperado), no la que manda el panel', rr.ok && rr.cierre.diferencia === -10 && rr.cierres.length === 3, rr.cierre);
  OK('una fecha mal formada o un monto que no es número se rechazan', server.handle({ action: 'cierre', token: tokE, registro: { fecha: '17/10', contado: 1, esperado: 1 } }, { panel: true }).error === 'fecha_invalida' && server.handle({ action: 'cierre', token: tokE, registro: { fecha: '2026-10-17', contado: 'x', esperado: 1 } }, { panel: true }).error === 'monto_invalido');

  /* ---------- la dueña refresca y ve lo de recepción; editar o borrar un cobro de hoy (cerrado) pide motivo ---------- */
  await D.evaluate(() => pullServer()); await D.waitForTimeout(800); await caja(D);
  t = await tarjeta(D);
  OK('al refrescar, la dueña ve los 3 cierres y que hoy lo volvió a cerrar Recepción con +10', t && t.chips.length === 3 && /Cerró Recepción/.test(t.est) && t.chips[0].f === '2026-10-20' && /Recepción \| \+Bs 10/.test(t.chips[0].txt), t && t.chips);
  /* editar: subir el total de una atención de hoy */
  await D.evaluate(() => { show('atencion'); loadForm(DATA.filter(r => r.id === ID_DEBE)[0]); });
  await D.waitForTimeout(300);
  await D.evaluate(() => { SRV[0].precio = 600; renderSrv(); $('#f-total').value = 600; $('#f-total').dispatchEvent(new Event('input', { bubbles: true })); if (typeof recalcSaldo === 'function') recalcSaldo(); });
  D.resp = null; D.dialogs = [];
  await D.evaluate(() => guardarAtencion()); await D.waitForTimeout(500);
  OK('cancelar el motivo no guarda el cambio (sigue en edición, obs sin nota)', D.dialogs.some(d => d.t === 'prompt' && /20\/10\/2026 ya está cerrado/.test(d.m) && /cerró Recepción/.test(d.m)) && await D.evaluate(() => EDIT_ID === ID_DEBE && $('#f-obs').value === '' && DATA.filter(r => r.id === ID_DEBE)[0].total === 500), D.dialogs.map(d => d.m.slice(0, 60)));
  D.resp = 'se agregó una resina'; D.dialogs = [];
  await D.evaluate(() => guardarAtencion()); await D.waitForTimeout(1200); await D.evaluate(() => closeModal());
  const reg = await D.evaluate(() => DATA.filter(r => r.id === ID_DEBE)[0]);
  OK('con motivo, el cambio se guarda y el motivo queda en «obs» de esa atención', reg.total === 600 && /Cambio con el día cerrado \(20\/10\/2026\): se agregó una resina/.test(reg.obs), reg.obs);
  OK('…y llega así a la hoja', /se agregó una resina/.test((server.registros[reg.id] || {}).obs || ''));
  /* registrar un pago hoy, con hoy cerrado */
  D.resp = 'pagó al salir'; D.dialogs = [];
  await D.evaluate(() => aplicarPago(DATA.filter(r => r.id === ID_DEBE)[0], 100, 'QR')); await D.waitForTimeout(800);
  const reg2 = await D.evaluate(() => DATA.filter(r => r.id === ID_DEBE)[0]);
  OK('un pago registrado hoy (ya cerrado) pide motivo y lo anota en obs', D.dialogs.some(d => d.t === 'prompt' && /caja de hoy/.test(d.m)) && reg2.acuenta === 200 && /pagó al salir/.test(reg2.obs), [reg2.acuenta, reg2.obs]);
  /* borrar: la atención desaparece, el motivo queda en la nota del cierre de ese día */
  D.resp = null; D.dialogs = [];
  await D.evaluate(() => borrar(ID_DUP)); await D.waitForTimeout(400);
  OK('cancelar el motivo al borrar deja la atención como estaba', D.dialogs.length === 1 && D.dialogs[0].t === 'prompt' && await D.evaluate(() => DATA.some(r => r.id === ID_DUP)));
  D.resp = 'cobro duplicado'; D.dialogs = [];
  await D.evaluate(() => borrar(ID_DUP)); await D.waitForTimeout(1500);
  const f4 = filasCierres().filter(f => f.fecha === '2026-10-20')[0];
  OK('con motivo se borra (prompt y después el confirm de siempre) y queda en la nota del cierre del 20/10', D.dialogs.map(d => d.t).join(',') === 'prompt,confirm' && await D.evaluate(() => !DATA.some(r => r.id === ID_DUP)) && /Se borró la atención de Dup Hoy del 20\/10\/2026 \(Bs 100 cobrados\)\. Cambio con el día cerrado \(20\/10\/2026\): cobro duplicado/.test(f4.nota) && f4.contado === 510, f4);
  await caja(D); t = await tarjeta(D);
  OK('la tarjeta avisa que lo esperado cambió después del cierre (esperaba 500, ahora 400)', t && /esperaba Bs 500; ahora Bs 400/.test(t.txt), t && t.txt.match(/Ojo[^.]*\./));
  /* una atención sin plata de un día cerrado no pide motivo */
  D.dialogs = []; await D.evaluate(() => { const id = at('Sin Plata', '2026-10-20', '', 0, { estado: 'No asistió', acuenta: 0, pagos: [], metodo: '' }); borrar(id); });
  OK('borrar una visita sin cobro no pide motivo', D.dialogs.map(d => d.t).join(',') === 'confirm');

  /* ---------- sin conexión: queda en la cola y sube al reconectar ---------- */
  await D.evaluate(() => { CONNECTED = false; mdCiIrA('2026-10-16'); }); await D.waitForTimeout(400);
  await cerrar(D, 0, 'viernes sin movimientos');
  const pq = await D.evaluate(() => pend().filter(x => x.action === 'cierre').map(x => ({ f: x.rec.fecha, k: claveCola(x.action, x.rec) })));
  t = await tarjeta(D);
  OK('sin conexión el cierre espera en la cola (clave ci:fecha) y la tarjeta lo dice', pq.length === 1 && pq[0].f === '2026-10-16' && pq[0].k === 'ci:2026-10-16' && /sube cuando haya conexión/.test(t.est) && t.chips.some(c => c.f === '2026-10-16' && /pend/.test(c.cls)), [pq, t.est]);
  await cerrar(D, 5, 'corregido');
  OK('cerrar de nuevo sin conexión reemplaza lo que esperaba, no lo duplica', await D.evaluate(() => pend().filter(x => x.action === 'cierre').length === 1 && pend().filter(x => x.action === 'cierre')[0].rec.contado === 5));
  OK('mientras tanto la hoja no lo tiene', !filasCierres().some(f => f.fecha === '2026-10-16'));
  await D.evaluate(() => { CONNECTED = true; return flushQueue(); }); await D.waitForTimeout(800);
  const f5 = filasCierres().filter(f => f.fecha === '2026-10-16')[0];
  OK('al reconectar sube: fila del 16/10 con contado 5 y su nota, y la cola queda vacía', f5 && f5.contado === 5 && f5.nota === 'corregido' && f5.quien === 'Dueña' && await D.evaluate(() => pend().length === 0 && !MD_CI.lista.some(x => x.pendiente)), f5);

  /* ---------- el Apps Script viejo: la acción no existe → aviso y cierre local de antes ---------- */
  server.respuestaForzada = (body) => body.action === 'cierre' ? { ok: false, error: 'accion_desconocida' } : null;
  await E.evaluate(() => mdCiIrA('2026-10-15')); await E.waitForTimeout(400);
  await cerrar(E, 40);
  t = await tarjeta(E);
  OK('con el script viejo avisa «Falta pegar el Apps Script nuevo» y nada queda colgado en la cola', await E.evaluate(() => __toasts.some(m => /Falta pegar el Apps Script nuevo/.test(m)) && MD_CI.srv === false && pend().length === 0), await E.evaluate(() => __toasts.slice(-2)));
  OK('el cierre sigue andando en local: «Solo en este aparato», semáforo rojo (40 contra 0) y el cartel del script viejo', t && /Solo en este aparato/.test(t.est) && t.luz === 'r' && t.viejo && await E.evaluate(() => mdPref('CIERRE_2026-10-15') === 40), t && [t.est, t.luz, t.viejo]);
  OK('y la hoja no tiene ese día', !filasCierres().some(f => f.fecha === '2026-10-15'));
  server.respuestaForzada = null;
  await E.evaluate(() => pullServer()); await E.waitForTimeout(600); await caja(E);
  OK('cuando el script nuevo contesta, el panel vuelve a usar la hoja', await E.evaluate(() => MD_CI.srv === true) && !(await tarjeta(E)).viejo);

  /* ---------- una doctora: ni ve el cierre ni puede cerrar ---------- */
  const Dr = await abrir('pa-doc-1');
  OK('la doctora entra con su clave', await Dr.evaluate(() => ROL === 'doctora' && PROF_ACTUAL === 'Dra. Mirna'));
  await Dr.evaluate(() => { try { show('caja'); } catch (e) {} try { renderCaja(); } catch (e) {} }); await Dr.waitForTimeout(400);
  OK('no tiene tarjeta de cierre ni recibe los cierres', await Dr.evaluate(() => !$('#md-cierre') && MD_CI.lista.length === 0));
  const rd = await Dr.evaluate(() => api('cierre', { fecha: hoyISO(), contado: 1, esperado: 1, quien: 'Dra. Mirna' }).then(r => r && r.error));
  OK('el servidor no la deja cerrar (sin_permiso) aunque lo intente por la API', rd === 'sin_permiso', rd);
  const tokDr = server.ctx.nuevaSesion({ rol: 'doctora', prof: 'Dra. Mirna', h: v.prof['Dra. Mirna'], fabrica: false });
  const ld = server.handle({ action: 'list', token: tokDr }, { panel: true });
  OK('a una doctora list le manda cierres vacíos (como los egresos)', ld.ok && Array.isArray(ld.cierres) && ld.cierres.length === 0 && filasCierres().length >= 4);
  OK('Sonri tiene la ayuda nueva y la novedad (solo para dueña/recepción)', await D.evaluate(() => ASIS_AYUDA.some(a => a.q === '¿Cómo cierro la caja del día?') && ASIS_NOVEDADES.some(n => n.id === 'md-cierre-hoja' && n.si()) && asisBuscar('cerrar la caja').map(i => ASIS_AYUDA[i].q).some(q => /cierro la caja del día/.test(q))));
  OK('para la doctora la novedad no aparece', await Dr.evaluate(() => !ASIS_NOVEDADES.filter(n => n.id === 'md-cierre-hoja')[0].si()));
  await Dr.context().close();

  /* ---------- la captura: la tarjeta de hoy de la dueña, con la tira ---------- */
  if (process.env.SHOT) {
    await D.evaluate(() => mdCiIrA('2026-10-20')); await D.waitForTimeout(500);
    await D.evaluate(() => { ['header', '#md-barra', '#toast'].forEach(s => { const e = document.querySelector(s); if (e) e.style.visibility = 'hidden'; }); });
    await D.locator('#md-cierre').screenshot({ path: process.env.SHOT });
    console.log('captura', process.env.SHOT);
  }
  await D.context().close(); await E.context().close();
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
