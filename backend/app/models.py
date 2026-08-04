import uuid
from datetime import datetime, timezone
from app import db


def _gen_id():
    return uuid.uuid4().hex


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