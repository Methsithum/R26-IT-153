"""
error_handling.py

Shared helper for turning study-planner service-layer exceptions into proper
HTTP responses, instead of letting them bubble up as raw 500 stack traces.

Convention used across all study-planner services: a *ServiceError raised
because the underlying model/logic failed to load at startup contains one of
a few recognizable phrases ("not loaded", "not available", "not initialized")
- those map to 500 (server misconfiguration, not the caller's fault).
Everything else raised by a *ServiceError is a caller input problem (missing
feature, bad type, malformed schedule state, etc.) and maps to 422.
"""

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
