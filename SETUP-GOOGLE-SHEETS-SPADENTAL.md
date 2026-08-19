# Conectar `pacientes.html` a una hoja de Google

El panel **funciona sin hacer nada de esto**: por defecto guarda todo en el
navegador donde se carga (modo local). Conectalo a una hoja de Google solo si
querés que **la doctora, la recepción y el celular vean los mismos datos**.

Tiempo estimado: 10 minutos, una sola vez.

---

## 1. Crear la hoja

1. Entrá a [sheets.new](https://sheets.new) con la cuenta de Google del consultorio.
2. Ponele un nombre, por ejemplo **Spadental · Pacientes**.
3. No hace falta crear pestañas ni encabezados: el script arma solo las tres
   hojas que usa — `Atenciones` (una fila por visita), `Pacientes` (una fila
   por persona: nacimiento, ficha médica y planes) y `Egresos` (lo que sale
   de caja).

> **Se puede saltear este paso.** Si preferís crear el proyecto suelto desde
> [script.google.com](https://script.google.com), el script **crea él mismo**
> una planilla llamada *Spadental · Pacientes* en tu Drive la primera vez que
> se guarda algo, y se acuerda de ella. Para ver cuál está usando, ejecutá la
> función `probar()` desde el editor: el enlace sale en *Registro de ejecución*.

## 2. Pegar el script

1. En esa hoja: menú **Extensiones → Apps Script**.
2. Borrá lo que aparezca en el editor.
3. Copiá **todo** el contenido de `google-apps-script-pacientes.gs` y pegalo ahí.
4. Guardá (💾 o `Ctrl+S`).

## 3. Publicarlo como aplicación web

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje ⚙️ elegí **Aplicación web**.
3. Completá así — **estas dos opciones son las que fallan siempre**:

   | Campo | Valor obligatorio |
   |---|---|
   | Descripción | `Spadental pacientes v1` |
   | **Ejecutar como** | **Yo** (tu cuenta) |
   | **Quién tiene acceso** | **Cualquier persona** |

   > ⚠️ La opción *"Cualquier persona"* **solo aparece si antes pusiste
   > "Ejecutar como: Yo"**. Si elegís *"Cualquier persona con una cuenta de
   > Google"*, la página va a recibir una pantalla de login en vez de datos y
   > no va a funcionar.

4. **Implementar**. Google te va a pedir autorizar la primera vez: aceptá
   (**Configuración avanzada → Ir a … (no seguro)** → **Permitir**). Es tu
   propio script sobre tu propia hoja.
5. Copiá la **URL de la aplicación web**. Termina en `/exec` y se parece a:

   ```
   https://script.google.com/macros/s/AKfycb.....................:/exec
   ```

## 4. Pegar la URL en el panel

Abrí `pacientes.html` con cualquier editor de texto y, cerca del principio,
cambiá esta línea:

```js
var SHEETS_URL = '';
```

por

```js
var SHEETS_URL = 'https://script.google.com/macros/s/TU-URL-AQUI/exec';
```

Guardá y subí el archivo. Al abrirlo vas a ver el aviso verde
**🟢 Conectado a la hoja de Google** en vez del amarillo de modo local.

---

## Si ya lo tenías conectado y actualizaste el panel

Cuando el `.gs` cambia —al agregarse las hojas `Pacientes` y `Egresos`, o la
columna `Plan`— **no alcanza con pegar el código y guardar**: hay que publicar
una versión nueva, si no la aplicación web sigue sirviendo la anterior.

1. Pegá de nuevo **todo** `google-apps-script-pacientes.gs` en el editor y guardá.
2. **Implementar → Administrar implementaciones → editar ✏️ → Versión: Nueva
   versión → Implementar**.
3. La URL `/exec` **no cambia**: no hay que tocar el HTML.

Los encabezados que falten se completan solos la próxima vez que el script
abra la planilla, y las filas que ya estaban no se tocan. Mientras no
redeployes, el panel sigue funcionando: guarda todo en el equipo y encola los
cambios hasta que el servidor los acepte.

## Cómo comprobar que quedó bien

1. Abrí el panel, cargá una atención de prueba.
2. Andá a la hoja de Google: tiene que aparecer una fila nueva en `Atenciones`.
3. Abrí el panel desde **otro** dispositivo y tocá **🔄 Actualizar** en la
   pestaña *Atenciones*: la atención de prueba tiene que aparecer.
4. Borrá la prueba desde el panel (ficha → **Borrar**) y verificá que la fila
   desaparece de la hoja.
5. Cargale a alguien la **fecha de nacimiento** desde su ficha médica: tiene
   que aparecer una fila en la hoja `Pacientes`.
6. Registrá un egreso de prueba desde *Caja*: tiene que aparecer una fila en
   la hoja `Egresos`. Borralo después y verificá que la fila desaparece.

## Si algo falla

| Síntoma | Causa casi segura |
|---|---|
| Sigue en modo local (aviso amarillo) | La URL no termina en `/exec`, o quedó con comillas mal pegadas |
| No aparece nada al actualizar | Se publicó con *"Ejecutar como: Usuario que accede"* → volvé al paso 3 |
| Se guarda pero no lo ven los demás | Cada uno abrió una copia distinta del archivo; todos tienen que abrir la **misma** URL publicada |
| Cambiaste el script y no se nota | Hay que **Implementar → Administrar implementaciones → editar ✏️ → Nueva versión** |
| `Cannot read properties of null (reading 'getSheetByName')` | Versión vieja del script en un proyecto suelto. Pegá el `.gs` actual y **redeployá como Nueva versión** |
| `Se requiere autorización` / `PERMISSION_DENIED` | Ejecutá `probar()` una vez desde el editor y aceptá los permisos |

## Nota de seguridad

La URL `/exec` queda escrita dentro del HTML. Cualquiera que tenga el archivo o
la dirección de la página puede leer y escribir en esa hoja. Para un consultorio
con la página compartida solo entre el equipo alcanza; si en algún momento se
publica en un sitio abierto, conviene agregarle una clave. Los datos de
pacientes son sensibles: no publiques esta página en un sitio indexable.

## Respaldo

Conectado o no, en **Ajustes → Datos y respaldo** tenés:

- **⬇ Excel de todo** — planilla con las atenciones, el resumen por canal y por servicio.
- **⬇ Respaldo JSON** — copia exacta de todo (atenciones + fichas de pacientes
  con su ficha médica y sus planes + egresos + precios, comisiones y canales
  configurados).
- **⬆ Restaurar JSON** — vuelve a cargar un respaldo (agrega, no pisa lo que ya hay).

En modo local conviene bajar el respaldo una vez por semana: si se borra el
historial del navegador, se borran los datos.
