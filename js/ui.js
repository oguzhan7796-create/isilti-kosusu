// Ekranlar, HUD, görevler, mağaza, hikâye, Gökkuşağı Kulesi
import { POWERUPS, BURST, STORY, MAX_UPGRADE, HERO_NAME, COLORS, TRAILS, DAILY_REWARD } from './config.js';
import {
  save, persist, missionText, missionIcon, multiplier, upgradeCost, colorsRestored, nextColor,
  ensureDaily, dailyText, dailyIcon, setReward,
} from './save.js';
import { isTouch } from './input.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('tr-TR');
const ICONS = { magnet: '🧲', shield: '🛡️', sneakers: '👟', double: '✨', burst: '⚡' };
const SCREENS = ['loading', 'menu', 'story', 'missions', 'shop', 'settings', 'hud', 'pause', 'gameover'];

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.stack = [];
    this.colors = COLORS;
    this.shopTab = 'up';

    document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { this.h.click(); this.open(b.dataset.open); }));
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { this.h.click(); this.closeTop(); }));
    $('btnPlay').addEventListener('click', () => this.h.play());
    $('btnPause').addEventListener('click', () => this.h.pause());
    $('btnResume').addEventListener('click', () => this.h.resume());
    $('btnQuit').addEventListener('click', () => this.h.quit());
    $('btnAgain').addEventListener('click', () => this.h.again());
    $('btnMenu').addEventListener('click', () => this.h.quit());
    $('btnRevive').addEventListener('click', () => this.h.revive());
    $('btnDaily').addEventListener('click', () => this.claimDaily());
    const burst = $('btnBurst');
    const fireBurst = (e) => { e.preventDefault(); e.stopPropagation(); this.h.burst(); };
    burst.addEventListener('touchstart', fireBurst, { passive: false });
    burst.addEventListener('mousedown', fireBurst);
    $('shopTabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      this.h.click(); this.shopTab = b.dataset.tab;
      $('shopTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      this.renderShop();
    }));

    const toggle = (key) => { save.settings[key] = !save.settings[key]; persist(); this.h.settings(); this.renderSettings(); };
    $('setMusic').addEventListener('click', () => toggle('music'));
    $('setSfx').addEventListener('click', () => toggle('sfx'));
    $('pauseMusic').addEventListener('click', () => toggle('music'));
    $('pauseSfx').addEventListener('click', () => toggle('sfx'));
    $('setQuality').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      save.settings.quality = b.dataset.q; persist(); this.h.quality(b.dataset.q); this.renderSettings();
    }));
    // confirm() her ortamda çalışmaz; ikinci dokunuşla onay
    let resetArmed = 0;
    const resetBtn = $('btnReset');
    resetBtn.addEventListener('click', () => {
      this.h.click();
      if (Date.now() < resetArmed) {
        resetArmed = 0; resetBtn.textContent = 'İlerlemeyi sıfırla';
        this.h.reset(); this.renderMenu(); this.renderSettings(); this.toast('İlerleme sıfırlandı');
        return;
      }
      resetArmed = Date.now() + 3000;
      resetBtn.textContent = 'Emin misin? Tekrar dokun';
      setTimeout(() => { if (Date.now() >= resetArmed) resetBtn.textContent = 'İlerlemeyi sıfırla'; }, 3100);
    });

    $('storyNext').addEventListener('click', () => { this.h.click(); this.storyGo(1); });
    $('storyPrev').addEventListener('click', () => { this.h.click(); this.storyGo(-1); });
    $('storySkip').addEventListener('click', () => { this.h.click(); this.storyDone(); });

    this.hudCache = {};
  }

  show(id) { $(id).classList.add('show'); }
  hide(id) { $(id).classList.remove('show'); }
  only(ids) { SCREENS.forEach((s) => $(s).classList.toggle('show', ids.includes(s))); this.stack = []; }

  open(name) {
    if (name === 'story') { this.openStory(false); return; }
    if (name === 'missions') this.renderMissions();
    if (name === 'shop') this.renderShop();
    if (name === 'settings') this.renderSettings();
    this.show(name);
    this.stack.push(name);
  }

  closeTop() {
    const s = this.stack.pop();
    if (s) this.hide(s);
    this.renderMenu();
  }

  loading(p, txt) {
    $('loadbar').style.width = `${Math.round(p * 100)}%`;
    if (txt) $('loadtxt').textContent = txt;
  }

  // ---------- kule ----------
  towerDots(el) {
    const n = colorsRestored();
    el.innerHTML = COLORS.map((c, i) => `<i style="${i < n ? `background:${c.hex};border-color:${c.hex};box-shadow:0 0 8px ${c.hex}` : ''}"></i>`).join('');
  }

  towerProgress() {
    const n = colorsRestored();
    const next = nextColor();
    if (!next) return { frac: 1, text: 'Kule yedi renkle parlıyor! Rekor için koş.' };
    const prev = n > 0 ? COLORS[n - 1].need : 0;
    const frac = (save.crystalsTotal - prev) / (next.need - prev);
    return { frac, text: `${next.name} için ${save.crystalsTotal - prev}/${next.need - prev} 💎`, next };
  }

  renderMenu() {
    $('menuCoins').textContent = fmt(save.coins);
    $('menuBest').textContent = fmt(save.best);
    $('menuMult').textContent = multiplier();
    const n = colorsRestored();
    $('towerCount').textContent = `${n}/7`;
    this.towerDots($('towerDots'));
    const tp = this.towerProgress();
    $('towerBar').style.width = `${Math.min(1, tp.frac) * 100}%`;
    $('towerBar').style.background = tp.next ? tp.next.hex : '';
    $('towerNext').textContent = tp.text;
    // günlük
    const d = ensureDaily();
    $('dailyIco').textContent = dailyIcon(d);
    $('dailyText').textContent = dailyText(d);
    $('dailyBar').style.width = `${Math.min(1, d.progress / d.target) * 100}%`;
    const bd = $('btnDaily');
    bd.classList.toggle('ready', d.done && !d.claimed);
    bd.classList.toggle('done', d.claimed);
    bd.textContent = d.claimed ? '✓' : `+${DAILY_REWARD.coins}`;
    // rozetler
    const doneCount = save.missions.filter((m) => m.done).length;
    $('missionBadge').textContent = `${doneCount}/3`;
    $('missionBadge').classList.toggle('on', true);
    const unread = STORY.filter((s) => s.need <= n).length - (save.storySeen || 0);
    $('storyBadge').textContent = unread > 0 ? unread : '';
    $('storyBadge').classList.toggle('on', unread > 0);
  }

  claimDaily() {
    const d = ensureDaily();
    if (!d.done || d.claimed) { this.h.click(); return; }
    d.claimed = true;
    save.coins += DAILY_REWARD.coins;
    save.crystalsTotal += DAILY_REWARD.crystals;
    persist();
    this.h.buy();
    this.h.towerChanged();
    this.renderMenu();
  }

  // ---------- görevler ----------
  missionLi(m) {
    const p = Math.min(m.progress, m.target);
    return `<li class="${m.done ? 'done' : ''}"><span class="m-ico">${missionIcon(m)}</span><div class="m-body"><p>${missionText(m)}</p>
      <div class="bar small"><i style="width:${(p / m.target) * 100}%"></i></div>
      <small>${fmt(p)} / ${fmt(m.target)}</small></div></li>`;
  }

  renderMissions() {
    $('missionMult').textContent = multiplier();
    $('setTitle').textContent = `Görev Seti ${save.missionLevel + 1}`;
    $('setInfo').textContent = `Üçünü de bitir: çarpan x${multiplier() + 1} ve ${fmt(setReward())} altın`;
    $('missionList').innerHTML = save.missions.map((m) => this.missionLi(m)).join('');
    const d = ensureDaily();
    $('dailyBig').innerHTML = `<span class="dc-ico">${dailyIcon(d)}</span><div class="dc-body"><small>GÜNLÜK GÖREV</small><p>${dailyText(d)}</p>
      <div class="bar small"><i style="width:${Math.min(1, d.progress / d.target) * 100}%"></i></div>
      <small style="color:var(--muted);letter-spacing:0">${fmt(Math.min(d.progress, d.target))} / ${fmt(d.target)} · Ödül: ${DAILY_REWARD.coins} 🪙 + ${DAILY_REWARD.crystals} 💎</small></div>`;
  }

  // ---------- mağaza ----------
  renderShop() {
    $('shopCoins').textContent = fmt(save.coins);
    const list = $('shopList');
    if (this.shopTab === 'up') {
      const items = [
        ...Object.entries(POWERUPS).map(([k, p]) => ({ k, name: p.name, desc: p.desc, base: p.base, step: p.step, color: p.color })),
        { k: 'burst', name: BURST.name, desc: BURST.desc, base: BURST.base, step: BURST.step, color: BURST.color },
      ];
      list.innerHTML = items.map((it) => {
        const lvl = save.upgrades[it.k];
        const cost = upgradeCost(it.k);
        const dur = (it.base + lvl * it.step).toFixed(1).replace('.0', '');
        const levels = Array.from({ length: MAX_UPGRADE }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
        const btn = cost === null
          ? '<button class="btn buy" disabled>MAKS</button>'
          : `<button class="btn primary buy" data-buy="${it.k}" ${cost > save.coins ? 'disabled' : ''}><span class="coin-ico"></span>${fmt(cost)}</button>`;
        return `<li><div class="shop-ico" style="background:${it.color}">${ICONS[it.k]}</div>
          <div class="m-body"><p>${it.name}</p><small>${it.desc} Süre: ${dur} sn</small><div class="levels">${levels}</div></div>${btn}</li>`;
      }).join('');
      list.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.buy; const cost = upgradeCost(k);
        if (cost !== null && save.coins >= cost) { save.coins -= cost; save.upgrades[k]++; persist(); this.h.buy(); this.renderShop(); this.renderMenu(); }
      }));
    } else {
      list.innerHTML = TRAILS.map((t) => {
        const own = save.trails.includes(t.id);
        const eq = save.trail === t.id;
        const sw = t.colors ? t.colors.map((c) => `#${c.toString(16).padStart(6, '0')}`) : ['#ff3b4f', '#ffd23f', '#3ddc84', '#2ec5ff', '#b45cff'];
        const btn = eq ? '<button class="btn buy equipped" disabled>Kullanılıyor</button>'
          : own ? `<button class="btn buy" data-eq="${t.id}">Kullan</button>`
            : `<button class="btn primary buy" data-trail="${t.id}" ${t.cost > save.coins ? 'disabled' : ''}><span class="coin-ico"></span>${fmt(t.cost)}</button>`;
        return `<li><div class="shop-ico" style="background:linear-gradient(135deg,${sw.join(',')})">${t.ico}</div>
          <div class="m-body"><p>${t.name}</p><small>Koşu izi ve Renk Patlaması efekti</small></div>${btn}</li>`;
      }).join('');
      list.querySelectorAll('[data-trail]').forEach((b) => b.addEventListener('click', () => {
        const t = TRAILS.find((x) => x.id === b.dataset.trail);
        if (save.coins >= t.cost) { save.coins -= t.cost; save.trails.push(t.id); save.trail = t.id; persist(); this.h.buy(); this.renderShop(); this.renderMenu(); }
      }));
      list.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => { save.trail = b.dataset.eq; persist(); this.h.click(); this.renderShop(); }));
    }
  }

  renderSettings() {
    $('setMusic').classList.toggle('on', save.settings.music);
    $('setSfx').classList.toggle('on', save.settings.sfx);
    $('pauseMusic').classList.toggle('off', !save.settings.music);
    $('pauseSfx').classList.toggle('off', !save.settings.sfx);
    const q = this.h.currentQuality();
    $('setQuality').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.q === q));
  }

  // ---------- hikâye ----------
  // intro: ilk açılış (4 kart, atla düğmesi); list: belirli kartlar; yoksa tüm bölümler
  openStory(intro, onDone, list) {
    this.storyIntro = intro;
    this.storyOnDone = onDone || null;
    this.storyList = list || (intro ? STORY.slice(0, 4) : STORY);
    const n = colorsRestored();
    this.storyIdx = list || intro ? 0 : Math.max(0, STORY.filter((s) => s.need <= n).length - 1);
    $('storySkip').style.display = intro ? '' : 'none';
    this.renderStory();
    this.show('story');
    if (!intro && !list) this.stack.push('story');
    save.storySeen = Math.max(save.storySeen || 0, STORY.filter((s) => s.need <= n).length);
    persist();
  }

  renderStory() {
    const s = this.storyList[this.storyIdx];
    const n = colorsRestored();
    const locked = s.need > n;
    const img = $('storyImg');
    img.src = s.img;
    img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
    $('storyLock').classList.toggle('on', locked);
    $('storyLock').textContent = locked ? `🔒 Açmak için kuleye ${COLORS[s.need - 1].name} rengini geri getir` : '';
    const idx = STORY.indexOf(s);
    $('storyStep').textContent = idx < 4 ? `GİRİŞ ${idx + 1}/4` : `RENK ${idx - 3}/7`;
    $('storyTitle').textContent = locked ? '???' : s.title;
    $('storyText').textContent = locked ? 'Bu bölüm henüz kilitli.' : s.text;
    $('storyDots').innerHTML = this.storyList.map((x, i) => `<i class="${i === this.storyIdx ? 'on' : ''} ${x.need > n ? 'lock' : ''}"></i>`).join('');
    $('storyPrev').style.visibility = this.storyIdx > 0 ? 'visible' : 'hidden';
    const last = this.storyIdx === this.storyList.length - 1;
    $('storyNext').textContent = last ? (this.storyIntro ? 'Koşmaya başla!' : this.storyOnDone ? 'Devam' : 'Kapat') : 'İleri';
  }

  storyGo(dir) {
    const n = this.storyIdx + dir;
    if (n >= this.storyList.length) { this.storyDone(); return; }
    if (n < 0) return;
    this.storyIdx = n;
    this.renderStory();
  }

  storyDone() {
    this.hide('story');
    this.stack = this.stack.filter((s) => s !== 'story');
    this.renderMenu();
    const cb = this.storyOnDone; this.storyOnDone = null;
    if (cb) cb();
  }

  // ---------- HUD ----------
  setupHud() {
    this.hideBoss();
    $('colorPop').classList.remove('show');
    $('missionPop').classList.remove('show');
    this.hudCache = {};
  }

  setBoss(name) {
    $('bossName').textContent = name.toUpperCase();
    $('bossWrap').style.display = 'flex';
  }

  hideBoss() { $('bossWrap').style.display = 'none'; }

  bossTime(t) {
    const s = Math.ceil(t);
    if (this.hudCache.bt !== s) { $('bossTime').textContent = s; this.hudCache.bt = s; }
  }

  hud(s) {
    const c = this.hudCache;
    const score = fmt(s.score);
    if (c.score !== score) { $('hudScore').textContent = score; c.score = score; }
    const dist = `${fmt(s.distance)} m`;
    if (c.dist !== dist) { $('hudDist').textContent = dist; c.dist = dist; }
    const mult = `x${s.mult}`;
    if (c.mult !== mult) { $('hudMult').textContent = mult; c.mult = mult; }
    if (c.coins !== s.coins) { $('hudCoins').textContent = fmt(s.coins); c.coins = s.coins; }
    if (c.crystals !== s.crystals) { $('hudCrystals').textContent = s.crystals; c.crystals = s.crystals; }
    if (s.bossHp !== null) {
      const bh = Math.round(s.bossHp * 100);
      if (c.bh !== bh) { $('bossBar').style.width = `${bh}%`; c.bh = bh; }
    }
    const meter = Math.round(s.meter * 100);
    const ring = Math.round((s.burstOn ? s.burstLeft : s.meter) * 100);
    if (c.ring !== ring || c.burstOn !== s.burstOn) {
      $('burstRing').style.strokeDashoffset = String(276.5 * (1 - ring / 100));
      $('btnBurst').classList.toggle('ready', meter >= 100 && !s.burstOn);
      c.ring = ring; c.burstOn = s.burstOn;
    }
    const keys = Object.keys(s.powers).filter((k) => s.powers[k] > 0);
    const sig = keys.join(',');
    const list = $('powerList');
    if (c.psig !== sig) {
      list.innerHTML = keys.map((k) => `<div class="power-item" data-k="${k}"><span class="pi" style="background:${POWERUPS[k].color}">${ICONS[k]}</span>${POWERUPS[k].short}<span class="pbar"><i></i></span></div>`).join('');
      c.psig = sig;
      c.pw = {};
    }
    keys.forEach((k) => {
      const w = Math.round(Math.max(0, Math.min(1, s.powers[k] / s.powerMax[k])) * 50);
      if (c.pw[k] !== w) {
        const el = list.querySelector(`[data-k="${k}"] .pbar i`);
        if (el) el.style.width = `${w * 2}%`;
        c.pw[k] = w;
      }
    });
  }

  toast(text, ms = 1400) {
    const el = $('toast');
    el.innerHTML = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  notice(html, ms = 2800) {
    const el = $('notice');
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  missionToast(m) {
    const el = $('missionPop');
    el.innerHTML = `<span>${missionIcon(m)}</span> Görev tamam: ${missionText(m)}`;
    el.classList.add('show');
    clearTimeout(this.missionTimer);
    this.missionTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  colorUnlocked(i) {
    const c = COLORS[i];
    const el = $('colorPop');
    $('colorPopName').textContent = c.name.toUpperCase();
    $('colorPopName').style.color = c.hex;
    el.style.borderColor = c.hex;
    el.classList.add('show');
    clearTimeout(this.colorTimer);
    this.colorTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  banner(chapter, title, line, ms = 3000) {
    $('bannerChapter').textContent = chapter;
    $('bannerTitle').textContent = title;
    $('bannerLine').textContent = line;
    const el = $('banner');
    el.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  hint(kind) {
    const T = isTouch;
    const map = {
      jump: ['⬆️', T ? 'Yukarı kaydır: ZIPLA' : '↑ / Boşluk: ZIPLA'],
      slide: ['⬇️', T ? 'Aşağı kaydır: KAY' : '↓: KAY'],
      lane: ['⬅️ ➡️', T ? 'Sağa/sola kaydır: ŞERİT DEĞİŞTİR' : '← →: ŞERİT DEĞİŞTİR'],
      ramp: ['🚌', 'Rampadan otobüsün üstüne çık!'],
      crystal: ['💎', 'Kristaller Gökkuşağı Kulesi\'ne gider!'],
      burst: ['⚡', T ? 'Patlama hazır! ⚡ butonuna bas' : 'Patlama hazır! E tuşuna bas'],
    };
    const [a, t] = map[kind] || ['', kind];
    const el = $('hint');
    el.innerHTML = `<span class="arrow">${a}</span>${t}`;
    el.classList.add('show');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  clearHud() {
    ['toast', 'banner', 'hint', 'colorPop', 'missionPop'].forEach((id) => $(id).classList.remove('show'));
    this.hudCache = {};
  }

  flash() {
    const f = $('flash');
    f.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
  }

  speedlines(on) {
    if (this.sl !== on) { $('speedlines').classList.toggle('on', on); this.sl = on; }
  }

  renderPauseMissions() { $('pauseMissions').innerHTML = save.missions.map((m) => this.missionLi(m)).join(''); }

  // ---------- oyun sonu ----------
  gameOver(r) {
    $('goTitle').textContent = r.caught ? 'Dron yakaladı!' : 'Çarptın!';
    $('goScore').textContent = fmt(r.score);
    $('goBest').textContent = fmt(Math.max(save.best, r.score));
    $('goDist').textContent = fmt(r.distance);
    $('goCoins').textContent = fmt(r.coins);
    $('goCrystals').textContent = fmt(r.crystals);
    $('goNew').classList.toggle('on', r.newBest);
    $('goMissions').innerHTML = save.missions.map((m) => this.missionLi(m)).join('');
    // kule: bu koşunun kristalleri dahil önizleme
    const total = save.crystalsTotal + r.crystals;
    const n = COLORS.filter((c) => total >= c.need).length;
    const next = COLORS[n];
    $('goTowerDots').innerHTML = COLORS.map((c, i) => `<i style="${i < n ? `background:${c.hex};border-color:${c.hex}` : ''}"></i>`).join('');
    if (next) {
      const prev = n > 0 ? COLORS[n - 1].need : 0;
      $('goTowerBar').style.width = `${((total - prev) / (next.need - prev)) * 100}%`;
      $('goTowerBar').style.background = next.hex;
      $('goTowerTxt').textContent = `+${r.crystals} 💎 · ${next.name} için ${total - prev}/${next.need - prev}`;
    } else {
      $('goTowerBar').style.width = '100%';
      $('goTowerTxt').textContent = `+${r.crystals} 💎 · Kule tamamen renkli!`;
    }
    const rv = $('btnRevive');
    rv.style.display = r.canRevive ? '' : 'none';
    $('reviveCost').textContent = fmt(r.reviveCost);
    const timer = $('reviveTimer');
    timer.style.transition = 'none'; timer.style.width = '100%';
    if (r.canRevive) {
      requestAnimationFrame(() => requestAnimationFrame(() => { timer.style.transition = 'width 6s linear'; timer.style.width = '0%'; }));
      clearTimeout(this.reviveTimeout);
      this.reviveTimeout = setTimeout(() => { rv.style.display = 'none'; }, 6000);
    }
    this.only(['gameover']);
  }
}
