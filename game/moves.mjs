export const ABILITIES = {
  coupe: { name: 'Redline', description: 'Kick into overdrive for 2.8 seconds.', cooldown: 7 },
  wagon: { name: 'Pallbearer', description: 'Guard against impacts and rival attacks for 3 seconds.', cooldown: 10 },
  tow: { name: 'Grave Hook', description: 'Steal speed from a car ahead. Rivals take priority.', cooldown: 8 },
  ambulance: { name: 'Second Wind', description: 'At 55 MPH, repair 32 damage and recover 8 soul.', cooldown: 16 },
};
export const DRAFT = { minGap: 27, maxGap: 158, halfWidth: 24, minSpeed: 32, minDonorSpeed: 24 };

const chassis = Object.keys(ABILITIES);
const jumpReach = 180;
const chainWindow = 9;

export function resetMoves(r) {
  r.moves = { cooldowns: { coupe: 0, wagon: 0, tow: 0, ambulance: 0 } };
  Object.assign(r, {
    charge: 0, draftCar: null, hasTarget: false,
    chain: 0, chainLeft: 0, bestChain: 0, draftJumps: 0,
    cooldown: 0, boost: 0, guard: 0, abilityFx: null,
  });
}

function forwardGap(r, c) {
  const gap = (c.s - r.player.s) % r.trackLength;
  return gap < 0 ? gap + r.trackLength : gap;
}

function livingHost(r, car, gap) {
  return car !== r.player && !car.enemy && car !== r.hearse && !car.wreck && car.speed > 5
    && Object.prototype.hasOwnProperty.call(ABILITIES, car.kind) && gap >= 18 && gap <= jumpReach;
}

export function updateMoves(r, input, dt) {
  if (r.phase !== 'drive') return;
  for (const kind of chassis) {
    r.moves.cooldowns[kind] = Math.max(0, r.moves.cooldowns[kind] - dt);
  }
  r.cooldown = r.moves.cooldowns[r.player.kind];
  r.boost = Math.max(0, r.boost - dt);
  r.guard = Math.max(0, r.guard - dt);
  r.chainLeft = Math.max(0, r.chainLeft - dt);
  if (!r.chainLeft) r.chain = 0;
  if (r.abilityFx) {
    r.abilityFx.left -= dt;
    if (r.abilityFx.left <= 0) r.abilityFx = null;
  }

  r.hasTarget = false;
  r.draftCar = null;
  const pulling = input.gas && !input.brake && r.player.speed >= DRAFT.minSpeed;
  let closest = Infinity;
  for (const c of r.cars) {
    if (c === r.player || c.wreck) continue;
    const gap = forwardGap(r, c);
    if (livingHost(r, c, gap)) r.hasTarget = true;
    if (pulling && c.speed >= DRAFT.minDonorSpeed && gap >= DRAFT.minGap && gap <= DRAFT.maxGap
      && gap < closest && Math.abs(c.lane - r.player.lane) <= DRAFT.halfWidth) {
      r.draftCar = c;
      closest = gap;
    }
  }
  if (r.charge === 1) return;
  if (r.draftCar) {
    r.charge = Math.min(1, r.charge + dt * (0.63 - 0.001 * (closest - DRAFT.minGap)));
    if (r.charge === 1) r.events.push({ type: 'draftReady' });
  } else {
    r.charge = Math.max(0, r.charge - dt * 0.055);
  }
}

export function startDraftJump(r) {
  if (r.phase !== 'drive' || r.player.wreck || r.charge < 1) return false;
  const targets = r.cars.filter(c => livingHost(r, c, forwardGap(r, c)))
    .sort((a, b) => forwardGap(r, a) - forwardGap(r, b)).slice(0, 3);
  r.hasTarget = targets.length > 0;
  if (!r.hasTarget) return false;
  r.targets = targets;
  r.selected = 0;
  r.jumpMode = 'draft';
  r.phase = 'clutch';
  r.timer = r.clutchDuration;
  r.draftCar = null;
  r.events.push({ type: 'clutch', mode: 'draft' });
  return true;
}

export function clearChain(r) {
  r.chain = r.chainLeft = r.boost = 0;
  r.draftCar = null;
  r.hasTarget = false;
}

export function landMove(r, next) {
  r.guard = 0;
  r.abilityFx = null;
  r.cooldown = r.moves.cooldowns[next.kind];
  r.draftCar = null;
  r.hasTarget = false;
  if (r.jumpMode !== 'draft') return;
  r.charge = 0;
  r.chain = r.chainLeft > 0 ? r.chain + 1 : 1;
  r.chainLeft = chainWindow;
  r.bestChain = Math.max(r.bestChain, r.chain);
  r.draftJumps++;
  const tier = Math.min(4, r.chain);
  r.boost = Math.max(r.boost, 0.8 + tier * 0.55);
  next.speed = Math.max(next.speed, Math.min(next.topSpeed + 24, next.speed + 4 + tier * 3));
  r.events.push({ type: 'relay', chain: r.chain, car: next });
}

function hookTarget(r) {
  let target = null, best = Infinity;
  for (const c of r.cars) {
    if (c === r.player || c.wreck || c.speed < 12 || Math.abs(c.lane - r.player.lane) > 56) continue;
    const gap = forwardGap(r, c);
    if (gap < 18 || gap > 170) continue;
    const rank = gap - (c.enemy || c === r.hearse ? 180 : 0);
    if (rank < best) {
      best = rank;
      target = c;
    }
  }
  return target;
}

export function useAbility(r) {
  if (r.phase !== 'drive' || r.player.wreck) return false;
  const p = r.player, kind = p.kind, ability = ABILITIES[kind];
  if (!ability || r.moves.cooldowns[kind] > 0) return false;
  let target = p, duration = 1.2, miss = '';
  if (kind === 'coupe') {
    duration = 2.8;
    p.speed = Math.max(p.speed, Math.min(p.topSpeed + 32, p.speed + 38));
    r.boost = Math.max(r.boost, duration);
  } else if (kind === 'wagon') {
    r.guard = duration = 3;
  } else if (kind === 'tow') {
    target = hookTarget(r);
    if (!target) miss = 'Grave Hook needs a car ahead';
    else {
      const stolen = Math.min(35, target.speed * 0.4);
      target.speed -= stolen;
      target.stun = Math.max(target.stun, 2);
      p.speed = Math.max(p.speed, Math.min(p.topSpeed + 32, p.speed + stolen));
      r.boost = Math.max(r.boost, 2);
    }
  } else if (kind === 'ambulance') {
    if (p.speed < 40) miss = 'Reach 55 MPH for Second Wind';
    else if (p.damage <= 0 && r.soul >= 100) miss = 'Chassis and soul are full';
    else {
      p.damage = Math.max(0, p.damage - 32);
      r.soul = Math.min(100, r.soul + 8);
    }
  }
  if (miss) {
    r.events.push({ type: 'abilityMiss', message: miss });
    return false;
  }
  r.moves.cooldowns[kind] = r.cooldown = ability.cooldown;
  r.abilityFx = { kind, target, duration, left: duration };
  r.events.push({ type: 'ability', kind, name: ability.name, target });
  return true;
}
