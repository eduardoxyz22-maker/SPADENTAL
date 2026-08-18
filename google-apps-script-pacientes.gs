/**
 * SPADENTAL · Backend de pacientes.html sobre Google Sheets
 * ---------------------------------------------------------
 * Pegá TODO este archivo en Extensiones → Apps Script de una hoja de cálculo
 * nueva, y publicalo como aplicación web (ver SETUP-GOOGLE-SHEETS-SPADENTAL.md).
 *
 * Acciones que entiende:
 *   {action:'list'}                  → {ok:true, registros:[...]}
 *   {action:'save',  registro:{…}}   → {ok:true, registro:{…}}   (crea o actualiza por id)
 *   {action:'delete',registro:{id}}  → {ok:true}
 *   {action:'bulk',  registros:[…]}  → {ok:true, agregados, actualizados, total}
 *   {action:'info'}                  → {ok:true, planilla, url, filas}
 */

var HOJA = 'Atenciones';

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
  'Cómo llegó', 'Agendó por', 'Viene de cita', 'Resuelta el'
];

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
    r.origen || '', r.agendaPor || '', r.citaDe || '', r.resueltaTs || ''
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
  return {
    id: f[0], ts: f[1], fecha: formatoFecha(f[2]), hora: f[3], nroDia: f[4],
    profesional: f[5], paciente: f[6], celular: String(f[7] || ''), ci: String(f[8] || ''),
    edad: String(f[9] || ''), tipo: f[10], canal: f[11], canalDetalle: f[12],
    servicios: servicios,
    total: Number(f[14]) || 0, acuenta: Number(f[15]) || 0, saldo: Number(f[16]) || 0,
    metodo: f[17], estado: f[18], prox: formatoFecha(f[19]), proxHora: f[20],
    proxMotivo: f[21], contactado: String(f[22]).toUpperCase() === 'SÍ' || String(f[22]).toUpperCase() === 'SI',
    obs: f[23], pagos: pagos,
    origen: f[30] || '', agendaPor: f[31] || '', citaDe: f[32] || '', resueltaTs: f[33] || ''
  };
}

/* Google a veces devuelve las fechas como objeto Date: las volvemos YYYY-MM-DD */
function formatoFecha(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v);
}

/* ---------------------------------------------------------------- acciones */
function doList() {
  var sh = getSheet();
  var n = sh.getLastRow();
  if (n < 2) return { ok: true, registros: [] };
  var filas = sh.getRange(2, 1, n - 1, COLS.length).getValues();
  var out = [];
  for (var i = 0; i < filas.length; i++) {
    if (!filas[i][0]) continue;
    out.push(registroDeFila(filas[i]));
  }
  return { ok: true, registros: out };
}

function doSave(r) {
  if (!r || !r.id) return { ok: false, error: 'sin_id' };
  var sh = getSheet();
  var n = sh.getLastRow();

  // Busca si el registro ya existe y, de paso, cuenta los del mismo día.
  var destino = 0, nroGuardado = 0, cuantas = 0, maxNro = 0;
  if (n >= 2) {
    var datos = sh.getRange(2, 1, n - 1, 5).getValues(); // ID · ts · Fecha · Hora · N° del día
    for (var j = 0; j < datos.length; j++) {
      if (datos[j][0] === r.id) {
        destino = j + 2;
        nroGuardado = Number(datos[j][4]) || 0;
        continue;
      }
      if (r.fecha && formatoFecha(datos[j][2]) === r.fecha) {
        cuantas++;
        maxNro = Math.max(maxNro, Number(datos[j][4]) || 0);
      }
    }
  }

  // N° del día: lo asigna el servidor para que no se repita entre celulares.
  // Es el mayor entre (cuántas atenciones ya hay ese día) y (el N° más alto usado).
  if (destino && nroGuardado && !r.nroDia) {
    r.nroDia = nroGuardado;                       // editar no cambia el número
  } else if (!r.nroDia || (!destino && r.nroDia <= maxNro)) {
    r.nroDia = Math.max(cuantas, maxNro) + 1;     // alta nueva o número ya tomado
  }

  var fila = filaDeRegistro(r);
  if (destino) sh.getRange(destino, 1, 1, COLS.length).setValues([fila]);
  else sh.appendRow(fila);

  return { ok: true, registro: r };
}

/**
 * Carga muchas atenciones de una sola vez (se usó para subir el histórico
 * de los cuadernos de enero a julio). Escribe todo con un solo setValues,
 * así que entran cientos de filas en una llamada.
 * Los que ya existen por id se actualizan; los nuevos se agregan.
 */
function doBulk(lista) {
  if (!lista || !lista.length) return { ok: true, agregados: 0, actualizados: 0 };
  var sh = getSheet();
  var n = sh.getLastRow();

  var filaPorId = {};
  if (n >= 2) {
    var ids = sh.getRange(2, 1, n - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0]) filaPorId[ids[i][0]] = i + 2;
    }
  }

  var nuevas = [], actualizados = 0;
  for (var k = 0; k < lista.length; k++) {
    var r = lista[k];
    if (!r || !r.id) continue;
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

function doDelete(r) {
  if (!r || !r.id) return { ok: false, error: 'sin_id' };
  var sh = getSheet();
  var n = sh.getLastRow();
  if (n < 2) return { ok: true };
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === r.id) { sh.deleteRow(i + 2); return { ok: true }; }
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ HTTP */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (err) { return json({ ok: false, error: 'ocupado' }); }
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var reg = body.registro || body.pedido || {};
    if (body.action === 'list') return json(doList());
    if (body.action === 'save') return json(doSave(reg));
    if (body.action === 'delete') return json(doDelete(reg));
    if (body.action === 'bulk') return json(doBulk(body.registros || []));
    if (body.action === 'info') return json(doInfo());
    return json({ ok: false, error: 'accion_desconocida' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'info') return json(doInfo());
  return json(doList());
}

function doInfo() {
  var ss = getSpreadsheet();
  return { ok: true, planilla: ss.getName(), url: ss.getUrl(), filas: Math.max(0, getSheet().getLastRow() - 1) };
}

/**
 * Ejecutá esta función una vez desde el editor (botón ▶ Ejecutar) para
 * autorizar los permisos y ver en qué planilla está guardando.
 * El enlace aparece abajo, en "Registro de ejecución".
 */
function probar() {
  var info = doInfo();
  Logger.log('Planilla: ' + info.planilla);
  Logger.log('Abrila acá: ' + info.url);
  Logger.log('Atenciones guardadas: ' + info.filas);
  return info;
}
