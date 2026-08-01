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
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class Artisan(db.Model):
    __tablename__ = "artisans"
    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    name = db.Column(db.String(150), nullable=False)
    trade = db.Column(db.String(100), nullable=False, index=True)
    city = db.Column(db.String(120), index=True)
    phone = db.Column(db.String(40), nullable=False)
    bio = db.Column(db.String(600))
    years_experience = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "trade": self.trade,
            "city": self.city, "phone": self.phone, "bio": self.bio,
            "years_experience": self.years_experience,
        }