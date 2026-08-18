# SPADENTAL · Publicador y gestor de anuncios de Meta

Herramienta en **Python** para:

1. **Publicar posts** automáticamente en **Instagram** (imagen, carrusel,
   Reel) y en una **Página de Facebook** (texto, enlace, foto, programado).
2. **Controlar y subir anuncios** (Marketing API): listar campañas, ver
   métricas, pausar/activar, cambiar presupuesto y **crear anuncios completos**.

Todo usando la **Graph API / Marketing API de Meta**.

> 🔐 **Seguridad ante todo:** el token de acceso vive únicamente en tu
> archivo `.env` (que está en `.gitignore`). **Nunca** se escribe en el
> código ni se sube al repositorio. Si tu token se expuso alguna vez,
> regenéralo en [Meta for Developers](https://developers.facebook.com/).

---

## 1. Requisitos previos en Meta

Para **publicar** en Instagram necesitas:

1. Una **cuenta de Instagram Business o Creator**.
2. Esa cuenta **vinculada a una Página de Facebook**.
3. Una **app** en [developers.facebook.com](https://developers.facebook.com/)
   con el producto *Instagram Graph API* / *Facebook Login*.
4. Un **token de acceso de Página** con estos permisos:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts` *(solo para publicar en Facebook)*

> ℹ️ Instagram **descarga** las imágenes/vídeos desde una **URL pública**;
> no se suben los bytes directamente. Aloja tus imágenes en tu web o en
> cualquier hosting accesible por internet.

---

## 2. Instalación

```bash
# (recomendado) crea un entorno virtual
python -m venv .venv
source .venv/bin/activate        # en Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

## 3. Configuración

```bash
cp .env.example .env
```

Edita `.env` y rellena al menos `META_ACCESS_TOKEN`. Los IDs de Página e
Instagram los puedes descubrir automáticamente (siguiente paso).

| Variable             | Obligatoria | Descripción                                            |
|----------------------|-------------|--------------------------------------------------------|
| `META_ACCESS_TOKEN`  | sí          | Token de acceso (de Página, larga duración ideal).     |
| `IG_USER_ID`         | para IG     | ID de la cuenta de Instagram Business.                 |
| `FB_PAGE_ID`         | para FB     | ID de la Página de Facebook.                           |
| `META_APP_ID`        | opcional    | Solo para renovar/intercambiar tokens.                 |
| `META_APP_SECRET`    | opcional    | Solo para renovar/intercambiar tokens.                 |
| `GRAPH_API_VERSION`  | opcional    | Versión de la Graph API (por defecto `v21.0`).         |

---

## 4. Descubrir tus IDs

```bash
python -m meta_publisher whoami
```

Te listará tus Páginas y, para cada una, el `FB_PAGE_ID` y el `IG_USER_ID`
(con su `@usuario`). Copia los que necesites a tu `.env`.

## 5. Renovar el token (recomendado)

Los tokens cortos caducan en ~1 hora. Conviértelo en uno de **larga
duración** (~60 días). Necesitas `META_APP_ID` y `META_APP_SECRET` en `.env`:

```bash
python -m meta_publisher exchange-token --token <TU_TOKEN_CORTO>
```

Copia el token resultante en `META_ACCESS_TOKEN`.

---

## 6. Publicar

### Instagram

```bash
# Una imagen
python -m meta_publisher instagram \
  --image-url "https://tu-web.com/foto.jpg" \
  --caption "Sonrisas más sanas en SPADENTAL ✨ #odontologia"

# Carrusel (2 a 10 imágenes)
python -m meta_publisher instagram \
  --carousel "https://tu-web.com/antes.jpg" "https://tu-web.com/despues.jpg" \
  --caption "Antes y después"

# Reel (vídeo)
python -m meta_publisher instagram \
  --reel-url "https://tu-web.com/clip.mp4" \
  --caption "Conoce nuestra clínica"
```

### Facebook

```bash
# Texto + enlace
python -m meta_publisher facebook \
  --message "Conoce nuestros implantes dentales" \
  --link "https://tu-web.com/implantes"

# Foto
python -m meta_publisher facebook \
  --image-url "https://tu-web.com/horario.jpg" \
  --caption "Horario de esta semana"

# Programado (epoch en segundos, entre 10 min y 6 meses)
python -m meta_publisher facebook \
  --message "Promoción de blanqueamiento" \
  --schedule 1893456000
```

### Varios posts desde un archivo JSON

```bash
python -m meta_publisher post --file examples/posts.example.json
```

Mira [`examples/posts.example.json`](examples/posts.example.json) para el
formato. Útil para preparar una tanda de publicaciones.

---

## 7. Uso como librería

```python
from meta_publisher import load_config, GraphAPIClient, InstagramPublisher

cfg = load_config()
client = GraphAPIClient(cfg.require_token(), api_version=cfg.api_version)
ig = InstagramPublisher(client, cfg.require_ig_user_id())

media_id = ig.publish_image(
    "https://tu-web.com/foto.jpg",
    caption="¡Nueva promoción en SPADENTAL!",
)
print("Publicado:", media_id)
```

---

## 8. Automatización ("posts automáticos")

Algunas formas de automatizar:

- **cron** (Linux/Mac): programa `python -m meta_publisher post --file ...`.
- **Programación nativa de Facebook**: usa `--schedule` para que el propio
  Facebook publique más tarde (no aplica a Instagram, que publica al instante).
- **Tarea programada de Windows** o un servicio en tu servidor.

> ⚠️ Recuerda renovar el token de Página antes de que caduque (los de
> larga duración duran ~60 días).

---

## 9. Anuncios (Marketing API)

Controla y crea anuncios sobre tu cuenta publicitaria.

### Requisitos adicionales

- Permiso **`ads_management`** en el token (o `ads_read` para solo lectura).
- Tu app necesita **Acceso Avanzado** a `ads_management` y, normalmente,
  **verificación del negocio** para gestionar cuentas reales (no de prueba).
- En `.env`: `META_AD_ACCOUNT_ID` (el `act=` de la URL de Ads Manager) y,
  opcional, `META_BUSINESS_ID`.

> 💡 Tu cuenta ya viene preconfigurada en `.env.example`:
> `META_AD_ACCOUNT_ID=1360245352043819` y `META_BUSINESS_ID=1057933761477026`
> (extraídos de tu URL de Ads Manager; no son secretos).

### Jerarquía de Meta Ads

```
Campaña (objetivo: tráfico, ventas, mensajes…)
  └─ Ad set (presupuesto, público, optimización, calendario)
       └─ Anuncio (creatividad)
```

### Comandos

```bash
# Listar (campaign | adset | ad)
python -m meta_publisher ads list --level campaign
python -m meta_publisher ads list --level adset
python -m meta_publisher ads list --level ad

# Métricas (de toda la cuenta o de un objeto concreto)
python -m meta_publisher ads insights --preset last_7d
python -m meta_publisher ads insights --id 120249407751900203 --level campaign
python -m meta_publisher ads insights --since 2026-06-01 --until 2026-06-19

# Pausar / activar
python -m meta_publisher ads status --id 120249407751920203 --status PAUSED
python -m meta_publisher ads status --id 120249407751920203 --status ACTIVE

# Cambiar presupuesto de un ad set (en CENTAVOS: 10000 = 100.00)
python -m meta_publisher ads budget --id 120249407751910203 --daily 10000

# Crear una campaña + ad set + anuncio completos desde un JSON
python -m meta_publisher ads create --file examples/ad.example.json
```

> 🛡️ **Por seguridad, todo se crea en estado `PAUSED`** para que no empiece
> a gastar. Revisa el anuncio en Ads Manager y actívalo cuando quieras con
> `ads status --id <ID> --status ACTIVE`.

### Subir un anuncio nuevo

Edita [`examples/ad.example.json`](examples/ad.example.json):

- Pon tu `FB_PAGE_ID` real en `creative.object_story_spec.page_id`.
- Ajusta `objective`, `optimization_goal`, `billing_event`, `targeting` y
  `daily_budget` (en centavos de tu moneda).
- Para **promocionar un post que ya existe**, sustituye el bloque
  `creative` por `{ "name": "...", "object_story_id": "PAGEID_POSTID" }`.

Valores de `objective` habituales: `OUTCOME_TRAFFIC`, `OUTCOME_ENGAGEMENT`,
`OUTCOME_LEADS`, `OUTCOME_SALES`, `OUTCOME_AWARENESS`.

### Como librería

```python
from meta_publisher import load_config, GraphAPIClient, AdsManager

cfg = load_config()
client = GraphAPIClient(cfg.require_token(), api_version=cfg.api_version)
ads = AdsManager(client, cfg.require_ad_account())

for c in ads.list("campaign"):
    print(c["id"], c["name"], c.get("effective_status"))

ads.pause("120249407751920203")
ads.update_budget("120249407751910203", daily_budget=15000)
```

---

## Estructura del proyecto

```
meta_publisher/
  config.py       Configuración desde variables de entorno
  client.py       Cliente HTTP base de la Graph API
  instagram.py    Publicación en Instagram (imagen/carrusel/reel)
  facebook.py     Publicación en Página de Facebook
  ads.py          Gestión de anuncios (Marketing API)
  tokens.py       Renovar token y descubrir IDs
  cli.py          Línea de comandos
examples/
  posts.example.json
  ad.example.json
.env.example      Plantilla de configuración (sin secretos)
requirements.txt
```

## Solución de problemas

- **`Falta META_ACCESS_TOKEN`** → no copiaste `.env.example` a `.env` o está vacío.
- **`(#200) Permissions error`** → al token le faltan permisos; revisa la lista del paso 1.
- **`Media ... is not ready`** (Reel) → el vídeo aún se procesa; la herramienta espera, pero vídeos grandes tardan más.
- **La imagen no aparece** → la URL debe ser **pública** y accesible desde internet (no `localhost`).
```

---

# Otras herramientas de este repo

## 🦷 Panel de pacientes (`pacientes.html`)

Panel de control de visitas y atención del consultorio de la Dra. Mirna:
registro de cada visita, **canal por el que llegó el paciente**, servicios con
precio editable, **a cuenta / saldo**, y **recordatorios para reagendar o
contactar**. Página única, se abre con doble clic, funciona sin internet y
opcionalmente sincroniza con una hoja de Google.

Documentación: **[PACIENTES.md](PACIENTES.md)** ·
conexión opcional a Google Sheets: **[SETUP-GOOGLE-SHEETS-SPADENTAL.md](SETUP-GOOGLE-SHEETS-SPADENTAL.md)**

## 📊 Dashboards

- `Spadental_dashboard_clinico_2026_v2.html` — dónde está el negocio
- `analisis-experto-spadental_2.html` — análisis experto
- `informe-julio-2026.html` — informe de Meta Ads
