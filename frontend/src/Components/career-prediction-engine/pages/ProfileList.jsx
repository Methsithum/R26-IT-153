import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getProfiles } from '../api/predictionApi';
import LoadingState from '../components/LoadingState';
import ApiErrorNotice from '../components/ApiErrorNotice';
import './ProfileList.css';

/** Risk level -> badge modifier class. */
const RISK_CLASS = {
  Low: 'pl-badge-low',
  Medium: 'pl-badge-med',
  High: 'pl-badge-high',
};

/**
 * Table of the 20 student profiles returned by the API.
 * Clicking a row opens the Dashboard pre-loaded with that student.
 */
export default function ProfileList() {
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /**
   * Fetch the profile list from the API.
   * `showSpinner` is false on the initial mount because `loading` already
   * starts true - this keeps the effect from setting state synchronously.
   */
  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
      setError('');
    }
    try {
      setProfiles(await getProfiles());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount.
  useEffect(() => {
    load(false);
  }, [load]);

  /**
   * Send the chosen profile to the Dashboard through router state.
   * ".." is relative to this page, so it lands on the feature's index route
   * regardless of where the host app mounts the feature.
   */
  const openStudent = (profile) => {
    navigate('..', { state: { profile }, relative: 'path' });
  };

  if (loading) return <LoadingState message="Loading student profiles..." />;
  if (error) return <ApiErrorNotice message={error} onRetry={load} />;

  return (
    <section className="cpe-panel">
      <h2 className="cpe-panel-title">Student Profiles ({profiles.length})</h2>

      <div className="pl-scroll">
        <table className="pl-table">
          <thead>
            <tr>
              <th>No</th>
              <th>GPA</th>
              <th>Attendance</th>
              <th>Risk Level</th>
              <th>Career Score</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p, i) => (
              <tr
                key={i}
                className="pl-row"
                onClick={() => openStudent(p)}
                tabIndex={0}
                // Keyboard parity: Enter opens the row like a click does.
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openStudent(p);
                }}
              >
                <td>{i + 1}</td>
                <td>{p.gpa_cumulative?.toFixed(2)}</td>
                <td>{Math.round((p.attendance_rate ?? 0) * 100)}%</td>
                <td>
                  <span className={`pl-badge ${RISK_CLASS[p.academic_risk_level] ?? ''}`}>
                    {p.academic_risk_level}
                  </span>
                </td>
                <td>{p.career_readiness_score?.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="pl-hint">Select a row to open that student in the dashboard.</p>
    </section>
  );
}
