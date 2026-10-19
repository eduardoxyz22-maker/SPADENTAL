// Bloquea cualquier conexión de red saliente desde Node (prueba de que no se toca el backend real).
const net=require('net'),tls=require('tls'),dns=require('dns');
const boom=(n)=>function(){ console.error('NETGUARD: intento de red bloqueado ('+n+') '+JSON.stringify([].slice.call(arguments,0,1)).slice(0,200)); process.exitCode=77; throw new Error('NETGUARD '+n);};
net.connect=net.createConnection=boom('net.connect'); tls.connect=boom('tls.connect');
dns.lookup=boom('dns.lookup');
const orig=net.Socket.prototype.connect; net.Socket.prototype.connect=boom('Socket.connect');
global.fetch=boom('global.fetch');
