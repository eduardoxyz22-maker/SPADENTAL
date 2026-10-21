/* Corregir el nombre de un paciente en toda su historia (caso real 28/10:
   se le agregó el apellido a «Melvy buceta» en una visita y la historia quedó
   partida en dos). «✏️ Corregir nombre» en la ficha, el aviso al guardar una
   atención con otro nombre, unir dos historias desde «Pacientes repetidos»
   (ahora también encuentra «un nombre contiene al otro»), una pantalla vieja
   que guarda la ficha con el nombre viejo, permisos y el Apps Script anterior.
   Chromium real, .gs real en memoria, datos ficticios, sin red real. */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false; server.latency = 600;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('nm-duena-1'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const responder = async (r) => { const body = JSON.parse(r.request().postData() || '{}'); if (server.latency) await new Promise(x => setTimeout(x, server.latency)); return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(body)) }); };
  const abrir = async () => {
    const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return responder(r);
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.evaluate(() => { const t = window.toast; window.TOASTS = []; window.toast = function (m, e) { window.TOASTS.push(String(m)); return t.apply(this, arguments); }; });
    await page.fill('#gate-pass', 'nm-duena-1'); await page.click('#gate-btn'); await page.waitForTimeout(2200);
    return page;
  };
  const hoja = () => server.ctx.doList();
  const filasDe = (n) => { const k = server.ctx.fClavePac(n); return hoja().registros.filter(r => server.ctx.fClavePac(r.paciente) === k); };
  const fichaDe = (n) => { const k = server.ctx.fClavePac(n); return hoja().pacientes.filter(p => server.ctx.fClavePac(p.nombre) === k); };

  const A = await abrir();
  /* datos ficticios: Melvy con 2 visitas, una cita, un pago a su plan, ficha con alergia y plan, y una foto */
  const PLAN = await A.evaluate(() => {
    const hoy = hoyISO(), prof = CFG.prof[0] || 'Dra. Shirley';
    const at = (pac, d, o) => { const r = normalize(Object.assign({ id: uid(), fecha: addDias(hoy, d), hora: '10:00', paciente: pac, profesional: prof, estado: 'Atendido', tipo: 'Recurrente', canal: CFG.canales[0], origen: 'Programada', celular: /^melvy/i.test(pac) ? '62671640' : '7' + String(Math.abs([...pac].reduce((x, c) => (x * 31 + c.charCodeAt(0)) | 0, 7))).padStart(7, '1').slice(0, 7), servicios: [{ nom: 'Restauración de carie', cant: 1, precio: 200 }], total: 200, acuenta: 200, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 200 }], ts: new Date().toISOString() }, o || {})); DATA.push(r); queue('save', r, null); return r; };
    const plan = { id: uid(), nombre: 'Restauraciones', total: 1100, cuotas: 1, estado: 'activo', prof: prof, sesiones: [{ n: 1, desc: 'Etapa 1', precio: 550 }, { n: 2, desc: 'Etapa 2', precio: 550 }] };
    at('Melvy buceta', -9); at('Melvy buceta', -2, { servicios: [{ nom: 'Extracción simple', cant: 1, precio: 260 }], total: 260, acuenta: 250, saldo: 10, pagos: [{ metodo: 'QR', monto: 250 }] });
    at('Melvy buceta', 5, { estado: 'Agendada', servicios: [], total: 0, acuenta: 0, saldo: 0, metodo: '', pagos: [] });
    at('Melvy buceta', -2, { estado: 'Anticipo', planId: plan.id, servicios: [], total: 0, acuenta: 300, saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 300 }] });
    const f = pacBlanco('Melvy buceta'); f.med.alergias = 'Penicilina'; f.planes = [plan]; savePac(f);
    /* otros pacientes para los demás casos */
    at('Ana Lia', -20); at('Ana Lia', -6);
    at('Juan Paz', -15); at('Juan Paz', -4);
    at('Rosa Quispe', -30, { celular: '70000001' }); const fr = pacBlanco('Rosa Quispe'); fr.med.alergias = 'Látex'; savePac(fr);
    at('Rosa Quispe Mamani', -3, { celular: '70000002' }); const fm = pacBlanco('Rosa Quispe Mamani'); fm.med.notas = 'Bruxismo'; savePac(fm);
    saveLocal(); return flushQueue().then(() => plan.id); });
  await A.waitForTimeout(2500);
  server.ctx.getSheetFotos().appendRow(['ft1', 'Melvy buceta', '2026-10-12', 'antes', 'Restauración', '', 'drive-x', '', 'NO', 'Dueña', new Date().toISOString(), '']);
  await A.evaluate(() => pullServer()); await A.waitForTimeout(1800);
  OK('la hoja tiene a «Melvy buceta» con 4 filas y su ficha', filasDe('Melvy buceta').length === 4 && fichaDe('Melvy buceta').length === 1, filasDe('Melvy buceta').length);

  /* una pantalla vieja (B) abierta antes del cambio */
  const B = await abrir();
  OK('B ve a «Melvy buceta»', await B.evaluate(() => !!PAC[keyPac('Melvy buceta')]));

  /* 1) desde la ficha: «✏️ Corregir nombre» */
  await A.evaluate(() => verPaciente('Melvy buceta')); await A.waitForTimeout(700);
  OK('la ficha muestra «✏️ Corregir nombre»', await A.locator('#modal .cn-btn').count() === 1);
  await A.locator('#modal .cn-btn').click(); await A.waitForTimeout(400);
  const txt = await A.locator('#modal').innerText();
  OK('la ventana dice qué se corrige: visitas, cita, pago, plan, ficha, foto', /2 visitas, 1 cita, 1 pago, su plan, la ficha y 1 foto|2 visitas, 1 cita, 1 pago, su plan y la ficha/.test(txt) && /No cambia ningún cobro/.test(txt), txt.slice(0, 220));
  await A.fill('#cn-nom', 'melvy buceta perez'); await A.click('#cn-may');
  OK('«Aa Poner mayúsculas» deja «Melvy Buceta Perez»', await A.inputValue('#cn-nom') === 'Melvy Buceta Perez');
  if (process.env.SHOT) await A.screenshot({ path: process.env.SHOT + '-ventana.png', clip: await A.evaluate(() => { const r = document.querySelector('#modal').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: Math.min(r.height, 560) }; }) });
  await A.click('#cn-ok'); await A.waitForTimeout(3500);
  const tA = await A.evaluate(() => TOASTS.slice(-3));
  OK('avisa «Nombre corregido en toda la historia»', tA.some(t => /Nombre corregido en toda la historia/.test(t)), tA);
  OK('en la hoja: las 4 filas con el nombre nuevo y ninguna con el viejo', filasDe('Melvy Buceta Perez').length === 4 && filasDe('Melvy buceta').length === 0 && filasDe('Melvy Buceta Perez').every(r => r.paciente === 'Melvy Buceta Perez'));
  const fNueva = fichaDe('Melvy Buceta Perez');
  OK('una sola ficha, con la alergia y el plan; la vieja ya no está', fNueva.length === 1 && fichaDe('Melvy buceta').length === 0 && fNueva[0].med.alergias === 'Penicilina' && fNueva[0].planes.length === 1 && fNueva[0].planes[0].id === PLAN, fNueva.map(p => p.nombre));
  const fotos = server.ctx.getSheetFotos().getRange(2, 1, 1, 2).getValues();
  OK('la foto pasó al nombre nuevo', fotos[0][1] === 'Melvy Buceta Perez', fotos);
  const credito = server.ctx.creditosSrv(server.ctx.fClavePac('Melvy Buceta Perez'));
  OK('la plata no se movió: lo adelantado sigue en su plan (300) y la deuda (10) igual', credito.planes[PLAN] === 300 && filasDe('Melvy Buceta Perez').reduce((a, r) => a + Number(r.saldo || 0), 0) === 10, credito);
  const corr = server.ctx.hojaCorr(); const ult = corr.getRange(corr.getLastRow(), 1, 1, 11).getValues()[0];
  OK('queda anotado en _Correcciones (de → a, sin atribuirlo a una persona)', ult[3] === 'Melvy buceta → Melvy Buceta Perez' && /Nombre corregido/.test(ult[9]) && /Dueña/.test(ult[10]), ult);
  OK('la ficha se abre con el nombre nuevo', /Melvy Buceta Perez/.test(await A.locator('#modal').innerText()));
  OK('en A ya no queda nadie con el nombre viejo', await A.evaluate(() => !DATA.some(r => keyPac(r.paciente) === keyPac('Melvy buceta')) && !PAC[keyPac('Melvy buceta')]));
  if (process.env.SHOT) await A.screenshot({ path: process.env.SHOT + '-ficha.png', clip: await A.evaluate(() => { const r = document.querySelector('#modal').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: Math.min(r.height, 300) }; }) });
  await A.evaluate(() => closeModal());

  /* 2) la pantalla vieja guarda la ficha con el nombre viejo: va a la nueva, no reaparece la vieja */
  await B.evaluate(() => { const f = PAC[keyPac('Melvy buceta')]; f.med.notas = 'Sensibilidad en 45'; savePac(f); return flushQueue(); }); await B.waitForTimeout(2500);
  const fb = fichaDe('Melvy Buceta Perez');
  OK('B guardó con el nombre viejo: no reaparece «Melvy buceta» y la nota quedó en la ficha nueva', fichaDe('Melvy buceta').length === 0 && fb.length === 1 && /Sensibilidad en 45/.test(fb[0].med.notas) && fb[0].planes.length === 1 && fb[0].med.alergias === 'Penicilina', fb.map(p => [p.nombre, p.med.notas]));
  await B.evaluate(() => pullServer()); await B.waitForTimeout(1500);
  OK('B, al refrescar, ve solo el nombre nuevo', await B.evaluate(() => !DATA.some(r => keyPac(r.paciente) === keyPac('Melvy buceta')) && DATA.filter(r => r.paciente === 'Melvy Buceta Perez').length === 4));

  /* 3) editar una atención y cambiar el nombre: pregunta */
  const idAna = await A.evaluate(() => DATA.filter(r => r.paciente === 'Ana Lia').sort((a, b) => b.fecha.localeCompare(a.fecha))[0].id);
  await A.evaluate((id) => editarId(id), idAna); await A.waitForTimeout(600);
  await A.fill('#f-paciente', 'Ana Lia Rojas'); await A.click('#btn-save'); await A.waitForTimeout(700);
  const m3 = await A.locator('#modal').innerText().catch(() => '');
  OK('al guardar pregunta «Cambiaste el nombre» y explica que se partiría la historia', /Cambiaste el nombre/.test(m3) && /solo esta visita/.test(m3) && /1 visita/.test(m3), m3.slice(0, 260));
  if (process.env.SHOT) await A.screenshot({ path: process.env.SHOT + '-aviso.png', clip: await A.evaluate(() => { const r = document.querySelector('#modal').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: Math.min(r.height, 520) }; }) });
  await A.click('#nm-todo'); await A.waitForTimeout(5000);
  OK('«Corregir el nombre en toda su historia»: las 2 visitas como «Ana Lia Rojas»', filasDe('Ana Lia Rojas').length === 2 && filasDe('Ana Lia').length === 0, filasDe('Ana Lia Rojas').map(r => r.paciente));
  OK('y la atención editada se guardó (sin cola pendiente)', await A.evaluate(() => pend().length === 0 && EDIT_ID === null || pend().length === 0), await A.evaluate(() => pend().length));
  await A.evaluate(() => { try { closeModal() } catch (e) {} });

  const idJuan = await A.evaluate(() => DATA.filter(r => r.paciente === 'Juan Paz').sort((a, b) => b.fecha.localeCompare(a.fecha))[0].id);
  await A.evaluate((id) => editarId(id), idJuan); await A.waitForTimeout(600);
  await A.fill('#f-paciente', 'Juan Pazos'); await A.click('#btn-save'); await A.waitForTimeout(700);
  await A.click('#nm-solo'); await A.waitForTimeout(3500); await A.evaluate(() => { try { closeModal() } catch (e) {} });
  OK('«Es otra persona: solo esta visita»: una pasa a «Juan Pazos» y la otra queda', filasDe('Juan Pazos').length === 1 && filasDe('Juan Paz').length === 1, [filasDe('Juan Pazos').length, filasDe('Juan Paz').length]);

  /* 4) Pacientes repetidos: encuentra «un nombre contiene al otro» y une en el servidor */
  await A.click('nav button[data-v="pacientes"]'); await A.waitForTimeout(500);
  await A.click('#btn-buscar-rep'); await A.waitForTimeout(900);
  const par = A.locator('.rep-par', { hasText: 'Rosa Quispe Mamani' });
  OK('«Pacientes repetidos» encuentra Rosa Quispe / Rosa Quispe Mamani (un nombre contiene al otro)', await par.count() === 1 && /contiene al otro/i.test(await par.innerText()), [await par.count(), (await par.innerText().catch(() => '')).slice(0, 300)]);
  await par.locator('button', { hasText: 'dejar «Rosa Quispe Mamani»' }).click(); await A.waitForTimeout(4000);
  const fr = fichaDe('Rosa Quispe Mamani');
  OK('unidas: 2 visitas, una sola ficha con la alergia y la nota, sin la ficha vieja', filasDe('Rosa Quispe Mamani').length === 2 && filasDe('Rosa Quispe').length === 0 && fr.length === 1 && fr[0].med.alergias === 'Látex' && fr[0].med.notas === 'Bruxismo' && fichaDe('Rosa Quispe').length === 0, fr);
  const ult2 = corr.getRange(corr.getLastRow(), 1, 1, 11).getValues()[0];
  OK('_Correcciones dice «Historias unidas»', /Historias unidas/.test(ult2[9]), ult2[9]);
  await A.evaluate(() => pullServer()); await A.waitForTimeout(1500);
  OK('después de refrescar no reaparece «Rosa Quispe»', await A.evaluate(() => !PAC[keyPac('Rosa Quispe')] && !DATA.some(r => keyPac(r.paciente) === keyPac('Rosa Quispe'))));

  /* 5) unir desde la ficha: el nombre nuevo ya existe → avisa y une */
  await A.evaluate(() => verPaciente('Juan Pazos')); await A.waitForTimeout(600);
  await A.locator('#modal .cn-btn').click(); await A.waitForTimeout(300);
  await A.fill('#cn-nom', 'Juan Paz'); await A.dispatchEvent('#cn-nom', 'input');
  const m5 = await A.locator('#modal').innerText();
  OK('si el nombre ya es de otro paciente avisa «Ya hay un paciente…» y el botón dice «unir»', /Ya hay un paciente «Juan Paz»/.test(m5) && /unir y corregir/.test(await A.locator('#cn-ok').innerText()), m5.slice(0, 200));
  await A.evaluate(() => closeModal());

  /* 6) permisos en el servidor */
  { const vv = server.ctx.leerVerif(); vv.prof['Dra. Que No Es'] = server.ctx.shaHex('nm-doc-x-1'); server.ctx.guardarVerif(vv); }
  const tokD = server.ctx.nuevaSesion({ rol: 'doctora', prof: 'Dra. Que No Es', h: server.ctx.shaHex('nm-doc-x-1'), fabrica: false });
  const rd = server.handle({ action: 'renombrar', renombre: { de: 'Juan Paz', a: 'Juan Paz Otro' }, token: tokD }, { panel: true });
  OK('una doctora no corrige el nombre de un paciente de otra', rd.ok === false && rd.error === 'sin_permiso', rd);
  server.ctx.VERIF_PAUTA = server.ctx.shaHex('nm-pauta-1');
  const tokP = server.ctx.nuevaSesion({ rol: 'pauta', prof: '', h: server.ctx.VERIF_PAUTA, fabrica: false });
  const rp = server.handle({ action: 'renombrar', renombre: { de: 'Juan Paz', a: 'Juan Paz Otro' }, token: tokP }, { panel: true });
  OK('la clave de pauta tampoco (solo lee)', rp.ok === false && rp.error === 'sin_permiso', rp);
  const rs = server.handle({ action: 'renombrar', renombre: { de: 'Juan Paz', a: 'Juan Paz Otro' } }, { panel: true });
  OK('sin sesión, nada', rs.ok === false && rs.error === 'sin_sesion', rs);
  const tokA = server.ctx.nuevaSesion({ rol: 'admin', prof: '', h: server.ctx.leerVerif().admin, fabrica: false });
  const rn = server.handle({ action: 'renombrar', renombre: { de: 'Nadie Existe', a: 'Otro Nombre' }, token: tokA }, { panel: true });
  OK('un nombre que no está en la hoja: «no_existe» y no toca nada', rn.ok === false && rn.error === 'no_existe', rn);

  /* 7) con el Apps Script anterior: no hace nada a medias */
  await A.evaluate(() => { CFG.renombrar = false; SESION.renombrar = false; verPaciente('Juan Paz'); }); await A.waitForTimeout(500);
  await A.locator('#modal .cn-btn').click(); await A.waitForTimeout(300); await A.fill('#cn-nom', 'Juan Paz Viejo'); await A.dispatchEvent('#cn-nom', 'input'); await A.click('#cn-ok'); await A.waitForTimeout(800);
  const t7 = await A.evaluate(() => TOASTS.slice(-1)[0]);
  OK('sin el Apps Script nuevo avisa y no cambia nada', /Apps Script nuevo/.test(t7) && filasDe('Juan Paz').length === 1 && filasDe('Juan Paz Viejo').length === 0, t7);
  await A.evaluate(() => { CFG.renombrar = true; closeModal(); });

  OK('Sonri lo enseña (novedad y pregunta frecuente)', await A.evaluate(() => ASIS_NOVEDADES.some(n => n.id === 'corregir-nombre') && ASIS_AYUDA.some(a => /corrijo el nombre/.test(a.q))));
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
