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
    # Optional — signup never asks for either, only the Settings screen does.
    name = db.Column(db.String(150), nullable=True)
    avatar_emoji = db.Column(db.String(16), nullable=True)
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
    # Granted two ways: ADMIN_BOOTSTRAP_EMAIL (an env var, promotes that one
    # account on every boot — see _bootstrap_admin in app/__init__.py, the
    # only way to create the first admin without direct DB access) or by an
    # existing admin flipping this on someone else from inside the admin
    # panel itself (PATCH /api/v1/admin/users/<id>).
    is_admin = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id, "email": self.email, "name": self.name, "avatar_emoji": self.avatar_emoji,
            "email_verified": bool(self.email_verified), "is_admin": bool(self.is_admin),
        }


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
    # A per-listing secret, handed back once in the create response and
    # required (X-Edit-Token header) on every later edit/delete — this
    # listing has no user account to authenticate against (self-listing
    # needs no signup), so a bearer secret is what stands in for "you're
    # the one who created this" instead of leaving edit/delete wide open to
    # anyone who knows the id. NULL on rows created before this existed —
    # see the grandfather clause in api/artisans.py's _authorize_edit.
    edit_token = db.Column(db.String(64), index=True, nullable=True)
    # Everything below is for the OPTIONAL account layer on top of this same
    # listing (see api/artisans.py's /signup, /login, /me) — the plain
    # anonymous "list yourself" flow above never touches these, so every
    # pre-existing listing simply has them all NULL and keeps working
    # exactly as before. An artisan only starts receiving job requests (see
    # JobRequest below) once they've signed up for real AND turned
    # is_available on — neither is assumed just because a listing exists.
    password_hash = db.Column(db.String(255), nullable=True)
    is_available = db.Column(db.Boolean, nullable=True)
    # Best-effort geocode of `city` (see utils/geocoding.py), set on save —
    # NULL on every row until it's (re)saved after this shipped, and NULL
    # forever for a city string that fails to geocode. A separate column
    # from `city` on purpose: the free-text field is what the artisan
    # actually typed and always renders as-is; a failed/ambiguous geocode
    # must never silently overwrite that with garbage or wipe it out.
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)
    geocoded_city = db.Column(db.String(190), nullable=True)
    avatar_emoji = db.Column(db.String(16), nullable=True)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "trade": self.trade,
            "city": self.city, "phone": self.phone, "email": self.email,
            "bio": self.bio, "years_experience": self.years_experience,
            "rating_avg": self.rating_avg, "rating_count": self.rating_count or 0,
            "has_account": self.password_hash is not None,
            "is_available": bool(self.is_available),
            "lat": self.lat, "lng": self.lng, "avatar_emoji": self.avatar_emoji,
        }


class ArtisanPhoto(db.Model):
    """
    An artisan's public portfolio image — a new table, not a reuse of
    Media (see models.py's docstring context / the marketplace plan):
    Media is scoped by guest_id/user_id (the customer identity system) and
    carries resume-specific fields; this is scoped by artisan_id and needs
    sort_order/caption that would be dead weight on every resume row.
    Same physical storage choice as Media (Postgres LargeBinary, not S3) —
    consistent with the rest of this app, revisit only if it becomes a
    real bottleneck.
    """
    __tablename__ = "artisan_photos"
    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    artisan_id = db.Column(
        db.String(32), db.ForeignKey("artisans.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    filename = db.Column(db.String(255), nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    file_data = db.Column(db.LargeBinary, nullable=False)
    file_size = db.Column(db.Integer)
    caption = db.Column(db.String(200), nullable=True)
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id, "artisan_id": self.artisan_id,
            "mime_type": self.mime_type, "caption": self.caption,
            "sort_order": self.sort_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class JobRequest(db.Model):
    """
    The "Uber/Lyft for artisans" request-and-accept flow: a customer posts
    what they need (trade + city + description), and any signed-in,
    available artisan whose trade/city match can see it in their pool and
    accept it — first to accept gets it (see api/requests.py's atomic
    accept, a single conditional UPDATE so two artisans racing on the same
    request can't both "win" it).

    No live dispatch algorithm — the pool an artisan sees is a simple
    trade+city text filter (api/requests.py's pool()), independent of the
    real lat/lng distance sort that exists on browse (see Artisan.lat/lng)
    for the customer-facing directory.
    """
    __tablename__ = "job_requests"
    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    # Same dual-scoping as Media/JobApplication — whoever posted this,
    # anonymous or signed in.
    guest_id = db.Column(db.String(64), index=True, nullable=True)
    user_id = db.Column(db.String(32), db.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)

    trade = db.Column(db.String(100), nullable=False, index=True)
    city = db.Column(db.String(120), index=True)
    description = db.Column(db.String(1000), nullable=False)
    # Contact info is captured directly on the request, not resolved via
    # guest_id/user_id lookup — a guest customer has no profile row an
    # artisan could look up, and even a signed-in one might want to give a
    # different phone number for this particular job.
    contact_name = db.Column(db.String(150), nullable=False)
    contact_phone = db.Column(db.String(40), nullable=False)
    contact_email = db.Column(db.String(190), nullable=True)

    # requested -> accepted -> completed, or requested/accepted -> cancelled
    status = db.Column(db.String(20), nullable=False, default="requested", index=True)
    artisan_id = db.Column(
        db.String(32), db.ForeignKey("artisans.id", ondelete="SET NULL"),
        index=True, nullable=True,
    )

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    accepted_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    # A simple propose/confirm pair rather than a separate negotiation
    # table — realistically a handful of back-and-forths per job, not
    # enough to earn its own schema. Whoever proposes sets scheduled_at +
    # scheduled_proposed_by and clears scheduled_confirmed; only the OTHER
    # party's confirm flips it back to True (see api/requests.py's
    # propose-time/confirm-time). Re-proposing before confirmation just
    # overwrites the previous proposal.
    scheduled_at = db.Column(db.DateTime, nullable=True)
    scheduled_proposed_by = db.Column(db.String(10), nullable=True)  # "customer" | "artisan"
    scheduled_confirmed = db.Column(db.Boolean, nullable=True)

    def to_dict(self):
        return {
            "id": self.id, "trade": self.trade, "city": self.city,
            "description": self.description,
            "contact_name": self.contact_name, "contact_phone": self.contact_phone,
            "contact_email": self.contact_email,
            "status": self.status, "artisan_id": self.artisan_id,
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "scheduled_proposed_by": self.scheduled_proposed_by,
            "scheduled_confirmed": bool(self.scheduled_confirmed),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "accepted_at": self.accepted_at.isoformat() if self.accepted_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class Message(db.Model):
    """
    A chat thread is exactly the set of Message rows sharing a
    job_request_id — one thread per job, not a general inbox (see
    api/messages.py). Only postable once a job is accepted; there's no
    counterpart to message before then.

    Uses a plain autoincrementing integer id, not this app's usual UUID
    hex — it doubles as the chronological polling cursor (?since_id=). A
    UUID doesn't sort chronologically, and created_at alone risks
    same-millisecond ties on a rapid back-and-forth. Every read here is
    already scoped to one job_request_id and gated to that job's own two
    participants (see _job_side in api/requests.py), so a sequential id
    doesn't leak anything a UUID would have hidden — unlike, say, Artisan
    or User ids, which stay UUIDs because they're looked up directly.
    """
    __tablename__ = "messages"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    job_request_id = db.Column(
        db.String(32), db.ForeignKey("job_requests.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    sender_type = db.Column(db.String(10), nullable=False)  # "customer" | "artisan"
    # Captured directly, not resolved via lookup — same reasoning as
    # JobRequest.contact_name/phone: a guest customer has no profile row to
    # look up, and this is simply whichever id (user_id/guest_id, or
    # artisan_id) _job_side already matched the sender against.
    sender_id = db.Column(db.String(64), nullable=False)
    body = db.Column(db.String(2000), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    read_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id, "job_request_id": self.job_request_id,
            "sender_type": self.sender_type, "body": self.body,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }


class Review(db.Model):
    """
    Free-floating (job_request_id NULL, verified False) by default — the
    original anonymous "rate this artisan" widget, unchanged, since most
    existing listings have no job history to gate a review against.
    job_request_id/verified=True is the additive job-gated path: only
    postable once a JobRequest is completed, only by that job's own
    customer, one per job (see api/requests.py's POST /<id>/review) — a
    stronger trust signal than the free-floating path, surfaced as a
    "Verified job" badge, not a replacement for it.
    """
    __tablename__ = "reviews"
    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    artisan_id = db.Column(
        db.String(32), db.ForeignKey("artisans.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    job_request_id = db.Column(
        db.String(32), db.ForeignKey("job_requests.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    verified = db.Column(db.Boolean, nullable=False, default=False)
    stars = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.String(280))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id, "artisan_id": self.artisan_id, "stars": self.stars,
            "comment": self.comment,
            "job_request_id": self.job_request_id, "verified": bool(self.verified),
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


class CareerProfile(db.Model):
    """
    The structured "verified memory" the Apply-with-AI agent (see app/agent/
    and app/api/apply.py) is allowed to treat as ground truth — distinct
    from Media's generated-resume JSON blobs, which are documents, not
    reusable structured facts. One row per scope (same guest_id/user_id
    dual-scoping as everywhere else in this app).

    `confirmed_at` is the whole point of this table: fields can be
    populated by AI extraction from an uploaded resume, but that's a
    PROPOSAL, not verified fact, until a human has reviewed/confirmed it at
    least once in the UI. The agent must never treat an unconfirmed profile
    as something it's allowed to fill sensitive fields from — see
    app/agent/tools.py's sensitive-field allowlist enforcement.
    """
    __tablename__ = "career_profiles"
    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    guest_id = db.Column(db.String(64), index=True, nullable=True)
    user_id = db.Column(db.String(32), db.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)

    full_name = db.Column(db.String(150))
    email = db.Column(db.String(190))
    phone = db.Column(db.String(40))
    location = db.Column(db.String(150))

    # {"status": "citizen" | "permanent_resident" | "visa_sponsorship_required"
    #  | "authorized_no_sponsorship" | "unknown", "details": "..."} — defaults
    # to unknown, never inferred by the agent from anything else on file.
    work_authorization = db.Column(db.JSON)
    willing_to_relocate = db.Column(db.Boolean, nullable=True)  # None = not stated, never assumed either way
    desired_salary_min = db.Column(db.Integer, nullable=True)

    education = db.Column(db.JSON)         # [{degree, school, location, period}]
    work_history = db.Column(db.JSON)      # [{role, company, period, location, bullets}]
    skills = db.Column(db.JSON)            # ["...", ...]
    certifications = db.Column(db.JSON)    # ["...", ...]

    # Legally voluntary on US applications (race/gender/veteran/disability)
    # — must default to "prefer not to answer," never inferred or assumed.
    eeo_demographics = db.Column(db.JSON)

    # Growing bank of confirmed free-text Q&A the agent can reuse across
    # runs instead of re-generating from scratch every time — keyed by a
    # normalized question fingerprint. [{question, answer, confirmed_at}]
    qa_answers = db.Column(db.JSON)

    source_resume_id = db.Column(db.String(32), db.ForeignKey("media.id"), index=True, nullable=True)
    confirmed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id, "full_name": self.full_name, "email": self.email,
            "phone": self.phone, "location": self.location,
            "work_authorization": self.work_authorization or {"status": "unknown"},
            "willing_to_relocate": self.willing_to_relocate,
            "desired_salary_min": self.desired_salary_min,
            "education": self.education or [], "work_history": self.work_history or [],
            "skills": self.skills or [], "certifications": self.certifications or [],
            "eeo_demographics": self.eeo_demographics or {},
            "qa_answers": self.qa_answers or [],
            "source_resume_id": self.source_resume_id,
            "confirmed": self.confirmed_at is not None,
            "confirmed_at": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ApplicationRun(db.Model):
    """
    One "Apply with AI" execution — the job execution record the agent loop
    (app/agent/loop.py) reads from and writes to as it works, and the
    frontend polls (GET /api/v1/apply/runs/<id>) to render live progress.
    Deliberately not named JobApplication — that table already exists as
    the user's own manually-tracked application list; this is a different
    concept (an audit trail of one automation run), linked to it only at
    the end, once a real submission happens (see api/apply.py).
    """
    __tablename__ = "application_runs"
    id = db.Column(db.String(32), primary_key=True, default=_gen_id)
    guest_id = db.Column(db.String(64), index=True, nullable=True)
    user_id = db.Column(db.String(32), db.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)

    target_url = db.Column(db.String(2000), nullable=False)
    # queued -> reading_job -> preparing_resume -> filling_form -> (needs_input <-> filling_form)
    # -> ready_for_review -> submitted | failed | cancelled | expired
    status = db.Column(db.String(30), nullable=False, default="queued", index=True)

    resume_id = db.Column(db.String(32), db.ForeignKey("media.id"), index=True, nullable=True)
    # Frozen copy of whichever CareerProfile fields were actually consulted
    # for this run, so a later edit to the live profile can never
    # retroactively change what an already-finished run's audit trail says
    # it used.
    profile_snapshot = db.Column(db.JSON)

    # Append-only: [{step_number, timestamp, tool_name, tool_input, result_summary, page_url}]
    # — the exact feed the frontend's live checklist/activity log polls and renders.
    steps_log = db.Column(db.JSON)
    # [{question, field_label, page_context, answered, answer}] — the
    # ask_user outbox; unanswered entries are what put status into needs_input.
    pending_questions = db.Column(db.JSON)
    # Required fields the agent had no data and no answer for by the time
    # it finished — surfaced to the human on the review screen, not silently dropped.
    unfillable_fields = db.Column(db.JSON)
    # Final field-by-field state of the form, for the human review screen.
    filled_form_snapshot = db.Column(db.JSON)
    review_screenshot_media_id = db.Column(db.String(32), db.ForeignKey("media.id"), index=True, nullable=True)

    # Addresses the live browser/context kept alive from ready_for_review
    # through the human's review window, so confirm-submit can reconnect to
    # the SAME session and perform the one real submit click — see
    # app/agent/browser.py's session registry. Cleared once the run leaves
    # ready_for_review (submitted, expired, or cancelled).
    browser_session_id = db.Column(db.String(64), nullable=True)
    # Wall-clock deadline for the review window — a boot-time sweep and a
    # background watcher both use this to expire/tear down a run nobody
    # confirmed in time, instead of holding a live browser indefinitely.
    review_expires_at = db.Column(db.DateTime, nullable=True)

    error_message = db.Column(db.String(1000), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id, "target_url": self.target_url, "status": self.status,
            "resume_id": self.resume_id,
            "steps_log": self.steps_log or [],
            "pending_questions": self.pending_questions or [],
            "unfillable_fields": self.unfillable_fields or [],
            "filled_form_snapshot": self.filled_form_snapshot or {},
            "review_screenshot_media_id": self.review_screenshot_media_id,
            "review_expires_at": self.review_expires_at.isoformat() if self.review_expires_at else None,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
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