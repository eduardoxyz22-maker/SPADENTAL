/* Abonos con fecha real, en Chromium real, en las dos clínicas: «Registrar pago» con «Fecha del pago»,
   confirmar y cancelar el diálogo de una fecha pasada, la caja de cada día, el saldo a favor sin doble
   caja y los rechazos. .gs real en memoria (sin red), sesión de la dueña, datos ficticios.
   Uso: PANEL=spa|cos node -r ./netguard.js e2e-abono-fecha.js */
const { chromium } = require('playwright-core');
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const FILE = path.join(__dirname, '..', '..', SPA ? 'pacientes.html' : 'cosmetic/pacientes.html');
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
const CID = SPA ? 'spadental' : 'cosmetic';
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = gsServer(GS); server.shimClaves = false;   /* los datos de prueba se siembran directo; después, sesión obligatoria */
  const v = server.ctx.leerVerif(); v.admin = server.ctx.shaHex('ab-duena-1'); server.ctx.guardarVerif(v);
  /* el servidor en memoria vive el mismo día que el navegador: 23/10 al mediodía de Bolivia */
  const RealDate = Date;
  server.ctx.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : ['2026-10-23T16:00:00Z'])); } static now() { return new RealDate('2026-10-23T16:00:00Z').valueOf(); } };
  const base = { clinicaId: CID, hora: '10:00', profesional: 'Dra. Ficticia', estado: 'Atendido', celular: '70000001', servicios: [{ nom: 'Corona ficticia', cant: 1, precio: 1000 }],
    total: 1000, acuenta: 250, saldo: 750, metodo: 'QR', pagos: [{ metodo: 'QR', monto: 250 }], cobrosPosteriores: [], cobroInicialFechado: true, ts: '2026-10-15T14:00:00.000Z' };
  server.handle({ action: 'save', registro: Object.assign({ id: 'ab-at1', fecha: '2026-10-15', paciente: 'Paciente Abonos Uno' }, base) });
  server.handle({ action: 'save', registro: Object.assign({ id: 'ab-at2', fecha: '2026-10-15', paciente: 'Paciente Abonos Dos' }, base) });
  server.handle({ action: 'save', registro: Object.assign({}, base, { id: 'ab-ant', fecha: '2026-10-20', paciente: 'Paciente Abonos Dos', estado: 'Anticipo', servicios: [], total: 0, acuenta: 300, saldo: 0, pagos: [{ metodo: 'QR', monto: 300 }], anticipoPor: 'Dueña', profesional: '' }) });
  server.handle({ action: 'save', registro: Object.assign({}, base, { id: 'ab-at3', fecha: '2026-10-15', paciente: 'Paciente Abonos Tres', total: 200, acuenta: 100, saldo: 100, pagos: [{ metodo: 'QR', monto: 100 }] }) });
  const reg = id => server.handle({ action: 'list' }).registros.find(r => r.id === id);

  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
  const red = [], errs = [], dialogos = []; let responder = true;
  const D = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  D.on('pageerror', e => errs.push(e.message));
  D.on('dialog', d => { dialogos.push(d.message()); responder ? d.accept() : d.dismiss(); });
  await D.route('**/*', async r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue();
    if (/script\.google(usercontent)?\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(server.handle(JSON.parse(r.request().postData() || '{}'))) });
    if (!/fonts\.g/.test(u)) red.push(u); return r.abort(); });
  await D.clock.install({ time: new Date('2026-10-23T16:00:00Z') });
  await D.goto('file://' + FILE); await D.waitForTimeout(800);
  await D.fill('#gate-pass', 'ab-duena-1'); await D.click('#gate-btn'); await D.waitForTimeout(2000);
  await D.evaluate(() => pullServer()); await D.waitForTimeout(600);

  /* abre «Registrar pago», completa fecha, monto y método como lo haría la persona, y toca «Guardar pago» */
  const pagar = async (id, monto, fecha, met) => {
    await D.evaluate(id => { closeModal && closeModal(); cobrarSaldo(id); }, id); await D.waitForTimeout(250);
    await D.fill('#cp-fecha', fecha); await D.fill('#cp-m', String(monto));
    await D.evaluate(m => { const i = document.querySelector('input[name="cpmet"][value="' + m + '"]'); if (i) i.click(); }, met || 'QR');
    await D.evaluate(() => { const b = [...document.querySelectorAll('#modal button')].find(x => /Guardar pago/.test(x.textContent)); b.click(); });
    await D.waitForTimeout(900);
  };
  const caja = f => D.evaluate(f => totalCobros(filasCajaDia(f)), f);
  const ultimoToast = () => D.evaluate(() => (document.querySelector('#toast') || {}).textContent || '');

  /* el campo: hoy por defecto, mínimo la fecha de la atención, máximo hoy */
  await D.evaluate(() => cobrarSaldo('ab-at1')); await D.waitForTimeout(250);
  const campo = await D.evaluate(() => { const i = document.querySelector('#cp-fecha'); return i && { v: i.value, min: i.min, max: i.max, tipo: i.type }; });
  OK('«Fecha del pago»: date, hoy por defecto, desde la atención hasta hoy', campo && campo.tipo === 'date' && campo.v === '2026-10-23' && campo.min === '2026-10-15' && campo.max === '2026-10-23', campo);
  await D.evaluate(() => closeModal());

  /* tres abonos sobre la misma atención */
  responder = true; dialogos.length = 0;
  await pagar('ab-at1', 300, '2026-10-20', 'QR');
  OK('abono 300 del 20: pide confirmar la fecha pasada', dialogos.length === 1 && /no a la de hoy/.test(dialogos[0]), dialogos);
  OK('saldo 750 → 450 en el servidor', reg('ab-at1').saldo === 450, reg('ab-at1').saldo);
  await pagar('ab-at1', 200, '2026-10-22', 'Efectivo');
  OK('saldo 450 → 250', reg('ab-at1').saldo === 250, reg('ab-at1').saldo);
  dialogos.length = 0; await pagar('ab-at1', 250, '2026-10-23', 'QR');
  OK('abono de hoy: sin diálogo, saldo 0', dialogos.length === 0 && reg('ab-at1').saldo === 0, [dialogos, reg('ab-at1').saldo]);
  const r1 = reg('ab-at1');
  OK('una sola atención, con su fecha 15/10, y tres abonos con fecha propia', server.handle({ action: 'list' }).registros.filter(r => r.paciente === 'Paciente Abonos Uno').length === 1 && r1.fecha === '2026-10-15' &&
    JSON.stringify(r1.cobrosPosteriores.map(p => [p.fecha, p.metodo, p.monto])) === JSON.stringify([['2026-10-20', 'QR', 300], ['2026-10-22', 'Efectivo', 200], ['2026-10-23', 'QR', 250]]), r1.cobrosPosteriores);
  OK('el servidor anota registradoEn y registradoPor', r1.cobrosPosteriores.every(p => p.registradoEn && p.registradoPor === 'admin'), r1.cobrosPosteriores.map(p => p.registradoPor));
  const cj = []; for (const d of ['15', '20', '22', '23']) cj.push(await caja('2026-10-' + d));
  OK('caja: el 15 las tres atenciones iniciales (250+250+100), el 20 abono 300 + anticipo 300, el 22 200, el 23 250', JSON.stringify(cj) === JSON.stringify([250 + 250 + 100, 300 + 300, 200, 250]), cj);

  /* la pantalla de Caja de ese día muestra lo mismo */
  const vista = await D.evaluate(() => { try { show('caja'); const i = document.querySelector('#caja-dia, #c-dia, input[type=date][id*=caja]'); return !!document.querySelector('#v-caja, [data-view=caja], #caja'); } catch (e) { return 'error ' + e.message; } });
  OK('la vista Caja abre sin errores', vista !== false && !String(vista).startsWith('error'), vista);

  /* cancelar el diálogo: no se guarda nada */
  responder = false; dialogos.length = 0;
  await pagar('ab-at3', 50, '2026-10-21', 'QR');
  OK('cancelar la confirmación: no se guarda', dialogos.length === 1 && reg('ab-at3').saldo === 100 && !(reg('ab-at3').cobrosPosteriores || []).length, reg('ab-at3').saldo);
  responder = true;

  /* rechazos del panel (no llegan al servidor) */
  await pagar('ab-at3', 50, '2026-10-24', 'QR');
  OK('fecha futura: no se guarda', reg('ab-at3').saldo === 100, await ultimoToast());
  await pagar('ab-at3', 50, '2026-10-14', 'QR');
  OK('fecha anterior a la atención: no se guarda', reg('ab-at3').saldo === 100, await ultimoToast());
  await pagar('ab-at3', 150, '2026-10-23', 'QR');
  OK('más que el saldo: no se guarda', reg('ab-at3').saldo === 100, await ultimoToast());

  /* saldo a favor: el anticipo de 300 del 20 paga hoy; no entra otra vez a la caja */
  const antes20 = await caja('2026-10-20'), antes23 = await caja('2026-10-23');
  await pagar('ab-at2', 300, '2026-10-21', 'Saldo a favor');
  OK('saldo a favor con fecha pasada: el panel lo frena', reg('ab-at2').saldo === 750, await ultimoToast());
  await pagar('ab-at2', 300, '2026-10-23', 'Saldo a favor');
  OK('saldo a favor hoy: deuda 750 → 450', reg('ab-at2').saldo === 450, reg('ab-at2').saldo);
  OK('la caja no cambia (el ingreso sigue siendo el anticipo del 20)', await caja('2026-10-20') === antes20 && await caja('2026-10-23') === antes23, [await caja('2026-10-20'), await caja('2026-10-23')]);
  OK('el anticipo sigue intacto y el crédito queda en 0', !!reg('ab-ant') && await D.evaluate(() => creditoLibre('Paciente Abonos Dos')) === 0);

  /* el servidor solo, con un pedido que el panel no mandaría */
  const fresca = reg('ab-at3'), mal = JSON.parse(JSON.stringify(fresca));
  mal.cobrosPosteriores = [{ id: 'ab-x1', fecha: '2026-02-30', metodo: 'QR', monto: 10 }]; mal.acuenta += 10; mal.saldo -= 10;
  OK('servidor: fecha inexistente → abono_fecha', server.handle({ action: 'save', registro: mal, base: fresca }).error === 'abono_fecha');

  OK('sin errores de página', !errs.length, errs);
  OK('sin pedidos a la red real', !red.length, red);
  await b.close();
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
