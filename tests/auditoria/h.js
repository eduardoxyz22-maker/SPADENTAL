/* Arnés jsdom para los paneles de pacientes (ES5, un solo archivo).
   - Servidor falso de Apps Script en window.fetch (guarda lo que recibe).
   - Captura de descargas (blob + nombre), print, confirm/prompt.
   - Utilidades DOM y un lector de .xlsx (zip "stored") para verificar celdas. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { JSDOM, VirtualConsole } = require('jsdom');
const { Blob } = require('buffer');
const { TextEncoder, TextDecoder } = require('util');

function fakeServerViejo() {
  const st = { registros: {}, pacientes: {}, egresos: {}, cfg: null, log: [], offline: false };
  st.handle = function (body) {
    const a = body.action;
    st.log.push({ action: a, body });
    if (a === 'save') { const r = body.registro; st.registros[r.id] = r; return { ok: true, registro: r }; }
    if (a === 'delete') { delete st.registros[body.registro.id]; return { ok: true }; }
    if (a === 'pac') { const p = body.registro; st.pacientes[String(p.nombre).trim().toLowerCase()] = p; return { ok: true }; }
    if (a === 'egreso') { const e = body.registro; st.egresos[e.id] = e; return { ok: true }; }
    if (a === 'egresoDel') { delete st.egresos[body.registro.id]; return { ok: true }; }
    if (a === 'cfg') { st.cfg = body.cfg; return { ok: true, ts: body.cfg && body.cfg.ts }; }
    if (a === 'cfgGet') return { ok: true, cfg: st.cfg };
    if (a === 'list') return { ok: true, registros: Object.values(st.registros), pacientes: Object.values(st.pacientes), egresos: Object.values(st.egresos), cfg: st.cfg };
    return { ok: false, error: 'accion_desconocida' };
  };
  st.calls = (a) => st.log.filter(x => x.action === a);
  return st;
}

function load(file, opts) {
  opts = opts || {};
  const html = fs.readFileSync(file, 'utf8');
  const server = opts.server || fakeServer();
  const api_ = {};
  if (opts.seed) { (opts.seed.registros||[]).forEach(r=>server.registros[r.id]=r); (opts.seed.pacientes||[]).forEach(p=>server.pacientes[String(p.nombre).trim().toLowerCase()]=p); (opts.seed.egresos||[]).forEach(e=>server.egresos[e.id]=e); if(opts.seed.cfg) server.cfg=opts.seed.cfg; }
  const netlog=[];
  const errors = [];
  const downloads = [];
  const prints = [];
  const dialogs = { confirm: [], prompt: [], alert: [], confirmAnswer: true, promptAnswer: 'x' };
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const m = String(e && e.message || e);
    if (/Not implemented: navigation|Not implemented: HTMLMediaElement/.test(m)) return;
    errors.push(m + (e && e.detail ? ' :: ' + (e.detail.stack || e.detail) : ''));
  });
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  const dom = new JSDOM(html, {
    url: opts.url || 'https://example.test/x/pacientes.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      if (opts.now) { const RD = window.Date; const off = new RD(opts.now).getTime() - RD.now(); const FD = function (...a) { if (!(this instanceof FD)) return new RD(RD.now()+off).toString(); return a.length ? new RD(...a) : new RD(RD.now() + off); }; FD.prototype = RD.prototype; FD.now = () => RD.now() + off; FD.UTC = RD.UTC; FD.parse = RD.parse; window.Date = FD; }
      if (opts.storage) for (const k in opts.storage) window.localStorage.setItem(k, opts.storage[k]);
      window.XMLHttpRequest = function(){ throw new Error('XHR bloqueado'); };
      window.navigator.sendBeacon = function(){ throw new Error('beacon bloqueado'); };
      window.fetch = function (url, init) {
        netlog.push(String(url));
        if (server.offline || api_.offline) return Promise.reject(new TypeError('Failed to fetch'));
        let body = {};
        try { body = JSON.parse(init && init.body || '{}'); } catch (e) {}
        const lat = api_.latency || server.latency || 0;
        if (!lat) { const resp = server.handle(body, { panel: true }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(resp))) }); }
        /* con latencia: la lectura (list) se resuelve al llegar al servidor; la escritura llega al servidor después de 'lat' ms */
        return new Promise(res => setTimeout(() => { const resp = server.handle(body, { panel: true }); res({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(resp))) }); }, lat));
      };
      if (!window.TextEncoder) window.TextEncoder = TextEncoder;
      if (!window.TextDecoder) window.TextDecoder = TextDecoder;
      window.Blob = Blob;
      window.URL.createObjectURL = (b) => { downloads.push({ blob: b, name: '' }); return 'blob:fake'; };
      window.URL.revokeObjectURL = () => {};
      const origClick = window.HTMLAnchorElement.prototype.click;
      window.HTMLAnchorElement.prototype.click = function () {
        if (this.download && downloads.length) downloads[downloads.length - 1].name = this.download;
        // no navegar: jsdom no lo implementa y solo mete ruido
      };
      window.print = () => prints.push(Date.now());
      window.confirm = (m) => { dialogs.confirm.push(m); return dialogs.confirmAnswer; };
      window.prompt = (m, d) => { dialogs.prompt.push(m); return dialogs.promptAnswer === undefined ? d : dialogs.promptAnswer; };
      window.alert = (m) => dialogs.alert.push(m);
      window.scrollTo = () => {};
      window.Element.prototype.scrollIntoView = () => {};
      window.addEventListener('error', (e) => errors.push('window.error: ' + (e.message || e.error)));
    }
  });
  const w = dom.window, d = w.document;
  const $ = (s) => d.querySelector(s);
  const $$ = (s) => Array.prototype.slice.call(d.querySelectorAll(s));
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const api = Object.assign(api_, {
    dom, w, d, $, $$, server, netlog, errors, downloads, prints, dialogs,
    tick: (ms) => new Promise(r => setTimeout(r, ms == null ? 20 : ms)),
    setVal(sel, v) { const el = typeof sel === 'string' ? $(sel) : sel; if (!el) throw new Error('no existe ' + sel); el.value = v; fire(el, 'input'); fire(el, 'change'); return el; },
    click(sel) { const el = typeof sel === 'string' ? $(sel) : sel; if (!el) throw new Error('no existe ' + sel); el.click(); return el; },
    radio(name, val) { const el = $$('input[name="' + name + '"]').filter(i => i.value === val)[0]; if (!el) throw new Error('no hay radio ' + name + '=' + val); el.checked = true; fire(el, 'change'); return el; },
    checkbox(sel, on) { const el = $(sel); el.checked = !!on; fire(el, 'change'); return el; },
    text(sel) { const el = $(sel); return el ? el.textContent : null; },
    html(sel) { const el = $(sel); return el ? el.innerHTML : null; },
    modalOpen: () => $('#ov').classList.contains('on'),
    modalText: () => $('#modal').textContent,
    modalHtml: () => $('#modal').innerHTML,
    toast: () => $('#toast').textContent,
    viewOn: () => ($$('.view').filter(s => s.classList.contains('on'))[0] || {}).id,
    /* texto visible de la página sin scripts ni estilos */
    visibleText() {
      const c = d.body.cloneNode(true);
      c.querySelectorAll('script,style,template').forEach(n => n.remove());
      return c.textContent;
    },
    lastDownload() { return downloads[downloads.length - 1]; },
    async blobBuffer(b) { return Buffer.from(await b.arrayBuffer()); },
    readZip, sheetCells, xmlUnesc,
    close() { try { w.close(); } catch (e) {} }
  });
  return api;
}

/* Lector de zip sin compresión (método 0), que es lo que arma makeZip. */
function readZip(buf) {
  const files = {}; let p = 0; let n = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8);
    const crc = buf.readUInt32LE(p + 14);
    const csize = buf.readUInt32LE(p + 18);
    const nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
    const name = buf.slice(p + 30, p + 30 + nlen).toString('utf8');
    const data = buf.slice(p + 30 + nlen + xlen, p + 30 + nlen + xlen + csize);
    if (method !== 0) throw new Error('zip: método no soportado ' + method + ' en ' + name);
    const real = zlib.crc32 ? zlib.crc32(data) : null;
    if (real !== null && real !== crc) throw new Error('zip: CRC inválido en ' + name);
    files[name] = data.toString('utf8');
    p += 30 + nlen + xlen + csize; n++;
  }
  // directorio central + EOCD
  if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: falta el directorio central');
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('zip: falta EOCD');
  const total = buf.readUInt16LE(eocd + 10);
  if (total !== n) throw new Error('zip: EOCD dice ' + total + ' archivos, hay ' + n);
  return files;
}
function xmlUnesc(s) { return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
/* celdas de una hoja: {A1:'texto', B2:123, ...} */
function sheetCells(xml) {
  const out = {}; const re = /<c r="([A-Z]+\d+)"([^>]*)>(.*?)<\/c>/g; let m;
  while ((m = re.exec(xml)) !== null) {
    const inner = m[3];
    const v = /<v>([^<]*)<\/v>/.exec(inner); const t = /<t[^>]*>([^<]*)<\/t>/.exec(inner);
    out[m[1]] = v ? Number(v[1]) : (t ? xmlUnesc(t[1]) : '');
  }
  return out;
}
function fakeServer() {
  const spa = process.env.PANEL === 'spa';
  return require('./gsserver.js').gsServer(spa ? require('path').join(__dirname,'..','..','google-apps-script-pacientes.gs') : require('path').join(__dirname,'..','..','cosmetic/google-apps-script-pacientes.gs'));
}
module.exports = { fakeServer, load, readZip, sheetCells, xmlUnesc };
