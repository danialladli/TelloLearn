import cv2
import importlib
import logging
import queue
import threading
import time

logger = logging.getLogger(__name__)

_OCR_AVAILABLE = False
pytesseract = None
Output = None
try:
    pytesseract = importlib.import_module("pytesseract")
    Output = getattr(pytesseract, "Output", None)
    _OCR_AVAILABLE = True
except ImportError:
    logger.warning("[M3] pytesseract not installed — OCR unavailable. Run: pip install pytesseract")

# ── Tuning constants ──────────────────────────────────────────────────────────
GAIN            = 0.25
TOLERANCE_X     = 25    # px — horizontal centering tolerance
TOLERANCE_Y     = 30    # px — vertical centering tolerance
SCAN_YAW_SPEED  = 10    # yaw speed during scan (slow → OCR thread can keep up)
NAV_YAW_SPEED   = 20    # yaw speed when rotating to a known letter position
HOVER_DURATION  = 3.0   # seconds to hover in front of each confirmed letter
FRAME_CX, FRAME_CY = 180, 120
OCR_CONF_MIN    = 55    # minimum pytesseract confidence % to accept a detection
SCAN_DURATION   = 25    # maximum seconds for the scanning phase


class AlphabetHovering:
    def __init__(self, drone, target_word: str):
        self.drone       = drone
        self.is_active   = False
        self.full_word   = target_word.upper()
        self.flight_state   = "IDLE"
        self.current_target = ""
        self.spelled_letters: list[str] = []   # letters confirmed in word order

        # Scan output
        self.letter_map: dict[str, dict] = {}  # letter -> {yaw, cx, cy}
        self.scan_complete = False
        self.distances: list[float] = []       # yaw deltas between word letters

        # Background OCR thread state
        self._ocr_running   = False
        self._ocr_queue_in  = queue.Queue(maxsize=1)  # latest frame for OCR
        self._ocr_queue_out = queue.Queue()           # (letter, cx, cy) results

    # ── Public API ────────────────────────────────────────────────────────────

    def start(self):
        self.is_active = True
        self.run_fsm()

    def stop(self):
        self.is_active = False
        self._ocr_running = False
        self.drone.send_rc_control(0, 0, 0, 0)

    # ── OCR helpers ───────────────────────────────────────────────────────────

    def _preprocess(self, img):
        """Upscale + Otsu threshold — improves pytesseract accuracy on printed text."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        up   = cv2.resize(gray, (720, 480), interpolation=cv2.INTER_CUBIC)
        _, thresh = cv2.threshold(up, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return thresh

    def _detect_all_letters(self, img):
        """Return list of (letter, cx, cy) for every confident uppercase letter found."""
        if not _OCR_AVAILABLE or pytesseract is None or Output is None:
            return []
        proc = self._preprocess(img)
        # PSM 11: sparse text — finds individual characters anywhere in the image
        cfg  = "--psm 11 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        try:
            data = pytesseract.image_to_data(proc, config=cfg, output_type=Output.DICT)
        except Exception:
            return []

        results = []
        for i, text in enumerate(data["text"]):
            letter = text.strip().upper()
            try:
                conf = int(data["conf"][i])
            except (ValueError, TypeError):
                conf = 0
            if len(letter) == 1 and letter.isalpha() and conf >= OCR_CONF_MIN:
                x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
                if w > 5 and h > 5:
                    # Scale cx/cy back to 360×240 space
                    cx = int((x + w // 2) / 2)
                    cy = int((y + h // 2) / 2)
                    results.append((letter, cx, cy))
        return results

    def _detect_letter(self, img, target):
        """Return (found, cx, cy) for a specific target letter."""
        if not _OCR_AVAILABLE or pytesseract is None or Output is None:
            return False, 0, 0
        proc = self._preprocess(img)
        # PSM 11: sparse text — needed for a full camera frame, not a cropped single-char image
        cfg  = "--psm 11 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        try:
            data = pytesseract.image_to_data(proc, config=cfg, output_type=Output.DICT)
        except Exception:
            return False, 0, 0

        for i, text in enumerate(data["text"]):
            if text.strip().upper() == target:
                try:
                    conf = int(data["conf"][i])
                except (ValueError, TypeError):
                    conf = 0
                if conf >= OCR_CONF_MIN:
                    x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
                    if w > 5 and h > 5:
                        return True, int((x + w // 2) / 2), int((y + h // 2) / 2)
        return False, 0, 0

    def _ocr_worker(self):
        """Background thread: consume frames from _ocr_queue_in, post results to _ocr_queue_out."""
        while self._ocr_running:
            try:
                frame = self._ocr_queue_in.get(timeout=0.5)
                for item in self._detect_all_letters(frame):
                    self._ocr_queue_out.put(item)
            except queue.Empty:
                pass

    # ── Geometry helper ───────────────────────────────────────────────────────

    @staticmethod
    def _yaw_delta(from_yaw: float, to_yaw: float) -> float:
        """Shortest signed angle from from_yaw to to_yaw (degrees)."""
        d = (to_yaw - from_yaw + 180) % 360 - 180
        return d

    # ── Main FSM ──────────────────────────────────────────────────────────────

    def run_fsm(self):
        logger.info(f"[M3] Starting for word: {self.full_word}")

        # ── Phase 1: SCAN ────────────────────────────────────────────────────
        self.flight_state = "SCANNING"
        self._ocr_running = True
        threading.Thread(target=self._ocr_worker, daemon=True).start()

        letters_needed = set(self.full_word)
        scan_start     = time.time()
        prev_yaw       = None
        total_rotated  = 0.0

        while time.time() - scan_start < SCAN_DURATION and self.is_active:
            if letters_needed.issubset(self.letter_map):
                logger.info("[M3] All word letters found — scan early exit")
                break

            frame = self.drone.get_frame_read().frame
            if frame is None or frame.size == 0:
                self.drone.send_rc_control(0, 0, 0, SCAN_YAW_SPEED)
                time.sleep(0.05)
                continue

            img         = cv2.resize(frame, (360, 240))
            current_yaw = self.drone.get_yaw()

            # Track total rotation so we stop after a full 360°
            if prev_yaw is not None:
                total_rotated += abs(self._yaw_delta(prev_yaw, current_yaw))
                if total_rotated >= 355:
                    logger.info("[M3] 360° scan complete")
                    break
            prev_yaw = current_yaw

            # Submit frame to OCR thread (non-blocking; drop if busy)
            try:
                self._ocr_queue_in.put_nowait(img.copy())
            except queue.Full:
                pass

            # Harvest any OCR results
            while not self._ocr_queue_out.empty():
                letter, cx, cy = self._ocr_queue_out.get_nowait()
                if letter not in self.letter_map:
                    yaw = self.drone.get_yaw()
                    self.letter_map[letter] = {"yaw": yaw, "cx": cx, "cy": cy}
                    logger.info(f"[M3] Mapped '{letter}' at yaw={yaw:.1f}°")

            self.drone.send_rc_control(0, 0, 0, SCAN_YAW_SPEED)
            time.sleep(0.05)

        self._ocr_running = False
        self.drone.send_rc_control(0, 0, 0, 0)
        time.sleep(0.5)
        self.scan_complete = True

        found = list(self.letter_map.keys())
        missing = letters_needed - set(found)
        logger.info(f"[M3] Scan done. Found: {found}. Missing from word: {missing or 'none'}")

        # ── Phase 2: CALCULATE DISTANCES ─────────────────────────────────────
        self.flight_state = "CALCULATING"
        self.distances = []
        prev_yaw_ref = self.drone.get_yaw()

        for letter in self.full_word:
            if letter in self.letter_map:
                target_yaw = self.letter_map[letter]["yaw"]
                delta      = self._yaw_delta(prev_yaw_ref, target_yaw)
                self.distances.append(round(delta, 1))
                prev_yaw_ref = target_yaw
                logger.info(f"[M3] '{letter}' → yaw={target_yaw:.1f}°  delta={delta:+.1f}°")
            else:
                self.distances.append(0.0)

        time.sleep(0.3)

        # ── Phase 3: NAVIGATE AND HOVER ───────────────────────────────────────
        for letter in self.full_word:
            if not self.is_active:
                break

            self.current_target = letter

            if letter not in self.letter_map:
                logger.warning(f"[M3] '{letter}' not in map — skipping")
                self.spelled_letters.append(f"[{letter}]")
                continue

            target_yaw = self.letter_map[letter]["yaw"]

            # ── Rotate to saved yaw ───────────────────────────────────────────
            self.flight_state = "ROTATING"
            logger.info(f"[M3] Rotating to '{letter}' at yaw={target_yaw:.1f}°")
            rotate_deadline = time.time() + 6

            while time.time() < rotate_deadline and self.is_active:
                delta = self._yaw_delta(self.drone.get_yaw(), target_yaw)
                if abs(delta) <= 8:
                    break
                spd = int(min(NAV_YAW_SPEED, max(8, abs(delta) * 0.35)))
                self.drone.send_rc_control(0, 0, 0, spd if delta > 0 else -spd)
                time.sleep(0.05)

            self.drone.send_rc_control(0, 0, 0, 0)
            time.sleep(0.4)

            # ── Fine-align with live OCR ──────────────────────────────────────
            self.flight_state = "ALIGNING"
            logger.info(f"[M3] Aligning to '{letter}'")
            align_deadline  = time.time() + 8
            frame_counter   = 0
            aligned         = False

            while time.time() < align_deadline and self.is_active:
                frame = self.drone.get_frame_read().frame
                if frame is None or frame.size == 0:
                    time.sleep(0.05)
                    continue

                img = cv2.resize(frame, (360, 240))
                frame_counter += 1

                # Run OCR every 5 frames during alignment
                if frame_counter % 5 != 0:
                    time.sleep(0.05)
                    continue

                found, cx, cy = self._detect_letter(img, letter)

                if found:
                    error_x = cx - FRAME_CX
                    error_y = cy - FRAME_CY

                    if abs(error_x) < TOLERANCE_X and abs(error_y) < TOLERANCE_Y:
                        self.drone.send_rc_control(0, 0, 0, 0)
                        logger.info(f"[M3] Aligned to '{letter}'!")
                        aligned = True
                        break

                    # Yaw corrects left/right (keeps drone perpendicular to wall)
                    yaw_spd = max(-NAV_YAW_SPEED, min(NAV_YAW_SPEED, int(error_x * GAIN)))
                    ud_spd  = max(-20, min(20, -int(error_y * GAIN)))
                    self.drone.send_rc_control(0, 0, ud_spd, yaw_spd)
                else:
                    # Slowly sweep right to find the letter
                    self.drone.send_rc_control(0, 0, 0, SCAN_YAW_SPEED // 2)

                time.sleep(0.05)

            if not aligned:
                logger.warning(f"[M3] Could not align to '{letter}' — continuing")

            # ── Hover ─────────────────────────────────────────────────────────
            self.flight_state = "HOVERING"
            self.drone.send_rc_control(0, 0, 0, 0)
            logger.info(f"[M3] Hovering at '{letter}' for {HOVER_DURATION}s")
            hover_end = time.time() + HOVER_DURATION
            while time.time() < hover_end and self.is_active:
                time.sleep(0.1)

            self.spelled_letters.append(letter)
            logger.info(f"[M3] '{letter}' confirmed. Progress: {''.join(self.spelled_letters)}")

        # ── Phase 4: LAND ─────────────────────────────────────────────────────
        if self.is_active:
            self.flight_state = "MISSION_COMPLETE"
            self.current_target = ""
            logger.info(f"[M3] Word '{self.full_word}' complete! Landing...")
            self.drone.land()
            self.is_active = False

        logger.info("[M3] Mission complete!")
