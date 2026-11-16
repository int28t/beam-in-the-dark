export function createFrameMeter() {
  let started = null,
    frames = 0;
  return {
    reset() {
      started = null;
      frames = 0;
    },
    sample(now) {
      if (started === null || now < started) {
        started = now;
        frames = 0;
        return null;
      }
      frames++;
      const elapsed = now - started;
      if (elapsed < 1000) return null;
      const fps = Math.round((frames * 1000) / elapsed);
      started = now;
      frames = 0;
      return fps;
    },
  };
}
