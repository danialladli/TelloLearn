import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from database import client
from dependencies import tello_system
from routers import auth, users, modules, progress, admin, drone, ai

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(_):
    # Startup
    try:
        await client.admin.command("ping")
        logger.info("✅ [DATABASE] MongoDB connection successful!")
    except Exception as e:
        logger.error(f"❌ [DATABASE] MongoDB connection failed: {e}")

    try:
        tello_system.connect()
        logger.info("✅ [DRONE] Tello drone connected successfully.")
    except Exception as e:
        logger.warning(f"⚠️ [DRONE] Failed to connect to Tello drone: {e}")

    yield  # app runs here


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="TelloLearn Ground Station", version="1.0.0", lifespan=lifespan)

# ── Static files ──────────────────────────────────────────────────────────────
app.mount("/assets", StaticFiles(directory="../web-app/assets"), name="assets")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Error handlers ────────────────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError):
    logger.error("❌ [VALIDATION ERROR] Invalid request data")
    return JSONResponse(
        status_code=422,
        content={"status": "error", "message": "Invalid request data", "errors": exc.errors()}
    )

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(modules.router)
app.include_router(progress.router)
app.include_router(admin.router)
app.include_router(drone.router)
app.include_router(ai.router)

# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"status": "Ground Station Online", "project": "Tello FYP"}
