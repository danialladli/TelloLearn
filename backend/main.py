from fastapi import FastAPI, HTTPException
from djitellopy import Tello
import logging
from fastapi.middleware.cors import CORSMiddleware
from security import hash_password, verify_password

from database import get_user_collection
from models import UserSignup, UserLogin, UserInDB

#Initialize app
app = FastAPI()

# Global Tello object
tello = Tello()

# --- 1. CONFIGURE CORS ---
# This tells the server: "Allow requests from React running on these ports"
origins = [
    "http://localhost:5173", # Vite (React) default port
    "http://127.0.0.1:5173",
    "http://localhost:3000", # Common React port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Who can talk to this server?
    allow_credentials=True,
    allow_methods=["*"],         # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],         # Allow all headers
)

@app.on_event("startup")
async def startup_event():
    """Connect to the Tello drone on startup."""
    try:
        tello.connect()
        logging.info("Tello drone connected successfully.")
    except Exception as e:
        logging.error(f"Failed to connect to Tello drone: {e}")

@app.get("/")
def read_root():
    return {"status": "Ground Station Online", "project": "Tello FYP"}

# --- 1. SIGN UP ENDPOINT ---
@app.post("/api/auth/signup")
async def signup(user: UserSignup):
    collection = get_user_collection()
    
    # Check if user exists
    existing_user = await collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    # [SECURITY UPGRADE] Hash the password before saving!
    hashed_pwd = hash_password(user.password)

    new_user_data = UserInDB(
        username=user.username,
        email=user.email,
        password=hashed_pwd  # <--- Save the Hash, NOT the plain text
    )
    
    await collection.insert_one(new_user_data.model_dump())
    
    return {"msg": "User created successfully!", "username": user.username}

# --- 2. LOG IN ENDPOINT ---
@app.post("/api/auth/login")
async def login(user: UserLogin):
    collection = get_user_collection()
    
    # 1. Find user by username
    db_user = await collection.find_one({"username": user.username})
    
    # 2. [SECURITY UPGRADE] Use the verify function
    # We check if db_user exists AND if the password matches the hash
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    return {
        "status": "success",
        "username": db_user["username"],
        "modules": db_user["modules"]
    }

# --- 3. GET USER MODULES (User-specific progress) ---
@app.get("/api/modules/{username}")
async def get_user_modules(username: str):
    collection = get_user_collection()
    user = await collection.find_one({"username": username})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Convert the DB structure into the List format your React Dashboard expects
    # This maps the database 'modules' to the UI cards
    module_descriptions = {
        "1": {"title": "Basic Flight", "desc": "Takeoff, land, and flips."},
        "2": {"title": "Landing Pad AI", "desc": "Precision landing using CV."},
        "3": {"title": "Alphabet Search", "desc": "Find letters using the camera."},
        "4": {"title": "Voice Command", "desc": "Control via microphone."},
        "5": {"title": "Swarm Control", "desc": "Synchronized flight."},
    }

    result = []
    for mod_id, mod_data in user["modules"].items():
        # Combine static description with dynamic DB status
        info = module_descriptions.get(mod_id, {})
        result.append({
            "id": mod_id,
            "title": info.get("title", "Unknown"),
            "description": info.get("desc", ""),
            "is_locked": mod_data["status"] == "locked",
            "status": mod_data["status"]
        })
    
    return result

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
    
@app.get("/api/user-progress")
def get_user_progress():
    # In a real app, you'd fetch this from MongoDB
    return {
        "username": "Pilot Ahmad",
        "level": 2,
        "completed_modules": ["Basic Flight"],
        "next_module": "Landing Pad Accuracy"
    }
    
# --- 4. GET ALL MODULES (Public list of available modules) ---
@app.get("/api/modules")
def get_all_modules():
    return [
        {"id": 1, "title": "Basic Flight", "description": "Takeoff, land, and flips.", "is_locked": False},
        {"id": 2, "title": "Landing Pad AI", "description": "Precision landing using CV.", "is_locked": True},
        {"id": 3, "title": "Alphabet Search", "description": "Find letters using the camera.", "is_locked": True},
        {"id": 4, "title": "Voice Command", "description": "Control via microphone.", "is_locked": True},
        {"id": 5, "title": "Swarm Control", "description": "Synchronized flight.", "is_locked": True},
    ]