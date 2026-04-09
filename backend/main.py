from fastapi import FastAPI, HTTPException, Depends, Header, Body
from fastapi.exceptions import RequestValidationError
from djitellopy import Tello
import logging
import secrets
from datetime import datetime, timedelta
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from bson.objectid import ObjectId

# Import security functions (Updated)
from security import hash_password, verify_password, create_access_token, decode_access_token
from database import get_activity_collection, get_user_collection, get_module_collection, client, db
from models import LogRequest, UserSignup, UserLogin, UserInDB, ProgressUpdate, ModuleDefinition, ForgotPasswordRequest, ResetPasswordRequest, UserUpdate

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize app
app = FastAPI()

# Mount static files (web-app assets) to the network.
app.mount("/assets", StaticFiles(directory="../web-app/assets"), name="assets")

# Global Tello object
tello = Tello()

# --- VALIDATION ERROR HANDLER ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.error(f"❌ [VALIDATION ERROR] Invalid request data")
    return {
        "status": "error",
        "message": "Invalid request data",
        "errors": exc.errors()
    }

# --- CORS ---
origins = [
    "http://localhost:5173", # Vite (React) default port
    "http://127.0.0.1:5173",
    "http://localhost:3000", # Common React port
    "*"                      # Allow mobile app connections
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DEPENDENCY: VERIFY TOKEN (NEW) ---
# This helper function protects routes for Mobile App usage
async def get_current_user_id(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Token")
    
    # Token usually comes as "Bearer <token>"
    try:
        token = authorization.split(" ")[1] 
        payload = decode_access_token(token)
        if payload is None or "sub" not in payload:
            raise HTTPException(status_code=401, detail="Invalid Token")
        return payload["sub"] # Returns the User ID from the token
    except Exception:
        raise HTTPException(status_code=401, detail="Malformed Token")
    
async def sync_user_modules(user_id: str):
    """
    Checks for missing modules in the user's profile and adds them.
    Also handles 'Auto-Unlock' if the previous module is complete.
    """
    user_collection = get_user_collection()
    module_collection = get_module_collection()

    # 1. Get the User and All Module Definitions
    user = await user_collection.find_one({"_id": ObjectId(user_id)})
    all_modules = await module_collection.find({}).to_list(length=100)
    
    if not user:
        return

    user_modules = user.get("modules", {})
    updates = {}
    has_changes = False

    # 2. Iterate through ALL defined modules
    for mod in all_modules:
        mod_id = str(mod["id"]) # Ensure ID is string
        
        # If this module is MISSING from the user's data
        if mod_id not in user_modules:
            has_changes = True
            
            # --- DETERMINE STATUS ---
            # Default to locked
            new_status = "locked"
            
            # Logic: If it's Module 1, it's always Active.
            if mod_id == "1":
                new_status = "active"
            else:
                # Check previous module (Current ID - 1)
                # We assume IDs are numeric strings "1", "2", "3"...
                try:
                    prev_id = str(int(mod_id) - 1)
                    # Get status of previous module from USER data (or updates dict if we just added it)
                    prev_status = user_modules.get(prev_id, {}).get("status")
                    
                    # If previous is done, UNLOCK this one!
                    if prev_status == "completed":
                        new_status = "active"
                except:
                    pass # Fallback to locked if ID math fails
            
            # Prepare the update
            # We treat the new entry as a ModuleProgress dict
            updates[f"modules.{mod_id}"] = {
                "status": new_status,
                "score": 0
            }

    # 3. Write to Database (Only if needed)
    if has_changes:
        logger.info(f"[SYNC] Updating user {user['username']} with {len(updates)} new modules.")
        await user_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": updates}
        )

@app.on_event("startup")
async def startup_event():
    """Connect to the Tello drone and MongoDB on startup."""
    # Test MongoDB Connection
    try:
        await client.admin.command('ping')
        logger.info("✅ [DATABASE] MongoDB connection successful!")
    except Exception as e:
        logger.error(f"❌ [DATABASE] MongoDB connection failed: {e}")
    
    # Connect Tello Drone
    try:
        tello.connect()
        logger.info("✅ [DRONE] Tello drone connected successfully.")
    except Exception as e:
        logger.warning(f"⚠️ [DRONE] Failed to connect to Tello drone: {e}")

@app.get("/")
def read_root():
    return {"status": "Ground Station Online", "project": "Tello FYP"}

async def log_activity(user_id: str, action: str, details: str):
    collection = get_activity_collection() # Make sure to import this too!
    log_entry = {
        "user_id": user_id,
        "action": action,
        "details": details,
        "timestamp": datetime.utcnow()
    }
    await collection.insert_one(log_entry)

# --- 1. SIGN UP ENDPOINT (Updated with Token) ---
@app.post("/api/auth/signup")
async def signup(user: UserSignup):
    collection = get_user_collection()
    logger.info(f"[SIGNUP] Request received: {user.username}")
    
    # Check if user exists
    existing_user = await collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Hash the password
    hashed_pwd = hash_password(user.password)

    # Hack for demo: If username contains 'admin', make them admin
    role = "admin" if "admin" in user.username.lower() else "learner"

    # Create new user with timestamp
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
            "1": {"status": "active", "score": 0},
            "2": {"status": "locked", "score": 0},
            "3": {"status": "locked", "score": 0},
            "4": {"status": "locked", "score": 0},
            "5": {"status": "locked", "score": 0},
        }
    
    try:
        result = await collection.insert_one(new_user_data)
        # Log the activity
        await log_activity(str(result.inserted_id), "ACCOUNT_CREATED", "Joined the Flight Academy")
        
        # Generate Token immediately so user is logged in
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

# --- 2. LOG IN ENDPOINT (Updated with Token) ---
@app.post("/api/auth/login")
async def login(user: UserLogin):
    collection = get_user_collection()
    
    # 1. Find user
    db_user = await collection.find_one({"username": user.username})

    # 2. Verify password
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # --- SYNC MODULES BEFORE RETURNING RESPONSE ---
    await sync_user_modules(str(db_user["_id"]))
    
    # 3. [NEW] Generate JWT Token
    access_token = create_access_token(data={"sub": str(db_user["_id"])})
    
    logger.info(f"✅ [LOGIN] Success: {user.username} ({db_user.get('role', 'learner')})")
    
    response = {
        "status": "success",
        "token": access_token,
        "username": db_user["username"],
        "id": str(db_user["_id"]),
        "role": db_user.get("role", "learner")
    }

    # 4. Only attach modules if they exist (Admins won't have them)
    if "modules" in db_user:
        response["modules"] = db_user["modules"]

    return response

# --- 3. SYNC ENDPOINT (Mobile Specific) ---
@app.get("/api/user/sync")
async def sync_user_data(user_id: str = Depends(get_current_user_id)):
    """
    Called by Mobile App on launch.
    Uses the Token to securely fetch fresh data.
    """
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

# --- 4. UPDATE PROGRESS (Updated Timestamp) ---
@app.post("/api/update-progress")
async def update_progress(update: ProgressUpdate):
    user_collection = get_user_collection()
    module_collection = get_module_collection()
    
    try:
        user_obj_id = ObjectId(update.user_id)
        user = await user_collection.find_one({"_id": user_obj_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # --- 1. ALWAYS UPDATE STATUS ---
        await user_collection.update_one(
            {"_id": user_obj_id},
            {
                "$set": {
                    f"modules.{update.module_id}.status": "completed",
                    "last_updated_at": datetime.utcnow()
                }
            }
        )
        
        # --- 2. ALWAYS LOG ACTIVITY (The Fix) ---
        # We removed the 'if current_status != completed' check.
        # If the user put in the effort to pass the code again, we record it.
        # Ensure you have the log_activity helper imported!
        await log_activity(
            update.user_id, 
            "MODULE_COMPLETED", 
            f"Completed Module {update.module_id}"
        )

        # --- 3. UNLOCK NEXT MODULE ---
        next_module_id = str(int(update.module_id) + 1)
        next_module_exists = await module_collection.find_one({"id": next_module_id})

        if next_module_exists:
            next_mod_status = user.get("modules", {}).get(next_module_id, {}).get("status", "locked")
            
            if next_mod_status == "locked":
                logger.info(f"[UPDATE] Unlocking Module {next_module_id}")
                await user_collection.update_one(
                    {"_id": user_obj_id},
                    {
                        "$set": {
                            f"modules.{next_module_id}.status": "active",
                            "last_updated_at": datetime.utcnow()
                        }
                    }
                )
                return {
                    "status": "success", 
                    "message": f"Module {next_module_id} unlocked!", 
                    "next_module_unlocked": next_module_id
                }
        
        return {"status": "success", "message": "Mission Recorded", "next_module_unlocked": None}
    
    except Exception as e:
        logger.error(f"❌ [UPDATE] Error: {e}")
        raise HTTPException(status_code=500, detail="Database error")

# --- EXISTING PUBLIC ENDPOINTS (Web/Public) ---

@app.get("/api/modules")
async def get_modules():
    """Get all module definitions (Merged from DB)"""
    collection = get_module_collection()
    modules_cursor = collection.find({})
    modules = []
    async for mod in modules_cursor:
        mod["_id"] = str(mod["_id"])
        modules.append(mod)

    return modules

"""
@app.get("/api/modules")
def get_all_modules():
    return [
        {"id": 1, "title": "Basic Flight", "description": "Takeoff, land, and flips.", "is_locked": False},
        {"id": 2, "title": "Landing Pad AI", "description": "Precision landing using CV.", "is_locked": True},
        {"id": 3, "title": "Alphabet Search", "description": "Find letters using the camera.", "is_locked": True},
        {"id": 4, "title": "Voice Command", "description": "Control via microphone.", "is_locked": True},
        {"id": 5, "title": "Swarm Control", "description": "Synchronized flight.", "is_locked": True},
    ]
"""

@app.get("/drone/status")
def get_status():
    try:
        return {
            "battery": tello.get_battery(),
            "temp": tello.get_temperature(),
            "flying": tello.is_flying
        }
    except:
        return {"error": "Drone disconnected"}
    
# --- ADMIN ENDPOINTS ---

# Read all users (for Admin Dashboard)
@app.get("/api/admin/users")
async def get_all_users():
    """Fetch all users for the Admin Dashboard"""
    collection = get_user_collection()
    users_cursor = collection.find({})
    users = []
    async for user in users_cursor:
        users.append({
            "id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "role": user.get("role", "learner")
        })
    return users

# Delete a user (for Admin Dashboard)
@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: str):
    """Delete a Learner"""
    collection = get_user_collection()
    result = await collection.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 1:
        return {"status": "success", "message": "User deleted"}
    raise HTTPException(status_code=404, detail="User not found")

# Create a new module (for Admin Dashboard)
@app.post("/api/admin/modules")
async def create_module(module: ModuleDefinition):
    """Create or Update a Module"""
    collection = get_module_collection()
    # Upsert based on ID
    await collection.update_one(
        {"id": module.id}, 
        {"$set": module.model_dump()}, 
        upsert=True
    )
    return {"status": "success", "message": f"Module {module.id} saved"}

# Delete a module (for Admin Dashboard)
@app.delete("/api/admin/modules/{module_id}")
async def delete_module(module_id: str):
    module_collection = get_module_collection()
    
    # 1. Delete the specific module
    result = await module_collection.delete_one({"id": module_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # 2. RE-INDEXING LOGIC
    # Find all modules with ID greater than the deleted one
    # We need to convert string IDs to integers for comparison
    
    # Fetch ALL modules
    all_modules = await module_collection.find({}).to_list(length=1000)
    
    # Filter for modules that need shifting (ID > deleted_id)
    deleted_id_int = int(module_id)
    
    for mod in all_modules:
        try:
            current_id_int = int(mod["id"])
            
            if current_id_int > deleted_id_int:
                # Calculate new ID (shift down by 1)
                new_id = str(current_id_int - 1)
                
                # Update the module in the database
                await module_collection.update_one(
                    {"_id": mod["_id"]},
                    {"$set": {"id": new_id}}
                )
                logger.info(f"Refactored Module {current_id_int} -> {new_id}")
                
        except ValueError:
            continue # Skip if ID is not a number
            
    return {"status": "success", "message": "Module deleted and IDs re-indexed"}

# --- ACTIVITY LOG ENDPOINTS ---

# Create a new activity log
@app.post("/api/activity/log")
async def create_log(log_data: LogRequest, user_id: str = Depends(get_current_user_id)):
    
    await log_activity(user_id, log_data.action, log_data.details)
    return {"status": "success"}

# Get activity logs for the current user
@app.get("/api/activity")
async def get_my_activity(user_id: str = Depends(get_current_user_id)):
    """Fetch timeline for the ViewProgress page"""
    collection = get_activity_collection()
    # Find logs for this user, Sort by Timestamp DESC (-1)
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

# Legacy endpoint for web compatibility (if needed)
@app.get("/api/auth/me/{username}")
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

# --- FORGOT PASSWORD ENDPOINTS ---
# --- 1. REQUEST RESET LINK ---
@app.post("/api/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    collection = get_user_collection()
    user = await collection.find_one({"email": req.email})
    
    # Security Best Practice: Do not reveal if the email exists or not to prevent user enumeration
    if not user:
        return {"status": "success", "message": "If that email matches an account, a reset link has been sent."}
    
    # Generate a secure 32-character token
    reset_token = secrets.token_urlsafe(32)
    expiration = datetime.utcnow() + timedelta(hours=1) # Token valid for 1 hour
    
    # Save token to a new collection in MongoDB
    await db.PasswordResets.insert_one({
        "email": req.email,
        "token": reset_token,
        "expires_at": expiration
    })
    
    # MOCK EMAIL: Print the link to the terminal so you can click it to test the frontend
    reset_link = f"http://localhost:5173/reset-password?token={reset_token}"
    print("\n" + "="*50)
    print(f"📧 EMAIL MOCK TO: {req.email}")
    print(f"🔗 Click here to reset your password: {reset_link}")
    print("="*50 + "\n")
    
    return {"status": "success", "message": "If that email matches an account, a reset link has been sent."}

# --- 2. CONFIRM NEW PASSWORD ---
@app.post("/api/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    # Find the token in the database
    reset_record = await db.PasswordResets.find_one({"token": req.token})
    
    # Check if token exists and hasn't expired
    if not reset_record or reset_record["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    
    # Hash the new password
    hashed_password = hash_password(req.new_password)
    
    # Update the user's password
    collection = get_user_collection()
    await collection.update_one(
        {"email": reset_record["email"]},
        {"$set": {"password": hashed_password}}
    )
    
    # Delete the used token (and any other old tokens for this email)
    await db.PasswordResets.delete_many({"email": reset_record["email"]})
    
    return {"status": "success", "message": "Password has been successfully reset."}

# --- UPDATE USER PROFILE ENDPOINT ---
@app.put("/api/auth/users/{user_id}")
async def update_user_profile(user_id: str, update_data: UserUpdate):
    collection = get_user_collection()
    
    try:
        user_obj_id = ObjectId(user_id)
        existing_user = await collection.find_one({"_id": user_obj_id})
        
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")

        update_dict = {}

        # 1. Check & Add Username
        if update_data.username and update_data.username != existing_user.get("username"):
            # Ensure the new username isn't taken
            username_check = await collection.find_one({"username": update_data.username})
            if username_check:
                raise HTTPException(status_code=400, detail="Username is already taken.")
            update_dict["username"] = update_data.username

        # 2. Check & Add Email
        if update_data.email and update_data.email != existing_user.get("email"):
            email_check = await collection.find_one({"email": update_data.email})
            if email_check:
                raise HTTPException(status_code=400, detail="Email is already registered.")
            update_dict["email"] = update_data.email

        # 3. Hash & Add Password
        if update_data.password:
            # Assuming you are using the hash_password function we discussed earlier
            update_dict["password"] = hash_password(update_data.password)

        # 4. Add Avatar
        if update_data.avatar:
            update_dict["avatar"] = update_data.avatar

        # 5. Execute Update
        if update_dict:
            await collection.update_one(
                {"_id": user_obj_id},
                {"$set": update_dict}
            )
            
            # Fetch the updated user to return fresh data
            updated_user = await collection.find_one({"_id": user_obj_id})
            
            return {
                "status": "success", 
                "message": "Profile updated successfully.",
                "username": updated_user.get("username"),
                "avatar": updated_user.get("avatar")
            }
        
        return {"status": "success", "message": "No changes were made."}

    except Exception as e:
        # If it's already an HTTPException (like our username taken error), raise it directly
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Profile update error: {e}")
        raise HTTPException(status_code=500, detail="Database error updating profile.")