import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { getProfiles, predictStudent } from '../api/predictionApi';
import InputDataPanel from '../components/InputDataPanel';
import CareerGauge from '../components/CareerGauge';
import RiskPanel from '../components/RiskPanel';
import WhatIfSimulation from '../components/WhatIfSimulation';
import BeforeAfterPanel from '../components/BeforeAfterPanel';
import AdvisorInsights from '../components/AdvisorInsights';
import LoadingState from '../components/LoadingState';
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

/**
 * Reduce a profile row (which also carries label columns) down to exactly the
 * 15 features the /predict endpoint accepts.
 */
function extractFeatures(profile) {
  const out = {};
  for (const key of FEATURE_KEYS) out[key] = profile[key];
  return out;
}

/**
 * Main dashboard. Loads a student profile, predicts on it, and feeds every
 * panel from that live API data.
 */
export default function Dashboard() {
  // A row clicked on the ProfileList page arrives via router state.
  const location = useLocation();
  const incomingProfile = location.state?.profile ?? null;

  const [features, setFeatures] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [simResult, setSimResult] = useState(null);
  const [simBusy, setSimBusy] = useState(false);

  /**
   * Load a student then predict on them. Uses the profile passed from the
   * ProfileList when present, otherwise falls back to the first profile.
   *
   * `showSpinner` is false on the initial mount because `loading` already
   * starts true - this keeps the effect from setting state synchronously.
   */
  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
      setError('');
      setSimResult(null);
    }

    try {
      let profile = incomingProfile;
      if (!profile) {
        const profiles = await getProfiles();
        if (!profiles.length) throw new Error('No student profiles returned by the API.');
        profile = profiles[0];
      }

      const feats = extractFeatures(profile);
      const result = await predictStudent(feats);

      setFeatures(feats);
      setPrediction(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [incomingProfile]);

  // Fetch on mount.
  useEffect(() => {
    load(false);
  }, [load]);

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

  if (loading) return <LoadingState />;
  if (error) return <ApiErrorNotice message={error} onRetry={load} />;

  return (
    <div className="dash">
      {/* Row 1 - inputs, career gauge, risk */}
      <div className="dash-row dash-row-3">
        <InputDataPanel features={features} />
        <CareerGauge score={prediction?.career_score} studentData={features} />
        <RiskPanel
          risk_level={prediction?.academic_risk}
          prob_low={prediction?.prob_low}
          prob_medium={prediction?.prob_medium}
          prob_high={prediction?.prob_high}
        />
      </div>

      {/* Row 2 - simulation and its before/after comparison */}
      <div className="dash-row dash-row-2">
        <WhatIfSimulation
          baseFeatures={features}
          onSimulate={handleSimulate}
          busy={simBusy}
          hasResult={Boolean(simResult)}
        />
        <BeforeAfterPanel before={prediction} after={simResult} />
      </div>

      {/* Row 3 - full-width advisor cards */}
      <AdvisorInsights
        career_score={prediction?.career_score}
        stress={features?.stress_level}
        sleep={features?.sleep_hours_avg}
        study_hours={features?.weekly_study_hours}
      />
    </div>
  );
}
