import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRace, step, decline, TRACK_LENGTH } from '../game/sim.mjs';
import { useAbility } from '../game/moves.mjs';

function drive(r, seconds, input = { gas: true }) {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(r, input);
}

function encounter(kind) {
  const r = makeRace();
  r.cars = [r.player, r.hearse, r.hound];
  Object.assign(r, { time: 20, progress: 200 });
  Object.assign(r.player, { s: 200, speed: 67 });
  Object.assign(r.hearse, { s: kind === 'bell' ? 270 : 460, speed: 74, cruise: 74 });
  Object.assign(r.hound, { s: kind === 'ram' ? 146 : -300, lane: 14, speed: 67 });
  if (kind === 'bell') r.ramAt = Infinity;
  else r.bellAt = Infinity;
  return r;
}

test('all four starters use worn chassis and every course seed can be replayed', () => {
  for (const kind of ['wagon', 'coupe', 'tow', 'ambulance']) {
    const r = makeRace(kind, 123);
    assert.equal(r.player.kind, kind);
    assert.ok(r.cars.some(c => c.kind === kind && !c.enemy && c.topSpeed > r.player.topSpeed));
    assert.equal(r.hearse.enemy, 'hearse');
    assert.equal(r.hound.enemy, 'hound');
  }
  const grid = seed => makeRace('wagon', seed).cars.map(c => [c.kind, c.s, c.lane, c.cruise]);
  assert.deepEqual(grid(123), grid(123));
  assert.notDeepEqual(grid(123), grid(124));
  assert.deepEqual(grid(), grid(0));
});

for (const kind of ['bell', 'ram']) {
  test(kind + ' telegraphs a fixed lane, damages a body there and can be dodged or guarded', () => {
    for (const defense of ['hold', 'dodge', 'guard', 'out of range', 'stun']) {
      const r = encounter(kind);
      step(r, { gas: true });
      const threat = r.threats[0];
      assert.equal(threat.kind, kind);
      assert.equal(threat.time, threat.duration);
      assert.ok(threat.duration >= 1);
      assert.equal(r.events.at(-1).car, threat.source);
      if (defense === 'guard') assert.ok(useAbility(r));
      if (defense === 'stun') threat.source.stun = 3;
      if (defense === 'out of range') threat.source.s += kind === 'bell' ? 400 : -400;
      const steer = defense === 'dodge' ? 1 : 0;
      drive(r, 0.75, { gas: true, steer });
      assert.equal(threat.lane, 0);
      assert.ok(threat.time > 0);
      assert.equal(r.player.damage, 0);
      drive(r, 0.8, { gas: true, steer });
      const result = r.events.filter(e => e.type === 'strike' || e.type === 'evade');
      assert.equal(result.length, 1);
      assert.equal(result[0].type, defense === 'hold' ? 'strike' : 'evade');
      assert.equal(result[0].kind, kind);
      assert.equal(r.player.damage > 0, defense === 'hold');
      assert.equal(r.threats.length, 0);
    }
  });
}

test('a rival can total a damaged car, but neither rival is a host', () => {
  const r = encounter('ram');
  r.player.damage = 85;
  r.chain = 3;
  drive(r, 1.5);
  assert.equal(r.phase, 'tow');
  assert.equal(r.chain, 0);
  assert.equal(r.player.damage, 100);
  assert.ok(!r.targets.length);
  const count = r.events.filter(e => e.type === 'strike').length;
  drive(r, 2);
  assert.equal(r.phase, 'drive');
  assert.equal(r.events.filter(e => e.type === 'strike').length, count);
});

test('the opening and small gaps are free, a lead heals and a sustained deficit ends the run', () => {
  const r = encounter('bell');
  r.cars = [r.player, r.hearse];
  r.time = 0;
  r.hearse.s = 620;
  r.soul = 60;
  drive(r, 2);
  assert.equal(r.drain, 0);
  assert.equal(r.soul, 60);
  r.time = 20;
  r.hearse.s = r.progress + 25;
  drive(r, 0.25);
  assert.equal(r.soul, 60);
  r.hearse.s = r.progress - 90;
  drive(r, 1);
  assert.ok(r.soul > 60 && r.soul < 64);
  r.hearse.s = r.progress + 300;
  drive(r, 1);
  assert.ok(r.drain > 0 && r.soul < 60);
  r.soul = 0.01;
  drive(r, 0.25);
  assert.equal(r.soul, 0);
  assert.equal(r.phase, 'lost');
  assert.ok(r.lossReason);
  const record = r.furthest;
  drive(r, 2);
  assert.equal(r.furthest, record);
  assert.equal(r.events.filter(e => e.type === 'lost').length, 1);
});

test('the hearse physically closes large leads and difficulty stops accelerating at its cap', () => {
  const r = makeRace();
  Object.assign(r, { lap: 18, nextGate: 72, gatesPassed: 71, progress: TRACK_LENGTH * 18 - 0.3 });
  r.cars = [r.player, r.hearse];
  Object.assign(r.player, { s: r.progress, speed: 57 });
  r.hearse.s = r.progress - 1100;
  const before = r.hearse.s;
  step(r, { gas: true });
  assert.equal(r.lap, 19);
  assert.equal(r.difficulty, 10);
  assert.equal(r.hearse.surge, 76);
  assert.ok(r.hearse.s > before && r.hearse.s - before < 2);
  r.hearse.s = r.progress - 120;
  step(r, { gas: true });
  assert.equal(r.hearse.surge, 0);
});

test('wrecks persist for the next circuit and then recycle offscreen without growing the field', () => {
  const r = makeRace();
  const host = r.cars.find(c => c.id === 'redline');
  Object.assign(host, { wreck: true, abandonedAt: 0, s: r.player.s + 700, speed: 0 });
  r.furthest = TRACK_LENGTH + 5;
  step(r);
  assert.ok(r.cars.includes(host));
  const size = r.cars.length;
  r.furthest = TRACK_LENGTH * 1.26;
  const farthestBefore = r.furthest;
  step(r);
  assert.equal(r.cars.length, size);
  assert.ok(!r.cars.includes(host));
  assert.equal(r.cars.find(c => c.id === host.id).wreck, false);
  assert.equal(r.furthest, farthestBefore);
  for (let i = 0; i < 10; i++) {
    Object.assign(r.player, { wreck: true, damage: 100 });
    r.phase = 'clutch';
    decline(r);
    drive(r, 1.5);
    assert.equal(r.cars.length, size);
    assert.equal(r.phase, 'drive');
  }
});
