import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRace, step, trackPoint, TRACK_LENGTH, decline, possess, bodyYaw } from '../game/sim.mjs';

function setup() {
  const r = makeRace();
  const host = r.cars.find(c => !c.wreck && !c.enemy && c !== r.player);
  r.cars = [r.player, host, r.hearse];
  r.hearse.s = 400;
  return { r, p: r.player, host };
}

// Project the four shell corners onto both cars' axes independently of the contact solver.
function shellsOverlap(a, b) {
  function shell(c) {
    const p = trackPoint(c.s, c.lane);
    const angle = p.angle + bodyYaw(c);
    return {
      p, axes: [[Math.cos(angle), Math.sin(angle)], [-Math.sin(angle), Math.cos(angle)]],
      length: c.kind === 'hearse' ? 12.25 : 11.1,
    };
  }
  const u = shell(a), v = shell(b);
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
  const radius = (car, axis) =>
    car.length * Math.abs(dot(car.axes[0], axis)) + 5.2 * Math.abs(dot(car.axes[1], axis));
  const delta = [u.p.x - v.p.x, u.p.y - v.p.y];
  return [...u.axes, ...v.axes].every(axis =>
    Math.abs(dot(delta, axis)) < radius(u, axis) + radius(v, axis)
  );
}

test('matched-speed cars separate across the lap seam even during grace', () => {
  const { r, p, host } = setup();
  Object.assign(p, { s: TRACK_LENGTH - 4, lane: 0, speed: 32 });
  Object.assign(host, { s: 4, lane: 0, homeLane: 0, speed: 32, cruise: 32 });
  r.immune = 1;
  step(r);
  assert.ok(!shellsOverlap(p, host));
  assert.equal(r.impactCount, 0);
});

test('steering into matched traffic can trigger a clutch', () => {
  const { r, p, host } = setup();
  Object.assign(p, { s: 100, lane: -16, speed: 40, lateralSpeed: 30 });
  Object.assign(host, { s: 100, lane: 0, homeLane: 0, passLane: 0, rethinkAt: Infinity, speed: 40, cruise: 40 });
  step(r, { gas: true, steer: 1 }, 0.25);
  assert.equal(r.phase, 'clutch');
  assert.equal(r.impactCount, 1);
  assert.ok(!host.wreck);
});

test('a relief tow selects a clear spot around a blocked recovery lane', () => {
  const { r, p, host } = setup();
  Object.assign(p, { s: 100, lane: 0, speed: 0, wreck: true, damage: 100 });
  Object.assign(host, { s: 100, lane: -22, homeLane: -22, speed: 0, cruise: 0 });
  r.phase = 'clutch';
  decline(r);
  for (let i = 0; i < 6; i++) step(r, {}, 0.25);
  assert.equal(r.phase, 'drive');
  assert.ok(r.cars.every(c => c === r.player || !shellsOverlap(c, r.player)));
});

test('a tightly bunched pack separates on the inner bend and at both lap boundaries', () => {
  for (const s of [TRACK_LENGTH / 2 - 80, TRACK_LENGTH - 4, -3]) {
    const { r, p, host } = setup();
    const pack = Array.from({ length: 7 }, (_, i) => ({ ...host, id: 'test' + i }));
    r.cars = [p, r.hearse, ...pack];
    for (const [i, c] of r.cars.entries()) {
      Object.assign(c, {
        s: s + 8 * (i % 3), lane: -64 + 7 * Math.floor(i / 3), homeLane: -57,
        lateralSpeed: i % 2 ? 8 : -8, speed: 0, cruise: 0, wreck: i > 4,
      });
    }
    r.immune = 2;
    for (let i = 0; i < 10; i++) {
      step(r);
      for (const [j, a] of r.cars.entries()) {
        assert.ok(Math.abs(a.lane) <= 68.00001);
        for (const b of r.cars.slice(j + 1))
          assert.ok(!shellsOverlap(a, b), a.id + ' overlapped ' + b.id + ' at ' + s);
      }
    }
  }
});

test('lap gates use the separated positions', () => {
  const { r, p, host } = setup(), finish = 3 * TRACK_LENGTH;
  Object.assign(r, { progress: finish - 0.15, nextGate: 12, gatesPassed: 11, immune: 2 });
  Object.assign(p, { s: r.progress, lane: 0, speed: 45 });
  Object.assign(host, { s: finish + 23, lane: 0, homeLane: 0, speed: 0, cruise: 0 });
  step(r);
  assert.equal(r.nextGate, 12);
  assert.equal(r.phase, 'drive');
  assert.ok(r.progress < finish);
});

test("body shells stay apart through a full pursuit", () => {
  const r = makeRace();
  for (let tick = 0; tick < 60 * 180; tick++) {
    for (let i = 0; i < r.cars.length; i++) {
      const a = r.cars[i];
      for (let j = i + 1; j < r.cars.length; j++) {
        const b = r.cars[j];
        const gap = Math.abs(a.s - b.s) % TRACK_LENGTH;
        if (Math.min(gap, TRACK_LENGTH - gap) > 46 || Math.abs(a.lane - b.lane) > 26) continue;
        if (shellsOverlap(a, b)) assert.fail(a.id + " overlaps " + b.id + " on tick " + tick);
      }
    }
    if (r.phase === "lost") break;
    if (r.phase === "clutch") {
      const coupe = r.targets.findIndex(c => c.kind === "coupe");
      if (coupe >= 0) r.selected = coupe;
      possess(r);
    }
    const steer = r.possessionCount ? Math.max(-1, Math.min(1, (-40 - r.player.lane) * 0.18)) : 0;
    step(r, { gas: true, steer });
  }
  assert.ok(r.phase === "lost");
  assert.ok(r.possessionCount >= 2);
});
