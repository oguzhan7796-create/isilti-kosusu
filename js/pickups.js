// Güç toplanabilirleri: parlayan cam balon içinde sallanan 3D simge, yörünge halkası ve hale
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { POWERUPS } from './config.js';

const protos = {};
let bubbleGeo = null;
let orbitGeo = null;

const srgb = (hex) => new THREE.Color(hex).convertLinearToSRGB();

function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.25, ...o });
}

function bubbleMat(color) {
  return new THREE.ShaderMaterial({
    uniforms: { col: { value: srgb(color) }, t: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 col; uniform float t; varying vec3 vN; varying vec3 vV;
      void main(){
        float ndv = clamp(dot(vN, vV), 0.0, 1.0);
        float rim = pow(1.0 - ndv, 2.4);
        float spec = pow(max(dot(vN, normalize(vec3(-0.45, 0.62, 0.64))), 0.0), 48.0);
        float pulse = 0.85 + 0.15 * sin(t * 4.0);
        vec3 c = mix(col * 0.55, col * 1.7 + 0.3, rim) * pulse + spec * 1.6;
        float a = 0.08 + rim * 0.9 + spec;
        gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
      }`,
    transparent: true, depthWrite: false,
  });
}

function haloMat(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const col = new THREE.Color(color);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},0.75)`); gr.addColorStop(0.45, `rgba(${rgb},0.28)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}

function star(r1, r2, depth) {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + (k / 10) * Math.PI * 2;
    const r = k % 2 ? r2 : r1;
    if (k === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
}

// her simge: [geometri, malzeme] çiftleri; ~0,6 birim boyunda, merkezde
const ICONS = {
  magnet() {
    const red = std(0xff3b5c, { emissive: 0x7a0a1e, emissiveIntensity: 0.6 });
    const silver = std(0xf2f5fa, { metalness: 0.9, roughness: 0.18 });
    const body = mergeGeometries([
      new THREE.TorusGeometry(0.2, 0.085, 12, 28, Math.PI),
      new THREE.CylinderGeometry(0.085, 0.085, 0.16, 16).translate(-0.2, -0.08, 0),
      new THREE.CylinderGeometry(0.085, 0.085, 0.16, 16).translate(0.2, -0.08, 0),
    ]).translate(0, 0.02, 0);
    const tips = mergeGeometries([
      new THREE.CylinderGeometry(0.087, 0.087, 0.11, 16).translate(-0.2, -0.2, 0),
      new THREE.CylinderGeometry(0.087, 0.087, 0.11, 16).translate(0.2, -0.2, 0),
    ]).translate(0, 0.02, 0);
    return [[body, red], [tips, silver]];
  },
  shield() {
    const s = new THREE.Shape();
    s.moveTo(0, 0.3);
    s.quadraticCurveTo(0.14, 0.23, 0.26, 0.25);
    s.quadraticCurveTo(0.28, -0.08, 0, -0.3);
    s.quadraticCurveTo(-0.28, -0.08, -0.26, 0.25);
    s.quadraticCurveTo(-0.14, 0.23, 0, 0.3);
    const plate = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 14 }).translate(0, 0, -0.035);
    const blue = std(0x2fb8ef, { metalness: 0.55, roughness: 0.22, emissive: 0x08445e, emissiveIntensity: 0.7 });
    const gold = std(0xffd45c, { metalness: 0.8, roughness: 0.22, emissive: 0x664400, emissiveIntensity: 0.5 });
    const emblem = star(0.13, 0.055, 0.03).translate(0, 0.01, 0.075);
    return [[plate, blue], [emblem, gold]];
  },
  sneakers() {
    const shoe = new THREE.Shape();
    shoe.moveTo(-0.26, -0.08);
    shoe.lineTo(0.2, -0.08);
    shoe.quadraticCurveTo(0.3, -0.08, 0.29, 0.0);
    shoe.quadraticCurveTo(0.26, 0.06, 0.12, 0.06);
    shoe.lineTo(0.0, 0.11);
    shoe.lineTo(-0.11, 0.2);
    shoe.lineTo(-0.25, 0.2);
    shoe.quadraticCurveTo(-0.31, 0.06, -0.26, -0.08);
    const body = new THREE.ExtrudeGeometry(shoe, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -0.08);
    const soleS = new THREE.Shape();
    soleS.moveTo(-0.29, -0.15); soleS.lineTo(0.27, -0.15); soleS.quadraticCurveTo(0.33, -0.15, 0.31, -0.08); soleS.lineTo(-0.29, -0.08); soleS.closePath();
    const sole = new THREE.ExtrudeGeometry(soleS, { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1);
    const wingS = new THREE.Shape();
    wingS.moveTo(-0.06, 0.04);
    wingS.quadraticCurveTo(-0.2, 0.3, -0.44, 0.33);
    wingS.quadraticCurveTo(-0.32, 0.25, -0.38, 0.22);
    wingS.quadraticCurveTo(-0.26, 0.17, -0.32, 0.13);
    wingS.quadraticCurveTo(-0.2, 0.1, -0.23, 0.05);
    wingS.quadraticCurveTo(-0.13, 0.03, -0.06, 0.04);
    const wingGeo = new THREE.ExtrudeGeometry(wingS, { depth: 0.02, bevelEnabled: false, curveSegments: 8 });
    const wings = mergeGeometries([wingGeo.clone().translate(0, 0, 0.11), wingGeo.clone().translate(0, 0, -0.13)]);
    const green = std(0x3ddc84, { emissive: 0x0d5a2c, emissiveIntensity: 0.6 });
    const white = std(0xffffff, { roughness: 0.5 });
    const gold = std(0xffc93c, { metalness: 0.6, roughness: 0.25, emissive: 0x8a5a00, emissiveIntensity: 0.6, side: THREE.DoubleSide });
    const geos = [[body, green], [sole, white], [wings, gold]];
    geos.forEach(([g]) => g.translate(0.07, -0.02, 0).scale(1.05, 1.05, 1.05));
    return geos;
  },
  double() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(100, 90, 20, 128, 128, 128);
    gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.55, '#ffcd3c'); gr.addColorStop(1, '#d58b00');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.lineWidth = 14; g.strokeStyle = '#b56f00'; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
    g.font = '900 118px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = '#8a4d00'; g.strokeText('x2', 128, 136);
    g.fillStyle = '#ffffff'; g.fillText('x2', 128, 136);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2; // silindir kapağının UV yönünü düzelt
    const side = std(0xffc23a, { metalness: 0.8, roughness: 0.25, emissive: 0x5a3a00, emissiveIntensity: 0.5 });
    const face = std(0xffffff, { map: tex, metalness: 0.45, roughness: 0.3, emissive: 0x332200, emissiveIntensity: 0.4 });
    const coin = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 40).rotateX(Math.PI / 2);
    // silindir grupları: 0 yan, 1 üst kapak (+Z, kameraya bakar), 2 alt kapak
    return [[coin, [side, face, side]]];
  },
};

function proto(kind) {
  if (protos[kind]) return protos[kind];
  if (!bubbleGeo) {
    bubbleGeo = new THREE.SphereGeometry(0.6, 32, 20);
    orbitGeo = new THREE.TorusGeometry(0.74, 0.022, 6, 56);
  }
  const color = POWERUPS[kind].color;
  protos[kind] = {
    parts: ICONS[kind](),
    bubble: bubbleMat(color),
    orbit: new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.85, depthWrite: false }),
    halo: haloMat(color),
  };
  return protos[kind];
}

export function makePowerPickup(kind) {
  const P = proto(kind);
  const g = new THREE.Group();
  const halo = new THREE.Sprite(P.halo);
  halo.scale.set(2.3, 2.3, 1);
  halo.renderOrder = 2;
  g.add(halo);
  const icon = new THREE.Group();
  P.parts.forEach(([geo, mat]) => icon.add(new THREE.Mesh(geo, mat)));
  icon.scale.setScalar(1.15);
  g.add(icon);
  const orbit = new THREE.Mesh(orbitGeo, P.orbit);
  orbit.rotation.x = 1.15;
  g.add(orbit);
  const bubble = new THREE.Mesh(bubbleGeo, P.bubble);
  bubble.renderOrder = 3;
  g.add(bubble);
  g.userData = { icon, orbit, bubble, halo, kind };
  return g;
}

export function animatePickup(g, t, phase) {
  const u = g.userData;
  u.icon.rotation.y = Math.sin(t * 2.2 + phase) * 0.65;
  u.icon.rotation.z = Math.sin(t * 1.7 + phase) * 0.08;
  u.orbit.rotation.z = t * 2.4 + phase;
  u.orbit.rotation.y = Math.sin(t * 1.3 + phase) * 0.35;
  u.halo.material.rotation = t * 0.4;
  const s = 1 + Math.sin(t * 5 + phase) * 0.04;
  u.bubble.scale.setScalar(s);
  u.bubble.material.uniforms.t.value = t;
}
