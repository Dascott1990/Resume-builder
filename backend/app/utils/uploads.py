"""
app/utils/uploads.py — the "reject the wrong type, reject too big" shape
that was duplicated near-identically across artisan avatar-photo upload
and ArtisanPhoto upload (byte-for-byte the same: mimetype-prefix check +
5MB cap), and one more time with a different type check (file-extension,
not mimetype — .pdf/.docx) in resume.py's /scan upload. One function,
supporting either check, so a new upload route picks the shape it needs
without writing a fourth independent copy of "read the file, check it,
enforce a size limit."
"""
from app.middleware.error_handlers import APIError


def validate_upload(file, *, allowed_mimetypes=None, allowed_extensions=None, max_bytes=None):
    """file: a werkzeug FileStorage (request.files.get(...)).
    allowed_mimetypes: prefixes to check file.mimetype against, e.g.
      ("image/",) — matches "image/png", "image/jpeg", etc.
    allowed_extensions: suffixes to check file.filename against, e.g.
      (".pdf", ".docx") — case-insensitive.
    max_bytes: rejected if the read file is larger than this.
    Pass whichever check(s) the caller actually needs; neither is
    required on its own. Returns the read bytes on success, raises
    APIError(400) with a specific message on any failure."""
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

    return data
