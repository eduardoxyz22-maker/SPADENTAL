'use strict';
/* El Apps Script REAL corriendo contra una planilla simulada en memoria.
   Expone la misma interfaz que el servidor falso del arnés (registros,
   pacientes, egresos, cfg, handle, log, calls) para que los repros corran
   sin cambios contra el código que se va a pegar en Google. */
const fs = require('fs'), vm = require('vm');
function gsServer(file) {
  const st = {};
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
  const cacheMem = {}, ahora = () => (st && st.reloj ? st.reloj() : Date.now());
  const cacheObj = { get: k => { const e = cacheMem[k]; if (!e || e.exp < ahora()) return null; return e.v; },
    put: (k, v, ttl) => { cacheMem[k] = { v: String(v), exp: ahora() + (ttl || 600) * 1000 }; }, remove: k => { delete cacheMem[k]; } };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss, create: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => Array.from(require('crypto').createHash('sha256').update(String(s), 'utf8').digest()).map(x => x > 127 ? x - 256 : x),
      getUuid: () => require('crypto').randomUUID() },
    CacheService: { getScriptCache: () => cacheObj },
    Session: { getScriptTimeZone: () => 'America/La_Paz' },
    Logger: { log() {} }, JSON, Object, String, Number, Math, isNaN
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  st.log = []; st.offline = false; st.latency = 0;
  st.handle = function (body, opts) {
    /* SOLO PRUEBAS: los repros viejos siembran datos llamando al servidor
       directo, sin panel ni sesión. Esas llamadas directas usan una sesión de
       la dueña creada acá; lo que manda el panel (opts.panel) pasa sin ayuda. */
    if (!(opts && opts.panel) && st.sesionDirecta !== false && body && !body.token && ctx.nuevaSesion &&
        ['info', 'login', 'cfgGet'].indexOf(body.action) < 0) {
      body = JSON.parse(JSON.stringify(body));
      body.token = ctx.nuevaSesion({ rol: 'admin', prof: '', h: ctx.leerVerif().admin, fabrica: false });
    }
    st.log.push({ action: body.action, body: JSON.parse(JSON.stringify(body)) });
    if (st.respuestaForzada && st.respuestaForzada(body)) return st.respuestaForzada(body);
    /* SOLO PRUEBAS: los repros viejos cargan claves escribiéndolas en la config.
       Con el servidor v6 eso se hace por la acción "clave"; acá se copian igual
       que si la dueña las hubiera puesto en Ajustes, para poder reusarlos. */
    if (body.action === 'cfg') shim(body.cfg);
    return JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).t);
  };
  st.calls = a => st.log.filter(x => x.action === a);
  const lista = () => JSON.parse(JSON.stringify(ctx.doList()));
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
  /* SOLO PRUEBAS: los repros viejos cargan claves escribiéndolas en la config.
     Con el servidor v6 eso se hace por la acción "clave"; acá se copian igual
     que si la dueña las hubiera puesto en Ajustes, para poder reusarlos. */
  function shim(c) {
    if (st.shimClaves === false || !c || !ctx.leerVerif) return;
    const ok = h => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h);
    const g = ctx.leerCfg() || {};
    if (!ctx.PropertiesService.getScriptProperties().getProperty('VERIF_CLAVES') && !g.precios) {
      /* primera config: el servidor real la migraría así */
      const v0 = { admin: ok(c.adminHash) ? c.adminHash : ctx.ADMIN_FABRICA, equipo: ok(c.passHash) ? c.passHash : ctx.EQUIPO_FABRICA, prof: {} };
      ctx.guardarVerif(v0);
    }
    const v = ctx.leerVerif();
    if (c.clavesProf) for (const p in c.clavesProf) if (ok(c.clavesProf[p])) v.prof[p] = c.clavesProf[p];
    if (ok(c.adminHash)) v.admin = c.adminHash; if (ok(c.passHash)) v.equipo = c.passHash;
    ctx.guardarVerif(v);
  }
  Object.defineProperty(st, 'cfg', { get: () => lista().cfg, set: c => { shim(c); ctx.doGuardarCfg(c); } });
  st.ctx = ctx; st.props = props; st.cacheMem = cacheMem;
  return st;
}
module.exports = { gsServer };
