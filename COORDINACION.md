# Coordinación — paneles de pacientes

## Cambio funcional del 2 de octubre de 2026

Alcance autorizado: `pacientes.html` y `cosmetic/pacientes.html`, pruebas aisladas y publicación frontend en GitHub Pages. No se modifican datos reales, claves, roles, permisos ni autenticación. No se despliega Apps Script. Mantener las URLs, nombres, listas de precios, equipos y claves de almacenamiento de cada clínica.

### Comportamiento implementado

- Los pagos adicionales se registran con ID, fecha, método e importe en `cobrosPosteriores`, dentro de la atención. `acuenta` y `pagos` siguen siendo acumulados para ficha, deuda y planes. Caja, panel, meta, resumen diario, informe mensual y Excel de caja usan la proyección por fecha de cobro. La visita no se duplica. El informe de atenciones queda identificado como acumulado por atención.
- Registrar un pago mayor que el saldo se bloquea. Un pago reduce el saldo registrado, respetando ajustes previos. Los nuevos cobros de atenciones ya atendidas se agregan con **Registrar pago**, no editando el acumulado. No se permite que una edición borre los importes de cobros fechados.
- No se marca una sesión por `No asistió`, cancelación u otro estado distinto de `Atendido`. Corregir el estado o el plan libera la sesión que pertenecía a esa atención. No se ejecuta limpieza retroactiva.
- La cita derivada pendiente actualiza hora, fecha, profesional, motivo y plan. Quitar la próxima fecha la cancela conservando el historial. Las citas resueltas no se reescriben ni se resucitan.
- El costo de laboratorio explícitamente igual a cero se guarda como cero; no toma el precio de catálogo.
- Nuevos respaldos: `schemaVersion: 2` y `clinicaId` estable (`spadental` o `cosmetic`). La importación rechaza otra clínica, registros etiquetados con otra clínica y respaldos sin identificación. No se infiere origen del nombre de archivo ni del nombre editable de la clínica. Esto previene errores operativos; no reemplaza la autenticación del servidor.
- Protección provisional de identidad: un mismo nombre con CI distintos bloquea nuevas asociaciones, edición y acceso agregado a ficha/planes. Para agregar una nueva visita o cita a un nombre ya existente se verifica un CI coincidente y único. Se agregó CI a Agenda y se retiró su autocompletado por nombre en atención. No se renombran ni separan fichas existentes.

### Decisiones pendientes; no migrar automáticamente

1. **Identidad:** el modelo anterior utiliza el nombre como clave. Los homónimos existentes y las fichas sin CI requieren validación por la clínica. No inventar CI ni distinguir personas por teléfono o fecha de nacimiento sin revisión. Solución posterior propuesta: ID estable de paciente por clínica, referencias explícitas desde atenciones/citas/planes y tabla revisada de correspondencia de registros antiguos. Requiere aprobar el mapeo y adaptar el backend; no está implementada ni desplegada en este cambio. Mientras tanto se bloquean asociaciones ambiguas; no se afirma que las fichas históricas ya estén desambiguadas.
2. **Cobros históricos:** no se conoce la fecha real de cobros anteriores guardados solo como un acumulado. La proyección conserva ese residual en la fecha de la atención y muestra una advertencia de conciliación. No extraer supuestas fechas de observaciones ni redistribuir importes automáticamente. Se necesita una relación revisada de atención, fecha, importe y método por clínica antes de migrar. No afirmar que los arqueos históricos quedaron reconciliados.
3. **Respaldos antiguos:** están bloqueados por carecer de origen verificable en el formato. Requieren confirmar procedencia en un proceso offline separado y revisar identidades antes de convertirlos. No basta renombrar el archivo ni asignarle la clínica actual.

### Apps Script y seguridad: diagnóstico separado

Los archivos `.gs` del repositorio no cambian. Su serialización `_extra_json` conserva `cobrosPosteriores`, `cobroInicialFechado` y `clinicaId`; se comprobó el round-trip en memoria con datos ficticios en ambas variantes. Esto no verifica cuál versión está desplegada en cada Web App. Si una implementación usa una versión anterior que omite esos campos, hace falta desplegar la versión compatible por separado. No acceder a datos reales para probarlo ni declarar el backend productivo corregido.

El diagnóstico previo observó que `doPost` y `doGet` no comprueban identidad/rol antes de ejecutar acciones. La posible exposición depende de la implementación real, no verificada. No se cambia ese comportamiento aquí. Propuesta para aprobación explícita: autenticación de usuario verificada en servidor, lista de usuarios/roles por clínica, autorización de cada operación antes de leer/escribir, rechazo de `clinicaId` ajeno y registro de auditoría. Antes de implementar se debe acordar el proveedor de identidad, la matriz de roles y el procedimiento de despliegue/recuperación. No generar claves o tokens como sustituto de esa decisión.

### Verificación y publicación

Ejecutar desde la raíz: `node tests/pacientes-regression.cjs`. Requiere Node, sin dependencias externas. La prueba carga el JavaScript de los HTML sin iniciar la aplicación, simula DOM, almacenamiento y backend, e intercepta todas las llamadas `fetch`; no expone transporte de red ni usa perfiles de navegador. Usa exclusivamente datos ficticios. Comprueba también el serializador real de ambos `.gs` en memoria, el motor compartido y el almacenamiento separado en un mismo origen.

80 comprobaciones pasaron antes de publicar. No incluye prueba visual en navegador real ni prueba contra las Web Apps reales. La publicación se confirma con el commit y la ejecución `pages build and deployment`; un commit por sí solo no prueba que Pages lo sirva. Consultar el reporte de entrega para el SHA y el resultado del despliegue.

Base revisada: `7d2e538463f1390c66132afdabd405daa06df975`. Al publicar, conservar cualquier cambio concurrente: actualizar sin `force` y verificar las versiones de los archivos afectados. No revertir páginas ajenas.

Antes de uso operativo, recargar ambos paneles en los equipos: una pestaña antigua puede sobrescribir campos nuevos al editar una atención. El saneamiento de históricos y los cambios de autenticación siguen pendientes de aprobación independiente.
