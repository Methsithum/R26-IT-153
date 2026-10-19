import { useEffect, useRef, useState } from "react";
import { predictFocusState } from "../lib/focusApi";

// VIVA SI: තත්පර දෙකකට frame එකක් යවයි; recent predictions හතරෙන් වැඩිපුර ලැබුණු state එක ගනී. | FOCUS GUIDE: Capture interval and number of recent predictions used for majority voting.
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
// VIVA SI: Camera stream සහ backend prediction loop පාලනය කරන custom React hook එකයි.
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

    // VIVA SI: Browser camera permission ඉල්ලා video stream එක අරියි. Audio ගන්නේ නැහැ. | FOCUS GUIDE: Ask for webcam video only; audio is disabled.
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
      // VIVA SI: Pause / End / component cleanup වන විට camera tracks නවතයි.
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
      // VIVA SI: Canvas එකේ frame එක JPEG Base64 image එකක් කර prediction API එකට යවන්න සකස් කරයි. | FOCUS GUIDE: Convert the captured canvas frame to a JPEG image for the prediction API.
      const base64 = canvas.toDataURL("image/jpeg", 0.8);

      try {
        // VIVA SI: Backend එකෙන් face_detected, state, confidence සහ probs අගයන් ලබාගනී. | FOCUS GUIDE: Backend response contains face detection, state, confidence, and class scores.
        const result = await predictFocusState(base64);
        setPredictError(null);
        setFaceDetected(result.face_detected);
        // VIVA SI: Face එක නැත්නම් scores zero කර return වෙයි; time update callback එක යවන්නේ නැහැ.
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
        // VIVA SI: Recent results හතරෙන් majority vote ගනී; එක frame එකකින් state එක හදිසියේ මාරු වීම අඩු කරයි.
        const hist = historyRef.current;
        hist.push(result.state);
        if (hist.length > SMOOTH_N) hist.shift();
        const counts = {};
        for (const s of hist) counts[s] = (counts[s] || 0) + 1;
        const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        let smoothed = ranked[0][0];
        const smoothedConfidence = result.probs[smoothed] ?? result.confidence;
        setConfidence(smoothedConfidence); // must describe `smoothed` -- the state the UI actually shows

        // VIVA SI: Smooth කළ state එක FocusApp.handleDetection වෙත යවා counters update කරවයි.
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
