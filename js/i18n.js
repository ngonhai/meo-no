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
      combos: 'Đánh đôi / ba / năm lá mèo', combosHint: 'Đôi: cướp ngẫu nhiên 1 lá. Ba: gọi tên 1 lá để đòi. Đủ 5 mèo khác nhau: đổi lấy 1 lá bất kỳ đã đánh trong trận.', on: 'Bật', off: 'Tắt',
      mode: 'Chế độ chơi', modeHint: 'Solo: mỗi người một mình. 2v2: đúng 4 người/bot, hai đội, đồng đội ngồi đối diện.', solo: 'Solo', team: '2v2',
      coop: 'Gỡ bom đôi', coopHint: 'Khi bốc trúng bom, đồng đội cùng chơi minigame để gỡ. Thua thì người bốc nổ.', coopNoDefuse: 'Khi hết Gỡ Bom', coopAlways: 'Mọi quả bom',
      dodgeAtk: 'Né khi bị Tấn công', dodgeAtkHint: 'Tắt: khi đang bị Tấn công cậu không dùng được Tấn Công để chuyển tiếp, cũng không dùng được Né — phải bốc đủ số lượt. Bật: vẫn không được Tấn Công chuyển tiếp, nhưng mỗi lá Né bỏ qua được 1 lượt bị Tấn Công.',
      cloneAny: 'Nhân Bản mọi lúc', cloneAnyHint: 'Tắt: chỉ đánh Nhân Bản ở lượt của mình. Bật: đánh được bất cứ lúc nào — kể cả lượt người khác hoặc khi đang có lá trên bàn. Đánh Nhân Bản không tốn lượt của ai; bản sao Tấn Công/Né tác dụng lên lượt đang chạy, dù ai đánh nó.',
      bombHeat: 'Bom nóng dần', bombHeatHint: 'Mỗi lần bom bị gỡ rồi đặt lại, nó nóng thêm 1 cấp: minigame khó hơn. Đủ 3 cấp thì minigame không gỡ nổi nữa — chỉ còn lá Gỡ Bom hoặc nổ.',
      suddenBomb: 'Bộ bài cạn thêm bom', suddenBombHint: 'Mỗi lần bộ bài cạn và phải xáo lại, có thêm 1 quả bom mới. Đảm bảo ván luôn có hồi kết.',
      coopGhost: 'Đồng đội đã nổ vẫn giúp gỡ', coopGhostHint: 'Bật: nếu đồng đội đã nổ, họ vẫn cùng chơi minigame để cứu bạn. Tắt: hết Gỡ Bom mà đồng đội đã nổ thì nổ luôn, không có minigame.'
    },
    botNames: { coral: 'Bí Ngô', mint: 'Bạc Hà', sky: 'Mây', violet: 'Khoai Môn', pink: 'Kẹo Bông' },
    drawn: c => `Bạn bốc được: ${c}`, drewHint: c => `Bạn bốc được lá ${c}`,
    turnHint: 'Đánh bài hoặc bốc bài để kết thúc lượt.', waitingOn: n => `Chờ ${n}…`, youOut: 'Bạn đã nổ — ngồi xem tiếp nhé.',
    knownTop: 'Bạn đã biết', online: 'Online', pending: n => `${n} vừa đánh bài`, noTarget: 'Không ai có bài để nhắm tới.', cloneDefuseHint: 'Lá vừa dùng là Gỡ Bom: Nhân Bản sẽ tự thành Gỡ Bom nếu cậu bốc trúng bom ngay bây giờ.', attackLockedAtk: 'Đang bị Tấn Công thì không dùng Tấn Công chuyển tiếp được!', attackLockedSkip: 'Đang bị Tấn Công — chỉ dùng được Né khi luật “Né khi bị Tấn công” được bật.',
    lobbyResume: 'Có ván đang chơi dở', resumeBody: c => `Phòng ${c} — quay lại?`, resume: 'Quay lại', joinSeat: 'Ngồi vào',
    seatTaken: 'Chỗ này có người rồi.', cantPlay: 'Chưa đánh được lá này.', cannotNow: 'Chưa tới lượt bạn.',
    // ---- in game
    yourTurn: 'Tới lượt bạn!', turnOf: n => `Lượt của ${n}`, turnsLeft: n => `còn ${n} lượt`,
    draw: 'Bốc bài (kết thúc lượt)', drawShort: 'Bốc bài',
    play1: 'Đánh lá này', play2: 'Đánh đôi', play3: 'Đánh bộ ba', play5: 'Đổi 5 mèo', pickCards: 'Chọn bài để đánh',
    nopeBtn: 'TỪ CHỐI!', passBtn: 'Cho qua', nopeWindow: 'Có ai Từ Chối không?', nopeMate: 'không Từ Chối lá của đồng đội', nopeOnlyNoped: 'chỉ người bị Từ Chối mới được đáp lại', nopeCount: n => `Từ Chối ×${n}`,
    cardsN: n => `${n} lá`, outLabel: 'Đã nổ', spectating: 'Đang xem', handTitle: 'Bài trên tay',
    deckLeft: n => `${n} lá`, discard: 'Chồng bỏ', deckTop: 'Chồng bốc',
    pickTarget: 'Chọn một người', pickTargetBody: 'Đánh bài này lên ai?',
    pickName: 'Gọi tên lá bài', pickNameBody: 'Nếu họ có lá này, bạn lấy được nó.',
      pickRecover: 'Chọn 1 lá để nhận', pickRecoverBody: 'Lấy một lá bất kỳ đã được đánh trong trận (Mèo Nổ thì không lấy được).',
    peekTitle: 'Ba lá trên cùng', peekBody: 'Lá đầu tiên nằm ngoài cùng bên trái. Chỉ mình bạn thấy.', peekClose: 'Đã nhớ',
    giveTitle: n => `${n} xin xỏ cậu!`, giveBody: 'Chọn một lá để tặng — tùy cậu.', giveWait: (a, b) => `${a} đang chọn lá tặng ${b}…`,
    reinsertTitle: 'Gỡ bom thành công!', reinsertBody: 'Nhét Mèo Nổ vào lại chồng bốc. Chỉ bạn biết nó nằm đâu.',
    posTop: 'Trên cùng', posBottom: 'Dưới cùng', posRandom: 'Ngẫu nhiên', posConfirm: 'Nhét vào',
    posLabel: (i, n) => i === 0 ? 'Lá tiếp theo bị bốc sẽ là bom!' : (i >= n ? 'Dưới đáy chồng' : `Sau ${i} lá an toàn`),
    scorchBanner: 'Bom quá nóng!', hotdeckBanner: 'Xáo lại bộ bài — thêm 1 bom!', bombBanner: n => `${n} bốc trúng MÈO NỔ!`, defusedBanner: 'Gỡ bom thành công!', boomBanner: n => `${n} nổ tung!`,
    got: c => `Nhận được: ${c}`, stolen: (c, n) => `${n} lấy mất ${c} của bạn`,
    needFour: 'Chế độ 2v2 cần đúng 4 người/bot.', teamNames: { A: 'Thuyền 1', B: 'Thuyền 2' },
    rescueBanner: (a, b) => `${a} & ${b} cùng gỡ bom!`, rescueHint: 'Cùng một thuyền — hai bạn gỡ bom nhé!', rescuedBanner: 'Cả thuyền thoát nạn!',
    winTeam: (a, b) => `${a} & ${b} thắng!`, youWonTeam: 'Thuyền của cậu sống sót!', youLostTeam: 'Thuyền của cậu đã chìm…',
    winTitle: n => `${n} thắng!`, youWon: 'Cậu là mèo sống sót cuối cùng!', youLost: 'Ván này cậu không sống sót…', winBody: 'Chơi lại không?',
    again: 'Về phòng chờ', close: 'Đóng', ok: 'OK',
    rulesTitle: 'Luật chơi Mèo Nổ',
    rulesBody: [
      '<b>Mục tiêu:</b> là mèo cuối cùng còn sống. Chồng bốc có <b>Mèo Nổ</b> — bốc trúng mà không có Gỡ Bom là nổ, bị loại.',
      '<b>Lượt của bạn:</b> đánh bao nhiêu lá hành động cũng được (hoặc không đánh), rồi <b>bốc 1 lá</b> để kết thúc lượt.',
      '<b>Gỡ Bom:</b> bốc trúng bom mà có Gỡ Bom → bom bị gỡ, bạn nhét nó lại <b>bí mật</b> vào vị trí tùy ý trong chồng bốc.',
      '<b>Từ Chối:</b> ngay khi ai đó đánh bài, người khác có thể Từ Chối để hủy nó. Từ Chối cũng bị Từ Chối được — nhưng chỉ <b>người vừa bị Từ Chối</b> mới được Từ Chối lại, người ngoài không chen vào được. Ở 2v2 bạn không thể Từ Chối lá của đồng đội; đồng đội của người bị Từ Chối thì được Từ Chối lại giúp.',
      '<b>Tấn Công:</b> bạn không bốc, người kế tiếp phải đi 2 lượt Khi đang bị Tấn Công thì không dùng Tấn Công chuyển tiếp được; Né chỉ dùng được nếu luật “Né khi bị Tấn công” bật (mỗi lá Né bỏ qua 1 lượt).',
      '<b>Né:</b> kết thúc 1 lượt mà không bốc. <b>Xào Bài:</b> xào chồng bốc. <b>Nhìn Trước:</b> xem bí mật 3 lá trên cùng.',
      '<b>Xin Xỏ:</b> chọn 1 người, họ tự chọn 1 lá tặng bạn.',
      '<b>Lá mèo:</b> vô dụng một mình. <b>Đôi</b> giống nhau → cướp ngẫu nhiên 1 lá của người khác. <b>Bộ ba</b> giống nhau → gọi tên 1 lá, họ có thì phải đưa.',
      '<b>Năm mèo:</b> đánh đủ <b>5 lá mèo khác nhau</b> (mỗi loại một lá) → đổi lấy <b>1 lá bất kỳ</b> đã được đánh trong trận (nằm trong chồng bài đã đánh, trừ Mèo Nổ). Vẫn có thể bị Từ Chối.',
      '<b>Chế độ 2v2:</b> hai đội, đồng đội ngồi đối diện. Bốc trúng bom thì <b>cả hai cùng chơi minigame</b> để gỡ (người khác xem). Thua thì người bốc nổ. Đội nào còn người sống cuối cùng thì thắng.',
      '<b>Nhân Bản:</b> sao chép <b>bất kỳ lá nào vừa được đánh gần nhất</b>, bất kể lượt nào hay ai đánh (không phải Mèo Nổ; kể cả khi lá đó bị Từ Chối). Nếu đang có một Từ Chối trên bàn thì lá vừa đánh chính là Từ Chối, và Nhân Bản sẽ thành thêm một Từ Chối. Nhân Bản cũng thay được MỘT lá mèo bất kỳ trong bộ đôi, bộ ba hoặc bộ năm (tối đa 1 lá mỗi bộ). Nếu lá vừa đánh gần nhất là một bộ đôi / bộ ba thì Nhân Bản biến thành 1 lá mèo của bộ đó (vào tay bạn ngay, không tốn lượt); nếu là bộ năm thì thành 1 lá mèo ngẫu nhiên trong năm lá. Nếu bật luật nhà, bạn đánh được Nhân Bản bất cứ lúc nào — kể cả lượt người khác. Đánh Nhân Bản không tốn lượt của ai (đánh xong bạn vẫn giữ nguyên lượt nếu đang là lượt bạn). Bản sao Tấn Công/Né tác dụng lên lượt đang chạy, dù ai đánh nó. Gỡ Bom cũng là một lá được sao chép: ngay sau khi ai đó dùng Gỡ Bom, ai bốc trúng bom mà đang có Nhân Bản thì Nhân Bản tự thành Gỡ Bom.'
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
      clone: { n: 'Nhân Bản', d: 'Sao chép công dụng của lá vừa được đánh gần nhất (luật nhà: đánh được bất cứ lúc nào, không tốn lượt của ai).' },
      future: { n: 'Nhìn Trước', d: 'Xem bí mật 3 lá trên cùng chồng bốc.' },
      cat1: { n: 'Mèo Mướp', d: 'Đánh 2 lá giống nhau để cướp bài, 3 lá để đòi, đủ 5 loại để đổi lá.' },
      cat2: { n: 'Mèo Mun', d: 'Đánh 2 lá giống nhau để cướp bài, 3 lá để đòi, đủ 5 loại để đổi lá.' },
      cat3: { n: 'Mèo Tuyết', d: 'Đánh 2 lá giống nhau để cướp bài, 3 lá để đòi, đủ 5 loại để đổi lá.' },
      cat4: { n: 'Mèo Xiêm', d: 'Đánh 2 lá giống nhau để cướp bài, 3 lá để đòi, đủ 5 loại để đổi lá.' },
      cat5: { n: 'Tam Thể', d: 'Đánh 2 lá giống nhau để cướp bài, 3 lá để đòi, đủ 5 loại để đổi lá.' },
      pair: 'đôi', triple: 'bộ ba', five: 'năm mèo'
    },
    // ---- log. Each receives player NAMES (already resolved) plus card names.
    coop: {
      title: 'Gỡ Bom Đôi', watching: 'Đang xem hai bạn gỡ bom', win: 'Gỡ xong!', lose: 'BÙM!', timeUp: 'Hết giờ!',
      chatTitle: 'Nói nhanh', chat: ['Dừng lại!', 'Đi đi!', 'Chờ tớ!', 'Ối!'],
      games: {
        zigzag: { n: 'Lái Chung', d: 'Một quả bom, hai người lái: một người lên/xuống, một người trái/phải. Đưa nó tới đích, chạm tường là bị ném về góc!' },
        wires: { n: 'Cắt Dây', d: 'Một người thấy dây, một người cầm sổ tay. Cắt đúng thứ tự, cắt nhầm 3 lần là nổ!' },
        lock: { n: 'Khóa Hai Chìa', d: 'Mã của khóa cậu nằm trên máy bạn cậu, và ngược lại. Đọc cho nhau nghe!' },
        maze: { n: 'Mê Cung Mù', d: 'Một người thấy cả mê cung nhưng không điều khiển được, người kia lái quả bom nhưng chỉ thấy mỗi quả bom. Dẫn đường cho nhau tới đích, đâm vào tường là mất giờ!' }
      },
      zz: { roleV: 'Cậu lái LÊN / XUỐNG. Bạn cậu lái TRÁI / PHẢI.', roleH: 'Cậu lái TRÁI / PHẢI. Bạn cậu lái LÊN / XUỐNG.', watch: 'Mỗi người chỉ lái một trục.', up: 'Lên', down: 'Xuống', left: 'Trái', right: 'Phải',
        tip: 'Đợi bạn tới góc rồi mới rẽ. Phím mũi tên hoặc WASD cũng được.' },
      sb: { title: 'Phá đám!', rotL: 'Xoay trái', rotR: 'Xoay phải', gum: 'Kẹo cao su', ink: 'Phun mực', tip: 'Chạm thẳng vào đường để ném kẹo đúng chỗ (chậm lại 65%). Nút bấm xong phải chờ hồi.', anon: 'Khán giả',
        didL: n => `<b>${n}</b> xoay đường sang trái 90°`, didR: n => `<b>${n}</b> xoay đường sang phải 90°`, didGum: n => `<b>${n}</b> ném kẹo cao su!`, didInk: n => `<b>${n}</b> phun mực!` },
      wires: { roleWires: 'Cậu thấy dây nhưng KHÔNG có sổ tay. Hỏi bạn cậu đi!', roleManual: 'Cậu có sổ tay nhưng KHÔNG thấy dây. Chạm để đọc cho bạn!', watch: 'Một người thấy dây, một người cầm sổ tay.',
        manual: 'Sổ tay gỡ bom', step: n => `Bước ${n}`, tell: 'Nói cho bạn nghe', strikes: 'Cắt nhầm', toldTitle: 'Bạn cậu vừa nói', 
        colors: { red: 'ĐỎ', blue: 'XANH DƯƠNG', green: 'XANH LÁ', yellow: 'VÀNG', white: 'TRẮNG', violet: 'TÍM' },
        shapes: ['tam giác', 'hình tròn', 'hình vuông', 'hình thoi', 'ngôi sao', 'dấu cộng'],
        clue: { color: c => `Dây màu ${c}`, shape: s => `Dây có thẻ ${s}`, pos: n => `Dây thứ ${n} từ trên xuống` } },
      lock: { role: 'Cậu đọc mã trên màn hình cho bạn, còn mã của cậu nằm trên máy bạn ấy.', watch: 'Mỗi người đặt một khóa, mã nằm ở máy người kia.', code: n => `Mã của ${n}`, codeHint: 'Chạm vào hình để “nói” cho bạn ấy',
        dial: n => `Khóa của ${n}`, dialHint: 'Chạm để đổi hình', saySlot: n => `Ô ${n}:`, sym: ['Tam giác cam', 'Tròn xanh', 'Vuông ngọc', 'Thoi vàng', 'Sao hồng', 'Cộng tím'] },
      maze: { roleMap: 'Cậu thấy cả mê cung nhưng KHÔNG điều khiển được. Chỉ đường cho bạn cậu!', roleBlind: 'Cậu điều khiển quả bom nhưng KHÔNG thấy mê cung. Nghe bạn cậu chỉ đường!', watch: 'Một người thấy mê cung, người kia lái mù theo lời chỉ đường.',
        up: 'Lên', right: 'Phải', down: 'Xuống', left: 'Trái', tipMove: 'Giữ nút để đi liên tục. Đâm vào tường là mất giờ. Phím mũi tên hoặc WASD cũng được.', tipGuide: 'Nói cho bạn nghe, hoặc bấm hướng để báo. Muốn bạn dừng thì bấm Dừng lại ở “Nói nhanh”.' }
    },
    log: {
      play1: (n, c) => `${n} đánh ${c}`,
      playFavor: (n, c, tg) => `${n} đánh ${c} lên ${tg}`,
      playPair: (n, c, tg) => `${n} đánh đôi ${c} lên ${tg}`,
      playTriple: (n, c, tg, nm) => `${n} đánh bộ ba ${c} lên ${tg}, đòi ${nm}`,
      playFive: (n, nm) => `${n} đánh đủ 5 mèo, muốn đổi lấy ${nm}`, recover: (n, c) => `${n} nhận ${c} từ chồng bài đã đánh`, calm: n => `Bản sao của ${n} không làm đổi lượt`,
      nope: (n, k) => k > 1 ? `${n} Từ Chối lại! (×${k})` : `${n} Từ Chối!`,
      cancel: (n, c) => `${c} của ${n} bị hủy`,
      attack: n => `${n} Tấn Công!`, skip: n => `${n} né lượt`, shuffle: n => `${n} xào chồng bốc`,
      future: n => `${n} xem trước 3 lá trên cùng`, favor: (n, tg) => `${tg} phải tặng ${n} một lá`,
      give: (from, to, c) => c ? `${from} tặng ${to} lá ${c}` : `${from} tặng ${to} một lá`,
      steal: (n, from, c) => c ? `${n} cướp ${c} của ${from}` : `${n} cướp một lá của ${from}`,
      miss: (n, from, c) => `${n} đòi ${c} nhưng ${from} không có`, fizzle: n => `Lá của ${n} không có tác dụng`,
      draw: n => `${n} bốc một lá`, bomb: n => `${n} bốc trúng MÈO NỔ!`, defuse: n => `${n} dùng Gỡ Bom!`, defuseClone: n => `${n} dùng Nhân Bản thành Gỡ Bom!`, cloneCat: (n, c) => `${n} biến Nhân Bản thành ${c}`,
      reinsert: n => `${n} nhét Mèo Nổ vào lại chồng bốc (bí mật)`, explode: n => `${n} nổ tung!`,
      playClone: (a, c, w) => `${a} đánh ${c} — nhân bản “${w}”`,
      scorch: a => `Bom quá nóng — minigame không gỡ nổi, ${a} chỉ còn lá Gỡ Bom!`, hotdeck: 'Bộ bài cạn, xáo lại — thêm 1 quả bom mới!',
      rescue: (a, b) => `${a} bốc trúng bom — ${b} cùng gỡ!`, rescued: (a, b) => `${a} & ${b} gỡ bom thành công!`, rescueFail: (a, b) => `${a} & ${b} gỡ thất bại…`,
      win: n => `${n} là mèo sống sót cuối cùng!`, turn: (n, left) => left > 1 ? `Lượt của ${n} (${left} lượt)` : `Lượt của ${n}`
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
      combos: 'Cat pairs / triples / fives', combosHint: 'Pair: steal a random card. Triple: name a card and take it. Five different cats: swap for any card played this match.', on: 'On', off: 'Off',
      mode: 'Game mode', modeHint: 'Solo: every cat for themselves. 2v2: exactly 4 players/bots, two teams, teammates sit opposite.', solo: 'Solo', team: '2v2',
      coop: 'Team defuse', coopHint: 'When a bomb is drawn, the teammates play a minigame together to defuse it. Fail and the drawer explodes.', coopNoDefuse: 'No Defuse in hand', coopAlways: 'Every bomb',
      dodgeAtk: 'Skip while attacked', dodgeAtkHint: 'Off: while you are attacked you can neither pass it on with Attack nor use Skip — you must play out your turns. On: still no Attack back, but every Skip cancels ONE of the turns you owe.',
      cloneAny: 'Clone any time', cloneAnyHint: 'Off: Clone can only be played on your turn. On: it can be played at any time — also on someone else\'s turn or while a card is on the table. Playing it costs nobody a turn; a copied Attack/Skip acts on the turn that is running, whoever plays it.',
      bombHeat: 'Bombs heat up', bombHeatHint: 'Every time a bomb is defused and slid back it gets one level hotter: a harder minigame. At level 3 the minigame can no longer defuse it — only a Defuse card or boom.',
      suddenBomb: 'Reshuffle adds a bomb', suddenBombHint: 'Every time the deck runs out and is reshuffled, one new bomb is added. Guarantees every game ends.',
      coopGhost: 'Exploded teammate can still help', coopGhostHint: 'On: an already-exploded teammate still plays the minigame to save you. Off: with no Defuse and a dead teammate you explode at once, no minigame.'
    },
    botNames: { coral: 'Pumpkin', mint: 'Minty', sky: 'Cloudy', violet: 'Taro', pink: 'Candy' },
    drawn: c => `You drew: ${c}`, drewHint: c => `You drew ${c}`,
    turnHint: 'Play cards, or draw to end your turn.', waitingOn: n => `Waiting for ${n}…`, youOut: 'You exploded — enjoy the show.',
    knownTop: 'You know', online: 'Online', pending: n => `${n} just played a card`, noTarget: 'Nobody has cards to target.', cloneDefuseHint: 'The last card used was a Defuse: your Clone will act as a Defuse if you draw a bomb right now.', attackLockedAtk: 'You are under attack — you cannot Attack back!', attackLockedSkip: 'You are under attack — Skip only works with the “Skip while attacked” rule on.',
    lobbyResume: 'Game in progress', resumeBody: c => `Room ${c} — rejoin?`, resume: 'Rejoin', joinSeat: 'Take a seat',
    seatTaken: 'That seat is taken.', cantPlay: 'You cannot play that yet.', cannotNow: 'Not your turn yet.',
    yourTurn: 'Your turn!', turnOf: n => `${n}'s turn`, turnsLeft: n => `${n} turns left`,
    draw: 'Draw (ends your turn)', drawShort: 'Draw',
    play1: 'Play card', play2: 'Play pair', play3: 'Play triple', play5: 'Swap 5 cats', pickCards: 'Select cards to play',
    nopeBtn: 'NOPE!', passBtn: 'Let it pass', nopeWindow: 'Anyone want to Nope?', nopeMate: "you can't Nope your teammate's card", nopeOnlyNoped: 'only the player who got Noped can answer', nopeCount: n => `Nope ×${n}`,
    cardsN: n => `${n} cards`, outLabel: 'Exploded', spectating: 'Spectating', handTitle: 'Your hand',
    deckLeft: n => `${n} cards`, discard: 'Discard', deckTop: 'Draw pile',
    pickTarget: 'Choose a player', pickTargetBody: 'Play this on whom?',
    pickName: 'Name a card', pickNameBody: 'If they hold it, you take it.',
      pickRecover: 'Pick a card to take', pickRecoverBody: 'Take any card that was played this match (Exploding Cats cannot be taken).',
    peekTitle: 'Top three cards', peekBody: 'The first card is on the left. Only you can see this.', peekClose: 'Got it',
    giveTitle: n => `${n} asks you for a favor!`, giveBody: 'Pick a card to hand over — your choice.', giveWait: (a, b) => `${a} is choosing a card for ${b}…`,
    reinsertTitle: 'Defused!', reinsertBody: 'Slide the Exploding Cat back into the pile. Only you know where.',
    posTop: 'Top', posBottom: 'Bottom', posRandom: 'Random', posConfirm: 'Insert',
    posLabel: (i, n) => i === 0 ? 'The very next draw explodes!' : (i >= n ? 'At the very bottom' : `After ${i} safe card${i > 1 ? 's' : ''}`),
    scorchBanner: 'Bomb too hot!', hotdeckBanner: 'Reshuffled — a new bomb joins!', bombBanner: n => `${n} drew an EXPLODING CAT!`, defusedBanner: 'Defused!', boomBanner: n => `${n} exploded!`,
    got: c => `You got: ${c}`, stolen: (c, n) => `${n} took your ${c}`,
    needFour: '2v2 needs exactly 4 players/bots.', teamNames: { A: 'Boat 1', B: 'Boat 2' },
    rescueBanner: (a, b) => `${a} & ${b} defuse together!`, rescueHint: 'Same boat — defuse it together!', rescuedBanner: 'The whole boat is saved!',
    winTeam: (a, b) => `${a} & ${b} win!`, youWonTeam: 'Your boat survived!', youLostTeam: 'Your boat sank…',
    winTitle: n => `${n} wins!`, youWon: 'You are the last cat standing!', youLost: 'You did not survive this one…', winBody: 'Play again?',
    again: 'Back to lobby', close: 'Close', ok: 'OK',
    rulesTitle: 'How to play',
    rulesBody: [
      '<b>Goal:</b> be the last cat alive. The draw pile hides <b>Exploding Cats</b> — draw one without a Defuse and you are out.',
      '<b>Your turn:</b> play any number of action cards (or none), then <b>draw 1 card</b> to end your turn.',
      '<b>Defuse:</b> draw a bomb with a Defuse in hand → it is defused and you slide it back <b>secretly</b> anywhere in the pile.',
      '<b>Nope:</b> the moment someone plays a card, others can Nope it. A Nope can itself be Noped — but only by the player who just got Noped; bystanders can\'t jump in. In 2v2 you can\'t Nope your teammate\'s card, while the teammate of the Noped player may answer for them.',
      '<b>Attack:</b> you do not draw; the next player takes 2 turns While you are attacked you cannot Attack back; Skip only works if the “Skip while attacked” rule is on (each Skip cancels one turn).',
      '<b>Skip:</b> end a turn without drawing. <b>Shuffle:</b> shuffle the pile. <b>See the Future:</b> peek at the top 3.',
      '<b>Favor:</b> pick a player; they choose a card to give you.',
      '<b>Cat cards:</b> useless alone. A <b>pair</b> of the same cat steals a random card. A <b>triple</b> lets you name a card — if they have it, it is yours.',
      '<b>Five cats:</b> play <b>5 different cat cards</b> (one of each) to swap them for <b>any one card</b> that has been played this match (it lies in the discard pile, Exploding Cats excluded). It can still be Noped.',
      '<b>2v2 mode:</b> two teams, teammates sit opposite. Draw a bomb and <b>both teammates play a minigame</b> to defuse it (everyone else watches). Fail and the drawer explodes. The last team with a cat alive wins.',
      '<b>Clone:</b> copies <b>whatever card was played last</b> (never an Exploding Cat; even if it got Noped). While a Nope lies on the table, the last card played is that Nope, so a Clone becomes one more Nope. A Clone also replaces ONE cat card of any pair, triple or five (at most one per combo). If the card played last was a pair / triple, the Clone turns into ONE cat card of that combo (straight into your hand, no turn spent); if it was a five, into one random cat of the five. With the house rule on you may play it at any time — also on someone else\'s turn. Playing a Clone costs nobody a turn (on your own turn you stay on turn); a copied Attack/Skip acts on the turn that is running, whoever plays it. Defuse can be copied too: right after somebody used a Defuse, whoever draws a bomb with a Clone in hand gets it as a Defuse.'
    ],
    cards: {
      bomb: { n: 'Exploding Cat', d: 'Draw it and explode — unless you have a Defuse.' },
      defuse: { n: 'Defuse', d: 'Saves you from a bomb; slide it back into the pile.' },
      attack: { n: 'Attack', d: 'Do not draw. The next player takes 2 turns.' },
      skip: { n: 'Skip', d: 'End your turn without drawing.' },
      favor: { n: 'Favor', d: 'A player must give you a card of their choice.' },
      nope: { n: 'Nope', d: 'Cancel a card just played (even another Nope).' },
      shuffle: { n: 'Shuffle', d: 'Shuffle the draw pile.' },
      clone: { n: 'Clone', d: 'Copies the effect of the last card played (house rule: playable at any time, costs nobody a turn).' },
      future: { n: 'See the Future', d: 'Secretly peek at the top 3 cards.' },
      cat1: { n: 'Tabby Cat', d: 'Play 2 alike to steal, 3 alike to demand, all 5 different to swap.' },
      cat2: { n: 'Black Cat', d: 'Play 2 alike to steal, 3 alike to demand, all 5 different to swap.' },
      cat3: { n: 'Snow Cat', d: 'Play 2 alike to steal, 3 alike to demand, all 5 different to swap.' },
      cat4: { n: 'Siamese', d: 'Play 2 alike to steal, 3 alike to demand, all 5 different to swap.' },
      cat5: { n: 'Calico', d: 'Play 2 alike to steal, 3 alike to demand, all 5 different to swap.' },
      pair: 'pair', triple: 'triple', five: 'five cats'
    },
    coop: {
      title: 'Team Defuse', watching: 'Watching the two of them defuse', win: 'Defused!', lose: 'BOOM!', timeUp: 'Time is up!',
      chatTitle: 'Quick say', chat: ['Stop!', 'Go!', 'Wait for me!', 'Oops!'],
      games: {
        zigzag: { n: 'Co-Pilot', d: 'One bomb, two drivers: one steers up/down, the other left/right. Reach the goal — touch a wall and you are thrown back to the last corner!' },
        wires: { n: 'Wire Cutters', d: 'One of you sees the wires, the other holds the manual. Cut in the right order — three wrong cuts and it blows!' },
        lock: { n: 'Two-Key Lock', d: 'The code for your lock is on your teammate’s screen, and vice versa. Read it out to each other!' },
        maze: { n: 'Blind Maze', d: 'One of you sees the whole maze but cannot move; the other drives the bomb but sees only the bomb. Guide each other to the goal — every wall you hit costs time!' }
      },
      zz: { roleV: 'You steer UP / DOWN. Your teammate steers LEFT / RIGHT.', roleH: 'You steer LEFT / RIGHT. Your teammate steers UP / DOWN.', watch: 'Each player only steers one axis.', up: 'Up', down: 'Down', left: 'Left', right: 'Right',
        tip: 'Wait for your teammate to reach the corner before you turn. Arrow keys or WASD work too.' },
      sb: { title: 'Mess with them!', rotL: 'Turn left', rotR: 'Turn right', gum: 'Bubblegum', ink: 'Ink splat', tip: 'Tap the track itself to drop gum exactly there (slows the dot by 65%). Every button needs time to recharge.', anon: 'A spectator',
        didL: n => `<b>${n}</b> turned the track left 90°`, didR: n => `<b>${n}</b> turned the track right 90°`, didGum: n => `<b>${n}</b> threw bubblegum!`, didInk: n => `<b>${n}</b> splashed ink!` },
      wires: { roleWires: 'You see the wires but have NO manual. Ask your teammate!', roleManual: 'You have the manual but CANNOT see the wires. Tap to read a step out!', watch: 'One sees the wires, the other holds the manual.',
        manual: 'Defuse manual', step: n => `Step ${n}`, tell: 'Tell your teammate', strikes: 'Wrong cuts', toldTitle: 'Your teammate just said',
        colors: { red: 'RED', blue: 'BLUE', green: 'GREEN', yellow: 'YELLOW', white: 'WHITE', violet: 'VIOLET' },
        shapes: ['triangle', 'circle', 'square', 'diamond', 'star', 'plus'],
        clue: { color: c => `The ${c} wire`, shape: s => `The wire with the ${s} tag`, pos: n => `Wire number ${n} from the top` } },
      lock: { role: 'You read the code on your screen to your teammate; your own code is on theirs.', watch: 'Each player sets one lock; the code is on the other player’s screen.', code: n => `${n}’s code`, codeHint: 'Tap a symbol to “say” it to them',
        dial: n => `${n}’s lock`, dialHint: 'Tap to change the symbol', saySlot: n => `Slot ${n}:`, sym: ['Orange triangle', 'Blue circle', 'Mint square', 'Yellow diamond', 'Pink star', 'Violet plus'] },
      maze: { roleMap: 'You see the whole maze but CANNOT move. Guide your teammate!', roleBlind: 'You drive the bomb but CANNOT see the maze. Follow your teammate’s directions!', watch: 'One sees the maze, the other drives blind by following directions.',
        up: 'Up', right: 'Right', down: 'Down', left: 'Left', tipMove: 'Hold a button to keep moving. Hitting a wall costs time. Arrow keys or WASD work too.', tipGuide: 'Tell your teammate, or tap a direction to say it. To make them stop, tap Stop! under “Quick say”.' }
    },
    log: {
      play1: (n, c) => `${n} plays ${c}`,
      playFavor: (n, c, tg) => `${n} plays ${c} on ${tg}`,
      playPair: (n, c, tg) => `${n} plays a pair of ${c} on ${tg}`,
      playTriple: (n, c, tg, nm) => `${n} plays three ${c} on ${tg}, demanding ${nm}`,
      playFive: (n, nm) => `${n} plays five different cats to swap for ${nm}`, recover: (n, c) => `${n} takes ${c} from the discard pile`, calm: n => `${n}'s copy does not change the turn`,
      nope: (n, k) => k > 1 ? `${n} Nopes back! (×${k})` : `${n} says Nope!`,
      cancel: (n, c) => `${n}'s ${c} was cancelled`,
      attack: n => `${n} attacks!`, skip: n => `${n} skips`, shuffle: n => `${n} shuffles the pile`,
      future: n => `${n} peeks at the top 3`, favor: (n, tg) => `${tg} must give ${n} a card`,
      give: (from, to, c) => c ? `${from} gives ${to} ${c}` : `${from} gives ${to} a card`,
      steal: (n, from, c) => c ? `${n} steals ${c} from ${from}` : `${n} steals a card from ${from}`,
      miss: (n, from, c) => `${n} demands ${c} but ${from} has none`, fizzle: n => `${n}'s card fizzles`,
      draw: n => `${n} draws a card`, bomb: n => `${n} drew an EXPLODING CAT!`, defuse: n => `${n} uses a Defuse!`, defuseClone: n => `${n} turns a Clone into a Defuse!`, cloneCat: (n, c) => `${n} turns a Clone into ${c}`,
      reinsert: n => `${n} slides the bomb back in (secret)`, explode: n => `${n} exploded!`,
      playClone: (a, c, w) => `${a} plays ${c} — copies “${w}”`,
      scorch: a => `Bomb too hot — no minigame can defuse it, ${a} needs a Defuse card!`, hotdeck: 'Deck ran out and was reshuffled — a new bomb joins!',
      rescue: (a, b) => `${a} drew a bomb — ${b} helps!`, rescued: (a, b) => `${a} & ${b} defused it!`, rescueFail: (a, b) => `${a} & ${b} failed to defuse…`,
      win: n => `${n} is the last cat standing!`, turn: (n, left) => left > 1 ? `${n}'s turn (${left} turns)` : `${n}'s turn`
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
