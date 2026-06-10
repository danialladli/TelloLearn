import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from bson.objectid import ObjectId

from database import get_user_collection, get_module_collection, get_activity_collection
from models import ProgressUpdate, LogRequest
from dependencies import get_current_user_id
from services import log_activity

router = APIRouter(prefix="/api", tags=["progress"])
logger = logging.getLogger(__name__)


@router.post("/update-progress")
async def update_progress(update: ProgressUpdate):
    user_collection = get_user_collection()
    module_collection = get_module_collection()

    try:
        user_obj_id = ObjectId(update.user_id)
        user = await user_collection.find_one({"_id": user_obj_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        await user_collection.update_one(
            {"_id": user_obj_id},
            {"$set": {
                f"modules.{update.module_id}.status": "completed",
                "last_updated_at": datetime.utcnow()
            }}
        )
        await log_activity(update.user_id, "MODULE_COMPLETED", f"Completed Module {update.module_id}")

        next_module_id = str(int(update.module_id) + 1)
        next_module_exists = await module_collection.find_one({"id": next_module_id})
        if next_module_exists:
            next_mod_status = user.get("modules", {}).get(next_module_id, {}).get("status", "locked")
            if next_mod_status == "locked":
                logger.info(f"[PROGRESS] Unlocking Module {next_module_id}")
                await user_collection.update_one(
                    {"_id": user_obj_id},
                    {"$set": {
                        f"modules.{next_module_id}.status": "active",
                        "last_updated_at": datetime.utcnow()
                    }}
                )
                return {
                    "status": "success",
                    "message": f"Module {next_module_id} unlocked!",
                    "next_module_unlocked": next_module_id
                }

        return {"status": "success", "message": "Mission Recorded", "next_module_unlocked": None}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [PROGRESS] Error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/activity/log")
async def create_log(log_data: LogRequest, user_id: str = Depends(get_current_user_id)):
    await log_activity(user_id, log_data.action, log_data.details)
    return {"status": "success"}


@router.get("/activity")
async def get_my_activity(user_id: str = Depends(get_current_user_id)):
    """Fetch the activity timeline for the authenticated user."""
    collection = get_activity_collection()
    cursor = collection.find({"user_id": user_id}).sort("timestamp", -1)
    logs = []
    async for log in cursor:
        logs.append({
            "id": str(log["_id"]),
            "action": log["action"],
            "details": log["details"],
            "timestamp": log["timestamp"]
        })
    return logs
