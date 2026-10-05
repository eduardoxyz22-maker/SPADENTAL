# Informe de traspaso: paneles de pacientes (5 de octubre de 2026)

Para quien siga trabajando en `pacientes.html` (Ezequiel Spadental) y `cosmetic/pacientes.html` (Cosmetic Dental & Face Center). Complementa `COORDINACION.md`; lo de este informe es más nuevo.

## Reglas que puso el dueño del repo (no negociables)

- **No publicar nada sin su ok explícito.** La rama `claude/vibrant-gauss-rvd0wb` es la que sirve GitHub Pages: hacer push equivale a publicar en el panel que usa la clínica. Antes de publicar, mostrar cómo queda.
- Las pruebas nunca contactan los Apps Script reales. El `fetch` se simula siempre.
- No escribir claves en texto plano en el repo, que es público.
- Todo cambio del motor se aplica **idéntico** en los dos paneles. Solo cambian los nombres, colores, precios, claves de `localStorage` (`SP_*` y `CD_*`), `CLINICA_ID` y `SHEETS_URL`.
- Accesos:
  - Cecilia (recepción, clave del consultorio) y Mirna (dueña) ven y hacen todo.
  - Las doctoras con clave personal (Brenda, Shirley) solo ven y tocan lo suyo.
- La identidad del paciente es el nombre más la **fecha de nacimiento**, no el CI.
- Queda **excluida, por decisión del dueño, la seguridad del servidor**: autenticación en el Apps Script, el truco de `sessionStorage` y las claves por defecto. No tocarla sin un pedido nuevo.

## Estado de los commits

| Commit | Qué es | ¿Publicado? |
|---|---|---|
| `53a6a30` | Arreglos de la 1.ª revisión: montos con punto de miles, total que se recalcula, "No asistió" con cobro bloqueado, plan terminado, `keyPac`, doctoras restringidas en Lista, Caja y Pacientes | Sí |
| `e4b609f` | **Fusión de cambios entre equipos** (panel y Apps Script) y los 30 hallazgos de la 2.ª auditoría | **No**: está en local, esperando el ok |
| `855dae1` | Este informe y `tests/apps-script-en-memoria.cjs` | No |
| (siguiente) | Correcciones de la 3.ª auditoría (re-auditoría de `e4b609f`); ver la sección "Ronda 3" | No |

**Falta desplegar el Apps Script.** `google-apps-script-pacientes.gs` y `cosmetic/google-apps-script-pacientes.gs` cambiaron en `e4b609f`, pero hay que pegarlos a mano en cada proyecto de Google Apps Script y publicar una versión nueva de la Web App. Lo hace la clínica, guiada. Mientras no se haga, el panel nuevo funciona igual que el viejo: el servidor ignora la `base` y escribe encima, como antes.

## Arquitectura de la fusión (`e4b609f`)

El problema: cada escritura mandaba el registro **entero**, y el servidor reemplazaba la fila. Una pestaña vieja borraba cobros, servicios, alergias, sesiones de plan y cambios de config que otro equipo acababa de cargar.

### Bloque compartido

El bloque "FUSIÓN DE CAMBIOS" es texto idéntico en los 2 HTML y los 2 `.gs`. El test verifica esa igualdad. Contiene:

- `fIgual`: comparación laxa entre tipos. `5` es igual a `'5'`, `false` a `''`, y `[]` a `undefined`.
- `fusion3(base, mío, servidor)`: decide campo por campo.
  - Si un campo solo cambió de un lado, gana ese lado.
  - Las listas con `id` (por ejemplo `cobrosPosteriores` o `planes`) se unen por id.
  - Las listas del mismo largo se juntan por posición.
  - Si los dos lados cambiaron un campo, gana el mío y el campo queda anotado en `conf`.
- `fCampo`: reglas especiales.
  - `acuenta` y `saldo` se suman por diferencia: el servidor más mi cambio respecto de la base.
  - Las marcas de tiempo `ts` o `*Ts`: gana la más nueva.
  - `estado`: si un lado dice `Atendido`, gana `Atendido`.
  - `sesiones`: usa `fSesiones`, para que cada atención ocupe su propia sesión del plan.
- `fusionRegistro`: después de juntar, si de los dos lados se cumplía `saldo = total − acuenta`, se recalcula el saldo.
- `fCambioParaBorrar`: un borrado se rechaza si cambiaron la fecha, el paciente, la profesional, el estado, algún monto, los servicios, `cobrosPosteriores` o `planId`.
- `fClavePac` y `fusionarFichas`: dos filas de ficha de la misma persona escrita distinto se juntan. Los textos que difieren se concatenan con " / ", para que ninguna alergia quede oculta.

### Apps Script

- `doSave(r, base)`:
  - si hay base y la fila existe, guarda `fusionRegistro(base, r, actual)`;
  - si hay base y la fila no existe, devuelve `{ok:false, error:'borrada'}`.
- `doDelete(r, base)`: si `fCambioParaBorrar` da verdadero, devuelve `{ok:false, error:'cambio', registro}`.
- `doGuardarPac(p, base)`:
  - busca la ficha por clave sin tildes;
  - junta las filas duplicadas;
  - fusiona y escribe el resultado en todas esas filas.
- Toda respuesta lleva `v: 2` (`FUSION_V`). El panel usa ese número para saber si el servidor ya fusiona.

### Panel

- `SNAP_R`, `SNAP_P` y `SNAP_E` guardan la última versión que el equipo vio en el servidor, tal como vino.
  - Se llenan en `pullServer`, `traerFresca` y `confirmado`.
  - Al arrancar se inicializan desde `localStorage` con `initSnaps`, excepto lo que está en la cola.
- `FORM_BASE` es la base del formulario. Se fija en `loadForm`. Así lo que otro equipo cambió mientras el formulario estaba abierto no se pisa.
- La cola (`queue`):
  - guarda un solo item por registro (`claveCola`);
  - un cambio nuevo reemplaza al que esperaba y conserva la base anterior.
- Envío:
  - `mandar` y `VUELO` serializan los envíos por registro;
  - `confirmado` rebasa lo que quedó en la cola: la base nueva pasa a ser lo que se envió, para que un cobro no se sume dos veces;
  - `rechazado` maneja `cambio` y `borrada`.
- `pullServer` vuelve a aplicar lo pendiente (`conPendientes`, `egrConPendientes`, `pacConPendientes`). Así lo encolado no desaparece de la pantalla.
- Config: `subirCfg` junta la config con `cfgBase()`, que es la última config del servidor guardada en `localStorage` bajo `K_CFG+'_BASE'`.
- Doctoras:
  - `pacAjeno` y `bloqueaAjeno` frenan fichas, planes, notas e historia de pacientes de otra doctora;
  - `planVisible` y `planesVisiblesDe` filtran planes. Los planes nuevos llevan `prof`;
  - `soloEquipo` deja plantillas y egresos solo a la dueña y recepción;
  - `deudaDe`, `presupuestos`, `autoPaciente`, `autoCita`, `avisosDe` y `htmlHistoria` usan `datosVisibles()`.
- Montos:
  - `num()` limpia el texto que rodea al número;
  - `validar` rechaza montos negativos y filas con precio pero sin servicio;
  - el descuento (`dataset.desc`) y la deuda perdonada (`dataset.ajuste`) se conservan al editar.
- Avisos con `confirm`:
  - al mover la fecha de una visita cobrada;
  - al borrar una visita con cobros. Una doctora no puede borrarla.
- Borrar sigue la cadena de reprogramaciones (`citaDe`) y cancela la cita viva.
- `subirLocal` y "Restaurar respaldo" solo mandan lo que falta.

## Ronda 3: lo que cambió después de la re-auditoría de `e4b609f`

La re-auditoría encontró tres retrocesos con el Apps Script nuevo:

- un cobro se contaba dos veces al reintentar después de una respuesta perdida;
- una ficha guardada sin base borraba la alergia o el plan de otra doctora;
- una atención con cobro, cargada sin red, se descartaba si otro equipo había borrado la cita.

Se corrigió así (`FUSION_V = 3`):

- **La plata no se suma por diferencia.** `fusionRegistro` desarma el registro (`fDesarmar`) en cobro inicial (`__cobroIni`), desglose inicial por método (`__pagosIni`) y deuda perdonada (`__perdon`). `cobrosPosteriores` se une por id. Después `fArmar` vuelve a calcular `acuenta`, `pagos`, `metodo` y `saldo`. Así el resultado es idempotente: el mismo envío repetido no cambia nada.
  - Si de los dos lados el total coincidía con la suma de los servicios, el total se recalcula después de juntar.
  - El saldo no queda negativo cuando hubo deuda perdonada.
- **Listas sin id** (servicios, antecedentes, profesionales, canales): `fMulti` suma lo que agregó cada lado y saca lo que sacó cada lado.
- **Textos** (`obs`, `notas`, `alergias`, `medicacion`, `detalle`): `fTexto3` conserva los dos agregados. Si los dos lados reescribieron el texto, quedan los dos separados por " / ".
- **Sesiones de plan:** `fSesiones` acepta largos distintos. Si un equipo agrega una sesión, eso no desmarca la que ya estaba hecha.
- **Base en el servidor:** en `doPost`, que falte `base` en el pedido (panel viejo) se trata distinto de `base: null` (alta nueva o cola vieja).
  - Sin `base`, se escribe como siempre.
  - Con `base: null`, el servidor junta con lo que haya, como si la base estuviera vacía. Así un alta repetida o una ficha que el equipo nunca vio no pisan nada.
  - La cola que dejó el panel anterior se manda con `base: null` (`initSnaps`).
- **`rechazado`:**
  - Si el error es `borrada` y el item traía trabajo (cobro o servicios atendidos), la atención se vuelve a crear en vez de descartarse.
  - Si el error es `cambio` en un borrado, se deshacen sus efectos: la cita vuelve a `Agendada` y la sesión del plan se vuelve a marcar.
- **Egresos:** `doGuardarEgreso` y `doBorrarEgreso` reciben base, con los mismos errores `borrada` y `cambio`.
- **Ajustes:** `doGuardarCfg(cfg, base)` junta dentro del servidor, sin carrera entre dos equipos. `subirCfg` manda como base la config que leyó del servidor justo antes. Si el equipo todavía no tiene base, usa `cfgDefault()` como base; para las claves delicadas mantiene la regla anterior.
- **Borrado:** `FUSION_CLAVE_BORRAR` incluye `obs`, así que una nota clínica nueva también frena un borrado.
- **Doctoras:**
  - el formulario, "Nueva atención" desde el Historial y la Agenda quedan siempre a nombre de la doctora;
  - cada plan tiene doctora (`duenaPlan`): la que lo cargó, la de sus sesiones o la que atiende al paciente.
- **Montos:** `num` entiende "1.500.00". `montoRaro` frena montos con letras ("15OO", "1e3") en el cobro y en el formulario.

## Cómo verificar

Desde la raíz del repo:

```
node tests/pacientes-regression.cjs        # 122 comprobaciones, sin red
```

`tests/apps-script-en-memoria.cjs` corre el `.gs` **real** sobre una planilla en memoria. Expone `handle(body)` y vistas `registros`, `pacientes`, `egresos` y `cfg`:

```js
const {gsServer}=require('./tests/apps-script-en-memoria.cjs');
const s=gsServer('google-apps-script-pacientes.gs');
s.handle({action:'save',registro:r,base:b});
```

Para escenarios de dos equipos, conectá dos instancias jsdom del panel a la misma instancia de `gsServer`, poniendo `window.fetch` sobre `s.handle`. Estos se verificaron así:

- dos cobros simultáneos;
- cobro sin red y otro equipo cobrando al mismo tiempo;
- formulario viejo que cambia solo una nota;
- botones de Agenda desde una pestaña vieja (WhatsApp, No vino, Canceló, Reprogramar, Corregir);
- "Aceptó" en recomendados;
- alergia y plan cargados desde dos equipos;
- sesiones de plan marcadas en paralelo;
- "Subir a la nube" y "Restaurar respaldo" desde un equipo viejo;
- guardar Ajustes desde un equipo viejo;
- lista refrescada con la cola pendiente.

Todos estos dieron el resultado correcto en los dos paneles.

También pasaron, pero esas pruebas viven fuera del repo:

- un arnés de interfaz con alrededor de 860 y 800 verificaciones por panel, que usa el servidor falso clásico (o sea, compatibilidad con el `.gs` viejo);
- Chromium real con Playwright, en celular y escritorio: sin desbordes ni errores, y la risa de octubre suena al entrar.

## Pendiente o conocido (no son errores, o necesitan una decisión)

1. **Desplegar los 2 `.gs`** en Google, después del ok y con guía.
2. **Homónimos que solo difieren en una tilde y tienen distinta fecha de nacimiento** (por ejemplo "Ana Ríos" de 1980 y "Ana Rios" de 2001): el panel los trata como la misma clave, y la regla de identidad frena el cobro hasta que se renombre a una. Es el diseño acordado. La solución real es un ID estable de paciente; ver `COORDINACION.md`.
3. **Planes existentes sin `prof`**: se les asigna doctora al vuelo (`duenaPlan`), según quién atendió sus sesiones o al paciente. Si un plan no tiene sesiones ni atenciones, lo ven todas.
4. **Alergias de un paciente ajeno**: la doctora las sigue viendo al cargarlo. Es a propósito, por seguridad clínica.
5. `num()` con texto sin sentido sigue devolviendo un número raro, pero `montoRaro` frena esos montos antes de guardarlos.
6. **Datos de Cosmetic**: hay Bs 40.030 cobrados sin método y Bs 46.910 sin doctora, sobre todo de Ana María Vargas. Vienen de los Excel históricos. Las doctoras históricas (Nadia, Ximena, Katherine, Yanaina, Carolina) no están en la config, y las doctoras actuales todavía no tienen clave asignada.
7. Mirna debe cambiar las claves de fábrica (la de dueña y la del equipo).
8. La re-auditoría de `e4b609f` encontró problemas, que se corrigieron en la ronda 3. Los repros de los auditores (32 scripts) dan bien contra el `.gs` nuevo en los dos paneles. Antes de publicar se hace una auditoría más de la ronda 3.
9. **Orden de despliegue recomendado:** primero publicar los paneles (las colas viejas se vacían con el servidor viejo, que se comporta como siempre); después pegar los dos `.gs` nuevos y publicar una versión nueva de cada Web App.
