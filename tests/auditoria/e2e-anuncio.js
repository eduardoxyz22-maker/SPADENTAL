/* 📢 El anuncio de la clínica (como el de Multiespumas): la dueña escribe un
   aviso y Sonri lo GRITA una vez en todos los aparatos al entrar (pantalla
   entera, temblor, sirena y voz), después lo recuerda cada 3 minutos con su
   globito callado, espera si la persona está escribiendo, y se va cuando lo
   quitan. Dos aparatos: la dueña y una doctora. Chromium real, .gs real en
   memoria, voz del navegador de mentira, datos ficticios, sin red real. */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const SHOT = process.env.SHOT || '';
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
function VOZ() {
  window.ASIS_PRUEBA = true; window._habla = []; window._cancel = 0;
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    speak(u) { window._habla.push({ t: u.text, lang: u.lang, vol: u.volume }); setTimeout(() => u.onstart && u.onstart(), 10); setTimeout(() => u.onend && u.onend(), 2500); },
    cancel() { window._cancel++; }, getVoices() { return [{ name: 'Paulina', lang: 'es-MX' }, { name: 'Samantha', lang: 'en-US' }]; } } });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
}
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('an-duena-1'); server.ctx.guardarVerif(v);
  const T0 = new Date('2026-10-28T13:10:00Z').getTime();
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update', '--autoplay-policy=no-user-gesture-required'] });
  const red = [], errs = [];
  const abrir = async (clave, vp) => {
    const ctx = await b.newContext({ viewport: vp || { width: 1366, height: 900 } });
    const P = await ctx.newPage();
    P.on('pageerror', e => errs.push(e.message)); P.on('dialog', d => d.accept());
    await P.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await P.addInitScript(VOZ);
    await P.clock.install({ time: new Date(T0) });
    await P.goto('file://' + FILE); await P.waitForTimeout(800);
    await P.evaluate(() => { const t = window.toast; window.TOASTS = []; window.toast = function (m, e) { window.TOASTS.push(String(m)); return t.apply(this, arguments); }; });
    await P.fill('#gate-pass', clave); await P.click('#gate-btn'); await P.waitForTimeout(2200);
    await P.evaluate(() => { try { asisTourFin() } catch (e) {} try { closeModal() } catch (e) {} });
    return P;
  };
  const D = await abrir('an-duena-1');
  /* una doctora con su clave */
  const prof = await D.evaluate(() => CFG.prof[0]);
  { const vv = server.ctx.leerVerif(); vv.prof[prof] = server.ctx.shaHex('an-doc-1'); server.ctx.guardarVerif(vv); }
  const M = await abrir('an-doc-1');
  OK('la doctora entró como doctora', await M.evaluate(() => ROL === 'doctora'), await M.evaluate(() => ROL));

  /* el botón: la dueña lo ve en Mi día; la doctora no */
  await D.evaluate(() => show('midia')); await D.waitForTimeout(400);
  OK('la dueña ve «📢 Decir anuncio» arriba en Mi día', await D.locator('#v-midia #anu-btn').isVisible() && /Decir anuncio/.test(await D.locator('#anu-btn').innerText()));
  await M.evaluate(() => show('midia')); await M.waitForTimeout(400);
  OK('la doctora no tiene el botón', await M.locator('#anu-btn').count() === 0);
  OK('sin anuncio, nadie grita', await M.evaluate(() => !document.getElementById('anu-grito') || document.getElementById('anu-grito').hidden));

  /* la dueña lo escribe */
  await D.click('#anu-btn'); await D.waitForTimeout(300);
  OK('abre la ventana «📢 Decir anuncio» (sin anuncio puesto)', /Decir anuncio/.test(await D.locator('#modal').innerText()) && /No hay ningún anuncio puesto/.test(await D.locator('#modal').innerText()));
  await D.click('#anu-pub'); await D.waitForTimeout(200);
  OK('vacío no se publica', /Escribí qué querés que diga/.test(await D.locator('#anu-est').innerText()));
  const TXT = 'Hoy no hay rayos X: las radiografías se derivan a mañana 🙏';
  await D.fill('#anu-txt', TXT); await D.dispatchEvent('#anu-txt', 'input');
  OK('cuenta las letras', +(await D.locator('#anu-n').innerText()) === TXT.length);
  if (SHOT) await D.screenshot({ path: SHOT + '-ventana.png', clip: await D.evaluate(() => { const r = document.querySelector('#modal').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }) });
  await D.click('#anu-pub'); await D.waitForTimeout(1500);
  const cfg = server.ctx.leerCfg();
  OK('queda en la configuración de la hoja (texto, fecha y quién, sin nombre de persona)', cfg.anuncio && cfg.anuncio.t === TXT && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(cfg.anuncio.d) && cfg.anuncio.por === 'Dueña', cfg.anuncio);
  OK('avisa «Listo: Sonri lo grita…»', (await D.evaluate(() => TOASTS.slice(-2))).some(t => /Sonri lo grita al entrar/.test(t)));
  OK('el botón ahora dice «Anuncio puesto»', /Anuncio puesto/.test(await D.locator('#anu-btn').innerText()));
  if (SHOT) { await D.evaluate(() => anuncioGritoCerrar()); await D.waitForTimeout(200); await D.screenshot({ path: SHOT + '-boton.png', clip: await D.evaluate(() => { const r = document.querySelector('#v-midia .mi-cab').getBoundingClientRect(); return { x: Math.max(0, r.left - 10), y: r.top + scrollY - 10, width: r.width + 20, height: r.height + 20 }; }) }); await D.evaluate(() => { ANUNCIO.ts = 0; anuncioTic(); }); }
  await D.waitForTimeout(800);
  OK('la dueña también lo ve gritar (así sabe cómo queda)', await D.evaluate(() => !document.getElementById('anu-grito').hidden));
  await D.evaluate(() => anuncioGritoCerrar());

  /* la doctora, en otro aparato: al refrescar con la hoja, Sonri lo grita */
  await M.evaluate(() => pullServer()); await M.waitForTimeout(2500);
  const g = await M.evaluate(() => { const b = document.getElementById('anu-grito'); return b ? { vis: !b.hidden, txt: b.innerText, tiembla: document.body.classList.contains('anu-tiembla'), mega: !!b.querySelector('.ag-mega'), sonri: !!b.querySelector('.ag-yo svg'), cambiar: !!b.querySelector('.ag-cambiar'), sirenas: ANUNCIO.sirenas || 0, habla: window._habla.slice() } : null; });
  OK('la doctora: pantalla entera con Sonri, su megáfono y el anuncio', g && g.vis && g.mega && g.sonri && g.txt.includes(TXT) && /Anuncio de la clínica/.test(g.txt), g && g.txt.slice(0, 160));
  OK('la pantalla tiembla y suena la sirena', g && g.sirenas >= 1, g && { s: g.sirenas });
  OK('la voz lo lee en castellano y sin emojis («¡Atención, atención! Hoy no hay rayos X…»)', g && g.habla.length >= 1 && g.habla.slice(-1)[0].t === '¡Atención, atención! Hoy no hay rayos X: las radiografías se derivan a mañana' && /^es/.test(g.habla.slice(-1)[0].lang), g && g.habla);
  OK('a la doctora no le ofrece «Cambiar o quitar»', g && !g.cambiar);
  if (SHOT) await M.screenshot({ path: SHOT + '-grito.png' });
  await M.waitForTimeout(800); await M.mouse.click(100, 100); await M.waitForTimeout(300);
  OK('tocar en cualquier lado lo cierra y lo calla', await M.evaluate(() => document.getElementById('anu-grito').hidden && window._cancel > 0));
  OK('en los avisos de Sonri va primero', await M.evaluate(() => { const A = asisAvisos(); return A.length && A[0].anuncio && A[0].t.includes('rayos X'); }));

  /* cada 3 minutos: el globito, callado; no vuelve a gritar */
  const pasar = async (P, min) => { const t = await P.evaluate(() => Date.now()); await P.clock.setSystemTime(new Date(t + min * 60000)); await P.evaluate(() => anuncioTic()); await P.waitForTimeout(300); };
  const sir0 = await M.evaluate(() => ANUNCIO.sirenas || 0);
  await pasar(M, 2);
  OK('a los 2 minutos, nada', await M.evaluate(() => document.getElementById('asis-globo').hidden && document.getElementById('anu-grito').hidden));
  await pasar(M, 1.2);
  const gl = await M.evaluate(() => ({ vis: !document.getElementById('asis-globo').hidden, txt: document.getElementById('asis-globo').innerText, grita: !document.getElementById('anu-grito').hidden, sir: ANUNCIO.sirenas || 0 }));
  OK('a los 3 minutos sale el globito de Sonri con el anuncio, sin gritar ni sirena', gl.vis && /📢/.test(gl.txt) && gl.txt.includes('rayos X') && !gl.grita && gl.sir === sir0, gl);
  if (SHOT) await M.screenshot({ path: SHOT + '-globo.png', clip: { x: 846, y: 560, width: 520, height: 340 } });

  /* un anuncio nuevo mientras la doctora escribe: espera a que termine */
  await M.evaluate(() => { show('atencion'); clearForm(); }); await M.waitForTimeout(300);
  await M.click('#f-paciente'); await M.keyboard.type('Ana Pr');
  await D.click('#anu-btn'); await D.waitForTimeout(300);
  OK('la ventana muestra lo que «ahora están escuchando»', /Ahora están escuchando/.test(await D.locator('#modal').innerText()) && (await D.locator('#modal').innerText()).includes('rayos X'));
  await D.fill('#anu-txt', 'Mañana cerramos a las 14:00'); await D.click('#anu-pub'); await D.waitForTimeout(1500);
  await M.evaluate(() => pullServer()); await M.waitForTimeout(1500);
  OK('mientras escribe, no le tapa el formulario', await M.evaluate(() => document.getElementById('anu-grito').hidden));
  await M.evaluate(() => { ANUNCIO.tecla = Date.now() - 9000; anuncioTic(); }); await M.waitForTimeout(500);
  OK('cuando deja de escribir, grita el anuncio nuevo', await M.evaluate(() => !document.getElementById('anu-grito').hidden && /Mañana cerramos a las 14:00/.test(document.getElementById('anu-grito').innerText)));
  await M.keyboard.press('Escape'); await M.waitForTimeout(200);
  OK('Esc lo cierra', await M.evaluate(() => document.getElementById('anu-grito').hidden));

  /* con Sonri en silencio: sale igual, sin sirena ni voz */
  await D.evaluate(() => { asisLS(ASIS_LS_MUDO, 1); window._habla = []; }); await D.click('#anu-btn'); await D.waitForTimeout(300);
  await D.fill('#anu-txt', 'Reunión de equipo a las 18:00'); await D.click('#anu-pub'); await D.waitForTimeout(2500);
  OK('con 🔇: la dueña lo ve gritar pero sin voz', await D.evaluate(() => !document.getElementById('anu-grito').hidden && window._habla.length === 0));
  await D.evaluate(() => { anuncioGritoCerrar(); asisLS(ASIS_LS_MUDO, 0); });

  /* la ventana de Sonri también tiene el botón (dueña) */
  await D.evaluate(() => asisAbrir('avisos')); await D.waitForTimeout(300);
  OK('en la ventana de Sonri: «📢 Cambiar o quitar el anuncio» (dueña)', /Cambiar o quitar el anuncio/.test(await D.locator('#asis-panel').innerText()));
  await D.evaluate(() => asisCerrar());

  /* quitarlo */
  await D.click('#anu-btn'); await D.waitForTimeout(300); await D.click('#anu-quitar'); await D.waitForTimeout(1500);
  OK('quitarlo deja el texto vacío en la hoja', server.ctx.leerCfg().anuncio && server.ctx.leerCfg().anuncio.t === '');
  await M.evaluate(() => pullServer()); await M.waitForTimeout(1500);
  await pasar(M, 4);
  OK('la doctora deja de verlo: ni grito, ni globito, ni en los avisos', await M.evaluate(() => document.getElementById('anu-grito').hidden && !asisAvisos().some(a => a.anuncio) && !/rayos X|14:00|18:00/.test(document.getElementById('asis-globo').hidden ? '' : document.getElementById('asis-globo').innerText)));
  OK('el botón vuelve a «Decir anuncio»', /Decir anuncio/.test(await D.locator('#anu-btn').innerText()));

  /* una doctora no puede escribirlo (el servidor no le deja tocar la configuración) */
  OK('anuncioAbrir() con la doctora: «lo ponen la dueña o recepción»', await M.evaluate(() => { anuncioAbrir(); return TOASTS.slice(-1)[0]; }).then(t => /dueña o recepción/.test(t)));

  /* en el celular: el grito se acomoda en columna */
  const C = await abrir('an-duena-1', { width: 390, height: 800 });
  await C.evaluate(() => { CFG.anuncio = { v: 1, t: 'Hoy no hay rayos X', d: hoyISO() + ' 09:10', ts: Date.now(), por: 'Dueña' }; anuncioTic(); }); await C.waitForTimeout(900);
  const cel = await C.evaluate(() => { const b = document.querySelector('#anu-grito .ag-burbuja').getBoundingClientRect(); return { w: b.width, x: b.left, r: b.right, vw: innerWidth }; });
  OK('en el celular entra entero en la pantalla', cel.x >= 0 && cel.r <= cel.vw + 1, cel);
  if (SHOT) await C.screenshot({ path: SHOT + '-celular.png' });

  OK('Sonri lo enseña (novedad y pregunta frecuente)', await D.evaluate(() => ASIS_NOVEDADES.some(n => n.id === 'anuncio') && ASIS_AYUDA.some(a => /anuncio para todo el equipo/.test(a.q))));
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
