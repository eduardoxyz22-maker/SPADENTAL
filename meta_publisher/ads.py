"""Gestion de anuncios con la Marketing API de Meta.

Permite, sobre una cuenta publicitaria (act_<id>):
    - Listar campanas, conjuntos de anuncios (ad sets) y anuncios.
    - Consultar metricas (insights).
    - Pausar / activar cualquier objeto.
    - Cambiar presupuesto de un ad set.
    - Crear una campana completa (campana -> ad set -> creatividad -> anuncio),
      ya sea desde cero o promocionando un post existente.

Jerarquia de Meta Ads:
    Campana (objetivo)
      └─ Ad set (presupuesto, publico, optimizacion, calendario)
           └─ Anuncio (creatividad)

Requisitos:
    - Permiso `ads_management` en el token (o `ads_read` para solo lectura).
    - La app necesita Acceso Avanzado + verificacion del negocio para
      gestionar cuentas que no sean de prueba.

Importante:
    - Los presupuestos y pujas van en la *unidad minima* de la moneda de la
      cuenta (p. ej. centavos): 5000 = 50.00.
    - Por seguridad, los objetos se crean en estado PAUSED por defecto para
      que NO empiecen a gastar hasta que tu los actives.
"""

from __future__ import annotations

import json
from typing import Any, Iterable

from .client import GraphAPIClient
from .exceptions import MetaAPIError, MetaError

# Campos por defecto al listar cada nivel.
DEFAULT_FIELDS = {
    "campaign": "id,name,status,effective_status,objective,daily_budget,"
                "lifetime_budget,created_time",
    "adset": "id,name,status,effective_status,campaign_id,daily_budget,"
             "lifetime_budget,optimization_goal,billing_event,start_time,end_time",
    "ad": "id,name,status,effective_status,adset_id,campaign_id,creative",
}

# Endpoint de coleccion por nivel dentro de la cuenta.
_EDGE = {"campaign": "campaigns", "adset": "adsets", "ad": "ads"}


def _encode(data: dict[str, Any]) -> dict[str, Any]:
    """Serializa a JSON los valores que son dict o list (los exige la API)."""
    out: dict[str, Any] = {}
    for key, value in data.items():
        if value is None:
            continue
        if isinstance(value, (dict, list)):
            out[key] = json.dumps(value)
        elif isinstance(value, bool):
            out[key] = str(value).lower()
        else:
            out[key] = value
    return out


class AdsManager:
    def __init__(self, client: GraphAPIClient, ad_account_id: str):
        self.client = client
        # Normaliza al formato act_<id>.
        acc = str(ad_account_id).strip()
        self.account = acc if acc.startswith("act_") else f"act_{acc}"

    # -- lectura ------------------------------------------------------------
    def list(self, level: str, *, fields: str | None = None,
             limit: int = 50, effective_status: Iterable[str] | None = None
             ) -> list[dict]:
        """Lista campanas / ad sets / anuncios de la cuenta."""
        level = self._check_level(level)
        params: dict[str, Any] = {
            "fields": fields or DEFAULT_FIELDS[level],
            "limit": limit,
        }
        if effective_status:
            params["effective_status"] = json.dumps(list(effective_status))
        resp = self.client.get(f"{self.account}/{_EDGE[level]}", params=params)
        return resp.get("data", [])

    def insights(self, *, obj_id: str | None = None, level: str = "campaign",
                 fields: str | None = None, date_preset: str | None = None,
                 since: str | None = None, until: str | None = None,
                 limit: int = 50) -> list[dict]:
        """Metricas de la cuenta o de un objeto concreto.

        Indica `date_preset` (p. ej. 'today', 'last_7d', 'maximum') o un
        rango con `since`/`until` (YYYY-MM-DD).
        """
        target = obj_id or self.account
        params: dict[str, Any] = {
            "level": level,
            "fields": fields or (
                "campaign_name,adset_name,ad_name,impressions,reach,clicks,"
                "spend,cpc,cpm,ctr,actions,cost_per_action_type"
            ),
            "limit": limit,
        }
        if since and until:
            params["time_range"] = json.dumps({"since": since, "until": until})
        else:
            params["date_preset"] = date_preset or "last_7d"
        resp = self.client.get(f"{target}/insights", params=params)
        return resp.get("data", [])

    # -- control ------------------------------------------------------------
    def set_status(self, obj_id: str, status: str) -> dict:
        """Cambia el estado de un objeto: ACTIVE, PAUSED, ARCHIVED, DELETED."""
        status = status.upper()
        if status not in {"ACTIVE", "PAUSED", "ARCHIVED", "DELETED"}:
            raise ValueError(f"Estado no valido: {status}")
        return self.client.post(obj_id, data={"status": status})

    def pause(self, obj_id: str) -> dict:
        return self.set_status(obj_id, "PAUSED")

    def activate(self, obj_id: str) -> dict:
        return self.set_status(obj_id, "ACTIVE")

    def update_budget(self, adset_id: str, *, daily_budget: int | None = None,
                      lifetime_budget: int | None = None) -> dict:
        """Actualiza el presupuesto de un ad set (en la unidad minima)."""
        if daily_budget is None and lifetime_budget is None:
            raise ValueError("Indica daily_budget o lifetime_budget.")
        data = _encode({
            "daily_budget": daily_budget,
            "lifetime_budget": lifetime_budget,
        })
        return self.client.post(adset_id, data=data)

    # -- creacion -----------------------------------------------------------
    def create_campaign(self, name: str, objective: str, *,
                        status: str = "PAUSED",
                        special_ad_categories: list | None = None,
                        **extra: Any) -> str:
        """Crea una campana y devuelve su id.

        `objective`: p. ej. OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT,
        OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_AWARENESS.
        """
        data = _encode({
            "name": name,
            "objective": objective,
            "status": status,
            "special_ad_categories": special_ad_categories or [],
            **extra,
        })
        return self._created_id(self.client.post(f"{self.account}/campaigns", data=data))

    def create_adset(self, name: str, campaign_id: str, *,
                     optimization_goal: str, billing_event: str,
                     daily_budget: int | None = None,
                     lifetime_budget: int | None = None,
                     targeting: dict | None = None,
                     bid_amount: int | None = None,
                     bid_strategy: str | None = None,
                     status: str = "PAUSED",
                     start_time: str | None = None,
                     end_time: str | None = None,
                     **extra: Any) -> str:
        """Crea un ad set y devuelve su id."""
        if daily_budget is None and lifetime_budget is None:
            raise ValueError("Un ad set necesita daily_budget o lifetime_budget.")
        data = _encode({
            "name": name,
            "campaign_id": campaign_id,
            "optimization_goal": optimization_goal,
            "billing_event": billing_event,
            "daily_budget": daily_budget,
            "lifetime_budget": lifetime_budget,
            "targeting": targeting or {"geo_locations": {"countries": ["MX"]}},
            "bid_amount": bid_amount,
            "bid_strategy": bid_strategy,
            "status": status,
            "start_time": start_time,
            "end_time": end_time,
            **extra,
        })
        return self._created_id(self.client.post(f"{self.account}/adsets", data=data))

    def create_creative(self, name: str, *, object_story_id: str | None = None,
                        object_story_spec: dict | None = None,
                        **extra: Any) -> str:
        """Crea una creatividad y devuelve su id.

        - Usa `object_story_id` para promocionar un post existente.
        - Usa `object_story_spec` para una creatividad nueva (link/foto).
        """
        if not object_story_id and not object_story_spec:
            raise ValueError("Indica object_story_id u object_story_spec.")
        data = _encode({
            "name": name,
            "object_story_id": object_story_id,
            "object_story_spec": object_story_spec,
            **extra,
        })
        return self._created_id(
            self.client.post(f"{self.account}/adcreatives", data=data)
        )

    def create_ad(self, name: str, adset_id: str, *,
                  creative_id: str | None = None,
                  creative: dict | None = None,
                  status: str = "PAUSED", **extra: Any) -> str:
        """Crea un anuncio y devuelve su id."""
        if creative_id:
            creative = {"creative_id": creative_id}
        if not creative:
            raise ValueError("Indica creative_id o creative.")
        data = _encode({
            "name": name,
            "adset_id": adset_id,
            "creative": creative,
            "status": status,
            **extra,
        })
        return self._created_id(self.client.post(f"{self.account}/ads", data=data))

    # -- alto nivel: crear todo desde un spec -------------------------------
    def create_from_spec(self, spec: dict) -> dict:
        """Crea campana + ad set + (creatividad) + anuncio desde un dict.

        Estructura esperada (ver examples/ad.example.json):
            {
              "campaign": {...},
              "adset":    {...},        # sin campaign_id (se inyecta)
              "creative": {...},        # opcional si el anuncio referencia post
              "ad":       {...}         # sin adset_id/creative (se inyectan)
            }
        Devuelve {campaign_id, adset_id, creative_id, ad_id}.
        """
        result: dict[str, str] = {}

        campaign = dict(spec["campaign"])
        result["campaign_id"] = self.create_campaign(
            campaign.pop("name"), campaign.pop("objective"), **campaign
        )

        adset = dict(spec["adset"])
        result["adset_id"] = self.create_adset(
            adset.pop("name"), result["campaign_id"], **adset
        )

        creative_id = None
        if spec.get("creative"):
            creative = dict(spec["creative"])
            creative_id = self.create_creative(creative.pop("name"), **creative)
            result["creative_id"] = creative_id

        ad = dict(spec["ad"])
        if creative_id and not ad.get("creative_id") and not ad.get("creative"):
            ad["creative_id"] = creative_id
        result["ad_id"] = self.create_ad(
            ad.pop("name"), result["adset_id"], **ad
        )
        return result

    # -- helpers ------------------------------------------------------------
    @staticmethod
    def _check_level(level: str) -> str:
        level = level.lower()
        if level not in _EDGE:
            raise ValueError("level debe ser: campaign, adset o ad.")
        return level

    @staticmethod
    def _created_id(resp: dict) -> str:
        obj_id = resp.get("id")
        if not obj_id:
            raise MetaAPIError(f"La API no devolvio un id al crear el objeto: {resp}")
        return obj_id
