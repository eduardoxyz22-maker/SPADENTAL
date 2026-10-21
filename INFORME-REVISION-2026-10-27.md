# Informe de revisión para ASTRA · 27/10/2026

Paneles de pacientes Spadental y Cosmetic. Foco: **planes, cobros, descuentos y saldo a favor**, que es lo que más preocupa al dueño. Complementa a `ASTRA.md` (traspaso general); acá va el estado exacto de hoy y qué revisar.

---

## 1. Estado

| Qué | Dónde está |
|---|---|
| Apps Script de las dos clínicas | **`2026-10-27-cierre`**, ya pegado e implementado por el dueño. Verificado con `info` (solo lectura) en Spa (1.549 filas) y Cosmetic (646 filas). |
| Panel publicado (GitHub Pages, rama `claude/vibrant-gauss-rvd0wb`) | `4ec829d` (auditoría del 20/10). |
| Commits locales en `paquetes`, probados y **sin publicar** (esperan el ok) | `a82abec` revisión del 21/10 (12 arreglos) · `45870fc` modernización (Ajustes, Panel, Caja, barra de fecha, claves) · `808fa3b` cierre de caja, accesibilidad, mensajes, recetas, presupuesto, ícono Pauta. |
| Pruebas | Batería completa (`tests/auditoria/correr-todo.sh`, dos clínicas) + 130 + 61 regresiones: **todo pasa**. La única intermitencia era de la prueba (leía un KPI animado antes de que terminara de contar); corregida y repetida 10/10. |

El servidor nuevo es compatible con el panel publicado (`4ec829d`): las acciones nuevas (`cierre`, `cierres` en `list`) solo las usa el panel pendiente. Nada de lo pendiente cambia cobros reales.

---

## 2. Qué cambió en plata desde el informe anterior (20/10)

### En el servidor (`.gs`, idéntico en las dos clínicas salvo constantes)

| Cambio | Función | Qué frena o hace |
|---|---|---|
| Sesión repetida de un plan | `sesionRepetidaSrv(r, sh)` (l. 248) y los dos guardas en `doSave` (l. 647 para la visita «separada», l. 670 para la principal) | Rechaza con `sesion_repetida` una atención con `planId` + `planEtapa` cuando **otra visita existente ya tiene esa etapa**. Devuelve `etapa`, `fecha` y `atencionId` de la que ya está. Editar la misma visita no lo dispara. Caso real: Cosmetic 20/10, dos pantallas marcaron la sesión 2. |
| Saldo a favor por bolsillos | `creditosSrv(clave)` (l. 1407), `creditoPacienteSrv(clave, planId)` (l. 1431), `recortarFavor` (l. 715) | Lo adelantado a un plan solo paga sesiones de **ese** plan; lo suelto paga cualquier cosa. Si una atención usa más de lo que queda, el servidor la recorta, la diferencia queda como deuda y responde `ajusteFavor`. Vale también para la visita separada y para el reintento de la cola. |
| Pauta solo lectura | `cfgSinSesion` (l. 1264), `doList` quita `med`, sin egresos | El rol `pauta` no ve claves, metas, comisiones, egresos ni datos médicos. |
| Cierre de caja | hoja `_Cierres`, `doCierre` (l. 1709), `doListCierres` (l. 1683), acción `cierre` | Guarda fecha, quién, contado, esperado, diferencia y nota. Solo `admin`/`equipo`. `list` trae los últimos 90 días. **No mueve plata**: es un registro. |
| Dueña de plan sin `prof` (de antes) | `duenoPlanSrv` (l. 267), `planesSinTocarAjenos` (l. 290) | Misma regla que el panel (`duenaPlan`). Un plan ajeno o de la clínica pasa a «terminado» con todas las sesiones hechas. |

### En el panel (`pacientes.html` / `cosmetic/pacientes.html`, bloques idénticos)

| Cambio | Función | Qué resuelve |
|---|---|---|
| Vender un paquete desde la atención en un paso | `sesionPaqueteForm` (l. 10277), `venderPaqueteForm` (l. 10308), `vpCambio`/`vpCuentas`/`vpOk` (l. 10335–10374) | El botón «📦 Sesión de un paquete o plan» en Servicios. Elige paquete, si hoy se hace la sesión 1, cuánto paga (Todo / Solo la consulta / Nada) y muestra las cuentas antes de cargar: consulta + sesión + adelanto. Es lo que pedía el dueño («150 la valoración, 700 el paquete, son 850»). |
| Qué sesión toca | `sesionQueToca(plan, idAt)` (l. 10403) | Primera sesión no hecha que no sea la de la visita que se edita. Antes marcaba la 3 salteando la 2 (caso Eduardo Añez). |
| Cambiar de plan en el formulario | `elegirPlanEnForm(id)` (l. 10374) | Al cambiar A→B o limpiar, saca la línea automática del plan anterior (antes se sumaban las dos). |
| Marcar sesión con pantalla vieja | `atencionDePlan` (l. 9518) | Refresca desde la hoja antes de abrir; si la etapa ya está hecha en otra visita, avisa «Esa etapa ya está hecha (visita del …)» y no abre. |
| Rechazo del servidor en la cola | rama `sesion_repetida` de `enviar`/`mandarYa`, `liberarSesionPlan` (l. 6639) | No reintenta: saca la visita local (o restaura la anterior si era edición), libera la marca y avisa. **Esto es lo que sacó el «reintentar subir» eterno.** |
| Texto de WhatsApp | `showWhatsappModal(r, cita, fav, alPlan, planIdPaq, sinRegistrar)` | «Recibido hoy: Bs X» con desglose, «Reservado para su plan: Bs Y», «Descontado de su adelanto». «Le queda a favor» solo sin plan. |
| Ficha: sesión repetida ya guardada | `sesionPillDe(r)` | Pastilla roja «⚠ sesión N repetida · el paquete ya la tiene el dd/mm» para datos viejos. |
| Sesiones sin marcar / varias visitas (de antes) | `avisoSinMarcar`, `marcarSesionPlan` (l. 6648), `vincularVisita` (l. 9853), `variasVisitas` (l. 9916) | Reparar lo que quedó mal sin tocar cobros. |

---

## 3. El modelo de plata, en una página

**Tres tipos de fila en la hoja de atenciones:** atención (`Atendido`, `No asistió`, `Canceló`, `Reprogramó`), cita (`Agendada`), anticipo (`Anticipo`; con `planId` es pago a un plan).

**Una atención:** `servicios[{nom, cant, precio, det}]`, `total`, `acuenta`, `saldo`, `pagos[{metodo, monto}]`, `metodo`. Si es sesión de un plan lleva `planId` y `planEtapa`, y su `total` es el precio de esa sesión.

**Invariantes que tienen que cumplirse siempre** (si Astra encuentra una fila real que no los cumple, es un hallazgo):

1. `saldo = total − acuenta − perdón`, con perdón ≥ 0 (cortesía/descuento posterior). En el panel `faltaPagar(r)` (l. 8927); `saldoNoCuadra` (l. 8928) detecta `saldo > total − acuenta` y Caja lo lista en «No cuadran» con «Dejar en X» (`arreglarSaldo`, l. 8939, deja nota en `obs`, no mueve caja).
2. `acuenta = Σ pagos.monto` (si hay `pagos`). Si no cuadra, Caja lo lista en «Sin forma de pago».
3. Lo cobrado en una atención cuenta para el plan **solo lo de su sesión**: `cobradoDeSesion(plan, r)` (l. 6481). Primero paga lo demás de la visita (la consulta), después la sesión.
4. El saldo a favor va por bolsillos: `creditosEn(lista, nombre)` (l. 7070) → `{general, porPlan}`. Un adelanto a un plan **nunca** paga la consulta ni otra cosa. Mismo cálculo en el servidor (`creditosSrv`). `creditoParaAtencion(r)` (l. 6489) es lo que puede usar una atención.
5. Cada sesión `hecha` de un plan apunta a una `atencionId` que existe, y **ninguna etapa está en dos atenciones** (servidor: `sesionRepetidaSrv`).
6. La comisión (`liquidacion`, l. 8008) usa `total` de filas `Atendido`. Los anticipos no generan comisión; la generan las sesiones cuando se hacen.
7. Un adelanto usado como saldo a favor no se puede borrar (`anticipo_usado`); bajar lo cobrado de una atención con un guardado común se rechaza (`cobro_baja`, l. 665) y hay que usar «Corregir cobro» (`corregirCobro`, queda en `_Correcciones`).

**Descuentos.** No hay campo «descuento» en la fila. Un descuento es **`total` menor que la suma de servicios**:
- En el formulario, si alguien toca el total a mano queda `dataset.touched` y la diferencia en `dataset.desc` (`recalcTotal`, l. 5150); al agregar servicios se conserva el descuento, no el total viejo. Una atención guardada con `total` distinto de la suma se abre como «con descuento» (l. 5402–5410).
- En el servidor la fusión de ediciones concurrentes desarma la fila en `__cobro`, `__perdon` y `__desc = Σ servicios − total` (`fDesarmar`/`fArmar`, l. 1040–1074), así dos personas editando no pisan el descuento ni el cobro.
- El presupuesto (`mdPresupuesto`, parte 70) acepta descuento en Bs o «10 %» pero **no cobra ni crea nada**: solo deja «presupuesto entregado el …» en la recomendación.
- Riesgo a mirar: un «descuento» que en realidad es un error de carga (total 0 en una atención real) no se distingue de una cortesía. Caja no lo lista porque los invariantes se cumplen. Propuesta abajo.

---

## 4. Lo que el servidor rechaza (tabla rápida)

| Error | Cuándo | Qué hace el panel |
|---|---|---|
| `sin_sesion` | sin token válido | pide la clave |
| `sin_permiso` | doctora toca lo de otra, rol `pauta` escribe, doctora cierra caja | avisa |
| `borrada` | editar algo que ya no existe | saca la copia local |
| `cobro_baja` | bajar lo cobrado con guardado común | pide «Corregir cobro» |
| `anticipo_usado` | borrar un adelanto ya usado | avisa |
| `sesion_repetida` | etapa ya hecha en otra visita | no reintenta, libera, avisa |
| `ajusteFavor` (no es error) | usó más saldo a favor del que quedaba | recorta y avisa «ya se había usado desde otro equipo» |
| `otra_clinica` | fila de la otra clínica | avisa |
| `no_cuadra` | corrección que deja saldo negativo | avisa |

---

## 5. Los casos reales y cómo quedaron

| Caso | Qué pasó | Causa | Estado |
|---|---|---|---|
| Naisha (Cosmetic) | visitas del plan sin sesión marcada, «Pago al plan» repetido | la ficha viajaba antes que la atención; el servidor devolvía el plan sin marcar | arreglado (orden de envío + `savePac(p, tras)`); reparación con «✓ Marcar sus sesiones» y «🧩 Se hizo en varias visitas» |
| Eduardo Añez (Spa) | marcaba la 3 salteando la 2; saldo a favor y deuda a la vez | `sesionQueToca` tomaba la sesión de la propia visita como hecha; la línea del plan anterior se sumaba | arreglado; ya lo cargaron bien |
| Sesión 2 dos veces (Cosmetic 20/10) | dos pantallas, una sin refrescar | no había guarda en el servidor | `sesionRepetidaSrv` + pre-refresco en `atencionDePlan` + pastilla roja para lo viejo |
| «Reintentar subir» eterno | la cola insistía con un rechazo definitivo | faltaba tratar `sesion_repetida` como definitivo | arreglado |
| Pedía clave «cada x tiempo» | el panel renovaba la sesión aunque el servidor no la hubiera validado | `api()` renueva solo con `r.ok !== false`, usa `SESION.ttl` | arreglado (`e2e-sesion-larga.js`) |

---

## 6. Lo que sigue sin ser perfecto (decir la verdad)

- **El alta de un paquete no es atómica**: atención (`save`), pago al plan (`save` de un `Anticipo`) y ficha (`pac`) van en tres pedidos y la cola los reintenta en orden. Si se corta internet a mitad, puede quedar la atención sin el adelanto o sin la marca; el panel lo muestra (aviso «sin subir», `avisoSinMarcar`) y se repara desde la ficha. Hacerlo atómico exige una acción nueva del servidor (`venderPaquete`), parecida a `pasarAlPlan` que sí es atómica.
- **Descuento vs. error de carga**: no se distinguen (ver §3). 
- **Datos viejos**: las guardas nuevas frenan lo nuevo; lo que ya quedó mal antes del 20/10 solo se ve (pastilla roja, «No cuadran», `avisoSinMarcar`) y se repara a mano.
- **Borrar es definitivo** (`deleteRow`); solo queda el id en `_Borrados`. Recuperar = historial de versiones de la planilla.
- **El cierre de caja** compara el efectivo contado con lo esperado del día; si después se borra o edita un movimiento de ese día, el cierre guardado no se recalcula (queda la nota). Es un registro, no un candado.
- **Plantillas de WhatsApp editadas** pierden los matices automáticos (texto distinto con plan, con saldo a favor) salvo que la plantilla use los campos entre llaves.

---

## 7. Qué pedirle a Astra (checklist)

**A. Revisión de código (sin datos reales)**

1. `doSave` (l. 571–714): recorrer las ramas con `separada` (consulta + sesión en la misma carga) y confirmar que `sesionRepetidaSrv`, `creditoPacienteSrv` y `recortarFavor` se aplican a las **dos** filas y al reintento (`base` definido).
2. `creditosSrv` vs `creditosEn`: misma cuenta en servidor y panel. Casos: adelanto a plan A usado en sesión de plan B (no debe), adelanto suelto usado en sesión de plan (sí puede), sesión con precio 0 (planes viejos: cuenta todo lo cobrado).
3. `cobradoDeSesion` cuando la visita trae consulta + sesión y el cobro es parcial: el orden es consulta primero, sesión después. Confirmar que `cuentasPlan` (l. 6502) y `mdCuentasPlanHtml` muestran lo mismo.
4. `vpOk` (l. 10361): con «Solo la consulta» el adelanto es 0 y la sesión 1 queda debiendo su precio; con «Nada», todo queda debiendo; con «Todo», el exceso va a `Anticipo` con `planId` por la misma forma de pago y el mismo día (`separarExceso`, l. 10181).
5. `sesionQueToca` con planes de la clínica (`deClinica`) y con sesiones `aparte`.
6. `fDesarmar`/`fArmar` (l. 1040–1074): que dos ediciones concurrentes de la misma atención (una cambia servicios, otra cobra) no dupliquen ni borren el descuento. **Hueco de pruebas:** la regresión solo verifica que la librería de fusión sea idéntica en los 4 archivos (`pacientes-regression.cjs`, l. 135); no hay una prueba de comportamiento con descuento + cobro concurrente. Es lo primero que conviene agregar.
7. `arreglarSaldo`: que solo baje `saldo` a `total − acuenta` y nunca toque `acuenta` ni `pagos`.

**B. Revisión de datos reales (solo lectura, con la clave de pauta de Eduardo, que no escribe nada)**

Con la respuesta de `list` (registros + pacientes con `planes`), verificar los invariantes de §3 fila por fila y listar excepciones por paciente y fecha:
- `saldo > total − acuenta` (no cuadra) y `acuenta ≠ Σ pagos` (sin forma de pago);
- dos atenciones con el mismo `planId` + `planEtapa`;
- sesiones `hecha` cuyo `atencionId` no existe;
- atenciones con `planId` que ninguna sesión apunta (sin marcar);
- planes activos repetidos para el mismo paciente;
- adelantos (`Anticipo` con `planId`) de un plan que ya no existe en la ficha;
- atenciones `Atendido` con `total` 0 y servicios con precio (posible error de carga disfrazado de descuento).

Si querés, dejo armado un script de solo lectura que haga esta pasada y saque un `.csv` por clínica; Eduardo lo corre con su clave y nadie más la ve.

**C. Qué no hacer**

- No probar contra los Apps Script reales ni GitHub Pages; solo `info`/`cfgGet`/`list` sin token (deben responder `sin_sesion`). El arnés `tests/auditoria/gsserver.js` corre el `.gs` real en memoria.
- No escribir claves en pruebas ni en el repo. No cambiar IDs de planillas. No crear usuarios.
- No publicar sin el ok del dueño.

---

## 8. Pruebas que cubren cada regla

| Regla | Prueba |
|---|---|
| Adelanto paga solo su sesión; consulta aparte | `s23-diagnostico.js`, `s24-credito-por-plan.js` (B1/B2), `e2e-sesion-visible.js` |
| Saldo a favor una sola vez entre equipos (`ajusteFavor`) | `s23`, `s24` (separada + reintento) |
| Sesión repetida: servidor, pre-refresco, cola sin reintentos, pastilla | `e2e-sesion-repetida.js`, `s24` |
| Vender paquete desde la atención (Todo / Solo consulta / Nada), textos de WhatsApp | `e2e-sesion-visible.js`, `s21`, `s18`, `s22` (con demora de Google) |
| Qué sesión toca, cambio de plan A→B | `e2e-sesion-visible.js` |
| Doctora marca sesión de paquete de la clínica | `e2e-sesion-paquete.js`, `s13` |
| Reparar: marcar sus sesiones, vincular visita, varias visitas | `e2e-vincular-visita.js` |
| Corregir cobro, `cobro_baja`, `_Correcciones` | `s10`, `s15` |
| Borrar pago, anticipo usado | `s20`, `s15` |
| No cuadran / sin forma de pago / «Dejar en» | `s11`, `e2e-md-panel-caja.js` |
| Cierre de caja en la hoja, dos aparatos, permisos | `e2e-md-cierre.js` |
| Pauta solo lectura, sin `med` ni egresos | `e2e-pauta.js`, `s24` |
| Sesión de 30 min renovada solo si el servidor validó | `e2e-sesion-larga.js` |
| Presupuesto con descuento y cuotas (no cobra) | `e2e-md-presupuesto.js` |
| Fusión de ediciones concurrentes (descuento, cobro) | **sin prueba de comportamiento** (solo identidad de la librería en `pacientes-regression.cjs`) |

Correr: `cd tests/auditoria && npm install && NODE_PATH=… sh correr-todo.sh` (20–30 min, dos clínicas). No editar archivos del repo mientras corre.
