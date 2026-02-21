"""
Regression tests for /api/process and /api/process/status.
Uses a minimal app and does not call real OpenAI; tests route shape and error handling.
"""
import pytest
from flask import Flask

from backend.models import db, User
from backend.routes.api import api
from backend.config import UPLOAD_FOLDER, TRANSCRIPT_FOLDER
from backend.services import export


@pytest.fixture()
def client(tmp_path):
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'test.db'}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    transcript_dir = tmp_path / "transcripts"
    transcript_dir.mkdir()
    app.config["UPLOAD_FOLDER"] = str(upload_dir)
    db.init_app(app)

    with app.app_context():
        db.create_all()
        db.session.add(User(id=1, username="default", email=None))
        db.session.commit()
        export.set_transcript_folder(str(transcript_dir))

    app.register_blueprint(api)

    with app.test_client() as test_client:
        yield test_client

    with app.app_context():
        db.drop_all()


def test_process_no_file_returns_400(client):
    """POST /api/process without audio_file returns 400 and consistent error JSON."""
    response = client.post("/api/process", data={})
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert "file" in data["error"].lower() or "no file" in data["error"].lower()


def test_process_empty_filename_returns_400(client):
    """POST /api/process with empty filename returns 400."""
    response = client.post(
        "/api/process",
        data={"audio_file": (b"", "")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_process_status_unknown_job_returns_404(client):
    """GET /api/process/status/<job_id> for unknown job returns 404."""
    response = client.get("/api/process/status/unknown-job-id")
    assert response.status_code == 404
    data = response.get_json()
    assert data.get("status") == "not_found"
    assert "progress" in data


def test_health_returns_200(client):
    """GET /api/health returns 200 and status ok."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}
