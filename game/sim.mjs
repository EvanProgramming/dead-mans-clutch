const STRAIGHT = 520,
  RADIUS = 175,
  ARC = Math.PI * RADIUS;
export const TRACK_LENGTH = 2 * (STRAIGHT + ARC);
export const ROAD_HALF_WIDTH = 68;
const wrap = (s) => ((s % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const separation = (a, b) => wrap(a - b + TRACK_LENGTH / 2) - TRACK_LENGTH / 2;
export function trackPoint(s, lane = 0) {
  s = wrap(s);
  const r = RADIUS + lane;
  if (s < STRAIGHT) return { x: s - STRAIGHT / 2, y: -r, angle: 0 };
  s -= STRAIGHT;
  if (s < ARC) {
    const angle = s / RADIUS;
    return { x: STRAIGHT / 2 + r * Math.sin(angle), y: -r * Math.cos(angle), angle };
  }
  s -= ARC;
  if (s < STRAIGHT) return { x: STRAIGHT / 2 - s, y: r, angle: Math.PI };
  const angle = Math.PI + (s - STRAIGHT) / RADIUS;
  return { x: -STRAIGHT / 2 + r * Math.sin(angle), y: -r * Math.cos(angle), angle };
}

const tune = {
  wagon: { max: 51, acceleration: 12, steer: 29, mass: 1.25, grip: 4.1 },
  coupe: { max: 54, acceleration: 16, steer: 37, mass: 0.85, grip: 5.2 },
  tow: { max: 49, acceleration: 10, steer: 26, mass: 2, grip: 3.5 },
  hearse: { max: 48, acceleration: 13, steer: 30, mass: 1.65, grip: 4 },
};
function car(id, kind, s, lane, speed, cruise = speed) {
  return {
    id,
    kind,
    s,
    lane,
    speed,
    cruise,
    homeLane: lane,
    lateralSpeed: 0,
    wreck: false,
    stun: 0,
    damage: 0,
    contactCooldown: 0,
  };
}
export function makeRace() {
  const player = car('starter', 'wagon', 0, 0, 37);
  const hearse = car('hearse', 'hearse', 35, -36, 44, 45);
  const cars = [
    player,
    hearse,
    car('redline', 'coupe', -6, 28, 48),
    car('wrecker', 'tow', 41, -24, 40),
  ];
  const grid = [
    ['coupe', 430, 35, 48],
    ['wagon', 750, -19, 43],
    ['tow', 1020, 30, 38],
    ['coupe', 1280, -32, 46],
    ['wagon', 1620, 23, 41],
    ['tow', 1850, -10, 39],
    ['wagon', 2040, 42, 43],
  ];
  for (const [kind, s, lane, speed] of grid) cars.push(car('traffic' + s, kind, s, lane, speed));
  for (const [id, kind, s, lane] of [
    ['pileup', 'wagon', 475, 0],
    ['backstretch-hauler', 'tow', 1310, 25],
    ['banked-coupe', 'coupe', 1840, -17],
  ]) {
    const wreck = car(id, kind, s, lane, 0);
    wreck.wreck = true;
    cars.push(wreck);
  }
  return {
    cars,
    player,
    hearse,
    barriers: [{ s: STRAIGHT + 38, lane: -57, broken: false }],
    phase: 'drive',
    time: 0,
    lap: 1,
    targets: [],
    selected: 0,
    shortcutOpen: false,
    events: [],
    progress: 0,
    nextGate: 1,
    gatesPassed: 0,
    hearseGate: 1,
    immune: 0,
    timer: 0,
    clutchDuration: 5,
    impactCount: 0,
    possessionCount: 0,
  };
}
function emit(r, type, extra = {}) {
  r.events.push({ type, ...extra });
}
function impact(r, obstacle) {
  const p = r.player;
  const relative = Math.abs(p.speed - (obstacle.speed || 0));
  const transfer = obstacle.kind
    ? (2 * tune[p.kind].mass) / (tune[p.kind].mass + tune[obstacle.kind].mass)
    : 1;
  p.damage = Math.min(100, p.damage + Math.round(24 + relative * 0.68 * (2 - transfer)));
  p.wreck = true;
  p.speed *= 1 - 0.24 * (2 - transfer);
  p.lateralSpeed = (p.lane <= obstacle.lane ? -21 : 21) * (2 - transfer);
  p.contactCooldown = 0.65;
  if ('speed' in obstacle && obstacle !== r.hearse) {
    obstacle.speed = Math.max(obstacle.speed, p.speed * 0.33 * transfer);
    obstacle.lateralSpeed = (p.lateralSpeed < 0 ? 1 : -1) * 10.92 * transfer;
    obstacle.contactCooldown = 0.65;
  }
  r.impactCount++;
  const distance = (c) => Math.hypot(separation(c.s, p.s), c.lane - p.lane);
  r.targets = r.cars
    .filter((c) => c !== r.hearse && !c.wreck && distance(c) < 154)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, 3);
  r.selected = 0;
  emit(r, 'impact', { car: p, obstacle });
  if (!r.targets.length) {
    decline(r);
    return;
  }
  r.phase = 'clutch';
  r.timer = r.clutchDuration;
  emit(r, 'clutch');
}
export function chooseTarget(r, delta = 1) {
  if (r.phase === 'clutch') r.selected = (r.selected + delta + r.targets.length) % r.targets.length;
}
export function possess(r) {
  if (r.phase !== 'clutch' || !r.targets[r.selected]) return false;
  r.phase = 'jump';
  r.timer = 0.48;
  emit(r, 'jump', { from: r.player, to: r.targets[r.selected] });
  return true;
}
export function decline(r) {
  if (r.phase !== 'clutch' && !(r.phase === 'drive' && r.player.wreck)) return false;
  r.targets = [];
  if (r.player.damage < 100) {
    r.player.wreck = false;
    r.phase = 'drive';
    r.immune = 1.5;
    emit(r, 'stay', { car: r.player });
    return true;
  }
  r.phase = 'tow';
  r.towS = r.player.s;
  r.timer = 1.4;
  emit(r, 'tow');
  return true;
}
function onCurve(s) {
  const v = wrap(s) % (STRAIGHT + ARC);
  return v >= STRAIGHT;
}
function advance(c, dt) {
  c.s += c.speed * dt * (onCurve(c.s) ? RADIUS / (RADIUS + c.lane) : 1);
}
function moveWrecks(r, dt) {
  const gate = r.barriers[0];
  for (const wreck of r.cars) {
    wreck.contactCooldown = Math.max(0, wreck.contactCooldown - dt);
    if (!wreck.wreck || wreck.speed <= 0) continue;
    advance(wreck, dt);
    wreck.lane = clamp(wreck.lane + wreck.lateralSpeed * dt, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH);
    wreck.speed = Math.max(0, wreck.speed - 4.3 * dt);
    wreck.lateralSpeed *= Math.exp(-0.22 * dt);
    if (
      !gate.broken &&
      Math.abs(separation(wreck.s, gate.s)) < 15 &&
      Math.abs(wreck.lane - gate.lane) < 17
    ) {
      gate.broken = r.shortcutOpen = true;
      wreck.speed *= 0.55;
      emit(r, 'shortcut', { barrier: gate, car: wreck });
    }
    if (wreck.contactCooldown || wreck.speed < 5) continue;
    for (const c of r.cars) {
      if (
        c === wreck ||
        c === r.player ||
        c.contactCooldown ||
        Math.abs(separation(wreck.s, c.s)) >= 14 ||
        Math.abs(wreck.lane - c.lane) >= 13
      )
        continue;
      if (c === r.hearse) continue;
      const transfer = (2 * tune[wreck.kind].mass) / (tune[wreck.kind].mass + tune[c.kind].mass);
      const shove = (c.lane >= wreck.lane ? 12 : -12) * transfer;
      c.lane = clamp(c.lane + shove * 0.35, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH);
      c.lateralSpeed += shove;
      if (!c.wreck) {
        c.stun = 1.3;
        c.speed *= 1 - 0.24 * transfer;
      } else c.speed = Math.max(c.speed, wreck.speed * 0.4 * transfer);
      wreck.speed *= 1 - 0.28 * (2 - transfer);
      wreck.lateralSpeed -= Math.sign(shove) * 5.4 * (2 - transfer);
      wreck.contactCooldown = c.contactCooldown = 0.75;
      emit(r, 'shove', { car: wreck, other: c });
      break;
    }
  }
}
function crossGates(r, key, from, to) {
  const gap = TRACK_LENGTH / 4;
  while (from <= r[key] * gap && to >= r[key] * gap) {
    if (key === 'nextGate') {
      r.gatesPassed = r[key];
      emit(r, 'gate', { index: r[key] % 4 });
    }
    r[key]++;
  }
}
function simulate(r, input, dt) {
  if (r.phase === 'won' || r.phase === 'lost') return;
  const p = r.player,
    phase = r.phase;
  const simDt = dt * (phase === 'clutch' || phase === 'jump' ? 0.09 : 1);
  r.time += simDt;
  r.immune = Math.max(0, r.immune - simDt);
  const before = p.s,
    rivalBefore = r.hearse.s;
  moveWrecks(r, simDt);
  if (phase === 'drive') {
    const t = tune[p.kind],
      steer = clamp(input.steer || 0, -1, 1);
    const edge = Math.abs(p.lane) > 61;
    const cap = t.max * (edge ? 0.8 : 1) * (1 - p.damage * 0.0015);
    const accel = input.brake ? -32 : input.gas ? t.acceleration : -4;
    p.speed = clamp(p.speed + accel * dt, 0, Math.max(cap, p.speed - 12 * dt));
    const drift = onCurve(p.s) ? 4.4 * (p.speed / t.max) ** 2 : 0;
    const desired = (steer * t.steer + drift) * Math.min(1, p.speed / 12);
    p.lateralSpeed += (desired - p.lateralSpeed) * (1 - Math.exp(-t.grip * dt));
    p.lane = clamp(p.lane + p.lateralSpeed * dt, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH);
    const sector = wrap(p.s);
    if (!r.shortcutOpen && sector > STRAIGHT + 50 && sector < STRAIGHT + ARC - 35)
      p.lane = Math.max(-43, p.lane);
    advance(p, dt);
  }
  for (const c of r.cars) {
    if (c === p || c.wreck) continue;
    const local = wrap(c.s);
    const cut =
      c === r.hearse && r.shortcutOpen && local > STRAIGHT - 110 && local < STRAIGHT + ARC - 50;
    const goal = c === r.hearse && c.stun ? c.avoidLane : cut ? -60 : c.homeLane;
    c.lane += clamp(goal - c.lane, -18 * simDt, 18 * simDt) + c.lateralSpeed * simDt;
    c.lane = clamp(c.lane, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH);
    c.lateralSpeed *= Math.exp(-2 * simDt);
    c.stun = Math.max(0, c.stun - simDt);
    c.speed = Math.min(c.cruise, c.speed + (c.stun ? 1 : 6) * simDt);
    advance(c, simDt);
    if (c !== r.hearse || c.stun) continue;
    const blockedBy = r.cars.find(
      (w) => w.wreck && Math.abs(separation(w.s, c.s)) < 14 && Math.abs(w.lane - c.lane) < 13,
    );
    if (blockedBy) {
      c.avoidLane = blockedBy.lane < 0 ? blockedBy.lane + 24 : blockedBy.lane - 24;
      c.speed *= 0.43;
      c.stun = 2.25;
      emit(r, 'hearseHit', { car: c, obstacle: blockedBy });
    }
  }
  const prior = r.progress;
  if (phase !== 'tow') r.progress += p.s - before;
  crossGates(r, 'nextGate', prior, r.progress);
  crossGates(r, 'hearseGate', rivalBefore, r.hearse.s);
  if (r.nextGate > 12 || r.hearseGate > 12) {
    const finish = TRACK_LENGTH * 3;
    const playerFraction = r.nextGate > 12 ? (finish - prior) / (r.progress - prior) : Infinity;
    const hearseFraction =
      r.hearseGate > 12 ? (finish - rivalBefore) / (r.hearse.s - rivalBefore) : Infinity;
    r.time -= simDt * (1 - Math.min(playerFraction, hearseFraction));
    r.phase = playerFraction <= hearseFraction ? 'won' : 'lost';
    emit(r, r.phase);
    return;
  }
  if (phase === 'drive') {
    const barrier = r.barriers[0];
    if (
      !barrier.broken &&
      Math.abs(separation(p.s, barrier.s)) < 10 &&
      Math.abs(p.lane - barrier.lane) < 15
    ) {
      barrier.broken = r.shortcutOpen = true;
      emit(r, 'shortcut', { barrier });
      impact(r, barrier);
    } else if (!r.immune && p.speed > 20) {
      const hit = r.cars.find(
        (c) =>
          c !== p &&
          (c.wreck || Math.abs(c.speed - p.speed) > 17) &&
          Math.abs(separation(p.s, c.s)) < 13 &&
          Math.abs(p.lane - c.lane) < 13,
      );
      if (hit) impact(r, hit);
    }
  } else {
    r.timer -= dt;
    if (r.timer <= 0 && phase === 'clutch') decline(r);
    if (r.timer <= 0 && phase === 'jump') {
      const next = r.targets[r.selected];
      next.s = p.s + separation(next.s, p.s);
      const beforeLanding = r.progress;
      r.progress += next.s - p.s;
      crossGates(r, 'nextGate', beforeLanding, r.progress);

      r.player = next;
      r.phase = 'drive';
      r.targets = [];
      r.immune = 2;
      r.possessionCount++;
      emit(r, 'possess', { car: next });
    }
    if (r.timer <= 0 && phase === 'tow') {
      const next = car('relief' + r.impactCount, 'tow', r.towS, p.lane < 0 ? 22 : -22, 30, 40);
      r.cars.push(next);
      r.player = next;
      r.phase = 'drive';
      r.immune = 2.5;
      emit(r, 'recover', { car: next });
    }
  }
  const lap = clamp(1 + Math.floor(r.gatesPassed / 4), 1, 3);
  if (lap > r.lap) {
    r.lap = lap;
    emit(r, 'lap', { lap });
  }
  if (r.nextGate > 12) {
    r.phase = 'won';
    emit(r, 'won');
  }
}
export function step(r, input = {}, dt = 1 / 60) {
  let remaining = Number.isFinite(dt) ? clamp(dt, 0, 0.25) : 0;
  while (remaining > 1e-8) {
    const transition =
      r.timer > 0 && ['clutch', 'jump', 'tow'].includes(r.phase) ? r.timer : Infinity;
    const slice = Math.min(remaining, 1 / 60, transition);
    simulate(r, input, slice);
    remaining -= slice;
  }
  return r;
}
