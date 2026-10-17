# Mèo Nổ (Exploding-cats-style card game)

Browser card game in the same stack as Cờ Cá Ngựa / Boardwalk Night: plain HTML/CSS/JS, optional Firebase Realtime
Database for online rooms, static hosting (GitHub Pages). Vietnamese by default, English via the language picker.
Open `index.html` through any static server (or GitHub Pages).

## Look
Flat **2D polygon** style: teal-blue faceted background, coral accent (no more bronze/gold), chamfered cards with hard
offset shadows. **Every picture is code**: `js/cat-art.js` draws the 5 cats, all action cards, the card back and the
player avatars from polygons into one hidden SVG sprite; cards only `<use>` them (cheap, scales crisp, no textures).
Effects use only `transform`/`opacity` via the Web Animations API.

## Play modes
- **Create / Join room** — online, 2–5 players (+ bots). Share the 5-letter code (click it to copy an invite link).
- **Play Offline** — you vs 1–4 bots on this device. (Hands are secret, so there is no hot-seat with several humans.)
- If a human disconnects for 20 s a bot plays for them; one connected client (the host) drives bots and timers.
- Rooms live at `rooms/meow_<CODE>` in the same Firebase project — the existing `rooms/$roomId` rules already cover it.
  Note: hands are stored in the room, so a determined friend could peek in the database. Fine for friends, not for stakes.

## Rules implemented
Deck: Exploding Cat ×(players−1), Defuse (1 each + 1–2 in the pile), Attack ×4, Skip ×4, Favor ×4, Nope ×5,
Shuffle ×4, See the Future ×5, 5 cat types ×4. Turn: play any cards, then draw (ends the turn).
- **Nope** window after every played card (3/5/8/12 s, host setting). Nope can be Noped. Ends early when everyone passes.
- **Attack** stacks: the victim takes 2 turns; attacking back passes on the remaining turns + 2.
- **Defuse**: bomb goes back into the pile at a position only you know (slider, top / bottom / random).
- **Cat pair** steals a random card; **cat triple** names a card and takes it if they have it. (Can be turned off.)
- **See the Future** is remembered: the cards you saw stay marked under the pile until a draw/shuffle/insert changes them.
- Bots: easy / normal / hard (they count bomb odds, remember peeks, Nope attacks aimed at them).

## 2v2 team mode (Gỡ Bom Đôi)
Host picks **Chế độ chơi → 2v2** in the waiting room (needs exactly 4 seats, humans and/or bots). Teams alternate around the table
(seat 1+3 vs seat 2+4), so teammates sit opposite; pick your seat to pick your partner. Teammates can't target each other,
an Attack lands on the next *opponent*, and the last team with a living cat wins.
- **Bomb drawn + teammate alive → both teammates play a minigame** (everyone else watches the same screen). Setting *Gỡ bom đôi*:
  `nodefuse` (default) = only when the drawer has no Defuse card; `always` = every bomb (success keeps your Defuse, failure burns it).
- Success → the drawer slides the bomb back as usual. Failure (timeout / 3 wrong cuts) → Defuse in hand is burned, else **the drawer explodes** and the teammate plays on.
- Minigames (`js/meow-coop.js`, 34–40 s, burning-fuse timer, portrait + landscape, touch / keyboard):
  **Lái Chung** (one dot, one player steers up/down, the other left/right, walls throw you back to the corner),
  **Cắt Dây** (one sees the wires, the other holds the manual: cut in order, 3 wrong cuts = boom),
  **Khóa Hai Chìa** (each lock's code is on the *other* player's screen).
- **Quick-say** buttons / "📣 tell" taps let teammates coordinate without voice chat, and bot teammates "talk" the same way.
- Realtime: positions/dials go through a separate path `rooms/meow_<CODE>_rt/<rescueId>/<color>` (one writer per node), result through
  the room transaction (`Net.doRescueEnd`). Phase `rescue` in the engine: `Meow.rescueEnd(g, id, ok)`.
- Add a minigame: `make(seed)` + a class extending `Base` in `meow-coop.js`, register in `GAMES` + `Meow.COOP_GAMES`, add texts `coop.games.<id>` in `i18n.js`.

## Sounds
At start-up every file in `SOUND_FILES` is fetched and decoded once (`probeSounds()` in `js/sounds.js`); existing ones play from memory with no
network/decode cost, missing ones (or an HTML 404 page) use the synth placeholder. Add a file and reload — nothing else to do.
Every event has a key in `js/sounds.js` (`SOUND_FILES`). Put the files from `sounds/README.txt` in `/sounds/` any time;
until then a tiny synth placeholder plays so the game is never silent. Add a sound: new key + path, `playSound('key')`.

## Keyboard (no on-screen hints)
`D` draw · `Enter` play selected · `N` Nope · `P` let it pass · `Esc` clear selection · double-click a card = play it.
Vibration on bomb / explosion / your turn (phones).

## Files
- `js/meow-engine.js` — pure rules + bots, no DOM. Tested: `node tests/engine.test.js` + `node tests/coop.test.js` (240 bot-vs-bot games + 150 team games, card conservation, Attack stacking, Nope chains, Defuse, triples).
- `js/meow-net.js` — Firebase transactions or in-memory local room. `js/meow-ui.js` — screens, table, hand, modals, driver.
- `js/meow-coop.js` — 2v2 minigames + overlay.
- `js/cat-art.js` — all artwork. `js/meow-fx.js` — fly/pop/explosion effects. `js/i18n.js` — vi/en. `js/sounds.js` — sounds.
- Add a card: kind in `COUNTS` + effect in `resolve()` (engine), `art.<kind>` (cat-art), `cards.<kind>` text (i18n).
- Add a language: copy the `en` block in `i18n.js`.
