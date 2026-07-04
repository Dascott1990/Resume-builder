from flask import jsonify


class APIError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def register_error_handlers(app):
    @app.errorhandler(APIError)
    def handle_api_error(err):
        return jsonify({"success": False, "error": err.message}), err.status_code

    @app.errorhandler(404)
    def handle_404(err):
        return jsonify({"success": False, "error": "Not found"}), 404

    @app.errorhandler(500)
    def handle_500(err):
        return jsonify({"success": False, "error": "Internal server error"}), 500
