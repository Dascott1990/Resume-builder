import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

load_dotenv()

db = SQLAlchemy()
# Keyed by IP — every rate-limited route here (auth, AI generation) is
# reachable with no login at all by design (see get_scope's docstring), so
# there's no user/token to key off of instead. In-memory storage is fine as
# long as this stays a single gunicorn worker (see render.yaml's
# `gunicorn run:app` with no -w flag) — multiple workers would each keep
# their own counters and the effective limit would multiply by worker
# count, silently weakening every limit below.
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per hour"])


def create_app():
    app = Flask(__name__)

    # Database configuration
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    elif not db_url:
        # Fallback to SQLite for local development
        db_url = "sqlite:///resume.db"

    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # CORS configuration - allow all origins for Render
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "https://resume-builder-orpin-theta.vercel.app",
                "https://resume-builder-c6l75mdzi-dascott1990s-projects.vercel.app",
                "http://localhost:3000",
                "http://localhost:3001"
            ],
            # PATCH was missing here — every PATCH endpoint in the app (this
            # one included, Artisan listing edits too) was failing its CORS
            # preflight and never actually reaching the server.
            "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Guest-Id", "X-Edit-Token", "X-Artisan-Token"],
            "supports_credentials": True
        },
        # The "tailor for this job" bookmarklet runs on whatever job board
        # page it was clicked on — LinkedIn, Indeed, a company's own careers
        # page, anything — so the origin is never knowable in advance the
        # way it is for our own frontend above. Wide open on purpose: no
        # cookies/credentials are ever sent here (supports_credentials is
        # off, which is also what makes a literal "*" origin valid per the
        # CORS spec), and the endpoint itself accepts nothing more
        # sensitive than a text blob.
        r"/api/v1/capture/*": {
            "origins": "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type"],
            "supports_credentials": False
        }
    })

    db.init_app(app)
    limiter.init_app(app)

    # Register error handlers
    from app.middleware.error_handlers import register_error_handlers
    register_error_handlers(app)

    # Flask-Limiter's own 429 response isn't in this app's {success, error}
    # envelope — every other error handler in register_error_handlers()
    # returns that shape, and the frontend's apiRequest() only ever reads
    # json.error, so leaving this one in Limiter's default shape would
    # surface as "Server returned an unreadable response" instead of an
    # actual "slow down" message.
    @app.errorhandler(429)
    def handle_rate_limit(err):
        return jsonify({"success": False, "error": "Too many requests — please slow down and try again shortly."}), 429

    # Register blueprints
    from app.api.resume import resume_bp
    app.register_blueprint(resume_bp, url_prefix="/api/v1/resume")

    from app.api.artisans import artisans_bp
    app.register_blueprint(artisans_bp, url_prefix="/api/v1/artisans")

    from app.api.requests import requests_bp
    app.register_blueprint(requests_bp, url_prefix="/api/v1/requests")

    from app.api.messages import messages_bp
    app.register_blueprint(messages_bp, url_prefix="/api/v1/messages")

    from app.api.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")

    from app.api.applications import applications_bp
    app.register_blueprint(applications_bp, url_prefix="/api/v1/applications")

    from app.api.capture import capture_bp
    app.register_blueprint(capture_bp, url_prefix="/api/v1/capture")

    from app.api.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix="/api/v1/admin")

    from app.api.apply import apply_bp
    app.register_blueprint(apply_bp, url_prefix="/api/v1/apply")

    # Pinged by the frontend's keep-alive (see frontend/app/KeepAlive.js) to
    # stop Render's free-tier instance from spinning down after 15 minutes
    # of inactivity. Deliberately does nothing but respond — no DB hit, no
    # auth, just proof the process is awake.
    @app.route("/api/v1/health")
    def health():
        return {"success": True, "status": "ok"}

    # Create tables. If a model's module never gets imported before this
    # runs, its table simply won't exist and every query against it will
    # 500 — log what we actually created so that's visible in deploy logs
    # instead of assumed.
    with app.app_context():
        db.create_all()
        _sync_missing_columns(app)
        _bootstrap_admin(app)
        _backfill_artisan_tokens(app)
        from app.api.apply import sweep_stuck_runs
        sweep_stuck_runs(app)
        table_names = sorted(db.metadata.tables.keys())
        print(f"✅ Database tables created/verified: {table_names}")

    return app


def _backfill_artisan_tokens(app):
    """
    Every Artisan row with a NULL edit_token is editable/deletable by
    anyone who has its id, no auth at all (see _authorize_edit's
    grandfather clause in api/artisans.py) — that was meant to only cover
    rows that predated edit tokens entirely, but _sync_missing_columns adds
    new columns NULL with no backfill, so it silently applied to every
    listing that already existed the moment the column shipped, forever,
    not just historically. Giving each one a real token here closes that.
    The original creator won't know this new token (there's nowhere to
    send it), so they'd need an admin to hand them a way back in — no
    worse than any other "lost the only credential" situation.
    """
    import secrets
    from app.models import Artisan

    stragglers = Artisan.query.filter(Artisan.edit_token.is_(None)).all()
    if not stragglers:
        return
    for artisan in stragglers:
        artisan.edit_token = secrets.token_urlsafe(24)
    db.session.commit()
    print(f"🔧 Backfilled edit_token for {len(stragglers)} artisan listing(s)")


def _bootstrap_admin(app):
    """
    Promotes ADMIN_BOOTSTRAP_EMAIL (a Render/Vercel-style env var, not a
    stored secret) to admin on every boot — the only way to create the
    FIRST admin without direct database access. Safe to leave set
    permanently: once that account is already an admin this is a no-op.
    Every admin after the first is promoted from inside the admin panel
    itself (PATCH /api/v1/admin/users/<id>), not through this env var.
    """
    email = os.environ.get("ADMIN_BOOTSTRAP_EMAIL")
    if not email:
        return
    from app.models import User

    user = User.query.filter_by(email=email.strip().lower()).first()
    if user and not user.is_admin:
        user.is_admin = True
        db.session.commit()
        print(f"👑 Promoted {email} to admin (ADMIN_BOOTSTRAP_EMAIL)")


def _sync_missing_columns(app):
    """
    db.create_all() only creates tables that don't exist yet — it NEVER
    alters an existing table when a model gains a new column. That's
    exactly what happened with Artisan.bio: the column was added to
    models.py after the artisans table already existed in production, so
    create_all() silently did nothing on deploy, and every read 500'd on a
    real Postgres error until someone noticed and ran ALTER TABLE by hand.

    This walks every model's columns against what Postgres actually has and
    ALTERs in whatever's missing on boot, so a new column in models.py is
    live on the next deploy — no manual psql session required.

    Deliberately adds every missing column as NULLABLE regardless of what
    the model declares, even when the model says nullable=False: a plain
    ALTER TABLE ADD COLUMN with a NOT NULL constraint fails outright on a
    table that already has rows (no default to backfill them with). Trading
    a hard crash for "the constraint doesn't fully apply until existing
    rows are cleaned up" is the safer failure mode for an auto-heal step.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    for table in db.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue  # brand-new table — db.create_all() above already handled it
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing_cols:
                continue
            col_type = column.type.compile(dialect=db.engine.dialect)
            ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'
            with db.engine.begin() as conn:
                conn.execute(text(ddl))
            print(f"🔧 Added missing column {table.name}.{column.name} ({col_type})")

            # Grandfather in accounts created before email verification
            # existed — they signed up under the old rules, so a NULL here
            # means "predates the feature," not "unverified." Without this
            # backfill, every existing account gets locked out of login the
            # moment this column lands, with no verification email ever
            # sent to unlock it.
            if table.name == "users" and column.name == "email_verified":
                with db.engine.begin() as conn:
                    conn.execute(text('UPDATE "users" SET "email_verified" = TRUE WHERE "email_verified" IS NULL'))
                print("🔧 Backfilled existing users.email_verified = TRUE")

            # Same reasoning as above, opposite default: a brand-new
            # is_admin column lands NULL on every pre-existing row, and
            # NULL isn't a safe stand-in for "not an admin" once this gets
            # serialized to JSON and rendered in the admin UI.
            if table.name == "users" and column.name == "is_admin":
                with db.engine.begin() as conn:
                    conn.execute(text('UPDATE "users" SET "is_admin" = FALSE WHERE "is_admin" IS NULL'))
                print("🔧 Backfilled existing users.is_admin = FALSE")