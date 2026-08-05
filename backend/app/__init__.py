import os
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

load_dotenv()

db = SQLAlchemy()


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
            "allow_headers": ["Content-Type", "Authorization", "X-Guest-Id"],
            "supports_credentials": True
        }
    })

    db.init_app(app)

    # Register error handlers
    from app.middleware.error_handlers import register_error_handlers
    register_error_handlers(app)

    # Register blueprints
    from app.api.resume import resume_bp
    app.register_blueprint(resume_bp, url_prefix="/api/v1/resume")

    from app.api.artisans import artisans_bp
    app.register_blueprint(artisans_bp, url_prefix="/api/v1/artisans")

    from app.api.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")

    from app.api.applications import applications_bp
    app.register_blueprint(applications_bp, url_prefix="/api/v1/applications")

    # Create tables. If a model's module never gets imported before this
    # runs, its table simply won't exist and every query against it will
    # 500 — log what we actually created so that's visible in deploy logs
    # instead of assumed.
    with app.app_context():
        db.create_all()
        _sync_missing_columns(app)
        table_names = sorted(db.metadata.tables.keys())
        print(f"✅ Database tables created/verified: {table_names}")

    return app


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