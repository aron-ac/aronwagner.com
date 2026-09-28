// One lazy, opt-in synthesizer per game. No audio work is done before a gesture.
export function createSynthAudio({
  button,
  volume = 0.035,
  duration = 0.12,
  type = 'sine',
  endFrequencyRatio = 1,
}) {
  let context;
  let enabled = false;
  let disposed = false;
  const voices = new Set();

  function beep(frequency = 440, length = duration, waveform = type, delay = 0) {
    if (!enabled || disposed) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context ||= new AudioContext();
      if (context.state === 'suspended') context.resume().catch(() => {});
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime + delay;
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (endFrequencyRatio !== 1) {
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * endFrequencyRatio,
          now + length,
        );
      }
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + length);
      oscillator.connect(gain).connect(context.destination);
      const voice = { oscillator, gain };
      voices.add(voice);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        voices.delete(voice);
      };
      oscillator.start(now);
      oscillator.stop(now + length);
    } catch {
      // Audio is optional; a device or permission failure cannot stop gameplay.
    }
  }

  function stopVoices() {
    for (const { oscillator, gain } of voices) {
      try {
        oscillator.stop();
      } catch {
        /* Already ended. */
      }
      oscillator.disconnect();
      gain.disconnect();
    }
    voices.clear();
  }

  function toggle() {
    enabled = !enabled;
    button.textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
    button.setAttribute('aria-pressed', String(enabled));
    if (enabled) beep(660);
    else stopVoices();
  }
  button.addEventListener('click', toggle);

  function dispose() {
    if (disposed) return;
    disposed = true;
    button.removeEventListener('click', toggle);
    stopVoices();
    if (context && context.state !== 'closed') context.close().catch(() => {});
  }
  return { beep, dispose };
}
