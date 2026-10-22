// Jádro hry Farmář Eda: fyzika hráče, slepice, kachna, sbírání. Sdílí ho hra i ověřovací skripty v Node.
(function (root) {
    'use strict';

    var FE = root.FE = root.FE || {};

    var COLS = 32, ROWS = 24, TOP = 3;
    var TOPY = TOP * 8 + 16, MAXY = 190;
    // dráha skoku (px za tik, 50 Hz): nahoru 18 px, pak pád
    var JUMP = [-2, -2, -2, -2, -2, -2, -2, -1, -1, -1, -1, 0, 0, 1, 1, 1, 1];
    var FREEZE = 250;          // zrno zastaví čas na 5 s

    FE.COLS = COLS; FE.ROWS = ROWS; FE.TOP = TOP; FE.JUMP = JUMP;

    function rnd(lv) {
        lv.seed = (Math.imul(lv.seed, 1664525) + 1013904223) >>> 0;
        return lv.seed / 4294967296;
    }

    function cellAt(lv, c, r) {
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) { return ' '; }
        return lv.cells[r][c];
    }
    function isL(lv, c, r) { var ch = cellAt(lv, c, r); return ch === 'H' || ch === 'T'; }
    function solidTop(ch) { return ch === '=' || ch === 'T'; }

    // je na žebříku ve sloupci c platná výška chodidel f?
    function ladderValid(lv, c, f) {
        if (f < 0) { return false; }
        var r = f >> 3;
        return isL(lv, c, r) || ((f & 7) === 0 && isL(lv, c, r - 1));
    }
    function supportAt(lv, x, y) {
        if (y & 7) { return false; }
        var r = y >> 3;
        return solidTop(cellAt(lv, (x + 2) >> 3, r)) || solidTop(cellAt(lv, (x + 5) >> 3, r));
    }

    function loadLevel(def, index) {
        var cells = def.rows.map(function (r) { return r.split(''); });
        var eggs = 0;
        for (var r = 0; r < ROWS; r++) { for (var c = 0; c < COLS; c++) { if (cells[r][c] === 'e') { eggs++; } } }
        var lv = {
            def: def, index: index || 0, cells: cells, eggsTotal: eggs, eggsLeft: eggs,
            limit: def.limit, time: def.limit, freeze: 0, frame: 0, seed: 12345 + (index || 0) * 777,
            hens: [], duck: null, released: false, noEnemies: false,
            hspeed: Math.min(0.85, 0.45 + 0.055 * (index || 0)), dspeed: 0.5 + 0.045 * (index || 0)
        };
        FE.respawn(lv);
        return lv;
    }

    // nová pozice po smrti: čas se vrací, vejce a zrno zůstávají
    FE.respawn = function (lv) {
        lv.time = lv.limit; lv.freeze = 0; lv.released = false;
        lv.hens = lv.def.hens.map(function (h, i) {
            return { x: h.x, y: h.y, dir: h.dir || 1, mode: 'walk', acc: 0, cool: 0, wait: 0, anim: i * 3 };
        });
        lv.duck = { x: 12, y: 5, out: false, fx: 12, fy: 5, flap: 0, dir: 1 };
        lv.seed = (lv.seed ^ 0x9e3779b9) >>> 0;
    };

    function newPlayer(lv) {
        return { x: lv.def.start.x, y: lv.def.start.y, face: 1, mode: 'ground', jt: -1, ft: 0, anim: 0, moved: false, dead: null };
    }

    function clampX(x) { return x < 0 ? 0 : (x > 248 ? 248 : x); }

    function tryGrab(lv, p, f) {
        var c = (p.x + 4) >> 3;
        if (!ladderValid(lv, c, f)) { return false; }
        p.mode = 'climb'; p.x = c * 8; p.jt = -1;
        return true;
    }

    // pohyb hráče o jeden tik (bez sbírání a nepřátel)
    function move(lv, p, inp, ev) {
        ev = ev || {};
        var dx = inp.dx || 0;
        p.moved = false;
        if (p.mode === 'ground') {
            if ((inp.up || inp.down) && tryGrab(lv, p, p.y + (inp.up ? -1 : 1))) {
                /* přechází do lezení níže */
            } else if (inp.jump) {
                p.mode = 'air'; p.jt = 0; p.ft = 0; ev.jumped = true;
            } else {
                if (dx) { p.face = dx; p.x = clampX(p.x + dx); p.anim++; p.moved = true; }
                if (!supportAt(lv, p.x, p.y)) { p.mode = 'air'; p.jt = -1; p.ft = 0; }
                return ev;
            }
        }
        if (p.mode === 'climb') {
            if (inp.jump) {
                p.mode = 'air'; p.jt = 0; p.ft = 0; ev.jumped = true;
                if (dx) { p.face = dx; }
            } else {
                var dy = inp.up ? -1 : (inp.down ? 1 : 0);
                if (dy && ladderValid(lv, p.x >> 3, p.y + dy)) { p.y += dy; p.anim++; p.moved = true; }
                if ((p.y & 7) === 0 && supportAt(lv, p.x, p.y)) { p.mode = 'ground'; }
                return ev;
            }
        }
        // vzduch
        if (dx) { p.face = dx; p.x = clampX(p.x + dx); }
        if ((inp.up || inp.down) && p.jt !== 0 && tryGrab(lv, p, p.y)) { return ev; }
        var d;
        if (p.jt >= 0) {
            d = JUMP[p.jt++];
            if (p.jt >= JUMP.length) { p.jt = -1; p.ft = 0; }
        } else {
            d = Math.min(3, 1 + (p.ft >> 3));
            if (p.ft < 40) { p.ft++; }
        }
        var n = Math.abs(d);
        for (var i = 0; i < n; i++) {
            if (d < 0) {
                if (p.y - 1 < TOPY) { p.jt = -1; p.ft = 0; break; }
                p.y--;
            } else {
                p.y++;
                if (supportAt(lv, p.x, p.y)) { p.mode = 'ground'; p.jt = -1; p.ft = 0; ev.landed = true; return ev; }
                if (p.y > MAXY) { p.dead = 'abyss'; return ev; }
            }
        }
        return ev;
    }

    function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
    }

    // vejce a zrno
    function collect(lv, p, ev) {
        var x0 = p.x + 1, y0 = p.y - 15;
        var c0 = x0 >> 3, c1 = (x0 + 5) >> 3, r0 = Math.max(0, y0 >> 3), r1 = Math.min(ROWS - 1, (p.y - 1) >> 3);
        for (var r = r0; r <= r1; r++) {
            for (var c = c0; c <= c1; c++) {
                var ch = cellAt(lv, c, r);
                if ((ch === 'e' || ch === 'g') && rectHit(x0, y0, 6, 15, c * 8 + 1, r * 8 + 1, 6, 7)) {
                    lv.cells[r][c] = ' ';
                    if (ch === 'e') { lv.eggsLeft--; ev.egg = (ev.egg || 0) + 1; }
                    else { lv.freeze = FREEZE; ev.grain = (ev.grain || 0) + 1; }
                }
            }
        }
    }

    function henSupport(lv, x, y) {
        return (y & 7) === 0 && solidTop(cellAt(lv, (x + 4) >> 3, y >> 3));
    }

    function henPickDir(lv, h, p) {
        if (Math.abs(p.y - h.y) < 10 && rnd(lv) < 0.5 && p.x !== h.x) { h.dir = p.x > h.x ? 1 : -1; }
        else { h.dir = rnd(lv) < 0.5 ? -1 : 1; }
    }

    function henStep(lv, h, p) {
        h.anim++;
        if (h.wait > 0) { h.wait--; return; }
        h.acc += lv.hspeed;
        if (h.acc < 1) { return; }
        h.acc -= 1;
        if (h.mode === 'walk') {
            if ((h.x & 7) === 0) {
                var c = h.x >> 3, wantUp = p.y < h.y - 8, wantDown = p.y > h.y + 8;
                if (h.cool > 0) { h.cool--; }
                var canUp = h.cool <= 0 && ladderValid(lv, c, h.y - 1);
                var canDown = h.cool <= 0 && cellAt(lv, c, h.y >> 3) === 'T';
                if (canUp && rnd(lv) < (wantUp ? 0.85 : 0.1)) { h.mode = 'up'; }
                else if (canDown && rnd(lv) < (wantDown ? 0.85 : 0.1)) { h.mode = 'down'; }
                else if (rnd(lv) < 0.08) { h.dir = -h.dir; }
                else if (Math.abs(p.y - h.y) < 10 && rnd(lv) < 0.25 && p.x !== h.x) { h.dir = p.x > h.x ? 1 : -1; }
            }
            if (h.mode === 'walk') {
                var nx = h.x + h.dir;
                if (nx < 0 || nx > 248 || !henSupport(lv, nx, h.y)) { h.dir = -h.dir; }
                else { h.x = nx; }
                var gc = (h.x + 4) >> 3, gr = (h.y - 1) >> 3;
                if (cellAt(lv, gc, gr) === 'g') { lv.cells[gr][gc] = ' '; h.wait = 40; }
            }
        } else {
            var ny = h.y + (h.mode === 'up' ? -1 : 1);
            if (ladderValid(lv, h.x >> 3, ny)) { h.y = ny; }
            if ((h.y & 7) === 0 && henSupport(lv, h.x, h.y)) { h.mode = 'walk'; h.cool = 3; henPickDir(lv, h, p); }
        }
    }

    function updateDuck(lv, p, ev) {
        var d = lv.duck;
        if (!lv.released && lv.time <= lv.limit * 0.6) {
            lv.released = true; d.out = true; ev.quack = true;
            d.fx = 12; d.fy = 5;
        }
        d.flap++;
        if (!d.out) { return; }
        var tx = p.x + 4 - 12, ty = p.y - 8 - 8;
        var vx = tx - d.fx, vy = ty - d.fy, len = Math.sqrt(vx * vx + vy * vy);
        if (len > 0.001) {
            d.fx += vx / len * lv.dspeed; d.fy += vy / len * lv.dspeed;
            if (Math.abs(vx) > 1) { d.dir = vx > 0 ? 1 : -1; }
        }
        d.fx = Math.max(0, Math.min(232, d.fx)); d.fy = Math.max(2, Math.min(176, d.fy));
        d.x = Math.round(d.fx); d.y = Math.round(d.fy);
    }

    // jeden tik hry (50 Hz)
    function tick(lv, p, inp, opt) {
        opt = opt || {};
        var ev = { egg: 0, grain: 0, jumped: false, landed: false, quack: false };
        move(lv, p, inp, ev);
        if (!p.dead) { collect(lv, p, ev); }
        if (!lv.noEnemies && !p.dead) {
            for (var i = 0; i < lv.hens.length; i++) {
                var h = lv.hens[i];
                henStep(lv, h, p);
                if (rectHit(p.x + 2, p.y - 14, 4, 13, h.x + 1, h.y - 9, 6, 9)) { p.dead = p.dead || 'hen'; }
            }
            updateDuck(lv, p, ev);
            if (lv.duck.out && rectHit(p.x + 1, p.y - 15, 6, 14, lv.duck.x + 4, lv.duck.y + 3, 16, 11)) { p.dead = p.dead || 'duck'; }
        }
        if (lv.freeze > 0) { lv.freeze--; } else { lv.time--; }
        if (lv.time <= 0 && !p.dead) { p.dead = 'time'; }
        lv.frame++;
        return ev;
    }

    FE.loadLevel = loadLevel;
    FE.newPlayer = newPlayer;
    FE.move = move;
    FE.tick = tick;
    FE.supportAt = supportAt;
    FE.cellAt = cellAt;
    FE.rectHit = rectHit;

    if (typeof module !== 'undefined' && module.exports) { module.exports = FE; }
})(typeof window !== 'undefined' ? window : globalThis);
