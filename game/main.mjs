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
};
const storageKey = 'dead-mans-clutch.v1.';
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
function storedBest() {
  const n = Number(read('best'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
let best = storedBest();
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
  $('best').textContent = best ? time(best) : '— : — . —';
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
    '<p>Beat the hearse over three laps. Crash hard and time slows. Aim at a marked windshield and release to steal the car. Your old ride keeps rolling.</p><div class="controls"><div><span>Accelerate / brake</span><kbd>W / S · ↑ / ↓</kbd></div><div><span>Steer across the track</span><kbd>A / D · ← / →</kbd></div><div><span>Pick a windshield</span><kbd>AIM · ← / →</kbd></div><div><span>Jump / stay</span><kbd>CLICK OR SPACE / X</kbd></div><div><span>Pause / restart / mute</span><kbd>ESC / R / M</kbd></div></div>',
    'START ENGINE',
    start,
    'BACK',
    closeDialog,
  );
}
function menu() {
  closeDialog();
  view = 'menu';
  cancelAnimationFrame(frame);
  audio.suspend();
  race = null;
  $('menu').hidden = false;
  $('race').hidden = true;
  $('pause').hidden = true;
  document.body.classList.remove('racing', 'driving');
  showBest();
  $('start').focus({ preventScroll: true });
}
function start() {
  closeDialog();
  view = 'race';
  keys.clear();
  race = makeRace();
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
  teach('Hold ↑ or W for gas. Steer with ← → or A D.', 4);
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
      ' of 3 &nbsp;·&nbsp; ' +
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
function result(win) {
  best = storedBest() || best;
  const oldBest = best;
  if (win && (!best || race.time < best)) {
    best = race.time;
    write('best', String(best));
  }
  const count = race.possessionCount;
  openDialog(
    'result',
    win ? 'CHECKERED FLAG' : 'THE CEMETERY GATES',
    win ? 'Back in the flesh.' : 'The hearse got there first.',
    '<p>' +
      (win
        ? 'The coroner wants his paperwork back.'
        : 'The pit crew can squeeze you in for another funeral.') +
      '</p><div class="statrow">Finish time<b>' +
      time(race.time) +
      '</b></div><div class="statrow">Windshields stolen<b>' +
      count +
      '</b></div><div class="statrow">Personal best<b>' +
      (best ? time(best) : '—') +
      (win && best !== oldBest ? ' · NEW' : '') +
      '</b></div>',
    'RACE AGAIN',
    start,
    'STARTING GRID',
    menu,
  );
}
function events() {
  for (const e of race.events.splice(0)) {
    audio.event(e.type);
    if (e.type === 'clutch') {
      helpLeft = 0;
      coachUntil = 0;
      $('banner').hidden = true;
      noticeLeft = 0;
    }
    if (e.type === 'shortcut') announce('Turn two · shortcut open', 3);
    if (e.type === 'hearseHit') announce('The hearse hit a wreck', 2.2);
    if (e.type === 'possess') {
      announce(names[e.car.kind] + ' stolen', 1.5);
      if (race.possessionCount === 1)
        teach('Watch your old car. It can still clear the inside line.', 2.8);
    }
    if (e.type === 'stay') announce('Still running · hold gas', 1.5);
    if (e.type === 'tow') announce('Totaled · tow inbound', 1.4);
    if (e.type === 'recover') announce('Back on track', 1.7);
    if (e.type === 'lap') announce(e.lap === 3 ? 'Final lap' : 'Lap two', 2);
    if (e.type === 'won' || e.type === 'lost') result(e.type === 'won');
  }
}
function paint(dt) {
  renderer.draw(race, dt);
  $('lap').textContent = race.lap + ' / 3';
  $('timer').textContent = time(race.time);
  const gap = (race.progress - race.hearse.s) / 48;
  $('gapLabel').textContent =
    Math.abs(gap) < 0.12 ? 'WHEEL TO WHEEL' : gap > 0 ? 'YOU LEAD' : 'HEARSE LEADS';
  $('gap').textContent = Math.abs(gap).toFixed(1) + 's';
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
    $('targetname').textContent = race.selected + 1 + ' / ' + names[race.targets[race.selected].kind];
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
    if (race.phase === 'drive' && race.time > 4.2 && race.time < 8.1 && !helpLeft) {
      teach('Hit the smoking wagon to steal another ride.', 3.5);
      helpLeft = 1;
    }
    events();
    paint(dt);
    audio.sync(race, !modal);
  }
  frame = requestAnimationFrame(tick);
}
$('start').onclick = start;
$('how').onclick = handbook;
$('pause').onclick = pause;
$('sound').onclick = toggleSound;
$('prevTarget').onclick = () => chooseTarget(race, -1);
$('nextTarget').onclick = () => chooseTarget(race, 1);
$('take').onclick = () => possess(race);
$('stay').onclick = () => decline(race);
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
  button.onpointerup = button.onpointercancel = () => keys.delete(code);
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
  if (e.key === storageKey + 'best') {
    best = storedBest();
    showBest();
  }
});
showBest();
setSound();
