// Yeni dünyaların görünümü: yol/cephe/dükkân dokuları, sokak yapıları ve ufuk siluetleri.
// Karlı Köy (snow), Peri Bacaları (canyon), Gizemli Orman (forest), Lunapark (fair), Gölge Kalesi (castle)
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------- dokular ----------------
export function paintRoad(g, w, h, D) {
  if (D.road === 'snow') {
    g.fillStyle = D.roadA; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 240; k++) { g.fillStyle = `rgba(150,180,210,${Math.random() * 0.18})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(4, 18), rnd(2, 8), 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(120,150,185,0.22)'; [0.22, 0.32, 0.68, 0.78].forEach((u) => g.fillRect(u * w - 4, 0, 8, h));
    return true;
  }
  if (D.road === 'sand') {
    g.fillStyle = D.roadA; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 14) { g.strokeStyle = `rgba(160,110,50,${0.12 + Math.random() * 0.12})`; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.quadraticCurveTo(x + 8, y + 5, x + 16, y); g.stroke(); }
    for (let k = 0; k < 90; k++) { g.fillStyle = D.roadB; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rnd(1, 4), 0, 7); g.fill(); }
    return true;
  }
  if (D.road === 'dirt') {
    g.fillStyle = D.roadA; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 160; k++) { g.fillStyle = Math.random() < 0.5 ? D.roadB : 'rgba(200,180,140,0.5)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(3, 9), rnd(2, 6), Math.random() * 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(95,138,58,0.55)'; for (let y = 0; y < h; y += 6) { g.fillRect(0, y, rnd(6, 16), 4); g.fillRect(w - rnd(6, 16), y, 16, 4); }
    return true;
  }
  if (D.road === 'tiles') {
    const s = 32;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) { g.fillStyle = ((x + y) / s) % 2 ? D.roadA : D.roadB; g.fillRect(x, y, s, s); }
    g.fillStyle = 'rgba(255,255,255,0.5)'; for (let y = 0; y < h; y += s) g.fillRect(0, y, w, 2);
    return true;
  }
  if (D.road === 'stone') {
    g.fillStyle = '#2c2838'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 40) {
      const off = (y / 40) % 2 ? 0 : 30;
      for (let x = -off; x < w; x += 60) { g.fillStyle = Math.random() < 0.5 ? D.roadA : D.roadB; g.fillRect(x + 2, y + 2, 56, 36); }
    }
    return true;
  }
  return false;
}

export function paintFacade(g, w, h, D) {
  const st = D.props;
  if (st === 'snow') {
    g.fillStyle = '#f2e6da'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < h; y += 14) g.fillRect(0, y, w, 2);
    for (let k = 0; k < 2; k++) {
      const x = 38 + k * 128; const y = 50; const ww = 52; const wh = 70;
      g.fillStyle = '#ffffff'; g.fillRect(x - 6, y - 6, ww + 12, wh + 12);
      g.fillStyle = '#ffd98a'; g.fillRect(x, y, ww, wh);
      g.fillStyle = '#ffffff'; g.fillRect(x + ww / 2 - 2, y, 4, wh); g.fillRect(x, y + wh / 2 - 2, ww, 4);
      g.fillStyle = '#2a9d8f'; g.fillRect(x - 20, y, 12, wh); g.fillRect(x + ww + 8, y, 12, wh);
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x + ww / 2, y + wh + 9, ww / 2 + 10, 7, 0, 0, 7); g.fill();
    }
    return true;
  }
  if (st === 'canyon') {
    g.fillStyle = '#f6eee2'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 220; k++) { g.fillStyle = `rgba(120,80,40,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, rnd(2, 6), rnd(2, 6)); }
    g.fillStyle = 'rgba(120,70,30,0.12)'; for (let y = 20; y < h; y += 46) g.fillRect(0, y, w, 3);
    for (let k = 0; k < 2; k++) {
      const x = 40 + k * 128; const y = 60;
      g.fillStyle = '#3a2416'; g.beginPath(); g.roundRect(x, y, 44, 64, [22, 22, 2, 2]); g.fill();
      g.fillStyle = 'rgba(255,190,110,0.5)'; g.beginPath(); g.roundRect(x + 8, y + 14, 28, 40, [14, 14, 0, 0]); g.fill();
    }
    return true;
  }
  if (st === 'forest') {
    g.fillStyle = '#e8dccb'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 6) { g.fillStyle = `rgba(60,35,15,${0.15 + Math.random() * 0.3})`; g.fillRect(x, 0, rnd(1, 3), h); }
    for (let k = 0; k < 18; k++) { g.fillStyle = 'rgba(80,130,50,0.45)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(6, 16), rnd(3, 8), 0, 0, 7); g.fill(); }
    return true;
  }
  if (st === 'fair') {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? 'rgba(255,255,255,1)' : 'rgba(255,214,234,1)'; g.fillRect(x, 0, 32, h); }
    for (let k = 0; k < 2; k++) { g.fillStyle = '#6a3cc9'; g.beginPath(); g.arc(64 + k * 128, 90, 26, 0, 7); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(64 + k * 128, 90, 18, 0, 7); g.fill(); }
    return true;
  }
  if (st === 'castle') {
    g.fillStyle = '#e4e0ee'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < h; y += 26) { g.fillRect(0, y, w, 3); const off = (y / 26) % 2 ? 0 : 32; for (let x = off; x < w; x += 64) g.fillRect(x, y, 3, 26); }
    for (let k = 0; k < 2; k++) { g.fillStyle = '#120e1e'; g.fillRect(58 + k * 128, 56, 14, 72); g.fillRect(48 + k * 128, 84, 34, 12); }
    return true;
  }
  return false;
}

export function paintShop(g, w, h, D) {
  const st = D.props;
  if (st === 'snow') {
    g.fillStyle = '#efe3d4'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.1)'; for (let y = 0; y < h; y += 14) g.fillRect(0, y, w, 2);
    g.fillStyle = '#7a4a2a'; g.beginPath(); g.roundRect(150, 70, 70, 135, [30, 30, 0, 0]); g.fill();
    g.fillStyle = '#ffd166'; g.beginPath(); g.arc(205, 140, 5, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(20, 66, 104, 84); g.fillStyle = '#ffcf7a'; g.fillRect(26, 72, 92, 72);
    g.fillStyle = '#e63946'; g.fillRect(20, 152, 104, 16);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 20);
    return true;
  }
  if (st === 'canyon') {
    g.fillStyle = '#f4e7d2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a2416'; g.beginPath(); g.roundRect(150, 60, 76, 145, [38, 38, 0, 0]); g.fill();
    const cols = ['#c1121f', '#1d4e89', '#e9c46a', '#2a9d8f'];
    for (let k = 0; k < 4; k++) { g.fillStyle = cols[k]; g.fillRect(16 + k * 30, 60, 26, 120); g.fillStyle = 'rgba(255,255,255,0.5)'; for (let y = 70; y < 180; y += 16) g.fillRect(20 + k * 30, y, 18, 4); }
    return true;
  }
  if (st === 'castle') {
    g.fillStyle = '#d8d4e4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a1424'; g.beginPath(); g.roundRect(70, 40, 116, 165, [58, 58, 0, 0]); g.fill();
    g.fillStyle = '#3a3448'; for (let x = 80; x < 180; x += 16) g.fillRect(x, 50, 5, 155);
    return true;
  }
  return false;
}

// ---------------- yardımcı geometriler ----------------
let EX = null;
function extraProtos(prep) {
  if (EX) return EX;
  const uvScale = (g, su, sv) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; };
  EX = {
    prism: prep(new THREE.CylinderGeometry(1, 1, 1, 3).rotateX(-Math.PI / 2)),
    cone: prep(new THREE.ConeGeometry(0.5, 1, 10).translate(0, 0.5, 0)),
    coneTex: prep(uvScale(new THREE.ConeGeometry(0.5, 1, 14).translate(0, 0.5, 0), 4, 3)),
    columnTex: prep(uvScale(new THREE.CylinderGeometry(0.3, 0.5, 1, 14).translate(0, 0.5, 0), 4, 3)),
    cylTex: prep(uvScale(new THREE.CylinderGeometry(0.5, 0.5, 1, 14).translate(0, 0.5, 0), 3, 4)),
    stripeCyl: prep(uvScale(new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, true).translate(0, 0.5, 0), 8, 1)),
    stripeCone: prep(uvScale(new THREE.ConeGeometry(0.5, 1, 16, 1, true).translate(0, 0.5, 0), 8, 1)),
    ring: prep(new THREE.TorusGeometry(1, 0.04, 6, 40).rotateY(Math.PI / 2)),
    ico: prep(new THREE.IcosahedronGeometry(0.5, 1)),
  };
  return EX;
}

// ---------------- sokak yapıları ----------------
// X: { CHUNK, prep, bproto(w,h,d), shopPlane(depth) } · b.add(key, proto, x, y, z, renk, { sx, sy, sz, rx, ry, rz, mul })
export function buildStyle(b, P, D, X) {
  const st = D.props;
  const E = extraProtos(X.prep);
  const { CHUNK } = X;
  const sides = [-1, 1];
  const face = (s) => (s > 0 ? -Math.PI / 2 : Math.PI / 2);

  const slots = (s, fn) => {
    let z = -rnd(0.4, 2);
    while (z > -CHUNK + 3.6) {
      const room = z + CHUNK - 0.6;
      const depth = Math.min(fn.depth(), Math.floor(room * 2) / 2);
      fn.build(s, z - depth / 2, depth);
      z -= depth + rnd(0.6, 1.8);
    }
  };

  if (st === 'snow') {
    sides.forEach((s) => slots(s, {
      depth: () => pick([6, 7, 8]),
      build: (s2, cz, depth) => {
        const width = pick([7, 8, 9]); const h = pick([5.4, 6.4, 7.4]); const bx = s2 * (7.8 + width / 2);
        b.add('wall', X.bproto(width, h, depth), bx, 0, cz, pick(D.walls));
        b.add('plain', E.prism, bx, h + 0.8, cz, 0xf6fbff, { sx: (width + 1.2) / 1.732, sy: 1.6, sz: depth + 0.9 });
        b.add('plain', P.boxB, bx + s2 * 1.5, h + 0.6, cz + depth * 0.25, 0x8a4a2a, { sx: 0.7, sy: 2.0, sz: 0.7 });
        b.add('plain', P.boxB, bx + s2 * 1.5, h + 2.6, cz + depth * 0.25, 0xffffff, { sx: 0.8, sy: 0.2, sz: 0.8 });
        const sp = X.shopPlane(depth);
        b.add('shop', sp.geo, s2 * 7.78, 1.82, cz, 0xffffff, { ry: face(s2), sx: sp.w, sy: 3.2 });
        if (Math.random() < 0.8) {
          const tz = cz - depth / 2 - 0.4; const tx = s2 * 7.2;
          [[2.2, 2.0, 0], [1.7, 1.7, 1.3], [1.1, 1.4, 2.4]].forEach(([r, hh, y], k) => {
            b.add('plain', E.cone, tx, 0.22 + y, tz, k % 2 ? 0x2d6a4f : 0x1b4332, { sx: r, sy: hh, sz: r });
            b.add('plain', E.cone, tx, 0.22 + y + hh * 0.55, tz, 0xffffff, { sx: r * 0.55, sy: hh * 0.45, sz: r * 0.55 });
          });
        }
        if (Math.random() < 0.6) b.add('plain', P.dome, s2 * 5.3, 0.2, cz + rnd(-2, 2), 0xffffff, { sx: rnd(1, 1.8), sy: 0.6, sz: rnd(1, 2) });
      },
    }));
    return true;
  }

  if (st === 'canyon') {
    sides.forEach((s) => slots(s, {
      depth: () => pick([6, 8, 9]),
      build: (s2, cz, depth) => {
        const r = depth * 0.42; const h = rnd(9, 17); const bx = s2 * (8.2 + r);
        b.add('wall', E.columnTex, bx, 0, cz, pick(D.walls), { sx: r * 2, sy: h, sz: r * 2 });
        b.add('plain', P.dome, bx, h - 0.3, cz, 0x8a5a3a, { sx: r * 1.35, sy: r * 0.9, sz: r * 1.35 });
        b.add('plain', E.cone, bx, h + r * 0.35, cz, 0x6f4518, { sx: r * 0.9, sy: r * 0.7, sz: r * 0.9 });
        if (Math.random() < 0.7) {
          const cx = s2 * 6.6;
          b.add('plain', P.boxB, cx, 0.22, cz, 0x8b5a2b, { sx: 1.4, sy: 0.8, sz: 2.2 });
          b.add('awning', P.plane, s2 * 6.9, 2.2, cz, pick(D.accents), { ry: face(s2), rx: -0.4, sx: 2.4, sy: 1.4 });
          [0, 1, 2].forEach((k) => b.add('plain', P.cyl, cx - 0.4 + k * 0.4, 1.02, cz + rnd(-0.6, 0.6), pick([0xc0632b, 0x9c4a1a, 0xe9c46a]), { sx: 0.35, sy: 0.5, sz: 0.35 }));
        }
      },
    }));
    // sıcak hava balonları
    for (let k = 0; k < 2; k++) {
      const s = Math.random() < 0.5 ? -1 : 1;
      const x = s * rnd(14, 40); const y = rnd(16, 34); const z = -rnd(2, CHUNK - 2);
      const r = rnd(2.2, 3.4);
      b.add('plain', P.sphere, x, y, z, pick(D.accents), { sx: r * 2, sy: r * 2.3, sz: r * 2 });
      b.add('plain', E.cone, x, y - r * 1.6, z, pick(D.accents), { sx: r * 1.3, sy: r * 0.9, sz: r * 1.3, rx: Math.PI });
      b.add('plain', P.boxB, x, y - r * 2.3, z, 0x8b5a2b, { sx: 0.8, sy: 0.6, sz: 0.8 });
    }
    return true;
  }

  if (st === 'forest') {
    sides.forEach((s) => slots(s, {
      depth: () => pick([7, 8, 10]),
      build: (s2, cz, depth) => {
        const tr = rnd(1.1, 1.7); const h = rnd(12, 20); const bx = s2 * (8.6 + tr);
        b.add('wall', E.cylTex, bx, 0, cz, pick(D.walls), { sx: tr * 2, sy: h, sz: tr * 2 });
        [[0, 0, 0, 1], [1.8, -1.2, 1.2, 0.8], [-1.6, -1.6, -1.4, 0.75], [0.6, 1.6, -1.8, 0.7]].forEach(([dx, dy, dz, k], i) => {
          const R = (depth * 0.6) * k;
          b.add('plain', P.sphere, bx + dx * s2, h + dy, cz + dz, i % 2 ? 0x2f6b2a : 0x3f8a33, { sx: R * 2, sy: R * 1.6, sz: R * 2 });
        });
        [-1, 1].forEach((k) => b.add('plain', P.boxB, bx - s2 * tr * 0.8, 0, cz + k * tr * 0.7, 0x5a3d26, { sx: 0.6, sy: 1.0, sz: 1.4, ry: k * 0.5 }));
        if (Math.random() < 0.85) {
          const mx = s2 * rnd(5.6, 7.0); const mz = cz + rnd(-depth / 2, depth / 2); const ms = rnd(0.7, 1.4);
          b.add('plain', P.cyl, mx, 0.22, mz, 0xf4ead5, { sx: 0.35 * ms, sy: 1.1 * ms, sz: 0.35 * ms });
          b.add('glow', P.dome, mx, 0.22 + 1.05 * ms, mz, pick([0xff5d8f, 0xc77dff, 0x9bf6ff, 0xffd166]), { sx: 1.6 * ms, sy: 0.9 * ms, sz: 1.6 * ms, mul: 0.9 });
        }
        if (Math.random() < 0.5) for (let k = 0; k < 4; k++) b.add('plain', P.leaf, s2 * 6.2, 0.22, cz + rnd(-2, 2), 0x4f9a33, { ry: rnd(0, 6.3), sx: 0.8, sy: 0.8, sz: 0.8 });
      },
    }));
    if (Math.random() < 0.45) {
      const az = -rnd(6, CHUNK - 6);
      [-1, 1].forEach((s) => b.add('plain', P.boxB, s * 5.4, 0.2, az, 0x8a8a7a, { sx: 0.9, sy: 6.5, sz: 1.2 }));
      b.add('plain', P.boxB, 0, 6.6, az, 0x7a7a6a, { sx: 12, sy: 0.9, sz: 1.3 });
      b.add('plain', P.boxB, 0, 7.5, az, 0x5f8a3a, { sx: 11, sy: 0.3, sz: 1.4 });
    }
    return true;
  }

  if (st === 'fair') {
    sides.forEach((s) => slots(s, {
      depth: () => pick([6, 7, 8]),
      build: (s2, cz, depth) => {
        const r = depth * 0.45; const bx = s2 * (8.0 + r); const hw = rnd(3.2, 4.4);
        const c1 = pick(D.accents); const c2 = pick(D.walls);
        b.add('awning', E.stripeCyl, bx, 0, cz, c1, { sx: r * 2, sy: hw, sz: r * 2 });
        b.add('awning', E.stripeCone, bx, hw, cz, c2, { sx: r * 2.3, sy: r * 1.2, sz: r * 2.3 });
        b.add('plain', P.cyl, bx, hw + r * 1.2, cz, 0xffffff, { sx: 0.08, sy: 1.4, sz: 0.08 });
        b.add('glow', P.box, bx + 0.35, hw + r * 1.2 + 1.1, cz, pick(D.accents), { sx: 0.7, sy: 0.4, sz: 0.04 });
        if (Math.random() < 0.6) {
          const cx = s2 * 6.4;
          b.add('plain', P.boxB, cx, 0.22, cz, 0xffffff, { sx: 1.2, sy: 1.0, sz: 2.2 });
          b.add('awning', P.plane, s2 * 6.6, 2.4, cz, pick(D.accents), { ry: face(s2), rx: -0.6, sx: 2.6, sy: 1.3 });
          for (let k = 0; k < 4; k++) b.add('glow', P.sphere, cx, 1.35, cz - 0.8 + k * 0.55, pick(D.accents), { sx: 0.35, sy: 0.35, sz: 0.35, mul: 0.8 });
        }
      },
    }));
    if (Math.random() < 0.5) {
      const s = Math.random() < 0.5 ? -1 : 1; const wx = s * 30; const wz = -CHUNK / 2; const R = 13;
      b.add('plain', E.ring, wx, R + 2, wz - 0.6, 0xb16cff, { sx: R, sy: R, sz: R });
      b.add('plain', E.ring, wx, R + 2, wz + 0.6, 0xb16cff, { sx: R, sy: R, sz: R });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        b.add('plain', P.box, wx, R + 2 + Math.sin(a) * R / 2, wz + Math.cos(a) * R / 2, 0xffffff, { sx: 0.12, sy: R, sz: 0.12, rx: -a + Math.PI / 2 });
        b.add('plain', P.boxB, wx, R + 2 + Math.sin(a) * R - 1.4, wz + Math.cos(a) * R, pick(D.accents), { sx: 1.6, sy: 1.4, sz: 1.4 });
        b.add('glow', P.sphere, wx, R + 2 + Math.sin(a + 0.26) * R, wz + Math.cos(a + 0.26) * R, 0xfff6c2, { sx: 0.4, sy: 0.4, sz: 0.4 });
      }
      [-1, 1].forEach((k) => b.add('plain', P.box, wx, (R + 2) / 2, wz + k * 4, 0x5b5f97, { sx: 0.4, sy: R + 4, sz: 0.4, rx: k * 0.28 }));
    }
    const lz = -rnd(5, CHUNK - 5);
    for (let k = 0; k < 18; k++) {
      const x = -7.0 + k * 0.82; const sag = 1.1 * (1 - Math.pow(x / 7.2, 2));
      b.add('glow', P.sphere, x, 6.4 - sag, lz, pick(D.accents), { sx: 0.22, sy: 0.22, sz: 0.22 });
    }
    return true;
  }

  if (st === 'castle') {
    sides.forEach((s) => slots(s, {
      depth: () => pick([7, 9, 11]),
      build: (s2, cz, depth) => {
        const width = 8; const h = pick([9, 11, 13]); const bx = s2 * (7.8 + width / 2);
        b.add('wall', X.bproto(width, h, depth), bx, 0, cz, pick(D.walls));
        for (let z = cz - depth / 2 + 0.5; z <= cz + depth / 2 - 0.4; z += 1.4) b.add('plain', P.boxB, s2 * 8.05, h, z, 0x4e4860, { sx: 0.6, sy: 0.9, sz: 0.8 });
        b.add('plain', P.cyl, s2 * 7.62, 2.6, cz, 0x2a2438, { sx: 0.12, sy: 0.6, sz: 0.12 });
        b.add('glow', P.sphere, s2 * 7.62, 3.3, cz, 0xffa13d, { sx: 0.32, sy: 0.45, sz: 0.32 });
        if (Math.random() < 0.7) b.add('plain', P.plane, s2 * 7.74, h * 0.6, cz + depth * 0.25, pick(D.accents), { ry: face(s2), sx: 1.3, sy: h * 0.45 });
        if (Math.random() < 0.4) {
          const sp = X.shopPlane(depth);
          b.add('shop', sp.geo, s2 * 7.78, 1.82, cz, 0xffffff, { ry: face(s2), sx: sp.w, sy: 3.2 });
        }
        if (Math.random() < 0.35) {
          const tx = s2 * (7.8 + width + 1.5); const th = h + rnd(5, 9);
          b.add('wall', E.cylTex, tx, 0, cz, pick(D.walls), { sx: 5, sy: th, sz: 5 });
          b.add('plain', E.cone, tx, th, cz, 0x3a2a5a, { sx: 6, sy: 5, sz: 6 });
          b.add('glow', P.box, tx - s2 * 2.45, th - 3, cz, 0xffb703, { sx: 0.05, sy: 1.0, sz: 0.4 });
        }
      },
    }));
    return true;
  }
  return false;
}

// ---------------- ufuk siluetleri ----------------
export function skylineParts(D, add, fogMix) {
  const st = D.props;
  const C = (hex, k = 0.6) => new THREE.Color(hex).lerp(fogMix, k).getHex();
  if (st === 'snow') {
    for (let k = 0; k < 9; k++) {
      const x = -260 + k * 65 + rnd(-10, 10); const h = rnd(60, 120); const r = rnd(45, 75);
      add(new THREE.ConeGeometry(r, h, 7).translate(x, h / 2, rnd(-30, 0)), C(0x7a8fa8, 0.45));
      add(new THREE.ConeGeometry(r * 0.42, h * 0.42, 7).translate(x, h * 0.79, rnd(-30, 0) + 1), C(0xffffff, 0.2));
    }
    return true;
  }
  if (st === 'canyon') {
    for (let k = 0; k < 22; k++) {
      const x = -260 + k * 24 + rnd(-6, 6); if (Math.abs(x) < 20) continue;
      const h = rnd(14, 42); const w = rnd(8, 22);
      add(new THREE.CylinderGeometry(w * 0.4, w * 0.55, h, 8).translate(x, h / 2, 0), C(pick(D.walls), 0.5));
      add(new THREE.CylinderGeometry(w * 0.5, w * 0.45, 3, 8).translate(x, h + 1.5, 0), C(0x8a5a3a, 0.5));
    }
    return true;
  }
  if (st === 'forest') {
    for (let k = 0; k < 40; k++) {
      const x = -260 + k * 13 + rnd(-4, 4); if (Math.abs(x) < 18) continue;
      const h = rnd(30, 60);
      add(new THREE.ConeGeometry(rnd(7, 12), h, 7).translate(x, h / 2, rnd(-20, 0)), C(k % 2 ? 0x2f6b2a : 0x24552a, 0.5));
    }
    return true;
  }
  if (st === 'fair') {
    for (let k = 0; k < 26; k++) {
      const x = -260 + k * 20 + rnd(-4, 4); if (Math.abs(x) < 20) continue;
      const h = rnd(6, 16); const r = rnd(4, 8);
      add(new THREE.CylinderGeometry(r, r, h, 10).translate(x, h / 2, 0), C(pick(D.walls), 0.55));
      add(new THREE.ConeGeometry(r * 1.2, r, 10).translate(x, h + r / 2, 0), C(pick(D.accents), 0.5));
    }
    add(new THREE.TorusGeometry(40, 1.5, 6, 40).translate(130, 46, -20), C(0xb16cff, 0.4));
    add(new THREE.TorusGeometry(26, 1.2, 6, 40).translate(-150, 30, -10), C(0x39d8ff, 0.4));
    return true;
  }
  if (st === 'castle') {
    for (let k = 0; k < 16; k++) {
      const x = -250 + k * 33 + rnd(-6, 6); if (Math.abs(x) < 22) continue;
      const h = rnd(30, 80);
      add(new THREE.CylinderGeometry(rnd(5, 9), rnd(6, 10), h, 10).translate(x, h / 2, 0), C(0x3a3448, 0.35));
      add(new THREE.ConeGeometry(rnd(7, 11), rnd(14, 24), 10).translate(x, h + 9, 0), C(0x2a1f45, 0.3));
    }
    add(new THREE.BoxGeometry(520, 22, 6).translate(0, 11, 8), C(0x2a2438, 0.3));
    return true;
  }
  return false;
}
