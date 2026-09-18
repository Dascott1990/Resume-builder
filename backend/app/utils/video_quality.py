"""
app/utils/video_quality.py — the resume side has an ATS score; this is
the same instinct applied to a rendered Story video: an automated pass
over the ACTUAL FINISHED FILE, not the edit-time settings that produced
it, catching what would embarrass the brand before someone else notices
it after the fact. Never a hard gate — always a score plus a ranked list
of what to look at, with the user keeping final say on whether to ship
anyway.

Deliberately checks the RENDERED output, not what the editor was told to
do:
  - Caption accuracy / sync — re-transcribes the final video's own audio
    (Groq's hosted Whisper, same as story/transcribe.js's live feature —
    not a second vendor) and compares it against each clip's caption
    text for that same time window. This does NOT need OCR on the
    burned-in caption pixels: the caption text this compares against is
    the exact string the backend was given to composite into those exact
    pixels in the FIRST place (see api/story.py's caption_text_{i}) — the
    only thing that can have actually drifted from a re-edit is whether
    it still matches what's audibly SAID, which is exactly what a fresh
    transcription of the real output audio settles.
  - Dead air — ffmpeg's own silencedetect filter over the real rendered
    audio track, checked against which clips were actually expected to
    carry sound (a voice-over, or a kept original audio track).
  - Jump cuts — ffmpeg's own scene-change detection over the real
    rendered video track, checked against this story's own known clip
    boundaries (every one of THOSE is an intentional straight cut by
    design — see api/story.py's module docstring) so only a scene change
    that lands somewhere else, mid-clip, gets flagged as an accidental one.

Every threshold below is a heuristic, not a certainty — this is meant to
catch what's worth a human glance, not to be an infallible judge.
"""
import re
import subprocess
from difflib import SequenceMatcher

from .ai_client import groq_transcribe

ANALYSIS_TIMEOUT_SEC = 60

SILENCE_NOISE_DB = "-30dB"
SILENCE_MIN_DURATION_SEC = 0.5
SCENE_CHANGE_THRESHOLD = 0.4
BOUNDARY_TOLERANCE_SEC = 0.35  # how close a scene cut has to be to a known clip edge to count as "that edge," not a separate accidental cut

CAPTION_MATCH_MIN_RATIO = 0.35  # below this, a caption reads as unrelated to what's actually said, not just re-worded
SYNC_DRIFT_MODERATE_SEC = 0.6
SYNC_DRIFT_CRITICAL_SEC = 1.5

DEAD_AIR_CRITICAL_COVERAGE = 0.9  # fraction of a clip's own duration that's silent
DEAD_AIR_MODERATE_COVERAGE = 0.3

SCORE_DEDUCTIONS = {"critical": 20, "moderate": 10, "minor": 5}
QUALITY_THRESHOLD = 80  # same 0-100 scale as the resume ATS score; below this the export screen reads "Needs review"


def _run_ffmpeg_analysis(args):
    result = subprocess.run(["ffmpeg", *args], capture_output=True, timeout=ANALYSIS_TIMEOUT_SEC, text=True)
    return result.stderr


def detect_silence(video_path, duration_sec):
    """[(start, end), ...] seconds of silence in the rendered audio."""
    stderr = _run_ffmpeg_analysis([
        "-i", video_path, "-af", f"silencedetect=noise={SILENCE_NOISE_DB}:d={SILENCE_MIN_DURATION_SEC}",
        "-f", "null", "-",
    ])
    starts = [float(m) for m in re.findall(r"silence_start:\s*([\d.]+)", stderr)]
    ends = [float(m) for m in re.findall(r"silence_end:\s*([\d.]+)", stderr)]
    windows = list(zip(starts, ends))
    if len(starts) > len(ends):  # a silence that runs to the very end of the file never gets its own silence_end line
        windows.append((starts[-1], duration_sec))
    return windows


def detect_scene_cuts(video_path):
    """[timestamp, ...] seconds where the rendered video changes abruptly."""
    stderr = _run_ffmpeg_analysis([
        "-i", video_path, "-vf", f"select='gt(scene,{SCENE_CHANGE_THRESHOLD})',showinfo", "-f", "null", "-",
    ])
    return [float(m) for m in re.findall(r"pts_time:([\d.]+)", stderr)]


def _normalize(text):
    return re.sub(r"[^\w\s]", "", (text or "").lower()).strip()


def _similarity(a, b):
    a, b = _normalize(a), _normalize(b)
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def analyze_rendered_video(video_path, duration_sec, clip_windows, captions):
    """
    clip_windows: [{"start": float, "end": float, "expected_audio": bool}, ...]
      — one per rendered clip segment, in GLOBAL (whole-story) seconds.
    captions: [{"text": str, "start": float, "end": float}, ...]
      — one per clip that actually has a caption; start/end are that
      clip's own window in clip_windows (a caption is visible for its
      whole clip in this tool, never partial).
    Returns {"score": int, "verdict": "ready"|"needs_review", "issues": [...]}.
    """
    issues = []

    try:
        with open(video_path, "rb") as f:
            # Word-level timestamps, not segment-level — verified directly
            # against a real render: a Whisper SEGMENT can span an entire
            # clip including several seconds of leading silence before the
            # words actually start, rather than starting where the speech
            # actually starts, which made the sync check below compare
            # against a meaningless anchor. Word timing doesn't have that
            # slack (confirmed within ~0.1s of the real onset).
            transcript = groq_transcribe(f.read(), "final.mp4", "video/mp4", word_timestamps=True)
        words = transcript.get("words", [])
    except Exception as exc:
        words = []
        issues.append({
            "severity": "minor", "type": "analysis_incomplete", "timestamp": 0,
            "message": f"Couldn't verify caption accuracy against the audio: {exc}",
        })

    for cap in captions:
        overlapping = [w for w in words if w.get("end", 0) > cap["start"] and w.get("start", 0) < cap["end"]]
        if not overlapping:
            continue  # nothing spoken in this window at all — detect_silence/dead-air below owns that case
        spoken_text = " ".join(w.get("word", "") for w in overlapping).strip()
        ratio = _similarity(cap["text"], spoken_text)
        if ratio < CAPTION_MATCH_MIN_RATIO:
            issues.append({
                "severity": "critical", "type": "caption_mismatch", "timestamp": cap["start"],
                "message": f"Caption doesn't match what's actually said here — caption: \"{cap['text'][:70]}\"; audio: \"{spoken_text[:70]}\"",
            })
            continue
        drift = overlapping[0].get("start", cap["start"]) - cap["start"]
        if abs(drift) >= SYNC_DRIFT_CRITICAL_SEC:
            issues.append({
                "severity": "critical", "type": "sync_drift", "timestamp": cap["start"],
                "message": f"Caption is {abs(drift):.1f}s {'late' if drift > 0 else 'early'} relative to the voice-over",
            })
        elif abs(drift) >= SYNC_DRIFT_MODERATE_SEC:
            issues.append({
                "severity": "moderate", "type": "sync_drift", "timestamp": cap["start"],
                "message": f"Caption is {abs(drift):.1f}s {'late' if drift > 0 else 'early'} relative to the voice-over",
            })

    silence_windows = detect_silence(video_path, duration_sec)
    for clip in clip_windows:
        if not clip.get("expected_audio"):
            continue
        clip_len = clip["end"] - clip["start"]
        if clip_len <= 0:
            continue
        silent_overlap = sum(
            max(0.0, min(clip["end"], s_end) - max(clip["start"], s_start))
            for s_start, s_end in silence_windows
        )
        coverage = silent_overlap / clip_len
        if coverage >= DEAD_AIR_CRITICAL_COVERAGE:
            issues.append({
                "severity": "critical", "type": "dead_air", "timestamp": clip["start"],
                "message": "This clip has no audio, even though a voice-over or original sound was expected",
            })
        elif coverage >= DEAD_AIR_MODERATE_COVERAGE:
            issues.append({
                "severity": "moderate", "type": "dead_air", "timestamp": clip["start"],
                "message": "Part of this clip has unexpected silence",
            })

    boundary_times = sorted({round(c["start"], 1) for c in clip_windows} | {round(c["end"], 1) for c in clip_windows})
    for cut_t in detect_scene_cuts(video_path):
        if any(abs(cut_t - b) < BOUNDARY_TOLERANCE_SEC for b in boundary_times):
            continue  # one of this story's own intentional straight cuts between clips
        issues.append({
            "severity": "minor", "type": "jump_cut", "timestamp": cut_t,
            "message": "Possible jump cut — an abrupt visual change in the middle of a clip",
        })

    score = 100
    for issue in issues:
        score -= SCORE_DEDUCTIONS.get(issue["severity"], 5)
    score = max(0, min(100, score))

    severity_rank = {"critical": 0, "moderate": 1, "minor": 2}
    issues.sort(key=lambda i: (severity_rank.get(i["severity"], 3), i["timestamp"]))

    return {"score": score, "verdict": "ready" if score >= QUALITY_THRESHOLD else "needs_review", "issues": issues}
