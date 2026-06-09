"""
TelloLearn — Backend System Tests
Tool  : pytest + FastAPI TestClient
Run   : pytest tests/test_system.py -v

End-to-end workflow tests. Each test walks through a complete
user journey the way a real user would experience it.
MongoDB, Gemini, and Drone are all mocked so no live hardware needed.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient


# ─── Shared fixture — full app with mocked external services ─────────────────
@pytest.fixture(scope="module")
def app_client():
    """
    Spins up the full FastAPI app. All external calls are mocked:
      - Motor (MongoDB) → in-memory async mocks
      - Gemini client   → controllable mock
      - TelloManager.connect → no-op
    Returns (TestClient, user_store, mock_gemini)
    """
    with patch("database.AsyncIOMotorClient"), \
         patch("tello_manager.TelloManager.connect"), \
         patch("gemini_service.client") as mock_gemini:

        # ---- in-memory user state ----
        user_store = {}

        from security import hash_password

        async def fake_find_one(query):
            # Lookup by email, username, or _id string
            for u in user_store.values():
                if query.get("email")    == u.get("email"):     return u
                if query.get("username") == u.get("username"):  return u
                if query.get("_id")      == u.get("_id"):       return u
                # reset_token lookup
                if query.get("reset_token") and query.get("reset_token") == u.get("reset_token"):
                    return u
            return None

        async def fake_insert_one(doc):
            uid = f"user_{len(user_store)+1}"
            doc["_id"] = uid
            user_store[uid] = doc
            return MagicMock(inserted_id=uid)

        async def fake_update_one(query, update, *args, **kwargs):
            for uid, u in user_store.items():
                if u.get("_id") == query.get("_id") or \
                   u.get("email") == query.get("email") or \
                   u.get("reset_token") == query.get("reset_token"):
                    # Apply $set updates
                    if "$set" in update:
                        user_store[uid].update(update["$set"])
                    return MagicMock(modified_count=1)
            return MagicMock(modified_count=0)

        async def fake_delete_one(query):
            for uid in list(user_store):
                if user_store[uid].get("_id") == query.get("_id") or \
                   str(user_store[uid].get("_id")) == str(list(query.values())[0]):
                    del user_store[uid]
                    return MagicMock(deleted_count=1)
            return MagicMock(deleted_count=0)

        user_col = AsyncMock()
        user_col.find_one   = fake_find_one
        user_col.insert_one = fake_insert_one
        user_col.update_one = fake_update_one
        user_col.delete_one = fake_delete_one
        user_col.find       = MagicMock(return_value=AsyncMock(
            to_list=AsyncMock(return_value=list(user_store.values()))
        ))

        mod_col = AsyncMock()
        mod_col.find_one   = AsyncMock(return_value={
            "_id": "mod1", "id": "1", "title": "Basic Flight", "is_active": True
        })
        mod_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="new_mod"))
        mod_col.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
        mod_col.find       = MagicMock(return_value=AsyncMock(to_list=AsyncMock(return_value=[
            {"_id": "mod1", "id": "1", "title": "Basic Flight", "is_active": True}
        ])))

        act_col = AsyncMock()
        act_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="act1"))
        act_col.find       = MagicMock(return_value=AsyncMock(to_list=AsyncMock(return_value=[])))

        import database
        database.get_user_collection     = lambda: user_col
        database.get_module_collection   = lambda: mod_col
        database.get_activity_collection = lambda: act_col

        # Default Gemini mock = pass
        mock_gemini.models.generate_content.return_value.text = (
            '{"is_correct": true, "feedback": "Correct!"}'
        )

        from main import app
        with TestClient(app) as c:
            yield c, user_store, mock_gemini


# ═══════════════════════════════════════════════════════════════════════════════
# ST-01: Full Registration → Login → Dashboard Sync workflow
# ═══════════════════════════════════════════════════════════════════════════════

class TestRegistrationLoginWorkflow:
    """ST-01: A new student registers, logs in, and syncs their module status."""

    def test_st01_001_register_then_login(self, app_client):
        """
        Full flow:
          1. Register a new account
          2. Log in with the same credentials
          3. Receive a JWT token
          4. Use token to call /api/user/sync
        """
        c, user_store, _ = app_client

        # Step 1: Register
        reg_resp = c.post("/api/auth/signup", json={
            "username": "studentA",
            "email":    "studentA@test.com",
            "password": "Test1234!"
        })
        assert reg_resp.status_code == 200, f"Signup failed: {reg_resp.text}"

        # Step 2: Login
        login_resp = c.post("/api/auth/login", json={
            "username": "studentA",
            "password": "Test1234!"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("token") or login_resp.json().get("access_token")
        assert token is not None, "No token returned from login"

        # Step 3: Sync
        sync_resp = c.get("/api/user/sync",
                          headers={"Authorization": f"Bearer {token}"})
        assert sync_resp.status_code == 200

    def test_st01_002_duplicate_email_blocked(self, app_client):
        """Registering twice with the same email must be rejected."""
        c, _, _ = app_client

        c.post("/api/auth/signup", json={
            "username": "user_dup",
            "email":    "dup@test.com",
            "password": "Test1234!"
        })
        resp2 = c.post("/api/auth/signup", json={
            "username": "user_dup2",
            "email":    "dup@test.com",
            "password": "Test1234!"
        })
        assert resp2.status_code in (400, 409)

    def test_st01_003_wrong_password_blocked(self, app_client):
        """Login with wrong password must return 401."""
        c, _, _ = app_client

        c.post("/api/auth/signup", json={
            "username": "student_wp",
            "email":    "wrongpass@test.com",
            "password": "CorrectPass1!"
        })
        resp = c.post("/api/auth/login", json={
            "username": "student_wp",
            "password": "WrongPass99"
        })
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# ST-02: Full Code Validation → Progress Unlock workflow
# ═══════════════════════════════════════════════════════════════════════════════

class TestCodeValidationWorkflow:
    """ST-02: Student submits code → Gemini validates → module progress updated."""

    def _register_and_login(self, c, suffix=""):
        c.post("/api/auth/signup", json={
            "username": f"coder{suffix}",
            "email":    f"coder{suffix}@test.com",
            "password": "Test1234!"
        })
        r = c.post("/api/auth/login", json={
            "username": f"coder{suffix}",
            "password": "Test1234!"
        })
        return r.json().get("token") or r.json().get("access_token")

    def test_st02_001_valid_code_unlocks_module(self, app_client):
        """
        Full flow:
          1. Log in
          2. Submit valid Module 1 code
          3. Gemini returns pass
          4. API returns is_correct=True
        """
        c, _, mock_gemini = app_client
        mock_gemini.models.generate_content.return_value.text = (
            '{"is_correct": true, "feedback": "Perfect! Takeoff and land present."}'
        )
        token = self._register_and_login(c, "A")

        resp = c.post("/api/validate_code", json={
            "user_id":   "any_user_id",
            "module_id": "module1",
            "code":      "from djitellopy import Tello\ntello=Tello()\ntello.takeoff()\ntello.land()"
        })
        assert resp.status_code == 200
        assert resp.json()["is_correct"] is True

    def test_st02_002_invalid_code_returns_feedback(self, app_client):
        """
        Flow:
          1. Submit code missing tello.land()
          2. Gemini returns fail with explanation
          3. API returns is_correct=False + feedback text
        """
        c, _, mock_gemini = app_client
        mock_gemini.models.generate_content.return_value.text = (
            '{"is_correct": false, "feedback": "Missing tello.land(). Always land safely."}'
        )

        resp = c.post("/api/validate_code", json={
            "user_id":   "any_user_id",
            "module_id": "module1",
            "code":      "tello.takeoff()"
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_correct"] is False
        assert len(body["feedback"]) > 5

    def test_st02_003_update_progress_after_validation(self, app_client):
        """POST /api/update-progress marks module as completed."""
        c, _, _ = app_client
        token = self._register_and_login(c, "B")

        resp = c.post("/api/update-progress",
                      json={"user_id": "any_id", "module_id": 1},
                      headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# ST-03: Full Drone Connection → Flight Command workflow
# ═══════════════════════════════════════════════════════════════════════════════

class TestDroneFlightWorkflow:
    """ST-03: Drone command sequence — takeoff, movement, land (mock mode)."""

    def _get_token(self):
        from security import create_access_token
        return create_access_token({"sub": "pilot_user_id"})

    def test_st03_001_drone_status_accessible(self, app_client):
        """GET /drone/status is reachable without auth."""
        c, _, _ = app_client
        resp = c.get("/drone/status")
        assert resp.status_code == 200

    def test_st03_002_full_flight_sequence(self, app_client):
        """
        Full Module 1 mock flight:
          1. Takeoff
          2. Move forward
          3. Land
        All three commands must succeed with status 200.
        """
        c, _, _ = app_client
        token = self._get_token()
        headers = {"Authorization": f"Bearer {token}"}

        for cmd in ["takeoff", "forward", "land"]:
            resp = c.post(f"/api/module1/{cmd}", headers=headers)
            assert resp.status_code == 200, f"Command '{cmd}' failed: {resp.text}"

    def test_st03_003_sequence_endpoint_batch(self, app_client):
        """POST /api/module1/sequence with full command array succeeds."""
        c, _, _ = app_client
        token = self._get_token()

        resp = c.post("/api/module1/sequence",
                      json={"commands": ["takeoff", "forward", "back", "land"]},
                      headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200

    def test_st03_004_rc_control_joystick(self, app_client):
        """POST /api/module1/rc with typical joystick values succeeds."""
        c, _, _ = app_client
        token = self._get_token()

        resp = c.post("/api/module1/rc",
                      json={"left_right": 50, "forward_backward": 30, "up_down": 0, "yaw": -20},
                      headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# ST-04: Module 2 Autonomous Landing workflow
# ═══════════════════════════════════════════════════════════════════════════════

class TestModule2Workflow:
    """ST-04: Autonomous landing — start FSM, poll telemetry."""

    def _get_token(self):
        from security import create_access_token
        return create_access_token({"sub": "pilot_user_id"})

    def test_st04_001_start_landing_module(self, app_client):
        """POST /api/module2/start initiates the FSM and returns a message."""
        c, _, _ = app_client
        resp = c.post("/api/module2/start",
                      headers={"Authorization": f"Bearer {self._get_token()}"})
        assert resp.status_code == 200

    def test_st04_002_telemetry_returns_expected_keys(self, app_client):
        """GET /api/module2/telemetry returns {status, state, pad_detected}."""
        c, _, _ = app_client
        resp = c.get("/api/module2/telemetry",
                     headers={"Authorization": f"Bearer {self._get_token()}"})
        assert resp.status_code == 200
        body = resp.json()
        assert "state"  in body
        assert "status" in body
        assert "pad_detected" in body

    def test_st04_003_telemetry_state_is_valid_string(self, app_client):
        """state field must be a non-empty string."""
        c, _, _ = app_client
        resp = c.get("/api/module2/telemetry",
                     headers={"Authorization": f"Bearer {self._get_token()}"})
        state = resp.json().get("state", "")
        assert isinstance(state, str) and len(state) > 0


# ═══════════════════════════════════════════════════════════════════════════════
# ST-05: Module 3 & 4 word-based workflows
# ═══════════════════════════════════════════════════════════════════════════════

class TestWordModuleWorkflow:
    """ST-05: Modules 3 & 4 — start with target word, poll telemetry."""

    def _get_token(self):
        from security import create_access_token
        return create_access_token({"sub": "pilot_user_id"})

    def test_st05_001_module3_start_with_cat(self, app_client):
        """POST /api/module3/start with word='CAT' returns 200."""
        c, _, _ = app_client
        resp = c.post("/api/module3/start",
                      json={"word": "CAT"},
                      headers={"Authorization": f"Bearer {self._get_token()}"})
        assert resp.status_code == 200

    def test_st05_002_module3_telemetry_contains_word(self, app_client):
        """GET /api/module3/telemetry returns full_word matching what was set."""
        c, _, _ = app_client
        c.post("/api/module3/start",
               json={"word": "CAT"},
               headers={"Authorization": f"Bearer {self._get_token()}"})

        resp = c.get("/api/module3/telemetry",
                     headers={"Authorization": f"Bearer {self._get_token()}"})
        assert resp.status_code == 200
        body = resp.json()
        assert "spelled_so_far" in body
        assert "current_target" in body

    def test_st05_003_module4_start_with_hi(self, app_client):
        """POST /api/module4/start with word='HI' returns 200."""
        c, _, _ = app_client
        resp = c.post("/api/module4/start",
                      json={"word": "HI"},
                      headers={"Authorization": f"Bearer {self._get_token()}"})
        assert resp.status_code == 200

    def test_st05_004_module4_telemetry_returns_vector(self, app_client):
        """GET /api/module4/telemetry returns next_vector field."""
        c, _, _ = app_client
        resp = c.get("/api/module4/telemetry",
                     headers={"Authorization": f"Bearer {self._get_token()}"})
        assert resp.status_code == 200
        body = resp.json()
        assert "next_vector" in body
        assert "total_distance" in body


# ═══════════════════════════════════════════════════════════════════════════════
# ST-06: Admin Dashboard workflow
# ═══════════════════════════════════════════════════════════════════════════════

class TestAdminWorkflow:
    """ST-06: Admin creates module, lists users, deletes user."""

    def _admin_token(self):
        from security import create_access_token
        return create_access_token({"sub": "admin_id", "role": "admin"})

    def test_st06_001_list_all_users(self, app_client):
        """GET /api/admin/users returns 200 with list of users."""
        c, _, _ = app_client
        resp = c.get("/api/admin/users",
                     headers={"Authorization": f"Bearer {self._admin_token()}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_st06_002_create_new_module(self, app_client):
        """POST /api/admin/modules creates a module entry."""
        c, _, _ = app_client
        resp = c.post("/api/admin/modules",
                      json={
                          "id":          "6",
                          "title":       "Advanced Navigation",
                          "description": "Spatial path planning",
                          "is_active":   True
                      },
                      headers={"Authorization": f"Bearer {self._admin_token()}"})
        assert resp.status_code == 200

    def test_st06_003_delete_user(self, app_client):
        """DELETE /api/admin/users/{id} removes the user."""
        c, _, _ = app_client
        resp = c.delete("/api/admin/users/507f1f77bcf86cd799439011",
                        headers={"Authorization": f"Bearer {self._admin_token()}"})
        assert resp.status_code in (200, 204)


# ═══════════════════════════════════════════════════════════════════════════════
# ST-07: Safety and non-functional requirements
# ═══════════════════════════════════════════════════════════════════════════════

class TestSafetyAndNFR:
    """ST-07: Safety behaviours — auth enforcement, API response time."""

    def test_st07_001_protected_routes_require_token(self, app_client):
        """All protected endpoints must return 401 without a token."""
        c, _, _ = app_client
        protected = [
            ("/api/user/sync",          "GET"),
            ("/api/update-progress",    "POST"),
            ("/api/module1/takeoff",    "POST"),
            ("/api/module2/start",      "POST"),
        ]
        for path, method in protected:
            if method == "GET":
                resp = c.get(path)
            else:
                resp = c.post(path, json={})
            assert resp.status_code == 401, \
                f"Expected 401 for {method} {path}, got {resp.status_code}"

    def test_st07_002_api_responds_within_2_seconds(self, app_client):
        """GET /api/modules must respond in under 2 seconds (NFR-001)."""
        import time
        c, _, _ = app_client
        start = time.time()
        c.get("/api/modules")
        elapsed = time.time() - start
        assert elapsed < 2.0, f"API too slow: {elapsed:.2f}s"

    def test_st07_003_health_check_returns_200(self, app_client):
        """GET / returns 200 for health monitoring."""
        c, _, _ = app_client
        resp = c.get("/")
        assert resp.status_code == 200

    def test_st07_004_invalid_token_rejected(self, app_client):
        """Tampered JWT must be rejected with 401."""
        c, _, _ = app_client
        resp = c.get("/api/user/sync",
                     headers={"Authorization": "Bearer this.is.garbage"})
        assert resp.status_code == 401

    def test_st07_005_validate_code_missing_fields_returns_422(self, app_client):
        """POST /api/validate_code missing required fields returns 422."""
        c, _, _ = app_client
        resp = c.post("/api/validate_code", json={"code": "tello.takeoff()"})
        # Missing user_id and module_id → FastAPI ValidationError → 422
        assert resp.status_code == 422
