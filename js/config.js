// Işıltı Koşusu — oyun ayarları ve içerik verileri

export const HERO_NAME = 'Şenay';
export const GAME_TITLE = 'Işıltı Koşusu';

export const LANE_W = 2.4;
export const LANES = [-LANE_W, 0, LANE_W];

export const START_SPEED = 15;
export const MAX_SPEED = 34;
export const SPEED_GAIN = 0.0042; // koşulan her metre için hız artışı

export const GRAVITY = 50;
export const JUMP_HEIGHT = 2.15;
export const SUPER_JUMP_HEIGHT = 4.6;
export const SLIDE_TIME = 0.68;

export const PLAYER_W = 0.6;
export const PLAYER_DEPTH = 0.55;
export const PLAYER_H = 1.75;
export const PLAYER_SLIDE_H = 0.75;
// Görsel boy çarpanı: çarpışma kutuları aynı kalır, karakter haritaya göre daha iri görünür
export const HERO_SCALE = 1.2;

// Test için ücretsiz Turbo: gökkuşağı köprüsünde bir sonraki bölgeye uçar,
// sıradaki rengi açacak kadar kristal toplar. Oyunu yayına alırken enabled: false yap.
export const TURBO = { enabled: true, time: 3.0, minSpeed: 60, maxSpeed: 430, height: 2.7, past: 25 };

export const BUS_H = 2.6;
export const DISTRICT_LEN = 1000;

// Gri Gölge karşılaşmaları: ilk karşılaşma ve sonrakiler arası mesafe
export const BOSS_FIRST = 1300;
export const BOSS_EVERY = 2300;
export const BOSS_TIME = 45; // bu sürede yenilmezse kaçar

// Bölgeler (sonsuz koşuda sırayla döner)
export const DISTRICTS = [
  {
    id: 'carsi',
    name: 'Renkli Çarşı',
    line: 'Baharat kokulu sokaklar, rengarenk tenteler… ve peşindeki dronlar.',
    boss: 'Çarşı Muhafızı',
    skyTop: 0x3d6fd6, skyBottom: 0xffc58a, sun: 0xffe2a8,
    fog: 0xe9b68f, hemiSky: 0xfff1dc, hemiGround: 0x9a6a4a,
    road: 'cobble', roadA: '#b88a66', roadB: '#9c7254', laneLine: '#fff1d6',
    walk: 0xd9b48f,
    walls: [0xe8794a, 0xf2c14e, 0x5fb7a8, 0xd6584f, 0xf0e2c4, 0x8f6fd1, 0x4f9fdc],
    accents: [0xe63946, 0xf4a261, 0x2a9d8f, 0xffd166, 0x9b5de5],
    props: 'bazaar', foes: ['crosser', 'roller'], weather: 'none', song: 0, sign: '✦ ÇARŞI ✦',
  },
  {
    id: 'sahil',
    name: 'Turkuaz Sahil',
    line: 'Martılar, palmiyeler ve griye dönmeye başlayan deniz.',
    boss: 'Dalga Muhafızı',
    skyTop: 0x1877d6, skyBottom: 0x8fdcf5, sun: 0xfff6e0,
    fog: 0x86cde6, hemiSky: 0xe3f7ff, hemiGround: 0x5d7f7a,
    road: 'board', roadA: '#b98f5f', roadB: '#a17749', laneLine: '#ffffff',
    walk: 0xe2cfa6,
    walls: [0xf4f1ea, 0x5cc8e0, 0xff8a66, 0xffc94a, 0x6fd6a0, 0xf590c8],
    accents: [0xff6b6b, 0x00b4d8, 0xffd166, 0x06d6a0, 0xff9f1c],
    props: 'coast', foes: ['diver', 'roller'], weather: 'none', song: 1, sign: '≈ SAHİL ≈',
  },
  {
    id: 'neon',
    name: 'Neon Kuleler',
    line: 'Gri Gölge burada. Kulelerin ışıkları onun elinde sönüyor.',
    boss: 'Gri Gölge',
    skyTop: 0x0b0630, skyBottom: 0x5a1a7a, sun: 0xff5ec4,
    fog: 0x2a1048, hemiSky: 0x8f6bff, hemiGround: 0x1a0b2e,
    road: 'neon', roadA: '#1c1430', roadB: '#251a3d', laneLine: '#39f3ff',
    walk: 0x2c2244,
    walls: [0x2b2450, 0x35295f, 0x1f2a4f, 0x3d2a5c, 0x262044],
    accents: [0xff3cac, 0x39f3ff, 0xfff05a, 0x7cff6b, 0xb16cff],
    props: 'neon', foes: ['diver', 'crosser'], weather: 'rain', song: 2, night: true, sign: '▼ KAY ▼',
  },
  {
    id: 'kar',
    name: 'Karlı Köy',
    line: 'Buz tutan çatılar, sessiz çamlar… ve yamaçtan yuvarlanan kar topları.',
    boss: 'Buz Muhafızı',
    skyTop: 0x5b93cf, skyBottom: 0xe6f2fc, sun: 0xffffff,
    fog: 0xdbeaf7, hemiSky: 0xffffff, hemiGround: 0x8aa6c1,
    road: 'snow', roadA: '#eef5fb', roadB: '#d3e3f0', laneLine: '#8fbbe3',
    walk: 0xf4f8fc,
    walls: [0x8b5a3c, 0xa0522d, 0x6b4226, 0xc97b4a, 0x7d5a44],
    accents: [0xe63946, 0x2a9d8f, 0xffd166, 0x457b9d, 0xf4a261],
    props: 'snow', foes: ['roller', 'diver'], weather: 'snow', song: 0, sign: '❄ KAR ❄',
  },
  {
    id: 'kapadokya',
    name: 'Peri Bacaları',
    line: 'Balonlar havalanıyor, kayalar altın gibi parlıyor.',
    boss: 'Çöl Muhafızı',
    skyTop: 0x2f7fd6, skyBottom: 0xffd8a0, sun: 0xfff0c0,
    fog: 0xf0c894, hemiSky: 0xfff0dc, hemiGround: 0xa0703a,
    road: 'sand', roadA: '#e6c08a', roadB: '#d6a86a', laneLine: '#fff3d6',
    walk: 0xd9ae78,
    walls: [0xe3b98a, 0xd9a877, 0xf0cfa0, 0xc98f5e],
    accents: [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x9b5de5, 0x264653],
    props: 'canyon', foes: ['crosser', 'roller'], weather: 'dust', song: 1, sign: '☼ ÇÖL ☼',
  },
  {
    id: 'orman',
    name: 'Gizemli Orman',
    line: 'Dev ağaçlar, ışıldayan mantarlar ve uyanan eski taşlar.',
    boss: 'Orman Muhafızı',
    skyTop: 0x2c6b5a, skyBottom: 0xc4e8b0, sun: 0xfff2b0,
    fog: 0x9fcf9a, hemiSky: 0xe6ffd8, hemiGround: 0x3d5a2a,
    road: 'dirt', roadA: '#8a6a48', roadB: '#73563a', laneLine: '#d8f0b0',
    walk: 0x5f8a3a,
    walls: [0x6b4a2f, 0x7a5636, 0x5a3d26],
    accents: [0xff5d8f, 0xffd166, 0x9bf6ff, 0xc77dff, 0xff9e00],
    props: 'forest', foes: ['diver', 'roller', 'pad'], weather: 'fireflies', song: 0, sign: '♣ ORMAN ♣',
  },
  {
    id: 'lunapark',
    name: 'Lunapark',
    line: 'Dönme dolap, pamuk şeker ve hiç durmayan vagonlar.',
    boss: 'Palyaço Muhafız',
    skyTop: 0x5566dd, skyBottom: 0xffb8dc, sun: 0xfff0f5,
    fog: 0xf3c4e0, hemiSky: 0xfff0fa, hemiGround: 0x8a5a7a,
    road: 'tiles', roadA: '#f7d6e6', roadB: '#c9e6ff', laneLine: '#ffffff',
    walk: 0xffe3f0,
    walls: [0xff6b9a, 0x6bc6ff, 0xffd166, 0x9b8cff, 0x5ee5b0],
    accents: [0xff3cac, 0x39d8ff, 0xffd23f, 0x7cff6b, 0xb16cff],
    props: 'fair', foes: ['crosser', 'diver', 'pad'], weather: 'confetti', song: 1, sign: '★ LUNAPARK ★',
  },
  {
    id: 'kale',
    name: 'Gölge Kalesi',
    line: 'Gri Gölge’nin kalesi. Fırtına kopuyor, meşaleler titriyor.',
    boss: 'Kale Muhafızı',
    skyTop: 0x15112a, skyBottom: 0x4a3a6a, sun: 0xb48cff,
    fog: 0x2e2540, hemiSky: 0x9a8acf, hemiGround: 0x1a1424,
    road: 'stone', roadA: '#4a4458', roadB: '#3a3548', laneLine: '#b48cff',
    walk: 0x3a3448,
    walls: [0x5a5468, 0x4e4860, 0x666078],
    accents: [0xb48cff, 0xff4d6d, 0xffb703, 0x39f3ff],
    props: 'castle', foes: ['crosser', 'roller', 'diver'], weather: 'rain', song: 2, night: true, sign: '✠ KALE ✠',
  },
];

// Engel/araç renkleri (bölgeye göre): gövde, şerit, çatı, direk, metal, tabela zemini
export const OB_COLORS = {
  carsi: { body: '#c62f2f', trim: '#f6e7c8', stripe: '#e76f2e', roof: '#8e2424', post: '#5b4636', metal: '#3b3b46', sign: '#7a2e1d', ramp: '#c9c2b4' },
  sahil: { body: '#1fb5c9', trim: '#f6e7c8', stripe: '#ff4d4d', roof: '#178a9a', post: '#5b4636', metal: '#3b3b46', sign: '#0077b6', ramp: '#c9c2b4' },
  neon: { body: '#5b2a86', trim: '#ff3cac', stripe: '#ff3cac', roof: '#2a1640', post: '#39f3ff', metal: '#2b2450', sign: '#160c2c', ramp: '#2b2450' },
  kar: { body: '#d62839', trim: '#ffffff', stripe: '#3a86ff', roof: '#f1f7ff', post: '#7a5236', metal: '#5c6b7a', sign: '#1d4e89', ramp: '#e8f1fa' },
  kapadokya: { body: '#b5651d', trim: '#f4e1b0', stripe: '#e76f51', roof: '#f2e3c6', post: '#6f4518', metal: '#5a4632', sign: '#9c4a1a', ramp: '#d9b07a' },
  orman: { body: '#6b8e23', trim: '#f0e6c8', stripe: '#ff9e00', roof: '#4a3520', post: '#4a3520', metal: '#3d3a32', sign: '#2d5016', ramp: '#8a6a48' },
  lunapark: { body: '#ff3c8e', trim: '#ffffff', stripe: '#39d8ff', roof: '#ffd23f', post: '#b16cff', metal: '#5b5f97', sign: '#6a3cc9', ramp: '#ffd6ea' },
  kale: { body: '#3b3550', trim: '#b48cff', stripe: '#ff4d6d', roof: '#26213a', post: '#2a2438', metal: '#55506a', sign: '#1c1730', ramp: '#4a4458' },
};

// Gökkuşağı Kulesi'nin 7 rengi: koşularda toplanan kristallerle (ömür boyu) geri gelir.
// hue: shader'da o rengin tonu (derece). need: gereken toplam kristal.
export const COLORS = [
  { id: 'kirmizi', name: 'Kırmızı', hex: '#ff3b4f', hue: 0, need: 15 },
  { id: 'turuncu', name: 'Turuncu', hex: '#ff8a2a', hue: 30, need: 40 },
  { id: 'sari', name: 'Sarı', hex: '#ffd23f', hue: 55, need: 80 },
  { id: 'yesil', name: 'Yeşil', hex: '#3ddc84', hue: 125, need: 140 },
  { id: 'mavi', name: 'Mavi', hex: '#2ec5ff', hue: 192, need: 220 },
  { id: 'lacivert', name: 'Lacivert', hex: '#4a6cff', hue: 228, need: 320 },
  { id: 'mor', name: 'Mor', hex: '#b45cff', hue: 285, need: 450 },
];

// Güçler. Süre = base + level * step
export const POWERUPS = {
  magnet: { name: 'Renk Mıknatısı', short: 'Mıknatıs', desc: 'Altınları kendine çeker.', base: 8, step: 2, color: '#ff4d6d' },
  shield: { name: 'Işık Kalkanı', short: 'Kalkan', desc: 'Bir çarpışmadan korur.', base: 10, step: 3, color: '#4cc9f0' },
  sneakers: { name: 'Gökkuşağı Ayakkabıları', short: 'Süper Zıplama', desc: 'Çok yükseğe zıplatır.', base: 8, step: 2, color: '#80ed99' },
  double: { name: 'Çifte Işıltı', short: 'x2 Puan', desc: 'Puanları ikiye katlar.', base: 10, step: 2.5, color: '#ffd166' },
};

export const BURST = {
  name: 'Renk Patlaması',
  desc: '5 kristalle dolar. Yenilmez olursun, engelleri parçalarsın; muhafızlara da bununla vurursun.',
  base: 3.2, step: 0.6, color: '#c77dff',
};

export const UPGRADE_COSTS = [250, 650, 1400, 2800, 5500];
export const MAX_UPGRADE = UPGRADE_COSTS.length;

// Görünüm: koşu izi (kozmetik)
export const TRAILS = [
  { id: 'rainbow', name: 'Gökkuşağı', cost: 0, colors: null, ico: '🌈' },
  { id: 'stars', name: 'Yıldız Tozu', cost: 1200, colors: [0xffe066, 0xfff3b0, 0xffb703], ico: '✨' },
  { id: 'pink', name: 'Pembe Rüya', cost: 2200, colors: [0xff8fd8, 0xffc2e8, 0xff4fa3], ico: '💖' },
  { id: 'neon', name: 'Neon Şerit', cost: 3500, colors: [0x39f3ff, 0xff3cac, 0x7cff6b], ico: '💠' },
  { id: 'fire', name: 'Alev İzi', cost: 5000, colors: [0xff5a1f, 0xffb703, 0xff2d55], ico: '🔥' },
];

// Görev şablonları (3'lü setler halinde; set bitince çarpan +1)
// run: tek koşuda mı, toplam mı. tiers: set seviyesine göre hedef
export const MISSION_TEMPLATES = [
  { id: 'coins_run', ico: '🪙', text: 'Tek koşuda {n} altın topla', run: true, tiers: [50, 100, 180, 280, 400, 600] },
  { id: 'coins_total', ico: '💰', text: 'Toplam {n} altın topla', run: false, tiers: [150, 400, 800, 1400, 2200, 3500] },
  { id: 'dist_run', ico: '🏃‍♀️', text: 'Tek koşuda {n} m koş', run: true, tiers: [500, 1000, 1600, 2400, 3500, 5000] },
  { id: 'score_run', ico: '⭐', text: 'Tek koşuda {n} puan yap', run: true, tiers: [4000, 10000, 22000, 45000, 80000, 140000] },
  { id: 'crystals_run', ico: '💎', text: 'Tek koşuda {n} kristal topla', run: true, tiers: [4, 8, 12, 18, 25, 35] },
  { id: 'jumps_run', ico: '⬆️', text: 'Tek koşuda {n} kez zıpla', run: true, tiers: [10, 20, 35, 50, 70, 100] },
  { id: 'slides_run', ico: '⬇️', text: 'Tek koşuda {n} kez kay', run: true, tiers: [8, 15, 25, 40, 55, 80] },
  { id: 'lanes_run', ico: '↔️', text: 'Tek koşuda {n} kez şerit değiştir', run: true, tiers: [25, 50, 90, 140, 200, 280] },
  { id: 'powerups', ico: '⚡', text: 'Toplam {n} güç topla', run: false, tiers: [2, 5, 9, 14, 20, 30] },
  { id: 'magnet_run', ico: '🧲', text: 'Mıknatısla tek koşuda {n} altın çek', run: true, tiers: [20, 40, 70, 110, 160, 220] },
  { id: 'bursts', ico: '🌈', text: 'Toplam {n} kez Renk Patlaması kullan', run: false, tiers: [1, 3, 5, 8, 12, 18] },
  { id: 'smash_run', ico: '💥', text: 'Tek koşuda {n} engel parçala', run: true, tiers: [3, 6, 10, 15, 22, 30] },
  { id: 'bus_run', ico: '🚌', text: 'Tek koşuda otobüs üstünde {n} m koş', run: true, tiers: [40, 90, 160, 250, 360, 500] },
  { id: 'boss', ico: '👾', text: 'Toplam {n} muhafız yen', run: false, tiers: [1, 1, 2, 3, 4, 6] },
  { id: 'nocoin_run', ico: '🙅‍♀️', text: 'Hiç altın almadan {n} m koş', run: true, tiers: [150, 250, 400, 550, 700, 900] },
  { id: 'clean_run', ico: '🛡️', text: 'Hiç tökezlemeden {n} m koş', run: true, tiers: [400, 800, 1300, 2000, 2800, 3800] },
];

// Günlük görev (her gün bir tane; ödülü büyük)
export const DAILY_TEMPLATES = [
  { id: 'runs', ico: '📅', text: 'Bugün {n} koşu yap', n: 5 },
  { id: 'crystals', ico: '💎', text: 'Bugün toplam {n} kristal topla', n: 30 },
  { id: 'dist', ico: '🏃‍♀️', text: 'Bugün toplam {n} m koş', n: 5000 },
  { id: 'coins', ico: '🪙', text: 'Bugün toplam {n} altın topla', n: 600 },
  { id: 'boss', ico: '👾', text: 'Bugün {n} muhafız yen', n: 1 },
  { id: 'bursts', ico: '🌈', text: 'Bugün {n} kez Renk Patlaması kullan', n: 4 },
];
export const DAILY_REWARD = { coins: 600, crystals: 5 };

// Kayma pozu (iskelet açıları, radyan)
export const SLIDE_POSE = {
  drop: 0.42, hips: 0.55, spine: -0.12, neck: -0.25, head: -0.15,
  upL: 0.95, kneeL: -0.1, upR: 0.45, kneeR: -1.3, armDown: -0.45, armBack: 0.55, elbow: 0.35,
};

// Hikâye. need: açmak için geri getirilmiş renk sayısı (0 = baştan açık)
export const STORY = [
  {
    img: 'assets/story/story1.jpg', title: 'Işıltıkent', need: 0,
    text: 'Şenay, renklerin şehri Işıltıkent\'in en sevilen tasarımcısıdır. Anneannesi şehrin son Renk Bekçisi\'ydi ve ona tek bir şey öğretti: "Renkler, onları fark edenlerle yaşar."',
  },
  {
    img: 'assets/story/story2.jpg', title: 'Gri Gölge', need: 0,
    text: 'Bir akşam gökyüzünü Gri Gölge kapladı. Dronları, şehrin kalbindeki Gökkuşağı Kulesi\'nin yedi rengini tek tek söktü. Işıltıkent birkaç saat içinde griye büründü.',
  },
  {
    img: 'assets/story/story3.jpg', title: 'Son Kıvılcım', need: 0,
    text: 'Sokakta parlayan son kıvılcım, Şenay\'ın anneannesinden kalan ayakkabılara düştü. Ayakkabılar gökkuşağı gibi parladı. Artık çalınan renkleri hissedebilen tek kişi oydu.',
  },
  {
    img: 'assets/story/story4.jpg', title: 'Koş, Şenay!', need: 0,
    text: 'Koşarken topladığın her Renk Kristali kuleye geri döner. Yedi rengi geri getir, Gri Gölge\'nin muhafızlarını Renk Patlaması ile dağıt ve şehrin ışığını yeniden yak!',
  },
  {
    img: 'assets/story/story1.jpg', title: 'Kırmızı: Çarşının Kalbi', need: 1,
    text: 'Kulenin ilk halkası kırmızıya büründü. Çarşının tenteleri, nar tezgâhları yeniden kıpkırmızı! Esnaf Şenay\'a bir şey fısıldadı: "Gri Gölge eskiden bu duvarları boyardı…"',
  },
  {
    img: 'assets/story/story6.jpg', title: 'Turuncu: Gün Batımı', need: 2,
    text: 'Gün batımı geri geldi. Şenay kulenin tepesinde dolaşan dronların bir şey aradığını fark etti: Kimse görmesin diye saklanmış eski bir tablo.',
  },
  {
    img: 'assets/story/story4.jpg', title: 'Sarı: Neşe', need: 3,
    text: 'Sokaklarda yeniden kahkahalar yükseldi. Bir dron Şenay\'ın önüne gri bir fırça düşürdü. Sapında bir isim kazınmıştı: "Rüzgâr".',
  },
  {
    img: 'assets/story/story5.jpg', title: 'Yeşil: Gölgenin Sırrı', need: 4,
    text: 'Gri Gölge aslında ressam Rüzgâr\'dı. Yıllarca şehri boyadı ama kimse resimlerine bakmadı. Kırgınlığı onu griye gömdü; renkleri, kimsenin değerini bilmediği için çaldı.',
  },
  {
    img: 'assets/story/story3.jpg', title: 'Mavi: Deniz', need: 5,
    text: 'Deniz yeniden turkuaz. Şenay anladı: Rüzgâr\'ı yenmek yetmez, onu görmek gerekir. Her koşuda kristallerin yanına, onun eski resimlerinin parçaları da düşüyor.',
  },
  {
    img: 'assets/story/story2.jpg', title: 'Lacivert: Gece', need: 6,
    text: 'Gece gökyüzü yıldızlarına kavuştu. Gri Gölge ilk kez kaçmadı; Şenay\'a uzaktan bakıp fırçasını indirdi. Geriye tek bir renk kaldı.',
  },
  {
    img: 'assets/story/story7.jpg', title: 'Mor: Işıltı Festivali', need: 7,
    text: 'Yedi renk kuleye döndü! Şenay, Rüzgâr\'ın tablolarını şehrin en büyük duvarına astı. Bütün Işıltıkent onları izlemeye geldi. Rüzgâr\'ın paltosu rengarenk oldu. Ama koşu bitmez: şehir artık her gün yeni renkler istiyor!',
  },
];
