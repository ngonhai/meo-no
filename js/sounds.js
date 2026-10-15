// sounds.js — sound manager.
//
//  * Every game event has a KEY and a file name in SOUND_FILES below. Drop the file into /sounds/ (mp3, wav or ogg —
//    just keep the name, or edit the path here) and it is used automatically.
//  * Until a file exists, a tiny built-in synth plays a placeholder for that key, so the game is never silent.
//    (The synth only kicks in for files that failed to load; once you add the file the placeholder disappears.)
//  * playSound('key') never throws: missing file, blocked autoplay or no WebAudio all just do nothing.
//
// Full list with a description of each moment: sounds/README.txt
const SOUND_FILES = {
  uiHover: 'sounds/ui-hover.wav',      uiClick: 'sounds/ui-click.wav',
  cardSelect: 'sounds/card-select.wav', cardDeselect: 'sounds/card-deselect.wav',
  cardPlay: 'sounds/card-play.mp3',    cardDraw: 'sounds/card-draw.mp3',     cardDeal: 'sounds/card-deal.mp3',
  cardGive: 'sounds/card-give.mp3',    cardReceive: 'sounds/card-receive.mp3',
  shuffle: 'sounds/shuffle.mp3',       attack: 'sounds/attack.mp3',          skip: 'sounds/skip.mp3',
  nope: 'sounds/nope.mp3',             favor: 'sounds/favor.mp3',            future: 'sounds/future.mp3',
  steal: 'sounds/steal.mp3',           stealMiss: 'sounds/steal-miss.mp3',   pass: 'sounds/pass.wav',
  bombDraw: 'sounds/bomb-draw.mp3',    bombTick: 'sounds/bomb-tick.wav',     defuse: 'sounds/defuse.mp3',
  reinsert: 'sounds/reinsert.mp3',     explode: 'sounds/explode.mp3',        eliminated: 'sounds/eliminated.mp3',
  yourTurn: 'sounds/your-turn.mp3',    endTurn: 'sounds/end-turn.mp3',       timerTick: 'sounds/timer-tick.wav',
  gameStart: 'sounds/game-start.mp3',  win: 'sounds/win.mp3',                lose: 'sounds/lose.mp3',
  join: 'sounds/join.wav',             leave: 'sounds/leave.wav',            error: 'sounds/error.wav',   notify: 'sounds/notify.wav',
  meow1: 'sounds/meow-1.mp3', meow2: 'sounds/meow-2.mp3', meow3: 'sounds/meow-3.mp3', meow4: 'sounds/meow-4.mp3', meow5: 'sounds/meow-5.mp3'
};
const SOUND_VOLUME = { uiHover: 0.2, uiClick: 0.5, cardSelect: 0.5, cardDeselect: 0.4, bombTick: 0.5, timerTick: 0.35, explode: 1, win: 0.9 };

// placeholder synth recipes: tones {f,f2,d,t,v,at}  /  noise {n:1,d,v,at,lp}
const SYNTH = {
  uiHover: [{ f: 900, d: .03, t: 'sine', v: .2 }],
  uiClick: [{ f: 520, f2: 760, d: .06, t: 'triangle', v: .5 }],
  cardSelect: [{ f: 440, f2: 620, d: .07, t: 'triangle', v: .5 }],
  cardDeselect: [{ f: 520, f2: 360, d: .07, t: 'triangle', v: .4 }],
  cardPlay: [{ n: 1, d: .08, v: .5, lp: 3000 }, { f: 300, f2: 180, d: .12, t: 'triangle', v: .5 }],
  cardDraw: [{ n: 1, d: .09, v: .45, lp: 2400 }, { f: 220, f2: 330, d: .1, t: 'triangle', v: .35 }],
  cardDeal: [{ n: 1, d: .05, v: .4, lp: 3500 }],
  cardGive: [{ f: 400, f2: 600, d: .1, t: 'triangle', v: .5 }, { f: 600, f2: 800, d: .1, t: 'triangle', v: .4, at: .09 }],
  cardReceive: [{ f: 700, f2: 520, d: .1, t: 'triangle', v: .5 }, { f: 880, f2: 1100, d: .12, t: 'sine', v: .4, at: .09 }],
  shuffle: [0, .07, .14, .21, .28].map(a => ({ n: 1, d: .06, v: .4, lp: 2800, at: a })),
  attack: [{ f: 900, f2: 200, d: .22, t: 'sawtooth', v: .5 }, { n: 1, d: .15, v: .5, lp: 6000, at: .02 }],
  skip: [{ f: 300, f2: 900, d: .18, t: 'sine', v: .5 }],
  nope: [{ f: 300, f2: 120, d: .25, t: 'square', v: .45 }, { f: 220, f2: 90, d: .25, t: 'square', v: .35, at: .08 }],
  favor: [{ f: 520, d: .09, t: 'sine', v: .5 }, { f: 660, d: .09, t: 'sine', v: .5, at: .1 }, { f: 784, d: .16, t: 'sine', v: .5, at: .2 }],
  future: [{ f: 600, f2: 1400, d: .45, t: 'sine', v: .35 }, { f: 900, f2: 1800, d: .45, t: 'sine', v: .2, at: .08 }],
  steal: [{ f: 700, f2: 300, d: .15, t: 'sawtooth', v: .35 }, { f: 300, f2: 500, d: .1, t: 'triangle', v: .4, at: .14 }],
  stealMiss: [{ f: 260, f2: 200, d: .2, t: 'square', v: .3 }],
  pass: [{ f: 400, d: .04, t: 'sine', v: .25 }],
  bombDraw: [{ f: 140, f2: 90, d: .5, t: 'sawtooth', v: .55 }, { f: 180, f2: 120, d: .5, t: 'square', v: .25, at: .05 }],
  bombTick: [{ f: 1200, d: .03, t: 'square', v: .4 }],
  defuse: [{ f: 880, d: .07, t: 'triangle', v: .5 }, { n: 1, d: .05, v: .5, lp: 5000, at: .08 }, { f: 660, d: .1, t: 'triangle', v: .5, at: .14 }, { f: 988, d: .18, t: 'triangle', v: .5, at: .26 }],
  reinsert: [{ f: 500, f2: 250, d: .22, t: 'triangle', v: .45 }],
  explode: [{ n: 1, d: .7, v: 1, lp: 1800 }, { f: 120, f2: 30, d: .6, t: 'sawtooth', v: .8 }],
  eliminated: [{ f: 330, f2: 110, d: .6, t: 'sawtooth', v: .45 }, { f: 220, f2: 70, d: .7, t: 'triangle', v: .4, at: .1 }],
  yourTurn: [{ f: 660, d: .1, t: 'triangle', v: .5 }, { f: 880, d: .16, t: 'triangle', v: .5, at: .1 }],
  endTurn: [{ f: 440, f2: 330, d: .08, t: 'triangle', v: .3 }],
  timerTick: [{ f: 1000, d: .025, t: 'square', v: .3 }],
  gameStart: [{ f: 392, d: .12, t: 'triangle', v: .5 }, { f: 523, d: .12, t: 'triangle', v: .5, at: .12 }, { f: 659, d: .12, t: 'triangle', v: .5, at: .24 }, { f: 784, d: .3, t: 'triangle', v: .5, at: .36 }],
  win: [523, 659, 784, 1047, 784, 1047].map((f, i) => ({ f, d: .16, t: 'triangle', v: .5, at: i * .13 })),
  lose: [{ f: 392, d: .2, t: 'triangle', v: .45 }, { f: 330, d: .2, t: 'triangle', v: .45, at: .2 }, { f: 262, d: .5, t: 'triangle', v: .45, at: .4 }],
  join: [{ f: 600, d: .08, t: 'sine', v: .4 }, { f: 800, d: .1, t: 'sine', v: .4, at: .08 }],
  leave: [{ f: 600, d: .08, t: 'sine', v: .4 }, { f: 400, d: .1, t: 'sine', v: .4, at: .08 }],
  error: [{ f: 200, d: .12, t: 'square', v: .3 }, { f: 160, d: .16, t: 'square', v: .3, at: .1 }],
  notify: [{ f: 880, d: .08, t: 'sine', v: .35 }],
  meow1: [{ f: 600, f2: 900, d: .12, t: 'triangle', v: .4 }, { f: 900, f2: 500, d: .22, t: 'triangle', v: .4, at: .11 }],
  meow2: [{ f: 500, f2: 800, d: .1, t: 'sawtooth', v: .25 }, { f: 800, f2: 420, d: .26, t: 'triangle', v: .35, at: .1 }],
  meow3: [{ f: 720, f2: 1000, d: .1, t: 'triangle', v: .4 }, { f: 1000, f2: 620, d: .18, t: 'triangle', v: .35, at: .1 }],
  meow4: [{ f: 450, f2: 700, d: .16, t: 'triangle', v: .4 }, { f: 700, f2: 380, d: .3, t: 'sine', v: .35, at: .15 }],
  meow5: [{ f: 640, f2: 840, d: .08, t: 'square', v: .18 }, { f: 840, f2: 540, d: .2, t: 'triangle', v: .38, at: .08 }]
};

const _sounds = {}, _missing = {}, _last = {};
for (const key in SOUND_FILES) {
  try {
    const a = new Audio(SOUND_FILES[key]);
    a.preload = 'auto';
    a.addEventListener('error', () => { _missing[key] = true; });
    _sounds[key] = a;
  } catch (e) { _missing[key] = true; }
}

let soundEnabled = (function () { try { return localStorage.getItem('meow_sound') !== 'off'; } catch (e) { return true; } })();
function setSoundEnabled(on) { soundEnabled = on; try { localStorage.setItem('meow_sound', on ? 'on' : 'off'); } catch (e) {} }

let _ctx = null, _noise = null;
function _audioCtx() {
  if (_ctx) return _ctx;
  try { const C = window.AudioContext || window.webkitAudioContext; if (C) _ctx = new C(); } catch (e) {}
  return _ctx;
}
function _synth(key, vol) {
  const rec = SYNTH[key], ctx = _audioCtx(); if (!rec || !ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const t0 = ctx.currentTime + 0.005;
  if (!_noise) { _noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = _noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  rec.forEach(n => {
    const at = t0 + (n.at || 0), g = ctx.createGain(), v = (n.v || .4) * vol * 0.6;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + n.d);
    let src;
    if (n.n) { src = ctx.createBufferSource(); src.buffer = _noise; src.loop = true; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = n.lp || 4000; src.connect(lp); lp.connect(g); }
    else { src = ctx.createOscillator(); src.type = n.t || 'sine'; src.frequency.setValueAtTime(n.f, at); if (n.f2) src.frequency.exponentialRampToValueAtTime(n.f2, at + n.d); src.connect(g); }
    g.connect(ctx.destination); src.start(at); src.stop(at + n.d + 0.02);
  });
}

function playSound(key) {
  if (!soundEnabled) return;
  const now = Date.now(); if (now - (_last[key] || 0) < 35) return; _last[key] = now;
  const vol = SOUND_VOLUME[key] != null ? SOUND_VOLUME[key] : 0.8;
  const a = _sounds[key];
  if (a && !_missing[key]) {
    try {
      const inst = a.cloneNode(); inst.volume = vol;
      const pr = inst.play();
      if (pr && pr.catch) pr.catch(err => { if (err && err.name === 'NotSupportedError') { _missing[key] = true; _synth(key, vol); } });
      return;
    } catch (e) { _missing[key] = true; }
  }
  _synth(key, vol);
}
const playMeow = kind => playSound({ cat1: 'meow1', cat2: 'meow2', cat3: 'meow3', cat4: 'meow4', cat5: 'meow5' }[kind] || 'cardPlay');
