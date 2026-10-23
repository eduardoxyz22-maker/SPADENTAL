/* Modo noche (body.md-noche) legible: recorre las vistas y las ventanas como dueña, en 1366 y 390, y calcula
   el contraste de cada texto visible contra el fondo que tiene atrás (WCAG: ≥ 4,5 texto normal, ≥ 3 texto grande).
   FALLA si algún texto queda con ratio < 3 (letra clara sobre fondo claro, o tinta sobre tinta); lo que queda
   entre 3 y 4,5 en texto normal se lista como aviso (no falla). Dos clínicas, Chromium real, .gs real en memoria,
   datos ficticios. Sin red real.
   Uso: PANEL=spa|cos node -r ./netguard.js e2e-md-noche.js   (SHOT=<carpeta> guarda capturas)
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
let fallas = 0, avisos = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x).slice(0, 600)); };
const PAC = 'D\'Angelo "Tito" O\'Neil', MAYUS = 'MARIA JOSE PEREZ GOMEZ';
/* corre adentro de la página: cada elemento con texto propio, visible y en pantalla → ratio contra el fondo */
const CONTRASTE = `(function(raiz){
  var lum=function(r,g,b){var f=function(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)};
  var parse=function(s){var m=/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/.exec(s||'');if(m)return [+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]];
    /* color-mix() se calcula como color(srgb r g b / a) */ var c=/color\\(srgb ([\\d.]+) ([\\d.]+) ([\\d.]+)(?: \\/ ([\\d.]+))?\\)/.exec(s||'');return c?[+c[1]*255,+c[2]*255,+c[3]*255,c[4]===undefined?1:+c[4]]:null};
  var mezcla=function(top,bajo){var a=top[3];return [top[0]*a+bajo[0]*(1-a),top[1]*a+bajo[1]*(1-a),top[2]*a+bajo[2]*(1-a),1]};
  /* el fondo efectivo: se sube por los padres acumulando los fondos con alfa hasta uno opaco (o el body) */
  var fondo=function(el){var capas=[],e=el.parentElement;while(e){var cs=getComputedStyle(e);var c=parse(cs.backgroundColor);var bi=cs.backgroundImage;if(bi&&bi!=='none'&&/gradient/.test(bi)){var c2=parse(bi);if(c2){capas.push([c2[0],c2[1],c2[2],1]);break}}if(c&&c[3]>0){capas.push(c);if(c[3]>=0.99)break}e=e.parentElement}
    var base=[255,255,255,1];var bb=parse(getComputedStyle(document.body).backgroundColor);if(bb&&bb[3]>0)base=[bb[0],bb[1],bb[2],1];
    var out=base;for(var i=capas.length-1;i>=0;i--)out=mezcla(capas[i],out);return out};
  var propio=function(el){var cs=getComputedStyle(el);var c=parse(cs.backgroundColor);var bi=cs.backgroundImage;if(bi&&bi!=='none'&&/gradient/.test(bi)){var c2=parse(bi);if(c2)return [c2[0],c2[1],c2[2],1]}return c&&c[3]>0?c:null};
  var out=[],vistos={};
  var sel=(raiz||'body')+' *';
  document.querySelectorAll(sel).forEach(function(el){
    if(out.length>40)return;
    if(el.closest('#gate, #asis .asis-yo, script, style, svg, #md-barra, #md-decor, .md-sr, [hidden]'))return;
    var tx='';for(var i=0;i<el.childNodes.length;i++){var n=el.childNodes[i];if(n.nodeType===3)tx+=n.textContent}
    tx=tx.replace(/\\s+/g,' ').trim(); if(!tx)return;
    if(!/[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(tx))return; /* solo emojis o símbolos: no se mide */
    var r=el.getBoundingClientRect(); if(r.width<4||r.height<4)return;
    if(r.bottom<0||r.top>innerHeight||r.right<=0||r.left>=innerWidth)return;
    var cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0)return;
    var p=el;while(p){var pcs=getComputedStyle(p);if(pcs.visibility==='hidden'||+pcs.opacity===0||pcs.display==='none')return;p=p.parentElement}
    var fg=parse(cs.color); if(!fg)return;
    var bg=propio(el); var atras=fondo(el); bg=bg?mezcla(bg,atras):atras;
    if(fg[3]<1)fg=mezcla(fg,bg);
    var L1=lum(fg[0],fg[1],fg[2]),L2=lum(bg[0],bg[1],bg[2]);var ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    var px=parseFloat(cs.fontSize),bold=parseInt(cs.fontWeight,10)>=700;var grande=px>=24||(bold&&px>=18.66);
    var min=grande?3:4.5;
    if(ratio<min){var k=el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+'.'+String(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className).split(' ').slice(0,2).join('.');
      if(vistos[k])return;vistos[k]=1;
      out.push({sel:k,ratio:+ratio.toFixed(2),fg:'rgb('+fg.slice(0,3).map(Math.round).join(',')+')',bg:'rgb('+bg.slice(0,3).map(Math.round).join(',')+')',px:px,t:tx.slice(0,40),mal:ratio<3})}});
  return out})`;
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('no-duena-1'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const errs = [];
  const abrir = async (clave, w) => {
    const h = w < 500 ? 844 : 900;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: 1 });
    const P = await ctx.newPage();
    P.on('pageerror', e => errs.push(e.message.slice(0, 200))); P.on('dialog', d => d.accept());
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
  const D = await abrir('no-duena-1', 1366);
  const seed = await D.evaluate(({ PAC, MAYUS }) => {
    const hoy = hoyISO(), DRA = CFG.prof[0], OTRA = CFG.prof[1] || CFG.prof[0], srv = CFG.precios[1].nom, srv2 = (CFG.precios[2] || CFG.precios[1]).nom;
    const mk = (o) => { const r = normalize(Object.assign({ id: uid(), fecha: hoy, hora: '10:00', paciente: PAC, profesional: DRA, estado: 'Atendido', tipo: 'Nuevo', canal: CFG.canales[0], origen: 'Espontánea', celular: '70012345', servicios: [], total: 0, acuenta: 0, saldo: 0, metodo: '', pagos: [], ts: new Date().toISOString() }, o)); DATA.push(r); queue('save', r, null); return r; };
    const a1 = mk({ fecha: addDias(hoy, -10), servicios: [{ nom: srv, cant: 1, precio: 700, piezas: ['11', '21'] }], total: 700, acuenta: 500, saldo: 200, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 500 }], presu: [{ nom: srv2, monto: 300 }] });
    const a2 = mk({ fecha: hoy, hora: '16:30', estado: 'Agendada', origen: 'Programada', proxMotivo: 'Control' });
    mk({ fecha: addDias(hoy, 3), hora: '09:00', estado: 'Agendada', origen: 'Programada' });
    mk({ fecha: hoy, hora: '11:00', paciente: 'Ana Prueba', celular: '70000001', servicios: [{ nom: srv, cant: 1, precio: 150 }], total: 150, acuenta: 150, saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 150 }] });
    mk({ fecha: hoy, hora: '12:00', paciente: 'Beto Prueba', profesional: OTRA, celular: '70000002', estado: 'Agendada', origen: 'Programada' });
    mk({ fecha: addDias(hoy, -3), paciente: 'Carla Prueba', celular: '70000003', estado: 'No asistió', origen: 'Programada' });
    mk({ fecha: addDias(hoy, -2), paciente: 'Cancela Prueba', celular: '70000005', estado: 'Canceló', origen: 'Programada' });
    mk({ fecha: addDias(hoy, -1), paciente: 'Vencida Prueba', celular: '70000006', estado: 'Agendada', origen: 'Programada' });
    mk({ fecha: addDias(hoy, -40), paciente: MAYUS, celular: '70000004', servicios: [{ nom: srv2, cant: 2, precio: 400 }], total: 800, acuenta: 800, saldo: 0, metodo: 'Tarjeta', pagos: [{ metodo: 'Tarjeta', monto: 800 }] });
    const f = pacDe(PAC); f.nombre = PAC; f.nac = '1990-05-05'; f.med = Object.assign(f.med || {}, { alergias: 'Penicilina', odonto: { '17': { e: 'caries', f: addDias(hoy, -20) }, '36': { e: 'ausente', f: addDias(hoy, -20) } } });
    f.planes.push(planNormalize({ nombre: 'Paquete Blanco', total: 900, prof: DRA, fecha: addDias(hoy, -5), paquete: true, sesiones: [{ desc: 'Sesión 1', precio: 300 }, { desc: 'Sesión 2', precio: 300 }, { desc: 'Sesión 3', precio: 300 }] }));
    f.planes.push(planNormalize({ nombre: 'Ortodoncia', total: 3000, prof: DRA, fecha: addDias(hoy, -5), cuotas: 6, cadaDias: 30, sesiones: [{ desc: 'Colocación', precio: 1000 }, { desc: 'Control 1', precio: 500 }, { desc: 'Retiro', precio: 500 }] }));
    savePac(f);
    const e = { id: uid(), fecha: hoy, categoria: 'Insumos y materiales', detalle: 'Guantes', proveedor: 'Dental', metodo: 'Efectivo', monto: 120 }; EGR = (EGR || []).concat([e]); queue('egreso', e, null);
    CFG.metaMes = 20000; try { saveCfg() } catch (e) {}
    saveLocal(); flushQueue();
    return { a1: a1.id, a2: a2.id, planes: f.planes.map(p => p.id) };
  }, { PAC, MAYUS });
  await D.waitForTimeout(1500);
  await D.evaluate(() => { try { closeModal() } catch (e) {} mdPref('NOCHE', 'si'); mdAplicarNoche(); });
  OK('body tiene md-noche', await D.evaluate(() => document.body.classList.contains('md-noche')));
  const medir = async (P, label, raiz) => {
    const r = await P.evaluate(CONTRASTE + '(' + JSON.stringify(raiz || '') + ')');
    const mal = r.filter(x => x.mal), av = r.filter(x => !x.mal);
    avisos += av.length;
    OK('noche · ' + label + ': ningún texto con contraste < 3', mal.length === 0, mal.map(x => x.sel + ' ' + x.ratio + ' «' + x.t + '» ' + x.fg + '/' + x.bg));
    if (av.length) console.log('       aviso (3–4,5 en texto normal): ' + av.slice(0, 6).map(x => x.sel + ' ' + x.ratio + ' «' + x.t + '»').join(' | '));
    if (SHOT) { try { await P.screenshot({ path: path.join(SHOT, SUF + '-noche-' + label.replace(/[^a-z0-9]+/gi, '_') + '.png') }); } catch (e) {} }
  };
  const cerrar = async (P) => { await P.evaluate(() => { try { closeModal() } catch (e) {} try { mdAgendarCerrar() } catch (e) {} try { mdCerrarHoja() } catch (e) {} try { asisCerrar() } catch (e) {} }); await P.waitForTimeout(200); };
  /* ---------- vistas (1366) ---------- */
  const vistas = await D.evaluate(() => $$('nav button[data-v]').map(b => b.dataset.v));
  for (const vv of vistas) {
    await D.evaluate((x) => show(x), vv); await D.waitForTimeout(600);
    await medir(D, 'vista ' + vv);
    if (vv === 'midia') { await D.evaluate(() => window.scrollTo(0, 500)); await D.waitForTimeout(200); await medir(D, 'vista midia (abajo)'); await D.evaluate(() => window.scrollTo(0, 0)); }
    if (vv === 'cita') {
      await D.evaluate(() => { try { AG_MODO = 'sem'; renderCitasProximas(); } catch (e) {} }); await D.waitForTimeout(500); await medir(D, 'vista cita semana');
      await D.evaluate(() => { try { mdAgendarAbrir() } catch (e) {} }); await D.waitForTimeout(500); await medir(D, 'panel agendar', '#md-agendar'); await cerrar(D);
      await D.evaluate(() => { const d = document.querySelector('#v-cita details.md-mas'); if (d) d.open = true; }); await D.waitForTimeout(200); await medir(D, 'vista cita con «⋯ Más» abierto');
    }
    if (vv === 'panel') { for (const s of ['servicios', 'agenda', 'equipo', 'pacientes']) { await D.evaluate((s) => { const el = document.querySelector('#p-sec'); if (el) { el.value = s; el.dispatchEvent(new Event('change', { bubbles: true })); } }, s); await D.waitForTimeout(400); await medir(D, 'vista panel ' + s); } }
    if (vv === 'caja') { await D.evaluate(() => { const r = document.querySelector('#c-rango'); if (r) { r.value = 'mes'; r.dispatchEvent(new Event('change', { bubbles: true })); } }); await D.waitForTimeout(500); await medir(D, 'vista caja mes'); await D.evaluate(() => window.scrollTo(0, 600)); await D.waitForTimeout(200); await medir(D, 'vista caja (abajo)'); await D.evaluate(() => window.scrollTo(0, 0)); }
    if (vv === 'lista') { await D.fill('#l-q', "O'Neil"); await D.waitForTimeout(900); await medir(D, 'vista lista con búsqueda'); await D.fill('#l-q', ''); await D.waitForTimeout(500); }
    if (vv === 'pacientes') { await D.fill('#pc-q', 'Ana Pruebaa'); await D.waitForTimeout(900); await medir(D, 'vista pacientes «¿Quisiste decir?»'); await D.fill('#pc-q', ''); await D.waitForTimeout(500); }
    if (vv === 'agenda') { await D.evaluate(() => window.scrollTo(0, 400)); await D.waitForTimeout(200); await medir(D, 'vista agenda (abajo)'); await D.evaluate(() => window.scrollTo(0, 0)); }
    if (vv === 'config') { for (const g of ['md-aj-equipo', 'md-aj-trat', 'md-aj-msj', 'md-aj-datos', 'md-aj-apar']) { await D.evaluate((g) => { try { mdAjGrupo(g) } catch (e) {} }, g); await D.waitForTimeout(300); await medir(D, 'vista config ' + g); } }
    if (vv === 'atencion') { await D.evaluate((PAC) => { clearForm(); $('#f-paciente').value = PAC; $('#f-paciente').dispatchEvent(new Event('input', { bubbles: true })); $('#f-paciente').dispatchEvent(new Event('change', { bubbles: true })); try { onPaciente && onPaciente() } catch (e) {} }, PAC); await D.waitForTimeout(700); await medir(D, 'vista atencion con paciente'); await D.evaluate(() => window.scrollTo(0, 700)); await D.waitForTimeout(200); await medir(D, 'vista atencion (abajo)'); await D.evaluate(() => { window.scrollTo(0, 0); clearForm(); }); }
  }
  /* ---------- ventanas (1366) ---------- */
  const modales = [
    ['ficha', `verPaciente(${JSON.stringify(PAC)})`], ['planes', `abrirPlanes(${JSON.stringify(PAC)})`],
    ['plan paquete', `verPlan(${JSON.stringify(PAC)}, ${JSON.stringify(seed.planes[0])})`], ['plan orto', `verPlan(${JSON.stringify(PAC)}, ${JSON.stringify(seed.planes[1])})`],
    ['atencion recibo', `verFicha(${JSON.stringify(seed.a1)})`], ['cita hoy', `verFicha(${JSON.stringify(seed.a2)})`], ['cobrar', `cobrarSaldo(${JSON.stringify(seed.a1)})`],
    ['whatsapp', `showWhatsappModal(DATA.filter(r=>r.id===${JSON.stringify(seed.a1)})[0])`], ['diente', `verDiente(${JSON.stringify(PAC)}, '17')`],
    ['presupuesto', `mdPrDesdeFicha(${JSON.stringify(PAC)})`], ['anuncio', `anuncioAbrir()`], ['corregir nombre', `corregirNombre(${JSON.stringify(PAC)})`],
    ['pago plan', `(function(){ if(typeof pagoAlPlan==='function') pagoAlPlan(${JSON.stringify(PAC)}, ${JSON.stringify(seed.planes[1])}); })()`],
    ['sonri ayuda', `asisAbrir('ayuda')`], ['sonri avisos', `asisAbrir('avisos')`], ['sonri novedades', `asisAbrir('novedades')`],
  ];
  await D.evaluate(() => show('pacientes')); await D.waitForTimeout(400);
  for (const [nm, code] of modales) {
    const err = await D.evaluate((code) => { try { eval(code); return ''; } catch (e) { return String(e && e.message || e); } }, code);
    await D.waitForTimeout(500);
    if (err) OK('noche · ventana ' + nm + ' abre', false, err);
    else await medir(D, 'ventana ' + nm, /sonri/.test(nm) ? '#asis-panel' : '#modal');
    if (nm === 'ficha') { await D.evaluate(() => { const m = $('#modal'); m.scrollTop = 700; }); await D.waitForTimeout(200); await medir(D, 'ventana ficha (abajo)', '#modal'); }
    await cerrar(D);
  }
  /* ---------- el celular (390): Mi día, ficha, hoja «Más», agenda ---------- */
  const C = await abrir('no-duena-1', 390);
  await C.evaluate(() => { mdPref('NOCHE', 'si'); mdAplicarNoche(); show('midia'); }); await C.waitForTimeout(600);
  await medir(C, '390 vista midia');
  await C.evaluate(() => mdAbrirHoja()); await C.waitForTimeout(400); await medir(C, '390 hoja mas', '#md-hoja'); await cerrar(C);
  await C.evaluate((PAC) => { show('pacientes'); verPaciente(PAC); }, PAC); await C.waitForTimeout(600); await medir(C, '390 ventana ficha', '#modal'); await cerrar(C);
  await C.evaluate(() => show('agenda')); await C.waitForTimeout(600); await medir(C, '390 vista agenda');
  await C.evaluate(() => show('cita')); await C.waitForTimeout(600); await medir(C, '390 vista cita');
  await C.context().close();
  await D.context().close();
  OK('sin errores de JavaScript', errs.length === 0, errs.slice(0, 5));
  await b.close();
  console.log('avisos (3–4,5):', avisos);
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
