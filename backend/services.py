import logging
from datetime import datetime
from bson.objectid import ObjectId
from database import get_activity_collection, get_user_collection, get_module_collection

logger = logging.getLogger(__name__)


async def log_activity(user_id: str, action: str, details: str) -> None:
    """Insert a single activity record into the activity collection."""
    collection = get_activity_collection()
    await collection.insert_one({
        "user_id": user_id,
        "action": action,
        "details": details,
        "timestamp": datetime.utcnow()
    })


async def sync_user_modules(user_id: str) -> None:
    """
    Ensures the user has a progress entry for every module defined in the DB.
    Auto-unlocks a module when the preceding one is marked completed.
    """
    user_collection = get_user_collection()
    module_collection = get_module_collection()

    user = await user_collection.find_one({"_id": ObjectId(user_id)})
    all_modules = await module_collection.find({}).to_list(length=100)

    if not user:
        return

    user_modules = user.get("modules", {})
    updates: dict = {}

    for mod in all_modules:
        mod_id = str(mod["id"])
        if mod_id in user_modules:
            continue

        new_status = "locked"
        if mod_id == "1":
            new_status = "active"
        else:
            try:
                prev_id = str(int(mod_id) - 1)
                prev_status = user_modules.get(prev_id, {}).get("status")
                if prev_status == "completed":
                    new_status = "active"
            except ValueError:
                pass

        updates[f"modules.{mod_id}"] = {"status": new_status, "score": 0}

    if updates:
        logger.info(f"[SYNC] Adding {len(updates)} missing module(s) to user '{user['username']}'")
        await user_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": updates}
        )
