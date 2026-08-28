"""Campus calendar days use Asia/Colombo, not UTC."""

from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Optional

# Sri Lanka is permanently UTC+5:30 with no DST. ZoneInfo needs the `tzdata`
# package on Windows; fall back to a fixed offset if IANA data is missing.
try:
    from zoneinfo import ZoneInfo

    LOCAL_TZ = ZoneInfo("Asia/Colombo")
except Exception:
    LOCAL_TZ = timezone(timedelta(hours=5, minutes=30), name="Asia/Colombo")


def local_now() -> datetime:
    return datetime.now(LOCAL_TZ)


def local_today() -> date:
    return local_now().date()


def local_today_iso() -> str:
    return local_today().isoformat()


def to_local_date(value: Any) -> Optional[date]:
    """Calendar date in Asia/Colombo for a datetime, date, or ISO string."""
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            if dt.hour == 0 and dt.minute == 0 and dt.second == 0 and dt.microsecond == 0:
                return dt.date()
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(LOCAL_TZ).date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        if len(text) <= 10:
            return datetime.fromisoformat(text[:10]).date()
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return to_local_date(dt)
    except ValueError:
        return None


def calendar_datetime(value: Any = None) -> datetime:
    """Naive midnight representing the campus calendar day."""
    day = to_local_date(value) or local_today()
    return datetime.combine(day, time.min)
