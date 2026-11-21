import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRace,
  trackPoint,
  step,
  possess,
  decline,
  chooseTarget,
  TRACK_LENGTH,
} from '../game/sim.mjs';

function driveUntil(r, done, limit = 12, input = { gas: true }) {
  for (let i = 0; i < limit * 60 && !done(); i++) step(r, input);
  assert.ok(done());
}
test('oval is continuous and repeats for negative and multi-lap positions', () => {
  for (const s of [-10, 0, 519, 520, 1069, 1600, 2000]) {
    const a = trackPoint(s, 29),
      b = trackPoint(s + 3 * TRACK_LENGTH, 29);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-8);
    const c = trackPoint(s + 0.001, 29);
    assert.ok(Math.hypot(a.x - c.x, a.y - c.y) < 0.002);
  }
});
test('signature crash leaves a wreck and offers multiple moving hosts before twelve seconds', () => {
  const r = makeRace(),
    first = r.player;
  driveUntil(r, () => r.phase === 'clutch');
  assert.ok(first.wreck);
  assert.ok(r.targets.every(host => host.speed > 0 && !host.wreck));
  assert.equal(r.targets[r.selected].kind, 'coupe');
  const tow = r.targets.findIndex(host => host.kind === 'tow');
  assert.ok(tow >= 0);
  chooseTarget(r, tow - r.selected);
  assert.ok(possess(r));
  driveUntil(r, () => r.phase === 'drive');
  assert.equal(r.player.kind, 'tow');
  assert.ok(r.cars.includes(first));
});
test('declining or timing out returns control to a surviving chassis', () => {
  for (const manual of [true, false]) {
    const r = makeRace();
    driveUntil(r, () => r.phase === 'clutch');
    if (manual) assert.ok(decline(r));
    driveUntil(r, () => r.phase === 'drive');
    assert.equal(r.player.kind, 'wagon');
    assert.ok(r.player.damage > 0 && !r.player.wreck);
  }
});
test('breaking the hay gate opens the inside line for the hearse', () => {
  const r = makeRace(),
    b = r.barriers[0];
  r.player.s = b.s - 11;
  r.player.lane = b.lane;
  r.hearse.s = 500;
  driveUntil(r, () => b.broken);
  assert.ok(r.shortcutOpen);
  driveUntil(r, () => r.hearse.lane < -50);
  assert.ok(r.hearse.lane < -50);
});
test('an abandoned wreck slows the hearse', () => {
  const r = makeRace();
  const wreck = r.cars.find((c) => c.wreck);
  const incoming = r.hearse.speed;
  wreck.s = r.hearse.s + 16;
  wreck.lane = r.hearse.lane;
  driveUntil(r, () => r.events.some((e) => e.type === 'hearseHit'));
  assert.ok(r.hearse.speed < incoming * 0.5);
});
test('three-lap race can be won via staged theft and ordinary driving inputs', () => {
  const r = makeRace();
  for (let i = 0; i < 60 * 170 && !['won', 'lost'].includes(r.phase); i++) {
    if (r.phase === 'clutch') possess(r);
    const steer = r.possessionCount ? Math.max(-1, Math.min(1, (-16 - r.player.lane) * 0.12)) : 0;
    step(r, { gas: true, steer });
  }
  assert.equal(r.phase, 'won');
  assert.equal(r.lap, 3);
  assert.ok(r.possessionCount > 0);
});
test('braking to a stop allows the hearse to finish first', () => {
  const r = makeRace();
  driveUntil(r, () => r.phase === 'lost', 180, { brake: true });
  assert.equal(r.player.speed, 0);
});

test('an abandoned starter coasts through the bales and leaves a persistent open passage', () => {
  const r = makeRace(),
    first = r.player;
  driveUntil(r, () => r.phase === 'clutch');
  const collision = first.s;
  possess(r);
  driveUntil(r, () => r.shortcutOpen);
  assert.ok(first.s > collision + 65 && first.wreck);
});
test('a totaled chassis requires a relief tow when the player stays', () => {
  const r = makeRace();
  r.player.damage = 65;
  driveUntil(r, () => r.phase === 'clutch');
  decline(r);
  assert.equal(r.phase, 'tow');
  driveUntil(r, () => r.phase === 'drive');
  assert.equal(r.player.kind, 'tow');
});
test('three persistent wrecks alternate lanes and leave the center clear in later sectors', () => {
  const wrecks = makeRace().cars.filter((c) => c.wreck);
  assert.deepEqual(
    wrecks.map((c) => c.kind),
    ['wagon', 'tow', 'coupe'],
  );
  assert.ok(wrecks[1].lane > 13 && wrecks[2].lane < -13);
  assert.ok(wrecks[2].s - wrecks[1].s > 400);
});
test('a heavier chassis delivers more momentum and takes less damage in the same impact', () => {
  const result = (kind) => {
    const r = makeRace(),
      wreck = r.cars.find((c) => c.id === 'pileup');
    r.player.kind = kind;
    r.player.s = wreck.s - 24;
    r.player.lane = wreck.lane;
    r.player.speed = 41;
    step(r, { gas: true });
    return { impulse: wreck.speed, damage: r.player.damage };
  };
  const coupe = result('coupe'),
    wagon = result('wagon'),
    tow = result('tow');
  assert.ok(tow.impulse > wagon.impulse && wagon.impulse > coupe.impulse);
  assert.ok(coupe.damage > wagon.damage && wagon.damage > tow.damage);
});
function atFinish(playerGap, hearseGap) {
  const r = makeRace();
  const line = TRACK_LENGTH * 3;
  r.nextGate = r.hearseGate = 12;
  r.gatesPassed = 11;
  r.lap = 3;
  r.immune = 2;
  r.player.s = r.progress = line - playerGap;
  r.player.speed = 48;
  r.hearse.s = line - hearseGap;
  r.hearse.lane = r.hearse.homeLane = -40;
  r.hearse.speed = r.hearse.cruise = 48;
  return r;
}
test('the earlier crossing wins when both cars finish in the same simulation step', () => {
  for (const [playerGap, hearseGap, expected] of [
    [0.5, 0.1, 'lost'],
    [0.1, 0.5, 'won'],
  ]) {
    const r = atFinish(playerGap, hearseGap);
    step(r, { gas: true });
    assert.equal(r.phase, expected);
    assert.ok(r.time < 1 / 60);
  }
});
test('a jump across the line scores at landing, after any earlier hearse crossing', () => {
  for (const [hearseGap, expected] of [
    [0.02, 'lost'],
    [0.06, 'won'],
  ]) {
    const r = atFinish(5, hearseGap);
    r.phase = 'jump';
    r.player.wreck = true;
    r.player.speed = 0;
    r.timer = 0.01;
    const host = r.cars.find((c) => c.kind === 'coupe' && !c.wreck);
    host.s = TRACK_LENGTH * 3 + 3;
    r.targets = [host];
    step(r, {});
    assert.equal(r.phase, expected);
  }
});
test('a rolling wreck and relief spawn earn no forward progress during a tow', () => {
  const r = atFinish(0.1, 400);
  r.phase = 'clutch';
  r.player.wreck = true;
  r.player.damage = 100;
  const wreck = r.player,
    spot = wreck.s;
  decline(r);
  step(r, {}, 0.25);
  assert.ok(wreck.s > spot);
  assert.equal(r.progress, spot);
  driveUntil(r, () => r.phase === 'drive', 2);
  assert.ok(r.player.s < TRACK_LENGTH * 3 && r.nextGate === 12);
  step(r, { gas: true });
  assert.equal(r.phase, 'won');
});
