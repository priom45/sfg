const audioCtx = () => new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

function ignoreAudioError(error: unknown) {
  void error;
}

export function playOrderSound() {
  try {
    const ctx = audioCtx();
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.4);
    });

    setTimeout(() => ctx.close(), 2000);
  } catch (error) {
    ignoreAudioError(error);
  }
}

export function playAddToCartSound() {
  try {
    const ctx = audioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.08);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
    setTimeout(() => ctx.close(), 500);
  } catch (error) {
    ignoreAudioError(error);
  }
}

export function playNewOrderAlert() {
  try {
    const ctx = audioCtx();
    const now = ctx.currentTime;

    for (let r = 0; r < 3; r++) {
      const offset = r * 0.4;
      [880, 1100, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + offset + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.12, now + offset + i * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + i * 0.1 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset + i * 0.1);
        osc.stop(now + offset + i * 0.1 + 0.2);
      });
    }

    setTimeout(() => ctx.close(), 3000);
  } catch (error) {
    ignoreAudioError(error);
  }
}

export function playOrderCompleteSound() {
  try {
    const ctx = audioCtx();
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.5);
    });

    setTimeout(() => ctx.close(), 3000);
  } catch (error) {
    ignoreAudioError(error);
  }
}

export function playPickupReadyAlert() {
  try {
    const ctx = audioCtx();
    const now = ctx.currentTime;

    for (let r = 0; r < 5; r++) {
      const offset = r * 1.0;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 880;
      gain1.gain.setValueAtTime(0, now + offset);
      gain1.gain.linearRampToValueAtTime(0.2, now + offset + 0.03);
      gain1.gain.setValueAtTime(0.2, now + offset + 0.3);
      gain1.gain.linearRampToValueAtTime(0, now + offset + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now + offset);
      osc1.stop(now + offset + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 1100;
      gain2.gain.setValueAtTime(0, now + offset + 0.45);
      gain2.gain.linearRampToValueAtTime(0.2, now + offset + 0.48);
      gain2.gain.setValueAtTime(0.2, now + offset + 0.75);
      gain2.gain.linearRampToValueAtTime(0, now + offset + 0.85);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + offset + 0.45);
      osc2.stop(now + offset + 0.9);
    }

    setTimeout(() => ctx.close(), 6000);
  } catch (error) {
    ignoreAudioError(error);
  }
}

export function playAcceptSound() {
  try {
    const ctx = audioCtx();
    const now = ctx.currentTime;

    [440, 554.37, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.3);
    });

    setTimeout(() => ctx.close(), 1500);
  } catch (error) {
    ignoreAudioError(error);
  }
}
