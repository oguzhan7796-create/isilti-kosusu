// Prosedürel müzik ve ses efektleri (harici ses dosyası gerekmez)

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Her bölge için tonalite ve akor yürüyüşü (kök notaya göre aralıklar)
const SONGS = [
  { root: 57, prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], lead: [0, 2, 4, 7, 9], bpm: 116 }, // Çarşı: A majör, sıcak
  { root: 62, prog: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], lead: [0, 2, 4, 7, 9, 11], bpm: 120 }, // Sahil: D majör, ferah
  { root: 52, prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], lead: [0, 3, 5, 7, 10], bpm: 124 }, // Neon: E minör, elektronik
  { root: 60, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], lead: [0, 2, 4, 7, 9], bpm: 100 }, // Menü: C majör, sakin
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.song = 3;
    this.tempoBoost = 0;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.intensity = 0.6;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    this.master.connect(comp).connect(c.destination);
    this.music = c.createGain();
    this.music.gain.value = this.musicOn ? 0.42 : 0;
    this.music.connect(this.master);
    this.sfx = c.createGain();
    this.sfx.gain.value = this.sfxOn ? 0.8 : 0;
    this.sfx.connect(this.master);

    // basit yankı
    this.delay = c.createDelay(1);
    this.delay.delayTime.value = 0.27;
    const fb = c.createGain(); fb.gain.value = 0.28;
    const wet = c.createGain(); wet.gain.value = 0.22;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.music);

    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.nextTime = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.music) this.music.gain.setTargetAtTime(on ? 0.42 : 0, this.ctx.currentTime, 0.1);
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  setSong(i) { this.song = i; }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // ---- müzik sıralayıcı ----
  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const song = SONGS[this.song];
    const bpm = song.bpm + this.tempoBoost;
    const stepDur = 60 / bpm / 4;
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, song, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, t, song, sd) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = song.prog[bar];
    const root = song.root;
    const menu = this.song === 3;
    const neon = this.song === 2;

    if (!menu) {
      if (s % 4 === 0) this.kick(t);
      if (s === 4 || s === 12) this.clap(t);
      if (s % 2 === 1 || (neon && s % 4 === 2)) this.hat(t, s % 4 === 2 ? 0.05 : 0.035);
    } else if (s === 0 || s === 8) {
      this.kick(t, 0.35);
    }

    // bas
    const bassPat = menu ? [0, 8] : neon ? [0, 3, 6, 8, 11, 14] : [0, 3, 8, 10, 14];
    if (bassPat.includes(s)) {
      const n = root - 12 + chord[0] + (s === 10 || s === 14 ? 12 : 0);
      this.bass(t, mtof(n), sd * (menu ? 6 : 2.2));
    }

    // akor pedi
    if (s === 0) chord.forEach((iv) => this.pad(t, mtof(root + iv), sd * 16, menu ? 0.05 : 0.035));

    // arpej / melodi
    if (!menu || s % 4 === 0) {
      const arp = [0, 1, 2, 1, 2, 0, 1, 2];
      if (s % 2 === 0) {
        const idx = arp[(s / 2) % arp.length];
        const n = root + 12 + chord[idx] + (bar === 3 && s > 8 ? 12 : 0);
        this.pluck(t, mtof(n), menu ? 0.06 : 0.045, neon ? 'square' : 'triangle');
      }
    }
    // ara melodi notaları
    if (!menu && (s === 6 || s === 14) && Math.random() < this.intensity) {
      const scale = song.lead;
      const n = root + 24 + scale[Math.floor(Math.random() * scale.length)];
      this.pluck(t, mtof(n), 0.035, 'sine', true);
    }
  }

  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  kick(t, vol = 0.9) {
    const c = this.ctx;
    const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.002, vol, 0.22);
    o.connect(g).connect(this.music);
    o.start(t); o.stop(t + 0.3);
  }

  clap(t) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 0.8;
    const g = c.createGain();
    this.env(g, t, 0.002, 0.35, 0.16);
    src.connect(f).connect(g).connect(this.music);
    src.start(t, Math.random() * 0.5); src.stop(t + 0.2);
  }

  hat(t, vol) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = c.createGain();
    this.env(g, t, 0.001, vol * 3, 0.04);
    src.connect(f).connect(g).connect(this.music);
    src.start(t, Math.random() * 0.5); src.stop(t + 0.06);
  }

  bass(t, freq, dur) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 6;
    const g = c.createGain();
    this.env(g, t, 0.005, 0.32, dur);
    o.connect(f).connect(g).connect(this.music);
    o.start(t); o.stop(t + dur + 0.05);
  }

  pad(t, freq, dur, vol) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    [-6, 6].forEach((det) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.05);
    });
    f.connect(g).connect(this.music);
  }

  pluck(t, freq, vol, type = 'triangle', echo = false) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    this.env(g, t, 0.003, vol, 0.22);
    o.connect(g).connect(this.music);
    if (echo) g.connect(this.delay);
    o.start(t); o.stop(t + 0.3);
  }

  // ---- efektler ----
  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.004, vol, dur);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noiseHit(dur, freq, vol = 0.3, type = 'lowpass', delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    this.env(g, t, 0.004, vol, dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 0.4); src.stop(t + dur + 0.05);
  }

  coin(streak = 0) {
    const n = 84 + [0, 2, 4, 7, 9, 12][streak % 6];
    this.tone(mtof(n), 0.09, 'square', 0.06);
    this.tone(mtof(n + 7), 0.12, 'sine', 0.08, null, 0.04);
  }
  crystal() { [0, 4, 7, 12].forEach((iv, i) => this.tone(mtof(88 + iv), 0.18, 'triangle', 0.09, null, i * 0.04)); }
  jump() { this.tone(300, 0.18, 'sine', 0.18, 720); this.noiseHit(0.12, 2500, 0.05, 'highpass'); }
  slide() { this.noiseHit(0.32, 900, 0.18, 'bandpass'); }
  land() { this.noiseHit(0.08, 400, 0.12); }
  whoosh() { this.noiseHit(0.14, 1800, 0.08, 'bandpass'); }
  stumble() { this.tone(220, 0.25, 'sawtooth', 0.12, 110); this.noiseHit(0.2, 500, 0.2); }
  crash() { this.noiseHit(0.6, 300, 0.5); this.tone(160, 0.5, 'sawtooth', 0.2, 40); }
  shieldBreak() { this.tone(900, 0.3, 'triangle', 0.16, 200); this.noiseHit(0.3, 4000, 0.12, 'highpass'); }
  smash() { this.noiseHit(0.25, 1200, 0.22, 'bandpass'); this.tone(500, 0.2, 'square', 0.06, 1200); }
  powerup() { [0, 4, 7, 11, 14].forEach((iv, i) => this.tone(mtof(72 + iv), 0.16, 'square', 0.06, null, i * 0.05)); }
  burst() {
    [0, 7, 12, 16, 19, 24].forEach((iv, i) => this.tone(mtof(60 + iv), 0.6, 'sawtooth', 0.05, null, i * 0.03));
    this.noiseHit(0.8, 6000, 0.12, 'highpass');
  }
  ui() { this.tone(mtof(79), 0.07, 'triangle', 0.08); }
  buy() { [0, 7, 12].forEach((iv, i) => this.tone(mtof(76 + iv), 0.12, 'triangle', 0.09, null, i * 0.06)); }
  mission() { [0, 4, 7, 12, 16].forEach((iv, i) => this.tone(mtof(72 + iv), 0.2, 'triangle', 0.1, null, i * 0.08)); }
  restore() { [0, 4, 7, 11, 12, 16, 19, 24].forEach((iv, i) => this.tone(mtof(67 + iv), 0.3, 'sine', 0.08, null, i * 0.06)); }
  warn() { this.tone(880, 0.12, 'square', 0.07); this.tone(880, 0.12, 'square', 0.07, null, 0.18); }
  honk() { this.tone(330, 0.35, 'sawtooth', 0.1); this.tone(415, 0.35, 'sawtooth', 0.08); }
  rumble() { this.noiseHit(0.7, 180, 0.28, 'lowpass'); this.tone(70, 0.6, 'sawtooth', 0.08, 50); }
  screech() { this.tone(1400, 0.35, 'sawtooth', 0.05, 700); this.tone(1800, 0.25, 'square', 0.03, 900, 0.05); }
  boing() { this.tone(180, 0.35, 'sine', 0.22, 720); this.tone(360, 0.25, 'triangle', 0.08, 1100, 0.03); }
  bossIntro() { [0, -1, -5, -12].forEach((iv, i) => this.tone(mtof(52 + iv), 0.5, 'sawtooth', 0.12, null, i * 0.22)); this.noiseHit(1.2, 200, 0.3, 'lowpass', 0.1); }
  bossHit() { this.noiseHit(0.5, 2500, 0.3, 'bandpass'); [0, 7, 12, 19].forEach((iv, i) => this.tone(mtof(64 + iv), 0.35, 'square', 0.07, null, i * 0.05)); }
  win() { [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((iv, i) => this.tone(mtof(64 + iv), 0.28, 'triangle', 0.11, null, i * 0.09)); }
  star(i = 0) { this.tone(mtof(84 + i * 4), 0.3, 'triangle', 0.12); this.tone(mtof(91 + i * 4), 0.35, 'sine', 0.08, null, 0.06); }
}
