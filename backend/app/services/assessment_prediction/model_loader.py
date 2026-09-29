"""
Lazy, thread-safe loader for the journal_compatible assessment-score bundle.

Loads ONLY assessment_score_journal_compatible.joblib - the full_oulad
bundle is research-only and is never referenced here. The bundle is a plain
dict of {model, features, conformal_q, alpha, feature_set, pass_mark,
trained_on, sklearn_version, trained_at} containing only sklearn/numpy/pandas
objects, so this module never imports anything from ml_scripts.
"""

import logging
import threading

import joblib
import sklearn

from app.config.assessment_prediction_settings import MODEL_PATH

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_bundle: dict | None = None
_load_error: str | None = None


class BundleNotFoundError(RuntimeError):
    """Raised when the joblib bundle file is missing. Route layer maps this to HTTP 503."""


def get_bundle() -> dict:
    """
    Returns the cached bundle, loading it on first call. Thread-safe (a
    concurrent request during the very first load will block briefly rather
    than double-load or race).
    """
    global _bundle, _load_error

    if _bundle is not None:
        return _bundle
    if _load_error is not None:
        raise BundleNotFoundError(_load_error)

    with _lock:
        if _bundle is not None:
            return _bundle
        if _load_error is not None:
            raise BundleNotFoundError(_load_error)

        if not MODEL_PATH.exists():
            _load_error = (
                f"Assessment-score model bundle not found at {MODEL_PATH}. "
                "Run the training pipeline in ml_scripts/journal/assessment_score/ first."
            )
            raise BundleNotFoundError(_load_error)

        bundle = joblib.load(MODEL_PATH)

        bundle_version = bundle.get("sklearn_version")
        installed_version = sklearn.__version__
        if bundle_version and bundle_version != installed_version:
            logger.warning(
                "assessment_score bundle was trained with scikit-learn %s but %s is installed - "
                "serving anyway, but predictions may differ slightly from training-time results.",
                bundle_version, installed_version,
            )

        _bundle = bundle
        return _bundle


def reset_cache_for_tests() -> None:
    """Test-only helper to clear the module-level cache between test cases."""
    global _bundle, _load_error
    with _lock:
        _bundle = None
        _load_error = None
