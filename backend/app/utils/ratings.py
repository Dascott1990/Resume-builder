"""
app/utils/ratings.py — the one place Artisan.rating_avg/rating_count get
recomputed from Review rows. Shared by every route that adds or removes a
review (api/artisans.py's create_review, api/admin.py's delete_review,
api/requests.py's job-gated review route) so this aggregate logic exists
exactly once instead of being copy-pasted a third time.
"""
from sqlalchemy import func
from app import db
from app.models import Artisan, Review


def recompute_rating(artisan_id):
    """Call after adding/removing a Review row for this artisan, inside the
    same session and after a flush so the change is visible to this query
    but before commit. Sets rating_count=0/rating_avg=None once no reviews
    remain. Returns the Artisan row (or None if it's gone too)."""
    count, avg = db.session.query(
        func.count(Review.id), func.avg(Review.stars)
    ).filter(Review.artisan_id == artisan_id).one()
    artisan = db.session.get(Artisan, artisan_id)
    if artisan:
        artisan.rating_count = count or 0
        artisan.rating_avg = round(float(avg), 2) if avg is not None else None
    return artisan
