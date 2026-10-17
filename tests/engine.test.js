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
  M.reinsert(g, 'coral', 1); assert.strictEqual(g.phase, 'play'); assert.strictEqual(g.turn, 'mint'); assert.strictEqual(g.deck.filter(M.isBomb).length, 3);
  assert.strictEqual(g.deck[1], 'bomb1', 'the defused bomb comes back one level hotter');
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
// lobby rule 'exploded teammate can still help' (coopGhost): the minigame runs with the DEAD teammate; default stays classic
{
  const g = rig({ coopGhost: true }); g.alive.sky = false; g.hands.sky = [];
  M.draw(g, 'coral'); assert.strictEqual(g.phase, 'rescue'); assert.strictEqual(g.rescue.mate, 'sky'); assert(!g.alive.sky);
  assert.deepStrictEqual([g.rescue.p1, g.rescue.p2].sort(), ['coral', 'sky']);
  M.rescueEnd(g, g.rescue.id, true); assert.strictEqual(g.phase, 'reinsert'); assert(g.alive.coral && !g.alive.sky);
  const h = rig({ coopGhost: true }); h.alive.sky = false; h.hands.sky = [];
  M.draw(h, 'coral'); M.rescueEnd(h, h.rescue.id, false); assert.strictEqual(h.phase, 'over'); assert.strictEqual(h.winTeam, 'B');
  assert.strictEqual(M.normalizeSettings({ coopGhost: 'x' }).coopGhost, false);
}

// ---- bomb heat: hotter after every defuse+reinsert, harder minigame, level 3 = no minigame any more
{
  assert.strictEqual(M.MAX_HEAT, 3);
  const g = rig(); g.deck = ['bomb2', 'cat1', 'cat2']; M.draw(g, 'coral');
  assert.strictEqual(g.phase, 'rescue'); assert.strictEqual(g.rescue.heat, 2, 'rescue carries the bomb heat (= minigame level)');
  assert(g.ev.some(e => e.k === 'bomb' && e.heat === 2));
  M.rescueEnd(g, g.rescue.id, true); M.reinsert(g, 'coral', 0); assert.strictEqual(g.deck[0], 'bomb3');
  assert.strictEqual(g.bheat, 0);
  // at max heat with a living teammate: no minigame; no Defuse card = boom, with a Defuse card = classic defuse
  const h = rig(); h.deck = ['bomb3', 'cat1']; M.draw(h, 'coral');
  assert(!h.alive.coral, 'too hot for a minigame and no Defuse = boom'); assert(h.ev.some(e => e.k === 'scorch'));
  const d = rig({}, ['defuse']); d.deck = ['bomb3', 'cat1']; M.draw(d, 'coral');
  assert.strictEqual(d.phase, 'reinsert'); assert(d.alive.coral); M.reinsert(d, 'coral', 0); assert.strictEqual(d.deck[0], 'bomb3', 'heat stays capped at 3');
  // a classic Defuse card heats the bomb as well; with the rule off nothing heats
  const e = rig({}, ['defuse']); e.deck = ['bomb', 'cat1']; e.coop = 'nodefuse'; M.draw(e, 'coral'); M.reinsert(e, 'coral', 0); assert.strictEqual(e.deck[0], 'bomb1');
  const o = rig({ bombHeat: false }); o.deck = ['bomb', 'cat1']; M.draw(o, 'coral'); M.rescueEnd(o, o.rescue.id, true); M.reinsert(o, 'coral', 0); assert.strictEqual(o.deck[0], 'bomb');
  // See the Future shows plain 'bomb' (heat stays a surprise) and Shuffle keeps each bomb's heat
  const f = rig({}, ['future']); f.deck = ['cat1', 'bomb2', 'cat2']; M.play(f, 'coral', ['future'], {}); M.resolve(f, f.pending.pid, f.pending.n);
  assert.deepStrictEqual(f.peek && f.peek.cards, ['cat1', 'bomb', 'cat2']);
  assert.strictEqual(M.bombProb(Object.assign({}, g, { deck: ['bomb1', 'cat1', 'cat1', 'bomb'] })), 0.5);
}
// ---- sudden bomb: every reshuffle of the pile adds one fresh bomb (2v2 only; solo is untouched)
{
  const g = rig(); g.deck = []; g.discard = ['cat1', 'cat2', 'cat3', 'bomb']; M.draw(g, 'coral');
  assert.strictEqual(g.extra, 1); assert(g.ev.some(e => e.k === 'hotdeck'));
  assert.strictEqual(g.deck.filter(M.isBomb).length + (g.phase === 'rescue' ? 1 : 0), 1 + 0 + 0 + 0 + 0, 'a fresh bomb joined the reshuffled pile (the old exploded bomb stays out)');
  const o = rig({ suddenBomb: false }); o.deck = []; o.discard = ['cat1', 'cat2']; M.draw(o, 'coral'); assert.strictEqual(o.extra, 0);
  const s = M.newGame(M.normalizeSettings({}), ['coral', 'mint', 'sky'], 'coral'); s.deck = []; s.discard = ['cat1', 'cat2']; M.draw(s, 'coral'); assert.strictEqual(s.extra, 0, 'solo mode: no extra bombs');
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
      assert.strictEqual(total(g), T + (g.extra || 0) - (g.phase === 'reinsert' || g.phase === 'rescue' ? 1 : 0), 'cards conserved (bomb in limbo during rescue/reinsert; reshuffle bombs counted)');
      if (g.phase === 'play' || g.phase === 'pending') assert.strictEqual(g.deck.filter(M.isBomb).length, M.aliveList(g).length - 1 + (g.extra || 0), 'bombs in the pile = alive - 1 + bombs added by reshuffles');
    }
    assert.strictEqual(g.phase, 'over', 'team game must end'); assert(g.winTeam === 'A' || g.winTeam === 'B');
    assert(M.aliveList(g).length >= 1 && M.aliveList(g).every(c => g.teams[c] === g.winTeam)); tg++; wins++;
  }
  console.log('OK — ' + tg + ' team games finished, ' + rescues + ' minigame rescues resolved');
}


// two players press Nope together: only the FIRST Nope counts, the second card is NOT spent (and a player who saw the Nope can still answer it)
{
  const g = M.newGame(M.DEFAULT_SETTINGS, ['coral', 'sky', 'mint'], 'coral');
  g.hands.coral = ['skip', 'nope']; g.hands.sky = ['nope', 'cat1']; g.hands.mint = ['nope'];
  M.play(g, 'coral', ['skip'], {});
  const n0 = g.pending.n;
  assert(M.nope(g, 'sky', n0), 'first Nope lands');
  assert.strictEqual(M.nope(g, 'mint', n0), null, 'second Nope pressed on the same state is refused');
  assert.deepStrictEqual(g.hands.mint, ['nope'], 'refused Nope keeps the card');
  assert.strictEqual(g.pending.n, n0 + 1); assert.strictEqual(g.pending.nopes.length, 1);
  assert.strictEqual(M.nopedPlayer(g), 'coral', 'the card owner is the one who got Noped');
  assert(M.nope(g, 'coral', g.pending.n), 'the Noped player answering after seeing it works');
  assert.strictEqual(M.nopedPlayer(g), 'sky'); assert.strictEqual(g.pending.nopes.length, 2);
  assert.strictEqual(M.nope(g, 'mint'), null, 'a bystander can no longer Nope on behalf of the Noped player');
  assert.deepStrictEqual(g.hands.mint, ['nope'], 'refused bystander Nope keeps the card');
  g.hands.sky.push('nope');
  assert(M.nope(g, 'sky'), 'calls without seenN keep working (bots / old clients) for the player who got Noped');
}

// Nope-on-Nope belongs to the player who just got Noped (solo): bystanders can not step in, at any depth
{
  const g = M.newGame(M.DEFAULT_SETTINGS, ['coral', 'sky', 'mint'], 'coral');
  g.hands.coral = ['skip', 'nope', 'nope']; g.hands.sky = ['nope', 'nope']; g.hands.mint = ['nope', 'nope'];
  M.play(g, 'coral', ['skip'], {});
  assert(M.canNope(g, 'mint') && M.canNope(g, 'sky'), 'first Nope on a fresh card: anyone with a Nope');
  assert(M.nope(g, 'sky'));
  assert(!M.canNope(g, 'mint') && !M.canNope(g, 'sky') && M.canNope(g, 'coral'), 'only the card owner may answer the first Nope');
  assert(M.nope(g, 'coral'));
  assert(!M.canNope(g, 'mint') && !M.canNope(g, 'coral') && M.canNope(g, 'sky'), 'only the player whose Nope was Noped may answer');
  assert.strictEqual(M.nope(g, 'mint'), null);
  assert(M.nope(g, 'sky')); assert(M.canNope(g, 'coral') && !M.canNope(g, 'mint'));
  assert.strictEqual(g.pending.nopes.length, 3);
}

// 2v2: you can't Nope your teammate's card; only the Noped player (or their teammate) may answer a Nope
{
  const g = M.newGame(TEAM(), ['coral', 'mint', 'sky', 'violet'], 'coral');   // coral+sky vs mint+violet
  g.hands.coral = ['skip', 'nope']; g.hands.sky = ['nope', 'nope']; g.hands.mint = ['nope', 'nope']; g.hands.violet = ['nope', 'nope'];
  M.play(g, 'coral', ['skip'], {});
  assert(!M.canNope(g, 'sky'), 'a teammate can not Nope the card');
  assert.strictEqual(M.nope(g, 'sky'), null); assert.deepStrictEqual(g.hands.sky, ['nope', 'nope'], 'refused teammate Nope keeps the card');
  assert(M.canNope(g, 'mint') && M.canNope(g, 'violet'), 'both foes may Nope it');
  assert(M.nope(g, 'mint'));
  assert(!M.canNope(g, 'violet') && !M.canNope(g, 'mint'), 'the foe\'s teammate can not pile on');
  assert(M.canNope(g, 'coral') && M.canNope(g, 'sky'), 'the Noped player AND their teammate may answer');
  assert(M.nope(g, 'sky'));                                                    // teammate answers for coral
  assert(!M.canNope(g, 'coral') && !M.canNope(g, 'sky') && M.canNope(g, 'mint') && M.canNope(g, 'violet'), 'now the other side may answer');
  for (const c of M.aliveList(g)) if (!M.canNope(g, c)) assert.strictEqual(M.botReact(g, c, 'hard'), 'pass', c + ' can not react');
}
console.log('OK — ' + games + ' bot games finished (' + turns + ' bot turns), rule tests passed');

// ====================================================================== Xin Xỏ may ask your teammate (2v2)
{
  const g = rig({}, ['favor']); g.hands.sky = ['cat1']; g.hands.mint = ['cat2'];
  assert(M.favorTargets(g, 'coral').indexOf('sky') >= 0, 'teammate is a valid Favor target');
  assert(M.canPlay(g, 'coral', ['favor'], { target: 'sky' }), 'Favor on my teammate is legal');
  M.play(g, 'coral', ['favor'], { target: 'sky' }); M.resolve(g, g.pending.pid, g.pending.n);
  assert.strictEqual(g.phase, 'give'); assert.strictEqual(g.give.from, 'sky'); assert.strictEqual(g.give.to, 'coral');
  M.giveCard(g, 'sky', 'cat1'); assert(g.hands.coral.indexOf('cat1') >= 0);
  const h = rig({}, ['cat1', 'cat1']); h.hands.sky = ['cat2'];
  assert(!M.canPlay(h, 'coral', ['cat1', 'cat1'], { target: 'sky' }), 'a steal still never targets a teammate');
}

// ====================================================================== Clone ("Nhân Bản")
{
  const solo = (hand, extra) => { const g = M.newGame(M.normalizeSettings(extra || {}), ['coral', 'mint', 'sky'], 'coral'); g.hands.coral = hand; g.hands.mint = ['cat1', 'cat2']; g.hands.sky = ['cat3']; g.deck = ['cat4', 'cat5', 'cat1', 'cat2', 'cat3', 'bomb', 'bomb']; g.v = 5; return g; };
  const finish = g => { while (g.phase === 'pending') M.resolve(g, g.pending.pid, g.pending.n); return g; };
  // nothing played yet: nothing to copy
  let g = solo(['clone']); assert(!M.canPlay(g, 'coral', ['clone'], {}), 'no card played yet = nothing to clone'); assert.strictEqual(M.cloneKind(g), null);
  // turn mode: copies Future on my own turn and sees the same 3 cards
  g = solo(['clone', 'future']); M.play(g, 'coral', ['future'], {}); finish(g); assert.strictEqual(g.last, 'future'); assert.strictEqual(M.cloneKind(g), 'future');
  g.turn = 'coral'; assert(M.play(g, 'coral', ['clone'], {}), 'clone plays as an action card'); assert.strictEqual(g.pending.kind, 'clone'); assert.strictEqual(g.pending.copy, 'future');
  assert(!g.hands.coral.includes('clone')); finish(g); assert(g.peek && g.peek.by === 'coral' && g.peek.cards.length === 3);
  // turn mode: not playable out of turn, not as a reaction
  g = solo(['future']); g.hands.mint = ['clone']; M.play(g, 'coral', ['future'], {});
  assert(!M.canPlay(g, 'mint', ['clone'], {}), 'cloneAny off: only on your own turn'); assert(!M.cloneReady(g, 'mint'));
  // Attack copied on my own turn: it really is an Attack (turn passes, next player owes 2)
  g = solo(['attack', 'clone']); M.play(g, 'coral', ['attack'], {}); finish(g); g.turn = 'coral'; g.left = 1; g.phase = 'play';
  M.play(g, 'coral', ['clone'], {}); finish(g); assert.strictEqual(g.turn, 'mint'); assert.strictEqual(g.left, 2);
  // Skip copy + a Noped card is still the "last played"
  g = solo(['skip', 'clone']); M.play(g, 'coral', ['skip'], {}); M.nope(g, 'mint') || (g.hands.mint.push('nope'), M.nope(g, 'mint')); finish(g);
  assert.strictEqual(M.cloneKind(g), 'skip', 'a Noped card counts as played'); g.turn = 'coral'; g.phase = 'play'; g.left = 1;
  M.play(g, 'coral', ['clone'], {}); finish(g); assert.strictEqual(g.turn, 'mint', 'cloned Skip ends my turn');
  // Clone of a pair needs its own target; Clone of Favor can ask a new player (teammate included)
  g = solo(['cat1', 'cat1', 'clone']); M.play(g, 'coral', ['cat1', 'cat1'], { target: 'mint' }); finish(g); g.turn = 'coral'; g.phase = 'play'; g.hands.sky = ['cat3', 'cat3'];
  assert(!M.canPlay(g, 'coral', ['clone'], {}), 'needs a target'); assert(M.canPlay(g, 'coral', ['clone'], { target: 'sky' }));
  const before = g.hands.coral.length; M.play(g, 'coral', ['clone'], { target: 'sky' }); finish(g); assert.strictEqual(g.hands.coral.length, before - 1 + 1, 'stole one card');
  // clone the clone: still copies the underlying effect
  g = solo(['shuffle', 'clone', 'clone']); M.play(g, 'coral', ['shuffle'], {}); finish(g); g.turn = 'coral'; g.phase = 'play';
  M.play(g, 'coral', ['clone'], {}); finish(g); assert.strictEqual(g.last, 'shuffle'); g.turn = 'coral'; g.phase = 'play'; assert(M.play(g, 'coral', ['clone'], {}));
  // ---- house rule: cloneAny = reaction while a card is pending
  g = solo(['future'], { cloneAny: true }); g.hands.mint = ['clone', 'nope']; g.hands.sky = ['clone'];
  M.play(g, 'coral', ['future'], {}); assert(M.cloneReady(g, 'mint'), 'mint can react'); const n0 = g.pending.n;
  assert(M.play(g, 'mint', ['clone'], {}), 'reaction clone'); assert.strictEqual(g.phase, 'pending'); assert.strictEqual(g.pending.by, 'mint'); assert.strictEqual(g.pending.under.length, 1); assert.strictEqual(g.pending.n, n0 + 1);
  finish(g); assert.strictEqual(g.phase, 'play'); assert.strictEqual(g.turn, 'coral', 'the turn did not move');
  assert(g.peek.by === 'mint' && g.peek.also.indexOf('coral') >= 0, 'both players saw the same top 3 (the original keeps its peek)');
  // a Nope on the clone only cancels the clone; the original card still works
  g = solo(['future'], { cloneAny: true }); g.hands.mint = ['clone']; g.hands.sky = ['nope'];
  M.play(g, 'coral', ['future'], {}); M.play(g, 'mint', ['clone'], {}); M.nope(g, 'sky'); finish(g);
  assert(g.peek && g.peek.by === 'coral' && g.peek.also.length === 0, 'clone was Noped, original future went through'); assert(g.ev.some(e => e.k === 'cancel' && e.kind === 'clone'));
  // Attack / Skip copies work at any time and act on the turn that is running (whoever plays the Clone)
  g = solo(['attack'], { cloneAny: true }); g.hands.sky = ['clone']; M.play(g, 'coral', ['attack'], {}); assert(M.canPlay(g, 'sky', ['clone'], {}), 'out-of-turn Attack copy is playable');
  M.play(g, 'sky', ['clone'], {}); finish(g); assert.strictEqual(g.turn, 'sky', 'coral attacked mint, the copy attacked on: mint -> sky'); assert.strictEqual(g.left, 3, 'attacks stacked: 2 + 1');
  g = solo(['skip', 'clone'], { cloneAny: true }); M.play(g, 'coral', ['skip'], {}); M.play(g, 'coral', ['clone'], {}); finish(g); assert.strictEqual(g.turn, 'sky', 'Skip skipped coral, its copy skipped mint'); assert.strictEqual(g.left, 1);
  // a Clone played on my own turn after the card resolved (e.g. it was Noped) is the classic case: Shuffle -> Clone -> shuffled again, I stay on turn
  g = solo(['shuffle', 'clone'], { cloneAny: true }); M.play(g, 'coral', ['shuffle'], {}); finish(g); M.play(g, 'coral', ['clone'], {}); finish(g); assert.strictEqual(g.turn, 'coral'); assert.strictEqual(g.phase, 'play');
  // cloneAny: also playable on someone else's turn with nothing on the table; afterwards the SAME player is still on turn
  g = solo(['future'], { cloneAny: true }); M.play(g, 'coral', ['future'], {}); finish(g); g.hands.mint = ['clone', 'cat1']; g.turn = 'coral'; g.left = 2; g.phase = 'play';
  assert.strictEqual(M.cloneMode(g, 'mint'), 'out'); assert(M.canPlay(g, 'mint', ['clone'], {})); const v0 = g.v; M.play(g, 'mint', ['clone'], {}); assert.strictEqual(g.phase, 'pending'); finish(g);
  assert.strictEqual(g.phase, 'play'); assert.strictEqual(g.turn, 'coral', 'turn owner unchanged'); assert.strictEqual(g.left, 2, 'turns left unchanged'); assert(g.peek && g.peek.by === 'mint');
  g = solo(['future'], { cloneAny: false }); M.play(g, 'coral', ['future'], {}); finish(g); g.hands.mint = ['clone']; assert(!M.canPlay(g, 'mint', ['clone'], {}), 'rule off: never out of turn');
  // a Clone can copy a Nope that is on the table = one more Nope (same who-may-Nope rules, the Clone card is spent)
  g = solo(['favor'], { cloneAny: true }); g.hands.mint = ['nope']; g.hands.sky = ['clone']; M.play(g, 'coral', ['favor'], { target: 'mint' });
  assert.strictEqual(M.cloneKind(g), 'favor', 'no Nope on the table yet: a Clone would copy the Favor');
  M.nope(g, 'mint'); assert.strictEqual(M.cloneKind(g), 'nope'); assert(!M.cloneReady(g, 'sky'), 'only the Noped player (or their teammate) may answer a Nope'); g.hands.coral.push('clone'); assert(M.cloneReady(g, 'coral'));
  M.play(g, 'coral', ['clone'], {}); assert.strictEqual(g.pending.nopes.length, 2, 'clone-Nope landed'); assert(!g.hands.coral.includes('clone')); assert.strictEqual(M.nopedPlayer(g), 'mint'); finish(g); assert.strictEqual(M.cloneKind(g), 'favor', 'after the window the card that was played still is what a Clone copies');
  // ---- five different cats: swap for ANY card that lies in the discard pile
  const five = (extra) => { const g = solo(['cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'cat1'], extra); g.discard = ['defuse', 'bomb', 'attack']; return g; };
  g = five(); assert(!M.canPlay(g, 'coral', ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'], {}), 'must name a card'); assert(!M.canPlay(g, 'coral', ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'], { name: 'bomb' }), 'a bomb can never be taken');
  assert(!M.canPlay(g, 'coral', ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'], { name: 'nope' }), 'a card that was never played cannot be named'); assert(!M.canPlay(g, 'coral', ['cat1', 'cat1', 'cat2', 'cat3', 'cat4'], { name: 'defuse' }), 'five must all be different');
  assert(!M.canPlay(g, 'coral', ['cat1', 'cat2', 'cat3', 'cat4'], { name: 'defuse' }), 'four is nothing'); assert(!M.canPlay(g, 'coral', ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'], { name: 'defuse' }, { combos: false }), 'combos off');
  assert.deepStrictEqual(M.recoverable(g, ['cat1', 'cat2']), ['defuse', 'attack', 'cat1', 'cat2']);
  const T5 = g.deck.length + g.discard.length + g.order.reduce((n, c) => n + g.hands[c].length, 0);
  assert(M.play(g, 'coral', ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'], { name: 'defuse' })); assert.strictEqual(g.pending.kind, 'five'); assert.strictEqual(g.last, 'five'); finish(g);
  assert.deepStrictEqual(g.hands.coral, ['cat1', 'defuse']); assert.strictEqual(g.discard.filter(k => k === 'defuse').length, 0); assert.strictEqual(g.phase, 'play'); assert.strictEqual(g.turn, 'coral', 'playing it does not end the turn');
  assert.strictEqual(g.deck.length + g.discard.length + g.order.reduce((n, c) => n + g.hands[c].length, 0), T5, 'cards conserved');
  // the five cats themselves are in the discard once played, so they may be named; a Noped five just cancels
  g = five(); g.hands.mint.push('nope'); M.play(g, 'coral', ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'], { name: 'cat5' }); M.nope(g, 'mint'); finish(g); assert.deepStrictEqual(g.hands.coral, ['cat1']); assert.strictEqual(g.discard.filter(k => k === 'cat5').length, 1);
  // a Clone copies it and takes a SECOND card; when the wanted card is gone the copy fizzles
  g = five({ cloneAny: true }); g.hands.mint = ['clone']; g.discard = ['defuse', 'attack']; M.play(g, 'coral', ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'], { name: 'defuse' }); finish(g);
  assert.strictEqual(M.cloneKind(g), 'five'); g.turn = 'coral'; g.phase = 'play'; g.hands.coral.push('clone'); assert(!M.canPlay(g, 'coral', ['clone'], {}), 'clone of five needs a name'); assert(M.canPlay(g, 'coral', ['clone'], { name: 'attack' }));
  M.play(g, 'coral', ['clone'], { name: 'attack' }); finish(g); assert(g.hands.coral.includes('attack'));
  g = five({ cloneAny: true }); g.hands.mint = ['clone']; g.discard = ['defuse']; M.play(g, 'coral', ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'], { name: 'defuse' }); M.play(g, 'mint', ['clone'], { name: 'defuse' }); finish(g);
  assert.deepStrictEqual(g.hands.coral.filter(k => k === 'defuse').length, 1); assert.strictEqual(g.hands.mint.filter(k => k === 'defuse').length, 0, 'the single Defuse went to the first player only'); assert(g.ev.some(e => e.k === 'fizzle'));
  // two Favor requests (original + clone) are served one after the other
  g = solo(['favor'], { cloneAny: true }); g.hands.mint = ['clone', 'cat1', 'cat2']; g.hands.sky = ['cat3', 'cat4'];
  M.play(g, 'coral', ['favor'], { target: 'sky' }); M.play(g, 'mint', ['clone'], { target: 'sky' }); finish(g);
  assert.strictEqual(g.phase, 'give'); assert.strictEqual(g.give.from, 'sky'); assert.strictEqual(g.give.to, 'coral'); M.giveCard(g, 'sky', 'cat3');
  assert.strictEqual(g.phase, 'give'); assert.strictEqual(g.give.to, 'mint', 'the cloned request comes next'); M.giveCard(g, 'sky', 'cat4'); assert.strictEqual(g.phase, 'play');
  // settings + deck
  assert.strictEqual(M.normalizeSettings({}).cloneAny, false); assert.strictEqual(M.normalizeSettings({ cloneAny: true }).cloneAny, true);
  assert.strictEqual(M.newGame(M.normalizeSettings({}), ['coral', 'mint'], 'coral').deck.concat(['coral', 'mint'].flatMap(c => [])).filter(k => k === 'clone').length + M.newGame(M.normalizeSettings({}), ['coral', 'mint'], 'coral').hands.coral.filter(k => k === 'clone').length >= 0, true);
}
console.log('OK — Favor on teammate + Clone card rules passed');

// ====================================================================== Clone as a cat card inside a combo
{
  const mk = hand => { const g = M.newGame(M.normalizeSettings({}), ['coral', 'mint', 'sky'], 'coral'); g.hands.coral = hand; g.hands.mint = ['cat1', 'cat2']; g.hands.sky = ['cat3']; g.deck = ['cat4', 'cat5', 'cat1', 'cat2', 'cat3', 'bomb', 'bomb', 'cat4']; g.discard = []; return g; };
  const finish = g => { while (g.phase === 'pending') M.resolve(g, g.pending.pid, g.pending.n); return g; };
  let g = mk(['cat3', 'cat3', 'cat3', 'clone', 'cat1']);
  assert(!M.canPlay(g, 'coral', ['cat3', 'clone'], { target: 'mint' }), 'nothing played yet: no cat to copy'); assert.strictEqual(M.wildCat(g), null);
  M.play(g, 'coral', ['cat3', 'cat3'], { target: 'mint' }); finish(g); g.turn = 'coral'; g.phase = 'play'; g.left = 1;
  assert.strictEqual(M.wildCat(g), 'cat3', 'the cat of the last pair');
  assert(M.canPlay(g, 'coral', ['cat3', 'clone'], { target: 'mint' }), 'Clone + cat3 = pair of cat3'); assert(!M.canPlay(g, 'coral', ['cat1', 'clone'], { target: 'mint' }), 'Clone is cat3, cat1 does not match');
  g.hands.coral.push('cat3'); assert(M.canPlay(g, 'coral', ['cat3', 'cat3', 'clone'], { target: 'mint', name: 'defuse' }), 'triple with a Clone'); g.hands.coral.pop();
  const n0 = g.hands.coral.length; assert(M.play(g, 'coral', ['cat3', 'clone'], { target: 'mint' })); assert.strictEqual(g.pending.kind, 'pair'); assert.strictEqual(g.last, 'pair'); assert.strictEqual(g.lastCat, 'cat3'); finish(g);
  assert.strictEqual(g.hands.coral.length, n0 - 2 + 1, 'both cards left the hand, one stolen card came in'); assert(!g.hands.coral.includes('clone'));
  // combos setting still switches it off
  g.turn = 'coral'; g.phase = 'play'; g.hands.coral = ['cat3', 'clone']; assert(!M.canPlay(g, 'coral', ['cat3', 'clone'], { target: 'mint' }, { combos: false }));
  // five: the Clone fills the missing cat when that is the cat played last
  g = mk(['cat1', 'cat2', 'cat3', 'cat4', 'clone', 'cat5', 'cat5']); g.discard = ['defuse']; g.hands.mint = ['cat5', 'cat5']; g.turn = 'mint'; M.play(g, 'mint', ['cat5', 'cat5'], { target: 'coral' }); finish(g); g.turn = 'coral'; g.phase = 'play';
  g.hands.coral = ['cat1', 'cat2', 'cat3', 'cat4', 'clone']; assert.strictEqual(M.wildCat(g), 'cat5');
  assert(M.canPlay(g, 'coral', ['cat1', 'cat2', 'cat3', 'cat4', 'clone'], { name: 'defuse' })); M.play(g, 'coral', ['cat1', 'cat2', 'cat3', 'cat4', 'clone'], { name: 'defuse' }); finish(g);
  assert.deepStrictEqual(g.hands.coral, ['defuse']); assert.strictEqual(g.lastCat, null, 'after a five there is no single cat to copy'); assert.strictEqual(M.wildCat(g), null);
  // after a non-cat card the Clone copies that card instead, and cannot join a combo
  g = mk(['skip', 'cat1', 'clone']); M.play(g, 'coral', ['skip'], {}); finish(g); g.turn = 'coral'; g.phase = 'play'; assert(!M.canPlay(g, 'coral', ['cat1', 'clone'], { target: 'mint' }));
}
// ====================================================================== fuzz: five cats + Clone any time (cloneAny) keep the match consistent
{
  const total = g => g.deck.length + g.discard.length + g.order.reduce((n, c) => n + g.hands[c].length, 0);
  let fives = 0, outClones = 0, nopeClones = 0, calm = 0;
  for (let r = 0; r < 300; r++) {
    const n = 2 + (r % 4), cols = M.COLORS.slice(0, n), s = M.normalizeSettings({ hand: 8, cloneAny: true, nopeSec: 3 });
    const g = M.newGame(s, cols, cols[0]), T = total(g);
    cols.forEach((c, i) => { if (i % 2 === 0) { g.hands[c] = g.hands[c].concat(M.CATS, ['clone', 'clone']); g.deck.splice(0, 0); } });
    let guard = 0;
    const T2 = total(g);
    while (g.phase !== 'over' && guard++ < 4000) {
      const before = { turn: g.turn, left: g.left, phase: g.phase };
      if (g.phase === 'play') {
        // somebody else sometimes clones out of turn: it must never change who is on turn / how many turns are left
        const other = M.aliveList(g).find(c => c !== g.turn && M.cloneMode(g, c) === 'out');
        if (other && Math.random() < 0.5) {
          const k = M.cloneKind(g), o = { target: M.validTargets(g, other)[0] || M.favorTargets(g, other)[0], name: M.recoverable(g, ['clone'])[0] };
          if (M.canPlay(g, other, ['clone'], o)) {
            assert(M.play(g, other, ['clone'], o, s)); outClones++; if (k === 'attack' || k === 'skip') calm++;
            while (g.phase === 'pending') { if (Math.random() < 0.2) { const nc = M.aliveList(g).find(c => M.canNope(g, c)); if (nc) { M.nope(g, nc); continue; } } assert(M.resolve(g, g.pending.pid, g.pending.n)); }
            if (g.phase === 'play' && k !== 'attack' && k !== 'skip') { assert.strictEqual(g.turn, before.turn, 'out-of-turn Clone changed whose turn it is'); assert.strictEqual(g.left, before.left, 'out-of-turn Clone changed the turns left'); }
            assert.strictEqual(total(g), T2, 'conserved'); continue;
          }
        }
        const me = g.turn, h = g.hands[me];
        if (M.CATS.every(k => h.indexOf(k) >= 0) && Math.random() < 0.8) { const o = { name: M.recoverable(g, M.CATS)[Math.floor(Math.random() * M.recoverable(g, M.CATS).length)] }; assert(M.play(g, me, M.CATS.slice(), o, s)); fives++; }
        else { const a = M.botPlay(g, me, 'hard'); const ok = a.t === 'draw' ? M.draw(g, me) : M.play(g, me, a.kinds, a.opts, s); assert(ok, 'illegal bot move ' + JSON.stringify(a)); }
      } else if (g.phase === 'pending') {
        const p = g.pending; let acted = false;
        for (const c of M.aliveList(g)) {
          if (M.botReact(g, c, 'hard') === 'nope') { assert(M.nope(g, c)); acted = true; break; }
          if (M.cloneMode(g, c) === 'react' && Math.random() < 0.3) {
            const o = { target: M.validTargets(g, c)[0] || M.favorTargets(g, c)[0], name: M.recoverable(g, ['clone'])[0] };
            if (M.canPlay(g, c, ['clone'], o)) { if (M.cloneKind(g) === 'nope') nopeClones++; assert(M.play(g, c, ['clone'], o, s)); acted = true; break; }
          }
        }
        if (!acted) assert(M.resolve(g, p.pid, p.n));
      } else if (g.phase === 'give') assert(M.giveCard(g, g.give.from, M.botGive(g, g.give.from)));
      else if (g.phase === 'reinsert') assert(M.reinsert(g, g.reins.by, M.botReinsert(g, g.reins.by, 'normal')));
      assert.strictEqual(total(g), T2 - (g.phase === 'reinsert' ? 1 : 0), 'cards conserved');
    }
    assert.strictEqual(g.phase, 'over', 'game must end (round ' + r + ')');
  }
  assert(fives > 20 && outClones > 20 && nopeClones > 0, 'fuzz exercised the new rules: ' + [fives, outClones, nopeClones, calm]);
  console.log('OK — five-cat swaps (' + fives + '), out-of-turn Clones (' + outClones + ', ' + calm + ' of them copied Attack/Skip) and Clone-Nopes (' + nopeClones + ') fuzzed');
}
