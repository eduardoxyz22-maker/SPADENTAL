/**
 * SPADENTAL · Backend de pacientes.html sobre Google Sheets
 * ---------------------------------------------------------
 * Pegá TODO este archivo en Extensiones → Apps Script de una hoja de cálculo
 * nueva, y publicalo como aplicación web (ver SETUP-GOOGLE-SHEETS-SPADENTAL.md).
 *
 * Acciones que entiende:
 *   {action:'list'}                  → {ok:true, registros:[...]}
 *   {action:'save',  registro:{…}, base:{…}} → {ok:true, registro:{…}}   (crea o actualiza por id;
 *                                   con base, junta los cambios con lo que hay en vez de pisarlo)
 *   {action:'delete',registro:{id}, base} → {ok:true} · {ok:false, error:'cambio', registro}
 *                                   (no borra si la atención cambió desde que se la vio)
 *   {action:'bulk',  registros:[…]}  → {ok:true, agregados, actualizados, total}
 *   {action:'info'}                  → {ok:true, planilla, url, filas}
 *   {action:'cfg',    cfg:{…}}        → {ok:true}   (guarda los ajustes compartidos)
 *   {action:'pac',   registro:{…}}   → {ok:true}   (ficha del paciente: nacimiento,
 *                                                   ficha médica y planes de tratamiento)
 *   {action:'egreso',   registro:{…}}  → {ok:true}   (lo que sale de caja)
 *   {action:'egresoDel',registro:{id}} → {ok:true}
 *
 * El list devuelve además `cfg` con los ajustes (precios, canales,
 * profesionales, clave) y `pacientes` con las fichas, para que todos los
 * equipos vean lo mismo.
 */

var HOJA = 'Atenciones';
var HOJA_PAC = 'Pacientes';
var HOJA_EGR = 'Egresos';

/* Opcional: el ID de la planilla (lo que va entre /d/ y /edit en su URL).
   Se puede dejar vacío: el script usa la planilla en la que está pegado y,
   si es un proyecto suelto, crea una llamada "Spadental · Pacientes" la
   primera vez y se acuerda de ella. Para ver cuál está usando, ejecutá la
   función probar() desde el editor. */
var SHEET_ID = '';

var COLS = [
  'ID', 'Fecha y hora', 'Fecha', 'Hora', 'N° del día', 'Profesional', 'Paciente',
  'Celular', 'CI', 'Edad', 'Tipo', 'Canal', 'Detalle canal', 'Servicios',
  'Total Bs', 'A cuenta Bs', 'Saldo Bs', 'Método', 'Estado', 'Próxima cita',
  'Hora próxima', 'Motivo próximo', 'Contactado', 'Observaciones', '_servicios_json',
  'Efectivo', 'QR', 'Tarjeta', 'Transferencia', '_pagos_json',
  'Cómo llegó', 'Agendó por', 'Viene de cita', 'Resuelta el', 'Plan', '_extra_json'
];

/* Todo lo que filaDeRegistro ya escribe en su propia columna. Lo que no esté
   en esta lista viaja en _extra_json, así agregar un campo al panel no obliga
   a redeployar el script nunca más. */
var CLAVES_MAPEADAS = ['id', 'ts', 'fecha', 'hora', 'nroDia', 'profesional',
  'paciente', 'celular', 'ci', 'edad', 'tipo', 'canal', 'canalDetalle',
  'servicios', 'total', 'acuenta', 'saldo', 'metodo', 'estado', 'prox',
  'proxHora', 'proxMotivo', 'contactado', 'obs', 'pagos', 'origen',
  'agendaPor', 'citaDe', 'resueltaTs', 'planId'];

function extraDeRegistro(r) {
  var e = {}, vacio = true;
  for (var k in r) {
    if (!Object.prototype.hasOwnProperty.call(r, k)) continue;
    if (CLAVES_MAPEADAS.indexOf(k) >= 0) continue;
    if (r[k] === undefined || r[k] === null || r[k] === '') continue;
    e[k] = r[k]; vacio = false;
  }
  return vacio ? '' : JSON.stringify(e);
}

/* Ficha del paciente: lo que es suyo y no de una visita puntual. Va en su
   propia hoja porque hay una fila por paciente, no por atención. */
var COLS_PAC = ['Nombre', 'Nacimiento', 'Alergias', 'Medicación', 'Antecedentes',
  'Consentimiento', 'Planes', 'Actualizado', '_med_json', '_planes_json'];

/* Lo que sale de caja. Va aparte de las atenciones porque no es una visita:
   mezclarlo ensuciaría cada métrica de pacientes. */
var COLS_EGR = ['ID', 'Fecha', 'Categoría', 'Detalle', 'Pagado a', 'Monto Bs',
  'Forma de pago', 'Registrado'];

/* ------------------------------------------------------------------ hoja */
/**
 * Devuelve la planilla a usar, sirva el script pegado dentro de una hoja
 * (Extensiones → Apps Script) o como proyecto suelto (script.google.com).
 */
function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = SHEET_ID || props.getProperty('SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* la borraron: seguimos */ }
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();   // script pegado en una hoja
  if (ss) return ss;
  ss = SpreadsheetApp.create('Spadental · Pacientes');   // proyecto suelto
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function getSheet() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(HOJA);
  if (!sh) {
    sh = ss.insertSheet(HOJA);
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]);
    sh.getRange(1, 1, 1, COLS.length)
      .setFontWeight('bold').setBackground('#A8C21E').setFontColor('#262625');
    sh.setFrozenRows(1);
  } else {
    // si el archivo es de una versión anterior, completa los encabezados nuevos
    var anchoActual = Math.max(sh.getLastColumn(), 1);
    var cab = sh.getRange(1, 1, 1, anchoActual).getValues()[0];
    if (cab.length < COLS.length || String(cab[0]).trim() !== COLS[0]) {
      sh.getRange(1, 1, 1, COLS.length).setValues([COLS]);
      sh.getRange(1, 1, 1, COLS.length)
        .setFontWeight('bold').setBackground('#A8C21E').setFontColor('#262625');
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

/**
 * La hoja de fichas. Igual que la de atenciones: si el archivo viene de una
 * versión anterior, se le completan los encabezados que faltan.
 */
function getSheetPac() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(HOJA_PAC);
  if (!sh) {
    sh = ss.insertSheet(HOJA_PAC);
  }
  var anchoActual = Math.max(sh.getLastColumn(), 1);
  var cab = sh.getRange(1, 1, 1, anchoActual).getValues()[0];
  if (cab.length < COLS_PAC.length || String(cab[0]).trim() !== COLS_PAC[0]) {
    sh.getRange(1, 1, 1, COLS_PAC.length).setValues([COLS_PAC]);
    sh.getRange(1, 1, 1, COLS_PAC.length)
      .setFontWeight('bold').setBackground('#A8C21E').setFontColor('#262625');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Las dos columnas legibles (Antecedentes, Planes) son para que el
   consultorio pueda leer la planilla; las que mandan son las _json. */
function filaDePaciente(p) {
  var med = p.med || {}, planes = p.planes || [];
  var ant = (med.antecedentes || []).join(', ');
  var resumen = planes.map(function (pl) {
    var ses = pl.sesiones || [], hechas = 0;
    for (var i = 0; i < ses.length; i++) if (ses[i] && ses[i].hecha) hechas++;
    return (pl.nombre || 'Plan') + ' (' + hechas + '/' + ses.length + ', ' + (pl.estado || '') + ')';
  }).join(' | ');
  return [
    p.nombre || '', p.nac || '', med.alergias || '', med.medicacion || '', ant,
    med.consent ? 'SÍ' : 'NO', resumen, p.ts || '',
    JSON.stringify(med), JSON.stringify(planes)
  ];
}

function pacienteDeFila(f) {
  var med = {}, planes = [];
  try { med = JSON.parse(f[8] || '{}'); } catch (e) { med = {}; }
  try { planes = JSON.parse(f[9] || '[]'); } catch (e) { planes = []; }
  return {
    nombre: String(f[0] || ''), nac: formatoFecha(f[1]),
    med: med, planes: planes, ts: f[7] || ''
  };
}

function doListPac() {
  var sh = getSheetPac();
  var n = sh.getLastRow();
  if (n < 2) return [];
  var filas = sh.getRange(2, 1, n - 1, COLS_PAC.length).getValues();
  var out = [];
  for (var i = 0; i < filas.length; i++) {
    if (!filas[i][0]) continue;
    out.push(pacienteDeFila(filas[i]));
  }
  return out;
}

/* Una ficha por paciente: se busca por nombre sin distinguir mayúsculas,
   tildes ni espacios dobles ("María Pérez" = "Maria Perez"). Si quedaron
   dos filas de la misma persona, se juntan y las dos quedan iguales. Con
   base, lo que mandó este equipo se junta con lo que ya había. */
function doGuardarPac(p, base, ses) {
  if (!p || !p.nombre) return { ok: false, error: 'sin_nombre' };
  var doctora = !!(ses && ses.rol === 'doctora');
  if (doctora && pacienteDeOtra(fClavePac(p.nombre), ses.prof)) return { ok: false, error: 'sin_permiso' };
  var sh = getSheetPac();
  var n = sh.getLastRow();
  var clave = fClavePac(p.nombre);
  var destinos = [], actual = null;
  if (n >= 2) {
    var filas = sh.getRange(2, 1, n - 1, COLS_PAC.length).getValues();
    for (var i = 0; i < filas.length; i++) {
      if (filas[i][0] && fClavePac(filas[i][0]) === clave) {
        destinos.push(i + 2);
        actual = fusionarFichas(actual, pacienteDeFila(filas[i]));
      }
    }
  }
  var conf = [], final = p;
  if (actual && base !== undefined) final = fusion3(base || {}, p, actual, '', conf);
  if (doctora && actual) final.planes = planesSinTocarAjenos(actual.planes, final.planes, ses.prof, fClavePac(p.nombre));
  final.nombre = p.nombre;
  var fila = filaDePaciente(final);
  if (destinos.length) {
    for (var d = 0; d < destinos.length; d++) sh.getRange(destinos[d], 1, 1, COLS_PAC.length).setValues([fila]);
  } else sh.getRange(sh.getLastRow() + 1, 1, 1, COLS_PAC.length).setValues([fila]);
  return { ok: true, paciente: pacienteDeFila(fila), conflictos: conf };
}

/* Igual que el panel (pacAjeno): el paciente es de otra doctora si tiene
   visitas con doctora asignada y ninguna es de esta. Un paciente nuevo, sin
   visitas, no es de nadie todavía. */
/* Las visitas de un paciente (id, doctora, estado), sin anticipos ni citas por definir. */
function filasPacSrv(clave) {
  var sh = getSheet(), n = sh.getLastRow(), out = [];
  if (n < 2 || !clave) return out;
  var filas = sh.getRange(2, 1, n - 1, 19).getValues();
  for (var i = 0; i < filas.length; i++) {
    var pr = String(filas[i][5] || ''), est = String(filas[i][18] || '');
    if (!pr || pr === 'Por definir' || est === 'Anticipo') continue;
    if (fClavePac(filas[i][6]) !== clave) continue;
    out.push({ id: filas[i][0], prof: pr, estado: est });
  }
  return out;
}
/* Igual que el panel (pacAjeno): el paciente es de otra doctora si tiene
   visitas con doctora asignada y ninguna es de esta. Un paciente nuevo, sin
   visitas, no es de nadie todavía. */
function pacienteDeOtra(clave, prof) {
  var fs = filasPacSrv(clave);
  return fs.length > 0 && !fs.some(function (f) { return f.prof === prof; }) && !paqueteClinicaActivo(clave);
}
/* Un paquete de la clínica (lo atiende cualquier doctora) todavía en curso:
   mientras tanto el paciente es de todas. Se mira la ficha guardada, no la
   que manda el panel. */
function planesGuardados(clave) {
  var sh = getSheetPac(), n = sh.getLastRow(), out = [];
  if (n < 2 || !clave) return out;
  var filas = sh.getRange(2, 1, n - 1, COLS_PAC.length).getValues();
  for (var i = 0; i < filas.length; i++) {
    if (!filas[i][0] || fClavePac(filas[i][0]) !== clave) continue;
    out = out.concat(pacienteDeFila(filas[i]).planes || []);
  }
  return out;
}
function paqueteClinicaActivo(clave) {
  return planesGuardados(clave).some(function (p) { return p && p.deClinica && p.estado !== 'cancelado' && p.estado !== 'terminado'; });
}
/* La dueña de un plan: la anotada; si es un plan viejo sin doctora, la que
   atendió más etapas; sin etapas atendidas, la única doctora del paciente.
   Si no se puede saber, no es de ninguna doctora (lo cambia la dueña). */
function duenoPlanSrv(p, filas) {
  if (p && p.deClinica) return '';
  if (p && p.prof) return p.prof;
  /* misma regla que el panel (duenaPlan): la que atendió más sesiones del plan
     (si empatan, ninguna); sin sesiones atendidas, la única doctora que atendió
     al paciente; si hay más de una, ninguna (lo asigna la dueña o recepción) */
  var noAt = ['Agendada', 'Canceló', 'Reprogramó', 'Anticipo'];
  var idProf = {}, cuenta = {}, profs = {};
  (filas || []).forEach(function (f) { if (noAt.indexOf(f.estado) >= 0) return; idProf[f.id] = f.prof; profs[f.prof] = 1; });
  ((p && p.sesiones) || []).forEach(function (s) { var d = s && s.atencionId && idProf[s.atencionId]; if (d) cuenta[d] = (cuenta[d] || 0) + 1; });
  var ds = Object.keys(cuenta);
  if (ds.length) {
    var mejor = '', max = 0, empate = false;
    ds.forEach(function (d) { if (cuenta[d] > max) { max = cuenta[d]; mejor = d; empate = false; } else if (cuenta[d] === max) empate = true; });
    return empate ? '' : mejor;
  }
  var ks = Object.keys(profs);
  return ks.length === 1 ? ks[0] : '';
}
/* El plan de otra doctora (o sin dueña clara) queda como estaba: no se
   cambia, no se borra y no se crean planes a su nombre. Si esta doctora
   atendió una etapa en reemplazo, se toma solo la marca de esa etapa, y solo
   si la atención es suya. */
function planesSinTocarAjenos(viejos, nuevos, prof, clave) {
  var filas = filasPacSrv(clave), idProf = {};
  filas.forEach(function (f) { idProf[f.id] = f.prof; });
  var ajeno = function (p) { return !!p && duenoPlanSrv(p, filas) !== prof; };
  var porId = {}, vistos = {}, out = [];
  (viejos || []).forEach(function (p) { if (p && p.id) porId[p.id] = p; });
  (nuevos || []).forEach(function (p) {
    if (!p) return;
    var v = p.id ? porId[p.id] : null;
    if (v && ajeno(v)) {
      var q = JSON.parse(JSON.stringify(v));
      q.sesiones = (v.sesiones || []).map(function (s) {
        var ns = (p.sesiones || []).filter(function (x) { return x && x.n === s.n; })[0], c = JSON.parse(JSON.stringify(s));
        var marca = ns && ns.hecha && ns.atencionId && idProf[ns.atencionId] === prof;
        var desmarca = ns && !ns.hecha && s.atencionId && idProf[s.atencionId] === prof;
        if (marca || desmarca) { c.hecha = !!ns.hecha; c.fecha = ns.fecha || ''; c.atencionId = ns.atencionId || ''; }
        return c;
      });
      /* con la última sesión hecha el plan termina; si se desmarca una, vuelve a estar activo */
      if (q.estado !== 'cancelado') {
        var todas = q.sesiones.length > 0 && q.sesiones.every(function (s) { return s && s.hecha; });
        if (todas && p.estado === 'terminado') q.estado = 'terminado';
        else if (!todas && q.estado === 'terminado') q.estado = 'activo';
      }
      out.push(q); vistos[p.id] = 1; return;
    }
    if (!v) {
      if (p.prof && p.prof !== prof) return;                 // no se crean planes a nombre de otra
      if (!p.prof && !p.deClinica) { p = JSON.parse(JSON.stringify(p)); p.prof = prof; }
      if (p.deClinica && p.prof) { p = JSON.parse(JSON.stringify(p)); p.prof = ''; }
    }
    out.push(p); if (p.id) vistos[p.id] = 1;
  });
  (viejos || []).forEach(function (p) { if (p && p.id && ajeno(p) && !vistos[p.id]) out.push(p); });
  return out;
}

function getSheetEgr() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(HOJA_EGR);
  if (!sh) sh = ss.insertSheet(HOJA_EGR);
  var anchoActual = Math.max(sh.getLastColumn(), 1);
  var cab = sh.getRange(1, 1, 1, anchoActual).getValues()[0];
  if (cab.length < COLS_EGR.length || String(cab[0]).trim() !== COLS_EGR[0]) {
    sh.getRange(1, 1, 1, COLS_EGR.length).setValues([COLS_EGR]);
    sh.getRange(1, 1, 1, COLS_EGR.length)
      .setFontWeight('bold').setBackground('#A8C21E').setFontColor('#262625');
    sh.setFrozenRows(1);
  }
  return sh;
}

function filaDeEgreso(e) {
  return [e.id || '', e.fecha || '', e.categoria || '', e.detalle || '',
    e.proveedor || '', Number(e.monto) || 0, e.metodo || '', e.ts || ''];
}

function egresoDeFila(f) {
  return {
    id: f[0], fecha: formatoFecha(f[1]), categoria: f[2], detalle: f[3],
    proveedor: f[4], monto: Number(f[5]) || 0, metodo: f[6], ts: f[7] || ''
  };
}

function doListEgr() {
  var sh = getSheetEgr();
  var n = sh.getLastRow();
  if (n < 2) return [];
  var filas = sh.getRange(2, 1, n - 1, COLS_EGR.length).getValues();
  var out = [];
  for (var i = 0; i < filas.length; i++) {
    if (!filas[i][0]) continue;
    out.push(egresoDeFila(filas[i]));
  }
  return out;
}

/** Busca la fila de un egreso por su id. Devuelve 0 si no está. */
function filaEgresoPorId(sh, id) {
  var n = sh.getLastRow();
  if (n < 2) return 0;
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return 0;
}

/* Con base, igual que las atenciones: un equipo sin refrescar no revive un
   egreso borrado ni pisa una corrección de otro. */
function doGuardarEgreso(e, base) {
  if (!e || !e.id) return { ok: false, error: 'sin_id' };
  var sh = getSheetEgr();
  var destino = filaEgresoPorId(sh, e.id);
  if (!destino && base !== undefined && fueBorrado('e:' + e.id)) return { ok: false, error: 'borrada', id: e.id };
  if (!destino && base && !base.__alta) return { ok: false, error: 'borrada', id: e.id };
  var conf = [];
  if (destino && base) {
    var actual = egresoDeFila(sh.getRange(destino, 1, 1, COLS_EGR.length).getValues()[0]);
    e = fusion3(fSinAlta(base), e, actual, '', conf);
  }
  var fila = filaDeEgreso(e);
  if (destino) sh.getRange(destino, 1, 1, COLS_EGR.length).setValues([fila]);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, COLS_EGR.length).setValues([fila]);
  return { ok: true, egreso: e.id, registro: egresoDeFila(fila), conflictos: conf };
}

function doBorrarEgreso(e, base) {
  if (!e || !e.id) return { ok: false, error: 'sin_id' };
  var sh = getSheetEgr();
  var fila = filaEgresoPorId(sh, e.id);
  if (fila && base) {
    var actual = egresoDeFila(sh.getRange(fila, 1, 1, COLS_EGR.length).getValues()[0]);
    var b2 = {}, a2 = {}, k;
    for (k in base) if (k !== 'ts') b2[k] = base[k];
    for (k in actual) if (k !== 'ts') a2[k] = actual[k];
    if (!fIgual(b2, a2)) return { ok: false, error: 'cambio', registro: actual };
  }
  if (fila) { sh.deleteRow(fila); anotarBorrado('e:' + e.id); }
  return { ok: true, borrado: !!fila };
}

/* ------------------------------------------------- lo que se borró
   Una lista de ids borrados: un alta que se reintenta (porque se cortó la
   respuesta) o un pendiente viejo no puede revivir algo que alguien borró. */
var HOJA_BORR = '_Borrados';
function hojaBorrados() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(HOJA_BORR);
  if (!sh) { sh = ss.insertSheet(HOJA_BORR); sh.getRange(1, 1, 1, 2).setValues([['ID', 'Borrado']]); }
  return sh;
}
function fueBorrado(id) {
  var sh = hojaBorrados(), n = sh.getLastRow();
  if (n < 2) return false;
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return true;
  return false;
}
function anotarBorrado(id) {
  var sh = hojaBorrados();
  sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([[String(id), new Date().toISOString()]]);
}

/* ------------------------------------------------- serialización servicios */
function srvTexto(servicios) {
  if (!servicios || !servicios.length) return '';
  return servicios.map(function (s) {
    var t = s.nom || '';
    if (s.det) t += ' (' + s.det + ')';
    if (Number(s.cant) > 1) t += ' ×' + s.cant;
    if (s.precio !== '' && s.precio != null) t += ' — Bs ' + s.precio;
    return t;
  }).join(' | ');
}

function filaDeRegistro(r) {
  return [
    r.id || '', r.ts || '', r.fecha || '', r.hora || '', r.nroDia || '',
    r.profesional || '', r.paciente || '', r.celular || '', r.ci || '', r.edad || '',
    r.tipo || '', r.canal || '', r.canalDetalle || '', srvTexto(r.servicios),
    Number(r.total) || 0, Number(r.acuenta) || 0, Number(r.saldo) || 0,
    r.metodo || '', r.estado || '', r.prox || '', r.proxHora || '', r.proxMotivo || '',
    r.contactado ? 'SÍ' : 'NO', r.obs || '', JSON.stringify(r.servicios || []),
    montoDe(r, 'Efectivo'), montoDe(r, 'QR'), montoDe(r, 'Tarjeta'), montoDe(r, 'Transferencia'),
    JSON.stringify(r.pagos || []),
    r.origen || '', r.agendaPor || '', r.citaDe || '', r.resueltaTs || '', r.planId || '',
    extraDeRegistro(r)
  ];
}

/** Cuánto de esta atención se cobró con tal forma de pago. */
function montoDe(r, metodo) {
  var ps = r.pagos && r.pagos.length ? r.pagos : [];
  if (!ps.length && r.metodo === metodo) return Number(r.acuenta) || 0;
  var t = 0;
  for (var i = 0; i < ps.length; i++) {
    if (ps[i] && ps[i].metodo === metodo) t += Number(ps[i].monto) || 0;
  }
  return t;
}

function registroDeFila(f) {
  var servicios = [], pagos = [];
  try { servicios = JSON.parse(f[24] || '[]'); } catch (e) { servicios = []; }
  try { pagos = JSON.parse(f[29] || '[]'); } catch (e) { pagos = []; }
  var base = {
    id: f[0], ts: f[1], fecha: formatoFecha(f[2]), hora: formatoHora(f[3]), nroDia: f[4],
    profesional: f[5], paciente: f[6], celular: String(f[7] || ''), ci: String(f[8] || ''),
    edad: String(f[9] || ''), tipo: f[10], canal: f[11], canalDetalle: f[12],
    servicios: servicios,
    total: Number(f[14]) || 0, acuenta: Number(f[15]) || 0, saldo: Number(f[16]) || 0,
    metodo: f[17], estado: f[18], prox: formatoFecha(f[19]), proxHora: formatoHora(f[20]),
    proxMotivo: f[21], contactado: String(f[22]).toUpperCase() === 'SÍ' || String(f[22]).toUpperCase() === 'SI',
    obs: f[23], pagos: pagos,
    origen: f[30] || '', agendaPor: f[31] || '', citaDe: f[32] || '', resueltaTs: f[33] || '',
    planId: f[34] || ''
  };
  /* lo que llegó en _extra_json vuelve tal cual, sin pisar nada mapeado */
  var extra = {};
  try { extra = JSON.parse(f[35] || '{}'); } catch (e) { extra = {}; }
  for (var k in extra) {
    if (!Object.prototype.hasOwnProperty.call(extra, k)) continue;
    if (CLAVES_MAPEADAS.indexOf(k) >= 0) continue;
    base[k] = extra[k];
  }
  return base;
}

/* Una hora en Sheets es la fecha 1899-12-30 más esa hora: si vuelve como Date,
   se formatea en la zona del consultorio para que el panel reciba "08:30". */
function formatoHora(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(v);
}

/* Google a veces devuelve las fechas como objeto Date: las volvemos YYYY-MM-DD */
function formatoFecha(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v);
}

/* ------------------------------------------------- ajustes compartidos */
/* Se guardan en las propiedades del script, no en una hoja: son un solo
   objeto y así no ensucian la planilla que mira el consultorio. */
var K_CFG = 'CFG_SPADENTAL';

function doGuardarCfg(cfg, base) {
  if (!cfg || !cfg.precios || !cfg.canales) return { ok: false, error: 'cfg_invalida' };
  var guardada = leerCfg() || {};
  cfg = cfgSinClaves(cfg, guardada);
  if (base) base = cfgSinClaves(base, guardada);
  /* con base, los ajustes de dos equipos se juntan acá adentro, sin carrera */
  if (base) {
    var actual = leerCfg();
    if (actual) cfg = fusion3(base, cfg, actual, '', []);
    cfg = cfgSinClaves(cfg, guardada);
  }
  var props = PropertiesService.getScriptProperties();
  var texto = JSON.stringify(cfg);
  if (texto.length > 450000) return { ok: false, error: 'cfg_muy_grande' };
  props.setProperty(K_CFG, texto);
  return { ok: true, ts: cfg.ts || '', cfg: cfgPublica(cfg) };
}

function leerCfg() {
  try {
    var t = PropertiesService.getScriptProperties().getProperty(K_CFG);
    return t ? JSON.parse(t) : null;
  } catch (e) { return null; }
}

/* ---------------------------------------------------------------- acciones */
function doList(ses) {
  /* los egresos de la clínica son de la dueña y recepción: a una doctora no se le mandan */
  var egr = (ses && ses.rol === 'doctora') ? [] : doListEgr();
  var sh = getSheet();
  var n = sh.getLastRow();
  if (n < 2) return { ok: true, registros: [], cfg: cfgPublica(leerCfg()), pacientes: doListPac(), egresos: egr };
  var filas = sh.getRange(2, 1, n - 1, COLS.length).getValues();
  var out = [];
  for (var i = 0; i < filas.length; i++) {
    if (!filas[i][0]) continue;
    out.push(registroDeFila(filas[i]));
  }
  return { ok: true, registros: out, cfg: cfgPublica(leerCfg()), pacientes: doListPac(), egresos: egr };
}

function doSave(r, base, ses) {
  if (!r || !r.id) return { ok: false, error: 'sin_id' };
  var sh = getSheet();
  var n = sh.getLastRow();
  var conf = [];

  // Busca si el registro ya existe y, de paso, cuenta los del mismo día.
  var destino = 0, nroGuardado = 0, fechaGuardada = '', cuantas = 0, maxNro = 0;
  if (n >= 2) {
    var datos = sh.getRange(2, 1, n - 1, 5).getValues(); // ID · ts · Fecha · Hora · N° del día
    for (var j = 0; j < datos.length; j++) {
      if (datos[j][0] === r.id) {
        destino = j + 2;
        nroGuardado = Number(datos[j][4]) || 0;
        fechaGuardada = formatoFecha(datos[j][2]);
        continue;
      }
      if (r.fecha && formatoFecha(datos[j][2]) === r.fecha) {
        cuantas++;
        maxNro = Math.max(maxNro, Number(datos[j][4]) || 0);
      }
    }
  }

  /* Con base: lo que mandó este equipo se junta con lo que hay guardado, así
     una pantalla vieja no borra el cobro o el servicio que cargó otra. */
  /* Tenía base pero ya no está: la borraron desde otro equipo. Un cambio
     viejo no la revive. */
  var esAlta = !!(base && base.__alta), separada = null;
  if (!destino && base !== undefined && fueBorrado(r.id)) return { ok: false, error: 'borrada', id: r.id };
  if (!destino && base && !esAlta) return { ok: false, error: 'borrada', id: r.id };
  var previa0 = destino ? registroDeFila(sh.getRange(destino, 1, 1, COLS.length).getValues()[0]) : null;
  /* una doctora no agenda ni carga nada nuevo para un paciente de otra (igual que el panel) */
  if (ses && ses.rol === 'doctora' && !previa0 && pacienteDeOtra(fClavePac(r.paciente), ses.prof))
    return { ok: false, error: 'sin_permiso', id: r.id };
  if (ses && !doctoraPuedeGuardar(r, previa0, ses, !!(previa0 && base && fOtraDoctora(fSinAlta(base), r, previa0))))
    return { ok: false, error: 'sin_permiso', id: r.id };
  if (destino && base !== undefined) {
    var actual = registroDeFila(sh.getRange(destino, 1, 1, COLS.length).getValues()[0]);
    var b0 = fSinAlta(base);
    if (b0 && fOtraDoctora(b0, r, actual)) {
      /* la misma cita la atendieron dos doctoras: son dos visitas, no una */
      var ids = {}, cpA = fCobrosPost(actual), q;
      for (q = 0; q < cpA.length; q++) if (cpA[q] && cpA[q].id) ids[cpA[q].id] = 1;
      var dm = fDesarmar(r), propios = [];
      delete dm.correccionesCobro;
      var cpM = fCobrosPost(r);
      for (q = 0; q < cpM.length; q++) if (!(cpM[q] && cpM[q].id && ids[cpM[q].id])) propios.push(cpM[q]);
      dm.cobrosPosteriores = propios;
      separada = fArmar(dm);
      /* id fijo por doctora: un reintento cae en la misma, no crea otra */
      separada.id = r.id + '-' + fSlug(r.profesional);
      var ya = 0, ids2 = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();
      for (q = 0; q < ids2.length; q++) if (String(ids2[q][0]) === separada.id) { ya = q + 2; break; }
      if (ya) {
        var previa = registroDeFila(sh.getRange(ya, 1, 1, COLS.length).getValues()[0]);
        var junta = fusionRegistro(null, separada, previa, []);
        junta.id = separada.id; junta.nroDia = previa.nroDia;
        sh.getRange(ya, 1, 1, COLS.length).setValues([filaDeRegistro(junta)]);
        return { ok: true, registro: actual, separada: registroDeFila(filaDeRegistro(junta)), conflictos: ['profesional'] };
      }
      separada.citaDe = r.id;
      separada.obs = String(separada.obs || '') + (separada.obs ? '\n' : '') +
        '⚠ Separada: la misma cita la atendió también ' + actual.profesional + '. Revisar.';
      separada.nroDia = Math.max(cuantas, maxNro) + 1;
      delete separada.correccionesCobro;
      sh.appendRow(filaDeRegistro(separada));
      return { ok: true, registro: actual, separada: registroDeFila(filaDeRegistro(separada)), conflictos: ['profesional'] };
    }
    r = fusionRegistro(b0, r, actual, conf);
  }
  /* Lo cobrado no se baja ni se borra con un guardado: para eso está
     «Corregir cobro», que deja la historia en _Correcciones. */
  if (previa0 && cobroBaja(previa0, r)) return { ok: false, error: 'cobro_baja', registro: previa0 };
  /* El saldo a favor se usa una sola vez. Con el candado puesto se mira cuánto
     le queda al paciente: si otro equipo ya lo usó, lo que esta atención paga
     con saldo a favor se recorta a lo que queda y la diferencia queda debiendo. */
  var ajusteFavor = 0;
  if (r.estado !== 'Anticipo') {
    var favN = favorDeSrv(r), favP = previa0 ? favorDeSrv(previa0) : 0;
    if (favN > favP + 0.009) {
      var falta = fR((favN - favP) - Math.max(0, creditoPacienteSrv(fClavePac(r.paciente))));
      if (falta > 0.009) { ajusteFavor = fR(Math.min(falta, favN - favP)); r = recortarFavor(r, ajusteFavor); }
    }
  }

  // N° del día: lo asigna el servidor para que no se repita entre celulares.
  // Es el mayor entre (cuántas atenciones ya hay ese día) y (el N° más alto usado).
  if (destino && nroGuardado && fechaGuardada === r.fecha) {
    // Editar no cambia el número: el guardado manda, aunque el equipo que
    // edita traiga uno viejo. Sin esto, un equipo sin refrescar podía pisar
    // el número corregido y duplicarlo.
    r.nroDia = nroGuardado;
  } else if (!r.nroDia || r.nroDia <= maxNro ||
             (destino && fechaGuardada && fechaGuardada !== r.fecha)) {
    // Alta nueva, número que ya está tomado, o registro movido a otro día
    // (el número viejo pertenece al día viejo: acá recibe el del nuevo).
    r.nroDia = Math.max(cuantas, maxNro) + 1;
  }

  /* la historia de correcciones solo la escribe "Corregir cobro"; al restaurar
     un respaldo (alta nueva) la dueña la puede traer de vuelta */
  if (previa0) { if (previa0.correccionesCobro) r.correccionesCobro = previa0.correccionesCobro; else delete r.correccionesCobro; }
  else if (!(ses && ses.rol === 'admin' && fEsLista(r.correccionesCobro))) delete r.correccionesCobro;
  var fila = filaDeRegistro(r);
  if (destino) sh.getRange(destino, 1, 1, COLS.length).setValues([fila]);
  else sh.appendRow(fila);

  return ajusteFavor ? { ok: true, registro: registroDeFila(fila), conflictos: conf, ajusteFavor: ajusteFavor }
    : { ok: true, registro: registroDeFila(fila), conflictos: conf };
}
function favorDeSrv(r) {
  var t = 0, ps = (r && r.pagos) || [];
  for (var i = 0; i < ps.length; i++) if (ps[i] && ps[i].metodo === 'Saldo a favor') t += Number(ps[i].monto) || 0;
  return fR(t);
}
/* Saca 'quitar' de lo pagado con saldo a favor (primero lo más nuevo). */
function recortarFavor(r, quitar) {
  var d = fDesarmar(r), q = fR(quitar), i;
  var cps = fCobrosPost(d).map(function (p) { return JSON.parse(JSON.stringify(p)); });
  for (i = cps.length - 1; i >= 0 && q > 0.009; i--) {
    if (!cps[i] || cps[i].metodo !== 'Saldo a favor') continue;
    var t = fR(Math.min(q, fNum(cps[i].monto))); cps[i].monto = fR(fNum(cps[i].monto) - t); q = fR(q - t);
  }
  d.cobrosPosteriores = cps.filter(function (p) { return p && fNum(p.monto) > 0.004; });
  var ini = (d.__cobro.pagos || []).map(function (p) { return { metodo: p.metodo, monto: fNum(p.monto) }; }), sacado = 0;
  for (i = ini.length - 1; i >= 0 && q > 0.009; i--) {
    if (ini[i].metodo !== 'Saldo a favor') continue;
    var u = fR(Math.min(q, ini[i].monto)); ini[i].monto = fR(ini[i].monto - u); q = fR(q - u); sacado = fR(sacado + u);
  }
  d.__cobro = { monto: fR(fNum(d.__cobro.monto) - sacado), pagos: ini.filter(function (p) { return p.monto > 0.004; }), metodo: d.__cobro.metodo };
  return fArmar(d);
}

/**
 * Carga muchas atenciones de una sola vez (se usó para subir el histórico
 * de los cuadernos de enero a julio). Escribe todo con un solo setValues,
 * así que entran cientos de filas en una llamada.
 * Los que ya existen por id se actualizan; los nuevos se agregan.
 */
function doBulk(lista, ses) {
  if (ses && ses.rol !== 'admin') return { ok: false, error: 'sin_permiso' };
  if (!lista || !lista.length) return { ok: true, agregados: 0, actualizados: 0 };
  var sh = getSheet();
  var n = sh.getLastRow();

  var filaPorId = {}, filasViejas = n >= 2 ? sh.getRange(2, 1, n - 1, COLS.length).getValues() : [];
  for (var i = 0; i < filasViejas.length; i++) {
    if (filasViejas[i][0]) filaPorId[filasViejas[i][0]] = i + 2;
  }

  var nuevas = [], actualizados = 0;
  for (var k = 0; k < lista.length; k++) {
    var r = lista[k];
    if (!r || !r.id) continue;
    if (filaPorId[r.id]) {
      /* una carga masiva no borra la historia de correcciones */
      var vieja = registroDeFila(filasViejas[filaPorId[r.id] - 2]);
      r = JSON.parse(JSON.stringify(r));
      if (vieja.correccionesCobro) r.correccionesCobro = vieja.correccionesCobro; else delete r.correccionesCobro;
    }
    var fila = filaDeRegistro(r);
    if (filaPorId[r.id]) {
      sh.getRange(filaPorId[r.id], 1, 1, COLS.length).setValues([fila]);
      actualizados++;
    } else {
      nuevas.push(fila);
    }
  }
  if (nuevas.length) {
    sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, COLS.length).setValues(nuevas);
  }
  return { ok: true, agregados: nuevas.length, actualizados: actualizados,
           total: Math.max(0, sh.getLastRow() - 1) };
}

function doDelete(r, base, ses) {
  if (!r || !r.id) return { ok: false, error: 'sin_id' };
  var sh = getSheet();
  var n = sh.getLastRow();
  if (n < 2) return { ok: true };
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === r.id) {
      /* si desde que este equipo la vio alguien la cobró o la cambió, no se
         borra: se devuelve cómo está para que la revisen */
      var actual = registroDeFila(sh.getRange(i + 2, 1, 1, COLS.length).getValues()[0]);
      if (ses && ses.rol === 'doctora' && (actual.estado === 'Anticipo'
          ? !anticipoDeDoctora(actual, ses) : profDeOtra(actual, ses)))
        return { ok: false, error: 'sin_permiso', registro: actual };
      /* con plata cobrada (no saldo a favor), la borra recepción o la dueña: igual que el panel */
      if (ses && ses.rol === 'doctora' && actual.estado !== 'Anticipo' && efectivoCobrado(actual) > 0.009)
        return { ok: false, error: 'sin_permiso', registro: actual };
      /* un anticipo (o pago a un plan) que ya se usó como saldo a favor no se borra: el saldo quedaría negativo */
      if (actual.estado === 'Anticipo' && creditoPacienteSrv(fClavePac(actual.paciente)) - (Number(actual.acuenta) || 0) < -0.009)
        return { ok: false, error: 'anticipo_usado', registro: actual };
      if (base) {
        if (fCambioParaBorrar(base, actual)) return { ok: false, error: 'cambio', registro: actual };
      }
      sh.deleteRow(i + 2); anotarBorrado(r.id); return { ok: true };
    }
  }
  return { ok: true };
}

/* =====================================================================
   FUSIÓN DE CAMBIOS (va idéntica en el panel y en el Apps Script)
   Dos equipos tocan la misma atención o la misma ficha: cada uno manda lo
   suyo junto con la versión que tenía al empezar (la "base"). Lo que solo
   cambió uno, queda; lo que cambiaron los dos, se resuelve campo por campo.
   La plata no se suma "por diferencia": lo cobrado sale de los cobros, que
   tienen id, así un reintento nunca cuenta dos veces el mismo pago.
   ===================================================================== */
var FUSION_V = 5;
var FUSION_TEXTO = {obs: 1, notas: 1, alergias: 1, medicacion: 1, detalle: 1};
function fVacio(v) {
  if (v === undefined || v === null || v === '' || v === false) return true;
  if (Object.prototype.toString.call(v) === '[object Array]') return v.length === 0;
  if (typeof v === 'object') { for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) return false; return true; }
  return false;
}
function fEsLista(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
function fEsObj(v) { return !!v && typeof v === 'object' && !fEsLista(v); }
function fIgual(a, b) {
  if (a === b) return true;
  if (fVacio(a) && fVacio(b)) return true;
  if ((a === 0 || a === '0') && fVacio(b) || (b === 0 || b === '0') && fVacio(a)) return true;
  if (fEsLista(a) || fEsLista(b)) {
    if (!fEsLista(a) || !fEsLista(b) || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (!fIgual(a[i], b[i])) return false;
    return true;
  }
  if (fEsObj(a) || fEsObj(b)) {
    if (!fEsObj(a) || !fEsObj(b)) return false;
    var ks = {}, k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) ks[k] = 1;
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) ks[k] = 1;
    for (k in ks) if (!fIgual(a[k], b[k])) return false;
    return true;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    var ta = String(a).toUpperCase(), tb = String(b).toUpperCase();
    var va = a === true || ta === 'TRUE' || ta === 'SÍ' || ta === 'SI';
    var vb = b === true || tb === 'TRUE' || tb === 'SÍ' || tb === 'SI';
    return va === vb;
  }
  if (typeof a === 'number' || typeof b === 'number') {
    var x = Number(a), y = Number(b);
    if (!isNaN(x) && !isNaN(y) && String(a).replace(/\s/g, '') !== '' && String(b).replace(/\s/g, '') !== '') return Math.abs(x - y) < 1e-6;
  }
  return String(a) === String(b);
}
function fCopia(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
function fConId(l) {
  if (!fEsLista(l)) return false;
  for (var i = 0; i < l.length; i++) if (!fEsObj(l[i]) || !l[i].id) return false;
  return true;
}
function fTodosObj(l) {
  for (var i = 0; i < l.length; i++) if (!fEsObj(l[i])) return false;
  return true;
}
function fPorId(b, m, t, ruta, conf) {
  var iB = {}, iM = {}, out = [], visto = {}, i;
  for (i = 0; i < b.length; i++) iB[b[i].id] = b[i];
  for (i = 0; i < m.length; i++) iM[m[i].id] = m[i];
  for (i = 0; i < t.length; i++) {
    var x = t[i], id = x.id; visto[id] = 1;
    if (iM[id]) out.push(fusion3(iB[id], iM[id], x, ruta + '[' + id + ']', conf));
    else if (iB[id]) { if (!fIgual(iB[id], x)) { out.push(x); conf.push(ruta + '[' + id + ']'); } }
    else out.push(x);
  }
  for (i = 0; i < m.length; i++) {
    var y = m[i];
    if (visto[y.id]) continue;
    if (iB[y.id]) { if (!fIgual(iB[y.id], y)) { out.push(y); conf.push(ruta + '[' + y.id + ']'); } }
    else out.push(y);
  }
  return out;
}
/* Servicios: no tienen id, pero cada fila es "tal servicio" (la primera
   limpieza, la segunda…). Se juntan fila por fila con esa clave (el detalle
   y el precio son parte de la fila): si dos equipos corrigen la misma fila
   no queda duplicada. */
function fClavesServ(l) {
  var n = {}, out = [];
  for (var i = 0; i < l.length; i++) {
    var x = l[i] || {}, k = fClavePac(x.nom);
    n[k] = (n[k] || 0) + 1; out.push(k + '#' + n[k]);
  }
  return out;
}
function fServicios(b, m, t, ruta, conf) {
  var kb = fClavesServ(b), km = fClavesServ(m), kt = fClavesServ(t), iB = {}, iM = {}, out = [], visto = {}, i;
  for (i = 0; i < b.length; i++) iB[kb[i]] = b[i];
  for (i = 0; i < m.length; i++) iM[km[i]] = m[i];
  for (i = 0; i < t.length; i++) {
    var k = kt[i]; visto[k] = 1;
    if (iM[k]) out.push(fusion3(iB[k], iM[k], t[i], ruta + '[' + k + ']', conf));
    else if (iB[k]) { if (!fIgual(iB[k], t[i])) { out.push(t[i]); conf.push(ruta + '[' + k + ']'); } }
    else out.push(t[i]);
  }
  for (i = 0; i < m.length; i++) {
    var k2 = km[i]; if (visto[k2]) continue;
    if (iB[k2]) { if (!fIgual(iB[k2], m[i])) { out.push(m[i]); conf.push(ruta + '[' + k2 + ']'); } }
    else out.push(m[i]);
  }
  return out;
}
/* Listas sin id (servicios, antecedentes, profesionales): cada elemento
   cuenta cuántas veces está. Lo que agregaron los dos a la vez es el mismo
   agregado (no se duplica); lo que agregó uno solo se suma; lo que sacó uno
   se saca. */
function fMulti(b, m, t) {
  var cB = {}, cM = {}, cT = {}, orden = [], visto = {}, i, k, x;
  function contar(l, c) { for (var q = 0; q < l.length; q++) { var kk = JSON.stringify(l[q]); c[kk] = (c[kk] || 0) + 1; if (!visto[kk]) { visto[kk] = l[q]; orden.push(kk); } } }
  contar(t, cT); contar(m, cM); contar(b, cB);
  var out = [];
  for (i = 0; i < orden.length; i++) {
    k = orden[i];
    var dm = (cM[k] || 0) - (cB[k] || 0), dt = (cT[k] || 0) - (cB[k] || 0), d;
    if (dm > 0 && dt > 0) d = Math.max(dm, dt);
    else if (dm < 0 && dt < 0) d = Math.min(dm, dt);
    else d = dm + dt;
    var n = Math.max(0, (cB[k] || 0) + d);
    for (x = 0; x < n; x++) out.push(visto[k]);
  }
  return out;
}
/* Un texto que los dos completaron: se conservan los dos agregados. Si lo
   reescribieron distinto, quedan los dos (una nota clínica no se pierde). */
function fTexto3(b, m, t) {
  b = String(b == null ? '' : b); m = String(m == null ? '' : m); t = String(t == null ? '' : t);
  if (b && m.indexOf(b) === 0 && t.indexOf(b) === 0) {
    var extra = m.slice(b.length);
    return t.indexOf(extra) >= 0 ? t : t + extra;
  }
  return fJuntarTexto(t, m);
}
/* b = base (lo que tenía este equipo al empezar), m = lo mío, t = lo del servidor */
function fusion3(b, m, t, ruta, conf) {
  if (fIgual(m, t)) return m;
  if (fIgual(m, b)) return t;
  if (fIgual(t, b)) return m;
  if (fEsObj(m) && fEsObj(t)) {
    var bb = fEsObj(b) ? b : {}, out = {}, ks = {}, k;
    for (k in bb) if (Object.prototype.hasOwnProperty.call(bb, k)) ks[k] = 1;
    for (k in m) if (Object.prototype.hasOwnProperty.call(m, k)) ks[k] = 1;
    for (k in t) if (Object.prototype.hasOwnProperty.call(t, k)) ks[k] = 1;
    for (k in ks) {
      var v = fCampo(k, bb[k], m[k], t[k], ruta ? ruta + '.' + k : k, conf);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (fEsLista(m) && fEsLista(t)) {
    var bL = fEsLista(b) ? b : [];
    if (fConId(m) && fConId(t) && fConId(bL)) return fPorId(bL, m, t, ruta, conf);
    if (m.length === t.length && m.length === bL.length && fTodosObj(m) && fTodosObj(t) && fTodosObj(bL)) {
      var o2 = [];
      for (var i = 0; i < m.length; i++) o2.push(fusion3(bL[i], m[i], t[i], ruta + '[' + i + ']', conf));
      return o2;
    }
    return fMulti(bL, m, t);
  }
  conf.push(ruta);
  return m;
}
function fCampo(k, b, m, t, ruta, conf) {
  if (fIgual(m, t)) return m;
  if (fIgual(m, b)) return t;
  if (fIgual(t, b)) return m;
  /* marcas de tiempo: la más nueva */
  if (/^(ts|.*Ts)$/.test(k) && typeof m === 'string' && typeof t === 'string') return m > t ? m : t;
  if (FUSION_TEXTO[k] && typeof m !== 'object' && typeof t !== 'object') {
    var tx = fTexto3(b, m, t);
    if (tx !== String(m == null ? '' : m)) conf.push(ruta);
    return tx;
  }
  /* una visita que ya se atendió no vuelve a "no vino" desde una pantalla vieja */
  if (k === 'estado' && (m === 'Atendido' || t === 'Atendido')) { conf.push(ruta); return 'Atendido'; }
  /* sesiones de un plan marcadas desde dos equipos: cada atención ocupa su
     propia sesión, no se pisan */
  if (k === 'sesiones' && fEsLista(m) && fEsLista(t)) return fSesiones(fEsLista(b) ? b : [], m, t, ruta, conf);
  if (k === 'servicios' && fEsLista(m) && fEsLista(t)) return fServicios(fEsLista(b) ? b : [], m, t, ruta, conf);
  return fusion3(b, m, t, ruta, conf);
}
function fSesiones(b, m, t, ruta, conf) {
  var out = [], i, j, usadas = {}, n = Math.max(b.length, m.length, t.length);
  for (i = 0; i < t.length; i++) if (t[i] && t[i].atencionId) usadas[t[i].atencionId] = 1;
  var pend = [];
  for (i = 0; i < n; i++) {
    var bi = b[i], mi = m[i], ti = t[i];
    if (mi === undefined && ti === undefined) continue;
    if (mi === undefined) { if (bi !== undefined && fIgual(ti, bi)) continue; out.push(ti); continue; }
    if (ti === undefined) { if (bi !== undefined && fIgual(mi, bi)) continue; out.push(mi); continue; }
    if (fIgual(mi, bi) || fIgual(mi, ti)) { out.push(ti); continue; }
    if (fIgual(ti, bi)) {
      if (mi.atencionId && usadas[mi.atencionId] && ti.atencionId !== mi.atencionId) { out.push(ti); continue; }
      out.push(mi); continue;
    }
    if (mi.atencionId && ti.atencionId && mi.atencionId !== ti.atencionId) {
      out.push(ti);
      if (!usadas[mi.atencionId]) pend.push(mi);
      continue;
    }
    out.push(fusion3(bi, mi, ti, ruta + '[' + i + ']', conf));
  }
  /* la atención que quedó sin lugar ocupa la primera sesión libre */
  for (i = 0; i < pend.length; i++) {
    for (j = 0; j < out.length; j++) {
      if (out[j] && !out[j].hecha && !out[j].atencionId) {
        var o = fCopia(out[j]); o.hecha = true; o.fecha = pend[i].fecha; o.atencionId = pend[i].atencionId;
        out[j] = o; break;
      }
    }
    if (j === out.length) conf.push(ruta);
  }
  return out;
}
/* ---- la plata de una atención ----
   A cuenta = cobro inicial + cobros posteriores (con id). Al juntar, el cobro
   inicial y la deuda perdonada se deciden campo a campo; los cobros
   posteriores se unen por id; y recién ahí se vuelven a armar el a cuenta, el
   desglose por método y el saldo. Así nada se cuenta dos veces. */
function fNum(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function fR(n) { return Math.round(n * 100) / 100; }
function fCobrosPost(r) { return fEsLista(r && r.cobrosPosteriores) ? r.cobrosPosteriores : []; }
function fPorMetodo(lista, signo, acc) {
  for (var i = 0; i < lista.length; i++) {
    var p = lista[i]; if (!p || !p.metodo) continue;
    acc[p.metodo] = fR((acc[p.metodo] || 0) + signo * fNum(p.monto));
  }
  return acc;
}
function fListaMetodos(acc) {
  var ks = [], k, out = [];
  for (k in acc) if (Object.prototype.hasOwnProperty.call(acc, k) && acc[k] > 0.004) ks.push(k);
  ks.sort();
  for (var i = 0; i < ks.length; i++) out.push({metodo: ks[i], monto: acc[ks[i]]});
  return out;
}
function fDesarmar(r) {
  r = r || {};
  var cp = fCobrosPost(r), sumaCp = 0, i;
  for (i = 0; i < cp.length; i++) sumaCp += fNum(cp[i] && cp[i].monto);
  var pagos = fEsLista(r.pagos) && r.pagos.length ? r.pagos
    : (r.metodo && r.metodo !== 'Mixto' && fNum(r.acuenta) > 0 ? [{metodo: r.metodo, monto: fNum(r.acuenta)}] : []);
  var ini = fListaMetodos(fPorMetodo(cp, -1, fPorMetodo(pagos, 1, {})));
  var o = {}, k;
  for (k in r) if (Object.prototype.hasOwnProperty.call(r, k) && k !== '__alta') o[k] = r[k];
  delete o.acuenta; delete o.saldo; delete o.pagos; delete o.metodo;
  /* el cobro del día de la atención es UNA cosa: monto y forma de pago van juntos */
  o.__cobro = {monto: fR(fNum(r.acuenta) - sumaCp), pagos: ini,
    metodo: (!pagos.length && !cp.length) ? (r.metodo || '') : ''};
  o.__perdon = fR(fNum(r.total) - fNum(r.acuenta) - fNum(r.saldo));
  /* con servicios, el total es servicios menos el descuento */
  if (fEsLista(r.servicios) && r.servicios.length) { delete o.total; o.__desc = fR(fSumaSrv(r) - fNum(r.total)); }
  return o;
}
function fArmar(o) {
  var cp = fCobrosPost(o), sumaCp = 0, i, c = o.__cobro || {monto: 0, pagos: [], metodo: ''};
  for (i = 0; i < cp.length; i++) sumaCp += fNum(cp[i] && cp[i].monto);
  var acc = {}, ini = c.pagos || [];
  for (i = 0; i < ini.length; i++) acc[ini[i].metodo] = fNum(ini[i].monto);
  var pagos = fListaMetodos(fPorMetodo(cp, 1, acc));
  var r = {}, k;
  for (k in o) if (Object.prototype.hasOwnProperty.call(o, k) && k.indexOf('__') !== 0) r[k] = o[k];
  if (fEsLista(o.servicios) && o.servicios.length) r.total = fR(Math.max(0, fSumaSrv(o) - fNum(o.__desc)));
  else if (r.total === undefined) r.total = 0;
  r.acuenta = fR(fNum(c.monto) + sumaCp);
  r.pagos = pagos;
  r.metodo = pagos.length > 1 ? 'Mixto' : (pagos.length ? pagos[0].metodo : (c.metodo || ''));
  r.saldo = fR(fNum(r.total) - r.acuenta - fNum(o.__perdon));
  if (r.saldo < 0 && fNum(o.__perdon) > 0) r.saldo = fR(Math.max(0, r.saldo));
  return r;
}
function fSumaSrv(r) {
  var l = fEsLista(r && r.servicios) ? r.servicios : [], s = 0;
  for (var i = 0; i < l.length; i++) s += fNum(l[i] && l[i].precio) * (fNum(l[i] && l[i].cant) || 1);
  return fR(s);
}
function fUnirCobros(a, b) {
  var out = [], ids = {}, l = fCobrosPost(a).concat(fCobrosPost(b)), i;
  for (i = 0; i < l.length; i++) { var x = l[i]; if (x && x.id) { if (ids[x.id]) continue; ids[x.id] = 1; } out.push(x); }
  return out;
}
/* ¿Dos doctoras atendieron la misma cita (cada una en su equipo)? Son dos
   visitas. Corregir la doctora de una atención ya cargada no lo es. */
function fOtraDoctora(b, m, t) {
  if (!b || !m || !t) return false;
  if (fEstadoN(b.estado) !== 'Agendada' || m.estado !== 'Atendido' || t.estado !== 'Atendido') return false;
  var pm = String(m.profesional || ''), pt = String(t.profesional || '');
  return pm !== pt && pm !== 'Por definir' && pt !== 'Por definir' && !!pm && !!pt;
}
function fSlug(s) { return fClavePac(s).replace(/[^a-z0-9]+/g, ''); }
/* Una atención.
   - base = lo que el equipo vio en el servidor: junta campo por campo.
   - base null = un alta que se reintenta o un pendiente de la versión
     anterior: vale lo de este equipo, pero los cobros de otros se conservan. */
function fusionRegistro(b, m, t, conf) {
  if (!t) return m;
  if (!b) {
    var dm = fDesarmar(m), dtt = fDesarmar(t);
    /* una visita ya atendida en el servidor no vuelve atrás por un pendiente
       viejo; y la plata nunca baja sin aviso */
    if (t.estado === 'Atendido' && m.estado !== 'Atendido') dm = dtt;
    else if (fNum(dtt.__cobro.monto) > fNum(dm.__cobro.monto)) dm.__cobro = dtt.__cobro;
    dm.cobrosPosteriores = fUnirCobros(t, m);
    return fArmar(dm);
  }
  var dB = fDesarmar(b), dM = fDesarmar(m), dT = fDesarmar(t);
  var o = fusion3(dB, dM, dT, '', conf);
  /* dos equipos anotaron un cobro inicial distinto para la misma visita:
     queda el primero, coherente, y la diferencia anotada para conciliar */
  if (!fIgual(dM.__cobro, dB.__cobro) && !fIgual(dT.__cobro, dB.__cobro) && !fIgual(dM.__cobro, dT.__cobro)) {
    o.__cobro = dT.__cobro;
    var desc = [], pm = dM.__cobro.pagos || [];
    for (var i = 0; i < pm.length; i++) desc.push(pm[i].metodo + ' ' + pm[i].monto);
    o.obs = String(o.obs || '') + (o.obs ? '\n' : '') + '⚠ Conciliar: otro equipo anotó un cobro inicial de ' + fNum(dM.__cobro.monto) + (desc.length ? ' (' + desc.join(', ') + ')' : '') + ' que no se sumó.';
    conf.push('__cobro');
  }
  return fArmar(o);
}
/* Lo que mira un borrado para saber si la atención cambió desde que se la
   vio: plata, estado, de quién es y las notas. */
var FUSION_CLAVE_BORRAR = ['fecha', 'paciente', 'profesional', 'estado', 'total', 'acuenta', 'saldo', 'servicios', 'cobrosPosteriores', 'planId', 'obs'];
function fEstadoN(e) { return {'Agendado': 'Agendada', 'Reagendar': 'Reprogramó'}[e] || e; }
function fCambioParaBorrar(base, actual) {
  for (var i = 0; i < FUSION_CLAVE_BORRAR.length; i++) {
    var k = FUSION_CLAVE_BORRAR[i], a = base[k], b = actual[k];
    if (k === 'estado') { a = fEstadoN(a); b = fEstadoN(b); }
    if (k === 'obs') { a = String(a == null ? '' : a).trim(); b = String(b == null ? '' : b).trim(); }
    if (!fIgual(a, b)) return true;
  }
  return false;
}
/* Clave de la ficha: sin tildes, sin espacios dobles, en minúsculas. */
function fClavePac(n) {
  var t = String(n == null ? '' : n);
  if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return t.replace(/\s+/g, ' ').trim().toLowerCase();
}
/* Dos filas de ficha que son la misma persona escrita distinto ("María
   Pérez" y "Maria Perez"): se juntan sin perder nada. Si dicen cosas
   distintas, se muestran las dos: una alergia nunca puede quedar oculta. */
function fPartes(x) {
  var p = String(x).split(/\s*(?:,|;|\/|\n| y )\s*/), out = [];
  for (var i = 0; i < p.length; i++) { var q = fClavePac(p[i]); if (q) out.push(q); }
  return out;
}
function fJuntarTexto(a, b) {
  a = String(a == null ? '' : a).trim(); b = String(b == null ? '' : b).trim();
  if (!a) return b; if (!b) return a;
  if (a === b || a.indexOf(b) >= 0) return a;
  if (b.indexOf(a) >= 0) return b;
  /* "Penicilina, Látex" y "látex": lo de uno ya está en el otro */
  var pa = fPartes(a), pb = fPartes(b), i, falta = [], partesB = String(b).split(/\s*(?:,|;|\/|\n)\s*/);
  for (i = 0; i < pb.length; i++) if (pa.indexOf(pb[i]) < 0) { falta = null; break; }
  if (falta !== null) return a;
  var todasA = true;
  for (i = 0; i < pa.length; i++) if (pb.indexOf(pa[i]) < 0) { todasA = false; break; }
  if (todasA) return b;
  falta = [];
  for (i = 0; i < partesB.length; i++) { var c = fClavePac(partesB[i]); if (c && pa.indexOf(c) < 0) falta.push(partesB[i].trim()); }
  return falta.length ? a + ' / ' + falta.join(', ') : a;
}
function fusionarFichas(a, b) {
  if (!a) return b; if (!b) return a;
  var nuevo = String(a.ts || '') >= String(b.ts || '') ? a : b, viejo = nuevo === a ? b : a;
  var ma = nuevo.med || {}, mb = viejo.med || {}, med = {}, k;
  for (k in mb) if (Object.prototype.hasOwnProperty.call(mb, k)) med[k] = mb[k];
  for (k in ma) if (Object.prototype.hasOwnProperty.call(ma, k)) med[k] = ma[k];
  med.alergias = fJuntarTexto(ma.alergias, mb.alergias);
  med.medicacion = fJuntarTexto(ma.medicacion, mb.medicacion);
  med.notas = fJuntarTexto(ma.notas, mb.notas);
  var ant = [], vistos = {};
  [].concat(ma.antecedentes || [], mb.antecedentes || []).forEach(function (x) { if (!vistos[x]) { vistos[x] = 1; ant.push(x); } });
  med.antecedentes = ant;
  med.consent = !!(ma.consent || mb.consent);
  med.consentTs = ma.consentTs || mb.consentTs || '';
  var planes = [], ids = {};
  [].concat(nuevo.planes || [], viejo.planes || []).forEach(function (p) {
    if (p && p.id && ids[p.id]) return; if (p && p.id) ids[p.id] = 1; planes.push(p);
  });
  return {nombre: nuevo.nombre || viejo.nombre, nac: nuevo.nac || viejo.nac || '', med: med, planes: planes, ts: nuevo.ts || viejo.ts || ''};
}
/* La base de un alta todavía no confirmada lleva esta marca: si el alta ya
   llegó, es la base para juntar; si no llegó, se crea. */
function fSinAlta(b) {
  if (!b || !b.__alta) return b;
  var o = {}, k;
  for (k in b) if (Object.prototype.hasOwnProperty.call(b, k) && k !== '__alta') o[k] = b[k];
  return o;
}

/* Claves de fábrica (las que traía el panel antes de cambiarlas): sirven
   para entrar, pero no para corregir cobros. */
var ADMIN_FABRICA = 'ca8e9b091bc87bdd52becab004bb12c828d57ca200de2027531eec59097b947a';
var EQUIPO_FABRICA = 'd5f70f16d1284a10785f81bfdb3ce58c629c9137ebf5db3f1ebe7ab151ef4580';
/* En Spadental corrige cobros solo la dueña. */
var CORRIGEN = ['admin'];
/* En Spadental también las doctoras registran anticipos (de sus pacientes). */
var ANTICIPO_DOCTORAS = true;
/* La clínica de este script (la misma etiqueta que usa su panel). Un registro
   marcado con la otra clínica se rechaza: si alguna vez se cruzan una
   dirección o un respaldo, no se mezclan las planillas. Lo viejo sin
   etiqueta se acepta como siempre. */
/* Qué versión de este archivo está publicada: se ve en «info», sin clave,
   para confirmar que se pegó y se publicó como «Nueva versión». */
var VERSION_SCRIPT = '2026-10-19-b';
var CLINICA_ID = 'spadental';
function deOtraClinica(r) { return !!(r && r.clinicaId && r.clinicaId !== CLINICA_ID); }
/* =====================================================================
   IDENTIDAD Y PERMISOS (versión 6)
   Antes las claves se comparaban solo en el navegador y el servidor
   aceptaba cualquier escritura. Ahora:
   - Los verificadores de las claves viven en las propiedades del script,
     nunca en la configuración que se le manda al panel.
   - Entrar con la clave abre una sesión de 30 minutos (se renueva sola
     mientras se usa). Toda escritura sin sesión se rechaza.
   - El servidor sabe quién es cada sesión (dueña, recepción o una doctora)
     y frena lo que no le toca, aunque alguien saltee los botones.
   - Las claves de fábrica sirven para entrar, no para corregir cobros.
   ===================================================================== */
var AUTH_V = 1;
var SESION_SEG = 1800;
var K_VERIF = 'VERIF_CLAVES';

function shaHex(s) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  var h = '';
  for (var i = 0; i < b.length; i++) { var x = (b[i] + 256) % 256; h += (x < 16 ? '0' : '') + x.toString(16); }
  return h;
}
function hashOk(h) { return typeof h === 'string' && /^[0-9a-f]{64}$/.test(h); }

/* Los verificadores: {admin, equipo, prof:{nombre: hash}}. La primera vez se
   copian de la configuración vieja (que el panel guardaba a la vista); de ahí
   en más, las claves se cambian solo por la acción "clave". La configuración
   vieja conserva sus hashes para poder volver a la versión anterior. */
function leerVerif() {
  var props = PropertiesService.getScriptProperties();
  var t = props.getProperty(K_VERIF), v = null;
  try { v = t ? JSON.parse(t) : null; } catch (e) { v = null; }
  if (v && hashOk(v.admin) && hashOk(v.equipo)) { if (!v.prof) v.prof = {}; return v; }
  var cfg = leerCfg() || {};
  v = { admin: hashOk(cfg.adminHash) ? cfg.adminHash : ADMIN_FABRICA,
        equipo: hashOk(cfg.passHash) ? cfg.passHash : EQUIPO_FABRICA, prof: {} };
  var cp = cfg.clavesProf || {};
  for (var p in cp) if (Object.prototype.hasOwnProperty.call(cp, p) && hashOk(cp[p])) v.prof[p] = cp[p];
  props.setProperty(K_VERIF, JSON.stringify(v));
  return v;
}
function guardarVerif(v) { PropertiesService.getScriptProperties().setProperty(K_VERIF, JSON.stringify(v)); }
function esDeFabrica(h) { return h === ADMIN_FABRICA || h === EQUIPO_FABRICA; }

/* Lo que se le manda al panel: sin ningún material de claves. */
/* Antes de entrar (sin sesión): sin metas ni comisiones. Va marcada
   «parcial» para que el panel no la tome como si se hubieran borrado. */
var CFG_PRIVADOS = ['metaMes', 'comision', 'comisionDefault', 'comisionDescuentaLab'];
function cfgSinSesion(cfg) {
  var o = cfgPublica(cfg); if (!o) return o;
  for (var i = 0; i < CFG_PRIVADOS.length; i++) delete o[CFG_PRIVADOS[i]];
  o.parcial = true;
  return o;
}
function cfgPublica(cfg) {
  if (!cfg) return cfg;
  var o = {}, k;
  for (k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) o[k] = cfg[k];
  delete o.adminHash; delete o.passHash; delete o.clavesProf;
  var v = leerVerif(), con = [];
  for (k in v.prof) if (Object.prototype.hasOwnProperty.call(v.prof, k)) con.push(k);
  o.credServidor = true;
  o.clavesProfHay = con;
  o.pagoPlanDoctoras = true;
  o.paquetes = true;
  return o;
}
/* Una configuración que llega del panel no puede tocar las claves. */
function cfgSinClaves(cfg, guardada) {
  if (!cfg) return cfg;
  var o = {}, k;
  for (k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) o[k] = cfg[k];
  delete o.credServidor; delete o.clavesProfHay; delete o.pagoPlanDoctoras; delete o.paquetes; delete o.parcial;
  delete o.adminHash; delete o.passHash; delete o.clavesProf;
  if (guardada !== undefined) {
    /* la config guardada lleva siempre las claves vigentes: si algún día se
       vuelve a la versión anterior del script, las de todas siguen andando */
    var v = leerVerif(), cp = {};
    o.adminHash = v.admin; o.passHash = v.equipo;
    for (k in v.prof) if (Object.prototype.hasOwnProperty.call(v.prof, k)) cp[k] = v.prof[k];
    o.clavesProf = cp;
  }
  return o;
}

/* ---- sesiones ---- */
function cache() { return CacheService.getScriptCache(); }
function nuevaSesion(s) {
  var tok = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  cache().put('S_' + tok, JSON.stringify(s), SESION_SEG);
  return tok;
}
function sesionDe(tok) {
  if (typeof tok !== 'string' || !/^[0-9a-f]{64}$/.test(tok)) return null;
  var t = cache().get('S_' + tok); if (!t) return null;
  var s = null; try { s = JSON.parse(t); } catch (e) { return null; }
  /* la clave pudo cambiar desde que se abrió: la sesión vieja ya no vale */
  var v = leerVerif(), h = s.rol === 'admin' ? v.admin : (s.rol === 'equipo' ? v.equipo : v.prof[s.prof]);
  if (!h || h !== s.h) { cache().remove('S_' + tok); return null; }
  cache().put('S_' + tok, t, SESION_SEG);   // se renueva mientras se usa
  return s;
}

function doLogin(body) {
  var c = cache(), fallas = Number(c.get('LOGIN_FALLAS') || 0);
  if (fallas >= 40) return { ok: false, error: 'muchos_intentos' };
  var clave = String(body.clave || '');
  if (!clave) return { ok: false, error: 'clave_incorrecta' };
  var h = shaHex(clave), v = leerVerif(), s = null;
  if (h === v.admin) s = { rol: 'admin', prof: '' };
  else {
    for (var p in v.prof) if (Object.prototype.hasOwnProperty.call(v.prof, p) && v.prof[p] === h) { s = { rol: 'doctora', prof: p }; break; }
    if (!s && h === v.equipo) s = { rol: 'equipo', prof: '' };
  }
  if (!s) { c.put('LOGIN_FALLAS', String(fallas + 1), 600); return { ok: false, error: 'clave_incorrecta' }; }
  s.h = h; s.fabrica = esDeFabrica(h);
  var tok = nuevaSesion(s);
  /* pagoPlan: este script acepta los pagos de plan que carga la doctora */
  return { ok: true, token: tok, ttl: SESION_SEG, rol: s.rol, prof: s.prof, fabrica: s.fabrica, pagoPlan: true, paquetes: true };
}

/* Cambiar una clave: la dueña cambia cualquiera; recepción, la suya
   (diciendo la actual). Nunca dos personas con la misma clave. */
function doCambiarClave(body, ses) {
  var quien = body.quien, nueva = String(body.clave || ''), v = leerVerif();
  var c = cache(), fallas = Number(c.get('LOGIN_FALLAS') || 0), propia = quien === 'equipo' && ses.rol === 'equipo';
  if (nueva.length < 6) return { ok: false, error: 'clave_corta' };
  if (propia) {
    if (fallas >= 40) return { ok: false, error: 'muchos_intentos' };
    if (shaHex(String(body.vieja || '')) !== v.equipo) { c.put('LOGIN_FALLAS', String(fallas + 1), 600); return { ok: false, error: 'clave_incorrecta' }; }
  } else if (ses.rol !== 'admin') return { ok: false, error: 'sin_permiso' };
  var h = shaHex(nueva);
  if (esDeFabrica(h)) return { ok: false, error: 'clave_de_fabrica' };
  var usadas = [];
  if (quien !== 'admin') usadas.push(v.admin);
  if (quien !== 'equipo') usadas.push(v.equipo);
  for (var p in v.prof) if (Object.prototype.hasOwnProperty.call(v.prof, p) && !(quien === 'prof' && p === body.prof)) usadas.push(v.prof[p]);
  if (usadas.indexOf(h) >= 0) {
    /* a recepción no se le dice de quién es: sería una forma de adivinar
       la clave de la dueña. Cuenta como intento fallido. */
    if (propia) { c.put('LOGIN_FALLAS', String(fallas + 1), 600); return { ok: false, error: 'clave_no_permitida' }; }
    return { ok: false, error: 'clave_repetida' };
  }
  var cfg = leerCfg() || {};
  if (quien === 'admin') { v.admin = h; cfg.adminHash = h; }
  else if (quien === 'equipo') { v.equipo = h; cfg.passHash = h; }
  else if (quien === 'prof' && body.prof) {
    v.prof[body.prof] = h; cfg.clavesProf = cfg.clavesProf || {}; cfg.clavesProf[body.prof] = h;
  } else return { ok: false, error: 'pedido_invalido' };
  guardarVerif(v);
  /* la config vieja guarda el mismo hash, por si hay que volver a la versión anterior */
  if (cfg.precios && cfg.canales) PropertiesService.getScriptProperties().setProperty(K_CFG, JSON.stringify(cfgSinClaves(cfg, cfg)));
  return { ok: true };
}

/* ---- qué puede tocar una doctora ---- */
/* Un anticipo suyo, a su nombre. El pago de un plan lo puede cargar
   siempre: es plata de ese tratamiento, no un anticipo suelto. */
function anticipoDeDoctora(r, ses) {
  if (!r || r.anticipoPor !== ses.prof) return false;
  /* el pago a un plan: el plan tiene que existir en la ficha de ese paciente y ser suyo */
  if (r.planId) return planDeLaDoctora(r, ses.prof);
  return ANTICIPO_DOCTORAS;
}
function planDeLaDoctora(r, prof) {
  var clave = fClavePac(r.paciente), sh = getSheetPac(), n = sh.getLastRow();
  if (n < 2 || !clave) return false;
  var filas = sh.getRange(2, 1, n - 1, COLS_PAC.length).getValues();
  for (var i = 0; i < filas.length; i++) {
    if (!filas[i][0] || fClavePac(filas[i][0]) !== clave) continue;
    var ps = pacienteDeFila(filas[i]).planes || [];
    for (var j = 0; j < ps.length; j++) if (ps[j] && ps[j].id === r.planId) return !!ps[j].deClinica || duenoPlanSrv(ps[j], filasPacSrv(clave)) === prof;
  }
  return false;
}
function efectivoCobrado(r) {
  var favor = 0, ps = (r && r.pagos) || [];
  for (var i = 0; i < ps.length; i++) if (ps[i] && ps[i].metodo === 'Saldo a favor') favor += Number(ps[i].monto) || 0;
  return (Number(r && r.acuenta) || 0) - favor;
}
/* Lo que le queda a favor a un paciente en total: lo que dejó (anticipos y
   pagos a planes) menos lo que usó con «Saldo a favor». */
function creditoPacienteSrv(clave) {
  var sh = getSheet(), n = sh.getLastRow(), t = 0;
  if (n < 2 || !clave) return 0;
  var filas = sh.getRange(2, 1, n - 1, COLS.length).getValues();
  for (var i = 0; i < filas.length; i++) {
    if (!filas[i][0] || fClavePac(filas[i][6]) !== clave) continue;
    var r = registroDeFila(filas[i]);
    if (r.estado === 'Anticipo') { t += Number(r.acuenta) || 0; continue; }
    var ps = r.pagos || [];
    for (var j = 0; j < ps.length; j++) if (ps[j] && ps[j].metodo === 'Saldo a favor') t -= Number(ps[j].monto) || 0;
  }
  return Math.round(t * 100) / 100;
}
function cobroBaja(prev, nuevo) {
  if ((Number(nuevo.acuenta) || 0) < (Number(prev.acuenta) || 0) - 0.009) return true;
  var ids = {}, cn = fCobrosPost(nuevo), cp = fCobrosPost(prev), i;
  for (i = 0; i < cn.length; i++) if (cn[i] && cn[i].id) ids[cn[i].id] = 1;
  for (i = 0; i < cp.length; i++) if (cp[i] && cp[i].id && !ids[cp[i].id]) return true;
  return false;
}
function profDeOtra(r, ses) {
  var p = String((r && r.profesional) || '');
  return !!p && p !== 'Por definir' && p !== ses.prof;
}
function doctoraPuedeGuardar(r, actual, ses, separa) {
  if (ses.rol !== 'doctora') return true;
  if (r.estado === 'Anticipo' || (actual && actual.estado === 'Anticipo')) {
    return anticipoDeDoctora(r, ses) && (!actual || anticipoDeDoctora(actual, ses));
  }
  if (separa) return !profDeOtra(r, ses);           // la segunda doctora de una misma cita: queda como visita propia
  if (actual && profDeOtra(actual, ses)) return false;
  return !profDeOtra(r, ses);
}

/* =====================================================================
   CORREGIR COBRO
   Corrige el cobro del día de la atención (el inicial), incluso de un
   histórico importado. No es un pago nuevo: no toca la caja de hoy, cambia
   lo que entró ese día. Queda la historia en la atención y, aparte, en la
   hoja _Correcciones, que ninguna otra acción toca.
   ===================================================================== */
var HOJA_CORR = '_Correcciones';
var METODOS_CAJA = ['Efectivo', 'QR', 'Tarjeta', 'Transferencia'];
var COLS_CORR = ['Corregido', 'Clave de pedido', 'ID atención', 'Paciente', 'Fecha atención',
  'Cobrado antes', 'Cobrado después', 'Forma antes', 'Forma después', 'Motivo', 'Responsable'];
function hojaCorr() {
  var ss = getSpreadsheet(), sh = ss.getSheetByName(HOJA_CORR);
  if (!sh) { sh = ss.insertSheet(HOJA_CORR); sh.getRange(1, 1, 1, COLS_CORR.length).setValues([COLS_CORR]); }
  return sh;
}
function correccionYaHecha(idem) {
  var sh = hojaCorr(), n = sh.getLastRow();
  if (n < 2) return false;
  var l = sh.getRange(2, 2, n - 1, 1).getValues();
  for (var i = 0; i < l.length; i++) if (String(l[i][0]) === String(idem)) return true;
  return false;
}
function responsableDe(ses) {
  if (ses.rol === 'admin') return 'Dueña (clave de administradora)';
  if (ses.rol === 'equipo') return 'Recepción (clave compartida del equipo)';
  return ses.prof || 'Doctora';
}
function textoPagos(c) {
  var l = (c && c.pagos) || [], out = [];
  for (var i = 0; i < l.length; i++) out.push(l[i].metodo + ' ' + l[i].monto);
  return out.join(' + ') || (c && c.metodo) || 'sin desglose';
}
function filaPorId(sh, id) {
  var n = sh.getLastRow(); if (n < 2) return 0;
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function doCorregirCobro(c, ses) {
  if (CORRIGEN.indexOf(ses.rol) < 0) return { ok: false, error: 'sin_permiso' };
  if (ses.fabrica) return { ok: false, error: 'clave_de_fabrica' };
  if (!c || !c.id || !c.idem) return { ok: false, error: 'pedido_invalido' };
  var motivo = String(c.motivo || '').trim();
  if (motivo.length < 5) return { ok: false, error: 'falta_motivo' };
  if (typeof c.monto !== 'number' || !isFinite(c.monto) || c.monto < 0) return { ok: false, error: 'monto_invalido' };
  var monto = c.monto;
  monto = fR(monto);
  var sh = getSheet(), fila = filaPorId(sh, c.id);
  if (!fila) return { ok: false, error: 'borrada', id: c.id };
  var actual = registroDeFila(sh.getRange(fila, 1, 1, COLS.length).getValues()[0]);
  /* un reintento (doble clic, se cortó la respuesta) no corrige dos veces */
  if (correccionYaHecha(c.idem)) return { ok: true, repetida: true, registro: actual };
  if (actual.estado !== 'Atendido') return { ok: false, error: 'no_corregible', registro: actual };
  /* versión: si otro equipo cobró o corrigió desde que se abrió, no se pisa */
  /* las atenciones viejas tienen un único método suelto: se leen igual que en el panel */
  var pagosV = fEsLista(actual.pagos) && actual.pagos.length ? actual.pagos
    : (actual.metodo && actual.metodo !== 'Mixto' && fNum(actual.acuenta) > 0 ? [{ metodo: actual.metodo, monto: fNum(actual.acuenta) }] : []);
  var ver = { acuenta: fR(fNum(actual.acuenta)), saldo: fR(fNum(actual.saldo)),
    pagos: fListaMetodos(fPorMetodo(pagosV, 1, {})), ncp: fCobrosPost(actual).length,
    ncorr: (actual.correccionesCobro || []).length };
  if (!c.version || !fIgual(ver, c.version)) return { ok: false, error: 'conflicto', registro: actual };
  var d = fDesarmar(actual), ant = d.__cobro;
  /* lo pagado con saldo a favor no se corrige acá: es del anticipo */
  var favor = 0, i, nuevos = [], suma = 0;
  for (i = 0; i < ant.pagos.length; i++) if (ant.pagos[i].metodo === 'Saldo a favor') favor = fR(favor + ant.pagos[i].monto);
  var desg = c.pagos;
  if (desg !== null && !fEsLista(desg)) return { ok: false, error: 'pedido_invalido' };
  if (desg) for (i = 0; i < desg.length; i++) {
    var p = desg[i], m = fR(fNum(p && p.monto));
    if (!p || METODOS_CAJA.indexOf(p.metodo) < 0 || typeof p.monto !== 'number' || !isFinite(p.monto) || m < 0) return { ok: false, error: 'pedido_invalido' };
    if (m > 0) { nuevos.push({ metodo: String(p.metodo), monto: m }); suma = fR(suma + m); }
  }
  if (desg && Math.abs(suma - monto) > 0.009) return { ok: false, error: 'desglose_no_cuadra' };
  if (favor > 0) nuevos.push({ metodo: 'Saldo a favor', monto: favor });
  d.__cobro = { monto: fR(monto + favor), pagos: fListaMetodos(fPorMetodo(nuevos, 1, {})), metodo: '' };
  var r = fArmar(d), sumaCp = 0, cps = fCobrosPost(actual);
  for (i = 0; i < cps.length; i++) sumaCp = fR(sumaCp + fNum(cps[i] && cps[i].monto));
  /* no se puede cobrar más de lo que debía pagar (el total menos el descuento) */
  if (fR(monto + favor + sumaCp) > fR(fNum(r.total) - Math.max(0, fNum(d.__perdon))) + 0.009) return { ok: false, error: 'supera_total', registro: actual };
  var antes = { cobrado: fR(fNum(ant.monto) - favor), forma: textoPagos({ pagos: (function () {
    var o = []; for (var j = 0; j < ant.pagos.length; j++) if (ant.pagos[j].metodo !== 'Saldo a favor') o.push(ant.pagos[j]); return o; })(), metodo: ant.metodo }),
    acuenta: fNum(actual.acuenta), saldo: fNum(actual.saldo) };
  var despues = { cobrado: monto, forma: desg ? textoPagos({ pagos: nuevos.filter(function (x) { return x.metodo !== 'Saldo a favor'; }) }) : 'sin desglose',
    acuenta: fNum(r.acuenta), saldo: fNum(r.saldo) };
  var ts = new Date().toISOString(), resp = responsableDe(ses);
  r.correccionesCobro = (actual.correccionesCobro || []).concat([{ id: c.idem, ts: ts, por: resp, motivo: motivo,
    antes: antes, despues: despues }]);
  /* un cobro importado sin forma de pago sigue sin forma: no se inventa */
  if (!desg && !favor) r.metodo = '';
  sh.getRange(fila, 1, 1, COLS.length).setValues([filaDeRegistro(r)]);
  hojaCorr().appendRow([ts, String(c.idem), actual.id, actual.paciente || '', actual.fecha || '',
    antes.cobrado, despues.cobrado, antes.forma, despues.forma, motivo, resp]);
  return { ok: true, registro: registroDeFila(sh.getRange(fila, 1, 1, COLS.length).getValues()[0]) };
}

/* =====================================================================
   PASAR AL PAQUETE
   Una atención se cargó con el paquete entero (ej. blanqueamiento de 3
   sesiones, Bs 700) y en realidad fue la sesión 1. La atención queda con el
   precio de esa sesión y lo cobrado de más pasa a ser pago del paquete: un
   pago al plan por cada día y forma de pago en que entró. La caja de cada día
   no cambia; la comisión de esa doctora es solo por su sesión. Todo en una
   sola llamada (con el candado), y queda en _Correcciones.
   ===================================================================== */
function doPasarAlPlan(c, ses) {
  if (!c || !c.id || !c.idem || !c.planId || !fEsLista(c.servicios) || !c.servicios.length) return { ok: false, error: 'pedido_invalido' };
  if (ses.fabrica) return { ok: false, error: 'clave_de_fabrica' };
  var sh = getSheet(), fila = filaPorId(sh, c.id);
  if (correccionYaHecha(c.idem)) {
    var ya = [], n0 = sh.getLastRow();
    if (n0 >= 2) {
      var l0 = sh.getRange(2, 1, n0 - 1, COLS.length).getValues();
      for (var y = 0; y < l0.length; y++) if (String(l0[y][0]).indexOf(c.idem + '-') === 0) ya.push(registroDeFila(l0[y]));
    }
    return { ok: true, repetida: true, registro: fila ? registroDeFila(sh.getRange(fila, 1, 1, COLS.length).getValues()[0]) : null, anticipos: ya };
  }
  if (!fila) return { ok: false, error: 'borrada', id: c.id };
  var actual = registroDeFila(sh.getRange(fila, 1, 1, COLS.length).getValues()[0]);
  if (deOtraClinica(actual)) return { ok: false, error: 'otra_clinica' };
  if (actual.estado !== 'Atendido') return { ok: false, error: 'no_corregible', registro: actual };
  if (ses.rol === 'doctora' && actual.profesional !== ses.prof) return { ok: false, error: 'sin_permiso' };
  var clave = fClavePac(actual.paciente), plan = null;
  planesGuardados(clave).forEach(function (p) { if (p && p.id === c.planId) plan = p; });
  if (!plan) return { ok: false, error: 'sin_plan' };
  if (ses.rol === 'doctora' && !plan.deClinica && duenoPlanSrv(plan, filasPacSrv(clave)) !== ses.prof) return { ok: false, error: 'sin_permiso' };
  /* versión: si otro equipo cobró o corrigió desde que se abrió, no se pisa */
  if (c.version && (fR(fNum(actual.acuenta)) !== fR(fNum(c.version.acuenta)) || fCobrosPost(actual).length !== fNum(c.version.ncp)))
    return { ok: false, error: 'conflicto', registro: actual };
  var srv = [];
  for (var i = 0; i < c.servicios.length; i++) {
    var x = c.servicios[i];
    if (!x || !x.nom || !isFinite(Number(x.precio)) || Number(x.precio) < 0 || !isFinite(Number(x.cant || 1)) || Number(x.cant || 1) <= 0) return { ok: false, error: 'pedido_invalido' };
    srv.push(x);
  }
  var d = fDesarmar(actual);
  d.servicios = srv;
  d.planId = c.planId;
  if (c.etapa) d.planEtapa = Number(c.etapa) || '';
  var r = fArmar(d);
  if (fNum(r.total) > fNum(actual.total) + 0.009) return { ok: false, error: 'sube_total', registro: actual };
  var perdon = Math.max(0, fNum(d.__perdon));
  var resto = fR(fNum(r.acuenta) - (fNum(r.total) - perdon)), trozos = [];
  if (resto > 0.009) {
    var cps = fCobrosPost(d).map(function (p, k) { var o = JSON.parse(JSON.stringify(p)); o.__k = k; return o; });
    var ini = d.__cobro.pagos.map(function (p) { return { metodo: p.metodo, monto: fNum(p.monto) }; });
    var tomar = function (o, fecha) {
      var t = fR(Math.min(resto, fNum(o.monto))); if (t <= 0) return;
      o.monto = fR(fNum(o.monto) - t); resto = fR(resto - t);
      if (o.metodo !== 'Saldo a favor') trozos.push({ fecha: fecha, metodo: o.metodo, monto: t });
    };
    /* primero lo pagado con saldo a favor (vuelve solo a donde estaba) */
    ini.forEach(function (o) { if (resto > 0.009 && o.metodo === 'Saldo a favor') tomar(o, actual.fecha); });
    cps.forEach(function (o) { if (resto > 0.009 && o.metodo === 'Saldo a favor') tomar(o, o.fecha); });
    /* después lo más nuevo: los cobros posteriores, y al final el del día */
    cps.slice().sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')) || b.__k - a.__k; })
      .forEach(function (o) { if (resto > 0.009) tomar(o, o.fecha || actual.fecha); });
    ini.slice().reverse().forEach(function (o) { if (resto > 0.009) tomar(o, actual.fecha); });
    if (resto > 0.009) return { ok: false, error: 'no_cuadra', registro: actual };
    var sacadoIni = 0;
    d.__cobro.pagos.forEach(function (p, k) { sacadoIni = fR(sacadoIni + fNum(p.monto) - ini[k].monto); });
    d.__cobro = { monto: fR(fNum(d.__cobro.monto) - sacadoIni), pagos: ini.filter(function (p) { return p.monto > 0.004; }), metodo: d.__cobro.metodo };
    d.cobrosPosteriores = cps.filter(function (p) { return fNum(p.monto) > 0.004; }).map(function (p) { delete p.__k; return p; });
    r = fArmar(d);
  }
  if (fNum(r.saldo) < -0.009) return { ok: false, error: 'no_cuadra', registro: actual };
  /* un pago al plan por día y forma de pago */
  var porDia = {}, orden = [];
  trozos.forEach(function (t) { var k = t.fecha + '|' + t.metodo; if (!porDia[k]) { porDia[k] = { fecha: t.fecha, metodo: t.metodo, monto: 0 }; orden.push(k); } porDia[k].monto = fR(porDia[k].monto + t.monto); });
  var ts = new Date().toISOString(), resp = responsableDe(ses), movido = 0, nuevos = [];
  orden.forEach(function (k, j) {
    var t = porDia[k]; movido = fR(movido + t.monto);
    nuevos.push({ id: c.idem + '-' + (j + 1), clinicaId: CLINICA_ID, ts: ts, fecha: t.fecha, hora: actual.hora || '',
      profesional: '', paciente: actual.paciente, celular: actual.celular || '', estado: 'Anticipo', origen: '',
      servicios: [], total: 0, acuenta: t.monto, saldo: 0, metodo: t.metodo, pagos: [{ metodo: t.metodo, monto: t.monto }],
      cobrosPosteriores: [], cobroInicialFechado: true, planId: c.planId, desdeAtencion: actual.id,
      anticipoPor: actual.profesional || (ses.rol === 'admin' ? 'Dueña' : (ses.rol === 'equipo' ? 'Recepción' : ses.prof)),
      obs: 'Venía junto con la atención del ' + String(actual.fecha || '').split('-').reverse().join('/') });
  });
  var motivo = 'Pasado al paquete «' + String(plan.nombre || '') + '»: la atención queda en Bs ' + fNum(r.total) +
    (movido > 0 ? ' y Bs ' + movido + ' quedan como pago del paquete' : '');
  var antes = { cobrado: fNum(actual.acuenta), forma: textoPagos(actual), acuenta: fNum(actual.acuenta), saldo: fNum(actual.saldo) };
  var despues = { cobrado: fNum(r.acuenta), forma: textoPagos(r), acuenta: fNum(r.acuenta), saldo: fNum(r.saldo) };
  r.correccionesCobro = (actual.correccionesCobro || []).concat([{ id: c.idem, ts: ts, por: resp, motivo: motivo, antes: antes, despues: despues, paquete: true }]);
  sh.getRange(fila, 1, 1, COLS.length).setValues([filaDeRegistro(r)]);
  nuevos.forEach(function (a) { sh.appendRow(filaDeRegistro(a)); });
  hojaCorr().appendRow([ts, String(c.idem), actual.id, actual.paciente || '', actual.fecha || '',
    antes.cobrado, despues.cobrado, antes.forma, despues.forma, motivo, resp]);
  return { ok: true, registro: registroDeFila(sh.getRange(fila, 1, 1, COLS.length).getValues()[0]),
    anticipos: nuevos.map(function (a) { return registroDeFila(filaDeRegistro(a)); }), movido: movido };
}

/* ------------------------------------------------------------------ HTTP */
function json(obj) {
  if (obj && typeof obj === 'object') { obj.v = FUSION_V; obj.auth = AUTH_V; }
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (err) { return json({ ok: false, error: 'ocupado' }); }
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var reg = body.registro || body.pedido || {};
    if (body.action === 'info') return json(doInfo());
    if (body.action === 'login') return json(doLogin(body));
    /* Solo la configuracion: el list arrastra miles de atenciones y tarda
       segundos. Sin material de claves. */
    if (body.action === 'cfgGet') return json({ ok: true, cfg: sesionDe(body.token) ? cfgPublica(leerCfg()) : cfgSinSesion(leerCfg()) });
    /* De acá para abajo, leer pacientes o escribir: sin sesión válida no se
       ve ni se toca nada (un panel viejo, o alguien que encontró la dirección,
       queda afuera). */
    var ses = sesionDe(body.token);
    if (!ses) return json({ ok: false, error: 'sin_sesion' });
    /* los pacientes tampoco se leen sin sesión */
    if (body.action === 'list') return json(doList(ses));
    /* base ausente = panel de una versión anterior: escribe como siempre.
       base null = alta nueva (o cola vieja): se junta igual con lo que haya. */
    var base = Object.prototype.hasOwnProperty.call(body, 'base') ? body.base : undefined;
    if (['save', 'delete', 'pac', 'egreso', 'egresoDel'].indexOf(body.action) >= 0 && deOtraClinica(reg))
      return json({ ok: false, error: 'otra_clinica' });
    if (body.action === 'bulk' && (body.registros || []).some(deOtraClinica)) return json({ ok: false, error: 'otra_clinica' });
    if (body.action === 'save') return json(doSave(reg, base, ses));
    if (body.action === 'delete') return json(doDelete(reg, base, ses));
    if (body.action === 'bulk') return json(doBulk(body.registros || [], ses));
    if (body.action === 'cfg' && ses.rol === 'doctora') return json({ ok: false, error: 'sin_permiso' });
    if (body.action === 'cfg') return json(doGuardarCfg(body.cfg, base));
    if (body.action === 'clave') return json(doCambiarClave(body, ses));
    if (body.action === 'corregirCobro') return json(doCorregirCobro(body.correccion, ses));
    if (body.action === 'pasarAlPlan') return json(doPasarAlPlan(body.pase, ses));
    if (body.action === 'pac') return json(doGuardarPac(reg, base, ses));
    if ((body.action === 'egreso' || body.action === 'egresoDel') && ses.rol === 'doctora') return json({ ok: false, error: 'sin_permiso' });
    if (body.action === 'egreso') return json(doGuardarEgreso(reg, base));
    if (body.action === 'egresoDel') return json(doBorrarEgreso(reg, base));
    return json({ ok: false, error: 'accion_desconocida' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return json(doInfo());
}

function doInfo() {
  var ss = getSpreadsheet();
  return { ok: true, planilla: ss.getName(), filas: Math.max(0, getSheet().getLastRow() - 1), seguridad: AUTH_V, version: VERSION_SCRIPT };
}

/**
 * Ejecutá esta función una vez desde el editor (botón ▶ Ejecutar) para
 * autorizar los permisos y ver en qué planilla está guardando.
 * El enlace aparece abajo, en "Registro de ejecución".
 */
function probar() {
  var info = doInfo();
  Logger.log('Planilla: ' + info.planilla);
  Logger.log('Abrila acá: ' + getSpreadsheet().getUrl());
  Logger.log('Atenciones guardadas: ' + info.filas);
  return info;
}
