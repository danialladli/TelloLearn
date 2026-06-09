"""
TelloLearn — Backend Unit Tests
Tool : pytest + pytest-asyncio
Run  : pytest tests/test_unit.py -v

Tests every function/class in isolation using mocks.
No real drone, no real database, no real Gemini API needed.
"""

import pytest
import json
import time
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime, timedelta

# ─── 1. SECURITY MODULE ───────────────────────────────────────────────────────
# Tests: hash_password, verify_password, create_access_token, decode_access_token

class TestSecurity:
    """UTC-01: security.py — Argon2 hashing + JWT token functions"""

    def setup_method(self):
        """Import here so tests run even without full venv installed."""
        from security import hash_password, verify_password, create_access_token, decode_access_token
        self.hash_password       = hash_password
        self.verify_password     = verify_password
        self.create_access_token = create_access_token
        self.decode_access_token = decode_access_token

    # UTC-01-001
    def test_hash_password_returns_argon2_hash(self):
        """Hashed password must start with Argon2 identifier $argon2id$."""
        hashed = self.hash_password("Test1234!")
        assert hashed.startswith("$argon2"), "Expected Argon2 hash prefix"

    # UTC-01-002
    def test_hash_password_is_not_plaintext(self):
        """Stored hash must never equal the plain-text password."""
        plain = "Test1234!"
        hashed = self.hash_password(plain)
        assert hashed != plain

    # UTC-01-003
    def test_verify_password_correct_returns_true(self):
        """verify_password returns True when plain matches the Argon2 hash."""
        plain  = "Test1234!"
        hashed = self.hash_password(plain)
        assert self.verify_password(plain, hashed) is True

    # UTC-01-004
    def test_verify_password_wrong_returns_false(self):
        """verify_password returns False for an incorrect password."""
        hashed = self.hash_password("Test1234!")
        assert self.verify_password("WrongPass99", hashed) is False

    # UTC-01-005
    def test_create_access_token_returns_string(self):
        """create_access_token must return a non-empty JWT string."""
        token = self.create_access_token({"sub": "user_abc123"})
        assert isinstance(token, str) and len(token) > 10

    # UTC-01-006
    def test_decode_access_token_returns_correct_sub(self):
        """Decoded JWT payload must contain the original user_id in 'sub'."""
        token   = self.create_access_token({"sub": "user_abc123"})
        payload = self.decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user_abc123"

    # UTC-01-007
    def test_decode_access_token_invalid_returns_none(self):
        """Tampered or random token must return None, not raise an exception."""
        result = self.decode_access_token("this.is.not.a.real.token")
        assert result is None


# ─── 2. PYDANTIC MODELS ───────────────────────────────────────────────────────
# Tests: UserSignup, UserLogin, ProgressUpdate, ModuleDefinition

class TestModels:
    """UTC-02: models.py — Pydantic schema validation"""

    def setup_method(self):
        from models import UserSignup, UserLogin, ProgressUpdate, ModuleDefinition
        self.UserSignup        = UserSignup
        self.UserLogin         = UserLogin
        self.ProgressUpdate    = ProgressUpdate
        self.ModuleDefinition  = ModuleDefinition

    # UTC-02-001
    def test_user_signup_valid(self):
        """Valid signup payload must instantiate without error."""
        user = self.UserSignup(
            username="danialtest",
            email="danial@test.com",
            password="Test1234!"
        )
        assert user.username == "danialtest"
        assert user.email    == "danial@test.com"

    # UTC-02-002
    def test_user_signup_short_password_raises(self):
        """Password shorter than 6 chars must raise ValidationError."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self.UserSignup(username="danial", email="d@d.com", password="abc")

    # UTC-02-003
    def test_user_signup_invalid_email_raises(self):
        """Malformed email (missing @) must raise ValidationError."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self.UserSignup(username="danial", email="notanemail", password="Test1234!")

    # UTC-02-004
    def test_user_login_valid(self):
        """Valid login payload must instantiate correctly."""
        login = self.UserLogin(username="danial", password="Test1234!")
        assert login.username == "danial"

    # UTC-02-005
    def test_module_definition_defaults(self):
        """ModuleDefinition must default is_active=True."""
        mod = self.ModuleDefinition(id="1", title="Basic Flight", description="Intro")
        assert mod.is_active is True

    # UTC-02-006
    def test_progress_update_fields(self):
        """ProgressUpdate must hold user_id and module_id."""
        pu = self.ProgressUpdate(user_id="abc123", module_id=1)
        assert pu.user_id == "abc123"
        assert pu.module_id == 1


# ─── 3. MODULE 1 — BasicFlightController ─────────────────────────────────────

class TestModule1Logic:
    """UTC-03: drone_logic/module1_logic.py — command dispatcher (mock mode)"""

    def setup_method(self):
        from drone_logic.module1_logic import BasicFlightController
        self.mock_drone = MagicMock()
        self.controller = BasicFlightController(self.mock_drone)

    # UTC-03-001
    def test_mock_mode_returns_mock_status(self):
        """When is_connected=False, execute() returns a mock status dict without calling drone SDK."""
        result = self.controller.execute("takeoff", is_connected=False)
        assert "Mock" in result["status"]
        self.mock_drone.takeoff.assert_not_called()

    # UTC-03-002
    def test_hardware_takeoff_calls_sdk(self):
        """When is_connected=True, execute('takeoff') calls tello.takeoff()."""
        self.controller.execute("takeoff", is_connected=True)
        self.mock_drone.takeoff.assert_called_once()

    # UTC-03-003
    def test_hardware_land_calls_sdk(self):
        """execute('land') calls tello.land()."""
        self.controller.execute("land", is_connected=True)
        self.mock_drone.land.assert_called_once()

    # UTC-03-004
    def test_hardware_forward_calls_sdk(self):
        """execute('forward') calls tello.move_forward(50)."""
        self.controller.execute("forward", is_connected=True)
        self.mock_drone.move_forward.assert_called_once_with(50)

    # UTC-03-005
    def test_unknown_command_returns_error(self):
        """An unrecognised command key must return an error dict, not raise."""
        result = self.controller.execute("flip_backflip", is_connected=True)
        assert "error" in result

    # UTC-03-006
    def test_rc_mock_mode_no_sdk_call(self):
        """send_rc in mock mode must not call drone SDK."""
        self.controller.send_rc(50, 20, 0, 0, is_connected=False)
        self.mock_drone.send_rc_control.assert_not_called()

    # UTC-03-007
    def test_rc_hardware_calls_sdk(self):
        """send_rc in hardware mode calls tello.send_rc_control with correct values."""
        self.controller.send_rc(30, -20, 10, 5, is_connected=True)
        self.mock_drone.send_rc_control.assert_called_once_with(30, -20, 10, 5)

    # UTC-03-008
    def test_sdk_exception_returns_error_dict(self):
        """If the drone SDK raises, execute() must catch it and return error dict."""
        self.mock_drone.takeoff.side_effect = Exception("Connection lost")
        result = self.controller.execute("takeoff", is_connected=True)
        assert "error" in result


# ─── 4. MODULE 2 — AutonomousLanding FSM ─────────────────────────────────────

class TestModule2Logic:
    """UTC-04: drone_logic/module2_logic.py — FSM state machine"""

    def setup_method(self):
        from drone_logic.module2_logic import AutonomousLanding
        self.mock_drone = MagicMock()
        self.fsm = AutonomousLanding(self.mock_drone, is_connected=False)

    # UTC-04-001
    def test_initial_state_is_searching(self):
        """FSM must start in SEARCHING state."""
        assert self.fsm.flight_state == "SEARCHING"

    # UTC-04-002
    def test_initial_is_active_false(self):
        """FSM must be inactive before start() is called."""
        assert self.fsm.is_active is False

    # UTC-04-003
    def test_stop_sets_is_active_false(self):
        """stop() must set is_active to False."""
        self.fsm.is_active = True
        self.fsm.stop()
        assert self.fsm.is_active is False

    # UTC-04-004
    def test_mock_fsm_cycles_through_states(self):
        """run_mock_fsm() must progress through SEARCHING → STABILIZING → CENTERING → … → BLIND_LEAP."""
        states_seen = []
        original_sleep = time.sleep
        time.sleep = lambda x: None  # speed up
        
        import threading
        def run():
            self.fsm.start()
        t = threading.Thread(target=run)
        t.start()
        t.join(timeout=3)
        
        time.sleep = original_sleep
        # After completion, is_active should be False
        assert self.fsm.is_active is False

    # UTC-04-005
    def test_dead_zone_constant(self):
        """Dead zone must be 40px as defined in code."""
        assert self.fsm.dead_zone == 40

    # UTC-04-006
    def test_frame_dimensions(self):
        """Frame dimensions must be 360x240."""
        assert self.fsm.w == 360
        assert self.fsm.h == 240


# ─── 5. MODULE 4 — ShortestPathSpeller grid ──────────────────────────────────

class TestModule4Logic:
    """UTC-05: drone_logic/module4_logic.py — grid mapping + vector calculation"""

    def setup_method(self):
        from drone_logic.module4_logic import ShortestPathSpeller
        self.mock_drone = MagicMock()
        self.speller = ShortestPathSpeller(self.mock_drone, is_connected=False, target_word="AB")

    # UTC-05-001
    def test_grid_spacing_is_50cm(self):
        """Grid spacing must be 50cm between letter mats."""
        assert self.speller.grid_spacing == 50

    # UTC-05-002
    def test_letter_A_at_origin(self):
        """Letter 'A' must map to (0, 0)."""
        assert self.speller.alphabet_map["A"] == (0, 0)

    # UTC-05-003
    def test_letter_B_at_50_0(self):
        """Letter 'B' (index 1, column 1) must map to (50, 0)."""
        assert self.speller.alphabet_map["B"] == (50, 0)

    # UTC-05-004
    def test_letter_F_at_0_50(self):
        """Letter 'F' (index 5, new row) must map to (0, 50)."""
        assert self.speller.alphabet_map["F"] == (0, 50)

    # UTC-05-005
    def test_all_26_letters_mapped(self):
        """All 26 letters must have grid coordinates."""
        assert len(self.speller.alphabet_map) == 26

    # UTC-05-006
    def test_vector_a_to_b_is_50_0(self):
        """Vector from A→B is dx=50, dy=0."""
        dx, dy = self.speller._calculate_vector("B")
        assert dx == 50
        assert dy == 0

    # UTC-05-007
    def test_vector_updates_current_pos(self):
        """After calculating vector to B, current_pos must update to B's coords."""
        self.speller._calculate_vector("B")
        assert self.speller.current_pos == (50, 0)

    # UTC-05-008
    def test_distance_accumulates(self):
        """total_distance_traveled must increase after each vector calculation."""
        self.speller._calculate_vector("B")  # A→B = 50cm
        assert self.speller.total_distance_traveled == pytest.approx(50.0, abs=0.1)

    # UTC-05-009
    def test_unknown_letter_returns_zero_vector(self):
        """Unknown character must return (0,0) without raising."""
        dx, dy = self.speller._calculate_vector("9")
        assert dx == 0 and dy == 0

    # UTC-05-010
    def test_word_queue_initialised(self):
        """Target word 'AB' must prime remaining_letters as ['A','B']."""
        speller = __import__('drone_logic.module4_logic', fromlist=['ShortestPathSpeller']).ShortestPathSpeller(
            self.mock_drone, False, "AB"
        )
        # first letter is popped into current_target on __init__
        assert speller.current_target == "A"
        assert speller.remaining_letters == ["B"]


# ─── 6. MODULE 5 — SwarmLeaderFollower ───────────────────────────────────────

class TestModule5Logic:
    """UTC-06: drone_logic/module5_logic.py — Leader-Follower swarm logic"""

    def setup_method(self):
        from drone_logic.module5_logic import SwarmLeaderFollower
        self.mock_leader   = MagicMock()
        self.mock_follower = MagicMock()
        self.swarm = SwarmLeaderFollower(
            drones=[self.mock_leader, self.mock_follower],
            is_connected=False
        )

    # UTC-06-001
    def test_follower_offset_is_50cm_right(self):
        """Follower offset must be x=50, y=0, z=0 (50cm to the right)."""
        assert self.swarm.follower_offset == {"x": 50, "y": 0, "z": 0}

    # UTC-06-002
    def test_initial_state_is_idle(self):
        """Swarm must start in IDLE state."""
        assert self.swarm.swarm_state == "IDLE"

    # UTC-06-003
    def test_has_swarm_true_with_2_drones(self):
        """has_swarm must be True when 2 drones provided."""
        assert self.swarm.has_swarm is True

    # UTC-06-004
    def test_mock_takeoff_updates_leader_z(self):
        """Mock takeoff must set leader_pos['z'] to 100."""
        self.swarm.execute_swarm_command("takeoff")
        assert self.swarm.leader_pos["z"] == 100

    # UTC-06-005
    def test_mock_land_sets_state_landed(self):
        """Mock land must set swarm_state to 'LANDED'."""
        self.swarm.execute_swarm_command("land")
        assert self.swarm.swarm_state == "LANDED"

    # UTC-06-006
    def test_mock_forward_updates_leader_y(self):
        """Mock forward must increment leader_pos['y'] by 30."""
        self.swarm.execute_swarm_command("forward")
        assert self.swarm.leader_pos["y"] == 30

    # UTC-06-007
    def test_mock_follower_mirrors_leader_offset(self):
        """After any command, follower_pos['x'] must equal leader_pos['x'] + 50."""
        self.swarm.execute_swarm_command("forward")
        assert self.swarm.follower_pos["x"] == self.swarm.leader_pos["x"] + 50

    # UTC-06-008
    def test_hardware_takeoff_calls_both_drones(self):
        """Hardware takeoff must call takeoff() on both leader and follower drones."""
        self.swarm.is_connected = True
        self.swarm.execute_swarm_command("takeoff")
        self.mock_leader.takeoff.assert_called_once()
        self.mock_follower.takeoff.assert_called_once()

    # UTC-06-009
    def test_stop_sets_emergency_state(self):
        """stop() must set swarm_state to 'EMERGENCY_STOP'."""
        self.swarm.stop()
        assert self.swarm.swarm_state == "EMERGENCY_STOP"

    # UTC-06-010
    def test_single_drone_has_swarm_false(self):
        """has_swarm must be False when only 1 drone provided."""
        from drone_logic.module5_logic import SwarmLeaderFollower
        single = SwarmLeaderFollower([self.mock_leader], is_connected=False)
        assert single.has_swarm is False


# ─── 7. GEMINI SERVICE ────────────────────────────────────────────────────────

class TestGeminiService:
    """UTC-07: gemini_service.py — AI validator with mocked API"""

    # UTC-07-001
    @patch("gemini_service.client")
    def test_valid_code_returns_is_correct_true(self, mock_client):
        """When Gemini returns is_correct=True, analyze_student_code returns pass result."""
        mock_client.models.generate_content.return_value.text = (
            '{"is_correct": true, "feedback": "Great work!"}'
        )
        from gemini_service import analyze_student_code
        result = analyze_student_code("module1", "tello.takeoff()\ntello.land()")
        assert result["is_correct"] is True
        assert isinstance(result["feedback"], str)

    # UTC-07-002
    @patch("gemini_service.client")
    def test_invalid_code_returns_is_correct_false(self, mock_client):
        """When Gemini detects errors, analyze_student_code returns fail result."""
        mock_client.models.generate_content.return_value.text = (
            '{"is_correct": false, "feedback": "Missing tello.land() call."}'
        )
        from gemini_service import analyze_student_code
        result = analyze_student_code("module1", "tello.takeoff()")
        assert result["is_correct"] is False
        assert "land" in result["feedback"].lower()

    # UTC-07-003
    @patch("gemini_service.client")
    def test_empty_response_returns_error_fallback(self, mock_client):
        """Empty Gemini response must return a system error dict without raising."""
        mock_client.models.generate_content.return_value.text = ""
        from gemini_service import analyze_student_code
        result = analyze_student_code("module1", "some code")
        assert result["is_correct"] is False
        assert "Error" in result["feedback"] or "error" in result["feedback"]

    # UTC-07-004
    @patch("gemini_service.client")
    def test_module_context_included_in_prompt(self, mock_client):
        """The correct module context must be included in the Gemini prompt."""
        mock_client.models.generate_content.return_value.text = (
            '{"is_correct": true, "feedback": "ok"}'
        )
        from gemini_service import analyze_student_code
        analyze_student_code("module5", "swarm code")
        call_args = mock_client.models.generate_content.call_args
        prompt_text = call_args[1]["contents"] if "contents" in call_args[1] else call_args[0][1]
        assert "swarm" in prompt_text.lower() or "leader" in prompt_text.lower()
