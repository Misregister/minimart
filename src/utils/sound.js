// Sound Utility using Web Audio API
// No external files required

const AudioContext = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioContext();

// Volume multiplier (0.1 = quiet, 0.5 = medium, 1.0 = loud)
let volumeMultiplier = 0.8; // เพิ่มเสียงให้ดังขึ้น (จาก 0.1 เป็น 0.8)

export const playBeep = () => {
    try {
        if (ctx.state === 'suspended') ctx.resume();

        const t = ctx.currentTime;
        const duration = 0.15;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Standard Scanner Beep: High pitch sine wave
        // Clear, professional, responsive
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Envelope: Quick attack, sustain, quick release
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volumeMultiplier, t + 0.01);
        gain.gain.setValueAtTime(volumeMultiplier, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.start(t);
        osc.stop(t + duration);

    } catch (e) {
        console.error("Audio play failed", e);
    }
};

export const playError = () => {
    try {
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Error buzz: Low pitch, saw/square, LOUDER
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.4);

        gain.gain.setValueAtTime(volumeMultiplier * 0.6, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.4);

        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

export const playClick = () => {
    // User requested the same sound for click and scan
    playBeep();
};
