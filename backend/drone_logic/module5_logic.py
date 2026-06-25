import logging
import threading
import time

logger = logging.getLogger(__name__)

# ── Routine definition ────────────────────────────────────────────────────────
# Each entry: (display name, Tello method name, args tuple)
# Executed on ALL connected drones in parallel per step.
ROUTINE_STEPS = [
    ("Move Forward 50 cm",        "move_forward",             (50,)),
    ("Move Backward 50 cm",       "move_back",                (50,)),
    ("Rotate Clockwise 90°",      "rotate_clockwise",         (90,)),
    ("Rotate Anticlockwise 90°",  "rotate_counter_clockwise", (90,)),
    ("Move Up 30 cm",             "move_up",                  (30,)),
    ("Move Down 30 cm",           "move_down",                (30,)),
    ("Land",                      "land",                     ()),
]
TOTAL_STEPS = len(ROUTINE_STEPS)


class SwarmRoutine:
    """
    Executes ROUTINE_STEPS on 1 or 2 Tello drones.
    - 1 drone : commands run sequentially on that drone.
    - 2 drones: each step fires on both drones simultaneously via threads.
    """

    def __init__(self, drones: list):
        self.drones            = drones
        self.drone_count       = len(drones)
        self.is_active         = False
        self.swarm_state       = "IDLE"
        self.current_step      = -1          # index into ROUTINE_STEPS
        self.current_step_name = ""
        self.total_steps       = TOTAL_STEPS

    # ── Public API ────────────────────────────────────────────────────────────

    def start(self):
        self.is_active = True
        self._run()

    def stop(self):
        self.is_active = False
        self.swarm_state = "STOPPED"
        for d in self.drones:
            try:
                d.send_rc_control(0, 0, 0, 0)
            except Exception:
                pass

    # ── Internal ──────────────────────────────────────────────────────────────

    def _exec_step(self, method: str, args: tuple):
        """Run a Tello method on every drone — in parallel when >1 drone."""
        def run_on(drone):
            try:
                getattr(drone, method)(*args)
            except Exception as e:
                logger.warning(f"[M5] Drone {drone.host} → {method}{args} failed: {e}")

        if self.drone_count == 1:
            run_on(self.drones[0])
        else:
            threads = [threading.Thread(target=run_on, args=(d,), daemon=True)
                       for d in self.drones]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

    def _run(self):
        logger.info(f"[M5] Routine starting on {self.drone_count} drone(s)")
        self.swarm_state = "RUNNING"

        for i, (name, method, args) in enumerate(ROUTINE_STEPS):
            if not self.is_active:
                logger.info("[M5] Routine aborted by stop()")
                break

            self.current_step      = i
            self.current_step_name = name
            logger.info(f"[M5] Step {i + 1}/{TOTAL_STEPS}: {name}")

            try:
                self._exec_step(method, args)
            except Exception as e:
                logger.error(f"[M5] Step '{name}' failed: {e}")
                self.swarm_state = "ERROR"
                self.is_active = False
                return

            # Pause between steps (skip after the final land)
            if method != "land" and self.is_active:
                time.sleep(1.0)

        if self.is_active:
            self.swarm_state = "COMPLETE"
        self.is_active = False
        logger.info("[M5] Routine complete!")


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

    from djitellopy import Tello
    DRONE_1_IP = "172.20.10.3"
    DRONE_2_IP = "172.20.10.4"

    t1 = Tello(host=DRONE_1_IP)
    t2 = Tello(host=DRONE_2_IP)

    t1.connect()
    print(f"[TEST] Drone 1 battery: {t1.get_battery()}%")
    t2.connect()
    print(f"[TEST] Drone 2 battery: {t2.get_battery()}%")

    # Takeoff both drones in parallel so neither hovers alone waiting for the other
    to1 = threading.Thread(target=t1.takeoff)
    to2 = threading.Thread(target=t2.takeoff)
    to1.start(); to2.start()
    to1.join();  to2.join()

    time.sleep(2)
    SwarmRoutine([t1, t2]).start()

    t1.end()
    t2.end()
