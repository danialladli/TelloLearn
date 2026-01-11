from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from datetime import datetime, timedelta
from jose import jwt, JWTError

# --- CONFIGURATION ---
# CHANGE THIS to a random secret string for production!
SECRET_KEY = "your_super_secret_key_change_this" 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Initialize the hasher with default security parameters
ph = PasswordHasher()

# --- PASSWORD FUNCTIONS ---
def hash_password(password: str) -> str:
    """
    Hashes a password using Argon2.
    """
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies the password. Returns True if valid, False otherwise.
    """
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, Exception):
        return False

# --- JWT TOKEN FUNCTIONS (NEW) ---
def create_access_token(data: dict):
    """
    Creates a JWT token that stores user ID and expires in 30 days.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str):
    """
    Decodes the token to get the payload (User ID).
    Returns None if token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None