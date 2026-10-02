
// Audio utility for Voice Assistant
let audioCtx = null;

export function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

export function playBeep(freq, type, duration, vol) {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch(e) {}
}


export function playVoiceStart() {
    playBeep(600, 'sine', 0.15, 0.1);
    setTimeout(() => playBeep(800, 'sine', 0.15, 0.1), 100);
}

export function playVoiceStop() {
    playBeep(400, 'sine', 0.15, 0.1);
}
