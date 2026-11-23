// Engeller, toplanabilirler, bölüm desenleri, bitiş kapısı ve çarpışma.
// Performans: her bölgenin engelleri tek doku atlasını paylaşır (engel başına 1 çizim).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePowerPickup, animatePickup } from './pickups.js';
import { LANES, BUS_H, DISTRICTS, DISTRICT_LEN, PLAYER_W, PLAYER_DEPTH, JUMP_HEIGHT, GRAVITY, OB_COLORS } from './config.js';
import { route } from './themes.js';
import { SHAPES, FOES, foeKey } from './foes.js';
import { patchSat } from './world.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const OB_W = { barrier: 2.0, high: 2.0, bus: 2.2, ramp: 2.2, laserLow: 7.6, laserHigh: 7.6 };
const RAMP_LEN = 6.5;
const SPAWN_AHEAD = 170;
const AT = 512;

// atlas bölgeleri (piksel; y aşağı)
const RG = {
  SIDE: [0, 0, 512, 128], FRONT: [0, 128, 128, 128], ROOF: [128, 128, 64, 64], DARK: [192, 128, 64, 64],
  STRIPE: [256, 128, 256, 64], POST: [256, 192, 64, 64], METAL: [320, 192, 64, 64],
  GLOWR: [384, 192, 64, 64], GLOWC: [448, 192, 64, 64], SIGN: [0, 256, 256, 128],
  RAMP: [256, 256, 128, 256], GATE: [0, 384, 256, 128], PILLAR: [384, 256, 128, 128], GOLD: [384, 384, 64, 64],
};

function mapRegion(uvAttr, i0, i1, R, flipU = false) {
  // uv aralığını [0,1]'e normalize edip bölgeye taşı
  let mnu = Infinity; let mxu = -Infinity; let mnv = Infinity; let mxv = -Infinity;
  for (let i = i0; i < i1; i++) { const u = uvAttr.getX(i); const v = uvAttr.getY(i); mnu = Math.min(mnu, u); mxu = Math.max(mxu, u); mnv = Math.min(mnv, v); mxv = Math.max(mxv, v); }
  const du = mxu - mnu || 1; const dv = mxv - mnv || 1;
  const [x, y, w, h] = R; const pad = 1.5;
  for (let i = i0; i < i1; i++) {
    let u = (uvAttr.getX(i) - mnu) / du; const v = (uvAttr.getY(i) - mnv) / dv;
    if (flipU) u = 1 - u;
    uvAttr.setXY(i, (x + pad + u * (w - 2 * pad)) / AT, 1 - (y + pad + (1 - v) * (h - 2 * pad)) / AT);
  }
}

function prep(g) {
  const out = g.index ? g.toNonIndexed() : g;
  Object.keys(out.attributes).forEach((k) => { if (!['position', 'normal', 'uv'].includes(k)) out.deleteAttribute(k); });
  return out;
}

// kutu: yüz başına atlas bölgesi [+x, -x, +y, -y, +z, -z]
function atlasBox(w, h, d, faces, tx = 0, ty = 0, tz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) mapRegion(uv, f * 4, f * 4 + 4, faces[f]);
  g.translate(tx, ty, tz);
  return prep(g);
}

function atlasAll(geo, R) {
  const g = prep(geo);
  mapRegion(g.attributes.uv, 0, g.attributes.uv.count, R);
  return g;
}

function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Track {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.obstacles = [];
    this.coins = [];
    this.crystals = [];
    this.powers = [];
    this.cache = {};
    this.listeners = {};
    this.diff = 0;

    // altınlar (instanced)
    const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.11, 24).rotateX(Math.PI / 2);
    const coinTex = tex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
      gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.6, '#ffc93c'); gr.addColorStop(1, '#d48a00');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#b36b00'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#b36b00';
      g.beginPath();
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2; const rr = k % 2 ? 12 : 28; g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); }
      g.fill();
    });
    this.coinMesh = new THREE.InstancedMesh(coinGeo, new THREE.MeshStandardMaterial({
      map: coinTex, metalness: 0.7, roughness: 0.25, emissive: 0xffa800, emissiveIntensity: 0.35,
    }), 400);
    this.coinMesh.count = 0;
    this.coinMesh.frustumCulled = false;
    this.group.add(this.coinMesh);
    this.dummy = new THREE.Object3D();

    this.crystalGeo = new THREE.OctahedronGeometry(0.45, 0).scale(0.8, 1.25, 0.8);
    this.crystalMat = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vP = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float t; varying vec3 vN; varying vec3 vP;
        vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
        void main(){ vec3 c = hue(fract(vP.y*0.6 + vN.x*0.3 + t*0.5)); float l = 0.55 + 0.45*max(dot(vN, normalize(vec3(0.3,1.0,0.6))),0.0); gl_FragColor = vec4(c * l * 2.0 + 0.15, 1.0); }`,
    });
    // kristal halesi
    this.haloMat = new THREE.SpriteMaterial({
      map: tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }),
      color: 0xffb3ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });

    this.reset({});
  }

  on(ev, fn) { this.listeners[ev] = fn; }
  emit(ev, ...a) { if (this.listeners[ev]) this.listeners[ev](...a); }

  reset({ tutorial = false, finish = 0, diff = 0, crystalEvery = 70, noSpawn = false } = {}) {
    this.obstacles.forEach((o) => this.group.remove(o.mesh));
    (this.pads || []).forEach((p) => this.group.remove(p.mesh));
    this.pads = [];
    this.crystals.forEach((c) => this.group.remove(c.mesh));
    this.powers.forEach((p) => this.group.remove(p.mesh));
    if (this.gate) { this.group.remove(this.gate); this.gate = null; }
    this.obstacles = []; this.coins = []; this.crystals = []; this.powers = [];
    this.cursor = noSpawn ? 1e9 : 42;
    this.nextPower = rnd(200, 280);
    this.crystalEvery = crystalEvery;
    this.nextCrystal = 60;
    this.diff = diff;
    this.pauseGen = false;
    this.finish = finish;
    this.finishCoins = false;
    this.tutorial = tutorial;
    this.tutorialRows = tutorial ? this.makeTutorial() : [];
    this.hints = [];
    if (tutorial) this.cursor = 470;
    this.coinMesh.count = 0;
    if (finish > 0) this.placeGate(finish);
  }

  districtAt(d) {
    if (this.districtOverride != null) return this.districtOverride;
    return route.at(Math.max(0, d)).t;
  }

  // ---------- atlas ve geometriler (bölgeye göre) ----------
  C(di) {
    if (this.cache[di]) return this.cache[di];
    const D = DISTRICTS[di];
    const neon = D.id === 'neon';
    const sahil = D.id === 'sahil';
    const c = {};
    const OC = OB_COLORS[D.id] || OB_COLORS.carsi;
    const bodyCol = OC.body;
    const trim = OC.trim;
    const stripeCol = OC.stripe;
    const rect = (g, R, fill) => { g.fillStyle = fill; g.fillRect(R[0], R[1], R[2], R[3]); };

    const drawAtlas = (g, emissive) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, AT, AT);
      const [sx, sy, sw, sh] = RG.SIDE;
      if (!emissive) {
        rect(g, RG.SIDE, bodyCol);
        g.fillStyle = trim; g.fillRect(sx, sy + 80, sw, 12);
        for (let x = 10; x < sw; x += 64) {
          g.fillStyle = neon ? '#7ae8ff' : '#2a3f57'; g.beginPath(); g.roundRect(sx + x, sy + 16, 50, 54, 6); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(sx + x + 6, sy + 20, 8, 46);
        }
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(sx, sy + sh - 16, sw, 16);
        // ön yüz
        const [fx, fy, fw] = RG.FRONT;
        rect(g, RG.FRONT, bodyCol);
        g.fillStyle = neon ? '#7ae8ff' : '#2a3f57'; g.beginPath(); g.roundRect(fx + 10, fy + 12, fw - 20, 52, 8); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(fx + 18, fy + 16, 30, 44);
        g.fillStyle = trim; g.fillRect(fx, fy + 76, fw, 8);
        g.fillStyle = '#fff6c2'; g.beginPath(); g.arc(fx + 24, fy + 100, 11, 0, 7); g.arc(fx + 104, fy + 100, 11, 0, 7); g.fill();
        g.fillStyle = '#111'; g.fillRect(fx + 40, fy + 94, 48, 14);
        rect(g, RG.ROOF, OC.roof);
        g.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k < 4; k++) g.fillRect(RG.ROOF[0] + 6 + k * 15, RG.ROOF[1] + 4, 6, RG.ROOF[3] - 8);
        rect(g, RG.DARK, '#1b1b1f');
        // şerit
        const [tx, ty, tw, th] = RG.STRIPE;
        for (let x = -64; x < tw + 64; x += 32) {
          g.fillStyle = (x / 32) % 2 ? '#ffffff' : stripeCol;
          g.beginPath(); g.moveTo(tx + x, ty); g.lineTo(tx + x + 32, ty); g.lineTo(tx + x + 64, ty + th); g.lineTo(tx + x + 32, ty + th); g.fill();
        }
        rect(g, RG.POST, OC.post);
        rect(g, RG.METAL, OC.metal);
        rect(g, RG.GLOWR, '#ff2d55');
        rect(g, RG.GLOWC, '#fff6c2');
        // tabela
        const [gx, gy, gw, gh] = RG.SIGN;
        rect(g, RG.SIGN, OC.sign);
        g.strokeStyle = neon ? '#ff3cac' : '#ffd166'; g.lineWidth = 10; g.strokeRect(gx + 8, gy + 8, gw - 16, gh - 16);
        g.fillStyle = neon ? '#39f3ff' : '#ffffff';
        g.font = '900 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(D.sign || '▼ KAY ▼', gx + gw / 2, gy + gh / 2 + 2);
        // rampa
        const [rx, ry, rw, rh] = RG.RAMP;
        rect(g, RG.RAMP, OC.ramp);
        g.fillStyle = neon ? '#39f3ff' : '#8f877a';
        for (let y = 0; y < rh; y += 20) g.fillRect(rx, ry + y, rw, 6);
        g.fillStyle = stripeCol; g.fillRect(rx, ry, 10, rh); g.fillRect(rx + rw - 10, ry, 10, rh);
        // bitiş kapısı
        const [ax, ay, aw, ah] = RG.GATE;
        const gr = g.createLinearGradient(ax, 0, ax + aw, 0);
        ['#ff4d6d', '#ff9f1c', '#ffd166', '#5ee58a', '#39d8ff', '#9b5de5'].forEach((col, k) => gr.addColorStop(k / 5, col));
        g.fillStyle = gr; g.fillRect(ax, ay, aw, ah);
        for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#fff' : '#111'; g.fillRect(ax + k * 16, ay, 16, 16); g.fillRect(ax + aw - 128 + k * 16, ay + ah - 16, 16, 16); }
        g.fillStyle = '#fff'; g.font = '900 56px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.strokeStyle = '#1b1033'; g.lineWidth = 8; g.strokeText('BİTİŞ', ax + aw / 2, ay + ah / 2 + 4); g.fillText('BİTİŞ', ax + aw / 2, ay + ah / 2 + 4);
        const [px, py, pw, ph] = RG.PILLAR;
        for (let y = 0; y < ph; y += 16) { g.fillStyle = (y / 16) % 2 ? '#ffffff' : '#ff3cac'; g.fillRect(px, py + y, pw, 16); }
        rect(g, RG.GOLD, '#ffc93c');
      } else {
        // ışık saçan bölgeler
        if (neon) {
          g.fillStyle = '#ff3cac'; g.fillRect(sx, sy + 80, sw, 12);
          for (let x = 10; x < sw; x += 64) { g.fillStyle = '#3aa8c0'; g.fillRect(sx + x, sy + 16, 50, 54); }
          const [tx, ty, tw, th] = RG.STRIPE; g.fillStyle = '#802060'; g.fillRect(tx, ty, tw, th);
          const [gx, gy, gw, gh] = RG.SIGN; g.fillStyle = '#39f3ff'; g.font = '900 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('▼ KAY ▼', gx + gw / 2, gy + gh / 2 + 2);
          g.strokeStyle = '#ff3cac'; g.lineWidth = 10; g.strokeRect(gx + 8, gy + 8, gw - 16, gh - 16);
          const [rx, ry, rw, rh] = RG.RAMP; g.fillStyle = '#39f3ff'; for (let y = 0; y < rh; y += 20) g.fillRect(rx, ry + y, rw, 6);
          rect(g, RG.POST, '#39f3ff');
        }
        const [fx, fy] = RG.FRONT;
        g.fillStyle = '#fff6c2'; g.beginPath(); g.arc(fx + 24, fy + 100, 13, 0, 7); g.arc(fx + 104, fy + 100, 13, 0, 7); g.fill();
        rect(g, RG.GLOWR, '#ff2d55');
        rect(g, RG.GLOWC, '#fff6c2');
        const [ax, ay, aw, ah] = RG.GATE; g.globalAlpha = 0.6;
        const gr = g.createLinearGradient(ax, 0, ax + aw, 0);
        ['#ff4d6d', '#ff9f1c', '#ffd166', '#5ee58a', '#39d8ff', '#9b5de5'].forEach((col, k) => gr.addColorStop(k / 5, col));
        g.fillStyle = gr; g.fillRect(ax, ay, aw, ah); g.globalAlpha = 1;
        g.fillStyle = '#fff'; g.font = '900 56px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BİTİŞ', ax + aw / 2, ay + ah / 2 + 4);
        const [px, py, pw, ph] = RG.PILLAR; for (let y = 0; y < ph; y += 16) { g.fillStyle = (y / 16) % 2 ? '#666' : '#ff3cac'; g.fillRect(px, py + y, pw, 16); }
      }
    };
    const map = tex(AT, AT, (g) => drawAtlas(g, false));
    const emap = tex(AT, AT, (g) => drawAtlas(g, true));
    map.generateMipmaps = true;
    c.mat = patchSat(new THREE.MeshStandardMaterial({ map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: neon ? 1.6 : 1.2, roughness: 0.45, metalness: 0.15 }));
    c.matPlain = new THREE.MeshStandardMaterial({ map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.4, metalness: 0.2 }); // kapı ve lazer: hep renkli

    const P = RG;
    // bariyer
    const barrier = [
      atlasBox(2.0, 0.42, 0.14, [P.POST, P.POST, P.POST, P.POST, P.STRIPE, P.STRIPE], 0, 0.8, 0),
      atlasBox(2.0, 0.34, 0.14, [P.POST, P.POST, P.POST, P.POST, P.STRIPE, P.STRIPE], 0, 0.3, 0),
      atlasBox(0.14, 1.05, 0.14, [P.POST, P.POST, P.POST, P.POST, P.POST, P.POST], -0.88, 0.52, 0),
      atlasBox(0.14, 1.05, 0.14, [P.POST, P.POST, P.POST, P.POST, P.POST, P.POST], 0.88, 0.52, 0),
      atlasBox(0.5, 0.06, 0.5, [P.METAL, P.METAL, P.METAL, P.METAL, P.METAL, P.METAL], -0.88, 0.03, 0),
      atlasBox(0.5, 0.06, 0.5, [P.METAL, P.METAL, P.METAL, P.METAL, P.METAL, P.METAL], 0.88, 0.03, 0),
      atlasAll(new THREE.SphereGeometry(0.1, 8, 6).translate(-0.88, 1.14, 0), P.GLOWR),
      atlasAll(new THREE.SphereGeometry(0.1, 8, 6).translate(0.88, 1.14, 0), P.GLOWR),
    ];
    c.barrierGeo = mergeGeometries(barrier);
    // üst tabela
    const high = [
      atlasBox(2.1, 1.05, 0.16, [P.METAL, P.METAL, P.METAL, P.METAL, P.SIGN, P.SIGN], 0, 2.07, 0),
      atlasAll(new THREE.CylinderGeometry(0.07, 0.07, 2.8, 8).translate(-1.12, 1.4, 0), P.METAL),
      atlasAll(new THREE.CylinderGeometry(0.07, 0.07, 2.8, 8).translate(1.12, 1.4, 0), P.METAL),
      atlasBox(2.4, 0.1, 0.1, [P.METAL, P.METAL, P.METAL, P.METAL, P.METAL, P.METAL], 0, 2.64, 0),
    ];
    if (neon) high.push(atlasAll(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6).rotateZ(Math.PI / 2).translate(0, 1.5, 0), P.GLOWR));
    c.highGeo = mergeGeometries(high);
    // otobüs (uzunluğa göre)
    c.busGeos = new Map();
    c.busGeo = (len) => {
      if (c.busGeos.has(len)) return c.busGeos.get(len);
      const parts = [atlasBox(2.2, BUS_H - 0.35, len, [P.SIDE, P.SIDE, P.ROOF, P.DARK, P.FRONT, P.FRONT], 0, 0.35 + (BUS_H - 0.35) / 2, 0)];
      [-1, 1].forEach((sx) => [len / 2 - 1.6, -len / 2 + 1.6].forEach((wz) => {
        parts.push(atlasAll(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14).rotateZ(Math.PI / 2).translate(sx * 0.98, 0.42, wz), P.DARK));
      }));
      parts.push(atlasBox(1.6, 0.1, 0.3, [P.GLOWC, P.GLOWC, P.GLOWC, P.GLOWC, P.GLOWC, P.GLOWC], 0, BUS_H + 0.05, len / 2 - 0.6));
      const g = mergeGeometries(parts);
      c.busGeos.set(len, g);
      return g;
    };
    // rampa
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(RAMP_LEN, 0); shape.lineTo(RAMP_LEN, BUS_H); shape.closePath();
    c.rampGeo = atlasAll(new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-1.1, 0, RAMP_LEN / 2), P.RAMP);
    // lazerler (boss saldırısı; tüm şeritleri kaplar)
    const laser = (y) => mergeGeometries([
      atlasAll(new THREE.CylinderGeometry(0.09, 0.09, 7.6, 8).rotateZ(Math.PI / 2).translate(0, y, 0), P.GLOWR),
      atlasBox(0.3, y + 0.5, 0.3, [P.METAL, P.METAL, P.GLOWR, P.METAL, P.METAL, P.METAL], -3.95, (y + 0.5) / 2, 0),
      atlasBox(0.3, y + 0.5, 0.3, [P.METAL, P.METAL, P.GLOWR, P.METAL, P.METAL, P.METAL], 3.95, (y + 0.5) / 2, 0),
    ]);
    c.laserLowGeo = laser(0.6);
    c.laserHighGeo = laser(1.55);
    // bitiş kapısı
    c.gateGeo = mergeGeometries([
      atlasBox(0.7, 6.4, 0.7, [P.PILLAR, P.PILLAR, P.GOLD, P.GOLD, P.PILLAR, P.PILLAR], -4.7, 3.2, 0),
      atlasBox(0.7, 6.4, 0.7, [P.PILLAR, P.PILLAR, P.GOLD, P.GOLD, P.PILLAR, P.PILLAR], 4.7, 3.2, 0),
      atlasBox(10.2, 1.6, 0.5, [P.GOLD, P.GOLD, P.GOLD, P.GOLD, P.GATE, P.GATE], 0, 6.2, 0),
      atlasAll(new THREE.SphereGeometry(0.45, 12, 8).translate(-4.7, 6.8, 0), P.GOLD),
      atlasAll(new THREE.SphereGeometry(0.45, 12, 8).translate(4.7, 6.8, 0), P.GOLD),
    ]);
    // yeni dünyalar: kendi bariyer, tabela ve araç modelleri
    const S = SHAPES[D.props];
    if (S) {
      c.matV = patchSat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.08 }));
      const bar = S.barrier(); const hi = S.high();
      c.vgeo = { barrier: bar.geo, high: hi.geo };
      c.vglow = { barrier: bar.glow, high: hi.glow };
      const busCache = new Map();
      c.vbus = (len) => { if (!busCache.has(len)) busCache.set(len, S.bus(len)); return busCache.get(len); };
    }
    c.matG = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    c.foe = {};
    this.cache[di] = c;
    return c;
  }

  // düşman/rampa kaynakları (dünyaya göre görünüm)
  foeRes(di, kind) {
    const c = this.C(di);
    if (c.foe[kind]) return c.foe[kind];
    const set = FOES[kind];
    const make = set[foeKey(DISTRICTS[di])] || set.default || set[Object.keys(set)[0]];
    const r = make();
    r.mat = patchSat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide }));
    r.glowMat = c.matG;
    c.foe[kind] = r;
    return r;
  }

  addFoe(kind, lane, d, opts = {}) {
    const R = this.foeRes(this.districtAt(d), kind);
    const mesh = new THREE.Group();
    let wings = null; let inner = null;
    if (kind === 'diver') {
      mesh.add(new THREE.Mesh(R.body, R.mat));
      if (R.eyes) mesh.add(new THREE.Mesh(R.eyes, R.glowMat));
      if (R.wing) { const wl = new THREE.Mesh(R.wing, R.mat); const wr = new THREE.Mesh(R.wing, R.mat); wr.scale.x = -1; mesh.add(wl, wr); wings = [wl, wr]; }
    } else {
      inner = new THREE.Mesh(R.geo, R.mat);
      if (R.glow) inner.add(new THREE.Mesh(R.glow, R.glowMat));
      mesh.add(inner);
    }
    mesh.position.set(LANES[lane] || 0, 0, -200);
    this.group.add(mesh);
    const o = {
      type: kind, lane, d, len: 1.0, top: 1.1, bottom: 0, w: 1.3, mesh, vel: opts.vel || 0,
      prevZ: false, prevX: false, smashed: false, honked: false, foe: true, wings, inner,
      r: R.r || 0.5, ph: opts.phase ?? Math.random() * 6.28, sp: opts.sp || 1.6, y: 0,
    };
    if (kind === 'roller') { o.top = o.r * 2 + 0.05; o.w = 1.5; o.len = o.r * 2; }
    if (kind === 'crosser') { o.top = 1.15; o.w = 1.2; o.len = 1.0; o.x = 0; }
    if (kind === 'diver') { o.top = 1.95; o.bottom = 1.15; o.w = 1.3; o.len = 0.9; o.y = 4.8; }
    this.obstacles.push(o);
    return o;
  }

  updateFoe(o, z, t, dt) {
    const m = o.mesh;
    if (o.type === 'roller') {
      m.position.set(LANES[o.lane], o.r, z);
      o.inner.rotation.x += (o.vel / o.r) * dt;
    } else if (o.type === 'crosser') {
      const a = o.ph + t * o.sp;
      o.x = 2.4 * Math.sin(a);
      m.position.set(o.x, Math.abs(Math.sin(t * 9 + o.ph)) * 0.08, z);
      o.inner.rotation.y = Math.cos(a) > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else if (o.type === 'diver') {
      const f = clamp((z + 34) / 20, 0, 1);
      const e = f * f * (3 - 2 * f);
      o.y = lerp(4.8, 1.55, e);
      o.bottom = o.y - 0.4; o.top = o.y + 0.4;
      m.position.set(LANES[o.lane], o.y + Math.sin(t * 5 + o.ph) * 0.08 * (1 - e), z);
      m.rotation.x = -0.35 * e;
      if (o.wings) { const w = Math.sin(t * 16 + o.ph) * 0.65; o.wings[0].rotation.z = w; o.wings[1].rotation.z = -w; }
      if (!o.screeched && z > -34) { o.screeched = true; this.emit('screech', o); }
    }
  }

  addPad(lane, d) {
    const R = this.foeRes(this.districtAt(d), 'pad');
    const mesh = new THREE.Mesh(R.geo, R.mat);
    if (R.glow) mesh.add(new THREE.Mesh(R.glow, R.glowMat));
    mesh.position.set(LANES[lane], 0, -200);
    this.group.add(mesh);
    this.pads.push({ lane, d, mesh, used: false, sq: 0 });
  }

  // ---------- üretim ----------
  addObstacle(type, lane, d, opts = {}) {
    const c = this.C(this.districtAt(d));
    let len; let top; let bottom = 0; let geo; let mat = c.mat;
    if (type === 'barrier') { len = 0.5; top = 1.05; geo = c.barrierGeo; }
    else if (type === 'high') { len = 0.4; top = 2.8; bottom = 1.4; geo = c.highGeo; }
    else if (type === 'bus') { len = opts.len || 12; top = BUS_H; geo = c.busGeo(len); }
    else if (type === 'ramp') { len = RAMP_LEN; top = BUS_H; geo = c.rampGeo; }
    else if (type === 'laserLow') { len = 0.35; top = 0.85; geo = c.laserLowGeo; mat = c.matPlain; lane = 1; }
    else if (type === 'laserHigh') { len = 0.35; top = 2.2; bottom = 1.3; geo = c.laserHighGeo; mat = c.matPlain; lane = 1; }
    let glow = null;
    if (c.matV && (type === 'barrier' || type === 'high' || type === 'bus')) {
      const v = type === 'bus' ? c.vbus(len) : { geo: c.vgeo[type], glow: c.vglow[type] };
      geo = v.geo; glow = v.glow; mat = c.matV;
    }
    const mesh = new THREE.Mesh(geo, mat);
    if (glow) mesh.add(new THREE.Mesh(glow, c.matG));
    mesh.castShadow = type === 'bus' || type === 'high' || type === 'barrier';
    mesh.position.set(LANES[lane], 0, 0);
    if (opts.vel) mesh.rotation.y = 0;
    this.group.add(mesh);
    const o = {
      type, lane, d, len, top, bottom, w: OB_W[type], mesh, vel: opts.vel || 0,
      prevZ: false, prevX: false, smashed: false, honked: false,
    };
    this.obstacles.push(o);
    return o;
  }

  placeGate(d) {
    const c = this.C(this.districtAt(d));
    this.gate = new THREE.Mesh(c.gateGeo, c.matPlain);
    this.gate.userData.d = d;
    this.group.add(this.gate);
  }

  addCoin(lane, d, y = 0.9) { this.coins.push({ lane, x: LANES[lane], d, y, fly: false, wx: 0, wy: 0, wz: 0 }); }

  addCoinLine(lane, d0, n, spacing = 2.4, yFn = null) {
    for (let k = 0; k < n; k++) {
      const d = d0 + k * spacing;
      if (this.finish && d > this.finish + 30) break;
      this.addCoin(lane, d, yFn ? yFn(d, k) : 0.9);
    }
  }

  addCrystal(lane, d, y = 1.0) {
    const mesh = new THREE.Mesh(this.crystalGeo, this.crystalMat);
    const halo = new THREE.Sprite(this.haloMat);
    halo.scale.set(1.8, 1.8, 1);
    mesh.add(halo);
    this.group.add(mesh);
    this.crystals.push({ lane, d, y, mesh });
  }

  addPower(lane, d, kind, y = 1.25) {
    const mesh = makePowerPickup(kind);
    this.group.add(mesh);
    this.powers.push({ lane, d, y, kind, mesh, phase: Math.random() * 6 });
  }

  laneFree(lane, from, to) {
    return !this.obstacles.some((o) => (o.lane === lane || o.w > 5) && o.d + o.len / 2 > from && o.d - o.len / 2 < to);
  }

  makeTutorial() {
    const rows = [];
    rows.push({ d: 50, build: () => this.addCoinLine(1, 40, 8) });
    rows.push({ d: 95, hint: 'jump', build: () => { [0, 1, 2].forEach((l) => this.addObstacle('barrier', l, 95)); this.addCoinLine(1, 88, 6, 1.5, (d) => 0.9 + this.arc(d - 88, 9)); } });
    rows.push({ d: 150, hint: 'slide', build: () => { [0, 1, 2].forEach((l) => this.addObstacle('high', l, 150)); this.addCoinLine(1, 146, 4, 1.6, () => 0.5); } });
    rows.push({ d: 205, hint: 'lane', build: () => { this.addObstacle('bus', 1, 211, { len: 12 }); this.addObstacle('bus', 2, 211, { len: 12 }); this.addCoinLine(0, 200, 8); } });
    rows.push({ d: 265, hint: 'ramp', build: () => {
      this.addObstacle('ramp', 1, 265); this.addObstacle('bus', 1, 265 + RAMP_LEN / 2 + 7, { len: 14 });
      this.addObstacle('bus', 0, 272, { len: 14 }); this.addObstacle('bus', 2, 272, { len: 14 });
      this.addCoinLine(1, 270, 6, 2.2, () => BUS_H + 0.9);
    } });
    rows.push({ d: 330, hint: 'crystal', build: () => { [0, 1, 2, 3, 4].forEach((k) => this.addCrystal(1, 322 + k * 4)); } });
    rows.push({ d: 405, hint: 'burst', build: () => {
      [0, 1, 2].forEach((l) => this.addObstacle('barrier', l, 405));
      [0, 1, 2].forEach((l) => this.addObstacle('high', l, 425));
      [0, 2].forEach((l) => this.addObstacle('bus', l, 450, { len: 12 }));
      this.addObstacle('barrier', 1, 445);
    } });
    return rows;
  }

  arc(x, span) {
    const t = clamp(x / span, 0, 1);
    return 4 * JUMP_HEIGHT * t * (1 - t) * 0.95;
  }

  // zorluk (diff 0..1+) ve hıza göre bir satır engel/ödül üretir; bir sonraki satırın konumunu döndürür
  genRow(D, speed) {
    const t = clamp(this.diff, 0, 1.3);
    const lanes = shuffle([0, 1, 2]);
    const air = 2 * Math.sqrt(2 * GRAVITY * JUMP_HEIGHT) / GRAVITY;
    const jumpSpan = air * speed;
    const gap = Math.max(lerp(19, 11, Math.min(1, t)) + rnd(0, lerp(9, 4, Math.min(1, t))), speed * lerp(0.92, 0.6, Math.min(1, t)));
    let used = 0;
    const W = {
      single: Math.max(0.3, 3 - 2.4 * t), double: 0.8 + 2 * t, bus: 2.2, full: 0.5 + 1.4 * t,
      combo: t > 0.25 ? 2 * t : 0, moving: t > 0.35 ? 1.5 * t : 0, zigzag: t > 0.45 ? 1.4 * t : 0, coins: Math.max(0.3, 1.3 - t),
    };
    // dünyaya özel düşmanlar ve zıplama rampaları
    const foes = DISTRICTS[this.districtAt(D)].foes || [];
    W.roller = foes.includes('roller') && t > 0.12 ? 1.3 + t : 0;
    W.diver = foes.includes('diver') && t > 0.1 ? 1.3 + t : 0;
    W.crosser = foes.includes('crosser') && t > 0.08 ? 1.3 + t : 0;
    W.pad = t > 0.05 ? (foes.includes('pad') ? 1.6 : 0.9) : 0;
    let r = Math.random() * Object.values(W).reduce((a, b) => a + b, 0);
    let kind = 'coins';
    for (const [k, w] of Object.entries(W)) { if (r < w) { kind = k; break; } r -= w; }

    const arcOver = (lane, at) => this.addCoinLine(lane, at - jumpSpan / 2, 6, jumpSpan / 5, (d) => 0.9 + this.arc(d - (at - jumpSpan / 2), jumpSpan));

    if (kind === 'single' || kind === 'double') {
      const n = kind === 'single' ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const type = Math.random() < 0.55 ? 'barrier' : 'high';
        this.addObstacle(type, lanes[k], D);
        if (type === 'barrier' && Math.random() < 0.5) arcOver(lanes[k], D);
      }
      if (n === 2 && t > 0.6 && Math.random() < 0.35) {
        this.addObstacle(pick(['barrier', 'high']), lanes[2], D + 9); // kaçış şeridinde de engel
      } else {
        this.addCoinLine(lanes[n], D - 6, 6);
      }
    } else if (kind === 'bus') {
      const len = pick([10, 12, 14, 16]);
      const nb = t < 0.2 ? 1 : (Math.random() < 0.6 ? 2 : 1);
      const rampLane = Math.random() < 0.6 ? lanes[0] : -1;
      for (let k = 0; k < nb; k++) {
        const l = lanes[k];
        if (l === rampLane) {
          this.addObstacle('ramp', l, D);
          this.addObstacle('bus', l, D + RAMP_LEN / 2 + len / 2, { len });
          this.addCoinLine(l, D - RAMP_LEN / 2 + 1, Math.floor((RAMP_LEN + len) / 2.4), 2.4, (d) => {
            const into = d - (D - RAMP_LEN / 2);
            return 0.9 + (into < RAMP_LEN ? BUS_H * (into / RAMP_LEN) : BUS_H);
          });
        } else {
          this.addObstacle('bus', l, D + len / 2, { len });
        }
      }
      if (nb === 1 || rampLane >= 0) this.addCoinLine(lanes[2], D, 6);
      used = (rampLane >= 0 ? RAMP_LEN : 0) + len;
    } else if (kind === 'full') {
      const mode = t < 0.3 ? pick(['barrier', 'high']) : 'mix';
      [0, 1, 2].forEach((l) => this.addObstacle(mode === 'mix' ? pick(['barrier', 'high']) : mode, l, D));
    } else if (kind === 'combo') {
      // zıpla, hemen ardından kay
      const l = lanes[0];
      const second = D + jumpSpan * 0.85 + 5;
      this.addObstacle('barrier', l, D);
      this.addObstacle('high', l, second);
      this.addCoinLine(l, D + jumpSpan * 0.6, 3, 1.6, () => 0.6);
      const len = Math.ceil((second - D + 6) / 2) * 2;
      this.addObstacle('bus', lanes[1], D - 2 + len / 2, { len });
      if (t > 0.55) this.addObstacle('bus', lanes[2], D - 2 + len / 2, { len });
      else this.addCoinLine(lanes[2], D, 6);
      used = len - 2;
    } else if (kind === 'moving') {
      const l = lanes[0];
      if (this.laneFree(l, D - 75, D + 1)) {
        this.addObstacle('bus', l, D + 20, { len: 12, vel: rnd(7, 10) + t * 4 });
        this.addCoinLine(lanes[1], D - 4, 7);
        if (t > 0.5 && Math.random() < 0.45) this.addObstacle(pick(['barrier', 'high']), lanes[2], D);
        used = 30;
      } else {
        this.addCoinLine(lanes[1], D, 8);
      }
    } else if (kind === 'zigzag') {
      // kademeli otobüsler: iki kez şerit değiştirmek gerekir
      const [a, b2, c2] = lanes;
      this.addObstacle('bus', a, D + 7, { len: 14 });
      this.addObstacle('bus', b2, D + 26, { len: 14 });
      this.addObstacle(t > 0.7 ? 'high' : 'barrier', c2, D + 16);
      this.addCoinLine(b2, D, 5);
      this.addCoinLine(a, D + 17, 6);
      used = 34;
    } else if (kind === 'roller') {
      // şeritte sana doğru yuvarlanan: zıpla ya da kaç
      const vel = 8 + 7 * Math.min(1, t);
      this.addFoe('roller', lanes[0], D + 30, { vel });
      if (t > 0.55) this.addFoe('roller', lanes[1], D + 50, { vel: vel * 0.9 });
      this.addCoinLine(lanes[2], D, 8);
      used = 16;
    } else if (kind === 'diver') {
      // havadan dalan: kay ya da şerit değiştir
      this.addFoe('diver', lanes[0], D);
      this.addCoinLine(lanes[0], D - 6, 5, 2.2, () => 0.5);
      if (t > 0.45) this.addFoe('diver', lanes[1], D + 11);
      used = 14;
    } else if (kind === 'crosser') {
      // şeritler arasında gidip gelen: zamanla ya da üstünden zıpla
      this.addFoe('crosser', 1, D, { sp: 1.4 + t * 0.8 });
      arcOver(lanes[0], D);
      if (t > 0.6) this.addObstacle('barrier', lanes[1], D + 16);
      used = 18;
    } else if (kind === 'pad') {
      // zıplama rampası: yükseğe fırlatır, havada altın yayı; ilerideyse aracın üstüne in
      const l = lanes[0];
      this.addPad(l, D);
      const padAir = 2 * Math.sqrt(2 * GRAVITY * 5.2) / GRAVITY;
      const span = padAir * speed;
      this.addCoinLine(l, D + span * 0.1, 8, span * 0.8 / 8, (d) => { const f = clamp((d - D) / span, 0, 1); return 1.0 + 5.2 * 4 * f * (1 - f); });
      if (t > 0.3 && this.laneFree(l, D + span * 0.5, D + span * 0.5 + 16)) { this.addObstacle('bus', l, D + span * 0.55 + 7, { len: 14 }); used = span * 0.55 + 14; } else used = span;
    } else {
      const l = lanes[0];
      if (Math.random() < 0.5) this.addCoinLine(l, D, 10);
      else for (let k = 0; k < 9; k++) this.addCoin([0, 1, 2, 1][k % 4], D + k * 2.6);
    }

    // kristal ve güç yerleşimi
    if (D >= this.nextCrystal) {
      const free = shuffle([0, 1, 2]).find((l) => this.laneFree(l, D + used + 2, D + used + 8));
      if (free !== undefined) this.addCrystal(free, D + used + 5);
      this.nextCrystal = D + this.crystalEvery * rnd(0.75, 1.25);
    }
    if (D > this.nextPower) {
      const free = shuffle([0, 1, 2]).find((l) => this.laneFree(l, D + used + 9, D + used + 14));
      if (free !== undefined) this.addPower(free, D + used + 11, pick(['magnet', 'shield', 'sneakers', 'double']));
      this.nextPower = D + rnd(300, 460);
    }
    return D + used + gap;
  }

  // ---------- güncelleme ----------
  update(dt, distance, speed, player, state, t) {
    for (let k = this.tutorialRows.length - 1; k >= 0; k--) {
      const row = this.tutorialRows[k];
      if (row.d - distance < SPAWN_AHEAD) { row.build(); if (row.hint) this.hints.push({ d: row.d, hint: row.hint }); this.tutorialRows.splice(k, 1); }
    }
    for (let k = this.hints.length - 1; k >= 0; k--) {
      if (this.hints[k].d - distance < 34) { this.emit('hint', this.hints[k].hint); this.hints.splice(k, 1); }
    }
    const stopAt = this.finish ? this.finish - 45 : Infinity;
    if (!this.pauseGen) while (this.cursor < distance + SPAWN_AHEAD && this.cursor < stopAt) this.cursor = this.genRow(this.cursor, speed);
    if (this.finish && this.cursor >= stopAt && !this.finishCoins) {
      this.finishCoins = true;
      for (let k = 0; k < 3; k++) this.addCoinLine(k, this.finish - 38, 14, 2.6);
    }
    if (!this.finish) this.finishCoins = false;

    if (this.gate) {
      const z = distance - this.gate.userData.d;
      this.gate.position.z = z;
      if (z > 20) { this.group.remove(this.gate); this.gate = null; }
    }

    const px = player.x; const pf = player.feet; const ph = player.height;
    const PD = PLAYER_DEPTH / 2;
    let groundH = 0;
    let onBus = false;

    for (let k = this.obstacles.length - 1; k >= 0; k--) {
      const o = this.obstacles[k];
      if (o.vel) o.d -= o.vel * dt;
      const z = distance - o.d;
      if (z - o.len / 2 > 12) { this.group.remove(o.mesh); this.obstacles.splice(k, 1); continue; }
      o.mesh.position.z = z;
      if (o.foe && !o.smashed) this.updateFoe(o, z, t, dt);
      if (o.smashed) {
        o.mesh.position.y -= dt * 6; o.mesh.rotation.x += dt * 4; o.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 3));
        continue;
      }
      if (o.vel && !o.honked && z > -70 && z < -10) { o.honked = true; this.emit('honk', o); }

      const zNear = z + o.len / 2; const zFar = z - o.len / 2;
      const zOv = zFar < PD && zNear > -PD;
      const xOv = Math.abs(px - (o.x !== undefined ? o.x : LANES[o.lane])) < o.w / 2 + PLAYER_W / 2 - 0.05;

      if (zOv && xOv && !player.dead) {
        let hit = false;
        if (o.type === 'barrier' || o.type === 'laserLow') hit = pf < o.top - 0.15;
        else if (o.type === 'high' || o.type === 'laserHigh') hit = pf + ph > o.bottom;
        else if (o.type === 'roller' || o.type === 'crosser') hit = pf < o.top - 0.15;
        else if (o.type === 'diver') hit = pf + ph > o.bottom && pf < o.top;
        else if (o.type === 'bus') hit = pf < o.top - 0.4;
        else if (o.type === 'ramp') hit = pf < o.top * clamp(zNear / o.len, 0, 1) - 0.7;
        if (hit) {
          if (state.burst > 0 && o.type !== 'ramp') this.smash(o);
          else if (o.type === 'ramp' || (o.prevZ && !o.prevX)) this.emit('sidehit', o);
          else if (!o.prevZ) this.emit('crash', o);
        }
      }

      if (!o.smashed && (o.type === 'bus' || o.type === 'ramp')) {
        const xs = Math.abs(px - LANES[o.lane]) < o.w / 2 + 0.05;
        if (xs && zFar < 0.05 && zNear > -0.05) {
          const top = o.type === 'bus' ? o.top : o.top * clamp(zNear / o.len, 0, 1);
          if (pf >= top - (o.type === 'ramp' ? 0.9 : 0.45) && top > groundH) { groundH = top; onBus = o.type === 'bus'; }
        }
      }
      o.prevZ = zOv; o.prevX = xOv;
    }

    // altınlar
    const mag = state.magnet > 0 || state.burst > 0;
    const py = player.y + 0.9;
    let n = 0;
    const m = this.coinMesh; const dm = this.dummy;
    for (let k = this.coins.length - 1; k >= 0; k--) {
      const c = this.coins[k];
      let x; let y; let z;
      if (c.fly) {
        const f = Math.min(1, dt * 14);
        c.wx += (px - c.wx) * f; c.wy += (py - c.wy) * f; c.wz += (0 - c.wz) * f;
        x = c.wx; y = c.wy; z = c.wz;
      } else {
        z = distance - c.d; x = c.x; y = c.y;
        if (z > 6) { this.coins.splice(k, 1); continue; }
        if (mag && z > -16 && z < 1) { c.fly = true; c.wx = x; c.wy = y; c.wz = z; }
      }
      if (Math.abs(x - px) < 0.85 && Math.abs(z) < 0.8 && Math.abs(y - py) < 1.25 && !player.dead) {
        this.coins.splice(k, 1);
        this.emit('coin', x, y, z, c.fly);
        continue;
      }
      if (n < 400 && z > -190) {
        dm.position.set(x, y, z);
        dm.rotation.set(0, t * 3 + c.d * 0.3, 0);
        dm.updateMatrix();
        m.setMatrixAt(n++, dm.matrix);
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;

    this.crystalMat.uniforms.t.value = t;
    for (let k = this.crystals.length - 1; k >= 0; k--) {
      const c = this.crystals[k];
      const z = distance - c.d;
      if (z > 6) { this.group.remove(c.mesh); this.crystals.splice(k, 1); continue; }
      c.mesh.position.set(LANES[c.lane], c.y + Math.sin(t * 3 + c.d) * 0.15, z);
      c.mesh.rotation.y = t * 2;
      if (Math.abs(LANES[c.lane] - px) < 0.95 && Math.abs(z) < 0.9 && Math.abs(c.y - py) < 1.4 && !player.dead) {
        this.group.remove(c.mesh); this.crystals.splice(k, 1);
        this.emit('crystal', LANES[c.lane], c.y, z);
      }
    }

    for (let k = this.powers.length - 1; k >= 0; k--) {
      const p = this.powers[k];
      const z = distance - p.d;
      if (z > 6) { this.group.remove(p.mesh); this.powers.splice(k, 1); continue; }
      p.mesh.position.set(LANES[p.lane], p.y + Math.sin(t * 2.5 + p.phase) * 0.16, z);
      animatePickup(p.mesh, t, p.phase);
      if (Math.abs(LANES[p.lane] - px) < 1.0 && Math.abs(z) < 1.0 && Math.abs(p.y - py) < 1.6 && !player.dead) {
        this.group.remove(p.mesh); this.powers.splice(k, 1);
        this.emit('power', p.kind, LANES[p.lane], p.y, z);
      }
    }

    for (let k = this.pads.length - 1; k >= 0; k--) {
      const p = this.pads[k];
      const z = distance - p.d;
      if (z > 10) { this.group.remove(p.mesh); this.pads.splice(k, 1); continue; }
      p.mesh.position.z = z;
      if (p.sq > 0) { p.sq = Math.max(0, p.sq - dt); p.mesh.scale.y = 1 - Math.sin((p.sq / 0.3) * Math.PI) * 0.5; }
      if (!p.used && !player.dead && Math.abs(LANES[p.lane] - px) < 0.95 && Math.abs(z) < 0.9 && player.y < 0.9) {
        p.used = true; p.sq = 0.3; this.emit('pad', p);
      }
    }

    return { groundH, onBus };
  }

  smash(o) {
    o.smashed = true;
    this.emit('smash', o);
  }

  clearAhead(distance, range) {
    this.obstacles.forEach((o) => {
      const z = distance - o.d;
      if (z > -range && z < 8 && !o.smashed) o.smashed = true;
    });
  }
}
