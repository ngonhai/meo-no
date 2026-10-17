// cat-art.js — every picture in the game is drawn here from flat polygons (no image files, no copyright).
// mount() builds ONE hidden <svg> sprite of <symbol>s; cards then only reference them with <use>, so
// a hand of 15 cards costs a handful of DOM nodes and animates on the GPU (transform/opacity only).
//
// Change a look: edit the PAL / art functions below. Add a card: add `art.<kind>` + a `cards.<kind>` text in i18n.js.
const CatArt = (function () {
  'use strict';
  const f = n => Math.round(n * 10) / 10;
  const pts = a => a.map(p => f(p[0]) + ',' + f(p[1])).join(' ');
  const P = (a, fill, extra) => '<polygon points="' + pts(a) + '" fill="' + fill + '"' + (extra ? ' ' + extra : '') + '/>';
  const mir = a => a.map(p => [120 - p[0], p[1]]);
  const both = (a, fill, extra) => P(a, fill, extra) + P(mir(a), fill, extra);
  const L = (a, stroke, w, extra) => '<polyline points="' + pts(a) + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linejoin="miter" stroke-linecap="butt"' + (extra ? ' ' + extra : '') + '/>';
  function ngon(cx, cy, r, n, rot) { const o = []; for (let i = 0; i < n; i++) { const a = (rot || 0) + i * 2 * Math.PI / n; o.push([cx + r * Math.sin(a), cy - r * Math.cos(a)]); } return o; }
  function star(cx, cy, r) { const q = r * .3; return [[cx, cy - r], [cx + q, cy - q], [cx + r, cy], [cx + q, cy + q], [cx, cy + r], [cx - q, cy + q], [cx - r, cy], [cx - q, cy - q]]; }

  // palettes: base fur, light facet, dark facet, inner ear, eye, pupil, nose
  const PAL = {
    tabby:  { base: '#f59e3b', light: '#ffc778', dark: '#b4540f', ear: '#f59e3b', inner: '#f9a8a8', eye: '#c8f56a', pupil: '#14202b', nose: '#f48aa0' },
    black:  { base: '#2f3850', light: '#4a5778', dark: '#171d2d', ear: '#2f3850', inner: '#c77dba', eye: '#e4ff5a', pupil: '#0b0f18', nose: '#f48aa0' },
    white:  { base: '#eef3f8', light: '#ffffff', dark: '#b9c6d6', ear: '#eef3f8', inner: '#f9b4c8', eye: '#5ac8fa', pupil: '#14202b', nose: '#f48aa0' },
    siamese:{ base: '#f1dfbf', light: '#fff0d4', dark: '#c9ae82', ear: '#7a5230', inner: '#5b3a20', eye: '#4fb8ff', pupil: '#0f1a26', nose: '#5b3a20' },
    calico: { base: '#fbfbf6', light: '#ffffff', dark: '#c9cfd6', ear: '#fbfbf6', inner: '#f9b4c8', eye: '#6ee7a0', pupil: '#14202b', nose: '#f48aa0' }
  };
  // seat colours (avatars). Keep in sync with --coral/--mint/... in style.css
  const SEAT = {
    coral:  { base: '#ff7b5c', light: '#ffa58f', dark: '#c4452b', ear: '#ff7b5c', inner: '#ffd0c4', eye: '#fff3c4', pupil: '#2a1410', nose: '#2a1410' },
    mint:   { base: '#4fd8c0', light: '#8ef0de', dark: '#1f9a86', ear: '#4fd8c0', inner: '#c9fff4', eye: '#fff3c4', pupil: '#0c2a26', nose: '#0c2a26' },
    sky:    { base: '#6cc4f5', light: '#a6dffb', dark: '#2b86bd', ear: '#6cc4f5', inner: '#d6f1ff', eye: '#fff3c4', pupil: '#0c2233', nose: '#0c2233' },
    violet: { base: '#b39bff', light: '#d3c4ff', dark: '#7557d6', ear: '#b39bff', inner: '#ece5ff', eye: '#fff3c4', pupil: '#1e1438', nose: '#1e1438' },
    pink:   { base: '#ff8fc0', light: '#ffb9d8', dark: '#cc4f8a', ear: '#ff8fc0', inner: '#ffe0ee', eye: '#fff3c4', pupil: '#3a1226', nose: '#3a1226' }
  };

  // ---- the cat head: ears, octagon head, facets, eyes, nose, whiskers. `mark` is drawn on the fur, under the eyes.
  function head(p, mark, mood) {
    const earL = [[27, 56], [25, 14], [57, 42]], inL = [[33, 48], [32, 26], [49, 41]];
    const eyeL = [[34, 62], [44, 57], [54, 63], [45, 71]], pupL = [[44, 59], [47, 64], [44, 69], [41, 64]];
    let s = both(earL, p.ear) + both(inL, p.inner);
    s += P([[27, 54], [42, 40], [78, 40], [93, 54], [95, 78], [80, 102], [40, 102], [25, 78]], p.base);
    s += P([[42, 40], [78, 40], [60, 64]], p.light, 'fill-opacity=".75"');
    s += both([[27, 54], [42, 40], [60, 64], [44, 80], [25, 78]], p.dark, 'fill-opacity=".28"');
    s += P([[44, 80], [60, 64], [76, 80], [80, 102], [40, 102]], p.light, 'fill-opacity=".35"');
    s += P([[50, 78], [70, 78], [66, 96], [54, 96]], p.light, 'fill-opacity=".8"');
    s += mark || '';
    if (mood === 'angry') {
      s += both([[34, 62], [44, 60], [54, 66], [45, 71]], p.eye) + both([[43, 61], [47, 65], [44, 70], [41, 66]], p.pupil) + both([[30, 56], [58, 64], [58, 68], [30, 60]], p.dark);
    } else if (mood === 'sleep') {
      s += both([[34, 66], [44, 70], [54, 66], [44, 73]], p.pupil);
    } else {
      s += both(eyeL, p.eye) + both(pupL, p.pupil) + both([[39, 61], [43, 60], [41, 64]], '#fff');
    }
    s += P([[54, 76], [66, 76], [60, 83]], p.nose);
    s += L([[60, 83], [60, 88], [54, 92]], p.pupil, 2) + L([[60, 88], [66, 92]], p.pupil, 2);
    s += L([[38, 84], [10, 79]], '#fff', 1.6, 'opacity=".7"') + L([[38, 88], [8, 89]], '#fff', 1.6, 'opacity=".7"') + L([[38, 92], [14, 100]], '#fff', 1.6, 'opacity=".7"');
    s += L([[82, 84], [110, 79]], '#fff', 1.6, 'opacity=".7"') + L([[82, 88], [112, 89]], '#fff', 1.6, 'opacity=".7"') + L([[82, 92], [106, 100]], '#fff', 1.6, 'opacity=".7"');
    return s;
  }
  // faceted backdrop: three overlapping polygons so every card feels cut from paper
  function bg(c1, c2, c3) {
    return P([[0, 0], [120, 0], [120, 120], [0, 120]], c1) + P([[0, 0], [120, 0], [0, 78]], c2, 'fill-opacity=".55"') +
           P([[120, 120], [120, 38], [46, 120]], c3, 'fill-opacity=".5"') + P([[0, 120], [0, 86], [34, 120]], c2, 'fill-opacity=".35"');
  }
  const shoulders = fill => P([[22, 120], [34, 98], [86, 98], [98, 120]], fill);

  const art = {};
  art.cat1 = () => bg('#1d6f80', '#2b95a8', '#0f4655') + shoulders('#c2661a') +
    head(PAL.tabby, P([[55, 40], [65, 40], [60, 56]], PAL.tabby.dark) + both([[46, 42], [53, 42], [50, 54]], PAL.tabby.dark) + both([[25, 68], [37, 71], [25, 76]], PAL.tabby.dark) + both([[26, 78], [38, 78], [28, 86]], PAL.tabby.dark)) +
    both([[40, 100], [36, 112], [46, 108]], '#fff', 'fill-opacity=".0"');
  art.cat2 = () => bg('#8fd3e0', '#c6eef5', '#5db1c4') + P([[88, 8], [104, 12], [112, 30], [108, 50], [98, 62], [104, 40], [100, 24]], '#fff4c2') + shoulders('#171d2d') +
    head(PAL.black, P([[44, 42], [60, 42], [52, 52]], '#fff', 'fill-opacity=".14"') + P([[66, 46], [76, 42], [72, 54]], '#fff', 'fill-opacity=".1"'));
  art.cat3 = () => bg('#17455e', '#2a6d8f', '#0d2c3f') + P([[34, 98], [86, 98], [92, 112], [28, 112]], '#e24a5b') + P([[76, 108], [90, 108], [98, 120], [84, 120]], '#b72f43') +
    head(PAL.white, both([[30, 72], [41, 74], [34, 81]], '#f9b4c8', 'fill-opacity=".8"')) + P([[34, 98], [86, 98], [92, 112], [28, 112]], '#e24a5b', 'fill-opacity="0"') +
    P([[28, 100], [92, 100], [96, 110], [24, 110]], '#e24a5b') + P([[24, 110], [96, 110], [100, 116], [20, 116]], '#b72f43');
  art.cat4 = () => bg('#ff8a6b', '#ffb199', '#d65c3f') + shoulders('#7a5230') +
    head(PAL.siamese, P([[46, 64], [74, 64], [78, 84], [66, 98], [54, 98], [42, 84]], '#7a5230', 'fill-opacity=".85"')) +
    P([[44, 104], [60, 108], [44, 114]], '#ff5a7a') + P([[76, 104], [60, 108], [76, 114]], '#ff5a7a') + P([[55, 104], [65, 104], [65, 112], [55, 112]], '#c42f56');
  art.cat5 = () => bg('#6ee7c8', '#a6f5e0', '#2fb596') + shoulders('#7b8794') +
    head(PAL.calico, P([[27, 54], [42, 40], [56, 40], [50, 58], [32, 62]], '#f59e3b') + P([[78, 40], [93, 54], [95, 70], [84, 66], [70, 52]], '#4b5563') + P([[66, 88], [80, 84], [80, 102], [68, 102]], '#f59e3b')) +
    P(ngon(60, 108, 6, 8, 0.4), '#ffd24a') + P([[48, 102], [72, 102], [70, 106], [50, 106]], '#ff5a7a');
  art.bomb = () => bg('#26172a', '#5a1a30', '#7a1f2b') + both([[32, 52], [30, 20], [54, 38]], '#1f2937') + both([[37, 44], [36, 29], [47, 38]], '#f9a8d4') +
    P(ngon(60, 72, 38, 8, 0.39), '#1f2937') + P([[36, 56], [60, 38], [52, 60]], '#3b4658') + P([[78, 94], [92, 74], [84, 96]], '#111827') +
    both([[38, 66], [54, 70], [52, 79], [40, 76]], '#fff') + both([[47, 70], [51, 71], [50, 77], [47, 76]], '#0b0f18') + both([[32, 60], [58, 68], [58, 72], [32, 64]], '#ff5a3c') +
    L([[42, 90], [49, 98], [56, 90], [63, 98], [70, 90], [77, 98]], '#fff', 3) +
    L([[60, 34], [60, 24], [76, 14]], '#e6c48f', 4) + P(star(80, 12, 13), '#ff6a4d') + P(star(80, 12, 7), '#ffe08a');
  art.defuse = () => bg('#1f8a70', '#35b595', '#126350') + P(ngon(60, 66, 34, 8, 0.39), '#0f4a3d', 'fill-opacity=".55"') +
    L([[0, 44], [52, 44]], '#ff5a3c', 5) + L([[68, 44], [120, 44]], '#ff5a3c', 5) + L([[0, 52], [46, 52], [58, 60]], '#4fb8ff', 3, 'opacity=".9"') +
    P([[24, 20], [34, 18], [98, 94], [88, 100]], '#eef2f7') + P([[96, 20], [86, 18], [22, 94], [32, 100]], '#c3ccd8') + P([[24, 20], [34, 18], [60, 49], [52, 55]], '#fff', 'fill-opacity=".6"') +
    P(ngon(28, 98, 13, 8, 0.39), '#ff6a4d') + P(ngon(28, 98, 6, 8, 0.39), '#126350') + P(ngon(92, 98, 13, 8, 0.39), '#ff6a4d') + P(ngon(92, 98, 6, 8, 0.39), '#126350') +
    P(ngon(60, 58, 6, 8, 0.39), '#ffd24a') + P(star(60, 44, 10), '#fff2a8') + both([[6, 10], [18, 22], [10, 28]], '#126350', 'fill-opacity=".6"');
  art.attack = () => bg('#7a1f2b', '#b73245', '#4d1019') +
    both([[20, 24], [54, 32], [48, 46], [24, 40]], '#fff4e0') + both([[40, 31], [44, 33], [42, 45], [38, 43]], '#14080b') + both([[16, 16], [58, 28], [58, 33], [16, 22]], '#2a0b10') +
    P([[34, 50], [48, 50], [92, 116], [76, 116]], '#ff6a4d') + P([[56, 50], [70, 50], [114, 116], [98, 116]], '#ff6a4d') + P([[12, 50], [26, 50], [70, 116], [54, 116]], '#ff6a4d') +
    P([[34, 50], [40, 50], [84, 116], [76, 116]], '#ffd0c4', 'fill-opacity=".7"') + P([[56, 50], [62, 50], [106, 116], [98, 116]], '#ffd0c4', 'fill-opacity=".7"') + P([[12, 50], [18, 50], [62, 116], [54, 116]], '#ffd0c4', 'fill-opacity=".7"');
  art.skip = () => bg('#1f5f8b', '#3a8cc0', '#123b5a') + '<g transform="translate(34 4) scale(.52)">' + head(PAL.white, null, 'sleep') + '</g>' +
    P([[14, 58], [38, 58], [64, 84], [38, 110], [14, 110], [40, 84]], '#5eead4') + P([[50, 58], [74, 58], [100, 84], [74, 110], [50, 110], [76, 84]], '#fff') +
    P(star(100, 36, 9), '#ffe08a') + P([[96, 52], [108, 52], [96, 64], [108, 64], [108, 68], [92, 68], [104, 56], [92, 56], [92, 52]], '#fff', 'fill-opacity=".0"');
  art.nope = () => bg('#8b1d2c', '#c43a4c', '#5a0f1b') + both([[26, 30], [28, 6], [48, 22]], '#5a0f1b') +
    P(ngon(60, 64, 48, 8, 0.39), '#e03a4e') + P(ngon(60, 64, 41, 8, 0.39), 'none', 'stroke="#fff" stroke-width="3"') +
    P([[42, 72], [52, 61], [68, 61], [78, 72], [73, 90], [47, 90]], '#fff') +
    P([[30, 56], [36, 48], [42, 56], [36, 64]], '#fff') + P([[46, 44], [52, 36], [58, 44], [52, 52]], '#fff') + P([[62, 44], [68, 36], [74, 44], [68, 52]], '#fff') + P([[78, 56], [84, 48], [90, 56], [84, 64]], '#fff') +
    P([[44, 76], [52, 66], [60, 76]], '#e03a4e', 'fill-opacity=".18"');
  art.shuffle = () => bg('#5b3f9b', '#8465cf', '#38256b') +
    '<g transform="rotate(-16 60 64)">' + P([[36, 28], [82, 28], [82, 100], [36, 100]], '#e9e3ff') + P([[36, 28], [82, 28], [36, 62]], '#fff', 'fill-opacity=".6"') + P(star(59, 64, 12), '#8465cf') + '</g>' +
    '<g transform="rotate(16 60 64)">' + P([[38, 28], [84, 28], [84, 100], [38, 100]], '#5eead4') + P([[38, 28], [84, 28], [38, 62]], '#fff', 'fill-opacity=".4"') + P(star(61, 64, 12), '#1f8a70') + '</g>' +
    L([[12, 58], [18, 34], [48, 20]], '#ff6a4d', 7) + P([[44, 8], [66, 20], [46, 32]], '#ff6a4d') + L([[108, 70], [102, 94], [72, 108]], '#ffd24a', 7) + P([[76, 120], [54, 108], [74, 96]], '#ffd24a');
  art.future = () => bg('#34327a', '#5a58b8', '#1d1c4d') + P(star(20, 24, 9), '#ffe08a') + P(star(102, 22, 7), '#ffe08a') + P(star(12, 78, 6), '#ffe08a') + P(star(108, 80, 8), '#ffe08a') +
    P([[34, 106], [44, 90], [76, 90], [86, 106]], '#22215a') + P(ngon(60, 58, 38, 8, 0.39), '#6d5bd0') +
    [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = ngon(60, 58, 38, 8, 0.39); return P([[60, 58], a[i], a[(i + 1) % 8]], '#fff', 'fill-opacity="' + (i % 2 ? '.06' : '.15') + '"'); }).join('') +
    P([[30, 58], [60, 38], [90, 58], [60, 78]], '#fff') + P([[45, 58], [60, 43], [75, 58], [60, 73]], '#5eead4') + P([[58, 47], [62, 47], [65, 58], [62, 69], [58, 69], [55, 58]], '#0b0f18') + P([[50, 56], [55, 51], [55, 56]], '#fff');
  art.favor = () => bg('#b04a7d', '#d870a2', '#7a2b55') +
    P([[26, 66], [46, 50], [76, 50], [92, 66], [76, 82], [46, 82]], '#2dd4bf') + P([[46, 82], [76, 82], [92, 66], [60, 70]], '#8ef0de', 'fill-opacity=".8"') + P([[92, 66], [112, 48], [112, 84]], '#14907f') +
    P([[56, 50], [66, 36], [76, 50]], '#14907f') + P([[34, 62], [39, 57], [44, 62], [39, 67]], '#fff') + P([[37, 62], [39, 60], [41, 62], [39, 65]], '#0b0f18') + L([[52, 56], [48, 66], [52, 76]], '#14907f', 2.5) +
    '<g transform="translate(66 6) scale(.46)">' + P([[60, 36], [50, 22], [38, 24], [34, 36], [40, 48], [60, 64], [80, 48], [86, 36], [82, 24], [70, 22]], '#ff5a7a') + P([[60, 36], [50, 22], [38, 24], [34, 36]], '#ff9db3', 'fill-opacity=".6"') + '</g>' +
    P([[40, 112], [46, 96], [74, 96], [80, 112], [70, 120], [50, 120]], '#fff') + P([[34, 100], [38, 92], [43, 100], [38, 106]], '#fff') + P([[48, 90], [53, 82], [58, 90], [53, 96]], '#fff') + P([[62, 90], [67, 82], [72, 90], [67, 96]], '#fff') + P([[77, 100], [82, 92], [86, 100], [82, 106]], '#fff');

  // ---- card back (100x140) and small icons -------------------------------------------------------------
  function backSVG() {
    let s = P([[0, 0], [100, 0], [100, 140], [0, 140]], '#0d4452');
    for (let y = -1; y < 8; y++) for (let x = 0; x < 6; x++) {
      const cx = x * 20 + (y % 2 ? 10 : 0), cy = y * 20 + 10;
      s += P([[cx, cy - 9], [cx + 9, cy], [cx, cy + 9], [cx - 9, cy]], (x + y) % 2 ? '#14606f' : '#0f5260');
    }
    s += P([[10, 10], [90, 10], [90, 130], [10, 130]], 'none', 'stroke="#ff7b5c" stroke-width="2"');
    s += P(ngon(50, 70, 30, 8, 0.39), '#0a2f3a') + '<g transform="translate(25 42) scale(.42)">' + head(SEAT.coral) + '</g>';
    return s;
  }
  const skull = () => P([[30, 40], [40, 18], [80, 18], [90, 40], [84, 68], [74, 76], [74, 92], [46, 92], [46, 76], [36, 68]], '#f1f5f9') +
    both([[38, 46], [52, 46], [50, 60], [40, 60]], '#14202b') + P([[56, 66], [64, 66], [60, 74]], '#14202b') + L([[52, 82], [52, 92]], '#14202b', 2) + L([[68, 82], [68, 92]], '#14202b', 2) + L([[60, 82], [60, 92]], '#14202b', 2);

  let mounted = false;
  function mount() {
    if (mounted || typeof document === 'undefined') return; mounted = true;
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>';
    Object.keys(art).forEach(k => { s += '<symbol id="art-' + k + '" viewBox="0 0 120 120">' + art[k]() + '</symbol>'; });
    Object.keys(SEAT).forEach(c => { s += '<symbol id="av-' + c + '" viewBox="0 0 120 120">' + head(SEAT[c]) + '</symbol>'; });
    s += '<symbol id="card-back" viewBox="0 0 100 140" preserveAspectRatio="none">' + backSVG() + '</symbol>';
    s += '<symbol id="ico-skull" viewBox="0 0 120 120">' + skull() + '</symbol>';
    s += '</defs></svg>';
    document.body.insertAdjacentHTML('afterbegin', s);
  }
  // ---- OWN ARTWORK (optional) --------------------------------------------------------------------------------------
  // Map a card kind to an image file and that card uses your image instead of the polygon drawing. Kinds: bomb defuse attack
  // skip favor nope shuffle future cat1..cat5, plus `back` (card back). Use square images (they fill the 1:1 picture area;
  // `back` should be 5:7). Anything not listed keeps the vector art. Example:
  //   ART_IMAGES.cat1 = 'img/cat-tabby.png';  ART_IMAGES.back = 'img/back.png';
  const ART_IMAGES = {};
  const has = k => !!art[k];
  const artSVG = k => ART_IMAGES[k] ? '<img class="c-art c-img" src="' + ART_IMAGES[k] + '" alt="" draggable="false">' :
    '<svg class="c-art" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><use href="#art-' + k + '"/></svg>';
  const iconHTML = (k, cls) => ART_IMAGES[k] ? '<img class="' + cls + '" src="' + ART_IMAGES[k] + '" alt="" draggable="false">' :
    '<svg class="' + cls + '" viewBox="0 0 120 120" aria-hidden="true"><use href="#art-' + k + '"/></svg>';
  const avatarSVG = (c, cls) => '<svg class="' + (cls || 'av') + '" viewBox="0 0 120 120" aria-hidden="true"><use href="#av-' + c + '"/></svg>';
  const backHTML = cls => ART_IMAGES.back ? '<img class="' + (cls || 'back-svg') + ' back-img" src="' + ART_IMAGES.back + '" alt="" draggable="false">' : '<svg class="' + (cls || 'back-svg') + '" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true"><use href="#card-back"/></svg>';
  const skullSVG = cls => '<svg class="' + (cls || 'ico') + '" viewBox="0 0 120 120" aria-hidden="true"><use href="#ico-skull"/></svg>';
  // a standalone head for the lobby logo / favicon
  const logoSVG = () => '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">' + head(SEAT.coral) + '</svg>';
  return { mount, has, artSVG, iconHTML, ART_IMAGES, avatarSVG, backHTML, skullSVG, logoSVG, SEAT, PAL, ngon, star };
})();
