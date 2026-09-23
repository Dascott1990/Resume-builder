from app import create_app

app = create_app()

if __name__ == "__main__":
    # use_reloader=False is deliberate: Flask's debug reloader watches
    # every .py file and silently kills + restarts this whole process the
    # moment any of them is saved — including mid-edit of an unrelated
    # file while someone has a real Apply with AI automation running.
    # That's not hypothetical: it killed a live in-progress run four
    # times in about a minute while apply.py itself was being edited,
    # each restart wiping the in-memory answer registry a needs_input
    # run depends on and abandoning the DB row with no thread left to
    # ever move it forward again — the run just sits there, and every
    # future attempt is left guessing why "cancel" or a fresh run didn't
    # help. debug=True is kept for its error pages; only the silent
    # auto-restart is off. Pick the process back up with a real restart
    # (this file) once, deliberately, when nothing is actually running.
    app.run(host="0.0.0.0", port=5002, debug=True, use_reloader=False)