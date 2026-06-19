"""Utilidades de tokens y descubrimiento de cuentas.

- Intercambio de token de corta duracion por uno de larga duracion.
- Listado de Paginas del usuario y sus cuentas de Instagram vinculadas
  (para obtener FB_PAGE_ID e IG_USER_ID sin buscarlos a mano).
"""

from __future__ import annotations

from .client import GraphAPIClient


def exchange_for_long_lived(client: GraphAPIClient, app_id: str,
                            app_secret: str, short_lived_token: str) -> dict:
    """Devuelve {'access_token': ..., 'expires_in': ...} de larga duracion."""
    return client.get("oauth/access_token", params={
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_lived_token,
    })


def list_pages_and_instagram(client: GraphAPIClient) -> list[dict]:
    """Lista las Paginas del usuario y su cuenta de Instagram asociada.

    Cada elemento: {page_id, page_name, page_access_token,
                    instagram_user_id, instagram_username}
    """
    resp = client.get("me/accounts", params={
        "fields": "id,name,access_token,"
                  "instagram_business_account{id,username}",
        "limit": 100,
    })
    out: list[dict] = []
    for page in resp.get("data", []):
        ig = page.get("instagram_business_account") or {}
        out.append({
            "page_id": page.get("id"),
            "page_name": page.get("name"),
            "page_access_token": page.get("access_token"),
            "instagram_user_id": ig.get("id"),
            "instagram_username": ig.get("username"),
        })
    return out
