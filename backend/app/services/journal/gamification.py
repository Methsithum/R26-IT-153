from app.models.user.user import UserModel
from datetime import datetime

BADGES = {
    "first_journal": "First Journal Entry",
    "streak_3": "3-Day Streak",
    "streak_7": "7-Day Streak",
    "streak_30": "30-Day Streak",
}

async def update_streak_and_xp(user_id: str, date: datetime):
    user = await UserModel.find_by_id(user_id)
    if not user:
        return 0, []

    xp_earned = 50
    new_badges = []

    last = user.get("last_journal_date")
    today = date.replace(hour=0, minute=0, second=0, microsecond=0)
    current_streak = user.get("current_streak", 0)
    longest_streak = user.get("longest_streak", 0)

    if last:
        last_date = last.replace(hour=0, minute=0, second=0, microsecond=0)
        day_diff = (today - last_date).days
        if day_diff == 1:
            current_streak += 1
        elif day_diff > 1:
            current_streak = 1
    else:
        current_streak = 1

    if current_streak > longest_streak:
        longest_streak = current_streak

    badges = user.get("badges", [])
    if current_streak >= 3 and "streak_3" not in badges:
        badges.append("streak_3")
        new_badges.append(BADGES["streak_3"])
    if current_streak >= 7 and "streak_7" not in badges:
        badges.append("streak_7")
        new_badges.append(BADGES["streak_7"])
    if current_streak >= 30 and "streak_30" not in badges:
        badges.append("streak_30")
        new_badges.append(BADGES["streak_30"])
    if not last and "first_journal" not in badges:
        badges.append("first_journal")
        new_badges.append(BADGES["first_journal"])

    await UserModel.update(user_id, {
        "total_xp": user["total_xp"] + xp_earned,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "badges": badges,
        "last_journal_date": today
    })
    return xp_earned, new_badges