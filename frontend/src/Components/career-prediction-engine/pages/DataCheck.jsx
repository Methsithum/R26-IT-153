import { useCallback, useEffect, useState } from 'react';

import {
  extractFeaturesFromMongoDB,
  summariseDataQuality,
} from '../../../utils/extractFeatures';
import { loadSurveyAnswers } from '../../../utils/surveyStorage';
import { readStoredUser } from '../../../services/userApi';
import LoadingState from '../components/LoadingState';
import './DataCheck.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * TEMPORARY DIAGNOSTIC PAGE.
 *
 * Shows the raw MongoDB responses next to the 15 features derived from them,
 * so the data pipeline can be verified against real documents before this
 * page is deleted. Nothing else imports it.
 */

/** Where each feature comes from, for the source column. */
const FEATURE_SOURCE = {
  gpa_cumulative: 'users.gpa',
  gpa_trend: 'learning_patterns.engagement_trend',
  assignment_completion_rate: 'tasks.progress_stage',
  late_submission_rate: 'tasks.deadline',
  resit_count: 'exams.exam_type',
  project_performance: 'exams.mark + tasks.mark',
  attendance_rate: 'daily_sessions.date',
  weekly_study_hours: 'learning_patterns.total_study_time',
  stress_level: 'focus_emotional_stats.stress_level',
  anxiety_score: 'focus_emotional_stats.distraction_score',
  mood_stability: 'focus_emotional_stats.mood_stability',
  sleep_hours_avg: 'survey',
  sleep_consistency: 'survey',
  part_time_work_hours: 'survey',
  career_clarity_score: 'survey',
};

/** The four features the survey supplies rather than MongoDB. */
const SURVEY_KEYS = new Set([
  'sleep_hours_avg',
  'sleep_consistency',
  'part_time_work_hours',
  'career_clarity_score',
]);

/**
 * Fetch a JSON endpoint, capturing failures instead of throwing so one dead
 * collection does not hide the rest.
 *
 * @param {string} path
 * @returns {Promise<{ok:boolean, status:number, data:any, error:string|null}>}
 */
async function probe(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data, error: null };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

/** Count the records inside a collection response, whatever its wrapper key. */
function countOf(result) {
  const d = result?.data;
  if (!d) return 0;
  if (Array.isArray(d)) return d.length;
  for (const key of ['tasks', 'exams', 'sessions', 'predictions']) {
    if (Array.isArray(d[key])) return d[key].length;
  }
  return d && typeof d === 'object' ? 1 : 0;
}

export default function DataCheck() {
  const [features, setFeatures] = useState(null);
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = readStoredUser();
  const userId = user?.id;

  /** Pull every source endpoint plus the derived feature vector. */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    if (!userId) {
      setError('No signed-in user found in localStorage. Log in first.');
      setLoading(false);
      return;
    }

    try {
      const [profile, tasks, exams, sessions, insights, emotional] =
        await Promise.all([
          probe(`/users/${userId}`),
          probe(`/users/${userId}/tasks`),
          probe(`/users/${userId}/exams`),
          probe(`/users/${userId}/sessions`),
          probe(`/learning-insights/${userId}`),
          probe(`/focus/emotional?user_id=${encodeURIComponent(userId)}`),
        ]);

      setSources({
        'users/:id': { path: `/users/${userId}`, ...profile },
        'users/:id/tasks': { path: `/users/${userId}/tasks`, ...tasks },
        'users/:id/exams': { path: `/users/${userId}/exams`, ...exams },
        'users/:id/sessions': { path: `/users/${userId}/sessions`, ...sessions },
        'learning-insights/:id': { path: `/learning-insights/${userId}`, ...insights },
        'focus/emotional': { path: `/focus/emotional?user_id=…`, ...emotional },
      });

      setFeatures(await extractFeaturesFromMongoDB(loadSurveyAnswers()));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState message="Checking your data..." />;

  const estimated = new Set(features?.__estimated ?? []);
  const survey = loadSurveyAnswers();

  // Same summary that gets stored on each saved prediction, so this page and
  // the history panel always report the identical percentage.
  const quality = summariseDataQuality(features);

  return (
    <div className="dc">
      <div className="dc-head">
        <div>
          <h2 className="dc-title">Data Check</h2>
          <p className="dc-sub">
            Temporary diagnostic page — delete once the pipeline is verified.
          </p>
        </div>
        <button type="button" className="dc-refresh" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="dc-error">{error}</div>}

      {/* Who we are reading for */}
      <section className="cpe-panel">
        <h3 className="cpe-panel-title">Signed-in student</h3>
        <dl className="dc-kv">
          <div>
            <dt>Name</dt>
            <dd>{user?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>user_id</dt>
            <dd className="dc-mono">{userId ?? '—'}</dd>
          </div>
          <div>
            <dt>Year / Sem</dt>
            <dd>
              {user?.campus_year ?? '—'} / {user?.semester ?? '—'}
            </dd>
          </div>
          <div>
            <dt>Survey saved</dt>
            <dd>{survey ? 'yes' : 'no'}</dd>
          </div>
        </dl>
      </section>

      {/* Endpoint health */}
      <section className="cpe-panel">
        <h3 className="cpe-panel-title">Source endpoints</h3>
        <div className="dc-table-wrap">
          <table className="dc-table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Records</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {sources &&
                Object.entries(sources).map(([name, r]) => {
                  const n = countOf(r);
                  return (
                    <tr key={name}>
                      <td className="dc-mono">{name}</td>
                      <td>
                        <span className={r.ok ? 'dc-pill dc-ok' : 'dc-pill dc-bad'}>
                          {r.error ? 'network' : r.status}
                        </span>
                      </td>
                      <td className="dc-num">{n}</td>
                      <td className="dc-note">
                        {r.error
                          ? r.error
                          : !r.ok
                            ? 'request failed'
                            : n === 0
                              ? 'empty — features fall back to defaults'
                              : 'ok'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* The 15 features */}
      <section className="cpe-panel">
        <h3 className="cpe-panel-title">
          Derived features — {quality.real_features} of 11 measured,{' '}
          {quality.estimated_features} estimated ({quality.quality_percent}%
          real data)
        </h3>
        <div className="dc-table-wrap">
          <table className="dc-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Value</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {features &&
                Object.entries(features).map(([key, value]) => {
                  const isSurvey = SURVEY_KEYS.has(key);
                  const isEstimated = estimated.has(key);
                  return (
                    <tr key={key}>
                      <td className="dc-mono">{key}</td>
                      <td className="dc-num">
                        {typeof value === 'number' ? value.toFixed(4) : String(value)}
                      </td>
                      <td>
                        <span
                          className={
                            isSurvey
                              ? 'dc-pill dc-info'
                              : isEstimated
                                ? 'dc-pill dc-warn'
                                : 'dc-pill dc-ok'
                          }
                        >
                          {isSurvey ? 'survey' : isEstimated ? 'estimated' : 'measured'}
                        </span>
                      </td>
                      <td className="dc-note dc-mono">{FEATURE_SOURCE[key] ?? '—'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Raw payloads */}
      <section className="cpe-panel">
        <h3 className="cpe-panel-title">Raw responses</h3>
        {sources &&
          Object.entries(sources).map(([name, r]) => (
            <details key={name} className="dc-raw">
              <summary>
                <span className="dc-mono">{name}</span>
                <span className="dc-raw-path">{r.path}</span>
              </summary>
              <pre>{JSON.stringify(r.data, null, 2)}</pre>
            </details>
          ))}

        <details className="dc-raw">
          <summary>
            <span className="dc-mono">survey answers</span>
            <span className="dc-raw-path">localStorage</span>
          </summary>
          <pre>{JSON.stringify(survey, null, 2)}</pre>
        </details>

        <details className="dc-raw">
          <summary>
            <span className="dc-mono">features sent to /predict</span>
            <span className="dc-raw-path">15 fields</span>
          </summary>
          <pre>{JSON.stringify(features, null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}
