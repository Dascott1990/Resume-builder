"""
app/utils/uploads.py — the "reject the wrong type, reject too big" shape
(mimetype-prefix check + size cap), and one more variant with a
different type check (file-extension, not mimetype — .pdf/.docx) in
resume.py's /scan upload. One function, supporting either check, so a
new upload route picks the shape it needs without writing an independent
copy of "read the file, check it, enforce a size limit."

SECURITY: file.mimetype is the attacker-supplied Content-Type header,
never proof of actual content — a file sent as "image/svg+xml" can
contain `<svg onload=...>` and this product serves uploaded avatars/
assets back from a public, unauthenticated URL. Every caller that passes
allowed_mimetypes=("image/", ...) gets its upload sniffed by Pillow (real
pixel data or reject) below, which also structurally rejects SVG — Pillow
has no SVG decoder, so a disguised SVG fails verify() the same way a
disguised HTML/script payload would. Callers must store the *returned*
mimetype (derived from the real decoded format), not file.mimetype.
"""
import io

from app.middleware.error_handlers import APIError

# Any of these appearing in the first KB of the file is someone trying to
# get a text/markup payload executed by whatever eventually serves this
# upload back — reject outright regardless of claimed mimetype. Covers
# SVG specifically (Pillow can't decode it, see above, but this catches
# it earlier with a clearer error) and blocks the same trick against
# "video/" uploads, which Pillow can't sniff at all.
_DISALLOWED_SNIFFED_PREFIXES = (b"<?xml", b"<svg", b"<!doctype html", b"<html", b"<script")


def validate_upload(file, *, allowed_mimetypes=None, allowed_extensions=None, max_bytes=None):
    """file: a werkzeug FileStorage (request.files.get(...)).
    allowed_mimetypes: prefixes to check against, e.g. ("image/",) — the
      "image/" prefix is verified against the real decoded bytes (Pillow),
      not the client's Content-Type header; other prefixes (e.g. "video/")
      only get the text/markup-payload sniff below, since there's no
      lightweight way to fully decode arbitrary video server-side here.
    allowed_extensions: suffixes to check file.filename against, e.g.
      (".pdf", ".docx") — case-insensitive.
    max_bytes: rejected if the read file is larger than this.
    Pass whichever check(s) the caller actually needs; neither is
    required on its own. Returns the read bytes on success — same
    signature as before, so every existing caller is protected by the
    content-sniffing below with no call-site changes needed. A caller
    that goes on to STORE "image/" content's mimetype for later unsanitized
    reuse should re-derive it from the real decoded bytes rather than
    trusting file.mimetype (see auth.py's avatar upload for the pattern).
    Raises APIError(400) with a specific message on any failure."""
    if not file or not file.filename:
        raise APIError("file is required", 400)

    if allowed_mimetypes:
        mimetype = file.mimetype or ""
        if not any(mimetype.startswith(prefix) for prefix in allowed_mimetypes):
            raise APIError(f"Only {', '.join(allowed_mimetypes)}* files are allowed", 400)

    if allowed_extensions:
        name = (file.filename or "").lower()
        if not any(name.endswith(ext.lower()) for ext in allowed_extensions):
            raise APIError(f"Only {', '.join(allowed_extensions)} files are supported", 400)

    data = file.read()
    if max_bytes and len(data) > max_bytes:
        raise APIError(f"File must be {max_bytes // (1024 * 1024)}MB or smaller", 400)

    head = data[:1024].lstrip().lower()
    if any(head.startswith(p) for p in _DISALLOWED_SNIFFED_PREFIXES):
        raise APIError("That file's content doesn't match an allowed type", 400)

    if allowed_mimetypes and any(p == "image/" for p in allowed_mimetypes):
        try:
            from PIL import Image
            with Image.open(io.BytesIO(data)) as img:
                img.verify()
        except Exception:
            raise APIError("That doesn't look like a valid image file", 400)

    return data


def sniff_image_mimetype(data, fallback="application/octet-stream"):
    """Derives a real mimetype from decoded image bytes — use this to
    decide what to STORE/serve for an "image/" upload instead of trusting
    file.mimetype (the client's own, attacker-controlled Content-Type
    header). Only meaningful after validate_upload(..., allowed_mimetypes=
    ("image/",)) already confirmed Pillow can decode this data."""
    try:
        from PIL import Image
        with Image.open(io.BytesIO(data)) as img:
            fmt = (img.format or "").upper()
        return "image/jpeg" if fmt == "JPEG" else f"image/{fmt.lower()}" if fmt else fallback
    except Exception:
        return fallback
