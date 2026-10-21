#!/bin/sh
# Corre todas las pruebas en las dos clínicas. La red real queda bloqueada (netguard.js):
# el servidor es el .gs del repo corriendo en memoria y los datos son ficticios.
# Uso: cd tests/auditoria && npm install && sh correr-todo.sh
cd "$(dirname "$0")"
fallas=0
for f in s08b-v6 s09-anticipos s10-corregir-cobro s11-no-cuadra s12-planes s13-pago-plan-doctora s14-editar-suma-pago \
         s15-auditoria-servidor s16-paquetes s17-script-viejo s18-paquete-desde-atencion s19-sin-visitas s20-borrar-pago \
         s21-paquete-en-la-fila s22-caso-real s23-diagnostico s24-credito-por-plan; do
  for p in spa cos; do
    r=$(PANEL=$p node -r ./netguard.js $f.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     $f ($p)";; *) echo "FALLA  $f ($p): $r"; fallas=$((fallas+1));; esac
  done
done
# recorrido completo en un Chromium real (si hay uno: variable CHROMIUM o /opt/pw-browsers/chromium)
if [ -x "${CHROMIUM:-/opt/pw-browsers/chromium}" ]; then
  for p in spa cos; do
    r=$(PANEL=$p node -r ./netguard.js e2e-circuito.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-circuito ($p)";; *) echo "FALLA  e2e-circuito ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-sesion-paquete.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-sesion-paquete ($p)";; *) echo "FALLA  e2e-sesion-paquete ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-vincular-visita.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-vincular-visita ($p)";; *) echo "FALLA  e2e-vincular-visita ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-fotos.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-fotos ($p)";; *) echo "FALLA  e2e-fotos ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-pauta.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-pauta ($p)";; *) echo "FALLA  e2e-pauta ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-sesion-larga.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-sesion-larga ($p)";; *) echo "FALLA  e2e-sesion-larga ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-sesion-visible.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-sesion-visible ($p)";; *) echo "FALLA  e2e-sesion-visible ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-sonri-oye.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-sonri-oye ($p)";; *) echo "FALLA  e2e-sonri-oye ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-sesion-repetida.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-sesion-repetida ($p)";; *) echo "FALLA  e2e-sesion-repetida ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-md-ajustes.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-md-ajustes ($p)";; *) echo "FALLA  e2e-md-ajustes ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-md-panel-caja.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-md-panel-caja ($p)";; *) echo "FALLA  e2e-md-panel-caja ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-md-fecha.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-md-fecha ($p)";; *) echo "FALLA  e2e-md-fecha ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-md-cierre.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-md-cierre ($p)";; *) echo "FALLA  e2e-md-cierre ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-md-accesible.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-md-accesible ($p)";; *) echo "FALLA  e2e-md-accesible ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-md-mensajes.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-md-mensajes ($p)";; *) echo "FALLA  e2e-md-mensajes ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-md-presupuesto.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-md-presupuesto ($p)";; *) echo "FALLA  e2e-md-presupuesto ($p): $r"; fallas=$((fallas+1));; esac
    r=$(PANEL=$p node -r ./netguard.js e2e-nombre.js 2>&1 | tail -1)
    case "$r" in "TODO OK"*) echo "OK     e2e-nombre ($p)";; *) echo "FALLA  e2e-nombre ($p): $r"; fallas=$((fallas+1));; esac
  done
else echo "(sin Chromium: se saltea e2e-circuito)"; fi
echo; [ $fallas -eq 0 ] && echo "TODO OK" || echo "FALLAS: $fallas"
exit $fallas
