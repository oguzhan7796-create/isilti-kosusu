// Kaydırma (dokunmatik/fare) ve klavye kontrolleri
// Eylem, parmak eşiği geçtiği anda tetiklenir (parmağı kaldırmayı beklemez).
// Aynı hareket içinde yön değiştirirse (ör. sağ sonra yukarı) ikinci eylem de tetiklenir.

export const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const TH = 16; // ilk eylem için px
const TH_CHAIN = 34; // aynı dokunuşta sonraki eylem için px (titreme yanlış eylem üretmesin)

export class Input {
  constructor(target, handlers) {
    this.h = handlers;
    this.enabled = false;
    this.start = null;
    this.fired = false;
    this.lastDir = null;
    this.touchId = null;

    const down = (x, y, ev) => {
      if (ev.target.closest && ev.target.closest('button, .panel, .no-swipe')) { this.start = null; return; }
      this.start = { x, y, t: performance.now() };
      this.fired = false;
      this.lastDir = null;
    };
    const move = (x, y) => {
      if (!this.start) return;
      const dx = x - this.start.x; const dy = y - this.start.y;
      const th = this.fired ? TH_CHAIN : TH;
      if (Math.abs(dx) < th && Math.abs(dy) < th) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.start.x = x; this.start.y = y;
      if (dir === this.lastDir) return; // aynı yönde uzayan kaydırma tek eylemdir
      this.lastDir = dir;
      this.fired = true;
      this.fire(dir);
    };
    const up = () => {
      if (this.start && !this.fired && performance.now() - this.start.t < 250) this.fire('tap');
      this.start = null;
      this.touchId = null;
    };
    const find = (list) => {
      for (let i = 0; i < list.length; i++) if (list[i].identifier === this.touchId) return list[i];
      return null;
    };

    target.addEventListener('touchstart', (e) => {
      if (this.touchId !== null) return; // ilk parmağı takip et
      const t = e.changedTouches[0];
      this.touchId = t.identifier;
      down(t.clientX, t.clientY, e);
      if (!this.start) this.touchId = null;
    }, { passive: true });
    target.addEventListener('touchmove', (e) => {
      const t = find(e.changedTouches);
      if (t) move(t.clientX, t.clientY);
      if (this.enabled && e.cancelable) e.preventDefault();
    }, { passive: false });
    const end = (e) => { if (find(e.changedTouches)) up(); };
    target.addEventListener('touchend', end, { passive: true });
    target.addEventListener('touchcancel', end, { passive: true });
    target.addEventListener('mousedown', (e) => { if (!isTouch) down(e.clientX, e.clientY, e); });
    window.addEventListener('mousemove', (e) => { if (!isTouch) move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (!isTouch) up(); });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      const map = {
        arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
        arrowup: 'up', w: 'up', ' ': 'up', arrowdown: 'down', s: 'down',
        e: 'burst', shift: 'burst', enter: 'burst', t: 'turbo', escape: 'pause', p: 'pause',
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
