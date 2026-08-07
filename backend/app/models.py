import uuid
from datetime import datetime, timezone
from app import db


def _gen_id():
    return uuid.uuid4().hex


class User(db.Model):
    # Entirely optional — the app works fully anonymously via guest_id on
    # every other model. This exists only for people who want their saved
    # resumes / job tracker / CV scans to follow them across devices.
    __tablename__ = "users"
    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    email = db.Column(db.String(190), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    # A real account isn't "created," it's "claimed" — email_verified stays
    # False (and login is refused) until the address is proven reachable.
    # Without this, signup is just a form that hands out session tokens to
    # whatever email string was typed in, verified or not.
    email_verified = db.Column(db.Boolean, default=False, nullable=False)
    verification_token = db.Column(db.String(64), index=True, nullable=True)
    verification_token_expires = db.Column(db.DateTime, nullable=True)
    reset_token = db.Column(db.String(64), index=True, nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {"id": self.id, "email": self.email, "email_verified": self.email_verified}


class Media(db.Model):
    __tablename__ = "media"

    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    filename = db.Column(db.String(255), nullable=False)
    media_type = db.Column(db.String(50))
    mime_type = db.Column(db.String(100))
    file_data = db.Column(db.LargeBinary)
    file_size = db.Column(db.Integer)
    caption = db.Column(db.String(500))
    filter_name = db.Column(db.String(100), index=True)
    metadata_json = db.Column(db.JSON)
    is_deleted = db.Column(db.Boolean, default=False)
    # Scopes guest-saved resumes to the browser that created them (a random
    # id in localStorage, sent as X-Guest-Id — no account, no login). Without
    # this, GET /resume/saved had no way to tell one visitor's resumes apart
    # from anyone else's and returned everyone's, name included.
    guest_id = db.Column(db.String(64), index=True, nullable=True)
    # Set instead of guest_id once someone's signed in — login is optional
    # (guest_id-only remains the default, fully-anonymous path), this is
    # what makes "your saved resumes on any device" actually true for
    # whoever opts in.
    user_id = db.Column(db.String(32), db.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class Artisan(db.Model):
    __tablename__ = "artisans"
    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    name = db.Column(db.String(150), nullable=False)
    trade = db.Column(db.String(100), nullable=False, index=True)
    city = db.Column(db.String(120), index=True)
    phone = db.Column(db.String(40), nullable=False)
    email = db.Column(db.String(190))
    bio = db.Column(db.String(600))
    years_experience = db.Column(db.Integer)
    rating_avg = db.Column(db.Float)
    rating_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "trade": self.trade,
            "city": self.city, "phone": self.phone, "email": self.email,
            "bio": self.bio, "years_experience": self.years_experience,
            "rating_avg": self.rating_avg, "rating_count": self.rating_count or 0,
        }


class Review(db.Model):
    __tablename__ = "reviews"
    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    artisan_id = db.Column(
        db.String(32), db.ForeignKey("artisans.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    stars = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.String(280))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id, "artisan_id": self.artisan_id, "stars": self.stars,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class JobApplication(db.Model):
    __tablename__ = "job_applications"
    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    # Same dual-scoping as Media — guest_id for the default anonymous path,
    # user_id once someone's opted into an account. Exactly one of these is
    # set per row; enforced in the API layer, not the schema (SQLite's
    # limited CHECK constraint support makes a DB-level XOR more trouble
    # than it's worth for what's already guaranteed at the one write path).
    guest_id = db.Column(db.String(64), index=True, nullable=True)
    user_id = db.Column(db.String(32), db.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    company = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(150), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="applied")  # applied | interview | offer | rejected
    date_applied = db.Column(db.String(20))  # ISO date string (YYYY-MM-DD) — free text from the user, not a real deadline system
    notes = db.Column(db.String(1000))
    # Optional — which saved resume was actually sent for this application.
    # No ondelete constraint on purpose: a resume can be deleted from
    # "Saved" without needing to touch every application that once pointed
    # at it. The API resolves this defensively (missing row -> null) rather
    # than the schema enforcing it.
    resume_id = db.Column(db.String(32), db.ForeignKey("media.id"), index=True, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id, "company": self.company, "role": self.role,
            "status": self.status, "date_applied": self.date_applied, "notes": self.notes,
            "resume_id": self.resume_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class JdCapture(db.Model):
    """
    A single job-description text, captured by the bookmarklet from
    whatever job board page it was clicked on and picked up moments later
    by the app in a new tab. Deliberately NOT scoped by guest_id/user_id —
    the bookmarklet runs on a third-party page with no access to Noviq's
    own localStorage (cross-origin), so there's no identity to attach here;
    the random id in the URL is the only handshake between the two tabs.
    Rows are single-use (deleted on read) and swept of anything left
    unclaimed after an hour — see _sweep_expired in api/capture.py.
    """
    __tablename__ = "jd_captures"
    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))