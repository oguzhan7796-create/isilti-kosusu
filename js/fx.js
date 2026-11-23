// Parçacıklar, kovalayan dron, post-processing
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const MAX = 900;

export class Particles {
  constructor(scene) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.drift = new Uint8Array(MAX); // 1: dünya ile birlikte geri akar
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: window.innerHeight / 2 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA;
        uniform float scale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * (1.0 + a), a * vA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.mat = mat;
    this.i = 0;
    this.tmp = new THREE.Color();
  }

  emit(x, y, z, opts = {}) {
    const n = opts.n || 10;
    for (let k = 0; k < n; k++) {
      const i = this.i; this.i = (this.i + 1) % MAX;
      const sp = opts.speed ?? 4;
      const a = Math.random() * Math.PI * 2; const b = Math.random() * Math.PI - Math.PI / 2;
      this.pos[i * 3] = x + (Math.random() - 0.5) * (opts.spread ?? 0.3);
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * (opts.spread ?? 0.3);
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * (opts.spread ?? 0.3);
      this.vel[i * 3] = Math.cos(a) * Math.cos(b) * sp + (opts.vx || 0);
      this.vel[i * 3 + 1] = Math.sin(b) * sp * 0.8 + (opts.vy ?? 2);
      this.vel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * sp + (opts.vz || 0);
      if (opts.rainbow) this.tmp.setHSL(Math.random(), 1, 0.6);
      else this.tmp.set(opts.color ?? 0xffffff).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
      this.col[i * 3] = this.tmp.r; this.col[i * 3 + 1] = this.tmp.g; this.col[i * 3 + 2] = this.tmp.b;
      this.size[i] = (opts.size ?? 0.35) * (0.6 + Math.random() * 0.8);
      this.maxLife[i] = this.life[i] = (opts.life ?? 0.6) * (0.6 + Math.random() * 0.8);
      this.grav[i] = opts.gravity ?? 9;
      this.drift[i] = opts.drift ? 1 : 0;
      this.alpha[i] = 1;
    }
  }

  update(dt, worldSpeed) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; } continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += (this.vel[i * 3 + 2] + (this.drift[i] ? worldSpeed : 0)) * dt;
      this.alpha[i] = Math.max(0, this.life[i] / this.maxLife[i]);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
  }

  resize(h) { this.mat.uniforms.scale.value = h / 2; }

  clear() { this.life.fill(0); this.alpha.fill(0); }
}

// Gri Gölge'nin dronu
export function makeDrone() {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.85, roughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 16), shell);
  g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.06, 8, 32), dark);
  g.add(ring);
  const eyeRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 24).rotateX(Math.PI / 2), dark);
  eyeRim.position.z = 0.52; g.add(eyeRim);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff1e3c).multiplyScalar(4) }));
  eye.position.z = 0.56; g.add(eye);
  const rotors = [];
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.08), dark);
    arm.position.set(sx * 0.55, 0.25, sz * 0.3); arm.rotation.y = sx * sz * 0.6; g.add(arm);
    const rot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 16), new THREE.MeshBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity: 0.45 }));
    rot.position.set(sx * 0.8, 0.3, sz * 0.45); g.add(rot); rotors.push(rot);
  });
  g.userData.rotors = rotors;
  g.userData.eye = eye;
  return g;
}

export function makeComposer(renderer, scene, camera, quality) {
  if (quality === 'low') return null;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 2 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.38, 0.45, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.bloom = bloom;
  return composer;
}
