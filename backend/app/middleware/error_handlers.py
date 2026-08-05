import logging
import traceback

from flask import jsonify

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Raised deliberately, with a message that's safe to show the user."""

    def __init__(self, message, status_code=400, code=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        # Optional machine-readable tag (e.g. "EMAIL_NOT_VERIFIED") so the
        # frontend can branch on specific cases (show a resend button)
        # without parsing the human-readable message string.
        self.code = code


def register_error_handlers(app):
    @app.errorhandler(APIError)
    def handle_api_error(err):
        body = {"success": False, "error": err.message}
        if err.code:
            body["code"] = err.code
        return jsonify(body), err.status_code

    @app.errorhandler(404)
    def handle_404(err):
        return jsonify({"success": False, "error": "Not found"}), 404

    @app.errorhandler(500)
    def handle_500(err):
        logger.error("Unhandled 500 error", exc_info=True)
        return jsonify({"success": False, "error": "Internal server error"}), 500

    # Catch-all for anything not already handled above (e.g. raw DB errors).
    # This is the ONLY place unexpected exceptions land, so it must log the
    # full traceback — without this, "An unexpected error occurred" is the
    # last thing anyone (including us) ever sees.
    @app.errorhandler(Exception)
    def handle_generic_error(err):
        logger.error("Unhandled exception: %s", err, exc_info=True)
        # Also print for environments (like Render's basic log tail) that
        # don't surface the logging module's output distinctly from stdout.
        traceback.print_exc()
        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500