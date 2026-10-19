'use strict';
const FAB = require('./lib.js').FAB;
const { abrir, entrar, fakeServer } = require('./lib.js');
let f=0; const OK=(t,c,x)=>{if(!c)f++;console.log((c?'PASS ':'FAIL ')+String(t).padEnd(60),x===undefined?'':JSON.stringify(x))};
(async()=>{
  const server=fakeServer();
  const b={estado:'Atendido',celular:'70000000',profesional:'Dra. Brenda',paciente:'Ficticio Excel',fecha:'2026-01-29',servicios:[{nom:'Paquete blanqueamiento - sesion 1',cant:1,precio:700}],total:700,acuenta:700,saldo:50,pagos:[{metodo:'Transferencia',monto:700}],metodo:'Transferencia',obs:'Importado del Excel de Cosmetic',cobrosPosteriores:[]};
  server.registros.x1=Object.assign({id:'x1'},b);
  server.registros.x2=Object.assign({id:'x2'},b,{paciente:'Ficticia Dos'});
  server.registros.ok1=Object.assign({id:'ok1'},b,{paciente:'Ficticia Bien',acuenta:500,saldo:200,pagos:[{metodo:'QR',monto:500}],metodo:'QR'});
  const A=await abrir({server}); await entrar(A,FAB.equipo); await A.w.pullServer(); await A.tick(400); const w=A.w;
  OK('detecta los 2 que no cuadran (no el bien anotado)', w.saldosNoCuadran().map(r=>r.id).join()==='x1,x2');
  w.show('caja'); w.renderCaja(); OK('Caja lista los dos', /Ficticio Excel/.test(A.$('#cj-nocuadra').textContent)&&/Ficticia Dos/.test(A.$('#cj-nocuadra').textContent), A.$('#cj-nocuadra').textContent.slice(0,160));
  w.verFicha('x1'); OK('la ficha avisa', /no cuadra/.test(A.$('#modal').textContent)); 
  const c=w.confirm; w.confirm=()=>true; w.arreglarSaldo('x1'); w.confirm=c; await A.tick(80);
  const s=server.registros.x1; OK('servidor: saldo 0, cobro intacto, anotado', s.saldo===0&&s.acuenta===700&&s.total===700&&/Saldo ajustado de Bs 50 a Bs 0/.test(s.obs), {saldo:s.saldo,obs:s.obs});
  // el otro por Editar → Guardar
  w.editarId('x2'); OK('Editar muestra saldo 0', A.$('#f-saldo').value==='0'||A.$('#f-saldo').value==='', A.$('#f-saldo').value);
  A.click('#btn-save'); await A.tick(80); const t=A.toast();
  OK('Editar → Guardar también lo deja en 0', server.registros.x2.saldo===0&&server.registros.x2.acuenta===700, {saldo:server.registros.x2.saldo,t});
  w.renderCaja(); OK('la lista queda vacía', /cuadran/.test(A.$('#cj-nocuadra').textContent));
  OK('el bien anotado no se tocó', server.registros.ok1.saldo===200);
  // una doctora no lo arregla
  console.log(f?'FALLAS '+f:'TODO OK'); process.exit(f?1:0)})().catch(e=>{console.error('FATAL',e);process.exit(2)});
