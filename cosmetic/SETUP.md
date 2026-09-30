# Cosmetic Dental & Face Center · conectar el panel a su hoja de Google

`cosmetic/pacientes.html` es el mismo panel que el de Spadental, pero para la
otra clínica: **sus propios pacientes, su propia lista de precios y su propio
equipo** (Dra. Mirna, Dra. Brenda, Dra. Shirley). Lo lleva Cecilia en recepción.

Los dos paneles viven en el mismo sitio y **no comparten nada**: cada uno
guarda en su propia hoja de Google y en su propio espacio del navegador.

## Claves de entrada (cambiarlas el primer día)

| Quién | Clave inicial | Qué abre |
|---|---|---|
| Recepción (Cecilia) | `cosmetic2026` | Cargar atenciones, agenda, recordatorios |
| Dueña (Dra. Mirna) | `mirnacosmetic2026` | Todo: caja, panel, liquidación, ajustes |
| Cada doctora | *sin clave todavía* | Su propia agenda y sus atenciones |

Las tres se cambian en **Ajustes** entrando como dueña. Las claves de las
doctoras se asignan ahí mismo (*Claves de las doctoras*).

## Conectarlo a Google (10 minutos, una sola vez)

Hasta que se haga esto el panel funciona igual, pero **solo en el navegador
donde se carga** (aviso amarillo *Modo local*). Para que Cecilia, la Dra. Mirna
y el celular vean lo mismo:

1. **Crear la hoja.** Entrá a [sheets.new](https://sheets.new) con la cuenta
   de Google de la clínica y ponele **Cosmetic · Pacientes**. No hace falta
   crear pestañas: el script arma solo `Atenciones`, `Pacientes` y `Egresos`.
2. **Pegar el script.** En esa hoja: **Extensiones → Apps Script**. Borrá lo
   que haya, pegá **todo** el contenido de `cosmetic/google-apps-script-pacientes.gs`
   y guardá. Es el script de Cosmetic, no el de Spadental (son casi iguales,
   pero este nombra su planilla y sus ajustes aparte).
3. **Publicarlo.** **Implementar → Nueva implementación → ⚙️ Aplicación web**:

   | Campo | Valor obligatorio |
   |---|---|
   | Descripción | `Cosmetic pacientes v1` |
   | **Ejecutar como** | **Yo** (tu cuenta) |
   | **Quién tiene acceso** | **Cualquier persona** |

   > ⚠️ *"Cualquier persona"* solo aparece si antes elegiste *"Ejecutar como:
   > Yo"*. Con *"Cualquier persona con una cuenta de Google"* el panel recibe
   > una pantalla de login en vez de datos y no funciona.

   Autorizá la primera vez (**Configuración avanzada → Ir a … → Permitir**) y
   copiá la **URL de la aplicación web** (termina en `/exec`).
4. **La URL ya está pegada en el panel.** `cosmetic/pacientes.html` viene
   con la URL `/exec` del Web App de Cosmetic cargada, cerca del principio:

   ```js
   var SHEETS_URL = 'https://script.google.com/macros/s/…/exec';
   ```

   Solo hay que tocarla si se vuelve a crear la implementación (paso 3) y
   Google entrega una URL nueva: se reemplaza, se guarda y se sube el archivo.
   Al abrir el panel tiene que decir **🟢 Conectado a la hoja de Google**.

## Cómo comprobar que quedó bien

1. Cargá una atención de prueba desde el panel: tiene que aparecer una fila
   en la hoja `Atenciones` de **Cosmetic · Pacientes** (y **ninguna** en la
   de Spadental).
2. Abrí el panel desde otro dispositivo y tocá **🔄 Actualizar**: la prueba
   tiene que estar.
3. Borrá la prueba desde su ficha → **Borrar**: la fila desaparece.

## Si algo falla

| Síntoma | Causa casi segura |
|---|---|
| Sigue en modo local (aviso amarillo) | La URL no termina en `/exec` o quedó con comillas mal pegadas |
| No aparece nada al actualizar | Se publicó con *"Ejecutar como: Usuario que accede"* → volvé al paso 3 |
| Las atenciones aparecen en la hoja de Spadental | Se pegó la URL de Spadental. Cada clínica tiene la suya |
| Cambiaste el script y no se nota | **Implementar → Administrar implementaciones → ✏️ → Nueva versión** |
| `Se requiere autorización` | Ejecutá `probar()` una vez desde el editor y aceptá los permisos |

Para el resto (respaldos, Excel, restaurar) vale lo mismo que en
`SETUP-GOOGLE-SHEETS-SPADENTAL.md`.
