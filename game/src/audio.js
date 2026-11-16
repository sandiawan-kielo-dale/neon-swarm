// Synthesized sound effects with the Web Audio API. No audio files, no network.
// Everything is created lazily on the first user gesture; shot mode never touches it.
export function createSfx() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx !== null;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, freqEnd, duration, type, volume, when = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noise(duration, volume, filterFreq) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    shoot() { tone(880, 220, 0.09, 'square', 0.10); },
    enemyShoot() { tone(320, 140, 0.12, 'sawtooth', 0.06); },
    explosion(big) {
      noise(big ? 0.55 : 0.3, big ? 0.5 : 0.28, big ? 900 : 1400);
      tone(big ? 160 : 220, 40, big ? 0.5 : 0.28, 'sine', 0.4);
    },
    hit() {
      noise(0.25, 0.4, 700);
      tone(200, 50, 0.3, 'sawtooth', 0.3);
    },
    pickup() {
      tone(523, 523, 0.08, 'sine', 0.22);
      tone(659, 659, 0.08, 'sine', 0.22, 0.07);
      tone(784, 784, 0.14, 'sine', 0.22, 0.14);
    },
    wave() {
      tone(392, 392, 0.12, 'triangle', 0.2);
      tone(523, 523, 0.12, 'triangle', 0.2, 0.1);
      tone(659, 659, 0.2, 'triangle', 0.2, 0.2);
    },
    boss() {
      tone(110, 110, 0.4, 'sawtooth', 0.3);
      tone(116, 116, 0.4, 'sawtooth', 0.3, 0.45);
    },
    gameOver() {
      tone(392, 392, 0.25, 'triangle', 0.25);
      tone(311, 311, 0.25, 'triangle', 0.25, 0.22);
      tone(233, 180, 0.5, 'triangle', 0.25, 0.44);
    },
  };
}
