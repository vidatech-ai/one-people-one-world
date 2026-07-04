from flask import Flask
from flask_cors import CORS

from app.routes.auth import auth_bp
from app.routes.posts import posts_bp
from app.routes.users import users_bp
from app.routes.messages import messages_bp
from app.routes.communities import communities_bp

def create_app():
    app = Flask(__name__)
    CORS(app)
    app.config["SECRET_KEY"] = "one-people-one-world-dev-key"
    app.register_blueprint(auth_bp,        url_prefix="/auth")
    app.register_blueprint(posts_bp,       url_prefix="/posts")
    app.register_blueprint(users_bp,       url_prefix="/users")
    app.register_blueprint(messages_bp,    url_prefix="/messages")
    app.register_blueprint(communities_bp, url_prefix="/communities")
    return app