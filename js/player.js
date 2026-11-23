// Kahraman: model, animasyonlar, şerit/zıplama/kayma hareketi ve görsel efektler
import * as THREE from 'three';
import {
  LANES, GRAVITY, JUMP_HEIGHT, SUPER_JUMP_HEIGHT, SLIDE_TIME, PLAYER_H, PLAYER_SLIDE_H, SLIDE_POSE, HERO_SCALE,
} from './config.js';

const S = HERO_SCALE;

const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3();

export class Player {
  constructor(scene, gltf) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.pivot = new THREE.Group(); // kayma eğimi için
    this.root.add(this.pivot);

    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        if (o.material) {
          o.material.envMapIntensity = 0.7;
          if (o.material.map) o.material.map.anisotropy = 8;
        }
      }
    });
    // Model boyu ~1 birim ve +X yönüne bakıyor: büyüt ve -Z (koşu yönü) yönüne çevir
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y;
    const s = (PLAYER_H * S) / h;
    model.scale.setScalar(s);
    model.position.y = -box.min.y * s;
    model.rotation.y = Math.PI / 2;
    this.model = model;
    this.pivot.add(model);

    // kayma pozu için kemikler ve bağlama (bind) pozu
    let skel = null;
    model.traverse((o) => { if (o.isSkinnedMesh && !skel) skel = o.skeleton; });
    this.bones = {};
    this.bindQ = {};
    const names = ['Hips', 'Spine', 'Neck', 'Head', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'];
    if (skel) {
      skel.pose();
      names.forEach((n) => {
        const b = model.getObjectByName('mixamorig' + n) || model.getObjectByName('mixamorig:' + n);
        if (b) { this.bones[n] = b; this.bindQ[n] = b.quaternion.clone(); }
      });
    }
    this.hasSlidePose = Object.keys(this.bones).length === names.length;

    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    gltf.animations.forEach((clip) => {
      const a = this.mixer.clipAction(clip);
      this.actions[clip.name] = a;
    });
    ['jump', 'fall', 'dive'].forEach((n) => {
      const a = this.actions[n];
      if (a) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    });
    this.current = null;

    // gölge lekesi
    const blobTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.4 * S, 1.4 * S).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    this.blob.renderOrder = 1;
    scene.add(this.blob);

    // kalkan balonu
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: { t: { value: 0 }, col: { value: new THREE.Color(0x4cc9f0) } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform float t; uniform vec3 col; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float w = 0.5 + 0.5 * sin(t * 6.0 + vN.y * 10.0); gl_FragColor = vec4(col * (1.5 + w), f * 0.85 + 0.05); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.shieldMesh.position.y = 0.95 * S;
    this.shieldMesh.scale.setScalar(S);
    this.shieldMesh.visible = false;
    this.root.add(this.shieldMesh);

    // Renk Patlaması aurası
    this.aura = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: { t: { value: 0 } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: `uniform float t; varying vec3 vN; varying vec3 vV; varying vec3 vP;
          vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
          void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.0); vec3 c = hue(fract(vP.y * 0.4 + t * 0.8)); gl_FragColor = vec4(c * 2.2, f * 0.9); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.aura.position.y = 0.95 * S;
    this.aura.scale.set(0.85 * S, 1.2 * S, 0.85 * S);
    this.aura.visible = false;
    this.root.add(this.aura);

    // mıknatıs halkası
    this.magnetRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.05, 8, 40).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4d6d).multiplyScalar(2.5), transparent: true, opacity: 0.8 }),
    );
    this.magnetRing.visible = false;
    this.root.add(this.magnetRing);

    this.reset();
  }

  reset() {
    this.lane = 1;
    this.prevLane = 1;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.groundH = 0;
    this.sliding = 0;
    this.slideQueued = false;
    this.jumpBoost = false;
    this.dead = false;
    this.lean = 0;
    this.slideTilt = 0;
    this.invuln = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.bufferedSuper = false;
    this.squash = 0; this.hop = 0; this.impact = 0;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.position.set(0, 0, 0);
    this.model.visible = true;
  }

  play(name, fade = 0.15, timeScale = 1) {
    const a = this.actions[name];
    if (!a) return;
    a.timeScale = timeScale;
    if (this.current === a) return;
    a.reset();
    a.enabled = true;
    a.setEffectiveWeight(1);
    a.play();
    if (this.current) a.crossFadeFrom(this.current, fade, false);
    this.current = a;
  }

  get height() { return this.sliding > 0 ? PLAYER_SLIDE_H : PLAYER_H; }
  get feet() { return this.y; }

  moveLane(dir) {
    const nl = Math.max(0, Math.min(2, this.lane + dir));
    if (nl === this.lane) return false;
    this.prevLane = this.lane;
    this.lane = nl;
    this.hop = 1;
    return true;
  }

  bounceBack() {
    this.lane = this.prevLane;
  }

  canJump() {
    return this.grounded || this.coyote > 0;
  }

  jump(superJump) {
    if (!this.canJump()) {
      // inişe yakınsa zıplamayı beklet
      this.jumpBuffer = 0.22; this.bufferedSuper = superJump;
      return false;
    }
    const h = superJump ? SUPER_JUMP_HEIGHT : JUMP_HEIGHT;
    this.vy = Math.sqrt(2 * GRAVITY * h);
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.sliding = 0;
    this.slideQueued = false;
    const air = 2 * this.vy / GRAVITY;
    // zıplama klibinin havadaki bölümünü (0.45-1.75 sn) hava süresine sığdır
    this.play('jump', 0.04, Math.max(1, 1.3 / air));
    this.squash = superJump ? -0.5 : -0.35;
    if (this.actions.jump) this.actions.jump.time = 0.45;
    return true;
  }

  slide() {
    if (!this.grounded) {
      this.vy = Math.min(this.vy, -40); // havadan hızla in
      this.slideQueued = true;
      return true;
    }
    this.sliding = SLIDE_TIME;
    return true;
  }

  // kemikleri karakter uzayındaki bir eksen etrafında döndür (bağlama pozundan)
  rotBone(name, axis, ang, pivQ) {
    const b = this.bones[name];
    b.parent.updateWorldMatrix(true, false);
    const pq = b.parent.getWorldQuaternion(_q1);
    _v.copy(axis).applyQuaternion(pivQ);
    const R = _q2.setFromAxisAngle(_v, ang);
    const inv = _q3.copy(pq).invert();
    b.quaternion.premultiply(pq).premultiply(R).premultiply(inv);
  }

  applySlidePose(w) {
    if (!this.hasSlidePose || w <= 0.001) return;
    const s = SLIDE_POSE;
    Object.keys(this.bones).forEach((n) => this.bones[n].quaternion.slerp(this.bindQ[n], w));
    const pivQ = this.pivot.getWorldQuaternion(new THREE.Quaternion());
    this.rotBone('Hips', AX, s.hips * w, pivQ);
    this.rotBone('Spine', AX, s.spine * w, pivQ);
    this.rotBone('Neck', AX, s.neck * w, pivQ);
    this.rotBone('Head', AX, s.head * w, pivQ);
    this.rotBone('LeftUpLeg', AX, s.upL * w, pivQ);
    this.rotBone('LeftLeg', AX, s.kneeL * w, pivQ);
    this.rotBone('RightUpLeg', AX, s.upR * w, pivQ);
    this.rotBone('RightLeg', AX, s.kneeR * w, pivQ);
    this.rotBone('RightUpLeg', AZ, -0.15 * w, pivQ);
    this.rotBone('LeftArm', AZ, -s.armDown * w, pivQ);
    this.rotBone('RightArm', AZ, s.armDown * w, pivQ);
    this.rotBone('LeftArm', AX, s.armBack * w, pivQ);
    this.rotBone('RightArm', AX, s.armBack * w, pivQ);
    this.rotBone('LeftForeArm', AY, s.elbow * w, pivQ);
    this.rotBone('RightForeArm', AY, -s.elbow * w, pivQ);
  }

  // dünya mantığından gelen zemin yüksekliği ile fizik
  update(dt, speed, groundH) {
    this.groundH = groundH;
    const tx = LANES[this.lane];
    const dx = tx - this.x;
    // anında tepki veren şerit geçişi (~0,08 sn)
    const step = Math.sign(dx) * Math.min(Math.abs(dx), dt * 30);
    this.x += step + (dx - step) * Math.min(1, dt * 12);
    this.lean += ((-dx * 0.16) - this.lean) * Math.min(1, dt * 16);

    let landed = false;
    if (this.coyote > 0) this.coyote -= dt;
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= groundH && this.vy <= 0) {
        this.impact = -this.vy;
        this.y = groundH; this.vy = 0; this.grounded = true; landed = true;
        this.squash = Math.min(0.5, 0.12 + this.impact * 0.018);
      }
    } else if (groundH < this.y - 0.05) {
      // kenardan düştü: kısa süre hâlâ zıplayabilir
      this.grounded = false; this.vy = 0; this.coyote = 0.15;
    } else {
      this.y = groundH;
    }

    if (landed && this.jumpBuffer > 0) { this.jumpBuffer = 0; this.jump(this.bufferedSuper); landed = false; this.buffered = true; }
    if (landed && this.slideQueued) { this.slideQueued = false; this.sliding = SLIDE_TIME; }
    if (this.sliding > 0) this.sliding -= dt;

    if (!this.dead) {
      if (!this.grounded) {
        if (this.current !== this.actions.jump) { this.play('jump', 0.1, 1.2); if (this.actions.jump) this.actions.jump.time = 0.9; }
      } else {
        this.play('run', landed ? 0.06 : 0.12, 0.85 + speed / 24);
      }
    }

    const target = this.sliding > 0.05 ? 1 : 0;
    this.slideTilt += (target - this.slideTilt) * Math.min(1, dt * (target ? 38 : 16));
    // canlı his: koşarken öne eğil, zıplarken uza, inerken basıl, şerit değiştirirken hafif sek
    this.squash += (0 - this.squash) * Math.min(1, dt * 10);
    const lean = this.grounded && this.sliding <= 0 ? 0.07 + Math.min(0.08, Math.max(0, (speed - 15) * 0.004)) : 0.02;
    this.pivot.rotation.set(-lean * (1 - this.slideTilt), 0, 0);
    let hopY = 0;
    if (this.hop > 0) { this.hop = Math.max(0, this.hop - dt / 0.17); if (this.grounded && this.sliding <= 0) hopY = Math.sin((1 - this.hop) * Math.PI) * 0.16; }
    const sq = this.squash;
    this.pivot.scale.set(1 + sq * 0.22, 1 - sq * 0.3, 1 + sq * 0.22);
    this.pivot.position.set(0, -SLIDE_POSE.drop * S * this.slideTilt + hopY, 0);

    this.root.position.set(this.x, this.y, 0);
    this.root.rotation.z = this.lean;
    this.root.rotation.y = -this.lean * 0.8;

    this.blob.position.set(this.x, groundH + 0.03, 0);
    const hs = Math.max(0.35, 1 - (this.y - groundH) * 0.2);
    this.blob.scale.set(hs * (1 + this.slideTilt * 0.3), 1, hs * (1 + this.slideTilt * 0.6));

    if (this.invuln > 0) {
      this.invuln -= dt;
      this.model.visible = Math.floor(this.invuln * 12) % 2 === 0 || this.invuln <= 0;
    }

    this.mixer.update(dt);
    this.root.updateMatrixWorld(true);
    this.applySlidePose(this.slideTilt);
    return landed;
  }

  die() {
    this.dead = true;
    this.sliding = 0;
    this.play('fall', 0.08, 1.3);
  }

  revive() {
    this.dead = false;
    this.invuln = 2.2;
    this.vy = 0;
    this.play('run', 0.2, 1);
  }

  menuPose() {
    this.reset();
    this.play('idle', 0.3, 1);
  }

  updateMenu(dt, t) {
    this.root.position.set(0, 0, 0);
    this.root.rotation.y = Math.PI + Math.sin(t * 0.4) * 0.35;
    this.blob.position.set(0, 0.03, 0);
    this.blob.scale.setScalar(1);
    this.mixer.update(dt);
  }

  updateFx(dt, t, fx) {
    this.shieldMesh.visible = fx.shield;
    this.shieldMesh.material.uniforms.t.value = t;
    this.aura.visible = fx.burst;
    this.aura.material.uniforms.t.value = t;
    this.magnetRing.visible = fx.magnet;
    if (fx.magnet) {
      this.magnetRing.position.y = 0.1 + (Math.sin(t * 5) * 0.5 + 0.5) * 1.6 * S;
      this.magnetRing.scale.setScalar(S * (1 + Math.sin(t * 9) * 0.08));
    }
  }
}
