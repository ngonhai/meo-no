// meow-engine.js — pure rules for "Mèo Nổ" (no DOM, no Firebase). Every function that changes the game
// mutates the game object it is given and returns it, or returns null (and changes nothing) if illegal.
// The net layer always hands it a deep copy, so "mutate in place" is safe.
//
// Cards are plain strings ("kind"). Hands/deck/discard are arrays of kinds.
const Meow = (function () {
  'use strict';
  const COLORS = ['coral', 'mint', 'sky', 'violet', 'pink'];
  const CATS = ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'];
  const ACTIONS = ['attack', 'skip', 'favor', 'shuffle', 'future'];
  const COUNTS = { attack: 4, skip: 4, favor: 4, nope: 5, shuffle: 4, future: 5, cat1: 4, cat2: 4, cat3: 4, cat4: 4, cat5: 4 };
  const STEALABLE = ['defuse', 'attack', 'skip', 'favor', 'nope', 'shuffle', 'future'].concat(CATS);
  const BOT_LEVELS = ['easy', 'normal', 'hard'];
  const DEFAULT_SETTINGS = { nopeSec: 5, hand: 7, combos: true };
  const NOPE_SECS = [3, 5, 8, 12];

  function normalizeSettings(s) {
    s = Object.assign({}, DEFAULT_SETTINGS, s || {});
    s.nopeSec = NOPE_SECS.indexOf(+s.nopeSec) >= 0 ? +s.nopeSec : 5;
    s.hand = Math.max(4, Math.min(8, parseInt(s.hand, 10) || 7));
    s.combos = s.combos !== false;
    return s;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const cnt = (a, k) => a.reduce((n, x) => n + (x === k ? 1 : 0), 0);
  const arr = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);

  // Firebase drops empty arrays / turns arrays into objects: put everything back in shape.
  function normalize(g) {
    if (!g) return g;
    g.order = arr(g.order); g.deck = arr(g.deck); g.discard = arr(g.discard); g.log = arr(g.log); g.ev = arr(g.ev);
    g.alive = g.alive || {}; g.hands = g.hands || {};
    g.order.forEach(c => { g.hands[c] = arr(g.hands[c]); });
    if (g.pending) { g.pending.kinds = arr(g.pending.kinds); g.pending.nopes = arr(g.pending.nopes); g.pending.passes = g.pending.passes || {}; }
    if (g.peek) { g.peek.cards = arr(g.peek.cards); if (!g.peek.cards.length) g.peek = null; }
    g.log.forEach(e => { if (e.kinds) e.kinds = arr(e.kinds); if (e.cards) e.cards = arr(e.cards); });
    g.ev.forEach(e => { if (e.kinds) e.kinds = arr(e.kinds); if (e.cards) e.cards = arr(e.cards); });
    return g;
  }

  function newGame(settings, colors, first) {
    settings = normalizeSettings(settings);
    const order = COLORS.filter(c => colors.indexOf(c) >= 0), n = order.length;
    const deck = [];
    Object.keys(COUNTS).forEach(k => { for (let i = 0; i < COUNTS[k]; i++) deck.push(k); });
    shuffle(deck);
    const hands = {}, alive = {};
    order.forEach(c => { hands[c] = deck.splice(0, settings.hand).concat(['defuse']); alive[c] = true; });
    const extra = Math.min(6 - n, n <= 4 ? 2 : 1);
    for (let i = 0; i < extra; i++) deck.push('defuse');
    for (let i = 0; i < n - 1; i++) deck.push('bomb');
    shuffle(deck);
    return { v: 0, pid: 0, order, alive, hands, deck, discard: [], turn: order.indexOf(first) >= 0 ? first : order[0], left: 1,
             phase: 'play', pending: null, give: null, reins: null, peek: null, winner: null, log: [], ev: [] };
  }

  const aliveList = g => g.order.filter(c => g.alive[c]);
  function nextAlive(g, from) {
    const i = g.order.indexOf(from);
    for (let s = 1; s <= g.order.length; s++) { const c = g.order[(i + s) % g.order.length]; if (g.alive[c]) return c; }
    return from;
  }
  function logEv(g, e) { g.ev.push(e); g.log.push(e); if (g.log.length > 60) g.log.shift(); }
  function startAction(g) { g.ev = []; g.v++; }
  function removeOne(hand, k) { const i = hand.indexOf(k); if (i < 0) return false; hand.splice(i, 1); return true; }

  // ---- turn flow --------------------------------------------------------------------------------
  function endTurns(g, attack) {
    if (attack) { g.left = g.left + 1; g.turn = nextAlive(g, g.turn); }
    else { g.left--; if (g.left <= 0) { g.turn = nextAlive(g, g.turn); g.left = 1; } }
    g.phase = 'play';
    logEv(g, { k: 'turn', by: g.turn, left: g.left });
  }
  function eliminate(g, c) {
    g.discard = g.discard.concat(g.hands[c], ['bomb']); g.hands[c] = []; g.alive[c] = false;
    logEv(g, { k: 'explode', by: c });
    const live = aliveList(g);
    if (live.length <= 1) { g.phase = 'over'; g.winner = live[0] || null; logEv(g, { k: 'win', by: g.winner }); return; }
    if (g.turn === c) { g.turn = nextAlive(g, c); g.left = 1; }
    g.phase = 'play'; g.pending = null;
    logEv(g, { k: 'turn', by: g.turn, left: g.left });
  }
  function ensureDeck(g) {            // safety net: never draw from an empty pile
    if (g.deck.length) return;
    const back = g.discard.filter(k => k !== 'bomb'); g.discard = g.discard.filter(k => k === 'bomb');
    g.deck = shuffle(back); g.peek = null;
  }

  function draw(g, c) {
    if (g.phase !== 'play' || g.turn !== c || !g.alive[c]) return null;
    startAction(g); ensureDeck(g);
    const card = g.deck.shift();
    if (g.peek) { g.peek.cards.shift(); if (!g.peek.cards.length) g.peek = null; }
    if (card === 'bomb') {
      logEv(g, { k: 'bomb', by: c });
      if (removeOne(g.hands[c], 'defuse')) { g.discard.push('defuse'); g.phase = 'reinsert'; g.reins = { by: c }; logEv(g, { k: 'defuse', by: c }); }
      else eliminate(g, c);
      return g;
    }
    g.hands[c].push(card); logEv(g, { k: 'draw', by: c, left: g.deck.length });
    endTurns(g, false);
    return g;
  }
  function reinsert(g, c, pos) {
    if (g.phase !== 'reinsert' || !g.reins || g.reins.by !== c) return null;
    startAction(g);
    pos = Math.max(0, Math.min(g.deck.length, parseInt(pos, 10) || 0));
    g.deck.splice(pos, 0, 'bomb');
    if (g.peek && pos < g.peek.cards.length) { g.peek.cards = g.peek.cards.slice(0, pos); if (!g.peek.cards.length) g.peek = null; }
    g.reins = null; logEv(g, { k: 'reinsert', by: c });
    endTurns(g, false);
    return g;
  }

  // ---- playing cards --------------------------------------------------------------------------------
  function kindOf(kinds) { return kinds.length === 1 ? kinds[0] : (kinds.length === 2 ? 'pair' : 'triple'); }
  function needsTarget(kinds) { const k = kindOf(kinds); return k === 'favor' || k === 'pair' || k === 'triple'; }
  function validTargets(g, c) { return aliveList(g).filter(o => o !== c && g.hands[o].length > 0); }
  // opts: {target, name}.  settings is optional (only `combos` is read).
  function canPlay(g, c, kinds, opts, settings) {
    opts = opts || {};
    if (!g || g.phase !== 'play' || g.turn !== c || !g.alive[c] || !kinds || !kinds.length || kinds.length > 3) return false;
    const h = g.hands[c], need = {};
    kinds.forEach(k => { need[k] = (need[k] || 0) + 1; });
    if (Object.keys(need).some(k => cnt(h, k) < need[k])) return false;
    if (kinds.length === 1) {
      if (ACTIONS.indexOf(kinds[0]) < 0) return false;
      if (kinds[0] === 'favor') return validTargets(g, c).indexOf(opts.target) >= 0;
      return true;
    }
    if (settings && settings.combos === false) return false;
    if (Object.keys(need).length !== 1 || CATS.indexOf(kinds[0]) < 0) return false;
    if (validTargets(g, c).indexOf(opts.target) < 0) return false;
    if (kinds.length === 3 && STEALABLE.indexOf(opts.name) < 0) return false;
    return true;
  }
  function play(g, c, kinds, opts, settings) {
    if (!canPlay(g, c, kinds, opts, settings)) return null;
    startAction(g); opts = opts || {};
    kinds.forEach(k => { removeOne(g.hands[c], k); g.discard.push(k); });
    g.pid++;
    g.phase = 'pending';
    g.pending = { pid: g.pid, by: c, kinds: kinds.slice(), kind: kindOf(kinds), target: needsTarget(kinds) ? opts.target : null, name: kinds.length === 3 ? opts.name : null, nopes: [], passes: {}, n: 0 };
    logEv(g, { k: 'play', by: c, kinds: kinds.slice(), kind: g.pending.kind, target: g.pending.target || null, name: g.pending.name || null });
    return g;
  }
  const canNope = (g, c) => !!g && g.phase === 'pending' && !!g.alive[c] && g.hands[c].indexOf('nope') >= 0;
  function nope(g, c) {
    if (!canNope(g, c)) return null;
    startAction(g);
    removeOne(g.hands[c], 'nope'); g.discard.push('nope');
    g.pending.nopes.push(c); g.pending.n++; g.pending.passes = {};
    logEv(g, { k: 'nope', by: c, n: g.pending.nopes.length });
    return g;
  }
  function pass(g, c, pid, n) {              // does not bump v: it is not a game event
    if (!g || g.phase !== 'pending' || !g.pending || g.pending.pid !== pid || g.pending.n !== n || !g.alive[c]) return null;
    g.pending.passes[c] = 1; return g;
  }
  function allPassed(g) { return !!g.pending && aliveList(g).every(c => g.pending.passes[c]); }

  function resolve(g, pid, n) {
    if (!g || g.phase !== 'pending' || !g.pending || g.pending.pid !== pid || g.pending.n !== n) return null;
    startAction(g);
    const p = g.pending, c = p.by; g.pending = null;
    g.phase = 'play';
    if (p.nopes.length % 2 === 1) { logEv(g, { k: 'cancel', by: c, kind: p.kind }); return g; }
    const tgt = p.target;
    switch (p.kind) {
      case 'attack': logEv(g, { k: 'attack', by: c }); endTurns(g, true); break;
      case 'skip': logEv(g, { k: 'skip', by: c }); endTurns(g, false); break;
      case 'shuffle': shuffle(g.deck); g.peek = null; logEv(g, { k: 'shuffle', by: c }); break;
      case 'future': ensureDeck(g); g.peek = { by: c, cards: g.deck.slice(0, 3) }; logEv(g, { k: 'future', by: c, cards: g.deck.slice(0, 3) }); break;
      case 'favor':
        if (g.alive[tgt] && g.hands[tgt].length) { g.phase = 'give'; g.give = { from: tgt, to: c }; logEv(g, { k: 'favor', by: c, target: tgt }); }
        else logEv(g, { k: 'fizzle', by: c });
        break;
      case 'pair': case 'triple': {
        if (!g.alive[tgt] || !g.hands[tgt].length) { logEv(g, { k: 'fizzle', by: c }); break; }
        if (p.kind === 'pair') {
          const i = Math.floor(Math.random() * g.hands[tgt].length), card = g.hands[tgt].splice(i, 1)[0];
          g.hands[c].push(card); logEv(g, { k: 'steal', by: c, from: tgt, card });
        } else if (removeOne(g.hands[tgt], p.name)) {
          g.hands[c].push(p.name); logEv(g, { k: 'steal', by: c, from: tgt, card: p.name, named: true });
        } else logEv(g, { k: 'miss', by: c, from: tgt, name: p.name });
        break;
      }
    }
    return g;
  }
  function giveCard(g, c, kind) {
    if (g.phase !== 'give' || !g.give || g.give.from !== c || g.hands[c].indexOf(kind) < 0) return null;
    startAction(g);
    removeOne(g.hands[c], kind); g.hands[g.give.to].push(kind);
    logEv(g, { k: 'give', from: c, by: g.give.to, card: kind });
    g.give = null; g.phase = 'play';
    return g;
  }

  // ---- bots ---------------------------------------------------------------------------------------------
  const THRESH = { easy: 0.5, normal: 0.26, hard: 0.16 };
  function bombProb(g) { return g.deck.length ? (aliveList(g).length - 1) / g.deck.length : 1; }
  const knownTop = (g, c) => (g.peek && g.peek.by === c && g.peek.cards.length) ? g.peek.cards[0] : null;
  function bestTarget(g, c) { const t = validTargets(g, c); t.sort((a, b) => g.hands[b].length - g.hands[a].length); return t[0] || null; }

  // One decision while it is `c`'s turn (phase 'play'): {t:'play', kinds, opts} or {t:'draw'}
  function botPlay(g, c, level) {
    level = BOT_LEVELS.indexOf(level) >= 0 ? level : 'normal';
    const h = g.hands[c], has = k => cnt(h, k) > 0, pb = bombProb(g), top = level === 'easy' ? null : knownTop(g, c);
    const defuses = cnt(h, 'defuse');
    const risky = (pb > THRESH[level] && defuses === 0) || (pb > 0.5 && level !== 'easy');
    const play = (kinds, opts) => ({ t: 'play', kinds, opts: opts || {} });
    if (top === 'bomb' && defuses === 0) {
      if (has('skip')) return play(['skip']);
      if (has('attack')) return play(['attack']);
      if (has('shuffle')) return play(['shuffle']);
    } else if (top && top !== 'bomb') {
      return { t: 'draw' };
    } else if (risky) {
      if (has('skip') && (level !== 'hard' || !has('attack') || Math.random() < 0.5)) return play(['skip']);
      if (has('attack')) return play(['attack']);
      if (has('skip')) return play(['skip']);
    }
    if (level !== 'easy' && has('future') && !top && Math.random() < 0.7 && g.deck.length > 3) return play(['future']);
    const tgt = bestTarget(g, c);
    if (tgt && Math.random() < (level === 'easy' ? 0.15 : 0.55)) {
      for (const k of CATS) {
        if (cnt(h, k) >= 3 && level === 'hard') return play([k, k, k], { target: tgt, name: ['defuse', 'nope', 'skip', 'attack'][Math.floor(Math.random() * 4)] });
        if (cnt(h, k) >= 2) return play([k, k], { target: tgt });
      }
      if (has('favor')) return play(['favor'], { target: tgt });
    }
    if (level === 'easy' && Math.random() < 0.15) {
      const o = ['skip', 'attack', 'shuffle', 'future'].filter(has);
      if (o.length) return play([o[Math.floor(Math.random() * o.length)]]);
    }
    return { t: 'draw' };
  }
  function botReact(g, c, level) {          // phase 'pending': 'nope' or 'pass'
    level = BOT_LEVELS.indexOf(level) >= 0 ? level : 'normal';
    if (!canNope(g, c)) return 'pass';
    const p = g.pending, cancelled = p.nopes.length % 2 === 1, mine = p.by === c, P = { easy: 0.3, normal: 0.7, hard: 0.95 }[level];
    if (mine) return cancelled && Math.random() < P ? 'nope' : 'pass';
    const hurts = p.target === c || (p.kind === 'attack' && nextAlive(g, p.by) === c);
    if (!cancelled && hurts) return Math.random() < P ? 'nope' : 'pass';
    if (!cancelled && level === 'hard' && (p.kind === 'future' || p.kind === 'favor') && Math.random() < 0.2) return 'nope';
    return 'pass';
  }
  function botGive(g, c) {
    const h = g.hands[c], order = ['shuffle', 'future', 'favor', 'skip', 'attack', 'nope', 'defuse'];
    const singles = CATS.filter(k => cnt(h, k) === 1); if (singles.length) return singles[0];
    const anyCat = CATS.filter(k => cnt(h, k) > 0); if (anyCat.length) return anyCat[0];
    for (const k of order) if (cnt(h, k) > 0) return k;
    return h[0];
  }
  function botReinsert(g, c, level) {
    const n = g.deck.length;
    if (level === 'easy') return Math.floor(Math.random() * (n + 1));
    if (level === 'hard') return Math.random() < 0.6 ? 0 : Math.floor(Math.random() * (n + 1));
    return Math.random() < 0.4 ? Math.min(1, n) : Math.floor(Math.random() * (n + 1));
  }

  return { COLORS, CATS, ACTIONS, COUNTS, STEALABLE, BOT_LEVELS, DEFAULT_SETTINGS, NOPE_SECS, normalizeSettings, normalize, newGame, aliveList, nextAlive, cnt,
           draw, reinsert, canPlay, play, canNope, nope, pass, allPassed, resolve, giveCard, needsTarget, validTargets, kindOf, bombProb,
           botPlay, botReact, botGive, botReinsert, shuffle };
})();
if (typeof module !== 'undefined') module.exports = Meow;
