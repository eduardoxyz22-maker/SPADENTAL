/* Caso real (Cosmetic, 20/10): una consulta guardada con el plan elegido quedó
   contada como la sesión 2 sin que se viera en la ficha, y la visita siguiente
   salió como «sesión 3». Ahora la sesión va como línea de la atención y la
   ficha dice qué sesión lleva cada visita. Chromium real, .gs real en memoria. */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(66), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false; server.sesionDirecta = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('sv-duena-1'); server.ctx.guardarVerif(v);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [];
  const D = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  D.on('pageerror', e => errs.push(e.message)); D.on('dialog', d => d.accept());
  await D.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
    if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
    if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
  await D.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
  await D.goto('file://' + FILE); await D.waitForTimeout(800);
  await D.fill('#gate-pass', 'sv-duena-1'); await D.click('#gate-btn'); await D.waitForTimeout(1800);
  const PAC = 'Paciente Sesion Visible';
  const plan = () => D.evaluate((n) => { const p = planesDe(n)[0]; return p ? { h: avancePlan(p).hechas, est: p.estado, sigue: (proxSesion(p) || {}).n || 0, ses: p.sesiones.map(s => [s.n, !!s.hecha]) } : null; }, PAC);
  /* el paquete de la clínica, vendido hace una semana con la sesión 1 hecha */
  await D.click('nav button[data-v="config"]'); await D.waitForTimeout(400); await D.evaluate(() => { try { mdAjGrupo('md-aj-trat'); } catch (e) {} });
  await D.fill('#pq-nom', 'BLANQUEAMIENTO'); await D.fill('#pq-n', '3'); await D.fill('#pq-tot', '700');
  await D.locator('#c-paquetes button', { hasText: /Guardar paquete/ }).first().click(); await D.waitForTimeout(400);
  await D.click('nav button[data-v="atencion"]'); await D.evaluate(() => clearForm());
  await D.fill('#f-prof', 'Dra. Mirna'); await D.fill('#f-paciente', PAC); await D.fill('#f-cel', '70011133');
  await D.evaluate(() => { $('#f-fecha').value = addDias(hoyISO(), -7); const i = document.querySelector('#seg-canal input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
  /* la venta, en una sola pantalla desde Servicios: consulta 150 + paquete 700 = 850 */
  await D.click('#btn-paq-srv'); await D.waitForTimeout(400);
  OK('0 sin paquetes todavía, ofrece venderle uno', /No tiene ningún paquete/.test(await D.locator('#modal').innerText()) && await D.locator('#modal button', { hasText: /📦 BLANQUEAMIENTO · 3 sesiones · Bs 700/ }).count() === 1);
  await D.locator('#modal button', { hasText: /📦 BLANQUEAMIENTO/ }).first().click(); await D.waitForTimeout(400);
  OK('0 paciente nuevo: la consulta viene tildada y la sesión 1 también', await D.evaluate(() => $('#vp-hoy').checked && $('#vp-cons').checked));
  await D.fill('#vp-cons-p', '150'); await D.dispatchEvent('#vp-cons-p', 'input'); await D.waitForTimeout(100);
  let cu = await D.locator('#vp-cuentas').innerText();
  OK('0 las cuentas: 150 + 700 = 850, paga todo, sesiones 2 a 3 pagadas', /Consulta \/ Valoración: Bs 150/.test(cu) && /Paquete BLANQUEAMIENTO: Bs 700 · 3 sesiones \(Bs 234 \+ Bs 233 \+ Bs 233\)/.test(cu) && /Total de hoy: Bs 850/.test(cu) && /paga Bs 850/.test(cu) && /La consulta queda pagada/.test(cu) && /sesiones 2 a 3 ya están pagadas/.test(cu), cu);
  OK('0 y el campo del pago ya dice 850', await D.evaluate(() => $('#vp-paga').value) === '850');
  await D.locator('#vp-chips button', { hasText: /Solo la consulta/ }).click(); await D.waitForTimeout(100);
  cu = await D.locator('#vp-cuentas').innerText();
  OK('0 si paga solo la consulta: lo dice claro', /paga Bs 150/.test(cu) && /Del paquete no paga nada hoy: los Bs 700 se cobran en las próximas visitas/.test(cu), cu);
  await D.fill('#vp-paga', '400'); await D.dispatchEvent('#vp-paga', 'input'); await D.waitForTimeout(100);
  cu = await D.locator('#vp-cuentas').innerText();
  OK('0 si paga 400: consulta pagada, del paquete 250 y faltan 450', /La consulta queda pagada/.test(cu) && /Del paquete paga Bs 250 \(la sesión 1 de hoy queda pagada\)\. Faltan Bs 450/.test(cu), cu);
  await D.locator('#vp-chips button', { hasText: /Todo/ }).click(); await D.waitForTimeout(100);
  await D.locator('#modal button', { hasText: /Cargar en la atención/ }).click(); await D.waitForTimeout(300);
  OK('0 sin forma de pago no deja seguir', await D.locator('#modal #vp-cuentas').count() === 1);
  await D.evaluate(() => { setRadio('vp-met', 'QR'); vpCambio(); });
  await D.locator('#modal button', { hasText: /Cargar en la atención/ }).click(); await D.waitForTimeout(500);
  const form = await D.evaluate(() => { readSrv(); return { srv: SRV.filter(x => x.nom).map(x => [x.nom, x.precio, x.ses || 0, !!x.solo]), acuenta: $('#f-acuenta').value, met: getRadio('metodo'), total: $('#f-total-view').textContent }; });
  OK('0 queda cargado: consulta 150 + paquete 700 (3 sesiones, hoy la 1), paga 850 QR', JSON.stringify(form.srv) === JSON.stringify([['Consulta / Valoración', 150, 0, false], ['BLANQUEAMIENTO', 700, 3, false]]) && form.acuenta === '850' && form.met === 'QR', form);
  await D.click('#btn-save'); await D.waitForTimeout(1800);
  const wa0 = await D.locator('#wa-txt').innerText();
  OK('0 el WhatsApp dice todo lo recibido: 850 = 384 de hoy + 466 adelantados, y lo reservado', /Recibido hoy: \*Bs 850\*/.test(wa0) && /Bs 384 por lo de hoy/.test(wa0) && /Bs 466 adelantados para sus próximas sesiones/.test(wa0) && /Reservado para su plan: Bs 466/.test(wa0) && !/Le queda a favor/.test(wa0), wa0);
  await D.evaluate(() => closeModal());
  OK('0 paquete vendido con la sesión 1 hecha', JSON.stringify((await plan()).ses) === JSON.stringify([[1, true], [2, false], [3, false]]), await plan());
  const cta = await D.evaluate((n) => { const p = planesDe(n)[0]; const v = DATA.filter(r => r.paciente === n && esAtencion(r)); return [cobradoPlan(p), saldoPlan(p), v.length, v[0].total, v[0].acuenta, Math.round(DATA.filter(r => r.paciente === n && esAnticipo(r)).reduce((a, r) => a + num(r.acuenta), 0))]; }, PAC);
  OK('0 cuentas: paquete pagado 700, nada pendiente; la visita 384 (150 + sesión 1) y 466 adelantados', cta[0] === 700 && cta[1] === 0 && cta[2] === 1 && cta[3] === 384 && cta[4] === 384 && cta[5] === 466, cta);

  /* vuelve: primero cargan la consulta y DESPUÉS eligen el plan */
  await D.click('nav button[data-v="atencion"]'); await D.evaluate(() => clearForm());
  await D.fill('#f-prof', 'Dra. Mirna'); await D.fill('#f-paciente', PAC); await D.dispatchEvent('#f-paciente', 'change'); await D.waitForTimeout(700);
  await D.evaluate(() => { SRV = [{ nom: 'Consulta / Valoración', det: '', cant: 1, precio: 150, lab: '', piezas: [] }]; renderSrv(); recalcTotal(); });
  /* el botón de Servicios: muestra el paquete que tiene, qué sesión toca hoy y si ya está pagada */
  await D.click('#btn-paq-srv'); await D.waitForTimeout(400);
  const m1 = await D.locator('#modal').innerText();
  OK('1 «📦 Sesión de un paquete o plan» muestra el paquete, la sesión de hoy y que ya está pagada', /BLANQUEAMIENTO/.test(m1) && /1\/3 sesiones hechas/.test(m1) && /Hoy sería: BLANQUEAMIENTO · sesión 2/.test(m1) && /ya tiene Bs 233 pagados/.test(m1), m1.slice(0, 260));
  await D.locator('#modal button', { hasText: /Hoy es esta sesión/ }).first().click(); await D.waitForTimeout(500);
  OK('1 queda elegido el plan en la atención', await D.evaluate(() => !!$('#f-plan').value && $('#wrap-plan').style.display !== 'none'));
  const srv = await D.evaluate(() => { readSrv(); return SRV.filter(x => x.nom).map(x => [x.nom, x.precio]); });
  OK('1 al elegir el plan, la sesión 2 se suma como línea (la consulta se queda)', srv.length === 2 && /Consulta/.test(srv[0][0]) && /sesión 2/i.test(srv[1][0]) && srv[1][1] === 233, srv);
  OK('1 el aviso dice sesión 2 (no la 3)', /sesión 2 de 3/.test(await D.evaluate(() => $('#plan-hint').textContent)));
  /* la eligen otra vez: no se duplica */
  await D.evaluate(() => { const s = $('#f-plan'); s.dispatchEvent(new Event('change', { bubbles: true })); }); await D.waitForTimeout(300);
  OK('1 elegirlo de nuevo no duplica la línea', await D.evaluate(() => { readSrv(); return SRV.filter(x => x.nom).length; }) === 2);
  /* se arrepiente: la quita y la línea de la sesión se va; la vuelve a elegir */
  await D.click('#btn-paq-srv'); await D.waitForTimeout(300);
  await D.locator('#modal button', { hasText: /NO es una sesión/ }).first().click(); await D.waitForTimeout(400);
  const sinPlan = await D.evaluate(() => { readSrv(); return [$('#f-plan').value, SRV.filter(x => x.nom).map(x => x.nom)]; });
  OK('1 «NO es una sesión» quita el plan y la línea de la sesión (la consulta se queda)', sinPlan[0] === '' && sinPlan[1].length === 1 && /Consulta/.test(sinPlan[1][0]), sinPlan);
  await D.click('#btn-paq-srv'); await D.waitForTimeout(300); await D.locator('#modal button', { hasText: /Hoy es esta sesión/ }).first().click(); await D.waitForTimeout(500);
  OK('1 la vuelve a elegir: consulta + sesión 2', await D.evaluate(() => { readSrv(); return SRV.filter(x => x.nom).length; }) === 2);
  await D.fill('#f-acuenta', '150'); await D.dispatchEvent('#f-acuenta', 'input'); await D.evaluate(() => { setRadio('metodo', 'QR'); recalcSaldo(); });
  await D.click('#btn-save'); await D.waitForTimeout(1500);
  const wa1 = await D.locator('#wa-txt').innerText();
  OK('2 el WhatsApp: 233 descontados del adelanto, 233 reservados para el plan, nada de «a favor Bs 0»', /Descontado de su adelanto: Bs 233/.test(wa1) && /Reservado para su plan: Bs 233/.test(wa1) && !/a favor: Bs 0/.test(wa1) && !/Saldo a favor libre/.test(wa1), wa1);
  await D.evaluate(() => closeModal());
  let p = await plan();
  OK('2 queda la sesión 2 hecha y sigue la 3', p.h === 2 && p.sigue === 3, p);
  /* la ficha dice qué sesión lleva cada visita */
  await D.evaluate((n) => verPaciente(n), PAC); await D.waitForTimeout(600);
  const filas = await D.evaluate(() => [...document.querySelectorAll('#modal table tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')));
  OK('3 en la ficha, la visita de hoy dice «sesión 2 de 3»', filas.some(t => /Consulta/.test(t) && /sesión 2 de 3 · BLANQUEAMIENTO/.test(t)), filas);
  OK('3 y la de la semana pasada dice «sesión 1 de 3»', filas.some(t => /sesión 1 de 3 · BLANQUEAMIENTO/.test(t)));
  /* una visita vieja guardada solo con la consulta (sin la línea) igual lo dice */
  await D.evaluate((n) => { const r = DATA.filter(x => x.paciente === n && x.planId && (x.servicios || []).some(s => /Consulta/.test(s.nom)))[0]; r.servicios = r.servicios.filter(s => /Consulta/.test(s.nom)); verPaciente(n); }, PAC); await D.waitForTimeout(500);
  const filas2 = await D.evaluate(() => [...document.querySelectorAll('#modal table tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')));
  OK('4 aunque la visita solo tenga la consulta, la ficha dice que es la sesión 2', filas2.some(t => /Consulta/.test(t) && !/sesión 2 de 3 \(/.test(t) && /📦 sesión 2 de 3/.test(t)), filas2);
  await D.evaluate(() => closeModal());

  /* ===== el camino de la captura del 20/10: consulta cargada, después «Planes de tratamiento» → paquete ===== */
  const PAC2 = 'Paciente Consulta Y Paquete';
  const plan2 = () => D.evaluate((n) => { const p = planesDe(n)[0]; return p ? { h: avancePlan(p).hechas, ses: p.sesiones.map(s => [s.n, !!s.hecha]), cob: cobradoPlan(p), sal: saldoPlan(p) } : null; }, PAC2);
  await D.click('nav button[data-v="atencion"]'); await D.evaluate(() => clearForm());
  await D.fill('#f-prof', 'Dra. Mirna'); await D.fill('#f-paciente', PAC2); await D.fill('#f-cel', '70011144'); await D.dispatchEvent('#f-paciente', 'change'); await D.waitForTimeout(500);
  await D.evaluate(() => { const i = document.querySelector('#seg-canal input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await D.evaluate(() => { SRV = [{ nom: 'Consulta / Valoración', det: '', cant: 1, precio: 150, lab: '', piezas: [] }]; renderSrv(); recalcTotal(); });
  await D.click('#btn-planes'); await D.locator('#modal button', { hasText: /📦 BLANQUEAMIENTO/ }).first().click(); await D.waitForTimeout(400);
  OK('5 con la consulta ya cargada, igual pregunta si hoy se hizo la sesión 1', /¿Hoy se hizo la sesión 1\?/.test(await D.locator('#modal').innerText()));
  await D.locator('#modal button', { hasText: /No, hoy solo paga/ }).first().click(); await D.waitForTimeout(500);
  OK('5 «No, hoy solo paga»: el paquete NO queda elegido en la consulta', await D.evaluate(() => $('#f-plan').value === ''));
  /* registra el pago del paquete (700) en la ventana de pago */
  await D.evaluate(() => { const m = $('#an-monto'); m.value = '700'; m.dispatchEvent(new Event('input', { bubbles: true })); setRadio('anmet', 'Efectivo'); });
  await D.locator('#modal button', { hasText: /Guardar pago/ }).first().click(); await D.waitForTimeout(1200);
  await D.evaluate(() => { if (document.querySelector('#ov.on')) closeModal(); });
  let q = await plan2();
  OK('5 el pago del paquete quedó: 700 pagados, nada pendiente, 0/3', q && q.cob === 700 && q.sal === 0 && q.h === 0, q);
  const f2 = await D.evaluate(() => { readSrv(); return [SRV.filter(x => x.nom).map(x => x.nom), $('#f-plan').value, $('#f-acuenta').value]; });
  OK('5 la consulta sigue cargada, sola y sin plan; el pago del paquete no se mezcla', f2[0].length === 1 && /Consulta/.test(f2[0][0]) && f2[1] === '' && f2[2] === '', f2);
  await D.fill('#f-acuenta', '150'); await D.dispatchEvent('#f-acuenta', 'input'); await D.evaluate(() => { setRadio('metodo', 'QR'); recalcSaldo(); });
  await D.click('#btn-save'); await D.waitForTimeout(1500); await D.evaluate(() => closeModal());
  q = await plan2();
  OK('5 guardada la consulta: NO cuenta como sesión (0/3) y el paquete sigue con 700 pagados', q.h === 0 && q.cob === 700 && q.sal === 0, q);
  /* viene a la sesión 1: desde la ficha, «Marcar realizada» con el formulario vacío → visita aparte, sin pedir plata */
  await D.evaluate((n) => { const p = planesDe(n)[0]; atencionDePlan(n, p.id, 1); }, PAC2); await D.waitForTimeout(500);
  OK('6 «Marcar realizada» dice que la sesión ya está pagada', /pagad/i.test(await D.locator('#modal').innerText()) && !/Queda debiendo/.test(await D.locator('#modal').innerText()), (await D.locator('#modal').innerText()).slice(0, 300));
  await D.evaluate(() => { const e = $('#ap-prof'); if (e && !e.readOnly && !e.value) { e.value = 'Dra. Mirna'; e.dispatchEvent(new Event('change', { bubbles: true })); } });
  await D.click('#ap-ok'); await D.waitForTimeout(1500); await D.evaluate(() => closeModal());
  q = await plan2();
  OK('6 sesión 1 hecha, sigue la 2, sin deuda', JSON.stringify(q.ses) === JSON.stringify([[1, true], [2, false], [3, false]]) && q.sal === 0, q);
  /* otro día: cargan una consulta de control y desde la ficha tocan «Marcar realizada · sesión 2» con el formulario a medio llenar */
  await D.click('nav button[data-v="atencion"]'); await D.evaluate(() => clearForm());
  await D.fill('#f-prof', 'Dra. Mirna'); await D.fill('#f-paciente', PAC2); await D.dispatchEvent('#f-paciente', 'change'); await D.waitForTimeout(500);
  await D.evaluate(() => { SRV = [{ nom: 'Consulta / Valoración', det: '', cant: 1, precio: 150, lab: '', piezas: [] }]; renderSrv(); recalcTotal(); });
  await D.evaluate((n) => { const p = planesDe(n)[0]; atencionDePlan(n, p.id, 2); }, PAC2); await D.waitForTimeout(400);
  OK('7 con una atención a medio cargar pregunta si la sesión es esa misma visita', /¿La sesión es esa misma visita\?/.test(await D.locator('#modal').innerText()));
  await D.locator('#modal button', { hasText: /Sí, es esta atención/ }).click(); await D.waitForTimeout(500);
  const f3 = await D.evaluate(() => { readSrv(); return [SRV.filter(x => x.nom).map(x => x.nom), !!$('#f-plan').value, $('#plan-hint').textContent]; });
  OK('7 «Sí»: la sesión 2 entra en esa atención junto con la consulta, y lo dice', f3[0].length === 2 && /sesión 2/.test(f3[0][1]) && f3[1] && /sesión 2 de 3/.test(f3[2]) && /pagados para esta sesión/.test(f3[2]), f3);
  await D.fill('#f-acuenta', '150'); await D.dispatchEvent('#f-acuenta', 'input'); await D.evaluate(() => { setRadio('metodo', 'QR'); recalcSaldo(); });
  await D.click('#btn-save'); await D.waitForTimeout(1500); await D.evaluate(() => closeModal());
  q = await plan2();
  OK('7 queda 2/3 (no salta a la 3), 700 pagados y nada pendiente', JSON.stringify(q.ses) === JSON.stringify([[1, true], [2, true], [3, false]]) && q.cob === 700 && q.sal === 0, q);
  const fact = await D.evaluate((n) => DATA.filter(r => r.paciente === n && esAtencion(r)).reduce((a, r) => a + num(r.total), 0), PAC2);
  OK('7 las cuentas suman: consulta 150 + sesión 1 234 + consulta 150 + sesión 2 233 = 767 facturado', fact === 767, fact);
  /* ===== B3: cambiar de plan A a B deja solo la línea de B; B4: no está el botón «Solo el paquete» ===== */
  const PAC3 = 'Paciente Dos Planes';
  await D.click('nav button[data-v="config"]'); await D.waitForTimeout(400); await D.evaluate(() => { try { mdAjGrupo('md-aj-trat'); } catch (e) {} });
  await D.fill('#pq-nom', 'MESOTERAPIA'); await D.fill('#pq-n', '2'); await D.fill('#pq-tot', '600');
  await D.locator('#c-paquetes button', { hasText: /Guardar paquete/ }).first().click(); await D.waitForTimeout(400);
  await D.click('nav button[data-v="atencion"]'); await D.evaluate(() => clearForm());
  await D.fill('#f-prof', 'Dra. Mirna'); await D.fill('#f-paciente', PAC3); await D.fill('#f-cel', '70011166'); await D.dispatchEvent('#f-paciente', 'change'); await D.waitForTimeout(500);
  await D.evaluate((n) => { const ps = paquetesTipo(); ps.forEach(x => crearPaquete(n, x.i, true)); }, PAC3); await D.waitForTimeout(600);
  await D.evaluate(() => { SRV = [{ nom: 'Consulta / Valoración', det: '', cant: 1, precio: 150, lab: '', piezas: [] }]; renderSrv(); recalcTotal(); });
  const ids = await D.evaluate((n) => planesActivos(n).map(p => [p.id, p.nombre]), PAC3);
  OK('8 el paciente tiene los dos paquetes activos', ids.length === 2, ids);
  const lineas = () => D.evaluate(() => { readSrv(); return SRV.filter(x => x.nom).map(x => x.nom); });
  await D.evaluate((id) => elegirPlanEnForm(id), ids[0][0]); await D.waitForTimeout(300);
  const l1 = await lineas();
  await D.evaluate((id) => elegirPlanEnForm(id), ids[1][0]); await D.waitForTimeout(300);
  const l2 = await lineas();
  await D.evaluate((id) => elegirPlanEnForm(id), ids[0][0]); await D.waitForTimeout(300);
  const l3 = await lineas();
  await D.evaluate(() => elegirPlanEnForm('')); await D.waitForTimeout(300);
  const l4 = await lineas();
  OK('8 A → B → A → ninguno: siempre la consulta más una sola línea de sesión, del plan elegido', l1.length === 2 && new RegExp(ids[0][1]).test(l1[1]) && l2.length === 2 && new RegExp(ids[1][1]).test(l2[1]) && l3.length === 2 && new RegExp(ids[0][1]).test(l3[1]) && l4.length === 1 && /Consulta/.test(l4[0]), [l1, l2, l3, l4]);
  await D.evaluate(() => clearForm());
  await D.fill('#f-prof', 'Dra. Mirna'); await D.fill('#f-paciente', 'Paciente Chips'); await D.dispatchEvent('#f-paciente', 'change'); await D.waitForTimeout(400);
  await D.click('#btn-paq-srv'); await D.waitForTimeout(300); await D.locator('#modal button', { hasText: /📦 BLANQUEAMIENTO/ }).first().click(); await D.waitForTimeout(300);
  await D.fill('#vp-cons-p', '150'); await D.dispatchEvent('#vp-cons-p', 'input'); await D.waitForTimeout(100);
  const chips = await D.evaluate(() => [...document.querySelectorAll('#vp-chips button')].map(b => b.textContent));
  OK('8 en la venta no está el botón «Solo el paquete» (la plata paga primero la consulta)', chips.length === 3 && !chips.some(c => /Solo el paquete/.test(c)) && chips.some(c => /Todo/.test(c)) && chips.some(c => /Solo la consulta/.test(c)), chips);
  await D.evaluate(() => closeModal()); await D.evaluate(() => clearForm());
  /* ===== «hoy solo paga» con consulta: el WhatsApp igual dice los 700 del paquete; borrar el monto no lo rellena ===== */
  await D.fill('#f-prof', 'Dra. Mirna'); await D.fill('#f-paciente', 'Paciente Solo Paga'); await D.fill('#f-cel', '70011177'); await D.dispatchEvent('#f-paciente', 'change'); await D.waitForTimeout(400);
  await D.evaluate(() => { const i = document.querySelector('#seg-canal input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await D.click('#btn-paq-srv'); await D.waitForTimeout(300); await D.locator('#modal button', { hasText: /📦 BLANQUEAMIENTO/ }).first().click(); await D.waitForTimeout(300);
  await D.fill('#vp-cons-p', '150'); await D.dispatchEvent('#vp-cons-p', 'input');
  await D.fill('#vp-paga', ''); await D.dispatchEvent('#vp-paga', 'input'); await D.waitForTimeout(100);
  OK('9 borrar «¿Cuánto paga hoy?» lo deja vacío (paga Bs 0), no lo rellena', await D.evaluate(() => $('#vp-paga').value === '' && /paga Bs 0/.test($('#vp-cuentas').innerText)));
  await D.locator('#vp-chips button', { hasText: /Todo/ }).click(); await D.evaluate(() => { $('#vp-hoy').checked = false; setRadio('vp-met', 'QR'); vpCambio(); }); await D.waitForTimeout(100);
  OK('9 sin sesión hoy: las cuentas dicen que el paquete queda pagado entero', /hoy no se hace ninguna sesión/.test(await D.locator('#vp-cuentas').innerText()) && /las 3 sesiones ya están pagadas/.test(await D.locator('#vp-cuentas').innerText()));
  await D.locator('#modal button', { hasText: /Cargar en la atención/ }).click(); await D.waitForTimeout(400);
  await D.click('#btn-save'); await D.waitForTimeout(2000);
  const wa9 = await D.locator('#wa-txt').innerText();
  OK('9 el WhatsApp dice los 850 recibidos: 150 de la consulta y 700 adelantados para su paquete, reservados', /Recibido hoy: \*Bs 850\*/.test(wa9) && /Bs 150 por lo de hoy/.test(wa9) && /Bs 700 adelantados para su paquete/.test(wa9) && /Reservado para su plan: Bs 700/.test(wa9), wa9);
  await D.evaluate(() => closeModal()); await D.waitForTimeout(800);
  const p9 = await D.evaluate(() => { const p = planesDe('Paciente Solo Paga')[0]; return p ? [avancePlan(p).hechas, cobradoPlan(p), saldoPlan(p)] : null; });
  OK('9 el paquete quedó 0/3 con 700 pagados', p9 && p9[0] === 0 && p9[1] === 700 && p9[2] === 0, p9);
  OK('no quedan cosas sin subir', await D.evaluate(() => pend().length) === 0);
  OK('sin errores de página ni red real', !errs.length && !red.length, errs.concat(red).slice(0, 3));
  await b.close();
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('FALLAS: excepción'); process.exit(1); });
