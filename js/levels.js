// 8 úrovní: platformy [řádek, od, do], žebříky [sloupec, horní řádek, dolní řádek],
// vejce a zrno [řádek platformy, sloupec], slepice [sloupec, řádek platformy].
(function (root) {
    'use strict';

    var FE = root.FE = root.FE || {};

    function mirror(s) {
        function m(c) { return 31 - c; }
        return {
            plat: s.plat.map(function (p) { return [p[0], m(p[2]), m(p[1])]; }),
            lad: s.lad.map(function (l) { return [m(l[0]), l[1], l[2]]; }),
            eggs: s.eggs.map(function (e) { return [e[0], m(e[1])]; }),
            grain: s.grain.map(function (e) { return [e[0], m(e[1])]; }),
            hens: s.hens.map(function (h) { return [m(h[0]), h[1]]; }),
            start: [m(s.start[0]), s.start[1]]
        };
    }

    function build(name, s, theme, limitSec) {
        var g = [], r, c;
        for (r = 0; r < 24; r++) { g.push([]); for (c = 0; c < 32; c++) { g[r].push(' '); } }
        s.plat.forEach(function (p) { for (c = p[1]; c <= p[2]; c++) { g[p[0]][c] = '='; } });
        s.lad.forEach(function (l) {
            if (g[l[2]][l[0]] !== '=' || g[l[1]][l[0]] !== '=') { throw new Error(name + ': žebřík ' + l + ' nemá platformy na koncích'); }
            g[l[1]][l[0]] = 'T';
            for (r = l[1] + 1; r < l[2]; r++) { g[r][l[0]] = 'H'; }
        });
        s.eggs.forEach(function (e) { g[e[0] - 1][e[1]] = 'e'; });
        s.grain.forEach(function (e) { g[e[0] - 1][e[1]] = 'g'; });
        return {
            name: name, theme: theme, limit: limitSec * 50,
            rows: g.map(function (row) { return row.join(''); }),
            start: { x: s.start[0] * 8, y: s.start[1] * 8 },
            hens: s.hens.map(function (h, i) { return { x: h[0] * 8, y: h[1] * 8, dir: i % 2 ? -1 : 1 }; })
        };
    }

    var S1 = {
        plat: [[23, 0, 31], [19, 2, 13], [19, 18, 29], [15, 6, 25], [11, 2, 12], [11, 19, 29], [7, 8, 23]],
        lad: [[6, 19, 23], [20, 19, 23], [10, 15, 19], [22, 15, 19], [8, 11, 15], [24, 11, 15], [11, 7, 11], [21, 7, 11]],
        eggs: [[23, 3], [23, 16], [23, 28], [19, 4], [19, 26], [15, 8], [15, 23], [11, 4], [11, 27], [7, 10], [7, 13], [7, 20]],
        grain: [[23, 9], [19, 9], [19, 21], [15, 14], [15, 17], [11, 9], [11, 23], [7, 16]],
        hens: [[12, 15], [25, 11]], start: [14, 23]
    };
    var S2 = {
        plat: [[23, 0, 31], [19, 0, 9], [19, 12, 18], [19, 21, 31], [15, 3, 12], [15, 15, 28], [11, 0, 6], [11, 9, 20], [11, 23, 31], [7, 4, 14], [7, 17, 27]],
        lad: [[2, 19, 23], [16, 19, 23], [28, 19, 23], [5, 15, 19], [17, 15, 19], [26, 15, 19], [4, 11, 15], [10, 11, 15], [24, 11, 15], [6, 7, 11], [18, 7, 11]],
        eggs: [[23, 5], [23, 24], [19, 3], [19, 15], [19, 29], [15, 8], [15, 20], [11, 2], [11, 14], [11, 28], [7, 8], [7, 23]],
        grain: [[23, 12], [19, 6], [19, 24], [15, 5], [15, 26], [11, 17], [7, 11], [7, 20]],
        hens: [[9, 15], [20, 11], [22, 7]], start: [15, 23]
    };
    var S3 = {
        plat: [[23, 0, 31], [21, 6, 9], [21, 22, 25], [19, 0, 4], [19, 12, 19], [19, 27, 31], [15, 3, 14], [15, 19, 30], [11, 0, 8], [11, 12, 22], [11, 26, 31], [7, 2, 10], [7, 14, 24], [7, 28, 31]],
        lad: [[2, 19, 23], [14, 19, 23], [29, 19, 23], [3, 15, 19], [19, 15, 19], [28, 15, 19], [7, 11, 15], [20, 11, 15], [29, 11, 15], [4, 7, 11], [16, 7, 11], [30, 7, 11]],
        eggs: [[23, 3], [23, 15], [23, 28], [21, 7], [21, 24], [19, 1], [19, 16], [15, 9], [15, 26], [11, 3], [11, 18], [7, 12]],
        grain: [[19, 13], [19, 30], [15, 5], [15, 22], [11, 14], [11, 28], [7, 6], [7, 20]],
        hens: [[8, 15], [18, 19], [24, 7]], start: [10, 23]
    };
    var S4 = {
        plat: [[23, 0, 31], [19, 0, 12], [19, 15, 31], [15, 2, 9], [15, 12, 19], [15, 22, 29], [11, 0, 6], [11, 9, 23], [11, 26, 31], [7, 3, 12], [7, 15, 28]],
        lad: [[6, 19, 23], [22, 19, 23], [4, 15, 19], [16, 15, 19], [26, 15, 19], [3, 11, 15], [14, 11, 15], [27, 11, 15], [5, 7, 11], [10, 7, 11], [18, 7, 11], [28, 7, 11]],
        eggs: [[23, 2], [23, 18], [23, 29], [19, 3], [19, 20], [15, 3], [15, 17], [15, 26], [11, 8], [11, 29], [7, 4], [7, 25]],
        grain: [[23, 10], [19, 9], [19, 29], [15, 7], [15, 13], [11, 13], [11, 20], [7, 8], [7, 20]],
        hens: [[9, 19], [16, 11], [20, 7]], start: [14, 23]
    };
    var S5 = {
        plat: [[23, 0, 31], [21, 14, 17], [19, 0, 6], [19, 9, 22], [19, 25, 31], [15, 2, 12], [15, 15, 29], [11, 0, 8], [11, 11, 20], [11, 23, 31], [7, 3, 14], [7, 17, 28]],
        lad: [[3, 19, 23], [15, 19, 23], [28, 19, 23], [5, 15, 19], [18, 15, 19], [27, 15, 19], [4, 11, 15], [12, 11, 15], [24, 11, 15], [6, 7, 11], [18, 7, 11], [26, 7, 11]],
        eggs: [[23, 8], [23, 20], [21, 15], [19, 1], [19, 12], [19, 29], [15, 8], [15, 22], [11, 2], [11, 17], [11, 29], [7, 24]],
        grain: [[23, 26], [19, 16], [15, 4], [15, 18], [11, 5], [11, 14], [7, 9], [7, 21]],
        hens: [[10, 15], [20, 11], [8, 7], [22, 19]], start: [8, 23]
    };

    var THEMES = [
        { plat: 6, lad: 5, hen: 13, border: 1 }, { plat: 2, lad: 6, hen: 15, border: 2 },
        { plat: 4, lad: 5, hen: 14, border: 4 }, { plat: 3, lad: 6, hen: 13, border: 3 },
        { plat: 5, lad: 7, hen: 10, border: 5 }, { plat: 6, lad: 4, hen: 15, border: 6 },
        { plat: 2, lad: 5, hen: 14, border: 1 }, { plat: 7, lad: 3, hen: 12, border: 2 }
    ];

    function more(s, extraHen) { var c = JSON.parse(JSON.stringify(s)); c.hens.push(extraHen); return c; }

    FE.LEVELS = [
        build('NÁVSÍ', S1, THEMES[0], 100),
        build('ZRCADLOVÝ KURNÍK', mirror(S2), THEMES[1], 100),
        build('SCHODY K SENU', S3, THEMES[2], 100),
        build('STODOLA', S4, THEMES[3], 95),
        build('KOMÍN', S5, THEMES[4], 95),
        build('SÝPKA', S2, THEMES[5], 90),
        build('PODKROVÍ', more(mirror(S4), [3, 23]), THEMES[6], 90),
        build('VELKÁ HONITBA', more(mirror(S5), [28, 23]), THEMES[7], 85)
    ];
    FE.LEVELS.forEach(function (d, i) { d.name = d.name; void i; });
})(typeof window !== 'undefined' ? window : globalThis);
