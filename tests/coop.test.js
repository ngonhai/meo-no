// node tests/coop.test.js — the 2v2 minigames, headless: puzzle validity + bots solving them, including the "split"
// case where the two roles are simulated by two different clients that only see each other through a laggy channel.
const assert = require('assert');
const Coop = require('../js/meow-coop.js');
const { zigzagMake, wiresMake, lockMake, wiresEval, zzSeg } = Coop.puzzles;
const KINDS = ['zigzag', 'wires', 'lock'];

// ---------------------------------------------------------------- puzzles
for (let seed = 1; seed <= 400; seed++) {
  const z = zigzagMake(seed);
  assert.strictEqual(z.segs.length, 7); assert(z.segs.every((s, i) => s.axis === (i % 2 ? 'v' : 'h')), 'legs alternate H,V,H,…');
  z.pts.forEach(([x, y]) => { assert(x >= 10 && x <= 90 && y >= 14 && y <= 86, 'corridor stays on the board ' + [x, y]); });
  z.segs.forEach(s => { if (s.axis === 'v') assert(Math.abs(s.a[1] - s.b[1]) >= 26, 'vertical legs are long enough to matter'); else assert(s.b[0] > s.a[0] + 8, 'horizontal legs go right'); });
  assert(zzSeg(z, z.start[0], z.start[1]) === 0 && zzSeg(z, z.goal[0], z.goal[1]) === 6 && zzSeg(z, 50, -50) === -1);
  assert.deepStrictEqual([z.axisOf.p1, z.axisOf.p2].sort(), ['h', 'v'], 'one player per axis');
  const w = wiresMake(seed);
  assert.strictEqual(new Set(w.wires.map(x => x.color)).size, 6); assert.strictEqual(new Set(w.wires.map(x => x.shape)).size, 6);
  assert.strictEqual(new Set(w.steps.map(s => s.w)).size, 4, 'four different wires'); assert(new Set(w.steps.map(s => s.by)).size >= 2, 'mixed clue types');
  const solve = w.steps.map(s => s.w); assert(wiresEval(w, solve).success && wiresEval(w, solve).strikes === 0);
  const l = lockMake(seed);
  ['p1', 'p2'].forEach(r => l.init[r].forEach((v, i) => assert.notStrictEqual(v, l.target[r][i], 'every slot starts wrong')));
}
{ const w = wiresMake(7), s = w.steps, bad = [0, 1, 2, 3, 4, 5].find(x => x !== s[0].w);
  assert.deepStrictEqual(wiresEval(w, [bad]), { done: 0, strikes: 1, success: false, boom: false }, 'wrong cut = strike, no progress');
  assert.strictEqual(wiresEval(w, [bad, bad, bad]).boom, true, 'three strikes = boom');
  assert.strictEqual(wiresEval(w, [bad, s[0].w, s[1].w, s[2].w, s[3].w]).success, true, 'a strike does not make the puzzle unsolvable');
  assert.strictEqual(wiresEval(w, { 0: s[0].w, 1: s[1].w }).done, 2, 'works on Firebase-style objects'); }
assert.strictEqual(Coop.limit('zigzag'), 34);

// ---------------------------------------------------------------- harness
const noop = () => {};
const T = k => k;
function mk(kind, seed, over, bus, who) {
  const puz = Coop.GAMES[kind].make(seed);
  const api = Object.assign({ puz, roles: { p1: 'coral', p2: 'sky' }, mine: null, sim: {}, isAuth: false, names: { p1: 'A', p2: 'B' }, t: T, bubble: noop, event: noop,
    send: (r, d) => bus && bus.push({ from: who, role: r, data: JSON.parse(JSON.stringify(d)), at: bus.now }) }, over);
  return new Coop.GAMES[kind].Game(api);
}
// run until `auth` reports a result (1 / -1) or time is up. games = [{g, auth?}], lat = one-way latency in seconds
function run(kind, games, bus, lat, maxSec) {
  const dt = 1 / 60, sec = Coop.GAMES[kind].sec; let t = 0;
  games.forEach(x => x.g.start());
  while (t < maxSec) {
    t += dt; bus.now = t;
    games.forEach(x => x.g.frame(dt));
    for (let i = bus.length - 1; i >= 0; i--) {                                    // deliver messages that have "travelled" long enough
      const m = bus[i]; if (t - m.at >= lat) { bus.splice(i, 1); games.forEach(x => { if (x.id !== m.from) x.g.onData(m.role, m.data); }); }
    }
    const a = games.find(x => x.auth); const r = a.g.result(); if (r) return { ok: r > 0, t: t + a.g.penalty() };
    if (t + a.g.penalty() >= sec) return { ok: false, t: sec };
  }
  return { ok: false, t };
}
const mkBus = () => { const b = []; b.now = 0; return b; };

// ---------------------------------------------------------------- bots solve everything (one client simulates both roles)
const stat = {};
KINDS.forEach(kind => ['easy', 'normal', 'hard'].forEach(lv => {
  let win = 0, N = 60, tsum = 0;
  for (let seed = 1; seed <= N; seed++) {
    const bus = mkBus(), g = mk(kind, seed * 7919, { sim: { p1: lv, p2: lv }, isAuth: true }, bus, 'D');
    const r = run(kind, [{ id: 'D', g, auth: true }], bus, 0, 90); if (r.ok) { win++; tsum += r.t; }
  }
  stat[kind + '/' + lv] = { win: win + '/' + N, avg: (tsum / Math.max(1, win)).toFixed(1) + 's' };
  assert(win / N >= (lv === 'easy' ? 0.55 : 0.8), kind + ' ' + lv + ' bots should usually save the boat: ' + win + '/' + N);
}));
console.table(stat);

// ---------------------------------------------------------------- split ownership + network lag (two clients, one role each)
KINDS.forEach(kind => [0.05, 0.2].forEach(lat => {
  let win = 0, N = 40;
  for (let seed = 1; seed <= N; seed++) {
    const bus = mkBus(), g1 = mk(kind, seed * 104729, { mine: null, sim: { p1: 'normal' }, isAuth: true }, bus, 'A'), g2 = mk(kind, seed * 104729, { mine: null, sim: { p2: 'normal' } }, bus, 'B');
    if (run(kind, [{ id: 'A', g: g1, auth: true }, { id: 'B', g: g2 }], bus, lat, 90).ok) win++;
  }
  console.log(kind.padEnd(7) + ' split clients, ' + (lat * 1000) + 'ms lag: ' + win + '/' + N);
  assert(win / N >= 0.7, kind + ' must stay winnable with ' + lat + 's of lag: ' + win + '/' + N);
}));

// ---------------------------------------------------------------- game-specific behaviour
{ // zigzag: moving the wrong axis into a wall throws the dot back to the last corner and costs time
  const g = mk('zigzag', 5, { mine: 'p1', isAuth: true }, null, 'X'); g.start();
  const axis = g.axis.p1; g.held.pos = true; let crashed = false;
  for (let i = 0; i < 600 && !crashed; i++) { g.frame(1 / 60); if (g.out.p1.b > 0) crashed = true; }
  assert(crashed || g.pos[axis === 'h' ? 'x' : 'y'] > 0, 'holding one direction forever must hit a wall or the end');
  if (crashed) { assert(g.penalty() > 0); const cp = g.puz.segs[g.maxIdx].a; assert.strictEqual(g.pos[axis === 'h' ? 'x' : 'y'], cp[axis === 'h' ? 0 : 1], 'thrown back to the corner'); }
}
{ // zigzag: a human cannot win alone (the other axis never moves)
  const g = mk('zigzag', 11, { mine: 'p1', isAuth: true }, null, 'X'); g.start(); g.held.pos = true; g.held.neg = false;
  for (let i = 0; i < 60 * 40; i++) g.frame(1 / 60); assert.strictEqual(g.result(), 0);
}
{ // wires: only the holder (p1) can cut; strikes cost time; the log drives everything
  const g = mk('wires', 3, { mine: 'p1', isAuth: true }, null, 'X'); g.start();
  const wrong = [0, 1, 2, 3, 4, 5].find(w => w !== g.puz.steps[0].w);
  g.cut(wrong); assert.strictEqual(g.state().strikes, 1); assert.strictEqual(g.penalty(), 4);
  g.puz.steps.forEach(s => g.cut(s.w)); assert.strictEqual(g.result(), 1);
  const m = mk('wires', 3, { mine: 'p2' }, null, 'Y'); m.start(); m.cut(0); assert.strictEqual(m.cuts.length, 0, 'the manual holder has no scissors');
  const b = mk('wires', 3, { mine: 'p1', isAuth: true }, null, 'X'); b.start(); [wrong, wrong, wrong].forEach(w => b.cut(w)); assert.strictEqual(b.result(), -1);
  b.cut(b.puz.steps[0].w); assert.strictEqual(b.cuts.length, 3, 'no more cutting after the boom');
}
{ // lock: a row is only solved when its OWN code is entered; success needs both rows
  const g = mk('lock', 9, { mine: 'p1', isAuth: true }, null, 'X'); g.start(); assert.strictEqual(g.result(), 0);
  g.set.p1 = g.puz.target.p1.slice(); assert.strictEqual(g.result(), 0, 'one row is not enough');
  g.apply('p2', { set: { 0: g.puz.target.p2[0], 1: g.puz.target.p2[1], 2: g.puz.target.p2[2] } }); assert.strictEqual(g.result(), 1);
  const h = mk('lock', 9, { mine: 'p1' }, null, 'X'); h.start(); const before = h.set.p2.slice(); h.turn('p2', 0); assert.deepStrictEqual(h.set.p2, before, 'cannot touch the other lock');
}
{ // quick-say tokens reach a simulated bot teammate and bubbles are produced for both
  const seen = []; const g = mk('lock', 4, { mine: 'p1', sim: { p2: 'hard' }, isAuth: true, bubble: (r, html, own) => seen.push([r, own]) }, null, 'X'); g.start();
  g.say('p1', 'sym:1:' + g.puz.target.p2[1]); for (let i = 0; i < 60 * 3; i++) g.frame(1 / 60);
  assert(seen.some(([r, own]) => r === 'p1' && own), 'my own bubble'); assert(seen.some(([r]) => r === 'p2'), 'the bot talks back (reads its code out)');
}
console.log('OK — puzzles valid for 400 seeds; bots solve every minigame, solo-client and split-client with lag');
