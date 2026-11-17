// Synthesized sound and music for SOLMAR HEAT — WebAudio only, no audio files.
// A laid-back synthwave-ish loop (bass + pad chords + a hats tick) runs under
// play, plus one-shot effects: punch, pickup, crash, siren, mission jingle.
// Audio starts only after a user gesture (the browser requires it); until then
// every call is a safe no-op.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let beat = 0;

  // Am — F — C — G, one bar each, bass roots + pad triads.
  const CHORDS = [
    { bass: 55.0, pad: [220.0, 261.63, 329.63] },
    { bass: 43.65, pad: [174.61, 220.0, 261.63] },
    { bass: 65.41, pad: [261.63, 329.63, 392.0] },
    { bass: 49.0, pad: [196.0, 246.94, 293.66] },
  ];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function note(freq, when, dur, type, gain, dest) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(dest || musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const chord = CHORDS[beat % CHORDS.length];
      const now = ctx.currentTime + 0.05;
      // Bass on the beat, pad shimmer, a soft tick every half beat.
      note(chord.bass, now, 0.5, 'triangle', 0.5);
      note(chord.bass * 2, now + 0.25, 0.22, 'sine', 0.22);
      for (const f of chord.pad) note(f, now, 0.48, 'sine', 0.07);
      note(1200, now + 0.25, 0.04, 'square', 0.03);
      beat += 1;
    }, 500);
  }

  function blip(freq, dur, type, gain) {
    if (!ensure() || ctx.state !== 'running') return;
    note(freq, ctx.currentTime, dur, type, gain, master);
  }

  function noise(dur, gain, filterFreq) {
    if (!ensure() || ctx.state !== 'running') return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  return {
    /** Call from any user gesture; safe to call any time. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    isMuted: () => muted,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    setDriving(speed01) {
      if (!ctx) return;
      engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, ctx.currentTime, 0.1);
    },
    setSiren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(sirenOsc.frequency.value > 800 ? 660 : 920, ctx.currentTime, 0.45);
    },
    punch() {
      noise(0.12, 0.5, 900);
      blip(140, 0.1, 'square', 0.25);
    },
    hit() {
      noise(0.18, 0.5, 500);
      blip(90, 0.2, 'sawtooth', 0.3);
    },
    crash() {
      noise(0.3, 0.7, 400);
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.35);
      if (ctx) note(1320, ctx.currentTime + 0.07, 0.14, 'sine', 0.3, master);
    },
    cash() {
      blip(660, 0.1, 'triangle', 0.3);
      if (ctx) note(990, ctx.currentTime + 0.08, 0.16, 'triangle', 0.3, master);
    },
    steal() {
      blip(220, 0.15, 'square', 0.25);
      if (ctx) note(330, ctx.currentTime + 0.1, 0.2, 'square', 0.22, master);
    },
    mission() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, now + i * 0.09, 0.3, 'triangle', 0.3, master));
    },
    fail() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      [392, 311, 233].forEach((f, i) => note(f, now + i * 0.16, 0.3, 'sawtooth', 0.22, master));
    },
    busted() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      [660, 660, 520, 440].forEach((f, i) => note(f, now + i * 0.14, 0.22, 'square', 0.2, master));
    },
  };
}
