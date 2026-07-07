import os
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

load_dotenv()

db = SQLAlchemy()


def create_app():
    app = Flask(__name__)

    db_url = os.environ.get("DATABASE_URL", "sqlite:///resume.db")
    # Render/Heroku-style Postgres URLs start with postgres:// — SQLAlchemy needs postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Comma-separated list of allowed origins, e.g. "https://yourdomain.com,https://www.yourdomain.com"
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

    db.init_app(app)

    from app.middleware.error_handlers import register_error_handlers
    register_error_handlers(app)

    from app.api.resume import resume_bp
    app.register_blueprint(resume_bp, url_prefix="/api/v1/resume")

    with app.app_context():
        db.create_all()

    return app

