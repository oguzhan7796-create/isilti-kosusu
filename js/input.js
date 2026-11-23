// Kaydırma (dokunmatik/fare) ve klavye kontrolleri

export const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export class Input {
  constructor(target, handlers) {
    this.h = handlers;
    this.enabled = false;
    this.start = null;
    this.fired = false;
    const TH = 26;

    const down = (x, y, ev) => {
      if (ev.target.closest && ev.target.closest('button, .panel, .no-swipe')) { this.start = null; return; }
      this.start = { x, y, t: performance.now() };
      this.fired = false;
    };
    const move = (x, y) => {
      if (!this.start || this.fired) return;
      const dx = x - this.start.x; const dy = y - this.start.y;
      if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
      this.fired = true;
      if (Math.abs(dx) > Math.abs(dy)) this.fire(dx > 0 ? 'right' : 'left');
      else this.fire(dy > 0 ? 'down' : 'up');
    };
    const up = () => {
      if (this.start && !this.fired && performance.now() - this.start.t < 250) this.fire('tap');
      this.start = null;
    };

    target.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; down(t.clientX, t.clientY, e); }, { passive: true });
    target.addEventListener('touchmove', (e) => {
      const t = e.changedTouches[0]; move(t.clientX, t.clientY);
      if (this.enabled && e.cancelable) e.preventDefault();
    }, { passive: false });
    target.addEventListener('touchend', up, { passive: true });
    target.addEventListener('mousedown', (e) => { if (!isTouch) down(e.clientX, e.clientY, e); });
    window.addEventListener('mousemove', (e) => { if (!isTouch) move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (!isTouch) up(); });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      const map = {
        arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
        arrowup: 'up', w: 'up', ' ': 'up', arrowdown: 'down', s: 'down',
        e: 'burst', shift: 'burst', enter: 'burst', escape: 'pause', p: 'pause',
      };
      if (map[k]) {
        if (this.enabled || k === 'escape' || k === 'p') e.preventDefault();
        this.fire(map[k]);
      }
    });
  }

  fire(action) {
    if (action === 'pause') { this.h.pause && this.h.pause(); return; }
    if (!this.enabled) return;
    const fn = this.h[action];
    if (fn) fn();
  }
}
