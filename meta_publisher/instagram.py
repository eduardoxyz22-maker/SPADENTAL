"""Publicacion en Instagram mediante la Content Publishing API.

Flujo general (imagen / reel):
    1. Crear un "contenedor" de medios -> devuelve un creation_id.
    2. (Reel/video) Esperar a que el contenedor termine de procesarse.
    3. Publicar el contenedor -> devuelve el id del post publicado.

Requisitos de Meta:
    - Cuenta de Instagram Business o Creator vinculada a una Pagina.
    - Token con permisos: instagram_basic, instagram_content_publish,
      pages_read_engagement, pages_show_list.
    - Las imagenes/videos deben estar accesibles en una URL publica
      (Instagram los descarga desde ahi; no se suben bytes directamente).
"""

from __future__ import annotations

import time
from typing import Sequence

from .client import GraphAPIClient
from .exceptions import MetaAPIError

# Limite de Instagram: hasta 10 elementos por carrusel.
MAX_CAROUSEL_ITEMS = 10


class InstagramPublisher:
    def __init__(self, client: GraphAPIClient, ig_user_id: str):
        self.client = client
        self.ig_user_id = ig_user_id

    # -- API publica --------------------------------------------------------
    def publish_image(self, image_url: str, caption: str | None = None) -> str:
        """Publica una sola imagen. Devuelve el id del post."""
        creation_id = self._create_container(
            {"image_url": image_url, "caption": caption}
        )
        return self._publish(creation_id)

    def publish_reel(self, video_url: str, caption: str | None = None,
                     cover_url: str | None = None,
                     share_to_feed: bool = True) -> str:
        """Publica un Reel (video). Devuelve el id del post."""
        creation_id = self._create_container({
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption,
            "cover_url": cover_url,
            "share_to_feed": str(share_to_feed).lower(),
        })
        # Los videos necesitan procesamiento; esperamos a que termine.
        self.wait_until_ready(creation_id)
        return self._publish(creation_id)

    def publish_carousel(self, image_urls: Sequence[str],
                         caption: str | None = None) -> str:
        """Publica un carrusel de imagenes (2 a 10). Devuelve el id del post."""
        urls = list(image_urls)
        if not 2 <= len(urls) <= MAX_CAROUSEL_ITEMS:
            raise ValueError(
                f"Un carrusel admite entre 2 y {MAX_CAROUSEL_ITEMS} imagenes "
                f"(recibidas: {len(urls)})."
            )
        children = [
            self._create_container({"image_url": url, "is_carousel_item": "true"})
            for url in urls
        ]
        parent = self._create_container({
            "media_type": "CAROUSEL",
            "children": ",".join(children),
            "caption": caption,
        })
        return self._publish(parent)

    # -- internos -----------------------------------------------------------
    def _create_container(self, fields: dict) -> str:
        resp = self.client.post(f"{self.ig_user_id}/media", data=fields)
        creation_id = resp.get("id")
        if not creation_id:
            raise MetaAPIError(f"No se obtuvo creation_id al crear el contenedor: {resp}")
        return creation_id

    def _publish(self, creation_id: str) -> str:
        resp = self.client.post(
            f"{self.ig_user_id}/media_publish",
            data={"creation_id": creation_id},
        )
        media_id = resp.get("id")
        if not media_id:
            raise MetaAPIError(f"No se obtuvo id del post publicado: {resp}")
        return media_id

    def wait_until_ready(self, creation_id: str, *, timeout: int = 300,
                         interval: int = 5) -> None:
        """Espera a que un contenedor (reel/video) quede en estado FINISHED."""
        deadline = time.monotonic() + timeout
        while True:
            resp = self.client.get(
                creation_id, params={"fields": "status_code,status"}
            )
            status = resp.get("status_code")
            if status == "FINISHED":
                return
            if status == "ERROR":
                raise MetaAPIError(
                    f"El contenedor {creation_id} fallo al procesarse: "
                    f"{resp.get('status')}"
                )
            if time.monotonic() >= deadline:
                raise MetaAPIError(
                    f"Tiempo de espera agotado procesando el contenedor "
                    f"{creation_id} (ultimo estado: {status})."
                )
            time.sleep(interval)
