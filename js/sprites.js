// Sprity jako pole řetězců ('X' = bod) – vlastní postavy: farmář Eda, slepice, kachna. Dlaždice 8x8.
(function (root) {
    'use strict';

    var FE = root.FE = root.FE || {};

    var HEAD = [
        '..XXXX..',
        '.XXXXXX.',
        'XXXXXXXX',
        '..X..X..',
        '..XXXX..',
        '...XX...'
    ];
    function body(arms, legs) { return HEAD.concat(arms, legs); }

    var ARMS_DOWN = ['.XXXXXX.', 'XXXXXXXX', 'X.XXXX.X', 'X.XXXX.X', '..XXXX..'];
    var ARMS_UP_A = ['XXXXXXXX', 'X.XXXX.X', 'X.XXXX..', '..XXXX..', '..XXXX..'];
    var ARMS_UP_B = ['XXXXXXXX', '..XXXX.X', '..XXXX.X', '..XXXX..', '..XXXX..'];
    var LEGS_STAND = ['..X..X..', '..X..X..', '..X..X..', '..X..X..', '.XX..XX.'];
    var LEGS_STEP = ['.XX..XX.', '.X....X.', 'XX....XX', 'XX....XX', 'XX....XX'];
    var LEGS_JUMP = ['.XX..XX.', 'XX....XX', 'X......X', '........', '........'];

    // zrnitá kachna 24x16 z elips (kreslená kódem)
    function ellipse(g, cx, cy, rx, ry, v) {
        for (var y = 0; y < 16; y++) {
            for (var x = 0; x < 24; x++) {
                var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
                if (dx * dx + dy * dy <= 1) { g[y][x] = v; }
            }
        }
    }
    function duck(frame) {
        var g = [], x, y;
        for (y = 0; y < 16; y++) { g.push([]); for (x = 0; x < 24; x++) { g[y].push('.'); } }
        ellipse(g, 11, 10, 9.5, 5, 'X');           // tělo
        ellipse(g, 19, 4.5, 3.5, 3.5, 'X');        // hlava
        ellipse(g, 17, 7, 2.5, 3, 'X');            // krk
        for (y = 4; y <= 5; y++) { for (x = 21; x < 24; x++) { g[y][x] = 'X'; } }   // zobák
        for (x = 0; x < 4; x++) { g[7 + (x >> 1)][x] = 'X'; g[8 + (x >> 1)][x] = 'X'; }   // ocas
        if (frame === 0) { ellipse(g, 8, 4.5, 4.5, 3.5, 'X'); ellipse(g, 8, 5.5, 2.5, 1.5, '.'); }   // křídlo nahoře
        else { for (x = 4; x < 13; x++) { g[10][x] = '.'; g[11][x - 1] = '.'; } ellipse(g, 9, 12.5, 4, 2, 'X'); for (x = 6; x < 12; x++) { g[12][x] = '.'; } }
        g[3][19] = '.';                              // oko
        return g.map(function (r) { return r.join(''); });
    }

    var HEN_A = ['.....X..', '....XXX.', '....XXXX', '.XX.XXX.', 'XXXXXXX.', 'XXXXXXX.', '.XXXXXX.', '..XXXX..', '...X.X..', '...X.X..'];
    var HEN_B = ['.....X..', '....XXX.', '....XXXX', '.XX.XXX.', 'XXXXXXX.', 'XXXXXXX.', '.XXXXXX.', '..XXXX..', '..X..X..', '..XX.XX.'];
    var HEN_C = ['.X.X.X..', 'XXXXXXX.', 'XXXXXXX.', '.XXXXX..', '..XXX...', '...X.X..', '...X.X..'];

    FE.SPR = {
        eda: {
            stand: body(ARMS_DOWN, LEGS_STAND),
            walk: [body(ARMS_DOWN, LEGS_STEP), body(ARMS_DOWN, LEGS_STAND)],
            climb: [body(ARMS_UP_A, LEGS_STAND), body(ARMS_UP_B, LEGS_STEP)],
            jump: body(ARMS_UP_B, LEGS_JUMP)
        },
        hen: [HEN_A, HEN_B],
        henUp: [HEN_C, HEN_C],
        duck: [duck(0), duck(1)]
    };

    FE.TILES = {
        '=': ['XXXXXXXX', 'X.XX.XXX', 'XXXXXXXX', '........', '........', '........', '........', '........'],
        'T': ['XXXXXXXX', 'X.XX.XXX', 'XXXXXXXX', 'X......X', 'X......X', 'XXXXXXXX', 'X......X', 'X......X'],
        'H': ['X......X', 'X......X', 'XXXXXXXX', 'X......X', 'X......X', 'X......X', 'XXXXXXXX', 'X......X'],
        'e': ['........', '...XX...', '..XXXX..', '.XXXXXX.', '.XXXXXX.', '.XXXXXX.', '..XXXX..', '........'],
        'g': ['........', '........', '........', '...XX...', '..XXXX..', '.X.XX.X.', 'XXXXXXXX', 'X.XXXX.X']
    };
})(typeof window !== 'undefined' ? window : globalThis);
