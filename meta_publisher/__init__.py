"""Publicacion automatica de posts en Instagram y Facebook (Graph API de Meta).

Modulos:
    config      -> carga de configuracion desde variables de entorno (.env)
    client      -> cliente HTTP base contra la Graph API
    instagram   -> publicacion en Instagram (imagen, carrusel, reel)
    facebook    -> publicacion en una Pagina de Facebook
    exceptions  -> errores propios
"""

from .config import Config, load_config
from .client import GraphAPIClient
from .instagram import InstagramPublisher
from .facebook import FacebookPublisher
from .ads import AdsManager
from .exceptions import MetaError, MetaAPIError, ConfigError

__all__ = [
    "Config",
    "load_config",
    "GraphAPIClient",
    "InstagramPublisher",
    "FacebookPublisher",
    "AdsManager",
    "MetaError",
    "MetaAPIError",
    "ConfigError",
]

__version__ = "0.1.0"
