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
  function zigzagMake(seed) {
    const R = rng(seed), W = 5.4, nH = 4;
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
    return { kind: 'zigzag', seed, W, pts, segs, start: pts[0], goal: pts[pts.length - 1], axisOf: swap ? { p1: 'h', p2: 'v' } : { p1: 'v', p2: 'h' } };
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

  // --- Cắt Dây: p1 sees six wires, p2 holds the manual (an ordered list of 4 clues). Cut in order; 3 wrong cuts = boom.
  function wiresMake(seed) {
    const R = rng(seed), colors = shuffled(R, [0, 1, 2, 3, 4, 5]), shapes = shuffled(R, [0, 1, 2, 3, 4, 5]);
    const wires = colors.map((c, i) => ({ color: c, shape: shapes[i] }));
    const kinds = ['color', 'shape', 'pos'];
    const steps = shuffled(R, [0, 1, 2, 3, 4, 5]).slice(0, 4).map(wi => ({ w: wi, by: kinds[Math.floor(R() * 3)] }));
    if (steps.every(s => s.by === steps[0].by)) steps[1].by = kinds[(kinds.indexOf(steps[0].by) + 1) % 3];
    return { kind: 'wires', seed, wires, steps, maxStrikes: 3 };
  }
  // `cuts` is the log of cut ATTEMPTS. A wrong attempt is a strike and the wire splices itself back together.
  function wiresEval(p, cuts) {
    let done = 0, strikes = 0;
    A(cuts).forEach(w => { if (done < p.steps.length && +w === p.steps[done].w) done++; else strikes++; });
    return { done, strikes, success: done >= p.steps.length, boom: strikes >= p.maxStrikes };
  }

  // --- Khóa Hai Chìa: each player sets a 3-symbol lock, but the code for MY lock is on MY TEAMMATE's screen.
  function lockMake(seed) {
    const R = rng(seed), code = () => [0, 1, 2].map(() => Math.floor(R() * 6));
    const t1 = code(), t2 = code();
    const init = t => t.map(v => (v + 1 + Math.floor(R() * 5)) % 6);     // every slot starts wrong
    return { kind: 'lock', seed, target: { p1: t1, p2: t2 }, init: { p1: init(t1), p2: init(t2) } };
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
    sayHTML(v) { const m = /^chat:(\d)$/.exec(v || ''); return m ? esc(A(this.t('coop.chat'))[+m[1]] || '') : ''; }
    heard() {} apply() {} frame() {} result() { return 0; } penalty() { return 0; } build() {} render() {} key() { return false; } destroy() {}
    roleText() { return ''; }
  }

  // ---------------------------------------------------------------- Lái Chung
  const ZZ_SPEED = 25, ZZ_PEN = 0.8;
  const ZBOT = { easy: { react: [0.7, 1.3], slow: 0.74, err: 0.16 }, normal: { react: [0.4, 0.8], slow: 0.9, err: 0.07 }, hard: { react: [0.2, 0.4], slow: 1, err: 0.02 } };
  class ZigzagGame extends Base {
    constructor(api) {
      super(api);
      const p = this.puz; this.axis = p.axisOf;
      this.pos = { x: p.start[0], y: p.start[1] }; this.tgt = { x: p.start[0], y: p.start[1] };
      this.held = {}; this.maxIdx = 0; this.cool = 0; this.outT = 0; this.bumps = { p1: 0, p2: 0 }; this.bot = {}; this.dt = 0; this.crashFx = 0;
      this.sentV = {}; this.sendT = { p1: 0, p2: 0 }; this.rv = { p1: 0, p2: 0 }; this.rAge = { p1: 9, p2: 9 }; this.drawn = '';
      this.locals().forEach(r => { this.out[r] = { p: this.pos[p.axisOf[r] === 'h' ? 'x' : 'y'], v: 0, b: 0 }; });
    }
    ax(r) { return this.axis[r] === 'h' ? 'x' : 'y'; }
    roleText() { return this.mine ? this.t(this.axis[this.mine] === 'v' ? 'coop.zz.roleV' : 'coop.zz.roleH') : this.t('coop.zz.watch'); }
    apply(r, d) {                                                     // d.v = signed speed factor: the remote dot keeps gliding between updates
      this.bumps[r] = +d.b || 0; if (d.p == null || !isFinite(+d.p)) return;
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
      const p = this.puz; this.dt = dt; this.tick(dt); this.cool = Math.max(0, this.cool - dt);
      this.locals().forEach(r => {
        let dir = 0, mul = 1;
        if (this.local[r] === 'human') dir = (this.held.pos ? 1 : 0) - (this.held.neg ? 1 : 0);
        else { dir = this.botDir(r); mul = (ZBOT[this.api.sim[r]] || ZBOT.normal).slow; }
        const k = this.ax(r), v = dir * mul, o = this.out[r];
        if (dir) this.pos[k] = clamp(this.pos[k] + v * ZZ_SPEED * dt, 3, 97);
        if (v !== (this.sentV[r] || 0)) { this.sentV[r] = v; o.v = Math.round(v * 100) / 100; o.p = round1(this.pos[k]); this.sendT[r] = 0; this.flush(r); }   // start / stop / turn: tell everyone at once
        else if (v && (this.sendT[r] += dt) >= 0.3) { this.sendT[r] = 0; o.p = round1(this.pos[k]); this.flush(r); }                                           // while moving: just a slow correction
      });
      ['p1', 'p2'].forEach(r => {
        if (this.local[r]) return; const k = this.ax(r); this.rAge[r] += dt;
        if (this.rv[r] && this.rAge[r] < 0.7) this.tgt[k] = clamp(this.tgt[k] + this.rv[r] * ZZ_SPEED * dt, 3, 97);         // dead reckoning
        this.pos[k] += (this.tgt[k] - this.pos[k]) * Math.min(1, dt * 12);
      });
      const si = zzSeg(p, this.pos.x, this.pos.y);
      if (si >= 0) { this.outT = 0; if (si > this.maxIdx) this.maxIdx = si; }
      else if (this.cool <= 0) { this.outT += dt; if (this.outT > 0.06) this.crash(); }
      this.pump(dt); this.crashFx = Math.max(0, this.crashFx - dt);
    }
    crash() {                                                         // each owner pulls ITS axis back to the last corner
      const cp = this.puz.segs[this.maxIdx].a; this.cool = 0.5; this.outT = 0; this.crashFx = 0.45;
      this.locals().forEach(r => { const k = this.ax(r); this.pos[k] = cp[k === 'x' ? 0 : 1]; this.out[r].p = round1(this.pos[k]); this.out[r].v = 0; this.sentV[r] = 0; this.out[r].b++; this.bumps[r] = this.out[r].b; this.flush(r); });
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
        '<line class="zz-gx" style="stroke:' + col(who('h')) + '"/><line class="zz-gy" style="stroke:' + col(who('v')) + '"/>' +
        '<circle class="zz-tx" r="2.1" style="fill:' + col(who('h')) + '"/><circle class="zz-ty" r="2.1" style="fill:' + col(who('v')) + '"/>' +
        '<g class="zz-dot"><circle r="3" class="zz-bomb"/><circle cx="-1" cy="-1.1" r=".8" class="zz-shine"/><path class="zz-fuse" d="M1.2,-2.7 q1.6,-2.2 3.2,-1.4"/><polygon class="zz-spark" points="4.6,-5.6 5.6,-4.2 7.2,-4.5 6.1,-3.3 6.8,-1.9 5.2,-2.6 4,-1.6 4.3,-3.2"/></g></svg>';
      this.el = { svg: ui.board.querySelector('svg'), dot: ui.board.querySelector('.zz-dot'), gx: ui.board.querySelector('.zz-gx'), gy: ui.board.querySelector('.zz-gy'), tx: ui.board.querySelector('.zz-tx'), ty: ui.board.querySelector('.zz-ty') };
      if (!this.mine) return;
      const v = this.axis[this.mine] === 'v', t = this.t, L = v ? ['▲', t('coop.zz.up'), '▼', t('coop.zz.down')] : ['◀', t('coop.zz.left'), '▶', t('coop.zz.right')];
      ui.ctl.innerHTML = '<div class="pad ' + (v ? 'v' : 'h') + '"><button type="button" class="hold" data-d="neg"><b>' + L[0] + '</b><small>' + L[1] + '</small></button><button type="button" class="hold" data-d="pos"><b>' + L[2] + '</b><small>' + L[3] + '</small></button></div><p class="pad-tip">' + t('coop.zz.tip') + '</p>';
      ui.ctl.querySelectorAll('.hold').forEach(b => {
        const d = b.dataset.d, on = e => { e.preventDefault(); if (this.playing) this.held[d] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) {} },
          off = () => { this.held[d] = false; b.classList.remove('on'); };
        b.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(ev => b.addEventListener(ev, off)); b.addEventListener('contextmenu', e => e.preventDefault());
      });
    }
    render() {
      if (!this.el) return; const e = this.el, x = this.pos.x, y = this.pos.y, key = x.toFixed(1) + '|' + y.toFixed(1) + '|' + (this.crashFx > 0 ? 1 : 0);
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
        const tell = () => this.say('p2', 'step:' + (Math.random() < L.err ? Math.floor(Math.random() * 4) : this.state().done));    // now and then it misreads…
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
      const manualHTML = () => '<div class="manual"><h4>📖 ' + esc(t('coop.wires.manual')) + '</h4><ol>' + this.puz.steps.map((s, k) =>
        '<li data-k="' + k + '"><em>' + esc(t('coop.wires.step', k + 1)) + '</em><span class="clue">' + this.clueHTML(s) + '</span>' + (this.mine === 'p2' ? '<button type="button" class="tell" data-k="' + k + '" title="' + esc(t('coop.wires.tell')) + '">📣</button>' : '') + '</li>').join('') +
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
      const bolts = Array.from({ length: this.puz.maxStrikes }, (_, i) => '<span class="' + (i < s.strikes ? 'hit' : '') + '">⚡</span>').join('');
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
    apply(r, d) { const s = A(d.set).map(Number); if (s.length === 3) { this.set[r] = s; this.refresh(); } }
    turn(r, j) { if (!this.playing || !this.local[r] || this.result()) return; this.set[r][j] = (this.set[r][j] + 1) % 6; this.out[r].set = this.set[r].slice(); this.flush(r); this.api.event('snip'); this.refresh(); }
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
        b.wait -= dt; if (b.wait <= 0) { b.wait = rand(L.d[0] + 1, L.d[1] + 1.8); const j = b.j; b.j = (b.j + 1) % 3; const k = Math.random() < L.err ? (j + 1) % 3 : j; this.say(r, 'sym:' + k + ':' + this.puz.target[this.other(r)][k]); }
      });
    }
    build(ui) {
      this.ui = ui; const t = this.t, name = r => this.api.names[r];
      const row = (r, kind) => {                                      // kind 'code' = the symbols I read out, 'dial' = the lock I set
        const tg = kind === 'code' ? this.puz.target[this.other(r)] : this.set[r];
        return '<div class="lk-row ' + kind + '" data-r="' + r + '"><h4>' + esc(kind === 'code' ? t('coop.lock.code', name(this.other(r))) : t('coop.lock.dial', name(r))) + '</h4><p>' + esc(t(kind === 'code' ? 'coop.lock.codeHint' : 'coop.lock.dialHint')) + '</p><div class="slots">' +
          [0, 1, 2].map(j => '<button type="button" class="slot" data-r="' + r + '" data-j="' + j + '" data-k="' + kind + '">' + symSVG(tg[j]) + '</button>').join('') + '</div></div>';
      };
      if (this.mine) ui.board.innerHTML = '<div class="lock">' + row(this.mine, 'code') + row(this.mine, 'dial') + '</div>';
      else ui.board.innerHTML = '<div class="lock spec">' + row('p1', 'dial') + row('p2', 'dial') + '</div>';
      ui.board.querySelectorAll('.slot').forEach(b => b.addEventListener('pointerdown', e => {
        e.preventDefault(); const r = b.dataset.r, j = +b.dataset.j; if (r !== this.mine) return;
        if (b.dataset.k === 'code') { this.tellSlot(r, j); b.classList.add('told'); setTimeout(() => b.classList.remove('told'), 500); } else this.turn(r, j);
      }));
    }
    refresh() {
      if (!this.ui) return;
      this.ui.board.querySelectorAll('.slot[data-k="dial"]').forEach(b => { b.innerHTML = symSVG(this.set[b.dataset.r][+b.dataset.j]); });
    }
  }

  const GAMES = {
    zigzag: { sec: 34, make: zigzagMake, Game: ZigzagGame },
    wires: { sec: 36, make: wiresMake, Game: WiresGame },
    lock: { sec: 40, make: lockMake, Game: LockGame }
  };
  const limit = kind => (GAMES[kind] || GAMES.zigzag).sec;

  // ------------------------------------------------------------------------------------------------------------
  // SESSION: the full-screen overlay (header, burning-fuse timer, board, role card, controls, quick-say, bubbles)
  // env = { rid, kind, seed, roles:{p1,p2}, me, sim:{role:level}, isAuth, names:{p1,p2} (HTML-safe), t, avatar(color),
  //         send(color,data), listen(cb)->unsub, onEnd(ok), sound(key), buzz(pattern) }
  const CHAT_ICONS = ['✋', '👉', '⏳', '😱'];
  class Session {
    constructor(env) {
      this.env = env; this.t = env.t; this.state = 'intro'; this.introLeft = 3.1; this.elapsed = 0; this.finished = false; this.closed = false; this.rid = env.rid;
      const meta = GAMES[env.kind] || GAMES.zigzag; this.meta = meta;
      const mine = env.me && env.me === env.roles.p1 ? 'p1' : (env.me && env.me === env.roles.p2 ? 'p2' : null); this.mine = mine;
      const api = { puz: meta.make(env.seed), roles: env.roles, mine, sim: env.sim || {}, isAuth: !!env.isAuth, names: env.names, t: env.t,
        send: (r, d) => env.send(env.roles[r], d), bubble: (r, html, own) => this.bubble(r, html, own), event: k => this.event(k) };
      this.game = new meta.Game(api);
      this.build();
      this.unsub = env.listen(snap => { snap = snap || {}; ['p1', 'p2'].forEach(r => { if (!this.game.isLocal(r)) this.game.onData(r, snap[env.roles[r]]); }); });
      this.keys = e => this.onKey(e, e.type === 'keydown'); document.addEventListener('keydown', this.keys); document.addEventListener('keyup', this.keys);
      this.blur = () => { this.game.held = {}; }; window.addEventListener('blur', this.blur);
      this.last = performance.now(); this.raf = requestAnimationFrame(n => this.loop(n));
    }
    q(sel) { return this.root.querySelector(sel); }
    build() {
      const env = this.env, t = this.t, root = document.getElementById('coop'), c1 = env.roles.p1, c2 = env.roles.p2, kind = env.kind; this.root = root;
      root.innerHTML = '<div class="coop-card" data-kind="' + kind + '"><div class="coop-head"><div class="coop-who"><span class="coop-av" style="--sc:var(--' + c1 + ')">' + env.avatar(c1) + '</span><b>' + env.names.p1 + '</b><span class="coop-amp">&amp;</span>' +
        '<span class="coop-av" style="--sc:var(--' + c2 + ')">' + env.avatar(c2) + '</span><b>' + env.names.p2 + '</b></div><div class="coop-name">💣 ' + esc(t('coop.title')) + ' · ' + esc(t('coop.games.' + kind + '.n')) + '</div></div>' +
        '<div class="coop-fuse"><i></i><em></em></div><div class="coop-main"><div class="coop-board"></div><div class="coop-side"><div class="coop-role"></div><div class="coop-ctl"></div><div class="coop-chat"></div></div><div class="coop-bubbles"></div></div>' +
        '<div class="coop-over"><div class="coop-over-in"></div></div></div>';
      root.classList.add('open');
      this.ui = { root, board: this.q('.coop-board'), ctl: this.q('.coop-ctl'), side: this.q('.coop-side') };
      this.fuse = this.q('.coop-fuse'); this.fuseBar = this.fuse.firstChild; this.fuseTxt = this.fuse.lastChild; this.fuseKey = ''; this.hot = false;
      document.body.classList.add('coop-on');                          // freezes the table's animations behind the overlay (big win on phones)
      const role = this.q('.coop-role'); role.innerHTML = this.mine ? '<span class="rl-dot" style="--sc:var(--' + env.roles[this.mine] + ')"></span>' + this.game.roleText() : '👀 ' + esc(t('coop.watching')) + '<br><small>' + this.game.roleText() + '</small>';
      this.game.build(this.ui);
      if (this.mine) {
        const chat = this.q('.coop-chat'); chat.innerHTML = '<small>' + esc(t('coop.chatTitle')) + '</small><div>' + A(t('coop.chat')).map((s, i) => '<button type="button" data-i="' + i + '">' + esc(s) + '</button>').join('') + '</div>';
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
      if (k === 'crash') { e.sound('bonk'); e.buzz(35); } else if (k === 'zap') { e.sound('zap'); e.buzz([30, 30, 60]); this.pulse(); } else if (k === 'snip') e.sound('snip');
    }
    pulse() { const c = this.q('.coop-card'); if (!c) return; c.classList.remove('zapfx'); void c.offsetWidth; c.classList.add('zapfx'); }
    onKey(e, down) {
      if (this.state !== 'play' && !(down === false)) return;
      if (this.game.key(e.code, down)) e.preventDefault();
    }
    left() { return this.meta.sec - this.elapsed - this.game.penalty(); }
    loop(now) {
      if (this.closed) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      if (this.state === 'intro') {
        this.introLeft -= dt; const n = Math.max(1, Math.ceil(this.introLeft - 0.1)), c = this.q('.co-count');
        if (c && c.textContent !== String(n)) { c.textContent = String(n); this.env.sound('timerTick'); }
        if (this.introLeft <= 0) { this.state = 'play'; this.hideOver(); this.game.start(); this.env.sound('rescueGo'); }
      } else if (this.state === 'play') {
        this.elapsed += dt; this.game.frame(dt);
        const left = this.left(), frac = clamp(left / this.meta.sec, 0, 1).toFixed(3), secs = Math.max(0, Math.ceil(left));
        if (frac !== this.fuseKey) { this.fuseKey = frac; this.fuseBar.style.transform = 'scaleX(' + frac + ')'; }
        if (secs !== this.secShown) { this.secShown = secs; this.fuseTxt.textContent = secs + 's'; }
        if ((left < 8) !== this.hot) { this.hot = left < 8; this.fuse.classList.toggle('hot', this.hot); }
        if (left < 8 && Math.ceil(left) !== this._tk) { this._tk = Math.ceil(left); if (left > 0) this.env.sound('timerTick'); }
        if (this.env.isAuth && !this.finished) { const r = this.game.result(); if (r) this.finish(r > 0); else if (left <= 0) this.finish(false); }
      }
      this.game.render(dt);
      this.raf = requestAnimationFrame(n => this.loop(n));
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

  return { GAMES, limit, open, close, active, puzzles: { zigzagMake, wiresMake, lockMake, wiresEval, zzSeg, rng }, SYM_COL, symSVG };
})();
if (typeof module !== 'undefined') module.exports = Coop;
