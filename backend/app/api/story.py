"""
app/api/story.py — /brand's story-assembly tool: multiple image/video
clips, sequenced with straight cuts, each optionally captioned, rendered
server-side to MP4 or GIF via ffmpeg.

POST /api/v1/brand/story/render — renders synchronously in the request
and either returns the file directly, or (if email_to is given) emails
it as an attachment and returns a plain success message instead.

Deliberately NOT an async job with a database-backed status row. Unlike
Apply-with-AI's browser-automation runs (which can take many minutes), a
straight-cut ffmpeg render of a handful of short clips finishes in
seconds — well inside one HTTP request. Skipping a StoryRun/Media row
entirely means this keeps working even when the database itself is
down (see this session's own recurring Neon outage) — the exact same
"never touches the database" shape brand.py's email_asset already uses.
Everything here is ephemeral: clips and every intermediate ffmpeg file
live in a tempfile.mkdtemp() working directory, deleted before the
response returns.

Same unauthenticated posture as the rest of api/brand.py.
"""
import io
import json
import os
import re
import shutil
import subprocess
import tempfile

from flask import Blueprint, request, jsonify, send_file

from app import limiter
from app.middleware.error_handlers import APIError
from app.utils.mail import send_email

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
MAX_NARRATION_CHARS = 400  # ~30-40s of speech at espeak's default rate — bounds render time
FFMPEG_TIMEOUT_SEC = 120
TTS_TIMEOUT_SEC = 30
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


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


def _tts_wav(workdir, text, index):
    """espeak-ng, not a paid neural TTS API — free, offline, zero new
    credentials (explicit tradeoff the user chose: synthetic-sounding
    over natural-sounding, to avoid provisioning a new vendor). Installed
    via apt in render.yaml's buildCommand, same mechanism as ffmpeg."""
    wav_path = os.path.join(workdir, f"narration_{index}.wav")
    result = subprocess.run(
        ["espeak-ng", "-s", "165", "-w", wav_path, text],
        cwd=workdir, timeout=TTS_TIMEOUT_SEC, capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode(errors="replace")[-500:])
    return wav_path


def _probe_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, timeout=15,
    )
    try:
        return float(result.stdout.decode().strip())
    except ValueError:
        return 0.0


@story_bp.route("/render", methods=["POST"])
@limiter.limit("20 per hour")
def render_story():
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

    email_to = (request.form.get("email_to") or "").strip()
    if email_to and not _EMAIL_RE.match(email_to):
        raise APIError("Enter a valid email address", 400)

    clip_specs = spec.get("clips")
    if not isinstance(clip_specs, list) or not (1 <= len(clip_specs) <= MAX_CLIPS):
        raise APIError(f"clips must be a list of 1-{MAX_CLIPS} items", 400)

    files = request.files.getlist("clips")
    if len(files) != len(clip_specs):
        raise APIError("Number of uploaded clip files must match spec.clips", 400)

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
        narration_text = clip_spec.get("narration_text")
        if narration_text is not None:
            if not isinstance(narration_text, str) or len(narration_text) > MAX_NARRATION_CHARS:
                raise APIError(f"clips[{i}].narration_text must be a string under {MAX_NARRATION_CHARS} characters", 400)

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

    workdir = tempfile.mkdtemp(prefix="story_")
    try:
        out_bytes, mime_type, ext = _render_story(workdir, clip_bytes, caption_bytes, platform_id, output_format)
    except subprocess.TimeoutExpired:
        raise APIError("Render timed out — try fewer or shorter clips", 504)
    except Exception as exc:
        print(f"❌ Story render failed: {exc}")
        raise APIError(f"Render failed: {str(exc)[:300]}", 502)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    filename = f"noqeev-story-{platform_id}.{ext}"

    if email_to:
        try:
            send_email(
                email_to, "Noqeev — your story is ready",
                f"""<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:8px;">
                  <p style="font-weight:800;letter-spacing:0.02em;color:#111;margin:0 0 24px;">NOQEEV</p>
                  <h2 style="color:#111;margin:0 0 12px;">Your story is ready</h2>
                  <p style="color:#444;line-height:1.6;margin:0 0 4px;">Attached — ready to post.</p>
                </div>""",
                attachment=(filename, out_bytes, ext),
            )
        except Exception as exc:
            print(f"❌ Failed to email story render to {email_to}: {exc}")
            raise APIError("Could not send this email — check the mail server configuration", 502)
        return jsonify({"success": True, "data": {"message": f"Sent to {email_to}"}}), 200

    return send_file(
        io.BytesIO(out_bytes), mimetype=mime_type,
        as_attachment=True, download_name=filename, max_age=0,
    )


def _render_story(workdir, clip_bytes, caption_bytes, platform_id, output_format):
    w, h = PLATFORMS[platform_id]
    # Once ANY clip carries narration, every segment needs the same
    # stream layout (video+audio) or the concat demuxer's stream-copy in
    # the next step breaks — clips with no narration_text get a silent
    # track exactly matching their own duration instead of staying
    # video-only. If nothing in the sequence has narration, the pipeline
    # stays exactly as before (fully silent, no audio stream anywhere).
    has_narration = any((c["spec"].get("narration_text") or "").strip() for c in clip_bytes)
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

        narration_text = (clip["spec"].get("narration_text") or "").strip()
        narration_wav, narration_duration = None, 0.0
        if narration_text:
            narration_wav = _tts_wav(workdir, narration_text, i)
            narration_duration = _probe_duration(narration_wav)

        seg_path = os.path.join(workdir, f"seg_{i}.mp4")
        scale_pad = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1"

        if clip["kind"] == "image":
            # Hold the frame at least as long as the narration takes to
            # read — never shorter, so speech is never cut off.
            duration = max(float(clip["spec"]["duration_sec"]), narration_duration)
            video_inputs = ["-loop", "1", "-i", src_path]
            video_chain = f"[0:v]{scale_pad}"
        else:
            trim_in = float(clip["spec"]["trim_in"])
            trim_out = float(clip["spec"]["trim_out"])
            # Same idea for video — grow the trim window (never shrink
            # it) to cover the narration. ffmpeg's trim filter clamps
            # `end` at whatever the source actually has, so this is safe
            # even on a short source clip; -shortest below then makes the
            # audio match whatever video actually came out either way.
            trim_out = trim_out + max(0.0, narration_duration - (trim_out - trim_in))
            duration = trim_out - trim_in
            video_inputs = ["-i", src_path]
            video_chain = f"[0:v]trim=start={trim_in}:end={trim_out},setpts=PTS-STARTPTS,{scale_pad}"

        next_idx = 1
        filter_parts = []
        if caption_path:
            video_inputs += ["-i", caption_path]
            filter_parts.append(f"{video_chain}[bg];[bg][{next_idx}:v]overlay=0:0:format=auto[outv]")
            next_idx += 1
        else:
            filter_parts.append(f"{video_chain}[outv]")

        if has_narration:
            if narration_wav:
                video_inputs += ["-i", narration_wav]
                filter_parts.append(f"[{next_idx}:a]apad[a]")
            else:
                video_inputs += ["-f", "lavfi", "-t", str(duration), "-i", "anullsrc=r=44100:cl=stereo"]
                filter_parts.append(f"[{next_idx}:a]anull[a]")
            args = [*video_inputs, "-filter_complex", ";".join(filter_parts), "-map", "[outv]", "-map", "[a]",
                    "-t", str(duration), "-r", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", seg_path]
        else:
            args = [*video_inputs, "-filter_complex", ";".join(filter_parts), "-map", "[outv]",
                    "-an", "-t", str(duration), "-r", "30", "-pix_fmt", "yuv420p", seg_path]

        _run_ffmpeg(args, workdir)
        seg_paths.append(seg_path)

    concat_list = os.path.join(workdir, "concat_list.txt")
    with open(concat_list, "w") as f:
        for p in seg_paths:
            f.write(f"file '{os.path.basename(p)}'\n")
    _run_ffmpeg(["-f", "concat", "-safe", "0", "-i", "concat_list.txt", "-c", "copy", "concat.mp4"], workdir)

    if output_format == "mp4":
        final_path = os.path.join(workdir, "final.mp4")
        _run_ffmpeg(["-i", "concat.mp4", "-c", "copy", "-movflags", "+faststart", "final.mp4"], workdir)
        mime_type, ext = "video/mp4", "mp4"
    else:
        _run_ffmpeg(["-i", "concat.mp4", "-vf", f"fps=15,scale={w}:-1:flags=lanczos,palettegen", "palette.png"], workdir)
        final_path = os.path.join(workdir, "final.gif")
        _run_ffmpeg(
            ["-i", "concat.mp4", "-i", "palette.png", "-lavfi",
             f"fps=15,scale={w}:-1:flags=lanczos[x];[x][1:v]paletteuse", "final.gif"],
            workdir,
        )
        mime_type, ext = "image/gif", "gif"

    with open(final_path, "rb") as f:
        return f.read(), mime_type, ext
