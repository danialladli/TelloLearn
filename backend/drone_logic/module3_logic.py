import cv2
import time

_OCR_AVAILABLE = False
try:
    import pytesseract  # type: ignore[import-untyped]
    _OCR_AVAILABLE = True
except ImportError:
    print("[WARNING] pytesseract not installed. Run: pip install pytesseract")


class AlphabetHovering:
    def __init__(self, drone, target_word: str):
        self.drone = drone
        self.is_active = False

        self.full_word = target_word.upper()
        self.remaining_letters = list(self.full_word)
        self.spelled_letters = []
        self.current_target = self.remaining_letters.pop(0) if self.remaining_letters else ""

        self.w, self.h = 360, 240
        self.center_x, self.center_y = self.w // 2, self.h // 2
        self.dead_zone = 50

        self.flight_state = "SEARCHING"
        self.hover_start_time = 0
        self._frame_counter = 0

    def start(self):
        self.is_active = True
        self.run_fsm()

    def stop(self):
        self.is_active = False
        self.drone.send_rc_control(0, 0, 0, 0)

    def _detect_letter(self, frame):
        """
        Use Tesseract OCR to locate the current target letter in the frame.
        Returns (found: bool, cx: int, cy: int).
        """
        if not _OCR_AVAILABLE:
            return False, 0, 0

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Upscale 2x for better OCR accuracy on small drone frames
        scaled = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        _, thresh = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # PSM 10 = treat image as single character; whitelist uppercase letters only
        config = '--psm 10 -c tessedit_charwhitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        try:
            data = pytesseract.image_to_data(thresh, config=config, output_type='dict')  # type: ignore[union-attr]
        except Exception:
            return False, 0, 0

        for i, text in enumerate(data['text']):
            if text.strip().upper() == self.current_target:
                conf = int(data['conf'][i])
                if conf > 60:
                    # Scale coordinates back to original frame size
                    x = data['left'][i] // 2
                    y = data['top'][i] // 2
                    w = data['width'][i] // 2
                    h = data['height'][i] // 2
                    cx = x + w // 2
                    cy = y + h // 2
                    return True, cx, cy

        return False, 0, 0

    def run_fsm(self):
        """
        Main CV loop: spin-searches for each letter using Tesseract OCR,
        aligns the drone over it, hovers 3 seconds to confirm, then moves to the next.
        """
        print(f"Module 3 Initiated. Searching for word: {self.full_word}")

        while self.is_active and self.current_target != "":
            frame = self.drone.get_frame_read().frame
            if frame is None or frame.size == 0:
                continue

            img = cv2.resize(frame, (self.w, self.h))

            # Run OCR every 5 frames to reduce CPU load
            self._frame_counter += 1
            letter_found = False
            cx, cy = 0, 0
            if self._frame_counter % 5 == 0:
                letter_found, cx, cy = self._detect_letter(img)

            lr_speed, fb_speed, ud_speed, yaw_speed = 0, 0, 0, 0

            if self.flight_state == "SEARCHING":
                if letter_found:
                    self.flight_state = "ALIGNING"
                else:
                    yaw_speed = 15  # Slowly rotate to scan the environment

            elif self.flight_state == "ALIGNING":
                if letter_found:
                    error_x = cx - self.center_x
                    error_y = cy - self.center_y
                    if abs(error_x) > self.dead_zone or abs(error_y) > self.dead_zone:
                        lr_speed = int(error_x / 4)
                        fb_speed = int(-error_y / 4)
                    else:
                        self.flight_state = "HOVERING"
                        self.hover_start_time = time.time()
                else:
                    # Letter lost mid-align, go back to searching
                    self.flight_state = "SEARCHING"

            elif self.flight_state == "HOVERING":
                # Hold position completely still for 3 seconds to "claim" the letter
                if time.time() - self.hover_start_time >= 3.0:
                    self.spelled_letters.append(self.current_target)
                    print(f"Letter '{self.current_target}' confirmed! Spelled: {''.join(self.spelled_letters)}")

                    if self.remaining_letters:
                        self.current_target = self.remaining_letters.pop(0)
                        self.flight_state = "SEARCHING"
                        self._frame_counter = 0
                    else:
                        self.current_target = ""  # All letters done — exit loop

            self.drone.send_rc_control(lr_speed, fb_speed, ud_speed, yaw_speed)

        if self.is_active:
            self.flight_state = "MISSION_COMPLETE"
            print(f"Word '{self.full_word}' completely spelled! Landing...")
            self.drone.land()
            self.is_active = False
