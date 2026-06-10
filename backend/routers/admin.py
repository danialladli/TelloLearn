import logging
from fastapi import APIRouter, HTTPException
from bson.objectid import ObjectId

from database import get_user_collection, get_module_collection
from models import ModuleDefinition

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)


@router.get("/users")
async def get_all_users():
    """Fetch all user accounts for the Admin Dashboard."""
    collection = get_user_collection()
    users = []
    async for user in collection.find({}):
        users.append({
            "id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "role": user.get("role", "learner")
        })
    return users


@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Delete a learner account."""
    collection = get_user_collection()
    result = await collection.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 1:
        return {"status": "success", "message": "User deleted"}
    raise HTTPException(status_code=404, detail="User not found")


@router.post("/modules")
async def create_module(module: ModuleDefinition):
    """Create or update a module definition (upsert by module id)."""
    collection = get_module_collection()
    await collection.update_one(
        {"id": module.id},
        {"$set": module.model_dump()},
        upsert=True
    )
    return {"status": "success", "message": f"Module {module.id} saved"}


@router.delete("/modules/{module_id}")
async def delete_module(module_id: str):
    """Delete a module and re-index the IDs of all subsequent modules."""
    module_collection = get_module_collection()

    result = await module_collection.delete_one({"id": module_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Module not found")

    all_modules = await module_collection.find({}).to_list(length=1000)
    deleted_id_int = int(module_id)
    for mod in all_modules:
        try:
            current_id_int = int(mod["id"])
            if current_id_int > deleted_id_int:
                new_id = str(current_id_int - 1)
                await module_collection.update_one(
                    {"_id": mod["_id"]},
                    {"$set": {"id": new_id}}
                )
                logger.info(f"[ADMIN] Re-indexed module {current_id_int} → {new_id}")
        except ValueError:
            continue

    return {"status": "success", "message": "Module deleted and IDs re-indexed"}
