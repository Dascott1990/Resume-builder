"""
app/api/auth.py
POST /api/v1/auth/signup
POST /api/v1/auth/login
GET  /api/v1/auth/me

Entirely optional layer on top of the anonymous guest_id system already
used everywhere else — nothing else in the app requires any of this.
"""
import re
from flask import Blueprint, request, jsonify
from app import db
from app.models import User, Media, JobApplication
from app.middleware.error_handlers import APIError
from app.utils.auth import hash_password, verify_password, issue_token, get_scope

auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@auth_bp.route("/signup", methods=["POST"])
def signup():
    body = request.get_json(force=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not EMAIL_RE.match(email):
        raise APIError("Enter a valid email address", 400)
    if len(password) < 8:
        raise APIError("Password must be at least 8 characters", 400)
    if User.query.filter_by(email=email).first():
        raise APIError("An account with that email already exists", 409)

    user = User(email=email, password_hash=hash_password(password))
    db.session.add(user)
    db.session.flush()  # assigns user.id before we touch rows that reference it

    # Whatever this browser already built anonymously follows them in —
    # signing up shouldn't mean starting over.
    _, guest_id = get_scope(request)
    if guest_id:
        Media.query.filter_by(guest_id=guest_id, user_id=None).update({"user_id": user.id})
        JobApplication.query.filter_by(guest_id=guest_id, user_id=None).update({"user_id": user.id})

    db.session.commit()
    return jsonify({"success": True, "data": {"user": user.to_dict(), "token": issue_token(user.id)}}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    body = request.get_json(force=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    user = User.query.filter_by(email=email).first()
    # Same message either way — confirming "that email doesn't exist" to
    # whoever's asking is a free account-enumeration oracle.
    if not user or not verify_password(password, user.password_hash):
        raise APIError("Incorrect email or password", 401)

    return jsonify({"success": True, "data": {"user": user.to_dict(), "token": issue_token(user.id)}}), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    user_id, _ = get_scope(request)
    if not user_id:
        raise APIError("Not signed in", 401)
    user = db.session.get(User, user_id)
    if not user:
        raise APIError("Not signed in", 401)
    return jsonify({"success": True, "data": user.to_dict()}), 200
