import cv2
import threading
import time
from djitellopy import tello

# Import your new OOP module!
from drone_logic.module1_logic import BasicFlightController
from drone_logic.module2_logic import AutonomousLanding

class TelloManager:
    def __init__(self):
        self.drone = tello.Tello()
        self.is_connected = False
        self.flight_controller = BasicFlightController(self.drone)
        self.active_module = None # Hold our active module threads

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
        
        # Delegate the task to the dedicated class!
        return self.flight_controller.execute(command, self.is_connected)
    
    def send_rc_control(self, lr: int, fb: int, ud: int, yaw: int):
        # Delegate the continuous joystick stream to the Module 1 Controller
        return self.flight_controller.send_rc(lr, fb, ud, yaw, self.is_connected)

    # --- MODULE 2: AUTONOMOUS FSM ---
    def start_module_2(self):
        # NEW: Pass self.is_connected to the class
        self.active_module = AutonomousLanding(self.drone, self.is_connected)
        threading.Thread(target=self.active_module.start, daemon=True).start()
        return {"message": "Module 2 FSM Initiated in Background!"}
    
    def get_module_2_telemetry(self):
        """Returns the live state of the FSM thread."""
        if self.active_module and self.active_module.is_active:
            # If the FSM is out of the SEARCHING state, it found the pad!
            pad_found = self.active_module.flight_state != "SEARCHING"
            
            return {
                "status": "active",
                "state": self.active_module.flight_state,
                "pad_detected": pad_found
            }
        else:
            # If the module isn't running (or finished landing)
            return {
                "status": "inactive", 
                "state": "OFFLINE", 
                "pad_detected": False
            }