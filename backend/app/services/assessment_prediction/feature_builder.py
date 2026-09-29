"""
Leakage-free previous-score feature computation for assessment-score
serving.

Reproduces EXACTLY the definition ml_scripts/journal/assessment_score/data_prep.py
used at training time (see that file's add_previous_score_features()):
  - Only assessments with a STRICTLY earlier date count as "previous" -
    same-date assessments never count toward each other.
  - prev_mean = mean of every individual earlier mark (each earlier
    assessment weighted equally - NOT a mean of per-date means; two marks
    tied on one earlier date each contribute their own value to the mean).
  - prev_last = the mark at the most recent strictly-earlier date. If that
    date itself has more than one tied mark, the training data broke the
    tie by smallest id_assessment (OULAD's own row ordering). The journal
    has no id_assessment equivalent, so this ties to ascending MongoDB `id`
    (ObjectId, monotonically increasing by creation time) instead - the
    closest available analogue. Documented as an assumption in the README.

This module has NO database access and NO FastAPI/Pydantic dependency, so it
is trivially unit-testable and directly comparable against data_prep.py in a
parity test.
"""

from datetime import date, datetime

from app.services.journal.journal_constants import parse_letter_grade
from app.config.assessment_prediction_settings import LETTER_GRADE_TO_PERCENT


def to_date(value) -> date | None:
    """Normalize an ISO date/datetime string, date, or datetime to a date. None if unusable."""
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value).strip()
    if not text:
        return None
    try:
        # Handles both plain "YYYY-MM-DD" and full ISO datetime strings.
        return datetime.fromisoformat(text[:19]).date() if len(text) > 10 else date.fromisoformat(text[:10])
    except ValueError:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            return None


def mark_to_numeric(raw_mark) -> float | None:
    """
    Converts a stored mark to a 0-100 number, or None if it can't be used.
    - A number (or numeric string) is used as-is.
    - A letter grade is normalized via parse_letter_grade() then looked up in
      LETTER_GRADE_TO_PERCENT (the assumed conversion - see config module).
    - Anything else (None, empty, unparseable) is excluded.
    """
    if raw_mark is None or raw_mark == "":
        return None
    if isinstance(raw_mark, (int, float)):
        return float(raw_mark)
    text = str(raw_mark).strip()
    try:
        return float(text)
    except ValueError:
        pass
    letter = parse_letter_grade(text)
    if letter is not None:
        return LETTER_GRADE_TO_PERCENT.get(letter)
    return None


def build_previous_score_records(
    raw_marks: list[dict], subject: str, exclude_id: str | None, date_field: str
) -> list[dict]:
    """
    raw_marks: raw exam/task-shaped dicts (as returned by ExamModel.find_by_user /
    TaskModel.find_by_user), each with at least "id", "subject", "mark", and a
    date-like field named `date_field` ("date" for exams, "deadline" for tasks).

    Applies every filter EXCEPT the strictly-earlier-date rule (that part is
    compute_previous_score_features's job): same subject only, excludes
    `exclude_id` (the assessment being predicted, so it never uses itself as
    its own history), excludes rows with no usable date, and excludes rows
    whose mark can't be converted to a number (via mark_to_numeric - so an
    unparseable value is silently dropped from history, not an error).

    Pure / DB-free - takes already-fetched documents, does no I/O itself.
    """
    out = []
    for doc in raw_marks:
        if str(doc.get("subject") or "") != subject:
            continue
        doc_id = str(doc.get("id") or doc.get("_id") or "")
        if exclude_id and doc_id == str(exclude_id):
            continue
        d = to_date(doc.get(date_field))
        if d is None:
            continue
        numeric = mark_to_numeric(doc.get("mark"))
        if numeric is None:
            continue
        out.append({"date": d, "mark": numeric, "id": doc_id})
    return out


def compute_previous_score_features(records: list[dict], target_date) -> tuple[float | None, float | None, int]:
    """
    records: list of {"date": <date-like>, "mark": <already-numeric 0-100 float>, "id": <str>}
             (caller is responsible for excluding the target itself, undated
             rows, and unparseable marks BEFORE calling this - this function
             only applies the strictly-earlier-date / tie-break rules).
    target_date: date-like value for the assessment being predicted.

    Returns (prev_mean, prev_last, prev_count). (None, None, 0) if there is
    no strictly-earlier record.
    """
    target = to_date(target_date)
    if target is None:
        raise ValueError("target_date is required and must be a usable date")

    earlier = []
    for r in records:
        d = to_date(r["date"])
        if d is None or d >= target:
            continue
        earlier.append({"date": d, "mark": float(r["mark"]), "id": str(r["id"])})

    prev_count = len(earlier)
    if prev_count == 0:
        return None, None, 0

    prev_mean = sum(r["mark"] for r in earlier) / prev_count

    max_date = max(r["date"] for r in earlier)
    tied_at_max = [r for r in earlier if r["date"] == max_date]
    tied_at_max.sort(key=lambda r: r["id"])
    prev_last = tied_at_max[0]["mark"]

    return prev_mean, prev_last, prev_count
