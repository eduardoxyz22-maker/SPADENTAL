/* Revisión de SOLO LECTURA de una planilla real: entra con la clave de pauta
   (rol que el servidor solo deja leer), pide `list` y busca filas que rompan
   los invariantes de plata. No manda ninguna otra acción. Escribe un CSV.
   Uso: CLINICA=spa|cos node revisar-planilla.js  (clave en CLAVE_ARCHIVO) */
'use strict';
const fs = require('fs'), path = require('path');
const CL = process.env.CLINICA === 'cos' ? 'cos' : 'spa';
const REPO = path.join(__dirname, '..', '..');
const HTML = path.join(REPO, CL === 'cos' ? 'cosmetic/pacientes.html' : 'pacientes.html');
const URL = /SHEETS_URL = '([^']+)'/.exec(fs.readFileSync(HTML, 'utf8'))[1];
const CLAVE = fs.readFileSync(process.env.CLAVE_ARCHIVO, 'utf8').trim();
const OUT = path.join(process.env.SALIDA || __dirname, (CL === 'cos' ? 'COSMETIC' : 'SPADENTAL') + '-revision-' + new Date().toISOString().slice(0, 10) + '.csv');
const SOLO_LECTURA = ['login', 'list'];
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const R = n => Math.round(n * 100) / 100;
const key = n => String(n == null ? '' : n).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const FAVOR = 'Saldo a favor';
const esAtencion = r => r.estado !== 'Agendada' && r.estado !== 'Canceló' && r.estado !== 'Reprogramó' && r.estado !== 'Anticipo';
const pagosDe = r => Array.isArray(r.pagos) && r.pagos.length ? r.pagos : (r.metodo && r.metodo !== 'Mixto' && num(r.acuenta) > 0 ? [{ metodo: r.metodo, monto: num(r.acuenta) }] : []);
const favorDe = r => pagosDe(r).reduce((a, p) => a + (p && p.metodo === FAVOR ? num(p.monto) : 0), 0);
const sumaSrv = r => (Array.isArray(r.servicios) ? r.servicios : []).reduce((a, s) => a + num(s && s.precio) * (num(s && s.cant) || 1), 0);

async function pedir(action, extra) {
  if (!SOLO_LECTURA.includes(action)) throw new Error('acción no permitida: ' + action);
  const res = await fetch(URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(Object.assign({ action }, extra || {})) });
  return res.json();
}

(async () => {
  const lg = await pedir('login', { clave: CLAVE });
  if (!lg.ok) throw new Error('login: ' + lg.error);
  if (lg.rol !== 'pauta') throw new Error('la clave no es la de pauta (rol ' + lg.rol + '): no sigo');
  const L = await pedir('list', { token: lg.token });
  if (!L.ok) throw new Error('list: ' + L.error);
  const regs = L.registros || [], pacs = L.pacientes || [];
  if (process.env.DUMP) fs.writeFileSync(path.join(process.env.SALIDA || __dirname, CL + '-crudo.json'), JSON.stringify({ registros: regs, pacientes: pacs }));
  const H = []; const add = (tipo, r, detalle, monto) => H.push({ tipo, paciente: r.paciente || r.nombre || '', fecha: r.fecha || '', id: r.id || '', detalle, monto: monto == null ? '' : R(monto) });

  const ids = new Set(regs.map(r => r.id));
  const porPac = {}; regs.forEach(r => { (porPac[key(r.paciente)] = porPac[key(r.paciente)] || []).push(r); });
  const planesDe = {}; pacs.forEach(p => { planesDe[key(p.nombre)] = (p.planes || []).filter(x => x && x.id); });

  /* 1 y 2: saldo que no cuadra, saldo negativo, cobro sin forma de pago */
  regs.forEach(r => {
    if (r.estado === 'Agendada') return;
    const falta = Math.max(0, R(num(r.total) - num(r.acuenta)));
    if (esAtencion(r) && num(r.saldo) > falta + 0.009) add('saldo_no_cuadra', r, 'figura saldo ' + num(r.saldo) + ' pero total ' + num(r.total) + ' menos cobrado ' + num(r.acuenta) + ' da ' + falta, num(r.saldo) - falta);
    if (num(r.saldo) < -0.009) add('saldo_negativo', r, 'saldo ' + num(r.saldo), num(r.saldo));
    const s = pagosDe(r).reduce((a, p) => a + num(p && p.monto), 0);
    if (num(r.acuenta) > 0 && Math.abs(s - num(r.acuenta)) > 0.01) add(/cuaderno|import/i.test(r.obs || '') ? 'importado_sin_forma_de_pago' : 'sin_forma_de_pago', r, 'cobrado ' + num(r.acuenta) + ', anotado por forma ' + R(s), num(r.acuenta) - s);
    if (r.estado === 'Atendido' && num(r.total) === 0 && sumaSrv(r) > 0) add('total_cero_con_servicios', r, 'servicios suman ' + R(sumaSrv(r)) + ' y el total es 0 (¿cortesía o error de carga?)', sumaSrv(r));
    if (r.estado === 'Atendido' && num(r.total) > 0 && sumaSrv(r) > num(r.total) + 0.009) add('descuento', r, 'servicios ' + R(sumaSrv(r)) + ' → total ' + num(r.total) + ' (solo informativo)', sumaSrv(r) - num(r.total));
  });

  /* 3: una etapa en dos atenciones; 4: sesión hecha que apunta a una visita inexistente; 5: visita de plan sin sesión marcada; 7: adelanto de plan inexistente; 9: atención de plan inexistente */
  Object.keys(porPac).forEach(k => {
    const rs = porPac[k], planes = planesDe[k] || [], porId = {}; planes.forEach(p => { porId[p.id] = p; });
    const etapas = {};
    rs.forEach(r => {
      if (!r.planId) return;
      const p = porId[r.planId];
      if (!p) { add(r.estado === 'Anticipo' ? 'adelanto_de_plan_inexistente' : 'atencion_de_plan_inexistente', r, 'planId ' + r.planId + ' no está en la ficha', num(r.acuenta)); return; }
      if (r.estado === 'Atendido' && num(r.planEtapa) > 0) {
        const kk = r.planId + '#' + num(r.planEtapa);
        if (etapas[kk]) add('etapa_en_dos_visitas', r, 'sesión ' + num(r.planEtapa) + ' de «' + p.nombre + '» también está en la visita del ' + etapas[kk].fecha, num(r.saldo));
        else etapas[kk] = r;
      }
      if (r.estado === 'Atendido') {
        const apunta = (p.sesiones || []).some(s => s && s.hecha && s.atencionId === r.id);
        if (!apunta) add('visita_de_plan_sin_marcar', r, 'visita con «' + p.nombre + '»' + (num(r.planEtapa) ? ' (etapa ' + num(r.planEtapa) + ')' : '') + ' que ninguna sesión apunta', num(r.total));
      }
    });
    planes.forEach(p => (p.sesiones || []).forEach(s => {
      if (s && s.hecha && s.atencionId && !ids.has(s.atencionId)) add('sesion_apunta_a_visita_borrada', { paciente: pacs.find(x => key(x.nombre) === k).nombre, fecha: s.fecha || '', id: s.atencionId }, 'sesión ' + s.n + ' de «' + p.nombre + '» marcada hecha pero su visita no existe', num(s.precio));
      if (s && s.hecha && !s.atencionId) add('sesion_hecha_sin_visita', { paciente: pacs.find(x => key(x.nombre) === k).nombre, fecha: s.fecha || '', id: p.id }, 'sesión ' + s.n + ' de «' + p.nombre + '» hecha sin visita asociada (marca vieja)', num(s.precio));
    }));
    /* 6: planes activos repetidos */
    const act = planes.filter(p => p.estado === 'activo'), vistos = {};
    act.forEach(p => { const n = key(p.nombre); if (vistos[n]) add('planes_activos_repetidos', { paciente: pacs.find(x => key(x.nombre) === k).nombre, fecha: '', id: p.id }, '«' + p.nombre + '» dos veces activo (también ' + vistos[n].id + ')', num(p.total)); else vistos[n] = p; });
    /* 11: saldo a favor usado de más (misma cuenta que creditosSrv) */
    let gen = 0; const plan = {}, uso = {}, cobAt = {};
    rs.forEach(r => {
      if (r.estado === 'Anticipo') { if (r.planId) plan[r.planId] = R((plan[r.planId] || 0) + num(r.acuenta)); else gen = R(gen + num(r.acuenta)); return; }
      if (r.planId) cobAt[r.planId] = R((cobAt[r.planId] || 0) + num(r.acuenta));
      const f = favorDe(r); if (!f) return;
      if (r.planId) uso[r.planId] = R((uso[r.planId] || 0) + f); else gen = R(gen - f);
    });
    Object.keys(uso).forEach(p => { let q = R((plan[p] || 0) - uso[p]); if (q < 0) { gen = R(gen + q); q = 0; } plan[p] = q; });
    Object.keys(plan).forEach(p => { const pl = porId[p]; const libre = !pl ? plan[p] : Math.max(0, Math.min(plan[p], R((plan[p] + (cobAt[p] || 0)) - num(pl.total)))); if (libre > 0.009) { plan[p] = R(plan[p] - libre); gen = R(gen + libre); } });
    if (gen < -0.009) add('saldo_a_favor_usado_de_mas', { paciente: rs[0].paciente, fecha: '', id: '' }, 'se descontó ' + R(-gen) + ' más de saldo a favor del que pagó', gen);
  });
  /* 12: lo que deja la unión vieja de «Pacientes repetidos»: la ficha del nombre que se unió sigue en la hoja (sin visitas) y su plan quedó en dos fichas */
  const fichaLlena = p => !!(p && ((p.planes || []).length || p.nac || (p.med && (p.med.alergias || p.med.medicacion || p.med.notas || (p.med.antecedentes || []).length || p.med.consent))));
  pacs.forEach(p => { const k = key(p.nombre); if (!porPac[k] && fichaLlena(p)) add('ficha_sin_visitas', { paciente: p.nombre, fecha: '', id: '' }, 'ficha con ' + [(p.planes || []).length ? (p.planes || []).length + ' plan(es)' : '', p.med && p.med.alergias ? 'alergia' : '', p.med && p.med.notas ? 'notas' : '', p.nac ? 'nacimiento' : ''].filter(Boolean).join(', ') + ' y ninguna visita ni pago (¿quedó de una unión?)', ''); });
  const dondePlan = {}; pacs.forEach(p => (p.planes || []).forEach(pl => { if (pl && pl.id) (dondePlan[pl.id] = dondePlan[pl.id] || []).push(p.nombre); }));
  Object.keys(dondePlan).forEach(id => { const l = [...new Set(dondePlan[id])]; if (l.length > 1) add('plan_en_dos_fichas', { paciente: l.join(' / '), fecha: '', id }, 'el mismo plan está en ' + l.length + ' fichas: ' + l.join(' y '), ''); });
  /* 10: planes de pacientes sin ninguna fila (ficha huérfana) solo informativo */
  pacs.forEach(p => { const k = key(p.nombre); if ((planesDe[k] || []).some(x => x.estado === 'activo') && !porPac[k]) add('plan_activo_sin_visitas_ni_pagos', { paciente: p.nombre, fecha: '', id: '' }, 'tiene plan activo pero ninguna atención ni pago', ''); });

  const orden = ['plan_en_dos_fichas', 'ficha_sin_visitas', 'etapa_en_dos_visitas', 'sesion_apunta_a_visita_borrada', 'saldo_a_favor_usado_de_mas', 'saldo_no_cuadra', 'saldo_negativo', 'visita_de_plan_sin_marcar', 'adelanto_de_plan_inexistente', 'atencion_de_plan_inexistente', 'planes_activos_repetidos', 'sesion_hecha_sin_visita', 'sin_forma_de_pago', 'total_cero_con_servicios', 'plan_activo_sin_visitas_ni_pagos', 'descuento', 'importado_sin_forma_de_pago'];
  H.sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo) || String(a.paciente).localeCompare(b.paciente) || String(a.fecha).localeCompare(b.fecha));
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  fs.writeFileSync(OUT, '﻿' + ['tipo;paciente;fecha;id;detalle;monto'].concat(H.map(h => [h.tipo, h.paciente, h.fecha, h.id, h.detalle, h.monto].map(q).join(';'))).join('\r\n'));
  const cnt = {}; H.forEach(h => { cnt[h.tipo] = (cnt[h.tipo] || 0) + 1; });
  const pacsCon = new Set(H.filter(h => h.tipo !== 'descuento' && h.tipo !== 'importado_sin_forma_de_pago').map(h => key(h.paciente))).size;
  console.log(JSON.stringify({ clinica: CL, filas: regs.length, pacientes: pacs.length, hallazgos: H.length, pacientesConAlgo: pacsCon, porTipo: cnt, csv: OUT }, null, 1));
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
