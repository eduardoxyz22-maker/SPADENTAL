/**
 * SPADENTAL · Backend de pacientes.html sobre Google Sheets
 * ---------------------------------------------------------
 * Pegá TODO este archivo en Extensiones → Apps Script de una hoja de cálculo
 * nueva, y publicalo como aplicación web (ver SETUP-GOOGLE-SHEETS-SPADENTAL.md).
 *
 * Acciones que entiende:
 *   {action:'list'}                 → {ok:true, registros:[...]}
 *   {action:'save',  registro:{…}}  → {ok:true, registro:{…}}   (crea o actualiza por id)
 *   {action:'delete',registro:{id}} → {ok:true}
 */

var HOJA = 'Atenciones';

var COLS = [
  'ID', 'Fecha y hora', 'Fecha', 'Hora', 'N° del día', 'Profesional', 'Paciente',
  'Celular', 'CI', 'Edad', 'Tipo', 'Canal', 'Detalle canal', 'Servicios',
  'Total Bs', 'A cuenta Bs', 'Saldo Bs', 'Método', 'Estado', 'Próxima cita',
  'Hora próxima', 'Motivo próximo', 'Contactado', 'Observaciones', '_servicios_json'
];

/* ------------------------------------------------------------------ hoja */
function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
    r.contactado ? 'SÍ' : 'NO', r.obs || '', JSON.stringify(r.servicios || [])
  ];
}

function registroDeFila(f) {
  var servicios = [];
  try { servicios = JSON.parse(f[24] || '[]'); } catch (e) { servicios = []; }
  return {
    id: f[0], ts: f[1], fecha: formatoFecha(f[2]), hora: f[3], nroDia: f[4],
    profesional: f[5], paciente: f[6], celular: String(f[7] || ''), ci: String(f[8] || ''),
    edad: String(f[9] || ''), tipo: f[10], canal: f[11], canalDetalle: f[12],
    servicios: servicios,
    total: Number(f[14]) || 0, acuenta: Number(f[15]) || 0, saldo: Number(f[16]) || 0,
    metodo: f[17], estado: f[18], prox: formatoFecha(f[19]), proxHora: f[20],
    proxMotivo: f[21], contactado: String(f[22]).toUpperCase() === 'SÍ' || String(f[22]).toUpperCase() === 'SI',
    obs: f[23]
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
    return json({ ok: false, error: 'accion_desconocida' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json(doList());
}
