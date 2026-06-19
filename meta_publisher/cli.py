"""Interfaz de linea de comandos.

Uso:
    python -m meta_publisher whoami
    python -m meta_publisher exchange-token --token <CORTO>
    python -m meta_publisher instagram --image-url URL --caption "..."
    python -m meta_publisher instagram --carousel URL1 URL2 [URL3 ...] --caption "..."
    python -m meta_publisher instagram --reel-url URL --caption "..."
    python -m meta_publisher facebook --message "..." [--link URL]
    python -m meta_publisher facebook --image-url URL --caption "..."
    python -m meta_publisher post --file examples/posts.example.json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys

from .client import GraphAPIClient
from .config import load_config
from .exceptions import MetaError
from .facebook import FacebookPublisher
from .instagram import InstagramPublisher
from . import tokens


def _build_client(cfg) -> GraphAPIClient:
    return GraphAPIClient(cfg.require_token(), api_version=cfg.api_version)


# --------------------------------------------------------------------------
# Subcomandos
# --------------------------------------------------------------------------
def cmd_whoami(cfg, args) -> int:
    client = _build_client(cfg)
    pages = tokens.list_pages_and_instagram(client)
    if not pages:
        print("No se encontraron Paginas para este token.")
        print("Asegurate de que el token tiene permisos pages_show_list.")
        return 1
    print("Paginas y cuentas de Instagram vinculadas:\n")
    for p in pages:
        print(f"  Pagina:    {p['page_name']}")
        print(f"    FB_PAGE_ID = {p['page_id']}")
        if p["instagram_user_id"]:
            print(f"    IG_USER_ID = {p['instagram_user_id']}  (@{p['instagram_username']})")
        else:
            print("    (sin cuenta de Instagram Business vinculada)")
        print()
    print("Copia los IDs que necesites en tu archivo .env")
    return 0


def cmd_exchange_token(cfg, args) -> int:
    app_id, app_secret = cfg.require_app_credentials()
    short = args.token or cfg.access_token
    client = GraphAPIClient(short, api_version=cfg.api_version)
    result = tokens.exchange_for_long_lived(client, app_id, app_secret, short)
    token = result.get("access_token", "")
    expires = result.get("expires_in")
    print("Token de larga duracion generado.")
    if expires:
        print(f"  Caduca en ~{int(expires) // 86400} dias.")
    print("\nPega este valor en META_ACCESS_TOKEN dentro de tu .env:\n")
    print(token)
    return 0


def cmd_instagram(cfg, args) -> int:
    client = _build_client(cfg)
    pub = InstagramPublisher(client, cfg.require_ig_user_id())

    if args.carousel:
        media_id = pub.publish_carousel(args.carousel, caption=args.caption)
    elif args.reel_url:
        media_id = pub.publish_reel(args.reel_url, caption=args.caption,
                                    cover_url=args.cover_url)
    elif args.image_url:
        media_id = pub.publish_image(args.image_url, caption=args.caption)
    else:
        print("Indica --image-url, --carousel o --reel-url", file=sys.stderr)
        return 2

    print(f"Publicado en Instagram. media_id = {media_id}")
    return 0


def cmd_facebook(cfg, args) -> int:
    client = _build_client(cfg)
    pub = FacebookPublisher(client, cfg.require_page_id())

    if args.image_url:
        post_id = pub.publish_photo(args.image_url, caption=args.caption,
                                    scheduled_publish_time=args.schedule)
    elif args.message:
        post_id = pub.publish_text(args.message, link=args.link,
                                   scheduled_publish_time=args.schedule)
    else:
        print("Indica --message o --image-url", file=sys.stderr)
        return 2

    print(f"Publicado en Facebook. post_id = {post_id}")
    return 0


def cmd_post(cfg, args) -> int:
    """Publica uno o varios posts definidos en un archivo JSON."""
    with open(args.file, encoding="utf-8") as fh:
        spec = json.load(fh)

    posts = spec if isinstance(spec, list) else [spec]
    client = _build_client(cfg)
    ig = InstagramPublisher(client, cfg.ig_user_id) if cfg.ig_user_id else None
    fb = FacebookPublisher(client, cfg.fb_page_id) if cfg.fb_page_id else None

    rc = 0
    for i, post in enumerate(posts, 1):
        platform = post.get("platform", "instagram").lower()
        caption = post.get("caption")
        try:
            if platform == "instagram":
                if not ig:
                    raise MetaError("Falta IG_USER_ID en .env para publicar en Instagram.")
                if post.get("carousel"):
                    mid = ig.publish_carousel(post["carousel"], caption=caption)
                elif post.get("reel_url"):
                    mid = ig.publish_reel(post["reel_url"], caption=caption)
                else:
                    mid = ig.publish_image(post["image_url"], caption=caption)
                print(f"[{i}] Instagram OK -> {mid}")
            elif platform == "facebook":
                if not fb:
                    raise MetaError("Falta FB_PAGE_ID en .env para publicar en Facebook.")
                if post.get("image_url"):
                    pid = fb.publish_photo(post["image_url"], caption=caption,
                                           scheduled_publish_time=post.get("schedule"))
                else:
                    pid = fb.publish_text(post.get("message", caption or ""),
                                          link=post.get("link"),
                                          scheduled_publish_time=post.get("schedule"))
                print(f"[{i}] Facebook OK -> {pid}")
            else:
                print(f"[{i}] Plataforma desconocida: {platform}", file=sys.stderr)
                rc = 1
        except MetaError as exc:
            print(f"[{i}] ERROR: {exc}", file=sys.stderr)
            rc = 1
    return rc


# --------------------------------------------------------------------------
# Parser
# --------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m meta_publisher",
        description="Publica posts automaticos en Instagram y Facebook (Graph API).",
    )
    p.add_argument("-v", "--verbose", action="store_true", help="logs de depuracion")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("whoami", help="Lista Paginas e IDs de Instagram del token")

    ex = sub.add_parser("exchange-token", help="Intercambia un token corto por uno largo")
    ex.add_argument("--token", help="Token de corta duracion (por defecto: META_ACCESS_TOKEN)")

    ig = sub.add_parser("instagram", help="Publica en Instagram")
    ig.add_argument("--image-url", help="URL publica de la imagen")
    ig.add_argument("--carousel", nargs="+", metavar="URL", help="2 a 10 URLs de imagen")
    ig.add_argument("--reel-url", help="URL publica del video (Reel)")
    ig.add_argument("--cover-url", help="URL de la miniatura del Reel (opcional)")
    ig.add_argument("--caption", help="Texto del post")

    fb = sub.add_parser("facebook", help="Publica en una Pagina de Facebook")
    fb.add_argument("--message", help="Texto del post")
    fb.add_argument("--link", help="Enlace a adjuntar (opcional)")
    fb.add_argument("--image-url", help="URL publica de una imagen")
    fb.add_argument("--caption", help="Pie de la imagen")
    fb.add_argument("--schedule", type=int, metavar="EPOCH",
                    help="Programar (epoch en segundos, 10 min a 6 meses)")

    po = sub.add_parser("post", help="Publica posts definidos en un archivo JSON")
    po.add_argument("--file", required=True, help="Ruta al JSON de posts")

    return p


_COMMANDS = {
    "whoami": cmd_whoami,
    "exchange-token": cmd_exchange_token,
    "instagram": cmd_instagram,
    "facebook": cmd_facebook,
    "post": cmd_post,
}


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(message)s",
    )
    cfg = load_config()
    try:
        return _COMMANDS[args.command](cfg, args)
    except MetaError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
