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

## Sounds
Every event has a key in `js/sounds.js` (`SOUND_FILES`). Put the files from `sounds/README.txt` in `/sounds/` any time;
until then a tiny synth placeholder plays so the game is never silent. Add a sound: new key + path, `playSound('key')`.

## Keyboard (no on-screen hints)
`D` draw · `Enter` play selected · `N` Nope · `P` let it pass · `Esc` clear selection · double-click a card = play it.
Vibration on bomb / explosion / your turn (phones).

## Files
- `js/meow-engine.js` — pure rules + bots, no DOM. Tested: `node tests/engine.test.js` (240 bot-vs-bot games, card conservation, Attack stacking, Nope chains, Defuse, triples).
- `js/meow-net.js` — Firebase transactions or in-memory local room. `js/meow-ui.js` — screens, table, hand, modals, driver.
- `js/cat-art.js` — all artwork. `js/meow-fx.js` — fly/pop/explosion effects. `js/i18n.js` — vi/en. `js/sounds.js` — sounds.
- Add a card: kind in `COUNTS` + effect in `resolve()` (engine), `art.<kind>` (cat-art), `cards.<kind>` text (i18n).
- Add a language: copy the `en` block in `i18n.js`.
