const STEP = 60 / 146 / 4;
const RIFF = [
  [40, 40, 43, 40, 47, 46, 43, 38],
  [40, 40, 43, 40, 50, 47, 46, 43],
  [40, 40, 43, 40, 47, 46, 43, 38],
  [45, 45, 43, 45, 46, 43, 38, 39],
];
const MOTORS = {
  wagon: [38, 35, 320, 1.99],
  coupe: [48, 54, 540, 2.02],
  tow: [29, 27, 235, 2.99],
  ambulance: [38, 43, 390, 2.49],
  hearse: [33, 35, 290, 1.49],
};
const STINGS = {
  lap: [52, 55, 59],
  shortcut: [59, 64, 67],
  recover: [43, 47, 52],
  draftReady: [64, 71, 76],
  won: [52, 55, 57, 59, 64],
  lost: [55, 54, 52, 40],
};
const hz = (note) => 440 * 2 ** ((note - 69) / 12);

export function createAudio() {
  let ctx, master, score, engine, effects, guitar, noise;
  let motor, overtone, rival, engineFilter, motorGain, rivalGain;
  let roadGain, roadFilter, driver, gear = 0, shiftUntil = 0;
  const shiftSpeeds = [0, 38, 66, 89, 112, 137];
  let step = 0;
  let next = 0;
  let muted = false;
  let playing = false;
  let suspended = false;
  let duckUntil = 0;

  function gain(value, output) {
    const node = ctx.createGain();
    node.gain.value = value;
    node.connect(output);
    return node;
  }

  function filter(type, frequency, output) {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.connect(output);
    return node;
  }

  function oscillator(type, frequency, output) {
    const node = ctx.createOscillator();
    node.type = type;
    node.frequency.value = frequency;
    node.connect(output);
    return node;
  }

  function initialize() {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return;
    ctx = new AudioContext();

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 5;
    compressor.connect(ctx.destination);
    master = gain(muted ? 0 : 0.78, compressor);
    score = gain(0, master);
    engine = gain(0, master);
    effects = gain(1, master);

    const cabinet = filter('lowpass', 2900, gain(0.72, score));
    const distortion = ctx.createWaveShaper();
    distortion.curve = Float32Array.from({ length: 1025 }, (_, i) => Math.tanh((i / 512 - 1) * 3.5));
    distortion.oversample = '2x';
    distortion.connect(cabinet);
    guitar = filter('highpass', 150, distortion);

    noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    roadGain = gain(0, engine);
    roadFilter = filter('bandpass', 680, roadGain);
    roadFilter.Q.value = 0.6;
    const rolling = ctx.createBufferSource();
    rolling.buffer = noise;
    rolling.loop = true;
    rolling.connect(roadFilter);
    rolling.start();

    motorGain = gain(0, engine);
    engineFilter = filter('lowpass', 440, motorGain);
    motor = oscillator('sawtooth', 38, engineFilter);
    overtone = oscillator('triangle', 76, gain(0.55, engineFilter));
    rivalGain = gain(0, filter('lowpass', 330, engine));
    rival = oscillator('sawtooth', 46, rivalGain);
    motor.start();
    overtone.start();
    rival.start();
  }

  function target(param, value, time = 0.035) {
    param.setTargetAtTime(value, ctx.currentTime, time);
  }

  function envelope(at, dur, volume, output) {
    const node = gain(0.0001, output);
    node.gain.setValueAtTime(0.0001, at);
    node.gain.linearRampToValueAtTime(volume, at + 0.006);
    node.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    return node;
  }

  function tone(at, dur, from, to, type, volume, output) {
    const voice = envelope(at, dur, volume, output);
    const node = oscillator(type, from, voice);
    node.frequency.setValueAtTime(from, at);
    node.frequency.exponentialRampToValueAtTime(to, at + dur * 0.85);
    node.onended = () => voice.disconnect();
    node.start(at);
    node.stop(at + dur);
  }

  function burst(at, dur, frequency, type, volume, output) {
    const voice = envelope(at, dur, volume, output);
    const bank = filter(type, frequency, voice);
    const node = ctx.createBufferSource();
    node.buffer = noise;
    node.connect(bank);
    node.onended = () => {
      bank.disconnect();
      voice.disconnect();
    };
    node.start(at);
    node.stop(at + dur);
  }

  function beat(index, at) {
    const bar = Math.floor(index / 16) % RIFF.length;
    const beat = index % 16;
    const note = RIFF[bar][Math.floor(beat / 2)];
    if ([0, 6, 8, 11].includes(beat)) {
      tone(at, 0.18, 122, 42, 'sine', beat === 0 ? 0.23 : 0.18, score);
    }
    if (beat === 4 || beat === 12) {
      burst(at, 0.14, 1700, 'highpass', 0.15, score);
      tone(at, 0.075, 174, 120, 'triangle', 0.1, score);
    }
    if (beat % 2 === 0 || (bar === 3 && beat >= 13)) {
      burst(
        at,
        beat % 4 === 2 ? 0.085 : 0.035,
        6400,
        'highpass',
        beat % 4 === 2 ? 0.07 : 0.042,
        score,
      );
    }
    if (beat % 2 === 0 || beat === 15) {
      const root = hz(note - 12);
      tone(at, STEP * 1.65, root * 1.015, root, 'triangle', 0.17, score);
    }
    if ([0, 2, 5, 6, 8, 10, 13, 14].includes(beat)) {
      const length = STEP * (beat % 4 === 0 ? 2.2 : 0.95);
      const root = hz(note + 12);
      tone(at, length, root * 1.025, root, 'sawtooth', 0.037, guitar);
      tone(at + 0.008, length, root * 1.5, root * 1.5, 'sawtooth', 0.022, guitar);
      if (beat % 4 === 0) tone(at + 0.013, length, root * 2.008, root * 2, 'triangle', 0.019, guitar);
    }
  }

  function sync(state, active) {
    if (!ctx || ctx.state !== 'running') return;
    const at = ctx.currentTime;
    if (!active || suspended || !state?.player) {
      if (playing) {
        target(score.gain, 0, 0.02);
        target(engine.gain, 0, 0.02);
      }
      playing = false;
      driver = null;
      return;
    }
    if (!playing || next < at) next = at + 0.015;
    playing = true;

    const phase = state.phase;
    const airborne = phase === 'jump' || phase === 'tow';
    const ejected = phase === 'clutch' || airborne;
    const ducked = at < duckUntil || ejected;
    target(score.gain, ducked ? 0.37 : 0.84, ducked ? 0.025 : 0.12);
    target(engine.gain, airborne ? 0 : ejected ? 0.16 : 1, ejected ? 0.02 : 0.07);

    const { kind, speed } = state.player;
    const pace = Math.min(1, Math.max(0, speed) / 140);
    const [idle, range, cutoff, harmonic] = MOTORS[kind] ?? MOTORS.wagon;
    let current = 0;
    while (current + 1 < shiftSpeeds.length && speed >= shiftSpeeds[current + 1]) current++;
    if (driver !== state.player || phase !== 'drive' || muted) {
      gear = Math.max(0, current);
      driver = phase === 'drive' && !muted ? state.player : null;
      shiftUntil = 0;
    } else if (current > gear || (current < gear && speed < shiftSpeeds[gear] - 5)) {
      gear = Math.max(0, current);
      shiftUntil = at + 0.115;
      burst(at, 0.06, 420, 'bandpass', 0.059, engine);
    }
    const rev = Math.max(0, Math.min(1, (speed - shiftSpeeds[gear]) /
      ((shiftSpeeds[gear + 1] ?? 170) - shiftSpeeds[gear])));
    const pitch = idle + range * (0.25 * pace + (gear ? 0.48 : 0) + rev * 0.86);
    target(motor.frequency, pitch, 0.06);
    target(overtone.frequency, pitch * harmonic, 0.055);
    target(engineFilter.frequency, cutoff + rev * 460 + pace * 160);
    target(motorGain.gain, (0.04 + pace * 0.066) * (at < shiftUntil ? 0.42 : 1));
    target(roadFilter.frequency, 340 + pace * pace * 1320, 0.15);
    target(roadGain.gain, 0.009 + 0.103 * pace ** 2, 0.15);

    const gap = Math.min(Math.abs((state.hearse?.s ?? Infinity) - state.player.s),
      Math.abs((state.hound?.s ?? Infinity) - state.player.s));
    const close = Math.max(0, 1 - gap / 100);
    target(rival.frequency, 40 + 25 * close + Math.sin(at * (4 + close * 5)) * (1 + 3 * close));
    target(rivalGain.gain, phase === 'drive' && kind !== 'hearse' ? 0.089 * close ** 1.4 : 0);

    while (next < at + 0.1) {
      if (!muted) beat(step, next);
      step++;
      next += STEP;
    }
  }

  function event(type, detail = {}) {
    if (!ctx || ctx.state !== 'running' || muted || suspended) return;
    const at = ctx.currentTime + 0.012;
    if (type === 'start' || type === 'restart') {
      step = 0;
      next = at;
    } else if (type === 'clutch') {
      duckUntil = at + 0.32;
      burst(at, 0.2, 680, 'bandpass', 0.15, effects);
      tone(at, 0.3, 335, 118, 'triangle', 0.17, effects);
    } else if (type === 'jump') {
      duckUntil = at + 0.38;
      tone(at, 0.38, 151, 606, 'sine', 0.19, effects);
      tone(at + 0.03, 0.25, 169, 651, 'triangle', 0.07, effects);
    } else if (type === 'possess') {
      duckUntil = at + 0.39;
      burst(at, 0.12, 3400, 'highpass', 0.075, effects);
      tone(at, 0.29, 125, 525, 'sawtooth', 0.12, effects);
      tone(at + 0.06, 0.26, 479, 783, 'triangle', 0.15, effects);
    } else if (type === 'impact') {
      burst(at, 0.16, 730, 'lowpass', 0.22, effects);
      tone(at, 0.16, 76, 33, 'triangle', 0.19, effects);
    } else if (type === 'warning') {
      duckUntil = at + 0.7;
      if (detail.kind === 'bell') {
        for (const delay of [0, 0.25]) {
          tone(at + delay, 0.63, 411, 392, 'sine', 0.24, effects);
          tone(at + delay, 0.27, 1061, 1002, 'triangle', 0.08, effects);
        }
      } else {
        for (const delay of [0, 0.22]) {
          burst(at + delay, 0.15, 710, 'bandpass', 0.15, effects);
          tone(at + delay, 0.2, 113, 173, 'sawtooth', 0.11, effects);
        }
      }
    } else if (type === 'strike') {
      duckUntil = at + 0.38;
      burst(at, 0.19, detail.kind === 'ram' ? 960 : 480, 'bandpass', 0.2, effects);
      tone(at, 0.36, detail.kind === 'ram' ? 115 : 294, 46, 'triangle', 0.21, effects);
    } else if (type === 'evade') {
      burst(at, 0.18, 1750, 'bandpass', 0.10, effects);
      tone(at + 0.06, 0.14, 443, 665, 'triangle', 0.1, effects);
    } else if (type === 'relay') {
      const pitch = hz(60 + Math.min(5, detail.chain || 1) * 2);
      tone(at, 0.13, pitch, pitch, 'square', 0.052, effects);
      tone(at + 0.1, 0.25, pitch * 1.5, pitch * 2, 'triangle', 0.15, effects);
    } else if (type === 'ability') {
      duckUntil = at + 0.44;
      if (detail.kind === 'ambulance') {
        tone(at, 0.24, 520, 710, 'triangle', 0.17, effects);
        tone(at + 0.2, 0.36, 710, 520, 'triangle', 0.15, effects);
      } else if (detail.kind === 'tow') {
        burst(at, 0.16, 2700, 'highpass', 0.13, effects);
        tone(at, 0.29, 740, 156, 'triangle', 0.14, effects);
        tone(at + 0.24, 0.18, 173, 111, 'square', 0.07, effects);
      } else if (detail.kind === 'wagon') {
        burst(at, 0.11, 900, 'bandpass', 0.12, effects);
        tone(at, 0.28, 116, 107, 'triangle', 0.18, effects);
        tone(at + 0.08, 0.28, 232, 214, 'sine', 0.14, effects);
      } else if (detail.kind === 'coupe') {
        burst(at, 0.34, 2200, 'bandpass', 0.13, effects);
        tone(at, 0.37, 105, 417, 'sawtooth', 0.085, effects);
      }
    } else if (type === 'hearseHit') {
      burst(at, 0.14, 630, 'lowpass', 0.075, effects);
    } else if (type === 'tow') {
      duckUntil = at + 0.6;
      burst(at, 0.28, 930, 'bandpass', 0.13, effects);
      tone(at, 0.2, 195, 146, 'square', 0.075, effects);
      tone(at + 0.23, 0.25, 146, 98, 'square', 0.06, effects);
    } else {
      const notes = STINGS[type];
      if (!Array.isArray(notes)) return;
      duckUntil = at + 0.45;
      notes.forEach((note, i) => {
        const pitch = hz(note);
        const dur = i === notes.length - 1 ? 0.48 : 0.15;
        tone(at + i * 0.1, dur, pitch, pitch * 0.99, 'triangle', 0.18, effects);
        tone(at + i * 0.1 + 0.01, dur, pitch * 1.5, pitch * 1.485, 'sawtooth', 0.038, effects);
      });
    }
  }

  return {
    async unlock() {
      try {
        if (!ctx) initialize();
        if (!ctx) return;
        suspended = false;
        target(effects.gain, 1);
        if (ctx.state !== 'running') await ctx.resume();
      } catch {
        // Audio is optional when playback is unavailable or gesture-gated.
      }
    },
    setMuted(value) {
      muted = Boolean(value);
      if (master) target(master.gain, muted ? 0 : 0.78);
    },
    sync,
    event,
    suspend() {
      playing = false;
      suspended = true;
      driver = null;
      if (!ctx) return;
      target(score.gain, 0, 0.014);
      target(engine.gain, 0, 0.014);
      target(effects.gain, 0, 0.014);
    },
  };
}
