"""todo_service.py"""

import logging
import os
import sys
from datetime import date

logger = logging.getLogger(__name__)

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ML_SCRIPTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner")
if ML_SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, ML_SCRIPTS_DIR)

_build_todo_list = None
try:
    from generate_todo_output import build_todo_list as _build_todo_list  # noqa: E402
    logger.info("todo_service: imported build_todo_list from ml_scripts/study-planner/generate_todo_output.py")
except FileNotFoundError as e:
    logger.error("todo_service: STARTUP ERROR - could not find generate_todo_output.py: %s", e)
except Exception:
    logger.exception("todo_service: STARTUP ERROR - failed to import build_todo_list.")


class TodoServiceError(Exception):
    """Raised for validation failures or when the to-do formatting logic failed to load at startup."""


def get_todo_list(schedule_result: dict, today: date = None) -> list:
    """schedule_result"""
    if _build_todo_list is None:
        raise TodoServiceError("To-do formatting logic is not available - check server startup logs.")

    try:
        return _build_todo_list(schedule_result, today=today)
    except ValueError as e:
        raise TodoServiceError(str(e))
