'use strict';
/* s15: hallazgos de la auditoría del 15/10 en el servidor. .gs real en memoria, sesiones de prueba, sin red. */
const { gsServer } = require('./gsserver.js');
const SPA = process.env.PANEL === 'spa';
const GS = process.env.GSFILE || (SPA ? require('path').join(__dirname,'..','..','google-apps-script-pacientes.gs') : require('path').join(__dirname,'..','..','cosmetic/google-apps-script-pacientes.gs'));
const MIA = SPA ? 'spadental' : 'cosmetic', OTRA = SPA ? 'cosmetic' : 'spadental';
let fallas = 0; const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(66), x === undefined ? '' : JSON.stringify(x)); };
const s = gsServer(GS); s.shimClaves = false; s.sesionDirecta = false;
const v = s.ctx.leerVerif(); v.admin = s.ctx.shaHex('t-duena'); v.prof = { 'Dra. A': s.ctx.shaHex('t-a'), 'Dra. B': s.ctx.shaHex('t-b') }; s.ctx.guardarVerif(v);
const tok = k => { const r = s.handle({ action: 'login', clave: k }); if (!r.ok) throw new Error('login ' + k + ' ' + JSON.stringify(r)); return r.token; };
const TD = tok('t-duena'), TA = tok('t-a'), TB = tok('t-b');
const H = (t, b) => s.handle(Object.assign({ token: t }, b));
let n = 0; const at = (o) => Object.assign({ id: 'R' + (++n), clinicaId: MIA, ts: new Date().toISOString(), fecha: '2026-10-10', hora: '10:00', estado: 'Atendido', servicios: [{ nom: 'Consulta', cant: 1, precio: 100 }], total: 100, acuenta: 100, saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 100 }] }, o);
// datos sintéticos
OK('0 dueña guarda atenciones de A, de B y de un paciente compartido', [
  H(TD, { action: 'save', registro: at({ paciente: 'Paciente De A', profesional: 'Dra. A' }), base: null }),
  H(TD, { action: 'save', registro: at({ paciente: 'Paciente De B', profesional: 'Dra. B' }), base: null }),
  H(TD, { action: 'save', registro: at({ paciente: 'Paciente Compartido', profesional: 'Dra. A' }), base: null }),
  H(TD, { action: 'save', registro: at({ paciente: 'Paciente Compartido', profesional: 'Dra. B' }), base: null })].every(r => r.ok));
const planA = { id: 'PA', prof: 'Dra. A', nombre: 'Ortodoncia de A', total: 5000, estado: 'activo', sesiones: [{ n: 1, desc: 'Control 1', hecha: false }, { n: 2, desc: 'Control 2', hecha: false }], cuotas: [] };
OK('0 dueña guarda la ficha con el plan de A', H(TD, { action: 'pac', registro: { nombre: 'Paciente Compartido', med: { alergias: '' }, planes: [planA] }, base: null }).ok);
OK('0 dueña guarda la ficha de A', H(TD, { action: 'pac', registro: { nombre: 'Paciente De A', med: { alergias: 'Penicilina' }, planes: [] }, base: null }).ok);
OK('0 dueña guarda un egreso', H(TD, { action: 'egreso', registro: { id: 'E1', clinicaId: MIA, fecha: '2026-10-10', monto: 50, concepto: 'Insumos' }, base: null }).ok);
// lectura: egresos
const lD = H(TD, { action: 'list' }), lB = H(TB, { action: 'list' });
OK('1 la dueña recibe los egresos', (lD.egresos || []).length === 1, (lD.egresos || []).length);
OK('1 una doctora no recibe los egresos', lB.ok && (lB.egresos || []).length === 0, (lB.egresos || []).length);
// ficha de un paciente ajeno
const r2 = H(TB, { action: 'pac', registro: { nombre: 'Paciente De A', med: { alergias: '' }, planes: [] }, base: null });
OK('2 Dra. B no puede tocar la ficha de un paciente de A', !r2.ok && r2.error === 'sin_permiso', r2);
const fichaA = () => (H(TD, { action: 'list' }).pacientes || []).find(p => p.nombre === 'Paciente De A');
OK('2 la alergia del paciente de A sigue igual', /Penicilina/.test(JSON.stringify(fichaA().med)));
OK('3 Dra. A sí puede tocar la de su paciente', H(TA, { action: 'pac', registro: { nombre: 'Paciente De A', med: { alergias: 'Penicilina, látex' }, planes: [] }, base: null }).ok);
OK('4 un paciente nuevo, sin visitas, lo puede cargar cualquiera', H(TB, { action: 'pac', registro: { nombre: 'Paciente Nuevo', med: { alergias: '' }, planes: [] }, base: null }).ok);
// paciente compartido: el plan de A no lo cambia B
const base = (H(TD, { action: 'list' }).pacientes || []).find(p => p.nombre === 'Paciente Compartido');
const tocado = JSON.parse(JSON.stringify(base));
tocado.planes = tocado.planes.map(p => p.id === 'PA' ? Object.assign({}, p, { total: 1, nombre: 'Cambiado por B', sesiones: [{ n: 1, desc: 'Control 1', hecha: true, fecha: '2026-10-15', atencionId: 'R4' }, { n: 2, desc: 'Control 2', hecha: false }] }) : p);
tocado.planes.push({ id: 'PB', prof: 'Dra. B', nombre: 'Blanqueamiento de B', total: 800, estado: 'activo', sesiones: [{ n: 1, desc: 'Sesión', hecha: false }], cuotas: [] });
tocado.planes.push({ id: 'PX', prof: 'Dra. A', nombre: 'Plan falso a nombre de A', total: 9, estado: 'activo', sesiones: [], cuotas: [] });
const r5 = H(TB, { action: 'pac', registro: tocado, base });
const fc = (H(TD, { action: 'list' }).pacientes || []).find(p => p.nombre === 'Paciente Compartido');
const pa = fc.planes.find(p => p.id === 'PA'), pb = fc.planes.find(p => p.id === 'PB');
OK('5 paciente compartido: B guarda su ficha', r5.ok, r5.error);
OK('5 el plan de A conserva su nombre y su total', pa && pa.nombre === 'Ortodoncia de A' && pa.total === 5000, pa && [pa.nombre, pa.total]);
OK('5 la etapa que B atendió en reemplazo sí queda marcada', pa && pa.sesiones[0].hecha === true && pa.sesiones[0].atencionId === 'R4');
OK('5 el plan propio de B se guarda', !!pb);
OK('5 no se crean planes a nombre de A', !fc.planes.some(p => p.id === 'PX'));
const sinA = JSON.parse(JSON.stringify(fc)); sinA.planes = sinA.planes.filter(p => p.id !== 'PA');
H(TB, { action: 'pac', registro: sinA, base: fc });
OK('5 B no puede borrar el plan de A', !!(H(TD, { action: 'list' }).pacientes || []).find(p => p.nombre === 'Paciente Compartido').planes.find(p => p.id === 'PA'));
const fa = (H(TD, { action: 'list' }).pacientes || []).find(p => p.nombre === 'Paciente Compartido');
const conA = JSON.parse(JSON.stringify(fa)); conA.planes = conA.planes.map(p => p.id === 'PA' ? Object.assign({}, p, { total: 5200 }) : p);
H(TA, { action: 'pac', registro: conA, base: fa });
OK('5 A sí puede cambiar su plan', (H(TD, { action: 'list' }).pacientes || []).find(p => p.nombre === 'Paciente Compartido').planes.find(p => p.id === 'PA').total === 5200);
OK('5 la dueña puede tocar cualquier ficha', H(TD, { action: 'pac', registro: { nombre: 'Paciente De B', med: { alergias: 'Ninguna' }, planes: [] }, base: null }).ok);
// clínica
const r6 = H(TD, { action: 'save', registro: at({ paciente: 'Cruzado', profesional: 'Dra. A', clinicaId: OTRA }), base: null });
OK('6 un registro de la otra clínica se rechaza', !r6.ok && r6.error === 'otra_clinica', r6);
OK('6 no quedó guardado', !(H(TD, { action: 'list' }).registros || []).some(r => r.paciente === 'Cruzado'));
OK('6 uno sin etiqueta (viejo) se acepta', H(TD, { action: 'save', registro: (() => { const r = at({ paciente: 'Viejo Sin Etiqueta', profesional: 'Dra. A' }); delete r.clinicaId; return r; })(), base: null }).ok);
const r7 = H(TD, { action: 'bulk', registros: [at({ paciente: 'Bulk 1', profesional: 'Dra. A' }), at({ paciente: 'Bulk 2', profesional: 'Dra. A', clinicaId: OTRA })] });
OK('7 una carga en lote con un registro de la otra clínica se rechaza entera', !r7.ok && r7.error === 'otra_clinica', r7);
OK('7 ficha de la otra clínica se rechaza', H(TD, { action: 'pac', registro: { nombre: 'X', clinicaId: OTRA, planes: [] }, base: null }).error === 'otra_clinica');
console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK');
process.exit(fallas ? 1 : 0);
