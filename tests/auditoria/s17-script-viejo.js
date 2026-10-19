'use strict';
const FAB = require('./lib.js').FAB;
/* s17: panel nuevo con el Apps Script anterior (antes de pegarlo): nada se rompe. */
const { abrir, entrar, close } = require('./lib.js');
const SPA = process.env.PANEL === 'spa';
const server = require('./gsserver.js').gsServer(__dirname + (SPA ? '/viejo-spa.gs' : '/viejo-cos.gs'));
let fallas = 0;
const OK = (t, c, x) => { if (!c) fallas++; console.log((c ? 'PASS ' : 'FAIL ') + String(t).padEnd(66), x === undefined ? '' : JSON.stringify(x)); };
const btn = (T, re) => T.$$('#modal button').find(b => re.test(b.textContent));
(async () => {
  const A = await abrir({ server }); await entrar(A, FAB.admin); const w = A.w;
  OK('el panel sabe que el script es el anterior', w.hayPaquetesSrv() === false);
  w.show('config'); w.renderConfig(); A.setVal('#pq-nom', 'Blanqueamiento'); A.setVal('#pq-n', '3'); A.setVal('#pq-tot', '700'); w.guardarPaqueteTipo(); await A.tick(40);
  OK('la plantilla se guarda igual', (w.CFG.planesTipo || []).some(t => t.paquete));
  w.show('atencion'); w.clearForm(); A.setVal('#f-prof', 'Dra. Mirna'); A.setVal('#f-paciente', 'Pac Viejo'); A.setVal('#f-cel', '7000');
  A.setVal('#srv-list .s-nom', SPA ? 'Blanqueamiento láser' : 'Blanqueamiento dental · 3 sesiones'); A.setVal('#srv-list .s-precio', '700');
  A.setVal('#f-acuenta', '700'); A.radio('metodo', 'QR'); A.radio('canal', w.CFG.canales[0]);
  A.click('#btn-save'); await A.tick(2500); close(A);
  const pl = w.planesDe('Pac Viejo')[0], at = w.DATA.find(r => r.paciente === 'Pac Viejo' && w.esAtencion(r));
  const an = w.DATA.filter(r => r.paciente === 'Pac Viejo' && w.esAnticipo(r));
  OK('con el script anterior: paquete creado (de la doctora, no de la clínica)', pl && !pl.deClinica && pl.prof === 'Dra. Mirna' && pl.sesiones[0].atencionId === at.id, pl && [pl.deClinica, pl.prof]);
  OK('atención 234 y 466 al paquete, en el servidor', server.registros[at.id] && server.registros[at.id].total === 234 && an.length === 1 && server.registros[an[0].id] && an[0].acuenta === 466);
  OK('sin pendientes trabados', !w.pend().length);
  console.log(A.errors.slice(0, 3));
  console.log(fallas ? 'FALLAS ' + fallas : 'TODO OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
