'use strict';
/* El Apps Script REAL corriendo contra una planilla simulada en memoria.
   Expone la misma interfaz que el servidor falso del arnés (registros,
   pacientes, egresos, cfg, handle, log, calls) para que los repros corran
   sin cambios contra el código que se va a pegar en Google. */
const fs = require('fs'), vm = require('vm');
function gsServer(file) {
  const hojas = {};
  function hoja(nombre) {
    const rows = [];
    const sh = {
      _rows: rows, getName: () => nombre,
      getLastRow: () => rows.length,
      getLastColumn: () => rows.reduce((m, r) => Math.max(m, r.length), 0),
      getRange: (r, c, nr, nc) => {
        nr = nr || 1; nc = nc || 1;
        const rg = {
          getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = rows[r - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) { const v = row[c - 1 + j]; o.push(v === undefined ? '' : JSON.parse(JSON.stringify(v))); } out.push(o); } return out; },
          setValues: (v) => { for (let i = 0; i < nr; i++) { while (rows.length < r + i) rows.push([]); const row = rows[r - 1 + i]; for (let j = 0; j < nc; j++) row[c - 1 + j] = JSON.parse(JSON.stringify(v[i][j])); } return rg; },
          setFontWeight: () => rg, setBackground: () => rg, setFontColor: () => rg
        };
        return rg;
      },
      appendRow: (a) => { rows.push(JSON.parse(JSON.stringify(a))); },
      deleteRow: (i) => { rows.splice(i - 1, 1); },
      setFrozenRows: () => {}
    };
    return sh;
  }
  const ss = { getSheetByName: n => hojas[n] || null, insertSheet: n => (hojas[n] = hoja(n)), getName: () => 'Simulada', getUrl: () => 'about:blank', getId: () => 'x' };
  const props = {}; 
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss, create: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) }, Session: { getScriptTimeZone: () => 'America/La_Paz' },
    Logger: { log() {} }, JSON, Object, String, Number, Math, isNaN
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  const st = { log: [], offline: false, latency: 0 };
  st.handle = function (body) {
    st.log.push({ action: body.action, body: JSON.parse(JSON.stringify(body)) });
    if (st.respuestaForzada && st.respuestaForzada(body)) return st.respuestaForzada(body);
    return JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).t);
  };
  st.calls = a => st.log.filter(x => x.action === a);
  const lista = () => JSON.parse(ctx.doPost({ postData: { contents: '{"action":"list"}' } }).t);
  st.registros = new Proxy({}, {
    get: (_, id) => (lista().registros || []).filter(r => r.id === id)[0],
    set: (_, id, r) => { ctx.doSave(JSON.parse(JSON.stringify(r)), null); return true; },
    ownKeys: () => (lista().registros || []).map(r => r.id),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    has: (_, id) => (lista().registros || []).some(r => r.id === id)
  });
  // pacientes: por nombre en minúsculas (como el falso); escribir agrega una fila tal cual
  st.pacientes = new Proxy({}, {
    get: (_, k) => (lista().pacientes || []).filter(p => String(p.nombre).trim().toLowerCase() === k)[0],
    set: (_, k, p) => { const sh = ctx.getSheetPac(); sh.appendRow(ctx.filaDePaciente(JSON.parse(JSON.stringify(p)))); return true; },
    ownKeys: () => (lista().pacientes || []).map(p => String(p.nombre).trim().toLowerCase()),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
  });
  st.egresos = new Proxy({}, {
    get: (_, id) => (lista().egresos || []).filter(e => e.id === id)[0],
    set: (_, id, e) => { ctx.doGuardarEgreso(JSON.parse(JSON.stringify(e))); return true; },
    ownKeys: () => (lista().egresos || []).map(e => e.id),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
  });
  Object.defineProperty(st, 'cfg', { get: () => lista().cfg, set: c => { ctx.doGuardarCfg(c); } });
  st.ctx = ctx;
  return st;
}
module.exports = { gsServer };
