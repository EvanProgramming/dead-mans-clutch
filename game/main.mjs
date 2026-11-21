import { ABILITIES, startDraftJump, useAbility } from './moves.mjs';
import { makeRace, step, chooseTarget, possess, decline, trackPoint, TRACK_LENGTH } from './sim.mjs';
import { createRenderer } from './render.mjs';
import { createAudio } from './audio.mjs';

const $ = (id) => document.getElementById(id);
const audio = createAudio(),
  keys = new Set(),
  dialog = $('dialog');
const names = {
  coupe: 'Redline Coupe',
  wagon: 'County Wagon',
  tow: 'Hook & Chain',
  hearse: 'The Hearse',
  ambulance: 'Last Responder',
};
const actionNames = { coupe: 'DASH', wagon: 'GUARD', tow: 'HOOK', ambulance: 'MEND' };
const touchMode = window.matchMedia('(pointer: coarse)');
const storageKey = 'dead-mans-clutch.v1.';
const bestKey = 'pursuit.distance';
const chainKey = 'pursuit.relay';
// The speedometer uses 1.37 MPH per track unit per second.
const distanceText = (v) => (v * 0.0006125).toFixed(2) + ' km';
function read(key) {
  try {
    return localStorage.getItem(storageKey + key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(storageKey + key, value);
  } catch {
    /* Private embeds can disable storage. */
  }
}
function time(t) {
  return (
    Math.floor(t / 60) +
    ':' +
    String(Math.floor(t % 60)).padStart(2, '0') +
    '.' +
    (Math.floor(t * 10) % 10)
  );
}
let race,
  renderer,
  view = 'menu',
  modal = '',
  last = 0,
  frame = 0,
  noticeLeft = 0,
  helpLeft = 0,
  coachUntil = 0;
let primaryAction,
  secondaryAction,
  muted = read('mute') === 'yes';
function storedBest(key = bestKey) {
  const n = Number(read(key));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
let best = storedBest(), chainBest = storedBest(chainKey);
let startingCar = read('pursuit.start');
if (!Object.prototype.hasOwnProperty.call(ABILITIES, startingCar)) startingCar = 'wagon';
let grid = 0, hasStarted = false, crossedBest = false;
const garage = $('garage');
for (const kind of ['wagon', 'coupe', 'tow', 'ambulance']) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.kind = kind;
  button.innerHTML = '<svg viewBox="0 0 88 35" aria-hidden="true"><use href="#side-' + kind +
    '"/></svg><span><strong>' + names[kind] + '</strong><small>' + ABILITIES[kind].name + '</small></span>';
  button.title = ABILITIES[kind].description;
  button.onclick = () => { startingCar = kind; write('pursuit.start', kind); showGarage(); };
  garage.append(button);
}
function showGarage() {
  for (const button of garage.children) button.setAttribute('aria-pressed', String(button.dataset.kind === startingCar));
  $('garageChoice').textContent = ABILITIES[startingCar].description;
}
const icon = (name) => '<svg aria-hidden="true"><use href="#' + name + '"/></svg>';
function setSound() {
  audio.setMuted(muted);
  $('sound').innerHTML =
    icon(muted ? 'muteicon' : 'speaker') + '<span>SOUND ' + (muted ? 'OFF' : 'ON') + '</span>';
  $('sound').setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  $('sound').setAttribute('aria-pressed', String(muted));
}
function toggleSound() {
  audio.unlock();
  muted = !muted;
  write('mute', muted ? 'yes' : 'no');
  setSound();
}
function showBest() {
  $('best').textContent = best ? distanceText(best) : '—';
}
function recordRun() {
  if (!race) return;
  const farthest = Math.max(best, storedBest(), race.furthest);
  const chain = Math.max(chainBest, storedBest(chainKey), race.bestChain);
  if (farthest > best) write(bestKey, String(farthest));
  if (chain > chainBest) write(chainKey, String(chain));
  best = farthest;
  chainBest = chain;
}
function announce(text, seconds = 2) {
  $('banner').textContent = text;
  $('banner').hidden = false;
  noticeLeft = seconds;
}
function teach(text, seconds) {
  $('coach').textContent = text;
  $('coach').hidden = false;
  coachUntil = seconds;
}
function closeDialog() {
  if (dialog.open) dialog.close();
  modal = '';
  last = performance.now();
  keys.clear();
}
function openDialog(kind, kicker, title, content, primary, action, secondary, other) {
  if (dialog.open) dialog.close();
  modal = kind;
  keys.clear();
  $('dialogKicker').textContent = kicker;
  $('dialogTitle').textContent = title;
  $('dialogContent').innerHTML = content;
  $('dialogPrimary').textContent = primary;
  primaryAction = action;
  $('dialogSecondary').textContent = secondary || '';
  secondaryAction = other;
  $('dialogSecondary').hidden = !secondary;
  $('dismiss').hidden = kind === 'result';
  dialog.showModal();
  $('dialogPrimary').focus({ preventScroll: true });
}
function handbook() {
  openDialog(
    'help',
    'DRIVER’S HANDBOOK',
    'How to play',
    '<p>The lead hearse drains your soul when it pulls away. Get ahead to recover. Its bell marks a strip of road. The Hound lines up a ram. Steer out of the marked lane before it hits.</p><div class="controls"><div><span>Gas / brake · steer</span><kbd>W S · A D / ARROWS</kbd></div><div><span>Use this car’s ability</span><kbd>E</kbd></div><div><span>Fill a jump in another car’s wake</span><kbd>HOLD GAS BEHIND IT</kbd></div><div><span>Choose a ride · steal it</span><kbd>HOLD SPACE · RELEASE</kbd></div><div><span>Aim during any jump window</span><kbd>MOUSE OR ← →</kbd></div><div><span>Stay / pause / restart / mute</span><kbd>X / ESC / R / M</kbd></div></div><p>Hard crashes give you an escape jump, too. Chain clean draft jumps for a longer speed burst.</p>',
    'START ENGINE',
    enterGrid,
    'BACK',
    closeDialog,
  );
}
function menu() {
  closeDialog();
  view = 'menu';
  cancelAnimationFrame(frame);
  audio.suspend();
  recordRun();
  race = null;
  $('menu').hidden = false;
  $('race').hidden = true;
  $('pause').hidden = true;
  document.body.classList.remove('racing', 'driving');
  showBest();
  $('start').focus({ preventScroll: true });
}
function enterGrid() {
  if (hasStarted) grid++;
  start();
}
function start() {
  closeDialog();
  view = 'race';
  keys.clear();
  recordRun();
  race = makeRace(startingCar, grid);
  race.recordLine = best;
  hasStarted = true;
  crossedBest = false;
  noticeLeft = helpLeft = coachUntil = 0;
  $('banner').hidden = $('clutch').hidden = true;
  $('menu').hidden = true;
  $('race').hidden = false;
  $('pause').hidden = false;
  document.body.classList.add('racing', 'driving');
  renderer ??= createRenderer($('road'));
  audio.unlock();
  audio.event('restart');
  audio.setMuted(muted);
  teach(touchMode.matches ? 'Hold GAS and follow the wake behind a car to earn a jump.' : 'Hold W or ↑ for gas. Follow a car’s wake to earn a jump.', 4.8);
  last = performance.now();
  cancelAnimationFrame(frame);
  paint(0);
  frame = requestAnimationFrame(tick);
}
function pause() {
  if (view !== 'race' || modal || ['won', 'lost'].includes(race.phase)) return;
  audio.suspend();
  openDialog(
    'pause',
    'IN THE PITS',
    'Race paused',
    '<p>Lap ' +
      race.lap +
      ' &nbsp;·&nbsp; ' +
      names[race.player.kind] +
      ' &nbsp;·&nbsp; ' +
      time(race.time) +
      '</p><div class="controls"><div><span>Restart race</span><kbd>R</kbd></div><div><span>Resume</span><kbd>ESC</kbd></div></div>',
    'RESUME',
    resume,
    'STARTING GRID',
    menu,
  );
}
function resume() {
  closeDialog();
  audio.unlock();
  last = performance.now();
}
function result() {
  recordRun();
  const bestLine = race.recordLine > 0 && race.furthest > race.recordLine ? ' · NEW RECORD' : '';
  const tip = !race.draftJumps ? 'Follow a bumper until the jump charges. You can steal a ride before your first crash.'
    : race.bestChain < 2 ? 'Land a second draft jump within nine seconds to extend your overdrive.'
    : 'The farthest windshield can buy more road than the fastest car.';
  const delta = race.furthest - race.recordLine;
  const comparison = race.recordLine > 100 && Math.abs(delta) > 16
    ? ' · ' + distanceText(Math.abs(delta)) + (delta > 0 ? ' farther' : ' short of best') : '';
  openDialog('result', 'SHADE COUNTY DEATH CERTIFICATE', 'End of the road.',
    '<p>' + race.lossReason + ' ' + tip + '</p><div class="result-mile"><small>DISTANCE SURVIVED' + bestLine +
    '</small><strong>' + distanceText(race.furthest) + '</strong></div><div class="statrow">Farthest run<b>' +
    distanceText(best) + comparison + '</b></div><div class="statrow">Clean jump chain<b>' +
    race.bestChain + ' &nbsp;·&nbsp; Best ' + chainBest + '</b></div><div class="statrow">Time at the wheel<b>' +
    time(race.time) + ' &nbsp;·&nbsp; Lap ' + race.lap + '</b></div>',
    'RETRY THIS PACK', start, 'CHANGE CAR & PACK', menu);
}
function events() {
  for (const e of race.events.splice(0)) {
    audio.event(e.type, e);
    if (e.type === 'clutch') {
      coachUntil = 0;
      $('banner').hidden = true;
      noticeLeft = 0;
    }
    if (e.type === 'shortcut') announce('Turn two · shortcut open', 2);
    if (e.type === 'hearseHit') announce('Hearse stalled on a wreck', 2);
    if (e.type === 'draftReady' && !helpLeft) {
      teach(touchMode.matches ? 'Jump charged. Tap Steal a ride, then tap a marked windshield.' : 'Jump charged. Hold Space to aim, then release.', 4);
      helpLeft = 1;
    }
    if (e.type === 'relay') announce(e.chain > 1 ? e.chain + ' rides linked · overdrive' : 'Clean jump · overdrive', 1.5);
    if (e.type === 'possess' && race.jumpMode !== 'draft' && !race.boost)
      announce(names[e.car.kind] + ' stolen', 1.4);
    if (e.type === 'stay') announce('Still running', 1);
    if (e.type === 'tow') announce('Totaled · tow inbound', 1.4);
    if (e.type === 'recover') announce('Relief truck · back on track', 1.6);
    if (e.type === 'lap') {
      recordRun();
      announce('Lap ' + e.lap + ' · pursuit intensifies', 1.7);
    }
    if (e.type === 'ability') announce(ABILITIES[e.kind]?.name || e.name, 1.3);
    if (e.type === 'abilityMiss') teach(e.message, 2.2);
    if (e.type === 'strike') announce(e.kind === 'bell' ? 'Toll bell hit your car' : 'Hound hit your car', 1.6);
    if (e.type === 'evade') announce('Attack survived', 1.1);
    if (e.type === 'lost') result();
  }
  if (race.phase === 'drive' && !crossedBest && race.recordLine > 100 && race.furthest > race.recordLine) {
    crossedBest = true;
    announce('New distance record', 2);
  }
}
function paint(dt) {
  renderer.draw(race, dt);
  $('lap').textContent = race.lap;
  $('distance').textContent = distanceText(race.furthest);
  const soul = Math.ceil(race.soul);
  $('soul').textContent = soul + '%';
  $('soulTrend').textContent = race.drain > 0 ? 'SOUL ↓ DRAIN' : race.soul < 100 && race.progress > race.hearse.s ? 'SOUL ↑ HEAL' : 'SOUL';
  $('soulMeter').setAttribute('aria-valuenow', soul);
  $('soulMeter').firstElementChild.style.transform = 'scaleX(' + race.soul / 100 + ')';
  $('race').classList.toggle('draining', race.drain > 0);
  $('race').classList.toggle('critical', soul <= 25);
  const threat = race.threats[0];
  $('warning').hidden = !threat;
  if (threat) $('warning').textContent = (threat.kind === 'bell' ? 'TOLL BELL' : 'HOUND RAM') + ' · LEAVE THE STRIPES';
  const ability = ABILITIES[race.player.kind];
  $('driveTools').hidden = race.phase !== 'drive';
  $('powerName').textContent = ability.name;
  $('powerState').textContent = race.guard > 0 ? 'GUARD ACTIVE' : race.cooldown > 0 ? Math.ceil(race.cooldown) + 's TO READY' : actionNames[race.player.kind] + ' · READY';
  $('powerBar').style.transform = 'scaleX(' + Math.max(0, 1 - race.cooldown / ability.cooldown) + ')';
  $('power').disabled = race.cooldown > 0;
  const ready = race.charge >= 1;
  $('draft').disabled = !ready || !race.hasTarget;
  $('draftTitle').textContent = ready ? 'Steal a ride' : 'Slipstream';
  $('draftState').textContent = ready ? race.hasTarget ? (touchMode.matches ? 'TAP TO AIM' : 'HOLD TO AIM') : 'FIND A WINDSHIELD' : race.draftCar ? 'CHARGING' : 'FOLLOW A CAR';
  $('draftBar').style.transform = 'scaleX(' + race.charge + ')';
  $('relay').hidden = !(race.chainLeft > 0);
  $('relay').textContent = 'CHAIN ×' + race.chain + ' · ' + Math.ceil(race.chainLeft) + 's';
  $('timer').textContent = time(race.time);
  const gap = (race.progress - race.hearse.s) / race.hearse.cruise;
  $('gapLabel').textContent = Math.abs(gap) < 0.12 ? 'WHEEL TO WHEEL'
    : gap < 0 ? 'HEARSE LEADS' : race.hearse.surge > 1 ? 'HEARSE PURSUING' : 'YOU LEAD';
  $('gap').textContent = (gap > 0 && race.hearse.surge > 1 ? '+' : '') + Math.abs(gap).toFixed(1) + 's';
  const driver = trackPoint(race.player.s, race.player.lane),
    rival = trackPoint(race.hearse.s, race.hearse.lane);
  $('mapPlayer').setAttribute('cx', driver.x.toFixed(1));
  $('mapPlayer').setAttribute('cy', driver.y.toFixed(1));
  $('mapHearse').setAttribute(
    'transform',
    'translate(' + rival.x.toFixed(1) + ' ' + rival.y.toFixed(1) + ')',
  );
  $('damage').hidden = !race.player.damage;
  $('damage').textContent = 'DAMAGE ' + race.player.damage + '%';
  $('chassis').textContent = names[race.player.kind].toUpperCase();
  $('speed').textContent = Math.round(race.player.speed * 1.37) + ' MPH';
  $('marker').style.left =
    Math.min(100, Math.max(0, ((race.progress % TRACK_LENGTH) / TRACK_LENGTH) * 100)) + '%';
  const picking = race.phase === 'clutch';
  $('clutch').hidden = !picking;
  if (picking) {
    const host = race.targets[race.selected];
    $('targetname').textContent = race.selected + 1 + ' / ' + names[host.kind];
    $('jumpKind').textContent = race.jumpMode === 'draft' ? (touchMode.matches ? 'DRAFT JUMP · TAP A CAR' : 'DRAFT JUMP · RELEASE SPACE') : 'CRASH ESCAPE';
    const advance = ((host.s - race.player.s + TRACK_LENGTH * 1.5) % TRACK_LENGTH + TRACK_LENGTH) % TRACK_LENGTH - TRACK_LENGTH / 2;
    const lengths = Math.round(Math.abs(advance) / 24);
    $('targetPace').textContent = actionNames[host.kind] + ' · ' + Math.round(host.topSpeed * 1.37) +
      ' MPH · ' + (lengths ? lengths + (lengths === 1 ? ' length' : ' lengths') + (advance >= 0 ? ' up' : ' back') : 'alongside');
    $('stay').innerHTML = race.player.damage >= 100 ? 'Tow <kbd>X</kbd>' : 'Stay <kbd>X</kbd>';
    $('windowbar').style.transform = 'scaleX(' + Math.max(0, race.timer / race.clutchDuration) + ')';
  }
  $('coach').hidden = coachUntil <= 0 || picking;
  document.body.classList.toggle('driving', race.phase === 'drive' && !modal);
}
function tick(now) {
  if (view !== 'race') return;
  const dt = Math.min(0.075, Math.max(0, (now - last) / 1000));
  last = now;
  if (!modal) {
    const gas = keys.has('ArrowUp') || keys.has('KeyW'),
      brake = keys.has('ArrowDown') || keys.has('KeyS');
    const left = keys.has('ArrowLeft') || keys.has('KeyA'),
      right = keys.has('ArrowRight') || keys.has('KeyD');
    step(race, { gas, brake, steer: Number(left) - Number(right) }, dt);
    coachUntil -= dt;
    noticeLeft -= dt;
    if (noticeLeft <= 0) $('banner').hidden = true;
    events();
    paint(dt);
    audio.sync(race, !modal);
  }
  frame = requestAnimationFrame(tick);
}
$('start').onclick = enterGrid;
// A second finger on an action button does not always generate a click while gas is held.
function bindRaceAction(id, action) {
  const button = $(id);
  let secondaryId = null, lastTouch = -Infinity;
  button.onpointerdown = e => {
    lastTouch = -Infinity;
    if (e.pointerType === 'touch' && !e.isPrimary) {
      secondaryId = e.pointerId;
      button.setPointerCapture(e.pointerId);
    }
  };
  button.onpointerup = e => {
    if (e.pointerId !== secondaryId) return;
    secondaryId = null;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    if (!button.disabled && hit && button.contains(hit)) {
      lastTouch = e.timeStamp;
      action();
    }
  };
  button.onlostpointercapture = button.onpointercancel = () => { secondaryId = null; };
  button.onclick = e => {
    if (!e.detail || e.timeStamp - lastTouch > 500) action();
  };
}
bindRaceAction('power', () => useAbility(race));
bindRaceAction('draft', () => startDraftJump(race));
$('how').onclick = handbook;
$('pause').onclick = pause;
$('sound').onclick = toggleSound;
bindRaceAction('prevTarget', () => chooseTarget(race, -1));
bindRaceAction('nextTarget', () => chooseTarget(race, 1));
bindRaceAction('take', () => possess(race));
bindRaceAction('stay', () => decline(race));
$('dialogPrimary').onclick = () => primaryAction?.();
$('dialogSecondary').onclick = () => secondaryAction?.();
$('dismiss').onclick = () => (modal === 'pause' ? resume() : closeDialog());
dialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  if (modal === 'pause') resume();
  else if (modal === 'help') closeDialog();
});
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    if (view === 'race') announce('Fullscreen unavailable in this embed', 2);
  }
};
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').querySelector('span').textContent = document.fullscreenElement
    ? 'EXIT FULLSCREEN'
    : 'FULLSCREEN';
  $('fullscreen').setAttribute(
    'aria-label',
    document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen',
  );
});
window.addEventListener('pagehide', recordRun);
if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
const road = $('road');
function point(e) {
  if (!race || modal || race.phase !== 'clutch') return -1;
  const i = renderer.hitTarget(race, e.clientX, e.clientY);
  if (i >= 0) race.selected = i;
  return i;
}
road.addEventListener('pointermove', point);
road.addEventListener('pointerup', (e) => {
  if (point(e) >= 0) possess(race);
});
for (const button of document.querySelectorAll('[data-bind]')) {
  const code = button.dataset.bind;
  button.onpointerdown = (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    keys.add(code);
    audio.unlock();
  };
  button.onpointerup = button.onpointercancel = button.onlostpointercapture = () => keys.delete(code);
}
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.code === 'KeyM' && !e.repeat) {
    e.preventDefault();
    toggleSound();
    return;
  }
  if (view !== 'race') return;
  if (e.code === 'KeyR' && !e.repeat) {
    e.preventDefault();
    start();
    return;
  }
  if (modal) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'Space', 'Escape'].includes(e.code))
    e.preventDefault();
  if (e.code === 'Escape' && !e.repeat) {
    pause();
    return;
  }
  if (race.phase === 'drive' && !e.repeat && e.code === 'KeyE') {
    useAbility(race);
    return;
  }
  if (race.phase === 'drive' && !e.repeat && e.code === 'Space') {
    startDraftJump(race);
    return;
  }
  if (race.phase === 'clutch') {
    if (!e.repeat && ['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code))
      chooseTarget(race, ['ArrowLeft', 'KeyA'].includes(e.code) ? -1 : 1);
    if (e.code === 'KeyX' && !e.repeat) decline(race);
  } else keys.add(e.code);
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (view === 'race' && !modal && e.code === 'Space' && race.phase === 'clutch') {
    e.preventDefault();
    possess(race);
  }
});
window.addEventListener('blur', () => {
  keys.clear();
  pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('storage', (e) => {
  if (e.key === storageKey + bestKey) {
    best = storedBest();
    showBest();
  }
});
showGarage();
showBest();
setSound();
