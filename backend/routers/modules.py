import logging
from fastapi import APIRouter

from database import get_module_collection

router = APIRouter(prefix="/api/modules", tags=["modules"])
logger = logging.getLogger(__name__)


@router.get("")
async def get_modules():
    """Return all module definitions from the database."""
    collection = get_module_collection()
    modules = []
    async for mod in collection.find({}):
        mod["_id"] = str(mod["_id"])
        modules.append(mod)
    return modules
