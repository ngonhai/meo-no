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
- **Refresh keeps your place.** The address bar always names the online room (`#CODE`) and the last room is saved in `localStorage` (`meow_last_room`, 12 h): on load the game re-enters it (spinner first) and lands on the waiting room or the table of the match in progress; a spectator re-enters a running match too. An unfinished **offline** game is copied to `localStorage` (`meow_local_room`, 12 h) on every change and restored the same way (a running minigame restarts from its seed). Leaving a room on purpose forgets it. Code: `Net.restoreLocal`, `Net.tryRejoin(code, spectate)`, `boot()` in `meow-ui.js`.
- **Create / Join room** — online, 2–5 players (+ bots). Share the 5-letter code (click it to copy an invite link).
- **Play Offline** — you vs 1–4 bots on this device. (Hands are secret, so there is no hot-seat with several humans.)
- If a human disconnects for 20 s a bot plays for them; one connected client (the host) drives bots and timers.
- Rooms live at `rooms/meow_<CODE>` in the same Firebase project — the existing `rooms/$roomId` rules already cover it.
  Note: hands are stored in the room, so a determined friend could peek in the database. Fine for friends, not for stakes.

## Rules implemented
Deck: Exploding Cat ×(players−1), Defuse (1 each + 1–2 in the pile), Attack ×4, Skip ×4, Favor ×4, Nope ×5,
Shuffle ×4, See the Future ×5, 5 cat types ×4. Turn: play any cards, then draw (ends the turn).
- **Xin Xỏ (Favor)** may target anyone with cards, **including your teammate in 2v2** (it is a gift). Pair / triple steals still never hit a teammate.
- **Năm Mèo (five cats, `five`)**: play **5 different cat cards** (one of each cat) and swap them for **any one card that has been played in the match**, i.e. any card lying in the discard pile (Exploding Cats excluded; the five cats you just played count, so they can be named too). The wanted card is named when the combo is played, it goes through the Nope window like every other card, and if the card is gone by the time it resolves (a Clone of the combo took it first) the effect fizzles. Turned off together with pairs / triples by the lobby rule *combos*. Engine: `Meow.isFive`, `Meow.recoverable(g, extra)`, effect `five` in `applyEffect`; bots with all 5 cats play it and pick Defuse > Nope > Skip > Attack > …
- **Nhân Bản (Clone, 3 in the deck, `clone`)** has two jobs:
  1. **Wildcard in a combo**: it replaces ONE cat card of a pair (Clone + X), a triple (Clone + X + X) or a five (Clone + 4 different cats = the missing one); at most one Clone per combo, and at least one real cat. `Meow.effKinds(g, kinds)` gives the cards as the combo sees them (`null` = invalid). The combo counts as that cat (`g.lastCat`).
  2. **Played alone it becomes the card played last** (`g.last` = the most recent card played in the whole match, whoever played it and however many turns ago; never a bomb, a Clone itself doesn't count so a Clone of a Clone copies the same card, `Meow.cloneKind`):
     - Attack / Skip / Shuffle / See the Future / Favor → acts as that card (the target is chosen again for a Favor); a copied Attack / Skip acts on the turn that is running right now.
     - a Nope on the table → one more Nope (same who-may-Nope rules, the Clone is spent instead of a Nope card);
     - a Defuse (it counts as played when used) → a Defuse for whoever draws a bomb next (see below);
     - a **pair / triple → the Clone turns into ONE cat card of that combo** (`cloneCat` event): instantly, straight into the player's hand, no Nope window, nobody's turn changes; a **five → one random cat** of the five. The new cat can then be used in the player's own combos.
  - Lobby rule **Nhân Bản mọi lúc** (`cloneAny`, default off): *off* = only on your own turn; *on* = **at any time**: on your own turn, on somebody else's turn (nothing pending) or as a reaction while a card is in the Nope window. A reaction Clone goes on top of the card on the table (the window restarts), a Nope only hits the top card, the stack resolves oldest first.
  - **Playing a Clone costs nobody a turn.** After its window the game is back in `play` with the same player on turn (own turn: you stay on turn). A copied Attack / Skip acts on the turn that is running *right now* (`g.turn`), whoever played the Clone: e.g. P plays Attack, anybody Clones it and the player who was just attacked gets attacked on (stacks); a Clone of Skip skips the running turn. A cloned Nhìn Trước shows the same 3 cards to both players; two Favor requests are served one after the other. A human who can still answer with a Clone is no longer auto-passed in the Nope window.
- **Nope** window after every played card (3/5/8/12 s, host setting). Nope can be Noped. Ends early when everyone passes.
  **Who may Nope (`Meow.nopeAllowed`)**: with no Nope on the table anyone may Nope the card, *except the card owner's teammate in 2v2*.
  Once a Nope is on the table only the player who just got Noped (`Meow.nopedPlayer`) may answer it (solo and 2v2) — bystanders can't Nope on their behalf;
  in 2v2 that player's teammate is on the same side and may answer for them, the opposing team may not. `canNope` enforces it, so bots, UI buttons, keyboard and the net layer all follow.
  Two players pressing Nope together: **only the first Nope counts** and the second card is not spent (`Meow.nope(g, c, seenN)`: a press made on a state that has since changed is refused). After a Nope lands, everyone except the player who got Noped is held back ~0.65 s so nobody cancels it by accident.
- **Attack**: the victim takes 2 turns. **While you are attacked (you still owe more than one turn) you cannot play Attack to pass it on**, and you cannot play Skip (Né) either — unless the lobby rule **Né khi bị Tấn công** (`dodgeAtk`, default off) is on: then every Skip cancels ONE of the turns you owe (2 owed = 2 Skips). Engine: `Meow.underAttack`, `Meow.lockedUnderAttack`; `canPlay` / `canClone` / bots respect it. (A Clone played by *another* player can still make the attacked player's turn count again — that is the Clone rule, not the victim's own card.)
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
- Lobby sub-rule **Đồng đội đã nổ vẫn giúp gỡ** (`coopGhost`, default off): off = with no Defuse and the teammate already dead you explode at once (no minigame, it needs two players); on = the dead teammate still plays the minigame with you.
- **Anti-stalemate rules (2v2 lobby sub-rules, both on by default):**
  - *Bom nóng dần 🔥* (`bombHeat`): every time a bomb is defused (minigame or Defuse card) and slid back it is one level hotter. The level is stored in the card string (`bomb`, `bomb1`, `bomb2`, `bomb3`) so Shuffle keeps it; See the Future still shows a plain bomb. Heat = minigame level: zigzag gets a narrower corridor and more corners, wires gets 5/6 steps (and only 2 strikes at 🔥2), lock gets 4/5 symbols; time limits are adjusted. A bomb at 🔥3 can't be defused by a minigame any more (Defuse card or boom).
  - *Bộ bài cạn thêm bom 💣* (`suddenBomb`): every time the pile runs out and the discard is reshuffled, one new bomb joins.
  Together they guarantee every game ends.
- Success → the drawer slides the bomb back as usual. Failure (timeout / 3 wrong cuts) → Defuse in hand is burned, else **the drawer explodes** and the teammate plays on.
- Minigames (`js/meow-coop.js`, 34–40 s, burning-fuse timer, portrait + landscape, touch / keyboard):
  **Lái Chung** (one dot, one player steers up/down, the other left/right, walls throw you back to the corner),
  **Cắt Dây** (one sees the wires, the other holds the manual: cut in order, 3 wrong cuts = boom),
  **Khóa Hai Chìa** (each lock's code is on the *other* player's screen),
  **Mê Cung Mù** (`maze`: one player — the *guide* — sees the whole maze, the dot and the goal but cannot move; the other — the *driver* — sees only a frame and the dot
  and moves it one cell per tap/key (hold = repeat, d-pad on phones). A wall costs 0.6 s. Spectators get the driver's blind screen, never the map. Maze size / route length grow with the bomb heat.
  The guide talks via voice or the quick-say direction buttons (`dir:R3` = "right, 3 cells"); bots read the route out run by run, and a bot driver obeys what it hears).
- **Phá đám (Lái Chung only)**: everyone who is not one of the two drivers (the other team, dead players, spectators) gets a panel with
  **↺/↻ turn the track 90°** (10 s cooldown, view only — walls don't change, the pad arrows turn with it), **🍬 gum** (7 s; tap the track to drop it
  exactly there, or press the button for a random spot ahead of the dot; the dot crawls at 35 % speed inside it for 9 s, max 4 at once),
  **🦑 ink** (14 s; hides the track for 4.5 s, the dot and guide lines stay visible; spectators see it faded). Each viewer writes its own log on
  `rooms/meow_<CODE>_rt/<rescueId>/<seat colour | sp_<uid>>`; clients apply each entry once and ignore entries that break the cooldown. Constants: `SB_CD`, `GUM_*`, `INK_LIFE`.
- Every wall hit in Lái Chung throws the dot back to the last corner and takes `ZZ_PEN` (0.8 s) off the fuse; any time penalty now pops up as “−0.8s” on the fuse.
- **Quick-say** buttons / "📣 tell" taps let teammates coordinate without voice chat, and bot teammates "talk" the same way.
- Realtime: positions/dials go through a separate path `rooms/meow_<CODE>_rt/<rescueId>/<color>` (one writer per node), result through
  the room transaction (`Net.doRescueEnd`). Phase `rescue` in the engine: `Meow.rescueEnd(g, id, ok)`.
- Add a minigame: `make(seed)` + a class extending `Base` in `meow-coop.js`, register in `GAMES` + `Meow.COOP_GAMES`, add texts `coop.games.<id>` in `i18n.js`.

## Discard pile
The last card played lies on top; the 4 cards before it are scattered and faded underneath (`discardUnder()` in `meow-ui.js`, `.card.under` in the CSS),
so everyone can see at a glance what was played before. Each card keeps the same scatter while it stays on the pile.

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
