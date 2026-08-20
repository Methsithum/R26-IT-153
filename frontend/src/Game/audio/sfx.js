let ctx;
let ambientNodes = null;
let lastClickAt = 0;

function audio() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlockAudio() {
  audio();
}

function envGain(c, start, dur, peak = 0.08) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  return g;
}

function osc(c, { type = "sine", freq, slide, start, dur, peak = 0.07 }) {
  const o = c.createOscillator();
  const g = envGain(c, start, dur, peak);
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, start + dur * 0.9);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.03);
}

function noiseBurst(c, { start, dur = 0.1, peak = 0.05, freq = 900, q = 1.2 }) {
  const n = c.createBufferSource();
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  n.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = envGain(c, start, dur, peak);
  n.connect(filter).connect(g).connect(c.destination);
  n.start(start);
  n.stop(start + dur + 0.02);
}

const PLAY = {
  jump() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "triangle", freq: 220, slide: 520, start: t, dur: 0.14, peak: 0.05 });
    noiseBurst(c, { start: t, dur: 0.08, peak: 0.03, freq: 1400 });
  },
  slide() {
    const c = audio();
    if (!c) return;
    noiseBurst(c, { start: c.currentTime, dur: 0.16, peak: 0.045, freq: 320, q: 0.7 });
  },
  hit() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "square", freq: 140, slide: 60, start: t, dur: 0.18, peak: 0.07 });
    noiseBurst(c, { start: t, dur: 0.2, peak: 0.08, freq: 180, q: 0.6 });
  },
  combo() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "triangle", freq: 440, start: t, dur: 0.08, peak: 0.05 });
    osc(c, { type: "triangle", freq: 554, start: t + 0.07, dur: 0.1, peak: 0.05 });
    osc(c, { type: "sine", freq: 659, start: t + 0.14, dur: 0.16, peak: 0.045 });
  },
  pickup() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "sine", freq: 880, start: t, dur: 0.09, peak: 0.045 });
    osc(c, { type: "sine", freq: 1320, start: t + 0.06, dur: 0.12, peak: 0.04 });
  },
  answer() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "triangle", freq: 392, start: t, dur: 0.1, peak: 0.055 });
    osc(c, { type: "triangle", freq: 523, start: t + 0.09, dur: 0.16, peak: 0.05 });
  },
  gate() {
    const c = audio();
    if (!c) return;
    osc(c, { type: "sine", freq: 330, slide: 220, start: c.currentTime, dur: 0.22, peak: 0.04 });
  },
  door() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "sawtooth", freq: 90, slide: 55, start: t, dur: 0.45, peak: 0.035 });
    noiseBurst(c, { start: t, dur: 0.35, peak: 0.03, freq: 240, q: 0.8 });
  },
  near() {
    const c = audio();
    if (!c) return;
    osc(c, { type: "sine", freq: 740, start: c.currentTime, dur: 0.12, peak: 0.035 });
  },
  enter() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "sine", freq: 262, start: t, dur: 0.18, peak: 0.04 });
    osc(c, { type: "sine", freq: 392, start: t + 0.1, dur: 0.22, peak: 0.04 });
  },
  book() {
    const c = audio();
    if (!c) return;
    noiseBurst(c, { start: c.currentTime, dur: 0.09, peak: 0.055, freq: 180, q: 0.9 });
    osc(c, { type: "triangle", freq: 110, start: c.currentTime, dur: 0.08, peak: 0.04 });
  },
  stamp() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.07, peak: 0.07, freq: 420, q: 1.4 });
    osc(c, { type: "square", freq: 90, slide: 50, start: t, dur: 0.09, peak: 0.05 });
  },
  dart() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "triangle", freq: 640, slide: 180, start: t, dur: 0.16, peak: 0.04 });
    noiseBurst(c, { start: t + 0.14, dur: 0.06, peak: 0.05, freq: 1100, q: 2 });
  },
  click() {
    const now = performance.now();
    if (now - lastClickAt < 55) return;
    lastClickAt = now;
    const c = audio();
    if (!c) return;
    osc(c, { type: "triangle", freq: 980, start: c.currentTime, dur: 0.04, peak: 0.03 });
  },
  save() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "sine", freq: 523, start: t, dur: 0.16, peak: 0.055 });
    osc(c, { type: "sine", freq: 659, start: t + 0.08, dur: 0.18, peak: 0.05 });
    osc(c, { type: "sine", freq: 784, start: t + 0.18, dur: 0.28, peak: 0.05 });
  },
  fanfare() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    [392, 523, 659, 784].forEach((freq, i) => {
      osc(c, { type: "triangle", freq, start: t + i * 0.11, dur: 0.22, peak: 0.05 });
    });
  },
  start() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "sine", freq: 349, start: t, dur: 0.14, peak: 0.04 });
    osc(c, { type: "sine", freq: 440, start: t + 0.1, dur: 0.2, peak: 0.045 });
  },
};

export function play(name) {
  PLAY[name]?.();
}

export function startAmbient(kind = "library") {
  const c = audio();
  if (!c) return;
  stopAmbient();
  const noise = c.createBufferSource();
  const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  noise.buffer = buffer;
  noise.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = kind === "lecture-hall" ? 900 : kind === "exam-hall" ? 700 : kind === "faculty-science" ? 1200 : 480;
  const g = c.createGain();
  g.gain.value = 0.018;
  noise.connect(filter).connect(g).connect(c.destination);
  noise.start();
  ambientNodes = { noise, g };
}

export function stopAmbient() {
  if (!ambientNodes) return;
  try {
    ambientNodes.noise.stop();
    ambientNodes.noise.disconnect();
    ambientNodes.g.disconnect();
  } catch {
    /* already stopped */
  }
  ambientNodes = null;
}
