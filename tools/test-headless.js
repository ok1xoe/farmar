// Headless test v Node: skutečné skripty s atrapou DOM, bot (BFS nad fyzikou) projde všechny úrovně,
// kontrola NaN, přechodů stavů a vykreslení framebufferu do PNG.
'use strict';
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var root = path.join(__dirname, '..');
var outDir = process.argv[2] || path.join(root, 'tools', 'out');
fs.mkdirSync(outDir, { recursive: true });

function stub() {
    return new Proxy(function () { }, { get: function (t, k) { return k === 'getContext' ? function () { return ctxStub; } : stub(); }, apply: function () { return stub(); }, set: function () { return true; } });
}
var lastImage = null;
var ctxStub = {
    createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData: function (img) { lastImage = img; }
};
var listeners = {};
var win = { innerWidth: 1024, innerHeight: 768, matchMedia: function () { return { matches: false }; }, addEventListener: function () { } };
global.window = win;
global.document = {
    getElementById: function () { return { getContext: function () { return ctxStub; }, addEventListener: function () { }, style: {} }; },
    querySelectorAll: function () { return []; },
    addEventListener: function (t, f) { (listeners[t] = listeners[t] || []).push(f); },
    body: { style: {} }, hidden: false
};
var store = {};
global.localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } };
global.requestAnimationFrame = function () { };
global.setInterval = function () { return 0; };
global.clearInterval = function () { };

['engine', 'levels', 'font', 'gfx', 'sprites', 'sound', 'main'].forEach(function (f) {
    var src = fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8');
    (new Function('window', 'document', 'localStorage', 'requestAnimationFrame', src.replace(/\}\)\(typeof window[^;]*;\s*$/, '})(window);')))(win, global.document, global.localStorage, global.requestAnimationFrame);
});
var FE = win.FE;
var V = require('./verify.js');
var fails = 0;
function check(c, msg) { if (!c) { console.log('  CHYBA: ' + msg); fails++; } }

function writePng(file, img) {
    var W = 256, H = 192, raw = Buffer.alloc((W * 3 + 1) * H);
    for (var y = 0; y < H; y++) {
        raw[y * (W * 3 + 1)] = 0;
        for (var x = 0; x < W; x++) {
            var o = (y * W + x) * 4, d = y * (W * 3 + 1) + 1 + x * 3;
            raw[d] = img.data[o]; raw[d + 1] = img.data[o + 1]; raw[d + 2] = img.data[o + 2];
        }
    }
    function crc(buf) { var c, n, t = crc.t; if (!t) { t = crc.t = []; for (n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) { c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } t[n] = c >>> 0; } } c = 0xFFFFFFFF; for (var i = 0; i < buf.length; i++) { c = t[(c ^ buf[i]) & 255] ^ (c >>> 8); } return (c ^ 0xFFFFFFFF) >>> 0; }
    function chunk(type, data) { var len = Buffer.alloc(4); len.writeUInt32BE(data.length); var td = Buffer.concat([Buffer.from(type), data]); var cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); }
    var ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
    // zvětšení 3x pro čitelnost
    var S = 3, W2 = W * S, H2 = H * S, raw2 = Buffer.alloc((W2 * 3 + 1) * H2);
    for (var y2 = 0; y2 < H2; y2++) {
        raw2[y2 * (W2 * 3 + 1)] = 0;
        for (var x2 = 0; x2 < W2; x2++) {
            var s = ((y2 / S | 0) * (W * 3 + 1)) + 1 + (x2 / S | 0) * 3, dd = y2 * (W2 * 3 + 1) + 1 + x2 * 3;
            raw2[dd] = raw[s]; raw2[dd + 1] = raw[s + 1]; raw2[dd + 2] = raw[s + 2];
        }
    }
    ihdr.writeUInt32BE(W2, 0); ihdr.writeUInt32BE(H2, 4);
    fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw2)), chunk('IEND', Buffer.alloc(0))]));
}
function shot(name) { G._draw(); writePng(path.join(outDir, name + '.png'), lastImage); }

var G = FE.game;
function finite(v) { return typeof v === 'number' && isFinite(v); }
function checkState(label) {
    var g = G._get();
    if (!g.player) { return; }
    var p = g.player;
    check(finite(p.x) && finite(p.y) && p.x >= 0 && p.x <= 248 && p.y >= 40 && p.y <= 191, label + ': hráč ' + p.x + ',' + p.y);
    g.lv.hens.forEach(function (h) { check(finite(h.x) && finite(h.y) && h.x >= 0 && h.x <= 248 && (h.y & 7) !== 9, label + ': slepice'); });
    check(finite(g.lv.duck.x) && finite(g.lv.duck.y), label + ': kachna');
    check(finite(g.score) && finite(g.lv.time), label + ': skóre/čas');
}

// 1) titulní obrazovka
G._draw(); shot('title');
check(G._get().state === 'title', 'start v titulní obrazovce');

// 2) kontrola dosažitelnosti
FE.LEVELS.forEach(function (d, i) {
    var r = V.verify(d, i);
    check(r.missing.length === 0, (i + 1) + '. ' + d.name + ': nedosažitelné položky ' + r.missing);
    // slepice musí stát na platformě
    d.hens.forEach(function (h) { var ch = d.rows[h.y >> 3][(h.x + 4) >> 3]; check(h.y % 8 === 0 && (ch === '=' || ch === 'T'), (i + 1) + ': slepice nestojí na platformě'); });
    var st = d.rows[d.start.y >> 3][(d.start.x + 4) >> 3];
    check(st === '=' || st === 'T', (i + 1) + ': start nestojí na platformě');
});
console.log('dosažitelnost úrovní ověřena');

// 3) bot projde všechny úrovně (bez nepřátel), přes skutečnou herní smyčku
G._press();                                   // title -> ready
check(G._get().state === 'ready', 'title -> ready');
var guardAll = 0;
while (G._get().state !== 'win' && guardAll++ < 200000) {
    var g = G._get();
    if (g.state === 'ready' || g.state === 'complete') { g.lv.noEnemies = true; G._tick(); continue; }
    if (g.state !== 'play') { check(false, 'neočekávaný stav ' + g.state); break; }
    g.lv.noEnemies = true;
    // cíle = zbývající vejce
    var targets = {}, cnt = 0;
    for (var r = 0; r < 24; r++) { for (var c = 0; c < 32; c++) { if (g.lv.cells[r][c] === 'e') { targets[r * 32 + c] = 1; cnt++; } } }
    var res = V.bfs(g.lv, V.clone(g.player), targets, false);
    if (!res.path) { check(false, 'bot nenašel cestu k vejci (úroveň ' + (g.levelIndex + 1) + ')'); break; }
    var li = g.levelIndex, before = g.lv.eggsLeft;
    for (var i = 0; i < res.path.length; i++) {
        var a = res.path[i];
        G._held.left = a.dx < 0; G._held.right = a.dx > 0; G._held.up = !!a.up; G._held.down = !!a.down; G._held.jump = !!a.jump;
        G._tick();
        checkState('bot');
        if (G._get().state !== 'play') { break; }
    }
    G._held.left = G._held.right = G._held.up = G._held.down = G._held.jump = false;
    var g2 = G._get();
    if (g2.state === 'play' && g2.levelIndex === li && g2.lv.eggsLeft === before) {
        // cesta nevedla ke sebrání (např. sebráno až o tik později) - jeden tik navíc
        G._tick();
        if (G._get().lv.eggsLeft === before && guardAll > 100000) { check(false, 'zaseknutí'); break; }
    }
    if (G._get().levelIndex !== li || G._get().state === 'complete') { if (li <= 1 || li === 7) { shot('level' + (li + 1) + '-done'); } }
}
check(G._get().state === 'win', 'bot dokončil všech 8 úrovní (stav ' + G._get().state + ', úroveň ' + (G._get().levelIndex + 1) + ')');
console.log('bot: skóre ' + G._get().score + ', životy ' + G._get().lives);
shot('win');
G._press(); check(G._get().state === 'title', 'win -> title');

// 4) vizuální snímky úrovní se spuštěnými nepřáteli
FE.LEVELS.forEach(function (d, i) {
    G._start(); G._get(); // úroveň 0
    var guard = 0;
    while (G._get().levelIndex < i && guard++ < 10) { /* přeskočení */ var gg = G._get(); gg.lv.eggsLeft = 0; G._tick(); G._tick(); for (var q = 0; q < 400 && G._get().levelIndex === guard - 1; q++) { G._tick(); } }
    for (var t = 0; t < 120; t++) { G._tick(); }
    shot('lvl' + (i + 1));
});

// 5) smrt: nehybný hráč -> kachna/slepice/čas -> dying -> over; životy klesají
G._start();
var sawDying = false, sawReady = 0, frames = 0, quack = false;
while (G._get().state !== 'over' && frames++ < 400000) {
    var s = G._get();
    if (s.state === 'dying') { sawDying = true; }
    if (s.state === 'ready') { sawReady++; }
    if (s.lv && s.lv.duck.out) { quack = true; }
    G._tick();
    checkState('idle');
    if (frames === 3500) { shot('duck'); }
}
check(G._get().state === 'over', 'idle -> over');
check(sawDying && sawReady >= 4, 'dying/ready proběhly (' + sawReady + ')');
G._draw(); shot('over');
check(G._get().lives < 0, 'životy po konci hry: ' + G._get().lives);
check(parseInt(store['farmar.hi'], 10) >= 0, 'rekord uložen');

// 5b) kachna sama (bez slepic) po vypuštění zabije stojícího hráče
FE.LEVELS[0].hens.splice(0, 9);
G._start();
var dframes = 0, duckOut = false, killedBy = null;
while (G._get().state !== 'dying' && dframes++ < 20000) {
    G._tick();
    if (G._get().lv.duck.out) { duckOut = true; }
}
check(duckOut && G._get().state === 'dying' && G._get().player.dead === 'duck', 'kachna vypuštěna a zabila hráče (' + G._get().player.dead + ')');
shot('duck-kill');

// 6) pauza a viditelnost
G._press(); G._press();
G._start();
for (var z = 0; z < 100; z++) { G._tick(); }
G._pause(); check(G._get().state === 'paused', 'pauza zapnuta');
G._pause(); check(G._get().state === 'play' || G._get().state === 'ready', 'pauza vypnuta');

// 7) náhodné mačkání kláves (fuzz) - bez NaN, bez výjimek
G._start();
var seed = 7;
function rr() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
for (var f = 0; f < 120000; f++) {
    if (f % 9 === 0) {
        G._held.left = rr() < 0.4; G._held.right = rr() < 0.4; G._held.up = rr() < 0.3; G._held.down = rr() < 0.3; G._held.jump = rr() < 0.2;
    }
    G._tick();
    if (f % 500 === 0) { checkState('fuzz'); G._draw(); }
    if (G._get().state === 'over') { G._press(); G._press(); }
    if (G._get().state === 'win') { G._press(); G._press(); }
}
console.log('fuzz hotov');

console.log(fails ? 'SELHÁNÍ: ' + fails : 'VŠE V POŘÁDKU');
process.exit(fails ? 1 : 0);
