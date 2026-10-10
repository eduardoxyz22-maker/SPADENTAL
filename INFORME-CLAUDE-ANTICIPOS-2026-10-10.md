# Claude: continuar anticipos conservando los accesos actuales

## Dictamen y encargo directo

**La función de anticipos está implementada y probada localmente, pero NO está publicada en los paneles activos.** Eduardo autorizó publicar y ajustar seguridad; después pidió mantener los accesos actuales, evitar un rediseño innecesario y dejar este traspaso si no se podía completar con seguridad ahora.

Continúa desde el patch estable entregado. No reinicies la contabilidad ni cambies las identidades del personal. No exijas correos Google ni crees cuentas para las doctoras de Cosmetic. No despliegues los HTML de revisión desconectados sobre el panel operativo.

## Accesos que Eduardo acaba de indicar

| Consultorio | Superacceso | Cuentas propias / restricciones |
|---|---|---|
| Cosmetic | Mirna y Cecilia | Las doctoras todavía NO tienen usuario ni contraseña. No crearlos por inferencia. |
| SPA Dental | Solo Mirna | Ximena, Brenda, Shirley y Catherine tienen cuentas propias. Conservarlas y sus permisos. |

Eduardo dictó «Mirda»; el código identifica «Dra. Mirna». El código base escribe «Dra. Katherine», mientras Eduardo dijo «Catherine». Son diferencias de transcripción pendientes de cotejar con la configuración, no permiso para renombrar, duplicar o reasignar cuentas. La lista de profesionales del código no es el padrón de usuarios. No añadir otras personas que aparezcan en documentos antiguos.

## Qué está listo y dónde recuperarlo

Base exacta: `a30a438fb23ac8dda275c6042508ef3589b272b1`, rama predeterminada `claude/vibrant-gauss-rvd0wb`, repo `eduardoxyz22-maker/SPADENTAL`. El trabajo se hizo en un clon separado; no se tocaron AKME-ESTUDIO ni MULTIESPUMAS.

Entregables privados del propietario en Library:

- `SPADENTAL-anticipos-catalogo.patch`, versión1. SHA256: `6daca6eec7eac1196f7be7d869728aae579a1a037bfa21de06737b9b3a365ace`.
- `SPADENTAL-codigo-pruebas-evidencia.zip`, versión1: código estable, pruebas y evidencia.
- `SPADENTAL-demo-anticipos-offline.html`, versión1: panel real y backend GAS simulado, datos ficticios, sin conexión a producción.
- Capturas `demo-anticipo5000-antes.png` y `demo-anticipo5000-despues800.png`.

El propietario debe adjuntar el patch o ZIP a Claude. El intento de añadir el patch completo al repositorio público fue rechazado por la revisión automática por exposición potencial de código/URLs; no existe un patch público publicado por esta entrega. No buscarlo en una ruta ficticia ni copiar secretos al repositorio.

En el entorno original: snapshot estable extraído en `/workspace/spadental-handoff-estable-20261010`. El clon `/workspace/spadental-anticipos-review` contiene además trabajo de seguridad interrumpido: **no usar su diff actual como versión aprobada**. La entrega financiera estable es el patch/ZIP versión1.

## Implementación estable

Cambios: ambos `pacientes.html` y ambos `google-apps-script-pacientes.gs`; `financial/backend.js`, `projections.js`, `panel.js`, `panel-projections.js`; motor `review/advance-ledger.js`; catálogo integrado; pruebas `tests/*financial*`, ledger, catálogo y Chromium.

- Dos tenants independientes: SPA Dental y Cosmetic. Dra. Mirna aparece en ambos; no hay un tercer tenant personal encontrado.
- Saldo por paciente UUID + tenant + BOB. No transferencias de fondos entre marcas o monedas.
- Recibo real, cargo por atención y aplicación de crédito son movimientos separados. Anticipo libre5000 → atención800 → crédito4200, deuda0, caja5000.
- Presupuesto5000 pagado5000: deuda0 y sesiones clínicas pendientes. Presupuesto7000 pagado5000: deuda2000. Lo pagado al plan no se suma otra vez al crédito libre.
- Journal append-only, un evento por operación, huella idempotente y versión bajo ScriptLock. Recargar/reintentar no duplica caja ni consumo.
- Anular una atención devuelve crédito o avance clínico; no representa refund. No se añadieron devoluciones de dinero ficticias.
- Guardas bloquean vías legacy que eluden ledger. Caja/exportación/respaldo consumen proyecciones sin duplicar recibos.
- Ajustes → Lista de precios → Añadir tratamiento, con inclusión en borrador de plan mediante snapshot.
- Históricos con movimientos no se adoptan automáticamente: conciliar aparte. No migrar ni limpiar datos reales por iniciativa propia.

## Bloqueo exacto y mínimo pendiente

El código GAS revisado no autentica/autoriza `doPost` ni `doGet`; el esquema anterior compara claves en el navegador y devuelve hashes dentro de configuración. **No basta trasladar esos hashes al cuerpo de una petición como tokens.** No llamar seguro al sistema por esconder botones o mantener ScriptLock.

El navegador cloud coordinador YA verificó propietario, proyectos y deployments coincidentes con el frontend. SPA está en versión13 y Cosmetic en versión2, de 5/10/2026; ambas ejecutan como propietario/acceso Cualquiera. Los enlaces exactos están en el anexo privado de entrega. **No pedir nuevamente acceso Google, enlaces o correos del personal.** No se verificó la vinculación de una hoja candidata de Cosmetic: no cambiar spreadsheet IDs por conjetura.

Resolver la validación mínima servidor conservando las cuentas/roles indicados, con credenciales nuevas introducidas privadamente por el usuario si es necesaria renovación por exposición. El agente no inventa contraseñas ni enrola a personas sin intervención autorizada. No introducir OAuth obligatorio o un sistema nuevo de usuarios como requisito si se puede asegurar el existente.

Antes de live faltan integración completa de controles por operación/recurso/respuesta y validación en staging, además de la eventual renovación privada. Aún no se implementó esa protección de extremo a extremo. La alternativa de sesiones preparada en `auth/` es solo trabajo exploratorio aislado; no debe desplegarse como solución terminada. Sus pruebas no certifican los endpoints actuales.

## Orden de continuación y despliegue

1. Clonar HEAD actual en una rama de trabajo y obtener el patch/ZIP estable privado. Ejecutar `git apply --check` contra la base indicada; conservar los cambios posteriores de documentación/Claude, sin force ni sobrescritura.
2. Revisar las diferencias de nombres contra configuración con mínima exposición, sin leer pacientes ni imprimir hashes. Conservar roles existentes; no crear usuarios Cosmetic doctoras.
3. Completar la protección de TODOS los handlers (legacy, financieros, lectura y escritura), respuestas filtradas por rol/recurso y eliminación de material de credenciales. Probar denegación sin sesión y restricciones entre doctoras/tenants. Si requiere renovación, intervención privada del usuario; no secretos en código/chat/logs.
4. Crear staging separado con hojas y cuentas ficticias. Aplicar allí backend primero y frontend de staging después; verificar versión, auth, caja, idempotencia, concurrencia y regresiones. No probar dando altas en pacientes reales.
5. Construir frontend operativo desde la variante revisada: restaurar únicamente URLs verificadas de cada tenant y claves SP_/CD_ correctas, retirar CSP offline y rótulo de revisión, conectar autenticación real y evitar datos cacheados de otra sesión. El HTML entregado tiene servidor vacío/almacenamiento REVIEW y NO es el archivo para live.
6. Coordinar ventana de actualización: respaldo y versiones previas, backend protegido de cada proyecto primero; comprobar salud/autorización sin datos clínicos; publicar frontend compatible en la rama Pages después. No dejar frontend nuevo hablando con GAS viejo ni pestañas antiguas escribiendo sin control.
7. Verificar commit remoto, workflow Pages, URL estática real y versión de cada GAS; lectura no equivale a prueba contable productiva. No afirmar activación hasta verificar ambos lados.

## Pruebas realizadas y límites

Versión financiera estable: **534 comprobaciones pasadas, cero fallidas, exit0**. Reparto: legacy128, catálogo55, ledger26, seguridad offline14, backend180, proyecciones6, panel16, catálogo Chromium12, E2E integrado48, demo15, piloto auxiliar30+4. Logs/comandos en `review-evidence-v2/TEST-RESULTS.md`. Patch aplicado en comprobación a base limpia; `git diff --check` exit0.

Comandos principales: `node tests/pacientes-regression.cjs`, `node tests/catalog-regression.cjs`, `node tests/advance-ledger.cjs`, `node tests/financial-backend.cjs`, `node tests/financial-projections.cjs`, `node tests/financial-panel.cjs`, `node tests/financial-e2e.cjs`, `node tests/integrated-demo-browser.cjs`. Chromium usa servidor local `python3 -m http.server 8765 --bind 127.0.0.1` y bloquea solicitudes externas.

El núcleo de sesiones exploratorio tuvo186 checks y derivación9, aislados. La integración de auth iniciada después se pausó por la instrucción de conservar estructura/hacer traspaso: **sus pruebas E2E no están completadas ni cuentan como pasadas**. No mezclar sus archivos en el patch estable.

No ejecutado: despliegue GAS nuevo, staging Google, login protegido de extremo a extremo, migración histórica, autenticación productiva, pruebas de cuotas/gran volumen. Las534 pruebas locales no hacen seguro el backend actual ni equivalen a producción lista.

## Rollback

Guardar versiones HTML y GAS previas y respaldo de cada tenant antes de activar. Si hay fallo, bloquear escrituras financieras nuevas y recuperar frontend/backend compatible, sin borrar journal ni reproducir recibos como saldos nuevos. Revertir solo HTML después de aceptar eventos financieros puede habilitar vías antiguas: conciliar y preservar el journal antes de decidir recuperación. No migrar o revertir datos históricos automáticamente.

Esta entrega remota publica documentación, no activa anticipos. Comunicar esa diferencia expresamente al propietario.
