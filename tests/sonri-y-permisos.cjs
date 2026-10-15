'use strict';
/* Sonri y permisos del servidor (auditoría del 15/10). Sin red ni navegador:
   el Apps Script REAL corre en memoria con sesiones de prueba, y el código de
   Sonri se carga del HTML real con un DOM mínimo. Solo datos ficticios.
   Ejecutar desde la raíz: node tests/sonri-y-permisos.cjs */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const { gsServer } = require('./apps-script-en-memoria.cjs');
let count = 0; const evidence = [];
function check(name, fn) { fn(); count++; evidence.push(name); }
const raiz = path.join(__dirname, '..');

/* ---------------- servidor: permisos por rol y por clínica ---------------- */
for (const [file, mia, otra] of [['google-apps-script-pacientes.gs', 'spadental', 'cosmetic'], ['cosmetic/google-apps-script-pacientes.gs', 'cosmetic', 'spadental']]) {
  const s = gsServer(path.join(raiz, file)); s.shimClaves = false; s.sesionDirecta = false;
  const v = s.ctx.leerVerif(); v.admin = s.ctx.shaHex('t-duena'); v.prof = { 'Dra. A': s.ctx.shaHex('t-a'), 'Dra. B': s.ctx.shaHex('t-b') }; s.ctx.guardarVerif(v);
  const tok = k => s.handle({ action: 'login', clave: k }).token;
  const TD = tok('t-duena'), TA = tok('t-a'), TB = tok('t-b');
  const H = (t, b) => s.handle(Object.assign({ token: t }, b));
  let n = 0; const at = o => Object.assign({ id: 'R' + (++n), clinicaId: mia, ts: '2026-10-10T10:00:00Z', fecha: '2026-10-10', hora: '10:00', estado: 'Atendido', servicios: [{ nom: 'Consulta', cant: 1, precio: 100 }], total: 100, acuenta: 100, saldo: 0, metodo: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 100 }] }, o);
  const ficha = nombre => (H(TD, { action: 'list' }).pacientes || []).find(p => p.nombre === nombre);
  H(TD, { action: 'save', registro: at({ paciente: 'Paciente De A', profesional: 'Dra. A' }), base: null });
  H(TD, { action: 'save', registro: at({ paciente: 'Paciente Compartido', profesional: 'Dra. A' }), base: null });
  H(TD, { action: 'save', registro: at({ paciente: 'Paciente Compartido', profesional: 'Dra. B' }), base: null });
  H(TD, { action: 'pac', registro: { nombre: 'Paciente De A', med: { alergias: 'Penicilina' }, planes: [] }, base: null });
  H(TD, { action: 'pac', registro: { nombre: 'Paciente Compartido', med: {}, planes: [{ id: 'PA', prof: 'Dra. A', nombre: 'Ortodoncia de A', total: 5000, estado: 'activo', sesiones: [{ n: 1, desc: 'Control 1' }], cuotas: [] }] }, base: null });
  H(TD, { action: 'egreso', registro: { id: 'E1', clinicaId: mia, fecha: '2026-10-10', monto: 50, concepto: 'Insumos' }, base: null });
  check(file + ': sin sesión no se lee nada', () => assert.equal(s.handle({ action: 'list' }).error, 'sin_sesion'));
  check(file + ': los egresos no se le mandan a una doctora', () => { assert.equal(H(TD, { action: 'list' }).egresos.length, 1); assert.equal(H(TB, { action: 'list' }).egresos.length, 0); });
  check(file + ': una doctora no toca la ficha de un paciente de otra', () => { const r = H(TB, { action: 'pac', registro: { nombre: 'Paciente De A', med: {}, planes: [] }, base: null }); assert.equal(r.error, 'sin_permiso'); assert.match(JSON.stringify(ficha('Paciente De A').med), /Penicilina/); });
  check(file + ': la doctora del paciente sí toca su ficha', () => assert.equal(H(TA, { action: 'pac', registro: { nombre: 'Paciente De A', med: { alergias: 'Penicilina, látex' }, planes: [] }, base: null }).ok, true));
  check(file + ': un paciente nuevo, sin visitas, lo carga cualquiera', () => assert.equal(H(TB, { action: 'pac', registro: { nombre: 'Paciente Nuevo', med: {}, planes: [] }, base: null }).ok, true));
  check(file + ': en un paciente compartido el plan de otra doctora no se cambia, no se borra ni se falsifica', () => {
    const base = ficha('Paciente Compartido'), t = JSON.parse(JSON.stringify(base));
    t.planes = [Object.assign({}, t.planes[0], { total: 1, nombre: 'Cambiado', sesiones: [{ n: 1, desc: 'Control 1', hecha: true, fecha: '2026-10-15', atencionId: 'R3' }] }),
      { id: 'PB', prof: 'Dra. B', nombre: 'De B', total: 800, estado: 'activo', sesiones: [], cuotas: [] }, { id: 'PX', prof: 'Dra. A', nombre: 'Falso', total: 9, sesiones: [], cuotas: [] }];
    assert.equal(H(TB, { action: 'pac', registro: t, base }).ok, true);
    const f = ficha('Paciente Compartido'), pa = f.planes.find(p => p.id === 'PA');
    assert.equal(pa.nombre, 'Ortodoncia de A'); assert.equal(pa.total, 5000); assert.equal(pa.sesiones[0].hecha, true);
    assert.ok(f.planes.find(p => p.id === 'PB')); assert.ok(!f.planes.find(p => p.id === 'PX'));
    const sinA = JSON.parse(JSON.stringify(f)); sinA.planes = sinA.planes.filter(p => p.id !== 'PA');
    H(TB, { action: 'pac', registro: sinA, base: f }); assert.ok(ficha('Paciente Compartido').planes.find(p => p.id === 'PA'));
  });
  check(file + ': la doctora dueña sí cambia su plan', () => { const f = ficha('Paciente Compartido'), t = JSON.parse(JSON.stringify(f)); t.planes.find(p => p.id === 'PA').total = 5200; H(TA, { action: 'pac', registro: t, base: f }); assert.equal(ficha('Paciente Compartido').planes.find(p => p.id === 'PA').total, 5200); });
  check(file + ': una doctora no edita la atención de otra', () => assert.equal(H(TB, { action: 'save', registro: at({ id: 'R1', paciente: 'Paciente De A', profesional: 'Dra. A', obs: 'x' }), base: null }).error, 'sin_permiso'));
  check(file + ': un registro de la otra clínica se rechaza (uno, en lote y en fichas)', () => {
    assert.equal(H(TD, { action: 'save', registro: at({ paciente: 'Cruzado', profesional: 'Dra. A', clinicaId: otra }), base: null }).error, 'otra_clinica');
    assert.equal(H(TD, { action: 'bulk', registros: [at({ paciente: 'L1', profesional: 'Dra. A' }), at({ paciente: 'L2', profesional: 'Dra. A', clinicaId: otra })] }).error, 'otra_clinica');
    assert.equal(H(TD, { action: 'pac', registro: { nombre: 'X', clinicaId: otra, planes: [] }, base: null }).error, 'otra_clinica');
    assert.ok(!H(TD, { action: 'list' }).registros.some(r => /Cruzado|^L[12]$/.test(r.paciente)));
  });
  check(file + ': lo viejo sin etiqueta de clínica se sigue aceptando', () => { const r = at({ paciente: 'Viejo', profesional: 'Dra. A' }); delete r.clinicaId; assert.equal(H(TD, { action: 'save', registro: r, base: null }).ok, true); });
}

/* ---------------- Sonri: el código real del HTML con un DOM mínimo ---------------- */
const MARCA = '/* =====================================================================\n   🦷 SONRI', FIN = '/* ===== fin de Sonri ===== */';
const bloque = f => { const s = fs.readFileSync(path.join(raiz, f), 'utf8'), a = s.indexOf(MARCA); return s.slice(a, s.indexOf(FIN, a)); };
check('Sonri es idéntico en los dos paneles', () => assert.equal(bloque('pacientes.html'), bloque('cosmetic/pacientes.html')));
for (const file of ['pacientes.html', 'cosmetic/pacientes.html']) {
  const html = fs.readFileSync(path.join(raiz, file), 'utf8'), nodes = new Map(), store = new Map();
  const el = s => { if (!nodes.has(s)) nodes.set(s, { value: '', hidden: true, innerHTML: '', textContent: '', style: {}, dataset: {}, options: [], classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } }, addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; } }); return nodes.get(s); };
  const ls = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const c = { console, localStorage: ls, sessionStorage: ls, document: { querySelector: el, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, body: { classList: { add() {}, remove() {}, contains() { return false; } }, appendChild() {} }, createElement: () => el('nuevo' + Math.random()) },
    window: { ASIS_PRUEBA: true, print() {}, scrollTo() {} }, navigator: { userAgent: 'node' }, location: {}, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, confirm: () => true, alert() {}, fetch: async () => ({ json: async () => ({ ok: true }) }) };
  vm.createContext(c, { codeGeneration: { strings: false, wasm: false } });
  let code = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  code = code.slice(0, code.lastIndexOf('(function init(){'));
  vm.runInContext(code, c, { timeout: 5000 }); vm.runInContext(bloque(file), c, { timeout: 5000 });
  c.CFG = c.loadCfg(); c.DATA = []; c.PAC = {}; c.EGR = []; c.toast = () => {}; c.closeModal = () => {};
  vm.runInContext('ASIS.montado=true; asisRefrescar=function(){}; esAdmin=function(){return ROL==="admin"||ROL==="equipo"}', c);
  const q = t => c.asisBuscar(t).map(i => c.ASIS_AYUDA[i].q);
  check(file + ': Sonri entiende un error de tipeo', () => assert.match(q('reprogarmar')[0], /reprogramar/));
  check(file + ': Sonri no inventa respuestas', () => assert.equal(q('zzzqqq wwwkkk').length, 0));
  check(file + ': a una doctora no le muestra la ayuda de Caja', () => { vm.runInContext('ROL="doctora";PROF_ACTUAL="Dra. A"', c); assert.ok(!q('caja').some(x => /caja del día/.test(x))); vm.runInContext('ROL="admin";PROF_ACTUAL=""', c); assert.ok(q('caja').some(x => /caja del día/.test(x))); });
  check(file + ': los avisos al guardar son solo de quien los generó', () => {
    vm.runInContext('ROL="doctora";PROF_ACTUAL="Dra. A"', c);
    c.asisAlGuardar({ id: 'A1', estado: 'Atendido', saldo: 200, paciente: 'Rosa Ficticia', servicios: [] });
    assert.ok(c.asisAvisos().some(a => /Rosa quedó debiendo/.test(a.t)));
    vm.runInContext('PROF_ACTUAL="Dra. B"', c); assert.ok(!c.asisAvisos().some(a => a.tm));
    vm.runInContext('ROL="admin";PROF_ACTUAL=""', c); assert.ok(!c.asisAvisos().some(a => a.tm));
  });
  check(file + ': al cerrar sesión Sonri olvida todo lo del usuario anterior', () => {
    vm.runInContext('ROL="doctora";PROF_ACTUAL="Dra. A"', c);
    c.asisAlGuardar({ id: 'A2', estado: 'Atendido', saldo: 50, paciente: 'Otra Ficticia', servicios: [] });
    c.asisOlvidar(); assert.equal(vm.runInContext('ASIS.alGuardar.length', c), 0); assert.ok(!c.asisAvisos().some(a => a.tm));
  });
  check(file + ': tocar dos veces la respuesta del plan guarda una sola vez', () => {
    let n = 0; c.submitAtencion = () => { n++; }; vm.runInContext('ASIS.planResp=""', c);
    el('#f-paciente').value = 'Alguien'; el('#f-fecha').value = '2026-10-15';
    c.asisRespuestaPlan(''); c.asisRespuestaPlan(''); assert.equal(n, 1);
  });
  check(file + ': el pie dice lo que hace de verdad', () => { assert.ok(/Solo se guarda lo que vos confirmás/.test(bloque(file))); assert.ok(!/no cambio nada/.test(bloque(file))); });
}
console.log(JSON.stringify({ passed: count, networkRequests: 0, evidence }, null, 2));
