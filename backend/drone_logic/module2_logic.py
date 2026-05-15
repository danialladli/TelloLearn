import cv2
import numpy as np
import time

class AutonomousLanding:
    def __init__(self, drone, is_connected: bool):
        self.drone = drone
        self.is_connected = is_connected
        self.is_active = False
        
        # Configuration
        self.w, self.h = 360, 240       
        self.center_x = self.w // 2     
        self.dead_zone = 40        
        
        # FSM Variables
        self.flight_state = "SEARCHING"
        self.stabilize_start_time = 0
        self.patience_counter = 0  
        self.search_direction = 15 

    def start(self):
        """Triggers the FSM loop depending on connection status."""
        self.is_active = True
        
        # HARDWARE MOCKING SHIELD
        if not self.is_connected:
            self.run_mock_fsm()
        else:
            self.run_fsm()

    def stop(self):
        """Emergency kill switch for the module."""
        self.is_active = False
        if self.is_connected:
            self.drone.send_rc_control(0, 0, 0, 0)
        else:
            print("[MOCK DRONE] Emergency Stop Triggered!")

    def run_mock_fsm(self):
        """Simulates the drone finding a pad and landing for offline UI testing."""
        print("[MOCK DRONE] Module 2: Autonomous Landing Initiated!")
        
        # A sequence of fake states and how long they take (in seconds)
        mock_sequence = [
            ("SEARCHING", 3),
            ("STABILIZING", 1),
            ("CENTERING", 2),
            ("APPROACHING", 2),
            ("BLIND_LEAP", 2)
        ]
        
        for state, delay in mock_sequence:
            if not self.is_active:
                print("[MOCK DRONE] Mission aborted by user.")
                break
                
            self.flight_state = state
            print(f"[MOCK DRONE] FSM State Change -> {self.flight_state}")
            time.sleep(delay) # Simulate the time it takes the drone to do this

        if self.is_active:
            print("[MOCK DRONE] DROP ZONE REACHED! Initiating Landing...")
            self.is_active = False 
            print("[MOCK DRONE] Landed successfully.")

    def run_fsm(self):
        """The main autonomous control loop. Runs until landing or stopped."""
        print("Module 2: Autonomous Landing Initiated!")
        
        while self.is_active:
            frame = self.drone.get_frame_read().frame
            if frame is None or frame.size == 0:
                continue 

            img = cv2.resize(frame, (self.w, self.h))  # type: ignore

            # --- COMPUTER VISION ---
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            lower_green = np.array([40, 50, 50])
            upper_green = np.array([80, 255, 255])
            mask = cv2.inRange(hsv, lower_green, upper_green)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            pad_found = False
            
            if len(contours) > 0:
                pad_contour = max(contours, key=cv2.contourArea)
                if cv2.contourArea(pad_contour) > 800: 
                    pad_found = True
                    x, y, bw, bh = cv2.boundingRect(pad_contour)
                    cx = x + (bw // 2)
                    bottom_edge_of_pad = y + bh

            # --- THE FSM LOGIC ---
            forward_speed = 0
            yaw_speed = 0

            if pad_found:
                self.patience_counter = 30 

            # Debouncer
            if not pad_found and self.flight_state != "BLIND_LEAP":
                if self.patience_counter > 0:
                    self.patience_counter -= 1
                    yaw_speed, forward_speed = 0, 0
                else:
                    self.flight_state = "SEARCHING"

            # Execute States
            if self.flight_state == "SEARCHING":
                if pad_found:
                    self.flight_state = "STABILIZING"
                    self.stabilize_start_time = time.time()
                    yaw_speed = 0
                else:
                    yaw_speed = self.search_direction 

            elif self.flight_state == "STABILIZING" and pad_found:
                yaw_speed, forward_speed = 0, 0
                if time.time() - self.stabilize_start_time >= 1.0:
                    self.flight_state = "CENTERING" 

            elif self.flight_state == "CENTERING" and pad_found:
                error = cx - self.center_x 
                if abs(error) > self.dead_zone:
                    yaw_speed = int(error / 4) 
                    yaw_speed = max(-30, min(30, yaw_speed)) # Clamp speed
                    self.search_direction = 15 if yaw_speed > 0 else -15
                else:
                    yaw_speed = 0   
                    self.flight_state = "APPROACHING"

            elif self.flight_state == "APPROACHING" and pad_found:
                error = cx - self.center_x
                if abs(error) > self.dead_zone:
                    self.flight_state = "CENTERING"
                else:
                    if bottom_edge_of_pad < self.h - 20: 
                        forward_speed = 15
                    else:
                        self.flight_state = "BLIND_LEAP"

            elif self.flight_state == "BLIND_LEAP":
                print("DROP ZONE REACHED! Initiating Landing...")
                self.drone.send_rc_control(0, 0, 0, 0)
                time.sleep(0.5)
                self.drone.send_rc_control(0, 20, 0, 0)
                time.sleep(1.8) 
                self.drone.send_rc_control(0, 0, 0, 0)
                self.drone.land()
                self.is_active = False # Kill the loop
                break 

            # Move the drone
            self.drone.send_rc_control(0, forward_speed, 0, yaw_speed)