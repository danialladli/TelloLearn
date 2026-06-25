import io
import time
import logging
import cv2
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from dependencies import tello_system
from models import CommandSequence, RCCommand, WordPayload

router = APIRouter(tags=["drone"])
logger = logging.getLogger(__name__)


# ── Status & Video ────────────────────────────────────────────────────────────

@router.get("/drone/status")
def get_status():
    if not tello_system.is_connected or tello_system.drone is None:
        return {"connected": False, "error": "Drone not connected"}
    try:
        return {
            "connected": True,
            "battery": tello_system.drone.get_battery(),
            "temp": tello_system.drone.get_temperature(),
            "flying": tello_system.drone.is_flying,
        }
    except Exception:
        tello_system.is_connected = False
        return {"connected": False, "error": "Drone disconnected"}


@router.get("/video_feed")
def video_feed():
    return StreamingResponse(
        tello_system.get_video_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.get("/video/snapshot")
def video_snapshot():
    """Returns a single JPEG frame — used by the mobile app for live polling."""
    if not tello_system.is_connected:
        return StreamingResponse(io.BytesIO(b""), media_type="image/jpeg")

    frame = tello_system.drone.get_frame_read().frame
    if frame is None or frame.size == 0:
        return StreamingResponse(io.BytesIO(b""), media_type="image/jpeg")

    img = cv2.resize(frame, (360, 240))
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return StreamingResponse(io.BytesIO(buf.tobytes()), media_type="image/jpeg")


# ── Module 1 — Basic Flight ───────────────────────────────────────────────────

@router.post("/api/module1/sequence")
def run_flight_sequence(seq: CommandSequence):
    logger.info(f"[MODULE 1] Executing sequence: {seq.commands}")
    results = []
    for cmd in seq.commands:
        results.append(tello_system.execute_command(cmd))
        time.sleep(2.5)
    return {"message": "Sequence complete", "logs": results}


# NOTE: /rc must be registered before /{command} so it is not swallowed by the
# path-parameter route.
@router.post("/api/module1/rc")
async def execute_rc(cmd: RCCommand):
    return tello_system.send_rc_control(
        cmd.left_right, cmd.forward_backward, cmd.up_down, cmd.yaw
    )


@router.post("/api/module1/{command}")
def run_single_command(command: str):
    logger.info(f"[MODULE 1] Single command: {command}")
    return tello_system.execute_command(command)


# ── Module 2 — Landing Pad ────────────────────────────────────────────────────

@router.post("/api/module2/start")
def start_autonomous_landing():
    logger.info("[MODULE 2] Starting autonomous landing FSM")
    return tello_system.start_module_2()


@router.get("/api/module2/telemetry")
def get_module2_telemetry():
    return tello_system.get_module_2_telemetry()


# ── Module 3 — Alphabet Hovering ─────────────────────────────────────────────

@router.post("/api/module3/start")
def start_alphabet_hovering(payload: WordPayload):
    logger.info(f"[MODULE 3] Starting for word: {payload.word}")
    return tello_system.start_module_3(payload.word)


@router.get("/api/module3/telemetry")
def get_module3_telemetry():
    return tello_system.get_module_3_telemetry()


# ── Module 4 — Shortest Path Navigation ──────────────────────────────────────

@router.post("/api/module4/start")
def start_shortest_path(payload: WordPayload):
    logger.info(f"[MODULE 4] Starting navigation for word: {payload.word}")
    return tello_system.start_module_4(payload.word)


@router.get("/api/module4/telemetry")
def get_module4_telemetry():
    return tello_system.get_module_4_telemetry()


# ── Module 5 — Swarm / Routine ────────────────────────────────────────────────

@router.post("/api/module5/start")
def start_module5():
    logger.info("[MODULE 5] Starting routine")
    return tello_system.start_module_5()


@router.post("/api/module5/stop")
def stop_module5():
    logger.info("[MODULE 5] Stopping routine")
    return tello_system.stop_module_5()


@router.get("/api/module5/telemetry")
def get_module5_telemetry():
    return tello_system.get_module_5_telemetry()
