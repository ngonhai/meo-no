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
  const COUNTS = { attack: 4, skip: 4, favor: 4, nope: 5, shuffle: 4, future: 5, clone: 3, cat1: 4, cat2: 4, cat3: 4, cat4: 4, cat5: 4 };
  const STEALABLE = ['defuse', 'attack', 'skip', 'favor', 'nope', 'shuffle', 'future', 'clone'].concat(CATS);
  const BOT_LEVELS = ['easy', 'normal', 'hard'];
  const MODES = ['solo', 'team'];                       // solo = free-for-all, team = 2v2 (exactly 4 seats, teammates sit opposite)
  const COOP_TRIGGERS = ['nodefuse', 'always'];         // team mode: minigame only when the drawer has no Defuse / on every bomb
  // Bomb heat (2v2): a bomb that was defused and slid back is hotter by one level. Heat travels WITH the card string ('bomb', 'bomb1', 'bomb2', 'bomb3'),
  // so Shuffle / the reshuffle keep it. Hotter bomb = harder minigame; at MAX_HEAT the minigame can't defuse it any more (a Defuse card or boom).
  const MAX_HEAT = 3;
  const isBomb = k => typeof k === 'string' && k.indexOf('bomb') === 0;
  const heatOf = k => { const m = /^bomb(\d)$/.exec(k || ''); return m ? Math.min(MAX_HEAT, +m[1]) : 0; };
  const bombCard = h => h > 0 ? 'bomb' + Math.min(MAX_HEAT, h) : 'bomb';
  const baseKind = k => isBomb(k) ? 'bomb' : k;
  const COOP_GAMES = ['zigzag', 'wires', 'lock', 'maze'];       // the cooperative defuse minigames (see js/meow-coop.js)
  const DEFAULT_SETTINGS = { nopeSec: 5, hand: 7, combos: true, mode: 'solo', coop: 'nodefuse', coopGhost: false, bombHeat: true, suddenBomb: true, cloneAny: false, dodgeAtk: false };
  const NOPE_SECS = [3, 5, 8, 12];

  function normalizeSettings(s) {
    s = Object.assign({}, DEFAULT_SETTINGS, s || {});
    s.nopeSec = NOPE_SECS.indexOf(+s.nopeSec) >= 0 ? +s.nopeSec : 5;
    s.hand = Math.max(4, Math.min(8, parseInt(s.hand, 10) || 7));
    s.combos = s.combos !== false;
    s.mode = MODES.indexOf(s.mode) >= 0 ? s.mode : 'solo';
    s.coop = COOP_TRIGGERS.indexOf(s.coop) >= 0 ? s.coop : 'nodefuse';
    s.bombHeat = s.bombHeat !== false; s.suddenBomb = s.suddenBomb !== false;   // team mode anti-stalemate rules (see README)
    s.dodgeAtk = s.dodgeAtk === true;                  // Attack: false = while you are attacked you can neither Attack nor Skip; true = a Skip may still cancel ONE of the owed turns per card
    s.cloneAny = s.cloneAny === true;                  // Clone: false = only on your own turn, true = also as a reaction while a card is pending
    s.coopGhost = s.coopGhost === true;                // team mode: an already-exploded teammate may still help with the defuse minigame
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
    g.giveQ = arr(g.giveQ);
    if (g.pending) { g.pending.kinds = arr(g.pending.kinds); g.pending.nopes = arr(g.pending.nopes); g.pending.passes = g.pending.passes || {}; g.pending.under = arr(g.pending.under); g.pending.under.forEach(u => { u.kinds = arr(u.kinds); }); }
    if (g.peek) { g.peek.also = arr(g.peek.also); g.peek.cards = arr(g.peek.cards); if (!g.peek.cards.length) g.peek = null; }
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
    const team = settings.mode === 'team' && n === 4;
    const teams = team ? { [order[0]]: 'A', [order[1]]: 'B', [order[2]]: 'A', [order[3]]: 'B' } : null;   // teammates sit opposite each other
    return { v: 0, pid: 0, order, alive, hands, deck, discard: [], turn: order.indexOf(first) >= 0 ? first : order[0], left: 1,
             phase: 'play', pending: null, give: null, reins: null, rescue: null, peek: null, winner: null, winTeam: null,
             mode: team ? 'team' : 'solo', coop: settings.coop, coopGhost: settings.coopGhost, teams, lastCoop: null, cloneAny: !!settings.cloneAny, dodgeAtk: !!settings.dodgeAtk, last: null, lastCat: null, giveQ: [], heatOn: !!(team && settings.bombHeat), suddenOn: !!(team && settings.suddenBomb), bheat: 0, extra: 0, log: [], ev: [] };
  }
  // ---- teams (2v2) ------------------------------------------------------------------------------------
  const teamOf = (g, c) => (g && g.teams && g.teams[c]) || null;
  const isAlly = (g, a, b) => !!g && !!g.teams && a !== b && g.teams[a] === g.teams[b];
  const mateOf = (g, c) => (g && g.teams) ? (g.order.find(o => o !== c && g.teams[o] === g.teams[c]) || null) : null;
  const aliveMate = (g, c) => { const m = mateOf(g, c); return m && g.alive[m] ? m : null; };
  function previewTeams(colors) {                       // same pairing newGame uses, for the waiting room
    const order = COLORS.filter(c => colors.indexOf(c) >= 0), out = {};
    if (order.length === 4) order.forEach((c, i) => { out[c] = i % 2 ? 'B' : 'A'; });
    return out;
  }

  const aliveList = g => g.order.filter(c => g.alive[c]);
  function nextAlive(g, from) {
    const i = g.order.indexOf(from);
    for (let s = 1; s <= g.order.length; s++) { const c = g.order[(i + s) % g.order.length]; if (g.alive[c]) return c; }
    return from;
  }
  function nextFoe(g, from) {         // next living player that is not on `from`'s team (who an Attack lands on in 2v2)
    const i = g.order.indexOf(from);
    for (let s = 1; s <= g.order.length; s++) { const c = g.order[(i + s) % g.order.length]; if (g.alive[c] && c !== from && !isAlly(g, from, c)) return c; }
    return nextAlive(g, from);
  }
  // `ev` (this action's events, drives animations / the receiver's toast) keeps card names; the permanent `log` never does,
  // so nobody can read which card was given / stolen / peeked at afterwards.
  function logEv(g, e) { g.ev.push(e); const l = Object.assign({}, e); delete l.card; delete l.cards; g.log.push(l); if (g.log.length > 60) g.log.shift(); }
  function startAction(g) { g.ev = []; g.v++; }
  function removeOne(hand, k) { const i = hand.indexOf(k); if (i < 0) return false; hand.splice(i, 1); return true; }

  // ---- turn flow --------------------------------------------------------------------------------
  function endTurns(g, attack) {
    if (attack) { g.left = g.left + 1; g.turn = g.teams ? nextFoe(g, g.turn) : nextAlive(g, g.turn); }
    else { g.left--; if (g.left <= 0) { g.turn = nextAlive(g, g.turn); g.left = 1; } }
    g.phase = 'play';
    logEv(g, { k: 'turn', by: g.turn, left: g.left });
  }
  function eliminate(g, c) {
    g.discard = g.discard.concat(g.hands[c], ['bomb']); g.hands[c] = []; g.alive[c] = false;
    logEv(g, { k: 'explode', by: c });
    g.rescue = null; g.bheat = 0;
    const live = aliveList(g);
    if (g.teams) {                                      // 2v2: the game ends when one whole team is out
      const alive = {}; live.forEach(x => { alive[g.teams[x]] = 1; }); const ts = Object.keys(alive);
      if (ts.length <= 1) { g.phase = 'over'; g.winTeam = ts[0] || null; g.winner = live[0] || null; logEv(g, { k: 'win', by: g.winner, team: g.winTeam }); return; }
    } else if (live.length <= 1) { g.phase = 'over'; g.winner = live[0] || null; logEv(g, { k: 'win', by: g.winner }); return; }
    if (g.turn === c) { g.turn = nextAlive(g, c); g.left = 1; }
    g.phase = 'play'; g.pending = null;
    logEv(g, { k: 'turn', by: g.turn, left: g.left });
  }
  function ensureDeck(g) {            // safety net: never draw from an empty pile
    if (g.deck.length) return;
    const back = g.discard.filter(k => !isBomb(k)); g.discard = g.discard.filter(isBomb);
    if (g.suddenOn) { back.push('bomb'); g.extra = (g.extra || 0) + 1; logEv(g, { k: 'hotdeck' }); }   // 2v2: every reshuffle adds a fresh bomb, so a game can't go on forever
    g.deck = shuffle(back); g.peek = null;
  }

  // Nhân Bản also copies a DEFUSE: a Defuse is used (not "played") when a bomb is drawn, and it counts as the card played last (g.last = 'defuse').
  // As long as that is still the last card, a Clone in hand acts as a Defuse for whoever draws a bomb next (a real Defuse is used first).
  const cloneDefuse = (g, c) => !!g && g.last === 'defuse' && !!g.alive[c] && cnt(g.hands[c], 'clone') > 0;
  function useDefuse(g, c) {                                       // -> 'defuse' | 'clone' | null (nothing to use)
    if (removeOne(g.hands[c], 'defuse')) { g.discard.push('defuse'); g.last = 'defuse'; g.lastCat = null; return 'defuse'; }
    if (cloneDefuse(g, c)) { removeOne(g.hands[c], 'clone'); g.discard.push('clone'); return 'clone'; }       // last stays 'defuse': a Clone of a Clone copies the same card
    return null;
  }
  function draw(g, c) {
    if (g.phase !== 'play' || g.turn !== c || !g.alive[c]) return null;
    startAction(g); ensureDeck(g);
    const card = g.deck.shift();
    if (g.peek) { g.peek.cards.shift(); if (!g.peek.cards.length) g.peek = null; }
    if (isBomb(card)) {
      g.bheat = g.heatOn ? heatOf(card) : 0;
      logEv(g, { k: 'bomb', by: c, heat: g.bheat });
      const hasDef = cnt(g.hands[c], 'defuse') > 0 || cloneDefuse(g, c), mate = g.teams ? (aliveMate(g, c) || (g.coopGhost ? mateOf(g, c) : null)) : null;   // dead teammate helps only if the lobby rule allows it
      const wants = !!mate && (g.coop === 'always' || !hasDef), tooHot = !!g.heatOn && g.bheat >= MAX_HEAT;
      if (wants && tooHot) logEv(g, { k: 'scorch', by: c });                                             // too hot for a minigame: classic rules
      if (wants && !tooHot) { startRescue(g, c, mate, hasDef); return g; }   // 2v2: the boat defuses together
      const used = useDefuse(g, c);
      if (used) { g.phase = 'reinsert'; g.reins = { by: c }; logEv(g, { k: 'defuse', by: c, clone: used === 'clone' ? 1 : 0 }); }
      else eliminate(g, c);
      return g;
    }
    g.hands[c].push(card); logEv(g, { k: 'draw', by: c, left: g.deck.length, card });
    endTurns(g, false);
    return g;
  }
  // ---- 2v2 cooperative defuse -----------------------------------------------------------------------
  // The bomb is in limbo (not in the pile, not in a hand) while phase === 'rescue'. The two teammates play a minigame
  // (js/meow-coop.js, generated from `seed`); one client reports the result with rescueEnd(). Success -> the drawer slides
  // the bomb back like a normal Defuse; failure -> a Defuse in hand (if any) is burned, otherwise the DRAWER explodes.
  function startRescue(g, c, mate, hasDef) {
    const pool = COOP_GAMES.filter(k => k !== g.lastCoop), game = pool[Math.floor(Math.random() * pool.length)];
    g.lastCoop = game;
    const swap = Math.random() < 0.5;
    g.phase = 'rescue';
    g.rescue = { id: g.v, by: c, mate, p1: swap ? mate : c, p2: swap ? c : mate, game, seed: 1 + Math.floor(Math.random() * 2147483000), hasDef: hasDef ? 1 : 0, heat: g.bheat || 0 };
    logEv(g, { k: 'rescue', by: c, mate, game });
  }
  function rescueEnd(g, id, ok) {
    if (!g || g.phase !== 'rescue' || !g.rescue || g.rescue.id !== id) return null;
    startAction(g);
    const r = g.rescue, c = r.by; g.rescue = null;
    if (ok) { logEv(g, { k: 'rescued', by: c, mate: r.mate, kept: r.hasDef && g.coop === 'always' ? 1 : 0 }); g.phase = 'reinsert'; g.reins = { by: c }; return g; }
    logEv(g, { k: 'rescueFail', by: c, mate: r.mate });
    const used = r.hasDef ? useDefuse(g, c) : null;
    if (used) { g.phase = 'reinsert'; g.reins = { by: c }; logEv(g, { k: 'defuse', by: c, clone: used === 'clone' ? 1 : 0 }); }
    else eliminate(g, c);
    return g;
  }
  function reinsert(g, c, pos) {
    if (g.phase !== 'reinsert' || !g.reins || g.reins.by !== c) return null;
    startAction(g);
    pos = Math.max(0, Math.min(g.deck.length, parseInt(pos, 10) || 0));
    g.deck.splice(pos, 0, bombCard((g.bheat || 0) + (g.heatOn ? 1 : 0))); g.bheat = 0;     // the bomb comes back one level hotter
    if (g.peek && pos < g.peek.cards.length) { g.peek.cards = g.peek.cards.slice(0, pos); if (!g.peek.cards.length) g.peek = null; }
    g.reins = null; logEv(g, { k: 'reinsert', by: c });
    endTurns(g, false);
    return g;
  }

  // ---- playing cards --------------------------------------------------------------------------------
  function kindOf(kinds) { return kinds.length === 1 ? kinds[0] : (kinds.length === 2 ? 'pair' : (kinds.length === 5 ? 'five' : 'triple')); }
  // ---- "Năm Mèo" (five): 5 DIFFERENT cat cards (one of every cat) are swapped for ANY one card that has been played in this match (= lies in the discard pile).
  // The wanted card is named when the combo is played (opts.name). Bombs lying in the discard (exploded players) can never be taken.
  // `extra` = cards that are about to join the discard (the combo's own cards / the Clone itself), so they can be named too.
  function recoverCounts(g, extra) { const n = {}; g.discard.concat(extra || []).forEach(k => { if (!isBomb(k)) n[k] = (n[k] || 0) + 1; }); return n; }
  const recoverable = (g, extra) => { const n = recoverCounts(g, extra); return STEALABLE.filter(k => n[k] > 0); };
  const isFive = kinds => !!kinds && kinds.length === 5 && CATS.every(k => kinds.indexOf(k) >= 0);
  // A Clone is a WILDCARD inside a combo: it replaces ONE cat card of a pair (Clone + X), a triple (Clone + X + X) or a five (Clone + 4 different cats = the missing one).
  // effKinds() gives the cards as the combo sees them (the Clone replaced by the cat it stands for); an entry is null when the combo is not valid (e.g. two Clones, or no real cat).
  function effKinds(g, kinds) {
    const nc = kinds.filter(k => k === 'clone').length; if (!nc) return kinds.slice();
    const real = kinds.filter(k => k !== 'clone'); let fill = null;
    if (nc === 1 && real.every(k => CATS.indexOf(k) >= 0)) {
      if (kinds.length === 5) { if (new Set(real).size === 4) fill = CATS.find(k => real.indexOf(k) < 0) || null; }
      else if (real.length >= 1 && real.every(k => k === real[0])) fill = real[0];
    }
    return kinds.map(k => k === 'clone' ? fill : k);
  }
  function needsTarget(kinds, g) { const k = (kinds.length === 1 && kinds[0] === 'clone') ? cloneKind(g) : kindOf(kinds); return k === 'favor' || k === 'pair' || k === 'triple'; }
  // Xin Xỏ may also ask your TEAMMATE (it is a gift, not a theft); steals still never hit an ally.
  function favorTargets(g, c) { return aliveList(g).filter(o => o !== c && g.hands[o].length > 0); }
  // ---- Clone ("Nhân Bản"): copies the effect of the most recently PLAYED action / combo (g.last, even if it got Noped).
  // Turn-order cards (Attack / Skip) can only be copied on your own turn; as a reaction (rule cloneAny) it copies the card that is on the table.
  // Nhân Bản copies ANY card that was played last (never a bomb). While a Nope lies on top of the table the card played last IS that Nope (a Clone then acts as one more Nope);
  // once the window is over the Noped card is still the one a Clone copies. Defuse is never "played" (it is only used when a bomb is drawn) and cat cards only act in combos.
  // Tempo: a Clone never changes whose turn it is. Attack / Skip copies only move the turn when the Clone was played on its owner's own turn (see applyEffect).
  // A Clone played ALONE turns into the card played last (g.last = the most recent card played in the whole match, whoever played it and whenever, not tied to turns or targets):
  //   an action card -> that action; a Nope on the table -> one more Nope; a Defuse -> a Defuse for the next bomb;
  //   a pair / triple -> ONE cat card of that combo (the Clone becomes that cat in your hand, instantly, to be used in your own combos); a five -> ONE random cat of the five.
  const COPYABLE = ['attack', 'skip', 'shuffle', 'future', 'favor', 'nope'], COMBOS = ['pair', 'triple', 'five'];
  const cloneKind = g => {
    if (!g) return null;
    if (g.phase === 'pending' && g.pending && g.pending.nopes.length) return 'nope';
    if (g.last && COMBOS.indexOf(g.last) >= 0) return 'cat';
    return (g.last && COPYABLE.indexOf(g.last) >= 0 && g.last !== 'nope') ? g.last : null;
  };
  const effKind = (g, kinds) => (kinds.length === 1 && kinds[0] === 'clone') ? cloneKind(g) : kindOf(kinds);
  function targetsFor(g, c, kinds) { const k = effKind(g, kinds); return k === 'favor' ? favorTargets(g, c) : ((k === 'pair' || k === 'triple') ? validTargets(g, c) : []); }
  const needsName = (g, kinds) => effKind(g, kinds) === 'triple';
  const needsPick = (g, kinds) => effKind(g, kinds) === 'five';          // the player must also name a card from the discard pile
  function cloneMode(g, c) {            // 'own' (my turn), 'react' (a card is on the table) or 'out' (someone else's turn, nothing pending) -- the last two only with the cloneAny rule
    if (!g || !g.alive[c] || cnt(g.hands[c], 'clone') < 1) return null;
    const k = cloneKind(g); if (!k) return null;
    if (k === 'nope') return (g.phase === 'pending' && g.pending && g.cloneAny && nopeAllowed(g, c)) ? 'react' : null;     // acts as a Nope: same who-may-Nope rules
    if (g.phase === 'play') return g.turn === c ? 'own' : (g.cloneAny ? 'out' : null);
    if (g.phase === 'pending' && g.pending && g.cloneAny) return 'react';
    return null;
  }
  // Under attack (the running player still owes more than one turn): the Attack card can't be used to pass the attack on, and a Skip ("Né") only works with the lobby rule `dodgeAtk` (each Skip then cancels ONE owed turn).
  const underAttack = (g, c) => !!g && g.turn === c && g.left > 1;
  const lockedUnderAttack = (g, c, kind) => underAttack(g, c) && (kind === 'attack' || (kind === 'skip' && !g.dodgeAtk));
  function canClone(g, c, opts) {
    opts = opts || {}; if (!cloneMode(g, c)) return false;
    const k = cloneKind(g); if (lockedUnderAttack(g, c, k)) return false;
    if (k === 'favor') return favorTargets(g, c).indexOf(opts.target) >= 0;
    return true;
  }
  function cloneReady(g, c) { const m = cloneMode(g, c); return !!m && (targetsFor(g, c, ['clone']).length > 0 || cloneKind(g) !== 'favor'); }
  function playClone(g, c, opts) {
    startAction(g); opts = opts || {};
    const k = cloneKind(g), own = g.turn === c;                     // `own`: was it the Clone owner's turn when it was played? (decides whether a copied Attack / Skip may move the turn)
    removeOne(g.hands[c], 'clone'); g.discard.push('clone');
    if (k === 'nope') {                                             // a copied Nope: the Clone is spent and acts as one more Nope on the card that is on top
      const p = g.pending; p.nopes.push(c); p.n++; p.passes = {};
      logEv(g, { k: 'nope', by: c, n: p.nopes.length, clone: 1 });
      return g;
    }
    if (k === 'cat') {                                              // a copied combo: the Clone becomes ONE cat card of it (random for a five). No Nope window, nobody's turn changes.
      const cat = g.last === 'five' ? CATS[Math.floor(Math.random() * CATS.length)] : (CATS.indexOf(g.lastCat) >= 0 ? g.lastCat : CATS[0]);
      g.discard.pop(); g.hands[c].push(cat); logEv(g, { k: 'cloneCat', by: c, card: cat });
      return g;
    }
    const tgt = k === 'favor' ? opts.target : null, name = null;
    logEv(g, { k: 'play', by: c, kinds: ['clone'], kind: 'clone', copy: k, target: tgt || null, name: name || null });
    if (g.phase === 'pending') {                                    // reaction: the card on the table goes UNDER, the clone is now the top of the stack (Nopes hit the top)
      const p = g.pending;
      p.under.push({ by: p.by, kinds: p.kinds.slice(), kind: p.kind, copy: p.copy || null, target: p.target || null, name: p.name || null, own: p.own !== false, off: p.nopes.length % 2 === 1 });
      p.by = c; p.kinds = ['clone']; p.kind = 'clone'; p.copy = k; p.target = tgt || null; p.name = name || null; p.own = own; p.nopes = []; p.passes = {}; p.n++;
      return g;
    }
    g.pid++; g.phase = 'pending';                                   // own turn or (cloneAny) someone else's turn: after the window the game goes back to 'play' with the SAME turn / left
    g.pending = { pid: g.pid, by: c, kinds: ['clone'], kind: 'clone', copy: k, target: tgt || null, name: name || null, own, nopes: [], passes: {}, n: 0, under: [] };
    return g;
  }
  function validTargets(g, c) { return aliveList(g).filter(o => o !== c && !isAlly(g, c, o) && g.hands[o].length > 0); }   // never your teammate
  // opts: {target, name}.  settings is optional (only `combos` is read).
  function canPlay(g, c, kinds, opts, settings) {
    opts = opts || {};
    if (kinds && kinds.length === 1 && kinds[0] === 'clone') return canClone(g, c, opts);
    if (!g || g.phase !== 'play' || g.turn !== c || !g.alive[c] || !kinds || !kinds.length || kinds.length > 5 || kinds.length === 4) return false;
    const h = g.hands[c], need = {};
    kinds.forEach(k => { need[k] = (need[k] || 0) + 1; });
    if (Object.keys(need).some(k => cnt(h, k) < need[k])) return false;
    if (kinds.length === 1) {
      if (ACTIONS.indexOf(kinds[0]) < 0) return false;
      if (lockedUnderAttack(g, c, kinds[0])) return false;
      if (kinds[0] === 'favor') return favorTargets(g, c).indexOf(opts.target) >= 0;
      return true;
    }
    if (settings && settings.combos === false) return false;
    const ek = effKinds(g, kinds); if (ek.some(k => !k)) return false;                               // a Clone in a combo = the cat played last
    if (kinds.length === 5) return isFive(ek) && recoverable(g, kinds).indexOf(opts.name) >= 0;      // five different cats -> any card from the discard pile
    if (ek.some(k => k !== ek[0]) || CATS.indexOf(ek[0]) < 0) return false;
    if (validTargets(g, c).indexOf(opts.target) < 0) return false;
    if (kinds.length === 3 && STEALABLE.indexOf(opts.name) < 0) return false;
    return true;
  }
  function play(g, c, kinds, opts, settings) {
    if (!canPlay(g, c, kinds, opts, settings)) return null;
    if (kinds.length === 1 && kinds[0] === 'clone') return playClone(g, c, opts);
    startAction(g); opts = opts || {};
    const ek = effKinds(g, kinds);
    kinds.forEach(k => { removeOne(g.hands[c], k); g.discard.push(k); });
    g.pid++;
    g.phase = 'pending'; g.last = kindOf(kinds); g.lastCat = (kinds.length === 2 || kinds.length === 3) ? (ek.find(k => k && k !== 'clone') || null) : null;
    g.pending = { pid: g.pid, by: c, kinds: kinds.slice(), kind: kindOf(kinds), target: needsTarget(kinds, g) ? opts.target : null, name: (kinds.length === 3 || kinds.length === 5) ? opts.name : null, own: true, nopes: [], passes: {}, n: 0, under: [] };
    logEv(g, { k: 'play', by: c, kinds: kinds.slice(), kind: g.pending.kind, target: g.pending.target || null, name: g.pending.name || null });
    return g;
  }
  // Who was just Noped: the author of the action the latest Nope hit (the card's owner after the 1st Nope, the previous noper after later ones).
  // That player knows what happened and may answer at once; everybody else is still deciding about the SAME state.
  function nopedPlayer(g) {
    const p = g && g.pending; if (!p) return null;
    const k = p.nopes.length; return k === 0 ? null : (k === 1 ? p.by : p.nopes[k - 2]);
  }
  // Who MAY Nope right now (the card in hand is checked separately), in solo and in 2v2:
  //  - nothing Noped yet: anybody, except the TEAMMATE of the player who played the card (2v2: you can't Nope your own side's card);
  //  - a Nope is already on the table: only the player who just got Noped may answer it, so a bystander can't Nope "on their behalf".
  //    In 2v2 their teammate is on the same side and may answer too (the opposing team may not).
  function nopeAllowed(g, c) {
    const p = g && g.pending; if (!p) return false;
    const target = nopedPlayer(g);
    if (target) return c === target || isAlly(g, target, c);
    return !isAlly(g, p.by, c);
  }
  const canNope = (g, c) => !!g && g.phase === 'pending' && !!g.alive[c] && g.hands[c].indexOf('nope') >= 0 && nopeAllowed(g, c);
  // seenN = how many Nopes the player SAW on the table when they pressed. If another Nope landed in the meantime the press is
  // refused and NO card is spent: two people hitting Nope together must not cancel each other (only the first Nope counts).
  function nope(g, c, seenN) {
    if (!canNope(g, c)) return null;
    if (seenN != null && g.pending.n !== seenN) return null;
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

  // One effect, done by `c` (the player who played that card; for a Clone, the copied kind).
  function applyEffect(g, c, kind, tgt, name, own) {
    switch (kind) {
      // Attack / Skip always act on the turn that is running RIGHT NOW (g.turn), whoever played the card or its Clone. A copy therefore works at any moment:
      // e.g. P plays Attack, anybody Clones it -> the player who just got attacked is attacked on (the Attack stacks).
      case 'attack': case 'skip':
        if (kind === 'attack') { logEv(g, { k: 'attack', by: c }); endTurns(g, true); } else { logEv(g, { k: 'skip', by: c }); endTurns(g, false); }
        break;
      case 'five':
        if (removeOne(g.discard, name)) { g.hands[c].push(name); logEv(g, { k: 'recover', by: c, card: name, name }); }
        else logEv(g, { k: 'fizzle', by: c });                                  // somebody got that card from the discard first
        break;
      case 'shuffle': shuffle(g.deck); g.peek = null; logEv(g, { k: 'shuffle', by: c }); break;
      case 'future': {
        ensureDeck(g); const top = g.deck.slice(0, 3).map(baseKind), prev = (g.peek && g.peek.stamp === g.v && g.peek.cards.join() === top.join()) ? g.peek : null;
        g.peek = { by: c, cards: top, stamp: g.v, also: prev ? [prev.by].concat(arr(prev.also)) : [] };     // a cloned Nhìn Trước shows the same 3 cards to both players
        logEv(g, { k: 'future', by: c, cards: top }); break;
      }
      case 'favor':
        if (g.alive[tgt] && g.hands[tgt].length) { logEv(g, { k: 'favor', by: c, target: tgt }); if (g.phase === 'give' && g.give) g.giveQ.push({ from: tgt, to: c }); else { g.phase = 'give'; g.give = { from: tgt, to: c }; } }
        else logEv(g, { k: 'fizzle', by: c });
        break;
      case 'pair': case 'triple': {
        if (!g.alive[tgt] || !g.hands[tgt].length) { logEv(g, { k: 'fizzle', by: c }); break; }
        if (kind === 'pair') {
          const i = Math.floor(Math.random() * g.hands[tgt].length), card = g.hands[tgt].splice(i, 1)[0];
          g.hands[c].push(card); logEv(g, { k: 'steal', by: c, from: tgt, card });
        } else if (removeOne(g.hands[tgt], name)) {
          g.hands[c].push(name); logEv(g, { k: 'steal', by: c, from: tgt, card: name, named: true });
        } else logEv(g, { k: 'miss', by: c, from: tgt, name });
        break;
      }
    }
  }
  function resolve(g, pid, n) {
    if (!g || g.phase !== 'pending' || !g.pending || g.pending.pid !== pid || g.pending.n !== n) return null;
    startAction(g);
    const p = g.pending; g.pending = null;
    g.phase = 'play';
    // the stack resolves oldest first; every card carries its own Nope parity (a Nope only ever hit the card that was on top at that moment)
    const items = arr(p.under).concat([{ by: p.by, kind: p.kind, copy: p.copy, target: p.target, name: p.name, own: p.own, off: p.nopes.length % 2 === 1 }]);
    items.forEach(it => {
      if (it.off) { logEv(g, { k: 'cancel', by: it.by, kind: it.kind }); return; }
      applyEffect(g, it.by, it.kind === 'clone' ? it.copy : it.kind, it.target, it.name, it.own !== false);
    });
    return g;
  }
  function giveCard(g, c, kind) {
    if (g.phase !== 'give' || !g.give || g.give.from !== c || g.hands[c].indexOf(kind) < 0) return null;
    startAction(g);
    removeOne(g.hands[c], kind); g.hands[g.give.to].push(kind);
    logEv(g, { k: 'give', from: c, by: g.give.to, card: kind });
    g.give = null; g.phase = 'play'; g.giveQ = arr(g.giveQ);
    while (g.giveQ.length) {                                         // a cloned Xin Xỏ: the next request comes right after
      const q = g.giveQ.shift();
      if (g.alive[q.from] && g.hands[q.from].length) { g.give = q; g.phase = 'give'; break; }
      logEv(g, { k: 'fizzle', by: q.to });
    }
    return g;
  }

  // ---- bots ---------------------------------------------------------------------------------------------
  const THRESH = { easy: 0.5, normal: 0.26, hard: 0.16 };
  function bombProb(g) { return g.deck.length ? g.deck.filter(isBomb).length / g.deck.length : 1; }
  const knownTop = (g, c) => (g.peek && (g.peek.by === c || arr(g.peek.also).indexOf(c) >= 0) && g.peek.cards.length) ? g.peek.cards[0] : null;
  const RECOVER_PREF = ['defuse', 'nope', 'skip', 'attack', 'future', 'favor', 'clone', 'shuffle'];
  function bestRecover(g, extra) { const l = recoverable(g, extra); return RECOVER_PREF.find(k => l.indexOf(k) >= 0) || l[0] || null; }
  function bestTarget(g, c) { const t = validTargets(g, c); t.sort((a, b) => g.hands[b].length - g.hands[a].length); return t[0] || null; }

  // One decision while it is `c`'s turn (phase 'play'): {t:'play', kinds, opts} or {t:'draw'}
  function botPlay(g, c, level) {
    level = BOT_LEVELS.indexOf(level) >= 0 ? level : 'normal';
    const h = g.hands[c], has = k => cnt(h, k) > 0 && !lockedUnderAttack(g, c, k), pb = bombProb(g), top = level === 'easy' ? null : knownTop(g, c);
    const defuses = cnt(h, 'defuse') + (cloneDefuse(g, c) ? 1 : 0);
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
    const ck = cloneKind(g);                                         // Nhân Bản: bots copy the last card when it helps them
    if (level !== 'easy' && ck && has('clone')) {
      const o = ck === 'favor' ? { target: bestTarget(g, c) } : {};
      if (canClone(g, c, o) && ((risky && (ck === 'skip' || ck === 'attack')) || (ck === 'future' && !top && g.deck.length > 3) || (ck === 'favor' && Math.random() < 0.4))) return play(['clone'], o);
    }
    if (level !== 'easy' && CATS.every(has) && Math.random() < (level === 'hard' ? 0.9 : 0.6)) return play(CATS.slice(), { name: bestRecover(g, CATS) });     // five different cats -> the best card in the discard pile
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
    const p = g.pending, cancelled = p.nopes.length % 2 === 1, mine = p.by === c || isAlly(g, p.by, c), P = { easy: 0.3, normal: 0.7, hard: 0.95 }[level];
    if (mine) return cancelled && Math.random() < P ? 'nope' : 'pass';      // defend my own (and my teammate's) cards
    const pk = p.kind === 'clone' ? p.copy : p.kind;
    const victim = pk === 'attack' ? (g.teams ? nextFoe(g, p.by) : nextAlive(g, p.by)) : null;
    const hurts = p.target === c || isAlly(g, p.target, c) || (victim && (victim === c || isAlly(g, victim, c)));
    if (!cancelled && hurts) return Math.random() < P ? 'nope' : 'pass';
    if (!cancelled && level === 'hard' && (pk === 'future' || pk === 'favor') && Math.random() < 0.2) return 'nope';
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

  return { COLORS, CATS, ACTIONS, COUNTS, STEALABLE, BOT_LEVELS, DEFAULT_SETTINGS, NOPE_SECS, MODES, MAX_HEAT, isBomb, heatOf, COOP_TRIGGERS, COOP_GAMES, normalizeSettings, normalize, newGame, aliveList, nextAlive, nextFoe, cnt,
           teamOf, isAlly, mateOf, previewTeams, rescueEnd, draw, reinsert, canPlay, play, canNope, nopeAllowed, nope, nopedPlayer, favorTargets, targetsFor, needsName, cloneKind, cloneReady, cloneMode, cloneDefuse, effKinds, underAttack, lockedUnderAttack, pass, allPassed, resolve, giveCard, needsTarget, needsPick,  validTargets, kindOf, bombProb, recoverable, recoverCounts, isFive,
           botPlay, botReact, botGive, botReinsert, shuffle };
})();
if (typeof module !== 'undefined') module.exports = Meow;
