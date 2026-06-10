import os
import secrets
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from bson.objectid import ObjectId

from database import get_user_collection, db
from models import UserSignup, UserLogin, ForgotPasswordRequest, ResetPasswordRequest, UserUpdate
from security import hash_password, verify_password, create_access_token
from services import log_activity, sync_user_modules
from email_service import send_reset_email

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)


@router.post("/signup")
async def signup(user: UserSignup):
    collection = get_user_collection()
    logger.info(f"[SIGNUP] Request received: {user.username}")

    existing_user = await collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    hashed_pwd = hash_password(user.password)
    role = "admin" if "admin" in user.username.lower() else "learner"

    new_user_data = {
        "username": user.username,
        "email": user.email,
        "password": hashed_pwd,
        "role": role,
        "last_updated_at": datetime.utcnow(),
        "avatar": ""
    }

    if role == "learner":
        new_user_data["modules"] = {
            "1": {"status": "active",  "score": 0},
            "2": {"status": "locked",  "score": 0},
            "3": {"status": "locked",  "score": 0},
            "4": {"status": "locked",  "score": 0},
            "5": {"status": "locked",  "score": 0},
        }

    try:
        result = await collection.insert_one(new_user_data)
        await log_activity(str(result.inserted_id), "ACCOUNT_CREATED", "Joined the Flight Academy")
        token = create_access_token({"sub": str(result.inserted_id)})
        return {
            "status": "success",
            "msg": "User created successfully!",
            "token": token,
            "user": {
                "id": str(result.inserted_id),
                "username": user.username,
                "email": user.email,
                "role": role
            }
        }
    except Exception as e:
        logger.error(f"❌ [SIGNUP] Failed to insert user: {e}")
        raise HTTPException(status_code=500, detail="Failed to create user")


@router.post("/login")
async def login(user: UserLogin):
    collection = get_user_collection()
    db_user = await collection.find_one({"username": user.username})

    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await sync_user_modules(str(db_user["_id"]))

    access_token = create_access_token(data={"sub": str(db_user["_id"])})
    logger.info(f"✅ [LOGIN] Success: {user.username} ({db_user.get('role', 'learner')})")

    response = {
        "status": "success",
        "token": access_token,
        "username": db_user["username"],
        "id": str(db_user["_id"]),
        "role": db_user.get("role", "learner")
    }
    if "modules" in db_user:
        response["modules"] = db_user["modules"]
    return response


@router.get("/me/{username}")
async def get_current_user_legacy(username: str):
    collection = get_user_collection()
    user = await collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "status": "success",
        "username": user.get("username"),
        "email": user.get("email"),
        "id": str(user["_id"]),
        "modules": user.get("modules", {}),
        "avatar": user.get("avatar", "")
    }


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    collection = get_user_collection()
    user = await collection.find_one({"email": req.email})

    # Do not reveal whether the email exists (prevents user enumeration)
    if not user:
        return {"status": "success", "message": "If that email matches an account, a reset link has been sent."}

    reset_token = secrets.token_urlsafe(32)
    expiration = datetime.utcnow() + timedelta(hours=1)
    await db.PasswordResets.insert_one({
        "email": req.email,
        "token": reset_token,
        "expires_at": expiration
    })

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    try:
        await send_reset_email(req.email, reset_link)
    except Exception as e:
        logger.error(f"❌ [EMAIL] Failed to send reset email to {req.email}: {e}")
        # Token is already saved — user can retry; don't expose the error externally

    return {"status": "success", "message": "If that email matches an account, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    reset_record = await db.PasswordResets.find_one({"token": req.token})
    if not reset_record or reset_record["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    collection = get_user_collection()
    await collection.update_one(
        {"email": reset_record["email"]},
        {"$set": {"password": hash_password(req.new_password)}}
    )
    await db.PasswordResets.delete_many({"email": reset_record["email"]})
    return {"status": "success", "message": "Password has been successfully reset."}


@router.put("/users/{user_id}")
async def update_user_profile(user_id: str, update_data: UserUpdate):
    collection = get_user_collection()
    try:
        user_obj_id = ObjectId(user_id)
        existing_user = await collection.find_one({"_id": user_obj_id})
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")

        update_dict = {}

        if update_data.username and update_data.username != existing_user.get("username"):
            if await collection.find_one({"username": update_data.username}):
                raise HTTPException(status_code=400, detail="Username is already taken.")
            update_dict["username"] = update_data.username

        if update_data.email and update_data.email != existing_user.get("email"):
            if await collection.find_one({"email": update_data.email}):
                raise HTTPException(status_code=400, detail="Email is already registered.")
            update_dict["email"] = update_data.email

        if update_data.password:
            update_dict["password"] = hash_password(update_data.password)

        if update_data.avatar:
            update_dict["avatar"] = update_data.avatar

        if update_dict:
            await collection.update_one({"_id": user_obj_id}, {"$set": update_dict})
            updated_user = await collection.find_one({"_id": user_obj_id})
            if not updated_user:
                raise HTTPException(status_code=500, detail="Error retrieving updated user data.")
            return {
                "status": "success",
                "message": "Profile updated successfully.",
                "username": updated_user.get("username"),
                "avatar": updated_user.get("avatar")
            }

        return {"status": "success", "message": "No changes were made."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [PROFILE] Update error: {e}")
        raise HTTPException(status_code=500, detail="Database error updating profile.")
