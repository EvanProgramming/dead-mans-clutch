export const STRAIGHT = 850;
export const RADIUS = 365;
const ARC = Math.PI * RADIUS;
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
  wagon: { max: 105, acceleration: 31, steer: 52, mass: 1.25, grip: 5.0 },
  coupe: { max: 124, acceleration: 44, steer: 66, mass: 0.85, grip: 6.2 },
  tow: { max: 95, acceleration: 25, steer: 47, mass: 2, grip: 4.2 },
  hearse: { max: 101, acceleration: 32, steer: 58, mass: 1.65, grip: 5.2 },
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
    passLane: lane,
    rethinkAt: 0,
    topSpeed: tune[kind].max,
    lateralSpeed: 0,
    wreck: false,
    stun: 0,
    damage: 0,
    contactCooldown: 0,
  };
}
export function makeRace() {
  const player = car('starter', 'wagon', 0, 0, 57);
  player.topSpeed = 67; // The starter is running on five cylinders.
  const hearse = car('hearse', 'hearse', 39, -35, 86, 98);
  const cars = [
    player, hearse,
    car('redline', 'coupe', -337, 27, 99, 99),
    car('wrecker', 'tow', -156, -30, 81, 81),
    car('backmarker', 'wagon', 285, 8, 43, 43),
    car('outside-rail', 'wagon', 34, 46, 85),
    car('pace-hauler', 'tow', 95, 17, 76),
    car('flyer', 'coupe', -39, 47, 106),
    car('inside-runner', 'coupe', -104, -50, 109),
  ];
  // Stagger four-car packs. The faster row catches the slower row from the green flag onward.
  const lanes = [-50, -27, -4, 21, 48];
  const lineups = [
    [['wagon', 75], ['coupe', 109], ['tow', 58], ['coupe', 118]],
    [['coupe', 102], ['tow', 71], ['wagon', 88], ['coupe', 112]],
    [['tow', 68], ['wagon', 81], ['coupe', 116], ['wagon', 94]],
  ];
  for (let pack = 0; pack < 12; pack++) {
    const start = 450 + pack * (TRACK_LENGTH - 900) / 12;
    for (const [row, [kind, pace]] of lineups[pack % 3].entries()) {
      const s = start + [0, 34, 79, 117][row];
      const lane = lanes[(pack * 2 + row * 3) % lanes.length];
      cars.push(car('pack-' + pack + '-' + row, kind, s, lane, pace));
    }
  }
  for (const [id, kind, s, lane] of [
    ['pileup', 'wagon', STRAIGHT - 75, 43],
    ['backstretch-hauler', 'tow', TRACK_LENGTH * 0.61, 26],
    ['banked-coupe', 'coupe', TRACK_LENGTH * 0.86, -20],
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
function impact(r, obstacle, closingSpeed = 0) {
  const p = r.player;
  const relative = Math.max(closingSpeed, Math.abs(p.speed - (obstacle.speed || 0)));
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
  const firstCoupe = r.impactCount === 1 ? r.targets.findIndex(c => c.kind === 'coupe') : -1;
  r.selected = Math.max(0, firstCoupe);
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
    if (!wreck.wreck || (wreck.speed <= 0 && Math.abs(wreck.lateralSpeed) < 0.02)) continue;
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
  }
}

// Bounds enclose the rotated shell and tires in track coordinates, including bend sagitta.
export function bodyYaw(c) {
  return clamp(-c.lateralSpeed * 0.01, -0.22, 0.22) + (c.wreck ? 0.22 : 0);
}
function halfWidth(c) {
  return 6.2 + 11.5 * Math.abs(Math.sin(bodyYaw(c)));
}
function contact(a, b) {
  const ds = separation(b.s, a.s);
  if (Math.abs(ds) > 45) return;
  const dl = b.lane - a.lane;
  const lateral = halfWidth(a) + halfWidth(b) - Math.abs(dl);
  if (lateral <= 0) return;
  const curved = onCurve(a.s) || onCurve(b.s);
  const scale = curved ? Math.min(1, 1 + (Math.min(a.lane, b.lane) - 12) / RADIUS) : 1;
  const length = a.kind === 'hearse' || b.kind === 'hearse' ? 26.3 : 25.6;
  const longitudinal = length - Math.abs(ds) * scale;
  if (longitudinal <= 0) return;
  return { ds, dl, lateral, longitudinal, scale };
}
function react(r, a, b, hit, side) {
  const sign = Math.sign(side ? hit.dl : hit.ds) || 1;
  const closing = sign * (side ? a.contactLaneSpeed - b.contactLaneSpeed : a.speed - b.speed);
  const player = a === r.player || b === r.player;
  const other = a === r.player ? b : a;
  if (player && r.phase === 'drive' && !r.immune && closing > (side ? 16 : 17)) {
    impact(r, other, closing);
    return;
  }
  const wreck = a.wreck && (!b.wreck || a.speed >= b.speed) ? a : b.wreck ? b : null;
  const victim = wreck === a ? b : a;
  if (wreck && victim === r.hearse && !victim.stun) {
    victim.avoidLane = wreck.lane < 0 ? wreck.lane + 24 : wreck.lane - 24;
    victim.speed *= 0.43;
    victim.stun = 2.25;
    emit(r, 'hearseHit', { car: victim, obstacle: wreck });
  } else if (wreck && wreck.speed > 5 && !wreck.contactCooldown && !victim.contactCooldown) {
    const transfer = 2 * tune[wreck.kind].mass / (tune[wreck.kind].mass + tune[victim.kind].mass);
    const shove = (victim.lane >= wreck.lane ? 12 : -12) * transfer;
    victim.lateralSpeed += shove;
    victim.speed = victim.wreck
      ? Math.max(victim.speed, wreck.speed * 0.4 * transfer)
      : victim.speed * (1 - 0.24 * transfer);
    if (!victim.wreck) victim.stun = 1.3;
    wreck.speed *= 1 - 0.28 * (2 - transfer);
    wreck.lateralSpeed -= Math.sign(shove) * 5.4 * (2 - transfer);
    wreck.contactCooldown = victim.contactCooldown = 0.75;
    emit(r, 'shove', { car: wreck, other: victim });
  } else if (!side && closing > 0 && !a.contactCooldown && !b.contactCooldown) {
    const rear = sign > 0 ? a : b;
    const front = rear === a ? b : a;
    if (!front.wreck && (front !== r.player || front.speed > 1)) {
      const share = tune[rear.kind].mass / (tune[rear.kind].mass + tune[front.kind].mass);
      front.speed += closing * 0.15 * share;
    }
    rear.speed = Math.min(rear.speed, front.speed);
  }
}
function separateCars(r) {
  // Revisit contacts disturbed by another pair's correction in a bunched pack.
  for (let pass = 0; pass < 48; pass++) {
    let moved = false;
    for (let i = 0; i < r.cars.length; i++) {
      const a = r.cars[i];
      for (let j = i + 1; j < r.cars.length; j++) {
        const b = r.cars[j], hit = contact(a, b);
        if (!hit) continue;
        const side = hit.lateral < hit.longitudinal;
        if (pass === 0) react(r, a, b, hit, side);
        const sign = Math.sign(side ? hit.dl : hit.ds) || 1;
        const share = tune[b.kind].mass / (tune[a.kind].mass + tune[b.kind].mass);
        if (side) {
          const gap = hit.lateral + 0.04;
          const roomA = ROAD_HALF_WIDTH + sign * a.lane;
          const roomB = ROAD_HALF_WIDTH - sign * b.lane;
          const moveA = clamp(gap * share, Math.max(0, gap - roomB), roomA);
          a.lane -= sign * moveA;
          b.lane += sign * (gap - moveA);
        } else {
          const gap = (hit.longitudinal + 0.04) / hit.scale;
          a.s -= sign * gap * share;
          b.s += sign * gap * (1 - share);
        }
        moved = true;
      }
    }
    if (!moved) return;
  }
  // A completely jammed row can have no remaining lateral space at the wall.
  for (let j = 1; j < r.cars.length; j++) {
    const car = r.cars[j];
    if (r.cars.slice(0, j).some(c => contact(car, c))) findSpace(r, car);
  }
}
function findSpace(r, car) {
  const origin = car.s, preferred = car.lane;
  for (let back = 0; ; back += 32) {
    car.s = origin - back;
    for (const lane of [preferred, 0, -22, 22, -44, 44, -64, 64]) {
      car.lane = lane;
      if (r.cars.every(c => c === car || !contact(car, c))) return;
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
// Drivers pick a passing line from the gaps they can see, then commit briefly.
function passingLane(r, car, preferred) {
  if (r.time < car.rethinkAt) return car.passLane;
  car.rethinkAt = r.time + 0.27 + (car.cruise % 7) * 0.018;
  const nearby = [];
  for (const other of r.cars) {
    if (other === car) continue;
    const gap = separation(other.s, car.s);
    const ahead = 34 + Math.max(0, car.cruise - other.speed) * 1.2;
    if (gap < -31 || gap > ahead) continue;
    nearby.push({ lane: other.lane, weight: gap < 0 ? 0.78 : 1 - 0.45 * gap / ahead });
  }
  let best = preferred;
  let lowest = Infinity;
  for (const lane of [preferred, car.passLane, -53, -30, -7, 16, 39, 57]) {
    let cost = Math.abs(lane - preferred) * 0.25 + Math.abs(lane - car.lane) * 0.38;
    for (const other of nearby) {
      cost += Math.max(0, 23 - Math.abs(lane - other.lane)) * 3.8 * other.weight;
    }
    if (cost < lowest) { lowest = cost; best = lane; }
  }
  car.passLane = best;
  return best;
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
  for (const c of r.cars) c.previousLane = c.lane;
  moveWrecks(r, simDt);
  if (phase === 'drive') {
    const t = tune[p.kind],
      steer = clamp(input.steer || 0, -1, 1);
    const edge = Math.abs(p.lane) > 61;
    const cap = p.topSpeed * (edge ? 0.8 : 1) * (1 - p.damage * 0.0015);
    const accel = input.brake ? -74 : input.gas ? t.acceleration : -8;
    p.speed = clamp(p.speed + accel * dt, 0, Math.max(cap, p.speed - 24 * dt));
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
    const preferred = cut ? -56 : c.homeLane;
    const goal = c === r.hearse && c.stun && Number.isFinite(c.avoidLane)
      ? c.avoidLane : passingLane(r, c, preferred);
    const steerRate = c === r.hearse ? 47 : 31;
    c.lane += clamp(goal - c.lane, -steerRate * simDt, steerRate * simDt) + c.lateralSpeed * simDt;
    c.lane = clamp(c.lane, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH);
    c.lateralSpeed *= Math.exp(-2 * simDt);
    c.stun = Math.max(0, c.stun - simDt);
    c.speed = Math.min(c.cruise, c.speed + (c.stun ? 4 : 22) * simDt);
    advance(c, simDt);
  }
  if (phase === 'drive' && r.phase === 'drive') {
    const barrier = r.barriers[0];
    if (
      !barrier.broken &&
      Math.abs(separation(p.s, barrier.s)) < 10 &&
      Math.abs(p.lane - barrier.lane) < 15
    ) {
      barrier.broken = r.shortcutOpen = true;
      emit(r, 'shortcut', { barrier });
      impact(r, barrier);
    }
  }
  for (const c of r.cars) c.contactLaneSpeed = (c.lane - c.previousLane) / simDt;
  separateCars(r);
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
  if (phase !== 'drive') {
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
      findSpace(r, next);
      next.homeLane = next.lane;
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
  const tick = 1 / 60;
  r.accumulator = (r.accumulator || 0) + (Number.isFinite(dt) ? clamp(dt, 0, 0.25) : 0);
  while (r.accumulator >= tick - 1e-9) {
    r.accumulator = Math.max(0, r.accumulator - tick);
    let remaining = tick;
    while (remaining > 1e-8) {
      const transition = r.timer > 0 && ['clutch', 'jump', 'tow'].includes(r.phase) ? r.timer : Infinity;
      const slice = Math.min(remaining, transition);
      simulate(r, input, slice);
      remaining -= slice;
    }
  }
  return r;
}
