from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)

def test_health():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'

def test_ready_does_not_expose_secret():
    response = client.get('/ready')
    assert response.status_code == 200
    assert 'gemini_api_key' not in response.json()
