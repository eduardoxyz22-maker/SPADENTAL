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

1. **Visita** — fecha, hora, profesional. El **N° del día** se asigna solo y
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
   se puede corregir a mano) + método de pago. Muestra al toque si quedó
   *pagado completo*, *pago parcial* o *sin pago*.
6. **Estado y próximo contacto** — Atendido / Agendado / Reagendar / No asistió,
   más la **próxima cita** con hora y motivo. Todo lo que tenga próxima fecha
   entra automáticamente en Recordatorios.

Al guardar aparece un **resumen listo para mandar por WhatsApp** al paciente
(botón *Abrir WhatsApp* o *Copiar texto*).

### 🔔 Recordatorios
La pestaña que dice **a quién llamar hoy**. El número rojo en la pestaña avisa
cuántos hay pendientes. Cuatro listas:

- **📅 Citas** — vencidas / de hoy / próximas / más adelante, cada una con su
  mensaje de WhatsApp ya escrito, botón **✓ Contactado** (la saca de la lista)
  y **🔁 Reagendar** (cambia la fecha y la vuelve a poner pendiente).
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
El tablero de control del periodo elegido:

- Pacientes atendidos · **pacientes nuevos** · facturado · cobrado · por cobrar · no asistieron.
- **¿De dónde llegan los pacientes?** — pacientes distintos y Bs facturados por
  canal, con el **Bs por paciente** de cada uno. Esta tabla es la que dice en
  qué canal conviene poner la plata de publicidad.
- **Servicios más hechos** — veces y Bs de cada tratamiento.
- Por profesional · por día de la semana · evolución mensual.

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
