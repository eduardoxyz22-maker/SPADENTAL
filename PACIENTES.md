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
2. **Paciente** — nombre, celular, CI y **fecha de nacimiento** (la edad se
   calcula sola: la fecha no envejece). Si el paciente ya vino antes, al
   escribir el nombre **se autocompletan sus datos**, se marca como
   *Recurrente* y avisa cuántas visitas tiene y si debe algo.
   Si tiene **alergias, medicación o antecedentes** cargados, aparece un
   **aviso rojo acá mismo**, antes de tocar al paciente. Los dos botones al
   pie del bloque abren su **ficha médica** y sus **planes de tratamiento**.
3. **¿Por dónde nos encontró?** — el dato clave: Facebook, Instagram, TikTok,
   WhatsApp, Google/Maps, Referido, Pasó por el local, Volante, Otro. Más un
   campo de detalle libre (*qué campaña*, *quién lo refirió*).
4. **Servicios realizados** — se eligen de la lista de precios del consultorio.
   Cada servicio tiene un botón **🦷 Marcar piezas** que abre el odontograma:
   se tocan las piezas que se trataron y quedan guardadas con el servicio (ya
   no hace falta escribirlas en el detalle). Mientras se eligen, las piezas que
   ya tienen trabajo hecho se ven en verde.
   Si el paciente tiene un **plan de tratamiento activo**, aparece un selector
   para marcar que esta visita es una sesión del plan: al guardar se marca
   hecha la sesión que seguía y lo cobrado va contra el saldo del plan.
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
(botón *Abrir WhatsApp* o *Copiar texto*), y debajo las **📋 indicaciones de
cuidado** que correspondan a lo que se le hizo —extracción, endodoncia,
blanqueamiento, ortodoncia, limpieza, restauraciones, placas o estética—, con
su propio botón para mandarlas aparte. Se pueden volver a abrir después desde
la ficha de la atención. El texto se edita en *Ajustes → Indicaciones
post-tratamiento*.

### 📅 Agenda
**Acá trabajan las doctoras todos los días.** Tiene tres partes, en este orden:

1. **⚠ Quedaron sin marcar** — citas de días anteriores que nadie cerró.
   Aparecen arriba de todo y en rojo: mientras estén así no cuentan ni como
   asistidas ni como faltas, y la medición queda coja.
0. **Choques de horario** — al agendar o reprogramar, si esa doctora ya tiene
   otra cita cerca de esa hora, el panel avisa y pide confirmación antes de
   guardar (se puede agendar igual: a veces se hace a propósito). En la agenda
   del día las citas que se pisan salen marcadas en rojo con **⚠ choca con…**.
   La ventana se configura en *Ajustes → Duración estimada de una cita*.
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

Al agendar se pueden anotar los **servicios previstos** ("¿qué se le va a
hacer?"). No es un presupuesto ni un cobro: la cita sigue en Bs 0 y no toca
ninguna caja ni ningún panel. Cuando la paciente llega y se toca **✅ Vino**,
el formulario abre con esos servicios ya cargados y el total calculado, para
revisar y ajustar en vez de escribir todo de nuevo.

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
agenda, así también se mide si el paciente vino al control. Si la atención era
**sesión de un plan**, la cita nueva se lleva el enlace al plan: al atenderla
el selector ya viene marcado y esa sesión descuenta del plan sin que nadie se
acuerde de elegirlo. Lo mismo al **reprogramar**: la cita nueva conserva el
plan y los servicios previstos.

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
- **💳 Cuotas vencidas** — planes con cuotas que ya pasaron de fecha y todavía
  no están cubiertas por lo cobrado. Muestra cuántas, cuánto falta y desde
  cuándo, con el mensaje de cobro listo. Una cuota que vence **hoy** no cuenta
  como vencida: hoy todavía no es tarde.
- **⏸ Tratamientos a medio hacer** — pacientes con un **plan activo**, sin
  próxima sesión agendada y sin volver hace más de 21 días (configurable).
  No es lo mismo que uno que simplemente no vuelve: este ya dijo que sí, ya
  pagó una parte y le queda trabajo empezado. Muestra cuál es la sesión que
  sigue y cuánto debe del plan; por eso **sale de "sin volver"**, para no
  contarlo dos veces.
- **🎂 Cumpleaños** — los de los próximos días (7 por defecto), con la edad
  que cumple y el saludo de WhatsApp ya escrito. Sale de la **fecha de
  nacimiento** de la ficha: el paciente que no la tenga cargada no aparece.
- **🪥 Controles que tocan** — los que el panel deduce solo, sin que nadie los
  agende: **limpieza cada 6 meses** y **control de ortodoncia cada 30 días**,
  contados desde el último servicio de ese tipo que se hizo el paciente. Los
  vencidos salen primero y en rojo. **No aparece quien ya tiene una próxima
  cita agendada** — va a venir igual, no hay nada que recordar. Los plazos y
  el aviso se cambian en *Ajustes → Recordatorios*.
- **Todos** — todas juntas.

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
  servicios por atención, con veces y pacientes distintos, agrupado por
  categoría, y qué hace cada doctora.
  Si se cargó el **costo de laboratorio** en la lista de precios, el ranking
  pasa a ordenarse por **margen** y no por facturación, y aparecen el costo de
  laboratorio del periodo y el margen del trabajo. Es una diferencia que
  cambia decisiones: una corona de Bs 1.800 con Bs 900 de laboratorio deja
  menos que tres limpiezas de Bs 230.
- **📣 Canales** — pacientes distintos y Bs por canal, con el **Bs por paciente**
  de cada uno. Esta tabla es la que dice dónde conviene poner la publicidad.
- **👩‍⚕️ Equipo** — producción por profesional, con atenciones, pacientes,
  ticket promedio y ausentismo de cada una.
- **📆 Tiempo** — evolución mensual, día de la semana y los días de más movimiento.

### 💰 Caja
La pestaña contable. Filtrable por día, mes, año o todo:

- **Cobrado, facturado y por cobrar**, más el **efectivo** (lo que se cuenta en
  caja) separado del **QR + transferencias** (lo que tiene que estar en el banco).
- **Egresos y caja neta.** Todo lo que sale —alquiler, sueldos, laboratorio,
  insumos, publicidad, impuestos— con su categoría, a quién se le pagó y con
  qué se pagó. La **caja neta** es *cobrado − egresos*: el número que dice si
  el mes cerró en verde.
- **Liquidación de las doctoras.** Cuánto le toca a cada una según su
  porcentaje, con un botón que registra el pago como egreso. Se calcula
  **sobre lo facturado**; al lado muestra cuánto de eso se cobró de verdad,
  porque si el paciente quedó debiendo la comisión se paga igual y el
  consultorio banca el saldo hasta que entre la plata. En *Ajustes →
  Comisiones* se puede pedir que el laboratorio se descuente antes de
  calcular.
- **Cobrado por forma de pago**, con una fila de *sin identificar* que tiene que
  quedar en cero para que la conciliación cierre.
- **Arqueo día por día** — cuánto entró y salió cada día y en qué forma de
  pago. La columna **💵 En caja** es el efectivo que entró menos el que salió:
  ese es el número que tiene que dar el conteo al cerrar.
- **Cuentas por cobrar por antigüedad** — 0-30, 31-60, 61-90 y más de 90 días.
  Mira toda la historia, no solo el periodo elegido.
- **Sin forma de pago anotada** — las atenciones que rompen la conciliación,
  clicables para completarlas.
- Botón **⬇ Excel de caja**: un informe con portada (resumen con la caja neta,
  cobrado por forma de pago, egresos por categoría, liquidación de las
  doctoras, cuentas por cobrar por antigüedad y lo que falta completar) y
  cuatro hojas de detalle — movimientos, arqueo diario, egresos y saldos
  pendientes.

### 👤 Pacientes
Un registro por persona: visitas, facturado, saldo, canal por el que llegó,
última y próxima visita. Al tocar una fila se abre su **ficha completa**.

#### La ficha del paciente
Todo lo suyo en una sola pantalla, que es lo que la doctora abre antes de
atender:

- **Datos y cumpleaños** — celular, edad calculada, fecha de nacimiento, por
  qué canal llegó y desde cuándo es paciente.
- **Aviso médico en rojo** — alergias, medicación y antecedentes, arriba de
  todo. Si firmó el consentimiento, también se ve acá.
- **Visitas, facturado y saldo** de toda su historia.
- **Próxima cita** agendada (o la próxima fecha que dejó una atención).
- **Plan de tratamiento** con barra de avance, presupuesto, saldo y cuál es la
  sesión que sigue.
- **Cada visita** que hizo, clicable para abrir la atención.
- Botones para mandarle **WhatsApp**, cargarle una **nueva atención**, o abrir
  su **ficha médica** y sus **planes**.

#### 🦷 Odontograma
El mapa de la boca del paciente, con la numeración FDI de siempre: arcada
superior arriba (18→11 · 21→28) e inferior abajo (48→41 · 31→38). Las piezas
con trabajo hecho salen en verde con la cantidad de veces; **tocando una se ve
qué se le hizo, cuándo y quién**, y desde ahí se abre la atención.

- Las piezas se marcan desde cada servicio, al cargar la atención.
- **Lo que ya estaba escrito a mano se sigue leyendo**: si el detalle de un
  servicio viejo decía "pieza 26", esa pieza igual aparece en el odontograma.
  Solo se aceptan códigos que existen de verdad, así "2 caras" no inventa nada.
- Los **dientes de leche** (51-55, 61-65, 71-75, 81-85) aparecen solos cuando
  el paciente tiene algo cargado en ellos, y se pueden mostrar a mano desde el
  selector de piezas.
- Solo cuentan las visitas **atendidas**: una cita futura o cancelada no
  ensucia el odontograma.

#### 🩺 Ficha médica
Es del paciente, no de la visita: se carga una vez y queda. Fecha de
nacimiento, **alergias**, **medicación que toma**, **antecedentes** (diabetes,
hipertensión, cardiopatía, embarazo, anticoagulantes, asma, epilepsia,
hepatitis, fuma, bruxismo), notas libres y el **consentimiento informado**
—que queda marcado con la fecha en que se firmó—.

Lo que se carga acá es lo que después aparece **en rojo al abrir la atención**.

#### 🦷 Planes de tratamiento
El presupuesto que se le pasó al paciente, partido en sesiones:

- **Nombre, fecha y presupuesto total** del plan.
- **Sesiones**, una por línea. Se van marcando hechas solas a medida que se
  cargan atenciones enlazadas al plan (o a mano, con *Marcar hecha*).
  Reescribir la lista **no borra lo ya hecho**.
- **Barra de avance** con las sesiones cumplidas y el porcentaje.
- **Lo cobrado no se anota a mano**: sale de las atenciones enlazadas al plan,
  así el panel nunca dice que está pagado algo que no se cobró. El saldo es el
  presupuesto menos eso.
- **Cuotas.** Se puede armar el plan de pago: cuántas cuotas, desde cuándo y
  cada cuántos días. Si una cuota está pagada **no se guarda como pagada**: se
  deduce de lo que ya se cobró del plan, así nunca dice que entró plata que no
  entró. Las cuotas vencidas aparecen solas en Recordatorios.
- **Plantillas.** Con **💾 Plantilla** se guarda un plan que ya funcionó
  (sesiones, total y plan de pago) y al crear el siguiente se elige de la
  lista en vez de escribirlo todo de nuevo. Se administran en *Ajustes →
  Plantillas de plan*.
- Botón **📄 Presupuesto**: arma el presupuesto en el idioma del paciente
  —qué le van a hacer, en cuántas sesiones, total, a cuenta y saldo— listo
  para mandarle por WhatsApp.
- Un plan se cierra solo cuando se hicieron todas las sesiones y no queda
  saldo; también se puede dar por terminado o borrar a mano (borrar el plan
  **no toca las atenciones** ya cargadas).

Un paciente puede tener varios planes; en el formulario solo se ofrecen los
**activos**.

### ⚙️ Ajustes
- **Clave de entrada** — cambiarla y bloquear la sesión.
- **Profesionales** — vienen cargadas las 5 doctoras (Mirna, Ximena, Katherine,
  Brenda, Shirley) y **canales de captación**, editables, uno por línea.
- **Lista de precios** completa y editable, con una columna de **costo de
  laboratorio** por servicio — se pueden actualizar los precios sin tocar el
  código, y restaurar la lista original cuando haga falta.
- **Comisiones**: el porcentaje de cada doctora, uno por defecto para las que
  no tengan el suyo, y si el laboratorio se descuenta antes de calcular.
- **Plantillas de plan**: las plantillas guardadas, con opción de borrarlas.
- **Recordatorios**: con cuántos días de anticipación avisar las citas y los
  **cumpleaños**, y a los cuántos días se considera que un paciente "no vuelve".
- **Controles automáticos**: si se traen o no, cada cuántos meses toca la
  **limpieza**, cada cuántos días el **control de ortodoncia**, y con cuánta
  anticipación avisarlos.
- **Duración estimada de una cita**: la ventana que se usa para avisar cuando
  dos pacientes caen a la misma hora con la misma doctora.
- **Indicaciones post-tratamiento**: el texto de cada bloque de cuidados, con
  botón para restaurar los originales. A qué servicios corresponde cada bloque
  está definido en el código; acá se cambia qué dice.
- **Datos y respaldo**: Excel de todo, respaldo JSON y restaurar JSON.

---

## Qué se comparte entre los equipos

Con la hoja de Google conectada, **todo se comparte**: atenciones, citas,
cobros, saldos, los **egresos** (en una hoja aparte llamada *Egresos*), las
**fichas de los pacientes** (nacimiento, ficha médica y planes, en una hoja
*Pacientes*), y también los **ajustes** (lista de precios, canales,
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

De la tanda de cumpleaños, ficha médica, planes y controles:

- 28 comprobaciones de flujo real en Chromium (cargar una atención, edad
  calculada, cumpleaños de hoy y de la semana, ficha médica que avisa en rojo,
  plan que consume sesión y descuenta saldo, control vencido, ficha completa,
  y que todo sobreviva a recargar la página).
- 21 comprobaciones de borde y de que no se rompió nada de lo anterior: 29 de
  febrero en año bisiesto y en año normal, la edad el día justo del cumpleaños,
  guardar dos veces la misma atención sin consumir dos sesiones, reescribir un
  plan sin borrar lo ya hecho, y las 8 pestañas dibujándose sin errores.
- 6 comprobaciones de coherencia del plan al borrar una atención: la sesión
  vuelve a quedar pendiente, el plan se reabre y lo cobrado baja solo.
- 21 comprobaciones del circuito cita → atención: que el plan viaje a la cita
  que se crea sola y a la reprogramada, que al atenderla el selector venga
  marcado y la sesión se consuma sola, y que los servicios previstos abran el
  formulario con el total ya calculado sin haber tocado ninguna caja antes.

De la tanda de odontograma, choques, indicaciones, presupuesto y planes
frenados — 77 comprobaciones más en Chromium, sobre un servidor local:

- **Odontograma (29)**: qué códigos FDI existen y cuáles no, lectura de las
  piezas escritas a mano, el mapa juntando varias visitas con lo más reciente
  primero, las citas y canceladas quedando afuera, los 32 dientes dibujados
  (52 con los de leche), elegir y desmarcar piezas, y que todo sobreviva a
  recargar.
- **Choques (16)**: misma hora, 20 minutos después, el límite justo de la
  ventana, otra doctora, otro día, la cita consigo misma al reprogramar, las
  canceladas y las que no tienen hora; que cancelar el aviso no guarde y
  aceptarlo sí.
- **Indicaciones (17)**: que cada servicio traiga las suyas, que una consulta
  sola no traiga ninguna, y que el texto editado por el consultorio reemplace
  al de fábrica sin pisar los demás.
- **Planes frenados y presupuesto (12)**: que solo caiga quien dejó el
  tratamiento, que no se repita en "sin volver", y el presupuesto con total,
  a cuenta y saldo.
- **Ficha (3)**: el celular sale de la última visita que lo tenga anotado.

De la tanda de contabilidad — 66 comprobaciones más:

- **Egresos (13)**: alta, edición sin duplicar, borrado, filtro por periodo,
  la caja neta, el efectivo en caja descontando lo que salió en efectivo, que
  sobrevivan a recargar y que **no se cuelen entre las atenciones** ni entre
  los pacientes.
- **Laboratorio (16)**: la migración de la configuración vieja sin perder
  precios, el costo por unidad, pisarlo en una atención (incluso a 0), que el
  campo aparezca solo en los servicios que van al laboratorio, y que el
  ranking pase a ordenar por margen —una limpieza de Bs 920 de margen le gana
  a una corona de Bs 1.800 que deja 900—.
- **Liquidación (16)**: agrupación por doctora, porcentaje propio y por
  defecto, la que no asistió sin sumar, el descuento del laboratorio, el pago
  convertido en egreso, y que sin porcentajes cargados no invente montos.
- **Cuotas y plantillas (21)**: el calendario con la última cuota absorbiendo
  el redondeo, el estado deducido de lo cobrado (pagada / parcial /
  pendiente), que una cuota que vence hoy no figure vencida, que un plan
  terminado no reclame, y las plantillas aplicándose y guardándose.
- **Excel de caja**: las 5 hojas abiertas con `openpyxl`, con la caja neta,
  los egresos por categoría y la liquidación cuadrando.

Nota sobre el entorno de prueba: abriendo el archivo con `file://` en
Chromium sin perfil, el navegador a veces descarta el `localStorage` al
recargar. Se comprobó que pasa **igual con la versión anterior** a estos
cambios, así que es del navegador de prueba y no del panel; las pruebas
corren sobre un servidor local para que sean estables.
- Móvil a 390×844: sin scroll horizontal.
