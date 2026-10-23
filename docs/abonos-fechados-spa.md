# Abonos con fecha real — Spa Dental

Alcance: solamente `pacientes.html` y `google-apps-script-pacientes.gs` de Spa. No se migran pagos ni se modifican datos de pacientes como parte del despliegue.

## Uso

Abrir la atención con deuda → Registrar pago → Fecha del pago → importe recibido → medio real → Guardar pago. Repetir sobre la misma atención por cada abono. La fecha predeterminada es hoy en Bolivia; se permiten fechas desde la atención hasta hoy. Una fecha pasada pide confirmación explícita. No se crean visitas ni planes.

Para un anticipo ya cobrado: abrir la atención → Registrar pago → Saldo a favor, con fecha de aplicación de hoy. No elegir otra vez QR o efectivo ni borrar el anticipo original. La proyección existente de caja excluye esta aplicación y conserva el ingreso en la fecha del anticipo.

## Persistencia

Cada abono conserva ID, `fecha`, `metodo`, `monto` dentro de `cobrosPosteriores`. `registradoEn` y `registradoPor` se asignan en servidor cuando se persiste el abono nuevo; no sustituyen la fecha efectiva. No se rellenan fechas ni auditoría de registros anteriores. La atención conserva su fecha y sus acumulados.

Se reutiliza la cola persistente y la fusión por ID. Se bloquea el doble clic mientras el pago se verifica y un nuevo pago mientras esa atención tenga cambios pendientes. Un corte de conexión mantiene el mismo ID para reintentar, incluso tras recargar. La interfaz distingue pendiente de confirmado. Bajo el candado existente de `doPost`, el servidor valida fechas, método, importe y saldo/crédito actuales antes de guardar; un exceso concurrente se rechaza y se restaura la copia confirmada. Las operaciones desconocidas no se convierten en cobros nuevos.

## Pruebas locales

- `node tests/abonos-fecha.cjs`: HTML y Apps Script reales contra planilla ficticia en memoria; 29 comprobaciones iniciales.
- `node tests/pacientes-regression.cjs`: 130 comprobaciones de regresión.
- `node tests/sonri-y-permisos.cjs`: 61 comprobaciones.

Los arneses no tienen transporte de red ni credenciales. Cubren atención 1000 del 15/10 con 250 iniciales y abonos 300/200/250 del 20/22/23; aplicación de anticipo sin doble caja; recarga, doble clic parcial, respuesta perdida y reintento, exceso concurrente, fechas inválidas y registros antiguos.

## Despliegue y límites

Publicar primero el Apps Script en la implementación existente de Spa, sin cambiar URL, roles ni permisos, y luego el frontend. No basta subir el `.gs` a GitHub: eso no actualiza Google Apps Script. Verificar la versión `2026-10-23-abonos-fecha` mediante `info` y comprobar el HTML servido antes de declarar publicado. No se realizan pagos de prueba en producción.

Los cobros históricos que sólo tienen acumulado y carecen de fecha efectiva siguen en la fecha de atención con su aviso previo; este cambio no inventa ni redistribuye sus fechas. Una aplicación de crédito encolada puede llegar al servidor al día siguiente; conserva su fecha de aplicación y no crea una entrada de caja.
