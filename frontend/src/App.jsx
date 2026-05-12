import { useState } from 'react';
import './App.css';

const API = 'http://localhost:8000/api';

const DEFAULTS = {
  gpa_cumulative: 3.2,
  gpa_trend: 0.1,
  assignment_completion_rate: 0.85,
  late_submission_rate: 0.10,
  resit_count: 0,
  project_performance: 78.0,
  attendance_rate: 0.78,
  weekly_study_hours: 14,
  sleep_hours_avg: 6.5,
  sleep_consistency: 1.1,
  part_time_work_hours: 10,
  stress_level: 60,
  anxiety_score: 10,
  mood_stability: 65,
  career_clarity_score: 70,
};

const FIELD_GROUPS = [
  {
    title: 'Academic',
    fields: [
      { key: 'gpa_cumulative',             label: 'Cumulative GPA',        min: 0,  max: 4,   step: 0.1  },
      { key: 'gpa_trend',                  label: 'GPA Trend',             min: -2, max: 2,   step: 0.1  },
      { key: 'assignment_completion_rate', label: 'Assignment Completion',  min: 0,  max: 1,   step: 0.01 },
      { key: 'late_submission_rate',       label: 'Late Submission Rate',   min: 0,  max: 1,   step: 0.01 },
      { key: 'resit_count',                label: 'Resit Count',           min: 0,  max: 10,  step: 1    },
      { key: 'project_performance',        label: 'Project Performance',    min: 0,  max: 100, step: 0.5  },
    ],
  },
  {
    title: 'Behavioral',
    fields: [
      { key: 'attendance_rate',      label: 'Attendance Rate',       min: 0, max: 1,  step: 0.01 },
      { key: 'weekly_study_hours',   label: 'Study Hours / Week',    min: 0, max: 80, step: 1    },
      { key: 'sleep_hours_avg',      label: 'Avg Sleep Hours',       min: 3, max: 12, step: 0.5  },
      { key: 'sleep_consistency',    label: 'Sleep Consistency',     min: 0, max: 5,  step: 0.1  },
      { key: 'part_time_work_hours', label: 'Part-Time Work Hrs/Wk', min: 0, max: 40, step: 1   },
    ],
  },
  {
    title: 'Emotional',
    fields: [
      { key: 'stress_level',   label: 'Stress Level',   min: 0, max: 100, step: 1 },
      { key: 'anxiety_score',  label: 'Anxiety Score',  min: 0, max: 25,  step: 1 },
      { key: 'mood_stability', label: 'Mood Stability', min: 0, max: 100, step: 1 },
    ],
  },
  {
    title: 'Career',
    fields: [
      { key: 'career_clarity_score', label: 'Career Clarity Score', min: 0, max: 100, step: 1 },
    ],
  },
];

const SIM_FIELDS = [
  { key: 'weekly_study_hours', label: 'Study Hours / Week', min: 0, max: 80,  step: 1    },
  { key: 'attendance_rate',    label: 'Attendance Rate',    min: 0, max: 1,   step: 0.01 },
  { key: 'sleep_hours_avg',    label: 'Sleep Hours',        min: 3, max: 12,  step: 0.5  },
  { key: 'stress_level',       label: 'Stress Level',       min: 0, max: 100, step: 1    },
];

function fmt(val, step) {
  const n = Number(val);
  if (step >= 1) return String(Math.round(n));
  if (step >= 0.1) return n.toFixed(1);
  return n.toFixed(2);
}

function Spinner() {
  return <span className="spinner" />;
}

function DonutGauge({ score }) {
  const r    = 72;
  const cx   = 90;
  const cy   = 90;
  const circ = 2 * Math.PI * r;
  const pct  = score != null ? Math.max(0, Math.min(1, (score - 30) / 70)) : 0;

  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 180 180" className="gauge-svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2060" strokeWidth="14" />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#4f6ef7"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
          transform={`rotate(-90 ${cx} ${cy})`}
          className="gauge-arc"
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="white" className="gauge-value">
          {score != null ? score.toFixed(1) : '—'}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#7b8ec8" className="gauge-sublabel">
          out of 100
        </text>
      </svg>
    </div>
  );
}

function RiskBar({ riskLevel, riskScore, probLow, probMed, probHigh }) {
  const COLORS = { Low: '#22c55e', Medium: '#f59e0b', High: '#ef4444' };
  const color  = COLORS[riskLevel] ?? '#7b8ec8';

  if (!riskLevel) {
    return <p className="placeholder-text">Run a prediction to see risk.</p>;
  }

  return (
    <div className="risk-content">
      <div className="risk-label" style={{ color }}>{riskLevel}</div>
      <div className="risk-bar">
        <div className="risk-bar-fill" />
        <div className="risk-marker" style={{ left: `${riskScore}%` }} />
      </div>
      <div className="risk-probs">
        <span style={{ color: '#22c55e' }}>Low {Math.round((probLow ?? 0) * 100)}%</span>
        <span style={{ color: '#f59e0b' }}>Med {Math.round((probMed ?? 0) * 100)}%</span>
        <span style={{ color: '#ef4444' }}>High {Math.round((probHigh ?? 0) * 100)}%</span>
      </div>
    </div>
  );
}

export default function App() {
  const [inputs,     setInputs]     = useState({ ...DEFAULTS });
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const [simMods,    setSimMods]    = useState({
    weekly_study_hours: DEFAULTS.weekly_study_hours,
    attendance_rate:    DEFAULTS.attendance_rate,
    sleep_hours_avg:    DEFAULTS.sleep_hours_avg,
    stress_level:       DEFAULTS.stress_level,
  });
  const [simResult,  setSimResult]  = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError,   setSimError]   = useState('');

  const setInput  = (key, val) => setInputs(p  => ({ ...p, [key]: Number(val) }));
  const setSimMod = (key, val) => setSimMods(p => ({ ...p, [key]: Number(val) }));

  async function predict() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/predict`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(inputs),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function simulate() {
    setSimLoading(true);
    setSimError('');
    try {
      const modified = { ...inputs, ...simMods };
      const res = await fetch(`${API}/simulate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ original: inputs, modified }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      setSimResult(await res.json());
    } catch (e) {
      setSimError(e.message);
    } finally {
      setSimLoading(false);
    }
  }

  const orig     = simResult?.original_prediction;
  const mod      = simResult?.modified_prediction;
  const improved = simResult ? simResult.career_change > 0 : null;

  return (
    <div className="app">
      <header className="app-header">
        <span className="header-icon">◈</span>
        <h1>Integrated Future &amp; Career Prediction Engine</h1>
      </header>

      <main className="dashboard">

        {/* ── Panel 1 · Input ────────────────────────── */}
        <section className="panel panel-input">
          <h2 className="panel-title">Input Data</h2>
          <div className="input-scroll">
            {FIELD_GROUPS.map(({ title, fields }) => (
              <div key={title} className="field-group">
                <div className="group-heading">{title}</div>
                {fields.map(({ key, label, min, max, step }) => (
                  <div key={key} className="field-row">
                    <label className="field-label">{label}</label>
                    <input
                      type="range"
                      min={min} max={max} step={step}
                      value={inputs[key]}
                      onChange={e => setInput(key, e.target.value)}
                      className="field-slider"
                    />
                    <span className="field-value">{fmt(inputs[key], step)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn-predict" onClick={predict} disabled={loading}>
            {loading ? <Spinner /> : 'Predict'}
          </button>
        </section>

        {/* ── Center column ──────────────────────────── */}
        <div className="center-col">

          {/* Panel 2 · Career Readiness */}
          <section className="panel panel-career">
            <h2 className="panel-title">Career Readiness</h2>
            <div className="gauge-area">
              <DonutGauge score={result?.career_score ?? null} />
              <div className="career-grade" data-grade={result?.career_grade ?? ''}>
                {result?.career_grade ?? '—'}
              </div>
            </div>
          </section>

          {/* Panel 4 · What-If Simulation */}
          <section className="panel panel-sim">
            <h2 className="panel-title">What-If Simulation</h2>
            <div className="sim-sliders">
              {SIM_FIELDS.map(({ key, label, min, max, step }) => (
                <div key={key} className="field-row">
                  <label className="field-label">{label}</label>
                  <input
                    type="range"
                    min={min} max={max} step={step}
                    value={simMods[key]}
                    onChange={e => setSimMod(key, e.target.value)}
                    className="field-slider"
                  />
                  <span className="field-value">{fmt(simMods[key], step)}</span>
                </div>
              ))}
            </div>
            {simError && <div className="error-msg">{simError}</div>}
            <button className="btn-simulate" onClick={simulate} disabled={simLoading}>
              {simLoading ? <Spinner /> : 'Run Simulation'}
            </button>
          </section>
        </div>

        {/* ── Right column ───────────────────────────── */}
        <div className="right-col">

          {/* Panel 3 · Academic Risk */}
          <section className="panel panel-risk">
            <h2 className="panel-title">Academic Risk</h2>
            <RiskBar
              riskLevel={result?.risk_level  ?? null}
              riskScore={result?.risk_score  ?? null}
              probLow={result?.prob_low      ?? null}
              probMed={result?.prob_medium   ?? null}
              probHigh={result?.prob_high    ?? null}
            />
          </section>

          {/* Panel 5 · Before → After */}
          <section className="panel panel-compare">
            <h2 className="panel-title">Before → After</h2>
            {!simResult ? (
              <p className="placeholder-text">Run a simulation to see changes.</p>
            ) : (
              <>
                <div className="compare-grid">
                  <div className="compare-col">
                    <span className="compare-heading">Original</span>
                    <span className="compare-score">{orig?.career_score?.toFixed(1) ?? '—'}</span>
                    <span className="compare-risk" data-risk={orig?.risk_level ?? ''}>
                      {orig?.risk_level ?? '—'}
                    </span>
                  </div>

                  <div className="compare-arrow" style={{ color: improved ? '#22c55e' : '#ef4444' }}>
                    {improved ? '▲' : '▼'}
                  </div>

                  <div className="compare-col">
                    <span className="compare-heading">Modified</span>
                    <span className="compare-score">{mod?.career_score?.toFixed(1) ?? '—'}</span>
                    <span className="compare-risk" data-risk={mod?.risk_level ?? ''}>
                      {mod?.risk_level ?? '—'}
                    </span>
                  </div>
                </div>

                <div className="compare-delta" style={{ color: improved ? '#22c55e' : '#ef4444' }}>
                  Career score {improved ? '+' : ''}{simResult.career_change.toFixed(1)}
                  {simResult.risk_changed && (
                    <span className="risk-changed-badge"> · Risk level changed</span>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
