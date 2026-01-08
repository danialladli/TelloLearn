from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# Initialize the hasher with default security parameters
ph = PasswordHasher()

def hash_password(password: str) -> str:
    """
    Hashes a password using Argon2.
    No need to slice/truncate; Argon2 handles long passwords automatically.
    """
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies the password.
    Returns True if valid, False otherwise.
    """
    try:
        # If the password is correct, this returns True.
        # If incorrect, it raises VerifyMismatchError.
        return ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False
    except Exception:
        # Safety net for corrupted hashes
        return False