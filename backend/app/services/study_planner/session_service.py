"""session_service.py"""

from datetime import date, timedelta

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# A gap shorter than this isn't offered even as a partial session.
MIN_PARTIAL_MINUTES = 30


def to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def to_hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def parse_time_slot(time_slot: str) -> tuple[int, int]:
    start, end = time_slot.split("-")
    return to_minutes(start), to_minutes(end)


def week_bounds(which: str, today: date) -> tuple[date, date]:
    """Monday-start weeks, matching the Week view (dateHelpers.js's getWeekStart)."""
    this_monday = today - timedelta(days=today.weekday())
    if which == "this":
        return today, this_monday + timedelta(days=6)
    next_monday = this_monday + timedelta(days=7)
    return next_monday, next_monday + timedelta(days=6)


def reschedule_options(deadline: date | None, today: date) -> dict:
    """Which of the three choices the student may pick, given the task's real deadline."""
    next_monday, _ = week_bounds("next", today)
    if deadline is None:
        # No real deadline recorded - nothing to protect against, both weeks allowed.
        return {"expired": False, "can_use_this_week": True, "can_use_next_week": True}
    expired = deadline < today
    return {
        "expired": expired,
        "can_use_this_week": not expired,
        "can_use_next_week": deadline >= next_monday,
    }


def _subtract(gaps: list[tuple[int, int]], busy: list[tuple[int, int]]) -> list[tuple[int, int]]:
    for busy_start, busy_end in busy:
        next_gaps = []
        for gap_start, gap_end in gaps:
            if busy_end <= gap_start or busy_start >= gap_end:
                next_gaps.append((gap_start, gap_end))
                continue
            if busy_start > gap_start:
                next_gaps.append((gap_start, busy_start))
            if busy_end < gap_end:
                next_gaps.append((busy_end, gap_end))
        gaps = next_gaps
    return gaps


def free_gaps_by_date(
    weekly_free_slots: list[dict],
    occupied_by_date: dict[str, list[str]],
    start: date,
    end: date,
    today: date,
    now_minutes: int,
) -> dict[str, list[tuple[int, int]]]:
    """Real free time per date in start..end"""
    result = {}
    day = start
    while day <= end:
        day_name = DAY_NAMES[day.weekday()]
        gaps = []
        for slot in weekly_free_slots:
            if slot["day"] != day_name:
                continue
            slot_start = to_minutes(slot["start_time"])
            gaps.append((slot_start, slot_start + int(slot["duration_minutes"])))
        busy = [parse_time_slot(ts) for ts in occupied_by_date.get(day.isoformat(), [])]
        if day == today:
            busy.append((0, now_minutes))
        gaps = sorted(g for g in _subtract(gaps, busy) if g[1] > g[0])
        if gaps:
            result[day.isoformat()] = gaps
        day += timedelta(days=1)
    return result


def build_suggestions(
    weekly_free_slots: list[dict],
    occupied_by_date: dict[str, list[str]],
    which: str,
    deadline: date | None,
    duration_minutes: int,
    today: date,
    now_minutes: int,
) -> dict:
    """Slot suggestions for one week, cut off at the deadline."""
    options = reschedule_options(deadline, today)
    allowed = options["can_use_this_week"] if which == "this" else options["can_use_next_week"]
    response = {**options, "week": which, "deadline_date": deadline.isoformat() if deadline else None, "suggestions": [], "warning": None}
    if options["expired"]:
        response["warning"] = "deadline_passed"
        return response
    if not allowed:
        response["warning"] = "deadline_before_next_week"
        return response

    start, end = week_bounds(which, today)
    if deadline is not None:
        end = min(end, deadline)
    if end < start:
        response["warning"] = "no_slot_before_deadline"
        return response

    gaps = free_gaps_by_date(weekly_free_slots, occupied_by_date, start, end, today, now_minutes)
    full, partial = [], []
    for date_str, day_gaps in gaps.items():
        for gap_start, gap_end in day_gaps:
            length = gap_end - gap_start
            if length >= duration_minutes:
                full.append({
                    "date": date_str,
                    "time_slot": f"{to_hhmm(gap_start)}-{to_hhmm(gap_start + duration_minutes)}",
                    "duration_minutes": duration_minutes,
                    "fits": True,
                })
            elif length >= MIN_PARTIAL_MINUTES:
                partial.append({
                    "date": date_str,
                    "time_slot": f"{to_hhmm(gap_start)}-{to_hhmm(gap_end)}",
                    "duration_minutes": length,
                    "fits": False,
                })

    suggestions = full or sorted(partial, key=lambda s: -s["duration_minutes"])
    if not suggestions:
        response["warning"] = "no_slot_before_deadline"
        return response
    if not full:
        response["warning"] = "only_partial_slots"
    for i, suggestion in enumerate(suggestions):
        suggestion["recommended"] = i == 0
    response["suggestions"] = suggestions
    return response


def is_slot_still_free(
    weekly_free_slots: list[dict],
    occupied_by_date: dict[str, list[str]],
    which: str,
    deadline: date | None,
    target_date: str,
    time_slot: str,
    today: date,
    now_minutes: int,
) -> bool:
    """Confirm-time re-check"""
    options = reschedule_options(deadline, today)
    if not (options["can_use_this_week"] if which == "this" else options["can_use_next_week"]):
        return False
    start, end = week_bounds(which, today)
    if deadline is not None:
        end = min(end, deadline)
    try:
        chosen = date.fromisoformat(target_date)
        slot_start, slot_end = parse_time_slot(time_slot)
    except ValueError:
        return False
    if not (start <= chosen <= end) or slot_end <= slot_start:
        return False
    gaps = free_gaps_by_date(weekly_free_slots, occupied_by_date, chosen, chosen, today, now_minutes)
    return any(gap_start <= slot_start and slot_end <= gap_end for gap_start, gap_end in gaps.get(target_date, []))
