import { useEffect, useRef, useState } from "react";
import { predictFocusState } from "../lib/focusApi";

const PREDICT_INTERVAL_MS = 2000;
const SMOOTH_N = 4; // ~8s window so Fatigue / Anxiety can surface without a 20s wait

// Published whenever no face is in frame. Nothing is being measured then, so every
// class reads 0% rather than leaving the last reading on screen looking current.
const ZERO_PROBS = { Focused: 0, Fatigue: 0, Anxiety: 0, Boredom: 0 };

/**
 * Owns the webcam stream + prediction loop at a level above the Monitoring
 * tab, so the session keeps running when the user switches tabs instead of
 * restarting the camera every time Monitoring mounts/unmounts.
 */
export function useFocusCamera(active, onDetection) {
  const captureVideoRef = useRef(null); // hidden <video>, always mounted, feeds the canvas capture
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const historyRef = useRef([]);

  const [internalStatus, setInternalStatus] = useState("idle"); // starting | live | denied | unsupported, while active
  const camStatus = active ? internalStatus : "idle"; // avoids a synchronous setState in the effect below when deactivating
  const [stream, setStream]           = useState(null);
  const [probs, setProbs]             = useState(ZERO_PROBS);
  const [confidence, setConfidence]   = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [predictError, setPredictError] = useState(null);

  useEffect(() => {
    if (!active) return; // nothing to start; camStatus already reads as "idle" while inactive

    if (!navigator.mediaDevices?.getUserMedia) {
      setInternalStatus("unsupported");
      return;
    }

    let cancelled = false;
    setInternalStatus("starting");

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (captureVideoRef.current) captureVideoRef.current.srcObject = s;
        setStream(s);
        setInternalStatus("live");
      })
      .catch(() => {
        if (!cancelled) setInternalStatus("denied");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      historyRef.current = [];
      // A resumed session starts from nothing measured yet, so it reads 0% until
      // the first face is found rather than resurfacing the last session's numbers.
      setProbs(ZERO_PROBS);
      setConfidence(0);
      setFaceDetected(false);
    };
  }, [active]);

  useEffect(() => {
    if (camStatus !== "live") return;

    const tick = async () => {
      const video  = captureVideoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg", 0.8);

      try {
        const result = await predictFocusState(base64);
        setPredictError(null);
        setFaceDetected(result.face_detected);
        if (!result.face_detected || !result.state) {
          // Zero the readout, but deliberately keep historyRef: face detection drops
          // out on a large share of frames, so clearing the vote on every gap would
          // throw away the smoothing instead of just pausing it.
          setProbs(ZERO_PROBS);
          setConfidence(0);
          return;
        }

        setProbs(result.probs);

        // Majority vote over recent predictions so a single noisy frame
        // can't flip the whole app's state / retrigger the modal.
        const hist = historyRef.current;
        hist.push(result.state);
        if (hist.length > SMOOTH_N) hist.shift();
        const counts = {};
        for (const s of hist) counts[s] = (counts[s] || 0) + 1;
        const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        let smoothed = ranked[0][0];
        const fatN = counts.Fatigue || 0;
        if (fatN >= 2) smoothed = "Fatigue";
        else if (smoothed === "Boredom" && (counts.Boredom || 0) * 2 <= hist.length) {
          smoothed = (ranked.find(([s]) => s !== "Boredom") || ["Focused"])[0];
        }
        const smoothedConfidence = result.probs[smoothed] ?? result.confidence;
        setConfidence(smoothedConfidence); // must describe `smoothed` -- the state the UI actually shows

        onDetection?.(smoothed, result.probs, PREDICT_INTERVAL_MS, smoothedConfidence);
      } catch (err) {
        setPredictError(err?.response?.data?.detail || "Backend unavailable");
      }
    };

    const id = setInterval(tick, PREDICT_INTERVAL_MS);
    tick();
    return () => clearInterval(id);
  }, [camStatus, onDetection]);

  return { captureVideoRef, canvasRef, camStatus, stream, probs, confidence, faceDetected, predictError };
}
