"""
app/api/story.py — /brand's story-assembly tool: multiple image/video
clips, sequenced with straight cuts, each optionally captioned, rendered
server-side to MP4 or GIF via ffmpeg.

POST /api/v1/brand/story/runs            — start a render, returns immediately
GET  /api/v1/brand/story/runs            — last 20 runs
GET  /api/v1/brand/story/runs/<id>       — poll status
GET  /api/v1/brand/story/runs/<id>/download — the finished file

Same unauthenticated posture as the rest of api/brand.py (see that
file's module docstring) — this is a team tool, not customer-facing, and
deliberately not gated behind the separate admin-panel auth system.

Modeled on api/apply.py's ApplicationRun pattern: the route that starts a
run does its validation synchronously, then hands the actual work to a
plain threading.Thread(daemon=True) — not APScheduler (reserved for
periodic work, see utils/task_reminders.py) and not Celery/RQ (this app
runs a single gunicorn worker with no queue infra, so a thread inside
that one process is the right amount of infrastructure). The frontend
polls GET .../runs/<id> for status; there's no websocket/SSE anywhere in
this app and no reason to introduce one here.

Unlike apply.py's Playwright sessions, a render has no idle "waiting on a
human" phase — every ffmpeg call is timeout-bounded — so this skips
_RunLock's ownership-token complexity entirely and just caps concurrency
with a plain threading.Semaphore.

Clip files are never persisted to Postgres — see StoryRun's docstring in
models.py. They live in a tempfile.mkdtemp() working directory for the
life of one render and are deleted unconditionally when it finishes,
success or failure. Only the rendered output becomes a Media row.
"""
import io
import json
import os
import shutil
import subprocess
import tempfile
import threading
from datetime import datetime, timezone

from flask import Blueprint, current_app, request, jsonify, send_file

from app import db, limiter
from app.models import StoryRun, Media
from app.middleware.error_handlers import APIError

story_bp = Blueprint("story", __name__)

# Kept in lockstep with frontend/app/brand/postTemplates.js's PLATFORMS —
# same "mirror a frontend enum server-side" pattern as brand.py's own
# ACCENT_IDS list for suggest-theme.
PLATFORMS = {
    "square": (1080, 1080), "portrait": (1080, 1350), "story": (1080, 1920),
    "landscape": (1600, 900), "pin": (1000, 1500),
}
VALID_KINDS = ("image", "video")
VALID_FORMATS = ("mp4", "gif")
MAX_CLIPS = 20
MAX_CLIP_BYTES = 60 * 1024 * 1024
MAX_TOTAL_UPLOAD_BYTES = 250 * 1024 * 1024
MAX_GIF_DURATION_SEC = 10  # GIF is for short single-scene loops only, not full stories
FFMPEG_TIMEOUT_SEC = 120
_STORY_SEMAPHORE = threading.Semaphore(2)  # caps concurrent renders on one dyno's CPU


def _clip_duration(clip_spec):
    if clip_spec["kind"] == "image":
        return float(clip_spec["duration_sec"])
    return float(clip_spec["trim_out"]) - float(clip_spec["trim_in"])


def _run_ffmpeg(args, cwd):
    result = subprocess.run(
        ["ffmpeg", "-y", *args], cwd=cwd, timeout=FFMPEG_TIMEOUT_SEC,
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode(errors="replace")[-800:])


@story_bp.route("/runs", methods=["POST"])
@limiter.limit("20 per hour")
def create_story_run():
    raw_spec = request.form.get("spec")
    if not raw_spec:
        raise APIError("spec is required", 400)
    try:
        spec = json.loads(raw_spec)
    except json.JSONDecodeError:
        raise APIError("spec must be valid JSON", 400)

    platform_id = spec.get("platform_id")
    if platform_id not in PLATFORMS:
        raise APIError(f"platform_id must be one of {sorted(PLATFORMS)}", 400)
    output_format = spec.get("output_format")
    if output_format not in VALID_FORMATS:
        raise APIError(f"output_format must be one of {VALID_FORMATS}", 400)

    clip_specs = spec.get("clips")
    if not isinstance(clip_specs, list) or not (1 <= len(clip_specs) <= MAX_CLIPS):
        raise APIError(f"clips must be a list of 1-{MAX_CLIPS} items", 400)

    files = request.files.getlist("clips")
    if len(files) != len(clip_specs):
        raise APIError("Number of uploaded clip files must match spec.clips", 400)

    # Read every clip's bytes now — request.files streams are only valid
    # inside this request; the background thread gets plain bytes, not a
    # file handle it could accidentally touch after the response returns.
    clip_bytes = []
    total_bytes = 0
    for i, (clip_spec, file) in enumerate(zip(clip_specs, files)):
        kind = clip_spec.get("kind")
        if kind not in VALID_KINDS:
            raise APIError(f"clips[{i}].kind must be one of {VALID_KINDS}", 400)
        mimetype = file.mimetype or ""
        expected_prefix = "image/" if kind == "image" else "video/"
        if not mimetype.startswith(expected_prefix):
            raise APIError(f"clips[{i}] must be a {expected_prefix}* file (got {mimetype})", 400)
        if kind == "image":
            if not isinstance(clip_spec.get("duration_sec"), (int, float)) or clip_spec["duration_sec"] <= 0:
                raise APIError(f"clips[{i}].duration_sec must be a positive number", 400)
        else:
            trim_in, trim_out = clip_spec.get("trim_in"), clip_spec.get("trim_out")
            if not isinstance(trim_in, (int, float)) or not isinstance(trim_out, (int, float)) or trim_out <= trim_in:
                raise APIError(f"clips[{i}].trim_out must be greater than trim_in", 400)

        data = file.read()
        if len(data) > MAX_CLIP_BYTES:
            raise APIError(f"clips[{i}] exceeds the {MAX_CLIP_BYTES // (1024*1024)}MB per-clip limit", 400)
        total_bytes += len(data)
        if total_bytes > MAX_TOTAL_UPLOAD_BYTES:
            raise APIError(f"Total upload exceeds the {MAX_TOTAL_UPLOAD_BYTES // (1024*1024)}MB limit", 400)
        clip_bytes.append({"kind": kind, "mimetype": mimetype, "data": data, "spec": clip_spec})

    caption_bytes = {}
    for i in range(len(clip_specs)):
        cap_file = request.files.get(f"caption_{i}")
        if cap_file:
            if (cap_file.mimetype or "") != "image/png":
                raise APIError(f"caption_{i} must be a PNG", 400)
            caption_bytes[i] = cap_file.read()

    if output_format == "gif":
        total_duration = sum(_clip_duration(c["spec"]) for c in clip_bytes)
        if total_duration > MAX_GIF_DURATION_SEC:
            raise APIError(
                f"GIF output is limited to {MAX_GIF_DURATION_SEC}s total (this sequence is {total_duration:.1f}s) — use MP4 for longer stories",
                400,
            )

    run = StoryRun(status="queued", output_format=output_format, platform_id=platform_id, sequence_spec=spec)
    db.session.add(run)
    db.session.commit()

    app_obj = current_app._get_current_object()
    threading.Thread(
        target=_execute_story_run, args=(app_obj, run.id, clip_bytes, caption_bytes, platform_id, output_format),
        daemon=True,
    ).start()

    return jsonify({"success": True, "data": run.to_dict()}), 201


@story_bp.route("/runs", methods=["GET"])
def list_story_runs():
    items = StoryRun.query.order_by(StoryRun.created_at.desc()).limit(20).all()
    return jsonify({"success": True, "data": [r.to_dict() for r in items]}), 200


@story_bp.route("/runs/<run_id>", methods=["GET"])
def get_story_run(run_id):
    run = db.session.get(StoryRun, run_id)
    if not run:
        raise APIError("Run not found", 404)
    return jsonify({"success": True, "data": run.to_dict()}), 200


@story_bp.route("/runs/<run_id>/download", methods=["GET"])
def download_story_run(run_id):
    run = db.session.get(StoryRun, run_id)
    if not run or run.status != "done" or not run.output_media_id:
        raise APIError("This render isn't ready yet", 404)
    media = db.session.get(Media, run.output_media_id)
    if not media or not media.file_data:
        raise APIError("Render output not found", 404)
    ext = "mp4" if run.output_format == "mp4" else "gif"
    return send_file(
        io.BytesIO(media.file_data), mimetype=media.mime_type,
        as_attachment=True, download_name=f"noqeev-story-{run.platform_id}.{ext}", max_age=0,
    )


def _execute_story_run(app, run_id, clip_bytes, caption_bytes, platform_id, output_format):
    acquired = _STORY_SEMAPHORE.acquire(timeout=FFMPEG_TIMEOUT_SEC * 2)
    workdir = tempfile.mkdtemp(prefix="story_")
    try:
        with app.app_context():
            run = db.session.get(StoryRun, run_id)
            if not run:
                return
            run.status = "rendering"
            db.session.commit()
            try:
                media = _render_story(workdir, run, clip_bytes, caption_bytes, platform_id, output_format)
                run.output_media_id = media.id
                run.status = "done"
            except Exception as exc:
                run.status = "failed"
                run.error_message = str(exc)[:1000]
                print(f"❌ Story render {run_id} failed: {exc}")
            run.completed_at = datetime.now(timezone.utc)
            db.session.commit()
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
        if acquired:
            _STORY_SEMAPHORE.release()


def _render_story(workdir, run, clip_bytes, caption_bytes, platform_id, output_format):
    w, h = PLATFORMS[platform_id]
    seg_paths = []

    for i, clip in enumerate(clip_bytes):
        ext = ".mp4" if clip["kind"] == "video" else (".png" if "png" in clip["mimetype"] else ".jpg")
        src_path = os.path.join(workdir, f"clip_{i}{ext}")
        with open(src_path, "wb") as f:
            f.write(clip["data"])

        caption_path = None
        if i in caption_bytes:
            caption_path = os.path.join(workdir, f"caption_{i}.png")
            with open(caption_path, "wb") as f:
                f.write(caption_bytes[i])

        seg_path = os.path.join(workdir, f"seg_{i}.mp4")
        scale_pad = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1"

        if clip["kind"] == "image":
            duration = float(clip["spec"]["duration_sec"])
            inputs = ["-loop", "1", "-i", src_path]
            if caption_path:
                inputs += ["-i", caption_path]
                filter_complex = f"[0:v]{scale_pad}[bg];[bg][1:v]overlay=0:0:format=auto[outv]"
                map_arg = "[outv]"
            else:
                filter_complex = f"[0:v]{scale_pad}[outv]"
                map_arg = "[outv]"
            args = [*inputs, "-filter_complex", filter_complex, "-map", map_arg,
                    "-t", str(duration), "-r", "30", "-pix_fmt", "yuv420p", seg_path]
        else:
            trim_in = float(clip["spec"]["trim_in"])
            trim_out = float(clip["spec"]["trim_out"])
            inputs = ["-i", src_path]
            trim = f"trim=start={trim_in}:end={trim_out},setpts=PTS-STARTPTS,{scale_pad}"
            if caption_path:
                inputs += ["-i", caption_path]
                filter_complex = f"[0:v]{trim}[bg];[bg][1:v]overlay=0:0:format=auto[outv]"
            else:
                filter_complex = f"[0:v]{trim}[outv]"
            args = [*inputs, "-filter_complex", filter_complex, "-map", "[outv]",
                    "-an", "-r", "30", "-pix_fmt", "yuv420p", seg_path]

        _run_ffmpeg(args, workdir)
        seg_paths.append(seg_path)

    concat_list = os.path.join(workdir, "concat_list.txt")
    with open(concat_list, "w") as f:
        for p in seg_paths:
            f.write(f"file '{os.path.basename(p)}'\n")
    concat_path = os.path.join(workdir, "concat.mp4")
    _run_ffmpeg(["-f", "concat", "-safe", "0", "-i", "concat_list.txt", "-c", "copy", "concat.mp4"], workdir)

    if output_format == "mp4":
        final_path = os.path.join(workdir, "final.mp4")
        _run_ffmpeg(["-i", "concat.mp4", "-c", "copy", "-movflags", "+faststart", "final.mp4"], workdir)
        mime_type, media_type = "video/mp4", "video"
    else:
        palette_path = os.path.join(workdir, "palette.png")
        _run_ffmpeg(["-i", "concat.mp4", "-vf", f"fps=15,scale={w}:-1:flags=lanczos,palettegen", "palette.png"], workdir)
        final_path = os.path.join(workdir, "final.gif")
        _run_ffmpeg(
            ["-i", "concat.mp4", "-i", "palette.png", "-lavfi",
             f"fps=15,scale={w}:-1:flags=lanczos[x];[x][1:v]paletteuse", "final.gif"],
            workdir,
        )
        mime_type, media_type = "image/gif", "image"

    with open(final_path, "rb") as f:
        out_bytes = f.read()

    media = Media(
        filename=f"story_{run.id}.{output_format}", media_type=media_type, mime_type=mime_type,
        file_data=out_bytes, file_size=len(out_bytes), filter_name="story_render",
        metadata_json={"story_run_id": run.id, "platform_id": platform_id, "clip_count": len(clip_bytes)},
    )
    db.session.add(media)
    db.session.flush()
    return media


def sweep_stuck_story_runs(app):
    """A redeploy mid-render leaves a row in queued/rendering with no
    thread left alive to ever finish it — same reasoning as apply.py's
    sweep_stuck_runs, simpler here since there's no live browser session
    to tear down, just DB state to correct."""
    with app.app_context():
        stuck = StoryRun.query.filter(StoryRun.status.in_(["queued", "rendering"])).all()
        for run in stuck:
            run.status = "failed"
            run.error_message = "Interrupted by a server restart."
            run.completed_at = datetime.now(timezone.utc)
        if stuck:
            db.session.commit()
            print(f"🔧 Swept {len(stuck)} stuck StoryRun row(s) after restart")
