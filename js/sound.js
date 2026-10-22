// Zvuky přes WebAudio – "beeper" (čtvercová vlna), vlastní melodie na titulní obrazovce.
(function (root) {
    'use strict';

    var FE = root.FE = root.FE || {};

    var ac = null, muted = false, tuneTimer = null, tuneStep = 0;

    try {
        var AC = root.AudioContext || root.webkitAudioContext;
        if (AC) { ac = new AC(); }
    } catch (e) { ac = null; }

    function unlock() {
        if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* ignorovat */ } }
    }

    function beep(freq, dur, slideTo, vol, delay) {
        if (!ac || muted) { return; }
        try {
            var t0 = ac.currentTime + (delay || 0);
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = 'square';
            o.frequency.setValueAtTime(freq, t0);
            if (slideTo) { o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur); }
            g.gain.setValueAtTime(vol || 0.04, t0);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            o.connect(g); g.connect(ac.destination);
            o.start(t0); o.stop(t0 + dur + 0.02);
        } catch (e) { /* ignorovat */ }
    }

    // melodie titulní obrazovky (0 = pauza), 32 kroků po 150 ms
    var TUNE = [
        330, 0, 392, 440, 494, 0, 440, 392, 330, 0, 294, 330, 392, 0, 330, 0,
        262, 0, 330, 392, 440, 0, 392, 330, 294, 330, 392, 330, 262, 0, 0, 0
    ];
    var BASS = [110, 0, 0, 0, 110, 0, 0, 0, 98, 0, 0, 0, 98, 0, 0, 0, 131, 0, 0, 0, 131, 0, 0, 0, 98, 0, 0, 0, 110, 0, 0, 0];

    FE.sound = {
        unlock: unlock,
        toggleMute: function () { muted = !muted; if (muted) { FE.sound.stopTune(); } return muted; },
        isMuted: function () { return muted; },
        jump: function () { beep(220, 0.18, 660, 0.035); },
        egg: function () { beep(880, 0.06, 0, 0.05); beep(1320, 0.09, 0, 0.05, 0.06); },
        grain: function () { beep(660, 0.05, 0, 0.04); beep(990, 0.05, 0, 0.04, 0.05); beep(1480, 0.1, 0, 0.04, 0.1); },
        quack: function () { beep(300, 0.12, 180, 0.06); beep(280, 0.12, 160, 0.06, 0.16); },
        die: function () { beep(660, 0.7, 50, 0.05); },
        exit: function () { [523, 659, 784, 1047].forEach(function (f, i) { beep(f, 0.12, 0, 0.05, i * 0.1); }); },
        over: function () { [392, 330, 262, 196].forEach(function (f, i) { beep(f, 0.25, 0, 0.05, i * 0.22); }); },
        win: function () { [523, 659, 784, 659, 784, 1047, 1047].forEach(function (f, i) { beep(f, 0.14, 0, 0.05, i * 0.13); }); },
        tick: function () { beep(1800, 0.02, 0, 0.02); },
        startTune: function () {
            if (tuneTimer || !ac) { return; }
            tuneTimer = setInterval(function () {
                var n = TUNE[tuneStep % TUNE.length], b = BASS[tuneStep % BASS.length];
                if (n) { beep(n, 0.13, 0, 0.03); }
                if (b) { beep(b, 0.3, 0, 0.03); }
                tuneStep++;
            }, 150);
        },
        stopTune: function () { if (tuneTimer) { clearInterval(tuneTimer); tuneTimer = null; } tuneStep = 0; }
    };
})(typeof window !== 'undefined' ? window : globalThis);
