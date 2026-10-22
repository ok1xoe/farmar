// Hra Farmář Eda: stavy hry, vykreslení, vstup, smyčka (logika 50 Hz).
(function (root) {
    'use strict';

    var FE = root.FE;
    var canvas = document.getElementById('screen');
    var ctx = canvas.getContext('2d');
    var scr = new FE.Screen();

    var state = 'title';        // title | ready | play | dying | complete | over | win | paused
    var lv = null, player = null, levelIndex = 0;
    var score = 0, lives = 3, hi = 0, nextLife = 10000;
    var stateTimer = 0, frame = 0, prevState = 'play';
    var held = { left: false, right: false, up: false, down: false, jump: false };
    var jumpBuf = 0;

    try { hi = parseInt(localStorage.getItem('farmar.hi'), 10) || 0; } catch (e) { hi = 0; }

    // ---------- pomocné ----------
    function pad(n, len) { var s = String(n); while (s.length < len) { s = '0' + s; } return s; }

    function line(row, str, ink, x) {
        var px = x === undefined ? Math.floor((256 - FE.textWidth(str, 1)) / 2) : x;
        FE.drawText(scr, px, row * 8 - 1, str, ink, 1);
    }

    function addScore(n) {
        score += n;
        if (score > hi) {
            hi = score;
            try { localStorage.setItem('farmar.hi', String(hi)); } catch (e) { /* ignorovat */ }
        }
        if (score >= nextLife) { lives = Math.min(lives + 1, 9); nextLife += 10000; FE.sound.exit(); }
    }

    function setBorder(color) {
        var c = FE.PAL[color & 7];
        document.body.style.background = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    }

    // ---------- průběh hry ----------
    function startGame() {
        score = 0; lives = 3; nextLife = 10000; levelIndex = 0;
        loadLevel();
    }

    function loadLevel() {
        lv = FE.loadLevel(FE.LEVELS[levelIndex], levelIndex);
        player = FE.newPlayer(lv);
        state = 'ready'; stateTimer = 80;
        setBorder(lv.def.theme.border);
        FE.sound.stopTune();
    }

    function toTitle() {
        state = 'title';
        setBorder(0);
        FE.sound.startTune();
    }

    function startDying() {
        state = 'dying';
        stateTimer = 70;
        FE.sound.die();
    }

    function playTick() {
        var inp = {
            dx: (held.right ? 1 : 0) - (held.left ? 1 : 0),
            up: held.up, down: held.down && !held.up,
            jump: held.jump || jumpBuf > 0
        };
        if (jumpBuf > 0) { jumpBuf--; }
        var ev = FE.tick(lv, player, inp);
        if (ev.jumped) { FE.sound.jump(); jumpBuf = 0; }
        if (ev.egg) { addScore(100 * ev.egg); FE.sound.egg(); }
        if (ev.grain) { addScore(50 * ev.grain); FE.sound.grain(); }
        if (ev.quack) { FE.sound.quack(); }
        if (player.dead) { startDying(); return; }
        if (lv.eggsLeft <= 0) { state = 'complete'; stateTimer = 0; FE.sound.exit(); }
    }

    function tick() {
        frame++;
        switch (state) {
            case 'ready':
                if (--stateTimer <= 0) { state = 'play'; }
                break;
            case 'play':
                playTick();
                break;
            case 'dying':
                if (--stateTimer <= 0) {
                    lives--;
                    if (lives < 0) { state = 'over'; FE.sound.over(); }
                    else { FE.respawn(lv); player = FE.newPlayer(lv); state = 'ready'; stateTimer = 50; }
                }
                break;
            case 'complete':
                if (lv.time > 0) {
                    var take = Math.min(lv.time, 100);
                    lv.time -= take;
                    addScore(Math.ceil(take / 5));
                    if ((frame & 3) === 0) { FE.sound.tick(); }
                } else if (++stateTimer > 25) {
                    levelIndex++;
                    if (levelIndex >= FE.LEVELS.length) { state = 'win'; FE.sound.win(); }
                    else { loadLevel(); }
                }
                break;
        }
    }

    // ---------- vykreslení ----------
    function drawCage() {
        var d = lv.duck, x, y;
        // klec: rám 48x24 a svislé pruty
        scr.fillCells(0, 0, 6, 3, 6, 0, 0);
        for (x = 0; x < 48; x++) { scr.block(x, 0, 1, 1, 1, 6, true); scr.block(x, 23, 1, 1, 1, 6, true); }
        for (y = 0; y < 24; y++) { scr.block(0, y, 1, 1, 1, 6, true); scr.block(47, y, 1, 1, 1, 6, true); }
        for (x = 4; x < 47; x += 6) {
            if (d.out && x > 10 && x < 40) { continue; }   // vypuštěno: dvířka dole otevřená
            for (y = 1; y < 23; y++) { scr.block(x, y, 1, 1, 1, 6, true); }
        }
        if (!d.out) {
            scr.sprite(12, 5, FE.SPR.duck[(frame >> 4) & 1], 14, false);
        }
    }

    function drawLevel() {
        var th = lv.def.theme;
        scr.clear(0, 7);
        for (var r = FE.TOP; r < FE.ROWS; r++) {
            for (var c = 0; c < FE.COLS; c++) {
                var ch = lv.cells[r][c];
                if (ch === ' ') { continue; }
                var ink = ch === '=' || ch === 'T' ? th.plat : (ch === 'H' ? th.lad : (ch === 'e' ? 15 : 14));
                if (ch === 'e' && ((frame + c * 5) & 63) < 3) { ink = 11; }
                scr.pattern(c, r, FE.TILES[ch], ink);
            }
        }
        lv.hens.forEach(function (h) {
            var spr = (h.mode === 'walk' ? FE.SPR.hen : FE.SPR.henUp)[(h.anim >> 4) & 1];
            var by = h.wait > 0 ? 1 + ((h.anim >> 2) & 1) : 0;
            scr.sprite(h.x, h.y - spr.length + by, spr, th.hen, h.dir < 0);
        });
        drawPlayer();
        drawCage();
        if (lv.duck.out) {
            scr.sprite(lv.duck.x, lv.duck.y, FE.SPR.duck[(lv.duck.flap >> 3) & 1], 14, lv.duck.dir < 0);
        }
    }

    function drawPlayer() {
        if (state === 'dying' && (stateTimer & 4)) { return; }
        var S = FE.SPR.eda, spr;
        if (player.mode === 'climb') { spr = S.climb[player.moved ? ((player.anim >> 2) & 1) : 0]; }
        else if (player.mode === 'air') { spr = S.jump; }
        else if (player.moved) { spr = S.walk[(player.anim >> 3) & 1]; }
        else { spr = S.stand; }
        scr.sprite(player.x, player.y - 16, spr, 15, player.face < 0);
    }

    function drawHud() {
        scr.fillCells(6, 0, 26, 3, 7, 0, 0);
        FE.drawText(scr, 54, -1, 'SKÓRE ' + pad(score, 6) + '  REKORD ' + pad(hi, 6), 6, 1);
        FE.drawText(scr, 54, 7, 'ÚROVEŇ ' + (levelIndex + 1) + '/' + FE.LEVELS.length + '  ŽIVOTY ' + Math.max(0, lives) + '  VEJCE ' + lv.eggsLeft, 7, 1);
        var bonus = Math.ceil(lv.time / 5);
        FE.drawText(scr, 54, 15, 'BONUS ' + pad(bonus, 4), lv.freeze > 0 ? 11 : 5, 1);
        var frac = Math.max(0, lv.time / lv.limit);
        var ink = lv.freeze > 0 ? 13 : (frac > 0.4 ? 12 : (frac > 0.2 ? 14 : 10));
        var w = Math.floor(128 * frac);
        scr.fillCells(15, 2, 17, 1, ink, 0, 1);
        for (var x = 0; x < w; x++) { scr.block(120 + x, 19, 1, 3, 1, ink, true); }
    }

    function drawTitle() {
        scr.clear(0, 7);
        var title = 'FARMÁŘ EDA';
        var x = Math.floor((256 - FE.textWidth(title, 2)) / 2);
        var cols = [14, 12, 10, 13, 11, 9];
        for (var i = 0; i < title.length; i++) {
            FE.drawText(scr, x + i * 12, 14, title.charAt(i), cols[(i + (frame >> 3)) % cols.length], 2);
        }
        var r;
        for (r = 0; r < 32; r++) { scr.pattern(r, 5, FE.TILES['='], 6); scr.pattern(r, 23, FE.TILES['='], 2); }
        // ozdoby: klec s kachnou, Eda, slepice a vejce
        scr.sprite(16, 28, FE.SPR.duck[(frame >> 4) & 1], 14, false);
        var wx = 40 + ((frame >> 1) % 176);
        scr.sprite(wx, 46 - 16 + 8, FE.SPR.eda.walk[(wx >> 2) & 1], 15, false);
        scr.sprite(232 - ((frame >> 1) % 176), 38, FE.SPR.hen[(frame >> 4) & 1], 13, true);
        scr.pattern(26, 4, FE.TILES.e, ((frame >> 3) & 1) ? 15 : 14);
        scr.pattern(3, 4, FE.TILES.g, 14);

        line(8, 'REKORD ' + pad(hi, 6), 6);
        line(10, 'SEBER VŠECHNA VEJCE NA OBRAZOVCE', 7);
        line(11, 'ZRNO ZASTAVÍ ČAS (50 BODŮ)', 14);
        line(12, 'SLEPICE I KACHNA TĚ HONÍ - UHÝBEJ!', 13);
        line(14, 'ŠIPKY NEBO A D   POHYB', 5);
        line(15, 'NAHORU/DOLŮ NEBO W S   ŽEBŘÍK', 5);
        line(16, 'MEZERNÍK   SKOK', 5);
        line(17, 'P - PAUZA     M - ZVUK', 5);
        if ((frame >> 5) & 1) { line(20, 'STISKNI MEZERNÍK NEBO KLEPNI', 15); }
        line(22, 'ZX STYL - 8 ÚROVNÍ', 3);
    }

    function banner(a, b) {
        scr.fillCells(4, 8, 24, 4, 7, 1, 1);
        scr.block(32, 64, 192, 32, 0, 0, false);
        FE.drawText(scr, Math.floor((256 - FE.textWidth(a, 2)) / 2), 68, a, 15, 2);
        line(11, b, 15);
    }

    function draw() {
        if (state === 'title') {
            drawTitle();
        } else {
            drawLevel();
            drawHud();
            if (state === 'paused') { banner('PAUZA', 'P - POKRAČOVAT'); }
            else if (state === 'over') { banner('KONEC HRY', 'SKÓRE ' + pad(score, 6) + '  MEZERNÍK = MENU'); }
            else if (state === 'win') { banner('VYHRÁL JSI!', 'SKÓRE ' + pad(score, 6) + '  MEZERNÍK = MENU'); }
            else if (state === 'ready') { banner('ÚROVEŇ ' + (levelIndex + 1), lv.def.name); }
            else if (state === 'complete') { line(14, 'ÚROVEŇ SPLNĚNA - BONUS ČASU', 15); }
        }
        scr.render(ctx);
    }

    // ---------- vstup ----------
    function press() {
        FE.sound.unlock();
        if (state === 'title') { startGame(); }
        else if (state === 'over' || state === 'win') { toTitle(); }
    }

    function togglePause() {
        if (state === 'play' || state === 'ready') { prevState = state; state = 'paused'; }
        else if (state === 'paused') { state = prevState; }
    }

    var KEYS = {
        37: 'left', 65: 'left', 39: 'right', 68: 'right', 38: 'up', 87: 'up', 40: 'down', 83: 'down', 32: 'jump'
    };

    document.addEventListener('keydown', function (e) {
        var k = KEYS[e.keyCode];
        if (k) {
            e.preventDefault();
            held[k] = true;
            if (!e.repeat && (k === 'jump' || k === 'up')) { press(); }
            if (!e.repeat && k === 'jump') { jumpBuf = 6; }
        } else if (e.keyCode === 13) {
            e.preventDefault();
            press();
        } else if (e.keyCode === 80) {
            togglePause();
        } else if (e.keyCode === 77) {
            if (!FE.sound.toggleMute() && state === 'title') { FE.sound.startTune(); }
        }
        FE.sound.unlock();
    });

    document.addEventListener('keyup', function (e) {
        var k = KEYS[e.keyCode];
        if (k) { held[k] = false; }
    });

    function releaseAll() { held.left = held.right = held.up = held.down = held.jump = false; jumpBuf = 0; }

    Array.prototype.forEach.call(document.querySelectorAll('#touch button'), function (b) {
        var act = b.getAttribute('data-act');
        function down(e) {
            e.preventDefault();
            FE.sound.unlock();
            if (act === 'pause') { togglePause(); return; }
            held[act] = true;
            if (act === 'jump') { jumpBuf = 6; }
            if (act === 'jump' || act === 'up') { press(); }
        }
        function up(e) { e.preventDefault(); if (act !== 'pause') { held[act] = false; } }
        b.addEventListener('pointerdown', down);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('pointerleave', up);
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });

    canvas.addEventListener('pointerdown', function () {
        if (state === 'title' || state === 'over' || state === 'win') { press(); }
        else if (state === 'paused') { togglePause(); }
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            releaseAll();
            if (state === 'play' || state === 'ready') { prevState = state; state = 'paused'; }
        }
    });

    // ---------- celočíselné měřítko ----------
    function fit() {
        var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        var availH = window.innerHeight - (touch ? 120 : 24);
        var s = Math.min(window.innerWidth / 256, availH / 192);
        s = s >= 1 ? Math.floor(s) : Math.max(0.5, s);
        canvas.style.width = Math.round(256 * s) + 'px';
        canvas.style.height = Math.round(192 * s) + 'px';
    }
    window.addEventListener('resize', fit);
    fit();

    // ---------- smyčka (fixní krok 50 Hz) ----------
    var last = 0, acc = 0, STEP = 20;

    function loop(ts) {
        var dt = Math.min(250, ts - last || 0);
        last = ts;
        if (state !== 'paused') {
            acc += dt;
            while (acc >= STEP) { tick(); acc -= STEP; }
        } else {
            acc = 0;
            frame++;
        }
        draw();
        requestAnimationFrame(loop);
    }

    FE.game = {
        _get: function () { return { state: state, lv: lv, player: player, score: score, lives: lives, levelIndex: levelIndex, hi: hi }; },
        _tick: tick, _draw: draw, _start: startGame, _held: held, _press: press, _pause: togglePause,
        _scr: scr, _setTitle: toTitle
    };

    toTitle();
    requestAnimationFrame(loop);
})(window);
