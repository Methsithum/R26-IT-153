import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { predictStudent } from '../api/predictionApi';
import { extractFeaturesFromMongoDB } from '../../../utils/extractFeatures';
import { hasSurveyAnswers, loadSurveyAnswers } from '../../../utils/surveyStorage';
import {
  getCachedHistory,
  getPredictionHistory,
  savePrediction,
} from '../../../utils/predictionHistory';
import { readStoredUser } from '../../../services/userApi';
import StudentSurvey from '../StudentSurvey';
import PredictionHistory from '../PredictionHistory';
import InputDataPanel from '../components/InputDataPanel';
import CareerGauge from '../components/CareerGauge';
import RiskPanel from '../components/RiskPanel';
import WhatIfSimulation from '../components/WhatIfSimulation';
import BeforeAfterPanel from '../components/BeforeAfterPanel';
import AdvisorInsights from '../components/AdvisorInsights';
import ApiErrorNotice from '../components/ApiErrorNotice';
import './Dashboard.css';

/** The 15 model features, used to strip label columns off a profile row. */
const FEATURE_KEYS = [
  'gpa_cumulative', 'gpa_trend', 'assignment_completion_rate',
  'late_submission_rate', 'resit_count', 'project_performance',
  'attendance_rate', 'weekly_study_hours', 'sleep_hours_avg',
  'sleep_consistency', 'part_time_work_hours',
  'stress_level', 'anxiety_score', 'mood_stability',
  'career_clarity_score',
];

/** Human-readable names for the estimated-input banner. */
const FEATURE_LABELS = {
  gpa_cumulative: 'GPA',
  gpa_trend: 'GPA trend',
  assignment_completion_rate: 'assignment completion',
  late_submission_rate: 'late submissions',
  resit_count: 'resits',
  project_performance: 'marks',
  attendance_rate: 'attendance',
  weekly_study_hours: 'study hours',
  stress_level: 'stress',
  anxiety_score: 'distraction',
  mood_stability: 'mood',
};

/**
 * Reduce a profile row (which also carries label columns) down to exactly the
 * 15 features the /predict endpoint accepts.
 */
function pickFeatures(profile) {
  const out = {};
  for (const key of FEATURE_KEYS) out[key] = profile[key];
  return out;
}

/**
 * Main dashboard.
 *
 * Moves through four states: survey -> ready -> predicting -> results.
 * Every number shown comes from MongoDB or the prediction API; nothing is
 * hard-coded.
 */
export default function Dashboard() {
  // A row clicked on the ProfileList page arrives via router state.
  const location = useLocation();
  const incomingProfile = location.state?.profile ?? null;

  // Viewing a specific profile skips the survey - that student's 15 features
  // are already complete.
  const [showSurvey, setShowSurvey] = useState(
    () => !incomingProfile && !hasSurveyAnswers(),
  );

  const [features, setFeatures] = useState(null);
  const [prediction, setPrediction] = useState(null);
  // Seeded from the local mirror so the panel paints immediately, then
  // replaced by the MongoDB copy once it arrives.
  const [history, setHistory] = useState(() => getCachedHistory());

  // True while the feature vector is being built and scored.
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  // Feature preview shown before the first prediction is generated.
  const [preview, setPreview] = useState(null);

  // The stored survey answers, held in state so the panel refreshes as soon
  // as the student edits them.
  const [surveyAnswers, setSurveyAnswers] = useState(() => loadSurveyAnswers());

  const [simResult, setSimResult] = useState(null);
  const [simBusy, setSimBusy] = useState(false);

  const student = readStoredUser();
  const studentName = student?.name || 'Student';

  /**
   * Refresh the stored history from MongoDB on mount, so past runs made on
   * another device show up here too.
   */
  useEffect(() => {
    if (incomingProfile) return;

    let cancelled = false;
    getPredictionHistory()
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch(() => {
        /* the local mirror is already displayed */
      });

    return () => {
      cancelled = true;
    };
  }, [incomingProfile]);

  /**
   * Pull the student's current feature vector from MongoDB so the pre-flight
   * screen can show what data was found. Failures are silent - the Generate
   * button still works and reports errors properly.
   */
  useEffect(() => {
    if (showSurvey || incomingProfile || prediction) return;

    let cancelled = false;
    extractFeaturesFromMongoDB(loadSurveyAnswers())
      .then((f) => {
        if (!cancelled) setPreview(f);
      })
      .catch(() => {
        /* preview is optional */
      });

    return () => {
      cancelled = true;
    };
  }, [showSurvey, incomingProfile, prediction]);

  /**
   * Build the feature vector, run the prediction, and record it in history.
   *
   * @param {object} [surveyAnswers] - survey values to use; falls back to
   *                                   whatever is stored
   */
  const generate = useCallback(
    async (surveyAnswers) => {
      setBusy(true);
      setError('');
      setSimResult(null);

      try {
        let feats;

        if (incomingProfile) {
          feats = pickFeatures(incomingProfile);
        } else {
          setStage('fetching');
          feats = await extractFeaturesFromMongoDB(
            surveyAnswers ?? loadSurveyAnswers(),
          );
        }

        setStage('predicting');
        const result = await predictStudent(feats);

        setFeatures(feats);
        setPrediction(result);

        // Only the signed-in student's own predictions belong in history;
        // browsing another profile must not pollute it.
        if (!incomingProfile) {
          await savePrediction(result, feats);
          setHistory(await getPredictionHistory());
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
        setStage('');
      }
    },
    [incomingProfile],
  );

  /**
   * A profile opened from the Student Profiles list predicts immediately -
   * there is no survey or Generate step for someone else's row.
   */
  useEffect(() => {
    if (!incomingProfile) return;
    generate();
  }, [incomingProfile, generate]);

  /**
   * Survey submitted - the survey component already persisted the answers.
   *
   * Returns to the start screen rather than predicting straight away, so the
   * student always presses "Generate My Prediction" themselves and can see
   * their revised answers reflected in the data preview first.
   */
  const handleSurveyComplete = (answers) => {
    setSurveyAnswers(answers);
    setShowSurvey(false);
    setPrediction(null);
  };

  /**
   * Re-predict using the slider-modified features and store the result as the
   * "after" side of the comparison.
   */
  const handleSimulate = async (modifiedFeatures) => {
    setSimBusy(true);
    try {
      setSimResult(await predictStudent(modifiedFeatures));
    } catch (err) {
      setError(err.message);
    } finally {
      setSimBusy(false);
    }
  };

  // ---- STATE 1: survey not done ------------------------------------------
  if (showSurvey) {
    return (
      <StudentSurvey
        onComplete={handleSurveyComplete}
        initialAnswers={loadSurveyAnswers()}
        // Cancel is only offered once answers exist to fall back on; on a
        // first visit the survey must be completed before anything else.
        onCancel={hasSurveyAnswers() ? () => setShowSurvey(false) : undefined}
      />
    );
  }

  if (error && !prediction) {
    return <ApiErrorNotice message={error} onRetry={() => generate()} />;
  }

  // ---- STATE 3: running the first prediction ------------------------------
  if (busy && !prediction) {
    return (
      <div className="dash-progress">
        <span className="cpe-spinner" />
        <h2 className="dash-progress-title">
          Analysing your academic, behavioral and emotional data...
        </h2>
        <ul className="dash-steps">
          <li className="dash-step-done">Fetching academic data</li>
          <li className={stage === 'predicting' ? 'dash-step-done' : 'dash-step-doing'}>
            Fetching focus data
          </li>
          <li className={stage === 'predicting' ? 'dash-step-doing' : 'dash-step-todo'}>
            Running AI prediction
          </li>
        </ul>
      </div>
    );
  }

  // ---- STATE 2: survey done, no prediction yet ---------------------------
  if (!prediction) {
    return (
      <div className="dash-start">
        <h2 className="dash-start-title">Welcome back, {studentName}</h2>
        <p className="dash-start-sub">Ready to see your prediction?</p>

        {preview && (
          <div className="dash-preview">
            <span className="dash-preview-tag">We found your data</span>
            <div className="dash-preview-row">
              <span>
                GPA <b>{preview.gpa_cumulative?.toFixed(1)}</b>
              </span>
              <span>
                Attendance <b>{Math.round((preview.attendance_rate ?? 0) * 100)}%</b>
              </span>
              <span>
                Stress <b>{preview.stress_level}</b>
              </span>
              <span>
                Study hrs <b>{preview.weekly_study_hours?.toFixed(0)}</b>
              </span>
            </div>
          </div>
        )}

        {/* The four answers MongoDB cannot supply, editable in place. Every
            change saves immediately, so pressing Generate always uses the
            values currently on screen. */}
        <div className="dash-answers">
          <span className="dash-preview-tag">Your answers</span>
          <StudentSurvey
            embedded
            initialAnswers={surveyAnswers}
            onChange={setSurveyAnswers}
          />
        </div>

        <button
          type="button"
          className="dash-cta"
          onClick={() => generate(surveyAnswers)}
        >
          <span className="dash-cta-icon" aria-hidden="true">⚡</span>
          Generate My Prediction
        </button>

        <p className="dash-start-note">
          We will analyse your academic, behavioral and emotional data to predict
          your risk and career readiness.
        </p>
      </div>
    );
  }

  // ---- STATE 4: prediction complete ---------------------------------------

  // Which MongoDB-derived inputs fell back to a default. Absent when viewing
  // a profile from the list, since those rows are already complete.
  const estimatedFields = features?.__estimated ?? [];
  const estimatedCount = incomingProfile ? 0 : estimatedFields.length;

  return (
    <div className="dash">
      {!incomingProfile && (
        <div className="dash-bar">
          <div className="dash-bar-text">
            <span className="dash-bar-greeting">Welcome, {studentName}</span>
            <span className="dash-bar-note">
              Built from your live study data plus your survey answers.
            </span>
          </div>
          <div className="dash-bar-actions">
            {/* Same survey control as the start screen, so the four editable
                answers are reachable from the results view too. */}
            <button
              type="button"
              className="dash-edit-link"
              onClick={() => setShowSurvey(true)}
            >
              Change my study hours &amp; other answers
            </button>
            <button
              type="button"
              className="dash-back-btn"
              onClick={() => setPrediction(null)}
            >
              New prediction
            </button>
          </div>
        </div>
      )}

      {/* A failure during regenerate keeps the existing results on screen. */}
      {error && <div className="dash-inline-error">{error}</div>}

      {estimatedCount > 0 && (
        <div className="dash-estimate">
          <strong>{estimatedCount} of 11</strong> study-data inputs have no
          record yet, so a typical value was used for them:{' '}
          <span className="dash-estimate-list">
            {estimatedFields.map((k) => FEATURE_LABELS[k] ?? k).join(', ')}
          </span>
          . Accuracy improves as you log marks, study time, and results.
        </div>
      )}

      <div className="dash-row dash-row-3">
        <InputDataPanel features={features} />
        {/* `features` drives the career-domain match chips and the score
            breakdown, both of which are empty without it. */}
        <CareerGauge score={prediction?.career_score} studentData={features} />
        <RiskPanel
          risk_level={prediction?.academic_risk}
          prob_low={prediction?.prob_low}
          prob_medium={prediction?.prob_medium}
          prob_high={prediction?.prob_high}
          studentData={features}
        />
      </div>

      <div className="dash-row dash-row-2">
        <WhatIfSimulation
          baseFeatures={features}
          onSimulate={handleSimulate}
          busy={simBusy}
          hasResult={Boolean(simResult)}
        />
        <BeforeAfterPanel before={prediction} after={simResult} />
      </div>

      <AdvisorInsights
        career_score={prediction?.career_score}
        stress={features?.stress_level}
        sleep={features?.sleep_hours_avg}
        study_hours={features?.weekly_study_hours}
      />

      {!incomingProfile && <PredictionHistory history={history} />}
    </div>
  );
}
