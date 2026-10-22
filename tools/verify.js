// Ověření dosažitelnosti: BFS nad skutečnou fyzikou hráče. Všechna vejce a zrna musí být dosažitelná.
'use strict';
var path = require('path');
var FE = require(path.join(__dirname, '..', 'js', 'engine.js'));
global.FE = FE; global.window = global;
require(path.join(__dirname, '..', 'js', 'levels.js'));

var ACTIONS = [
    { dx: -1 }, { dx: 1 }, { dx: 0 }, { dx: -1, jump: 1 }, { dx: 1, jump: 1 }, { dx: 0, jump: 1 }, { up: 1 }, { down: 1 }
];
var MODES = { ground: 0, air: 1, climb: 2 };
function key(p) { return (((p.x * 200 + p.y) * 3 + MODES[p.mode]) * 24 + (p.jt + 1)) * 41 + p.ft; }
function clone(p) { return { x: p.x, y: p.y, face: p.face, mode: p.mode, jt: p.jt, ft: p.ft, anim: 0, moved: false, dead: null }; }

function touches(lv, p, ch) {
    var x0 = p.x + 1, y0 = p.y - 15, found = [];
    for (var r = Math.max(0, y0 >> 3); r <= Math.min(23, (p.y - 1) >> 3); r++) {
        for (var c = x0 >> 3; c <= (x0 + 5) >> 3; c++) {
            if (lv.cells[r] && lv.cells[r][c] === ch && FE.rectHit(x0, y0, 6, 15, c * 8 + 1, r * 8 + 1, 6, 7)) { found.push(r * 32 + c); }
        }
    }
    return found;
}

// najde nejkratší posloupnost vstupů z p k nejbližší položce (cíle = množina klíčů r*32+c); vrací {path, state, hit}
function bfs(lv, start, targets, wantAll) {
    var seen = new Map(), q = [clone(start)], head = 0;
    seen.set(key(q[0]), null);
    var parents = [null], acts = [-1], hitSet = {};
    var res = null;
    while (head < q.length) {
        var p = q[head], idx = head++;
        var t = touches(lv, p, 'e').concat(touches(lv, p, 'g'));
        for (var k = 0; k < t.length; k++) {
            hitSet[t[k]] = 1;
            if (!wantAll && !res && targets[t[k]]) { res = { idx: idx, hit: t[k] }; }
        }
        if (res) { break; }
        for (var a = 0; a < ACTIONS.length; a++) {
            var np = clone(p);
            FE.move(lv, np, ACTIONS[a], {});
            if (np.dead) { continue; }
            var kk = key(np);
            if (seen.has(kk)) { continue; }
            seen.set(kk, 1);
            q.push(np); parents.push(idx); acts.push(a);
        }
    }
    if (!res) { return { hitSet: hitSet, states: q.length, path: null }; }
    var path = [], i = res.idx;
    while (i > 0) { path.push(ACTIONS[acts[i]]); i = parents[i]; }
    path.reverse();
    return { path: path, state: q[res.idx], hit: res.hit, hitSet: hitSet, states: q.length };
}

function verify(def, index) {
    var lv = FE.loadLevel(def, index), p = FE.newPlayer(lv);
    var items = {}, total = 0;
    for (var r = 0; r < 24; r++) { for (var c = 0; c < 32; c++) { if (lv.cells[r][c] === 'e' || lv.cells[r][c] === 'g') { items[r * 32 + c] = lv.cells[r][c]; total++; } } }
    var res = bfs(lv, p, {}, true);
    var missing = Object.keys(items).filter(function (k) { return !res.hitSet[k]; });
    return { total: total, missing: missing, items: items, states: res.states };
}

module.exports = { verify: verify, bfs: bfs, ACTIONS: ACTIONS, clone: clone };

if (require.main === module) {
    var bad = 0;
    FE.LEVELS.forEach(function (d, i) {
        var t0 = Date.now(), r = verify(d, i);
        console.log((i + 1) + '. ' + d.name + ': položek ' + r.total + ', nedosažitelné ' + r.missing.map(function (k) { return (k >> 5) + ',' + (k & 31); }).join(' ') + ', stavů ' + r.states + ', ' + (Date.now() - t0) + ' ms');
        if (r.missing.length) { bad++; }
    });
    process.exit(bad ? 1 : 0);
}
