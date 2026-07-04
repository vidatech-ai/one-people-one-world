from flask import Blueprint, request, jsonify
from app.extensions import db
import time, uuid

messages_bp = Blueprint("messages", __name__)

@messages_bp.route("/send", methods=["POST"])
def send_message():
    data     = request.json or {}
    sender   = data.get("from")
    receiver = data.get("to")
    content  = (data.get("content") or "").strip()
    if not sender or not receiver or not content:
        return jsonify({"error": "Missing fields"}), 400
    if sender not in db["users"] or receiver not in db["users"]:
        return jsonify({"error": "User not found"}), 404
    msg = {"id": str(uuid.uuid4()), "from": sender, "to": receiver,
           "content": content, "timestamp": int(time.time())}
    db["messages"].append(msg)
    return jsonify(msg), 201

@messages_bp.route("/conversation", methods=["GET"])
def get_conversation():
    a = request.args.get("a")
    b = request.args.get("b")
    if not a or not b:
        return jsonify({"error": "Provide a and b"}), 400
    convo = [m for m in db["messages"]
             if (m["from"]==a and m["to"]==b) or (m["from"]==b and m["to"]==a)]
    return jsonify(sorted(convo, key=lambda m: m["timestamp"]))

@messages_bp.route("/inbox/<username>", methods=["GET"])
def inbox(username):
    contacts = set()
    for m in db["messages"]:
        if m["to"]   == username: contacts.add(m["from"])
        if m["from"] == username: contacts.add(m["to"])
    return jsonify(list(contacts))