from flask import jsonify


def success(data=None, message=None, status=200):
    body = {"success": True}
    if message is not None:
        body["message"] = message
    if data is not None:
        body["data"] = data
    return jsonify(body), status


def created(data=None, message="Created"):
    return success(data, message, 201)


def no_content():
    return "", 204
