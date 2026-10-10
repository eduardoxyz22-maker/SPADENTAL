# Traspaso para Claude — anticipos, 10 de octubre de 2026

## Estado de publicación

Eduardo autorizó «Publica» y «Deja informe para cuando lea claude» el 10/10/2026, 21:23 UTC. Se publica este informe documental. **Los anticipos no están desplegados ni habilitados en los paneles activos.** La autorización no resuelve los requisitos de seguridad pendientes; no se cambió autenticación, claves, roles ni acceso Google, ni se migraron pacientes o saldos históricos.

La rama predeterminada y servida por Pages según el traspaso existente es `claude/vibrant-gauss-rvd0wb`. HEAD remoto verificado antes de esta entrega: `a30a438fb23ac8dda275c6042508ef3589b272b1`. `INFORME-CODEX.md` y `COORDINACION.md` son los antecedentes; este informe actualiza únicamente el trabajo de anticipos.

## Bloqueo concreto

Los `doPost`/`doGet` revisados no comprueban identidad ni rol antes de leer/escribir. Las guías antiguas recomiendan Web Apps ejecutadas como propietario y acceso público. No se comprobó la configuración efectiva de Google ni se llamó a endpoints de pacientes. Un UUID, ScriptLock o filtro UI no reemplaza autorización servidor.

`INFORME-CODEX.md` excluye cambios de seguridad sin nuevo pedido; `COORDINACION.md` requiere acordar proveedor de identidad, matriz de roles y despliegue/recuperación. Por eso no se inventaron tokens, cuentas o permisos. Para desbloquear: aprobar autenticación verificada en servidor, confirmar las identidades reales autorizadas por clínica y rol (dueña/recepción/doctoras), aprobar acceso de despliegue a los dos proyectos Google y crear un staging aislado con datos ficticios. No solicitar contraseñas por chat ni poner secretos en este repositorio público.

GitHub publica HTML estático; no despliega Apps Script. No hay manifiesto clasp ni pipeline GAS identificado en los archivos revisados. Las guías indican actualización manual de cada Web App por su propietario. Hace falta comprobar versión efectiva de ambos backends y ruta de despliegue autorizada, sin leer datos clínicos como prueba.

## Código preparado, aún no incorporado a esta rama remota

Checkout separado: `/workspace/spadental-anticipos-review`, rama local `review/anticipos-20261010`. Base a30a438. Se entregaron en Library un patch, ZIP completo, informe y demo integrada, todos versión 1; las capturas 5000→4200 están versión 0. Pedir al propietario esos entregables si el entorno local no está disponible. No interpretar rutas de este apartado como archivos ya publicados en GitHub.

Cambios locales:
- Ambos `pacientes.html`: catálogo «Añadir tratamiento», planes y cuenta/anticipos integrados.
- Ambos `google-apps-script-pacientes.gs`: journal financiero, idempotencia, control de versión y guards para operaciones legacy.
- `review/advance-ledger.js`: motor auditado en centavos.
- `financial/backend.js`, `projections.js`, `panel.js`, `panel-projections.js`: backend/proyecciones/UI/caja/informes/exportación y respaldos.
- `financial/build-integrated-demo.py`: demo del panel real con GAS real simulado en memoria, CSP sin red, datos ficticios y almacenamiento separado.
- `tests/financial-*.cjs`, `tests/advance-ledger.cjs`, pruebas catálogo y Chromium; logs en `review-evidence-v2/`.

**No copiar los HTML de revisión a producción:** llevan `SHEETS_URL` vacío, CSP de conexiones bloqueadas y claves REVIEW separadas. Antes de una futura activación se debe construir una variante operativa conservando las URLs verificadas, nombres y almacenamiento de cada clínica, con autenticación acordada, y volver a validar. Restaurar solo la URL no completa ni asegura el despliegue.

## Modelo y alcance

Existen dos tenants: SPA Dental y Cosmetic. Dra. Mirna es profesional/marca en ambos, no un tercer tenant encontrado. Fondos aislados por paciente UUID, clínica y BOB; sin transferencias entre marcas/monedas.

Un anticipo libre de Bs5000 deja saldo a favor5000. Una atención adicional800 consume crédito y deja4200, deuda0, caja acumulada5000. Aplicar crédito no genera ingreso nuevo. Las capturas reproducen exactamente ese caso ficticio sin plan asignado.

Un plan presupuesto5000/pagado5000 tiene deuda0 y sesiones pendientes. Plan7000/pagado5000 debe2000. Los importes asignados al plan se muestran separados del crédito libre, sin sumar dos veces. Las sesiones incluidas carecen de precio individual en el modelo original: no se inventa un reservado restante4200 por realizar una sesión sin valoración contractual. Un reparto monetario por partida requeriría decisión adicional.

Journal append-only con una fila/evento, huella de petición y versión por cuenta bajo ScriptLock. Reintento idéntico no duplica dinero; respuesta incierta conserva comando. Anular atención libera crédito/avance, no registra devolución ficticia. Sin refunds ni corrección arbitraria de recibos. Planes históricos con actividad requieren conciliación; no se reinterpretan saldos iniciales automáticamente.

## Evidencia y límites

534 comprobaciones locales pasadas, cero fallidas en ejecuciones finales: legacy128, catálogo55, ledger26, seguridad offline14, backend180, proyecciones6, panel16, catálogo Chromium12, E2E integrado48, demo integrada15, piloto auxiliar30+4. Exit0 en todos. `git diff --check` y aplicación del patch a base limpia: exit0.

E2E usa paneles reales y Apps Script en VM con Sheets/Lock simulados: parciales, varias atenciones, agotamiento, deuda por diferencia, pagos adicionales, anulación/corrección, retries, pérdida de respuesta, dos pestañas, recarga, aislamiento, redondeo, históricos, caja, XLSX descargado y respaldo JSON. Chromium bloquea solicitudes externas. Cuatro hallazgos de auditoría fueron corregidos y revalidados: bypass legacy de proyecciones, cobro antiguo sobre ID virtual, refresh parcialmente fallido y visibilidad entre doctoras.

No probado: despliegue Google, autenticación servidor, cuotas/rendimiento real, concurrencia física Google, migración histórica. **534 checks no equivalen a producción lista.** Las pruebas no deben usar pacientes reales ni probar escribiendo en las hojas operativas.

## Próxima secuencia y rollback

1. Obtener aprobación y definición concreta de identidad/roles/despliegue, manteniendo separados los dos tenants.
2. Recuperar patch/ZIP y comparar de nuevo HEAD remoto; conservar cambios concurrentes sin force push.
3. Implementar autorización fail-closed y probar staging aislado; construir HTML operativo separado del demo.
4. Verificar versión backend y desplegar de forma coordinada ambos lados; confirmar Pages/commit y URL real mediante lectura estática. No usar un alta de paciente real como smoke test.
5. Migración histórica requiere decisión y conciliación aparte; no es condición para probar casos nuevos ficticios en staging.

La entrega actual es documental: si se necesitara revertir, revertir solo el commit de este informe, sin tocar paneles. Para futura activación: conservar HTML/versión GAS anteriores y respaldo verificado; ante fallo deshabilitar nuevas escrituras financieras primero. No borrar journal, no borrar filas para «volver atrás», no reproducir recibos como saldos nuevos. Restaurar código anterior sin controlar escrituras no es rollback seguro del ledger; conciliar los eventos aceptados y acordar recuperación por tenant.
