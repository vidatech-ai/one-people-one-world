from flask import Blueprint, request, jsonify
from app.extensions import db
import hashlib, time, uuid

auth_bp = Blueprint("auth", __name__)

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json or {}
    username     = (data.get("username") or "").strip()
    password     = data.get("password") or ""
    display_name = data.get("display_name") or username

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if len(password) < 4:
        return jsonify({"error": "Password must be at least 4 characters"}), 400
    if username in db["users"]:
        return jsonify({"error": "Username already taken"}), 400

    user = {
        "id":           str(uuid.uuid4()),
        "username":     username,
        "password":     hash_password(password),
        "display_name": display_name,
        "bio":          "",
        "joined":       int(time.time()),
        "followers":    [],
        "following":    [],
    }
    db["users"][username] = user
    return jsonify({"message": "Registered successfully", "username": username,
                    "id": user["id"], "display_name": display_name})

@auth_bp.route("/login", methods=["POST"])
def login():
    data     = request.json or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    user     = db["users"].get(username)

    if not user or user["password"] != hash_password(password):
        return jsonify({"error": "Invalid username or password"}), 401

    return jsonify({"message": "Login successful", "username": username,
                    "id": user["id"], "display_name": user["display_name"], "bio": user["bio"]})