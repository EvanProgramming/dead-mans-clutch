import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, resetMoves, updateMoves, startDraftJump, landMove, clearChain, useAbility } from '../game/moves.mjs';
import { makeRace, step, decline, chooseTarget, possess } from '../game/sim.mjs';

const car = (kind, s, lane = 0) => ({ kind, s, lane, speed: 80, topSpeed: 105, stun: 0, damage: 0 });
function race(kind = 'wagon') {
  const player = car(kind, 950);
  const r = { player, cars: [player], trackLength: 1000, phase: 'drive', soul: 100, clutchDuration: 5, events: [] };
  resetMoves(r);
  return r;
}
const tick = (r, seconds, input = { gas: true }) => updateMoves(r, input, seconds);

test('opening throttle banks a jump before the crash and supports cancel, choice, release and relay', () => {
  const r = makeRace(), starter = r.player;
  for (let i = 0; i < 180 && r.charge < 1; i++) step(r, { gas: true });
  assert.equal(r.impactCount, 0);
  assert.ok(startDraftJump(r));
  assert.ok(r.targets.length > 1);
  assert.ok(decline(r));
  assert.equal(r.charge, 1);
  assert.equal(starter.wreck, false);
  assert.ok(startDraftJump(r));
  chooseTarget(r, 1);
  const selected = r.targets[r.selected];
  assert.ok(possess(r));
  for (let i = 0; i < 40 && r.phase !== 'drive'; i++) step(r, { gas: true });
  assert.equal(r.player, selected);
  assert.equal(starter.wreck, true);
  assert.equal(r.chain, 1);
  assert.ok(r.boost > 0 && r.charge < 0.01);
});

test('a rival across the lap seam feeds the draft, with banked charge and no rival possession', () => {
  const r = race(), rival = car('coupe', 5);
  rival.enemy = 'hound';
  r.cars.push(rival);
  tick(r, 1);
  assert.equal(r.draftCar, rival);
  assert.ok(r.charge > 0 && r.charge < 1);
  tick(r, 2);
  assert.equal(r.charge, 1);
  for (const input of [{}, { gas: true, brake: true }]) {
    tick(r, 3, input);
    assert.equal(r.draftCar, null);
    assert.equal(r.charge, 1);
  }
  assert.equal(r.hasTarget, false);
  assert.equal(startDraftJump(r), false);
  assert.equal(r.phase, 'drive');
  assert.equal(r.events.filter(e => e.type === 'draftReady').length, 1);
});

test('charging requires a moving, aligned car ahead while on throttle', () => {
  const r = race(), donor = car('coupe', 15, 39);
  r.cars.push(donor);
  tick(r, 1);
  donor.lane = 0;
  donor.wreck = true;
  tick(r, 1);
  donor.wreck = false;
  donor.s = 900;
  tick(r, 1);
  donor.s = 15;
  donor.speed = 0;
  tick(r, 1);
  donor.speed = 70;
  tick(r, 1, { brake: true, gas: true });
  r.player.speed = 0;
  tick(r, 1);
  assert.equal(r.charge, 0);
});

test('manual target choice sorts at most three forward hosts and spends the bank on landing', () => {
  const r = race(), behind = car('coupe', 941), hearse = car('hearse', 990);
  const dead = car('wagon', 995), rival = car('coupe', 4), ambulance = car('ambulance', 2);
  dead.wreck = true;
  rival.enemy = 'hound';
  r.hearse = hearse;
  r.cars.push(car('tow', 115), behind, hearse, dead, rival, car('coupe', 42), ambulance, car('wagon', 13));
  r.charge = 1;
  assert.equal(startDraftJump(r), true);
  assert.equal(r.jumpMode, 'draft');
  assert.equal(r.phase, 'clutch');
  assert.deepEqual(r.targets.map(c => c.kind), ['ambulance', 'wagon', 'coupe']);
  assert.equal(r.charge, 1);
  assert.equal(r.player.wreck, undefined);
  landMove(r, ambulance);
  assert.equal(r.charge, 0);
  assert.equal(r.draftJumps, 1);
  assert.ok(ambulance.speed > 80 && r.boost > 0);
});

test('relay tiers reward closely timed manual landings and preserve the record after a crash', () => {
  const r = race(), host = car('tow', 45);
  r.jumpMode = 'draft';
  landMove(r, host);
  const first = r.boost;
  tick(r, 7);
  landMove(r, host);
  assert.equal(r.chain, 2);
  assert.ok(r.boost > first);
  r.phase = 'clutch';
  tick(r, 20);
  assert.equal(r.chain, 2);
  r.phase = 'drive';
  tick(r, 11);
  assert.equal(r.chain, 0);
  landMove(r, host);
  assert.equal(r.chain, 1);
  clearChain(r);
  r.jumpMode = 'crash';
  landMove(r, host);
  assert.equal(r.chain, 0);
  assert.equal(r.bestChain, 2);
  assert.equal(r.draftJumps, 3);
});

test('Redline and Pallbearer have separate timers that follow the soul across swaps', () => {
  const r = race('coupe'), speed = r.player.speed;
  assert.ok(useAbility(r));
  assert.ok(r.boost > 0 && r.player.speed > speed);
  r.player = car('wagon', 300);
  landMove(r, r.player);
  assert.equal(r.cooldown, 0);
  assert.ok(useAbility(r));
  assert.equal(r.guard, 3);
  r.player = car('coupe', 320);
  landMove(r, r.player);
  assert.equal(r.guard, 0);
  assert.equal(r.cooldown, ABILITIES.coupe.cooldown);
  assert.equal(useAbility(r), false);
  tick(r, 8);
  assert.ok(useAbility(r));
});

test('Grave Hook steals speed from a forward rival before a closer traffic car', () => {
  const r = race('tow');
  assert.equal(useAbility(r), false);
  assert.equal(r.cooldown, 0);
  const traffic = car('coupe', 2), rival = car('hearse', 43);
  r.hearse = rival;
  r.cars.push(traffic, rival);
  assert.ok(useAbility(r));
  assert.ok(r.player.speed > 80 && rival.speed < 80 && rival.stun > 0);
  assert.equal(traffic.speed, 80);
  assert.equal(r.abilityFx.target, rival);
});

test('Second Wind requires motion, caps restoration, and a fresh ambulance cannot bypass its cooldown', () => {
  const r = race('ambulance');
  assert.equal(useAbility(r), false);
  r.player.damage = 25;
  r.player.speed = 0;
  r.soul = 96;
  assert.equal(useAbility(r), false);
  assert.equal(r.cooldown, 0);
  r.player.speed = 60;
  assert.ok(useAbility(r));
  assert.equal(r.player.damage, 0);
  assert.equal(r.soul, 100);
  r.player = car('ambulance', 700);
  r.soul = 70;
  landMove(r, r.player);
  assert.equal(useAbility(r), false);
  tick(r, 17);
  assert.ok(useAbility(r));
  assert.equal(r.soul, 78);
});
