'use strict';
/* Utilidades comunes para las pruebas de auditoría del panel Cosmetic.
   Todo el tráfico va al servidor falso del arnés (h.js); netguard.js bloquea red real. */
const { load, fakeServer } = require('./h.js');
const crypto = require('crypto');
const SPA = process.env.PANEL === 'spa';
const FILE = SPA ? require('path').join(__dirname,'..','..','pacientes.html') : require('path').join(__dirname,'..','..','cosmetic/pacientes.html');
const URL = SPA ? 'https://example.test/AUD/pacientes.html' : 'https://example.test/AUD/cosmetic/pacientes.html';
/* Las claves de fábrica de cada panel se leen del propio HTML (no se escriben acá):
   con ellas el servidor en memoria arranca igual que una clínica nueva. */
const HTML = require('fs').readFileSync(FILE, 'utf8');
const FAB = { equipo: (HTML.match(/Clave por defecto:\s*([^\s(]+)/) || [])[1], admin: (HTML.match(/return sha256\('([^']+)'\)\}/) || [])[1] };
if (!FAB.equipo || !FAB.admin) { console.error('No encuentro las claves de fábrica en ' + FILE); process.exit(9); }
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const close = T => { if (T.modalOpen()) { const x = T.$('#modal .modal-x'); if (x) x.click(); else T.w.closeModal(); } };
async function abrir(opts) {
  opts = opts || {};
  const T = load(FILE, Object.assign({ url: URL }, opts));
  if (String(T.w.fetch).indexOf('server.handle') < 0) { console.error('fetch no es falso'); process.exit(9); }
  await T.tick(120);
  return T;
}
async function entrar(T, k) { T.setVal('#gate-pass', k); T.click('#gate-btn'); await T.tick(80); return T.w.ROL; }
/* atención nueva por el formulario, como recepción */
async function nueva(T, o) {
  const { w, setVal, radio, click, tick } = T;
  w.show('atencion'); w.clearForm(); if (o.fecha) setVal('#f-fecha', o.fecha);
  if (!T.$('#f-prof').readOnly) setVal('#f-prof', o.prof || 'Dra. Mirna');
  setVal('#f-paciente', o.pac); setVal('#f-cel', o.cel || '70009999'); if (o.nac) setVal('#f-nac', o.nac);
  setVal('#srv-list .s-nom', o.srv || 'Limpieza dental'); setVal('#srv-list .s-precio', String(o.total));
  if (o.totalTxt != null) setVal('#f-total', o.totalTxt);
  if (o.acuenta != null) { setVal('#f-acuenta', String(o.acuenta)); if (num0(w, o.acuenta) > 0) radio('metodo', o.metodo || 'Efectivo'); }
  if (o.mixto) { for (const k in o.mixto) setVal(w.MX[k], String(o.mixto[k])); }
  if (o.saldoTxt != null) { const s = T.$('#f-saldo'); s.dataset.touched = '1'; setVal('#f-saldo', o.saldoTxt); }
  if (o.planId) { setVal('#f-plan', o.planId); }
  if (o.prox) { setVal('#f-prox', o.prox); setVal('#f-prox-hora', o.proxHora || '09:00'); }
  if (o.estado) radio('estado', o.estado);
  if (!w.getRadio('canal')) radio('canal', w.CFG.canales[0]);
  const n0 = w.DATA.length; click('#btn-save'); await tick(60); const toast = T.toast(); close(T);
  return { r: w.DATA.filter(r => r.paciente === o.pac.trim() && r.estado === (o.estado || 'Atendido')).slice(-1)[0], toast, nuevo: w.DATA.length > n0 };
}
function num0(w, v) { return w.num(v); }
async function pagar(T, id, m, met) {
  T.w.cobrarSaldo(id); if (!T.$('#cp-m')) { const t = T.toast(); return t; }
  T.setVal('#cp-m', String(m)); T.radio('cpmet', met || 'Efectivo'); T.w.guardarPago(id); await T.tick(40);
  const t = T.toast(); close(T); return t;
}
const R = (t, x) => console.log(String(t).padEnd(58), JSON.stringify(x));
module.exports = { FAB, load, fakeServer, FILE, URL, sha, close, abrir, entrar, nueva, pagar, R };
