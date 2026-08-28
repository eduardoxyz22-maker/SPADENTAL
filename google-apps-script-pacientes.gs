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

/* Una fila por paciente: se busca por nombre, sin distinguir mayúsculas. */
function doGuardarPac(p) {
  if (!p || !p.nombre) return { ok: false, error: 'sin_nombre' };
  var sh = getSheetPac();
  var n = sh.getLastRow();
  var clave = String(p.nombre).trim().toLowerCase();
  var destino = 0;
  if (n >= 2) {
    var nombres = sh.getRange(2, 1, n - 1, 1).getValues();
    for (var i = 0; i < nombres.length; i++) {
      if (String(nombres[i][0] || '').trim().toLowerCase() === clave) { destino = i + 2; break; }
    }
  }
  var fila = filaDePaciente(p);
  if (destino) sh.getRange(destino, 1, 1, COLS_PAC.length).setValues([fila]);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, COLS_PAC.length).setValues([fila]);
  return { ok: true, paciente: p.nombre };
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

function doGuardarEgreso(e) {
  if (!e || !e.id) return { ok: false, error: 'sin_id' };
  var sh = getSheetEgr();
  var destino = filaEgresoPorId(sh, e.id);
  var fila = filaDeEgreso(e);
  if (destino) sh.getRange(destino, 1, 1, COLS_EGR.length).setValues([fila]);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, COLS_EGR.length).setValues([fila]);
  return { ok: true, egreso: e.id };
}

function doBorrarEgreso(e) {
  if (!e || !e.id) return { ok: false, error: 'sin_id' };
  var sh = getSheetEgr();
  var fila = filaEgresoPorId(sh, e.id);
  if (fila) sh.deleteRow(fila);
  return { ok: true, borrado: !!fila };
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

function doGuardarCfg(cfg) {
  if (!cfg || !cfg.precios || !cfg.canales) return { ok: false, error: 'cfg_invalida' };
  var props = PropertiesService.getScriptProperties();
  var texto = JSON.stringify(cfg);
  if (texto.length > 450000) return { ok: false, error: 'cfg_muy_grande' };
  props.setProperty(K_CFG, texto);
  return { ok: true, ts: cfg.ts || '' };
}

function leerCfg() {
  try {
    var t = PropertiesService.getScriptProperties().getProperty(K_CFG);
    return t ? JSON.parse(t) : null;
  } catch (e) { return null; }
}

/* ---------------------------------------------------------------- acciones */
function doList() {
  var sh = getSheet();
  var n = sh.getLastRow();
  if (n < 2) return { ok: true, registros: [], cfg: leerCfg(), pacientes: doListPac(), egresos: doListEgr() };
  var filas = sh.getRange(2, 1, n - 1, COLS.length).getValues();
  var out = [];
  for (var i = 0; i < filas.length; i++) {
    if (!filas[i][0]) continue;
    out.push(registroDeFila(filas[i]));
  }
  return { ok: true, registros: out, cfg: leerCfg(), pacientes: doListPac(), egresos: doListEgr() };
}

function doSave(r) {
  if (!r || !r.id) return { ok: false, error: 'sin_id' };
  var sh = getSheet();
  var n = sh.getLastRow();

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
    if (body.action === 'cfg') return json(doGuardarCfg(body.cfg));
    /* Solo la configuracion: el list arrastra miles de atenciones y tarda
       segundos; las claves de las doctoras tienen que llegar ya. */
    if (body.action === 'cfgGet') return json({ ok: true, cfg: leerCfg() });
    if (body.action === 'pac') return json(doGuardarPac(reg));
    if (body.action === 'egreso') return json(doGuardarEgreso(reg));
    if (body.action === 'egresoDel') return json(doBorrarEgreso(reg));
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
