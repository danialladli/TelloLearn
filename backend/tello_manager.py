import cv2
import threading
import time
from djitellopy import tello

from drone_logic.module1_logic import BasicFlightController
from drone_logic.module2_logic import AutonomousLanding
from drone_logic.module3_logic import AlphabetHovering
from drone_logic.module4_logic import ShortestPathSpeller
from drone_logic.module5_logic import SwarmLeaderFollower


class TelloManager:
    def __init__(self):
        self.drone = tello.Tello()
        self.drone_follower = tello.Tello()
        self.is_connected = False
        self.flight_controller = BasicFlightController(self.drone)
        self.active_module = None
        self.swarm_controller = SwarmLeaderFollower([self.drone, self.drone_follower])

    def connect(self):
        if not self.is_connected:
            print("Connecting to Tello...")
            self.drone.connect()
            self.drone.streamon()
            print(f"Battery: {self.drone.get_battery()}%")
            self.is_connected = True
            time.sleep(2)

    def get_video_stream(self):
        while True:
            if not self.is_connected:
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
        if command == "land":
            if self.active_module and self.active_module.is_active:
                print("[MANAGER] Emergency override! Killing active module thread...")
                self.active_module.stop()

        return self.flight_controller.execute(command)

    def send_rc_control(self, lr: int, fb: int, ud: int, yaw: int):
        return self.flight_controller.send_rc(lr, fb, ud, yaw)

    # --- MODULE 2: AUTONOMOUS LANDING ---
    def start_module_2(self):
        if self.active_module and self.active_module.is_active:
            self.active_module.stop()

        self.active_module = AutonomousLanding(self.drone)
        threading.Thread(target=self.active_module.start, daemon=True).start()
        return {"message": "Module 2 FSM Initiated in Background!"}

    def get_module_2_telemetry(self):
        if self.active_module and self.active_module.is_active:
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
        if self.active_module and self.active_module.is_active:
            self.active_module.stop()

        self.active_module = AlphabetHovering(self.drone, target_word)
        threading.Thread(target=self.active_module.start, daemon=True).start()
        return {"message": f"Module 3 FSM Initiated for word: {target_word}"}

    def get_module_3_telemetry(self):
        if self.active_module and isinstance(self.active_module, AlphabetHovering):
            return {
                "status": "active" if self.active_module.is_active else "inactive",
                "state": self.active_module.flight_state,
                "current_target": self.active_module.current_target,
                "spelled_so_far": "".join(self.active_module.spelled_letters),
                "full_word": self.active_module.full_word
            }
        return {
            "status": "inactive",
            "state": "OFFLINE",
            "current_target": "",
            "spelled_so_far": "",
            "full_word": ""
        }

    # --- MODULE 4: SHORTEST PATH SPELLING ---
    def start_module_4(self, target_word: str):
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

    # --- MODULE 5: SWARM PROGRAMMING ---
    def execute_swarm_command(self, command: str):
        return self.swarm_controller.execute_swarm_command(command)

    def get_swarm_telemetry(self):
        return {
            "status": "active" if self.swarm_controller.is_active else "inactive",
            "state": self.swarm_controller.swarm_state,
            "last_command": self.swarm_controller.last_command,
            "leader_pos": self.swarm_controller.leader_pos,
            "follower_pos": self.swarm_controller.follower_pos
        }
