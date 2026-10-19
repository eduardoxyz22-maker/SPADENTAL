# Pruebas de auditoría de los paneles

Prueban `pacientes.html` (Spadental) y `cosmetic/pacientes.html` (Cosmetic) contra el **Apps Script real del repo corriendo en memoria** (`gsserver.js`). Usan datos ficticios y **no tocan la red**: `netguard.js` corta cualquier conexión saliente.

```sh
cd tests/auditoria
npm install            # jsdom y playwright-core
sh correr-todo.sh      # todas, en las dos clínicas
PANEL=spa node -r ./netguard.js s21-paquete-en-la-fila.js   # una sola (PANEL=spa o cos)
```

- `h.js` carga el panel en jsdom con un `fetch` falso que habla con el `.gs` en memoria. `server.latency = 1500` simula a Google tardando: úsenlo en todo flujo nuevo de plata o fichas.
- `lib.js` tiene ayudas comunes (abrir, entrar, cargar una atención). Las claves de fábrica se leen del HTML.
- `s08b`…`s22`: una prueba por tema (anticipos, corregir cobro, planes, pagos de doctoras, servidor, paquetes, script anterior, paquete desde la atención, pacientes sin visitas, borrar pagos, paquete en la fila, caso real con latencia).
- `e2e-circuito.js`: recorrido completo con clics en Chromium real (planes, paquetes, pagos, doctora que marca una sesión, borrado). Necesita un Chromium (`CHROMIUM=/ruta`).
- `viejo-spa.gs` / `viejo-cos.gs`: el Apps Script anterior (`2026-10-15-b`), para probar el panel nuevo con el script viejo.

Además están las pruebas del repo en `tests/*.cjs` (regresión, Sonri y permisos).
