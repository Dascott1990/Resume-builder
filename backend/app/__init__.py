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
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
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

    # Create tables. If a model's module never gets imported before this
    # runs, its table simply won't exist and every query against it will
    # 500 — log what we actually created so that's visible in deploy logs
    # instead of assumed.
    with app.app_context():
        db.create_all()
        table_names = sorted(db.metadata.tables.keys())
        print(f"✅ Database tables created/verified: {table_names}")

    return app