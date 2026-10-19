/* Circuito completo en Chromium real, con clics. Datos ficticios; servidor = .gs real en memoria; sin red real. */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const SPA = process.env.PANEL === 'spa';
const FILE = SPA ? require('path').join(__dirname,'..','..','pacientes.html') : require('path').join(__dirname,'..','..','cosmetic/pacientes.html');
const GS = SPA ? require('path').join(__dirname,'..','..','google-apps-script-pacientes.gs') : require('path').join(__dirname,'..','..','cosmetic/google-apps-script-pacientes.gs');
const SRVPAQ = SPA ? 'Blanqueamiento láser' : 'Blanqueamiento dental · 3 sesiones';
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(66), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('e2e-duena-1'); v.prof['Dra. Shirley'] = server.ctx.shaHex('e2e-shirley-1'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const abrir = async (clave) => {
    const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue();
      if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
      if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
    await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
    await page.goto('file://' + FILE); await page.waitForTimeout(800);
    await page.fill('#gate-pass', clave); await page.click('#gate-btn'); await page.waitForTimeout(1800);
    return page;
  };
  const P = await abrir('e2e-duena-1');
  const ev = (f, ...a) => P.evaluate(f, ...a);
  const boton = async (pg, re, scope = '#modal') => { const bs = await pg.$$(scope + ' button'); for (const x of bs) { if (re.test(await x.textContent()) && await x.isVisible()) { await x.click(); await pg.waitForTimeout(350); return true; } } return false; };
  const caja = (pg) => pg.evaluate(() => totalCobros(filasCajaDia(hoyISO())));
  const nuevaAt = async (pg, pac, extra) => {
    await pg.click('nav button[data-v="atencion"]'); await pg.evaluate(() => clearForm());
    if (!(await pg.$eval('#f-prof', e => e.readOnly))) await pg.fill('#f-prof', 'Dra. Mirna');
    await pg.fill('#f-paciente', pac); await pg.fill('#f-cel', '70011122');
    await pg.evaluate(() => { var i = document.querySelector('#seg-canal input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })) });
    if (extra) await extra();
  };
  const ponerSrv = async (pg, nom, precio) => { await pg.selectOption('#srv-list .s-nom', nom); await pg.fill('#srv-list .s-precio', String(precio)); await pg.dispatchEvent('#srv-list .s-precio', 'input'); };
  const cobrar = async (pg, monto, met) => { await pg.fill('#f-acuenta', String(monto)); await pg.dispatchEvent('#f-acuenta', 'input'); await pg.evaluate(m => { setRadio('metodo', m); recalcSaldo() }, met); };

  // 1 Ajustes: paquete con clics
  await P.click('nav button[data-v="config"]'); await P.waitForTimeout(300);
  await P.fill('#pq-nom', 'Blanqueamiento'); await P.fill('#pq-n', '3'); await P.fill('#pq-tot', '700');
  await boton(P, /Guardar paquete/, '#c-paquetes');
  OK('1 paquete creado en Ajustes (234/233/233)', await ev(() => (CFG.planesTipo || []).some(t => t.paquete && t.etapas.map(e => e.precio).join() === '234,233,233')));
  const c0 = await caja(P);

  // 2 paciente nuevo: paquete desde la atención, solo paga
  await nuevaAt(P, 'E2E Solo Paga');
  await P.click('#btn-planes'); await boton(P, /📦 Blanqueamiento/);
  OK('2 pregunta si hoy se hizo la sesión 1', await boton(P, /No, hoy solo paga/));
  await ev(() => setRadio('anmet', 'Efectivo')); await boton(P, /Guardar pago/); await P.waitForTimeout(500);
  OK('2 pago 700, formulario limpio, sin atención', await ev(() => DATA.some(r => r.paciente === 'E2E Solo Paga' && esAnticipo(r) && r.acuenta === 700) && !DATA.some(r => r.paciente === 'E2E Solo Paga' && esAtencion(r)) && $('#f-paciente').value === ''));
  await ev(() => closeModal());
  OK('2 aparece en Pacientes (sin visitas)', await ev(() => { show('pacientes'); renderPacientes(); return [...document.querySelectorAll('#pc-body tr')].some(t => /E2E Solo Paga/.test(t.textContent) && /sin visitas/.test(t.textContent)) }));

  // 3 vuelve: marcar sesión 1 desde la ficha
  await ev(() => verPaciente('E2E Solo Paga'));
  await boton(P, /Marcar realizada · sesión 1/);
  await P.selectOption('#ap-prof', 'Dra. Mirna'); await boton(P, /Guardar sesión realizada/); await P.waitForTimeout(500);
  OK('3 sesión 1: 234 pagados con el paquete, no suma caja', await ev(() => { var a = DATA.find(r => r.paciente === 'E2E Solo Paga' && esAtencion(r)); return a && a.total === 234 && a.saldo === 0 && a.celular === '70011122' }) && await caja(P) === c0 + 700);
  await ev(() => closeModal());

  // 4 paciente nuevo: paquete desde la atención, hoy se hizo la sesión 1 y paga todo
  await nuevaAt(P, 'E2E Paga Todo');
  await P.click('#btn-planes'); await boton(P, /📦 Blanqueamiento/); await boton(P, /Sí, hoy se hizo la sesión 1/);
  await cobrar(P, 700, 'QR');
  OK('4 avisa que 466 van al paquete', /466/.test(await P.textContent('#pago-tag')));
  await P.click('#btn-save'); await P.waitForTimeout(900); await ev(() => closeModal());
  OK('4 atención 234 + pago del paquete 466', await ev(() => { var a = DATA.find(r => r.paciente === 'E2E Paga Todo' && esAtencion(r)), x = DATA.filter(r => r.paciente === 'E2E Paga Todo' && esAnticipo(r)); return a && a.total === 234 && a.acuenta === 234 && x.length === 1 && x[0].acuenta === 466 }));
  OK('4 caja +700', await caja(P) === c0 + 1400);

  // 5 paquete cargado entero como una atención: pregunta y lo pasa
  await nuevaAt(P, 'E2E Entero');
  await ponerSrv(P, SRVPAQ, 700); await cobrar(P, 700, 'Efectivo');
  OK('5 la fila se reconoce sola como paquete (sin abrir Planes)', /Paquete de 3 sesiones/.test(await P.textContent('#srv-list')));
  await P.click('#btn-save'); await P.waitForTimeout(1500); await ev(() => closeModal());
  OK('5 quedó 234 y 466 al paquete', await ev(() => { var a = DATA.find(r => r.paciente === 'E2E Entero' && esAtencion(r)), x = DATA.filter(r => r.paciente === 'E2E Entero' && esAnticipo(r)); return a && a.total === 234 && x.length === 1 && x[0].acuenta === 466 }));
  OK('5 caja +700', await caja(P) === c0 + 2100);

  // 6 plan de ortodoncia desde la ficha: pago al plan y etapa
  await nuevaAt(P, 'E2E Orto'); await ponerSrv(P, await ev(() => CFG.precios[0].nom), 100); await cobrar(P, 100, 'Efectivo');
  await P.click('#btn-save'); await P.waitForTimeout(700); await ev(() => closeModal());
  await ev(() => verPaciente('E2E Orto')); await boton(P, /🦷 Planes/); await boton(P, /Crear plan de tratamiento/);
  await ev(() => { var i = plantillasPlan().findIndex(t => t.nombre === 'Ortodoncia'); $('#pl-tipo').value = String(i); aplicarPlantilla(i); PL_ETAPAS.forEach(e => { if (/Instalación/.test(e.desc)) e.precio = 3000; if (/Evaluación/.test(e.desc)) e.precio = 300 }); pintarEtapasEditor(); $('#pl-tot').value = sumaEtapas(); });
  await boton(P, /Guardar plan/); await P.waitForTimeout(400);
  await boton(P, /Registrar pago/); await P.fill('#an-monto', '1000'); await ev(() => setRadio('anmet', 'Tarjeta')); await boton(P, /Guardar pago/); await P.waitForTimeout(400);
  await boton(P, /Marcar realizada · Evaluación/); await boton(P, /Guardar sesión realizada/); await P.waitForTimeout(500);
  OK('6 plan orto: evaluación hecha, pagado 1000, pendiente 2300', await ev(() => { var p = planesDe('E2E Orto')[0]; return avancePlan(p).hechas === 1 && cobradoPlan(p) === 1000 && saldoPlan(p) === 2300 }), await ev(() => { var p = planesDe('E2E Orto')[0]; return [avancePlan(p).hechas, cobradoPlan(p), saldoPlan(p)] }));
  await ev(() => closeModal());

  // 7 editar una atención y sumar un pago de hoy
  const idE = await ev(() => DATA.find(r => r.paciente === 'E2E Orto' && esAtencion(r) && !r.planId).id);
  await ev(id => editarId(id), idE); await P.waitForTimeout(300);
  await P.click('#btn-add-srv'); await P.waitForTimeout(100);
  await P.evaluate(n => { var s = [...document.querySelectorAll('#srv-list .s-nom')].pop(); s.value = n; s.dispatchEvent(new Event('change', { bubbles: true })) }, await ev(() => CFG.precios[1].nom));
  await P.evaluate(() => { var p = [...document.querySelectorAll('#srv-list .s-precio')].pop(); p.value = '50'; p.dispatchEvent(new Event('input', { bubbles: true })) });
  await cobrar(P, 150, 'QR'); await P.click('#btn-save'); await P.waitForTimeout(700); await ev(() => closeModal());
  OK('7 editar y subir A cuenta: pago de 50 hoy', await ev(id => { var r = DATA.find(x => x.id === id); return r.total === 150 && r.acuenta === 150 && (r.cobrosPosteriores || []).length === 1 }, idE));

  // 8 la doctora Shirley marca la sesión 2 del paquete de la clínica
  const S = await abrir('e2e-shirley-1'); await S.waitForTimeout(800);
  await S.evaluate(() => { var p = planesDe('E2E Paga Todo')[0]; verPlan('E2E Paga Todo', p.id) });
  OK('8 Shirley ve el paquete y el botón de la sesión 2', await boton(S, /Marcar realizada · Blanqueamiento · sesión 2/));
  await boton(S, /Guardar sesión realizada/); await S.waitForTimeout(800);
  const at2 = Object.values(server.registros).find(r => r.paciente === 'E2E Paga Todo' && r.profesional === 'Dra. Shirley');
  OK('8 el servidor guardó la sesión 2 de Shirley (233, pagada)', at2 && at2.total === 233 && at2.saldo === 0);

  // 9 borrar la visita de alguien con ficha: no desaparece
  await nuevaAt(P, 'E2E Borrada'); await ponerSrv(P, await ev(() => CFG.precios[0].nom), 80);
  await P.click('#btn-save'); await P.waitForTimeout(600); await ev(() => closeModal());
  await ev(() => { var f = pacDe('E2E Borrada'); f.nombre = 'E2E Borrada'; f.med.alergias = 'Látex'; savePac(f) }); await P.waitForTimeout(300);
  await ev(() => borrar(DATA.find(r => r.paciente === 'E2E Borrada').id)); await P.waitForTimeout(500);
  OK('9 sin visitas pero sigue en Pacientes', await ev(() => { show('pacientes'); renderPacientes(); return [...document.querySelectorAll('#pc-body tr')].some(t => /E2E Borrada/.test(t.textContent)) }));

  // 10 todo en el servidor, sin pendientes
  await P.waitForTimeout(800);
  const pend = await ev(() => pend().length);
  const loc = await ev(() => DATA.filter(r => /^E2E/.test(r.paciente)).map(r => r.id + ':' + r.acuenta + ':' + r.total).sort().join('|'));
  const srv = Object.values(server.registros).filter(r => /^E2E/.test(r.paciente) && r.profesional !== 'Dra. Shirley').map(r => r.id + ':' + r.acuenta + ':' + r.total).sort().join('|');
  OK('10 sin pendientes en la cola', pend === 0, pend);
  OK('10 lo del panel = lo del servidor', loc === srv, [loc.split('|').length, srv.split('|').length]);
  OK('10 sin errores de página', errs.length === 0, errs.slice(0, 3));
  OK('10 sin red real', red.length === 0, red.slice(0, 2));
  await b.close();
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
