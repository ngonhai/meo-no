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
console.log('OK — ' + games + ' bot games finished (' + turns + ' bot turns), rule tests passed');
