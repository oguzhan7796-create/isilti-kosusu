// Kalıcı ilerleme (localStorage). Depolama kapalıysa oyun yine çalışır.
import {
  MISSION_TEMPLATES, UPGRADE_COSTS, MAX_UPGRADE, COLORS, DAILY_TEMPLATES,
} from './config.js';

const KEY = 'isilti-kosusu-save-v2';

function defaults() {
  return {
    coins: 0,
    best: 0,
    bestDistance: 0,
    runs: 0,
    crystalsTotal: 0, // Gökkuşağı Kulesi'ne giden ömür boyu kristal
    colorsCelebrated: 0, // kutlaması gösterilmiş renk sayısı
    upgrades: { magnet: 0, shield: 0, sneakers: 0, double: 0, burst: 0 },
    missionLevel: 0, // tamamlanan set sayısı; çarpan = missionLevel + 1
    missions: [],
    totals: { coins: 0, powerups: 0, bursts: 0, boss: 0 },
    trails: ['rainbow'],
    trail: 'rainbow',
    daily: null,
    settings: { music: true, sfx: true, quality: 'auto' },
    seenIntro: false,
    tutorialDone: false,
  };
}

export const save = load();

function load() {
  let data = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      data = { ...data, ...p };
      data.upgrades = { ...defaults().upgrades, ...(p.upgrades || {}) };
      data.totals = { ...defaults().totals, ...(p.totals || {}) };
      data.settings = { ...defaults().settings, ...(p.settings || {}) };
      if (!Array.isArray(data.trails) || !data.trails.length) data.trails = ['rainbow'];
    }
  } catch (e) { /* depolama yok */ }
  if (!Array.isArray(data.missions) || data.missions.length !== 3) data.missions = newMissionSet(data);
  return data;
}

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* yok say */ }
}

export function resetProgress() {
  const keepSettings = save.settings;
  const fresh = defaults();
  Object.keys(save).forEach((k) => delete save[k]);
  Object.assign(save, fresh, { settings: keepSettings });
  save.missions = newMissionSet(save);
  persist();
}

export function multiplier() { return 1 + save.missionLevel; }

// ---------- görev setleri ----------
export function newMissionSet(data = save) {
  const pool = [...MISSION_TEMPLATES].sort(() => Math.random() - 0.5);
  const lvl = data.missionLevel || 0;
  return pool.slice(0, 3).map((t) => {
    const tier = Math.min(t.tiers.length - 1, Math.floor(lvl * 0.55) + (Math.random() < 0.3 ? 1 : 0));
    return { id: t.id, target: t.tiers[tier], base: t.run ? 0 : ((data.totals && data.totals[totalKey(t.id)]) || 0), progress: 0, done: false };
  });
}

export function totalKey(id) { return { coins_total: 'coins', powerups: 'powerups', bursts: 'bursts', boss: 'boss' }[id] || id; }
export function template(id) { return MISSION_TEMPLATES.find((x) => x.id === id); }
export function missionText(m) { const t = template(m.id); return t ? t.text.replace('{n}', m.target.toLocaleString('tr-TR')) : ''; }
export function missionIcon(m) { const t = template(m.id); return t ? t.ico : '🎯'; }
export function isRunMission(m) { const t = template(m.id); return !!(t && t.run); }
export function setReward() { return 150 + save.missionLevel * 60; }

export function upgradeCost(key) {
  const lvl = save.upgrades[key];
  return lvl >= MAX_UPGRADE ? null : UPGRADE_COSTS[lvl];
}

// ---------- Gökkuşağı Kulesi ----------
export function colorsRestored(total = save.crystalsTotal) { return COLORS.filter((c) => total >= c.need).length; }
export function nextColor() { return COLORS.find((c) => save.crystalsTotal < c.need) || null; }

// ---------- günlük görev ----------
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ensureDaily() {
  const t = today();
  if (save.daily && save.daily.date === t) return save.daily;
  let h = 0; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const tpl = DAILY_TEMPLATES[h % DAILY_TEMPLATES.length];
  save.daily = { date: t, id: tpl.id, target: tpl.n, progress: 0, done: false, claimed: false };
  persist();
  return save.daily;
}

export function dailyText(d) {
  const tpl = DAILY_TEMPLATES.find((x) => x.id === d.id);
  return tpl ? tpl.text.replace('{n}', d.target.toLocaleString('tr-TR')) : '';
}
export function dailyIcon(d) { const tpl = DAILY_TEMPLATES.find((x) => x.id === d.id); return tpl ? tpl.ico : '📅'; }
