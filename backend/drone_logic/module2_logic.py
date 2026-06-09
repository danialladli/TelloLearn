import cv2
import numpy as np
import time


class AutonomousLanding:
    def __init__(self, drone):
        self.drone = drone
        self.is_active = False

        self.w, self.h = 360, 240
        self.center_x = self.w // 2
        self.dead_zone = 40

        self.flight_state = "SEARCHING"
        self.stabilize_start_time = 0
        self.patience_counter = 0
        self.search_direction = 15

    def start(self):
        self.is_active = True
        self.run_fsm()

    def stop(self):
        self.is_active = False
        self.drone.send_rc_control(0, 0, 0, 0)

    def run_fsm(self):
        """Autonomous landing loop: detects green landing pad via HSV and lands on it."""
        print("Module 2: Autonomous Landing Initiated!")

        while self.is_active:
            frame = self.drone.get_frame_read().frame
            if frame is None or frame.size == 0:
                continue

            img = cv2.resize(frame, (self.w, self.h))

            # --- COMPUTER VISION: Green landing pad detection ---
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            lower_green = np.array([40, 50, 50])
            upper_green = np.array([80, 255, 255])
            mask = cv2.inRange(hsv, lower_green, upper_green)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            pad_found = False
            cx = 0
            bottom_edge_of_pad = 0

            if contours:
                pad_contour = max(contours, key=cv2.contourArea)
                if cv2.contourArea(pad_contour) > 800:
                    pad_found = True
                    x, y, bw, bh = cv2.boundingRect(pad_contour)
                    cx = x + bw // 2
                    bottom_edge_of_pad = y + bh

            # --- FSM LOGIC ---
            forward_speed = 0
            yaw_speed = 0

            if pad_found:
                self.patience_counter = 30

            # Debouncer: tolerate brief occlusions before reverting to SEARCHING
            if not pad_found and self.flight_state != "BLIND_LEAP":
                if self.patience_counter > 0:
                    self.patience_counter -= 1
                    yaw_speed, forward_speed = 0, 0
                else:
                    self.flight_state = "SEARCHING"

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
                    yaw_speed = max(-30, min(30, yaw_speed))
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
                self.is_active = False
                break

            self.drone.send_rc_control(0, forward_speed, 0, yaw_speed)
