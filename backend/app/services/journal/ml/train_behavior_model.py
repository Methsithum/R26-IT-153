"""Trains the behaviour-category classifier on the 5 seed test
accounts created by seed_synthetic_data.py.

For each account, the activity snapshot (the same function the live app
uses) is replayed at many points across its seeded history, each replay
giving one labelled training row (features -> that account's category).
This turns 5 accounts into a few hundred rows without needing hundreds of
real users.

Run from backend/: python -m app.services.journal.ml.train_behavior_model
Writes behavior_model.joblib next to this file.
"""

import asyncio
from datetime import timedelta
from pathlib import Path

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

from app.models.user.user import UserModel
from app.services.journal.behavior_analysis import build_activity_snapshot
from app.services.journal.ml.feature_extraction import extract_features, FEATURE_NAMES
from app.services.journal.ml.profiles import TEST_USERS, SEED_START, SEED_END

MODEL_PATH = Path(__file__).parent / "behavior_model.joblib"
REPLAY_STEP_DAYS = 3


async def _build_dataset():
    X, y = [], []
    for profile in TEST_USERS:
        user = await UserModel.find_by_email(profile["email"])
        if not user:
            raise RuntimeError(
                f"{profile['email']} not found - run seed_synthetic_data.py first."
            )
        user_id = str(user["_id"]) if "_id" in user else user["id"]

        day = SEED_START + timedelta(days=14)  # need 14 days of history for a full window
        while day <= SEED_END:
            snapshot = await build_activity_snapshot(user_id, as_of=day)
            if snapshot.get("active_days_last_14_days", 0) > 0:
                X.append(extract_features(snapshot))
                y.append(profile["category"])
            day += timedelta(days=REPLAY_STEP_DAYS)
    return X, y


async def main():
    X, y = await _build_dataset()
    print(f"Training rows: {len(X)}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    print(f"Test accuracy: {accuracy_score(y_test, predictions):.2f}")
    print(classification_report(y_test, predictions))

    joblib.dump({"model": model, "feature_names": FEATURE_NAMES}, MODEL_PATH)
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
