// Sonsuz rota: her 1000 m'de yeni bir dünya. İlk tur 8 dünyayı karışık sırayla gezer,
// sonraki turlarda her dünya farklı bir zaman/hava hâliyle (gün batımı, gece, sis, fırtına) döner.
// 8 dünya x 5 hâl = 40 farklı bölüm: 50.000 puanda bile yeni bir görünüm gelir.
import { DISTRICTS, DISTRICT_LEN } from './config.js';

export const VARIANTS = [
  { id: 'gun', name: 'Gündüz' },
  { id: 'aksam', name: 'Gün Batımı' },
  { id: 'gece', name: 'Gece' },
  { id: 'sis', name: 'Sisli Sabah' },
  { id: 'firtina', name: 'Fırtına' },
];

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

class Route {
  constructor() { this.reset(); }

  reset(fixedFirst = 0) {
    this.seq = [{ t: fixedFirst, v: 0, cycle: 0 }];
    this.used = DISTRICTS.map(() => new Set([0]));
    this.bag = [];
    this.cycle = 0;
  }

  // d metresindeki bölüm: { t: dünya, v: hâl, cycle: tur }
  at(d) {
    const i = Math.max(0, Math.floor(d / DISTRICT_LEN));
    while (this.seq.length <= i) this.extend();
    return this.seq[i];
  }

  extend() {
    if (!this.bag.length) {
      const prev = this.seq[this.seq.length - 1].t;
      this.bag = shuffle(DISTRICTS.map((_, k) => k).filter((k) => k !== prev || DISTRICTS.length < 2));
      if (this.seq.length > 1) this.cycle++;
    }
    const t = this.bag.shift();
    let v = 0;
    if (this.cycle > 0) {
      const free = VARIANTS.map((_, k) => k).filter((k) => !this.used[t].has(k));
      v = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * VARIANTS.length);
      this.used[t].add(v);
    }
    this.seq.push({ t, v, cycle: this.cycle });
  }
}

export const route = new Route();

// bölümün adı: "Karlı Köy · Gece"
export function segmentName(seg) {
  const D = DISTRICTS[seg.t];
  return seg.v ? `${D.name} · ${VARIANTS[seg.v].name}` : D.name;
}

// hâle göre hava: fırtınada yağmur (karlı köyde tipi), gecede ateş böcekleri vb.
export function weatherFor(seg) {
  const D = DISTRICTS[seg.t];
  const v = VARIANTS[seg.v].id;
  if (v === 'firtina') return D.props === 'snow' ? 'blizzard' : 'rain';
  if (v === 'sis') return D.props === 'snow' ? 'snow' : 'none';
  if (v === 'gece' && D.weather === 'none') return 'fireflies';
  return D.weather;
}
