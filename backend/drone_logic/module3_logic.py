import cv2
import time
import numpy as np
# import pytesseract  <-- You will need to pip install pytesseract later for the real physical drone tests!

class AlphabetHovering:
    def __init__(self, drone, is_connected: bool, target_word: str):
        self.drone = drone
        self.is_connected = is_connected
        self.is_active = False
        
        # Word Spelling Queue
        self.full_word = target_word.upper()
        self.remaining_letters = list(self.full_word) 
        self.spelled_letters = []
        
        # Grab the first letter to look for
        self.current_target = self.remaining_letters.pop(0) if self.remaining_letters else ""
        
        # Configuration & FSM
        self.w, self.h = 360, 240
        self.center_x, self.center_y = self.w // 2, self.h // 2
        self.dead_zone = 50
        
        self.flight_state = "SEARCHING"
        self.hover_start_time = 0

    def start(self):
        self.is_active = True
        if not self.is_connected:
            self.run_mock_fsm()
        else:
            self.run_fsm()

    def stop(self):
        self.is_active = False
        if self.is_connected:
            self.drone.send_rc_control(0, 0, 0, 0)
        else:
            print(f"[MOCK DRONE] Module 3 Emergency Stop Triggered!")

    def run_mock_fsm(self):
        """Simulates finding each letter of the target word sequentially."""
        print(f"[MOCK DRONE] Module 3 Initiated. Target Word: {self.full_word}")
        
        while self.is_active and self.current_target != "":
            print(f"\n[MOCK DRONE] --- Now looking for letter: '{self.current_target}' ---")
            
            # Simulate the drone finding and hovering over a letter
            mock_sequence = [
                ("SEARCHING", 2),
                ("ALIGNING", 1.5),
                ("HOVERING", 3) # Hover for 3 seconds to "claim" the letter
            ]
            
            for state, delay in mock_sequence:
                if not self.is_active: break
                self.flight_state = state
                print(f"[MOCK DRONE] State -> {self.flight_state}")
                time.sleep(delay)
                
            if not self.is_active: break
            
            # Letter successfully spelled!
            self.spelled_letters.append(self.current_target)
            print(f"[MOCK DRONE] Letter '{self.current_target}' confirmed! Spelled so far: {''.join(self.spelled_letters)}")
            
            # Queue up the next letter
            if len(self.remaining_letters) > 0:
                self.current_target = self.remaining_letters.pop(0)
                self.flight_state = "NEXT_LETTER_TRANSITION"
                time.sleep(1)
            else:
                self.current_target = "" # We are done!

        if self.is_active:
            self.flight_state = "MISSION_COMPLETE"
            print(f"[MOCK DRONE] Word '{self.full_word}' completely spelled! Initiating Landing...")
            self.is_active = False

    def run_fsm(self):
        """The real CV loop. (Skeleton prepared for PyTesseract OCR)."""
        print(f"Module 3 Initiated. Searching for: {self.full_word}")
        
        while self.is_active and self.current_target != "":
            frame = self.drone.get_frame_read().frame
            if frame is None or frame.size == 0: continue
            
            img = cv2.resize(frame, (self.w, self.h))
            
            # --- COMPUTER VISION: OCR PLACEHOLDER ---
            # In a real scenario, you would run OCR (like PyTesseract) here to read text.
            # Running OCR on every frame is CPU heavy, so you typically process every 5th frame.
            letter_found = False
            cx, cy = 0, 0 
            
            # ... OCR Logic to find self.current_target goes here ...
            
            # --- THE FSM LOGIC ---
            lr_speed, fb_speed, ud_speed, yaw_speed = 0, 0, 0, 0
            
            if self.flight_state == "SEARCHING":
                if letter_found:
                    self.flight_state = "ALIGNING"
                else:
                    yaw_speed = 15 # Slowly spin to search
                    
            elif self.flight_state == "ALIGNING" and letter_found:
                error_x = cx - self.center_x
                error_y = cy - self.center_y
                
                if abs(error_x) > self.dead_zone or abs(error_y) > self.dead_zone:
                    lr_speed = int(error_x / 4)
                    fb_speed = int(-error_y / 4) # Forward/Back to align Y-axis
                else:
                    self.flight_state = "HOVERING"
                    self.hover_start_time = time.time()
                    
            elif self.flight_state == "HOVERING":
                # Stay completely still for 3 seconds over the letter
                if time.time() - self.hover_start_time >= 3.0:
                    self.spelled_letters.append(self.current_target)
                    
                    if len(self.remaining_letters) > 0:
                        self.current_target = self.remaining_letters.pop(0)
                        self.flight_state = "SEARCHING" # Go back to searching for the next one
                    else:
                        self.current_target = "" # Break the loop!
            
            # Send movement to drone
            self.drone.send_rc_control(lr_speed, fb_speed, ud_speed, yaw_speed)

        # Land when the word is finished
        if self.is_active:
            self.flight_state = "MISSION_COMPLETE"
            self.drone.land()
            self.is_active = False