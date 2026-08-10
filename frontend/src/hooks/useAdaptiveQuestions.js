import { useCallback, useEffect, useRef, useState } from 'react';
import { submitCheckpointAnswer } from '../services/gameApi';
import { isDemoUser } from '../constants/demoMode';
import { buildGate, buildStaticGates, padOptions, scheduleGateAhead } from '../utils/questionGates';
import { generateMissionGates } from '../constants/missionQuestions';

/**
 * Manages in-path question gates — static (demo) or adaptive (backend LLM).
 * No correct/wrong logic; every lane choice is recorded as the student's answer.
 */
export default function useAdaptiveQuestions({
  session,
  mapId,
  userId,
  playerZ,
  onSessionUpdate,
  onAdventureComplete,
  staticOnly = false,
}) {
  const [gates, setGates] = useState([]);
  const [activeInputGate, setActiveInputGate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const sessionRef = useRef(session);
  const initialized = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Initialize gates from backend session or static fallback
  useEffect(() => {
    if (initialized.current) return;

    if (session?.question && session?.options?.length) {
      initialized.current = true;
      setGates([
        buildGate({
          id: 'backend-q0',
          z: -40,
          question: session.question,
          options: session.options,
          question_type: session.question_type || 'lane',
          question_id: 'backend-0',
        }),
        buildGate({ id: 'backend-q1', z: -85, question: '...', options: ['...', '...', '...', '...'], question_type: 'lane' }),
        buildGate({ id: 'backend-q2', z: -130, question: '...', options: ['...', '...', '...', '...'], question_type: 'lane' }),
      ]);
      // Hide placeholder gates until answered — only show first real gate
      setGates([
        buildGate({
          id: 'backend-q0',
          z: -40,
          question: session.question,
          options: session.options,
          question_type: session.question_type || 'lane',
        }),
      ]);
      return;
    }

    if (mapId) {
      initialized.current = true;
      setGates(buildStaticGates(mapId, generateMissionGates));
    }
  }, [session, mapId]);

  const resolveGate = useCallback(async (gateId, laneIndex, gate) => {
    if (gate.question_type && gate.question_type !== 'lane') {
      setActiveInputGate(gate);
      return { needsInput: true };
    }

    const answer = gate.options[laneIndex] ?? gate.options[0];
    return submitAnswer(gate, answer);
  }, [session, userId, playerZ]);

  const submitInputAnswer = useCallback(async (gate, value) => {
    setActiveInputGate(null);
    return submitAnswer(gate, value);
  }, [session, userId, playerZ]);

  const submitAnswer = async (gate, answer) => {
    const demo = isDemoUser(userId) || staticOnly || !sessionRef.current?.session_id
      || sessionRef.current?.session_id === 'demo-session';

    if (demo) {
      setGates((prev) => prev.filter((g) => g.id !== gate.id));
      return { answer, demo: true };
    }

    setSubmitting(true);
    try {
      const response = await submitCheckpointAnswer({
        sessionId: sessionRef.current.session_id,
        answer,
      });

      sessionRef.current = { ...sessionRef.current, ...response };
      onSessionUpdate?.(response);

      setGates((prev) => prev.filter((g) => g.id !== gate.id));

      if (response.completed) {
        onAdventureComplete?.(response);
        return { answer, completed: true, response };
      }

      if (response.question) {
        const next = scheduleGateAhead(
          playerZ,
          response.question,
          response.options,
          response.question_type || 'lane',
        );
        setGates((prev) => [...prev, next]);
      }

      return { answer, response };
    } catch (_err) {
      return { answer, error: true };
    } finally {
      setSubmitting(false);
    }
  };

  const resetForMap = useCallback((newMapId) => {
    initialized.current = false;
    setGates(buildStaticGates(newMapId, generateMissionGates));
    initialized.current = true;
  }, []);

  return {
    gates,
    activeInputGate,
    submitting,
    resolveGate,
    submitInputAnswer,
    clearInputGate: () => setActiveInputGate(null),
    resetForMap,
    padOptions,
  };
}
