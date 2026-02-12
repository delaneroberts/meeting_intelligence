from flask import Flask
import pytest

from backend.models import db, User, Setting
from backend.routes.api import api


@pytest.fixture()
def client(tmp_path):
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'test.db'}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    with app.app_context():
        db.create_all()
        db.session.add(User(id=1, username="default", email=None))
        db.session.commit()

    app.register_blueprint(api)

    with app.test_client() as test_client:
        yield test_client

    with app.app_context():
        db.drop_all()


def test_get_settings(client):
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.get_json()
    assert "settings" in data
    assert "default_language" in data["settings"]


def test_put_settings(client):
    payload = {
        "settings": {
            "default_language": "English",
            "summary_language": "English",
            "auto_detect_qa": False
        }
    }
    response = client.put("/api/settings", json=payload)
    assert response.status_code == 200

    data = response.get_json()
    assert data["settings"]["auto_detect_qa"] is False
    assert Setting.get("summary_language", user_id=1) == "English"
