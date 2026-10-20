import { useEffect, useRef, useState } from "react";
import { predictFocusState } from "../lib/focusApi";

const PREDICT_INTERVAL_MS = 2000;
const SMOOTH_N = 4;

const ZERO_PROBS = { Focused: 0, Fatigue: 0, Anxiety: 0, Boredom: 0 };

export function useFocusCamera(active, onDetection) {
  const captureVideoRef = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const historyRef = useRef([]);

  const [internalStatus, setInternalStatus] = useState("idle");
  const camStatus = active ? internalStatus : "idle";
  const [stream, setStream]           = useState(null);
  const [probs, setProbs]             = useState(ZERO_PROBS);
  const [confidence, setConfidence]   = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [predictError, setPredictError] = useState(null);

  useEffect(() => {
    if (!active) return;

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
          setProbs(ZERO_PROBS);
          setConfidence(0);
          return;
        }

        setProbs(result.probs);

        const hist = historyRef.current;
        hist.push(result.state);
        if (hist.length > SMOOTH_N) hist.shift();
        const counts = {};
        for (const s of hist) counts[s] = (counts[s] || 0) + 1;
        const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        let smoothed = ranked[0][0];
        const smoothedConfidence = result.probs[smoothed] ?? result.confidence;
        setConfidence(smoothedConfidence);

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
