// Oyun kuralları: tek ve sonsuz koşu, Gri Gölge karşılaşmaları, görevler, Gökkuşağı Kulesi
import * as THREE from 'three';
import {
  START_SPEED, MAX_SPEED, SPEED_GAIN, DISTRICTS, DISTRICT_LEN, POWERUPS, BURST, LANES,
  BOSS_FIRST, BOSS_EVERY, BOSS_TIME, TRAILS,
} from './config.js';
import {
  save, persist, multiplier, newMissionSet, isRunMission, totalKey, setReward, colorsRestored, ensureDaily,
} from './save.js';
import { colorUniforms } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V1 = new THREE.Vector3();
const V2 = new THREE.Vector3();
const TUTORIAL_END = 470;

export class Game {
  constructor(o) {
    Object.assign(this, o); // scene, camera, player, track, world, particles, drone, boss, audio, ui, onOver
    this.camPos = new THREE.Vector3(0, 4.6, 7.6);
    this.camLook = new THREE.Vector3(0, 1.2, -11);
    this.shake = 0;
    this.time = 0;
    this.active = false;

    const t = this.track;
    t.on('coin', (x, y, z, flew) => this.onCoin(x, y, z, flew));
    t.on('crystal', (x, y, z) => this.onCrystal(x, y, z));
    t.on('power', (k, x, y, z) => this.onPower(k, x, y, z));
    t.on('smash', (ob) => this.onSmash(ob));
    t.on('crash', (ob) => this.onCrash(ob));
    t.on('sidehit', () => this.onSideHit());
    t.on('hint', (h) => this.onHint(h));
    t.on('honk', () => this.audio.honk());
  }

  start() {
    const tutorial = !save.tutorialDone;
    this.tutorial = tutorial;
    this.distance = 0;
    this.speed = START_SPEED;
    this.score = 0;
    this.coins = 0;
    this.crystals = 0;
    this.coinStreak = 0; this.coinStreakT = 0;
    this.meter = 0;
    this.burst = 0;
    this.burstMax = BURST.base + save.upgrades.burst * BURST.step;
    this.powers = { magnet: 0, shield: 0, sneakers: 0, double: 0 };
    this.powerMax = { magnet: 1, shield: 1, sneakers: 1, double: 1 };
    this.stumble = 0;
    this.lastSide = -9;
    this.run = { jumps: 0, slides: 0, lanes: 0, powerups: 0, bursts: 0, busDist: 0, smashes: 0, magnetCoins: 0, boss: 0, firstCoinAt: null, cleanDist: 0, stumbles: 0 };
    this.revives = 0;
    this.dead = false;
    this.deadT = 0;
    this.droneGap = 0; this.droneIntro = 3.2;
    this.missionCheck = 0;
    this.readyAnnounced = false;
    this.active = true;
    this.slowmo = 1;
    this.nextBoss = BOSS_FIRST;
    this.bossT = 0;
    this.encounter = 0;
    this.districtIdx = 0;
    this.skyIdx = 0;
    this.runSat = 0.45;
    this.trail = TRAILS.find((x) => x.id === save.trail) || TRAILS[0];
    this.colorsAtStart = colorsRestored();

    ensureDaily();
    save.missions.forEach((m) => { if (isRunMission(m) && !m.done) m.progress = 0; });

    this.player.reset();
    this.player.play('run', 0.2, 1);
    this.track.districtOverride = null;
    this.world.districtOverride = null;
    this.track.reset({ tutorial, diff: 0.1, crystalEvery: 60 });
    this.world.reset();
    this.world.setDistrict(0, true);
    this.applyBands(this.colorsAtStart, false);
    this.bandTargets = null;
    this.world.setTower(this.colorsAtStart, this.ui.colors);
    colorUniforms.uRunSat.value = this.runSat;
    this.particles.clear();
    this.boss.stop();
    this.audio.setSong(0);
    this.drone.visible = true;
    this.drone.position.set(0, 4.6, 3.2);
    this.ui.clearHud();
    this.ui.setupHud();
    const runId = (this.runId = (this.runId || 0) + 1);
    setTimeout(() => {
      if (!this.active || this.runId !== runId) return;
      const D = DISTRICTS[0];
      this.ui.banner('KOŞ, ŞENAY!', D.name, D.line, 3000);
    }, 400);
  }

  get mult() { return multiplier() * (this.powers.double > 0 ? 2 : 1); }

  // ---------- eylemler ----------
  canAct() { return !this.dead; }
  left() { this.lane(-1); }
  right() { this.lane(1); }
  lane(dir) {
    if (!this.canAct()) return;
    if (this.player.moveLane(dir)) { this.audio.whoosh(); this.run.lanes++; }
  }
  up() {
    if (!this.canAct()) return;
    if (this.player.jump(this.powers.sneakers > 0)) this.afterJump();
  }
  afterJump() {
    this.run.jumps++; this.audio.jump();
    if (this.powers.sneakers > 0) this.emitTrail(this.player.x, 0.2, 0, 16, 3);
  }
  down() {
    if (!this.canAct()) return;
    if (this.player.slide()) { this.run.slides++; this.audio.slide(); }
  }
  activateBurst() {
    if (!this.canAct() || this.burst > 0 || this.meter < 1) return;
    this.meter = 0;
    this.burst = this.burstMax;
    this.run.bursts++;
    this.audio.burst();
    this.ui.flash();
    this.ui.toast(`<span style="color:#ffd166">⚡ ${BURST.name.toUpperCase()}!</span>`, 1100);
    this.particles.emit(this.player.x, 1, 0, { n: 70, rainbow: !this.trail.colors, color: this.trail.colors && this.trail.colors[0], speed: 9, vy: 2, life: 0.9, size: 0.5 });
    this.shake = 0.35;
    if (this.boss.active && this.boss.hit(this.player)) {
      this.score += 500 * this.mult;
      this.ui.toast(this.boss.hp > 0 ? `💥 İsabet! ${this.boss.hp} kaldı` : '💥 YENİLDİ!', 1300);
    }
  }

  emitTrail(x, y, z, n, speed = 0.6) {
    const c = this.trail.colors;
    this.particles.emit(x, y, z, { n, rainbow: !c, color: c ? c[Math.floor(Math.random() * c.length)] : undefined, speed, vy: 0.5, gravity: 0, life: 0.5, size: 0.3, drift: true });
  }

  // ---------- olaylar ----------
  onCoin(x, y, z, flew) {
    this.coins++;
    if (this.run.firstCoinAt === null) this.run.firstCoinAt = this.distance;
    if (flew && this.powers.magnet > 0) this.run.magnetCoins++;
    this.score += 10 * this.mult;
    this.coinStreak = this.coinStreakT > 0 ? this.coinStreak + 1 : 0;
    this.coinStreakT = 0.45;
    this.audio.coin(this.coinStreak);
    this.particles.emit(x, y, z, { n: 4, color: 0xffd166, speed: 2.4, vy: 1.5, life: 0.3, size: 0.22, drift: true });
  }

  onCrystal(x, y, z) {
    this.crystals++;
    this.score += 60 * this.mult;
    if (this.burst <= 0) this.meter = Math.min(1, this.meter + (this.boss.active ? 0.34 : 0.2));
    this.runSat = Math.min(0.85, this.runSat + 0.025);
    this.audio.crystal();
    this.particles.emit(x, y, z, { n: 22, rainbow: true, speed: 5, vy: 2.5, life: 0.6, size: 0.35, drift: true });
    // kule ilerlemesi: koşu içinde yeni renk açılırsa hemen kutla
    const before = colorsRestored(save.crystalsTotal + this.crystals - 1);
    const after = colorsRestored(save.crystalsTotal + this.crystals);
    if (after > before) {
      this.ui.colorUnlocked(after - 1);
      this.audio.restore();
      this.ui.flash();
      this.world.setTower(after, this.ui.colors);
      this.applyBands(after, true);
    } else if (this.meter >= 1 && !this.readyAnnounced && this.burst <= 0) {
      this.readyAnnounced = true;
      this.ui.toast(this.boss.active ? '⚡ Hazır! Muhafıza ateş et!' : '⚡ Renk Patlaması hazır!', 1300);
    }
  }

  applyBands(n, animate) {
    const b = colorUniforms.uBands.value;
    for (let i = 0; i < 7; i++) {
      const target = i < n ? 1 : 0;
      if (!animate) b[i] = target; else this.bandTargets = Array.from({ length: 7 }, (_, k) => (k < n ? 1 : 0));
    }
  }

  onPower(kind, x, y, z) {
    const P = POWERUPS[kind];
    const dur = P.base + save.upgrades[kind] * P.step;
    this.powers[kind] = dur; this.powerMax[kind] = dur;
    this.run.powerups++;
    this.score += 40 * this.mult;
    this.audio.powerup();
    this.ui.toast(`<span style="color:${P.color}">${P.name}</span>`, 1100);
    this.particles.emit(x, y, z, { n: 26, color: new THREE.Color(P.color).getHex(), speed: 5, vy: 2, life: 0.6, drift: true });
  }

  onSmash(o) {
    this.run.smashes++;
    this.score += 50 * this.mult;
    this.audio.smash();
    const z = this.distance - o.d;
    this.particles.emit(LANES[o.lane], Math.min(o.top, 2) * 0.6, z, { n: 34, rainbow: true, speed: 8, vy: 4, life: 0.7, size: 0.4, drift: true, spread: 1.2 });
    this.shake = Math.max(this.shake, 0.2);
  }

  onCrash(o) {
    if (!this.canAct()) return;
    if (this.player.invuln > 0) return;
    if (this.powers.shield > 0) {
      this.powers.shield = 0;
      this.track.smash(o);
      this.audio.shieldBreak();
      this.player.invuln = 1.0;
      this.ui.flash();
      this.shake = 0.3;
      return;
    }
    this.die(false);
  }

  onSideHit() {
    if (!this.canAct() || this.time - this.lastSide < 0.5) return;
    this.lastSide = this.time;
    this.player.bounceBack();
    this.audio.stumble();
    this.shake = 0.25;
    this.particles.emit(this.player.x, 1, 0, { n: 12, color: 0xdddddd, speed: 3, life: 0.4 });
    if (this.player.invuln > 0) return;
    this.run.stumbles++;
    this.run.cleanDist = 0;
    if (this.stumble > 0) {
      if (this.powers.shield > 0) { this.powers.shield = 0; this.audio.shieldBreak(); this.stumble = 3; return; }
      this.die(true);
    } else {
      this.stumble = 5;
      this.ui.toast('Dikkat! Dron yaklaşıyor!', 1100);
    }
  }

  onHint(h) {
    this.ui.hint(h);
    if (h === 'burst') { this.meter = 1; this.readyAnnounced = true; }
  }

  // ---------- Gri Gölge karşılaşması ----------
  startEncounter() {
    this.encounter++;
    const di = this.districtIdx % DISTRICTS.length;
    const D = DISTRICTS[di];
    const hp = Math.min(6, 2 + this.encounter);
    this.boss.start({ hp, name: D.boss, final: di === 2 });
    this.bossT = BOSS_TIME;
    this.track.pauseGen = true;
    this.ui.banner('GRİ GÖLGE SALDIRIYOR', D.boss, `${BOSS_TIME} saniyen var! Kristal topla, ⚡ ile vur.`, 3000);
    this.ui.setBoss(D.boss);
  }

  endEncounter(won) {
    this.track.pauseGen = false;
    this.track.cursor = this.distance + 40;
    this.nextBoss = this.distance + BOSS_EVERY;
    this.ui.hideBoss();
    if (won) {
      this.run.boss++;
      this.crystals += 10; // kuleye bonus
      this.score += 2000 * this.mult;
      const bonus = 100 * multiplier();
      this.coins += bonus;
      this.track.clearAhead(this.distance, 250);
      this.audio.restore();
      this.ui.flash();
      this.ui.toast(`🏆 Muhafız yenildi!<br><small>+10 💎 · +${bonus} 🪙</small>`, 2200);
      this.particles.emit(this.player.x, 3, -15, { n: 140, rainbow: true, speed: 12, vy: 4, life: 1.3, size: 0.5, spread: 6 });
      this.runSat = Math.min(0.9, this.runSat + 0.2);
    } else {
      this.boss.flee();
      this.ui.toast('Muhafız kaçtı… bir dahakine!', 1600);
    }
  }

  onBossDefeated() { this.endEncounter(true); }

  die(caught) {
    this.dead = true;
    this.caught = caught;
    this.deadT = 0;
    this.player.die();
    this.burst = 0;
    this.audio.crash();
    this.shake = 0.5;
    this.ui.flash();
    this.particles.emit(this.player.x, 0.6, 0, { n: 26, color: 0xcfc8bd, speed: 4, vy: 2, life: 0.8, size: 0.5 });
    this.updateMissions();
  }

  // ---------- canlandırma ----------
  reviveCost() { return 300 * Math.pow(2, this.revives); }
  canRevive() { return this.revives < 2; }

  revive() {
    const cost = this.reviveCost();
    if (save.coins + this.coins < cost) return false;
    const fromRun = Math.min(this.coins, cost);
    this.coins -= fromRun;
    save.coins -= cost - fromRun;
    persist();
    this.revives++;
    this.dead = false;
    this.active = true;
    this.stumble = 0;
    this.player.revive();
    this.track.clearAhead(this.distance, 45);
    this.droneGap = 1;
    this.ui.flash();
    this.audio.powerup();
    this.particles.emit(this.player.x, 1, 0, { n: 50, rainbow: true, speed: 6, life: 0.9 });
    return true;
  }

  // ---------- görevler ----------
  missionValue(m) {
    const r = this.run;
    switch (m.id) {
      case 'coins_run': return this.coins;
      case 'dist_run': return this.distance;
      case 'score_run': return this.score;
      case 'crystals_run': return this.crystals;
      case 'jumps_run': return r.jumps;
      case 'slides_run': return r.slides;
      case 'lanes_run': return r.lanes;
      case 'magnet_run': return r.magnetCoins;
      case 'smash_run': return r.smashes;
      case 'bus_run': return r.busDist;
      case 'nocoin_run': return r.firstCoinAt === null ? this.distance : r.firstCoinAt;
      case 'clean_run': return Math.max(r.cleanBest || 0, r.cleanDist);
      case 'coins_total': return save.totals.coins + this.coins - m.base;
      case 'powerups': return save.totals.powerups + r.powerups - m.base;
      case 'bursts': return save.totals.bursts + r.bursts - m.base;
      case 'boss': return save.totals.boss + r.boss - m.base;
      default: return 0;
    }
  }

  updateMissions() {
    save.missions.forEach((m) => {
      if (m.done) return;
      m.progress = Math.max(m.progress, Math.floor(this.missionValue(m)));
      if (m.progress >= m.target) {
        m.done = true;
        if (!this.dead) { this.ui.missionToast(m); this.audio.mission(); }
      }
    });
    const d = save.daily;
    if (d && !d.done) {
      const v = this.dailyValue(d);
      if (v >= d.target) { d.done = true; if (!this.dead) { this.ui.toast('📅 Günlük görev tamam!', 1500); this.audio.mission(); } }
    }
  }

  dailyValue(d) {
    const base = d.progress || 0;
    switch (d.id) {
      case 'runs': return base + 1;
      case 'crystals': return base + this.crystals;
      case 'dist': return base + this.distance;
      case 'coins': return base + this.coins;
      case 'boss': return base + this.run.boss;
      case 'bursts': return base + this.run.bursts;
      default: return base;
    }
  }

  // koşu sonucunu kalıcı kayda yaz
  commit() {
    if (!this.pendingCommit) return null;
    this.pendingCommit = false;
    const out = { setDone: false, setReward: 0, newColors: [], dailyReward: false };
    this.updateMissions();
    save.coins += this.coins;
    save.runs++;
    save.best = Math.max(save.best, Math.floor(this.score));
    save.bestDistance = Math.max(save.bestDistance, Math.floor(this.distance));
    save.totals.coins += this.coins;
    save.totals.powerups += this.run.powerups;
    save.totals.bursts += this.run.bursts;
    save.totals.boss += this.run.boss;
    if (this.distance > TUTORIAL_END) save.tutorialDone = true;

    // kule
    const before = colorsRestored();
    save.crystalsTotal += this.crystals;
    const after = colorsRestored();
    for (let i = before; i < after; i++) { out.newColors.push(i); save.coins += 300 * (i + 1); }

    // günlük
    const d = save.daily;
    if (d) {
      d.progress = Math.floor(this.dailyValue(d));
      if (d.progress >= d.target) d.done = true;
    }

    // görev seti
    if (save.missions.every((m) => m.done)) {
      out.setDone = true;
      out.setReward = setReward();
      save.coins += out.setReward;
      save.missionLevel = Math.min(29, save.missionLevel + 1);
      save.missions = newMissionSet(save);
    }
    persist();
    return out;
  }

  result() {
    return {
      score: this.score, distance: this.distance, coins: this.coins, crystals: this.crystals,
      caught: this.caught, newBest: this.score > save.best,
      canRevive: this.canRevive() && save.coins + this.coins >= this.reviveCost(),
      reviveCost: this.reviveCost(),
    };
  }

  targetSpeed() {
    let s = Math.min(MAX_SPEED, START_SPEED + this.distance * SPEED_GAIN);
    if (this.tutorial && this.distance < TUTORIAL_END) s = START_SPEED;
    if (this.boss.active) s = Math.min(s, 26);
    return s * (this.burst > 0 ? 1.4 : 1);
  }

  // ---------- döngü ----------
  update(rawDt) {
    this.time += rawDt;
    const dt = rawDt * this.slowmo;
    const p = this.player;

    if (!this.dead) {
      this.speed += (this.targetSpeed() - this.speed) * Math.min(1, dt * 2.5);
      this.distance += this.speed * dt;
      this.score += this.speed * dt * this.mult * 0.5;
      this.run.cleanDist += this.speed * dt;
      this.run.cleanBest = Math.max(this.run.cleanBest || 0, this.run.cleanDist);
      if (this.tutorial && this.distance > TUTORIAL_END) { this.tutorial = false; save.tutorialDone = true; persist(); }
      this.track.diff = clamp(0.1 + this.distance / 3200, 0, 1.25);
      // Gri Gölge karşılaşması
      if (!this.boss.active && !this.tutorial && this.distance > this.nextBoss) this.startEncounter();
      if (this.boss.active && !this.boss.dying) {
        this.bossT -= dt;
        this.ui.bossTime(Math.max(0, this.bossT));
        if (this.bossT <= 0) this.endEncounter(false);
      }
    } else {
      this.speed *= Math.max(0, 1 - dt * 5);
      this.deadT += rawDt;
      this.slowmo = this.deadT < 0.5 ? 0.45 : 1;
      if (this.deadT > 1.4 && this.active) {
        this.active = false;
        this.pendingCommit = true;
        this.updateMissions();
        this.onOver(this.result());
      }
    }

    if (!this.dead) {
      Object.keys(this.powers).forEach((k) => { if (this.powers[k] > 0) this.powers[k] -= dt; });
      if (this.burst > 0) {
        this.burst -= dt;
        if (this.burst <= 0) { this.burst = 0; p.invuln = Math.max(p.invuln, 0.8); this.readyAnnounced = false; }
      }
    }
    if (this.stumble > 0) this.stumble -= dt;
    if (this.coinStreakT > 0) this.coinStreakT -= dt;

    const state = { magnet: this.powers.magnet, burst: this.burst };
    const { groundH, onBus } = this.track.update(dt, this.distance, this.speed, p, state, this.time);
    const landed = p.update(dt, this.speed, groundH);
    if (p.buffered) { p.buffered = false; this.afterJump(); }
    if (landed) {
      this.audio.land();
      this.particles.emit(p.x, groundH + 0.1, 0.2, { n: 6, color: 0xe8dccb, speed: 1.5, vy: 0.8, life: 0.3, size: 0.3, drift: true });
    }
    if (onBus && p.grounded && !this.dead) this.run.busDist += this.speed * dt;
    this.world.update(dt, this.distance, this.camera);
    this.boss.update(dt, this.distance, this);
    p.updateFx(dt, this.time, { shield: this.powers.shield > 0, burst: this.burst > 0, magnet: this.powers.magnet > 0 });

    // koşu izi (kozmetik): her zaman ince, patlama/süper zıplamada yoğun
    if (!this.dead && p.grounded) {
      const rate = this.burst > 0 || this.powers.sneakers > 0 ? 30 : 9;
      if (Math.random() < dt * rate) this.emitTrail(p.x + (Math.random() - 0.5) * 0.4, groundH + 0.12, 0.3, 1);
    }
    if (!this.dead && p.sliding > 0 && Math.random() < dt * 40) {
      this.particles.emit(p.x + (Math.random() - 0.5) * 0.5, groundH + 0.1, -0.4, { n: 2, color: 0xe8dccb, speed: 1.2, vy: 0.8, life: 0.35, size: 0.4, drift: true });
    }
    this.particles.update(dt, this.dead ? 0 : this.speed);

    // bölgeler
    const idx = Math.floor(this.distance / DISTRICT_LEN);
    const skyIdx = Math.floor((this.distance + 110) / DISTRICT_LEN);
    if (skyIdx !== this.skyIdx) { this.skyIdx = skyIdx; this.world.setDistrict(skyIdx % DISTRICTS.length); }
    if (idx !== this.districtIdx && !this.dead) {
      this.districtIdx = idx;
      const di = idx % DISTRICTS.length;
      const D = DISTRICTS[di];
      this.audio.setSong(di);
      if (!this.boss.active) this.ui.banner(`${Math.floor(this.distance)} M`, D.name, D.line, 2600);
      this.score += 500 * this.mult;
    }

    // renk: kalıcı bantlar + koşu içi canlılık
    if (this.bandTargets) {
      const b = colorUniforms.uBands.value;
      let moving = false;
      for (let i = 0; i < 7; i++) { const d = this.bandTargets[i] - b[i]; if (Math.abs(d) > 0.001) { b[i] += d * Math.min(1, dt * 1.5); moving = true; } }
      if (!moving) this.bandTargets = null;
    }
    const target = this.burst > 0 ? 1 : this.runSat;
    colorUniforms.uRunSat.value += (target - colorUniforms.uRunSat.value) * Math.min(1, dt * 3);
    this.audio.tempoBoost = (this.speed - START_SPEED) * 0.8;

    this.missionCheck -= dt;
    if (this.missionCheck <= 0 && !this.dead) { this.missionCheck = 0.5; this.updateMissions(); }

    this.updateDrone(dt);
    this.updateCamera(dt);

    this.ui.hud({
      score: this.score, distance: this.distance, coins: this.coins, mult: this.mult, crystals: this.crystals,
      meter: this.meter, burstOn: this.burst > 0, burstLeft: this.burst / this.burstMax,
      powers: this.powers, powerMax: this.powerMax,
      bossHp: this.boss.active ? this.boss.hp / this.boss.maxHp : null,
    });
    this.ui.speedlines(this.burst > 0);
  }

  updateDrone(dt) {
    const d = this.drone;
    if (this.droneIntro > 0) this.droneIntro -= dt;
    let gap = 1;
    if ((this.droneIntro > 0 || this.stumble > 0) && !this.boss.active) gap = 0;
    const caught = this.dead && this.caught;
    this.droneGap += (gap - this.droneGap) * Math.min(1, dt * 1.6);
    const near = 1 - this.droneGap;
    const tx = caught ? this.player.x : this.player.x * 0.55;
    d.position.x += (tx - d.position.x) * Math.min(1, dt * 4);
    const ty = caught ? 2.4 + this.player.y : 5.0 + this.player.y * 0.6 + Math.sin(this.time * 3) * 0.12;
    const tz = caught ? 1.1 : 3.4 + this.droneGap * 4;
    d.position.y += (ty - d.position.y) * Math.min(1, dt * (caught ? 5 : 3));
    d.position.z += (tz - d.position.z) * Math.min(1, dt * (caught ? 5 : 3));
    d.scale.setScalar(0.6);
    d.rotation.y = Math.sin(this.time * 1.3) * 0.25;
    d.rotation.x = 0.35;
    d.userData.rotors.forEach((r, i) => { r.rotation.y += dt * (30 + i); });
    d.visible = near > 0.05 || caught;
  }

  updateCamera(dt) {
    const p = this.player;
    const burst = this.burst > 0;
    V1.set(p.x * 0.7, 4.6 + p.y * 0.6, burst ? 8.2 : 7.6);
    V2.set(p.x * 0.8, 1.2 + p.y * 0.65, -11);
    const k = Math.min(1, dt * 8);
    this.camPos.lerp(V1, k);
    this.camLook.lerp(V2, k);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake -= dt;
      const s = this.shake * 0.4;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.camLook);
    const fov = burst ? 72 : 60 + Math.min(7, (this.speed - START_SPEED) * 0.35);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
  }
}
