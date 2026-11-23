// Sound for Solara, all synthesized with WebAudio: no audio files, no
// network. The engine hum follows the car's speed, the siren wails while the
// player is wanted, gunshots and pickups are short bursts, and a low-key
// bass line keeps time. Nothing here plays before the first user gesture,
// and every call is guarded so a browser with no audio still runs the game.
export function createAudio() {
  const engine = { osc: null, gain: null };
  const siren = { osc: null, gain: null, high: false, timer: 0 };
  const music = { timer: 0, step: 0 };
  let ctx = null;
  let master = null;
  let muted = false;

  // A slow bass line in A minor, one note a beat, with a hat tick on the off-beat.
  const BASS_LINE = [55, 0, 55, 65.41, 55, 0, 49, 55];
  const BEAT = 0.42;

  function buildVoice(type, startFreq) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = startFreq;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    return { osc, gain };
  }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      const e = buildVoice('sawtooth', 50);
      engine.osc = e.osc;
      engine.gain = e.gain;
      const s = buildVoice('triangle', 700);
      siren.osc = s.osc;
      siren.gain = s.gain;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, duration, type, volume) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Sound is optional.
    }
  }

  function burstNoise(duration, volume, cutoff) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Sound is optional.
    }
  }

  function playArpeggio(notes, gap, duration, type, volume) {
    notes.forEach((freq, i) => {
      setTimeout(() => tone(freq, duration, type, volume), i * gap);
    });
  }

  function musicTick(dt) {
    if (!ctx || muted) return;
    music.timer -= dt;
    if (music.timer > 0) return;
    music.timer += BEAT;
    const note = BASS_LINE[music.step % BASS_LINE.length];
    music.step += 1;
    if (note > 0) tone(note, 0.38, 'triangle', 0.1);
    if (music.step % 2 === 0) burstNoise(0.03, 0.03, 6000);
  }

  function updateEngine(speed) {
    const target = speed > 20 ? 0.05 + Math.min(0.09, speed / 6000) : 0;
    engine.gain.gain.value += (target - engine.gain.gain.value) * 0.1;
    engine.osc.frequency.value = 50 + speed * 0.25;
  }

  function updateSiren(dt, wanted) {
    siren.timer -= dt;
    if (wanted <= 0) {
      siren.gain.gain.value = 0;
      return;
    }
    // Two-tone wail: the oscillator flips between 700 and 950 Hz every 0.45 s.
    siren.gain.gain.value = 0.045;
    if (siren.timer > 0) return;
    siren.timer = 0.45;
    siren.high = !siren.high;
    siren.osc.frequency.value = siren.high ? 950 : 700;
  }

  return {
    // Call on the first user gesture; also safe to call every frame.
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    shot() { burstNoise(0.12, 0.5, 3000); },
    punch() { burstNoise(0.08, 0.3, 1200); },
    pickup() { tone(880, 0.12, 'sine', 0.25); tone(1320, 0.18, 'sine', 0.18); },
    cash() { tone(660, 0.1, 'square', 0.12); tone(990, 0.14, 'square', 0.1); },
    mission() { playArpeggio([523, 659, 784, 1047], 90, 0.25, 'triangle', 0.2); },
    fail() { tone(220, 0.3, 'sawtooth', 0.15); tone(165, 0.4, 'sawtooth', 0.15); },
    busted() { tone(330, 0.2, 'square', 0.2); tone(220, 0.5, 'square', 0.2); },
    // Continuous sounds, called every frame with the live state.
    update(dt, speed, wanted) {
      if (!ctx || muted) return;
      try {
        updateEngine(speed);
        updateSiren(dt, wanted);
        musicTick(dt);
      } catch {
        // Sound is optional.
      }
    },
  };
}
