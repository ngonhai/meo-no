// node tests/coop.test.js — the 2v2 minigames, headless: puzzle validity + bots solving them, including the "split"
// case where the two roles are simulated by two different clients that only see each other through a laggy channel.
const assert = require('assert');
const Coop = require('../js/meow-coop.js');
const { zigzagMake, wiresMake, lockMake, wiresEval, zzSeg } = Coop.puzzles;
const KINDS = ['zigzag', 'wires', 'lock', 'maze'];

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
  const puz = Coop.GAMES[kind].make(seed, over && over.level);
  const api = Object.assign({ puz, roles: { p1: 'coral', p2: 'sky' }, mine: null, sim: {}, isAuth: false, names: { p1: 'A', p2: 'B' }, t: T, bubble: noop, event: noop,
    send: (r, d) => bus && bus.push({ from: who, role: r, data: JSON.parse(JSON.stringify(d)), at: bus.now }) }, over);
  return new Coop.GAMES[kind].Game(api);
}
// run until `auth` reports a result (1 / -1) or time is up. games = [{g, auth?}], lat = one-way latency in seconds
function run(kind, games, bus, lat, maxSec, level) {
  const dt = 1 / 60, sec = Coop.limit(kind, level); let t = 0;
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
{ // viewer sabotage: rotate / gum / ink go through the channel, apply once, respect cooldowns, and gum really slows the dot
  const notes = [];
  const mkv = (key, bus, who, over) => mk('zigzag', 21, Object.assign({ mine: null, sim: { p1: 'hard', p2: 'hard' }, isAuth: false, sbKey: key, note: (k, a, b) => notes.push([k, a, b]), sendSabo: d => bus.push({ from: who, role: key, data: JSON.parse(JSON.stringify(d)), at: bus.now, sabo: key }) }, over), bus, who);
  const bus = mkBus(), pair = mk('zigzag', 21, { mine: null, sim: { p1: 'hard', p2: 'hard' }, isAuth: true, note: () => {} }, bus, 'D'), viewer = mkv('mint', bus, 'V'), watcher = mkv('sp_x', bus, 'W');
  assert(viewer.canSabo() && !pair.canSabo(), 'only non-drivers can sabotage');
  assert.strictEqual(viewer.sabo('rot', -1), false, 'not before the game starts');
  [pair, viewer, watcher].forEach(g => g.start());
  const pump = (sec) => { for (let i = 0; i < sec * 60; i++) { bus.now += 1 / 60; [pair, viewer, watcher].forEach(g => g.frame(1 / 60));
    for (let k = bus.length - 1; k >= 0; k--) { const m = bus[k]; if (bus.now - m.at >= 0.05) { bus.splice(k, 1); [pair, viewer, watcher].forEach(g => { if (m.sabo) g.onSabo(m.sabo, m.data); else if (g !== (m.from === 'D' ? pair : null)) g.onData(m.role, m.data); }); } } } };
  assert.strictEqual(viewer.sabo('rot', -1), true); assert.strictEqual(viewer.rot, -90, 'applied at once on my own screen');
  assert.strictEqual(viewer.sabo('rot', 1), false, 'rotate is on a 10 s cooldown');
  pump(0.5); assert.strictEqual(pair.rot, -90); assert.strictEqual(watcher.rot, -90, 'everybody sees the same rotation'); assert.strictEqual(pair.rotNorm(), 270);
  pump(0.5); assert.strictEqual(pair.rot, -90, 'a message repeated by the channel is applied only once'); assert.strictEqual(viewer.rot, -90);
  pump(10); assert.strictEqual(viewer.sabo('rot', 1), true); pump(0.3); assert.strictEqual(pair.rot, 0, 'turned back');
  // gum: dot crawls inside it
  const g0 = pair.pos.x, here = { x: pair.pos.x, y: pair.pos.y };
  assert.strictEqual(viewer.sabo('gum', here), true); pump(0.3);
  assert.strictEqual(pair.gums.length, 1); assert.strictEqual(pair.gumMul(here.x, here.y), 0.35); assert.strictEqual(pair.gumMul(here.x + 30, here.y), 1);
  pump(10); assert.strictEqual(pair.gums.length, 0, 'gum dries up'); assert.strictEqual(watcher.gums.length, 0);
  // ink only lives a few seconds, the auto-aimed gum lands on the track
  assert.strictEqual(viewer.sabo('ink'), true); pump(0.2); assert.strictEqual(pair.ink.length, 1); pump(5); assert.strictEqual(pair.ink.length, 0);
  viewer.sbCool.gum = 0; viewer.sabo('gum'); pump(0.2); const ag = pair.gums[pair.gums.length - 1]; assert(ag && zzSeg(pair.puz, ag.x, ag.y) >= 0, 'auto gum is on the corridor');
  // a client that ignores its own cooldown is ignored by the others
  const bad = mkv('cheat', bus, 'C'); bad.start(); bad.sabo('rot', 1); bad.sbCool.rot = 0; bad.sabo('rot', 1); const before = pair.rot; pump(0.3); assert.strictEqual(pair.rot, before + 90, 'only the first of two instant rotations counts');
  // the drivers themselves cannot sabotage
  const drv = mk('zigzag', 21, { mine: 'p1', isAuth: false, sbKey: null }, null, 'X'); drv.start(); assert.strictEqual(drv.sabo('rot', 1), false);
  // gum slows a real run: same bots, with and without gum on the start of the track
  const lap = (gum) => { const g = mk('zigzag', 33, { sim: { p1: 'hard', p2: 'hard' }, isAuth: true, note: () => {} }, mkBus(), 'S'); g.start(); if (gum) g.gums.push({ id: 'g', x: g.puz.start[0] + 6, y: g.puz.start[1], age: -99 });
    let t = 0; while (!g.result() && t < 60) { g.frame(1 / 60); t += 1 / 60; } return t; };
  assert(lap(true) > lap(false) + 0.3, 'driving through gum takes longer: ' + lap(true) + ' vs ' + lap(false));
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
// ---------------------------------------------------------------- zig-zag: the two screens must agree, even if messages are LOST
{
  let worst = 0, win = 0, N = 40;
  for (let seed = 1; seed <= N; seed++) {
    const bus = mkBus(), g1 = mk('zigzag', seed * 31, { mine: null, sim: { p1: 'normal' }, isAuth: true }, bus, 'A'), g2 = mk('zigzag', seed * 31, { mine: null, sim: { p2: 'normal' } }, bus, 'B');
    const lossy = []; lossy.now = 0; const push = bus.push.bind(bus); bus.push = m => { if (Math.random() > 0.35) push(m); };      // 35% of messages never arrive
    const dt = 1 / 60; let t = 0, ok = false; g1.start(); g2.start();
    while (t < 60) {
      t += dt; bus.now = t; g1.frame(dt); g2.frame(dt);
      for (let i = bus.length - 1; i >= 0; i--) { const m = bus[i]; if (t - m.at >= 0.12) { bus.splice(i, 1); (m.from === 'A' ? g2 : g1).onData(m.role, m.data); } }
      if (g1.result()) { ok = true; break; }
    }
    if (ok) win++;
    g1.botDir = () => 0; g2.botDir = () => 0;                                            // both players let go; the heartbeat keeps running for 6 s, then compare both screens
    for (let i = 0; i < 60 * 6; i++) {
      t += dt; bus.now = t; g1.frame(dt); g2.frame(dt);
      for (let k = bus.length - 1; k >= 0; k--) { const m = bus[k]; if (t - m.at >= 0.12) { bus.splice(k, 1); (m.from === 'A' ? g2 : g1).onData(m.role, m.data); } }
    }
    worst = Math.max(worst, Math.abs(g1.pos.x - g2.pos.x), Math.abs(g1.pos.y - g2.pos.y));
    assert.strictEqual(g1.maxIdx, g2.maxIdx, 'both screens agree on the last corner reached');
  }
  console.log('zigzag with 35% message loss: won ' + win + '/' + N + ', worst final screen disagreement ' + worst.toFixed(2) + ' units');
  assert(worst < 1.5, 'screens converge after loss, off by ' + worst);
}


// ---------------------------------------------------------------- bomb heat: hotter bombs = harder (but still fair) minigames
assert.deepStrictEqual([0, 1, 2].map(l => Coop.limit('wires', l)), [36, 38, 40]); assert.strictEqual(Coop.limit('lock', 99), 44, 'level is clamped');
for (let l = 1; l <= 2; l++) KINDS.forEach(kind => {
  for (let seed = 1; seed <= 200; seed++) {                                        // every hot puzzle is valid
    const p = Coop.GAMES[kind].make(seed * 131, l); assert.strictEqual(p.level, l);
    if (kind === 'lock') { assert.strictEqual(p.n, 3 + l); ['p1', 'p2'].forEach(r => { assert.strictEqual(p.target[r].length, p.n); p.target[r].forEach((v, i) => assert.notStrictEqual(p.init[r][i], v)); }); }
    if (kind === 'wires') { assert.strictEqual(p.steps.length, 4 + l); assert.strictEqual(p.maxStrikes, l === 2 ? 2 : 3); assert.strictEqual(new Set(p.steps.map(x => x.w)).size, p.steps.length); }
    if (kind === 'zigzag') { assert.strictEqual(p.segs.length, 2 * (4 + l) - 1); assert(p.W < 5.4); }
  }
  ['normal', 'hard'].forEach(lv => {
    let win = 0, N = 60;
    for (let seed = 1; seed <= N; seed++) {
      const bus = mkBus(), g = mk(kind, seed * 7919, { level: l, sim: { p1: lv, p2: lv }, isAuth: true }, bus, 'D');
      if (run(kind, [{ id: 'D', g, auth: true }], bus, 0, 90, l).ok) win++;
    }
    console.log(kind.padEnd(7) + ' heat ' + l + ' bots ' + lv + ': ' + win + '/' + N);
    assert(win / N >= 0.6, kind + ' heat ' + l + ' must stay winnable for ' + lv + ' bots: ' + win + '/' + N);
  });
  let win = 0, N = 40;                                                              // split clients with lag on the hardest heat
  if (l === 2) {
    for (let seed = 1; seed <= N; seed++) {
      const bus = mkBus(), g1 = mk(kind, seed * 104729, { level: l, sim: { p1: 'normal' }, isAuth: true }, bus, 'A'), g2 = mk(kind, seed * 104729, { level: l, sim: { p2: 'normal' } }, bus, 'B');
      if (run(kind, [{ id: 'A', g: g1, auth: true }, { id: 'B', g: g2 }], bus, 0.2, 90, l).ok) win++;
    }
    console.log(kind.padEnd(7) + ' heat 2 split clients, 200ms lag: ' + win + '/' + N); assert(win / N >= 0.55, kind + ' heat 2 with lag: ' + win + '/' + N);
  }
});

// ---------------------------------------------------------------- blind maze
{
  const { mazeMake, mazePath } = Coop.puzzles;
  for (let l = 0; l <= 2; l++) for (let seed = 1; seed <= 150; seed++) {          // every maze is a valid perfect maze with a sensible route
    const p = mazeMake(seed * 977, l), N = [6, 7, 8][l];
    assert.strictEqual(p.N, N); assert.strictEqual(p.open.length, N * N); assert(p.driver !== p.guide && ['p1', 'p2'].includes(p.driver));
    let doors = 0; p.open.forEach((m, c) => { for (let d = 0; d < 4; d++) if ((m >> d) & 1) { doors++; const x = c % N, y = (c - x) / N, dx = [0, 1, 0, -1][d], dy = [-1, 0, 1, 0][d];
      assert(x + dx >= 0 && x + dx < N && y + dy >= 0 && y + dy < N, 'no door through the outer wall'); assert((p.open[(y + dy) * N + x + dx] >> ((d + 2) % 4)) & 1, 'doors are two-sided'); } });
    assert.strictEqual(doors / 2, N * N - 1, 'perfect maze: N*N-1 passages, every cell reachable, no loops');
    const route = mazePath(p, p.start[0], p.start[1], p.goal[0], p.goal[1]);
    assert.strictEqual(route.length - 1, p.len); assert(p.len >= 6 && p.len <= [15, 19, 23][l], 'route length ' + p.len);
    assert(p.start.every(v => v === 0 || v === N - 1), 'the start is a corner');
  }
  assert.deepStrictEqual(mazeMake(5, 1).open, mazeMake(5, 1).open, 'same seed -> same maze on every client'); assert.deepStrictEqual([0, 1, 2].map(l => Coop.limit('maze', l)), [42, 44, 46]);
  const KEY = { U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', L: 'ArrowLeft' };
  const walk = (g, route) => { for (let i = 1; i < route.length; i++) { const a = route[i - 1], b = route[i], d = a[0] < b[0] ? 'R' : a[0] > b[0] ? 'L' : a[1] < b[1] ? 'D' : 'U'; g.key(KEY[d], true); g.key(KEY[d], false); } };
  { // the DRIVER walks the true route cell by cell: wins with no penalty; a wall costs time and does not move the dot
    const p = mazeMake(21, 0), g = mk('maze', 21, { mine: p.driver, isAuth: true }, null, 'X'); g.start();
    const wall = [0, 1, 2, 3].find(d => !((p.open[p.start[1] * p.N + p.start[0]] >> d) & 1) && (d === 1 || d === 2 ? true : true));
    const before = g.pos.slice(); g.key({ 0: 'ArrowUp', 1: 'ArrowRight', 2: 'ArrowDown', 3: 'ArrowLeft' }[wall], true); g.key({ 0: 'ArrowUp', 1: 'ArrowRight', 2: 'ArrowDown', 3: 'ArrowLeft' }[wall], false);
    assert.deepStrictEqual(g.pos, before, 'walls are solid'); assert.strictEqual(g.bumps, 1); assert(Math.abs(g.penalty() - 0.6) < 1e-9);
    assert.strictEqual(g.result(), 0); walk(g, mazePath(p, g.pos[0], g.pos[1], p.goal[0], p.goal[1])); assert.strictEqual(g.result(), 1, 'reaching the goal wins');
  }
  { // the GUIDE can not move the dot, and only the driver's payload moves it
    const p = mazeMake(22, 1), g = mk('maze', 22, { level: 1, mine: p.guide, isAuth: true }, null, 'X'); g.start();
    Object.keys(KEY).forEach(d => { g.key(KEY[d], true); g.key(KEY[d], false); g.press(1); g.step(1); }); assert.deepStrictEqual(g.pos, p.start, 'the guide has no controls');
    g.apply(p.guide, { x: 3, y: 3, b: 0, n: 1 }); assert.deepStrictEqual(g.pos, p.start, 'a payload from the guide role is ignored');
    const route = mazePath(p, p.start[0], p.start[1], p.goal[0], p.goal[1]), c = route[3]; g.apply(p.driver, { x: c[0], y: c[1], b: 2, n: 3 });
    assert.deepStrictEqual(g.pos, c); assert.strictEqual(g.bumps, 2); assert.strictEqual(g.trail.length, 4, 'a skipped update is filled in along the route');
    g.apply(p.driver, { x: p.goal[0], y: p.goal[1], b: 2, n: 9 }); assert.strictEqual(g.result(), 1, 'the authority sees the win from the driver\'s payload');
  }
  { // a spectator gets neither controls nor the map
    const p = mazeMake(23, 0), g = mk('maze', 23, { mine: null, sim: {}, isAuth: false }, null, 'X'); g.start(); g.key('ArrowUp', true); g.press(0); assert.deepStrictEqual(g.pos, p.start);
  }
  { // a bot driver does exactly what the human guide says: "Right 2" = two cells, then it stops; "stop" interrupts; a wall ahead = bump + "oops"
    const p = mazeMake(24, 0), spoken = []; let g = null; const run2 = sec => { for (let i = 0; i < 60 * sec; i++) g.frame(1 / 60); };
    g = mk('maze', 24, { mine: p.guide, sim: { [p.driver]: 'hard' }, isAuth: true, bubble: (r, html) => spoken.push(r + ':' + html) }, null, 'X'); g.start();
    const route = mazePath(p, p.start[0], p.start[1], p.goal[0], p.goal[1]), dirOf = (a, b) => a[0] < b[0] ? 'R' : a[0] > b[0] ? 'L' : a[1] < b[1] ? 'D' : 'U';
    const d0 = dirOf(route[0], route[1]); let n = 1; while (n + 1 < route.length && dirOf(route[n], route[n + 1]) === d0) n++;
    run2(2); assert.deepStrictEqual(g.pos, p.start, 'a bot driver waits for orders');
    g.say(p.guide, 'dir:' + d0 + n); run2(4); assert.deepStrictEqual(g.pos, route[n], 'it walks exactly the called number of cells');
    const wall = [0, 1, 2, 3].find(d => !((p.open[g.pos[1] * p.N + g.pos[0]] >> d) & 1)), W = 'URDL'[wall];
    g.say(p.guide, 'dir:' + W); run2(2); assert.strictEqual(g.bumps, 1, 'blind bot walks into the wall'); assert(spoken.some(x => x.startsWith(p.driver + ':')), 'and says oops');
  }
  { // two bots + one-writer-per-role clients with message loss still finish, and both screens agree
    let win = 0, N = 40, worst = 0;
    for (let seed = 1; seed <= N; seed++) {
      const q = mazeMake(seed * 31, 1), bus = mkBus(), A = mk('maze', seed * 31, { level: 1, mine: null, sim: { [q.guide]: 'normal' }, isAuth: true }, bus, 'A'), B = mk('maze', seed * 31, { level: 1, mine: null, sim: { [q.driver]: 'normal' } }, bus, 'B');
      const push = bus.push.bind(bus); bus.push = m => { if (Math.random() > 0.35) push(m); };
      const dt = 1 / 60; let t = 0, ok = false; A.start(); B.start();
      while (t < 70) { t += dt; bus.now = t; A.frame(dt); B.frame(dt); for (let i = bus.length - 1; i >= 0; i--) { const m = bus[i]; if (t - m.at >= 0.12) { bus.splice(i, 1); (m.from === 'A' ? B : A).onData(m.role, m.data); } } if (A.result()) { ok = true; break; } }
      if (ok) win++; for (let i = 0; i < 60 * 3; i++) { t += dt; bus.now = t; A.frame(dt); B.frame(dt); for (let k = bus.length - 1; k >= 0; k--) { const m = bus[k]; if (t - m.at >= 0.12) { bus.splice(k, 1); (m.from === 'A' ? B : A).onData(m.role, m.data); } } }
      if (A.pos.join() !== B.pos.join()) worst++;
    }
    console.log('maze with 35% message loss: won ' + win + '/' + N + ', screens disagreeing at the end: ' + worst); assert(win / N >= 0.6, 'maze winnable with lost messages'); assert(worst <= 1, 'screens converge after loss');
  }
}

console.log('OK — puzzles valid for 400 seeds; bots solve every minigame, solo-client and split-client with lag');
