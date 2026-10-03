# Journal Analytics (statistics only, no ML)

Read-only, descriptive statistics over a user's own `daily_sessions`. No
model is trained anywhere in this package; `stats.py` is pure stdlib
(`math`, `statistics`) with no scikit-learn/numpy/pandas.

## What's here

- `stats.py` - generic statistics primitives: Theil-Sen slope, Mann-Kendall
  trend test (S/Z/two-sided p), MAD robust z-scores, Spearman rank
  correlation (+ p-value approximation), Shannon entropy and its normalized
  (0..1) form.
- `insights.py` - builds the **Learning Patterns** payload (`build_learning_patterns`)
  from a user's completed sessions in a 14/30/60/90-day window.
- `behavior_latest.py` - reads the most recent stored **Behaviour Analysis**
  result (never calls the LLM; the LLM only runs via the existing
  `POST /behavior/analyze`).

## Removed (kept recoverable in git history)

The Analytics tab used to have four more sub-tabs: Data Quality,
Gamification Simulator, Alert Rules Explorer, Question Bank Explorer. They
were removed to keep the tab to two sections (Learning Patterns, Behaviour
Analysis). Their backend modules (`data_quality.py`, `simulator.py`,
`alert_rules.py`, `question_catalog.py`) and the `tf-idf` / tokenizer
helpers in `stats.py` (only used by the removed near-duplicate-journal
check) were deleted along with them - nothing else imported them.

## Endpoints

- `GET /analytics/learning-patterns/{user_id}?window=14|30|60|90` (default 30)
  - 404 if the user doesn't exist, 422 if `window` isn't one of the four
    allowed values.
  - Returns daily series, weekly aggregates, weekday distribution (+ entropy),
    trends (Theil-Sen + Mann-Kendall) for study minutes and XP, MAD anomalies
    (only with >= 10 active days), a minutes histogram, engagement
    distribution, subject effort (top 8 + Other), a study-minutes-vs-XP
    scatter with Spearman correlation, a journal calendar with the Part 1
    canonical on-time streak, an hour-of-day distribution (based on session
    *start* time - there is no separate "completed at" timestamp), and
    recorded-ness shares (how much of the window actually has study
    minutes/engagement/subjects recorded).
- `GET /analytics/behavior-latest/{user_id}` - `{"available": false}` or the
  latest stored `{behaviorCategory, reasoning, created_at, generated_at}`.

## Known null/empty-data behavior

- Spearman correlation returns `None` when either series never varies
  (e.g. study minutes are always 0) or there are fewer than 2 points - a
  correlation needs two things that both vary.
- Normalized entropy returns `None` when fewer than 2 categories have any
  data at all (e.g. engagement never recorded -> only "unspecified").
- Mann-Kendall's significance cutoff is `|Z| >= 1.96` (two-sided p <= 0.05);
  below `TREND_MIN_ACTIVE_DAYS` (7) active days the trend label is always
  "insufficient data" regardless of Z.
- `xp_earned` per session is not capped at the 120-point per-journal
  check-in amount - `apply_run_rewards` can raise it up to `MAX_SESSION_XP`
  (2500) when a campus mini-game run is attached to the same journal. The
  API's `meta.xp_note` field says this explicitly so the frontend doesn't
  need to guess.
