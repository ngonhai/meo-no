// node tests/engine.test.js — rules + bot-vs-bot soak test
const M = require('../js/meow-engine.js');
const assert = require('assert');
const total = g => g.deck.length + g.discard.length + g.order.reduce((n, c) => n + g.hands[c].length, 0);
let games = 0, turns = 0;
const LV = ['easy', 'normal', 'hard'];
for (let n = 2; n <= 5; n++) for (let r = 0; r < 60; r++) {
  const cols = M.COLORS.slice(0, n), s = M.normalizeSettings({ hand: 4 + (r % 5) });
  const g = M.newGame(s, cols, cols[0]), T = total(g), lvl = {};
  cols.forEach((c, i) => { lvl[c] = LV[(i + r) % 3]; });
  assert.strictEqual(g.deck.filter(k => k === 'bomb').length, n - 1);
  let guard = 0;
  while (g.phase !== 'over' && guard++ < 5000) {
    if (g.phase === 'play') {
      const a = M.botPlay(g, g.turn, lvl[g.turn]);
      const ok = a.t === 'draw' ? M.draw(g, g.turn) : M.play(g, g.turn, a.kinds, a.opts, s);
      assert(ok, 'bot made an illegal move ' + JSON.stringify(a)); turns++;
    } else if (g.phase === 'pending') {
      const p = g.pending; let acted = false;
      for (const c of M.aliveList(g)) if (M.botReact(g, c, lvl[c]) === 'nope') { assert(M.nope(g, c)); acted = true; break; }
      if (!acted) assert(M.resolve(g, p.pid, p.n));
    } else if (g.phase === 'give') {
      assert(M.giveCard(g, g.give.from, M.botGive(g, g.give.from)));
    } else if (g.phase === 'reinsert') {
      assert(M.reinsert(g, g.reins.by, M.botReinsert(g, g.reins.by, lvl[g.reins.by])));
    }
    assert.strictEqual(total(g), T - (g.phase === 'reinsert' ? 1 : 0), 'cards must be conserved (the defused bomb is in hand-limbo during reinsert)');
    if (g.phase === 'play' || g.phase === 'pending') {
      const bombsAlive = M.aliveList(g).length - 1;
      assert.strictEqual(g.deck.filter(k => k === 'bomb').length, bombsAlive, 'one bomb per living opponent stays in the pile');
    }
  }
  assert.strictEqual(g.phase, 'over', 'game must end'); assert.strictEqual(M.aliveList(g).length, 1); games++;
}
// attack stacking: attacked player takes 2 turns, attacking back gives the next one 3
{
  const g = M.newGame(M.DEFAULT_SETTINGS, ['coral', 'mint', 'sky'], 'coral');
  g.hands.coral = ['attack', 'cat1']; g.hands.mint = ['attack', 'cat2']; g.hands.sky = ['cat3'];
  M.play(g, 'coral', ['attack'], {}); M.resolve(g, g.pending.pid, 0);
  assert.strictEqual(g.turn, 'mint'); assert.strictEqual(g.left, 2);
  M.play(g, 'mint', ['attack'], {}); M.resolve(g, g.pending.pid, 0);
  assert.strictEqual(g.turn, 'sky'); assert.strictEqual(g.left, 3);
}
// nope chain: one nope cancels, two nopes restore
{
  const g = M.newGame(M.DEFAULT_SETTINGS, ['coral', 'mint'], 'coral');
  g.hands.coral = ['skip', 'nope']; g.hands.mint = ['nope'];
  M.play(g, 'coral', ['skip'], {}); M.nope(g, 'mint');
  M.nope(g, 'coral'); M.resolve(g, g.pending.pid, g.pending.n);
  assert.strictEqual(g.turn, 'mint');
}
// a single nope cancels the card for good (it still leaves the hand)
{
  const g = M.newGame(M.DEFAULT_SETTINGS, ['coral', 'mint'], 'coral');
  g.hands.coral = ['skip']; g.hands.mint = ['nope'];
  M.play(g, 'coral', ['skip'], {}); M.nope(g, 'mint'); M.resolve(g, g.pending.pid, g.pending.n);
  assert.strictEqual(g.turn, 'coral'); assert.strictEqual(g.phase, 'play'); assert.strictEqual(g.hands.coral.length, 0);
}
// defuse flow + peek bookkeeping
{
  const g = M.newGame(M.DEFAULT_SETTINGS, ['coral', 'mint'], 'coral');
  g.deck = ['bomb', 'cat1', 'cat2', 'cat3']; g.hands.coral = ['defuse'];
  g.peek = { by: 'coral', cards: ['bomb', 'cat1', 'cat2'] };
  M.draw(g, 'coral'); assert.strictEqual(g.phase, 'reinsert');
  M.reinsert(g, 'coral', 2); assert.deepStrictEqual(g.deck, ['cat1', 'cat2', 'bomb', 'cat3']);
  assert.strictEqual(g.turn, 'mint');
}
// no defuse -> out, winner declared
{
  const g = M.newGame(M.DEFAULT_SETTINGS, ['coral', 'mint'], 'coral');
  g.deck = ['bomb', 'cat1']; g.hands.coral = ['cat2'];
  M.draw(g, 'coral'); assert.strictEqual(g.phase, 'over'); assert.strictEqual(g.winner, 'mint');
}
// triple: right guess steals, wrong guess misses; pair/triple need a target
{
  const g = M.newGame(M.DEFAULT_SETTINGS, ['coral', 'mint'], 'coral');
  g.hands.coral = ['cat1', 'cat1', 'cat1']; g.hands.mint = ['nope', 'skip'];
  assert(!M.canPlay(g, 'coral', ['cat1', 'cat1', 'cat1'], {}));
  M.play(g, 'coral', ['cat1', 'cat1', 'cat1'], { target: 'mint', name: 'nope' }); M.resolve(g, g.pending.pid, 0);
  assert.deepStrictEqual(g.hands.coral, ['nope']); assert.deepStrictEqual(g.hands.mint, ['skip']);
}
// Favor: target picks the card; the log never names it, the events do
{
  const g = M.newGame(M.DEFAULT_SETTINGS, ['coral', 'mint', 'sky'], 'coral');
  g.hands.coral = ['favor']; g.hands.mint = ['cat1', 'skip']; g.hands.sky = ['cat2'];
  M.play(g, 'coral', ['favor'], { target: 'mint' }); M.resolve(g, g.pending.pid, 0);
  assert.strictEqual(g.phase, 'give'); assert.strictEqual(g.give.from, 'mint'); assert(!M.giveCard(g, 'sky', 'cat2'), 'only the target may give');
  assert(!M.giveCard(g, 'mint', 'defuse'), 'cannot give a card you do not hold');
  M.giveCard(g, 'mint', 'skip');
  assert.strictEqual(g.phase, 'play'); assert.strictEqual(g.turn, 'coral'); assert.deepStrictEqual(g.hands.coral, ['skip']);
  assert(g.ev.some(e => e.k === 'give' && e.card === 'skip'), 'animation event keeps the card');
  assert(!g.log.some(e => e.card || e.cards), 'permanent log must not reveal cards');
}
// Favor whose target plays their last card as a Nope -> fizzles instead of hanging in the give phase
{
  const g = M.newGame(M.DEFAULT_SETTINGS, ['coral', 'mint'], 'coral');
  g.hands.coral = ['favor']; g.hands.mint = ['nope'];
  M.play(g, 'coral', ['favor'], { target: 'mint' }); M.nope(g, 'mint'); M.nope(g, 'coral') || 0; M.resolve(g, g.pending.pid, g.pending.n);
  assert.strictEqual(g.phase, 'play');
}
// ============================== 2v2 TEAM MODE ==============================
const TEAM = (extra) => M.normalizeSettings(Object.assign({ mode: 'team' }, extra || {}));
// teams alternate around the table, so teammates sit opposite
{
  const g = M.newGame(TEAM(), ['coral', 'mint', 'sky', 'violet'], 'coral');
  assert.strictEqual(g.mode, 'team');
  assert.deepStrictEqual(g.teams, { coral: 'A', mint: 'B', sky: 'A', violet: 'B' });
  assert.strictEqual(M.mateOf(g, 'coral'), 'sky'); assert(M.isAlly(g, 'mint', 'violet')); assert(!M.isAlly(g, 'coral', 'mint'));
  assert.deepStrictEqual(M.previewTeams(['coral', 'mint', 'sky', 'violet']), g.teams);
  assert.deepStrictEqual(M.previewTeams(['coral', 'mint', 'sky']), {}, 'preview only exists for exactly 4');
  // never target your teammate (Favor / pairs / triples)
  g.hands.sky = ['cat1']; g.hands.mint = ['cat2']; g.hands.violet = ['cat3'];
  assert.deepStrictEqual(M.validTargets(g, 'coral').sort(), ['mint', 'violet']);
  // fewer/more than 4 seats silently falls back to solo
  assert.strictEqual(M.newGame(TEAM(), ['coral', 'mint', 'sky'], 'coral').mode, 'solo');
}
// Attack lands on the next FOE, not on a teammate
{
  const g = M.newGame(TEAM(), ['coral', 'mint', 'sky', 'violet'], 'coral');
  g.alive.mint = false;                          // order coral, (mint), sky, violet -> after sky comes violet (foe)
  g.turn = 'sky'; g.hands.sky = ['attack']; g.hands.coral = []; g.hands.violet = [];
  M.play(g, 'sky', ['attack'], {}); M.resolve(g, g.pending.pid, 0);
  assert.strictEqual(g.turn, 'violet'); assert.strictEqual(g.left, 2);
  g.turn = 'violet'; g.left = 1; g.hands.violet = ['attack'];
  M.play(g, 'violet', ['attack'], {}); M.resolve(g, g.pending.pid, 0);
  assert.strictEqual(g.turn, 'coral', 'violet\'s foes are coral/sky; next in table order is coral');
}
// bomb + no Defuse + living teammate -> rescue phase instead of instant death
function rig(extra, hand) {
  const g = M.newGame(TEAM(extra), ['coral', 'mint', 'sky', 'violet'], 'coral');
  g.deck = ['bomb', 'cat1', 'cat2', 'cat3', 'bomb', 'bomb']; g.hands.coral = hand || ['cat4']; g.v = 10;
  return g;
}
{
  const g = rig(); assert(M.draw(g, 'coral'));
  assert.strictEqual(g.phase, 'rescue'); assert.strictEqual(g.rescue.by, 'coral'); assert.strictEqual(g.rescue.mate, 'sky');
  assert(M.COOP_GAMES.indexOf(g.rescue.game) >= 0); assert(g.rescue.seed > 0);
  assert.deepStrictEqual([g.rescue.p1, g.rescue.p2].sort(), ['coral', 'sky']);
  assert(g.alive.coral, 'still alive while the boat is defusing');
  assert(!M.draw(g, 'coral') && !M.play(g, 'coral', ['cat4'], {}), 'nothing else is legal during a rescue');
  assert(!M.rescueEnd(g, g.rescue.id + 1, true), 'a stale result is ignored');
  const id = g.rescue.id; assert(M.rescueEnd(g, id, true));
  assert.strictEqual(g.phase, 'reinsert'); assert.strictEqual(g.reins.by, 'coral'); assert(!M.rescueEnd(g, id, true), 'result lands once');
  M.reinsert(g, 'coral', 1); assert.strictEqual(g.phase, 'play'); assert.strictEqual(g.turn, 'mint'); assert.strictEqual(g.deck.filter(k => k === 'bomb').length, 3);
}
// failure: only the DRAWER explodes; the teammate plays on
{
  const g = rig(); M.draw(g, 'coral'); assert(M.rescueEnd(g, g.rescue.id, false));
  assert(!g.alive.coral); assert(g.alive.sky); assert.strictEqual(g.phase, 'play'); assert.strictEqual(g.turn, 'mint'); assert.strictEqual(g.rescue, null);
  assert(g.ev.some(e => e.k === 'rescueFail') && g.ev.some(e => e.k === 'explode'));
}
// default trigger: a Defuse in hand keeps the classic flow (no minigame)
{
  const g = rig({}, ['defuse']); M.draw(g, 'coral'); assert.strictEqual(g.phase, 'reinsert'); assert(!g.rescue);
}
// 'always' trigger: minigame even with a Defuse; success keeps the card, failure burns it
{
  const g = rig({ coop: 'always' }, ['defuse']); M.draw(g, 'coral'); assert.strictEqual(g.phase, 'rescue'); assert.strictEqual(g.rescue.hasDef, 1);
  M.rescueEnd(g, g.rescue.id, true); assert.strictEqual(g.phase, 'reinsert'); assert.deepStrictEqual(g.hands.coral, ['defuse']);
  const h = rig({ coop: 'always' }, ['defuse']); M.draw(h, 'coral');
  M.rescueEnd(h, h.rescue.id, false); assert.strictEqual(h.phase, 'reinsert'); assert.deepStrictEqual(h.hands.coral, []); assert(h.alive.coral);
}
// dead teammate -> nobody to help -> classic rules (and the drawer was the last of team A, so B wins)
{
  const g = rig(); g.alive.sky = false; g.hands.sky = [];
  M.draw(g, 'coral'); assert.strictEqual(g.phase, 'over'); assert(!g.alive.coral); assert.strictEqual(g.winTeam, 'B');
}
// a team wins when both opponents are out (the survivor of the winning team may be alone)
{
  const g = rig(); g.alive.mint = false; g.hands.mint = []; g.alive.sky = false; g.hands.sky = [];
  g.deck = ['bomb', 'cat1', 'bomb']; M.draw(g, 'coral');                 // coral is alone on team A and has no Defuse -> out, team B wins
  assert.strictEqual(g.phase, 'over'); assert.strictEqual(g.winTeam, 'B'); assert.strictEqual(g.winner, 'violet');
}
{
  const g = rig(); M.draw(g, 'coral'); M.rescueEnd(g, g.rescue.id, false);   // team A loses coral, B and sky remain -> continue
  assert.strictEqual(g.phase, 'play'); g.turn = 'mint'; g.deck = ['bomb']; g.hands.mint = []; g.hands.violet = [];
  M.draw(g, 'mint'); assert.strictEqual(g.phase, 'rescue'); assert.strictEqual(g.rescue.mate, 'violet');
  M.rescueEnd(g, g.rescue.id, false); assert(!g.alive.mint && g.alive.violet && g.alive.sky); assert.strictEqual(g.phase, 'play');
  g.turn = 'sky'; g.deck = ['bomb']; g.hands.sky = []; g.alive.coral = false;                 // sky explodes alone -> team A wiped
  M.draw(g, 'sky'); assert.strictEqual(g.phase, 'over'); assert.strictEqual(g.winTeam, 'B'); assert(M.aliveList(g).every(c => g.teams[c] === 'B'));
}
// bots can't Nope their own side, and defend a teammate's card
{
  const g = M.newGame(TEAM(), ['coral', 'mint', 'sky', 'violet'], 'coral');
  g.hands.coral = ['skip']; g.hands.sky = ['nope']; g.hands.mint = ['nope'];
  M.play(g, 'coral', ['skip'], {});
  assert.strictEqual(M.botReact(g, 'sky', 'hard'), 'pass', 'teammate lets a harmless card through');
  M.nope(g, 'mint');                                                        // a foe cancels coral's card
  let n = 0; for (let i = 0; i < 200; i++) if (M.botReact(g, 'sky', 'hard') === 'nope') n++;
  assert(n > 150, 'teammate re-Nopes the foe\'s Nope to rescue the card (hard bot)');
}
// soak: bot-only 2v2 games with random minigame outcomes
{
  let tg = 0, rescues = 0, wins = 0;
  for (let r = 0; r < 150; r++) {
    const cols = M.COLORS.slice(0, 4), st = TEAM({ coop: r % 2 ? 'always' : 'nodefuse', hand: 4 + (r % 5) }), g = M.newGame(st, cols, cols[r % 4]), T = total(g), lvl = {};
    cols.forEach((c, i) => { lvl[c] = LV[(i + r) % 3]; });
    const pOK = [0.2, 0.5, 0.8][r % 3]; let guard = 0;
    while (g.phase !== 'over' && guard++ < 6000) {
      if (g.phase === 'play') { const a = M.botPlay(g, g.turn, lvl[g.turn]); assert(a.t === 'draw' ? M.draw(g, g.turn) : M.play(g, g.turn, a.kinds, a.opts, st), 'illegal bot move'); }
      else if (g.phase === 'pending') { let acted = false; for (const c of M.aliveList(g)) if (M.botReact(g, c, lvl[c]) === 'nope') { assert(M.nope(g, c)); acted = true; break; } if (!acted) assert(M.resolve(g, g.pending.pid, g.pending.n)); }
      else if (g.phase === 'give') assert(M.giveCard(g, g.give.from, M.botGive(g, g.give.from)));
      else if (g.phase === 'reinsert') assert(M.reinsert(g, g.reins.by, M.botReinsert(g, g.reins.by, lvl[g.reins.by])));
      else if (g.phase === 'rescue') { rescues++; const ok = Math.random() < pOK; assert(g.alive[g.rescue.by] && g.alive[g.rescue.mate]); assert(M.rescueEnd(g, g.rescue.id, ok)); }
      else assert.fail('unexpected phase ' + g.phase);
      assert.strictEqual(total(g), T - (g.phase === 'reinsert' || g.phase === 'rescue' ? 1 : 0), 'cards conserved (bomb in limbo during rescue/reinsert)');
      if (g.phase === 'play' || g.phase === 'pending') assert.strictEqual(g.deck.filter(k => k === 'bomb').length, M.aliveList(g).length - 1);
    }
    assert.strictEqual(g.phase, 'over', 'team game must end'); assert(g.winTeam === 'A' || g.winTeam === 'B');
    assert(M.aliveList(g).length >= 1 && M.aliveList(g).every(c => g.teams[c] === g.winTeam)); tg++; wins++;
  }
  console.log('OK — ' + tg + ' team games finished, ' + rescues + ' minigame rescues resolved');
}

console.log('OK — ' + games + ' bot games finished (' + turns + ' bot turns), rule tests passed');
