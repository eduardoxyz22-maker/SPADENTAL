# Traspaso para ASTRA: paneles de pacientes Spadental y Cosmetic

Estado al 19/10/2026 (último publicado: `0a3be26`). Este documento es para seguir el trabajo sin romper nada. Leelo entero antes de tocar código.

---

## 1. Reglas del dueño (no negociables)

- **No publicar nada sin su "ok" explícito.** Antes de publicar: mostrarle cómo queda (capturas) y probar todo.
- **Las pruebas nunca tocan los servidores reales** (Apps Script de producción ni GitHub Pages). Lo único permitido contra producción: consultas de solo lectura **sin clave** (`info`, `cfgGet`, `list` → tiene que responder `sin_sesion`). Nunca usar claves reales.
- **No commitear claves en texto plano.** No recordarle que cambie claves (lo pidió explícitamente).
- No crear usuarios ni claves para doctoras de Cosmetic. No cambiar IDs de planillas. No pedir de nuevo accesos de Google ni correos.
- "Corregir cobro": solo con sesión válida; las claves de fábrica no habilitan correcciones ni mover plata. Si hay accesos compartidos, no atribuir la acción a una persona concreta.
- No cambiar ningún cobro real durante pruebas o publicación.
- Responder en español rioplatense (voseo), corto y concreto.

## 2. Qué es cada cosa

| Archivo | Qué es |
|---|---|
| `pacientes.html` | Panel de **Spadental** (claves de almacenamiento `SP_`). |
| `cosmetic/pacientes.html` | Panel de **Cosmetic** (claves `CD_`). |
| `google-apps-script-pacientes.gs` | Backend de Spadental (Apps Script sobre Google Sheets). |
| `cosmetic/google-apps-script-pacientes.gs` | Backend de Cosmetic. |
| `COORDINACION.md` | Historia de decisiones y cambios. |
| `tests/*.cjs` | Pruebas del repo (ver §7). |

- Los dos paneles son **un solo archivo HTML cada uno, JavaScript ES5**, y comparten casi todo el código. Todo cambio va **en los dos** (los bloques de planes, paquetes y Sonri son idénticos).
- Los dos `.gs` son idénticos salvo constantes de cada clínica: `K_CFG`, colores, `ADMIN_FABRICA`/`EQUIPO_FABRICA`, `CORRIGEN` (Spa `['admin']`, Cosmetic `['admin','equipo']`), `ANTICIPO_DOCTORAS` (Spa `true`, Cosmetic `false`), `CLINICA_ID`.
- La librería de fusión (`fusion3`, `fusionarFichas`, `fClavePac`…) tiene que ser **idéntica** en los 4 archivos.
- La dirección del Apps Script de cada clínica está en `SHEETS_URL` dentro de cada HTML.

## 3. Publicar

- **Rama de GitHub Pages: `claude/vibrant-gauss-rvd0wb`** (es la única rama remota). Trabajar en una rama local y, con el ok del dueño:
  `git fetch origin claude/vibrant-gauss-rvd0wb` → rebase → `git checkout claude/vibrant-gauss-rvd0wb` → `git merge --ff-only <rama>` → `git push -u origin claude/vibrant-gauss-rvd0wb` → verificar el SHA remoto con `git ls-remote`.
- Pages tarda 1–2 minutos; en las compus hay que recargar con Ctrl+F5.
- **Apps Script**: el dueño lo pega a mano (Implementar → Administrar implementaciones → ✏️ → Nueva versión). La app de Claude no abre `.gs` en el chat: mandarle una copia `.txt` de cada uno. Cada `.gs` va en el proyecto de su clínica; no cruzarlos (se nota porque la cantidad de filas de `info` cambia).
- Versión actual de ambos scripts: **`2026-10-28-nombre`** (`VERSION_SCRIPT`, visible en `info`). Si cambiás un `.gs`, subí la versión.
- Si el cambio es solo del panel, **no hace falta pegar ningún Apps Script**: decírselo.

## 4. Datos y servidor (lo mínimo para no romper)

- **`DATA`**: filas de la hoja de atenciones. Hay tres tipos:
  - **Atenciones**: `estado` `Atendido`, `No asistió`, `Canceló` o `Reprogramó`.
  - **Citas**: `estado` `Agendada`.
  - **Anticipos y pagos a planes**: `estado` `Anticipo`. Si llevan `planId`, es pago a un plan.
- Campos desconocidos de una fila van a la columna `_extra_json`.
- **`PAC`**: fichas de pacientes (`nac`, `med`, `planes`), en la hoja de Pacientes. Los planes van en `_planes_json`.
- **Borrar es definitivo** (`deleteRow`). `_Borrados` solo guarda el id y la fecha. Para recuperar algo hay que usar el historial de versiones de la planilla.
- **Borrar las atenciones o los pagos de un paciente NO borra sus planes** (viven en la ficha). Esto ya causó un paquete repetido.
- **Sesiones del servidor (v6)**:
  - `login` devuelve un token de 30 minutos guardado en CacheService. Roles: `admin`, `equipo`, `doctora`.
  - Sin token, `list` devuelve `sin_sesion` y `cfgGet` devuelve una config parcial, sin metas, comisiones ni claves.
  - `cfgPublica` agrega las marcas `pagoPlanDoctoras` y `paquetes`; el `login` las devuelve también.
- **Lo que el servidor frena**:
  - una doctora que toca lo de otra (`doctoraPuedeGuardar`, `pacienteDeOtra`, `planesSinTocarAjenos`);
  - bajar lo cobrado de una atención con un guardado común (`cobroBaja` → `cobro_baja`; para eso está `corregirCobro`, que queda en la hoja `_Correcciones`);
  - borrar un anticipo ya usado (`anticipo_usado`);
  - escribir en la otra clínica (`otra_clinica`).
- **El saldo a favor se usa una sola vez** (desde `2026-10-19-b`): en `doSave`, con el candado puesto, si la atención usa más saldo a favor del que le queda al paciente (`creditoPacienteSrv`), el servidor lo recorta (`recortarFavor`), guarda la diferencia como deuda y responde `ajusteFavor`. El panel avisa ("ya se había usado desde otro equipo").
- **Dueña de un plan sin `prof`** (`duenaPlan` en el panel = `duenoPlanSrv` en el servidor, misma regla): la que atendió más sesiones del plan (si empatan, ninguna); sin sesiones atendidas, la única doctora que atendió al paciente; si hay varias, ninguna, y se le pide a la dueña o recepción que la asigne. Una doctora solo registra pagos de un plan suyo o de la clínica (`puedePagoPlan`, igual que `anticipoDeDoctora`).
- **Cola del panel** (`queue`/`enviar`/`mandar`/`confirmado`): todo se encola primero y se manda serializado por clave. Una ficha que cambia mientras viaja se manda después con base = lo enviado.

## 5. Planes y paquetes (el circuito que más problemas dio)

### Modelo

- Plan (en la ficha):
  - `sesiones[{n, desc, precio, aparte, hecha, fecha, atencionId}]`
  - `total` (precio acordado), `cuotas`, `prof` (doctora dueña), `estado` (`activo`/`terminado`/`cancelado`)
  - `paquete: true` (opcional)
  - `deClinica: true` (opcional): sin doctora fija; lo ve cualquier doctora y cada una marca la sesión que hace. Solo la dueña o recepción lo editan o borran.
- **Atención de una sesión**: lleva `planId` y `planEtapa`. Su `total` es el precio de esa sesión, y eso es lo que cuenta para la comisión (`liquidacion` usa `total` de las filas `Atendido`; los anticipos no generan comisión).
- **Pago al plan / adelanto**: una fila `Anticipo` con `planId`. Entra a la caja el día que se paga. Las sesiones siguientes lo usan como "Saldo a favor".

### Cuentas (funciones clave)

| Función | Qué hace |
|---|---|
| `favorDeSesion(plan, r)` / `creditoParaAtencion(r)` | **Regla única del saldo a favor:** el saldo a favor de una atención paga primero su sesión; lo adelantado a un plan **paga solo sesiones de ese plan**, nunca la consulta que vino junto. `creditoParaAtencion` es lo que puede usar una atención: lo suelto + lo del plan hasta lo que falta de su sesión. La usan el cobro automático al guardar, el aviso del formulario y "Cobrar lo que debe". |
| `cobradoDeSesion(plan, r)` | De una atención, cuenta para el plan **solo lo de su sesión**. Lo cobrado paga primero lo demás de esa atención (la consulta) y recién después la sesión. Una sesión con precio 0 (planes viejos) cuenta todo lo cobrado. |
| `cobradoPlan` | Lo pagado del plan. Si no se respetara la regla de arriba, la consulta cobrada junto con la sesión 1 aparecía como pago del plan y como "saldo a favor" falso. |
| `cuentasPlan(plan)` / `cuentasPlanHtml` | En atenciones / adelantado / usado / queda. Es el recuadro "💰 Cuentas del paquete". |
| `creditosEn` | Bolsillos de saldo a favor: general y uno por plan. |
| `creditoLibre` | Saldo a favor general. |
| `creditoPara(nombre, planId)` | Lo que puede usar una sesión: general + su plan. |

### Cómo se carga hoy (lo que el dueño quiere: pocos pasos)

1. **En "Nueva atención", en la misma fila del servicio** (`paquetesDeFilas`):
   - Un servicio cuyo nombre dice "N sesiones" (o que coincide con un paquete de Ajustes) se marca solo como paquete (`SRV[i].ses`). A cualquier otro se le toca "📦 Es de varias sesiones".
   - En la fila se elige "Hoy se hizo la sesión 1" o "Hoy solo paga".
   - Al guardar se crea el paquete. **Si ya hay uno igual sin empezar, se usa ese** (`paqueteSinEmpezar`).
   - La fila pasa a valer la sesión 1. La atención se enlaza al plan, y lo que pagó de más se separa como pago del plan, con la misma forma de pago y el mismo día (`excesoAlPlanOk` + `separarExceso` en `guardarAtencion`).
   - Ejemplo: consulta 150 + paquete 700, pagó 850 → atención 384 (150 + 234) + adelanto 466.
2. **"✓ Marcar realizada"** (`atencionDePlan`/`guardarAtencionPlan`):
   - Desde el plan o la ficha, eligiendo "¿Quién la hizo?".
   - Crea la atención de esa sesión por su precio y la paga sola con el adelanto.
3. **Ajustes → 📦 Paquetes** (`guardarPaqueteTipo`, en `CFG.planesTipo` con `paquete: true`): plantillas. El precio se reparte solo con `repartirPrecio`: 700 en 3 = 234 + 233 + 233.
4. **Planes → 📦 un toque** (`crearPaquete`):
   - Si se usa desde la atención vacía, pregunta "¿Hoy se hizo la sesión 1?" (`preguntaSesionHoy`).
   - Si la respuesta es "solo paga", abre el pago y no se guarda atención.
5. **Atención ya guardada con el paquete entero**:
   - Al editarla y elegir el plan, pregunta (`paqueteAntesDeGuardar`).
   - En la sesión 1 del plan aparece "📦 Pasar al paquete". Usa la acción del servidor `pasarAlPlan`, que es atómica: baja la atención al precio de la sesión, crea un pago al plan por cada día y forma de pago, deja la caja igual y anota en `_Correcciones`. No funciona con clave de fábrica.
6. **Pacientes sin visitas** (`pacientesSinVisitas`): un paciente con ficha o pagos sigue en la lista y en el buscador aunque se le borren todas las atenciones.
7. **Avisos**: si hay dos planes iguales activos, la ficha y Planes avisan (`planesRepetidosHtml`). "🗑 Borrar plan" está en la lista de planes y dentro del plan.

### Lo que salió mal y no hay que repetir

- **Probar con el servidor instantáneo esconde problemas.** Google tarda 1–4 segundos. El arnés acepta `server.latency = 1500`: usarlo en todo flujo nuevo de plata o fichas.
- Un paquete repetido (uno viejo sin empezar + uno nuevo) hizo marcar la sesión en el equivocado: el paciente quedó debiendo y no se veía el adelanto. Ya está cubierto, pero cualquier flujo nuevo que cree planes tiene que buscar uno igual primero.
- Los textos que ve el usuario tienen que decir qué pasa con la plata: cuánto entra a la caja, cuánto queda adelantado y cuánto debe.

## 6. Sonri (asistente)

- Es un bloque idéntico en los dos paneles, entre las marcas `/* =====...\n   🦷 SONRI` y `/* ===== fin de Sonri ===== */`. El CSS empieza en `/* ===== 🦷 Sonri`.
- Tiene preguntas frecuentes (`ASIS_AYUDA`), novedades que se muestran 45 días (`ASIS_NOVEDADES`), avisos y una pregunta antes de guardar si la visita es de un plan (`asisAntesDeGuardar`).
- **El dueño pide que Sonri explique cada función nueva.** Si cambiás un circuito, actualizá sus pasos.
- No aparece en navegadores automatizados salvo que exista `window.ASIS_PRUEBA`.

## 6b. La cara nueva (bloque MODERNO)

- Va idéntico en los dos paneles: el CSS entre `/* ===== MODERNO INI` y `/* ===== MODERNO FIN ===== */` (antes de `</style></head>`), el JS entre las mismas marcas al final del último `<script>`, y en `<head>` entre `<!-- MODERNO HEAD INI -->` y `<!-- MODERNO HEAD FIN -->` (manifiesto de la app).
- **Solo pinta y lee**: envuelve funciones que ya existen (`show`, `renderMiDia`, `verPaciente`, `verPlan`, `renderCaja`, `renderPanel`, `renderSemana`, `showWhatsappModal`, `dienteHtml`, `asisSvg`…) y agrega lo suyo después. No guarda nada en la hoja ni cambia ninguna cuenta.
- Qué trae: encabezado oscuro con anillos del día; pestañas abajo en el celular (+ «Más»); Ajustes agrupados con la tarjeta «Apariencia»; tarjetas con dibujitos en Mi día; Mi día como línea de tiempo con carriles por doctora; festejo al guardar; tablas de Atenciones, Pacientes y Movimientos de caja como tarjetas en el celular; ficha nueva; plan como recorrido con barra de plata; caja por forma de pago y cierre con semáforo (lo contado queda en `localStorage`, no en la hoja); panel de la dueña con dona, top de servicios y «a esta altura del mes»; agenda semanal por horas (tocar un hueco agenda ahí); odontograma con forma de diente; Nueva atención con pasos y resumen en vivo; caras y ropa de temporada de Sonri; temas de temporada; app instalable.
- Preferencias por aparato (`<prefijo>_MD_ANIM`, `_MD_TEMP`, `_MD_CIERRE_<fecha>`). Animaciones solo bajo `body.md-anim`.
- App instalable: `pacientes.webmanifest`, `sw-pacientes.js` e `iconos/` en la raíz y en `cosmetic/`. El service worker pide siempre a la red primero (cada publicación llega sola) y guarda copia solo de `pacientes.html`, el manifiesto y los íconos; nunca toca los pedidos a Google. No se registra en `file://` (las pruebas no lo ven).
- Sonri enseña lo nuevo: entradas `md-*` en `ASIS_NOVEDADES` y preguntas nuevas en `ASIS_AYUDA` (se agregan desde el bloque MODERNO).
- Ronda 2 (más color): botones con ícono y color según el texto (`mdBoton`; el emoji del principio queda en el texto pero oculto en `span.md-emo`, y el texto va en `span.md-bt`); campos con ícono (`span.md-in`); canal y forma de pago como tarjetas; títulos de tarjeta con ícono (`.md-h`); avisos arriba a la derecha con tipo bien/mal/info; pantalla de entrada partida (`#gate.md-gate`, solo cuando no tiene `.off`); esqueleto mientras carga; «¿Quisiste decir…?» en Pacientes; recordatorios de color por tipo; panel con «De dónde vienen los nuevos» y «Mes a mes»; festejo de la meta del mes (solo dueña, una vez por mes, `_MD_META_<aaaa-mm>`); modo noche (`body.md-noche`, `_MD_NOCHE` = no/auto/si, auto de 19 a 7) y fondo con dientecitos (`_MD_FONDO`). Un `MutationObserver` le pone ícono a los botones que se agregan después.
- Ronda 3 (animaciones y optimizaciones, pensada para la compu): la pantalla entra desde el lado de su pestaña (solo al cambiar de pestaña; repintar la misma no sube arriba ni repite la entrada); la ventana se abre desde la fila/tarjeta tocada (`MD_ORIGEN`, Web Animations); el botón Guardar gira/✓/se sacude (`MD_GUARDA`: no deja tocar dos veces mientras espera a la red, se suelta solo si nada espera); los números cuentan desde el valor anterior (`MD_NUM`) y el anillo de cobrado muestra «+ Bs X»; en Mi día solo se pinta la tarjeta que cambió de estado (`mdMarcarCambios`) y lo que llegó de otra compu dice «recién llegada»; la línea «Ahora» se mueve cada minuto (`mdAhoraMueve`, `data-ini/fin` en `#md-carriles`); Sonri se duerme tras 15 min sin uso (`MD_SIESTA`); vista rápida al dejar el mouse sobre una fila de Atenciones/Pacientes (`#md-vr`, solo con mouse); el cartel «Conectado» dice si está al día con la hoja (`MD_SINC`); Atenciones y Pacientes muestran de a 50 (`mdPorPartes`, «Ver todas») y la búsqueda filtra al toque la primera letra y después espera a que pares (y marca en amarillo); aviso de versión nueva comparando el `ETag` de `pacientes.html` cada 10 min (solo en http/https; no actualiza con algo a medio cargar). Sin atajos de teclado (se descartaron).
- Cuentas del plan/paquete: `mdCuentasPlanHtml` reemplaza a `cuentasPlanHtml` (mismas cuentas de `cuentasPlan`), con barra de colores y cajas; en la ventana del plan se ocultan los 5 cuadritos de arriba (`.md-plan-kpis`) y el recorrido va antes de las cuentas.
- Ronda 4: el servicio se elige escribiendo (`mdCombo` sobre `.s-nom`, `.p-nom` y `#q-srv`: el `<select>` sigue ahí, invisible, y recibe el `change` de siempre); recomendaciones con los más recomendados a un toque (`mdTopRecomendados`, desde `presupuestos()`) y tarjetas lila; Cobro con Todo/Mitad/Nada y barra pagado/debe (`mdCobroVivo`); Recordatorios con cuadros de color que filtran al tocarlos y conteos en los filtros (`mdRecordatoriosColor`); Controles con «✓ Ya lo contacté» (se guarda SOLO en esta compu, `_MD_CTRL`, se olvida a los 120 días) y avance; Atenciones con los filtros en una barra (`#md-lfil`: los campos `#l-dia`, `#l-mes`, `#l-q` se mudan ahí; los selects quedan ocultos y se manejan con botones) y cuadros con mini gráfico y comparación con el mismo día del mes pasado (`mdCuadrosLista`). `mdReenganchar` cambia los `onchange`/`oninput` que habían quedado apuntando a las funciones originales (antes de la cara nueva), así los filtros repintan con todo lo nuevo. iPad: los campos de fecha/mes ya no se montan sobre el de al lado.
- Ronda 5: Ajustes con menú a la izquierda y una sección por vez en pantallas de 1000px o más (`mdAjLayout`/`mdAjGrupo`, `_MD_AJ`; arranca en «Tratamientos y precios»; `asisFoco` abre la sección del elemento que señala); lista de precios con buscador, categorías, guardado solo (hace clic en «Guardar precios» 0,9 s después de cambiar) y «＋ Agregar servicio» (agrega a `CFG.precios`). Agenda: en cada cita WhatsApp/Vino/No vino a la vista y el resto en «⋯ Más» (`<details class="md-mas">`), anillo del día, y el formulario «Agendar» vive en un panel lateral `#md-agendar` (la tarjeta se muda ahí con sus ids; se abre con «＋ Agendar cita», con `agendarEse`, con los huecos del calendario y con Sonri; se cierra al agendar) con horarios libres según `CFG.minCita`. Ventanas: si el contenido ya tiene «Cerrar/Cancelar» se oculta el pie repetido; la atención como recibo con sello (`mdRecibo`); «Registrar pago» con Todo/Mitad/Otro y barra (`mdPagoRapido`). Buscador con avatar, deuda, alergia, próxima cita, plan y botones Nueva atención/WhatsApp (Enter sigue abriendo la ficha). Caja: cuadros con color, arqueo en barras (últimos 14 días), liquidación con barra y tablas de a 50/31. Todo mensaje de WhatsApp (`#wa-txt`) se ve como burbuja; el texto original queda oculto y es el que se copia.
- Videos de ayuda: `videos/tutorial-1..4.mp4` (Spa) y `cosmetic/videos/tutorial-1..4.mp4` (Cosmetic; el 4 es «Cómo marcar las sesiones de un paquete»), H.264 1280×720 sin sonido, grabados del panel real con datos ficticios (guion en el scratchpad, `tutorial.js`). Se abren con `mdVideo(n)` desde Nueva atención («▶ ¿Primera vez?»), la ventana de Planes y las respuestas de Sonri que tienen video (`MD_VID_AYUDA`). El service worker no los guarda. Al cerrar la ventana el video se pausa. Si cambia mucho la pantalla, hay que volver a grabarlos.
- Sesión de un paquete marcada por la doctora (20/10): la ficha (`pac`) con la marca salía antes que la atención (`save`) y el servidor, que solo acepta la marca si ya ve esa atención de la doctora, devolvía el paquete sin marcar. Ahora `guardar()` manda primero la atención y `savePac(p, tras)` encola la ficha y la sube recién cuando terminó ese envío. En el Apps Script (`planesSinTocarAjenos`), con todas las sesiones hechas el plan ajeno o de la clínica puede pasar a «terminado» (y vuelve a «activo» si se desmarca una): **hay que pegar el .gs de las dos clínicas**; sin eso, lo único que falta es que el paquete completo diga «terminado». Prueba: `tests/auditoria/e2e-sesion-paquete.js`.
- Calendario semanal: dos citas que en el dibujo se tocarían van lado a lado (`mdCarriles`), con el nombre primero.
- Ronda 7 (22/10): «📣 Pauta por servicio» arriba del Panel, solo la dueña (`mdPauta`: pacientes nuevos del periodo × red de «¿Por dónde nos encontró?» × servicio principal de su primera visita; «dejó» = lo cobrado más lo adelantado desde que llegó; recomendación = la casilla con 2 o más pacientes que más dejó). Ventana de la atención (`mdFichaCita`, después de `mdRecibo`): estado arriba, recorrido por la cadena `citaDe`, recibo solo si hay algo cargado; si no se atendió, WhatsApp armado (`mdFcTexto`) y Reagendar / En realidad vino / Borrar aparte. Mi día: «Tu próximo paciente» (`mdProximo`, solo hoy) y `mdAtenderListo` (abre la cita como atención con el plan y la sesión elegidos, o copia la última visita). Barras apiladas («Nuevos vs. que vuelven») vuelven a sus dos colores.
- Fotos del antes y del después (22/10): sección «📸 Fotos» en la ficha (`mdFotosFicha`). El panel achica la foto (1600 px, JPEG 0,82) y arma una miniatura (≤ 45.000 caracteres) antes de mandarla. Servidor: acciones `foto`, `fotos`, `fotoVer`, `fotoCambiar`, `fotoBorrar`; los archivos van a una carpeta de Google Drive de la clínica (`FOTOS_CARPETA` en las propiedades del script) y el registro a la hoja «Fotos» (borrar = papelera de Drive + fila marcada). La doctora solo ve y carga fotos de sus pacientes (`pacienteDeOtra`) y borra solo las que cargó ella. **Necesita el permiso de Google Drive**: después de pegar el script, ejecutar `probar` una vez desde el editor y aceptar. La comparación: el par elegido a mano («⇆ Comparar con otra», `MD_CMP_PAR`, solo en este aparato); si no, el último «Después» con el «Antes» del mismo tratamiento o, si no hay, el «Antes» más reciente anterior. Desde la foto se corrige el tratamiento y el tipo (`fotoCambiar`). 
- Pestaña «📣 Pauta» (23/10): solo con la clave de pauta de Eduardo (rol `pauta`, la misma en las dos clínicas). En el `.gs` está solo su verificador (`VERIF_PAUTA`, SHA-256); la clave no está en el repo ni en Ajustes y la dueña no la ve: **se cambia solo acá** (nueva clave → nuevo verificador en los dos `.gs` → pegarlos). Ese rol solo lee: el servidor rechaza toda acción que no sea `list` y no le manda egresos; tampoco se recuerda en el equipo para entrar sin internet. En el panel (`renderPautaTab`): cohortes por mes de llegada y red (`mdPautaCohortes`: la red es la de la primera visita atendida; «Paciente antiguo» o vacío = «Sin dato»), la pauta que más rindió, los que volvieron el último mes según por dónde habían llegado, cuánto tardan en hacerse un tratamiento, los que más dejan (podio) y la tabla por servicio del rango; «Descargar para Excel» baja un CSV. El Panel de la dueña no cambia. Prueba: `tests/auditoria/e2e-pauta.js` (usa una clave de prueba).Prueba: `tests/auditoria/e2e-fotos.js` (Drive simulado en `gsserver.js`).
- Sesiones que no quedaron marcadas (caso Naisha, 20/10): en el plan y en la ficha, `avisoSinMarcar` lista las visitas guardadas con ese plan (`r.planId`) que ninguna sesión apunta (lo que dejó la falla de la doctora) y «✓ Marcar sus sesiones» las marca en orden con `marcarSesionPlan`. «🔗 Ya se hizo en una visita» (`vincularVisita`) deja elegir una visita suelta (o de un plan que ya no está) para una sesión pendiente. Ninguno cambia lo cobrado ni la caja. En `filasPlan`/`cuentasPlan`, lo adelantado cubre primero las sesiones hechas que se cobraron de menos en su atención (por ejemplo en Bs 0), salvo que esa atención misma deba (eso se cobra en la atención). «🧩 Se hizo en varias visitas» (`variasVisitas`, solo planes de una etapa y con permiso de editar el plan): se marcan las visitas y el plan queda con una sesión por visita; el importe va a la visita que trae el tratamiento entero (o a la primera) y las demás quedan incluidas (precio 0). Con eso se ocultan el aviso y el «🔗» para no elegir mal. `puedePasarAlPaquete` ya no ofrece pasar si la sesión vale el paquete entero. Caso real (Naisha): borrar el «Pago al plan» repetido y después «🧩». Prueba: `tests/auditoria/e2e-vincular-visita.js`.

- Corregir el nombre (28/10): cambiar el nombre en una atención movía solo esa visita y la historia quedaba partida; la unión de «Pacientes repetidos» dejaba la ficha vieja en la hoja (al recargar volvía con el plan copiado) y no movía las fotos. Ahora la acción del servidor `renombrar` (`doRenombrar`, con el candado) cambia el nombre en todas las filas (visitas, citas, pagos), junta las fichas en una sola fila (borra la vieja), mueve las fotos y anota en `_Correcciones` («Nombre corregido» o «Historias unidas»). No toca montos. Un mapa `RENOMBRES` (propiedad del script, 30 días) manda a la ficha nueva lo que guarde una pantalla vieja con el nombre anterior, solo si trae `base` (un alta nueva con ese nombre no se toca). En el panel: «✏️ Corregir nombre» en la ficha (`corregirNombre`; avisa si el nombre ya es de otro y une), aviso al guardar una atención con otro nombre (`nombreAntesDeGuardar`: toda la historia o «es otra persona»), `unirPacientes` usa el servidor cuando hay `CFG.renombrar`, y «Pacientes repetidos» también encuentra «un nombre contiene al otro». Con el script anterior no hace nada a medias: avisa. Prueba: `tests/auditoria/e2e-nombre.js`. Revisión de datos reales de solo lectura: `tests/auditoria/revisar-planilla.js` (clave de pauta).

## 7. Pruebas

En el repo hay tres suites. Correr siempre con un guardián que bloquee la red real:

| Suite | Verificaciones |
|---|---|
| `tests/pacientes-regression.cjs` | 130 |
| `tests/sonri-y-permisos.cjs` | 61 (permisos del servidor por clínica, Sonri, cola) |
| `tests/apps-script-en-memoria.cjs` | el `.gs` real corriendo en memoria |

**`tests/auditoria/`**: la auditoría completa del panel contra el `.gs` real en memoria, en las dos clínicas. Ver su `README.md`.
- s08b–s22 cubren anticipos, corregir cobro, planes, pagos de doctoras, editar sumando pago, servidor, paquetes, script viejo, paquete desde la atención, sin visitas, borrar pago, paquete en la fila y el caso real con latencia.
- `e2e-circuito.js` es un recorrido completo con clics en Chromium real.
- Para correrlas: `cd tests/auditoria && npm install && sh correr-todo.sh`. Todo pasaba en las dos clínicas al publicar.
- Las claves de fábrica se leen del HTML: no escribas claves en las pruebas.

Chromium para Playwright: `/opt/pw-browsers/chromium`, con `--disable-background-networking --disable-component-update`. Hay que rutear `script.google.com` al `.gs` en memoria y abortar el resto de la red.

## 8. Pendiente y decisiones abiertas

- **Diagnóstico del 19/10 (ASTRA)**: corregidos el adelanto que pagaba la consulta, el doble uso del saldo a favor entre equipos y la dueña de plan viejo (prueba `tests/auditoria/s23-diagnostico.js`). Los botones ahora se distinguen: "💵 Cobrar lo que debe" (salda una atención) y "💰 Pago adelantado o cuota" (plata a cuenta del plan). "Atención guardada" avisa que se está subiendo; el aviso de arriba dice si quedó algo sin subir. Sigue sin ser atómico el alta de un paquete (atención + pago + ficha van por separado y la cola los reintenta): no lo presenten como atómico.
- Las suites s08b–s21 corren con el servidor instantáneo; s22, s23 y el e2e usan demora. Para flujos nuevos de plata, probar con `server.latency`.

- **Paciente de prueba con dos "BLANQUEAMIENTO"**: el dueño tiene que borrar la visita de 234 con saldo 234 y el plan que dice "pagado Bs 0". Confirmar con él que quedó bien.
- **Viviana Moreno**: sus atenciones y pagos borrados solo se recuperan con el historial de versiones de la planilla (copiar sus filas de una versión anterior y pegarlas al final). Ofrecerle guiarlo.
- Propuestas sin decidir:
  - **A**: avisar al borrar lo último de un paciente.
  - **B**: papelera para restaurar lo borrado. Necesita cambiar el Apps Script.
- Decisiones del dueño pendientes desde antes:
  - si cada doctora debería recibir solo sus pacientes (hoy `list` manda todo y el panel filtra);
  - qué hacer con la copia local en compus compartidas.
- Opciones de paquetes no elegidas: **D** (pagado y no atendido) y **E** (sesiones incluidas en 0 para la comisión).

## 9. Cómo trabajar con este dueño

- Prueba en serio antes de mostrar, con su caso exacto y con la demora de Google.
- Mostrale capturas del panel con datos ficticios, explicá en pocas líneas qué cambia para la doctora o recepción, y pedí el ok.
- Si algo sale mal, reconocelo directo, explicá la causa en una frase y decile cómo arreglar los datos que quedaron mal.
