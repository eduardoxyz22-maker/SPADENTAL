/* «📄 Armar presupuesto»: desde un plan y desde una recomendación. Ítems precargados, cambiar un precio,
   descuento, cuotas, validez, la imagen 1080×1350 (descarga y envío), imprimir, el texto por WhatsApp,
   y que la recomendación quede marcada «presupuesto entregado» y suba al servidor (_extra_json).
   Chromium real, .gs real en memoria, sin red real. Datos ficticios.
   Uso: PANEL=spa|cos node -r ./netguard.js e2e-md-presupuesto.js
        IMG_OUT=/ruta/presupuesto.jpg guarda la imagen generada · SHOT_OUT=/ruta/ventana.png guarda la captura 1366 de la ventana */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path'), fs = require('fs');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false; server.latency = 300;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('pr-duena-1'); v.prof['Dra. Shirley'] = server.ctx.shaHex('pr-shirley-1'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const abrir = async (clave) => {
    const page = await (await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true })).newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    /* sin navegador real para compartir ni imprimir: se anota qué se pidió */
    await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve();
      window.print = () => { window.__printed = (window.__printed || 0) + 1; };
      window.open = (u) => { window.__opened = u; return null; }; });
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.fill('#gate-pass', clave); await page.click('#gate-btn'); await page.waitForTimeout(2000);
    return page;
  };
  const dims = (P, buf) => P.evaluate((b64) => new Promise(ok => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.src = 'data:image/jpeg;base64,' + b64; }), buf.toString('base64'));
  const texto = (P, sel) => P.locator(sel).innerText();

  const D = await abrir('pr-duena-1');
  /* ---- datos ficticios: una atención con dos recomendaciones (una sin monto: toma el de la lista) y un plan con etapas y cuotas ---- */
  const S = await D.evaluate(() => {
    const hoy = hoyISO(), prof = (CFG.prof || []).filter(p => p && p !== 'Por definir')[0];
    const lista = (CFG.precios || []).filter(x => num(x.precio) > 0 && !/consulta/i.test(x.nom));
    const srvLista = lista[0].nom, precioLista = num(lista[0].precio);
    const consulta = (CFG.precios || []).filter(x => /consulta|valoraci/i.test(x.nom))[0] || { nom: 'Consulta', precio: 100 };
    const at = normalize({ id: uid(), fecha: addDias(hoy, -3), hora: '10:00', paciente: 'Presu Prueba', profesional: prof, estado: 'Atendido', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Espontánea', celular: '71234567',
      servicios: [{ nom: consulta.nom, cant: 1, precio: num(consulta.precio) }], total: num(consulta.precio), acuenta: num(consulta.precio), saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: num(consulta.precio) }],
      presu: [{ id: uid(), nom: srvLista, monto: 0, motivo: 'lo piensa' }, { id: uid(), nom: 'Carillas de resina', monto: 450 }], ts: new Date().toISOString() });
    DATA.push(at); queue('save', at, null); saveLocal();
    const f = pacBlanco('Presu Prueba'), plan = { id: uid(), nombre: 'Ortodoncia prueba', fecha: hoy, total: 3000, estado: 'activo', prof: prof, notas: '',
      sesiones: [{ n: 1, desc: 'Evaluación y diagnóstico', precio: 500 }, { n: 2, desc: 'Instalación de brackets', precio: 1500 }, { n: 3, desc: 'Controles mensuales', precio: 1000 }], cuotas: armarCuotas(3000, 3, hoy, 30) };
    f.planes.push(plan); savePac(f);
    return flushQueue().then(() => ({ atId: at.id, planId: plan.id, prof, srvLista, precioLista, hoy }));
  });
  await D.waitForTimeout(1500);
  OK('la atención con recomendaciones y la ficha con el plan subieron', !!server.registros[S.atId] && !!server.pacientes['presu prueba'], Object.keys(server.registros).length);

  /* ---- (a) la ficha del paciente: botón junto a Planes y las recomendaciones sin marca ---- */
  await D.evaluate(() => verPaciente('Presu Prueba')); await D.waitForTimeout(900);
  const juntoAPlanes = await D.evaluate(() => { const bs = Array.from(document.querySelectorAll('#modal .row-btn button')); const i = bs.findIndex(b => /Planes/.test(b.textContent)); return i >= 0 && /Armar presupuesto/.test((bs[i + 1] || {}).textContent || ''); });
  OK('ficha: «📄 Armar presupuesto» junto a «Planes»', juntoAPlanes);
  OK('ficha: sección Recomendado con las dos recomendaciones, sin respuesta y sin presupuesto entregado', await D.locator('#md-pr-recs .md-pr-rec').count() === 2 && /sin respuesta/.test(await texto(D, '#md-pr-recs')) && !/Presupuesto entregado/.test(await texto(D, '#md-pr-recs')));

  /* ---- (b) desde el plan ---- */
  await D.evaluate((S) => verPlan('Presu Prueba', S.planId), S); await D.waitForTimeout(900);
  const juntoAWa = await D.evaluate(() => { const bs = Array.from(document.querySelectorAll('#modal .row-btn button')); const i = bs.findIndex(b => /Enviar presupuesto por WhatsApp/.test(b.textContent)); return i >= 0 && /Armar presupuesto/.test((bs[i + 1] || {}).textContent || ''); });
  OK('plan: «📄 Armar presupuesto» junto a «Enviar presupuesto por WhatsApp»', juntoAWa);
  await D.locator('#modal button.md-pr-bt').click(); await D.waitForTimeout(800);
  OK('se abre la ventana de armado con las 3 etapas y sus importes', await D.locator('#md-pr-items .md-pr-fila[data-i]').count() === 3 && await D.inputValue('#md-pr-items .md-pr-fila[data-i="1"] .md-pr-precio') === '1500', await D.locator('#md-pr-items').innerText());
  OK('total Bs 3.000 y, por las cuotas del plan, 3 cuotas de Bs 1.000', /Bs 3\.000/.test(await texto(D, '#md-pr-tot .md-pr-total')) && await D.isChecked('#md-pr-cuotason') && await D.inputValue('#md-pr-cuotas') === '3' && /3 cuotas de\s*Bs 1\.000/.test(await texto(D, '#md-pr-tot')), await texto(D, '#md-pr-tot'));
  OK('la doctora viene del plan y la validez por defecto es 15 días', await D.inputValue('#md-pr-prof') === S.prof && await D.inputValue('#md-pr-validez') === '15');
  /* cambiar un precio, descuento, cuotas y validez */
  await D.fill('#md-pr-items .md-pr-fila[data-i="1"] .md-pr-precio', '1200'); await D.waitForTimeout(150);
  OK('cambiar un precio recalcula: total Bs 2.700', /Bs 2\.700/.test(await texto(D, '#md-pr-tot .md-pr-total')), await texto(D, '#md-pr-tot .md-pr-total'));
  await D.fill('#md-pr-desc', '10%'); await D.waitForTimeout(150);
  OK('descuento del 10%: Bs 270 y total Bs 2.430', /Bs 270/.test(await texto(D, '#md-pr-tot')) && /Bs 2\.430/.test(await texto(D, '#md-pr-tot .md-pr-total')), await texto(D, '#md-pr-tot'));
  await D.fill('#md-pr-cuotas', '3'); await D.waitForTimeout(150);
  OK('en 3 cuotas: Bs 810 cada una (misma regla que los planes)', /3 cuotas de\s*Bs 810/.test(await texto(D, '#md-pr-tot')), await texto(D, '#md-pr-tot'));
  await D.fill('#md-pr-validez', '20'); await D.waitForTimeout(150);
  const hasta20 = await D.evaluate(() => fmtF(addDias(hoyISO(), 20)));
  OK('validez de 20 días: válido hasta ' + hasta20, (await texto(D, '#md-pr-tot')).indexOf(hasta20) >= 0);
  await D.waitForTimeout(600);
  OK('la vista previa se arma sola', /^data:image\/jpeg/.test(await D.getAttribute('#md-pr-prev', 'src') || ''));
  /* la imagen: descarga */
  const [dl] = await Promise.all([D.waitForEvent('download'), D.locator('#modal button', { hasText: 'Descargar imagen' }).click()]);
  const jpg = fs.readFileSync(await dl.path()), d1 = await dims(D, jpg);
  OK('descarga «Presupuesto Presu Prueba <fecha>.jpg» de 1080×1350', /^Presupuesto Presu Prueba \d{4}-\d\d-\d\d\.jpg$/.test(dl.suggestedFilename()) && d1[0] === 1080 && d1[1] === 1350 && jpg.length > 20000, [dl.suggestedFilename(), d1, jpg.length]);
  if (process.env.IMG_OUT) fs.writeFileSync(process.env.IMG_OUT, jpg);
  await D.waitForTimeout(1500);
  const planSrv = (server.pacientes['presu prueba'].planes || [])[0] || {};
  OK('el plan quedó con «presupuesto entregado» hoy y subió al servidor', await D.evaluate((S) => planesDe('Presu Prueba')[0].presuEntregado === S.hoy, S) && planSrv.presuEntregado === S.hoy && planSrv.presuEntregadoTotal === 2430, [planSrv.presuEntregado, planSrv.presuEntregadoTotal]);
  /* mandar por WhatsApp: sin compartir del sistema, baja la imagen y abre el chat */
  const [dl2] = await Promise.all([D.waitForEvent('download'), D.locator('#modal button', { hasText: 'Mandar por WhatsApp' }).click()]);
  const opened = await D.evaluate(() => window.__opened || '');
  OK('«Mandar por WhatsApp» (sin compartir del sistema) baja la imagen y abre el chat con el total', /\.jpg$/.test(dl2.suggestedFilename()) && /wa\.me\/59171234567/.test(opened) && decodeURIComponent(opened).indexOf('Bs 2.430') >= 0, opened.slice(0, 80));
  await D.evaluate((S) => verPlan('Presu Prueba', S.planId), S); await D.waitForTimeout(800);
  OK('la ventana del plan dice «Presupuesto entregado el …»', /Presupuesto entregado el/.test(await texto(D, '#modal')));

  /* ---- (c) desde la atención guardada con recomendaciones ---- */
  await D.evaluate((S) => verFicha(S.atId), S); await D.waitForTimeout(900);
  OK('la atención muestra lo recomendado y el botón', await D.locator('#md-pr-at .mrow').count() === 2 && await D.locator('#md-pr-at button.md-pr-bt').count() === 1 && !/Presupuesto entregado/.test(await texto(D, '#md-pr-at')));
  await D.locator('#md-pr-at button.md-pr-bt').click(); await D.waitForTimeout(800);
  const nom0 = await D.inputValue('#md-pr-items .md-pr-fila[data-i="0"] .md-pr-nom'), pr0 = await D.inputValue('#md-pr-items .md-pr-fila[data-i="0"] .md-pr-precio'), pr1 = await D.inputValue('#md-pr-items .md-pr-fila[data-i="1"] .md-pr-precio');
  OK('ítems precargados: el recomendado sin monto toma el precio de la lista, el otro su monto', nom0 === S.srvLista && +pr0 === S.precioLista && pr1 === '450', [nom0, pr0, pr1]);
  const totRec = await D.evaluate(() => mdPrCuentas(MD_PR).total);
  OK('total = precio de lista + 450, sin cuotas', totRec === S.precioLista + 450 && !(await D.isChecked('#md-pr-cuotason')));
  await D.fill('#md-pr-nota', 'Se puede empezar con la mitad y el resto al terminar.'); await D.waitForTimeout(600);
  if (process.env.SHOT_OUT) await D.screenshot({ path: process.env.SHOT_OUT });
  /* imprimir */
  await D.locator('#modal button', { hasText: 'Imprimir' }).click(); await D.waitForTimeout(300);
  const imp = await D.evaluate(() => ({ n: window.__printed || 0, cls: document.body.classList.contains('md-pr-imprimiendo'), html: (document.querySelector('#md-pr-print') || {}).innerText || '' }));
  await D.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  OK('«Imprimir» arma la hoja limpia (clínica, ítems, total) y llama a imprimir', imp.n === 1 && imp.cls && imp.html.indexOf(await D.evaluate(() => clinica())) >= 0 && imp.html.indexOf('Carillas de resina') >= 0 && /TOTAL/.test(imp.html) && !(await D.evaluate(() => document.body.classList.contains('md-pr-imprimiendo'))));
  await D.waitForTimeout(1500);
  const reg = server.registros[S.atId] || {};
  OK('la recomendación quedó «presupuesto entregado» hoy en el registro y en el servidor (_extra_json)', await D.evaluate((S) => DATA.filter(r => r.id === S.atId)[0].presuEntregado === S.hoy, S) && reg.presuEntregado === S.hoy && reg.presuEntregadoComo === 'impreso' && reg.presuEntregadoTotal === totRec && reg.presuEntregadoPor === S.prof, [reg.presuEntregado, reg.presuEntregadoComo, reg.presuEntregadoTotal]);
  OK('las recomendaciones mismas no cambiaron (ni estado ni monto)', (reg.presu || []).length === 2 && !reg.presu[0].estado && reg.presu[1].monto === 450);
  /* el texto por WhatsApp */
  await D.locator('#modal button', { hasText: 'Solo el texto' }).click(); await D.waitForTimeout(500);
  const wa = await texto(D, '#wa-txt'), hasta15 = await D.evaluate(() => fmtF(addDias(hoyISO(), 15)));
  const href = await D.getAttribute('#modal a.btn', 'href');
  OK('el texto incluye cada ítem, el total y la validez', wa.indexOf('Carillas de resina') >= 0 && wa.indexOf('Total: *' + await D.evaluate(t => bs(t), totRec) + '*') >= 0 && wa.indexOf('Válido hasta el ' + hasta15) >= 0, wa.slice(0, 120));
  OK('«Abrir WhatsApp» va al celular del paciente con ese texto', /wa\.me\/59171234567/.test(href) && decodeURIComponent(href).indexOf('Válido hasta el ' + hasta15) >= 0);
  await D.locator('#modal button', { hasText: 'Copiar texto' }).click(); await D.waitForTimeout(1500);
  OK('copiar el texto también lo anota como entregado (texto)', (server.registros[S.atId] || {}).presuEntregadoComo === 'texto');
  await D.evaluate(() => verPaciente('Presu Prueba')); await D.waitForTimeout(900);
  OK('en la ficha, la recomendación dice «Presupuesto entregado el ' + (await D.evaluate(() => fmtF(hoyISO()))) + '»', (await texto(D, '#md-pr-recs')).indexOf('Presupuesto entregado el ' + await D.evaluate(() => fmtF(hoyISO()))) >= 0);
  /* la ficha sin recomendaciones pendientes y sin plan: ventana vacía para armar a mano; agregar y quitar líneas */
  await D.evaluate(() => { const r = normalize({ id: uid(), fecha: hoyISO(), hora: '09:00', paciente: 'Sin Nada', profesional: CFG.prof[0], estado: 'Atendido', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Espontánea', servicios: [], total: 0, acuenta: 0, saldo: 0, pagos: [], ts: new Date().toISOString() }); DATA.push(r); saveLocal(); verPaciente('Sin Nada'); });
  await D.waitForTimeout(700); await D.locator('#modal button.md-pr-bt').click(); await D.waitForTimeout(500);
  await D.fill('#md-pr-items .md-pr-fila[data-i="0"] .md-pr-nom', 'Limpieza'); await D.fill('#md-pr-items .md-pr-fila[data-i="0"] .md-pr-precio', '150');
  await D.click('#md-pr-agregar'); await D.fill('#md-pr-items .md-pr-fila[data-i="1"] .md-pr-nom', 'Flúor'); await D.fill('#md-pr-items .md-pr-fila[data-i="1"] .md-pr-precio', '50'); await D.fill('#md-pr-items .md-pr-fila[data-i="1"] .md-pr-cant', '2'); await D.waitForTimeout(150);
  OK('a mano: agregar líneas y cantidad (150 + 2×50 = Bs 250)', /Bs 250/.test(await texto(D, '#md-pr-tot .md-pr-total')), await texto(D, '#md-pr-tot .md-pr-total'));
  await D.click('#md-pr-items .md-pr-fila[data-i="0"] .md-pr-del'); await D.waitForTimeout(150);
  OK('quitar una línea: queda Bs 100', await D.locator('#md-pr-items .md-pr-fila[data-i]').count() === 1 && /Bs 100/.test(await texto(D, '#md-pr-tot .md-pr-total')));
  /* Sonri */
  const sonri = await D.evaluate(() => ({ nov: ASIS_NOVEDADES.some(n => n.id === 'md-presupuesto'), ay: ASIS_AYUDA.some(a => /presupuesto prolijo/.test(a.q)) }));
  OK('Sonri: novedad y pregunta «¿Cómo le mando un presupuesto prolijo?»', sonri.nov && sonri.ay);
  await D.context().close();

  /* ---- la doctora: la doctora queda fija y marca solo lo suyo ---- */
  if (SPA) {
    const P = await abrir('pr-shirley-1');
    await P.evaluate(() => { const hoy = hoyISO(); const r = normalize({ id: uid(), fecha: addDias(hoy, -1), hora: '11:00', paciente: 'De Shirley', profesional: 'Dra. Shirley', estado: 'Atendido', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Espontánea', celular: '70000001',
      servicios: [{ nom: 'Consulta', cant: 1, precio: 100 }], total: 100, acuenta: 100, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 100 }], presu: [{ id: uid(), nom: 'Endodoncia', monto: 900 }], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); saveLocal(); window.__id = r.id; return flushQueue(); });
    await P.waitForTimeout(1200);
    await P.evaluate(() => verFicha(window.__id)); await P.waitForTimeout(800);
    await P.locator('#md-pr-at button.md-pr-bt').click(); await P.waitForTimeout(600);
    OK('doctora: la doctora del presupuesto es ella y no se cambia', await P.inputValue('#md-pr-prof') === 'Dra. Shirley' && await P.evaluate(() => document.querySelector('#md-pr-prof').disabled));
    await P.locator('#modal button', { hasText: 'Imprimir' }).click(); await P.waitForTimeout(1800);
    const id = await P.evaluate(() => window.__id), rd = server.registros[id] || {};
    OK('doctora: su recomendación queda marcada y sube al servidor', rd.presuEntregado === await P.evaluate(() => hoyISO()) && rd.presuEntregadoPor === 'Dra. Shirley', [rd.presuEntregado, rd.presuEntregadoPor]);
    const ajena = await P.evaluate((S) => { const t0 = document.querySelector('#toast').textContent; mdPrDesdeAtencion(S.atId); return document.querySelector('#toast').textContent; }, S);
    OK('doctora: no arma presupuestos sobre la atención de otra', /otra doctora/.test(ajena), ajena);
    await P.context().close();
  }
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
