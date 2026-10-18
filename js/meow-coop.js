// meow-coop.js — the 2v2 "defuse together" minigames + the full-screen overlay that hosts them.
//
// WHEN: meow-engine puts the game in phase 'rescue' when a player draws a bomb and their teammate is still alive
//       (see Meow.draw). The room doc carries { game, seed, p1, p2 }; this file builds the puzzle from `seed`
//       (so every client generates the SAME puzzle), shows it to everybody (the two teammates play, the rest watch)
//       and reports success / failure back through env.onEnd(ok).
//
// HOW SYNC WORKS (important for adding games):
//   * Each of the two roles (p1 / p2) is SIMULATED BY EXACTLY ONE CLIENT: the human who owns it (zero input lag) or,
//     for a bot teammate, the "driver" client. Every role publishes only its OWN small payload (env.send), everybody
//     else just reads it (onData). Single writer per node = no conflicts, and no transaction on the room per frame.
//   * `s:{n,v}` inside a payload is a "quick say" (speech bubble). It lets players coordinate WITHOUT voice chat and
//     lets bot teammates "talk". v is a token ('chat:2', 'step:1', 'sym:0:4') localised by the RECEIVER.
//   * One client is the AUTHORITY (a human teammate if there is one, else the driver). Only it ends the minigame
//     (all pass / strike / timeout conditions are derived from the shared payloads, so it needs no extra messages).
//
// ADD A MINIGAME: write make(seed) (pure puzzle) + a class extending Base (logic, optional build()/render() for the DOM),
//   register it in GAMES, add its id to Meow.COOP_GAMES (engine) and its texts under coop.games.<id> / coop.<id> (i18n).
//   Game classes work headless (no DOM) so they can be tested in node: see tests/coop.test.js.
const Coop = (function () {
  'use strict';
  const Ic = typeof Icon !== 'undefined' ? Icon : (typeof require !== 'undefined' ? require('./icons.js') : { svg: () => '', arrow: () => '', flames: () => '' });   // polygon icons (js/icons.js)

  // ------------------------------------------------------------------------------------------------------------
  // tiny helpers
  const round1 = v => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const A = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);      // Firebase turns arrays into objects
  const rand = (a, b) => a + Math.random() * (b - a);
  function rng(seed) {                                    // mulberry32: same seed -> same puzzle on every client
    let a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffled(R, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  // six cartoon symbols used as wire tags and as lock codes (drawn from polygons like the rest of the art)
  const SYM_COL = ['#ff7b5c', '#6cc4f5', '#4fd8c0', '#ffd166', '#ff8fc0', '#b39bff'];
  const SYM_PTS = ['12,2.5 22,21 2,21', null, '3.5,3.5 20.5,3.5 20.5,20.5 3.5,20.5', '12,1.5 22.5,12 12,22.5 1.5,12',
    (function () { const o = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4.6 : 10.8; o.push((12 + r * Math.cos(a)).toFixed(1) + ',' + (12.6 + r * Math.sin(a)).toFixed(1)); } return o.join(' '); })(),
    '9,2.5 15,2.5 15,9 21.5,9 21.5,15 15,15 15,21.5 9,21.5 9,15 2.5,15 2.5,9 9,9'];
  function symSVG(i, fill, cls) {
    const body = i === 1 ? '<circle cx="12" cy="12" r="10"/>' : '<polygon points="' + SYM_PTS[i] + '"/>';
    return '<svg class="sym ' + (cls || '') + '" viewBox="0 0 24 24" fill="' + (fill || SYM_COL[i]) + '" stroke="rgba(0,0,0,.4)" stroke-width="1.3" stroke-linejoin="round">' + body + '</svg>';
  }
  const WIRE_COLORS = [{ id: 'red', hex: '#e0334c' }, { id: 'blue', hex: '#2f86c2' }, { id: 'green', hex: '#37b36a' },
    { id: 'yellow', hex: '#f2c230' }, { id: 'white', hex: '#f1ede0' }, { id: 'violet', hex: '#9b78e6' }];

  // ------------------------------------------------------------------------------------------------------------
  // PUZZLES (pure, deterministic from the seed)

  // --- Lái Chung: one bomb-dot, two drivers. p1/p2 each own ONE axis (up/down or left/right). Stay inside the zig-zag
  //     corridor — touch the wall and the dot is thrown back to the last corner.
  // `level` = bomb heat (0..2): a hotter bomb gets a narrower corridor with more corners.
  const lvl = v => Math.max(0, Math.min(2, v | 0));
  function zigzagMake(seed, level) {
    const L = lvl(level), R = rng(seed), W = [5.4, 4.7, 4.1][L], nH = [4, 5, 6][L];
    const w = []; for (let i = 0; i < nH; i++) w.push(0.65 + R() * 0.7);
    const sum = w.reduce((a, b) => a + b, 0), xs = [12];
    w.forEach(x => xs.push(round1(xs[xs.length - 1] + 76 * x / sum))); xs[nH] = 88;
    let y = round1(26 + R() * 48); const pts = [[12, y]];
    for (let i = 0; i < nH; i++) {
      pts.push([xs[i + 1], y]);
      if (i < nH - 1) {
        let ny = y, tries = 0;
        while (Math.abs(ny - y) < 26 && tries++ < 60) ny = round1(16 + R() * 68);
        if (Math.abs(ny - y) < 26) ny = y > 50 ? round1(y - 32) : round1(y + 32);
        y = ny; pts.push([xs[i + 1], y]);
      }
    }
    const segs = []; for (let i = 0; i < pts.length - 1; i++) segs.push({ a: pts[i], b: pts[i + 1], axis: pts[i][1] === pts[i + 1][1] ? 'h' : 'v' });
    const swap = R() < 0.5;
    return { kind: 'zigzag', seed, level: L, W, pts, segs, start: pts[0], goal: pts[pts.length - 1], axisOf: swap ? { p1: 'h', p2: 'v' } : { p1: 'v', p2: 'h' } };
  }
  // highest segment whose corridor rectangle contains (x,y); -1 = inside a wall
  function zzSeg(p, x, y) {
    const W = p.W;
    for (let i = p.segs.length - 1; i >= 0; i--) {
      const s = p.segs[i];
      if (x >= Math.min(s.a[0], s.b[0]) - W && x <= Math.max(s.a[0], s.b[0]) + W && y >= Math.min(s.a[1], s.b[1]) - W && y <= Math.max(s.a[1], s.b[1]) + W) return i;
    }
    return -1;
  }

  // --- Mê Cung Mù: a perfect maze on an N×N grid. One player (the GUIDE) sees the whole maze and the dot but cannot move; the other
  //     (the DRIVER) sees ONLY the dot and moves it one cell at a time. Walls cost time. `level` = bomb heat: bigger maze, longer route.
  const MZ_DIRS = ['U', 'R', 'D', 'L'], MZ_DX = [0, 1, 0, -1], MZ_DY = [-1, 0, 1, 0];     // bit d of open[cell] = "no wall on side d"
  const mzOpen = (p, x, y, d) => (p.open[y * p.N + x] >> d) & 1;
  function mazePath(p, fx, fy, tx, ty) {                                // shortest route (the only route: the maze is perfect) as [[x,y],…] incl. both ends
    const N = p.N, prev = new Array(N * N).fill(-2), q = [fy * N + fx]; prev[q[0]] = -1;
    for (let i = 0; i < q.length && prev[ty * N + tx] === -2; i++) {
      const c = q[i], x = c % N, y = (c - x) / N;
      for (let d = 0; d < 4; d++) if (mzOpen(p, x, y, d)) { const n = (y + MZ_DY[d]) * N + x + MZ_DX[d]; if (prev[n] === -2) { prev[n] = c; q.push(n); } }
    }
    const out = []; for (let c = ty * N + tx; c !== -1 && c !== -2; c = prev[c]) out.push([c % N, Math.floor(c / N)]);
    return out.reverse();
  }
  function mazeMake(seed, level) {
    const L = lvl(level), R = rng(seed), N = [6, 7, 8][L], cap = [15, 19, 23][L], lo = [10, 13, 16][L];
    let best = null;
    for (let tries = 0; tries < 30; tries++) {
      const open = new Array(N * N).fill(0), seen = new Array(N * N).fill(false), st = [Math.floor(R() * N * N)]; seen[st[0]] = true;
      while (st.length) {                                                 // randomised depth-first carving
        const c = st[st.length - 1], x = c % N, y = (c - x) / N;
        const nb = shuffled(R, [0, 1, 2, 3]).filter(d => { const nx = x + MZ_DX[d], ny = y + MZ_DY[d]; return nx >= 0 && ny >= 0 && nx < N && ny < N && !seen[ny * N + nx]; });
        if (!nb.length) { st.pop(); continue; }
        const d = nb[0], n = (y + MZ_DY[d]) * N + x + MZ_DX[d]; open[c] |= 1 << d; open[n] |= 1 << ((d + 2) % 4); seen[n] = true; st.push(n);
      }
      const corners = [[0, 0], [N - 1, 0], [0, N - 1], [N - 1, N - 1]], sc = corners[Math.floor(R() * 4)], cand = { open, N }, dist = {};
      let far = null;                                                     // goal = the farthest cell whose route is still ≤ cap steps
      for (let c = 0; c < N * N; c++) { const len = mazePath(cand, sc[0], sc[1], c % N, Math.floor(c / N)).length - 1; if (len <= cap && (!far || len > far.len)) far = { c, len }; }
      const pick = { open, start: sc, goal: [far.c % N, Math.floor(far.c / N)], len: far.len };
      if (!best || pick.len > best.len) best = pick; if (pick.len >= lo) break;
    }
    const driver = R() < 0.5 ? 'p1' : 'p2';
    return { kind: 'maze', seed, level: L, N, open: best.open, start: best.start, goal: best.goal, len: best.len, driver, guide: driver === 'p1' ? 'p2' : 'p1' };
  }

  // --- Cắt Dây: p1 sees six wires, p2 holds the manual (an ordered list of 4 clues). Cut in order; 3 wrong cuts = boom.
  function wiresMake(seed, level) {
    const L = lvl(level), R = rng(seed), colors = shuffled(R, [0, 1, 2, 3, 4, 5]), shapes = shuffled(R, [0, 1, 2, 3, 4, 5]);
    const wires = colors.map((c, i) => ({ color: c, shape: shapes[i] }));
    const kinds = ['color', 'shape', 'pos'];
    const steps = shuffled(R, [0, 1, 2, 3, 4, 5]).slice(0, [4, 5, 6][L]).map(wi => ({ w: wi, by: kinds[Math.floor(R() * 3)] }));
    if (steps.every(s => s.by === steps[0].by)) steps[1].by = kinds[(kinds.indexOf(steps[0].by) + 1) % 3];
    return { kind: 'wires', seed, level: L, wires, steps, maxStrikes: [3, 3, 2][L] };
  }
  // `cuts` is the log of cut ATTEMPTS. A wrong attempt is a strike and the wire splices itself back together.
  function wiresEval(p, cuts) {
    let done = 0, strikes = 0;
    A(cuts).forEach(w => { if (done < p.steps.length && +w === p.steps[done].w) done++; else strikes++; });
    return { done, strikes, success: done >= p.steps.length, boom: strikes >= p.maxStrikes };
  }

  // --- Khóa Hai Chìa: each player sets a 3-symbol lock, but the code for MY lock is on MY TEAMMATE's screen.
  function lockMake(seed, level) {
    const L = lvl(level), N = [3, 4, 5][L], R = rng(seed), code = () => Array.from({ length: N }, () => Math.floor(R() * 6));
    const t1 = code(), t2 = code();
    const init = t => t.map(v => (v + 1 + Math.floor(R() * 5)) % 6);     // every slot starts wrong
    return { kind: 'lock', seed, level: L, n: N, target: { p1: t1, p2: t2 }, init: { p1: init(t1), p2: init(t2) } };
  }
  const sameArr = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  // ------------------------------------------------------------------------------------------------------------
  // GAME LOGIC. Every class works headless; DOM only happens if build() was called.
  // api = { puz, roles:{p1,p2}, mine:'p1'|'p2'|null, sim:{role:botLevel}, isAuth, names, t, send(role,payload), bubble(role,html,own), event(name) }
  class Base {
    constructor(api) {
      this.api = api; this.puz = api.puz; this.mine = api.mine; this.t = api.t;
      this.local = {}; if (api.mine) this.local[api.mine] = 'human'; Object.keys(api.sim || {}).forEach(r => { this.local[r] = 'bot'; });
      this.out = {}; this.dirty = {}; this.acc = 0; this.playing = false; this.seenSay = {}; this.seenQ = {}; this.sayN = {}; this.jobs = []; this.ui = null;
    }
    isLocal(r) { return !!this.local[r]; }
    locals() { return Object.keys(this.local); }
    other(r) { return r === 'p1' ? 'p2' : 'p1'; }
    start() { this.playing = true; this.locals().forEach(r => this.flush(r)); }
    touch(r) { this.dirty[r] = true; }
    flush(r) { this.dirty[r] = false; if (this.out[r]) { this.out[r].q = (this.out[r].q || 0) + 1; this.api.send(r, this.out[r]); } }   // q = sequence number: every snapshot repeats the OTHER role's old data, so each payload is applied once
    pump(dt) {                                                       // ≤12 sends/s per role, only when something changed
      this.acc += dt; if (this.acc < 0.08) return; this.acc = 0;
      this.locals().forEach(r => { if (this.dirty[r]) this.flush(r); });
    }
    after(sec, fn) { this.jobs.push({ t: sec, fn }); }
    tick(dt) { const due = []; this.jobs = this.jobs.filter(j => { j.t -= dt; if (j.t <= 0) { due.push(j); return false; } return true; }); due.forEach(j => j.fn()); }
    say(r, v) {                                                      // speech bubble from role r
      this.sayN[r] = (this.sayN[r] || 0) + 1; this.out[r].s = { n: this.sayN[r], v };
      this.flush(r); this.api.bubble(r, this.sayHTML(v), this.local[r] === 'human');
      const o = this.other(r); if (this.local[o] === 'bot') this.heard(o, v);       // the teammate is a bot simulated right here
    }
    onData(r, d) {
      if (!d || this.local[r]) return;
      if (d.s && d.s.n > (this.seenSay[r] || 0)) { this.seenSay[r] = d.s.n; if (this.playing) { this.api.bubble(r, this.sayHTML(d.s.v), false); if (this.local[this.other(r)] === 'bot') this.heard(this.other(r), d.s.v); } }
      if (d.q == null || d.q > (this.seenQ[r] || 0)) { this.seenQ[r] = d.q || 0; this.apply(r, d); }
    }
    sayHTML(v) { const m = /^chat:(\d)$/.exec(v || ''); return m ? Ic.svg(CHAT_ICONS[+m[1]]) + ' ' + esc(A(this.t('coop.chat'))[+m[1]] || '') : ''; }
    heard() {} apply() {} frame() {} result() { return 0; } penalty() { return 0; } build() {} render() {} key() { return false; } destroy() {}
    canSabo() { return false; } onSabo() {}                          // viewers' sabotage: only some minigames (Lái Chung) support it
    roleText() { return ''; }
  }

  // ---------------------------------------------------------------- Lái Chung
  const CHAT_ICONS = ['stop', 'go', 'wait', 'oops'];
  const ZZ_SPEED = 25, ZZ_PEN = 0.8;                                 // ZZ_PEN = seconds taken off the fuse every time the dot hits a wall
  // Viewer sabotage (anyone who is NOT one of the two drivers: the opposing team, dead players, spectators).
  //   rot = turn the whole track ±90° (view only: walls/collisions are unchanged, the pads keep their places),
  //   gum = a sticky blob on the track, slows the dot to GUM_SLOW while it is inside, lives GUM_LIFE s (max GUM_MAX at once),
  //   ink = ink splats hide the track for INK_LIFE s (the dot and guide lines stay visible).
  // Cooldowns are per viewer and per action. Each viewer publishes its own log {a:[{i,k,…}]} on its own node (single writer);
  // every client applies an entry once (sbSeen), so a lost message heals itself and the effects look the same everywhere.
  const SB_CD = { rot: 10, gum: 7, ink: 14 }, GUM_R = 6.5, GUM_SLOW = 0.35, GUM_LIFE = 9, GUM_MAX = 4, INK_LIFE = 4.5;
  const blobPts = (R, cx, cy, r, n) => Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2, d = r * (0.7 + R() * 0.5); return (cx + d * Math.cos(a)).toFixed(1) + ',' + (cy + d * Math.sin(a)).toFixed(1); }).join(' ');
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const ZBOT = { easy: { react: [0.7, 1.3], slow: 0.74, err: 0.16 }, normal: { react: [0.4, 0.8], slow: 0.9, err: 0.07 }, hard: { react: [0.2, 0.4], slow: 1, err: 0.02 } };
  class ZigzagGame extends Base {
    constructor(api) {
      super(api);
      const p = this.puz; this.axis = p.axisOf;
      this.pos = { x: p.start[0], y: p.start[1] }; this.tgt = { x: p.start[0], y: p.start[1] };
      this.held = {}; this.maxIdx = 0; this.cool = 0; this.outT = 0; this.bumps = { p1: 0, p2: 0 }; this.bot = {}; this.dt = 0; this.crashFx = 0;
      this.sentV = {}; this.sendT = { p1: 0, p2: 0 }; this.rv = { p1: 0, p2: 0 }; this.rAge = { p1: 9, p2: 9 }; this.drawn = '';
      this.locals().forEach(r => { this.out[r] = { p: this.pos[p.axisOf[r] === 'h' ? 'x' : 'y'], v: 0, b: 0, i: 0 }; });
      this.rot = 0; this.gums = []; this.ink = []; this.clock = 0;                    // viewer sabotage state (see SB_CD)
      this.sbSeen = {}; this.sbLast = {}; this.sbLog = []; this.sbCool = { rot: 0, gum: 0, ink: 0 }; this.sbShown = ''; this.sboDrawn = '';
    }
    ax(r) { return this.axis[r] === 'h' ? 'x' : 'y'; }
    // ---- viewer sabotage
    canSabo() { return !this.mine && !!this.api.sbKey; }
    rotNorm() { return ((this.rot % 360) + 360) % 360; }
    gumMul(x, y) { return this.gums.some(g => (g.x - x) * (g.x - x) + (g.y - y) * (g.y - y) <= GUM_R * GUM_R) ? GUM_SLOW : 1; }
    sabo(kind, arg) {                                                 // called by the viewer's own button / tap. true = it went out
      if (!this.playing || !this.canSabo() || !(kind in SB_CD) || this.sbCool[kind] > 0) return false;
      const act = { i: this.sbLog.length + 1, k: kind };
      if (kind === 'rot') act.a = arg < 0 ? -1 : 1;
      else if (kind === 'gum') { const q = arg || this.autoGum(); act.x = round1(clamp(q.x, 3, 97)); act.y = round1(clamp(q.y, 3, 97)); }
      this.sbLog.push(act); this.sbCool[kind] = SB_CD[kind]; this.sbSeen[this.api.sbKey] = act.i; this.sbLast[this.api.sbKey + kind] = this.clock;
      this.applySabo(this.api.sbKey, act);                            // instantly on my own screen; everybody else gets it through the channel
      this.api.sendSabo({ a: this.sbLog.slice(-12) });
      return true;
    }
    autoGum() {                                                       // a spot on the track just ahead of the dot
      const p = this.puz, i = Math.min(this.maxIdx + (Math.random() < 0.5 ? 0 : 1), p.segs.length - 1), s = p.segs[i], f = 0.35 + Math.random() * 0.65;
      return { x: s.a[0] + (s.b[0] - s.a[0]) * f, y: s.a[1] + (s.b[1] - s.a[1]) * f };
    }
    onSabo(key, node) {                                               // somebody else's log: apply each entry exactly once
      if (!node || key === this.api.sbKey) return;
      A(node.a).map(o => o || {}).sort((x, y) => (+x.i || 0) - (+y.i || 0)).forEach(o => {
        const i = +o.i || 0; if (i <= (this.sbSeen[key] || 0)) return; this.sbSeen[key] = i;
        const k = o.k; if (!(k in SB_CD)) return;
        if (this.clock - (this.sbLast[key + k] === undefined ? -1e9 : this.sbLast[key + k]) < SB_CD[k] * 0.6) return;       // a client that ignores its cooldown is ignored
        this.sbLast[key + k] = this.clock;
        const act = { i, k }; if (k === 'rot') act.a = +o.a < 0 ? -1 : 1; if (k === 'gum') { if (!isFinite(+o.x) || !isFinite(+o.y)) return; act.x = clamp(+o.x, 3, 97); act.y = clamp(+o.y, 3, 97); }
        this.applySabo(key, act);
      });
    }
    applySabo(key, act) {
      if (act.k === 'rot') this.rot += act.a * 90;
      else if (act.k === 'gum') { this.gums.push({ id: key + ':' + act.i, x: act.x, y: act.y, age: 0 }); while (this.gums.length > GUM_MAX) this.gums.shift(); }
      else if (act.k === 'ink') this.ink = [{ id: key + ':' + act.i, age: 0 }];
      this.api.event('sabo'); this.api.note(key, act.k, act.a);
    }
    roleText() { return this.mine ? this.t(this.axis[this.mine] === 'v' ? 'coop.zz.roleV' : 'coop.zz.roleH') : this.t('coop.zz.watch'); }
    apply(r, d) {                                                     // d.v = signed speed factor: the remote dot keeps gliding between updates
      this.bumps[r] = +d.b || 0; if (+d.i > this.maxIdx) this.maxIdx = Math.min(+d.i, this.puz.segs.length - 1);   // everyone agrees on the last corner reached
      if (d.p == null || !isFinite(+d.p)) return;
      this.rv[r] = +d.v || 0; this.rAge[r] = 0; this.tgt[this.ax(r)] = clamp(+d.p + this.rv[r] * ZZ_SPEED * 0.06, 3, 97);
    }
    penalty() { return ZZ_PEN * (this.bumps.p1 + this.bumps.p2); }
    result() { const g = this.puz.goal; return Math.abs(this.pos.x - g[0]) < 3.6 && Math.abs(this.pos.y - g[1]) < 3.6 ? 1 : 0; }
    key(code, down) {
      if (!this.mine) return false;
      const v = this.axis[this.mine] === 'v', neg = v ? ['ArrowUp', 'KeyW'] : ['ArrowLeft', 'KeyA'], pos = v ? ['ArrowDown', 'KeyS'] : ['ArrowRight', 'KeyD'];
      if (neg.indexOf(code) >= 0) { this.held.neg = down; return true; } if (pos.indexOf(code) >= 0) { this.held.pos = down; return true; } return false;
    }
    botDir(r) {
      const p = this.puz, L = ZBOT[this.api.sim[r]] || ZBOT.normal, a = this.axis[r], ai = a === 'h' ? 0 : 1, k = this.ax(r);
      let st = this.bot[r]; if (!st) st = this.bot[r] = { idx: -1, wait: 0.9, ov: 0 };
      const idx = Math.min(this.maxIdx, p.segs.length - 1), seg = p.segs[idx];
      if (st.idx !== idx) {
        if (st.idx >= 0 && p.segs[st.idx].axis === a) this.say(r, 'chat:1');                       // "your turn!" when handing over
        st.idx = idx; st.wait = rand(L.react[0], L.react[1]);
        st.ov = seg.axis === a && Math.random() < L.err ? p.W + 2.5 + Math.random() * 2 : 0;       // a human-like blunder: overshoot the corner
      }
      if (st.wait > 0) { st.wait -= this.dt; return 0; }
      const cur = this.pos[k];
      if (seg.axis === a) { const sgn = Math.sign(seg.b[ai] - seg.a[ai]) || 1, d = seg.b[ai] + sgn * st.ov - cur; return Math.abs(d) < 0.7 ? 0 : Math.sign(d); }
      const d = seg.a[ai] - cur; return Math.abs(d) > 0.8 ? Math.sign(d) : 0;                       // not my leg: stay on the centre line
    }
    frame(dt) {
      if (!this.playing) return;
      const p = this.puz; this.dt = dt; this.tick(dt); this.cool = Math.max(0, this.cool - dt); this.clock += dt;
      Object.keys(this.sbCool).forEach(k => { this.sbCool[k] = Math.max(0, this.sbCool[k] - dt); });
      this.gums.forEach(g => { g.age += dt; }); this.gums = this.gums.filter(g => g.age < GUM_LIFE);
      this.ink.forEach(g => { g.age += dt; }); this.ink = this.ink.filter(g => g.age < INK_LIFE);
      const gm = this.gumMul(this.pos.x, this.pos.y);                  // stuck in gum: both drivers crawl while the dot is inside it
      this.locals().forEach(r => {
        let dir = 0, mul = gm;
        if (this.local[r] === 'human') dir = (this.held.pos ? 1 : 0) - (this.held.neg ? 1 : 0);
        else { dir = this.botDir(r); mul *= (ZBOT[this.api.sim[r]] || ZBOT.normal).slow; }
        const k = this.ax(r), v = dir * mul, o = this.out[r];
        if (dir) this.pos[k] = clamp(this.pos[k] + v * ZZ_SPEED * dt, 3, 97);
        o.i = this.maxIdx;
        if (v !== (this.sentV[r] || 0)) { this.sentV[r] = v; o.v = Math.round(v * 100) / 100; o.p = round1(this.pos[k]); this.sendT[r] = 0; this.flush(r); }   // start / stop / turn: tell everyone at once
        else if ((this.sendT[r] += dt) >= (v ? 0.3 : 1)) { this.sendT[r] = 0; o.p = round1(this.pos[k]); this.flush(r); }                                      // slow correction while moving, a heartbeat while still: a missed message heals itself
      });
      ['p1', 'p2'].forEach(r => {
        if (this.local[r]) return; const k = this.ax(r); this.rAge[r] += dt;
        if (this.rv[r] && this.rAge[r] < 0.7) this.tgt[k] = clamp(this.tgt[k] + this.rv[r] * ZZ_SPEED * dt, 3, 97);         // dead reckoning
        if (Math.abs(this.tgt[k] - this.pos[k]) > 10) this.pos[k] = this.tgt[k]; else this.pos[k] += (this.tgt[k] - this.pos[k]) * Math.min(1, dt * 12);
      });
      const si = zzSeg(p, this.pos.x, this.pos.y);
      if (si >= 0) { this.outT = 0; if (si > this.maxIdx) this.maxIdx = si; }
      else if (this.cool <= 0) { this.outT += dt; if (this.outT > 0.06) this.crash(); }
      this.pump(dt); this.crashFx = Math.max(0, this.crashFx - dt);
    }
    crash() {                                                         // each owner pulls ITS axis back to the last corner
      const cp = this.puz.segs[this.maxIdx].a; this.cool = 0.5; this.outT = 0; this.crashFx = 0.45;
      this.locals().forEach(r => { const k = this.ax(r); this.pos[k] = cp[k === 'x' ? 0 : 1]; this.out[r].p = round1(this.pos[k]); this.out[r].v = 0; this.sentV[r] = 0; this.out[r].i = this.maxIdx; this.out[r].b++; this.bumps[r] = this.out[r].b; this.flush(r); });
      this.api.event('crash');
    }
    // ---- DOM
    build(ui) {
      this.ui = ui; const p = this.puz, pts = p.pts.map(q => q.join(',')).join(' '), W = p.W, who = k => (this.axis.p1 === k ? 'p1' : 'p2');
      const col = r => 'var(--' + this.api.roles[r] + ')', S = p.start, G = p.goal;
      const star = SYM_PTS[4].split(' ').map(q => { const [a, b] = q.split(',').map(Number); return ((a - 12) * 0.34).toFixed(2) + ',' + ((b - 12.6) * 0.34).toFixed(2); }).join(' ');
      ui.board.innerHTML = '<svg class="zz" viewBox="0 0 100 100"><rect class="zz-bg" x="0" y="0" width="100" height="100" rx="3"/>' +
        '<polyline class="zz-path" points="' + pts + '" stroke-width="' + (W * 2) + '"/><polyline class="zz-mid" points="' + pts + '"/>' +
        '<g transform="translate(' + S[0] + ' ' + S[1] + ')"><circle class="zz-start" r="3.4"/></g>' +
        '<g transform="translate(' + G[0] + ' ' + G[1] + ')"><circle class="zz-goal" r="4.4"/><polygon class="zz-star" points="' + star + '"/></g>' +
        '<g class="zz-gums"></g><g class="zz-ink"></g>' +
        '<line class="zz-gx" style="stroke:' + col(who('h')) + '"/><line class="zz-gy" style="stroke:' + col(who('v')) + '"/>' +
        '<circle class="zz-tx" r="2.1" style="fill:' + col(who('h')) + '"/><circle class="zz-ty" r="2.1" style="fill:' + col(who('v')) + '"/>' +
        '<g class="zz-dot"><circle r="3" class="zz-bomb"/><circle cx="-1" cy="-1.1" r=".8" class="zz-shine"/><path class="zz-fuse" d="M1.2,-2.7 q1.6,-2.2 3.2,-1.4"/><polygon class="zz-spark" points="4.6,-5.6 5.6,-4.2 7.2,-4.5 6.1,-3.3 6.8,-1.9 5.2,-2.6 4,-1.6 4.3,-3.2"/></g></svg>';
      this.el = { svg: ui.board.querySelector('svg'), dot: ui.board.querySelector('.zz-dot'), gx: ui.board.querySelector('.zz-gx'), gy: ui.board.querySelector('.zz-gy'), tx: ui.board.querySelector('.zz-tx'), ty: ui.board.querySelector('.zz-ty'), gums: ui.board.querySelector('.zz-gums'), ink: ui.board.querySelector('.zz-ink') };
      if (this.canSabo()) { this.buildSabo(ui); return; }
      if (!this.mine) return;
      const v = this.axis[this.mine] === 'v', t = this.t, L = v ? [Ic.arrow('u'), t('coop.zz.up'), Ic.arrow('d'), t('coop.zz.down')] : [Ic.arrow('l'), t('coop.zz.left'), Ic.arrow('r'), t('coop.zz.right')];
      ui.ctl.innerHTML = '<div class="pad ' + (v ? 'v' : 'h') + '"><button type="button" class="hold" data-d="neg"><b>' + L[0] + '</b><small>' + L[1] + '</small></button><button type="button" class="hold" data-d="pos"><b>' + L[2] + '</b><small>' + L[3] + '</small></button></div><p class="pad-tip">' + t('coop.zz.tip') + '</p>';
      ui.ctl.querySelectorAll('.hold').forEach(b => {
        const d = b.dataset.d, on = e => { e.preventDefault(); if (this.playing) this.held[d] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) {} },
          off = () => { this.held[d] = false; b.classList.remove('on'); };
        b.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(ev => b.addEventListener(ev, off)); b.addEventListener('contextmenu', e => e.preventDefault());
      });
      this.el.pad = ui.ctl.querySelector('.pad'); this.el.arrows = Array.from(ui.ctl.querySelectorAll('.hold b'));
    }
    buildSabo(ui) {                                                   // the viewer's panel: three buttons with cooldowns + tap the track to drop gum
      const t = this.t, B = [['rot-', Ic.svg('rotL'), t('coop.sb.rotL'), 'rot'], ['rot+', Ic.svg('rotR'), t('coop.sb.rotR'), 'rot'], ['gum', Ic.svg('gum'), t('coop.sb.gum'), 'gum'], ['ink', Ic.svg('ink'), t('coop.sb.ink'), 'ink']];
      ui.ctl.innerHTML = '<div class="sb"><h4>' + Ic.svg('spark') + ' ' + esc(t('coop.sb.title')) + '</h4><div class="sb-btns">' + B.map(([id, ic, lb, k]) => '<button type="button" class="sb-b" data-id="' + id + '" data-k="' + k + '"><b>' + ic + '</b><small>' + esc(lb) + '</small><em></em></button>').join('') + '</div><p class="pad-tip">' + esc(t('coop.sb.tip')) + '</p></div>';
      ui.ctl.querySelectorAll('.sb-b').forEach(b => b.addEventListener('click', () => { const id = b.dataset.id; this.sabo(b.dataset.k, id === 'rot-' ? -1 : 1); this.refreshSabo(); }));
      this.el.sbBtns = Array.from(ui.ctl.querySelectorAll('.sb-b')); this.el.svg.classList.add('aim');
      this.el.svg.addEventListener('pointerdown', e => {              // tap the board = throw gum THERE (screen point -> track coordinates, undoing the current rotation)
        const r = this.el.svg.getBoundingClientRect(), s = r.width ? [(e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5] : null; if (!s) return;
        const a = this.rotNorm() * Math.PI / 180, c = Math.cos(a), n = Math.sin(a);
        e.preventDefault(); this.sabo('gum', { x: (s[0] * c + s[1] * n + 0.5) * 100, y: (-s[0] * n + s[1] * c + 0.5) * 100 }); this.refreshSabo();
      });
      this.refreshSabo();
    }
    refreshSabo() {
      if (!this.el || !this.el.sbBtns) return; const key = this.el.sbBtns.map(b => Math.ceil(this.sbCool[b.dataset.k])).join(',') + (this.playing ? 'p' : '');
      if (key === this.sbShown) return; this.sbShown = key;
      this.el.sbBtns.forEach(b => { const c = Math.ceil(this.sbCool[b.dataset.k]); b.disabled = c > 0 || !this.playing; b.lastChild.textContent = c > 0 ? c + 's' : ''; });
    }
    sboHTML() {                                                       // gum + ink as polygons, deterministic from the action ids (same picture on every screen)
      const gum = this.gums.map(g => { const R = rng(hashStr(g.id)), a = Math.min(1, (GUM_LIFE - g.age) / 1.5);
        return '<g opacity="' + (0.9 * a).toFixed(2) + '"><polygon class="zz-gum" points="' + blobPts(R, g.x, g.y, GUM_R, 9) + '"/><polygon class="zz-gum2" points="' + blobPts(R, g.x - 1.4, g.y - 1.4, GUM_R * 0.35, 6) + '"/></g>'; }).join('');
      const ink = this.ink.map(g => { const R = rng(hashStr(g.id)), a = Math.min(1, (INK_LIFE - g.age) / 1.2, g.age / 0.15 + 0.2) * (this.mine ? 0.95 : 0.35); let s = '';
        for (let k = 0; k < 7; k++) s += '<polygon class="zz-inkb" points="' + blobPts(R, 8 + R() * 84, 8 + R() * 84, 14 + R() * 12, 11) + '"/>';
        return '<g opacity="' + a.toFixed(2) + '">' + s + '</g>'; }).join('');
      return [gum, ink];
    }
    render() {
      if (!this.el) return; const e = this.el, x = this.pos.x, y = this.pos.y;
      this.refreshSabo();
      const sk = this.gums.map(g => g.id + Math.round(g.age * 4)).join() + '|' + this.ink.map(g => g.id + Math.round(g.age * 8)).join() + '|' + this.rot;
      if (sk !== this.sboDrawn) {
        this.sboDrawn = sk; const h = this.sboHTML(); if (e.gums) e.gums.innerHTML = h[0]; if (e.ink) e.ink.innerHTML = h[1];
        const d = this.rot + 'deg'; e.svg.style.rotate = d; if (e.arrows) e.arrows.forEach(b => { b.style.rotate = d; }); if (e.pad) e.pad.classList.toggle('rotd', this.rotNorm() !== 0);
      }
      const key = x.toFixed(1) + '|' + y.toFixed(1) + '|' + (this.crashFx > 0 ? 1 : 0);
      if (key === this.drawn) return; this.drawn = key;                // nothing moved: no DOM work at all
      e.dot.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')');
      e.gx.setAttribute('x1', x); e.gx.setAttribute('x2', x); e.gx.setAttribute('y1', 0); e.gx.setAttribute('y2', y);
      e.gy.setAttribute('x1', 0); e.gy.setAttribute('x2', x); e.gy.setAttribute('y1', y); e.gy.setAttribute('y2', y);
      e.tx.setAttribute('cx', x); e.tx.setAttribute('cy', 1.8); e.ty.setAttribute('cx', 1.8); e.ty.setAttribute('cy', y);
      e.svg.classList.toggle('crash', this.crashFx > 0);
    }
  }

  // ---------------------------------------------------------------- Cắt Dây
  const WBOT = { easy: { d: [1.4, 2.4], err: 0.2 }, normal: { d: [0.9, 1.7], err: 0.09 }, hard: { d: [0.5, 1.0], err: 0.03 } };
  class WiresGame extends Base {
    constructor(api) {
      super(api); this.cuts = []; this.flash = {}; this.botSt = { p1: { idle: 0 }, p2: { last: -1, wait: 0, idle: 0 } };
      if (this.local.p1) this.out.p1 = { c: [] }; if (this.local.p2) this.out.p2 = {};
    }
    state() { return wiresEval(this.puz, this.cuts); }
    roleText() { return this.mine ? this.t(this.mine === 'p1' ? 'coop.wires.roleWires' : 'coop.wires.roleManual') : this.t('coop.wires.watch'); }
    result() { const s = this.state(); return s.success ? 1 : (s.boom ? -1 : 0); }
    penalty() { return 4 * Math.min(this.state().strikes, 3); }
    apply(r, d) {
      if (r !== 'p1') return; const c = A(d.c).map(Number);
      if (c.length > this.cuts.length) { const was = this.cuts.length; this.cuts = c; this.noteAttempts(was); }
    }
    doneWires() { return this.puz.steps.slice(0, this.state().done).map(s => s.w); }
    cut(w) {                                                          // p1 only (human click or bot)
      if (!this.playing || !this.local.p1 || this.state().success || this.state().boom || this.doneWires().indexOf(w) >= 0) return;
      const was = this.cuts.length; this.cuts.push(w); this.out.p1.c = this.cuts.slice(); this.flush('p1'); this.noteAttempts(was);
    }
    noteAttempts(from) {                                              // animate every new attempt: snip or zap
      let done = 0; const ok = [];
      for (let i = 0; i < this.cuts.length; i++) { const good = done < this.puz.steps.length && this.cuts[i] === this.puz.steps[done].w; if (good) done++; if (i >= from) ok.push([this.cuts[i], good]); }
      ok.forEach(([w, good]) => { if (good) this.api.event('snip'); else { this.flash[w] = 0.7; this.api.event('zap'); } });
      this.refresh();
    }
    tell(k) { if (this.playing && this.local.p2 && this.local.p2 === 'human') this.say('p2', 'step:' + k); }
    clueHTML(step) {
      const w = this.puz.wires[step.w], t = this.t;
      if (step.by === 'color') return '<i class="sw" style="background:' + WIRE_COLORS[w.color].hex + '"></i>' + esc(t('coop.wires.clue.color', t('coop.wires.colors.' + WIRE_COLORS[w.color].id)));
      if (step.by === 'shape') return symSVG(w.shape, '#f6f0e2', 'sm') + esc(t('coop.wires.clue.shape', A(t('coop.wires.shapes'))[w.shape]));
      return '<b class="pos">' + (step.w + 1) + '</b>' + esc(t('coop.wires.clue.pos', step.w + 1));
    }
    sayHTML(v) {
      const m = /^step:(\d)$/.exec(v || ''); if (!m) return super.sayHTML(v);
      const k = +m[1], st = this.puz.steps[k]; return st ? '<span class="say-step">' + esc(this.t('coop.wires.step', k + 1)) + ':</span> ' + this.clueHTML(st) : '';
    }
    heard(r, v) {                                                     // a simulated bot reacts to what its teammate said
      const m = /^step:(\d)$/.exec(v || ''); if (r !== 'p1' || !m) return;
      const k = +m[1], L = WBOT[this.api.sim.p1] || WBOT.normal; this.botSt.p1.idle = 0;
      this.after(rand(L.d[0], L.d[1]), () => {
        const s = this.puz.steps[k]; if (!s || this.doneWires().indexOf(s.w) >= 0) return;
        if (Math.random() < L.err) { const bad = [0, 1, 2, 3, 4, 5].filter(w => this.doneWires().indexOf(w) < 0 && w !== s.w); this.cut(bad[Math.floor(Math.random() * bad.length)]); } else this.cut(s.w);
      });
    }
    frame(dt) {
      if (!this.playing) return; this.tick(dt); this.pump(dt);
      Object.keys(this.flash).forEach(w => { this.flash[w] -= dt; if (this.flash[w] <= 0) { delete this.flash[w]; this.refresh(); } });
      const s = this.state(), live = !s.success && !s.boom;
      if (this.local.p2 === 'bot' && live) {                          // the bot reads the manual out loud, step by step
        const b = this.botSt.p2, L = WBOT[this.api.sim.p2] || WBOT.normal;
        if (b.last !== s.done) { b.last = s.done; b.wait = rand(0.9, 1.6); b.idle = 0; }
        const tell = () => this.say('p2', 'step:' + (Math.random() < L.err ? Math.floor(Math.random() * this.puz.steps.length) : this.state().done));    // now and then it misreads…
        if (b.wait > 0) { b.wait -= dt; if (b.wait <= 0) tell(); }
        else { b.idle += dt; if (b.idle >= 6.5) { b.idle = 0; tell(); } }                                                          // …and repeats itself if nothing happens
      }
      if (this.local.p1 === 'bot' && live) {                          // a bot holder that was never told eventually guesses
        const b = this.botSt.p1; b.idle += dt;
        if (b.idle > 8) { b.idle = 0; const left = [0, 1, 2, 3, 4, 5].filter(w => this.doneWires().indexOf(w) < 0); this.cut(left[Math.floor(Math.random() * left.length)]); }
      }
    }
    // ---- DOM
    build(ui) {
      this.ui = ui; const t = this.t;
      const wiresHTML = () => '<div class="wires"><div class="wires-box">' + this.puz.wires.map((w, i) =>
        '<button type="button" class="wire" data-w="' + i + '" style="--wc:' + WIRE_COLORS[w.color].hex + '"><span class="w-num">' + (i + 1) + '</span><i class="w-line"><b></b><b></b></i><span class="w-tag">' + symSVG(w.shape, '#f6f0e2') + '</span></button>').join('') +
        '</div><div class="w-strikes"></div></div>';
      const manualHTML = () => '<div class="manual"><h4>' + Ic.svg('book') + ' ' + esc(t('coop.wires.manual')) + '</h4><ol>' + this.puz.steps.map((s, k) =>
        '<li data-k="' + k + '"><em>' + esc(t('coop.wires.step', k + 1)) + '</em><span class="clue">' + this.clueHTML(s) + '</span>' + (this.mine === 'p2' ? '<button type="button" class="tell" data-k="' + k + '" title="' + esc(t('coop.wires.tell')) + '">' + Ic.svg('megaphone') + '</button>' : '') + '</li>').join('') +
        '</ol><div class="w-strikes"></div></div>';
      if (this.mine === 'p2') ui.board.innerHTML = manualHTML();
      else ui.board.innerHTML = wiresHTML();                          // only the manual holder ever sees the manual (spectators don't)
      if (this.mine === 'p1') ui.ctl.innerHTML = '<div class="w-told"><small>' + esc(t('coop.wires.toldTitle')) + '</small><div class="w-told-in">…</div></div>';
      ui.board.querySelectorAll('.wire').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); if (this.mine === 'p1') this.cut(+b.dataset.w); }));
      ui.root.querySelectorAll('.tell').forEach(b => b.addEventListener('click', () => this.tell(+b.dataset.k)));
      this.refresh();
    }
    refresh() {
      if (!this.ui) return; const s = this.state(), done = this.doneWires(), root = this.ui.root;
      root.querySelectorAll('.wire').forEach(b => { const w = +b.dataset.w; b.classList.toggle('cut', done.indexOf(w) >= 0); b.classList.toggle('zap', !!this.flash[w]); });
      root.querySelectorAll('.manual li').forEach(li => { const k = +li.dataset.k; li.classList.toggle('done', k < s.done); li.classList.toggle('cur', k === s.done && !s.success); });
      const bolts = Array.from({ length: this.puz.maxStrikes }, (_, i) => '<span class="' + (i < s.strikes ? 'hit' : '') + '">' + Ic.svg('bolt') + '</span>').join('');
      root.querySelectorAll('.w-strikes').forEach(el => { el.innerHTML = '<small>' + esc(this.t('coop.wires.strikes')) + '</small> ' + bolts; });
    }
    onToldUI(v) { const el = this.ui && this.ui.ctl.querySelector('.w-told-in'); if (el) el.innerHTML = this.sayHTML(v); }
    onData(r, d) { if (d && d.s && r === 'p2' && this.mine === 'p1' && d.s.n > (this.seenSay.p2 || 0) && /^step:/.test(d.s.v)) this.onToldUI(d.s.v); super.onData(r, d); }
  }

  // ---------------------------------------------------------------- Khóa Hai Chìa
  const LBOT = { easy: { d: [1.5, 2.6], err: 0.2 }, normal: { d: [0.9, 1.7], err: 0.09 }, hard: { d: [0.5, 1.0], err: 0.03 } };
  class LockGame extends Base {
    constructor(api) {
      super(api); const p = this.puz;
      this.set = { p1: p.init.p1.slice(), p2: p.init.p2.slice() }; this.botSt = { j: 0, wait: 2 };
      this.locals().forEach(r => { this.out[r] = { set: this.set[r].slice() }; });
    }
    roleText() { return this.mine ? this.t('coop.lock.role') : this.t('coop.lock.watch'); }
    result() { return sameArr(this.set.p1, this.puz.target.p1) && sameArr(this.set.p2, this.puz.target.p2) ? 1 : 0; }
    apply(r, d) { const s = A(d.set).map(Number); if (s.length === this.puz.n) { this.set[r] = s; this.refresh(); } }
    turn(r, j) {                                                     // my dial: tap = next symbol. The picture changes FIRST; sound/network can never block it
      if (!this.playing || !this.local[r] || this.result()) return;
      this.set[r][j] = (this.set[r][j] + 1) % 6; this.out[r].set = this.set[r].slice(); this.refresh();
      try { this.flush(r); } catch (e) {} try { this.api.event('snip'); } catch (e) {}
    }
    tellSlot(r, j) { if (this.playing) this.say(r, 'sym:' + j + ':' + this.puz.target[this.other(r)][j]); }       // I read MY mate's code to them
    sayHTML(v) {
      const m = /^sym:(\d):(\d)$/.exec(v || ''); if (!m) return super.sayHTML(v);
      return esc(this.t('coop.lock.saySlot', +m[1] + 1)) + ' ' + symSVG(+m[2], null, 'sm') + ' <b>' + esc(A(this.t('coop.lock.sym'))[+m[2]]) + '</b>';
    }
    heard(r, v) {                                                     // a bot sets the slot its teammate just read out
      const m = /^sym:(\d):(\d)$/.exec(v || ''); if (!m) return; const j = +m[1], sym = +m[2], L = LBOT[this.api.sim[r]] || LBOT.normal;
      this.after(rand(L.d[0], L.d[1]), () => { this.set[r][j] = Math.random() < L.err ? Math.floor(Math.random() * 6) : sym; this.out[r].set = this.set[r].slice(); this.flush(r); this.refresh(); });
    }
    frame(dt) {
      if (!this.playing) return; this.tick(dt); this.pump(dt);
      Object.keys(this.local).forEach(r => {                          // a bot reads the code it sees to the human, slot by slot
        if (this.local[r] !== 'bot') return; const b = this.botSt, L = LBOT[this.api.sim[r]] || LBOT.normal;
        if (sameArr(this.set[this.other(r)], this.puz.target[this.other(r)])) return;
        b.wait -= dt; if (b.wait <= 0) { b.wait = rand(L.d[0] + 1, L.d[1] + 1.8); const j = b.j; b.j = (b.j + 1) % this.puz.n; const k = Math.random() < L.err ? (j + 1) % this.puz.n : j; this.say(r, 'sym:' + k + ':' + this.puz.target[this.other(r)][k]); }
      });
    }
    build(ui) {
      this.ui = ui; const t = this.t, name = r => this.api.names[r];
      const row = (r, kind) => {                                      // kind 'code' = the symbols I read out, 'dial' = the lock I set
        const tg = kind === 'code' ? this.puz.target[this.other(r)] : this.set[r];
        return '<div class="lk-row ' + kind + '" data-r="' + r + '"><h4>' + esc(kind === 'code' ? t('coop.lock.code', name(this.other(r))) : t('coop.lock.dial', name(r))) + '</h4><p>' + esc(t(kind === 'code' ? 'coop.lock.codeHint' : 'coop.lock.dialHint')) + '</p><div class="slots">' +
          Array.from({ length: this.puz.n }, (_, j) => j).map(j => '<button type="button" class="slot" data-r="' + r + '" data-j="' + j + '" data-k="' + kind + '">' + symSVG(tg[j]) + '</button>').join('') + '</div></div>';
      };
      if (this.mine) ui.board.innerHTML = '<div class="lock">' + row(this.mine, 'code') + row(this.mine, 'dial') + '</div>';
      else ui.board.innerHTML = '<div class="lock spec">' + row('p1', 'dial') + row('p2', 'dial') + '</div>';
      // ONE delegated handler on the board (the slot buttons get re-drawn, the board does not). pointerdown is instant on touch; `click` is the
      // fallback for browsers / webviews that swallow pointer events (a click that follows a handled pointerdown is skipped, so a tap never counts twice).
      const hit = (e, viaClick) => {
        const b = e.target.closest && e.target.closest('.slot'); if (!b || !ui.board.contains(b)) return;
        if (viaClick) { if (performance.now() - (this.lastPD || -1e9) < 600) return; } else this.lastPD = performance.now();
        e.preventDefault(); const r = b.dataset.r, j = +b.dataset.j; if (!this.mine || r !== this.mine) return;
        if (b.dataset.k === 'code') { this.tellSlot(r, j); b.classList.add('told'); setTimeout(() => b.classList.remove('told'), 500); } else this.turn(r, j);
      };
      ui.board.addEventListener('pointerdown', e => hit(e, false)); ui.board.addEventListener('click', e => hit(e, true));
    }
    refresh() {
      if (!this.ui) return;
      this.ui.board.querySelectorAll('.slot[data-k="dial"]').forEach(b => { b.innerHTML = symSVG(this.set[b.dataset.r][+b.dataset.j]); });
    }
  }

  // ---------------------------------------------------------------- Mê Cung Mù
  const MZ_FIRST = 0.3, MZ_REPEAT = 0.17, MZ_PEN = 0.6, MZ_ARROW = ['u', 'r', 'd', 'l'], MZ_NAME = ['up', 'right', 'down', 'left'];
  const MBOT = { easy: { react: [0.8, 1.4], hear: [0.3, 0.6], step: 0.4, err: 0.14 }, normal: { react: [0.5, 0.9], hear: [0.2, 0.4], step: 0.3, err: 0.06 }, hard: { react: [0.25, 0.5], hear: [0.1, 0.25], step: 0.22, err: 0.02 } };
  const MZ_KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
  class MazeGame extends Base {
    constructor(api) {
      super(api); const p = this.puz; this.driver = p.driver; this.guide = p.guide;
      this.pos = p.start.slice(); this.disp = { x: p.start[0], y: p.start[1] }; this.bumps = 0; this.steps = 0; this.trail = [p.start.slice()];
      this.held = {}; this.order = []; this.block = null; this.rep = 0; this.hb = 0; this.crashFx = 0; this.drawn = ''; this.bot = {};
      if (this.local[this.driver]) this.out[this.driver] = { x: p.start[0], y: p.start[1], b: 0, n: 0 };
      if (this.local[this.guide]) this.out[this.guide] = {};
    }
    roleText() { return this.mine ? this.t(this.mine === this.driver ? 'coop.maze.roleBlind' : 'coop.maze.roleMap') : this.t('coop.maze.watch'); }
    result() { const g = this.puz.goal; return this.pos[0] === g[0] && this.pos[1] === g[1] ? 1 : 0; }
    penalty() { return MZ_PEN * this.bumps; }
    apply(r, d) {                                                     // only the driver's payload carries game state (the guide only talks)
      if (r !== this.driver) return;
      const x = Math.round(+d.x), y = Math.round(+d.y), N = this.puz.N;
      if (x >= 0 && y >= 0 && x < N && y < N && (x !== this.pos[0] || y !== this.pos[1])) {
        const route = mazePath(this.puz, this.pos[0], this.pos[1], x, y); route.shift(); route.forEach(c => this.trail.push(c));   // a lost message: fill the gap along the maze
        this.pos = [x, y]; this.steps = Math.max(this.steps, +d.n || 0);
      }
      const b = +d.b || 0; if (b > this.bumps) { this.bumps = b; this.crashFx = 0.45; this.api.event('crash'); }
    }
    // ---- the driver's moves (human buttons / keys, or a bot)
    step(d) {                                                         // 1 = moved, 0 = hit a wall, -1 = not allowed now
      const r = this.driver, o = this.out[r]; if (!o || !this.playing || this.result()) return -1;
      if (mzOpen(this.puz, this.pos[0], this.pos[1], d)) {
        this.pos = [this.pos[0] + MZ_DX[d], this.pos[1] + MZ_DY[d]]; this.steps++; this.trail.push(this.pos.slice());
        o.x = this.pos[0]; o.y = this.pos[1]; o.n = this.steps; this.touch(r); return 1;
      }
      this.bumps++; o.b = this.bumps; this.crashFx = 0.45; this.block = d; this.flush(r); this.api.event('crash'); return 0;
    }
    press(d) {
      if (!this.playing || this.mine !== this.driver || this.held[d]) return;
      this.held[d] = true; this.order.push(d); this.rep = MZ_FIRST; this.block = null; this.step(d);
    }
    release(d) { this.held[d] = false; if (this.block === d) this.block = null; }
    key(code, down) {
      if (this.mine !== this.driver || MZ_KEYS[code] == null) return false;
      if (down) this.press(MZ_KEYS[code]); else this.release(MZ_KEYS[code]); return true;
    }
    // ---- bots: the driver bot obeys what it hears, the guide bot reads the route out run by run
    heard(r, v) {
      v = v || '';
      if (r === this.driver) {
        const L = MBOT[this.api.sim[r]] || MBOT.normal, m = /^dir:([URDL])(\d+)?$/.exec(v), B = this.bot.d || (this.bot.d = { cmd: -1, left: 0, t: 0 });
        if (m) this.after(rand(L.hear[0], L.hear[1]), () => {
          let n = m[2] ? +m[2] : Infinity; if (n !== Infinity && Math.random() < L.err) n = Math.max(1, n + (Math.random() < 0.5 ? -1 : 1));      // mishears the number now and then
          B.cmd = MZ_DIRS.indexOf(m[1]); B.left = n; B.t = 0;
        });
        else if (v === 'chat:0') this.after(rand(L.hear[0] * 0.5, L.hear[1] * 0.7), () => { B.cmd = -1; });
      } else if (r === this.guide && (v === 'chat:2' || v === 'chat:3')) { const G = this.bot.g || (this.bot.g = { key: '', expect: null, idle: 0, busy: false }); G.expect = null; G.idle = 99; }
    }
    guideSay() {                                                      // read the next straight run of the route out loud
      const G = this.bot.g, L = MBOT[this.api.sim[this.guide]] || MBOT.normal, route = mazePath(this.puz, this.pos[0], this.pos[1], this.puz.goal[0], this.puz.goal[1]);
      if (route.length < 2 || this.result()) return;
      const dirOf = (a, b) => MZ_DIRS.indexOf(a[0] < b[0] ? 'R' : a[0] > b[0] ? 'L' : a[1] < b[1] ? 'D' : 'U'), d = dirOf(route[0], route[1]); let n = 1;
      while (n + 1 < route.length && dirOf(route[n], route[n + 1]) === d) n++;
      G.expect = route[n].join(','); G.idle = 0;
      this.say(this.guide, 'dir:' + MZ_DIRS[d] + (Math.random() < L.err ? Math.max(1, n + (Math.random() < 0.5 ? -1 : 1)) : n));
    }
    frame(dt) {
      if (!this.playing) return;
      this.tick(dt); this.crashFx = Math.max(0, this.crashFx - dt);
      const dr = this.driver, mode = this.local[dr];
      if (mode) { this.hb += dt; if (this.hb >= 1) { this.hb = 0; this.touch(dr); } }                // heartbeat: a lost message heals itself
      if (mode === 'human') {
        this.order = this.order.filter(d => this.held[d]); const d = this.order[this.order.length - 1];     // `held` may have been wiped (window blur, game over)
        if (d == null) this.block = null;
        else if (this.block !== d && (this.rep -= dt) <= 0) { this.rep = MZ_REPEAT; this.step(d); }
      } else if (mode === 'bot') {
        const L = MBOT[this.api.sim[dr]] || MBOT.normal, B = this.bot.d || (this.bot.d = { cmd: -1, left: 0, t: 0 });
        if (B.cmd >= 0 && (B.t -= dt) <= 0) {
          B.t = L.step; const r = this.step(B.cmd);
          if (r === 0) { B.cmd = -1; this.say(dr, 'chat:3'); } else if (r < 0) B.cmd = -1; else if (--B.left <= 0) B.cmd = -1;
        }
      }
      if (this.local[this.guide] === 'bot' && !this.result()) {
        const L = MBOT[this.api.sim[this.guide]] || MBOT.normal, G = this.bot.g || (this.bot.g = { key: '', expect: null, idle: 0, busy: false }), key = this.pos.join(',');
        if (key !== G.key) { G.key = key; G.idle = 0; } else G.idle += dt;
        if (!G.busy && (G.expect == null || G.expect === key || G.idle > 1.7)) { G.busy = true; this.after(rand(L.react[0], L.react[1]), () => { G.busy = false; this.guideSay(); }); }
      }
      const k = Math.min(1, dt * 14); this.disp.x += (this.pos[0] - this.disp.x) * k; this.disp.y += (this.pos[1] - this.disp.y) * k;
      this.pump(dt);
    }
    sayHTML(v) {
      const m = /^dir:([URDL])(\d+)?$/.exec(v || ''); if (!m) return super.sayHTML(v);
      const i = MZ_DIRS.indexOf(m[1]); return '<span class="say-dir">' + Ic.arrow(MZ_ARROW[i]) + ' ' + esc(this.t('coop.maze.' + MZ_NAME[i])) + (m[2] ? ' ×' + m[2] : '') + '</span>';
    }
    // ---- DOM: the guide gets the whole map, the driver (and every spectator) only a frame and the dot
    build(ui) {
      this.ui = ui; const p = this.puz, N = p.N, B0 = 8, cs = 84 / N, t = this.t, map = this.mine === this.guide, c = v => (B0 + (v + 0.5) * cs).toFixed(2);
      this.cs = cs; this.B0 = B0; let walls = 'M' + B0 + ',' + B0 + 'H92V92H' + B0 + 'Z';
      if (map) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const x1 = (B0 + (x + 1) * cs).toFixed(2), y1 = (B0 + (y + 1) * cs).toFixed(2), x0 = (B0 + x * cs).toFixed(2), y0 = (B0 + y * cs).toFixed(2);
        if (x < N - 1 && !mzOpen(p, x, y, 1)) walls += 'M' + x1 + ',' + y0 + 'V' + y1;
        if (y < N - 1 && !mzOpen(p, x, y, 2)) walls += 'M' + x0 + ',' + y1 + 'H' + x1;
      }
      const star = SYM_PTS[4].split(' ').map(q => { const [a, b] = q.split(',').map(Number); return ((a - 12) * 0.34).toFixed(2) + ',' + ((b - 12.6) * 0.34).toFixed(2); }).join(' ');
      ui.board.innerHTML = '<svg class="zz mz" viewBox="0 0 100 100"><rect class="zz-bg" x="0" y="0" width="100" height="100" rx="3"/><path class="mz-wall" d="' + walls + '"/>' +
        (map ? '<polyline class="mz-trail"/><circle class="zz-start" r="3.4" cx="' + c(p.start[0]) + '" cy="' + c(p.start[1]) + '"/><g transform="translate(' + c(p.goal[0]) + ' ' + c(p.goal[1]) + ')"><circle class="zz-goal" r="4.4"/><polygon class="zz-star" points="' + star + '"/></g>' : '') +
        '<g class="zz-dot"><circle r="3" class="zz-bomb"/><circle cx="-1" cy="-1.1" r=".8" class="zz-shine"/><path class="zz-fuse" d="M1.2,-2.7 q1.6,-2.2 3.2,-1.4"/><polygon class="zz-spark" points="4.6,-5.6 5.6,-4.2 7.2,-4.5 6.1,-3.3 6.8,-1.9 5.2,-2.6 4,-1.6 4.3,-3.2"/></g></svg>';
      this.el = { svg: ui.board.querySelector('svg'), dot: ui.board.querySelector('.zz-dot'), trail: ui.board.querySelector('.mz-trail') };
      if (this.mine === this.driver) {
        const L = [[Ic.arrow('u'), 'up'], [Ic.arrow('l'), 'left'], [Ic.arrow('d'), 'down'], [Ic.arrow('r'), 'right']], idx = { up: 0, left: 3, down: 2, right: 1 };
        ui.ctl.innerHTML = '<div class="pad4">' + L.map(([ic, k]) => '<button type="button" class="hold ' + k + '" data-d="' + idx[k] + '"><b>' + ic + '</b></button>').join('') + '</div><p class="pad-tip">' + esc(t('coop.maze.tipMove')) + '</p>';
        ui.ctl.querySelectorAll('.hold').forEach(b => {
          const d = +b.dataset.d, on = e => { e.preventDefault(); this.press(d); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) {} },
            off = () => { this.release(d); b.classList.remove('on'); };
          b.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(ev => b.addEventListener(ev, off)); b.addEventListener('contextmenu', e => e.preventDefault());
        });
      } else if (map) {
        ui.ctl.innerHTML = '<div class="say-dirs">' + MZ_DIRS.map((d, i) => '<button type="button" data-v="dir:' + d + '">' + Ic.arrow(MZ_ARROW[i]) + ' ' + esc(t('coop.maze.' + MZ_NAME[i])) + '</button>').join('') + '</div><p class="pad-tip">' + esc(t('coop.maze.tipGuide')) + '</p>';
        ui.ctl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { if (this.playing) this.say(this.guide, b.dataset.v); }));
      }
    }
    render() {
      if (!this.el) return; const e = this.el, x = this.disp.x, y = this.disp.y, key = x.toFixed(2) + '|' + y.toFixed(2) + '|' + (this.crashFx > 0 ? 1 : 0) + '|' + this.trail.length;
      if (key === this.drawn) return; this.drawn = key; const c = v => (this.B0 + (v + 0.5) * this.cs).toFixed(2);
      e.dot.setAttribute('transform', 'translate(' + c(x) + ' ' + c(y) + ')');
      if (e.trail && this.trailN !== this.trail.length) { this.trailN = this.trail.length; e.trail.setAttribute('points', this.trail.map(q => c(q[0]) + ',' + c(q[1])).join(' ')); }
      e.svg.classList.toggle('crash', this.crashFx > 0);
    }
  }

  const GAMES = {
    zigzag: { sec: 34, secs: [34, 32, 30], make: zigzagMake, Game: ZigzagGame },
    wires: { sec: 36, secs: [36, 38, 40], make: wiresMake, Game: WiresGame },
    lock: { sec: 40, secs: [40, 42, 44], make: lockMake, Game: LockGame },
    maze: { sec: 42, secs: [42, 44, 46], make: mazeMake, Game: MazeGame }
  };
  const limit = (kind, level) => { const g = GAMES[kind] || GAMES.zigzag; return g.secs[lvl(level)] || g.sec; };

  // ------------------------------------------------------------------------------------------------------------
  // SESSION: the full-screen overlay (header, burning-fuse timer, board, role card, controls, quick-say, bubbles)
  // env = { rid, kind, seed, roles:{p1,p2}, me, sim:{role:level}, isAuth, names:{p1,p2} (HTML-safe), t, avatar(color),
  //         send(color,data), listen(cb)->unsub, onEnd(ok), sound(key), buzz(pattern) }
  class Session {
    constructor(env) {
      const snd = env.sound, bz = env.buzz;                           // a sound / vibration error must never stop the minigame loop (then nobody could ever tap)
      env = Object.assign({}, env, { sound: k => { try { snd && snd(k); } catch (e) {} }, buzz: p => { try { bz && bz(p); } catch (e) {} } });
      this.env = env; this.t = env.t; this.state = 'intro'; this.introLeft = 3.1; this.elapsed = 0; this.finished = false; this.closed = false; this.rid = env.rid; this.lastPen = 0;
      const meta = GAMES[env.kind] || GAMES.zigzag; this.meta = meta; this.level = lvl(env.level); this.sec = limit(env.kind, this.level);
      const mine = env.me && env.me === env.roles.p1 ? 'p1' : (env.me && env.me === env.roles.p2 ? 'p2' : null); this.mine = mine;
      const api = { puz: meta.make(env.seed, this.level), roles: env.roles, mine, sim: env.sim || {}, isAuth: !!env.isAuth, names: env.names, t: env.t,
        send: (r, d) => env.send(env.roles[r], d), bubble: (r, html, own) => this.bubble(r, html, own), event: k => this.event(k),
        sbKey: mine ? null : (env.sbKey || null), sendSabo: d => { if (env.sbKey) env.send(env.sbKey, d); }, note: (key, k, a) => this.sboNote(key, k, a) };
      this.game = new meta.Game(api);
      this.build();
      this.unsub = env.listen(snap => {
        snap = snap || {}; ['p1', 'p2'].forEach(r => { if (!this.game.isLocal(r)) this.game.onData(r, snap[env.roles[r]]); });
        Object.keys(snap).forEach(k => { if (k !== env.roles.p1 && k !== env.roles.p2) this.game.onSabo(k, snap[k]); });          // every other node = a viewer's sabotage log
      });
      this.keys = e => this.onKey(e, e.type === 'keydown'); document.addEventListener('keydown', this.keys); document.addEventListener('keyup', this.keys);
      this.blur = () => { this.game.held = {}; }; window.addEventListener('blur', this.blur);
      this.last = performance.now(); this.raf = requestAnimationFrame(n => this.loop(n));
    }
    q(sel) { return this.root.querySelector(sel); }
    build() {
      const env = this.env, t = this.t, root = document.getElementById('coop'), c1 = env.roles.p1, c2 = env.roles.p2, kind = env.kind; this.root = root;
      root.innerHTML = '<div class="coop-card" data-kind="' + kind + '"><div class="coop-head"><div class="coop-who"><span class="coop-av" style="--sc:var(--' + c1 + ')">' + env.avatar(c1) + '</span><b>' + env.names.p1 + '</b><span class="coop-amp">&amp;</span>' +
        '<span class="coop-av" style="--sc:var(--' + c2 + ')">' + env.avatar(c2) + '</span><b>' + env.names.p2 + '</b></div><div class="coop-name">' + Ic.svg('bomb') + Ic.flames(this.level) + ' ' + esc(t('coop.title')) + ' · ' + esc(t('coop.games.' + kind + '.n')) + '</div></div>' +
        '<div class="coop-fuse"><i></i><em></em></div><div class="coop-main"><div class="coop-board"></div><div class="coop-side"><div class="coop-role"></div><div class="coop-ctl"></div><div class="coop-chat"></div></div><div class="coop-bubbles"></div></div>' +
        '<div class="coop-over"><div class="coop-over-in"></div></div></div>';
      root.classList.add('open');
      this.ui = { root, board: this.q('.coop-board'), ctl: this.q('.coop-ctl'), side: this.q('.coop-side') };
      this.fuse = this.q('.coop-fuse'); this.fuseBar = this.fuse.firstChild; this.fuseTxt = this.fuse.lastChild; this.fuseKey = ''; this.hot = false;
      document.body.classList.add('coop-on');                          // freezes the table's animations behind the overlay (big win on phones)
      const role = this.q('.coop-role'); role.innerHTML = this.mine ? '<span class="rl-dot" style="--sc:var(--' + env.roles[this.mine] + ')"></span>' + this.game.roleText() : Ic.svg('eye') + ' ' + esc(t('coop.watching')) + '<br><small>' + this.game.roleText() + '</small>';
      this.game.build(this.ui);
      if (this.mine) {
        const chat = this.q('.coop-chat'); chat.innerHTML = '<small>' + esc(t('coop.chatTitle')) + '</small><div>' + A(t('coop.chat')).map((s, i) => '<button type="button" data-i="' + i + '">' + Ic.svg(CHAT_ICONS[i]) + esc(s) + '</button>').join('') + '</div>';
        chat.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { if (this.state === 'play') this.game.say(this.mine, 'chat:' + b.dataset.i); }));
      }
      this.showOver('<div class="co-game">' + esc(t('coop.games.' + kind + '.n')) + '</div><p>' + esc(t('coop.games.' + kind + '.d')) + '</p><div class="co-count">3</div>', 'intro');
    }
    showOver(html, cls) { const o = this.q('.coop-over'); if (!o) return; o.className = 'coop-over show ' + (cls || ''); this.q('.coop-over-in').innerHTML = html; }
    hideOver() { const o = this.q('.coop-over'); if (o) o.className = 'coop-over'; }
    bubble(role, html, own) {
      const box = this.q('.coop-bubbles'); if (!box || !html) return;
      const el = document.createElement('div'); el.className = 'bub' + (own ? ' own' : ''); el.style.setProperty('--bc', 'var(--' + this.env.roles[role] + ')');
      el.innerHTML = '<b>' + this.env.names[role] + '</b>' + html; box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
      setTimeout(() => { if (el.parentNode) el.remove(); }, 3600); if (!own) this.env.sound('sayPing');
    }
    event(k) {
      const e = this.env;
      if (k === 'crash') { e.sound('bonk'); e.buzz(35); } else if (k === 'zap') { e.sound('zap'); e.buzz([30, 30, 60]); this.pulse(); } else if (k === 'snip') e.sound('snip'); else if (k === 'sabo') { e.sound('zap'); e.buzz(25); }
    }
    sboNote(key, k, a) {                                              // banner on the board: who did what to the track
      const box = this.q('.coop-bubbles'); if (!box) return; const t = this.t, who = this.env.nameOf ? this.env.nameOf(key) : '', nm = who || t('coop.sb.anon');
      const ico = Ic.svg(k === 'rot' ? (a < 0 ? 'rotL' : 'rotR') : k), txt = ico + ' ' + (k === 'rot' ? t(a < 0 ? 'coop.sb.didL' : 'coop.sb.didR', nm) : t(k === 'gum' ? 'coop.sb.didGum' : 'coop.sb.didInk', nm));
      const el = document.createElement('div'); el.className = 'bub sb-note'; el.style.setProperty('--bc', 'var(--danger)'); el.innerHTML = txt; box.appendChild(el);
      while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => { if (el.parentNode) el.remove(); }, 2600);
    }
    penaltyFx(d) {                                                    // "-0.8s" pops up on the fuse and the bar flashes: the time cost of a mistake is now visible
      const f = this.fuse; if (!f) return; const el = document.createElement('span'); el.className = 'pen-pop'; el.textContent = '−' + (Math.round(d * 10) / 10) + 's'; f.appendChild(el);
      setTimeout(() => { if (el.parentNode) el.remove(); }, 1200); f.classList.remove('pen'); void f.offsetWidth; f.classList.add('pen'); setTimeout(() => f.classList.remove('pen'), 450);
    }
    pulse() { const c = this.q('.coop-card'); if (!c) return; c.classList.remove('zapfx'); void c.offsetWidth; c.classList.add('zapfx'); }
    onKey(e, down) {
      if (this.state !== 'play' && !(down === false)) return;
      if (this.game.key(e.code, down)) e.preventDefault();
    }
    left() { return this.sec - this.elapsed - this.game.penalty(); }
    loop(now) {
      if (this.closed) return;
      try { this.step(now); } catch (e) { try { console.error('coop loop', e); } catch (x) {} }
      if (!this.closed) this.raf = requestAnimationFrame(n => this.loop(n));
    }
    step(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      if (this.state === 'intro') {
        this.introLeft -= dt; const n = Math.max(1, Math.ceil(this.introLeft - 0.1)), c = this.q('.co-count');
        if (c && c.textContent !== String(n)) { c.textContent = String(n); this.env.sound('timerTick'); }
        if (this.introLeft <= 0) { this.state = 'play'; this.hideOver(); this.game.start(); this.env.sound('rescueGo'); }
      } else if (this.state === 'play') {
        this.elapsed += dt; this.game.frame(dt);
        const pen = this.game.penalty(); if (pen > this.lastPen + 1e-6) this.penaltyFx(pen - this.lastPen); this.lastPen = pen;
        const left = this.left(), frac = clamp(left / this.sec, 0, 1).toFixed(3), secs = Math.max(0, Math.ceil(left));
        if (frac !== this.fuseKey) { this.fuseKey = frac; this.fuseBar.style.transform = 'scaleX(' + frac + ')'; }
        if (secs !== this.secShown) { this.secShown = secs; this.fuseTxt.textContent = secs + 's'; }
        if ((left < 8) !== this.hot) { this.hot = left < 8; this.fuse.classList.toggle('hot', this.hot); }
        if (left < 8 && Math.ceil(left) !== this._tk) { this._tk = Math.ceil(left); if (left > 0) this.env.sound('timerTick'); }
        if (this.env.isAuth && !this.finished) { const r = this.game.result(); if (r) this.finish(r > 0); else if (left <= 0) this.finish(false); }
      }
      this.game.render(dt);
    }
    finish(ok) {
      this.finished = true; this.state = 'done'; this.game.playing = false; this.game.held = {};
      this.showOver('<div class="co-big ' + (ok ? 'good' : 'bad') + '">' + esc(this.t(ok ? 'coop.win' : (this.left() <= 0 ? 'coop.timeUp' : 'coop.lose'))) + '</div>', 'result');
      this.env.sound(ok ? 'rescueWin' : 'rescueFail'); this.env.buzz(ok ? [40, 30, 40] : [120, 50, 200]);
      setTimeout(() => { if (!this.closed) this.env.onEnd(ok); }, 650);
    }
    destroy() {
      this.closed = true; cancelAnimationFrame(this.raf); try { this.unsub && this.unsub(); } catch (e) {}
      document.removeEventListener('keydown', this.keys); document.removeEventListener('keyup', this.keys); window.removeEventListener('blur', this.blur);
      document.body.classList.remove('coop-on'); try { this.game.destroy(); } catch (e) {} if (this.root) { this.root.classList.remove('open'); this.root.innerHTML = ''; }
    }
  }

  let current = null;
  function open(env) { if (current && current.rid === env.rid) return; close(); current = new Session(env); }
  function close() { if (current) { current.destroy(); current = null; } }
  const active = () => current ? current.rid : null;

  return { GAMES, limit, open, close, active, puzzles: { zigzagMake, wiresMake, lockMake, mazeMake, mazePath, wiresEval, zzSeg, rng }, SYM_COL, symSVG };
})();
if (typeof module !== 'undefined') module.exports = Coop;
