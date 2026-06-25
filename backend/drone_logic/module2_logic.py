import cv2
import numpy as np
import time

LOWER_GREEN = np.array([30, 40, 40])
UPPER_GREEN = np.array([90, 255, 255])

FRAME_CX, FRAME_CY = 180, 120
GAIN          = 0.3
MAX_SPEED     = 25
MIN_FB_SPEED  = 5
TARGET_HEIGHT = 50    # cm — descent target before visual search

# ── Dead-zone detection ───────────────────────────────────────────────────────
# Two complementary triggers; either one confirms dead-zone entry.
#
# 1. Area-drop trigger (primary)
#    The pad contour grows as the drone approaches.  When it peaks and then
#    drops to <40 % of that peak, the drone has just overflown the pad centre.
DEAD_ZONE_PEAK_AREA  = 2500  # px² — pad must reach this size to arm the trigger
DEAD_ZONE_DROP_RATIO = 0.40  # fraction — fire when area < peak * ratio

# 2. pad_cy trigger (backup — catches cases where the drop is gradual)
DEAD_ZONE_PY          = 210  # pad centre-y above this → near frame bottom
DEAD_ZONE_CLOSE_FRAMES = 2   # consecutive frames at DEAD_ZONE_PY to confirm

# ── Landing sequence after dead-zone entry ────────────────────────────────────
# At TARGET_HEIGHT = 50 cm with ~45° effective camera vFOV, the pad exits
# the frame bottom when it is TARGET_HEIGHT / tan(45°) ≈ 50 cm ahead of the
# point directly below the drone.  Moving forward ~50 cm after entry centres
# the drone over the pad.  Adjust DEAD_ZONE_FORWARD_CM based on test results.
DEAD_ZONE_FORWARD_CM = 65


class AutonomousLanding:
    def __init__(self, drone):
        self.drone = drone
        self.is_active = False
        self.flight_state = "IDLE"
        self.pad_detected = False

    def start(self):
        self.is_active = True
        self.run_fsm()

    def stop(self):
        self.is_active = False
        self.drone.send_rc_control(0, 0, 0, 0)

    def _execute_landing_sequence(self):
        """Hover to stabilise → push forward to centre over pad → land."""
        print(f"[M2] Dead zone entered → hover 1 s, forward {DEAD_ZONE_FORWARD_CM} cm, land")
        self.flight_state = "LANDING"
        self.drone.send_rc_control(0, 0, 0, 0)
        time.sleep(1.0)
        if not self.is_active:
            return
        try:
            self.drone.move_forward(DEAD_ZONE_FORWARD_CM)
        except Exception as e:
            print(f"[M2] move_forward aborted (drone likely already landed): {e}")
            self.is_active = False
            return
        time.sleep(0.5)
        if not self.is_active:
            return
        try:
            self.drone.land()
        except Exception as e:
            print(f"[M2] land command failed: {e}")
        self.is_active = False

    def run_fsm(self):
        print("[M2] Autonomous Landing Initiated!")

        # ── Phase 1: Descend to TARGET_HEIGHT ───────────────────────────────
        self.flight_state = "DESCENDING"
        time.sleep(1)
        try:
            current_h = self.drone.get_distance_tof()
            print(f"[M2] Height: {current_h} cm → targeting {TARGET_HEIGHT} cm")
            drop = current_h - TARGET_HEIGHT
            if drop >= 10:
                self.drone.move_down(drop)
                time.sleep(1)
        except Exception as e:
            print(f"[M2] Height adjust skipped: {e}")

        # ── Phase 2: Search → Centre → Dead-zone → Land ──────────────────────
        self.flight_state = "SEARCHING"
        close_frames = 0   # consecutive frames with pad_cy > DEAD_ZONE_PY
        peak_area    = 0   # largest contour area seen this mission
        landed       = False
        frame_idx    = 0

        while frame_idx < 600 and self.is_active:
            frame = self.drone.get_frame_read().frame
            if frame is None or frame.size == 0:
                time.sleep(0.05)
                continue

            img = cv2.resize(frame, (360, 240))
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            mask = cv2.inRange(hsv, LOWER_GREEN, UPPER_GREEN)
            contours, _ = cv2.findContours(
                mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )

            if frame_idx % 30 == 0:
                if contours:
                    best = cv2.contourArea(max(contours, key=cv2.contourArea))
                    print(f"[M2] f={frame_idx} contour={best:.0f}px² peak={peak_area:.0f}px² state={self.flight_state}")
                else:
                    print(f"[M2] f={frame_idx} no_contours peak={peak_area:.0f}px² state={self.flight_state}")

            if contours:
                largest = max(contours, key=cv2.contourArea)
                area    = cv2.contourArea(largest)

                if area > 300:
                    x, y, w, h_r = cv2.boundingRect(largest)
                    pad_cx  = x + w // 2
                    pad_cy  = y + h_r // 2
                    error_x = pad_cx - FRAME_CX

                    self.pad_detected = True
                    self.flight_state = "CENTERING"

                    # Update peak
                    if area > peak_area:
                        peak_area = area

                    # ── Dead-zone trigger 1: area-drop ───────────────────────
                    # Pad was large and is now shrinking fast → drone overflew it
                    if (peak_area >= DEAD_ZONE_PEAK_AREA
                            and area < peak_area * DEAD_ZONE_DROP_RATIO):
                        self._execute_landing_sequence()
                        landed = True
                        break

                    # ── Dead-zone trigger 2: pad_cy backup ───────────────────
                    if pad_cy > DEAD_ZONE_PY:
                        close_frames += 1
                    else:
                        close_frames = 0

                    if close_frames >= DEAD_ZONE_CLOSE_FRAMES:
                        self._execute_landing_sequence()
                        landed = True
                        break

                    # ── Movement ─────────────────────────────────────────────
                    speed_lr = max(-MAX_SPEED, min(MAX_SPEED, int(error_x * GAIN)))

                    if pad_cy > DEAD_ZONE_PY:
                        # Near dead zone — L/R correction only, no forward push
                        self.drone.send_rc_control(speed_lr, 0, 0, 0)
                    else:
                        raw_fb   = int((pad_cy - FRAME_CY) * GAIN)
                        speed_fb = max(MIN_FB_SPEED, min(MAX_SPEED, raw_fb))
                        self.drone.send_rc_control(speed_lr, speed_fb, 0, 0)

                else:
                    # Contour too small
                    close_frames = 0
                    self.pad_detected = False
                    self.flight_state = "SEARCHING"
                    self.drone.send_rc_control(0, 0, 0, 0)

            else:
                # ── No contours ───────────────────────────────────────────────
                if peak_area >= DEAD_ZONE_PEAK_AREA:
                    # Pad was large and just disappeared → drone is over it
                    self._execute_landing_sequence()
                    landed = True
                    break
                else:
                    close_frames = 0
                    self.pad_detected = False
                    self.flight_state = "SEARCHING"
                    self.drone.send_rc_control(0, 0, 0, 0)

            time.sleep(0.05)
            frame_idx += 1

        if not landed and self.is_active:
            print("[M2] Timeout. Landing...")
            self.drone.land()
            self.is_active = False

        print("[M2] Mission complete!")
