import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRace, step, decline } from '../game/sim.mjs';

test('the starting field is busy and a straight gas run meets moving traffic',()=>{
  const race=makeRace();
  assert.ok(race.cars.filter(c=>!c.wreck).length>=40);
  assert.ok(race.cars.filter(c=>!c.wreck&&Math.abs(c.s)<180).length>=5);
  for(let i=0;i<15*60&&race.phase==='drive';i++)step(race,{gas:true});
  const first=race.events.find(e=>e.type==='impact');
  assert.ok(first?.obstacle?.kind && !first.obstacle.wreck && first.obstacle.speed>20);
  assert.ok(race.targets.some(c=>c.kind==='coupe') && race.targets.length>=2);
});

test('a clean inside line in the starter cannot outrun the hearse',()=>{
  const race=makeRace();
  // Isolate the actual race pace from the cost of contact.
  race.cars=[race.player,race.hearse];
  race.shortcutOpen=race.barriers[0].broken=true;
  for(let i=0;i<180*60 && race.phase !== 'lost';i++){
    step(race,{gas:true,steer:Math.max(-1,Math.min(1,(-58-race.player.lane)*.25))});
  }
  assert.equal(race.phase,'lost');
  assert.equal(race.possessionCount,0);
});

test('holding gas and declining every windshield loses in live traffic',()=>{
  const race=makeRace();
  for(let i=0;i<180*60 && race.phase !== 'lost';i++){
    if(race.phase==='clutch')decline(race);
    step(race,{gas:true});
  }
  assert.equal(race.phase,'lost');
  assert.ok(race.impactCount>=1);
  assert.equal(race.possessionCount,0);
});

test("the same throttle input reaches the same pack at different display rates", () => {
  function firstImpact(frameTime) {
    const race = makeRace();
    for (let i = 0; i < 15 / frameTime && race.phase === "drive"; i++) {
      step(race, { gas: true }, frameTime);
    }
    const hit = race.events.find(e => e.type === "impact");
    assert.ok(hit && race.phase === "clutch");
    return [hit.obstacle.id, race.targets.map(c => c.id), race.targets[race.selected].kind];
  }
  const baseline = firstImpact(1 / 60);
  for (const frameTime of [1 / 30, 0.016, 1 / 120, 1 / 144]) {
    assert.deepEqual(firstImpact(frameTime), baseline);
  }
});
