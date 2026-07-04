from flask import Blueprint, request, jsonify
from app.extensions import db
import time, uuid

communities_bp = Blueprint("communities", __name__)

@communities_bp.route("/", methods=["GET"])
def list_communities():
    return jsonify(db["communities"])

@communities_bp.route("/", methods=["POST"])
def create_community():
    data     = request.json or {}
    username = data.get("username")
    name     = (data.get("name") or "").strip()
    desc     = (data.get("description") or "").strip()
    if not username or username not in db["users"]:
        return jsonify({"error": "Not logged in"}), 401
    if not name:
        return jsonify({"error": "Community name required"}), 400
    if any(c["name"].lower() == name.lower() for c in db["communities"]):
        return jsonify({"error": "Community already exists"}), 400
    community = {"id": str(uuid.uuid4()), "name": name, "description": desc,
                 "creator": username, "members": [username], "created": int(time.time())}
    db["communities"].append(community)
    return jsonify(community), 201

@communities_bp.route("/<community_id>/join", methods=["POST"])
def join_community(community_id):
    data     = request.json or {}
    username = data.get("username")
    if not username:
        return jsonify({"error": "Not logged in"}), 401
    for c in db["communities"]:
        if c["id"] == community_id:
            if username in c["members"]:
                c["members"].remove(username)
                return jsonify({"joined": False, "members": len(c["members"])})
            else:
                c["members"].append(username)
                return jsonify({"joined": True, "members": len(c["members"])})
    return jsonify({"error": "Community not found"}), 404