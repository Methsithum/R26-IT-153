import { useState } from 'react';

import { saveSurveyAnswers } from '../../../utils/surveyStorage';
import './styles.css';

/**
 * Sleep-regularity choices.
 *
 * `sleep_consistency` was trained on a 0-2.61 scale (median 1.175), and the
 * model scores a HIGHER value as better. The spec's 0.2/0.6/0.9 values all
 * sit in the bottom quartile of that range, which would leave the answer
 * barely able to move the prediction, so these are spread across the real
 * trained range instead - low for irregular, high for regular.
 */
const SLEEP_REGULARITY = [
  { label: 'Very Irregular', value: 0.5 },
  { label: 'Sometimes Regular', value: 1.2 },
  { label: 'Very Regular', value: 1.9 },
];

/** Upper bound the model was trained on for nightly sleep hours. */
const SLEEP_HOURS_MODEL_MAX = 7.0;

/** Map a 0-100 career clarity score to its descriptive band. */
function clarityLabel(score) {
  if (score <= 25) return 'Very Unclear';
  if (score <= 50) return 'Somewhat Unclear';
  if (score <= 75) return 'Somewhat Clear';
  return 'Very Clear';
}

/**
 * One-time survey collecting the 4 features MongoDB does not provide.
 *
 * @param {function} onComplete - called with the saved answers on submit
 * @param {object}   [initialAnswers] - existing answers when re-editing
 * @param {function} [onCancel] - when provided, shows a Cancel button
 * @param {boolean}  [embedded] - render the questions inline, without the card
 *                                chrome, title or submit button. The parent
 *                                owns the surrounding layout and reads answers
 *                                through onChange.
 * @param {function} [onChange] - called with the current answers whenever an
 *                                input moves; embedded mode only
 */
export default function StudentSurvey({
  onComplete,
  initialAnswers,
  onCancel,
  embedded = false,
  onChange,
}) {
  const [sleepHours, setSleepHours] = useState(
    initialAnswers?.sleep_hours_avg_reported ?? initialAnswers?.sleep_hours_avg ?? 7.0,
  );
  const [sleepConsistency, setSleepConsistency] = useState(
    initialAnswers?.sleep_consistency ?? 1.2,
  );
  const [workHours, setWorkHours] = useState(
    initialAnswers?.part_time_work_hours ?? 0,
  );
  const [clarity, setClarity] = useState(
    initialAnswers?.career_clarity_score ?? 50,
  );

  /**
   * Assemble the four answers into the shape the model expects.
   *
   * Sleep hours are clamped to the trained maximum before being used as a
   * model feature, while the student's real answer is kept alongside it so
   * the form can be re-opened showing what they actually chose.
   *
   * @param {object} over - values that have changed but are not yet in state
   * @returns {object}
   */
  const buildAnswers = (over = {}) => {
    const hours = over.sleepHours ?? sleepHours;
    return {
      sleep_hours_avg: Math.min(hours, SLEEP_HOURS_MODEL_MAX),
      sleep_hours_avg_reported: hours,
      sleep_consistency: over.sleepConsistency ?? sleepConsistency,
      part_time_work_hours: over.workHours ?? workHours,
      career_clarity_score: over.clarity ?? clarity,
    };
  };

  /**
   * Persist the edit and tell the parent, so an embedded survey keeps its
   * answers saved without needing a submit button.
   *
   * React state updates are asynchronous, so the changed value is passed in
   * rather than read back from state.
   *
   * @param {object} over - the field that just changed
   */
  const commit = (over) => {
    if (!embedded) return;
    const answers = buildAnswers(over);
    saveSurveyAnswers(answers);
    onChange?.(answers);
  };

  /** Save and hand the answers to the parent (standalone mode). */
  const handleSubmit = (event) => {
    event.preventDefault();
    const answers = buildAnswers();
    saveSurveyAnswers(answers);
    onComplete(answers);
  };

  // Embedded inside the Generate page the questions are just a section of
  // that page, so the form element, card chrome and submit button are all
  // dropped and every edit saves as it happens.
  const Wrapper = embedded ? 'div' : 'form';
  const wrapperProps = embedded
    ? { className: 'svy-embedded' }
    : { className: 'svy-card', onSubmit: handleSubmit };

  return (
    <Wrapper {...wrapperProps}>
      {!embedded && (
        <>
          <div className="svy-head">
            <h2 className="svy-title">
              Quick Setup — Help Us Personalise Your Prediction
            </h2>
            <p className="svy-sub">
              Answer 4 quick questions once. We use this to predict your academic
              risk and career readiness.
            </p>
          </div>

          {/* Progress indicator - all four questions are on one page, so every
              dot is shown as complete. */}
          <div className="svy-progress">
            <span className="svy-progress-text">4 questions</span>
            <div className="svy-dots">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="svy-dot svy-dot-on" />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Q1 - sleep hours */}
      <div className="svy-q">
        <label className="svy-label" htmlFor="svy-sleep">
          How many hours do you sleep on average per night?
        </label>
        <div className="svy-slider-row">
          <input
            id="svy-sleep"
            className="svy-range"
            type="range"
            min={3}
            max={12}
            step={0.5}
            value={sleepHours}
            onChange={(e) => {
                  const v = Number(e.target.value);
                  setSleepHours(v);
                  commit({ sleepHours: v });
                }}
          />
          <span className="svy-value">{sleepHours.toFixed(1)} hours</span>
        </div>
        {sleepHours > SLEEP_HOURS_MODEL_MAX && (
          <p className="svy-note">
            Great - that is above the range the model was trained on, so it is
            scored as {SLEEP_HOURS_MODEL_MAX.toFixed(1)} hours.
          </p>
        )}
      </div>

      {/* Q2 - sleep regularity */}
      <div className="svy-q">
        <span className="svy-label">How regular is your sleep schedule?</span>
        <div className="svy-choices">
          {SLEEP_REGULARITY.map(({ label, value }) => (
            <button
              key={label}
              type="button"
              className={
                sleepConsistency === value ? 'svy-choice svy-choice-on' : 'svy-choice'
              }
              onClick={() => {
                setSleepConsistency(value);
                commit({ sleepConsistency: value });
              }}
              aria-pressed={sleepConsistency === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Q3 - part-time work */}
      <div className="svy-q">
        <label className="svy-label" htmlFor="svy-work">
          How many hours per week do you work part time?
        </label>
        <div className="svy-slider-row">
          <input
            id="svy-work"
            className="svy-range"
            type="range"
            min={0}
            max={40}
            step={1}
            value={workHours}
            onChange={(e) => {
                  const v = Number(e.target.value);
                  setWorkHours(v);
                  commit({ workHours: v });
                }}
          />
          <span className="svy-value">{workHours} hours per week</span>
        </div>
        <p className="svy-note">Put 0 if you do not work</p>
      </div>

      {/* Q4 - career clarity */}
      <div className="svy-q">
        <label className="svy-label" htmlFor="svy-clarity">
          How clear are you about your career path?
        </label>
        <div className="svy-slider-row">
          <input
            id="svy-clarity"
            className="svy-range"
            type="range"
            min={0}
            max={100}
            step={1}
            value={clarity}
            onChange={(e) => {
                  const v = Number(e.target.value);
                  setClarity(v);
                  commit({ clarity: v });
                }}
          />
          <span className="svy-value">{clarityLabel(clarity)}</span>
        </div>
      </div>

      {/* Embedded mode saves on every change, so the parent's own Generate
          button is the only action needed. */}
      {!embedded && (
        <div className="svy-actions">
          {onCancel && (
            <button type="button" className="svy-cancel" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="svy-submit">
            Save &amp; Get My Prediction
          </button>
        </div>
      )}
    </Wrapper>
  );
}
