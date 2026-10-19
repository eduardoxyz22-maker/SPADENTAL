'use strict';
const FAB = require('./lib.js').FAB;
const { abrir, entrar, nueva, R, sha, fakeServer } = require('./lib.js');
let f=0; const OK=(t,c,x)=>{if(!c)f++;console.log((c?'PASS ':'FAIL ')+t,x===undefined?'':JSON.stringify(x))};
(async () => {
  console.log('PANEL', process.env.PANEL === 'spa' ? 'Spa' : 'Cosmetic');
  { const server = fakeServer(); server.shimClaves = false; server.sesionDirecta = false;
    const A = await abrir({ server }); await entrar(A, FAB.admin); await A.w.pullServer();
    A.w.show('config'); await A.tick(5);
    A.setVal('#cp-' + A.w.cssId('Dra. Brenda'), 'brenda-vieja'); A.click('#btn-save-claves-prof'); await A.tick(60);
    const B = await abrir({ server }); await entrar(B, FAB.equipo); await B.w.pullServer();
    A.setVal('#cp-' + A.w.cssId('Dra. Brenda'), 'brenda-NUEVA'); A.click('#btn-save-claves-prof'); await A.tick(60);
    const inp = A.$$('#c-comision .cc').find(i => i.dataset.p === 'Dra. Brenda'); A.setVal(inp, '40'); A.click('#btn-save-comision'); await A.tick(60);
    B.w.show('config'); await B.tick(5); B.click('#btn-save-rem'); await B.tick(80);
    const C = await abrir({ server }); const rv = await entrar(C, 'brenda-vieja');
    const D = await abrir({ server }); const rn = await entrar(D, 'brenda-NUEVA');
    OK('N1v6 clave vieja de Brenda no entra tras el guardado viejo de B', rv !== 'doctora' && C.$('body').classList.contains('locked'), rv);
    OK('N1v6 clave nueva entra', rn === 'doctora' && D.w.PROF_ACTUAL === 'Dra. Brenda', rn);
    OK('N1v6 comisión nueva se conserva', server.cfg.comision['Dra. Brenda'] === 40, server.cfg.comision);
    OK('N1v6 la config pública no tiene claves', !JSON.stringify(server.cfg).match(/[0-9a-f]{64}/)); }
  { const server = fakeServer();
    const A = await abrir({ server }); await entrar(A, FAB.equipo);
    const h0 = server.handle; server.handle = (b, o) => b.action === 'save' ? { ok: false, error: 'ocupado' } : h0(b, o);
    const x = await nueva(A, { pac: 'Cola Pendiente', total: 400, acuenta: 400, prof: 'Dra. Mirna' });
    await A.w.refrescarSiCorresponde(true); await A.tick(20);
    OK('N2 sigue en pantalla y en cola', !!A.w.DATA.find(r => r.paciente === 'Cola Pendiente') && A.w.pend().length === 1);
    server.handle = h0; await A.w.refrescarSiCorresponde(true); await A.tick(60);
    OK('N2 se sube al liberarse', Object.values(server.registros).filter(r => r.paciente === 'Cola Pendiente').length === 1 && A.w.pend().length === 0); }
  console.log(f ? 'FALLAS ' + f : 'TODO OK'); process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
