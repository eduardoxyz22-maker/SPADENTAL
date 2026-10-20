/* Auditoría del 20/10 (Astra), B1 y B2: el saldo a favor en el servidor va por
   bolsillos, como en el panel. Lo pagado a un plan es de ese plan; una atención
   de un plan usa lo de su plan más lo general; una suelta, solo lo general.
   Dos pantallas desactualizadas no pueden gastar dos veces el mismo adelanto,
   tampoco cuando la misma cita la atienden dos doctoras. .gs real en memoria,
   datos ficticios, sin red. */
const { gsServer } = require('./gsserver.js');
const path = require('path');
const SPA = process.env.PANEL === 'spa';
const GS = path.join(__dirname, '..', '..', SPA ? 'google-apps-script-pacientes.gs' : 'cosmetic/google-apps-script-pacientes.gs');
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(66), x === undefined ? '' : JSON.stringify(x)); };
const clone = x => JSON.parse(JSON.stringify(x));
const row = (id, pac, amount, opts) => Object.assign({ id, fecha: '2026-10-20', hora: '10:00', profesional: 'Dra. Mirna', paciente: pac, estado: 'Atendido',
  servicios: [{ nom: 'Sesion ficticia', cant: 1, precio: amount }], total: amount, acuenta: amount, saldo: 0, metodo: 'Saldo a favor',
  pagos: [{ metodo: 'Saldo a favor', monto: amount }], cobrosPosteriores: [], cobroInicialFechado: true }, opts || {});
const advance = (id, pac, amount, planId) => row(id, pac, amount, { estado: 'Anticipo', total: 0, servicios: [], planId: planId || '', metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: amount }] });
const plan = (id, price, n) => ({ id, nombre: 'Plan ficticio ' + id, fecha: '2026-10-20', estado: 'activo', prof: 'Dra. Mirna', total: price * (n || 2),
  sesiones: Array.from({ length: n || 2 }, (_, i) => ({ n: i + 1, desc: 'Sesion ' + (i + 1), precio: price })), cuotas: [], notas: '' });
const save = (s, r, base, token) => { const b = { action: 'save', registro: clone(r) }; if (base !== undefined) b.base = clone(base); if (token) b.token = token; return s.handle(b, token ? { panel: true } : undefined); };
const list = s => s.handle({ action: 'list' }).registros;
const usado = rows => rows.reduce((a, r) => a + (r.pagos || []).filter(p => p.metodo === 'Saldo a favor').reduce((b, p) => b + p.monto, 0), 0);
console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');

/* control positivo: un solo bolsillo general, dos pantallas que vieron los mismos 100 */
{
  const s = gsServer(GS), pac = 'Prueba saldo unico'; save(s, advance('ant', pac, 100));
  const a = save(s, row('at1', pac, 100), null), b = save(s, row('at2', pac, 100), null);
  OK('A general 100: la 1ra atención lo usa; la 2da queda debiendo 100', a.ok && a.registro.acuenta === 100 && b.ok && b.ajusteFavor === 100 && b.registro.saldo === 100 && usado(list(s)) === 100, [a.ajusteFavor, b.ajusteFavor, b.registro.saldo]);
  const c = save(s, row('at2', pac, 100), null);
  OK('A el reintento no gasta de nuevo', c.ok && c.registro.saldo === 100 && usado(list(s)) === 100 && s.ctx.creditoPacienteSrv(s.ctx.fClavePac(pac)) === 0);
}
/* B1: dos planes con 100 adelantados cada uno; dos pantallas mandan dos sesiones del plan A */
{
  const s = gsServer(GS), pac = 'Prueba dos planes', A = plan('plan-A', 100), B = plan('plan-B', 100, 1);
  OK('B1 ficha con los dos planes', s.handle({ action: 'pac', registro: { nombre: pac, med: {}, planes: [A, B] } }).ok);
  save(s, advance('ant-A', pac, 100, A.id)); save(s, advance('ant-B', pac, 100, B.id));
  const c0 = s.ctx.creditosSrv(s.ctx.fClavePac(pac));
  OK('B1 el servidor ve los bolsillos: A 100, B 100, general 0', c0.general === 0 && c0.planes['plan-A'] === 100 && c0.planes['plan-B'] === 100, c0);
  const r1 = save(s, row('at-A-1', pac, 100, { planId: A.id, planEtapa: 1 }), null);
  const r2 = save(s, row('at-A-2', pac, 100, { planId: A.id, planEtapa: 2 }), null);
  OK('B1 la 1ra sesión de A usa los 100 de A', r1.ok && r1.registro.acuenta === 100 && r1.registro.saldo === 0 && !r1.ajusteFavor, r1.ajusteFavor);
  OK('B1 la 2da sesión de A NO puede usar lo de B: queda debiendo 100', r2.ok && r2.ajusteFavor === 100 && r2.registro.saldo === 100 && r2.registro.acuenta === 0, [r2.ajusteFavor, r2.registro.saldo]);
  const r3 = save(s, row('at-B-1', pac, 100, { planId: B.id, planEtapa: 1 }), null);
  OK('B1 B conserva sus 100: su sesión queda pagada', r3.ok && !r3.ajusteFavor && r3.registro.saldo === 0 && r3.registro.acuenta === 100, [r3.ajusteFavor, r3.registro.saldo]);
  const c1 = s.ctx.creditosSrv(s.ctx.fClavePac(pac));
  OK('B1 nada queda negativo', c1.general === 0 && c1.planes['plan-A'] === 0 && c1.planes['plan-B'] === 0 && usado(list(s)) === 200, c1);
  /* una atención suelta no toca lo de un plan */
  const s2 = gsServer(GS), pac2 = 'Prueba plan y suelta'; s2.handle({ action: 'pac', registro: { nombre: pac2, med: {}, planes: [plan('plan-C', 100)] } });
  save(s2, advance('ant-C', pac2, 100, 'plan-C')); save(s2, advance('ant-G', pac2, 40));
  const r4 = save(s2, row('suelta', pac2, 100), null);
  OK('B1 una visita suelta usa solo lo general (40): debe 60', r4.ok && r4.ajusteFavor === 60 && r4.registro.saldo === 60, [r4.ajusteFavor, r4.registro.saldo]);
  const r5 = save(s2, row('ses-C', pac2, 100, { planId: 'plan-C', planEtapa: 1 }), null);
  OK('B1 y la sesión del plan C sigue teniendo sus 100', r5.ok && !r5.ajusteFavor && r5.registro.saldo === 0, [r5.ajusteFavor, r5.registro.saldo]);
  /* lo que pasa del presupuesto del plan queda libre, como en el panel */
  const s3 = gsServer(GS), pac3 = 'Prueba excedente'; s3.handle({ action: 'pac', registro: { nombre: pac3, med: {}, planes: [plan('plan-D', 100, 1)] } });
  save(s3, advance('ant-D', pac3, 150, 'plan-D'));
  const c3 = s3.ctx.creditosSrv(s3.ctx.fClavePac(pac3));
  OK('B1 adelantó 150 a un plan de 100: 100 del plan y 50 libres', c3.planes['plan-D'] === 100 && c3.general === 50, c3);
}
/* B2: la misma cita la atienden dos doctoras (se separa en dos visitas): no pueden gastar dos veces el mismo adelanto */
{
  const s = gsServer(GS), pac = 'Prueba cita compartida'; save(s, advance('ant', pac, 100));
  const v = s.ctx.leerVerif(); v.prof = { 'Dra. Mirna': 'a'.repeat(64), 'Dra. Shirley': 'b'.repeat(64) }; s.ctx.guardarVerif(v);
  const tok = prof => s.ctx.nuevaSesion({ rol: 'doctora', prof, h: v.prof[prof], fabrica: false });
  const cita = save(s, row('cita', pac, 0, { profesional: 'Por definir', estado: 'Agendada', servicios: [], pagos: [], metodo: '' }), null).registro;
  const m = row('cita', pac, 100, { profesional: 'Dra. Mirna' }), sh = row('cita', pac, 100, { profesional: 'Dra. Shirley' });
  const first = save(s, m, cita, tok('Dra. Mirna')), second = save(s, sh, cita, tok('Dra. Shirley'));
  OK('B2 la 1ra doctora usa los 100', first.ok && first.registro.acuenta === 100 && first.registro.saldo === 0);
  OK('B2 la 2da queda como visita aparte, pero debiendo 100 (no hay más adelanto)', second.ok && second.separada && second.separada.saldo === 100 && second.separada.acuenta === 0 && second.ajusteFavor === 100, [second.ajusteFavor, second.separada && second.separada.saldo]);
  OK('B2 el adelanto no queda negativo', usado(list(s)) === 100 && s.ctx.creditoPacienteSrv(s.ctx.fClavePac(pac)) === 0, s.ctx.creditoPacienteSrv(s.ctx.fClavePac(pac)));
  const retry = save(s, sh, cita, tok('Dra. Shirley'));
  OK('B2 el reintento no crea otra visita ni gasta más', retry.ok && list(s).length === 3 && usado(list(s)) === 100, list(s).length);
}
console.log(fallas ? 'FALLAS: ' + fallas : 'TODO OK');
process.exit(fallas ? 1 : 0);
