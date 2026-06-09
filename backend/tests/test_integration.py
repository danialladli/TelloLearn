"""
TelloLearn — Backend Integration Tests
Tool  : pytest + pytest-asyncio + httpx (FastAPI TestClient)
Run   : pytest tests/test_integration.py -v

Tests that two or more components work together correctly.
MongoDB and Gemini are mocked so no live services are needed.
"""

import pytest
import json
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient

# ─── Fixture: patch all external I/O before importing the app ────────────────
@pytest.fixture(scope="module")
def client():
    """
    Provides a FastAPI TestClient with:
      - MongoDB Motor client replaced by an async mock
      - TelloManager.connect() neutered (no real UDP)
      - Gemini client mocked
    """
    with patch("database.AsyncIOMotorClient") as mock_motor, \
         patch("tello_manager.TelloManager.connect"), \
         patch("gemini_service.client") as mock_gemini:

        # Wire up a fake in-memory user store
        fake_user = {
            "_id": "507f1f77bcf86cd799439011",
            "username": "danialtest",
            "email":    "danial@test.com",
            "password": None,   # filled during signup test
            "role":     "learner",
            "modules": {
                "1": {"status": "active",    "score": 0},
                "2": {"status": "locked",    "score": 0},
                "3": {"status": "locked",    "score": 0},
                "4": {"status": "locked",    "score": 0},
                "5": {"status": "locked",    "score": 0},
            }
        }
        fake_module = {
            "_id":         "507f1f77bcf86cd799439012",
            "id":          "1",
            "title":       "Basic Flight Operations",
            "description": "Intro to flight",
            "is_active":   True,
        }
        fake_activity = {
            "_id":      "507f1f77bcf86cd799439013",
            "user_id":  "507f1f77bcf86cd799439011",
            "action":   "MODULE_STARTED",
            "details":  "Module 1",
        }

        # Build async mock collections
        user_col  = AsyncMock()
        mod_col   = AsyncMock()
        act_col   = AsyncMock()

        user_col.find_one  = AsyncMock(return_value=fake_user)
        user_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="new_id"))
        user_col.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
        user_col.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
        user_col.find       = MagicMock(return_value=AsyncMock(
            to_list=AsyncMock(return_value=[fake_user])
        ))

        mod_col.find_one   = AsyncMock(return_value=fake_module)
        mod_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="new_mod_id"))
        mod_col.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
        mod_col.find       = MagicMock(return_value=AsyncMock(
            to_list=AsyncMock(return_value=[fake_module])
        ))

        act_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="new_act_id"))
        act_col.find       = MagicMock(return_value=AsyncMock(
            to_list=AsyncMock(return_value=[fake_activity])
        ))

        import database
        database.get_user_collection     = lambda: user_col
        database.get_module_collection   = lambda: mod_col
        database.get_activity_collection = lambda: act_col

        # Default Gemini mock — pass
        mock_gemini.models.generate_content.return_value.text = (
            '{"is_correct": true, "feedback": "Well done!"}'
        )

        from main import app
        with TestClient(app) as c:
            yield c, user_col, mod_col, act_col, mock_gemini, fake_user


# ─── Helper: get a valid JWT token ──────────────────────────────────────────
@pytest.fixture(scope="module")
def auth_token(client):
    """Returns a real JWT token by calling the actual create_access_token function."""
    from security import create_access_token, hash_password
    token = create_access_token({"sub": "507f1f77bcf86cd799439011"})
    return token


# ═══════════════════════════════════════════════════════════════════════════════
# IT-01: Web App ↔ FastAPI — Auth endpoints
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuthIntegration:
    """IT-01: /api/auth/* endpoints — signup, login, forgot-password, reset-password"""

    def test_it01_001_signup_new_user(self, client):
        """POST /api/auth/signup stores user and returns 200."""
        c, user_col, *_ = client
        # Make find_one return None so user doesn't "already exist"
        user_col.find_one = AsyncMock(return_value=None)

        resp = c.post("/api/auth/signup", json={
            "username": "newuser",
            "email":    "new@test.com",
            "password": "NewPass123!"
        })
        assert resp.status_code == 200
        user_col.insert_one.assert_called_once()

    def test_it01_002_signup_duplicate_email_rejected(self, client):
        """POST /api/auth/signup with existing email returns 400."""
        c, user_col, *_ = client
        from security import hash_password
        fake_existing = {
            "username": "existinguser",
            "email":    "existing@test.com",
            "password": hash_password("Test1234!"),
        }
        user_col.find_one = AsyncMock(return_value=fake_existing)

        resp = c.post("/api/auth/signup", json={
            "username": "dup",
            "email":    "existing@test.com",
            "password": "Test1234!"
        })
        assert resp.status_code in (400, 409)

    def test_it01_003_login_correct_credentials_returns_token(self, client):
        """POST /api/auth/login with correct password returns a JWT token."""
        c, user_col, *_ = client
        from security import hash_password
        user_col.find_one = AsyncMock(return_value={
            "_id":      "507f1f77bcf86cd799439011",
            "username": "danialtest",
            "email":    "danial@test.com",
            "password": hash_password("Test1234!"),
            "role":     "learner",
            "modules":  {}
        })

        resp = c.post("/api/auth/login", json={
            "username": "danialtest",
            "password": "Test1234!"
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "token" in body or "access_token" in body

    def test_it01_004_login_wrong_password_returns_401(self, client):
        """POST /api/auth/login with wrong password returns 401."""
        c, user_col, *_ = client
        from security import hash_password
        user_col.find_one = AsyncMock(return_value={
            "_id":      "507f1f77bcf86cd799439011",
            "username": "danialtest",
            "password": hash_password("Test1234!"),
            "role":     "learner",
            "modules":  {}
        })

        resp = c.post("/api/auth/login", json={
            "username": "danialtest",
            "password": "WrongPass99"
        })
        assert resp.status_code == 401

    def test_it01_005_forgot_password_registered_email(self, client):
        """POST /api/auth/forgot-password for registered email returns 200."""
        c, user_col, *_ = client
        user_col.find_one = AsyncMock(return_value={
            "_id":   "507f1f77bcf86cd799439011",
            "email": "danial@test.com"
        })

        resp = c.post("/api/auth/forgot-password", json={"email": "danial@test.com"})
        assert resp.status_code == 200

    def test_it01_006_forgot_password_unknown_email_returns_404(self, client):
        """POST /api/auth/forgot-password for unknown email returns 404."""
        c, user_col, *_ = client
        user_col.find_one = AsyncMock(return_value=None)

        resp = c.post("/api/auth/forgot-password", json={"email": "ghost@nowhere.com"})
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# IT-02: Web App ↔ Gemini GenAI — Code validation endpoint
# ═══════════════════════════════════════════════════════════════════════════════

class TestCodeValidationIntegration:
    """IT-02: POST /api/validate_code — code → Gemini → response"""

    def test_it02_001_valid_code_returns_success(self, client):
        """Valid code: Gemini returns is_correct=True → API returns success."""
        c, *_, mock_gemini, _ = client
        mock_gemini.models.generate_content.return_value.text = (
            '{"is_correct": true, "feedback": "Perfect! Your code correctly calls takeoff and land."}'
        )

        resp = c.post("/api/validate_code", json={
            "user_id":   "507f1f77bcf86cd799439011",
            "module_id": "module1",
            "code":      "from djitellopy import Tello\ntello=Tello()\ntello.takeoff()\ntello.land()"
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_correct"] is True

    def test_it02_002_invalid_code_returns_failure_with_feedback(self, client):
        """Invalid code: Gemini returns is_correct=False → API returns fail + feedback."""
        c, *_, mock_gemini, _ = client
        mock_gemini.models.generate_content.return_value.text = (
            '{"is_correct": false, "feedback": "Missing tello.land() call. Always land after takeoff."}'
        )

        resp = c.post("/api/validate_code", json={
            "user_id":   "507f1f77bcf86cd799439011",
            "module_id": "module1",
            "code":      "tello.takeoff()"
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_correct"] is False
        assert len(body["feedback"]) > 0

    def test_it02_003_validate_code_calls_gemini_api(self, client):
        """Submitting code must trigger exactly one Gemini API call."""
        c, *_, mock_gemini, _ = client
        mock_gemini.models.generate_content.reset_mock()
        mock_gemini.models.generate_content.return_value.text = (
            '{"is_correct": true, "feedback": "ok"}'
        )

        c.post("/api/validate_code", json={
            "user_id":   "507f1f77bcf86cd799439011",
            "module_id": "module1",
            "code":      "tello.takeoff()\ntello.land()"
        })
        mock_gemini.models.generate_content.assert_called_once()


# ═══════════════════════════════════════════════════════════════════════════════
# IT-03: Web App ↔ MongoDB — Module progress sync
# ═══════════════════════════════════════════════════════════════════════════════

class TestProgressIntegration:
    """IT-03: /api/update-progress + /api/user/sync — progress persistence"""

    def test_it03_001_update_progress_writes_to_db(self, client, auth_token):
        """POST /api/update-progress triggers a MongoDB update_one call."""
        c, user_col, *_ = client
        user_col.update_one.reset_mock()
        user_col.find_one = AsyncMock(return_value={
            "_id":     "507f1f77bcf86cd799439011",
            "modules": {"1": {"status": "active", "score": 0}}
        })

        resp = c.post("/api/update-progress", json={
            "user_id":   "507f1f77bcf86cd799439011",
            "module_id": 1
        }, headers={"Authorization": f"Bearer {auth_token}"})

        assert resp.status_code == 200
        user_col.update_one.assert_called()

    def test_it03_002_sync_returns_module_status(self, client, auth_token):
        """GET /api/user/sync returns the user document with module statuses."""
        c, user_col, *_ = client
        user_col.find_one = AsyncMock(return_value={
            "_id":      "507f1f77bcf86cd799439011",
            "username": "danialtest",
            "role":     "learner",
            "modules": {
                "1": {"status": "completed", "score": 100},
                "2": {"status": "locked",    "score": 0},
            }
        })

        resp = c.get("/api/user/sync",
                     headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200
        body = resp.json()
        # Response must include module progress data
        assert "modules" in body or "user" in body

    def test_it03_003_sync_without_token_returns_401(self, client):
        """GET /api/user/sync without Authorization header returns 401."""
        c = client[0]
        resp = c.get("/api/user/sync")
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# IT-04: Mobile App ↔ FastAPI — Drone commands (mock mode)
# ═══════════════════════════════════════════════════════════════════════════════

class TestDroneCommandsIntegration:
    """IT-04: /api/module1/* endpoints — command flow through TelloManager"""

    def test_it04_001_single_command_takeoff(self, client, auth_token):
        """POST /api/module1/takeoff returns status ok (mock mode)."""
        c = client[0]
        resp = c.post("/api/module1/takeoff",
                      headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200
        body = resp.json()
        # In mock mode, status contains "Mock" or "Executed"
        assert "status" in body

    def test_it04_002_sequence_endpoint(self, client, auth_token):
        """POST /api/module1/sequence with valid command array returns 200."""
        c = client[0]
        resp = c.post("/api/module1/sequence",
                      json={"commands": ["takeoff", "forward", "land"]},
                      headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200

    def test_it04_003_rc_command_accepted(self, client, auth_token):
        """POST /api/module1/rc with joystick values returns 200."""
        c = client[0]
        resp = c.post("/api/module1/rc",
                      json={"left_right": 30, "forward_backward": 20,
                            "up_down": 0, "yaw": 10},
                      headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200

    def test_it04_004_module2_start_triggers_fsm(self, client, auth_token):
        """POST /api/module2/start returns message confirming FSM initiated."""
        c = client[0]
        resp = c.post("/api/module2/start",
                      headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200
        body = resp.json()
        assert "message" in body or "status" in body

    def test_it04_005_module2_telemetry_returns_state(self, client, auth_token):
        """GET /api/module2/telemetry returns {status, state, pad_detected}."""
        c = client[0]
        resp = c.get("/api/module2/telemetry",
                     headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200
        body = resp.json()
        assert "state" in body
        assert "status" in body

    def test_it04_006_drone_status_endpoint(self, client):
        """GET /drone/status returns connection state."""
        c = client[0]
        resp = c.get("/drone/status")
        assert resp.status_code == 200

    def test_it04_007_module3_start_with_word(self, client, auth_token):
        """POST /api/module3/start with word payload returns 200."""
        c = client[0]
        resp = c.post("/api/module3/start",
                      json={"word": "CAT"},
                      headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200

    def test_it04_008_module4_start_with_word(self, client, auth_token):
        """POST /api/module4/start with word payload returns 200."""
        c = client[0]
        resp = c.post("/api/module4/start",
                      json={"word": "HI"},
                      headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# IT-05: Admin ↔ FastAPI ↔ MongoDB — Admin CRUD
# ═══════════════════════════════════════════════════════════════════════════════

class TestAdminIntegration:
    """IT-05: /api/admin/* — user and module management"""

    @pytest.fixture
    def admin_token(self):
        from security import create_access_token
        return create_access_token({"sub": "admin_user_id", "role": "admin"})

    def test_it05_001_list_users(self, client, admin_token):
        """GET /api/admin/users returns list of users."""
        c, user_col, *_ = client
        resp = c.get("/api/admin/users",
                     headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_it05_002_delete_user_calls_db(self, client, admin_token):
        """DELETE /api/admin/users/{id} triggers delete_one on db.User."""
        c, user_col, *_ = client
        user_col.delete_one.reset_mock()

        resp = c.delete("/api/admin/users/507f1f77bcf86cd799439011",
                        headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code in (200, 204)
        user_col.delete_one.assert_called_once()

    def test_it05_003_create_module(self, client, admin_token):
        """POST /api/admin/modules creates a new module entry."""
        c, _, mod_col, *_ = client
        mod_col.insert_one.reset_mock()

        resp = c.post("/api/admin/modules",
                      json={
                          "id":          "6",
                          "title":       "Advanced Navigation",
                          "description": "Path planning",
                          "is_active":   True
                      },
                      headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        mod_col.insert_one.assert_called_once()
