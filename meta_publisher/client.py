"""Cliente HTTP base contra la Graph API de Meta."""

from __future__ import annotations

import logging
from typing import Any

import requests

from .exceptions import MetaAPIError

logger = logging.getLogger("meta_publisher")

GRAPH_BASE = "https://graph.facebook.com"


class GraphAPIClient:
    """Envoltura fina sobre `requests` para hablar con la Graph API.

    Inyecta el access token en cada peticion y traduce los errores de
    Meta a `MetaAPIError` con la informacion util ya extraida.
    """

    def __init__(self, access_token: str, api_version: str = "v21.0",
                 *, timeout: int = 60, session: requests.Session | None = None):
        if not access_token:
            raise ValueError("access_token es obligatorio")
        self.access_token = access_token
        self.api_version = api_version
        self.timeout = timeout
        self.session = session or requests.Session()

    # -- construccion de URL ------------------------------------------------
    def _url(self, path: str) -> str:
        path = path.lstrip("/")
        return f"{GRAPH_BASE}/{self.api_version}/{path}"

    # -- peticiones ---------------------------------------------------------
    def get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        return self._request("GET", path, params=params)

    def post(self, path: str, data: dict[str, Any] | None = None) -> dict:
        return self._request("POST", path, data=data)

    def _request(self, method: str, path: str, *,
                 params: dict[str, Any] | None = None,
                 data: dict[str, Any] | None = None) -> dict:
        url = self._url(path)

        params = {k: v for k, v in (params or {}).items() if v is not None}
        data = {k: v for k, v in (data or {}).items() if v is not None}

        # El token va siempre, pero nunca se registra en logs.
        if method == "GET":
            params.setdefault("access_token", self.access_token)
        else:
            data.setdefault("access_token", self.access_token)

        logger.debug("%s %s params=%s", method, url, _redact(params))
        try:
            resp = self.session.request(
                method, url, params=params, data=data, timeout=self.timeout
            )
        except requests.RequestException as exc:
            raise MetaAPIError(f"Fallo de red al llamar a la Graph API: {exc}") from exc

        try:
            body = resp.json()
        except ValueError:
            body = {"raw": resp.text}

        if not resp.ok or (isinstance(body, dict) and "error" in body):
            raise MetaAPIError.from_response(resp.status_code, body)

        return body


def _redact(params: dict[str, Any]) -> dict[str, Any]:
    """Oculta el token en cualquier traza de log."""
    safe = dict(params)
    if "access_token" in safe:
        safe["access_token"] = "***"
    return safe
