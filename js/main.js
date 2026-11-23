// Işıltı Koşusu — giriş noktası
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STORY, HERO_NAME, COLORS } from './config.js';
import { save, persist, resetProgress, colorsRestored } from './save.js';
import { World, colorUniforms } from './world.js';
import { Track } from './track.js';
import { Player } from './player.js';
import { Particles, makeDrone, makeComposer } from './fx.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { Boss } from './boss.js';

// ---------- kalite ----------
// Dengeli varsayılan: parlama ve gölge yok, çözünürlük sınırlı. Kare hızı düşerse çözünürlük kendiliğinden azalır.
const PRESETS = {
  low: { dpr: 0.85, bloom: false, shadows: false },
  medium: { dpr: 1.25, bloom: false, shadows: false },
  high: { dpr: 1.75, bloom: true, shadows: true },
};
const resolveQuality = (q) => (q === 'auto' ? 'medium' : q);
let quality = resolveQuality(save.settings.quality);
let dynScale = 1;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const audio = new AudioEngine();
audio.musicOn = save.settings.music;
audio.sfxOn = save.settings.sfx;

let composer = null;
let world; let track; let player; let particles; let drone; let game; let boss;
let state = 'loading';
let countdown = 0;
let menuT = 0;

function pixelRatio() {
  return Math.max(0.5, Math.min(window.devicePixelRatio || 1, PRESETS[quality].dpr) * dynScale);
}

function applyQuality(q) {
  quality = q;
  dynScale = 1;
  const P = PRESETS[q];
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = P.shadows;
  if (world) {
    world.setShadows(P.shadows);
    world.reset();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  if (composer) { composer.dispose(); composer = null; }
  if (P.bloom) composer = makeComposer(renderer, scene, camera, 'medium');
  resize();
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(innerWidth, innerHeight, false);
  const s = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (composer) {
    composer.setPixelRatio(pixelRatio());
    composer.setSize(innerWidth, innerHeight);
    if (composer.bloom) composer.bloom.resolution.set(s.x / 2, s.y / 2);
  }
  if (particles) particles.resize(s.y);
}
addEventListener('resize', resize);

// uyarlamalı çözünürlük
let ema = 1 / 60; let evalT = 0; let goodT = 0;
function adapt(realDt) {
  if (state !== 'play' || countdown > 0) return;
  ema += (realDt - ema) * 0.08;
  evalT += realDt;
  if (evalT < 1) return;
  evalT = 0;
  if (ema > 1 / 42 && dynScale > 0.55) { dynScale = Math.max(0.55, dynScale * 0.85); goodT = 0; resize(); }
  else if (ema < 1 / 57 && dynScale < 1) { goodT++; if (goodT >= 3) { dynScale = Math.min(1, dynScale * 1.1); goodT = 0; resize(); } }
}

// ---------- arayüz ----------
const ui = new UI({
  click: () => audio.ui(),
  play: () => onPlay(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  quit: () => finishRun(toMenu),
  again: () => { audio.ui(); finishRun(startRun); },
  revive: () => {
    if (game.revive()) { ui.only(['hud']); state = 'play'; input.enabled = true; }
  },
  burst: () => { if (state === 'play' && countdown <= 0) game.activateBurst(); },
  buy: () => audio.buy(),
  settings: () => { audio.setMusic(save.settings.music); audio.setSfx(save.settings.sfx); },
  quality: (q) => applyQuality(resolveQuality(q)),
  currentQuality: () => quality,
  reset: () => { resetProgress(); refreshColors(); },
  towerChanged: () => refreshColors(),
});

const input = new Input(document.body, {
  left: () => countdown <= 0 && game.left(),
  right: () => countdown <= 0 && game.right(),
  up: () => countdown <= 0 && game.up(),
  down: () => countdown <= 0 && game.down(),
  burst: () => countdown <= 0 && game.activateBurst(),
  pause: () => { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); },
});

function refreshColors() {
  const n = colorsRestored();
  for (let i = 0; i < 7; i++) colorUniforms.uBands.value[i] = i < n ? 1 : 0;
  if (world) world.setTower(n, COLORS);
}

// ---------- akış ----------
function ensureAudio() {
  audio.init();
  audio.setMusic(save.settings.music); audio.setSfx(save.settings.sfx);
}

function onPlay() {
  ensureAudio();
  audio.ui();
  if (!save.seenIntro) {
    state = 'story';
    ui.only([]);
    ui.openStory(true, () => { save.seenIntro = true; persist(); startRun(); });
  } else startRun();
}

function startRun() {
  ui.only(['hud']);
  game.start();
  state = 'play';
  countdown = 0;
  input.enabled = true;
}

// koşuyu kaydet; yeni renk açıldıysa hikâye kartlarını, set bittiyse kutlamayı göster
function finishRun(next) {
  const out = game.pendingCommit ? game.commit() : null;
  if (game) game.active = false;
  const cards = [];
  if (out) {
    out.newColors.forEach((i) => { const s = STORY.find((x) => x.need === i + 1); if (s) cards.push(s); });
  }
  const after = () => {
    if (out && out.setDone) ui.notice(`🎯 Görev seti tamam! Çarpan x${save.missionLevel + 1} · +${out.setReward} 🪙`, 2600);
    next();
  };
  if (cards.length) {
    state = 'story';
    ui.only([]);
    refreshColors();
    ui.openStory(false, after, cards);
  } else after();
}

function pauseGame() {
  if (state !== 'play') return;
  state = 'pause';
  input.enabled = false;
  ui.renderSettings();
  ui.renderPauseMissions();
  ui.show('pause');
  audio.suspend();
}

function resumeGame() {
  if (state !== 'pause') return;
  ui.hide('pause');
  audio.resume();
  audio.ui();
  state = 'play';
  countdown = 1.5;
  input.enabled = true;
  ui.toast('3', 500);
}

function toMenu() {
  state = 'menu';
  input.enabled = false;
  audio.resume();
  audio.setSong(3);
  ui.clearHud();
  ui.speedlines(false);
  ui.only(['menu']);
  ui.renderMenu();
  setupMenuScene();
}

function setupMenuScene() {
  track.districtOverride = null;
  world.districtOverride = null;
  track.reset({ noSpawn: true });
  boss.stop();
  world.reset();
  world.setDistrict(0, true);
  world.update(0, 0, camera);
  refreshColors();
  colorUniforms.uRunSat.value = 0.6;
  player.menuPose();
  drone.visible = false;
  particles.clear();
  camera.fov = 55;
  camera.updateProjectionMatrix();
}

function onGameOver(result) {
  state = 'over';
  input.enabled = false;
  ui.speedlines(false);
  ui.gameOver(result);
}

addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// ---------- ön ısıtma: tüm gölgelendiricileri yüklemede derle (koşu sırasında takılma olmasın) ----------
function prewarm() {
  const P = PRESETS[quality];
  for (let di = 0; di < 3; di++) {
    world.districtOverride = di; world.makeChunk(-2000 - di * 40);
    track.districtOverride = di;
    ['barrier', 'high', 'bus', 'ramp', 'laserLow', 'laserHigh'].forEach((t, k) => track.addObstacle(t, k % 3, 2000 + di * 40 + k * 3));
  }
  track.addCrystal(1, 30); ['magnet', 'shield', 'sneakers', 'double'].forEach((k, i) => track.addPower(i % 3, 40 + i * 3, k));
  for (let k = 0; k < 3; k++) track.addCoin(1, 20 + k);
  track.obstacles.forEach((o) => { o.mesh.position.z = -10; });
  world.skylines.forEach((s) => { s.visible = true; });
  boss.root.visible = true; boss.beam.visible = true; boss.ray.visible = true; boss.figure.visible = true;
  player.shieldMesh.visible = true; player.aura.visible = true; player.magnetRing.visible = true;
  drone.visible = true;
  particles.emit(0, 1, -3, { n: 5 });
  renderer.compile(scene, camera);
  if (P.bloom && composer) composer.render(); else renderer.render(scene, camera);
  // temizle
  world.districtOverride = null; track.districtOverride = null;
  track.reset({ noSpawn: true });
  world.reset();
  boss.stop(); boss.figure.visible = false;
  player.shieldMesh.visible = false; player.aura.visible = false; player.magnetRing.visible = false;
  particles.clear();
}

// ---------- yükleme ----------
async function boot() {
  applyQuality(quality);
  ui.loading(0.05, 'Şehir kuruluyor…');

  world = new World(scene, quality);
  world.setShadows(PRESETS[quality].shadows);
  track = new Track(scene);
  particles = new Particles(scene);
  resize();
  drone = makeDrone();
  scene.add(drone);

  [...new Set(STORY.map((s) => s.img))].forEach((src) => { const i = new Image(); i.src = src; });

  const loader = new GLTFLoader();
  // Dokuları <img> ile yükle: bazı barındırma ortamları blob: adreslerine fetch'i engeller
  loader.register((parser) => {
    parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
    return { name: 'img_textures' };
  });
  const onProg = (e) => { if (e.total) ui.loading(0.1 + 0.6 * (e.loaded / e.total), `${HERO_NAME} ısınıyor…`); };
  const b64 = window.ISILTI_MODEL_B64; // claude.ai sürümü: model base64 metin olarak gelir
  const gltf = await new Promise((res, rej) => {
    if (!b64) { loader.load('assets/heroine.glb', res, onProg, rej); return; }
    new THREE.FileLoader().load(b64, (txt) => {
      try {
        const bin = atob(txt.trim());
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        loader.parse(bytes.buffer, '', res, rej);
      } catch (err) { rej(err); }
    }, onProg, rej);
  });
  player = new Player(scene, gltf);
  boss = new Boss(scene, track, particles, audio, ui);
  game = new Game({ scene, camera, player, track, world, particles, drone, boss, audio, ui, onOver: onGameOver });

  ui.loading(0.75, 'Sokaklar çiziliyor…');
  await new Promise((r) => setTimeout(r, 20));
  world.prebuild(6);
  ui.loading(0.88, 'Renkler hazırlanıyor…');
  await new Promise((r) => setTimeout(r, 20));
  setupMenuScene();
  prewarm();
  setupMenuScene();
  ui.loading(1, 'Hazır!');
  // yalnızca ?debug ile: performans ölçümü için erişim
  if (new URLSearchParams(location.search).has('debug')) {
    window.__isilti = {
      game, player, track, world, renderer, scene, camera, save, getState: () => state,
      // n kare boyunca oyunu ilerletip her karenin (mantık + çizim) süresini ölçer
      bench: (n = 600, bot = null) => {
        const gl = renderer.getContext(); const px = new Uint8Array(4); const times = [];
        state = 'bench';
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          if (bot) bot();
          game.update(1 / 60);
          if (composer) composer.render(); else renderer.render(scene, camera);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          times.push(performance.now() - t0);
          if (game.dead) break;
        }
        state = 'play';
        const s = [...times].sort((a, b) => a - b);
        return { frames: s.length, avg: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), max: +s[s.length - 1].toFixed(2), over16: s.filter((x) => x > 16.7).length, calls: renderer.info.render.calls, dist: Math.round(game.distance), px: renderer.getDrawingBufferSize(new THREE.Vector2()).toArray() };
      },
      setQuality: (q) => applyQuality(q),
    };
  }
  setTimeout(() => {
    state = 'menu';
    ui.only(['menu']);
    ui.renderMenu();
  }, 200);
}

// ---------- döngü ----------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.5, clock.getDelta());
  const dt = Math.min(0.05, realDt);
  if (!world || !game) return;

  if (state === 'play') {
    if (countdown > 0) {
      const before = Math.ceil(countdown * 2);
      countdown -= realDt;
      const after = Math.ceil(countdown * 2);
      if (after !== before && after > 0) ui.toast(String(after), 450);
      if (countdown <= 0) ui.toast('KOŞ!', 500);
    } else {
      game.update(dt);
    }
    adapt(realDt);
  } else if (state === 'over') {
    game.update(dt);
  } else if (state === 'menu' || state === 'story') {
    menuT += dt;
    player.updateMenu(dt, menuT);
    world.update(dt, 0, camera);
    particles.update(dt, 0);
    const a = menuT * 0.12;
    // portrede Şenay'ı logonun altında, kartların üstünde göster
    const portrait = innerHeight > innerWidth;
    camera.position.set(Math.sin(a) * 0.6 + 0.3, portrait ? 1.25 : 1.55, portrait ? 4.9 : 4.4);
    camera.lookAt(0, portrait ? 0.55 : 1.15, 0);
    if (Math.random() < dt * 5) particles.emit((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 2, { n: 1, rainbow: true, speed: 0.3, vy: 0.5, gravity: -0.3, life: 1.6, size: 0.18 });
  }

  if (composer) {
    const night = world.district === 2;
    composer.bloom.threshold = night ? 0.85 : 1.8;
    composer.bloom.strength = night ? 0.55 : 0.35;
    composer.render();
  } else renderer.render(scene, camera);
}

boot().catch((e) => {
  console.error(e);
  ui.loading(1, 'Yüklenemedi. Sayfayı yenileyin.');
});
frame();
