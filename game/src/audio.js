// Synthesized sound and music for SOLMAR HEAT, WebAudio only, no audio
// files. Under play runs a laid-back synthwave-ish loop (bass + pad chords
// + a hats tick), plus one-shot effects: punch, pickup, crash, siren, stash
// chime, a wanted-level sting, and the mission jingle. Audio starts only
// after a user gesture (the browser requires it); until then every call is
// a safe no-op, and the looping engine/siren voices are only built once
// sound is unlocked.

// Output levels for the two buses.
const MASTER_LEVEL = 1 / 2;
const MUSIC_LEVEL = 16 / 100;

// Am — F — C — G, one bar each; each row is [bass root, pad, pad, pad].
const PROGRESSION = [[55, 220, 261.63, 329.63],
  [43.65, 174.61, 220, 261.63],
  [65.41, 261.63, 329.63, 392],
  [49, 196, 246.94, 293.66],
];

// Short melodies: notes, gap between notes, note length, wave, gain.
const STASH_CHIME = { notes: [659.25, 830.61, 1046.5], gap: 0.08, dur: 0.25, wave: 'triangle', gain: 0.3 };
const WANTED_STING = { notes: [196, 155.56], gap: 0.13, dur: 0.22, wave: 'sawtooth', gain: 0.25 };
const MISSION_JINGLE = { notes: [523.25, 659.25, 783.99, 1046.5], gap: 0.09, dur: 0.3, wave: 'triangle', gain: 0.3 };
const FAIL_DESCENT = { notes: [392, 311, 233], gap: 0.16, dur: 0.3, wave: 'sawtooth', gain: 0.22 };
const BUSTED_SIREN = { notes: [660, 660, 520, 440], gap: 0.14, dur: 0.22, wave: 'square', gain: 0.2 };

export const createAudio = () => {
  let audioCtx = null, masterBus = null, musicBus = null;
  let engineVoice = null, engineLevel = null, sirenVoice = null, sirenLevel = null;
  let isMuted = false, musicClock = null, bar = 0;

  // Small node factories so the graph reads as a parts list.
  const makeOsc = (type, freq) => {
    const o = audioCtx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  };
  const makeGain = (value) => {
    const node = audioCtx.createGain();
    node.gain.value = value;
    return node;
  };
  const makeLowpass = (freq) => {
    const f = audioCtx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    return f;
  };
  const makeSource = (buf) => {
    const s = audioCtx.createBufferSource();
    s.buffer = buf;
    return s;
  };
  const chain = (nodes) => {
    for (let i = 0; i + 1 < nodes.length; i += 1) nodes[i].connect(nodes[i + 1]);
  };

  // Build the graph on first use; false when the browser has no WebAudio.
  const ensureGraph = () => {
    if (audioCtx !== null) return true;
    let built = false; try {
      const AC = window['AudioContext'] || window['webkitAudioContext'];
      if (AC === undefined) return false;
      const fresh = new AC();
      audioCtx = fresh;
      const sink = audioCtx.destination;
      masterBus = makeGain(isMuted ? 0 : MASTER_LEVEL);
      musicBus = makeGain(MUSIC_LEVEL);
      masterBus.connect(sink);
      musicBus.connect(masterBus, 0);
      // Engine hum: a sawtooth voice through a lowpass, quiet while parked.
      engineVoice = makeOsc('sawtooth', 55);
      engineLevel = makeGain(0);
      const engineFilter = makeLowpass(320);
      chain([engineVoice, engineFilter, engineLevel, masterBus]);
      engineVoice.start(0);
      // Police siren: a triangle voice wailing between two pitches.
      sirenVoice = makeOsc('triangle', 700);
      sirenLevel = makeGain(0);
      chain([sirenVoice, sirenLevel, masterBus]);
      sirenVoice.start(0);
      beginLoop();
      built = true;
    } catch (_err) {
      built = false;
    }
    return built;
  };

  // One enveloped oscillator note, scheduled at `when`.
  const note = (freq, when, dur, type, gain, dest) => {
    const osc = makeOsc(type, freq);
    const g = makeGain(0);
    g.gain.setValueAtTime(0.0, when);
    g.gain.linearRampToValueAtTime(gain, when + 2 / 100);
    g.gain.exponentialRampToValueAtTime(1 / 1000, when + dur);
    osc.connect(g, 0);
    g.connect(dest === undefined ? musicBus : dest);
    osc.start(when, 0);
    osc.stop(when + dur + 5 / 100);
  };

  // One bar of the loop: bass on the beat, pad shimmer, a soft tick.
  const playBar = () => {
    if (audioCtx === null || audioCtx.state !== 'running') return;
    const [root, ...chord] = PROGRESSION[bar % PROGRESSION.length];
    const now = 0.05 + audioCtx.currentTime;
    note(root, now, 1 / 2, 'triangle', 1 / 2);
    note(root * 2, now + 1 / 4, 0.22, 'sine', 0.22);
    for (const f of chord) note(f, now, 0.48, 'sine', 7 / 100);
    note(1200, now + 1 / 4, 4 / 100, 'square', 3 / 100);
    bar = bar + 1;
  };

  const beginLoop = () => {
    if (musicClock === null) musicClock = window.setInterval(playBar, 500);
  };

  // True once the graph exists and the context is actually running.
  const ready = () => ensureGraph() && audioCtx.state === 'running';

  // A short pitched blip straight onto the master bus.
  const ping = (freq, dur, type, gain) => {
    if (ready() === false) return;
    const at = audioCtx.currentTime;
    note(freq, at, dur, type, gain, masterBus);
  };

  // A burst of filtered noise that decays over `dur` seconds.
  const noise = (dur, gain, filterFreq) => {
    if (ready() === false) return;
    const rate = audioCtx.sampleRate;
    const len = Math.floor(rate * dur);
    const buffer = audioCtx.createBuffer(1, len, rate);
    const data = buffer.getChannelData(/* mono channel */ 0);
    for (let i = 0; len > i; i += 1) {
      const fade = 1 - i / len;
      data[i] = (Math.random() * 2 - 1) * fade;
    }
    const src = makeSource(buffer);
    const filter = makeLowpass(filterFreq);
    const g = makeGain(gain);
    chain([src, filter, g, masterBus]);
    src.start(0);
  };

  // Play a melody table: notes stepped out from now, on the master bus.
  const melody = (spec) => {
    if (ensureGraph() === false) return;
    const at = audioCtx.currentTime;
    spec.notes.forEach((f, i) => note(f, at + i * spec.gap, spec.dur, spec.wave, spec.gain, masterBus));
  };

  const api = {
    // Call from any user gesture; safe to call any time.
    unlock: () => {
      if (ensureGraph() && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    },
    isMuted: () => isMuted === true,
    toggleMute: () => {
      isMuted = isMuted === false;
      if (masterBus !== null) masterBus.gain.value = isMuted ? 0 : MASTER_LEVEL;
      return isMuted === true;
    },
    setDriving: (speed01) => {
      if (audioCtx === null) return;
      const level = speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0;
      engineLevel.gain.setTargetAtTime(level, audioCtx.currentTime, 0.1);
      engineVoice.frequency.setTargetAtTime(50 + 140 * speed01, audioCtx.currentTime, 0.1);
    },
    setSiren: (on) => {
      if (audioCtx === null) return;
      sirenLevel.gain.setTargetAtTime(on === true ? 0.045 : 0, audioCtx.currentTime, 0.2);
      if (on === true) {
        const wail = sirenVoice.frequency.value > 800 ? 660 : 920;
        sirenVoice.frequency.setTargetAtTime(wail, audioCtx.currentTime, 0.45);
      }
    },
    // -- combat sounds --
    punch: () => {
      noise(12 / 100, 0.5, 900);
      ping(140, 1 / 10, 'square', 1 / 4);
    },
    hit: () => {
      noise(18 / 100, 1 / 2, 500);
      ping(90, 2 / 10, 'sawtooth', 3 / 10);
    },
    crash: () => {
      noise(3 / 10, 7 / 10, 400);
    },
    // -- pickups and money --
    pickup: () => {
      ping(880, 12 / 100, 'sine', 35 / 100);
      if (audioCtx !== null) note(1320, audioCtx.currentTime + 7 / 100, 14 / 100, 'sine', 3 / 10, masterBus);
    },
    cash: () => {
      ping(660, 1 / 10, 'triangle', 3 / 10);
      if (audioCtx !== null) note(990, audioCtx.currentTime + 8 / 100, 16 / 100, 'triangle', 3 / 10, masterBus);
    },
    // A hidden stash: a rising three-note chime, brighter than plain cash.
    stash: () => {
      melody(STASH_CHIME);
    },
    // -- crime sounds --
    steal: () => {
      ping(220, 15 / 100, 'square', 1 / 4);
      if (audioCtx !== null) note(330, audioCtx.currentTime + 1 / 10, 2 / 10, 'square', 22 / 100, masterBus);
    },
    // Wanted level rose: two low brass-ish stabs.
    heat: () => {
      melody(WANTED_STING);
    },
    // -- story sounds --
    mission: () => {
      melody(MISSION_JINGLE);
    },
    fail: () => {
      melody(FAIL_DESCENT);
    },
    busted: () => {
      melody(BUSTED_SIREN);
    },
  };
  return api;
};
