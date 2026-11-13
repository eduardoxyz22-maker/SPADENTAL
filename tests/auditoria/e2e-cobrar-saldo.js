/* «💵 Cobrar saldo» desde la ficha del paciente, en Chromium real, en las dos clínicas: un solo botón de
   plata (si debe, Cobrar saldo; si no, Anticipo), pago total o parcial repartido de la visita más vieja a
   la más nueva, fecha del pago, caja de cada día y rechazos. .gs real en memoria, datos ficticios, sin red.
   Uso: PANEL=spa|cos node -r ./netguard.js e2e-cobrar-saldo.js */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const CID = SPA ? 'spadental' : 'cosmetic';
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(72), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false;
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('cs-duena-1'); server.ctx.guardarVerif(v);
  const RealDate = Date;
  server.ctx.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : ['2026-11-13T16:00:00Z'])); } static now() { return new RealDate('2026-11-13T16:00:00Z').valueOf(); } };
  const PAC = 'Paciente Ficticia Saldo';
  const at = (id, fecha, hora, nom, total, acuenta) => server.handle({ action: 'save', registro: { id, clinicaId: CID, fecha, hora, paciente: PAC, profesional: 'Dra. Ficticia', estado: 'Atendido', celular: '70000002',
    servicios: [{ nom, cant: 1, precio: total }], total, acuenta, saldo: total - acuenta, metodo: 'QR', pagos: [{ metodo: 'QR', monto: acuenta }], cobrosPosteriores: [], cobroInicialFechado: true, ts: fecha + 'T14:00:00.000Z' } });
  at('cs-endo', '2026-09-09', '10:00', 'Endodoncia', 750, 700);
  at('cs-cons', '2026-09-09', '09:00', 'Consulta', 30, 30);
  at('cs-rest', '2026-09-12', '10:00', 'Restauración', 220, 200);
  at('cs-limp', '2026-09-16', '10:00', 'Limpieza', 200, 200);
  at('cs-perno', '2026-09-17', '10:00', 'Perno', 250, 200);
  server.handle({ action: 'save', registro: { id: 'cs-otra', clinicaId: CID, fecha: '2026-09-20', hora: '10:00', paciente: 'Paciente Sin Deuda', profesional: 'Dra. Ficticia', estado: 'Atendido', celular: '70000003',
    servicios: [{ nom: 'Limpieza', cant: 1, precio: 200 }], total: 200, acuenta: 200, saldo: 0, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 200 }], cobrosPosteriores: [], cobroInicialFechado: true } });
  const reg = id => server.handle({ action: 'list' }).registros.find(r => r.id === id);
  const saldos = () => ['cs-endo', 'cs-rest', 'cs-perno'].map(id => reg(id).saldo);

  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [], dialogos = []; let responder = true;
  const D = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  D.on('pageerror', e => errs.push(e.message));
  D.on('dialog', d => { dialogos.push(d.message()); responder ? d.accept() : d.dismiss(); });
  await D.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
    if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
    if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
  await D.clock.install({ time: new Date('2026-11-13T16:00:00Z') });
  await D.goto('file://' + FILE); await D.waitForTimeout(800);
  await D.fill('#gate-pass', 'cs-duena-1'); await D.click('#gate-btn'); await D.waitForTimeout(2000);
  await D.evaluate(() => pullServer()); await D.waitForTimeout(600);
  const botones = () => D.evaluate(() => [...document.querySelectorAll('#modal button, #modal a.btn')].map(x => x.textContent.trim()));
  const caja = f => D.evaluate(f => totalCobros(filasCajaDia(f)), f);
  const toastTxt = () => D.evaluate(() => (document.querySelector('#toast') || {}).textContent || '');
  const tocar = txt => D.evaluate(t => { const x = [...document.querySelectorAll('#modal button')].find(b => b.textContent.includes(t)); if (x) x.click(); return !!x; }, txt);

  /* un solo botón de plata en la ficha */
  await D.evaluate(n => verPaciente(n), PAC); await D.waitForTimeout(400);
  if (process.env.SHOT) { await D.evaluate(() => { const r = [...document.querySelectorAll('#modal .row-btn')].pop(); r && r.scrollIntoView({ block: 'center' }); }); await D.waitForTimeout(200);
    await D.screenshot({ path: process.env.SHOT + '-ficha' + (SPA ? '' : '-cos') + '.png' }); }
  let bt = await botones();
  OK('ficha con deuda: «💵 Cobrar saldo» y sin «Anticipo»', bt.some(t => t === '💵 Cobrar saldo') && !bt.some(t => /Anticipo/.test(t)), bt);
  await D.evaluate(() => closeModal()); await D.evaluate(() => verPaciente('Paciente Sin Deuda')); await D.waitForTimeout(400);
  bt = await botones();
  OK('ficha sin deuda: sin «Cobrar saldo»' + (SPA ? ' y con «Anticipo»' : ''), !bt.some(t => /Cobrar saldo/.test(t)) && (bt.some(t => /Anticipo/.test(t)) === await D.evaluate(() => puedeAnticipo())), bt);
  await D.evaluate(() => closeModal());

  /* la ventana: viene con todo lo que debe */
  await D.evaluate(n => verPaciente(n), PAC); await D.waitForTimeout(300);
  await tocar('Cobrar saldo'); await D.waitForTimeout(300);
  const v0 = await D.evaluate(() => ({ m: $('#cps-m').value, res: $('#cps-res').textContent, fecha: $('#cps-fecha').value, botones: [...document.querySelectorAll('#modal button')].map(b => b.textContent.trim()) }));
  OK('la ventana trae Bs 120 (todo lo que debe) y dice que queda sin deuda', v0.m === '120' && /queda sin deuda/.test(v0.res), v0);
  OK('botones propios: solo Guardar pago y Cancelar (la ✕ y «Cerrar» son de todas las ventanas)', JSON.stringify(v0.botones.filter(t => t !== '✕' && t !== 'Cerrar')) === JSON.stringify(['Guardar pago', 'Cancelar']), v0.botones);
  OK('fecha del pago: hoy', v0.fecha === '2026-11-13', v0.fecha);

  /* paga una parte: 60 */
  if (process.env.SHOT) await D.locator('#modal').screenshot({ path: process.env.SHOT + '-ventana' + (SPA ? '' : '-cos') + '.png' });
  await D.fill('#cps-m', '60'); await D.waitForTimeout(150);
  if (process.env.SHOT) { await D.evaluate(() => { document.querySelector('#modal details').open = true; document.querySelector('input[name="cpsmet"][value="QR"]').click(); }); await D.waitForTimeout(150);
    await D.locator('#modal').screenshot({ path: process.env.SHOT + '-parcial' + (SPA ? '' : '-cos') + '.png' }); await D.evaluate(() => { document.querySelector('#modal details').open = false; document.querySelector('input[name="cpsmet"][value="QR"]').checked = false; }); }
  const v1 = await D.evaluate(() => ({ res: $('#cps-res').textContent, rep: [...document.querySelectorAll('#cps-rep > div')].map(d => d.querySelector('b').textContent.trim()) }));
  OK('escribe 60: «Paga Bs 60 · queda debiendo Bs 60»', /Paga Bs 60/.test(v1.res) && /queda debiendo Bs 60/.test(v1.res), v1.res);
  OK('se reparte de la más vieja: endodoncia 50, restauración 10, perno 0', JSON.stringify(v1.rep) === JSON.stringify(['paga Bs 50', 'paga Bs 10', '—']), v1.rep);
  await tocar('Guardar pago'); await D.waitForTimeout(300);
  OK('sin marcar cómo paga: no guarda', JSON.stringify(saldos()) === JSON.stringify([50, 20, 50]), await toastTxt());
  await D.evaluate(() => { document.querySelector('input[name="cpsmet"][value="QR"]').click(); });
  const cajaHoy0 = await caja('2026-11-13');
  await tocar('Guardar pago'); await D.waitForTimeout(1500);
  OK('servidor: endodoncia 0, restauración 10, perno 50', JSON.stringify(saldos()) === JSON.stringify([0, 10, 50]), saldos());
  OK('cada parte es un abono de su visita, con la fecha de hoy', reg('cs-endo').cobrosPosteriores.slice(-1)[0].monto === 50 && reg('cs-rest').cobrosPosteriores.slice(-1)[0].monto === 10 &&
    reg('cs-endo').cobrosPosteriores.slice(-1)[0].fecha === '2026-11-13' && reg('cs-endo').fecha === '2026-09-09', [reg('cs-endo').cobrosPosteriores, reg('cs-rest').cobrosPosteriores]);
  OK('la caja de hoy suma 60', await caja('2026-11-13') - cajaHoy0 === 60, await caja('2026-11-13'));
  OK('un solo aviso al final, con lo que queda', /repartido en 2 visitas · queda debiendo Bs 60/.test(await toastTxt()), await toastTxt());
  bt = await botones();
  OK('vuelve a la ficha, que sigue con «Cobrar saldo»', bt.some(t => t === '💵 Cobrar saldo'), bt);

  /* más de lo que debe: no se guarda */
  await tocar('Cobrar saldo'); await D.waitForTimeout(300);
  await D.fill('#cps-m', '61'); await D.evaluate(() => { document.querySelector('input[name="cpsmet"][value="QR"]').click(); });
  OK('escribe 61: avisa que es más de lo que debe', /más de lo que debe/.test(await D.evaluate(() => $('#cps-res').textContent)));
  await tocar('Guardar pago'); await D.waitForTimeout(400);
  OK('y no guarda nada', JSON.stringify(saldos()) === JSON.stringify([0, 10, 50]), await toastTxt());

  /* el resto, pagado otro día: confirma la fecha y entra a la caja de ese día */
  await D.fill('#cps-m', '60'); await D.fill('#cps-fecha', '2026-11-11'); await D.evaluate(() => { document.querySelector('input[name="cpsmet"][value="Efectivo"]').click(); });
  responder = false; dialogos.length = 0; await tocar('Guardar pago'); await D.waitForTimeout(500);
  OK('fecha pasada: pide confirmar; con «Cancelar» no guarda', dialogos.length === 1 && JSON.stringify(saldos()) === JSON.stringify([0, 10, 50]), dialogos);
  responder = true; const caja11 = await caja('2026-11-11');
  await tocar('Guardar pago'); await D.waitForTimeout(1500);
  OK('confirmado: queda sin deuda', JSON.stringify(saldos()) === JSON.stringify([0, 0, 0]), saldos());
  OK('la caja del 11/11 suma 60', await caja('2026-11-11') - caja11 === 60, await caja('2026-11-11'));
  bt = await botones();
  OK('la ficha ya no tiene «Cobrar saldo»', !bt.some(t => /Cobrar saldo/.test(t)), bt);
  OK('sigue siendo una sola atención por visita (no se crearon visitas)', server.handle({ action: 'list' }).registros.filter(r => r.paciente === PAC).length === 5);

  OK('sin errores de página', !errs.length, errs);
  OK('sin pedidos a la red real', !red.length, red);
  if (process.env.SHOT) { await D.evaluate(n => { closeModal(); }, PAC); }
  await b.close();
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
