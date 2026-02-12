import pytest
from flask import Flask

from backend.models import db, User, Setting


@pytest.fixture()
def app_context(tmp_path):
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'test.db'}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_create_default_user_and_setting(app_context):
    user = User(id=1, username="default", email=None)
    db.session.add(user)
    db.session.commit()

    Setting.set("default_language", "Cantonese", data_type="string", user_id=1)
    value = Setting.get("default_language", user_id=1)
    assert value == "Cantonese"


def test_setting_boolean_parsing(app_context):
    user = User(id=1, username="default", email=None)
    db.session.add(user)
    db.session.commit()

    Setting.set("auto_detect_qa", "true", data_type="bool", user_id=1)
    assert Setting.get("auto_detect_qa", user_id=1) is True
