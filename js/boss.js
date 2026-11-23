// Boss: Gri Gölge'nin muhafızları ve Gri Gölge'nin kendisi.
// Oyuncunun önünde kaçar, şeritlere engel bırakır, lazer atar. Renk Patlaması ile vurulur.
import * as THREE from 'three';
import { LANES } from './config.js';
import { makeDrone } from './fx.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const BOSS_Z = -29;

export class Boss {
  constructor(scene, track, particles, audio, ui) {
    Object.assign(this, { scene, track, particles, audio, ui });
    this.root = new THREE.Group();
    this.drone = makeDrone();
    this.drone.scale.setScalar(2.6);
    this.root.add(this.drone);

    // final boss: kukuletalı figür
    const cloak = new THREE.MeshStandardMaterial({ color: 0x6f747d, roughness: 0.9 });
    this.figure = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.8, 10, 1, true), cloak);
    body.position.y = 1.4;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), cloak);
    hood.position.y = 3.0;
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdfe7ff).multiplyScalar(3) });
    [-0.18, 0.18].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeMat); e.position.set(x, 3.02, 0.48); this.figure.add(e); });
    this.figure.add(body, hood);
    this.figure.position.y = 1.9;
    this.figure.scale.setScalar(0.9);
    this.root.add(this.figure);
    this.root.scale.setScalar(1.7);

    // hedef işaret ışını
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.6, 1, 12, 1, true).translate(0, -0.5, 0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2d55).multiplyScalar(2.5), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.beam.visible = false;
    this.scene.add(this.beam);

    // oyuncunun renk ışını
    this.ray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 1, 16, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2),
      new THREE.ShaderMaterial({
        uniforms: { t: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float t; varying vec2 vUv;
          vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
          void main(){ gl_FragColor = vec4(hue(fract(vUv.y * 2.0 - t * 2.0)) * 3.0, 0.85); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    this.ray.visible = false;
    this.scene.add(this.ray);

    this.root.visible = false;
    scene.add(this.root);
    this.active = false;
    this.dropped = [];
  }

  start(def) {
    this.def = def;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.active = true;
    this.defeated = false;
    this.dying = 0;
    this.enter = 1; // giriş animasyonu
    this.lane = 1;
    this.targetLane = 1;
    this.cooldown = 2.6;
    this.crystalT = 1.5;
    this.tele = null;
    this.flinch = 0;
    this.rayT = 0;
    this.fleeing = 0;
    this.figure.visible = !!def.final;
    this.drone.userData.eye.material.color.set(def.final ? 0xdfe7ff : 0xff1e3c).multiplyScalar(4);
    this.root.visible = true;
    this.root.position.set(0, 14, BOSS_Z - 30);
    this.audio.bossIntro && this.audio.bossIntro();
  }

  flee() {
    this.active = false;
    this.fleeing = 1.8;
    this.tele = null;
    this.beam.visible = false;
  }

  stop() {
    this.active = false;
    this.fleeing = 0;
    this.root.visible = false;
    this.beam.visible = false;
    this.ray.visible = false;
    this.dropped = [];
  }

  // Renk Patlaması bossa çarptı
  hit(player) {
    if (!this.active || this.dying || this.enter > 0.2) return false;
    this.hp--;
    this.flinch = 0.8;
    this.rayT = 0.6;
    this.ray.visible = true;
    this.audio.bossHit && this.audio.bossHit();
    const p = this.root.position;
    this.particles.emit(p.x, p.y, p.z, { n: 90, rainbow: true, speed: 12, vy: 3, life: 1.0, size: 0.7, spread: 2 });
    if (this.hp <= 0) {
      this.dying = 2.2;
      this.defeated = true;
      this.beam.visible = false;
    }
    this.playerRef = player;
    return true;
  }

  telegraph(kind, lanes, extra) {
    this.tele = { kind, lanes, t: kind === 'drop' || kind === 'double' ? 0.7 : 0.9, extra };
    if (kind === 'drop') { this.targetLane = lanes[0]; }
    if (kind === 'double') this.ui.hint(extra === 'barrier' ? 'jump' : 'slide');
    if (kind === 'laserLow') this.ui.hint('jump');
    if (kind === 'laserHigh') this.ui.hint('slide');
    if (kind === 'buses') this.ui.hint('lane');
    this.audio.warn && this.audio.warn();
  }

  fire(distance) {
    const T = this.tele; this.tele = null;
    const at = distance - BOSS_Z; // bossun altındaki yol konumu
    if (T.kind === 'drop') {
      const o = this.track.addObstacle(T.extra, T.lanes[0], at + 2);
      o.mesh.position.y = 7; this.dropped.push({ o, t: 0 });
      this.particles.emit(LANES[T.lanes[0]], 0.5, BOSS_Z, { n: 20, color: 0xff2d55, speed: 4, life: 0.5, drift: true });
    } else if (T.kind === 'laserLow' || T.kind === 'laserHigh') {
      this.track.addObstacle(T.kind, 1, at + 8);
    } else if (T.kind === 'double') {
      T.lanes.forEach((l) => { const o = this.track.addObstacle(T.extra, l, at + 2); o.mesh.position.y = 7; this.dropped.push({ o, t: 0 }); });
    } else if (T.kind === 'buses') {
      T.lanes.forEach((l) => { const o = this.track.addObstacle('bus', l, at + 14, { len: 12 }); o.mesh.position.y = 8; this.dropped.push({ o, t: 0 }); });
    }
    this.audio.smash && this.audio.smash();
  }

  update(dt, distance, game) {
    if (this.fleeing > 0) {
      this.fleeing -= dt;
      this.root.position.y += dt * 10; this.root.position.z -= dt * 45; this.root.rotation.z += dt;
      if (this.fleeing <= 0) this.stop();
      return;
    }
    if (!this.active) return;
    const t = game.time;
    const r = this.root;
    const phase = 1 - this.hp / this.maxHp;

    // düşen engellerin inişi
    for (let k = this.dropped.length - 1; k >= 0; k--) {
      const d = this.dropped[k]; d.t += dt;
      d.o.mesh.position.y = Math.max(0, 7 * (1 - d.t / 0.35));
      if (d.t > 0.35) { this.dropped.splice(k, 1); game.shake = Math.max(game.shake, 0.12); }
    }

    if (this.dying > 0) {
      this.dying -= dt;
      r.position.y -= dt * 3; r.rotation.z += dt * 3; r.rotation.x += dt * 2;
      if (Math.random() < dt * 25) this.particles.emit(r.position.x + rnd(-2, 2), r.position.y + rnd(-1, 1), r.position.z, { n: 12, rainbow: true, speed: 9, life: 0.8, size: 0.6 });
      if (this.dying <= 0) { this.stop(); game.onBossDefeated(); }
      this.updateRay(dt, game);
      return;
    }

    // giriş
    if (this.enter > 0) this.enter = Math.max(0, this.enter - dt * 0.6);
    const tx = LANES[this.targetLane];
    r.position.x += (tx - r.position.x) * Math.min(1, dt * 3.2);
    const ty = 7.4 + Math.sin(t * 2.2) * 0.4 + this.enter * 8;
    r.position.y += (ty - r.position.y) * Math.min(1, dt * 3);
    r.position.z += ((BOSS_Z - this.enter * 30) - r.position.z) * Math.min(1, dt * 3);
    r.rotation.set(Math.sin(t * 1.7) * 0.08 + 0.15, Math.sin(t * 0.9) * 0.3, Math.sin(t * 1.3) * 0.1 - (r.position.x - tx) * 0.05);
    this.drone.userData.rotors.forEach((ro, i) => { ro.rotation.y += dt * (30 + i); });
    if (this.flinch > 0) {
      this.flinch -= dt;
      r.position.x += Math.sin(t * 60) * 0.25 * this.flinch;
      r.rotation.z += Math.sin(t * 40) * 0.4 * this.flinch;
    }

    if (game.dead) { this.beam.visible = false; this.updateRay(dt, game); return; }

    // kristal sırası ve altınlar (patlamayı doldurmak için 3 kristal yeter)
    this.crystalT -= dt;
    if (this.crystalT <= 0) {
      this.crystalT = rnd(4.2, 5.2);
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
      const d = distance + 60;
      const l = lanes.find((ln) => this.track.laneFree(ln, d - 4, d + 14));
      if (l !== undefined) for (let k = 0; k < 3; k++) this.track.addCrystal(l, d + k * 5, 1.1);
      const cl = lanes.find((ln) => ln !== l && this.track.laneFree(ln, d - 10, d + 20));
      if (cl !== undefined) this.track.addCoinLine(cl, d - 8, 10, 2.4);
    }

    // saldırılar
    if (this.enter <= 0.05) {
      if (this.tele) {
        this.tele.t -= dt;
        const lanes = this.tele.lanes;
        this.beam.visible = this.tele.kind !== 'laserLow' && this.tele.kind !== 'laserHigh';
        if (this.beam.visible) {
          this.beam.position.set(r.position.x, r.position.y - 1.6, r.position.z);
          this.beam.scale.set(1.6, r.position.y - 1.6, 1.6);
          this.beam.material.opacity = 0.3 + 0.4 * Math.abs(Math.sin(t * 20));
        }
        if (this.tele.kind === 'buses' || this.tele.kind === 'double') this.targetLane = lanes[Math.floor(t * 4) % lanes.length];
        if (this.tele.t <= 0) { this.beam.visible = false; this.fire(distance); }
      } else {
        this.cooldown -= dt;
        if (this.cooldown <= 0) {
          const interval = (this.def.final ? 1.25 : 1.6) - phase * 0.5;
          this.cooldown = interval + rnd(0, 0.4);
          const choices = ['drop', 'drop', 'laserLow', 'laserHigh'];
          if (phase > 0.3 || this.def.final) choices.push('buses', 'double');
          const kind = pick(choices);
          if (kind === 'drop') this.telegraph('drop', [pick([0, 1, 2])], pick(['barrier', 'high']));
          else if (kind === 'double') { const free = pick([0, 1, 2]); this.telegraph('double', [0, 1, 2].filter((l) => l !== free), pick(['barrier', 'high'])); }
          else if (kind === 'buses') { const free = pick([0, 1, 2]); this.telegraph('buses', [0, 1, 2].filter((l) => l !== free)); }
          else this.telegraph(kind, [0, 1, 2]);
        }
      }
    }
    this.updateRay(dt, game);
  }

  updateRay(dt, game) {
    if (this.rayT > 0) {
      this.rayT -= dt;
      const p = game.player;
      const from = new THREE.Vector3(p.x, p.y + 1.2, 0);
      const to = this.root.position;
      const len = from.distanceTo(to);
      this.ray.position.copy(from);
      this.ray.lookAt(to);
      this.ray.scale.set(1 + this.rayT, 1 + this.rayT, len);
      this.ray.material.uniforms.t.value = game.time;
      this.ray.visible = true;
      if (this.rayT <= 0) this.ray.visible = false;
    }
  }
}
