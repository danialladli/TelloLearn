from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.exceptions import RequestValidationError
from djitellopy import Tello
import logging
from datetime import datetime
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from bson.objectid import ObjectId

# Import security functions (Updated)
from security import hash_password, verify_password, create_access_token, decode_access_token

from database import get_user_collection, client, db
from models import UserSignup, UserLogin, UserInDB, ProgressUpdate

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize app
app = FastAPI()

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

# --- 1. SIGN UP ENDPOINT (Updated with Token) ---
@app.post("/api/auth/signup")
async def signup(user: UserSignup):
    collection = get_user_collection()
    logger.info(f"[SIGNUP] Request received: {user.username}")
    
    # Check if user exists
    existing_user = await collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    hashed_pwd = hash_password(user.password)

    # Create new user with timestamp
    new_user_data = UserInDB(
        username=user.username,
        email=user.email,
        password=hashed_pwd,
        last_updated_at=datetime.utcnow() 
    )
    
    try:
        result = await collection.insert_one(new_user_data.model_dump())
        
        # [NEW] Generate Token immediately so user is logged in
        token = create_access_token({"sub": str(result.inserted_id)})
        
        return {
            "status": "success",
            "msg": "User created successfully!",
            "token": token,
            "user": {
                "id": str(result.inserted_id),
                "username": user.username,
                "email": user.email
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
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # 2. Verify Password
    if not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # 3. [NEW] Generate JWT Token
    access_token = create_access_token(data={"sub": str(db_user["_id"])})
    
    logger.info(f"✅ [LOGIN] Success: {user.username}")
    
    return {
        "status": "success",
        "token": access_token, # Mobile uses this
        "username": db_user["username"],
        "id": str(db_user["_id"]),
        "modules": db_user["modules"]
    }

# --- 3. [NEW] SYNC ENDPOINT (Mobile Specific) ---
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
        "last_updated_at": user.get("last_updated_at", datetime.utcnow())
    }

# --- 4. UPDATE PROGRESS (Updated Timestamp) ---
@app.post("/api/update-progress")
async def update_progress(update: ProgressUpdate):
    collection = get_user_collection()
    
    try:
        user_obj_id = ObjectId(update.user_id)
        
        # 1. Fetch User
        user = await collection.find_one({"_id": user_obj_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # 2. Update Status AND Timestamp
        logger.info(f"[UPDATE] Marking Module {update.module_id} complete for {user['username']}")
        
        await collection.update_one(
            {"_id": user_obj_id},
            {
                "$set": {
                    f"modules.{update.module_id}.status": "completed",
                    "last_updated_at": datetime.utcnow() # [NEW]
                }
            }
        )
        
        # 3. Unlock Next Module
        next_module_id = str(int(update.module_id) + 1)
        if int(next_module_id) <= 5:
            await collection.update_one(
                {"_id": user_obj_id},
                {
                    "$set": {
                        f"modules.{next_module_id}.status": "active",
                        "last_updated_at": datetime.utcnow()
                    }
                }
            )
            return {"status": "success", "message": f"Module {next_module_id} unlocked!"}
        
        return {"status": "success", "message": "All modules completed!"}
    
    except Exception as e:
        logger.error(f"❌ [UPDATE] Error: {e}")
        raise HTTPException(status_code=500, detail="Database error")

# --- EXISTING PUBLIC ENDPOINTS (Web/Public) ---

@app.get("/api/modules")
def get_all_modules():
    return [
        {"id": 1, "title": "Basic Flight", "description": "Takeoff, land, and flips.", "is_locked": False},
        {"id": 2, "title": "Landing Pad AI", "description": "Precision landing using CV.", "is_locked": True},
        {"id": 3, "title": "Alphabet Search", "description": "Find letters using the camera.", "is_locked": True},
        {"id": 4, "title": "Voice Command", "description": "Control via microphone.", "is_locked": True},
        {"id": 5, "title": "Swarm Control", "description": "Synchronized flight.", "is_locked": True},
    ]

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

# Legacy endpoint for web compatibility (if needed)
@app.get("/api/auth/me/{username}")
async def get_current_user_legacy(username: str):
    collection = get_user_collection()
    user = await collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "status": "success",
        "username": user["username"],
        "email": user["email"],
        "id": str(user["_id"]),
        "modules": user["modules"]
    }