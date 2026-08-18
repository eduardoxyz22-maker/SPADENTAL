# Panel de pacientes · Spadental

`pacientes.html` — una sola página, sin instalar nada, para que el consultorio
de la **Dra. Mirna** registre cada visita y sepa **de dónde llegan los
pacientes**, **cuánto se cobró y cuánto falta**, y **a quién hay que volver a
contactar**.

Se abre con doble clic o desde el celular. Funciona sin internet.

**Pide una clave al entrar.** La de fábrica es `spadental2026` y se cambia desde
*Ajustes → Clave de entrada*. Se recuerda por equipo, así que la pide una sola
vez por dispositivo (el botón *🔒 Bloquear ahora* la vuelve a pedir).
Es una traba para el curioso, **no seguridad real**: quien sepa mirar el código
de la página puede saltearla. Por eso el enlace no se comparte fuera del equipo.

---

## Las 6 pestañas

### ＋ Nueva atención
El formulario del día a día, en 6 pasos:

1. **Visita** — fecha, hora, profesional y **¿cómo llegó hoy?**
   (🚶 vino sin cita / 📅 tenía cita). El **N° del día** se asigna solo y
   reinicia cada mañana.
2. **Paciente** — nombre, celular, CI, edad. Si el paciente ya vino antes,
   al escribir el nombre **se autocompletan sus datos**, se marca como
   *Recurrente* y avisa cuántas visitas tiene y si debe algo.
3. **¿Por dónde nos encontró?** — el dato clave: Facebook, Instagram, TikTok,
   WhatsApp, Google/Maps, Referido, Pasó por el local, Volante, Otro. Más un
   campo de detalle libre (*qué campaña*, *quién lo refirió*).
4. **Servicios realizados** — se eligen de la lista de precios del consultorio.
   El precio **se sugiere pero se puede pisar siempre**: manda lo que anotan
   ustedes, no la lista. Se pueden cargar varios servicios, con cantidad y
   detalle de pieza.
5. **Cobro** — Total, **A cuenta hoy** y **Saldo** (se calcula solo y también
   se puede corregir a mano). Si entró plata, aparecen los botones de
   **forma de pago** (💵 Efectivo · 📱 QR · 💳 Tarjeta · 🏦 Transferencia ·
   🧾 Mixto) y **es obligatorio marcar una** — sin ese dato la caja no cuadra
   nunca. Con *Mixto* se reparte el monto entre varias formas y el sistema
   avisa si el desglose no suma. Muestra al toque si quedó *pagado completo*,
   *pago parcial* o *sin pago*.
6. **Estado y próximo contacto** — Atendido / No asistió / Canceló / Reprogramó,
   más la **próxima cita** con hora y motivo. Todo lo que tenga próxima fecha
   entra automáticamente en Recordatorios.

Al guardar aparece un **resumen listo para mandar por WhatsApp** al paciente
(botón *Abrir WhatsApp* o *Copiar texto*).

### 📅 Agenda
**Acá trabajan las doctoras todos los días.** Tiene tres partes, en este orden:

1. **⚠ Quedaron sin marcar** — citas de días anteriores que nadie cerró.
   Aparecen arriba de todo y en rojo: mientras estén así no cuentan ni como
   asistidas ni como faltas, y la medición queda coja.
2. **Agenda del día** — las citas de la fecha elegida, ordenadas por hora, con
   botones ◀ Hoy ▶ para moverse y un filtro por profesional. Arriba, el resumen:
   cuántas hay, cuántas faltan marcar, cuántas vinieron y cuántas faltaron.
   Cada cita pendiente trae los cuatro botones — **✅ Vino** (abre la atención
   para cargar servicios y cobro), **✖ No vino**, **🚫 Canceló**,
   **🔁 Reprogramar** — y las ya resueltas muestran el desenlace, con
   **↩ Corregir** por si se marcó mal.
3. **Lo que viene** — las citas de los próximos días.

El número rojo de la pestaña cuenta **lo de hoy sin marcar más lo vencido**:
si está en cero, la agenda está al día.

Abajo del todo, el formulario para agendar una cita nueva, para cuando piden
hora por WhatsApp, por teléfono o en el mostrador. Fecha, hora, paciente, celular, profesional, motivo — y el dato
clave: **¿por dónde agendó?** (📱 WhatsApp · ☎️ Llamada · 📷 Instagram ·
👍 Facebook · 🏥 En el consultorio · Otro).

Queda como una **cita agendada**, sin servicios ni cobro todavía, y ofrece el
mensaje de confirmación listo para mandar.

> Ojo con la diferencia: **canal** es cómo nos conoció (una vez en la vida);
> **agendó por** es por dónde pidió *esta* cita. Alguien que nos conoció por
> Facebook puede agendar por WhatsApp.

Cuando una atención deja una **próxima cita**, esa cita **se crea sola** en la
agenda, así también se mide si el paciente vino al control.

### 🔔 Recordatorios
La pestaña que dice **a quién llamar hoy**. El número rojo en la pestaña avisa
cuántos hay pendientes. Cuatro listas:

- **📅 Citas** — para **avisar antes**: vencidas / de hoy / próximas, cada una
  con su mensaje de WhatsApp ya escrito. También trae **los cuatro botones para
  cerrarla**, aunque el lugar natural para marcarlas es **📅 Agenda**:
  **✅ Vino** (abre la atención para cargar lo que se hizo), **✖ No vino**,
  **🚫 Canceló** y **🔁 Reprogramar** (deja la vieja marcada y crea la nueva).
  Una cita sale de la lista solo cuando se resuelve — mandarle WhatsApp no la
  cierra, solo la marca como avisada.
- **💰 Saldos** — pacientes que deben plata, agrupados y ordenados por monto,
  con el mensaje de cobro listo.
- **😴 Sin volver** — pacientes que no vienen hace mucho y no tienen próxima
  cita agendada: la lista para reactivar.
- **Todos** — las tres juntas.

### 📋 Atenciones
Todas las visitas cargadas, filtrables por día / mes / todo y con buscador
(paciente, canal, servicio, profesional). Arriba: atenciones, cobrado,
por cobrar y ticket promedio del filtro. Botón **⬇ Descargar Excel**.

### 📊 Panel
El tablero de control del periodo elegido. Arriba, seis KPIs siempre visibles
(pacientes · nuevos · facturado · cobrado · por cobrar · no asistieron) y abajo
cinco secciones:

- **📅 Agenda** — citas agendadas, **tasa de asistencia**, no asistieron,
  cancelaron, reprogramaron y cuántos vinieron sin cita. Más:
  **por dónde agendan y quiénes cumplen** (WhatsApp vs. llamada vs. mostrador,
  con el % de asistencia de cada uno), qué días falla más la agenda, y el
  listado de los pacientes que más faltan.
- **👤 Pacientes** — nuevos vs. los que ya eran del consultorio, **reconsultas**,
  cuántos salieron **solo con la consulta**, visitas por paciente y gasto por
  paciente. Más: nuevos vs. recurrentes mes a mes, **conversión de consulta a
  tratamiento** (de los que entraron solo por consulta, cuántos se trataron),
  frecuencia de visitas y los 15 pacientes que más dejan.
- **🦷 Servicios** — servicios distintos, el que más deja, precio promedio y
  servicios por atención. Ranking por facturación con veces y pacientes
  distintos, agrupado por categoría, y qué hace cada doctora.
- **📣 Canales** — pacientes distintos y Bs por canal, con el **Bs por paciente**
  de cada uno. Esta tabla es la que dice dónde conviene poner la publicidad.
- **👩‍⚕️ Equipo** — producción por profesional, con atenciones, pacientes,
  ticket promedio y ausentismo de cada una.
- **📆 Tiempo** — evolución mensual, día de la semana y los días de más movimiento.

### 💰 Caja
La pestaña contable. Filtrable por día, mes, año o todo:

- **Cobrado, facturado y por cobrar**, más el **efectivo** (lo que se cuenta en
  caja) separado del **QR + transferencias** (lo que tiene que estar en el banco).
- **Cobrado por forma de pago**, con una fila de *sin identificar* que tiene que
  quedar en cero para que la conciliación cierre.
- **Arqueo día por día** — cuánto entró cada día y en qué forma de pago.
- **Cuentas por cobrar por antigüedad** — 0-30, 31-60, 61-90 y más de 90 días.
  Mira toda la historia, no solo el periodo elegido.
- **Sin forma de pago anotada** — las atenciones que rompen la conciliación,
  clicables para completarlas.
- Botón **⬇ Excel de caja**: un informe con portada (resumen, cobrado por forma
  de pago, cuentas por cobrar por antigüedad y lo que falta completar) y tres
  hojas de detalle — movimientos, arqueo diario y saldos pendientes.

### 👤 Pacientes
Un registro por persona: visitas, facturado, saldo, canal por el que llegó,
última y próxima visita. Al tocar una fila se abre su **historial completo**.

### ⚙️ Ajustes
- **Clave de entrada** — cambiarla y bloquear la sesión.
- **Profesionales** — vienen cargadas las 5 doctoras (Mirna, Ximena, Katherine,
  Brenda, Shirley) y **canales de captación**, editables, uno por línea.
- **Lista de precios** completa y editable — se pueden actualizar los precios
  sin tocar el código, y restaurar la lista original cuando haga falta.
- **Recordatorios**: con cuántos días de anticipación avisar, y a los cuántos
  días se considera que un paciente "no vuelve".
- **Datos y respaldo**: Excel de todo, respaldo JSON y restaurar JSON.

---

## Qué se comparte entre los equipos

Con la hoja de Google conectada, **todo se comparte**: atenciones, citas,
cobros, saldos, y también los **ajustes** (lista de precios, canales,
profesionales, días de aviso y la clave de entrada). Se cambian en un equipo
y los demás los toman solos. Si dos equipos editan lo mismo, gana el último
que guardó.

La pantalla **se refresca sola** cada 3 minutos y cada vez que se vuelve a la
pestaña — pero nunca mientras se está escribiendo una atención o con un cuadro
abierto, para no pisar lo que se está cargando. El botón **🔄 Actualizar** de
la pestaña Atenciones fuerza el refresco en el momento.

Si se corta internet, todo se guarda igual en el equipo y se manda solo cuando
vuelve la conexión.

## Dónde se guardan los datos

Por defecto, **en el navegador donde se carga** (no viaja a ningún servidor).
Es lo más simple y funciona sin internet, pero cada dispositivo tiene su propia
copia — y si se borra el historial del navegador, se borran los datos.
**Bajá el respaldo seguido** desde *Ajustes*.

Para que todo el equipo vea lo mismo desde cualquier celular, seguí
**[SETUP-GOOGLE-SHEETS-SPADENTAL.md](SETUP-GOOGLE-SHEETS-SPADENTAL.md)**: se
publica `google-apps-script-pacientes.gs` como aplicación web de Google y se
pega la URL en la variable `SHEETS_URL` del HTML. A partir de ahí todo se
sincroniza solo (y si se corta internet, encola los cambios y los manda cuando
vuelve).

## La lista de precios cargada

Sale del documento *PRECIOS DE TRATAMIENTOS ACTUALIZADOS* — 48 servicios en 6
categorías: General, Odontológico, Carillas, Coronas, Placas y Estético.

Dos casos que se resolvieron distinto al documento:

- **Cirugías** figuran como "entre Bs 500 y Bs 900". Quedó cargada en **500**
  como sugerencia; se ajusta a mano en cada atención.
- **Ortodoncia** tenía solo la cuota inicial (Bs 1.400). Se agregó
  *Ortodoncia · mensualidad* en Bs 0 para que se anote el monto que corresponda
  cada mes.

Cualquier precio se cambia desde **Ajustes → Lista de precios**, y en cada
atención se puede pisar igual.

## Privacidad

Esta página guarda datos de salud de personas. Si se sube a un sitio público,
la URL no debería compartirse fuera del equipo del consultorio, y conviene
tenerla fuera de buscadores.

---

## Verificación

- 109 comprobaciones automáticas sobre el HTML (jsdom): clave de entrada,
  alta, validación, precios editables, cálculo de saldo, recordatorios
  vencidos/hoy/próximos, reagendar, cobro de saldo, edición sin duplicar,
  panel por canal, historial, ajustes y export.
- SHA-256 propio (necesario porque `crypto.subtle` no existe al abrir el
  archivo con doble clic) contrastado contra el de Node en 10 casos, incluidos
  acentos y emojis.
- 23 comprobaciones sobre el backend de Apps Script con una hoja simulada:
  round-trip completo, N° del día correlativo, edición sin duplicar, borrado.
- Excel generado validado con `zipfile` + `openpyxl` (3 hojas: Atenciones,
  Por canal, Por servicio).
- Flujo real en navegador a 375×812 (celular) y 1280×720: sin scroll
  horizontal, todos los campos reciben el toque, sin errores de consola.
