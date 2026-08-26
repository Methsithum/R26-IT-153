let ctx;
let graph;
let ambientNodes = null;
let runWind = null;
let lastClickAt = 0;
let noiseBuf;
let windBuf;
let lastStepSign = 0;
let lastStepAt = 0;
let stepOdd = false;

let musicMode = "off";
let nextNoteTime = 0;
let beatCount = 0;
let schedulerId = 0;
let padNodes = null;
let musicHeld = false;

function audio() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  ensureGraph(ctx);
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function ensureGraph(c) {
  if (graph) return graph;

  const master = c.createGain();
  master.gain.value = 0.94;

  const compressor = c.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 10;
  compressor.ratio.value = 2.8;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.14;

  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -2.5;
  limiter.knee.value = 0;
  limiter.ratio.value = 18;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;

  const sfxGain = c.createGain();
  sfxGain.gain.value = 0.9;
  const musicGain = c.createGain();
  musicGain.gain.value = 0.0001;
  const ambientGain = c.createGain();
  ambientGain.gain.value = 1;

  const convolver = c.createConvolver();
  convolver.buffer = makeImpulse(c, 0.48, 3.1);
  const reverbGain = c.createGain();
  reverbGain.gain.value = 0.22;
  const sfxSend = c.createGain();
  sfxSend.gain.value = 0.2;
  const musicSend = c.createGain();
  musicSend.gain.value = 0.12;

  sfxGain.connect(compressor);
  musicGain.connect(compressor);
  ambientGain.connect(compressor);
  sfxSend.connect(convolver);
  musicSend.connect(convolver);
  convolver.connect(reverbGain).connect(compressor);
  compressor.connect(limiter).connect(master).connect(c.destination);

  graph = { master, compressor, sfxGain, musicGain, ambientGain, sfxSend, musicSend, reverbGain };
  return graph;
}

function sfxOut() {
  return graph.sfxGain;
}

function musicOut() {
  return graph.musicGain;
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

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function jitter(value, amount) {
  return value * (1 + (Math.random() * 2 - 1) * amount);
}

function makeImpulse(c, seconds, decay) {
  const length = Math.floor(c.sampleRate * seconds);
  const buffer = c.createBuffer(2, length, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return buffer;
}

function envGain(c, start, dur, peak = 0.08, attack = 0.008) {
  const g = c.createGain();
  const a = Math.min(attack, dur * 0.35);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + a);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  return g;
}

function routeSfx(node, send = 0.18, pan = 0) {
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  node.connect(panner);
  panner.connect(sfxOut());
  if (send > 0.001) {
    const wet = ctx.createGain();
    wet.gain.value = send;
    panner.connect(wet).connect(graph.sfxSend);
  }
  return panner;
}

function tone(c, { type = "sine", freq, slide, start, dur, peak = 0.07, attack = 0.006, send = 0.16, pan = 0, detune = 0 }) {
  const o = c.createOscillator();
  const g = envGain(c, start, dur, peak, attack);
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (detune) o.detune.setValueAtTime(detune, start);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), start + dur * 0.92);
  o.connect(g);
  routeSfx(g, send, pan);
  o.start(start);
  o.stop(start + dur + 0.04);
  return o;
}

function filteredTone(c, { type = "triangle", freq, slide, start, dur, peak, filterFreq, filterQ = 0.9, filterType = "lowpass", send = 0.14, pan = 0, attack = 0.006 }) {
  const o = c.createOscillator();
  const filter = c.createBiquadFilter();
  const g = envGain(c, start, dur, peak, attack);
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), start + dur * 0.9);
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, start);
  filter.Q.value = filterQ;
  o.connect(filter).connect(g);
  routeSfx(g, send, pan);
  o.start(start);
  o.stop(start + dur + 0.04);
}

function getNoise(c) {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function getWind(c) {
  if (!windBuf || windBuf.sampleRate !== c.sampleRate) {
    windBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = windBuf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 0.22;
    }
  }
  return windBuf;
}

function noiseBurst(c, { start, dur = 0.1, peak = 0.05, freq = 900, q = 1.2, type = "bandpass", send = 0.1, pan = 0, attack = 0.004 }) {
  const n = c.createBufferSource();
  n.buffer = getNoise(c);
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = envGain(c, start, dur, peak, attack);
  n.connect(filter).connect(g);
  routeSfx(g, send, pan);
  n.start(start);
  n.stop(start + dur + 0.03);
}

function duckMusic(amount = 0.42, recover = 0.22) {
  if (!graph || musicMode === "off") return;
  const c = ctx;
  const t = c.currentTime;
  const g = graph.musicGain.gain;
  const cur = Math.max(0.0001, g.value);
  g.cancelScheduledValues(t);
  g.setValueAtTime(cur, t);
  g.linearRampToValueAtTime(Math.max(0.0001, cur * amount), t + 0.028);
  g.exponentialRampToValueAtTime(cur, t + recover);
}

function chord(c, freqs, start, dur, peak, type = "triangle") {
  freqs.forEach((freq, i) => {
    tone(c, {
      type,
      freq,
      start: start + i * 0.012,
      dur: dur + i * 0.04,
      peak: peak * (1 - i * 0.12),
      send: 0.28,
      detune: rand(-6, 6),
    });
  });
}

const PLAY = {
  jump() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.16, peak: 0.1, freq: 1600, q: 0.55, type: "highpass", send: 0.12 });
    filteredTone(c, {
      type: "triangle",
      freq: jitter(186, 0.06),
      slide: 620,
      start: t,
      dur: 0.2,
      peak: 0.13,
      filterFreq: 2400,
      send: 0.2,
    });
    tone(c, { type: "sine", freq: 92, slide: 170, start: t, dur: 0.14, peak: 0.09, send: 0.08 });
  },
  land() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    lastStepAt = performance.now();
    tone(c, { type: "sine", freq: jitter(72, 0.08), slide: 42, start: t, dur: 0.16, peak: 0.16, attack: 0.003, send: 0.1 });
    noiseBurst(c, { start: t, dur: 0.12, peak: 0.11, freq: 240, q: 0.7, send: 0.08 });
    noiseBurst(c, { start: t, dur: 0.07, peak: 0.05, freq: 1800, q: 0.8, type: "highpass", send: 0.06 });
  },
  slide() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.32, peak: 0.13, freq: 420, q: 0.55, send: 0.14 });
    filteredTone(c, {
      type: "sawtooth",
      freq: 64,
      slide: 38,
      start: t,
      dur: 0.26,
      peak: 0.06,
      filterFreq: 480,
      send: 0.1,
    });
  },
  whoosh() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    const pan = rand(-0.45, 0.45);
    noiseBurst(c, { start: t, dur: 0.14, peak: 0.12, freq: jitter(920, 0.12), q: 0.6, send: 0.16, pan });
    tone(c, { type: "sine", freq: jitter(380, 0.1), slide: 150, start: t, dur: 0.12, peak: 0.045, send: 0.1, pan });
  },
  hit() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    duckMusic(0.38, 0.2);
    filteredTone(c, {
      type: "square",
      freq: jitter(128, 0.08),
      slide: 46,
      start: t,
      dur: 0.22,
      peak: 0.12,
      filterFreq: 700,
      filterQ: 0.7,
      send: 0.12,
    });
    tone(c, { type: "sine", freq: 58, slide: 36, start: t, dur: 0.18, peak: 0.14, attack: 0.002, send: 0.06 });
    noiseBurst(c, { start: t, dur: 0.2, peak: 0.16, freq: 190, q: 0.5, send: 0.1 });
  },
  combo() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    chord(c, [523.25, 659.25, 783.99], t, 0.16, 0.09);
    tone(c, { type: "sine", freq: 1046.5, start: t + 0.12, dur: 0.22, peak: 0.07, send: 0.32 });
  },
  pickup() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    const root = jitter(988, 0.03);
    tone(c, { type: "sine", freq: root, start: t, dur: 0.09, peak: 0.11, send: 0.22 });
    tone(c, { type: "sine", freq: root * 1.5, start: t + 0.05, dur: 0.12, peak: 0.09, send: 0.24 });
    tone(c, { type: "triangle", freq: root * 2, start: t + 0.1, dur: 0.16, peak: 0.06, send: 0.28 });
  },
  answer() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    chord(c, [392, 493.88], t, 0.18, 0.1, "triangle");
    tone(c, { type: "sine", freq: 587.33, start: t + 0.1, dur: 0.24, peak: 0.08, send: 0.3 });
  },
  gate() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    filteredTone(c, {
      type: "triangle",
      freq: 196,
      slide: 294,
      start: t,
      dur: 0.28,
      peak: 0.09,
      filterFreq: 1400,
      send: 0.26,
    });
    tone(c, { type: "sine", freq: 392, start: t + 0.12, dur: 0.22, peak: 0.07, send: 0.24 });
  },
  door() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.42, peak: 0.09, freq: 210, q: 0.7, send: 0.18 });
    filteredTone(c, {
      type: "sawtooth",
      freq: 108,
      slide: 54,
      start: t,
      dur: 0.5,
      peak: 0.07,
      filterFreq: 420,
      send: 0.16,
    });
    noiseBurst(c, { start: t + 0.28, dur: 0.12, peak: 0.06, freq: 900, q: 1.1, send: 0.1 });
  },
  near() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    tone(c, { type: "sine", freq: 784, start: t, dur: 0.12, peak: 0.06, send: 0.28 });
    tone(c, { type: "triangle", freq: 1175, start: t + 0.06, dur: 0.14, peak: 0.045, send: 0.3 });
  },
  enter() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    chord(c, [261.63, 329.63, 392], t, 0.28, 0.08);
  },
  book() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.11, peak: 0.13, freq: 210, q: 0.85, send: 0.08 });
    tone(c, { type: "triangle", freq: jitter(140, 0.1), start: t, dur: 0.1, peak: 0.08, send: 0.06 });
    noiseBurst(c, { start: t + 0.04, dur: 0.06, peak: 0.05, freq: 1400, q: 1.2, type: "highpass", send: 0.05 });
  },
  stamp() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.09, peak: 0.16, freq: 480, q: 1.3, send: 0.1 });
    tone(c, { type: "sine", freq: 82, slide: 48, start: t, dur: 0.11, peak: 0.12, attack: 0.002, send: 0.06 });
    noiseBurst(c, { start: t + 0.02, dur: 0.07, peak: 0.05, freq: 2400, q: 0.8, type: "highpass", send: 0.08 });
  },
  dart() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.12, peak: 0.08, freq: 1800, q: 0.7, type: "highpass", send: 0.12 });
    tone(c, { type: "triangle", freq: jitter(720, 0.08), slide: 210, start: t, dur: 0.15, peak: 0.08, send: 0.14 });
    noiseBurst(c, { start: t + 0.13, dur: 0.08, peak: 0.12, freq: 1250, q: 2.2, send: 0.1 });
  },
  click() {
    const now = performance.now();
    if (now - lastClickAt < 50) return;
    lastClickAt = now;
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.03, peak: 0.06, freq: 3200, q: 1.4, type: "highpass", send: 0.04 });
    tone(c, { type: "triangle", freq: jitter(1680, 0.08), start: t, dur: 0.032, peak: 0.045, attack: 0.001, send: 0.05 });
  },
  save() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    chord(c, [523.25, 659.25, 783.99, 1046.5], t, 0.36, 0.09);
  },
  fanfare() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    [
      [392, 493.88, 587.33],
      [523.25, 659.25, 783.99],
      [659.25, 783.99, 987.77],
    ].forEach((notes, i) => {
      chord(c, notes, t + i * 0.18, 0.34, 0.1);
    });
    tone(c, { type: "sine", freq: 523.25, start: t + 0.52, dur: 0.7, peak: 0.07, send: 0.34 });
  },
  levelUp() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      tone(c, { type: "triangle", freq, start: t + i * 0.07, dur: 0.26, peak: 0.1 - i * 0.012, send: 0.3 });
    });
    chord(c, [523.25, 783.99, 1046.5], t + 0.28, 0.55, 0.08);
  },
  tape() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, { start: t, dur: 0.18, peak: 0.15, freq: 2400, q: 0.65, send: 0.12 });
    noiseBurst(c, { start: t + 0.05, dur: 0.12, peak: 0.09, freq: 900, q: 0.8, send: 0.1 });
    tone(c, { type: "triangle", freq: 160, slide: 70, start: t, dur: 0.14, peak: 0.07, send: 0.08 });
  },
  start() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    chord(c, [349.23, 440, 523.25], t, 0.42, 0.09);
  },
  pauseHold() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    chord(c, [196, 246.94, 293.66], t, 0.55, 0.055);
    tone(c, { type: "sine", freq: 392, start: t + 0.08, dur: 0.42, peak: 0.035, send: 0.28 });
  },
  pauseLift() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    chord(c, [261.63, 329.63, 392], t, 0.32, 0.05);
  },
  step() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    stepOdd = !stepOdd;
    const pan = stepOdd ? -0.22 : 0.22;
    const thud = jitter(stepOdd ? 74 : 88, 0.07);
    tone(c, { type: "sine", freq: thud, slide: thud * 0.72, start: t, dur: 0.07, peak: rand(0.07, 0.1), attack: 0.002, send: 0.04, pan });
    noiseBurst(c, {
      start: t,
      dur: 0.055,
      peak: rand(0.055, 0.08),
      freq: stepOdd ? 210 : 270,
      q: 0.95,
      send: 0.03,
      pan,
    });
  },
  stepSoft() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    stepOdd = !stepOdd;
    const pan = stepOdd ? -0.18 : 0.18;
    tone(c, {
      type: "sine",
      freq: jitter(stepOdd ? 102 : 118, 0.06),
      slide: 76,
      start: t,
      dur: 0.06,
      peak: 0.05,
      attack: 0.003,
      send: 0.05,
      pan,
    });
    noiseBurst(c, { start: t, dur: 0.05, peak: 0.04, freq: 320, q: 1.1, send: 0.03, pan });
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
  if (now - lastStepAt < 100) return;
  lastStepAt = now;
  play(kind === "walk" ? "stepSoft" : "step");
}

function fadeGain(node, value, seconds = 0.4) {
  const c = ctx;
  if (!c || !node) return;
  const g = node.gain;
  const t = c.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.exponentialRampToValueAtTime(Math.max(0.0001, value), t + seconds);
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
    filter.frequency.value = 720;
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.13;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(filter.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.048, c.currentTime + 0.55);
    src.connect(filter).connect(g).connect(graph.ambientGain);
    src.start();
    lfo.start();
    runWind = { src, g, lfo, filter };
    return;
  }

  if (!runWind) return;
  const node = runWind;
  runWind = null;
  fadeGain(node.g, 0.0001, 0.32);
  window.setTimeout(() => {
    try {
      node.src.stop();
      node.lfo.stop();
      node.src.disconnect();
      node.g.disconnect();
    } catch {
      /* already stopped */
    }
  }, 360);
}

const BASS = [98, 98, 110, 82.4, 98, 130.8, 110, 87.3];
const PLUCKS = [392, 440, 493.88, 587.33, 659.25, 523.25];

function musicTone(c, dest, { type = "sine", freq, start, dur, peak, filterFreq = 1200 }) {
  const o = c.createOscillator();
  const filter = c.createBiquadFilter();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(filter).connect(g).connect(dest);
  const wet = c.createGain();
  wet.gain.value = 0.18;
  g.connect(wet).connect(graph.musicSend);
  o.start(start);
  o.stop(start + dur + 0.03);
}

function scheduleBeat(time, beat) {
  const c = ctx;
  if (!c || musicMode === "off") return;
  const celebrate = musicMode === "celebrate";
  const interior = musicMode === "interior";
  const eighth = beat;

  if (musicHeld) {
    if (eighth % 32 === 4) {
      const note = PLUCKS[(eighth / 4) % PLUCKS.length];
      musicTone(c, musicOut(), {
        type: "triangle",
        freq: note,
        start: time,
        dur: 0.7,
        peak: 0.022,
        filterFreq: 1100,
      });
    }
    return;
  }

  if (!interior && eighth % 2 === 0) {
    const n = c.createBufferSource();
    n.buffer = getNoise(c);
    const f = c.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = celebrate ? 6000 : 7500;
    const g = envGain(c, time, celebrate ? 0.05 : 0.04, celebrate ? 0.035 : 0.018, 0.002);
    n.connect(f).connect(g).connect(musicOut());
    n.start(time);
    n.stop(time + 0.06);
  }

  if (!interior && eighth % 4 === 0) {
    musicTone(c, musicOut(), {
      type: "sine",
      freq: celebrate ? 72 : 64,
      start: time,
      dur: 0.16,
      peak: celebrate ? 0.05 : 0.028,
      filterFreq: 220,
    });
  }

  if (!interior && eighth % 8 === 0) {
    const note = BASS[(eighth / 8) % BASS.length];
    musicTone(c, musicOut(), {
      type: "triangle",
      freq: note,
      start: time,
      dur: 0.38,
      peak: 0.045,
      filterFreq: 420,
    });
  }

  if (eighth % (interior ? 32 : 16) === 4) {
    const note = PLUCKS[(eighth / 4) % PLUCKS.length];
    musicTone(c, musicOut(), {
      type: "triangle",
      freq: note * (celebrate ? 1.5 : 1),
      start: time,
      dur: interior ? 0.55 : 0.28,
      peak: interior ? 0.03 : 0.04,
      filterFreq: interior ? 1400 : 2200,
    });
  }
}

function tickScheduler() {
  const c = ctx;
  if (!c || musicMode === "off") return;
  const bpm = musicMode === "celebrate" ? 112 : 96;
  const step = 60 / bpm / 2;
  while (nextNoteTime < c.currentTime + 0.28) {
    scheduleBeat(nextNoteTime, beatCount);
    nextNoteTime += step;
    beatCount += 1;
  }
}

function startPad(mode) {
  const c = ctx;
  stopPad();
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  const filter = c.createBiquadFilter();
  const g = c.createGain();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  o1.type = "sawtooth";
  o2.type = "sawtooth";
  o1.frequency.value = mode === "interior" ? 196 : 146.8;
  o2.frequency.value = mode === "interior" ? 246.9 : 220;
  o2.detune.value = 9;
  filter.type = "lowpass";
  filter.frequency.value = mode === "interior" ? 520 : 780;
  filter.Q.value = 0.7;
  lfo.frequency.value = mode === "interior" ? 0.07 : 0.11;
  lfoGain.gain.value = mode === "interior" ? 90 : 160;
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(mode === "celebrate" ? 0.05 : mode === "interior" ? 0.028 : 0.034, c.currentTime + 0.8);
  lfo.connect(lfoGain).connect(filter.frequency);
  o1.connect(filter);
  o2.connect(filter);
  filter.connect(g).connect(musicOut());
  const wet = c.createGain();
  wet.gain.value = 0.35;
  g.connect(wet).connect(graph.musicSend);
  o1.start();
  o2.start();
  lfo.start();
  padNodes = { o1, o2, lfo, g, filter };
}

function stopPad() {
  if (!padNodes) return;
  const nodes = padNodes;
  padNodes = null;
  try {
    fadeGain(nodes.g, 0.0001, 0.35);
  } catch {
    /* already fading */
  }
  window.setTimeout(() => {
    try {
      nodes.o1.stop();
      nodes.o2.stop();
      nodes.lfo.stop();
      nodes.o1.disconnect();
      nodes.o2.disconnect();
      nodes.g.disconnect();
    } catch {
      /* already stopped */
    }
  }, 400);
}

function startScheduler() {
  if (schedulerId) return;
  const c = ctx;
  nextNoteTime = c.currentTime + 0.05;
  beatCount = 0;
  schedulerId = window.setInterval(tickScheduler, 80);
}

function stopScheduler() {
  if (schedulerId) {
    window.clearInterval(schedulerId);
    schedulerId = 0;
  }
}

const MUSIC_LEVEL = {
  off: 0.0001,
  run: 0.09,
  interior: 0.05,
  celebrate: 0.125,
};

export function setMusic(mode) {
  const c = audio();
  if (!c) return;
  const next = mode || "off";
  if (next === musicMode) return;
  musicMode = next;
  fadeGain(graph.musicGain, MUSIC_LEVEL[next] ?? 0.0001, next === "off" ? 0.5 : 0.45);
  if (next === "off") {
    stopScheduler();
    stopPad();
    return;
  }
  startPad(next);
  startScheduler();
}

export function setPausedAtmosphere(enabled) {
  const c = audio();
  if (!c || !graph) return;
  musicHeld = Boolean(enabled);
  if (enabled) {
    lastStepSign = 0;
  }
  const base = MUSIC_LEVEL[musicMode] ?? 0.0001;
  fadeGain(graph.musicGain, enabled ? Math.max(0.0001, base * 0.78) : base, 0.42);
  fadeGain(graph.ambientGain, enabled ? 0.84 : 1, 0.42);
  fadeGain(graph.reverbGain, enabled ? 0.34 : 0.22, 0.5);
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
    kind === "lecture-hall" ? 980 : kind === "exam-hall" ? 640 : kind === "faculty-science" ? 1280 : 440;
  const g = c.createGain();
  g.gain.value = kind === "library" ? 0.038 : 0.032;
  noise.connect(filter).connect(g).connect(graph.ambientGain);
  const toneOsc = c.createOscillator();
  const toneFilter = c.createBiquadFilter();
  const toneG = c.createGain();
  toneOsc.type = "sine";
  toneOsc.frequency.value = kind === "exam-hall" ? 196 : kind === "lecture-hall" ? 174 : 146;
  toneFilter.type = "lowpass";
  toneFilter.frequency.value = 380;
  toneG.gain.value = 0.012;
  toneOsc.connect(toneFilter).connect(toneG).connect(graph.ambientGain);
  noise.start();
  toneOsc.start();
  ambientNodes = { noise, g, toneOsc, toneG };
}

export function stopAmbient() {
  if (!ambientNodes) return;
  const nodes = ambientNodes;
  ambientNodes = null;
  try {
    nodes.noise.stop();
    nodes.toneOsc?.stop();
    nodes.noise.disconnect();
    nodes.g.disconnect();
    nodes.toneOsc?.disconnect();
    nodes.toneG?.disconnect();
  } catch {
    /* already stopped */
  }
}
