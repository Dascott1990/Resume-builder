"""
app/utils/story_quality.py — the phase-one story tool's post-render
quality check: same shape as resume.py's ATS score (0-100 + a list of
issues, advisory only, never blocks export/download), scored from the
clip timeline that was actually just rendered rather than an AI call —
every issue here is a mechanical timing/pacing fact (a clip too short to
register, a caption outpacing its own reading time, a long stretch with
no caption at all), not something that needs semantic judgment the way
a resume's wording does.

Deliberately does NOT check caption/audio sync or audio dead-air: phase
one's client-side export (storyClientExport.js) never records an audio
track at all — see StoryTool.js's own doc comment on why — so there is
no audio to be out of sync with. Checking for it anyway would mean
either silently always passing (dishonest) or always failing (useless);
this only scores what's structurally possible to be wrong about a
silent, straight-cut slideshow.
"""
MIN_CLIP_SECONDS = 1.0          # shorter than this cuts before it can register
READING_CHARS_PER_SEC = 15      # comfortable reading speed for a caption overlay
DEAD_AIR_SECONDS = 3.0          # a captionless clip held this long reads as empty

DEDUCTIONS = {"jarring_cut": 12, "caption_pace": 8, "dead_air": 10}


def score_story(clips):
    """clips: [{ duration, caption_text }], in playback order. Returns
    {score, summary, issues: [{severity, message, category, timestamp}]}."""
    issues = []
    t = 0.0
    for i, clip in enumerate(clips):
        duration = float(clip.get("duration") or 0)
        caption = (clip.get("caption_text") or "").strip()
        label = f"Clip {i + 1}"

        if duration > 0 and duration < MIN_CLIP_SECONDS:
            issues.append({
                "category": "jarring_cut", "severity": "medium", "timestamp": round(t, 2),
                "message": f"{label} is only {duration:.1f}s — too quick to register before it cuts away.",
            })

        if caption:
            max_readable_chars = duration * READING_CHARS_PER_SEC
            if len(caption) > max_readable_chars:
                issues.append({
                    "category": "caption_pace", "severity": "medium", "timestamp": round(t, 2),
                    "message": f"{label}'s caption is too long to read in {duration:.1f}s — shorten it or hold the clip longer.",
                })
        elif duration >= DEAD_AIR_SECONDS:
            issues.append({
                "category": "dead_air", "severity": "low", "timestamp": round(t, 2),
                "message": f"{label} holds for {duration:.1f}s with no caption — feels empty this long.",
            })

        t += duration

    score = 100
    for issue in issues:
        score -= DEDUCTIONS.get(issue["category"], 5)
    score = max(0, min(100, score))

    if not clips:
        summary = "No clips to score yet."
    elif not issues:
        summary = "Clean pacing — no timing issues found."
    else:
        summary = f"{len(issues)} pacing issue{'s' if len(issues) != 1 else ''} found — advisory only, export isn't blocked."

    return {"score": score, "summary": summary, "issues": issues}
