from pydantic import BaseModel, EmailStr, Field
from typing import Dict, Optional

# --- SUB-MODELS (Helper parts) ---
class ModuleProgress(BaseModel):
    status: str = "locked"  # Options: locked, active, completed
    score: int = 0

# --- MAIN MODELS ---

# 1. UserSchema: This is what we store in MongoDB
class UserInDB(BaseModel):
    username: str
    email: EmailStr
    password: str  # In a real app, this should be hashed!
    modules: Dict[str, ModuleProgress] = {
        "1": ModuleProgress(status="active"),   # Module 1 starts open
        "2": ModuleProgress(status="locked"),
        "3": ModuleProgress(status="locked"),
        "4": ModuleProgress(status="locked"),
        "5": ModuleProgress(status="locked"),
    }

# 2. UserSignup: This is what React sends to register
class UserSignup(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(..., min_length=6)  # Min 6 chars, no max (server will truncate to 72 bytes)

# 3. UserLogin: This is what React sends to login
class UserLogin(BaseModel):
    username: str
    password: str = Field(..., max_length=50)