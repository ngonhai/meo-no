// meow-fx.js — small visual effects. Everything animates only `transform` and `opacity` through the Web Animations
// API (GPU-composited), and every element is removed when its animation ends, so nothing piles up in the DOM.
const FX = (function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const reduce = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const COLORS = ['#ff6a4d', '#ffb199', '#5eead4', '#ffffff', '#ff4d6d', '#8ef0de'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function layer() { return $('fx'); }
  const hidden = () => typeof document !== 'undefined' && document.hidden;
  const safety = (el, ms) => setTimeout(() => { if (el.parentNode) el.remove(); }, ms || 3600);   // never leave an orphan on screen
  function clear() { ['fx', 'stage'].forEach(id => { const el = $(id); if (el) el.innerHTML = ''; }); document.body.classList.remove('shake'); }
  function center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }

  // fly a card (html = a .card element) from one element to another
  function fly(fromEl, toEl, html, o) {
    o = o || {};
    if (hidden() || !fromEl || !toEl || !layer()) return;
    const a = center(fromEl), b = center(toEl), w = o.w || 72;
    const el = document.createElement('div');
    el.className = 'fly'; el.innerHTML = html;
    el.style.cssText = '--cw:' + w + 'px;left:' + (a.x - w / 2) + 'px;top:' + (a.y - w * 0.7) + 'px';
    layer().appendChild(el); safety(el);
    if (reduce()) { setTimeout(() => el.remove(), 50); return; }
    const an = el.animate([
      { transform: 'translate(0,0) scale(' + (o.from || 1) + ') rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + (b.x - a.x) + 'px,' + (b.y - a.y) + 'px) scale(' + (o.to || .8) + ') rotate(' + (o.rot || 0) + 'deg)', opacity: o.fade ? 0 : 1 }
    ], { duration: o.d || 420, easing: 'cubic-bezier(.22,.8,.25,1)', fill: 'forwards', delay: o.delay || 0 });
    an.onfinish = an.oncancel = () => el.remove();
  }

  // a big card popping into the middle of the table to announce what was played
  function pop(html, label, cls) {
    const st = $('stage'); if (hidden() || !st) return;
    const el = document.createElement('div');
    el.className = 'pop ' + (cls || ''); el.innerHTML = '<div class="pop-cards">' + html + '</div><div class="pop-label">' + label + '</div>';
    st.appendChild(el); safety(el);
    if (reduce()) { setTimeout(() => el.remove(), 900); return; }
    const C = 'translate(-50%,-50%) ';          // the CSS centring is replaced by the animated transform, so repeat it here
    const an = el.animate([
      { transform: C + 'translateY(40px) scale(.55)', opacity: 0 },
      { transform: C + 'translateY(0) scale(1.06)', opacity: 1, offset: .22 },
      { transform: C + 'translateY(0) scale(1)', opacity: 1, offset: .8 },
      { transform: C + (cls === 'draw' ? 'translateY(150px) scale(.5)' : 'translateY(-26px) scale(.92)'), opacity: 0 }
    ], { duration: (cls === 'nope' ? 1250 : (cls === 'draw' ? 1900 : 1500)), easing: 'ease-out', fill: 'forwards' });
    an.onfinish = an.oncancel = () => el.remove();
  }

  function banner(text, cls) {
    if (hidden() || !layer()) return;
    const el = document.createElement('div');
    el.className = 'big-banner ' + (cls || ''); el.textContent = text;
    layer().appendChild(el); safety(el);
    if (reduce()) { setTimeout(() => el.remove(), 1200); return; }
    const an = el.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 1, offset: .18 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .8 },
      { transform: 'translate(-50%,-60%) scale(1)', opacity: 0 }
    ], { duration: 1700, easing: 'ease-out', fill: 'forwards' });
    an.onfinish = an.oncancel = () => el.remove();
  }

  function shake(ms) {
    if (reduce() || hidden()) return;
    document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), ms || 500);
  }

  // polygon shards flying out of an element (the exploded cat's seat)
  function boom(el) {
    if (hidden() || !layer()) return;
    const c = el ? center(el) : { x: innerWidth / 2, y: innerHeight / 2 };
    const flash = document.createElement('div'); flash.className = 'flash'; layer().appendChild(flash); safety(flash);
    if (reduce()) { setTimeout(() => flash.remove(), 200); return; }
    flash.animate([{ opacity: 0 }, { opacity: .55, offset: .15 }, { opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = () => flash.remove();
    shake(560);
    for (let i = 0; i < 22; i++) {
      const s = document.createElement('i'), sz = rnd(12, 34), ang = rnd(0, Math.PI * 2), dist = rnd(70, 240);
      s.className = 'shard';
      s.style.cssText = 'left:' + (c.x - sz / 2) + 'px;top:' + (c.y - sz / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px;background:' + COLORS[i % COLORS.length] +
        ';clip-path:polygon(' + Math.round(rnd(0, 40)) + '% 0,100% ' + Math.round(rnd(20, 60)) + '%,' + Math.round(rnd(20, 60)) + '% 100%)';
      layer().appendChild(s); safety(s);
      const an = s.animate([
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + (Math.sin(ang) * dist + 60) + 'px) rotate(' + rnd(-540, 540) + 'deg) scale(.3)', opacity: 0 }
      ], { duration: rnd(650, 1100), easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' });
      an.onfinish = an.oncancel = () => s.remove();
    }
  }

  function confetti() {
    if (hidden() || !layer() || reduce()) return;
    for (let i = 0; i < 46; i++) {
      const s = document.createElement('i'), sz = rnd(10, 22), x = rnd(0, innerWidth);
      s.className = 'shard';
      s.style.cssText = 'left:' + x + 'px;top:-30px;width:' + sz + 'px;height:' + sz + 'px;background:' + COLORS[i % COLORS.length] + ';clip-path:polygon(50% 0,100% 100%,0 100%)';
      layer().appendChild(s); safety(s, 5000);
      const an = s.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + rnd(-120, 120) + 'px,' + (innerHeight + 60) + 'px) rotate(' + rnd(-720, 720) + 'deg)', opacity: 1 }
      ], { duration: rnd(1800, 3200), delay: rnd(0, 700), easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'forwards' });
      an.onfinish = an.oncancel = () => s.remove();
    }
  }
  return { fly, pop, banner, boom, shake, confetti, center, clear };
})();
