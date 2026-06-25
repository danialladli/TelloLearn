import cv2
import logging
import threading
import time
from djitellopy import Tello, tello

logger = logging.getLogger(__name__)

from drone_logic.module1_logic import BasicFlightController
from drone_logic.module2_logic import AutonomousLanding
from drone_logic.module3_logic import AlphabetHovering
from drone_logic.module4_logic import ShortestPathSpeller
from drone_logic.module5_logic import SwarmRoutine

DRONE_1_IP = "192.168.10.1"   # Tello AP mode default IP
DRONE_2_IP = "172.20.10.4"   # replace with actual IP from arp sweep

SWARM_MODE = False              # ← flip this to True only for Module 5

class TelloManager:
    def __init__(self):
        # Tello() is NOT created here — it binds a UDP socket on construction.
        # Doing it at import time means a stale process holding the port crashes
        # the entire backend before it can serve a single request (e.g. login).
        # All drone objects are created lazily inside connect().
        self.drone = None
        self.drone_follower = None
        self.is_connected = False
        self.flight_controller = None
        self.active_module = None
        self.swarm_controller = None

    def connect(self):
        if not self.is_connected:
            # Leader drone — always connects
            self.drone = Tello(host=DRONE_1_IP)
            self.flight_controller = BasicFlightController(self.drone)
            self.swarm_controller  = None
            self.drone_follower    = None   # default to None

            logger.info("Connecting to Drone 1...")
            self.drone.connect()
            self.drone.streamon()
            logger.info(f"Drone 1 battery: {self.drone.get_battery()}%")

            # Only connect follower if swarm mode is enabled
            if SWARM_MODE:
                try:
                    logger.info("Connecting to Drone 2...")
                    self.drone_follower = Tello(host=DRONE_2_IP)
                    self.drone_follower.connect()
                    logger.info(f"Drone 2 battery: {self.drone_follower.get_battery()}%")
                except Exception as e:
                    logger.warning(f"Drone 2 connection failed: {e}")
                    logger.warning("Continuing in single-drone mode")
                    self.drone_follower = None

            self.is_connected = True
            time.sleep(2)
            threading.Thread(
                target=self._health_monitor, daemon=True
            ).start()

    def _health_monitor(self):
        """Detect disconnection by watching whether the drone's state dict stops
        updating. Uses only the cached state — no network commands, no logs."""
        prev_key = None
        stale_rounds = 0

        while self.is_connected and self.drone is not None:
            time.sleep(3)

            # Don't check during active module flight
            if self.active_module and self.active_module.is_active:
                stale_rounds = 0
                prev_key = None
                continue

            try:
                s = self.drone.get_current_state()
                # IMU + baro values fluctuate every packet even when stationary.
                # If ALL four are identical for 4 consecutive checks (12 s),
                # the state thread has stopped receiving packets → drone offline.
                state_key = (s.get('agx'), s.get('agy'), s.get('agz'), s.get('baro'))

                if prev_key is not None and state_key == prev_key:
                    stale_rounds += 1
                    if stale_rounds >= 4:
                        logger.warning("⚠️ [DRONE] Connection Terminated")
                        self.is_connected = False
                        break
                else:
                    stale_rounds = 0

                prev_key = state_key
            except Exception:
                logger.warning("⚠️ [DRONE] Connection Terminated")
                self.is_connected = False
                break

    def get_video_stream(self):
        while True:
            if not self.is_connected or self.drone is None:
                time.sleep(0.1)
                continue

            frame = self.drone.get_frame_read().frame
            if frame is None or frame.size == 0:
                continue

            img = cv2.resize(frame, (360, 240))
            _, buffer = cv2.imencode('.jpg', img)
            frame_bytes = buffer.tobytes()

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    # --- MODULE 1: BASIC CONTROLS ---
    def execute_command(self, command: str):
        if not self.is_connected or self.flight_controller is None:
            return {"error": "Drone not connected"}

        if command == "land":
            if self.active_module and self.active_module.is_active:
                print("[MANAGER] Emergency override! Killing active module thread...")
                self.active_module.stop()

        return self.flight_controller.execute(command)

    def send_rc_control(self, lr: int, fb: int, ud: int, yaw: int):
        if not self.is_connected or self.flight_controller is None:
            return {"error": "Drone not connected"}
        return self.flight_controller.send_rc(lr, fb, ud, yaw)

    # --- MODULE 2: AUTONOMOUS LANDING ---
    def start_module_2(self):
        if not self.is_connected:
            return {"error": "Drone not connected"}
        if self.active_module and self.active_module.is_active:
            self.active_module.stop()

        module = AutonomousLanding(self.drone)
        self.active_module = module

        def _run():
            if self.drone is None:
                return
            module.start()

        threading.Thread(target=_run, daemon=True).start()
        return {"message": "Module 2 FSM Initiated in Background!"}

    def get_module_2_telemetry(self):
        if self.active_module and isinstance(self.active_module, AutonomousLanding) and self.active_module.is_active:
            pad_found = self.active_module.flight_state != "SEARCHING"
            return {
                "status": "active",
                "state": self.active_module.flight_state,
                "pad_detected": pad_found
            }
        return {
            "status": "inactive",
            "state": "OFFLINE",
            "pad_detected": False
        }

    # --- MODULE 3: ALPHABET RECOGNITION ---
    def start_module_3(self, target_word: str):
        if not self.is_connected:
            return {"error": "Drone not connected"}
        if self.active_module and self.active_module.is_active:
            self.active_module.stop()

        self.active_module = AlphabetHovering(self.drone, target_word)
        threading.Thread(target=self.active_module.start, daemon=True).start()
        return {"message": f"Module 3 FSM Initiated for word: {target_word}"}

    def get_module_3_telemetry(self):
        if self.active_module and isinstance(self.active_module, AlphabetHovering):
            m = self.active_module
            return {
                "status": "active" if m.is_active else "inactive",
                "state": m.flight_state,
                "full_word": m.full_word,
                "current_target": m.current_target,
                "spelled_count": len(m.spelled_letters),
                "letters_found": sorted(m.letter_map.keys()),
                "scan_complete": m.scan_complete,
                "distances": m.distances,
            }
        return {
            "status": "inactive",
            "state": "OFFLINE",
            "full_word": "",
            "current_target": "",
            "spelled_count": 0,
            "letters_found": [],
            "scan_complete": False,
            "distances": [],
        }

    # --- MODULE 4: SHORTEST PATH SPELLING ---
    def start_module_4(self, target_word: str):
        if not self.is_connected:
            return {"error": "Drone not connected"}
        if self.active_module and self.active_module.is_active:
            self.active_module.stop()

        self.active_module = ShortestPathSpeller(self.drone, target_word)
        threading.Thread(target=self.active_module.start, daemon=True).start()
        return {"message": f"Module 4 Pathfinding Initiated for word: {target_word}"}

    def get_module_4_telemetry(self):
        if self.active_module and isinstance(self.active_module, ShortestPathSpeller):
            return {
                "status": "active" if self.active_module.is_active else "inactive",
                "state": self.active_module.flight_state,
                "current_target": self.active_module.current_target,
                "spelled_so_far": "".join(self.active_module.spelled_letters),
                "total_distance": round(self.active_module.total_distance_traveled, 1),
                "next_vector": self.active_module.next_move_vector
            }
        return {
            "status": "inactive",
            "state": "OFFLINE",
            "current_target": "",
            "spelled_so_far": "",
            "total_distance": 0.0,
            "next_vector": [0, 0]
        }

    # --- MODULE 5: SWARM / ROUTINE PROGRAMMING ---
    def start_module_5(self):
        if not self.is_connected:
            return {"error": "Drone not connected"}
        if self.active_module and self.active_module.is_active:
            self.active_module.stop()

        drones = [self.drone]
        if self.drone_follower is not None:
            drones.append(self.drone_follower)

        routine = SwarmRoutine(drones)
        self.active_module    = routine
        self.swarm_controller = routine

        threading.Thread(target=routine.start, daemon=True).start()
        return {
            "status": "ok",
            "message": f"Module 5 routine started on {len(drones)} drone(s)",
            "drone_count": len(drones),
        }

    def stop_module_5(self):
        if self.active_module and isinstance(self.active_module, SwarmRoutine):
            self.active_module.stop()
        return {"message": "Module 5 stopped"}

    def get_module_5_telemetry(self):
        if self.active_module and isinstance(self.active_module, SwarmRoutine):
            m = self.active_module
            return {
                "status": "active" if m.is_active else "inactive",
                "state": m.swarm_state,
                "current_step": m.current_step,
                "current_step_name": m.current_step_name,
                "total_steps": m.total_steps,
                "drone_count": m.drone_count,
            }
        return {
            "status": "inactive",
            "state": "IDLE",
            "current_step": -1,
            "current_step_name": "",
            "total_steps": 7,
            "drone_count": 1,
        }
