/**
 * COSMETIC DENTAL & FACE CENTER · Backend de cosmetic/pacientes.html sobre Google Sheets
 * ---------------------------------------------------------
 * Pegá TODO este archivo en Extensiones → Apps Script de una hoja de cálculo
 * nueva, y publicalo como aplicación web (ver cosmetic/SETUP.md).
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
   si es un proyecto suelto, crea una llamada "Cosmetic · Pacientes" la
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
  ss = SpreadsheetApp.create('Cosmetic · Pacientes');   // proyecto suelto
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
      .setFontWeight('bold').setBackground('#C99214').setFontColor('#1E1E1E');
    sh.setFrozenRows(1);
  } else {
    // si el archivo es de una versión anterior, completa los encabezados nuevos
    var anchoActual = Math.max(sh.getLastColumn(), 1);
    var cab = sh.getRange(1, 1, 1, anchoActual).getValues()[0];
    if (cab.length < COLS.length || String(cab[0]).trim() !== COLS[0]) {
      sh.getRange(1, 1, 1, COLS.length).setValues([COLS]);
      sh.getRange(1, 1, 1, COLS.length)
        .setFontWeight('bold').setBackground('#C99214').setFontColor('#1E1E1E');
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
      .setFontWeight('bold').setBackground('#C99214').setFontColor('#1E1E1E');
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
function doGuardarPac(p, base) {
  if (!p || !p.nombre) return { ok: false, error: 'sin_nombre' };
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
  final.nombre = p.nombre;
  var fila = filaDePaciente(final);
  if (destinos.length) {
    for (var d = 0; d < destinos.length; d++) sh.getRange(destinos[d], 1, 1, COLS_PAC.length).setValues([fila]);
  } else sh.getRange(sh.getLastRow() + 1, 1, 1, COLS_PAC.length).setValues([fila]);
  return { ok: true, paciente: pacienteDeFila(fila), conflictos: conf };
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
      .setFontWeight('bold').setBackground('#C99214').setFontColor('#1E1E1E');
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
var K_CFG = 'CFG_COSMETIC';

function doGuardarCfg(cfg, base) {
  if (!cfg || !cfg.precios || !cfg.canales) return { ok: false, error: 'cfg_invalida' };
  /* con base, los ajustes de dos equipos se juntan acá adentro, sin carrera */
  if (base) {
    var actual = leerCfg();
    if (actual) cfg = fusion3(base, cfg, actual, '', []);
  }
  var props = PropertiesService.getScriptProperties();
  var texto = JSON.stringify(cfg);
  if (texto.length > 450000) return { ok: false, error: 'cfg_muy_grande' };
  props.setProperty(K_CFG, texto);
  return { ok: true, ts: cfg.ts || '', cfg: cfg };
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

function doSave(r, base) {
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
  if (destino && base !== undefined) {
    var actual = registroDeFila(sh.getRange(destino, 1, 1, COLS.length).getValues()[0]);
    var b0 = fSinAlta(base);
    if (b0 && fOtraDoctora(b0, r, actual)) {
      /* la misma cita la atendieron dos doctoras: son dos visitas, no una */
      var ids = {}, cpA = fCobrosPost(actual), q;
      for (q = 0; q < cpA.length; q++) if (cpA[q] && cpA[q].id) ids[cpA[q].id] = 1;
      var dm = fDesarmar(r), propios = [];
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
      sh.appendRow(filaDeRegistro(separada));
      return { ok: true, registro: actual, separada: registroDeFila(filaDeRegistro(separada)), conflictos: ['profesional'] };
    }
    r = fusionRegistro(b0, r, actual, conf);
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

  return { ok: true, registro: registroDeFila(fila), conflictos: conf };
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

function doDelete(r, base) {
  if (!r || !r.id) return { ok: false, error: 'sin_id' };
  var sh = getSheet();
  var n = sh.getLastRow();
  if (n < 2) return { ok: true };
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === r.id) {
      /* si desde que este equipo la vio alguien la cobró o la cambió, no se
         borra: se devuelve cómo está para que la revisen */
      if (base) {
        var actual = registroDeFila(sh.getRange(i + 2, 1, 1, COLS.length).getValues()[0]);
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

/* ------------------------------------------------------------------ HTTP */
function json(obj) {
  if (obj && typeof obj === 'object') obj.v = FUSION_V;
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
    /* base ausente = panel de una versión anterior: escribe como siempre.
       base null = alta nueva (o cola vieja): se junta igual con lo que haya. */
    var base = Object.prototype.hasOwnProperty.call(body, 'base') ? body.base : undefined;
    if (body.action === 'save') return json(doSave(reg, base));
    if (body.action === 'delete') return json(doDelete(reg, base));
    if (body.action === 'bulk') return json(doBulk(body.registros || []));
    if (body.action === 'info') return json(doInfo());
    if (body.action === 'cfg') return json(doGuardarCfg(body.cfg, base));
    /* Solo la configuracion: el list arrastra miles de atenciones y tarda
       segundos; las claves de las doctoras tienen que llegar ya. */
    if (body.action === 'cfgGet') return json({ ok: true, cfg: leerCfg() });
    if (body.action === 'pac') return json(doGuardarPac(reg, base));
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
