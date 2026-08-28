import { useState } from 'react';
import './styles.css';

/**
 * Slider config.
 *
 * The UI scale and the model scale differ for two features, so each slider
 * carries converters:
 *   toUi    - model value  -> slider value
 *   toModel - slider value -> model value
 * Attendance is 0-1 in the model but shown as 0-100%.
 * Stress is 0-100 in the model but shown as 0-10.
 */
const SLIDERS = [
  {
    key: 'weekly_study_hours',
    label: 'Study hours / week',
    min: 0, max: 40, step: 1,
    fmt: (v) => `${v} hrs`,
    toUi: (v) => v,
    toModel: (v) => v,
  },
  {
    key: 'attendance_rate',
    label: 'Attendance',
    min: 0, max: 100, step: 1,
    fmt: (v) => `${v}%`,
    toUi: (v) => Math.round(v * 100),
    toModel: (v) => v / 100,
  },
  {
    key: 'sleep_hours_avg',
    label: 'Sleep hours',
    min: 3, max: 12, step: 0.5,
    fmt: (v) => `${v} hrs`,
    toUi: (v) => v,
    toModel: (v) => v,
  },
  {
    key: 'stress_level',
    label: 'Stress level',
    min: 0, max: 10, step: 1,
    fmt: (v) => `${v}/10`,
    toUi: (v) => Math.round(v / 10),
    toModel: (v) => v * 10,
  },
];

/**
 * Four what-if sliders plus a Run Simulation button.
 *
 * @param {object}   baseFeatures - the student's current 15 features, used to
 *                                  seed the sliders and build the merged payload
 * @param {function} onSimulate   - called with the full modified feature object
 * @param {boolean}  [busy]       - disables the button while a request is in flight
 * @param {boolean}  [hasResult]  - whether a simulation has already returned
 */
export default function WhatIfSimulation({ baseFeatures, onSimulate, busy, hasResult }) {
  // User-adjusted slider positions, in UI units. Null until the user moves a
  // slider, so a newly loaded student falls back to the seeded values below.
  const [edits, setEdits] = useState(null);
  // Tracks which student the current edits belong to, so switching students
  // discards stale slider positions without needing an effect.
  const [seededFor, setSeededFor] = useState(baseFeatures);

  // Derive slider positions from the loaded student during render.
  const seeded = {};
  for (const s of SLIDERS) {
    const raw = baseFeatures?.[s.key];
    seeded[s.key] = typeof raw === 'number' ? s.toUi(raw) : s.min;
  }

  // A different student arrived - drop the previous student's edits.
  if (seededFor !== baseFeatures) {
    setSeededFor(baseFeatures);
    setEdits(null);
  }

  const values = edits ?? seeded;

  /** Update one slider's UI value. */
  const setOne = (key, val) =>
    setEdits((prev) => ({ ...(prev ?? seeded), [key]: Number(val) }));

  /** Convert every slider back to model units and hand the merged payload up. */
  const run = () => {
    if (!baseFeatures) return;
    const overrides = {};
    for (const s of SLIDERS) {
      if (typeof values[s.key] === 'number') {
        overrides[s.key] = s.toModel(values[s.key]);
      }
    }
    onSimulate({ ...baseFeatures, ...overrides });
  };

  return (
    <section className="cpe-panel wis">
      <h2 className="cpe-panel-title">What-If Simulation</h2>

      <div className="wis-sliders">
        {SLIDERS.map((s) => {
          const val = values[s.key] ?? s.min;
          return (
            <div key={s.key} className="wis-row">
              <label className="wis-label" htmlFor={`wis-${s.key}`}>
                {s.label}
              </label>
              <input
                id={`wis-${s.key}`}
                type="range"
                className="wis-range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={val}
                disabled={!baseFeatures}
                onChange={(e) => setOne(s.key, e.target.value)}
              />
              <span className="wis-val">{s.fmt(val)}</span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="wis-btn"
        onClick={run}
        disabled={!baseFeatures || busy}
      >
        {busy ? 'Simulating...' : 'Run Simulation'}
      </button>

      {hasResult && !busy && (
        <p className="wis-preview">
          Preview updated - see the Before / After panel for the change.
        </p>
      )}
    </section>
  );
}
