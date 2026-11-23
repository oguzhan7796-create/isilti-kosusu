// Dünyaya özel engel, araç, düşman ve zıplama rampası modelleri.
// Hepsi köşe renkli (vertex color) basit şekillerden birleştirilir: model başına 1-3 çizim.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUS_H } from './config.js';

// geometriyi renklendir, döndür, taşı (yalnızca position/normal/color kalır)
function cg(geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  Object.keys(g.attributes).forEach((k) => { if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); });
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, s = 12) => new THREE.CylinderGeometry(r1, r2, h, s);
const sph = (r, ws = 12, hs = 8) => new THREE.SphereGeometry(r, ws, hs);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const merge = (parts) => (parts.length ? mergeGeometries(parts) : null);

// tekerlek çifti (araçlar için)
function wheels(parts, L, col, r = 0.42) {
  [-1, 1].forEach((sx) => [L / 2 - 1.4, -L / 2 + 1.4].forEach((wz) => parts.push(cg(cyl(r, r, 0.3, 14), col, sx * 0.98, r, wz, 0, 0, Math.PI / 2))));
}

// ---------------- engeller (yeni dünyalar) ----------------
// barrier: üstünden zıplanır (tepe ~1,05) · high: altından kayılır (alt 1,4) · bus: üstünde koşulur (tepe 2,6)
export const SHAPES = {
  snow: {
    barrier() {
      const p = [];
      [-0.66, 0, 0.66].forEach((x, k) => p.push(cg(box(0.62, 0.78, 0.5), k % 2 ? 0xa8d8f5 : 0xc4e6fa, x, 0.39, 0)));
      p.push(cg(box(2.05, 0.16, 0.62), 0xffffff, 0, 0.86, 0));
      [-0.7, 0.05, 0.6].forEach((x) => p.push(cg(sph(0.16, 8, 6), 0xffffff, x, 0.95, 0.05)));
      return { geo: merge(p) };
    },
    high() {
      const p = [];
      [-1.15, 1.15].forEach((x) => p.push(cg(cyl(0.1, 0.12, 2.9, 8), 0x7a5236, x, 1.45, 0)));
      p.push(cg(box(2.5, 0.22, 0.26), 0x7a5236, 0, 2.75, 0));
      p.push(cg(box(2.5, 0.14, 0.36), 0xffffff, 0, 2.9, 0));
      p.push(cg(box(2.1, 0.8, 0.12), 0x1d4e89, 0, 2.05, 0));
      p.push(cg(box(1.9, 0.1, 0.14), 0xffffff, 0, 2.38, 0));
      for (let k = 0; k < 8; k++) p.push(cg(cone(0.06, 0.24, 5), 0xd8f1ff, -0.9 + k * 0.26, 1.55, 0.02, Math.PI));
      return { geo: merge(p) };
    },
    bus(L) {
      const p = [];
      p.push(cg(box(2.1, 2.0, L), 0xd62839, 0, 1.55, 0));
      p.push(cg(box(2.16, 0.62, L - 0.8), 0x1d3557, 0, 1.95, 0));
      p.push(cg(box(2.2, 0.14, L + 0.1), 0xf6fbff, 0, BUS_H - 0.05, 0));
      p.push(cg(box(2.14, 0.12, L), 0xffd166, 0, 1.2, 0));
      [-0.8, 0.8].forEach((x) => {
        p.push(cg(box(0.14, 0.14, L + 0.6), 0x5c6b7a, x, 0.12, 0));
        p.push(cg(cyl(0.18, 0.18, 0.14, 10), 0x5c6b7a, x, 0.3, L / 2 + 0.3, 0, 0, Math.PI / 2));
        p.push(cg(box(0.12, 0.45, 0.12), 0x5c6b7a, x, 0.35, L / 2 - 1));
        p.push(cg(box(0.12, 0.45, 0.12), 0x5c6b7a, x, 0.35, -L / 2 + 1));
      });
      const glow = merge([-0.6, 0.6].map((x) => cg(sph(0.13, 8, 6), 0xfff3b0, x, 0.95, L / 2 + 0.02)));
      return { geo: merge(p), glow };
    },
  },
  canyon: {
    barrier() {
      const p = [];
      [-0.68, 0.68].forEach((x) => {
        p.push(cg(cyl(0.22, 0.3, 0.75, 12), 0xc0632b, x, 0.375, 0));
        p.push(cg(cyl(0.25, 0.22, 0.12, 12), 0x9c4a1a, x, 0.8, 0));
        p.push(cg(box(0.5, 0.06, 0.04), 0xf4e1b0, x, 0.45, 0.27));
      });
      p.push(cg(box(0.62, 0.62, 0.62), 0x8b5a2b, 0, 0.31, 0));
      p.push(cg(box(0.66, 0.08, 0.66), 0x6f4518, 0, 0.6, 0));
      p.push(cg(box(1.9, 0.35, 0.3), 0xe9c46a, 0, 0.82, -0.1));
      return { geo: merge(p) };
    },
    high() {
      const p = [];
      [-1.2, 1.2].forEach((x) => p.push(cg(cyl(0.08, 0.1, 3.0, 8), 0x6f4518, x, 1.5, 0)));
      p.push(cg(box(2.5, 0.05, 0.05), 0xf4e1b0, 0, 2.75, 0));
      const cols = [0xc1121f, 0x1d4e89, 0xe9c46a, 0xc1121f];
      cols.forEach((c, k) => p.push(cg(box(0.52, 1.2, 0.05), c, -0.78 + k * 0.52, 2.12, 0)));
      p.push(cg(box(2.1, 0.12, 0.07), 0xf4e1b0, 0, 1.55, 0));
      for (let k = 0; k < 9; k++) p.push(cg(box(0.04, 0.12, 0.04), 0xf4e1b0, -1.0 + k * 0.25, 1.44, 0));
      return { geo: merge(p) };
    },
    bus(L) {
      const p = [];
      p.push(cg(box(2.1, 1.0, L), 0x8b5a2b, 0, 1.0, 0));
      p.push(cg(box(2.16, 0.1, L), 0x5a3a18, 0, 1.2, 0));
      const roof = new THREE.CylinderGeometry(1.1, 1.1, L, 16, 1, false, -Math.PI / 2, Math.PI);
      p.push(cg(roof, 0xf2e3c6, 0, 1.5, 0, Math.PI / 2, 0, Math.PI / 2));
      p.push(cg(box(2.0, 0.08, L - 0.4), 0xe9dcc0, 0, BUS_H - 0.02, 0));
      for (let z = -L / 2 + 1; z < L / 2; z += 2) p.push(cg(box(2.24, 0.08, 0.1), 0x9c4a1a, 0, 1.55, z));
      wheels(p, L, 0x5a3a18, 0.5);
      return { geo: merge(p) };
    },
  },
  forest: {
    barrier() {
      const p = [];
      p.push(cg(cyl(0.42, 0.42, 2.1, 14), 0x6b4a2f, 0, 0.42, 0, 0, 0, Math.PI / 2));
      [-1.06, 1.06].forEach((x) => p.push(cg(cyl(0.36, 0.36, 0.03, 14), 0xd9b98a, x, 0.42, 0, 0, 0, Math.PI / 2)));
      p.push(cg(box(1.5, 0.08, 0.5), 0x5f8a3a, 0.1, 0.84, 0));
      [[-0.5, 0xff5d8f], [0.55, 0xffd166]].forEach(([x, c]) => {
        p.push(cg(cyl(0.04, 0.04, 0.2, 6), 0xf4ead5, x, 0.95, 0.15));
        p.push(cg(sph(0.12, 8, 6), c, x, 1.06, 0.15));
      });
      return { geo: merge(p) };
    },
    high() {
      const p = [];
      [-1.25, 1.25].forEach((x) => p.push(cg(cyl(0.32, 0.4, 3.0, 10), 0x5a3d26, x, 1.5, 0)));
      p.push(cg(cyl(0.26, 0.3, 2.8, 10), 0x6b4a2f, 0, 1.78, 0, 0, 0, Math.PI / 2));
      [[-0.8, 2.15, 0.45], [0, 2.3, 0.55], [0.8, 2.15, 0.45], [-0.3, 2.05, 0.35], [0.45, 2.45, 0.4]].forEach(([x, y, r], k) => p.push(cg(sph(r, 10, 8), k % 2 ? 0x3f7d2a : 0x4f9a33, x, y, 0)));
      for (let k = 0; k < 5; k++) p.push(cg(box(0.05, 0.35, 0.05), 0x2f6b1f, -0.8 + k * 0.4, 1.45, 0.05));
      return { geo: merge(p) };
    },
    bus(L) {
      const p = [];
      p.push(cg(box(2.1, 1.55, L), 0x7a5636, 0, 1.3, 0));
      for (let z = -L / 2 + 0.3; z <= L / 2; z += Math.max(2, L / 5)) p.push(cg(box(2.16, 1.55, 0.14), 0x3d3a32, 0, 1.3, z));
      [-0.62, 0, 0.62].forEach((x) => p.push(cg(cyl(0.3, 0.3, L, 10), 0x8a6a48, x, 2.3, 0, Math.PI / 2)));
      p.push(cg(box(1.95, 0.06, L), 0x8a6a48, 0, BUS_H - 0.03, 0));
      wheels(p, L, 0x3d3a32, 0.4);
      return { geo: merge(p) };
    },
  },
  fair: {
    barrier() {
      const p = [];
      [[-0.62, 0.62, 0xff6b9a], [0.05, 0.85, 0x6bc6ff], [0.66, 0.55, 0xffd166]].forEach(([x, s, c]) => {
        p.push(cg(box(s, s, s), c, x, s / 2, 0));
        p.push(cg(box(s + 0.02, s + 0.02, 0.1), 0xffffff, x, s / 2, 0));
        p.push(cg(box(0.1, s + 0.02, s + 0.02), 0xffffff, x, s / 2, 0));
        p.push(cg(new THREE.TorusGeometry(0.1, 0.035, 6, 12), 0xffffff, x, s + 0.08, 0));
      });
      return { geo: merge(p) };
    },
    high() {
      const p = [];
      [-1.3, 1.3].forEach((x) => {
        for (let k = 0; k < 6; k++) p.push(cg(cyl(0.12, 0.12, 0.5, 8), k % 2 ? 0xffffff : 0xff3c8e, x, 0.25 + k * 0.5, 0));
      });
      [0.5, -0.5].forEach((z) => p.push(cg(box(2.8, 0.12, 0.12), 0xb16cff, 0, 1.6, z * 0.6)));
      for (let k = 0; k < 7; k++) p.push(cg(box(0.1, 0.08, 0.8), 0x5b5f97, -1.2 + k * 0.4, 1.52, 0));
      p.push(cg(box(2.6, 0.7, 0.14), 0xffd23f, 0, 2.2, 0));
      p.push(cg(box(2.4, 0.5, 0.16), 0xff3c8e, 0, 2.2, 0));
      return { geo: merge(p), glow: merge([-1.0, -0.5, 0, 0.5, 1.0].map((x) => cg(sph(0.07, 6, 4), 0xfff6c2, x, 2.6, 0.08))) };
    },
    bus(L) {
      const p = [];
      const n = Math.max(2, Math.round(L / 1.5));
      const seg = L / n;
      for (let k = 0; k < n; k++) p.push(cg(box(2.1, 1.9, seg), k % 2 ? 0xff3c8e : 0xffffff, 0, 1.5, -L / 2 + seg * (k + 0.5)));
      p.push(cg(box(2.24, 0.16, L + 0.1), 0xffd23f, 0, BUS_H - 0.08, 0));
      p.push(cg(box(2.16, 0.2, L), 0x6a3cc9, 0, 0.6, 0));
      wheels(p, L, 0xffd23f, 0.4);
      const glow = [];
      for (let z = -L / 2 + 0.5; z < L / 2; z += 1) [-1.1, 1.1].forEach((x) => glow.push(cg(sph(0.07, 6, 4), 0xfff6c2, x, BUS_H - 0.08, z)));
      return { geo: merge(p), glow: merge(glow) };
    },
  },
  castle: {
    barrier() {
      const p = [];
      p.push(cg(box(2.1, 0.26, 0.32), 0x5a3a24, 0, 0.36, 0));
      [-0.8, 0.8].forEach((x) => p.push(cg(box(0.2, 0.5, 0.5), 0x3a2a1c, x, 0.25, 0)));
      for (let k = 0; k < 7; k++) p.push(cg(cone(0.1, 0.58, 6), 0x9a96aa, -0.9 + k * 0.3, 0.78, 0));
      return { geo: merge(p) };
    },
    high() {
      const p = [];
      [-1.15, 1.15].forEach((x) => p.push(cg(box(0.34, 3.0, 0.5), 0x5a5468, x, 1.5, 0)));
      p.push(cg(box(2.64, 0.4, 0.5), 0x4e4860, 0, 2.85, 0));
      for (let k = 0; k < 7; k++) p.push(cg(box(0.07, 1.35, 0.07), 0x2a2438, -0.84 + k * 0.28, 2.12, 0));
      [1.7, 2.15, 2.6].forEach((y) => p.push(cg(box(1.95, 0.07, 0.07), 0x2a2438, 0, y, 0)));
      for (let k = 0; k < 7; k++) p.push(cg(cone(0.05, 0.16, 5), 0x9a96aa, -0.84 + k * 0.28, 1.39, 0, Math.PI));
      return { geo: merge(p), glow: merge([-1.15, 1.15].map((x) => cg(sph(0.12, 8, 6), 0xffa13d, x, 2.5, 0.3))) };
    },
    bus(L) {
      const p = [];
      p.push(cg(box(2.1, 0.6, L), 0x2a2438, 0, 0.7, 0));
      for (let z = -L / 2 + 0.2; z <= L / 2; z += 0.55) [-1.0, 1.0].forEach((x) => p.push(cg(box(0.07, 1.45, 0.07), 0x55506a, x, 1.72, z)));
      [-L / 2 + 0.05, L / 2 - 0.05].forEach((z) => { for (let x = -0.9; x <= 0.9; x += 0.3) p.push(cg(box(0.07, 1.45, 0.07), 0x55506a, x, 1.72, z)); });
      p.push(cg(box(2.2, 0.16, L), 0x3b3550, 0, BUS_H - 0.08, 0));
      wheels(p, L, 0x1c1730, 0.4);
      const glow = merge([cg(new THREE.OctahedronGeometry(0.45, 0), 0xb48cff, 0, 1.55, 0)]);
      return { geo: merge(p), glow };
    },
  },
};

// ---------------- düşmanlar ----------------
// roller: şeritte sana doğru yuvarlanır (zıpla ya da şerit değiştir)
// crosser: şeritler arasında gidip gelir (zıpla ya da zamanla)
// diver: havadan baş hizasına süzülür (kay ya da şerit değiştir)
// pad: zıplama rampası (üstünden geçince yükseğe fırlatır)

function beachBall() {
  const p = [];
  const cols = [0xff4d4d, 0xffffff, 0x00b4d8, 0xffffff, 0xffd166, 0xffffff];
  for (let k = 0; k < 6; k++) p.push(cg(new THREE.SphereGeometry(0.55, 4, 10, (k / 6) * Math.PI * 2, Math.PI / 3), cols[k]));
  return merge(p);
}

function spiky(r, col, spikeCol) {
  const p = [cg(new THREE.IcosahedronGeometry(r, 1), col)];
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pos = ico.attributes.position;
  const seen = new Set();
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    const key = v.toArray().map((x) => x.toFixed(2)).join();
    if (seen.has(key)) continue; seen.add(key);
    const g = cone(0.09, 0.32, 5).translate(0, r + 0.12, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v));
    p.push(cg(g, spikeCol));
  }
  return merge(p);
}

export const FOES = {
  roller: {
    carsi: () => ({ geo: merge([cg(cyl(0.5, 0.5, 1.1, 14), 0x9c6b3f, 0, 0, 0, 0, 0, Math.PI / 2), ...[-0.35, 0, 0.35].map((x) => cg(cyl(0.52, 0.52, 0.07, 14), 0x4a3a2a, x, 0, 0, 0, 0, Math.PI / 2))]), r: 0.5 }),
    sahil: () => ({ geo: beachBall(), r: 0.55 }),
    neon: () => ({ geo: merge([cg(sph(0.5, 14, 10), 0x2b2450), cg(new THREE.TorusGeometry(0.52, 0.05, 6, 24), 0x39f3ff), cg(new THREE.TorusGeometry(0.52, 0.05, 6, 24), 0xff3cac, 0, 0, 0, Math.PI / 2)]), r: 0.5 }),
    snow: () => ({ geo: merge([cg(new THREE.IcosahedronGeometry(0.62, 2), 0xffffff), cg(sph(0.2, 8, 6), 0xe6f2fc, 0.35, 0.4, 0.2), cg(sph(0.16, 8, 6), 0xe6f2fc, -0.4, -0.2, 0.35)]), r: 0.62 }),
    canyon: () => ({ geo: merge([cg(new THREE.DodecahedronGeometry(0.6, 0), 0xc98f5e), cg(new THREE.DodecahedronGeometry(0.3, 0), 0xa86f40, 0.3, 0.3, 0.2)]), r: 0.6 }),
    forest: () => ({ geo: merge([cg(new THREE.DodecahedronGeometry(0.62, 1), 0x8a8a7a), cg(sph(0.28, 8, 6), 0x5f8a3a, 0.2, 0.45, 0.1)]), r: 0.62 }),
    fair: () => ({ geo: beachBall(), r: 0.55 }),
    castle: () => ({ geo: spiky(0.48, 0x3b3550, 0x9a96aa), r: 0.55 }),
  },
  crosser: {
    carsi: () => ({ geo: merge([cg(box(1.1, 0.5, 0.8), 0x9c6b3f, 0, 0.55, 0), ...[0xff7b00, 0xe63946, 0x80b918].map((c, k) => cg(sph(0.17, 8, 6), c, -0.3 + k * 0.3, 0.9, 0)), cg(cyl(0.25, 0.25, 0.1, 12), 0x4a3a2a, 0.45, 0.25, 0.42, Math.PI / 2), cg(cyl(0.25, 0.25, 0.1, 12), 0x4a3a2a, -0.45, 0.25, 0.42, Math.PI / 2), cg(box(0.06, 0.06, 0.9), 0x6b4a2f, 0.75, 0.75, 0, 0, 0, 0.3)]) }),
    neon: () => ({ geo: merge([cg(cyl(0.45, 0.55, 0.5, 16), 0x2b2450, 0, 0.55, 0), cg(sph(0.3, 12, 8), 0x55506a, 0, 0.9, 0)]), glow: merge([cg(new THREE.TorusGeometry(0.56, 0.05, 6, 24), 0x39f3ff, 0, 0.3, 0, Math.PI / 2), cg(sph(0.08, 6, 4), 0xff3cac, 0, 0.95, 0.28)]) }),
    snow: () => ({ geo: merge([cg(new THREE.CapsuleGeometry(0.34, 0.45, 4, 10), 0x1c1c24, 0, 0.62, 0), cg(new THREE.CapsuleGeometry(0.26, 0.35, 4, 10), 0xffffff, 0, 0.58, 0.12), cg(cone(0.08, 0.2, 6), 0xffa630, 0, 0.88, 0.36, Math.PI / 2), cg(box(0.3, 0.06, 0.2), 0xffa630, -0.15, 0.03, 0.1), cg(box(0.3, 0.06, 0.2), 0xffa630, 0.15, 0.03, 0.1)]) }),
    canyon: () => ({ geo: merge([cg(new THREE.IcosahedronGeometry(0.55, 0), 0xa07040, 0, 0.55, 0), cg(new THREE.IcosahedronGeometry(0.42, 0), 0xc9a06a, 0, 0.55, 0, 0.5, 0.5, 0)]) }),
    forest: () => ({ geo: merge([spiky(0.42, 0x8a6a48, 0x3a2a1c).translate(0, 0.55, 0), cg(sph(0.16, 8, 6), 0xd9b98a, 0, 0.45, 0.42), cg(sph(0.06, 6, 4), 0x111111, 0, 0.5, 0.58), cg(sph(0.05, 6, 4), 0x111111, -0.12, 0.66, 0.36), cg(sph(0.05, 6, 4), 0x111111, 0.12, 0.66, 0.36)]) }),
    fair: () => ({ geo: merge([cg(box(1.1, 0.45, 0.95), 0x39d8ff, 0, 0.42, 0), cg(new THREE.TorusGeometry(0.62, 0.12, 8, 20), 0x222233, 0, 0.25, 0, Math.PI / 2), cg(box(0.6, 0.3, 0.3), 0xff3c8e, 0, 0.75, -0.2), cg(cyl(0.03, 0.03, 0.9, 6), 0xdddddd, 0, 1.1, -0.35)]), glow: merge([cg(sph(0.1, 6, 4), 0xffd23f, 0, 1.58, -0.35)]) }),
    castle: () => ({ geo: merge([cg(cone(0.45, 1.2, 10), 0x1c1730, 0, 0.6, 0), cg(sph(0.3, 10, 8), 0x26213a, 0, 1.15, 0)]), glow: merge([cg(sph(0.06, 6, 4), 0xff4d6d, -0.1, 1.18, 0.26), cg(sph(0.06, 6, 4), 0xff4d6d, 0.1, 1.18, 0.26)]) }),
  },
  diver: {
    sahil: () => bird(0xffffff, 0x9aa3ad, 0xffa630),
    neon: () => ({ body: merge([cg(box(0.6, 0.3, 0.6), 0x2b2450), cg(sph(0.16, 8, 6), 0xff3cac, 0, -0.1, 0.25)]), wing: merge([cg(box(0.6, 0.04, 0.4), 0x39f3ff, 0.3, 0, 0)]) }),
    snow: () => bird(0xf4f8fc, 0xdfe8f0, 0xffa630),
    canyon: () => bird(0x5a3a24, 0x3a2a1c, 0xf4e1b0),
    forest: () => bat(0x3a2a4a, 0x4a3a5a),
    fair: () => ({ body: merge([cg(sph(0.32, 10, 8), 0xff3c8e, -0.25, 0.1, 0), cg(sph(0.32, 10, 8), 0x39d8ff, 0.25, 0.1, 0), cg(sph(0.32, 10, 8), 0xffd23f, 0, 0.42, 0), cg(cyl(0.01, 0.01, 0.8, 4), 0xffffff, 0, -0.5, 0)]), wing: null }),
    castle: () => bat(0x15112a, 0x26213a, 0xff4d6d),
    carsi: () => bird(0x9aa3ad, 0x6b7380, 0xffa630),
  },
  pad: {
    forest: () => ({ geo: merge([cg(cyl(0.22, 0.28, 0.35, 10), 0xf4ead5, 0, 0.17, 0), cg(new THREE.SphereGeometry(0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xe63946, 0, 0.3, 0, 0, 0, 0).scale(1, 0.45, 1), ...[[0.4, 0.2], [-0.35, 0.3], [0, -0.45], [0.2, 0.55]].map(([x, z]) => cg(sph(0.1, 6, 4), 0xffffff, x, 0.6, z))]) }),
    fair: () => ({ geo: merge([cg(cyl(0.95, 0.95, 0.22, 20), 0x39d8ff, 0, 0.22, 0), cg(new THREE.TorusGeometry(0.95, 0.09, 6, 24), 0xff3c8e, 0, 0.33, 0, Math.PI / 2), ...[0, 1, 2, 3].map((k) => cg(cyl(0.05, 0.05, 0.22, 6), 0xffd23f, Math.cos(k * 1.57) * 0.8, 0.11, Math.sin(k * 1.57) * 0.8))]) }),
    default: () => ({ geo: merge([cg(cyl(0.9, 0.9, 0.12, 18), 0x444455, 0, 0.06, 0), cg(new THREE.TorusGeometry(0.55, 0.07, 6, 16), 0xbbbbcc, 0, 0.18, 0, Math.PI / 2), cg(new THREE.TorusGeometry(0.55, 0.07, 6, 16), 0xbbbbcc, 0, 0.32, 0, Math.PI / 2), cg(cyl(0.85, 0.85, 0.1, 18), 0xffd23f, 0, 0.42, 0)]), glow: merge([cg(cone(0.25, 0.3, 3), 0x7cff6b, 0, 0.62, 0.1, -Math.PI / 2)]) }),
  },
};

function bird(body, wingCol, beak) {
  return {
    body: merge([cg(sph(0.26, 10, 8), body, 0, 0, 0).scale(1, 0.85, 1.6), cg(sph(0.17, 8, 6), body, 0, 0.12, 0.38), cg(cone(0.06, 0.2, 6), beak, 0, 0.1, 0.6, Math.PI / 2), cg(box(0.3, 0.04, 0.25), wingCol, 0, 0, -0.42)]),
    wing: merge([cg(box(0.9, 0.04, 0.4), wingCol, 0.45, 0, 0)]),
  };
}

function bat(body, wingCol, eye = 0xffd23f) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(0.9, 0.25); shape.lineTo(0.75, -0.05); shape.lineTo(0.55, 0.05); shape.lineTo(0.4, -0.15); shape.lineTo(0.2, -0.05); shape.lineTo(0, -0.2); shape.closePath();
  return {
    body: merge([cg(sph(0.25, 10, 8), body), cg(cone(0.07, 0.18, 4), body, -0.12, 0.25, 0), cg(cone(0.07, 0.18, 4), body, 0.12, 0.25, 0)]),
    wing: merge([cg(new THREE.ShapeGeometry(shape), wingCol, 0, 0, 0, -Math.PI / 2)]),
    eyes: merge([cg(sph(0.05, 6, 4), eye, -0.09, 0.06, 0.22), cg(sph(0.05, 6, 4), eye, 0.09, 0.06, 0.22)]),
  };
}

// stilden tema anahtarı (eski 3 dünya id ile, yeniler props ile)
export function foeKey(D) {
  return { bazaar: 'carsi', coast: 'sahil', neon: 'neon' }[D.props] || D.props;
}
