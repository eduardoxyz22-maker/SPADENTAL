/* Fotos del antes y del después en la ficha: subir (achicada), comparar, autorizar, borrar y permisos.
   Chromium real, .gs real en memoria con Google Drive simulado. Datos ficticios; sin red real. */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const VIEJO = path.join(__dirname, SPA ? 'viejo-spa.gs' : 'viejo-cos.gs');
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(66), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const preparar = (gs) => { const server = gsServer(gs); server.shimClaves = false; server.sesionDirecta = false;
    const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('fo-duena-1'); v.prof['Dra. Shirley'] = server.ctx.shaHex('fo-shirley-1'); v.equipo = server.ctx.shaHex('fo-equipo-1'); server.ctx.guardarVerif(v); return server; };
  const abrir = async (server, clave) => {
    const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async r => { const u = r.request().url(); if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.fill('#gate-pass', clave); await page.click('#gate-btn'); await page.waitForTimeout(1800);
    return page;
  };
  /* una foto de 2400×1800 del color pedido, como si viniera de la cámara */
  const subir = (P, nombre, color) => P.evaluate(([n, col]) => new Promise(ok => {
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1800; const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 2400, 1800);
    g.fillStyle = '#333'; g.fillRect(200, 600, 2000, 600);
    c.toBlob(bl => { mdFotoElegida(n, { files: [new File([bl], 'camara.jpg', { type: 'image/jpeg' })], value: '' }); ok(); }, 'image/jpeg', 0.9); }), [nombre, color]);
  const filas = (server) => (server.ctx.getSheetFotos()._rows || []).slice(1);

  const server = preparar(GS);
  const D = await abrir(server, 'fo-duena-1');
  await D.evaluate(() => { const hoy = hoyISO();
    const at = (pac, prof, d) => { const r = normalize({ id: uid(), fecha: addDias(hoy, d), hora: '10:00', paciente: pac, profesional: prof, estado: 'Atendido', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Espontánea', celular: '70000009',
      servicios: [{ nom: 'Blanqueamiento dental · 1 sesión', cant: 1, precio: 233 }], total: 233, acuenta: 233, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 233 }], ts: new Date().toISOString() }); DATA.push(r); queue('save', r, null); };
    at('Foto Prueba', 'Dra. Shirley', -5); at('Otra Doctora', 'Dra. Mirna', -3); saveLocal(); return flushQueue(); });
  await D.waitForTimeout(1200);
  /* la dueña sube una foto de una paciente de otra doctora (para probar permisos) */
  await D.evaluate(() => verPaciente('Otra Doctora')); await D.waitForTimeout(800);
  await subir(D, 'Otra Doctora', '#d8c890'); await D.waitForTimeout(1500);
  await D.click('#ft-ok'); await D.waitForTimeout(1500);
  OK('la dueña guardó una foto de «Otra Doctora»', filas(server).length === 1 && Object.keys(server.drive.archivos).length === 1, filas(server).length);
  await D.context().close();

  const P = await abrir(server, SPA ? 'fo-shirley-1' : 'fo-equipo-1');
  await P.evaluate(() => verPaciente('Foto Prueba')); await P.waitForTimeout(1000);
  OK('la ficha tiene la sección Fotos, vacía', await P.locator('#md-fotos').count() === 1 && /Todavía no hay fotos/.test(await P.locator('#md-fotos').innerText()));
  OK('botones Sacar foto y Subir de la galería', await P.locator('#md-fotos input[type=file][capture]').count() === 1 && await P.locator('#md-fotos input[type=file]:not([capture])').count() === 1);
  /* antes */
  await subir(P, 'Foto Prueba', '#e0cf95'); await P.waitForTimeout(1500);
  OK('el formulario sugiere «Antes» y el tratamiento', await P.evaluate(() => getRadio('fttipo')) === 'antes' && /blanqueamiento/i.test(await P.inputValue('#ft-trat')), await P.inputValue('#ft-trat'));
  await P.click('#ft-ok'); await P.waitForTimeout(1500);
  let F = filas(server);
  const tam = await P.evaluate(() => { const d = Object.values(MD_FOTO_GRANDE)[0]; return new Promise(ok => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight, d.length]); i.src = d; }); });
  OK('guardada en Drive y en la hoja, achicada a 1600 px', F.length === 2 && tam[0] === 1600 && tam[1] === 1200 && tam[2] < 1500000, tam);
  const fila1 = F[1];
  OK('la fila: paciente, tipo antes, la cargó quien corresponde, miniatura chica', fila1[1] === 'Foto Prueba' && fila1[3] === 'antes' && fila1[9] === (SPA ? 'Dra. Shirley' : 'Recepción') && String(fila1[7]).length > 100 && String(fila1[7]).length < 45000, [fila1[3], fila1[9], String(fila1[7]).length]);
  /* después */
  await subir(P, 'Foto Prueba', '#fbfaf4'); await P.waitForTimeout(1500);
  OK('la segunda sugiere «Después»', await P.evaluate(() => getRadio('fttipo')) === 'despues');
  await P.click('#ft-aut'); await P.click('#ft-ok'); await P.waitForTimeout(2000);
  OK('la ficha muestra el antes y el después para comparar', await P.locator('#md-cmp img').count() === 2 && await P.locator('#md-fotos .md-foto-th').count() === 2);
  await P.evaluate(() => mdCmp(20)); OK('la barra compara', await P.evaluate(() => $('#md-cmp .md-cmp-des').style.clipPath) === 'inset(0px 0px 0px 20%)' || await P.evaluate(() => $('#md-cmp .md-cmp-des').style.clipPath) === 'inset(0 0 0 20%)');
  F = filas(server); OK('la del después quedó autorizada para publicidad', F[2][3] === 'despues' && F[2][8] === 'SÍ', F[2][8]);
  /* abrir la del antes: se ve grande, se autoriza, se borra */
  const idA = String(F[1][0]);
  await P.locator('#md-fotos .md-foto-th').last().click(); await P.waitForTimeout(1200);
  OK('abre la foto grande', /^data:image\/jpeg;base64,/.test(await P.getAttribute('#md-foto-img', 'src')) && /Antes/.test(await P.locator('#modal h3').innerText()));
  await P.locator('#modal .md-foto-aut input').check(); await P.waitForTimeout(800);
  OK('autorizar desde la foto lo guarda en la hoja', filas(server)[1][8] === 'SÍ');
  await P.locator('#modal button', { hasText: /^Borrar$/ }).click(); await P.waitForTimeout(1500);
  const arch = server.drive.archivos[Object.keys(server.drive.archivos).find(k => server.ctx.getSheetFotos()._rows.slice(1).some(r => r[0] === idA && r[6] === k))];
  OK('borrada: a la papelera de Drive y marcada en la hoja', !!filas(server)[1][11] && arch && arch.trashed === true && await P.locator('#md-fotos .md-foto-th').count() === 1);
  /* permisos: la doctora no ve las fotos de pacientes de otra doctora */
  if (SPA) {
    const otra = await P.evaluate(() => api('fotos', null, undefined, undefined, { consulta: { paciente: 'Otra Doctora' } }));
    const ver = await P.evaluate((id) => api('fotoVer', null, undefined, undefined, { consulta: { id } }), String(filas(server)[0][0]));
    OK('la doctora no ve ni abre fotos de pacientes de otra doctora', otra.ok && otra.fotos.length === 0 && ver.ok === false && ver.error === 'sin_permiso', [otra.fotos.length, ver.error]);
    const borra = await P.evaluate((id) => api('fotoBorrar', null, undefined, undefined, { consulta: { id } }), String(filas(server)[0][0]));
    OK('ni la borra', borra.ok === false && !filas(server)[0][11], borra.error);
  } else {
    const otra = await P.evaluate(() => api('fotos', null, undefined, undefined, { consulta: { paciente: 'Otra Doctora' } }));
    OK('recepción ve las fotos de cualquier paciente', otra.ok && otra.fotos.length === 1);
  }
  await P.context().close();

  /* con el Apps Script viejo: avisa que falta pegarlo */
  const viejo = preparar(VIEJO);
  const V = await abrir(viejo, 'fo-duena-1');
  await V.evaluate(() => { const r = normalize({ id: uid(), fecha: hoyISO(), hora: '10:00', paciente: 'Foto Vieja', profesional: 'Dra. Shirley', estado: 'Atendido', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Espontánea', servicios: [], total: 0, acuenta: 0, saldo: 0, pagos: [], ts: new Date().toISOString() }); DATA.push(r); saveLocal(); verPaciente('Foto Vieja'); });
  await V.waitForTimeout(1500);
  OK('con el Apps Script viejo avisa que falta pegarlo', /Falta pegar el Apps Script nuevo/.test(await V.locator('#md-fotos').innerText()), await V.locator('#md-fotos').innerText());
  await V.context().close();
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
