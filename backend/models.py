from pydantic import BaseModel, EmailStr, Field
from typing import Dict, Optional, List
from datetime import datetime

# --- SUB-MODELS (Helper parts) ---
class ModuleProgress(BaseModel):
    status: str = "locked"  # Options: locked, active, completed
    score: int = 0

# --- MODULE DEFINITION (For Admin CRUD) ---
class ModuleDefinition(BaseModel):
    id: str  # e.g., "1", "2"
    title: str
    description: str
    video_url: Optional[str] = None
    docs: Optional[str] = None
    default_code: Optional[str] = None
    is_active: bool = True
    image_data: Optional[str] = None

# --- MAIN MODELS ---

# 1. UserSchema: This is what we store in MongoDB
class UserInDB(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "learner"  # [NEW] 'admin' or 'learner'
    last_updated_at: datetime = Field(default_factory=datetime.utcnow)
    modules: Optional[Dict[str, ModuleProgress]] = None

# 2. UserSignup: This is what React sends to register
class UserSignup(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(..., min_length=6) 

# 3. UserLogin: This is what React sends to login
class UserLogin(BaseModel):
    username: str
    password: str = Field(..., max_length=50)

class ProgressUpdate(BaseModel):
    user_id: str
    module_id: int

class ActivityLog(BaseModel):
    user_id: str
    action: str      # e.g., "ACCOUNT_CREATED", "MODULE_STARTED", "MODULE_COMPLETED"
    details: str     # e.g., "Module 1", "Welcome to TelloLearn"
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class LogRequest(BaseModel):
    action: str
    details: str