import logging
from fastapi import APIRouter

from gemini_service import analyze_student_code
from models import CodeSubmission

router = APIRouter(tags=["ai"])
logger = logging.getLogger(__name__)


@router.post("/api/validate_code")
def validate_code(submission: CodeSubmission):
    logger.info(f"[AI] Validating module {submission.module_id} code for user {submission.user_id}")
    result = analyze_student_code(submission.module_id, submission.code)

    if result["is_correct"]:
        logger.info(f"[AI] Code correct — module {submission.module_id} passed")
        return {"status": "success", "is_correct": True, "feedback": result["feedback"]}

    logger.info(f"[AI] Code incorrect — returning hints for module {submission.module_id}")
    return {"status": "failed", "is_correct": False, "feedback": result["feedback"]}
