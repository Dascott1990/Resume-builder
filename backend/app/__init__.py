import os
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

load_dotenv()

db = SQLAlchemy()


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "sqlite:///resume.db"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    db.init_app(app)

    from app.middleware.error_handlers import register_error_handlers
    register_error_handlers(app)

    from app.api.resume import resume_bp
    app.register_blueprint(resume_bp, url_prefix="/api/v1/resume")

    with app.app_context():
        db.create_all()

    return app
