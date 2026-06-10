import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from bson.objectid import ObjectId

from database import get_user_collection
from dependencies import get_current_user_id

router = APIRouter(prefix="/api/user", tags=["users"])
logger = logging.getLogger(__name__)


@router.get("/sync")
async def sync_user_data(user_id: str = Depends(get_current_user_id)):
    """Called by the mobile app on launch to fetch fresh user data via JWT."""
    collection = get_user_collection()
    user = await collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "modules": user["modules"],
        "avatar": user.get("avatar", ""),
        "last_updated_at": user.get("last_updated_at", datetime.utcnow())
    }
