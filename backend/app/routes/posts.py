from flask import Blueprint, request, jsonify
from app.extensions import db
import time, uuid

posts_bp = Blueprint("posts", __name__)

@posts_bp.route("/", methods=["POST"])
def create_post():
    data     = request.json or {}
    username = data.get("username")
    content  = (data.get("content") or "").strip()

    if not username or username not in db["users"]:
        return jsonify({"error": "Not logged in"}), 401
    if not content:
        return jsonify({"error": "Post cannot be empty"}), 400
    if len(content) > 500:
        return jsonify({"error": "Post too long (max 500 chars)"}), 400

    post = {
        "id":           str(uuid.uuid4()),
        "username":     username,
        "display_name": db["users"][username]["display_name"],
        "content":      content,
        "timestamp":    int(time.time()),
        "likes":        [],
        "community":    data.get("community"),
    }
    db["posts"].append(post)
    return jsonify(post), 201

@posts_bp.route("/", methods=["GET"])
def get_posts():
    community = request.args.get("community")
    username  = request.args.get("username")
    posts     = db["posts"]
    if community:
        posts = [p for p in posts if p.get("community") == community]
    if username:
        posts = [p for p in posts if p["username"] == username]
    return jsonify(list(reversed(posts)))

@posts_bp.route("/<post_id>/like", methods=["POST"])
def like_post(post_id):
    data     = request.json or {}
    username = data.get("username")
    if not username:
        return jsonify({"error": "Not logged in"}), 401
    for post in db["posts"]:
        if post["id"] == post_id:
            if username in post["likes"]:
                post["likes"].remove(username)
                return jsonify({"liked": False, "count": len(post["likes"])})
            else:
                post["likes"].append(username)
                return jsonify({"liked": True, "count": len(post["likes"])})
    return jsonify({"error": "Post not found"}), 404

@posts_bp.route("/<post_id>", methods=["DELETE"])
def delete_post(post_id):
    data     = request.json or {}
    username = data.get("username")
    for i, post in enumerate(db["posts"]):
        if post["id"] == post_id:
            if post["username"] != username:
                return jsonify({"error": "Not your post"}), 403
            db["posts"].pop(i)
            return jsonify({"message": "Deleted"})
    return jsonify({"error": "Post not found"}), 404