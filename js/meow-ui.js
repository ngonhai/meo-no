// meow-ui.js — screens, table, hand, modals, effects wiring and the bot/timer driver.
// Rules: meow-engine.js · rooms: meow-net.js · pictures: cat-art.js · effects: meow-fx.js · text: i18n.js
(function () {
  'use strict';
  const M = Meow, $ = id => document.getElementById(id);
  const LAST_KEY = 'meow_last_room', NAME_KEY = 'meow_name';
  const ORDER = ['defuse', 'nope', 'attack', 'skip', 'shuffle', 'future', 'clone', 'favor', 'cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'bomb'];
  const U = {
    screen: 'loading', sel: {}, timers: [], tickTimers: [], driveKey: null, earlyKey: null, passKey: null, passedKey: null, barKey: null,
    fxV: null, freshV: null, fresh: null, freshWhy: null, fxTimers: [], handSig: null, prevHand: null, dealing: false, winV: null, reTimer: null, giveSel: null, chips: {}, lastTurn: null
  };

  // ---------------------------------------------------------------------------------------------------------------
  // small helpers
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = (a, b) => a + Math.random() * (b - a);
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function showScreen(name) { ['loading', 'lobby', 'waiting', 'game'].forEach(n => $('screen-' + n).classList.toggle('active', n === name)); U.screen = name; }
  function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600); }
  function closeModal() { $('modal').innerHTML = ''; $('modal').classList.remove('open'); U.modalFor = null; }
  function openModal(html, key, cls) { const m = $('modal'); m.innerHTML = '<div class="modal-card ' + (cls || '') + '">' + html + '</div>'; m.classList.add('open'); U.modalFor = key || null; }
  const room = () => Net.S.room;
  const myColor = r => Net.mySeatColor(r);
  function nm(r, c) { const s = r.seats[c]; return esc(s && s.name ? s.name : t('botNames.' + c)); }
  const cname = k => t('cards.' + k + '.n');
  const sortedHand = h => h.slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const myName = () => (($('input-name').value || '').trim().slice(0, 16)) || t('player');
  function clearTimers() { U.timers.forEach(clearTimeout); U.timers = []; }
  function clearTicks() { U.tickTimers.forEach(clearTimeout); U.tickTimers = []; }

  // ---------------------------------------------------------------------------------------------------------------
  // cards
  function cardHTML(k, extra, attrs) {
    return '<div class="card k-' + k + (extra ? ' ' + extra : '') + '" data-kind="' + k + '"' + (attrs || '') + '><div class="card-in"><div class="card-face">' +
      '<div class="c-name">' + esc(cname(k)) + '</div>' + CatArt.artSVG(k) + '<div class="c-desc">' + esc(t('cards.' + k + '.d')) + '</div></div></div></div>';
  }
  const backCard = extra => '<div class="card back' + (extra ? ' ' + extra : '') + '"><div class="card-in">' + CatArt.backHTML() + '</div></div>';

  // ---------------------------------------------------------------------------------------------------------------
  // static text + language
  function buildLangSelects() {
    document.querySelectorAll('.lang-select').forEach(sel => {
      sel.innerHTML = availableLangs().map(c => '<option value="' + c + '"' + (c === LANG ? ' selected' : '') + '>' + esc(I18N[c].meta.name) + '</option>').join('');
      sel.onchange = () => { setLang(sel.value); document.documentElement.lang = I18N[LANG].meta.htmlLang || LANG; buildLangSelects(); applyStaticText(); rerender(); };
    });
  }
  function applyStaticText() {
    const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
    set('lobby-title', t('title')); set('lobby-sub', t('subtitle')); set('lbl-name', t('yourName')); $('input-name').placeholder = t('namePh');
    set('tab-btn-create', t('tabCreate')); set('tab-btn-join', t('tabJoin')); set('tab-btn-offline', t('tabOffline'));
    set('btn-create-room', t('createRoom')); set('lbl-code', t('roomCode')); $('input-room-code').placeholder = t('codePh'); set('btn-join-room', t('joinRoom'));
    set('offline-hint', t('offlineHint')); set('btn-start-offline', t('startOffline')); set('online-off-note', t('onlineOff'));
    set('room-code-label', t('roomCodeShare')); set('seats-title', t('seats')); set('rules-title', t('houseRules')); set('rules-readonly-hint', t('hostOnly'));
    set('btn-leave-waiting', t('leave')); set('game-title', t('title')); set('btn-rules', t('rules')); set('btn-leave-game', t('leave')); set('btn-resume', t('resume'));
    set('resume-title', t('lobbyResume')); set('btn-draw', t('draw')); document.querySelectorAll('.pile-ic').forEach(el => { el.innerHTML = Icon.svg('deck'); });
    $('btn-sound').innerHTML = Icon.svg(soundEnabled ? 'speaker' : 'mute'); $('btn-sound').title = t('sound');
    document.title = t('title');
  }
  function rerender() { const r = room(); if (!r) return; if (r.status === 'lobby') renderWaiting(r); else { U.handSig = null; U.barKey = null; U.chips = {}; $('opps').innerHTML = ''; renderGame(r, null); } }

  // ---------------------------------------------------------------------------------------------------------------
  // waiting room
  function seatLabel(r, c) { const s = r.seats[c]; return s ? (s.name || t('botNames.' + c)) : ''; }
  function renderWaiting(r) {
    const me = myColor(r), host = Net.isHost(r), local = Net.S.mode === 'local';
    const team = r.settings.mode === 'team', tmap = team ? M.previewTeams(M.COLORS.filter(c => r.seats[c])) : {};
    $('room-code-display').textContent = local ? '—' : Net.S.code;
    $('room-code-box').classList.toggle('local', local);
    $('room-code-label').textContent = local ? t('offlineRoom') : t('roomCodeShare');
    let h = '';
    M.COLORS.forEach(c => {
      const s = r.seats[c];
      h += '<div class="seat ' + (s ? 'taken' : 'free') + (me === c ? ' mine' : '') + '" style="--sc:var(--' + c + ')">' +
        '<div class="seat-av">' + CatArt.avatarSVG(c) + '</div><div class="seat-body"><div class="seat-color">' + esc(t('colors.' + c)) + '</div>';
      if (s) {
        h += '<div class="seat-name">' + esc(seatLabel(r, c)) + '</div><div class="seat-tags">' +
          (r.hostUid === s.uid || (local && !s.bot) ? '<span class="tag">' + t('host') + '</span>' : '') + (s.bot ? '<span class="tag">' + t('bot') + '</span>' : '') + (me === c ? '<span class="tag you">' + t('you') + '</span>' : '') + (tmap[c] ? '<span class="tag team-' + tmap[c] + '">' + Icon.svg('sail') + ' ' + esc(t('teamNames.' + tmap[c])) + '</span>' : '') +
          (!s.bot && !s.local && s.connected === false ? '<span class="tag off">offline</span>' : '') + '</div>';
        if (s.bot && host) {
          h += '<div class="seat-ctl"><span class="seg">' + M.BOT_LEVELS.map(l => '<button type="button" class="seg-btn' + (Net.botLevel(s) === l ? ' on' : '') + '" data-act="lvl" data-color="' + c + '" data-val="' + l + '">' + t('level.' + l) + '</button>').join('') +
            '</span><button type="button" class="mini-btn danger" data-act="remove" data-color="' + c + '">' + t('remove') + '</button></div>';
        } else if (!s.bot && host && me !== c && !local) h += '<div class="seat-ctl"><button type="button" class="mini-btn danger" data-act="remove" data-color="' + c + '">' + t('kick') + '</button></div>';
      } else {
        h += '<div class="seat-name muted">' + t('empty') + '</div><div class="seat-ctl">' + (host ? '<button type="button" class="mini-btn" data-act="addbot" data-color="' + c + '">' + t('addBot') + '</button>' : '') +
          (!local && me ? '<button type="button" class="mini-btn" data-act="sit" data-color="' + c + '">' + t('sit') + '</button>' : '') + '</div>';
      }
      h += '</div></div>';
    });
    $('seat-grid').innerHTML = h;
    renderRules($('rules-list'), r.settings, host);
    $('rules-readonly-hint').style.display = host ? 'none' : '';
    const n = Object.keys(r.seats).filter(c => r.seats[c]).length;
    const sb = $('btn-start-game'); sb.textContent = t('start'); sb.style.display = host ? '' : 'none'; sb.disabled = n < 2 || (team && n !== 4);
    const wh = $('waiting-hint'); wh.textContent = host ? (team && n !== 4 ? t('needFour') : (n < 2 ? t('needTwo') : '')) : t('waitHost');
  }
  function renderRules(box, s, editable) {
    const dis = editable ? '' : ' disabled';
    const seg = (key, vals, cur, label) => '<span class="seg">' + vals.map(v => '<button type="button" class="seg-btn' + (cur === v ? ' on' : '') + '" data-act="set" data-key="' + key + '" data-val="' + v + '"' + dis + '>' + label(v) + '</button>').join('') + '</span>';
    box.innerHTML =
      '<div class="rule-row"><div><b>' + t('set.nopeSec') + '</b><p class="muted">' + t('set.nopeHint') + '</p></div>' + seg('nopeSec', M.NOPE_SECS, s.nopeSec, v => t('set.secs', v)) + '</div>' +
      '<div class="rule-row"><div><b>' + t('set.hand') + '</b><p class="muted">' + t('set.handHint') + '</p></div><span class="stepper"><button type="button" class="seg-btn" data-act="step" data-key="hand" data-d="-1"' + dis + '>−</button><b>' + s.hand + '</b><button type="button" class="seg-btn" data-act="step" data-key="hand" data-d="1"' + dis + '>+</button></span></div>' +
      '<div class="rule-row"><div><b>' + t('set.combos') + '</b><p class="muted">' + t('set.combosHint') + '</p></div>' + seg('combos', [true, false], s.combos, v => v ? t('set.on') : t('set.off')) + '</div>' +
      '<div class="rule-row"><div><b>' + t('set.cloneAny') + '</b><p class="muted">' + t('set.cloneAnyHint') + '</p></div>' + seg('cloneAny', [true, false], s.cloneAny, v => v ? t('set.on') : t('set.off')) + '</div>' +
      '<div class="rule-row"><div><b>' + t('set.dodgeAtk') + '</b><p class="muted">' + t('set.dodgeAtkHint') + '</p></div>' + seg('dodgeAtk', [true, false], s.dodgeAtk, v => v ? t('set.on') : t('set.off')) + '</div>' +
      '<div class="rule-row"><div><b>' + t('set.mode') + '</b><p class="muted">' + t('set.modeHint') + '</p></div>' + seg('mode', M.MODES, s.mode, v => t('set.' + v)) + '</div>' +
      (s.mode === 'team' ? '<div class="rule-row sub"><div><b>' + t('set.coop') + '</b><p class="muted">' + t('set.coopHint') + '</p></div>' + seg('coop', M.COOP_TRIGGERS, s.coop, v => t(v === 'always' ? 'set.coopAlways' : 'set.coopNoDefuse')) + '</div>' +
        '<div class="rule-row sub"><div><b>' + t('set.coopGhost') + '</b><p class="muted">' + t('set.coopGhostHint') + '</p></div>' + seg('coopGhost', [true, false], s.coopGhost, v => v ? t('set.on') : t('set.off')) + '</div>' +
        '<div class="rule-row sub"><div><b>' + t('set.bombHeat') + '</b><p class="muted">' + t('set.bombHeatHint') + '</p></div>' + seg('bombHeat', [true, false], s.bombHeat, v => v ? t('set.on') : t('set.off')) + '</div>' +
        '<div class="rule-row sub"><div><b>' + t('set.suddenBomb') + '</b><p class="muted">' + t('set.suddenBombHint') + '</p></div>' + seg('suddenBomb', [true, false], s.suddenBomb, v => v ? t('set.on') : t('set.off')) + '</div>' : '');
  }

  // ---------------------------------------------------------------------------------------------------------------
  // game: opponents / piles / banner
  function chipSig(r, c) {
    const g = r.g, s = r.seats[c];
    return [nm(r, c), g.hands[c].length, g.alive[c] ? 1 : 0, g.turn === c && g.phase !== 'over' ? 1 : 0, g.turn === c ? g.left : 0, s && s.bot ? 1 : 0, s && !s.bot && !s.local && s.connected === false ? 1 : 0, LANG].join('|');
  }
  const teamTag = (g, c) => g.teams && g.teams[c] ? ' <span class="tag team-' + g.teams[c] + '">' + Icon.svg('sail') + g.teams[c] + '</span>' : '';
  const allyOf = (g, a, b) => !!g.teams && a !== b && g.teams[a] === g.teams[b];
  function chipHTML(r, c) {
    const g = r.g, s = r.seats[c], alive = g.alive[c], turn = g.turn === c && g.phase !== 'over';
    return '<div class="opp-av">' + (alive ? CatArt.avatarSVG(c) : CatArt.skullSVG()) + '</div><div class="opp-info"><div class="opp-name">' + nm(r, c) + (s && s.bot ? ' <em>' + t('bot') + '</em>' : '') + teamTag(g, c) + '</div>' +
      '<div class="opp-meta">' + (alive ? '<span class="mini-back">' + CatArt.backHTML('mini-back-svg') + '</span><b>' + g.hands[c].length + '</b>' + (turn && g.left > 1 ? '<span class="tag">' + t('turnsLeft', g.left) + '</span>' : '') : '<span class="muted">' + t('outLabel') + '</span>') +
      (s && !s.bot && !s.local && s.connected === false ? ' <span class="tag off">offline</span>' : '') + '</div></div>';
  }
  function renderOpps(r, me) {
    const g = r.g, box = $('opps'), n = g.order.length, start = me ? g.order.indexOf(me) : -1;
    const list = me ? g.order.map((_, i) => g.order[(start + 1 + i) % n]).filter(c => c !== me) : g.order.slice();
    Array.from(box.children).forEach(el => { if (list.indexOf(el.dataset.color) < 0) { el.remove(); delete U.chips[el.dataset.color]; } });
    list.forEach((c, i) => {
      let el = $('opp-' + c);
      if (!el) { el = document.createElement('div'); el.id = 'opp-' + c; el.dataset.color = c; box.appendChild(el); }
      if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
      el.className = 'opp' + (allyOf(g, me, c) ? ' ally' : '') + (g.alive[c] ? '' : ' out') + (g.turn === c && g.phase !== 'over' && g.alive[c] ? ' turn' : '');
      el.style.setProperty('--sc', 'var(--' + c + ')'); el.style.setProperty('--tm', g.teams && g.teams[c] === 'B' ? 'var(--teamB)' : 'var(--teamA)');
      const sig = chipSig(r, c);
      if (U.chips[c] !== sig) { el.innerHTML = chipHTML(r, c); U.chips[c] = sig; }
    });
  }
  // The cards played before the last one lie messily and faded under it, so everybody can still see what came before.
  // Every card keeps the same scatter for as long as it is on the pile (the offsets come from its position in the discard).
  const UNDER_SHOWN = 4;
  function discardUnder(d) {
    let h = '';
    for (let j = Math.max(0, d.length - 1 - UNDER_SHOWN); j < d.length - 1; j++) {
      const r = k => { const x = Math.imul(j + 1, 2654435761) ^ Math.imul(k + 7, 40503); return (((x ^ (x >>> 15)) >>> 0) % 1000) / 1000 - .5; };   // stable -.5..+.5
      const age = d.length - 1 - j;                                             // 1 = the card right under the top one
      h += cardHTML(d[j], 'under', ' style="--ux:' + Math.round(r(1) * 56) + '%;--uy:' + Math.round(r(2) * 40 - 8) + '%;--ur:' + Math.round(r(3) * 44) + 'deg;--uo:' + (age === 1 ? .62 : age === 2 ? .5 : .38) + '"');
    }
    return h;
  }
  function renderPiles(r, me) {
    const g = r.g;
    $('deck-count').textContent = t('deckLeft', g.deck.length);
    $('deck-pile').classList.toggle('can-draw', !!me && g.alive[me] && g.phase === 'play' && g.turn === me);
    const top = g.discard.length ? g.discard[g.discard.length - 1] : null;
    $('discard-top').innerHTML = top ? discardUnder(g.discard) + cardHTML(top, 'mini-lg') : '<div class="card-slot"></div>';
    const known = $('peek-known');
    if (me && g.peek && (g.peek.by === me || (g.peek.also || []).indexOf(me) >= 0) && g.peek.cards.length) {
      known.innerHTML = '<span>' + t('knownTop') + '</span>' + g.peek.cards.map(k => CatArt.iconHTML(k, 'known-ico')).join('');
      known.style.display = '';
    } else known.style.display = 'none';
  }
  const winners = g => g.order.filter(c => g.teams && g.teams[c] === g.winTeam);
  function renderBanner(r, me) {
    const g = r.g, b = $('turn-banner'); let txt, col = g.turn;
    if (g.phase === 'over') { txt = g.winTeam ? t('winTeam', nm(r, winners(g)[0]), nm(r, winners(g)[1] || winners(g)[0])) : t('winTitle', nm(r, g.winner)); col = g.winner; }
    else if (g.phase === 'rescue') { txt = t('rescueBanner', nm(r, g.rescue.by), nm(r, g.rescue.mate)); col = g.rescue.by; }
    else if (g.phase === 'pending') { txt = t('pending', nm(r, g.pending.by)); col = g.pending.by; }
    else if (g.phase === 'give') { txt = t('giveWait', nm(r, g.give.from), nm(r, g.give.to)); col = g.give.from; }
    else if (g.phase === 'reinsert') { txt = g.reins.by === me ? t('reinsertTitle') : t('waitingOn', nm(r, g.reins.by)); col = g.reins.by; }
    else if (me && g.turn === me) txt = t('yourTurn') + (g.left > 1 ? ' · ' + t('turnsLeft', g.left) : '');
    else txt = t('turnOf', nm(r, g.turn)) + (g.left > 1 ? ' · ' + t('turnsLeft', g.left) : '');
    if (me && !g.alive[me] && g.phase !== 'over' && g.phase !== 'rescue') txt = t('youOut');
    b.textContent = ''; b.innerHTML = txt; b.style.setProperty('--tc', 'var(--' + col + ')');
    b.classList.toggle('mine', !!me && g.turn === me && g.phase === 'play');
    const mine = !!me && g.alive[me] && g.turn === me && g.phase === 'play';
    $('sub-hint').textContent = g.phase === 'rescue' ? t('rescueHint') : mine ? t('turnHint') : ((me && g.alive[me] && U.fresh && U.freshWhy === 'draw' && g.phase !== 'over') ? t('drewHint', cname(U.fresh)) : '');
  }
  function playText(r, p) {
    const n = nm(r, p.by), tg = p.target ? nm(r, p.target) : '';
    if (p.kind === 'pair') return t('log.playPair', n, cname(p.kinds[0]), tg);
    if (p.kind === 'triple') return t('log.playTriple', n, cname(p.kinds[0]), tg, cname(p.name));
    if (p.kind === 'five') return t('log.playFive', n, cname(p.name));
    if (p.kind === 'favor') return t('log.playFavor', n, cname('favor'), tg);
    if (p.kind === 'clone') { const w = cname(p.copy); return t('log.playClone', n, cname('clone'), w) + (tg ? ' → ' + tg : '') + (p.name ? ' (' + cname(p.name) + ')' : ''); }
    return t('log.play1', n, cname(p.kind));
  }
  function renderBar(r, me) {
    const g = r.g, bar = $('nope-bar');
    if (g.phase !== 'pending') { bar.classList.remove('show', 'cool'); U.barKey = null; U.nopeSeen = null; clearTicks(); return; }
    const p = g.pending, key = p.pid + ':' + p.n, canNope = !!me && (M.canNope(g, me) || M.cloneReady(g, me));
    bar.classList.add('show');
    // A Nope just landed: for a moment everybody EXCEPT the player who got Noped is held back, so someone who was already pressing
    // Nope (not knowing a second person would too) cannot cancel the first Nope by accident. The press is also refused server-side (seenN).
    const sn = U.nopeSeen;
    if (!sn || sn.pid !== p.pid) U.nopeSeen = { pid: p.pid, n: p.n, until: 0, exempt: null };
    else if (sn.n !== p.n) { U.nopeSeen = { pid: p.pid, n: p.n, until: Date.now() + NOPE_GRACE, exempt: M.nopedPlayer(g) }; clearTimeout(U.coolTimer); U.coolTimer = setTimeout(() => bar.classList.remove('cool'), NOPE_GRACE + 30); }
    bar.classList.toggle('cool', nopeLocked(me));
    if (U.barKey === key) { bar.classList.toggle('can', canNope && U.passedKey !== key); return; }
    U.barKey = key; clearTicks();
    const ms = r.settings.nopeSec * 1000;
    bar.innerHTML = '<div class="nb-cards">' + p.kinds.map(k => cardHTML(k, 'mini')).join('') + '</div><div class="nb-main"><div class="nb-title">' + playText(r, p) + '</div>' +
      '<div class="nb-sub">' + t('nopeWindow') + (p.nopes.length ? ' · <b>' + t('nopeCount', p.nopes.length) + '</b>' : '') + (me && g.alive[me] && !M.nopeAllowed(g, me) ? ' · <i>' + t(p.nopes.length ? 'nopeOnlyNoped' : 'nopeMate') + '</i>' : '') + '</div><div class="nb-time"><i style="animation-duration:' + ms + 'ms"></i></div>' +
      '<div class="nb-actions"><button type="button" class="btn btn-nope" data-act="nope">' + t('nopeBtn') + '</button><button type="button" class="btn btn-secondary" data-act="pass">' + t('passBtn') + '</button></div></div>';
    bar.classList.toggle('can', canNope);
    if (canNope && ms >= 4000) [3, 2, 1].forEach(s => U.tickTimers.push(setTimeout(() => playSound('timerTick'), ms - s * 1000)));
  }

  // ---------------------------------------------------------------------------------------------------------------
  // hand + actions
  const selKinds = () => Object.keys(U.sel).reduce((a, k) => a.concat(Array(U.sel[k]).fill(k)), []);
  function selValid(r, me) {
    const g = r.g, kinds = selKinds(); if (!kinds.length) return false;
    const tg = M.targetsFor(g, me, kinds)[0];
    return M.canPlay(g, me, kinds, { target: tg, name: M.recoverable(g, kinds.length === 1 && kinds[0] === 'clone' ? ['clone'] : kinds)[0] || 'defuse' }, r.settings);
  }
  function layoutHand() {
    const el = $('hand'), c = el.firstElementChild; if (!c) return;
    const n = el.children.length, W = el.clientWidth - 24, cw = c.offsetWidth;
    let ov = n > 1 ? (W - cw) / (n - 1) - cw : 0; ov = Math.max(-cw * 0.84, Math.min(8, ov));
    el.style.setProperty('--ov', ov + 'px');
  }
  // remember the card I just drew / received so it stays marked (✦) in my hand until my next move
  function trackFresh(r, me) {
    const g = r.g; if (U.freshV == null) { U.freshV = g.v; return; } if (g.v <= U.freshV) return; U.freshV = g.v;
    if (!me) return;
    g.ev.forEach(e => {
      if (e.k === 'draw' && e.by === me && e.card) { U.fresh = e.card; U.freshWhy = 'draw'; }
      else if ((e.k === 'give' || e.k === 'steal') && e.by === me && e.card) { U.fresh = e.card; U.freshWhy = 'get'; }
    });
  }
  function renderHand(r, me) {
    const g = r.g, el = $('hand'), alive = !!me && g.alive[me];
    const hand = alive ? sortedHand(g.hands[me]) : [];
    const cnt = {}; hand.forEach(k => { cnt[k] = (cnt[k] || 0) + 1; });
    Object.keys(U.sel).forEach(k => { if ((U.sel[k] || 0) > (cnt[k] || 0)) U.sel[k] = cnt[k] || 0; if (!U.sel[k]) delete U.sel[k]; });
    if (!(g.phase === 'play' && g.turn === me)) U.sel = {};
    const sig = hand.join(',') + '|' + JSON.stringify(U.sel) + '|' + g.phase + '|' + (g.turn === me) + '|' + LANG + '|' + (g.last || '') + '|' + (g.pending ? g.pending.pid + ':' + g.pending.n : '');
    if (sig === U.handSig) return;
    U.handSig = sig;
    // which cards are new since last render (for the deal-in animation)
    const fresh = {};
    if (U.prevHand && !U.dealing) { const pc = {}; U.prevHand.forEach(k => { pc[k] = (pc[k] || 0) + 1; }); Object.keys(cnt).forEach(k => { const d = cnt[k] - (pc[k] || 0); if (d > 0) fresh[k] = d; }); }
    U.prevHand = hand.slice();
    const seen = {}, total = {}; hand.forEach(k => { total[k] = (total[k] || 0) + 1; });
    const myTurn = g.phase === 'play' && g.turn === me;
    let h = '';
    hand.forEach((k, idx) => {
      const i = seen[k] = (seen[k] || 0); seen[k]++;
      const cls = (i < (U.sel[k] || 0) ? 'sel ' : '') + (fresh[k] && i >= total[k] - fresh[k] ? 'new ' : '') + (U.dealing ? 'deal ' : '') +
        (g.phase === 'pending' ? ((k === 'nope' && M.canNope(g, me)) || (k === 'clone' && M.cloneReady(g, me)) ? 'ready' : 'dim') : (!myTurn ? (k === 'clone' && g.phase === 'play' && M.cloneReady(g, me) ? 'ready' : 'dim') : ''));
      h += cardHTML(k, cls, ' data-i="' + i + '" style="--d:' + idx * 70 + 'ms"');
    });
    el.innerHTML = h; el.classList.toggle('empty', !hand.length);
    layoutHand();
    if (U.dealing) setTimeout(() => { U.dealing = false; }, 900);
  }
  function updateActions(r, me) {
    const g = r.g, bp = $('btn-play'), bd = $('btn-draw'), alive = !!me && g.alive[me], my = alive && g.phase === 'play' && g.turn === me;
    $('me-bar').style.display = alive || me ? '' : 'none';
    const kinds = selKinds(), valid = my && selValid(r, me);
    bp.textContent = !kinds.length ? t('pickCards') : (kinds.length === 1 ? t('play1') : (kinds.length === 2 ? t('play2') : (kinds.length === 5 ? t('play5') : t('play3'))));
    bp.disabled = !valid; bp.style.display = my ? '' : 'none';
    bd.disabled = !my; bd.style.display = my ? '' : 'none';
    if (me) {
      const mc = $('me-chip'); mc.style.setProperty('--sc', 'var(--' + me + ')');
      mc.className = 'me-chip' + (g.turn === me && g.phase !== 'over' && alive ? ' turn' : '') + (alive ? '' : ' out');
      mc.innerHTML = '<div class="opp-av">' + (alive ? CatArt.avatarSVG(me) : CatArt.skullSVG()) + '</div><div class="opp-info"><div class="opp-name">' + nm(r, me) + ' <em>' + t('you') + '</em>' + teamTag(g, me) + '</div><div class="opp-meta">' + t('cardsN', g.hands[me].length) + '</div></div>';
    }
  }

  function onCardClick(kind, i, dbl) {
    const r = room(); if (!r || !r.g) return; const g = r.g, me = myColor(r);
    if (!me || !g.alive[me]) return;
    if (kind === 'clone' && M.cloneDefuse(g, me) && !M.cloneMode(g, me)) { toast(t('cloneDefuseHint')); playSound('error'); return; }       // the last card was a Defuse: the Clone waits for a bomb
    if (g.phase === 'pending') { if (kind === 'nope' && M.canNope(g, me)) doNope(); else if (kind === 'clone') reactClone(); return; }
    if (g.phase !== 'play' || g.turn !== me) { if (g.phase === 'play' && kind === 'clone' && M.cloneMode(g, me)) reactClone(); else playSound('error'); return; }   // cloneAny: a Clone can also be played on somebody else's turn
    const cur = U.sel, keys = Object.keys(cur), isCat = M.CATS.indexOf(kind) >= 0;
    if (dbl) { U.sel = {}; U.sel[kind] = 1; renderHand(r, me); U.handSig = null; renderHand(r, me); updateActions(r, me); return playSelected(); }
    if (i < (cur[kind] || 0)) { cur[kind] = i; if (!cur[kind]) delete cur[kind]; playSound('cardDeselect'); }
    else if (comboAdd(g, cur, kind)) { cur[kind] = (cur[kind] || 0) + 1; playSound('cardSelect'); }       // builds a pair / triple (same cat) or a set of five (different cats); a Clone may stand in for the cat played last
    else { U.sel = {}; U.sel[kind] = 1; playSound('cardSelect'); }
    renderHand(r, me); updateActions(r, me);
  }
  function comboAdd(g, cur, kind) {
    const ok = k => M.CATS.indexOf(k) >= 0 || k === 'clone';                                  // a Clone is a wildcard: it may replace ONE cat of a pair / triple / five
    if (!ok(kind) || !Object.keys(cur).every(ok)) return false;
    const n = Object.assign({}, cur); n[kind] = (n[kind] || 0) + 1;
    const total = Object.keys(n).reduce((a, k) => a + n[k], 0), cats = Object.keys(n).filter(k => k !== 'clone');
    if ((n.clone || 0) > 1) return false;
    return (cats.length <= 1 && total <= 3) || (cats.every(k => n[k] === 1) && total <= 5);
  }
  function playSelected() {
    const r = room(); if (!r || !r.g) return; const g = r.g, me = myColor(r), kinds = selKinds();
    if (!me || !selValid(r, me)) { if (me && kinds.length === 1 && M.lockedUnderAttack(g, me, kinds[0])) toast(t(kinds[0] === 'attack' ? 'attackLockedAtk' : 'attackLockedSkip')); playSound('error'); return; }
    if (M.needsPick(g, kinds)) return openRecover(r, kinds);
    if (!M.needsTarget(kinds, g)) return sendPlay(kinds, {});
    const tg = M.targetsFor(g, me, kinds);                          // Xin Xỏ (also via Nhân Bản) may ask your teammate too
    if (!tg.length) { toast(t('noTarget')); return; }
    if (tg.length === 1 && !(kinds.length === 3 || M.needsName(g, kinds))) return sendPlay(kinds, { target: tg[0] });
    openTarget(r, kinds, tg);
  }
  function reactClone() {                                          // house rule: Nhân Bản while a card is on the table
    const r = room(), me = myColor(r); if (!r || !r.g || !me) return;
    if (!M.cloneReady(r.g, me) || (M.cloneKind(r.g) === 'nope' && nopeLocked(me))) { playSound('error'); return; }       // a copied Nope obeys the same "just after a Nope" hold-back
    U.sel = {}; playSelectedKinds(r, me, ['clone']);
  }
  function playSelectedKinds(r, me, kinds) {
    const g = r.g; if (M.needsPick(g, kinds)) return openRecover(r, kinds);
    if (!M.needsTarget(kinds, g)) return sendPlay(kinds, {});
    const tg = M.targetsFor(g, me, kinds); if (!tg.length) { toast(t('noTarget')); return; }
    if (tg.length === 1 && !M.needsName(g, kinds)) return sendPlay(kinds, { target: tg[0] });
    openTarget(r, kinds, tg);
  }
  function sendPlay(kinds, opts) {
    const r = room(), me = myColor(r); if (!r || !r.g || !me) return;
    closeModal(); U.sel = {}; U.fresh = null;
    Net.doPlay(r.g.v, me, kinds, opts).then(ok => { if (!ok) playSound('error'); });
  }
  function doDraw() { const r = room(), me = myColor(r); if (!r || !r.g || !me) return; if (r.g.phase !== 'play' || r.g.turn !== me) { playSound('error'); return; } U.sel = {}; U.fresh = null; Net.doDraw(r.g.v, me).then(ok => { if (!ok) playSound('error'); }); }
  const NOPE_GRACE = 650;                                    // ms an unaware player is held back after somebody else's Nope lands
  function nopeLocked(me) { const s = U.nopeSeen; return !!s && !!me && Date.now() < s.until && s.exempt !== me; }
  function doNope() {
    const r = room(), me = myColor(r); if (!r || !r.g || !me || !M.canNope(r.g, me)) return;
    if (nopeLocked(me)) return;                              // pressed too soon after another Nope: ignored, the card stays in hand
    Net.doNope(r.g.v, me, r.g.pending.n).then(ok => { if (!ok) playSound('error'); });
  }
  function doPass() { const r = room(), me = myColor(r); if (!r || !r.g || !me || r.g.phase !== 'pending') return; const p = r.g.pending; U.passedKey = p.pid + ':' + p.n; $('nope-bar').classList.remove('can'); playSound('pass'); Net.doPass(me, p.pid, p.n); }

  // ---------------------------------------------------------------------------------------------------------------
  // modals
  function openTarget(r, kinds, targets) {
    const g = r.g;
    openModal('<h3>' + t('pickTarget') + '</h3><p class="muted">' + t('pickTargetBody') + '</p><div class="target-list">' + targets.map(c =>
      '<button type="button" class="target" style="--sc:var(--' + c + ')" data-act="target" data-color="' + c + '"><span class="opp-av">' + CatArt.avatarSVG(c) + '</span><b>' + nm(r, c) + '</b><span class="muted">' + t('cardsN', g.hands[c].length) + '</span></button>').join('') +
      '</div><button type="button" class="btn btn-secondary btn-block" data-act="close">' + t('close') + '</button>', 'target');
    $('modal').onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'close') closeModal();
      if (b.dataset.act === 'target') { if (kinds.length === 3 || M.needsName(r.g, kinds)) openName(r, kinds, b.dataset.color); else sendPlay(kinds, { target: b.dataset.color }); }
    };
  }
  function openName(r, kinds, target) {
    openModal('<h3>' + t('pickName') + '</h3><p class="muted">' + t('pickNameBody') + '</p><div class="name-grid">' + M.STEALABLE.map(k => '<button type="button" class="pick" data-act="name" data-kind="' + k + '">' + cardHTML(k, 'mini') + '</button>').join('') +
      '</div><button type="button" class="btn btn-secondary btn-block" data-act="close">' + t('close') + '</button>', 'name', 'wide');
    $('modal').onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'close') closeModal();
      if (b.dataset.act === 'name') sendPlay(kinds, { target, name: b.dataset.kind });
    };
  }
  function openRecover(r, kinds) {                                  // five different cats (or a Clone of it): choose ANY card from the discard pile
    const g = r.g, isClone = kinds.length === 1 && kinds[0] === 'clone', cnts = M.recoverCounts(g, isClone ? ['clone'] : kinds), list = M.recoverable(g, isClone ? ['clone'] : kinds);
    openModal('<h3>' + t('pickRecover') + '</h3><p class="muted">' + t('pickRecoverBody') + '</p><div class="name-grid">' + list.map(k => '<button type="button" class="pick" data-act="name" data-kind="' + k + '">' + cardHTML(k, 'mini') + (cnts[k] > 1 ? '<span class="pick-n">×' + cnts[k] + '</span>' : '') + '</button>').join('') +
      '</div><button type="button" class="btn btn-secondary btn-block" data-act="close">' + t('close') + '</button>', 'name', 'wide');
    $('modal').onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'close') closeModal();
      if (b.dataset.act === 'name') sendPlay(kinds, { name: b.dataset.kind });
    };
  }
  function openPeek(cards) {
    openModal('<h3>' + t('peekTitle') + '</h3><p class="muted">' + t('peekBody') + '</p><div class="peek-row">' + cards.map(k => cardHTML(k, 'peek')).join('') + '</div><button type="button" class="btn btn-block" data-act="close">' + t('peekClose') + '</button>', 'peek', 'wide');
    $('modal').onclick = e => { if (e.target.closest('[data-act="close"]')) closeModal(); };
  }
  function openGive(r, me) {
    const g = r.g, hand = sortedHand(g.hands[me]); U.giveSel = null;
    openModal('<h3>' + t('giveTitle', nm(r, g.give.to)) + '</h3><p class="muted">' + t('giveBody') + '</p><div class="give-grid">' + hand.map((k, i) => '<button type="button" class="pick" data-act="pick" data-kind="' + k + '" data-i="' + i + '">' + cardHTML(k, 'mini') + '</button>').join('') +
      '</div><button type="button" class="btn btn-block" id="btn-give" disabled>' + t('ok') + '</button>', 'give', 'wide');
    $('modal').onclick = e => {
      const b = e.target.closest('[data-act="pick"]');
      if (b) { U.giveSel = b.dataset.kind; document.querySelectorAll('#modal .pick').forEach(x => x.classList.toggle('on', x === b)); $('btn-give').disabled = false; playSound('cardSelect'); return; }
      if (e.target.id === 'btn-give' && U.giveSel) { const rr = room(); closeModal(); Net.doGive(rr.g.v, me, U.giveSel); }
    };
  }
  function openReinsert(r, me) {
    const n = r.g.deck.length; let pos = Math.min(n, Math.floor(rnd(0, n + 1)));
    const strip = p => { let s = ''; for (let i = 0; i <= n; i++) s += '<i class="' + (i === p ? 'bomb' : '') + '"></i>'; return s; };
    openModal('<h3>' + t('reinsertTitle') + '</h3><p class="muted">' + t('reinsertBody') + '</p><div class="strip" id="re-strip">' + strip(pos) + '</div><div class="re-label" id="re-label">' + t('posLabel', pos, n) + '</div>' +
      '<input type="range" id="re-range" min="0" max="' + n + '" value="' + pos + '"><div class="re-btns"><button type="button" class="mini-btn" data-act="p0">' + t('posTop') + '</button><button type="button" class="mini-btn" data-act="pr">' + t('posRandom') + '</button><button type="button" class="mini-btn" data-act="pn">' + t('posBottom') + '</button></div>' +
      '<button type="button" class="btn btn-block" data-act="go">' + t('posConfirm') + '</button>', 'reinsert', 'wide');
    const upd = p => { pos = Math.max(0, Math.min(n, p)); $('re-range').value = pos; $('re-strip').innerHTML = strip(pos); $('re-label').textContent = t('posLabel', pos, n); playSound('uiHover'); };
    $('re-range').oninput = e => upd(+e.target.value);
    $('modal').onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'p0') upd(0); if (b.dataset.act === 'pn') upd(n); if (b.dataset.act === 'pr') upd(Math.floor(rnd(0, n + 1)));
      if (b.dataset.act === 'go') { const rr = room(); closeModal(); Net.doReinsert(rr.g.v, me, pos); }
    };
  }
  // one row of example cards per rule (same order as rulesBody in i18n.js); 'back' = a face-down card
  const RULE_DEMO = [['bomb'], ['back'], ['defuse'], ['nope'], ['attack'], ['skip', 'shuffle', 'future'], ['favor'], ['cat1', 'cat1', 'cat3', 'cat3', 'cat3'], ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'], ['bomb', 'defuse'], ['clone']];
  function openRules() {
    const body = I18N[LANG].rulesBody || I18N[DEFAULT_LANG].rulesBody;
    openModal('<h3>' + t('rulesTitle') + '</h3><ul class="rules-list">' + body.map((x, i) => '<li><div class="rule-txt">' + x + '</div><div class="rule-demo">' +
      (RULE_DEMO[i] || []).map(k => k === 'back' ? backCard('mini') : cardHTML(k, 'mini')).join('') + '</div></li>').join('') +
      '</ul><button type="button" class="btn btn-block" data-act="close">' + t('close') + '</button>', 'rules', 'wide');
    $('modal').onclick = e => { if (e.target.closest('[data-act="close"]')) closeModal(); };
  }
  function openWin(r, me) {
    const g = r.g, host = Net.isHost(r), team = !!g.winTeam, won = team ? !!me && g.teams[me] === g.winTeam : g.winner === me, ws = team ? winners(g) : [g.winner];
    openModal('<div class="win"><div class="win-team">' + ws.map(c => '<div class="win-av" style="--sc:var(--' + c + ')">' + CatArt.avatarSVG(c) + '</div>').join('') + '</div><h2>' + (team ? t('winTeam', nm(r, ws[0]), nm(r, ws[1] || ws[0])) : t('winTitle', nm(r, g.winner))) + '</h2><p>' + (me ? (won ? t(team ? 'youWonTeam' : 'youWon') : t(team ? 'youLostTeam' : 'youLost')) : '') + '</p><p class="muted">' + t('winBody') + '</p>' +
      (host ? '<button type="button" class="btn btn-block" data-act="lobby">' + t('again') + '</button>' : '<p class="muted">' + t('waitHost') + '</p>') + '<button type="button" class="btn btn-secondary btn-block" data-act="leave">' + t('leave') + '</button></div>', 'win');
    $('modal').onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'lobby') { closeModal(); Net.backToLobby(); }
      if (b.dataset.act === 'leave') { closeModal(); leaveToLobby(); }
    };
    FX.confetti();
  }
  function confirmLeave(where) {
    const body = where === 'waiting' ? t('leaveWaitingBody') : (Net.S.mode === 'local' ? t('leaveGameLocalBody') : t('leaveGameBody'));
    openModal('<h3>' + t('leaveTitle') + '</h3><p>' + body + '</p><div class="row"><button type="button" class="btn btn-secondary" data-act="stay">' + t('leaveStay') + '</button><button type="button" class="btn" data-act="go">' + t('leaveGo') + '</button></div>', 'leave');
    $('modal').onclick = e => { const b = e.target.closest('[data-act]'); if (!b) return; closeModal(); if (b.dataset.act === 'go') leaveToLobby(); };
  }
  function syncModals(r, me) {
    const g = r.g, k = U.modalFor;
    const needGive = !!me && g.phase === 'give' && g.give && g.give.from === me;
    const needRe = !!me && g.phase === 'reinsert' && g.reins && g.reins.by === me;
    if (!needGive && k === 'give') closeModal();
    if (!needRe && k === 'reinsert') closeModal();
    if ((k === 'target' || k === 'name') && !(g.phase === 'play' && g.turn === me) && !(me && M.cloneMode(g, me))) closeModal();
    if (needGive && k !== 'give' && !U.giveTimer) { U.giveTimer = setTimeout(() => { U.giveTimer = null; const rr = room(); if (rr && rr.g && rr.g.phase === 'give' && rr.g.give.from === me && U.modalFor !== 'give') openGive(rr, me); }, 500); }
    if (needRe && k !== 'reinsert' && !U.reTimer) { U.reTimer = setTimeout(() => { U.reTimer = null; const rr = room(); if (rr && rr.g && rr.g.phase === 'reinsert' && rr.g.reins.by === me && U.modalFor !== 'reinsert') openReinsert(rr, me); }, 1500); }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // log
  const flames = h => h > 0 ? ' ' + Icon.flames(h) : '';       // bomb heat shown next to its banner / log line
  function fmtLog(r, e, me) {
    const n = e.by ? nm(r, e.by) : '';
    if (e.k === 'fizzle' && e.calm) return { x: t('log.calm', n), c: '' };
    switch (e.k) {
      case 'play': return { x: playText(r, { by: e.by, kind: e.kind, kinds: e.kinds, target: e.target, name: e.name, copy: e.copy }), c: 'play' };
      case 'nope': return { x: t('log.nope', n, e.n), c: 'nope' };
      case 'cancel': return { x: t('log.cancel', n, ['pair', 'triple', 'five'].indexOf(e.kind) >= 0 ? t('cards.' + e.kind) : cname(e.kind)), c: 'nope' };
      case 'recover': return { x: t('log.recover', n, cname(e.name)), c: 'play' };
      case 'bomb': return { x: t('log.bomb', n) + flames(e.heat), c: 'danger' };
      case 'scorch': return { x: t('log.scorch', n), c: 'danger' };
      case 'hotdeck': return { x: t('log.hotdeck'), c: 'danger' };
      case 'cloneCat': return { x: t('log.cloneCat', n, cname(e.card)), c: 'good' };
      case 'defuse': return { x: t(e.clone ? 'log.defuseClone' : 'log.defuse', n), c: 'good' };
      case 'attack': case 'skip': case 'shuffle': case 'future': case 'draw': case 'reinsert': case 'explode': case 'win': case 'fizzle': return { x: t('log.' + e.k, n), c: e.k === 'bomb' || e.k === 'explode' ? 'danger' : (e.k === 'defuse' || e.k === 'win' ? 'good' : '') };
      case 'favor': return { x: t('log.favor', n, nm(r, e.target)), c: '' };
      case 'give': return { x: t('log.give', nm(r, e.from), n, null), c: '' };
      case 'steal': return { x: t('log.steal', n, nm(r, e.from), null), c: 'play' };
      case 'rescue': return { x: t('log.rescue', n, nm(r, e.mate)), c: 'danger' };
      case 'rescued': return { x: t('log.rescued', n, nm(r, e.mate)), c: 'good' };
      case 'rescueFail': return { x: t('log.rescueFail', n, nm(r, e.mate)), c: 'danger' };
      case 'miss': return { x: t('log.miss', n, nm(r, e.from), cname(e.name)), c: '' };
      case 'turn': return { x: t('log.turn', n, e.left), c: 'turn' };
    }
    return { x: '', c: '' };
  }
  function renderLog(r, me) {
    const box = $('log-panel'), g = r.g;
    const sig = g.v + '|' + LANG; if (box.dataset.sig === sig) return; box.dataset.sig = sig;
    box.innerHTML = g.log.map(e => { const f = fmtLog(r, e, me); return f.x ? '<div class="log-line ' + f.c + '">' + f.x + '</div>' : ''; }).join('');
    box.scrollTop = box.scrollHeight;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // effects for the events of the newest action
  // where a card I just received will sit: the hidden `.new` card in my hand
  const slot = me => $('hand').querySelector('.card.new') || $('hand');
  function anchor(c, me) { return c === me ? $('hand') : ($('opp-' + c) || $('hand')); }
  function processEvents(r, me) {
    const g = r.g;
    if (U.fxV == null) { U.fxV = g.v; if (g.v === 0) startDeal(r, me); return; }
    if (g.v <= U.fxV) return;
    U.fxV = g.v;
    if (document.hidden) return;                       // background tab: browsers freeze animations, so skip the show entirely
    U.fxTimers = U.fxTimers.filter(() => false);
    g.ev.slice().forEach((e, i) => U.fxTimers.push(setTimeout(() => { if (!document.hidden) fxEvent(r, e, me); }, i * 380)));
  }
  function startDeal(r, me) {
    U.dealing = true; U.handSig = null; renderHand(r, me);
    playSound('gameStart');
    const n = r.g.order.length;
    r.g.order.forEach((c, i) => { if (c === me) return; setTimeout(() => { playSound('cardDeal'); FX.fly($('deck-pile'), $('opp-' + c), backCard(), { w: 58, d: 380, to: .6 }); }, 300 + i * 140); });
    for (let i = 0; i < Math.min(7, r.settings.hand); i++) setTimeout(() => playSound('cardDeal'), 250 + i * 110);
    U.handSig = null; renderHand(r, me);
  }
  function fxEvent(r, e, me) {
    const g = r.g;
    switch (e.k) {
      case 'play': {
        FX.fly(anchor(e.by, me), $('discard-pile'), backCard(), { w: 60, d: 380, fade: true });
        FX.pop(e.kinds.map(k => cardHTML(k, 'pop-card')).join(''), playText(r, { by: e.by, kind: e.kind, kinds: e.kinds, target: e.target, name: e.name }));
        playSound('cardPlay'); if (M.CATS.indexOf(e.kinds[0]) >= 0) setTimeout(() => playMeow(e.kinds[0]), 120);
        break;
      }
      case 'nope': FX.pop(cardHTML('nope', 'pop-card'), t('log.nope', nm(r, e.by), e.n), 'nope'); playSound('nope'); buzz(40); break;
      case 'cancel': playSound('stealMiss'); break;
      case 'attack': playSound('attack'); FX.shake(260); break;
      case 'skip': playSound('skip'); break;
      case 'shuffle': playSound('shuffle'); { const d = $('deck-pile'); d.classList.remove('wiggle'); void d.offsetWidth; d.classList.add('wiggle'); } break;
      case 'future': playSound('future'); if (e.by === me && e.cards && e.cards.length) setTimeout(() => openPeek(e.cards), 250); break;
      case 'favor': playSound('favor'); break;
      case 'give': playSound('cardGive'); FX.fly(anchor(e.from, me), e.by === me ? slot(me) : anchor(e.by, me), backCard(), { w: 60, d: 420 });
        if (e.by === me) { setTimeout(() => { playSound('cardReceive'); toast(t('got', cname(e.card))); }, 350); } break;
      case 'steal': playSound('steal'); FX.fly(anchor(e.from, me), e.by === me ? slot(me) : anchor(e.by, me), backCard(), { w: 60, d: 420 });
        if (e.by === me) setTimeout(() => { playSound('cardReceive'); toast(t('got', cname(e.card))); }, 350);
        else if (e.from === me) toast(t('stolen', cname(e.card), nm(r, e.by))); break;
      case 'cloneCat': playSound('cardReceive'); if (e.by === me) setTimeout(() => toast(t('got', cname(e.card))), 250); break;
      case 'recover': playSound('steal'); FX.fly($('discard-pile'), e.by === me ? slot(me) : anchor(e.by, me), cardHTML(e.card), { w: 60, d: 420 });
        if (e.by === me) setTimeout(() => { playSound('cardReceive'); toast(t('got', cname(e.card))); }, 350); break;
      case 'miss': case 'fizzle': playSound('stealMiss'); break;
      case 'draw': playSound('cardDraw');
        if (e.by === me && e.card) FX.fly($('deck-pile'), slot(me), cardHTML(e.card), { w: $('deck-pile').querySelector('.pile-stack').offsetWidth, d: 600, to: 1 });   // the top card leaves the pile and lands in its slot
        else FX.fly($('deck-pile'), anchor(e.by, me), backCard(), { w: 64, d: 400, to: .6 });
        break;
      case 'bomb': FX.pop(cardHTML('bomb', 'pop-card'), t('bombBanner', nm(r, e.by)) + flames(e.heat), 'nope'); playSound('bombDraw'); FX.banner(t('bombBanner', nm(r, e.by)) + flames(e.heat), 'danger'); [250, 500, 750].forEach(ms => setTimeout(() => playSound('bombTick'), ms)); buzz([60, 40, 60]); break;
      case 'rescue': playSound('bombTick'); break;
      case 'scorch': playSound('bombTick'); FX.banner(t('scorchBanner'), 'danger'); buzz([80, 40, 80]); break;
      case 'hotdeck': playSound('bombTick'); FX.banner(t('hotdeckBanner'), 'danger'); break;
      case 'rescued': playSound('defuse'); FX.banner(t('rescuedBanner'), 'good'); buzz([40, 30, 40]); break;
      case 'rescueFail': playSound('stealMiss'); break;
      case 'defuse': playSound('defuse'); FX.banner(t('defusedBanner'), 'good'); break;
      case 'reinsert': playSound('reinsert'); FX.fly(anchor(e.by, me), $('deck-pile'), backCard(), { w: 58, d: 380, fade: true }); break;
      case 'explode': playSound('explode'); setTimeout(() => playSound('eliminated'), 450); FX.boom($('opp-' + e.by) || $('me-chip')); FX.banner(t('boomBanner', nm(r, e.by)), 'danger'); buzz([120, 50, 240]); break;
      case 'win': setTimeout(() => playSound(e.by === me || !me ? 'win' : 'lose'), 600); break;
      case 'turn':
        if (me && e.by === me && g.phase === 'play') { playSound('yourTurn'); buzz(40); } else playSound('endTurn');
        break;
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // the driver: whoever is the "driver" client runs bots, AFK seats and the Nope-window timer; every human also
  // auto-passes the Nope window when they hold no Nope (so the window can end early).
  function schedule(r, me) {
    const g = r.g;
    if (r.status !== 'playing') { clearTimers(); U.driveKey = null; return; }
    if (me && g.phase === 'pending' && g.alive[me] && !Net.botControlled(r, me) && g.pending) {
      const p = g.pending, key = p.pid + ':' + p.n;
      if (U.passKey !== key) {
        U.passKey = key;
        const mineEven = p.by === me && p.nopes.length % 2 === 0;
        if ((!M.canNope(g, me) && !M.cloneReady(g, me)) || mineEven) setTimeout(() => { const rr = room(); if (rr && rr.g && rr.g.phase === 'pending' && rr.g.pending.pid === p.pid && rr.g.pending.n === p.n) Net.doPass(me, p.pid, p.n); }, rnd(350, 1000));
      }
    }
    if (!Net.isDriver(r)) { clearTimers(); U.driveKey = null; return; }
    const key = g.v + '|' + g.phase + '|' + (g.pending ? g.pending.pid + ':' + g.pending.n : '');
    const later = (ms, fn) => U.timers.push(setTimeout(fn, ms));
    if (key !== U.driveKey) {
      clearTimers(); U.driveKey = key; U.earlyKey = null;
      const v = g.v, lvl = c => Net.botLevel(r.seats[c]);
      if (g.phase === 'play' && g.alive[g.turn] && Net.botControlled(r, g.turn)) later(rnd(1300, 2200), () => botTurn(g.turn, v));
      else if (g.phase === 'give' && Net.botControlled(r, g.give.from)) later(rnd(1000, 1700), () => { const rr = room(); if (rr && rr.g && rr.g.v === v) Net.doGive(v, g.give.from, M.botGive(rr.g, g.give.from)); });
      else if (g.phase === 'reinsert' && Net.botControlled(r, g.reins.by)) later(rnd(1300, 2000), () => { const rr = room(); if (rr && rr.g && rr.g.v === v) Net.doReinsert(v, g.reins.by, M.botReinsert(rr.g, g.reins.by, lvl(g.reins.by))); });
      else if (g.phase === 'rescue' && g.rescue) {            // safety net: if nobody reports a result, the driver fails the minigame
        const rs = g.rescue; later((Coop.limit(rs.game, rs.heat || 0) + 16) * 1000, () => Net.doRescueEnd(rs.id, false));
      }
      else if (g.phase === 'pending') {
        const p = g.pending, ms = r.settings.nopeSec * 1000;
        M.aliveList(g).forEach(c => {
          if (!Net.botControlled(r, c)) return;
          later(Math.min(rnd(800, 2200), ms - 500), () => {
            const rr = room(); if (!rr || !rr.g || rr.g.phase !== 'pending' || rr.g.pending.pid !== p.pid || rr.g.pending.n !== p.n) return;
            if (M.botReact(rr.g, c, lvl(c)) === 'nope') Net.doNope(rr.g.v, c, rr.g.pending.n); else Net.doPass(c, p.pid, p.n);
          });
        });
        later(ms + 150, () => Net.doResolve(p.pid, p.n));
      }
    } else if (g.phase === 'pending' && g.pending && M.allPassed(g) && U.earlyKey !== key) {
      U.earlyKey = key; const p = g.pending; later(260, () => Net.doResolve(p.pid, p.n));
    }
  }
  function botTurn(c, v) {
    const r = room(); if (!r || !r.g || r.g.v !== v || r.g.phase !== 'play' || r.g.turn !== c) return;
    const a = M.botPlay(r.g, c, Net.botLevel(r.seats[c]));
    if (a.t === 'draw') Net.doDraw(v, c);
    else Net.doPlay(v, c, a.kinds, a.opts).then(ok => { if (!ok) { const rr = room(); if (rr && rr.g) Net.doDraw(rr.g.v, c); } });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 2v2 cooperative defuse: open the minigame overlay once the bomb banner has played, close it when the phase moves on
  function syncCoop(r, me) {
    const g = r.g;
    if (g.phase === 'rescue' && g.rescue) {
      if (U.coopId !== g.rescue.id) { U.coopId = g.rescue.id; clearTimeout(U.coopTimer); U.coopTimer = setTimeout(() => openCoop(room()), 1500); }
    } else if (U.coopId != null) { U.coopId = null; clearTimeout(U.coopTimer); Coop.close(); }
  }
  function openCoop(r) {
    if (!r || !r.g || r.g.phase !== 'rescue' || !r.g.rescue || U.coopId !== r.g.rescue.id) return;
    const rs = r.g.rescue, me = myColor(r), roles = { p1: rs.p1, p2: rs.p2 }, driver = Net.isDriver(r);
    const human = [rs.by, rs.mate].filter(c => !Net.botControlled(r, c)), auth = human[0] || null, sim = {};
    ['p1', 'p2'].forEach(k => { if (Net.botControlled(r, roles[k]) && driver) sim[k] = Net.botLevel(r.seats[roles[k]]); });   // the driver plays the bot teammate
    closeModal(); U.sel = {};
    Coop.open({ rid: rs.id, kind: rs.game, seed: rs.seed, level: rs.heat || 0, roles, me, sim, isAuth: auth ? auth === me : driver, t, avatar: c => CatArt.avatarSVG(c),
      names: { p1: nm(r, roles.p1), p2: nm(r, roles.p2) }, sound: playSound, buzz,
      sbKey: me || ('sp_' + String(Net.MY_UID).replace(/[^A-Za-z0-9_]/g, '')), nameOf: k => (r.seats[k] ? nm(r, k) : ''),   // viewers' sabotage node (seat colour, or a spectator id)
      send: (color, data) => Net.rtSend(rs.id, color, data), listen: cb => Net.rtListen(rs.id, cb),
      onEnd: ok => { const rr = room(); if (rr && rr.g && rr.g.phase === 'rescue') Net.doRescueEnd(rs.id, ok).then(() => setTimeout(() => Net.rtClear(rs.id), 2500)); } });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // main render + room events
  function renderGame(r, prev) {
    const g = r.g, me = myColor(r);
    $('game-room-code-label').textContent = Net.S.mode === 'local' ? t('offlineRoom') : Net.S.code;
    const sp = $('spectator-badge'); sp.textContent = t('spectating'); sp.style.display = me ? 'none' : '';
    trackFresh(r, me);
    renderOpps(r, me); renderPiles(r, me); renderBanner(r, me); renderBar(r, me); renderHand(r, me); renderLog(r, me); updateActions(r, me);
    processEvents(r, me); syncModals(r, me); syncCoop(r, me); schedule(r, me);
    if (g.phase === 'over' && U.winV !== g.v) { U.winV = g.v; setTimeout(() => { const rr = room(); if (rr && rr.status === 'ended') openWin(rr, myColor(rr)); }, 2300); }
  }
  function resetGameUI() {
    clearTimeout(U.coopTimer); U.coopId = null; Coop.close();
    clearTimers(); clearTicks(); U.fxTimers.forEach(clearTimeout); U.fxTimers = []; clearTimeout(U.reTimer); clearTimeout(U.giveTimer); U.reTimer = U.giveTimer = null;
    Object.assign(U, { sel: {}, fresh: null, freshWhy: null, freshV: null, driveKey: null, earlyKey: null, passKey: null, passedKey: null, barKey: null, nopeSeen: null, fxV: null, handSig: null, prevHand: null, dealing: false, winV: null, chips: {} });
    ['opps', 'fx', 'stage', 'hand'].forEach(id => { const el = $(id); if (el) el.innerHTML = ''; });
    $('log-panel').dataset.sig = ''; clearTimeout(U.coolTimer); $('nope-bar').classList.remove('show', 'cool');
  }
  function onRoomChange(r, prev) {
    if (!r) { if (U.screen === 'waiting' || U.screen === 'game') { toast(t('noRoom')); leaveToLobby(true); } return; }
    if (Net.S.mode === 'online') { rememberRoom(Net.S.code); if (location.hash.replace('#', '') !== Net.S.code) { try { history.replaceState(null, '', location.pathname + '#' + Net.S.code); } catch (e) {} } }   // the address bar always names the room: refresh / back-forward lands in the same place
    if (r.status === 'lobby') {
      if (U.screen === 'game') { closeModal(); resetGameUI(); }
      if (U.screen !== 'waiting') { closeModal(); showScreen('waiting'); }
      renderWaiting(r);
      if (prev && prev.status === 'lobby') {
        const a = Object.keys(prev.seats).length, b = Object.keys(r.seats).length;
        if (b > a) playSound('join'); else if (b < a) playSound('leave');
      }
    } else {
      if (U.screen !== 'game') { closeModal(); resetGameUI(); showScreen('game'); }
      renderGame(r, prev);
    }
  }
  function leaveToLobby(silent) {
    clearTimers(); closeModal();
    if (!silent && Net.S.mode === 'online') { Net.leaveSeat().finally(() => {}); }
    Net.detach(); forgetRoom(); resetGameUI(); showScreen('lobby'); history.replaceState(null, '', location.pathname);
  }
  function rememberRoom(code) { try { localStorage.setItem(LAST_KEY, JSON.stringify({ code, ts: Date.now() })); } catch (e) {} }
  function forgetRoom() { try { localStorage.removeItem(LAST_KEY); } catch (e) {} $('resume-card').style.display = 'none'; }
  function paintResume() {
    try {
      const v = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
      if (v && v.code && Date.now() - v.ts < 6 * 36e5 && Net.ONLINE_OK) { $('resume-body').textContent = t('resumeBody', v.code); $('resume-card').style.display = ''; $('btn-resume').dataset.code = v.code; }
    } catch (e) {}
  }
  function inviteCode() {
    const m = (location.hash || '').replace('#', '') || new URLSearchParams(location.search).get('room') || '';
    return /^[A-Za-z0-9]{5}$/.test(m) ? m.toUpperCase() : '';
  }

  // ---------------------------------------------------------------------------------------------------------------
  // wiring
  function enterRoom(res) {
    if (res && res.ok === false) { toast(t(res.reason || 'noRoom')); playSound('error'); return false; }
    return true;
  }
  function wire() {
    $('input-name').value = (function () { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } })();
    $('input-name').addEventListener('input', () => { try { localStorage.setItem(NAME_KEY, $('input-name').value); } catch (e) {} });
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(x => x.classList.toggle('active', x === b));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab)); playSound('uiClick');
    }));
    $('btn-create-room').addEventListener('click', async () => { playSound('uiClick'); if (!Net.ONLINE_OK) return toast(t('onlineOff')); try { await Net.createOnline(myName()); } catch (e) { toast(t('onlineOff')); } });
    const join = async () => {
      const code = $('input-room-code').value.trim(); if (code.length < 4) return; playSound('uiClick');
      try { enterRoom(await Net.joinOnline(code, myName())); } catch (e) { toast(t('onlineOff')); }
    };
    $('btn-join-room').addEventListener('click', join);
    $('input-room-code').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
    $('btn-start-offline').addEventListener('click', () => { playSound('uiClick'); Net.createLocal(myName()); showScreen('waiting'); renderWaiting(room()); });
    $('btn-resume').addEventListener('click', async () => { const c = $('btn-resume').dataset.code; const ok = await Net.tryRejoin(c); if (!ok) { toast(t('noRoom')); forgetRoom(); } });
    $('btn-leave-waiting').addEventListener('click', () => confirmLeave('waiting'));
    $('btn-leave-game').addEventListener('click', () => confirmLeave('game'));
    $('btn-rules').addEventListener('click', () => { playSound('uiClick'); openRules(); });
    $('btn-sound').addEventListener('click', () => { setSoundEnabled(!soundEnabled); applyStaticText(); playSound('uiClick'); });
    $('btn-start-game').addEventListener('click', () => { playSound('uiClick'); Net.startGame(); });
    $('room-code-box').addEventListener('click', () => {
      if (Net.S.mode !== 'online') return; const url = location.origin + location.pathname + '#' + Net.S.code;
      try { navigator.clipboard.writeText(url); toast(t('copied')); } catch (e) {}
    });
    $('seat-grid').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return; const c = b.dataset.color; playSound('uiClick');
      if (b.dataset.act === 'addbot') Net.addBot(c); else if (b.dataset.act === 'remove') Net.removeSeat(c); else if (b.dataset.act === 'sit') Net.sit(c); else if (b.dataset.act === 'lvl') Net.setBotLevel(c, b.dataset.val);
    });
    $('rules-list').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; playSound('uiClick'); const r = room(); if (!r) return;
      if (b.dataset.act === 'set') { const v = b.dataset.val; Net.setSetting(b.dataset.key, v === 'true' ? true : (v === 'false' ? false : (isNaN(+v) ? v : +v))); }
      if (b.dataset.act === 'step') Net.setSetting(b.dataset.key, r.settings[b.dataset.key] + (+b.dataset.d));
    });
    $('hand').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) onCardClick(c.dataset.kind, +c.dataset.i || 0, false); });
    $('hand').addEventListener('dblclick', e => { const c = e.target.closest('.card'); if (c) onCardClick(c.dataset.kind, +c.dataset.i || 0, true); });
    $('btn-play').addEventListener('click', playSelected);
    $('btn-draw').addEventListener('click', doDraw);
    $('deck-pile').addEventListener('click', () => { const r = room(); if (r && r.g && $('deck-pile').classList.contains('can-draw')) doDraw(); });
    $('nope-bar').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; if (b.dataset.act === 'nope') doNope(); if (b.dataset.act === 'pass') doPass(); });
    document.addEventListener('mouseover', e => { const b = e.target.closest && e.target.closest('.btn:not(:disabled), .mini-btn, .seg-btn, .target, .pick'); if (b && b !== U.hoverEl) { U.hoverEl = b; playSound('uiHover'); } else if (!b) U.hoverEl = null; });
    document.addEventListener('keydown', e => {
      if (U.screen !== 'game' || $('modal').classList.contains('open') || /INPUT|SELECT|TEXTAREA/.test((e.target.tagName || ''))) return;
      const k = e.key.toLowerCase(), r = room(); if (!r || !r.g) return;
      if (k === 'd') doDraw(); else if (k === 'enter') playSelected(); else if (k === 'n') doNope(); else if (k === 'p') doPass(); else if (k === 'escape') { U.sel = {}; U.handSig = null; renderHand(r, myColor(r)); updateActions(r, myColor(r)); }
    });
    // coming back from another tab: drop every half-played effect and redraw the table from the real state
    document.addEventListener('visibilitychange', () => {
      U.fxTimers.forEach(clearTimeout); U.fxTimers = []; FX.clear();
      if (document.hidden) return;
      const r = room(); if (U.screen !== 'game' || !r || !r.g) return;
      U.fxV = r.g.v; U.dealing = false; U.handSig = null; U.barKey = null; U.chips = {}; $('opps').innerHTML = '';
      renderGame(r, null);
    });
    let rz; window.addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(layoutHand); });
  }

  function boot() {
    CatArt.mount();
    $('lobby-logo').innerHTML = CatArt.logoSVG();
    document.querySelectorAll('#deck-pile .pile-stack > div').forEach(d => { d.innerHTML = backCard(); });
    try { const ic = document.querySelector('link[rel=icon]'); if (ic) ic.href = 'data:image/svg+xml,' + encodeURIComponent(CatArt.logoSVG()); } catch (e) {}
    document.documentElement.lang = I18N[LANG].meta.htmlLang || LANG;
    buildLangSelects(); applyStaticText(); wire();
    Net.onChange = onRoomChange;
    if (!Net.ONLINE_OK) $('online-off-note').style.display = '';
    // A refresh must put the player back exactly where they were (lobby, waiting room or the table in the middle of a match):
    //   1) an unfinished OFFLINE game is restored from localStorage;  2) an online room is re-entered from the saved code (or the #CODE of the address).
    // Until the room answers a spinner is shown; if it is gone the normal lobby appears.
    const code = inviteCode();
    if (!code && Net.restoreLocal()) return;
    let saved = null; try { saved = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) {}
    const want = code || (saved && saved.code && Date.now() - saved.ts < 12 * 36e5 ? saved.code : '');
    const toLobby = () => { showScreen('lobby'); paintResume(); if (code) { document.querySelector('[data-tab="join"]').click(); $('input-room-code').value = code; } };
    if (want && Net.ONLINE_OK) {
      showScreen('loading');
      const timeout = new Promise(res => setTimeout(() => res(null), 8000));
      Promise.race([Net.tryRejoin(want, true), timeout]).then(ok => {
        if (ok) return;                                              // onRoomChange has already switched to waiting / game
        if (!code) forgetRoom();
        toLobby();
      }).catch(toLobby);
    } else toLobby();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
