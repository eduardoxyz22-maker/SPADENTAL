/* Mensajes (MODERNO · parte 60): plantillas de WhatsApp editables en Ajustes (#11) y recetas
   frecuentes (#9). Chromium real, .gs real en memoria, datos ficticios, sin red real.
   SHOT_DIR=<carpeta> deja real-mensajes.png y real-recetas.png (a 1366 px). */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(72), x === undefined ? '' : JSON.stringify(x)); };
const espera = async (page, fn, arg, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 6000)) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(120); } return false; };
/* el texto que lleva el link de WhatsApp de una tarjeta */
const waDe = href => { const m = /[?&]text=([^&]*)/.exec(href || ''); return m ? decodeURIComponent(m[1]) : ''; };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('mj-duena-1'); server.ctx.guardarVerif(v);
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
  const D = await abrir('mj-duena-1');
  OK('entra la dueña', await D.evaluate(() => ROL === 'admin'));
  /* datos ficticios: una paciente con una visita pagada a medias (debe 120), una cita para mañana y su fecha de nacimiento */
  const S = await D.evaluate(() => {
    const hoy = hoyISO(), man = addDias(hoy, 1), P = CFG.prof[0], C = CFG.canales[0];
    const at = normalize({ id: uid(), fecha: addDias(hoy, -10), hora: '09:00', paciente: 'Mensaje Prueba', profesional: P, estado: 'Atendido', tipo: 'Nuevo', canal: C, origen: 'Espontánea', celular: '70041234',
      servicios: [{ nom: 'Limpieza dental', cant: 1, precio: 200 }], total: 200, acuenta: 80, saldo: 120, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 80 }], ts: new Date().toISOString() });
    const ci = normalize({ id: uid(), fecha: man, hora: '10:30', paciente: 'Mensaje Prueba', profesional: P, estado: 'Agendada', tipo: 'Recurrente', canal: C, origen: 'Programada', celular: '70041234',
      servicios: [], total: 0, acuenta: 0, saldo: 0, pagos: [], proxMotivo: 'Control de limpieza', ts: new Date().toISOString() });
    DATA.push(at); DATA.push(ci); queue('save', at, null); queue('save', ci, null);
    const f = pacDe('Mensaje Prueba'); f.nombre = 'Mensaje Prueba'; f.nac = '1990-05-10'; savePac(f);
    saveLocal(); flushQueue();
    return { hoy, man, P, cli: clinica(), citaId: ci.id, atId: at.id }; });
  await D.waitForTimeout(1200);

  /* ---- A · la tarjeta en Ajustes ---- */
  await D.click('nav button[data-v="config"]'); await D.waitForTimeout(500); await D.evaluate(() => { try { mdAjGrupo('md-aj-msj'); } catch (e) {} }); await D.waitForTimeout(300);
  OK('las dos tarjetas nuevas están en «Pacientes y mensajes», después de Indicaciones', await D.evaluate(() => { const g = document.querySelector('#md-aj-msj'); const cs = [...g.querySelectorAll(':scope > .card')].map(c => c.id); const i = cs.indexOf(document.querySelector('#c-indicaciones').closest('.card').id || '__'); return cs.indexOf('md-msj') > 0 && cs.indexOf('md-rx') === cs.indexOf('md-msj') + 1 && g.classList.contains('on'); }), await D.evaluate(() => [...document.querySelectorAll('#md-aj-msj > .card')].map(c => c.id || c.querySelector('h2').textContent.trim())));
  OK('y en el índice de Ajustes, debajo de Indicaciones', await D.evaluate(() => { const its = [...document.querySelectorAll('#md-aj-indice .md-aj-it span')].map(s => s.textContent.trim()); const i = its.indexOf('Indicaciones post-tratamiento'); return i >= 0 && its[i + 1] === 'Mensajes de WhatsApp' && its[i + 2] === 'Recetas frecuentes'; }));
  OK('un botón por tipo de mensaje, ninguno editado todavía', await D.locator('#md-msj-tipos button').count() === 11 && await D.locator('#md-msj-tipos button.ed').count() === 0 && await D.evaluate(() => !CFG.plantillasWa));
  const def = await D.evaluate(() => $('#md-msj-ed .md-msj-ta[data-k="cita"]').value);
  OK('la cita muestra el texto original con sus variables', /^Hola \{nombre\}! 👋 Le escribimos de \*\{clinica\}\*\./.test(def) && /\[ a las \{hora\}\]/.test(def) && /¿Nos confirma por favor\? 🦷$/.test(def) && /texto original/.test(await D.locator('#md-msj-ed .md-msj-cab').innerText()));
  const prev0 = await D.locator('#md-msj-prev').innerText();
  OK('la vista previa es una burbuja con datos de ejemplo (María, la clínica, la hora)', /Hola María! 👋 Le escribimos de/.test(prev0) && prev0.indexOf(S.cli) >= 0 && /a las 10:30/.test(prev0) && /Saldo pendiente: Bs 350/.test(prev0), prev0.slice(0, 120));
  OK('las variables están documentadas como chips', await D.locator('#md-msj-ed .md-msj-var').count() === 7 && await D.evaluate(() => [...document.querySelectorAll('#md-msj-ed .md-msj-var')].map(b => b.textContent).join(' ') === '{nombre} {fecha} {hora} {doctora} {clinica} {saldo} {servicio}') && /nombre de pila/.test(await D.locator('#md-msj-ed .md-msj-var[data-v="nombre"]').getAttribute('title')));
  /* antes de editar: Recordatorios › Citas manda el texto original */
  await D.evaluate(() => { show('rem'); setRadio('remf', 'citas'); renderRem(); }); await D.waitForTimeout(400);
  const href0 = await D.evaluate(() => { const c = [...document.querySelectorAll('#rem-list .rem')].filter(x => /Mensaje Prueba/.test(x.textContent))[0]; const a = c && c.querySelector('a[href*="wa.me"]'); return a ? a.getAttribute('href') : ''; });
  const t0 = waDe(href0);
  OK('sin plantilla, el WhatsApp de la cita lleva el texto de siempre', t0.indexOf('Hola Mensaje! 👋 Le escribimos de *' + S.cli + '*.') === 0 && t0.indexOf('Le recordamos su cita del *' + fmt(S.man) + '* a las 10:30.') > 0 && /Motivo: Control de limpieza\./.test(t0) && /Saldo pendiente: Bs 120\./.test(t0) && /¿Nos confirma por favor\? 🦷$/.test(t0), t0);
  /* editar la plantilla de la cita: un chip inserta la variable donde está el cursor */
  await D.evaluate(() => show('config')); await D.waitForTimeout(400); await D.evaluate(() => { try { mdAjGrupo('md-aj-msj'); } catch (e) {} });
  await D.evaluate(() => { const ta = $('#md-msj-ed .md-msj-ta[data-k="cita"]'); ta.value = 'Hola {nombre}! 👋 PLANTILLA NUEVA: su cita es el {fecha}[ a las {hora}] con {doctora} en {clinica}.[\nDebe {saldo}.]\n¡Gracias! '; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); ta.dispatchEvent(new Event('input', { bubbles: true })); });
  await D.click('#md-msj-ed .md-msj-var[data-v="servicio"]');
  const val1 = await D.evaluate(() => $('#md-msj-ed .md-msj-ta[data-k="cita"]').value);
  OK('tocar el chip {servicio} lo inserta donde está el cursor', /¡Gracias! \{servicio\}$/.test(val1), val1.slice(-30));
  const prev1 = await D.locator('#md-msj-prev').innerText();
  OK('la vista previa sigue lo que se escribe', /PLANTILLA NUEVA: su cita es el .+ a las 10:30 con .+ en /.test(prev1) && /Debe Bs 350\./.test(prev1) && /¡Gracias! Limpieza dental/.test(prev1), prev1);
  OK('una variable que no existe no se guarda, avisa', await D.evaluate(() => { const ta = $('#md-msj-ed .md-msj-ta[data-k="cita"]'); const v = ta.value; ta.value = v + ' {inventada}'; const ok = mdMsjGuardar(); ta.value = v; return ok === false && !CFG.plantillasWa && /inventada/.test($('#toast').textContent); }));
  await D.click('#md-msj-save'); await D.waitForTimeout(300);
  const TPL = 'Hola {nombre}! 👋 PLANTILLA NUEVA: su cita es el {fecha}[ a las {hora}] con {doctora} en {clinica}.[\nDebe {saldo}.]\n¡Gracias! {servicio}';
  OK('guardar: queda en CFG.plantillasWa.cita y el botón del tipo se marca', await D.evaluate(t => CFG.plantillasWa && CFG.plantillasWa.cita === t, TPL) && await D.locator('#md-msj-tipos button[data-k="cita"].ed').count() === 1 && /texto propio/.test(await D.locator('#md-msj-ed .md-msj-cab').innerText()));
  OK('…y viaja al servidor (acción cfg)', await espera(D, () => pend().length === 0, null, 8000) && server.cfg.plantillasWa && server.cfg.plantillasWa.cita === TPL, server.cfg.plantillasWa);
  OK('no se guardan las que siguen como el original (solo cita)', JSON.stringify(Object.keys(server.cfg.plantillasWa)) === '["cita"]');
  /* el WhatsApp de la cita, en Recordatorios, usa el texto nuevo con las variables reemplazadas */
  await D.evaluate(() => { show('rem'); setRadio('remf', 'citas'); renderRem(); }); await D.waitForTimeout(400);
  const href1 = await D.evaluate(() => { const c = [...document.querySelectorAll('#rem-list .rem')].filter(x => /Mensaje Prueba/.test(x.textContent))[0]; const a = c && c.querySelector('a[href*="wa.me"]'); return a ? a.getAttribute('href') : ''; });
  const t1 = waDe(href1), esperado = 'Hola Mensaje! 👋 PLANTILLA NUEVA: su cita es el ' + fmt(S.man) + ' a las 10:30 con ' + S.P + ' en ' + S.cli + '.\nDebe Bs 120.\n¡Gracias! Control de limpieza';
  OK('Recordatorios › Citas: el WhatsApp lleva la plantilla con los datos de la cita', t1 === esperado, { t1, esperado });
  OK('también la ficha de la cita (Agenda) y el número va al mismo celular', await D.evaluate(id => { verFicha(id); const a = document.querySelector('#modal a[href*="wa.me"]'); const h = a ? a.getAttribute('href') : ''; closeModal(); return /wa\.me\/59170041234/.test(h) && /PLANTILLA%20NUEVA/.test(h); }, S.citaId));
  OK('sin hora ni saldo ni motivo: los corchetes no salen y la línea que quedó vacía tampoco', await D.evaluate(a => txtCita({ paciente: 'Sin Datos', prox: a.man, saldo: 0 }), S) === 'Hola Sin! 👋 PLANTILLA NUEVA: su cita es el ' + fmt(S.man) + ' con  en ' + S.cli + '.', await D.evaluate(a => txtCita({ paciente: 'Sin Datos', prox: a.man, saldo: 0 }), S));
  OK('una cita que ya pasó sin marcarse sigue con su texto propio', /no llegamos a verla/.test(await D.evaluate(a => txtCita({ paciente: 'Vieja Cita', fecha: addDias(a.hoy, -3), estado: 'Agendada' }), S)));
  /* el resumen de la visita: saludo y cierre editables, el detalle de montos queda */
  await D.evaluate(() => show('config')); await D.waitForTimeout(400); await D.evaluate(() => { try { mdAjGrupo('md-aj-msj'); } catch (e) {} });
  await D.click('#md-msj-tipos button[data-k="visita"]'); await D.waitForTimeout(200);
  OK('la visita tiene saludo y cierre por separado, con el medio fijo explicado', await D.locator('#md-msj-ed .md-msj-ta').count() === 2 && await D.locator('#md-msj-ed .md-msj-fijo').count() === 1 && /💵 Total: Bs 200/.test(await D.locator('#md-msj-prev').innerText()));
  await D.fill('#md-msj-ed .md-msj-ta[data-k="visita"]', 'Hola {nombre}! 👋 SALUDO NUEVO de {clinica} ({doctora}, {fecha}).');
  await D.fill('#md-msj-ed .md-msj-ta[data-k="visitaFin"]', 'CIERRE NUEVO: cualquier duda nos escribe 🦷');
  await D.click('#md-msj-save'); await D.waitForTimeout(300);
  await D.evaluate(id => showWhatsappModal(DATA.filter(r => r.id === id)[0]), S.atId); await D.waitForTimeout(400);
  const wa = await D.evaluate(() => ({ txt: $('#wa-txt').textContent, href: (document.querySelector('#modal a[href*="wa.me"]') || {}).getAttribute ? document.querySelector('#modal a[href*="wa.me"]').getAttribute('href') : '', bur: $('#modal .md-wa-bur') ? $('#modal .md-wa-bur').innerText : '' }));
  const sal = 'Hola Mensaje! 👋 SALUDO NUEVO de ' + S.cli + ' (' + S.P + ', ' + fmt(addDias(S.hoy, -10)) + ').';
  OK('«Atención guardada»: el saludo y el cierre nuevos, el detalle de montos intacto', wa.txt.indexOf(sal) === 0 && /💵 Total: Bs 200\n✅ A cuenta: Bs 80\n⏳ Saldo: Bs 120/.test(wa.txt) && /CIERRE NUEVO: cualquier duda nos escribe 🦷$/.test(wa.txt) && !/Gracias por su visita/.test(wa.txt), wa.txt);
  OK('…en el link de WhatsApp y en la burbuja de vista previa también', waDe(wa.href).indexOf(sal) === 0 && /CIERRE NUEVO/.test(waDe(wa.href)) && /SALUDO NUEVO/.test(wa.bur) && /CIERRE NUEVO/.test(wa.bur));
  await D.evaluate(() => closeModal());
  /* los demás tipos, por la función que usa el panel */
  await D.evaluate(() => { CFG.plantillasWa.saldo = 'SALDO {nombre}: {saldo} ({clinica})'; CFG.plantillasWa.presupuesto = 'PRESU {nombre} {servicio} {monto}'; CFG.plantillasWa.presupuestoFin = 'FIN PRESU {saldo}'; CFG.plantillasWa.foto = 'FOTO {nombre} {clinica}'; CFG.plantillasWa.antesdespues = 'AYD {nombre}'; CFG.plantillasWa.dormido = 'DORMIDO {nombre} {fecha}'; });
  OK('saldo: la función de siempre devuelve la plantilla', await D.evaluate(() => txtSaldo({ paciente: 'Mensaje Prueba', saldo: 120 })) === 'SALDO Mensaje: Bs 120 (' + S.cli + ')');
  OK('sin volver: idem, con la fecha de la última visita', await D.evaluate(a => txtDormido({ paciente: 'Mensaje Prueba', ult: addDias(a.hoy, -200) }), S) === 'DORMIDO Mensaje ' + fmt(addDias(S.hoy, -200)));
  OK('presupuesto: saludo y cierre nuevos, las etapas y el total en el medio', await D.evaluate(() => { const p = planNormalize({ nombre: 'Blanqueamiento', total: 800, sesiones: [{ desc: 'sesión 1', precio: 400 }, { desc: 'sesión 2', precio: 400 }] }); const t = txtPresupuesto('Mensaje Prueba', p); return t.indexOf('PRESU Mensaje Blanqueamiento Bs 800\n\n🦷 *Blanqueamiento*\n1. sesión 1 — Bs 400') === 0 && /💵 Total: \*Bs 800\*/.test(t) && /\nFIN PRESU Bs 800$/.test(t); }));
  OK('fotos: el texto del antes/después y el de una foto pasan por su plantilla', await D.evaluate(() => { const de = h => decodeURIComponent(/text=([^&]*)/.exec(h)[1]); return [de(waLink('70041234', 'Hola Mensaje! 👋 Le mandamos su foto de ' + clinica() + ' 🦷')), de(waLink('70041234', 'Hola Mensaje! 👋 Le mandamos su antes y después de ' + clinica() + ' 🦷✨')), de(waLink('70041234', 'Hola Mensaje! 👋'))].join('|'); }) === 'FOTO Mensaje ' + S.cli + '|AYD Mensaje|Hola Mensaje! 👋');
  await D.evaluate(() => { delete CFG.plantillasWa.saldo; delete CFG.plantillasWa.presupuesto; delete CFG.plantillasWa.presupuestoFin; delete CFG.plantillasWa.foto; delete CFG.plantillasWa.antesdespues; delete CFG.plantillasWa.dormido; });
  /* captura: la tarjeta con la plantilla de la cita editada */
  if (process.env.SHOT_DIR) {
    await D.evaluate(() => { mdAjGrupo('md-aj-msj'); MD_MSJ.k = 'cita'; mdMsjPintar(true); [...document.querySelectorAll('#md-aj-msj > .card')].forEach(c => { if (c.id !== 'md-msj') c.setAttribute('data-shot-oculta', '1'), c.style.display = 'none'; }); });
    await D.setViewportSize({ width: 1366, height: 1400 }); await D.evaluate(() => { window.scrollTo(0, 0); $('#toast').className = ''; }); await D.waitForTimeout(600);
    await D.locator('#md-msj').screenshot({ path: path.join(process.env.SHOT_DIR, 'real-mensajes.png') });
    await D.setViewportSize({ width: 1366, height: 900 });
    await D.evaluate(() => { [...document.querySelectorAll('[data-shot-oculta]')].forEach(c => { c.style.display = ''; c.removeAttribute('data-shot-oculta'); }); });
  }
  /* restaurar la cita */
  await D.click('#md-msj-tipos button[data-k="cita"]'); await D.waitForTimeout(200);
  OK('«Restaurar» está habilitado solo si hay texto propio', !(await D.locator('#md-msj-reset').isDisabled()));
  await D.click('#md-msj-reset'); await D.waitForTimeout(300);
  OK('restaurar: la cita vuelve al texto original (y el servidor también)', await D.evaluate(() => !CFG.plantillasWa.cita && $('#md-msj-ed .md-msj-ta[data-k="cita"]').value === MD_MSJ_DEF.cita) && await espera(D, () => pend().length === 0, null, 8000) && !(server.cfg.plantillasWa || {}).cita && server.cfg.plantillasWa.visita === 'Hola {nombre}! 👋 SALUDO NUEVO de {clinica} ({doctora}, {fecha}).', server.cfg.plantillasWa);
  await D.evaluate(() => { show('rem'); setRadio('remf', 'citas'); renderRem(); }); await D.waitForTimeout(400);
  const href2 = await D.evaluate(() => { const c = [...document.querySelectorAll('#rem-list .rem')].filter(x => /Mensaje Prueba/.test(x.textContent))[0]; const a = c && c.querySelector('a[href*="wa.me"]'); return a ? a.getAttribute('href') : ''; });
  OK('…y el WhatsApp de la cita vuelve a ser el de siempre', waDe(href2) === t0);
  OK('el refresco de Ajustes no pisa un texto a medio escribir', await D.evaluate(() => { show('config'); mdAjGrupo('md-aj-msj'); const ta = $('#md-msj-ed .md-msj-ta[data-k="cita"]'); ta.value = 'a medio'; renderConfig(); const ok = $('#md-msj-ed .md-msj-ta[data-k="cita"]').value === 'a medio'; mdMsjPintar(true); return ok; }));

  /* ---- B · recetas frecuentes ---- */
  await D.evaluate(() => { show('config'); mdAjGrupo('md-aj-msj'); }); await D.waitForTimeout(300);
  OK('vienen 5 recetas de fábrica (sin tocar CFG) con la leyenda de revisar la dosis', await D.locator('#md-rx-lista .md-rx-fila').count() === 5 && await D.evaluate(() => CFG.recetasFav == null && /Amoxicilina 500 mg/.test($('#md-rx-lista .md-rx-nom').value) && /Revisá la dosis según el paciente/.test($('#md-rx').textContent)));
  await D.evaluate(() => show('midia')); await D.waitForTimeout(200);
  await D.evaluate(() => abrirReceta('Mensaje Prueba')); await D.waitForTimeout(300);
  const pre = await D.evaluate(() => $('#rc-tx').value);
  OK('la receta abre con el nombre y la edad del paciente arriba, y 5 chips', /Mensaje Prueba · 36 años/.test(await D.locator('#modal p.mini').innerText()) && await D.locator('#md-rx-chips .md-rx-chip[data-i]').count() === 5 && /Revisá la dosis/.test(await D.locator('#md-rx-chips small').innerText()));
  await D.click('#md-rx-chips .md-rx-chip[data-i="0"]'); await D.waitForTimeout(150);
  const v1 = await D.evaluate(() => $('#rc-tx').value);
  OK('tocar un chip agrega su texto sin pisar lo escrito', v1.indexOf('— Amoxicilina 500 mg: 1 cápsula cada 8 horas, por 7 días.') > 0 && (pre ? v1.indexOf(pre.trim()) === 0 : true) && await D.evaluate(() => document.activeElement === $('#rc-tx')), { pre: pre.slice(0, 40), v1: v1.slice(-60) });
  await D.click('#md-rx-chips .md-rx-chip[data-i="4"]'); await D.waitForTimeout(150);
  const v2 = await D.evaluate(() => $('#rc-tx').value);
  OK('el segundo chip va debajo, separado por una línea en blanco', v2.indexOf(v1) === 0 && /por 7 días\.\n\nCuidados después de la extracción:/.test(v2));
  if (process.env.SHOT_DIR) { await D.evaluate(() => { $('#toast').className = ''; }); await D.waitForTimeout(300); await D.locator('#modal').screenshot({ path: path.join(process.env.SHOT_DIR, 'real-recetas.png') }); }
  OK('«Imprimir» arma la hoja con el texto agregado (sin imprimir de verdad)', await D.evaluate(() => { window.print = () => {}; imprimirReceta('Mensaje Prueba'); const h = $('#print-area').innerHTML; document.body.classList.remove('imprimiendo'); return /Mensaje Prueba/.test(h) && /36 años/.test(h) && /Amoxicilina 500 mg/.test(h) && /extracción/.test(h); }));
  /* la biblioteca se edita y se guarda */
  await D.evaluate(() => { show('config'); mdAjGrupo('md-aj-msj'); }); await D.waitForTimeout(300);
  await D.click('#md-rx-add'); await D.waitForTimeout(100);
  OK('«Agregar receta» abre una fila nueva con el foco en el nombre', await D.locator('#md-rx-lista .md-rx-fila').count() === 6 && await D.evaluate(() => document.activeElement.classList.contains('md-rx-nom')));
  await D.click('#md-rx-save'); await D.waitForTimeout(200);
  OK('una fila sin nombre ni texto no se guarda como receta vacía, el resto sí', await D.evaluate(() => Array.isArray(CFG.recetasFav) && CFG.recetasFav.length === 5 && document.querySelectorAll('#md-rx-lista .md-rx-fila').length === 5));
  await D.click('#md-rx-add'); await D.waitForTimeout(100);
  await D.evaluate(() => { const f = $('#md-rx-lista .md-rx-fila:last-child'); f.querySelector('.md-rx-nom').value = 'Receta de prueba'; });
  await D.click('#md-rx-save'); await D.waitForTimeout(200);
  OK('nombre sin texto: avisa y no guarda', /completá «Receta de prueba»/.test(await D.evaluate(() => $('#toast').textContent)) && await D.evaluate(() => CFG.recetasFav.length === 5));
  await D.evaluate(() => { const f = $('#md-rx-lista .md-rx-fila:last-child'); f.querySelector('.md-rx-tx').value = 'Rp.\n— Texto de prueba, 1 vez al día.'; });
  await D.click('#md-rx-save'); await D.waitForTimeout(300);
  OK('guardar: CFG.recetasFav tiene 6 y el servidor también', await D.evaluate(() => CFG.recetasFav.length === 6 && CFG.recetasFav[5].nom === 'Receta de prueba') && await espera(D, () => pend().length === 0, null, 8000) && Array.isArray(server.cfg.recetasFav) && server.cfg.recetasFav.length === 6 && server.cfg.recetasFav[5].txt === 'Rp.\n— Texto de prueba, 1 vez al día.');
  await D.click('#md-rx-lista .md-rx-fila:first-child .md-rx-del'); await D.click('#md-rx-save'); await D.waitForTimeout(300);
  OK('quitar la primera y guardar: quedan 5, sin la amoxicilina', await D.evaluate(() => CFG.recetasFav.length === 5 && !CFG.recetasFav.some(x => /Amoxicilina/.test(x.nom)) && CFG.recetasFav[4].nom === 'Receta de prueba'));
  await D.evaluate(() => abrirReceta('Mensaje Prueba')); await D.waitForTimeout(200);
  OK('la ventana de la receta muestra la lista nueva', await D.locator('#md-rx-chips .md-rx-chip[data-i]').count() === 5 && /Receta de prueba/.test(await D.locator('#md-rx-chips').innerText()) && !/Amoxicilina/.test(await D.locator('#md-rx-chips').innerText()));
  await D.evaluate(() => closeModal());
  OK('«⚙ Editar la lista» lleva a la tarjeta de Ajustes', await D.evaluate(() => { abrirReceta('Mensaje Prueba'); document.querySelector('#md-rx-chips .md-rx-aj').click(); return $('#v-config').classList.contains('on') && $('#md-aj-msj').classList.contains('on') && !$('#ov').classList.contains('on'); }));
  OK('no quedan cosas sin subir', await espera(D, () => pend().length === 0, null, 8000));
  const cg = server.handle({ action: 'cfgGet', token: server.ctx.nuevaSesion({ rol: 'admin', prof: '', h: server.ctx.leerVerif().admin, fabrica: false }) }, { panel: true });
  OK('cfgGet devuelve las plantillas y las recetas', cg.ok && cg.cfg && cg.cfg.plantillasWa && /SALUDO NUEVO/.test(cg.cfg.plantillasWa.visita) && Array.isArray(cg.cfg.recetasFav) && cg.cfg.recetasFav.length === 5);
  await D.context().close();

  /* ---- otra pantalla las ve ---- */
  const E = await abrir('mj-duena-1');
  await E.evaluate(() => show('config')); await E.waitForTimeout(500); await E.evaluate(() => { try { mdAjGrupo('md-aj-msj'); } catch (e) {} }); await E.waitForTimeout(300);
  OK('otra pantalla: la plantilla de la visita y las recetas llegan del servidor', await E.evaluate(() => /SALUDO NUEVO/.test((CFG.plantillasWa || {}).visita || '') && Array.isArray(CFG.recetasFav) && CFG.recetasFav.length === 5 && CFG.recetasFav[4].nom === 'Receta de prueba'));
  OK('…y Ajustes marca la visita como editada, la cita como original', await E.locator('#md-msj-tipos button[data-k="visita"].ed').count() === 1 && await E.locator('#md-msj-tipos button[data-k="cita"].ed').count() === 0 && await E.locator('#md-rx-lista .md-rx-fila').count() === 5);
  await E.click('#md-msj-tipos button[data-k="visita"]'); await E.waitForTimeout(200);
  OK('…con el texto guardado en el editor y en la vista previa', /SALUDO NUEVO/.test(await E.evaluate(() => $('#md-msj-ed .md-msj-ta[data-k="visita"]').value)) && /SALUDO NUEVO de/.test(await E.locator('#md-msj-prev').innerText()) && /CIERRE NUEVO/.test(await E.locator('#md-msj-prev').innerText()));
  /* restaurar las recetas de fábrica desde la otra pantalla */
  await E.click('#md-rx-reset'); await E.waitForTimeout(300);
  OK('restaurar recetas: vuelven las 5 de fábrica (CFG.recetasFav = null, el servidor igual)', await E.evaluate(() => CFG.recetasFav === null && mdRxLista().length === 5 && /Amoxicilina/.test(mdRxLista()[0].nom)) && await espera(E, () => pend().length === 0, null, 8000) && server.cfg.recetasFav === null);
  await E.context().close();

  /* ---- la doctora: ve, no edita; usa los chips igual ---- */
  const DRA = S.P;
  const vv = server.ctx.leerVerif(); vv.prof[DRA] = sha('mj-dra-1'); server.ctx.guardarVerif(vv);
  const R = await abrir('mj-dra-1');
  OK('la doctora entra', await R.evaluate(d => ROL === 'doctora' && PROF_ACTUAL === d, DRA));
  await R.evaluate(() => show('config')); await R.waitForTimeout(400); await R.evaluate(() => { try { mdAjGrupo('md-aj-msj'); } catch (e) {} }); await R.waitForTimeout(200);
  OK('la doctora ve los mensajes pero sin guardar ni restaurar', await R.locator('#md-msj.md-msj-ro').count() === 1 && await R.locator('#md-msj-save').count() === 0 && await R.evaluate(() => $('#md-msj-ed .md-msj-ta').readOnly && mdMsjGuardar() === false && mdRxGuardar() === false && !document.querySelector('#md-rx-lista .md-rx-del')));
  await R.evaluate(() => { show('midia'); abrirReceta('Mensaje Prueba'); }); await R.waitForTimeout(300);
  OK('…y en la receta tiene los chips (sin «Editar la lista»)', await R.locator('#md-rx-chips .md-rx-chip[data-i]').count() === 5 && await R.locator('#md-rx-chips .md-rx-aj').count() === 0);
  await R.context().close();
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
function fmt(s) { const p = String(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function addDias(s, n) { const p = s.split('-'); const d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
