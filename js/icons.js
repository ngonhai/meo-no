// icons.js — every little UI icon (arrows, bomb, flame, gum, …) drawn from flat polygons, in the same style as cat-art.js.
// No emoji and no image files anywhere in the UI: Icon.html('bomb') returns an inline <svg> that scales with the font size
// (width/height 1.1em, see .ic in style.css). `currentColor` is the main colour, so a button's text colour tints its icon.
//
// Add an icon: put a list of [fill, points] in DEF below (24×24 grid, y down). fill: 'c' = currentColor, 'cs' = currentColor
// darker shade (a facet), 'w' = a light facet, or any #hex. Facets (a darker half, a light spot) are what keep it from looking flat-boring.
const Icon = (function () {
  'use strict';
  const f = n => Math.round(n * 10) / 10;
  const S = a => a.map(p => f(p[0]) + ',' + f(p[1])).join(' ');
  const mirror = a => a.map(p => [24 - p[0], p[1]]);
  const ngon = (cx, cy, r, n, rot) => Array.from({ length: n }, (_, i) => { const a = (rot || 0) + i * 2 * Math.PI / n; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; });
  const starPts = (cx, cy, r, q) => { const o = []; for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + k * Math.PI / 4, d = k % 2 ? q : r; o.push([cx + d * Math.cos(a), cy + d * Math.sin(a)]); } return o; };
  const blob = (cx, cy, r, jit) => jit.map((j, k) => { const a = k / jit.length * Math.PI * 2; return [cx + r * j * Math.cos(a), cy + r * j * Math.sin(a)]; });
  // ring-shaped curved arrow (clockwise): outer arc, arrow head, inner arc
  function curved() {
    const o = [], i = [], a0 = -150 * Math.PI / 180, a1 = 70 * Math.PI / 180, N = 9;
    for (let k = 0; k <= N; k++) { const a = a0 + (a1 - a0) * k / N; o.push([12 + 8.2 * Math.cos(a), 12 + 8.2 * Math.sin(a)]); i.unshift([12 + 4.6 * Math.cos(a), 12 + 4.6 * Math.sin(a)]); }
    const tip = a1 + 0.62, head = [[12 + 11.6 * Math.cos(a1), 12 + 11.6 * Math.sin(a1)], [12 + 6.4 * Math.cos(tip), 12 + 6.4 * Math.sin(tip)], [12 + 1.2 * Math.cos(a1), 12 + 1.2 * Math.sin(a1)]];
    return { ring: o.concat(i), head };
  }
  const CV = curved();

  const DEF = {
    arrow: [['c', [[12, 2.5], [21.5, 13], [15, 13], [15, 21.5], [9, 21.5], [9, 13], [2.5, 13]]], ['cs', [[12, 2.5], [21.5, 13], [15, 13], [15, 21.5], [12, 21.5]]]],
    rotR: [['c', CV.ring], ['cs', CV.ring.slice(0, 5).concat(CV.ring.slice(-5))], ['c', CV.head]],
    rotL: [['c', mirror(CV.ring)], ['cs', mirror(CV.ring.slice(0, 5).concat(CV.ring.slice(-5)))], ['c', mirror(CV.head)]],
    gum: [['#ff8fc0', blob(12, 12.5, 9.5, [1, .82, 1.04, .86, 1, .8, 1.05, .88, .98])], ['#cc4f8a', [[12, 12.5], [20.5, 14], [18.6, 18.6], [13.5, 21.5], [8.2, 19.8], [5.2, 15.6]]], ['#ffd0e4', [[7.2, 8.4], [11, 6.6], [12.6, 8.6], [9.4, 11.6]]]],
    ink: [['#5446c9', blob(11, 12, 7.6, [1, .8, 1.1, .85, 1.05, .78, 1.1, .86, 1])], ['#5446c9', [[19.5, 5], [22.5, 7], [20.6, 10.2], [18, 8.4]]], ['#5446c9', [[18.6, 17.4], [21.2, 19], [19.6, 21.4], [17.2, 20]]], ['#a79cff', [[6.5, 8.5], [10, 6.5], [11.4, 9], [8, 11]]], ['#2c2380', [[11, 12], [17.5, 13.5], [15.5, 18.8], [10.5, 19.8], [7, 16.5]]]],
    spark: [['c', starPts(12, 12, 11, 4)], ['cs', starPts(12, 12, 11, 4).slice(0, 5).concat([[12, 12]])]],
    flame: [['#ff7b5c', [[12, 1.5], [15.6, 7], [19, 12], [18, 18], [14.5, 22], [9.5, 22], [6, 18], [5, 13], [8, 9], [9.5, 12]]], ['#c4452b', [[12, 1.5], [15.6, 7], [19, 12], [18, 18], [14.5, 22], [12, 22]]], ['#ffd166', [[12, 10], [15, 15.2], [14, 20.2], [10, 20.2], [9, 16]]]],
    bomb: [['#3f5a66', ngon(11.5, 14, 8, 8, Math.PI / 8)], ['#22363f', [[11.5, 6], [17.2, 8.3], [19.5, 14], [17.2, 19.7], [11.5, 22], [11.5, 14]]], ['#9fb9c6', [[6.6, 10.4], [9.6, 8.2], [10.8, 10], [8, 12.6]]], ['#c8a36a', [[13, 5.6], [15.2, 2.6], [17.2, 4], [15, 7]]], ['#ffd166', starPts(18.4, 3.6, 3.4, 1.2)]],
    bolt: [['#ffd166', [[14, 1.5], [4.5, 13.2], [10.8, 13.2], [8.6, 22.5], [19.5, 9.8], [13, 9.8]]], ['#e0a52e', [[14, 1.5], [13, 9.8], [19.5, 9.8], [8.6, 22.5], [11.5, 13.2]]]],
    eye: [['w', [[1.5, 12], [6.5, 6.2], [12, 4.6], [17.5, 6.2], [22.5, 12], [17.5, 17.8], [12, 19.4], [6.5, 17.8]]], ['c', ngon(12, 12, 5, 8, Math.PI / 8)], ['#14202b', ngon(12, 12, 2.6, 8, Math.PI / 8)], ['#fff', [[10.2, 9.8], [11.8, 9.8], [11.8, 11.2], [10.2, 11.2]]]],
    book: [['c', [[1, 4], [12, 5.6], [23, 4], [23, 20.5], [12, 22], [1, 20.5]]], ['#f6f0e2', [[3, 6], [11, 7.4], [11, 19.8], [3, 18.5]]], ['#f6f0e2', [[21, 6], [13, 7.4], [13, 19.8], [21, 18.5]]], ['#c8b896', [[4.6, 9.4], [9.4, 10.2], [9.4, 11.4], [4.6, 10.6]]], ['#c8b896', [[4.6, 13], [9.4, 13.8], [9.4, 15], [4.6, 14.2]]], ['#c8b896', [[14.6, 10.2], [19.4, 9.4], [19.4, 10.6], [14.6, 11.4]]], ['#c8b896', [[14.6, 13.8], [19.4, 13], [19.4, 14.2], [14.6, 15]]]],
    megaphone: [['c', [[2.5, 9], [8, 9], [17.5, 3.5], [17.5, 20.5], [8, 15], [2.5, 15]]], ['cs', [[8, 9], [17.5, 3.5], [17.5, 20.5], [8, 15]]], ['c', [[6, 15.5], [9.6, 15.5], [11, 22], [7.6, 22]]], ['#ffd166', [[19.5, 8.5], [22, 7], [22, 17], [19.5, 15.5]]]],
    stop: [['#e0334c', ngon(12, 12, 10.6, 8, Math.PI / 8)], ['#a82038', [[12, 1.4], [19.5, 4.5], [22.6, 12], [19.5, 19.5], [12, 22.6]]], ['#fff', [[6, 10.2], [18, 10.2], [18, 13.8], [6, 13.8]]]],
    go: [['#4fd8c0', [[2.5, 12], [11, 3], [11, 8.5], [21.5, 8.5], [21.5, 15.5], [11, 15.5], [11, 21]]], ['#1f9a86', [[2.5, 12], [11, 21], [11, 15.5], [21.5, 15.5], [21.5, 12]]]],
    wait: [['c', [[4, 2.5], [20, 2.5], [20, 5], [4, 5]]], ['c', [[4, 19], [20, 19], [20, 21.5], [4, 21.5]]], ['w', [[6, 5], [18, 5], [12, 12]]], ['w', [[12, 12], [18, 19], [6, 19]]], ['#ffd166', [[12, 14.5], [15.6, 19], [8.4, 19]]], ['#ffd166', [[9.5, 5], [14.5, 5], [12, 8.2]]]],
    oops: [['#ffd166', [[12, 1.5], [22.5, 12], [12, 22.5], [1.5, 12]]], ['#e0a52e', [[12, 1.5], [22.5, 12], [12, 22.5]]], ['#14202b', [[10.6, 5.8], [13.4, 5.8], [12.8, 14.4], [11.2, 14.4]]], ['#14202b', [[10.8, 16.2], [13.2, 16.2], [13.2, 18.6], [10.8, 18.6]]]],
    sail: [['#f6f0e2', [[11, 2.5], [11, 15], [4, 15]]], ['#c8b896', [[13, 5.5], [13, 15], [20, 15]]], ['c', [[3, 16.5], [21, 16.5], [18, 21.5], [6, 21.5]]], ['cs', [[12, 16.5], [21, 16.5], [18, 21.5], [12, 21.5]]]],
    deck: [['cs', [[7.5, 2.5], [20, 2.5], [20, 17], [7.5, 17]]], ['c', [[4, 6], [16.5, 6], [16.5, 21.5], [6, 21.5], [4, 19.5]]], ['w', [[8, 11], [12.2, 9], [12.2, 18], [8, 18]]]],
    speaker: [['c', [[2.5, 9], [7, 9], [12.5, 4], [12.5, 20], [7, 15], [2.5, 15]]], ['cs', [[7, 9], [12.5, 4], [12.5, 20], [7, 15]]], ['c', [[15.2, 9], [17.4, 9], [19, 12], [17.4, 15], [15.2, 15], [16.6, 12]]], ['c', [[18.4, 5.8], [20.8, 5.8], [23, 12], [20.8, 18.2], [18.4, 18.2], [20.4, 12]]]],
    mute: [['c', [[2.5, 9], [7, 9], [12.5, 4], [12.5, 20], [7, 15], [2.5, 15]]], ['cs', [[7, 9], [12.5, 4], [12.5, 20], [7, 15]]], ['#ff7b5c', [[15.5, 9], [17.2, 7.6], [22, 14.8], [20.3, 16.2]]], ['#ff7b5c', [[20.3, 7.6], [22, 9], [17.2, 16.2], [15.5, 14.8]]]],
    cat: [['c', [[3, 2.5], [9, 6.5], [15, 6.5], [21, 2.5], [21.5, 14], [17, 21.5], [7, 21.5], [2.5, 14]]], ['cs', [[12, 6.5], [15, 6.5], [21, 2.5], [21.5, 14], [17, 21.5], [12, 21.5]]], ['#14202b', [[7, 11], [10, 11], [10, 14], [7, 14]]], ['#14202b', [[14, 11], [17, 11], [17, 14], [14, 14]]]]
  };
  const SKIN = { cs: 'rgba(0,0,0,.24)', w: 'rgba(255,255,255,.55)' };

  function svg(name, cls) {
    const d = DEF[name]; if (!d) return '';
    return '<svg class="ic ic-' + name + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + d.map(([fill, pts]) => {
      const c = fill === 'c' ? 'currentColor' : null, shade = SKIN[fill];
      if (shade) return '<polygon points="' + S(pts) + '" fill="' + (fill === 'cs' ? '#000' : '#fff') + '" fill-opacity="' + (fill === 'cs' ? '.24' : '.55') + '"/>';
      return '<polygon points="' + S(pts) + '" fill="' + (c || fill) + '"/>';
    }).join('') + '</svg>';
  }
  // 'u' | 'r' | 'd' | 'l': the arrow pointing that way (one drawing, turned)
  const ROT = { u: 0, r: 90, d: 180, l: 270 };
  const arrow = dir => svg('arrow', '').replace('<svg ', '<svg style="transform:rotate(' + (ROT[dir] || 0) + 'deg)" ');
  // inline text helper: Icon.html('bomb') ; Icon.flames(2) = two flames
  const flames = n => Array.from({ length: Math.max(0, Math.min(3, n | 0)) }, () => svg('flame')).join('');
  return { svg, html: svg, arrow, flames, names: Object.keys(DEF) };
})();
if (typeof module !== 'undefined') module.exports = Icon;
