"""Carga de configuracion desde variables de entorno (.env)."""

from __future__ import annotations

import os
from dataclasses import dataclass

from .exceptions import ConfigError

try:  # carga .env automaticamente si python-dotenv esta instalado
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:  # pragma: no cover
    pass


DEFAULT_API_VERSION = "v21.0"


@dataclass
class Config:
    """Configuracion de acceso a la Graph API.

    Los valores se leen de variables de entorno. El token NUNCA se
    escribe en codigo ni se sube al repositorio: vive solo en .env.
    """

    access_token: str
    api_version: str = DEFAULT_API_VERSION
    app_id: str | None = None
    app_secret: str | None = None
    ig_user_id: str | None = None
    fb_page_id: str | None = None

    def require_token(self) -> str:
        if not self.access_token:
            raise ConfigError(
                "Falta META_ACCESS_TOKEN. Copia .env.example a .env y rellenalo."
            )
        return self.access_token

    def require_ig_user_id(self) -> str:
        if not self.ig_user_id:
            raise ConfigError(
                "Falta IG_USER_ID (cuenta de Instagram Business). "
                "Obtenlo con:  python -m meta_publisher whoami"
            )
        return self.ig_user_id

    def require_page_id(self) -> str:
        if not self.fb_page_id:
            raise ConfigError(
                "Falta FB_PAGE_ID (ID de la Pagina de Facebook). "
                "Obtenlo con:  python -m meta_publisher whoami"
            )
        return self.fb_page_id

    def require_app_credentials(self) -> tuple[str, str]:
        if not self.app_id or not self.app_secret:
            raise ConfigError(
                "Faltan META_APP_ID y/o META_APP_SECRET para esta operacion."
            )
        return self.app_id, self.app_secret


def load_config() -> Config:
    """Construye la configuracion a partir del entorno."""
    return Config(
        access_token=os.getenv("META_ACCESS_TOKEN", "").strip(),
        api_version=os.getenv("GRAPH_API_VERSION", DEFAULT_API_VERSION).strip()
        or DEFAULT_API_VERSION,
        app_id=(os.getenv("META_APP_ID") or "").strip() or None,
        app_secret=(os.getenv("META_APP_SECRET") or "").strip() or None,
        ig_user_id=(os.getenv("IG_USER_ID") or "").strip() or None,
        fb_page_id=(os.getenv("FB_PAGE_ID") or "").strip() or None,
    )
