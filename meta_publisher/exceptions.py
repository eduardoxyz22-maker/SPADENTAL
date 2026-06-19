"""Errores propios del paquete."""

from __future__ import annotations


class MetaError(Exception):
    """Error base del paquete."""


class ConfigError(MetaError):
    """Falta configuracion o es invalida (token, IDs, etc.)."""


class MetaAPIError(MetaError):
    """La Graph API devolvio un error.

    Conserva la informacion util del cuerpo de error de Meta para
    poder diagnosticar (codigo, subcodigo, tipo y mensaje).
    """

    def __init__(self, message: str, *, status: int | None = None,
                 code: int | None = None, subcode: int | None = None,
                 fbtrace_id: str | None = None, error_type: str | None = None,
                 payload: dict | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.subcode = subcode
        self.fbtrace_id = fbtrace_id
        self.error_type = error_type
        self.payload = payload or {}

    @classmethod
    def from_response(cls, status: int, body: dict) -> "MetaAPIError":
        err = (body or {}).get("error", {}) if isinstance(body, dict) else {}
        message = err.get("message") or f"Error HTTP {status} de la Graph API"
        return cls(
            message,
            status=status,
            code=err.get("code"),
            subcode=err.get("error_subcode"),
            fbtrace_id=err.get("fbtrace_id"),
            error_type=err.get("type"),
            payload=body if isinstance(body, dict) else {},
        )

    def __str__(self) -> str:  # pragma: no cover - formato legible
        parts = [super().__str__()]
        details = []
        if self.code is not None:
            details.append(f"code={self.code}")
        if self.subcode is not None:
            details.append(f"subcode={self.subcode}")
        if self.error_type:
            details.append(f"type={self.error_type}")
        if self.fbtrace_id:
            details.append(f"fbtrace_id={self.fbtrace_id}")
        if details:
            parts.append(f"[{', '.join(details)}]")
        return " ".join(parts)
