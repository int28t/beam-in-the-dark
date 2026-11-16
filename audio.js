const SOUNDS = {
  roar: [65, 180, 0.6, 0.07, 'sawtooth'],
  parasite: [440, 65, 0.28, 0.045, 'sine'],
  step: [90, 45, 0.075, 0.025, 'triangle'],
  click: [200, 85, 0.055, 0.035, 'square'],
  key: [660, 990, 0.3, 0.065, 'sine'],
  battery: [330, 660, 0.2, 0.05, 'sine'],
  caught: [140, 38, 0.6, 0.09, 'sawtooth'],
  complete: [520, 1040, 0.6, 0.055, 'sine'],
};

export function createAudio({
  Context = globalThis.AudioContext ?? globalThis.webkitAudioContext,
} = {}) {
  let context = null,
    muted = false,
    disposed = false,
    drone = null,
    stepTimer = 0,
    scrapeTimer = 0,
    hissTimer = 0;
  const voices = new Set();
  function voice(frequency, endFrequency, duration, volume, type = 'sine') {
    if (disposed || muted || !context || context.state !== 'running' || voices.size >= 16)
      return null;
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      now = context.currentTime;
    let active = true;
    const node = {
      stop() {
        if (!active) return;
        try {
          oscillator.stop();
        } catch {}
        cleanup();
      },
    };
    function cleanup() {
      if (!active) return;
      active = false;
      oscillator.disconnect();
      gain.disconnect();
      voices.delete(node);
      if (drone === node) drone = null;
    }
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (duration !== null)
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    if (duration !== null) gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = cleanup;
    voices.add(node);
    oscillator.start();
    if (duration !== null) oscillator.stop(now + duration + 0.02);
    return node;
  }
  function pause() {
    for (const node of [...voices]) node.stop();
    stepTimer = scrapeTimer = hissTimer = 0;
  }
  return {
    async unlock() {
      if (disposed || !Context || muted) return false;
      try {
        if (!context) context = new Context();
        if (context.state !== 'running') await context.resume();
        return !disposed && context.state === 'running';
      } catch {
        return false;
      }
    },
    play(event) {
      const sound = SOUNDS[event];
      if (sound) voice(...sound);
    },
    update(
      dt,
      {
        threat = false,
        walking = false,
        sneaking = false,
        scraping = false,
        hissing = false,
        noise = 1,
      } = {},
    ) {
      if (threat) {
        if (!drone) drone = voice(58, 58, null, 0.025, 'triangle');
      } else drone?.stop();
      scrapeTimer -= dt;
      hissTimer -= dt;
      if (scraping && scrapeTimer <= 0) {
        voice(78, 120, 0.19, 0.022, 'sawtooth');
        scrapeTimer = 0.55;
      }
      if (hissing && hissTimer <= 0) {
        voice(240, 500, 0.25, 0.015, 'triangle');
        hissTimer = 0.8;
      }
      stepTimer -= dt;
      if (walking && stepTimer <= 0) {
        const sound = SOUNDS.step;
        voice(
          sound[0],
          sound[1],
          sound[2],
          sound[3] * (sneaking || noise <= 0.55 ? 0.25 : 1),
          sound[4],
        );
        stepTimer = sneaking || noise <= 0.55 ? 0.55 : 0.34;
      }
      if (!walking) stepTimer = 0;
    },
    setMuted(value) {
      muted = Boolean(value);
      if (muted) pause();
    },
    pause,
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
      if (context) context.close().catch(() => {});
    },
  };
}
