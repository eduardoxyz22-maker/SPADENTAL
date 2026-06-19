"""Publicacion en una Pagina de Facebook.

Requisitos de Meta:
    - Token de Pagina (Page Access Token).
    - Permisos: pages_manage_posts, pages_read_engagement, pages_show_list.

Soporta:
    - Post de texto (y opcional enlace).
    - Post con una foto a partir de una URL publica.
    - Programacion: published=false + scheduled_publish_time (epoch).
"""

from __future__ import annotations

import time

from .client import GraphAPIClient
from .exceptions import MetaAPIError

# Facebook exige programar entre 10 minutos y 6 meses en el futuro.
MIN_SCHEDULE_SECONDS = 10 * 60
MAX_SCHEDULE_SECONDS = 180 * 24 * 60 * 60


class FacebookPublisher:
    def __init__(self, client: GraphAPIClient, page_id: str):
        self.client = client
        self.page_id = page_id

    def publish_text(self, message: str, link: str | None = None,
                     scheduled_publish_time: int | None = None) -> str:
        """Publica un post de texto (opcionalmente con enlace)."""
        data: dict = {"message": message, "link": link}
        data.update(self._schedule_fields(scheduled_publish_time))
        resp = self.client.post(f"{self.page_id}/feed", data=data)
        return self._extract_id(resp)

    def publish_photo(self, image_url: str, caption: str | None = None,
                      scheduled_publish_time: int | None = None) -> str:
        """Publica una foto a partir de una URL publica."""
        data: dict = {"url": image_url, "caption": caption}
        data.update(self._schedule_fields(scheduled_publish_time))
        resp = self.client.post(f"{self.page_id}/photos", data=data)
        return self._extract_id(resp)

    # -- internos -----------------------------------------------------------
    @staticmethod
    def _schedule_fields(scheduled_publish_time: int | None) -> dict:
        if scheduled_publish_time is None:
            return {}
        delta = scheduled_publish_time - int(time.time())
        if not MIN_SCHEDULE_SECONDS <= delta <= MAX_SCHEDULE_SECONDS:
            raise ValueError(
                "scheduled_publish_time debe estar entre 10 minutos y 6 meses "
                "en el futuro (epoch en segundos)."
            )
        return {"published": "false", "scheduled_publish_time": scheduled_publish_time}

    @staticmethod
    def _extract_id(resp: dict) -> str:
        post_id = resp.get("post_id") or resp.get("id")
        if not post_id:
            raise MetaAPIError(f"No se obtuvo id del post de Facebook: {resp}")
        return post_id
