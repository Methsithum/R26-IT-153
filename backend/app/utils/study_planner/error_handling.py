"""error_handling.py"""

import logging

from fastapi import HTTPException

logger = logging.getLogger(__name__)

_STARTUP_FAILURE_PHRASES = ("not loaded", "not available", "not initialized")


def service_error_to_http(exc: Exception) -> HTTPException:
    message = str(exc)
    if any(phrase in message for phrase in _STARTUP_FAILURE_PHRASES):
        logger.error("study-planner service error (startup/config issue): %s", message)
        return HTTPException(status_code=500, detail=message)
    return HTTPException(status_code=422, detail=message)
