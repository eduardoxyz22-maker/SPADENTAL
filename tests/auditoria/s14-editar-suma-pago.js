'use strict';
const FAB = require('./lib.js').FAB;
/* s14: editar una atención ya cobrada y subir "A cuenta" = pago nuevo de hoy.
   Datos ficticios; servidor = .gs real en memoria. */
const { abrir, entrar, nueva, R, close, sha, fakeServer } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(66), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer();
  const A = await abrir({ server }); await entrar(A, FAB.admin); const w = A.w, hoy = w.hoyISO(), ayer = w.addDias(hoy, -1);
  const caja = (T, d) => T.w.totalCobros(T.w.filasCajaDia(d));
  const editar = async (T, id, o) => {
    T.w.editarId(id); await T.tick(5);
    if (o.srv) { T.click('#btn-add-srv'); const ns = T.$$('#srv-list .s-nom'), ps = T.$$('#srv-list .s-precio');
      T.setVal(ns[ns.length - 1], o.srv); await T.tick(5); T.setVal(T.$$('#srv-list .s-precio').slice(-1)[0], String(o.precio)); await T.tick(5); }
    if (o.acuenta != null) T.setVal('#f-acuenta', String(o.acuenta));
    if (o.metodo) T.radio('metodo', o.metodo);
    if (o.mixto) { for (const k in o.mixto) T.setVal(T.w.MX[k], String(o.mixto[k])); }
    T.click('#btn-save'); await T.tick(80); const t = T.toast(); close(T); return t;
  };
  const reg = id => w.DATA.find(r => r.id === id), srv = id => server.registros[id];

  // 1 consulta de ayer, pagada en efectivo; hoy decide hacerse una limpieza y paga por QR
  const c = (await nueva(A, { pac: 'Paciente Indeciso', total: 100, acuenta: 100, metodo: 'Efectivo', fecha: ayer })).r;
  const cajaAyer0 = caja(A, ayer), cajaHoy0 = caja(A, hoy);
  const t1 = await editar(A, c.id, { srv: 'Limpieza dental', precio: 250, acuenta: 350, metodo: 'QR' });
  const r1 = reg(c.id);
  OK('1 se guarda sin bloquear', /pago de Bs 250 registrado hoy/.test(t1), t1);
  OK('1 total 350, a cuenta 350, saldo 0', r1.total === 350 && r1.acuenta === 350 && r1.saldo === 0, [r1.total, r1.acuenta, r1.saldo]);
  OK('1 queda un cobro de hoy por QR 250', (r1.cobrosPosteriores || []).length === 1 && r1.cobrosPosteriores[0].fecha === hoy && r1.cobrosPosteriores[0].metodo === 'QR' && r1.cobrosPosteriores[0].monto === 250, r1.cobrosPosteriores);
  OK('1 desglose: Efectivo 100 + QR 250', JSON.stringify(w.agruparPagos(r1.pagos)) === JSON.stringify([{ metodo: 'Efectivo', monto: 100 }, { metodo: 'QR', monto: 250 }]), r1.pagos);
  OK('1 la caja de ayer no cambia', caja(A, ayer) === cajaAyer0, [cajaAyer0, caja(A, ayer)]);
  OK('1 la caja de hoy suma 250', caja(A, hoy) === cajaHoy0 + 250, [cajaHoy0, caja(A, hoy)]);
  OK('1 el servidor tiene lo mismo', srv(c.id) && srv(c.id).acuenta === 350 && (srv(c.id).cobrosPosteriores || []).length === 1, srv(c.id) && [srv(c.id).acuenta, (srv(c.id).cobrosPosteriores || []).length]);
  OK('1 Corregir cobro sigue viendo lo del día de la atención (100)', w.partesCobro(r1).inicial === 100, w.partesCobro(r1).inicial);

  // 2 bajar lo cobrado sigue bloqueado
  const t2 = await editar(A, c.id, { acuenta: 300, metodo: 'Mixto', mixto: { Efectivo: 100, QR: 200 } });
  OK('2 bajar "A cuenta": bloqueado', /no se baja/.test(t2) && reg(c.id).acuenta === 350, t2);

  // 3 mixto: lo que estaba queda igual y se suma tarjeta
  const d = (await nueva(A, { pac: 'Paciente Mixto', total: 100, acuenta: 100, metodo: 'Efectivo', fecha: ayer })).r;
  const t3 = await editar(A, d.id, { srv: 'Limpieza dental', precio: 200, acuenta: 300, metodo: 'Mixto', mixto: { Efectivo: 100, Tarjeta: 200 } });
  const r3 = reg(d.id);
  OK('3 mixto: cobro de hoy en Tarjeta 200', /registrado hoy/.test(t3) && r3.cobrosPosteriores.length === 1 && r3.cobrosPosteriores[0].metodo === 'Tarjeta' && r3.cobrosPosteriores[0].monto === 200, [t3, r3.cobrosPosteriores]);
  // 4 mixto que en realidad cambia lo anterior: bloqueado
  const e = (await nueva(A, { pac: 'Paciente Cambia', total: 100, acuenta: 100, metodo: 'Efectivo', fecha: ayer })).r;
  const t4 = await editar(A, e.id, { srv: 'Limpieza dental', precio: 200, acuenta: 300, metodo: 'Mixto', mixto: { Efectivo: 50, QR: 250 } });
  OK('4 mixto que baja el efectivo de ayer: bloqueado', /no se baja/.test(t4) && reg(e.id).acuenta === 100 && !(reg(e.id).cobrosPosteriores || []).length, t4);

  // 5 una atención con saldo: pagar lo que debía al editar también entra hoy
  const f = (await nueva(A, { pac: 'Paciente Debe', total: 300, acuenta: 100, metodo: 'Efectivo', fecha: ayer })).r;
  const t5 = await editar(A, f.id, { acuenta: 300, metodo: 'Efectivo' });
  const r5 = reg(f.id);
  OK('5 completar el pago al editar: entra hoy, saldo 0', /Bs 200 registrado hoy/.test(t5) && r5.saldo === 0 && r5.cobrosPosteriores[0].fecha === hoy, [t5, r5.saldo]);

  // 6 la doctora, con su paciente
  A.w.CFG.clavesProf = { 'Dra. Brenda': sha('brenda-edit') }; A.w.saveCfg(true); await A.tick(30);
  const g = (await nueva(A, { pac: 'Paciente De Brenda', total: 100, acuenta: 100, metodo: 'Efectivo', fecha: ayer, prof: 'Dra. Brenda' })).r;
  const D = await abrir({ server }); await entrar(D, 'brenda-edit'); await D.w.pullServer(); await D.tick(700);
  const t6 = await editar(D, g.id, { srv: 'Limpieza dental', precio: 250, acuenta: 350, metodo: 'QR' });
  const s6 = srv(g.id);
  OK('6 la doctora lo hace y el servidor lo guarda', /registrado hoy/.test(t6) && s6 && s6.acuenta === 350 && (s6.cobrosPosteriores || []).length === 1, [t6, s6 && s6.acuenta]);
  // 7 otro equipo ve la misma caja
  const B = await abrir({ server }); await entrar(B, FAB.equipo); await B.w.pullServer(); await B.tick(80);
  OK('7 otro equipo ve la misma caja de hoy y de ayer', caja(B, hoy) === caja(A, hoy) + 250 || caja(B, hoy) === caja(D, hoy), [caja(B, hoy), caja(A, hoy), caja(D, hoy)]);
  OK('7 otro equipo ve la misma caja de ayer', caja(B, ayer) === caja(D, ayer), [caja(B, ayer), caja(D, ayer)]);
  R('errores', [A.errors.slice(0, 3), D.errors.slice(0, 3), B.errors.slice(0, 3)]);
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
