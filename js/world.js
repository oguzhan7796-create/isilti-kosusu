// Şehir: bölge bölge oluşturulan sonsuz cadde, gökyüzü, ışıklar ve "renk çalma" efekti.
// Performans: her parça (chunk) malzemeye göre tek geometride birleştirilir (parça başına ~6 çizim).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DISTRICTS, DISTRICT_LEN } from './config.js';
import { paintRoad, paintFacade, paintShop, buildStyle, skylineParts } from './styles.js';
import { route, VARIANTS } from './themes.js';

const GROUND = { snow: 0xf4f8fc, canyon: 0xd9ae78, forest: 0x4f7a32, fair: 0xbfe8a0, castle: 0x26213a };

// Renk sistemi: Gökkuşağı Kulesi'nin 7 tonu ayrı ayrı geri gelir.
// uBands[i] = o tonun canlılığı (0..1); uRunSat = koşu içi taban canlılık (patlamada 1)
export const colorUniforms = {
  uBands: { value: [0, 0, 0, 0, 0, 0, 0] },
  uRunSat: { value: 0.45 },
};

export const COLOR_GLSL = `
uniform float uBands[7];
uniform float uRunSat;
vec3 isiltiHsv(vec3 c){ vec4 K = vec4(0., -1./3., 2./3., -1.); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x); }
float isiltiBand(float h){
  float cs[7] = float[7](0.0, 30.0, 55.0, 125.0, 192.0, 228.0, 285.0);
  float w = 0.0; float tot = 0.0;
  for (int i = 0; i < 7; i++) { float d = abs(h - cs[i]); d = min(d, 360.0 - d); float k = exp(-d * d / 700.0); w += k * uBands[i]; tot += k; }
  return w / max(tot, 1e-4);
}
vec3 isiltiColor(vec3 c){
  float keep = max(uRunSat, isiltiBand(isiltiHsv(c).x * 360.0));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return mix(vec3(l) * vec3(0.84, 0.86, 0.95), c, keep);
}`;

// Çevre malzemelerini renk sistemine bağlar
export function patchSat(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBands = colorUniforms.uBands;
    shader.uniforms.uRunSat = colorUniforms.uRunSat;
    shader.fragmentShader = COLOR_GLSL + '\n' + shader.fragmentShader.replace(
      '#include <fog_fragment>',
      `#include <fog_fragment>
      gl_FragColor.rgb = isiltiColor(gl_FragColor.rgb);`,
    );
  };
  mat.customProgramCacheKey = () => 'isilti-' + mat.type;
  return mat;
}

const CHUNK = 30;
const AHEAD = 230;
const _C = new THREE.Color();
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const S = new THREE.Vector3(1, 1, 1);

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Birleştirme için standart hale getirilmiş geometri (indekssiz, uv + color)
function prep(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  Object.keys(g.attributes).forEach((k) => { if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); });
  return g;
}

function colorize(g, hex, mul = 1) {
  const c = new THREE.Color(hex).multiplyScalar(mul);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

class Batch {
  constructor() { this.parts = {}; }
  // proto: prep() edilmiş geometri; konum/dönüş/ölçek ve renk ile kopyalanır
  add(key, proto, x, y, z, color, { ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1, mul = 1 } = {}) {
    const g = proto.clone();
    E.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(E); V.set(x, y, z); S.set(sx, sy, sz);
    M.compose(V, Q, S);
    g.applyMatrix4(M);
    colorize(g, color, mul);
    (this.parts[key] || (this.parts[key] = [])).push(g);
  }
  build() {
    const out = {};
    Object.entries(this.parts).forEach(([k, arr]) => {
      out[k] = mergeGeometries(arr);
      arr.forEach((g) => g.dispose());
    });
    return out;
  }
}

export class World {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.chunks = [];
    this.res = {};
    this.root = new THREE.Group();
    scene.add(this.root);
    this.district = 0;
    this.time = 0;
    this.protos = this.makeProtos();

    // Gökyüzü
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
        sunCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(-0.3, 0.22, -1).normalize() },
        uBands: colorUniforms.uBands, uRunSat: colorUniforms.uRunSat, stars: { value: 0 },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; uniform vec3 sunCol; uniform vec3 sunDir; uniform float stars;
        ${COLOR_GLSL}
        varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y * 1.6 + 0.12, 0.0, 1.0);
          vec3 col = mix(bottom, top, pow(h, 0.75));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunCol * (pow(s, 220.0) * 2.0 + pow(s, 10.0) * 0.28);
          if (stars > 0.0) {
            float st = step(0.9965, hash(floor(d * 220.0)));
            col += vec3(st) * stars * smoothstep(0.1, 0.5, d.y);
          }
          gl_FragColor = vec4(isiltiColor(col), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), this.skyMat);
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    scene.fog = new THREE.Fog(0xffffff, 60, 235);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.7);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.3);
    this.sun.position.set(-9, 18, 6);
    this.sun.target.position.set(0, 0, -14);
    scene.add(this.sun, this.sun.target);
    this.setShadows(quality === 'high');

    this.cur = {
      top: new THREE.Color(), bottom: new THREE.Color(), sun: new THREE.Color(), fog: new THREE.Color(),
      hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), stars: 0, sunI: 2.3, hemiI: 1.7,
    };
    this.tgt = {
      top: new THREE.Color(), bottom: new THREE.Color(), sun: new THREE.Color(), fog: new THREE.Color(),
      hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), stars: 0, sunI: 2.3, hemiI: 1.7,
    };
    this.white = new THREE.Color(0xffffff);

    this.buildSkylines();
    this.buildSkyDecor();
    this.setDistrict(0, true);
  }

  setShadows(on) {
    this.sun.castShadow = on;
    if (on) {
      const s = this.sun.shadow;
      s.mapSize.set(1024, 1024);
      s.camera.left = -16; s.camera.right = 16; s.camera.top = 30; s.camera.bottom = -14;
      s.camera.near = 1; s.camera.far = 70;
      s.bias = -0.0008; s.normalBias = 0.03;
      s.camera.updateProjectionMatrix();
    }
  }

  // i: dünya, v: hâl (gündüz, gün batımı, gece, sis, fırtına), weather: hava efekti
  setDistrict(i, instant = false, v = 0, weather = null) {
    this.district = i;
    this.variant = v;
    const d = DISTRICTS[i];
    const V = VARIANTS[v] ? VARIANTS[v].id : 'gun';
    const t = this.tgt;
    const C = (hex) => _C.setHex(hex);
    t.top.setHex(d.skyTop); t.bottom.setHex(d.skyBottom); t.sun.setHex(d.sun); t.fog.setHex(d.fog);
    t.hemiSky.setHex(d.hemiSky); t.hemiGround.setHex(d.hemiGround);
    const night = !!d.night;
    t.stars = night ? 1 : 0;
    t.sunI = night ? 0.7 : 2.4;
    t.hemiI = night ? 1.3 : 1.35;
    t.fogNear = 60; t.fogFar = 235;
    if (V === 'aksam') {
      t.top.lerp(C(0x3b2a6e), 0.55); t.bottom.lerp(C(0xff8a50), 0.7); t.sun.setHex(0xffb070);
      t.fog.lerp(C(0xf09a6a), 0.5); t.hemiSky.lerp(C(0xffc090), 0.45); t.sunI = night ? 1.0 : 1.7;
    } else if (V === 'gece') {
      t.top.setHex(0x050822); t.bottom.lerp(C(0x1a1040), 0.8); t.fog.lerp(C(0x15112e), 0.82); t.sun.setHex(0x9ab0ff);
      t.hemiSky.lerp(C(0x6a78d8), 0.6); t.hemiGround.lerp(C(0x101020), 0.6); t.stars = 1; t.sunI = 0.55; t.hemiI = 1.2;
    } else if (V === 'sis') {
      t.fog.lerp(C(0xe6edf2), night ? 0.25 : 0.55); t.top.lerp(t.fog, 0.55); t.bottom.copy(t.fog);
      t.fogNear = 18; t.fogFar = 130; t.sunI *= 0.75;
    } else if (V === 'firtina') {
      t.top.lerp(C(0x23283a), 0.75); t.bottom.lerp(C(0x5a6070), 0.65); t.fog.lerp(C(0x4a5064), 0.65);
      t.sun.lerp(C(0xaab4cc), 0.6); t.sunI *= 0.45; t.hemiI *= 0.85; t.fogNear = 35; t.fogFar = 170;
    }
    this.storm = V === 'firtina' || d.props === 'castle';
    if (instant) {
      ['top', 'bottom', 'sun', 'fog', 'hemiSky', 'hemiGround'].forEach((k) => this.cur[k].copy(t[k]));
      this.cur.stars = t.stars; this.cur.sunI = t.sunI; this.cur.hemiI = t.hemiI;
      this.scene.fog.near = t.fogNear; this.scene.fog.far = t.fogFar;
    }
    this.skylines.forEach((g, k) => { g.visible = k === i; });
    if (this.clouds) this.clouds.visible = !night && V !== 'gece' && V !== 'sis';
    this.setWeather(weather ?? d.weather);
    this.applyColors();
  }

  // ---------- hava: kar, tipi, yağmur, ateş böceği, konfeti, toz ----------
  makeWeather() {
    const N = 650;
    const pos = new Float32Array(N * 3); const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = rnd(-24, 24); pos[i * 3 + 1] = rnd(0, 22); pos[i * 3 + 2] = rnd(-70, 8); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 1; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dot = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 1, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
    })();
    const mat = new THREE.PointsMaterial({ size: 0.25, map: dot, vertexColors: true, transparent: true, depthWrite: false, fog: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 4;
    this.scene.add(pts);
    // yağmur: çizgi parçaları
    const RN = 420; const rp = new Float32Array(RN * 6);
    for (let i = 0; i < RN; i++) { const x = rnd(-24, 24); const y = rnd(0, 22); const z = rnd(-60, 8); rp.set([x, y, z, x + 0.05, y + 0.7, z + 0.25], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.45, fog: false }));
    rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 4;
    this.scene.add(rain);
    this.wx = { pts, rain, kind: 'none', N, RN, t: 0 };
  }

  setWeather(kind) {
    if (!this.wx) this.makeWeather();
    const W = this.wx;
    if (W.kind === kind) return;
    W.kind = kind;
    const m = W.pts.material; const col = W.pts.geometry.attributes.color;
    W.pts.visible = ['snow', 'blizzard', 'fireflies', 'confetti', 'dust'].includes(kind);
    W.rain.visible = kind === 'rain';
    m.blending = kind === 'fireflies' ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.size = { snow: 0.28, blizzard: 0.22, fireflies: 0.32, confetti: 0.26, dust: 0.35 }[kind] || 0.25;
    m.opacity = kind === 'dust' ? 0.35 : 1;
    const palette = { snow: [0xffffff], blizzard: [0xffffff], fireflies: [0xd8ff6a, 0xfff07a], confetti: [0xff3cac, 0x39d8ff, 0xffd23f, 0x7cff6b, 0xb16cff], dust: [0xf0d8b0] }[kind] || [0xffffff];
    for (let i = 0; i < W.N; i++) { _C.setHex(palette[i % palette.length]); col.setXYZ(i, _C.r, _C.g, _C.b); }
    col.needsUpdate = true;
    m.needsUpdate = true;
  }

  updateWeather(dt, speed, camera) {
    const W = this.wx; if (!W || W.kind === 'none') return;
    W.t += dt;
    const cx = camera.position.x;
    if (W.rain.visible) {
      const a = W.rain.geometry.attributes.position;
      for (let i = 0; i < W.RN; i++) {
        let y = a.getY(i * 2) - 26 * dt; let z = a.getZ(i * 2) + speed * dt; let x = a.getX(i * 2);
        if (y < 0) y += 22;
        if (z > 8) z -= 68;
        if (x < cx - 24) x += 48; else if (x > cx + 24) x -= 48;
        a.setXYZ(i * 2, x, y, z); a.setXYZ(i * 2 + 1, x + 0.05, y + 0.7, z + 0.25);
      }
      a.needsUpdate = true;
      return;
    }
    const a = W.pts.geometry.attributes.position;
    const k = W.kind;
    const vy = { snow: -2.2, blizzard: -5, fireflies: 0, confetti: -1.6, dust: -0.2 }[k];
    const vx = { blizzard: 7, dust: 4 }[k] || 0;
    for (let i = 0; i < W.N; i++) {
      let x = a.getX(i); let y = a.getY(i); let z = a.getZ(i);
      const ph = i * 1.7;
      if (k === 'fireflies') { x += Math.sin(W.t * 0.9 + ph) * dt * 0.8; y += Math.cos(W.t * 1.1 + ph) * dt * 0.6; if (y < 0.3) y = 0.3 + rnd(0, 4); if (y > 7) y = rnd(0.5, 5); }
      else { x += (vx + Math.sin(W.t * 1.5 + ph) * (k === 'confetti' ? 1.2 : 0.5)) * dt; y += vy * dt; if (y < 0) y += 22; }
      z += speed * dt;
      if (z > 8) z -= 78;
      if (x < cx - 24) x += 48; else if (x > cx + 24) x -= 48;
      a.setXYZ(i, x, y, z);
    }
    a.needsUpdate = true;
  }

  applyColors() {
    const c = this.cur;
    this.skyMat.uniforms.top.value.copy(c.top);
    this.skyMat.uniforms.bottom.value.copy(c.bottom);
    this.skyMat.uniforms.sunCol.value.copy(c.sun);
    this.skyMat.uniforms.stars.value = c.stars;
    this.scene.fog.color.copy(c.fog);
    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);
    this.hemi.intensity = c.hemiI;
    this.sun.intensity = c.sunI;
    this.sun.color.copy(c.sun).lerp(this.white, 0.5);
  }

  // ---------- ortak prototip geometriler ----------
  makeProtos() {
    const p = {};
    p.box = prep(new THREE.BoxGeometry(1, 1, 1));
    p.boxB = prep(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)); // tabanı y=0
    p.cyl = prep(new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0));
    p.cone3 = prep(new THREE.ConeGeometry(0.22, 0.5, 3).rotateZ(Math.PI));
    p.sphere = prep(new THREE.SphereGeometry(0.5, 10, 8));
    p.dome = prep(new THREE.SphereGeometry(0.5, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2));
    p.plane = prep(new THREE.PlaneGeometry(1, 1));
    p.leaf = prep(new THREE.ConeGeometry(0.35, 2.6, 4).rotateZ(-Math.PI / 2 + 0.5).translate(1.2, -0.2, 0));
    p.umbrella = prep(new THREE.ConeGeometry(1.4, 0.6, 8, 1, true));
    p.torus = prep(new THREE.TorusGeometry(5.5, 0.07, 6, 48).rotateY(Math.PI / 2));
    p.bCache = new Map();
    return p;
  }

  // bina: cephe dokusu kat/pencere ölçüsünde tekrar eder, çatı düz renk alır
  buildingProto(w, h, d) {
    const key = `${w}|${h}|${d}`;
    const c = this.protos.bCache;
    if (c.has(key)) return c.get(key);
    const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      const [fw, fh] = dims[f];
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        if (f === 2 || f === 3) { uv.setXY(i, 0.02, 0.97); continue; } // çatı: duvar rengi pikseli
        uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(fw / 4)), uv.getY(i) * Math.max(1, Math.round(fh / 3.2)));
      }
    }
    const out = prep(g);
    c.set(key, out);
    return out;
  }

  // ---------- bölge kaynakları ----------
  R(i) {
    if (this.res[i]) return this.res[i];
    const D = DISTRICTS[i];
    const r = {};
    const neon = D.id === 'neon';

    const roadTex = canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = D.roadA; g.fillRect(0, 0, w, h);
      if (paintRoad(g, w, h, D)) { /* yeni dünya yolu */ } else if (D.road === 'cobble') {
        for (let y = 0; y < h; y += 16) {
          const off = (y / 16) % 2 ? 8 : 0;
          for (let x = -16 + off; x < w; x += 20) {
            g.fillStyle = Math.random() < 0.5 ? D.roadA : D.roadB;
            g.globalAlpha = 0.6 + Math.random() * 0.4;
            g.beginPath(); g.roundRect(x + 1, y + 1, 18, 14, 4); g.fill();
          }
        }
        g.globalAlpha = 1;
      } else if (D.road === 'board') {
        for (let y = 0; y < h; y += 22) {
          g.fillStyle = Math.random() < 0.5 ? D.roadA : D.roadB; g.fillRect(0, y, w, 20);
          g.fillStyle = 'rgba(70,45,20,0.35)'; g.fillRect(0, y + 20, w, 2);
        }
      } else {
        g.fillStyle = D.roadB;
        for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 1);
        for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 1, h);
      }
      g.fillStyle = D.laneLine;
      [(4.2 - 1.2) / 8.4, (4.2 + 1.2) / 8.4].forEach((u) => {
        for (let y = 0; y < h; y += 64) g.fillRect(u * w - 3, y, 6, 34);
      });
      g.globalAlpha = 0.9; g.fillRect(4, 0, 5, h); g.fillRect(w - 9, 0, 5, h); g.globalAlpha = 1;
    });
    roadTex.repeat.set(1, CHUNK / 16.8);
    r.road = patchSat(new THREE.MeshStandardMaterial({
      map: roadTex, roughness: neon ? 0.35 : 0.9, metalness: neon ? 0.3 : 0,
      emissive: neon ? 0xffffff : 0x000000, emissiveMap: neon ? roadTex : null, emissiveIntensity: neon ? 0.35 : 0,
    }));
    r.roadGeo = new THREE.PlaneGeometry(8.4, CHUNK).rotateX(-Math.PI / 2).translate(0, 0, -CHUNK / 2);

    // cephe (üst katlar)
    const facade = canvasTex(256, 205, (g, w, h) => {
      if (paintFacade(g, w, h, D)) return;
      g.fillStyle = neon ? '#2a2f4a' : '#f4efe6'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, h - 10, w, 10);
      for (let k = 0; k < 2; k++) {
        const x = 34 + k * 128; const y = 44; const ww = 60; const wh = neon ? 120 : 96;
        if (neon) {
          g.fillStyle = '#0b0f22'; g.fillRect(x - 10, y - 20, ww + 20, wh + 20);
        } else if (D.id === 'carsi') {
          g.fillStyle = '#6b3f2a'; g.beginPath(); g.roundRect(x - 6, y - 6, ww + 12, wh + 12, [30, 30, 2, 2]); g.fill();
          g.fillStyle = '#26354f'; g.beginPath(); g.roundRect(x, y, ww, wh, [26, 26, 0, 0]); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 6, y + 20, 10, wh - 26);
          g.fillStyle = '#8a5a3a'; g.fillRect(x - 10, y + wh + 4, ww + 20, 8);
          g.fillStyle = '#e9573f'; for (let f = 0; f < 4; f++) { g.beginPath(); g.arc(x + 8 + f * 15, y + wh + 2, 5, 0, 7); g.fill(); }
        } else {
          g.fillStyle = '#2f7fbf'; g.fillRect(x - 16, y, 12, wh); g.fillRect(x + ww + 4, y, 12, wh);
          g.fillStyle = '#1c3550'; g.fillRect(x, y, ww, wh);
          g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 6, y + 6, 12, wh - 12);
          g.fillStyle = '#ffffff'; g.fillRect(x - 4, y + wh, ww + 8, 6);
        }
      }
    });
    let lit = null;
    if (neon) {
      lit = canvasTex(256, 205, (g, w, h) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        const cols = ['#ffd27a', '#7ae8ff', '#ff8fd8', '#ffffff'];
        for (let k = 0; k < 2; k++) if (Math.random() < 0.8) { g.fillStyle = pick(cols); g.fillRect(36 + k * 128, 26, 56, 116); }
      });
    }
    r.wall = patchSat(new THREE.MeshStandardMaterial({
      map: facade, vertexColors: true, roughness: neon ? 0.4 : 0.85, metalness: neon ? 0.2 : 0,
      emissive: neon ? 0xffffff : 0x000000, emissiveMap: lit, emissiveIntensity: neon ? 1.3 : 0,
    }));

    // zemin kat dükkânları (4 m genişlik, 3.2 m yükseklik)
    const shopTex = canvasTex(256, 205, (g, w, h) => {
      if (paintShop(g, w, h, D)) return;
      g.fillStyle = neon ? '#1a1530' : '#efe6d6'; g.fillRect(0, 0, w, h);
      // tabela bandı
      g.fillStyle = neon ? '#ff3cac' : '#ffffff'; g.fillRect(0, 8, w, 36);
      g.fillStyle = neon ? '#0b0f22' : 'rgba(0,0,0,0.25)';
      for (let x = 18; x < w - 18; x += 22) g.fillRect(x, 20, 12, 12);
      // vitrin
      g.fillStyle = neon ? '#7ae8ff' : '#2a4a6a'; g.fillRect(14, 60, 130, 120);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(22, 66, 18, 108);
      if (!neon) { // vitrindeki ürünler
        ['#ffb703', '#e63946', '#2a9d8f', '#f4a261', '#8ecae6'].forEach((c, k) => { g.fillStyle = c; g.beginPath(); g.arc(40 + k * 22, 160, 9, 0, 7); g.fill(); });
      }
      // kapı
      g.fillStyle = neon ? '#2b2450' : '#6b3f2a'; g.fillRect(166, 64, 66, 141);
      g.fillStyle = neon ? '#39f3ff' : '#d9a441'; g.fillRect(220, 132, 6, 14);
    });
    r.shop = patchSat(new THREE.MeshStandardMaterial({
      map: shopTex, vertexColors: true, roughness: 0.6,
      emissive: neon ? 0xffffff : 0, emissiveMap: neon ? shopTex : null, emissiveIntensity: neon ? 0.55 : 0,
    }));

    r.plain = patchSat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    r.glow = patchSat(new THREE.MeshBasicMaterial({ vertexColors: true }));
    const stripes = canvasTex(128, 64, (g, w, h) => {
      for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16) % 2 ? '#ffffff' : '#c9c9c9'; g.fillRect(x, 0, 16, h); }
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, h - 8, w, 8);
    });
    r.awning = patchSat(new THREE.MeshStandardMaterial({ map: stripes, vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));

    if (D.props === 'coast') {
      const water = canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = '#19b6c9'; g.fillRect(0, 0, w, h);
        for (let k = 0; k < 140; k++) {
          g.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.35})`; g.lineWidth = 2;
          const x = Math.random() * w; const y = Math.random() * h; const l = 10 + Math.random() * 26;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 4, x + l, y); g.stroke();
        }
      });
      water.repeat.set(10, 2);
      r.water = water;
      r.sea = patchSat(new THREE.MeshStandardMaterial({ map: water, color: 0x9ff3ff, roughness: 0.12, metalness: 0.25 }));
      r.seaGeo = new THREE.PlaneGeometry(200, CHUNK).rotateX(-Math.PI / 2).translate(108, -0.3, -CHUNK / 2);
    }
    this.res[i] = r;
    return r;
  }

  // ---------- parça varyantı üretimi (yüklemede) ----------
  buildVariant(di) {
    const D = DISTRICTS[di];
    this.R(di);
    const P = this.protos;
    const b = new Batch();
    const neon = D.props === 'neon';
    const coast = D.props === 'coast';
    const bazaar = D.props === 'bazaar';

    // kaldırımlar, bordürler, zemin
    [-1, 1].forEach((s) => {
      b.add('plain', P.boxB, s * 6.0, 0, -CHUNK / 2, D.walk, { sx: 3.4, sy: 0.22, sz: CHUNK });
      if (neon) b.add('glow', P.boxB, s * 4.3, 0, -CHUNK / 2, 0x39f3ff, { sx: 0.18, sy: 0.24, sz: CHUNK, mul: 1.8 });
      else b.add('plain', P.boxB, s * 4.3, 0, -CHUNK / 2, 0xeae2d6, { sx: 0.22, sy: 0.26, sz: CHUNK });
    });
    const groundCol = GROUND[D.props] ?? (neon ? 0x15102a : coast ? 0xe9d7a8 : 0xc9a27e);
    b.add('plain', P.plane, -110 - 7.7, -0.02, -CHUNK / 2, groundCol, { rx: -Math.PI / 2, sx: 220, sy: CHUNK });
    if (!coast) b.add('plain', P.plane, 110 + 7.7, -0.02, -CHUNK / 2, groundCol, { rx: -Math.PI / 2, sx: 220, sy: CHUNK });

    // binalar
    const styled = buildStyle(b, P, D, {
      CHUNK, prep,
      bproto: (w, h, d) => this.buildingProto(w, h, d),
      shopPlane: (depth) => {
        const tiles = Math.floor((depth - 0.6) / 4);
        const geo = P.plane.clone(); const uv = geo.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * Math.max(1, tiles));
        return { geo, w: tiles >= 1 ? tiles * 4 : depth - 0.8 };
      },
    });
    const sides = styled ? [] : coast ? [-1] : [-1, 1];
    sides.forEach((s) => {
      let z = -rnd(0.4, 2);
      while (z > -CHUNK + 3.6) {
        // bina parça sınırını aşmasın: komşu parçadaki binayla aynı yüzeyde üst üste binip titreşmesin
        const room = z + CHUNK - 0.6;
        const depth = Math.min(pick(neon ? [8, 10, 12] : [6, 7, 8, 9]), Math.floor(room * 2) / 2);
        const width = pick([7, 9, 11]);
        const h = neon ? pick([16, 22.4, 28.8, 35.2, 44.8]) : coast ? pick([6.4, 9.6, 9.6, 12.8]) : pick([6.4, 9.6, 12.8, 12.8, 16]);
        const cz = z - depth / 2;
        const wallCol = pick(D.walls);
        const bx = s * (7.8 + width / 2);
        b.add('wall', this.buildingProto(width, h, depth), bx, 0, cz, wallCol);
        // çatı kenarı / korniş
        b.add('plain', P.boxB, bx, h, cz, neon ? 0x141024 : 0xf4efe6, { sx: width + 0.4, sy: 0.35, sz: depth + 0.4, mul: neon ? 1 : 0.92 });
        // zemin kat dükkânı (yola bakan yüz)
        const tiles = Math.floor((depth - 0.6) / 4);
        const shopW = tiles >= 1 ? tiles * 4 : depth - 0.8;
        const shop = P.plane.clone();
        const uv = shop.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * Math.max(1, tiles));
        b.add('shop', shop, s * 7.78, 1.6 + 0.22, cz, pick(D.accents), { ry: s > 0 ? -Math.PI / 2 : Math.PI / 2, sx: shopW, sy: 3.2, mul: 1 });
        shop.dispose();

        if (bazaar && Math.random() < 0.9) {
          b.add('awning', P.plane, s * 7.05, 3.25, cz, pick(D.accents), { ry: s > 0 ? -Math.PI / 2 : Math.PI / 2, rx: -0.95, sx: depth - 0.8, sy: 1.7 });
          if (Math.random() < 0.55) {
            const cx = s * 6.5; const czz = cz + rnd(-1.5, 1.5);
            b.add('plain', P.boxB, cx, 0.22, czz, 0x9b6a3f, { sx: 1.2, sy: 0.7, sz: 0.9 });
            [0xff7b00, 0xe63946, 0x80b918, 0xffd166].forEach((fc, k) => b.add('plain', P.sphere, cx - 0.35 + k * 0.23, 1.05, czz + (k % 2 ? 0.15 : -0.12), fc, { sx: 0.34, sy: 0.34, sz: 0.34 }));
          }
        }
        if (coast && Math.random() < 0.6) {
          b.add('plain', P.boxB, s * 7.4, 3.4, cz, 0xffffff, { sx: 0.7, sy: 0.12, sz: depth * 0.6 }); // balkon
        }
        if (neon) {
          if (Math.random() < 0.85) b.add('glow', P.box, s * 7.72, rnd(5, 12), cz + rnd(-1.5, 1.5), pick(D.accents), { sx: 0.16, sy: 1.4, sz: 3.2, mul: 2.2 });
          if (Math.random() < 0.5) {
            b.add('plain', P.cyl, bx, h, cz, 0x6a5acd, { sx: 0.12, sy: 4, sz: 0.12 });
            b.add('glow', P.sphere, bx, h + 4.1, cz, 0xff3cac, { sx: 0.4, sy: 0.4, sz: 0.4, mul: 2.5 });
          }
        }
        z -= depth + rnd(0.4, 1.6);
      }
    });

    if (coast) {
      // korkuluk
      b.add('plain', P.boxB, 7.6, 1.15, -CHUNK / 2, 0xffffff, { sx: 0.08, sy: 0.08, sz: CHUNK });
      b.add('plain', P.boxB, 7.6, 0.7, -CHUNK / 2, 0xffffff, { sx: 0.08, sy: 0.08, sz: CHUNK });
      for (let k = 0; k < 10; k++) b.add('plain', P.boxB, 7.6, 0.22, -k * 3, 0xffffff, { sx: 0.1, sy: 1.0, sz: 0.1 });
      // palmiyeler
      for (let k = 0; k < 3; k++) {
        const px = 6.6; const pz = -4 - k * 10 + rnd(-1, 1);
        for (let t = 0; t < 5; t++) b.add('plain', P.cyl, px + t * 0.12, 0.22 + t * 1.25, pz, 0x8d6748, { sx: 0.36 - t * 0.03, sy: 1.3, sz: 0.36 - t * 0.03 });
        for (let l = 0; l < 7; l++) b.add('plain', P.leaf, px + 0.6, 6.6, pz, l % 2 ? 0x2d9c4a : 0x3fbf5c, { ry: (l / 7) * Math.PI * 2 });
      }
      if (Math.random() < 0.6) {
        const ux = -6.4; const uz = -rnd(4, 26);
        b.add('plain', P.cyl, ux, 0.22, uz, 0xffffff, { sx: 0.1, sy: 2.4, sz: 0.1 });
        b.add('plain', P.umbrella, ux, 2.65, uz, pick([0xff6b6b, 0x00b4d8, 0xffd166]));
      }
    }
    if (bazaar && Math.random() < 0.75) {
      const fz = -rnd(5, 25);
      for (let k = 0; k < 22; k++) {
        const x = -7.2 + k * 0.68;
        const sag = 0.9 * (1 - Math.pow(x / 7.4, 2));
        b.add('plain', P.cone3, x, 6.6 - sag - 0.3, fz, pick(D.accents), { ry: Math.PI / 6 });
      }
    }
    if (neon && Math.random() < 0.5) b.add('glow', P.torus, 0, 3.4, -rnd(5, 25), pick(D.accents), { mul: 2.2 });

    // sokak lambaları (kalede meşaleler var)
    for (let k = 0; k < (D.props === 'castle' ? 0 : 2); k++) {
      const s = k % 2 ? 1 : -1;
      if (coast && s > 0) continue;
      const lz = -7 - k * 15;
      b.add('plain', P.cyl, s * 5.0, 0.22, lz, neon ? 0x6a5acd : 0x2f3b45, { sx: 0.18, sy: 5.2, sz: 0.18 });
      b.add('plain', P.boxB, s * 4.5, 5.3, lz, neon ? 0x6a5acd : 0x2f3b45, { sx: 1.1, sy: 0.08, sz: 0.08 });
      b.add('glow', P.sphere, s * 4.0, 5.15, lz, neon ? 0xff6ad5 : 0xffe9b0, { sx: 0.44, sy: 0.44, sz: 0.44, mul: neon ? 3 : 1.7 });
    }

    return b.build();
  }

  // Parça havuzu: her bölge için birkaç hazır varyant (koşu sırasında geometri üretilmez)
  prebuild(variants = 6) {
    this.pool = DISTRICTS.map((_, di) => Array.from({ length: variants }, () => this.buildVariant(di)));
  }

  makeChunk(d0) {
    const di = this.districtOverride != null ? this.districtOverride : route.at(Math.max(0, d0)).t;
    if (!this.pool) this.prebuild();
    const r = this.R(di);
    const coast = DISTRICTS[di].props === 'coast';
    const geos = pick(this.pool[di]);
    const g = new THREE.Group();
    const shadows = this.sun.castShadow;
    const addMesh = (geo, mat, cast = false, recv = false) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cast && shadows; m.receiveShadow = recv && shadows;
      m.matrixAutoUpdate = false; m.updateMatrix();
      g.add(m);
      return m;
    };
    addMesh(r.roadGeo, r.road, false, true);
    if (geos.wall) addMesh(geos.wall, r.wall, true, false);
    if (geos.shop) addMesh(geos.shop, r.shop);
    if (geos.plain) addMesh(geos.plain, r.plain, true, true);
    if (geos.glow) addMesh(geos.glow, r.glow);
    if (geos.awning) addMesh(geos.awning, r.awning, true);
    if (coast) addMesh(r.seaGeo, r.sea);
    if (!coast && Math.random() < 0.5) g.scale.x = -1; // ayna: çeşitlilik
    g.userData.d0 = d0;
    this.root.add(g);
    this.chunks.push(g);
  }

  disposeChunk(c) {
    this.root.remove(c);
  }

  // ---------- bulutlar ve Gökkuşağı Kulesi ----------
  buildSkyDecor() {
    const cloudTex = (() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const g = c.getContext('2d');
      for (let k = 0; k < 14; k++) {
        const x = 40 + Math.random() * 176; const y = 60 + Math.random() * 30; const r = 22 + Math.random() * 30;
        const gr = g.createRadialGradient(x, y, 2, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    this.clouds = new THREE.Group();
    const cmat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    for (let k = 0; k < 16; k++) {
      const s = new THREE.Sprite(cmat);
      const w = rnd(60, 130);
      s.scale.set(w, w * 0.45, 1);
      s.position.set(rnd(-260, 260), rnd(45, 110), rnd(-380, -200));
      s.userData.vx = rnd(0.5, 2);
      this.clouds.add(s);
    }
    this.clouds.renderOrder = -9;
    this.scene.add(this.clouds);

    // Kule: yolun ufkunda, 7 renk halkası
    this.tower = new THREE.Group();
    const stone = new THREE.MeshBasicMaterial({ color: 0x6b6880, fog: false });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 150, 16).translate(0, 75, 0), stone);
    this.tower.add(body);
    this.rings = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0x55536a, fog: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(9 - i * 0.55, 1.6, 10, 40).rotateX(Math.PI / 2), m);
      ring.position.y = 22 + i * 17;
      this.tower.add(ring);
      this.rings.push(ring);
    }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(4.5, 20, 12), new THREE.MeshBasicMaterial({ color: 0x8a879c, fog: false }));
    beacon.position.y = 156;
    this.tower.add(beacon);
    this.beacon = beacon;
    this.tower.position.set(0, -6, -420);
    this.tower.renderOrder = -8;
    this.scene.add(this.tower);
  }

  // restored: geri gelen renk sayısı; colors: COLORS listesi
  setTower(restored, colors) {
    this.towerRestored = restored;
    this.rings.forEach((r, i) => {
      if (i < restored) r.material.color.set(colors[i].hex).multiplyScalar(1.8);
      else r.material.color.set(0x55536a);
    });
    this.beacon.material.color.set(restored >= 7 ? 0xffffff : 0x8a879c).multiplyScalar(restored >= 7 ? 2.5 : 1);
  }

  buildSkylines() {
    this.skylines = DISTRICTS.map((D, i) => {
      const grp = new THREE.Group();
      const parts = [];
      const fogMix = new THREE.Color(D.fog);
      const add = (geo, col) => parts.push(colorize(prep(geo), col));
      for (let k = 0; k < (skylineParts(D, add, fogMix) ? 0 : 70); k++) {
        const x = -260 + k * 7.5 + rnd(-2, 2);
        if (Math.abs(x) < 25) continue;
        const h = D.props === 'neon' ? rnd(30, 110) : D.props === 'coast' ? rnd(6, 22) : rnd(12, 40);
        const w = rnd(6, 14);
        const col = new THREE.Color(D.walls[k % D.walls.length]).lerp(fogMix, D.props === 'neon' ? 0.55 : 0.6);
        add(new THREE.BoxGeometry(w, h, 8).translate(x, h / 2, 0), col.getHex());
        if (D.props === 'bazaar' && k % 9 === 0) {
          add(new THREE.SphereGeometry(w * 0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, h, 0), col.getHex());
          add(new THREE.CylinderGeometry(0.8, 1, h * 1.9, 8).translate(x + w * 0.9, h * 0.95, 0), col.getHex());
        }
      }
      if (D.props === 'coast') {
        add(new THREE.SphereGeometry(90, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.6, 0.35, 0.5).translate(-120, 0, -40), new THREE.Color(0x5fa37a).lerp(fogMix, 0.5).getHex());
        add(new THREE.CylinderGeometry(2, 3, 26, 10).translate(140, 13, 0), 0xffffff);
        add(new THREE.CylinderGeometry(2.4, 2.4, 3, 10).translate(140, 27.5, 0), 0xe63946);
      }
      const mesh = new THREE.Mesh(mergeGeometries(parts), patchSat(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
      grp.add(mesh);
      grp.position.set(0, -1, -330);
      grp.visible = i === 0;
      this.scene.add(grp);
      return grp;
    });
  }

  reset() {
    this.lastDist = undefined;
    this.chunks.forEach((c) => this.disposeChunk(c));
    this.chunks = [];
    this.nextD = -CHUNK;
  }

  update(dt, distance, camera) {
    this.time += dt;
    if (this.nextD === undefined) this.nextD = -CHUNK;
    let built = 0;
    while (this.nextD < distance + AHEAD && built < 3) {
      this.makeChunk(this.nextD);
      this.nextD += CHUNK;
      built++;
    }
    for (let k = this.chunks.length - 1; k >= 0; k--) {
      const c = this.chunks[k];
      const d0 = c.userData.d0;
      if (d0 + CHUNK < distance - 25) { this.disposeChunk(c); this.chunks.splice(k, 1); continue; }
      c.position.z = distance - d0;
      c.updateMatrix();
    }

    const k = 1 - Math.exp(-dt * 1.4);
    const c = this.cur; const t = this.tgt;
    ['top', 'bottom', 'sun', 'fog', 'hemiSky', 'hemiGround'].forEach((key) => c[key].lerp(t[key], k));
    c.stars += (t.stars - c.stars) * k; c.sunI += (t.sunI - c.sunI) * k; c.hemiI += (t.hemiI - c.hemiI) * k;
    this.applyColors();
    const fz = this.scene.fog;
    if (t.fogNear !== undefined) { fz.near += (t.fogNear - fz.near) * k; fz.far += (t.fogFar - fz.far) * k; }
    // hava efekti dünya ile birlikte akar
    const spd = this.lastDist !== undefined && dt > 0 ? Math.min(500, Math.max(0, (distance - this.lastDist) / dt)) : 0;
    this.lastDist = distance;
    this.updateWeather(dt, spd, camera);
    // fırtınada şimşek
    if (this.storm && Math.random() < dt * 0.15) this.flash = 1;
    if (this.flash > 0) { this.flash -= dt * 5; this.hemi.intensity = c.hemiI + Math.max(0, this.flash) * 2.2; }

    if (this.res[1] && this.res[1].water) {
      this.res[1].water.offset.x = this.time * 0.02;
      this.res[1].water.offset.y = distance / 15;
    }
    this.sky.position.copy(camera.position);
    this.skylines.forEach((s) => { s.position.x = camera.position.x * 0.9; });
    this.clouds.position.x = camera.position.x * 0.95;
    this.clouds.children.forEach((s) => { s.position.x += s.userData.vx * dt; if (s.position.x > 300) s.position.x = -300; });
    this.tower.position.x = camera.position.x * 0.97;
    const pulse = 1 + Math.sin(this.time * 2.5) * 0.04;
    this.beacon.scale.setScalar(this.towerRestored >= 7 ? pulse * 1.15 : 1);
  }
}
