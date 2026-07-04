from flask import Blueprint, request, jsonify
from app.extensions import db

users_bp = Blueprint("users", __name__)

def public_user(user):
    return {"id": user["id"], "username": user["username"],
            "display_name": user["display_name"], "bio": user["bio"],
            "followers": len(user["followers"]), "following": len(user["following"]),
            "joined": user["joined"]}

@users_bp.route("/", methods=["GET"])
def list_users():
    return jsonify([public_user(u) for u in db["users"].values()])

@users_bp.route("/<username>", methods=["GET"])
def get_user(username):
    user = db["users"].get(username)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(public_user(user))

@users_bp.route("/<username>/bio", methods=["PUT"])
def update_bio(username):
    data      = request.json or {}
    requester = data.get("username")
    if requester != username:
        return jsonify({"error": "Forbidden"}), 403
    user = db["users"].get(username)
    if not user:
        return jsonify({"error": "User not found"}), 404
    user["bio"] = (data.get("bio") or "")[:200]
    return jsonify({"bio": user["bio"]})

@users_bp.route("/<username>/follow", methods=["POST"])
def follow(username):
    data      = request.json or {}
    requester = data.get("username")
    if not requester or requester == username:
        return jsonify({"error": "Invalid"}), 400
    target = db["users"].get(username)
    me     = db["users"].get(requester)
    if not target or not me:
        return jsonify({"error": "User not found"}), 404
    if requester in target["followers"]:
        target["followers"].remove(requester)
        me["following"].remove(username)
        return jsonify({"following": False})
    else:
        target["followers"].append(requester)
        me["following"].append(username)
        return jsonify({"following": True})