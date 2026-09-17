"""
scripts/generate_break_glass_admin.py — one-shot generator for the
break-glass admin credential (see app/utils/auth.py's BREAK_GLASS_* and
app/api/auth.py's POST /api/v1/auth/break-glass-login).

Run it, copy the two env lines it prints into backend/.env (local) and into
Render's dashboard (production — Settings → Environment), and save the
plaintext password somewhere safe (a password manager, not a text file).
This script never writes anywhere itself and prints the plaintext password
exactly once — there is no way to recover it afterward, only to regenerate
a new pair by running this again (which invalidates the old one, since the
hash is what's actually checked).

Usage:
    cd backend && python scripts/generate_break_glass_admin.py
"""
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from werkzeug.security import generate_password_hash

username = "admin-" + secrets.token_hex(4)
password = secrets.token_urlsafe(18)
password_hash = generate_password_hash(password)

print()
print("Break-glass admin credential generated. This is shown once.")
print()
print(f"  Username: {username}")
print(f"  Password: {password}")
print()
print("Save that password now (password manager, not a text file) — it")
print("cannot be recovered from the hash below.")
print()
print("Add these two lines to backend/.env AND to your production host's")
print("environment variables (e.g. Render → Settings → Environment) —")
print("both need them for break-glass access to work in that environment:")
print()
print(f"BREAK_GLASS_ADMIN_USERNAME={username}")
print(f"BREAK_GLASS_ADMIN_PASSWORD_HASH={password_hash}")
print()
