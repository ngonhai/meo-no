// i18n.js — all UI text. Vietnamese (default) + English.
//
// ADD A LANGUAGE: copy the whole `en: { ... }` block, rename the key to the language code (e.g. `ja`), translate the
// values and set `meta.name`. The picker, the saved choice and every screen pick it up automatically.
// Missing keys fall back to English (the console lists them). Values that are functions receive their arguments in
// the same order as the English version. t('key.path', ...args) looks the text up.

const I18N = {
  vi: {
    meta: { name: 'Tiếng Việt', htmlLang: 'vi' },
    title: 'Mèo Nổ',
    subtitle: 'Bốc bài, né bom — mèo cuối cùng còn sống thì thắng',
    yourName: 'Tên cậu là gì', namePh: 'e.g. Sơn Tùng MVP',
    tabCreate: 'Tạo Phòng', tabJoin: 'Tham Gia', tabOffline: 'Chơi Offline',
    createRoom: 'Tạo Phòng', joinRoom: 'Tham Gia', roomCode: 'Code Phòng', codePh: 'e.g. K7XPS',
    offlineHint: 'Đấu với 1–4 bot trên máy này — không cần mạng. (Bài trên tay là bí mật nên offline chỉ có 1 người.)',
    startOffline: 'Chơi Offline',
    onlineOff: 'Không kết nối được Server — chơi offline đi.',
    noRoom: 'Không tìm thấy phòng này.', roomFull: 'Phòng đã đầy.',
    roomCodeShare: 'Code Phòng — chia sẻ cho bạn bè', offlineRoom: 'Phòng Offline',
    seats: 'Chọn Mèo', empty: 'Trống', host: 'Chủ phòng', bot: 'Bot', you: 'Cậu',
    sit: 'Ngồi đây', addBot: '+ Bot', remove: 'Bỏ', kick: 'Kick',
    leaveTitle: 'Rời Game...?', leaveStay: 'Ở lại', leaveGo: 'Rời đi',
    leaveWaitingBody: 'Có chắc sẽ rời khỏi phòng này?',
    leaveGameBody: 'Bạn sẽ thoát khỏi ván đang chơi. Bot sẽ chơi thay chỗ.',
    leaveGameLocalBody: 'Ván Offline sẽ không được lưu lại.',
    houseRules: 'Luật Chơi', hostOnly: 'Chỉ chủ phòng mới đổi được luật.',
    start: 'Bắt Đầu', waitHost: 'Chờ chủ phòng Bắt Đầu...', needTwo: 'Cần ít nhất 2 Người/Bot.',
    leave: 'Rời', rules: 'Luật', sound: 'Âm thanh', copied: 'Đã copy link chứa code',
    colors: { coral: 'Cam San Hô', mint: 'Xanh Bạc Hà', sky: 'Xanh Trời', violet: 'Tím', pink: 'Hồng' },
    player: 'Người chơi',
    level: { easy: 'Dễ', normal: 'Vừa', hard: 'Khó' },
    set: {
      nopeSec: 'Thời gian được “Từ Chối”', nopeHint: 'Sau khi ai đó đánh bài, mọi người có chừng này giây để chặn.', secs: n => `${n} giây`,
      hand: 'Số bài ban đầu', handHint: 'Chưa tính 1 lá Gỡ Bom luôn có sẵn.',
      combos: 'Đánh đôi / ba lá mèo', combosHint: 'Đôi: cướp ngẫu nhiên 1 lá. Ba: gọi tên 1 lá để đòi.', on: 'Bật', off: 'Tắt'
    },
    botNames: { coral: 'Bí Ngô', mint: 'Bạc Hà', sky: 'Mây', violet: 'Khoai Môn', pink: 'Kẹo Bông' },
    turnHint: 'Đánh bài hoặc bốc bài để kết thúc lượt.', waitingOn: n => `Chờ ${n}…`, youOut: 'Bạn đã nổ — ngồi xem tiếp nhé.',
    knownTop: 'Bạn đã biết', online: 'Online', pending: n => `${n} vừa đánh bài`, noTarget: 'Không ai có bài để nhắm tới.',
    lobbyResume: 'Có ván đang chơi dở', resumeBody: c => `Phòng ${c} — quay lại?`, resume: 'Quay lại', joinSeat: 'Ngồi vào',
    seatTaken: 'Chỗ này có người rồi.', cantPlay: 'Chưa đánh được lá này.', cannotNow: 'Chưa tới lượt bạn.',
    // ---- in game
    yourTurn: 'Tới lượt bạn!', turnOf: n => `Lượt của ${n}`, turnsLeft: n => `còn ${n} lượt`,
    draw: 'Bốc bài (kết thúc lượt)', drawShort: 'Bốc bài',
    play1: 'Đánh lá này', play2: 'Đánh đôi', play3: 'Đánh bộ ba', pickCards: 'Chọn bài để đánh',
    nopeBtn: 'TỪ CHỐI!', passBtn: 'Cho qua', nopeWindow: 'Có ai Từ Chối không?', nopeCount: n => `Từ Chối ×${n}`,
    cardsN: n => `${n} lá`, outLabel: 'Đã nổ', spectating: 'Đang xem 👀', handTitle: 'Bài trên tay',
    deckLeft: n => `${n} lá`, discard: 'Chồng bỏ', deckTop: 'Chồng bốc',
    pickTarget: 'Chọn một người', pickTargetBody: 'Đánh bài này lên ai?',
    pickName: 'Gọi tên lá bài', pickNameBody: 'Nếu họ có lá này, bạn lấy được nó.',
    peekTitle: 'Ba lá trên cùng', peekBody: 'Lá đầu tiên nằm ngoài cùng bên trái. Chỉ mình bạn thấy.', peekClose: 'Đã nhớ',
    giveTitle: n => `${n} xin xỏ cậu!`, giveBody: 'Chọn một lá để tặng — tùy cậu.', giveWait: (a, b) => `${a} đang chọn lá tặng ${b}…`,
    reinsertTitle: 'Gỡ bom thành công!', reinsertBody: 'Nhét Mèo Nổ vào lại chồng bốc. Chỉ bạn biết nó nằm đâu.',
    posTop: 'Trên cùng', posBottom: 'Dưới cùng', posRandom: 'Ngẫu nhiên', posConfirm: 'Nhét vào',
    posLabel: (i, n) => i === 0 ? 'Lá tiếp theo bị bốc sẽ là bom!' : (i >= n ? 'Dưới đáy chồng' : `Sau ${i} lá an toàn`),
    bombBanner: n => `${n} bốc trúng MÈO NỔ!`, defusedBanner: 'Gỡ bom thành công!', boomBanner: n => `${n} nổ tung!`,
    got: c => `Nhận được: ${c}`, stolen: (c, n) => `${n} lấy mất ${c} của bạn`,
    winTitle: n => `${n} thắng!`, youWon: 'Cậu là mèo sống sót cuối cùng! 🏆', youLost: 'Ván này cậu không sống sót…', winBody: 'Chơi lại không?',
    again: 'Về phòng chờ', close: 'Đóng', ok: 'OK',
    rulesTitle: 'Luật chơi Mèo Nổ',
    rulesBody: [
      '<b>Mục tiêu:</b> là mèo cuối cùng còn sống. Chồng bốc có <b>Mèo Nổ</b> 💣 — bốc trúng mà không có Gỡ Bom là nổ, bị loại.',
      '<b>Lượt của bạn:</b> đánh bao nhiêu lá hành động cũng được (hoặc không đánh), rồi <b>bốc 1 lá</b> để kết thúc lượt.',
      '<b>Gỡ Bom:</b> bốc trúng bom mà có Gỡ Bom → bom bị gỡ, bạn nhét nó lại <b>bí mật</b> vào vị trí tùy ý trong chồng bốc.',
      '<b>Từ Chối:</b> ngay khi ai đó đánh bài, bất kỳ ai cũng có thể Từ Chối để hủy nó. Từ Chối cũng bị Từ Chối được!',
      '<b>Tấn Công:</b> bạn không bốc, người kế tiếp phải đi 2 lượt (cộng dồn nếu họ lại Tấn Công).',
      '<b>Né:</b> kết thúc 1 lượt mà không bốc. <b>Xào Bài:</b> xào chồng bốc. <b>Nhìn Trước:</b> xem bí mật 3 lá trên cùng.',
      '<b>Xin Xỏ:</b> chọn 1 người, họ tự chọn 1 lá tặng bạn.',
      '<b>Lá mèo:</b> vô dụng một mình. <b>Đôi</b> giống nhau → cướp ngẫu nhiên 1 lá của người khác. <b>Bộ ba</b> giống nhau → gọi tên 1 lá, họ có thì phải đưa.'
    ],
    // ---- cards
    cards: {
      bomb: { n: 'Mèo Nổ', d: 'Bốc trúng là nổ — trừ khi có Gỡ Bom.' },
      defuse: { n: 'Gỡ Bom', d: 'Cứu bạn khỏi Mèo Nổ, rồi nhét bom lại chồng bốc.' },
      attack: { n: 'Tấn Công', d: 'Không bốc bài. Người kế tiếp phải đi 2 lượt.' },
      skip: { n: 'Né', d: 'Kết thúc lượt mà không cần bốc bài.' },
      favor: { n: 'Xin Xỏ', d: 'Một người chơi phải tặng bạn 1 lá tùy họ chọn.' },
      nope: { n: 'Từ Chối', d: 'Hủy một lá vừa đánh (kể cả một Từ Chối).' },
      shuffle: { n: 'Xào Bài', d: 'Xào ngẫu nhiên chồng bốc.' },
      future: { n: 'Nhìn Trước', d: 'Xem bí mật 3 lá trên cùng chồng bốc.' },
      cat1: { n: 'Mèo Mướp', d: 'Đánh 2 lá giống nhau để cướp bài, 3 lá để đòi.' },
      cat2: { n: 'Mèo Mun', d: 'Đánh 2 lá giống nhau để cướp bài, 3 lá để đòi.' },
      cat3: { n: 'Mèo Tuyết', d: 'Đánh 2 lá giống nhau để cướp bài, 3 lá để đòi.' },
      cat4: { n: 'Mèo Xiêm', d: 'Đánh 2 lá giống nhau để cướp bài, 3 lá để đòi.' },
      cat5: { n: 'Tam Thể', d: 'Đánh 2 lá giống nhau để cướp bài, 3 lá để đòi.' },
      pair: 'đôi', triple: 'bộ ba'
    },
    // ---- log. Each receives player NAMES (already resolved) plus card names.
    log: {
      play1: (n, c) => `${n} đánh ${c}`,
      playFavor: (n, c, tg) => `${n} đánh ${c} lên ${tg}`,
      playPair: (n, c, tg) => `${n} đánh đôi ${c} lên ${tg}`,
      playTriple: (n, c, tg, nm) => `${n} đánh bộ ba ${c} lên ${tg}, đòi ${nm}`,
      nope: (n, k) => k > 1 ? `${n} Từ Chối lại! (×${k})` : `${n} Từ Chối! ✋`,
      cancel: (n, c) => `${c} của ${n} bị hủy`,
      attack: n => `${n} Tấn Công!`, skip: n => `${n} né lượt`, shuffle: n => `${n} xào chồng bốc`,
      future: n => `${n} xem trước 3 lá trên cùng`, favor: (n, tg) => `${tg} phải tặng ${n} một lá`,
      give: (from, to, c) => c ? `${from} tặng ${to} lá ${c}` : `${from} tặng ${to} một lá`,
      steal: (n, from, c) => c ? `${n} cướp ${c} của ${from}` : `${n} cướp một lá của ${from}`,
      miss: (n, from, c) => `${n} đòi ${c} nhưng ${from} không có`, fizzle: n => `Lá của ${n} không có tác dụng`,
      draw: n => `${n} bốc một lá`, bomb: n => `${n} bốc trúng MÈO NỔ! 💣`, defuse: n => `${n} dùng Gỡ Bom! ✂️`,
      reinsert: n => `${n} nhét Mèo Nổ vào lại chồng bốc (bí mật)`, explode: n => `${n} nổ tung! 💥`,
      win: n => `${n} là mèo sống sót cuối cùng! 🏆`, turn: (n, left) => left > 1 ? `Lượt của ${n} (${left} lượt)` : `Lượt của ${n}`
    }
  },

  en: {
    meta: { name: 'English', htmlLang: 'en' },
    title: 'Mèo Nổ',
    subtitle: 'Draw cards, dodge bombs — last cat standing wins',
    yourName: 'Your name', namePh: 'e.g. Whiskers',
    tabCreate: 'Create Room', tabJoin: 'Join', tabOffline: 'Play Offline',
    createRoom: 'Create Room', joinRoom: 'Join', roomCode: 'Room code', codePh: 'e.g. K7XPS',
    offlineHint: 'Play against 1–4 bots on this device — no network needed. (Hands are secret, so offline is one human only.)',
    startOffline: 'Play Offline',
    onlineOff: 'Cannot reach the server — play offline instead.',
    noRoom: 'Room not found.', roomFull: 'The room is full.',
    roomCodeShare: 'Room code — share it with friends', offlineRoom: 'Offline room',
    seats: 'Pick a cat', empty: 'Empty', host: 'Host', bot: 'Bot', you: 'You',
    sit: 'Sit here', addBot: '+ Bot', remove: 'Remove', kick: 'Kick',
    leaveTitle: 'Leave game…?', leaveStay: 'Stay', leaveGo: 'Leave',
    leaveWaitingBody: 'Leave this room?',
    leaveGameBody: 'You will leave the running game. A bot takes your seat.',
    leaveGameLocalBody: 'An offline game is not saved.',
    houseRules: 'Game rules', hostOnly: 'Only the host can change the rules.',
    start: 'Start', waitHost: 'Waiting for the host to start…', needTwo: 'Needs at least 2 players/bots.',
    leave: 'Leave', rules: 'Rules', sound: 'Sound', copied: 'Invite link copied',
    colors: { coral: 'Coral', mint: 'Mint', sky: 'Sky', violet: 'Violet', pink: 'Pink' },
    player: 'Player',
    level: { easy: 'Easy', normal: 'Normal', hard: 'Hard' },
    set: {
      nopeSec: '“Nope” window', nopeHint: 'After a card is played, everyone has this long to cancel it.', secs: n => `${n} s`,
      hand: 'Starting hand', handHint: 'Not counting the Defuse everyone always gets.',
      combos: 'Cat pairs / triples', combosHint: 'Pair: steal a random card. Triple: name a card and take it.', on: 'On', off: 'Off'
    },
    botNames: { coral: 'Pumpkin', mint: 'Minty', sky: 'Cloudy', violet: 'Taro', pink: 'Candy' },
    turnHint: 'Play cards, or draw to end your turn.', waitingOn: n => `Waiting for ${n}…`, youOut: 'You exploded — enjoy the show.',
    knownTop: 'You know', online: 'Online', pending: n => `${n} just played a card`, noTarget: 'Nobody has cards to target.',
    lobbyResume: 'Game in progress', resumeBody: c => `Room ${c} — rejoin?`, resume: 'Rejoin', joinSeat: 'Take a seat',
    seatTaken: 'That seat is taken.', cantPlay: 'You cannot play that yet.', cannotNow: 'Not your turn yet.',
    yourTurn: 'Your turn!', turnOf: n => `${n}'s turn`, turnsLeft: n => `${n} turns left`,
    draw: 'Draw (ends your turn)', drawShort: 'Draw',
    play1: 'Play card', play2: 'Play pair', play3: 'Play triple', pickCards: 'Select cards to play',
    nopeBtn: 'NOPE!', passBtn: 'Let it pass', nopeWindow: 'Anyone want to Nope?', nopeCount: n => `Nope ×${n}`,
    cardsN: n => `${n} cards`, outLabel: 'Exploded', spectating: 'Spectating 👀', handTitle: 'Your hand',
    deckLeft: n => `${n} cards`, discard: 'Discard', deckTop: 'Draw pile',
    pickTarget: 'Choose a player', pickTargetBody: 'Play this on whom?',
    pickName: 'Name a card', pickNameBody: 'If they hold it, you take it.',
    peekTitle: 'Top three cards', peekBody: 'The first card is on the left. Only you can see this.', peekClose: 'Got it',
    giveTitle: n => `${n} asks you for a favor!`, giveBody: 'Pick a card to hand over — your choice.', giveWait: (a, b) => `${a} is choosing a card for ${b}…`,
    reinsertTitle: 'Defused!', reinsertBody: 'Slide the Exploding Cat back into the pile. Only you know where.',
    posTop: 'Top', posBottom: 'Bottom', posRandom: 'Random', posConfirm: 'Insert',
    posLabel: (i, n) => i === 0 ? 'The very next draw explodes!' : (i >= n ? 'At the very bottom' : `After ${i} safe card${i > 1 ? 's' : ''}`),
    bombBanner: n => `${n} drew an EXPLODING CAT!`, defusedBanner: 'Defused!', boomBanner: n => `${n} exploded!`,
    got: c => `You got: ${c}`, stolen: (c, n) => `${n} took your ${c}`,
    winTitle: n => `${n} wins!`, youWon: 'You are the last cat standing! 🏆', youLost: 'You did not survive this one…', winBody: 'Play again?',
    again: 'Back to lobby', close: 'Close', ok: 'OK',
    rulesTitle: 'How to play',
    rulesBody: [
      '<b>Goal:</b> be the last cat alive. The draw pile hides <b>Exploding Cats</b> 💣 — draw one without a Defuse and you are out.',
      '<b>Your turn:</b> play any number of action cards (or none), then <b>draw 1 card</b> to end your turn.',
      '<b>Defuse:</b> draw a bomb with a Defuse in hand → it is defused and you slide it back <b>secretly</b> anywhere in the pile.',
      '<b>Nope:</b> the moment someone plays a card, anyone can Nope it. A Nope can itself be Noped!',
      '<b>Attack:</b> you do not draw; the next player takes 2 turns (stacks if they Attack back).',
      '<b>Skip:</b> end a turn without drawing. <b>Shuffle:</b> shuffle the pile. <b>See the Future:</b> peek at the top 3.',
      '<b>Favor:</b> pick a player; they choose a card to give you.',
      '<b>Cat cards:</b> useless alone. A <b>pair</b> of the same cat steals a random card. A <b>triple</b> lets you name a card — if they have it, it is yours.'
    ],
    cards: {
      bomb: { n: 'Exploding Cat', d: 'Draw it and explode — unless you have a Defuse.' },
      defuse: { n: 'Defuse', d: 'Saves you from a bomb; slide it back into the pile.' },
      attack: { n: 'Attack', d: 'Do not draw. The next player takes 2 turns.' },
      skip: { n: 'Skip', d: 'End your turn without drawing.' },
      favor: { n: 'Favor', d: 'A player must give you a card of their choice.' },
      nope: { n: 'Nope', d: 'Cancel a card just played (even another Nope).' },
      shuffle: { n: 'Shuffle', d: 'Shuffle the draw pile.' },
      future: { n: 'See the Future', d: 'Secretly peek at the top 3 cards.' },
      cat1: { n: 'Tabby Cat', d: 'Play 2 alike to steal, 3 alike to demand.' },
      cat2: { n: 'Black Cat', d: 'Play 2 alike to steal, 3 alike to demand.' },
      cat3: { n: 'Snow Cat', d: 'Play 2 alike to steal, 3 alike to demand.' },
      cat4: { n: 'Siamese', d: 'Play 2 alike to steal, 3 alike to demand.' },
      cat5: { n: 'Calico', d: 'Play 2 alike to steal, 3 alike to demand.' },
      pair: 'pair', triple: 'triple'
    },
    log: {
      play1: (n, c) => `${n} plays ${c}`,
      playFavor: (n, c, tg) => `${n} plays ${c} on ${tg}`,
      playPair: (n, c, tg) => `${n} plays a pair of ${c} on ${tg}`,
      playTriple: (n, c, tg, nm) => `${n} plays three ${c} on ${tg}, demanding ${nm}`,
      nope: (n, k) => k > 1 ? `${n} Nopes back! (×${k})` : `${n} says Nope! ✋`,
      cancel: (n, c) => `${n}'s ${c} was cancelled`,
      attack: n => `${n} attacks!`, skip: n => `${n} skips`, shuffle: n => `${n} shuffles the pile`,
      future: n => `${n} peeks at the top 3`, favor: (n, tg) => `${tg} must give ${n} a card`,
      give: (from, to, c) => c ? `${from} gives ${to} ${c}` : `${from} gives ${to} a card`,
      steal: (n, from, c) => c ? `${n} steals ${c} from ${from}` : `${n} steals a card from ${from}`,
      miss: (n, from, c) => `${n} demands ${c} but ${from} has none`, fizzle: n => `${n}'s card fizzles`,
      draw: n => `${n} draws a card`, bomb: n => `${n} drew an EXPLODING CAT! 💣`, defuse: n => `${n} uses a Defuse! ✂️`,
      reinsert: n => `${n} slides the bomb back in (secret)`, explode: n => `${n} exploded! 💥`,
      win: n => `${n} is the last cat standing! 🏆`, turn: (n, left) => left > 1 ? `${n}'s turn (${left} turns)` : `${n}'s turn`
    }
  }
};

const DEFAULT_LANG = 'vi', FALLBACK_LANG = 'en';
const availableLangs = () => Object.keys(I18N);
const hasLang = c => !!c && Object.prototype.hasOwnProperty.call(I18N, c);
let LANG = (function () {
  try { const s = localStorage.getItem('meow_lang'); if (hasLang(s)) return s; } catch (e) {}
  return DEFAULT_LANG;
})();
function setLang(l) { if (!hasLang(l)) return; LANG = l; try { localStorage.setItem('meow_lang', l); } catch (e) {} }
function _lookup(code, parts) { let v = hasLang(code) ? I18N[code] : null; for (const p of parts) v = v == null ? v : v[p]; return v; }
function t(key, ...args) {
  const parts = key.split('.');
  let v = _lookup(LANG, parts);
  if (v == null) v = _lookup(FALLBACK_LANG, parts);
  if (v == null) v = _lookup(DEFAULT_LANG, parts);
  if (v == null) return key;
  return typeof v === 'function' ? v(...args) : v;
}
(function checkI18n() {
  const flat = (o, pre = '') => Object.keys(o || {}).flatMap(k => {
    if (!pre && k === 'meta') return [];
    const v = o[k], path = pre + k;
    return v && typeof v === 'object' && !Array.isArray(v) ? flat(v, path + '.') : [path];
  });
  const ref = flat(I18N[FALLBACK_LANG]);
  availableLangs().forEach(code => {
    if (code === FALLBACK_LANG) return;
    const have = new Set(flat(I18N[code])), missing = ref.filter(k => !have.has(k));
    if (missing.length) console.warn('[i18n] "' + code + '" is missing ' + missing.length + ' key(s):', missing);
  });
})();
