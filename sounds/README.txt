MÈO NỔ — SOUND FILES
====================
Drop files in this folder using the names below (mp3 / wav). Until a file exists, the game plays a small
built-in synth beep for that event, so nothing is ever silent. To rename a file or use .ogg, edit SOUND_FILES
at the top of js/sounds.js. Per-sound volume: SOUND_VOLUME in the same file.

UI
  ui-hover.wav        pointer over a button
  ui-click.wav        click on a button / tab
  notify.wav          generic notice
  error.wav           illegal action (not your turn, cannot play that)
  join.wav / leave.wav   someone sits down / leaves in the waiting room

CARDS
  card-select.wav     select a card in your hand
  card-deselect.wav   unselect it
  card-deal.mp3       each card dealt at game start
  card-draw.mp3       someone draws a card
  card-play.mp3       any card is played onto the table
  card-give.mp3       a card moves between players (Favor / steal)
  card-receive.mp3    YOU receive a card
  shuffle.mp3         Shuffle card resolves
  meow-1..5.mp3       a cat card is played (Tabby, Black, Snow, Siamese, Calico)

ACTION CARDS
  attack.mp3          Attack resolves
  skip.mp3            Skip resolves
  nope.mp3            a Nope is played
  pass.wav            you let a card pass / a card is cancelled by Nope is "steal-miss"
  favor.mp3           Favor resolves
  future.mp3          See the Future resolves
  steal.mp3           pair / triple steals a card
  steal-miss.mp3      a triple names a card the victim doesn't have / a card is cancelled / fizzles
  timer-tick.wav      last 3 seconds of the Nope window (only if you hold a Nope)

BOMB
  bomb-draw.mp3       someone draws an Exploding Cat
  bomb-tick.wav       three ticks right after (fuse)
  defuse.mp3          Defuse used
  reinsert.mp3        the bomb is slid back into the pile
  explode.mp3         BOOM
  eliminated.mp3      sad sting right after the boom

FLOW
  game-start.mp3      game begins (deal)
  your-turn.mp3       it is YOUR turn
  end-turn.mp3        turn passes to someone else
  win.mp3             you win / game ends
  lose.mp3            you lose
