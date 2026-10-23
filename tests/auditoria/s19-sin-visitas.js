'use strict';
const FAB = require('./lib.js').FAB;
/* s19: un paciente al que se le borran todas las visitas sigue en la lista si tiene ficha o pagos. */
const { abrir, entrar, nueva, close, sha, fakeServer } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(70), x === undefined ? '' : JSON.stringify(x)); };
(async () => {
  console.log('PANEL', SPA ? 'Spa' : 'Cosmetic');
  const server = fakeServer();
  /* desde 2026-10-29-auditoria la clave de fábrica no borra: la dueña y recepción entran con claves propias (de prueba) */
  { const v = server.ctx.leerVerif(); v.admin = sha('prueba-duena-1'); v.equipo = sha('prueba-equipo-1'); server.ctx.guardarVerif(v); }
  const A = await abrir({ server }); await entrar(A, 'prueba-duena-1'); const w = A.w;
  w.confirm = () => true; A.w.window && (A.w.window.confirm = () => true);
  w.CFG.clavesProf = { 'Dra. Shirley': sha('shirley-sv') }; w.saveCfg(true); await A.tick(30);
  // con ficha médica
  const v1 = (await nueva(A, { pac: 'Viviana Prueba', total: 100, acuenta: 0, prof: 'Dra. Mirna' })).r;
  const f = w.pacDe('Viviana Prueba'); f.nombre = 'Viviana Prueba'; f.med.alergias = 'Penicilina'; w.savePac(f); await A.tick(30);
  // sin ficha
  const v2 = (await nueva(A, { pac: 'Sin Ficha Prueba', total: 100, acuenta: 0, prof: 'Dra. Mirna' })).r;
  // de un plan de Mirna
  const v3 = (await nueva(A, { pac: 'Plan Mirna Prueba', total: 100, acuenta: 0, prof: 'Dra. Mirna' })).r;
  const f3 = w.pacDe('Plan Mirna Prueba'); f3.nombre = 'Plan Mirna Prueba'; f3.planes.push(w.planNormalize({ nombre: 'Orto', prof: 'Dra. Mirna', sesiones: [{ desc: 'Control' }] })); w.savePac(f3); await A.tick(30);
  const enLista = n => { w.show('pacientes'); w.renderPacientes(); return A.$$('#pc-body tr').some(tr => tr.textContent.indexOf(n) >= 0); };
  const enBuscador = n => { w.abrirBuscador(); A.setVal('#bsq', n.split(' ')[0]); const ok = /Abrir ficha/.test(A.$('#bsq-res').textContent) && A.$('#bsq-res').textContent.indexOf(n) >= 0; close(A); return ok; };
  OK('0 antes: los tres en la lista', enLista('Viviana Prueba') && enLista('Sin Ficha Prueba') && enLista('Plan Mirna Prueba'));
  for (const r of [v1, v2, v3]) { w.borrar(r.id); await A.tick(40); close(A); }
  OK('1 se borraron las visitas', !w.DATA.some(r => [v1.id, v2.id, v3.id].includes(r.id)));
  OK('1 con ficha médica sigue en la lista, marcada «sin visitas»', enLista('Viviana Prueba') && A.$$('#pc-body tr').find(tr => /Viviana Prueba/.test(tr.textContent)).textContent.includes('sin visitas'));
  OK('1 y en el buscador', enBuscador('Viviana Prueba'));
  w.verPaciente('Viviana Prueba'); await A.tick(5);
  OK('1 la ficha abre con su alergia', A.modalOpen() && /Penicilina/.test(A.$('#modal').textContent)); close(A);
  OK('1 con plan sigue en la lista', enLista('Plan Mirna Prueba'));
  OK('1 sin ficha ni pagos: no aparece (no hay nada que mostrar)', !enLista('Sin Ficha Prueba'));
  const S = await abrir({ server }); await entrar(S, 'shirley-sv'); await S.w.pullServer(); await S.tick(700);
  S.w.show('pacientes'); S.w.renderPacientes();
  OK('2 otra doctora no ve fichas ajenas sin visitas', !S.$$('#pc-body tr').some(tr => /Viviana Prueba|Plan Mirna Prueba/.test(tr.textContent)));
  console.log(A.errors.slice(0, 3), S.errors.slice(0, 3));
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
