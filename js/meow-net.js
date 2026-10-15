// meow-net.js — room storage + every room-level action.
// Two backends behind one interface:
//   online : Firebase Realtime Database, room at rooms/meow_<CODE>
//   local  : in-memory (offline vs bots), no network at all
//
// Every write is a pure function  room -> room  (or undefined to abort). Online it runs inside a Firebase
// transaction (so racing clients cannot clobber each other), locally it just runs. Rules live in meow-engine.js.

const Net = (function () {
  const M = Meow;
  const MY_UID = (function () {
    try {
      let id = localStorage.getItem('meow_uid');
      if (!id) { id = 'u_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('meow_uid', id); }
      return id;
    } catch (e) { return 'u_' + Math.random().toString(36).slice(2, 10); }
  })();
  const ONLINE_OK = typeof db !== 'undefined' && db !== null;
  const AFK_MS = 20000;
  const S = { mode: null, code: null, room: null, onChange: null, ref: null, connRef: null };

  const codeGen = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
  const keyOf = code => 'meow_' + code;

  function normalizeRoom(r) {
    if (!r) return r;
    r.seats = r.seats || {};
    r.settings = M.normalizeSettings(r.settings);
    if (r.g) M.normalize(r.g);
    return r;
  }
  function emit(prev) { if (S.onChange) S.onChange(S.room, prev); }

  async function mutate(fn) {
    if (S.mode === 'local') {
      const prev = S.room, next = fn(JSON.parse(JSON.stringify(S.room)));
      if (!next) return false;
      S.room = normalizeRoom(next); emit(prev); return true;
    }
    if (S.mode === 'online') {
      const res = await S.ref.transaction(cur => {
        if (cur === null) return cur;
        const out = fn(normalizeRoom(JSON.parse(JSON.stringify(cur))));
        return out === undefined || out === false || out === null ? undefined : out;
      }, undefined, false);
      return !!(res && res.committed);
    }
    return false;
  }

  // ---- connect / disconnect -----------------------------------------------------------------------------------
  function attach(code) {
    S.mode = 'online'; S.code = code; S.ref = db.ref('rooms/' + keyOf(code));
    S.ref.on('value', snap => {
      const prev = S.room, val = snap.val();
      S.room = val ? normalizeRoom(val) : null; emit(prev);
    });
    S.connRef = db.ref('.info/connected');
    S.connRef.on('value', snap => { if (snap.val() === true && S.room) armPresence(); });
  }
  function mySeatColor(room) {
    room = room || S.room; if (!room) return null;
    if (S.mode === 'local') return Object.keys(room.seats).find(c => room.seats[c] && room.seats[c].local) || null;   // offline: the one human
    return Object.keys(room.seats).find(c => room.seats[c] && room.seats[c].uid === MY_UID) || null;
  }
  function armPresence() {
    const c = mySeatColor(); if (!c || S.mode !== 'online') return;
    const r = S.ref.child('seats/' + c);
    r.child('connected').onDisconnect().set(false);
    r.child('lastSeen').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
    r.child('connected').set(true); r.child('lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
  }
  function detach() {
    if (S.ref) { S.ref.off(); S.ref = null; }
    if (S.connRef) { S.connRef.off(); S.connRef = null; }
    S.mode = null; S.code = null; S.room = null;
  }

  // ---- lobby --------------------------------------------------------------------------------------------------
  const freeColor = (room, prefer) => (prefer && !room.seats[prefer]) ? prefer : M.COLORS.find(c => !room.seats[c]) || null;
  const baseRoom = host => ({ game: 'meow', hostUid: host, status: 'lobby', settings: Object.assign({}, M.DEFAULT_SETTINGS), seats: {}, g: null, createdAt: Date.now() });

  async function createOnline(name) {
    if (!ONLINE_OK) throw new Error('offline');
    const code = codeGen(), room = baseRoom(MY_UID);
    room.seats.coral = { uid: MY_UID, name, connected: true, bot: false };
    await db.ref('rooms/' + keyOf(code)).set(room);
    attach(code); return code;
  }
  async function joinOnline(code, name) {
    if (!ONLINE_OK) throw new Error('offline');
    code = code.toUpperCase().trim();
    const snap = await db.ref('rooms/' + keyOf(code)).get();
    if (!snap.exists()) return { ok: false, reason: 'noRoom' };
    attach(code);
    await new Promise(res => { const t0 = Date.now(); (function w() { if (S.room || Date.now() - t0 > 4000) res(); else setTimeout(w, 30); })(); });
    if (!S.room) { detach(); return { ok: false, reason: 'noRoom' }; }
    if (mySeatColor()) return { ok: true, resumed: true };
    if (S.room.status === 'lobby') {
      const ok = await mutate(r => {
        if (r.status !== 'lobby') return undefined;
        if (Object.values(r.seats).some(s => s && s.uid === MY_UID)) return r;
        const c = freeColor(r); if (!c) return undefined;
        r.seats[c] = { uid: MY_UID, name, connected: true, bot: false };
        return r;
      });
      if (!ok) { detach(); return { ok: false, reason: 'roomFull' }; }
      return { ok: true };
    }
    return { ok: true, spectator: true };
  }
  async function tryRejoin(code) {
    if (!ONLINE_OK || !code) return null;
    code = code.toUpperCase();
    const snap = await db.ref('rooms/' + keyOf(code)).get();
    if (!snap.exists()) return null;
    const r = normalizeRoom(snap.val());
    if (Object.values(r.seats).some(s => s && s.uid === MY_UID)) { attach(code); return code; }
    return null;
  }
  function createLocal(name) {
    S.mode = 'local'; S.code = 'LOCAL';
    const room = baseRoom('local_host');
    room.seats.coral = { uid: 'local_1', name, local: true, bot: false, connected: true };
    room.seats.mint = { uid: 'bot_mint', name: '', bot: true, level: 'normal', connected: true };
    S.room = normalizeRoom(room); return 'LOCAL';
  }

  const isHost = room => S.mode === 'local' || (!!room && room.hostUid === MY_UID);
  // exactly one connected client runs bots / timers: the host, or the first connected human if the host is gone
  function isDriver(room) {
    if (S.mode === 'local') return true;
    if (!room) return false;
    const humans = M.COLORS.map(c => room.seats[c]).filter(s => s && !s.bot && !s.local && s.connected !== false);
    const host = humans.find(s => s.uid === room.hostUid);
    const d = host || humans[0];
    return !!d && d.uid === MY_UID;
  }
  function botControlled(room, color) {
    const s = room && room.seats[color]; if (!s) return false;
    if (s.bot) return true;
    return S.mode === 'online' && !s.local && s.connected === false && Date.now() - (s.lastSeen || 0) > AFK_MS;
  }
  const botLevel = seat => (seat && M.BOT_LEVELS.indexOf(seat.level) >= 0) ? seat.level : 'normal';

  const setSetting = (key, value) => mutate(r => { if (r.status !== 'lobby') return undefined; r.settings[key] = value; r.settings = M.normalizeSettings(r.settings); return r; });
  function sit(color) {
    if (S.mode !== 'online') return;
    return mutate(r => {
      if (r.status !== 'lobby' || r.seats[color]) return undefined;
      const old = Object.keys(r.seats).find(c => r.seats[c] && r.seats[c].uid === MY_UID); if (!old) return undefined;
      r.seats[color] = r.seats[old]; delete r.seats[old]; return r;
    }).then(ok => { if (ok) armPresence(); return ok; });
  }
  const addBot = color => mutate(r => { if (r.status !== 'lobby' || r.seats[color]) return undefined; r.seats[color] = { uid: 'bot_' + color, name: '', bot: true, level: 'normal', connected: true }; return r; });
  const removeSeat = color => mutate(r => { if (r.status !== 'lobby' || !r.seats[color]) return undefined; delete r.seats[color]; return r; });
  const setBotLevel = (color, level) => mutate(r => { const s = r.seats[color]; if (!s || !s.bot || M.BOT_LEVELS.indexOf(level) < 0) return undefined; s.level = level; return r; });
  function leaveSeat() {
    if (S.mode !== 'online') return Promise.resolve();
    const c = mySeatColor(); if (!c) return Promise.resolve();
    return mutate(r => {
      if (r.status === 'lobby') {
        delete r.seats[c];
        const rest = Object.keys(r.seats).filter(k => r.seats[k] && !r.seats[k].bot);
        if (r.hostUid === MY_UID && rest.length) r.hostUid = r.seats[rest[0]].uid;
        return r;
      }
      r.seats[c].connected = false; r.seats[c].lastSeen = Date.now(); return r;
    });
  }
  function startGame() {
    return mutate(r => {
      if (r.status !== 'lobby') return undefined;
      const colors = Object.keys(r.seats).filter(c => r.seats[c]);
      if (colors.length < 2) return undefined;
      r.g = M.newGame(r.settings, colors, colors[Math.floor(Math.random() * colors.length)]);
      r.status = 'playing'; return r;
    });
  }
  const backToLobby = () => mutate(r => { r.status = 'lobby'; r.g = null; return r; });

  // ---- in-game actions ----------------------------------------------------------------------------------------
  // expectV protects against acting on stale state (double clicks, races): the action only lands if the game is
  // still at the version the player was looking at.
  function act(expectV, fn) {
    return mutate(r => {
      if (r.status !== 'playing' || !r.g || (expectV != null && r.g.v !== expectV)) return undefined;
      const out = fn(r.g, r.settings); if (!out) return undefined;
      r.g = out; if (r.g.phase === 'over') r.status = 'ended';
      return r;
    });
  }
  const doPlay = (v, color, kinds, opts) => act(v, (g, s) => M.play(g, color, kinds, opts, s));
  const doDraw = (v, color) => act(v, g => M.draw(g, color));
  const doNope = (v, color) => act(v, g => M.nope(g, color));
  const doGive = (v, color, kind) => act(v, g => M.giveCard(g, color, kind));
  const doReinsert = (v, color, pos) => act(v, g => M.reinsert(g, color, pos));
  const doPass = (color, pid, n) => act(null, g => M.pass(g, color, pid, n));
  const doResolve = (pid, n) => act(null, g => M.resolve(g, pid, n));

  return {
    MY_UID, ONLINE_OK, S, set onChange(f) { S.onChange = f; },
    createOnline, joinOnline, tryRejoin, createLocal, detach, mySeatColor, isHost, isDriver, botControlled, botLevel,
    setSetting, sit, addBot, removeSeat, setBotLevel, leaveSeat, startGame, backToLobby,
    doPlay, doDraw, doNope, doGive, doReinsert, doPass, doResolve
  };
})();
