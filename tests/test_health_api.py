from flask import Flask

from backend.routes.api import api


def test_health_endpoint():
    app = Flask(__name__)
    app.register_blueprint(api)

    with app.test_client() as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}
