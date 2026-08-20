let ctx;
let master;
let ambientNodes = null;
let runWind = null;
let lastClickAt = 0;
let noiseBuf;
let windBuf;
let lastStepSign = 0;
let lastStepAt = 0;
let stepOdd = false;

function audio() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  ensureMaster(ctx);
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function ensureMaster(c) {
  if (master) return;
  master = c.createGain();
  master.gain.value = 0.92;
  master.connect(c.destination);
}

function out() {
  return master;
}

export async function unlockAudio() {
  const c = audio();
  if (!c) return false;
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* browser may still block until a later gesture */
    }
  }
  return c.state === "running";
}

function envGain(c, start, dur, peak = 0.08) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  return g;
}

function osc(c, { type = "sine", freq, slide, start, dur, peak = 0.07 }) {
  const o = c.createOscillator();
  const g = envGain(c, start, dur, peak);
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, start + dur * 0.9);
  o.connect(g).connect(out());
  o.start(start);
  o.stop(start + dur + 0.03);
}

function getNoise(c) {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.28), c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function getWind(c) {
  if (!windBuf || windBuf.sampleRate !== c.sampleRate) {
    windBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = windBuf.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      prev = prev * 0.86 + white * 0.14;
      data[i] = prev;
    }
  }
  return windBuf;
}

function noiseBurst(c, { start, dur = 0.1, peak = 0.05, freq = 900, q = 1.2 }) {
  const n = c.createBufferSource();
  n.buffer = getNoise(c);
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = envGain(c, start, dur, peak);
  n.connect(filter).connect(g).connect(out());
  n.start(start);
  n.stop(start + dur + 0.02);
}

const PLAY = {
  jump() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "triangle", freq: 210, slide: 560, start: t, dur: 0.16, peak: 0.14 });
    osc(c, { type: "sine", freq: 90, slide: 160, start: t, dur: 0.12, peak: 0.08 });
    noiseBurst(c, { start: t, dur: 0.09, peak: 0.08, freq: 1400 });
  },
  land() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    lastStepAt = performance.now();
    osc(c, { type: "sine", freq: 78, slide: 48, start: t, dur: 0.12, peak: 0.12 });
    noiseBurst(c, { start: t, dur: 0.1, peak: 0.1, freq: 220, q: 0.8 });
  },
  slide() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.22, peak: 0.12, freq: 340, q: 0.65 });
    osc(c, { type: "sawtooth", freq: 70, slide: 40, start: t, dur: 0.18, peak: 0.06 });
  },
  whoosh() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.11, peak: 0.1, freq: 780, q: 0.7 });
    osc(c, { type: "sine", freq: 420, slide: 180, start: t, dur: 0.1, peak: 0.05 });
  },
  hit() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "square", freq: 150, slide: 52, start: t, dur: 0.2, peak: 0.16 });
    noiseBurst(c, { start: t, dur: 0.22, peak: 0.14, freq: 180, q: 0.55 });
  },
  combo() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "triangle", freq: 440, start: t, dur: 0.09, peak: 0.12 });
    osc(c, { type: "triangle", freq: 554, start: t + 0.07, dur: 0.11, peak: 0.12 });
    osc(c, { type: "sine", freq: 659, start: t + 0.14, dur: 0.18, peak: 0.1 });
  },
  pickup() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "sine", freq: 880, start: t, dur: 0.1, peak: 0.12 });
    osc(c, { type: "sine", freq: 1320, start: t + 0.06, dur: 0.14, peak: 0.1 });
  },
  answer() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "triangle", freq: 392, start: t, dur: 0.11, peak: 0.13 });
    osc(c, { type: "triangle", freq: 523, start: t + 0.09, dur: 0.18, peak: 0.12 });
  },
  gate() {
    const c = audio();
    if (!c) return;
    osc(c, { type: "sine", freq: 330, slide: 210, start: c.currentTime, dur: 0.26, peak: 0.1 });
  },
  door() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "sawtooth", freq: 96, slide: 50, start: t, dur: 0.45, peak: 0.09 });
    noiseBurst(c, { start: t, dur: 0.35, peak: 0.08, freq: 240, q: 0.8 });
  },
  near() {
    const c = audio();
    if (!c) return;
    osc(c, { type: "sine", freq: 740, start: c.currentTime, dur: 0.13, peak: 0.09 });
  },
  enter() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "sine", freq: 262, start: t, dur: 0.18, peak: 0.1 });
    osc(c, { type: "sine", freq: 392, start: t + 0.1, dur: 0.22, peak: 0.1 });
  },
  book() {
    const c = audio();
    if (!c) return;
    noiseBurst(c, { start: c.currentTime, dur: 0.1, peak: 0.12, freq: 180, q: 0.9 });
    osc(c, { type: "triangle", freq: 110, start: c.currentTime, dur: 0.09, peak: 0.08 });
  },
  stamp() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.08, peak: 0.14, freq: 420, q: 1.4 });
    osc(c, { type: "square", freq: 90, slide: 50, start: t, dur: 0.1, peak: 0.1 });
  },
  dart() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "triangle", freq: 640, slide: 180, start: t, dur: 0.16, peak: 0.1 });
    noiseBurst(c, { start: t + 0.14, dur: 0.07, peak: 0.11, freq: 1100, q: 2 });
  },
  click() {
    const now = performance.now();
    if (now - lastClickAt < 55) return;
    lastClickAt = now;
    const c = audio();
    if (!c) return;
    osc(c, { type: "triangle", freq: 980, start: c.currentTime, dur: 0.045, peak: 0.08 });
  },
  save() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "sine", freq: 523, start: t, dur: 0.16, peak: 0.13 });
    osc(c, { type: "sine", freq: 659, start: t + 0.08, dur: 0.18, peak: 0.12 });
    osc(c, { type: "sine", freq: 784, start: t + 0.18, dur: 0.28, peak: 0.12 });
  },
  fanfare() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    [392, 523, 659, 784, 1046].forEach((freq, i) => {
      osc(c, { type: "triangle", freq, start: t + i * 0.1, dur: 0.3, peak: 0.13 });
    });
    osc(c, { type: "sine", freq: 523, start: t + 0.42, dur: 0.55, peak: 0.08 });
  },
  levelUp() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    [523, 659, 784, 1046, 1318].forEach((freq, i) => {
      osc(c, { type: "triangle", freq, start: t + i * 0.08, dur: 0.28, peak: 0.14 });
    });
    osc(c, { type: "sine", freq: 784, start: t + 0.28, dur: 0.55, peak: 0.09 });
  },
  tape() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.16, peak: 0.16, freq: 2100, q: 0.7 });
    noiseBurst(c, { start: t + 0.04, dur: 0.12, peak: 0.1, freq: 900, q: 0.8 });
    osc(c, { type: "square", freq: 180, slide: 70, start: t, dur: 0.14, peak: 0.08 });
  },
  start() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    osc(c, { type: "sine", freq: 349, start: t, dur: 0.16, peak: 0.12 });
    osc(c, { type: "sine", freq: 440, start: t + 0.1, dur: 0.22, peak: 0.13 });
    osc(c, { type: "triangle", freq: 523, start: t + 0.2, dur: 0.28, peak: 0.1 });
  },
  step() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    stepOdd = !stepOdd;
    const thud = stepOdd ? 68 : 82;
    osc(c, { type: "sine", freq: thud, slide: thud - 18, start: t, dur: 0.08, peak: 0.11 });
    noiseBurst(c, { start: t, dur: 0.07, peak: 0.09, freq: stepOdd ? 190 : 240, q: 0.9 });
  },
  stepSoft() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    stepOdd = !stepOdd;
    osc(c, { type: "sine", freq: stepOdd ? 96 : 108, slide: 70, start: t, dur: 0.07, peak: 0.07 });
    noiseBurst(c, { start: t, dur: 0.06, peak: 0.055, freq: 280, q: 1 });
  },
};

export function play(name) {
  PLAY[name]?.();
}

export function tickSteps(gait, kind = "off") {
  if (kind === "off") {
    lastStepSign = 0;
    return;
  }
  const sign = Math.sin(gait) >= 0 ? 1 : -1;
  if (sign === lastStepSign || sign < 0) {
    lastStepSign = sign;
    return;
  }
  lastStepSign = sign;
  const now = performance.now();
  if (now - lastStepAt < 95) return;
  lastStepAt = now;
  play(kind === "walk" ? "stepSoft" : "step");
}

export function setRunWind(enabled) {
  const c = audio();
  if (!c) return;

  if (enabled) {
    if (runWind) return;
    const src = c.createBufferSource();
    src.buffer = getWind(c);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 560;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.07, c.currentTime + 0.45);
    src.connect(filter).connect(g).connect(out());
    src.start();
    runWind = { src, g };
    return;
  }

  if (!runWind) return;
  const node = runWind;
  runWind = null;
  try {
    node.g.gain.cancelScheduledValues(c.currentTime);
    node.g.gain.setValueAtTime(Math.max(0.0001, node.g.gain.value), c.currentTime);
    node.g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.28);
  } catch {
    /* already fading */
  }
  window.setTimeout(() => {
    try {
      node.src.stop();
      node.src.disconnect();
      node.g.disconnect();
    } catch {
      /* already stopped */
    }
  }, 320);
}

export function startAmbient(kind = "library") {
  const c = audio();
  if (!c) return;
  stopAmbient();
  const noise = c.createBufferSource();
  noise.buffer = getWind(c);
  noise.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value =
    kind === "lecture-hall" ? 900 : kind === "exam-hall" ? 700 : kind === "faculty-science" ? 1200 : 480;
  const g = c.createGain();
  g.gain.value = 0.042;
  noise.connect(filter).connect(g).connect(out());
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
