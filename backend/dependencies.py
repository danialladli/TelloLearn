import logging
from fastapi import Header, HTTPException
from security import decode_access_token
from tello_manager import TelloManager

logger = logging.getLogger(__name__)

# Singleton drone manager — imported by routers that need drone access
tello_system = TelloManager()


async def get_current_user_id(authorization: str = Header(None)) -> str:
    """JWT dependency that protects mobile-app routes."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Token")
    try:
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload is None or "sub" not in payload:
            raise HTTPException(status_code=401, detail="Invalid Token")
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Malformed Token")
