import { bodyYaw, trackPoint, ROAD_HALF_WIDTH, TRACK_LENGTH } from './sim.mjs';
import { DRAFT } from './moves.mjs';

const ink = '#181b18',
  ivory = '#f3dfb1',
  lime = '#d8ed79';
function poly(c, points, fill, stroke, width = 1) {
  c.beginPath();
  for (let i = 0; i < points.length; i += 2) {
    if (i) c.lineTo(points[i], points[i + 1]);
    else c.moveTo(points[i], points[i + 1]);
  }
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
  }
}
function line(c, x, y, u, v, color, width) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(u, v);
  c.stroke();
}
function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function label(c, value, x, y, size, color, align = 'center') {
  c.font = '900 ' + size + 'px Impact, "Arial Narrow", sans-serif';
  c.textAlign = align;
  c.fillStyle = color;
  c.fillText(value, x, y);
}
function rng() {
  let seed = 7203;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function carSprite(kind, number, enemy) {
  const a = document.createElement('canvas');
  a.width = 200;
  a.height = 120;
  const c = a.getContext('2d');
  c.translate(100, 60);
  c.scale(2, 2);
  const hound = enemy === 'hound',
    hearse = kind === 'hearse',
    ambulance = kind === 'ambulance',
    tow = kind === 'tow',
    coupe = kind === 'coupe';
  const front = hound ? 44 : coupe ? 35 : 39,
    back = hearse || ambulance ? -44 : -37,
    side = ambulance ? 18 : coupe ? 14 : 16;
  const coat = hound ? '#262b29' : ambulance ? '#f3dfb1' : hearse ? '#333d37' : coupe ? '#9cad7a' : tow ? '#b87936' : '#b3482d';
  const light = hound ? '#e5663f' : ambulance ? '#fff1c9' : hearse ? '#9ea598' : coupe ? '#e4d6a2' : tow ? '#e3b96d' : '#e88d52';
  const shade = hound ? '#753325' : ambulance ? '#ae593b' : hearse ? '#212722' : coupe ? '#5e7056' : tow ? '#70482b' : '#773325';
  const body = [
    back,
    -side + 4,
    back + 4,
    -side,
    front - 9,
    -side,
    front - 2,
    -side + 3,
    front,
    -side + 7,
    front,
    side - 6,
    front - 3,
    side - 2,
    front - 10,
    side,
    back + 3,
    side,
    back,
    side - 3,
  ];
  for (const x of [back + 7, front - 16])
    for (const y of [-side - 2, side - 3]) {
      rect(c, x, y, 12, 6, '#141613');
      rect(c, x + 2, y, 8, 1, '#8f806b');
    }
  poly(c, body, coat, ink, 2.8);
  line(c, back + 5, -side + 1, front - 11, -side + 1, light, 2);
  line(c, back + 3, side - 2, front - 6, side - 2, shade, 2.5);
  for (const y of [-1, 1]) {
    rect(c, back - 1, y * 10 - 3, 2.5, 6, '#e35230');
    rect(c, front - 2, y * 9 - 4, 2.3, 7, '#fff0ba');
    line(c, front - 14, y * (side - 2), front - 5, y * (side - 3), light, 1);
  }
  rect(c, front, -7, 1.7, 14, '#aaa58a');
  rect(c, back - 1, -6, 1.5, 12, '#9a9b83');
  const windX = tow || ambulance ? 17 : 10;
  poly(
    c,
    [windX, -13, windX + 6, -11, windX + 8, 10, windX + 1, 13, windX - 2, 9, windX - 3, -9],
    '#293735',
    ink,
    1.2,
  );
  line(c, windX + 1, -10, windX + 5, 6, '#8da39b', 1.7);
  for (const y of [-1, 1]) {
    poly(c, [windX - 2, y * 11, windX - 4, y * 14, -17, y * 14, -13, y * 11], '#303734', ink, 0.7);
    rect(c, windX - 2, y * 15 - 1, 4, 2.6, shade);
  }
  if (hound) {
    for (const sign of [-1, 1]) {
      poly(c, [-34, sign * 7, -30, sign * 12, -14, sign * 10, -19, sign * 7,
        -6, sign * 4, -14, sign * 2], '#c14c33');
      poly(c, [-20, sign * 7, -6, sign * 8, 3, sign * 3, -9, sign * 5], ivory);
      poly(c, [19, sign * 12, 25, sign * 8, 34, sign * 4, 40, sign * 4,
        33, sign * 8, 22, sign * 13], '#e5c497', ink, 0.9);
      for (let x = 22; x < 36; x += 5) {
        const y = 10 - (x - 22) * 0.31;
        poly(c, [x, sign * y, x + 4, sign * (y - 1), x + 4, sign * (y - 5)], ivory);
      }
      line(c, 20, sign * 5, 24, sign * 4, '#fa8a4e', 2.5);
      poly(c, [5, sign * 12, -4, sign * 14, -1, sign * 7], shade, ink, 1);
    }
    poly(c, [34, -3, 42, -4, 44, 0, 42, 4, 34, 3, 37, 0], '#121815');
  } else if (ambulance) {
    rect(c, -40, -14, 48, 28, '#d1b888');
    rect(c, -38, -12, 43, 24, '#f6e4b9');
    for (const y of [-16, 13]) rect(c, -38, y, 69, 3, '#bd5237');
    rect(c, 8, -14, 5, 28, ink);
    rect(c, 9, -13, 3, 10, '#f4754a');
    rect(c, 9, 3, 3, 10, '#79c9bf');
    c.save();
    c.translate(-16, 0);
    for (let i = 0; i < 3; i++) {
      rect(c, -3.4, -10.5, 6.8, 21, '#176966');
      c.rotate(Math.PI / 3);
    }
    line(c, 0, -6.5, 0, 6.5, ivory, 1.5);
    c.restore();
    rect(c, 29, -12, 4, 24, '#cc5b3a');
  } else if (tow) {
    rect(c, back + 4, -12, 37, 24, ink);
    rect(c, back + 6, -10, 32, 20, '#504b3e');
    for (let y = -8; y < 10; y += 4) line(c, back + 6, y, -3, y, '#82795d', 0.7);
    poly(c, [-33, -1, -8, -7, -3, -5, -27, 2], light, ink, 1);
    line(c, -3, 5, -29, 1, ink, 2);
    rect(c, 4, -12, 4, 24, '#643c22');
    rect(c, 5, -10, 3, 5, '#efac4c');
    rect(c, 5, 5, 3, 5, '#efac4c');
  } else if (hearse) {
    poly(c, [-36, -11, 5, -11, 9, -7, 9, 7, 5, 11, -36, 11], '#424a40', ink, 1.1);
    for (const y of [-8, 8]) line(c, -34, y, 3, y, '#a4a799', 1.2);
    poly(c, [-25, -4, -17, -7, -7, -5, 0, 0, -7, 5, -17, 7, -25, 4], '#252c27', '#b8b49b', 0.8);
    line(c, -19, 0, -9, 0, '#c6bea1', 1.2);
    line(c, -15, -3, -15, 3, '#c6bea1', 1.1);
    if (enemy === 'hearse') {
      poly(c, [-31, -5, -23, -9, -6, -6, 2, 0, -6, 6, -23, 9, -31, 5], '#cfb789', ink, 1.2);
      line(c, -24, 0, -9, 0, ink, 2.1);
      line(c, -19, -4.5, -19, 4.5, ink, 2);
      for (const sign of [-1, 1]) {
        poly(c, [20, 0, 19, sign * 11, 25, sign * 7, 35, sign * 10, 27, sign * 3], '#a44b37');
        line(c, 30, sign * 12, 36, sign * 9, '#f4d69e', 2.2);
      }
    }
  } else {
    const tail = coupe ? -22 : -29;
    poly(
      c,
      [tail, -10, tail + 4, -12, tail + 8, -9, tail + 8, 9, tail + 4, 12, tail, 9],
      '#35403a',
      ink,
      1,
    );
    poly(
      c,
      [tail + 7, -10, windX - 4, -10, windX, -7, windX + 2, 8, windX - 2, 10, tail + 7, 10],
      coat,
      light,
      0.7,
    );
    c.save();
    c.translate((tail + windX) / 2 + 2, 0);
    c.rotate(Math.PI / 2);
    label(c, number, 0, 4, 13, ivory);
    c.restore();
    for (const y of [-6, 6])
      line(c, windX + 11, y, front - 3, y + (coupe ? 2 : 0), light, coupe ? 2.4 : 1);
    line(c, back + 3, -10, tail - 1, -10, light, 1.1);
  }
  return a;
}

function ground() {
  const random = rng(),
    points = [];
  for (let s = 0; s < TRACK_LENGTH; s += 4) points.push(trackPoint(s, 0));
  const pad = 200,
    x0 = Math.floor(Math.min(...points.map((p) => p.x)) - pad),
    y0 = Math.floor(Math.min(...points.map((p) => p.y)) - pad);
  const w = Math.ceil(Math.max(...points.map((p) => p.x)) + pad - x0),
    h = Math.ceil(Math.max(...points.map((p) => p.y)) + pad - y0);
  const a = document.createElement('canvas'),
    res = Math.min(2, 4096 / w, 4096 / h);
  a.width = w * res;
  a.height = h * res;
  const c = a.getContext('2d');
  c.scale(res, res);
  c.translate(-x0, -y0);
  rect(c, x0, y0, w, h, '#282c22');
  function loop(lane, color, width, from = 0, to = TRACK_LENGTH, step = 4) {
    c.beginPath();
    for (let s = from; s < to; s += step) {
      const p = trackPoint(s, lane);
      if (s === from) c.moveTo(p.x, p.y);
      else c.lineTo(p.x, p.y);
    }
    const p = trackPoint(to, lane);
    c.lineTo(p.x, p.y);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  for (let i = 0; i < 14500; i++) {
    const x = x0 + random() * w,
      y = y0 + random() * h;
    line(
      c,
      x,
      y,
      x + random() * 6,
      y - random() * 2,
      random() > 0.5 ? '#34382a' : '#22261f',
      0.35 + random() * 0.9,
    );
  }
  loop(0, '#38352a', 157);
  loop(0, '#5b3829', 145);
  loop(0, '#9b5137', 136);
  loop(0, '#ae6040', 119);
  loop(-5, '#b46a49', 91);
  for (let i = 0; i < 520; i++) {
    const s = random() * TRACK_LENGTH,
      lane = (random() - 0.5) * 132;
    loop(
      lane,
      random() > 0.55 ? 'rgba(103,53,38,.16)' : 'rgba(228,158,103,.13)',
      0.3 + random() * 2,
      s,
      s + 15 + random() * 100,
    );
  }
  for (let i = 0; i < 17000; i++) {
    const s = random() * TRACK_LENGTH,
      lane = (random() - 0.5) * 145,
      p = trackPoint(s, lane),
      len = 0.2 + random() * 1.8;
    line(
      c,
      p.x,
      p.y,
      p.x + Math.cos(p.angle) * len,
      p.y + Math.sin(p.angle) * len,
      random() > 0.64 ? 'rgba(250,205,146,.34)' : 'rgba(71,40,27,.32)',
      0.25 + random() * 0.55,
    );
  }
  for (const lane of [-65, 65]) {
    loop(lane, '#ca9466', 1.1);
    for (let s = 0; s < TRACK_LENGTH; s += 8 + random() * 7)
      loop(lane + random() * 0.6, '#dfaf7e', 0.55, s, s + 3 + random() * 7);
  }
  loop(-73, '#181e18', 4);
  loop(-73, '#9b8668', 1);
  for (let s = 0; s < TRACK_LENGTH; s += 14) {
    const p = trackPoint(s, 70);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.angle);
    rect(c, -7, -1.5, 13.7, 3.5, Math.floor(s / 56) % 2 ? '#a84d37' : '#d7b995');
    rect(c, -7, -1.5, 13.7, 0.6, '#f1d5aa');
    c.restore();
  }
  function at(s, lane, fn) {
    const p = trackPoint(s, lane);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.angle);
    fn();
    c.restore();
  }
  // Paired chalk ticks and catch-fence shadows give the eye fixed distance markers.
  for (let s = 0; s < TRACK_LENGTH; s += 21) {
    for (const side of [-1, 1]) {
      at(s, side * 61, () => {
        poly(c, [-4, 0, 1.4, 0, 3.4, side * 1.4, -1.8, side * 1.4], '#e1af7c');
      });
      at(s, side * 73, () => {
        line(c, 0, 0, 6, side * -6, '#674f38', 1.4);
        line(c, 0, 0, -1, side * 4, ink, 2);
        rect(c, -2, side * 4 - 0.6, 2.8, 1.3, '#debd86');
      });
    }
  }
  for (let s = 70; s < TRACK_LENGTH; s += 183) {
    at(s, 99, () => {
      rect(c, -57, -15, 117, 39, '#191f1a');
      for (let y = -14; y < 22; y += 6) {
        rect(c, -56, y, 112, 1.4, '#6e6852');
        for (let x = -54; x < 54; x += 2 + random() * 2) {
          const yy = y + 1 + random() * 1.2;
          rect(
            c,
            x,
            yy,
            1.6,
            2.7,
            ['#a59979', '#934e36', '#565a43', '#ceaa78', '#664c39'][Math.floor(random() * 5)],
          );
        }
      }
      for (let x = -56; x <= 56; x += 28) rect(c, x, -16, 0.9, 39, '#383f31');
    });
  }
  for (let s = 58; s < TRACK_LENGTH; s += 113) {
    at(s, -81, () => {
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.ellipse(i * 4, 0, 2.8, 3.8, 0.2, 0, Math.PI * 2);
        c.fillStyle = '#161a17';
        c.fill();
        c.strokeStyle = '#695e49';
        c.lineWidth = 0.8;
        c.stroke();
      }
    });
  }
  const sponsors = ['CINDER OIL', 'DUST BOWL', 'REDLINE', 'LAST CHANCE', 'GRAVEYARD', 'PIT • 13'];
  for (let i = 0; i < 12; i++)
    at(92 + (i * TRACK_LENGTH) / 12, -101, () => {
      const word = sponsors[i % sponsors.length];
      c.transform(1, 0, -0.2, 1, 0, 0);
      line(c, -37, -9, 37, -9, '#797655', 0.7);
      line(c, -37, 7, 37, 7, '#797655', 0.7);
      label(c, word, 0, 3.5, 10, '#a7a07a');
    });
  for (let i = 0; i < 8; i++)
    at(85 + (i * TRACK_LENGTH) / 8, 49, () => {
      c.globalAlpha = 0.36;
      c.transform(1, 0, -0.3, 1, 0, 0);
      label(c, ['CINDER', 'NO LIFT', 'DUST BOWL', 'COUNTY 13'][i % 4], 0, 4, 11, '#f2c895');
      line(c, -22, 7, 22, 7, ivory, 0.7);
    });
  at(0, 0, () => {
    for (let row = 0; row < 30; row++)
      for (let col = 0; col < 3; col++)
        rect(c, col * 4.5 - 7, row * 4.5 - 67.5, 4.5, 4.5, (row + col) % 2 ? '#d6bd94' : '#5b4837');
  });
  // Light pools and cast shadows follow the same stadium spacing.
  for (let s = 25; s < TRACK_LENGTH; s += 172) {
    at(s, 77, () => {
      const grad = c.createRadialGradient(7, 20, 2, 7, 20, 87);
      grad.addColorStop(0, 'rgba(255,205,114,.20)');
      grad.addColorStop(1, 'rgba(255,202,115,0)');
      c.fillStyle = grad;
      c.fillRect(-83, -69, 180, 180);
      line(c, 0, 0, 20, 19, 'rgba(37,28,21,.46)', 1.3);
      line(c, 16, 15, 23, 23, 'rgba(37,28,21,.46)', 2);
      rect(c, -3, -2, 6, 4, '#191c17');
      line(c, 0, 0, -4, -7, '#7b7c61', 0.9);
      rect(c, -9, -8, 11, 2.8, '#27291f');
      for (let j = 0; j < 3; j++) rect(c, -8.5 + j * 3.7, -7.7, 2.7, 1.8, '#ffe6a1');
    });
  }
  return { a, x0, y0, w, h };
}

function trackGap(a, b) {
  const delta = a.s - b.s;
  return delta - Math.round(delta / TRACK_LENGTH) * TRACK_LENGTH;
}

function drawRecordLine(c, r, cameraAngle) {
  const delta = r.recordLine - r.progress;
  if (!Number.isFinite(delta) || r.recordLine <= 100 || Math.abs(delta) > 240 || r.furthest > r.recordLine + 160) return;
  const s = r.player.s + delta;
  const inner = trackPoint(s, -ROAD_HALF_WIDTH);
  const outer = trackPoint(s, ROAD_HALF_WIDTH);
  line(c, inner.x, inner.y, outer.x, outer.y, '#394131', 2);
  c.save();
  c.setLineDash([4, 2]);
  line(c, inner.x, inner.y, outer.x, outer.y, '#e9e8b0', 1.25);
  c.restore();
  for (const foot of [inner, outer]) {
    c.save();
    c.translate(foot.x, foot.y);
    c.rotate(-cameraAngle);
    line(c, 0, 0, 0, -10, ink, 1.1);
    poly(c, [-0.4, -12, 21, -12, 18.5, -8.7, 20.5, -6.5, -0.4, -6.5], lime, ink, 0.6);
    label(c, 'YOUR BEST', 9, -8, 3.4, ink);
    c.restore();
  }
}

function drawWake(c, source, charge, active) {
  const paint = active ? '#e7f39f' : 'rgba(243,223,177,.52)';
  for (let i = 0; i < 6; i++) {
    const d = DRAFT.minGap + i * (DRAFT.maxGap - DRAFT.minGap) / 5;
    const p = trackPoint(source.s - d, source.lane);
    const width = 9 + i * (DRAFT.halfWidth - 9) / 5;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.angle);
    for (const y of [-1, 1]) {
      poly(c, [-3.5, y * width, -0.5, y * width, 3.5, y * (width - 3.5),
        0.5, y * (width - 3.5)], paint, active ? '#546344' : null, 0.46);
    }
    if (active && charge >= (i + 1) / 6) {
      poly(c, [-3, -2.7, 2, 0, -3, 2.7, -1.6, 0], lime, ink, 0.4);
    }
    c.restore();
  }
}

// The bell covers the hearse's wake. The ram's sightline previews its committed run.
function drawThreat(c, threat, player, cameraAngle) {
  const bell = threat.kind === 'bell';
  const sourceS = player.s + trackGap(threat.source, player);
  const start = bell ? sourceS - 245 : Math.min(sourceS, player.s - 18);
  const end = bell ? sourceS : Math.max(sourceS + 40, player.s + 35);
  const width = 14;
  const edges = [Math.max(-ROAD_HALF_WIDTH, threat.lane - width),
    Math.min(ROAD_HALF_WIDTH, threat.lane + width)];
  const segments = Math.ceil((end - start) / 12);
  const ribbon = [];
  for (let side = 0; side <= 1; side++) {
    for (let i = 0; i <= segments; i++) {
      const u = side ? 1 - i / segments : i / segments;
      const p = trackPoint(start + (end - start) * u, edges[side]);
      ribbon.push(p.x, p.y);
    }
  }
  poly(c, ribbon, 'rgba(104,24,23,.42)', '#3f3025', 1.45);
  for (let s = start + 2; s < end - 3; s += 12) {
    for (const edge of edges) {
      const a = trackPoint(s, edge), b = trackPoint(Math.min(end, s + 5.5), edge);
      line(c, a.x, a.y, b.x, b.y, '#f7ce95', 1.4);
    }
    const a = trackPoint(s, edges[0] + 1), b = trackPoint(Math.min(end, s + 11), edges[1] - 1);
    line(c, a.x, a.y, b.x, b.y, 'rgba(249,173,110,.46)', 0.8);
  }
  const marker = trackPoint(Math.max(start + 7, Math.min(end - 7, player.s + 32)), threat.lane);
  c.save();
  c.translate(marker.x, marker.y);
  c.rotate(-cameraAngle);
  poly(c, [-7, -5, -4, -8, 4, -8, 7, -5, 7, 4, 0, 9, -7, 4], ink, ivory, 0.9);
  if (bell) {
    c.beginPath();
    c.moveTo(-4.8, 2.2);
    c.quadraticCurveTo(-3, 0, -3.1, -1.5);
    c.quadraticCurveTo(-3, -6.4, 0, -6.2);
    c.quadraticCurveTo(3, -6.4, 3.1, -1.5);
    c.quadraticCurveTo(3, 0, 4.8, 2.2);
    c.fillStyle = ivory;
    c.fill();
    rect(c, -1.4, 3.1, 2.8, 1.3, ivory);
  } else {
    for (const y of [-3, 2]) poly(c, [-4.5, y, 0, y - 3, 4.5, y, 4.5, y + 2.5, 0, y - 0.5, -4.5, y + 2.5], ivory);
  }
  const fraction = Math.max(0, Math.min(1, threat.time / threat.duration));
  rect(c, -5.5, 9.5, 11, 2.4, ink);
  rect(c, -5, 10, 10 * fraction, 1.4, '#f6bd78');
  c.restore();
}

function drawPlayerEffect(c, r, tick, reduce) {
  if (r.boost > 0) {
    for (const side of [-1, 1]) {
      const flicker = reduce ? 0 : 2.2 * Math.sin(tick * 21 + side);
      const tail = -22 - 5 * Math.min(1, r.boost) + flicker;
      const y = side * 2.8;
      poly(c, [-8, y - 1.5, -15, y - 2.1, tail + 2, y - 1.2, tail, y,
        -17, y + 1.5, -8, y + 1.35], '#f88743', '#754332', 0.65);
      poly(c, [-8, y - 1.1, -15, y - 1, tail + 4, y, -12, y + 0.7, -8, y + 0.7], '#fff4af');
    }
  }
  if (r.guard > 0) {
    const shell = [-14, -4, -10, -8, 7, -8, 15, -4, 17, 0, 15, 4, 7, 8, -10, 8, -14, 4];
    poly(c, shell, 'rgba(216,237,121,.18)', ink, 2.2);
    poly(c, shell, null, lime, 1.25);
    for (const side of [-1, 1]) line(c, 9, side * 8.7, 15, side * 5.7, ivory, 1.1);
  }
  if (r.abilityFx?.kind === 'ambulance') {
    for (const side of [-1, 1]) {
      const spread = reduce ? 0 : 1.5 * Math.sin(tick * 7 + side);
      poly(c, [3, side * 4, -2 + spread, side * 15, 8 + spread, side * 14.5, 4, side * 4],
        side > 0 ? 'rgba(135,236,214,.66)' : 'rgba(255,160,102,.71)');
      line(c, 3, side * 5, 3 + spread, side * 12, ivory, 1);
    }
  }
}

export function createRenderer(canvas) {
  const c = canvas.getContext('2d', { alpha: false }),
    terrain = ground(),
    sprites = new Map(),
    hits = [];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let impacts = 0,
    crash = null;
  let cam = null,
    width = 0,
    height = 0,
    dpr = 1,
    frameRace = null,
    tick = 0;
  function draw(r, dt = 1 / 60) {
    const w = canvas.clientWidth || canvas.width,
      h = canvas.clientHeight || canvas.height;
    if (!w || !h || !r?.player) return;
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    if (w !== width || h !== height || pixelRatio !== dpr) {
      width = w;
      height = h;
      dpr = pixelRatio;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    tick += Math.min(dt || 0, 0.1);
    if (frameRace !== r) {
      impacts = r.impactCount;
      crash = null;
    }
    if (r.impactCount > impacts) {
      impacts = r.impactCount;
      crash = { at: tick, car: r.player, p: trackPoint(r.player.s, r.player.lane) };
    }
    const age = crash ? tick - crash.at : 1;
    const shock = reduce.matches ? 0 : Math.max(0, 1 - age / 0.27);
    const shakeX = Math.cos(age * 117) * shock * 3.5,
      shakeY = Math.sin(age * 145) * shock * 2.4;
    const picking = r.phase === 'clutch' || r.phase === 'jump';
    const rush = !reduce.matches && r.phase === 'drive'
      ? Math.max(0, Math.min(1, (r.player.speed - 36) / 89)) : 0;
    const lead = picking ? 0 : 5 + 13 * rush;
    const pivot = trackPoint(r.player.s + lead, r.player.lane * 0.31),
      follow = trackPoint(r.player.s + 22, 0);
    const tilt = w / h > 1.18 ? -0.25 : -1.25;
    let z = Math.min(w / (w / h > 1.18 ? 270 : 160), h / (w / h > 1.18 ? 178 : 250)),
      x = pivot.x,
      y = pivot.y;
    if (!picking) z *= 1.09 + rush * 0.04;
    const angle = tilt - follow.angle;
    if (picking && r.targets.length) {
      const ext = [
        trackPoint(r.player.s, r.player.lane),
        ...r.targets.map((v) => trackPoint(v.s, v.lane)),
      ];
      const projected = ext.map((p) => ({
        x: Math.cos(angle) * p.x - Math.sin(angle) * p.y,
        y: Math.sin(angle) * p.x + Math.cos(angle) * p.y,
      }));
      const xs = projected.map((p) => p.x),
        ys = projected.map((p) => p.y);
      const minX = Math.min(...xs),
        maxX = Math.max(...xs),
        minY = Math.min(...ys),
        maxY = Math.max(...ys);
      const cx = (minX + maxX) / 2,
        cy = (minY + maxY) / 2;
      x = Math.cos(angle) * cx + Math.sin(angle) * cy;
      y = -Math.sin(angle) * cx + Math.cos(angle) * cy;
      z = Math.min(z, (w * 0.81) / (maxX - minX + 34), (h * 0.61) / (maxY - minY + 30));
    }
    const anchorX = picking ? 0.5 : w / h > 1.18 ? 0.35 : 0.49,
      anchorY = picking ? 0.51 : w / h > 1.18 ? 0.54 : 0.62;
    if (!cam || frameRace !== r) cam = { x, y, angle, z, ax: anchorX, ay: anchorY };
    frameRace = r;
    const k = 1 - Math.exp(-Math.min(0.15, dt || 1 / 60) * (picking ? 10 : 8));
    cam.x += (x - cam.x) * k;
    cam.y += (y - cam.y) * k;
    cam.z += (z - cam.z) * k;
    cam.angle += Math.atan2(Math.sin(angle - cam.angle), Math.cos(angle - cam.angle)) * k;
    cam.ax += (anchorX - cam.ax) * k;
    cam.ay += (anchorY - cam.ay) * k;
    const co = Math.cos(cam.angle),
      si = Math.sin(cam.angle);
    function screen(p) {
      const dx = p.x - cam.x,
        dy = p.y - cam.y;
      return {
        x: w * cam.ax + shakeX + (dx * co - dy * si) * cam.z,
        y: h * cam.ay + shakeY + (dx * si + dy * co) * cam.z,
      };
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    rect(c, 0, 0, w, h, '#24281f');
    c.save();
    c.translate(w * cam.ax + shakeX, h * cam.ay + shakeY);
    c.rotate(cam.angle);
    c.scale(cam.z, cam.z);
    c.translate(-cam.x, -cam.y);
    c.drawImage(terrain.a, terrain.x0, terrain.y0, terrain.w, terrain.h);
    drawRecordLine(c, r, cam.angle);
    for (const b of r.barriers) {
      if (b.broken) {
        for (const offset of [-3, 3]) {
          c.beginPath();
          for (let d = -48; d < 500; d += 6) {
            const q = trackPoint(
              b.s + d,
              -57 + offset + Math.max(0, -d) * 0.24 + Math.sin(d / 48) * 1.8,
            );
            if (d === -48) c.moveTo(q.x, q.y);
            else c.lineTo(q.x, q.y);
          }
          c.strokeStyle = 'rgba(76,49,32,.54)';
          c.lineWidth = 1.7;
          c.stroke();
        }
        for (let d = 24; d <= 420; d += 72) {
          const q = trackPoint(b.s + d, -57);
          c.save();
          c.translate(q.x, q.y);
          c.rotate(q.angle);
          poly(c, [-2, -3, 2, 0, -2, 3, -0.7, 0], '#d4b681');
          c.restore();
        }
      }
      const p = trackPoint(b.s, b.lane);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.angle);
      if (b.broken) {
        rect(c, -2, -14, 3, 4, '#d3be8e');
        rect(c, -2, 10, 3, 4, '#d3be8e');
        c.save();
        c.translate(10, 9);
        c.rotate(-0.35);
        rect(c, -1, -4, 2, 10, '#ac9265');
        c.restore();
        for (let i = 0; i < 9; i++) {
          const d = Math.sin(i * 13.4);
          line(c, 2 + i * 0.6, d * 13, 4 + i * 0.8, d * 13 + 2, i % 2 ? '#352f23' : '#c7995b', 1.5);
        }
      } else {
        rect(c, -1, -11, 4, 24, '#483b2c');
        rect(c, -2, -12, 3, 24, '#dec289');
        for (let i = -11; i < 12; i += 6) poly(c, [-2, i, -2, i + 3, 1, i + 5, 1, i + 2], ink);
      }
      c.restore();
    }
    hits.length = 0;
    const playerPoint = trackPoint(r.player.s, r.player.lane);
    if (r.phase === 'drive') {
      let donor = r.draftCar;
      if (!donor) {
        let best = Infinity;
        for (const car of r.cars) {
          if (car === r.player || car.wreck || car.speed < DRAFT.minDonorSpeed) continue;
          const gap = trackGap(car, r.player);
          const cost = gap + 1.4 * Math.abs(car.lane - r.player.lane);
          if (gap >= DRAFT.minGap && gap <= DRAFT.maxGap && cost < best) {
            donor = car;
            best = cost;
          }
        }
      }
      if (donor) drawWake(c, donor, r.charge, !!r.draftCar);
      if (r.abilityFx?.kind === 'tow') {
        const hook = r.abilityFx.target;
        const to = trackPoint(hook.s - 9, hook.lane);
        line(c, playerPoint.x, playerPoint.y, to.x, to.y, ink, 1.8);
        c.save();
        c.setLineDash([2.2, 1.8]);
        line(c, playerPoint.x, playerPoint.y, to.x, to.y, '#f0c58a', 1.1);
        c.restore();
        poly(c, [to.x - 2, to.y, to.x, to.y - 2, to.x + 2, to.y, to.x, to.y + 2], ivory, ink, 0.65);
      }
    }
    for (const threat of r.threats) drawThreat(c, threat, r.player, cam.angle);
    for (const [idx, v] of r.cars.entries()) {
      const p = trackPoint(v.s, v.lane),
        pos = screen(p);
      if (pos.x < -75 || pos.x > w + 75 || pos.y < -75 || pos.y > h + 75) continue;
      const a = p.angle + bodyYaw(v);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(a);
      if (v.speed > 9 && !v.wreck) {
        const pace = Math.min(1, v.speed / 125);
        const phase = v.s / 28 + idx * 0.73;
        const count = reduce.matches ? 6 : 16;
        for (let j = 0; j < count; j++) {
          const u = phase + j / count;
          const t = u - Math.floor(u), side = j % 2 ? 1 : -1;
          const x = -10 - t * (11 + 31 * pace);
          const y = side * (3 + t * 4) + Math.sin(j * 17 + t * 5) * t * 3;
          const spread = 0.5 + t * 2.8;
          c.globalAlpha = (1 - t) * (reduce.matches || picking ? 0.17 : 0.48);
          poly(c, [x + spread, y, x, y - spread * 0.6, x - spread * (2 + pace),
            y + spread * 0.15, x - spread, y + spread * 0.65], j % 4 ? '#efc08a' : '#805234');
        }
        c.globalAlpha = 1;
      }
      const skin = (v.enemy || v.kind) + '-' + (idx % 9);
      let sprite = sprites.get(skin);
      if (!sprite) {
        sprite = carSprite(v.kind, String([13, 8, 72, 44, 29, 67, 14, 88, 36][idx % 9]), v.enemy);
        sprites.set(skin, sprite);
      }
      if (v.wreck) {
        c.fillStyle = 'rgba(59,40,26,.31)';
        c.beginPath();
        c.ellipse(-2, 1, 12.7, 6.7, 0, 0, Math.PI * 2);
        c.fill();
        for (const y of [-3.3, 3.3]) line(c, -17, y, -6, y + 0.7, 'rgba(64,40,26,.46)', 1.2);
      }
      if (crash?.car === v && shock > 0) c.scale(1 - 0.18 * shock, 1 + 0.15 * shock);
      poly(c, [-10, 2, -7, -3, 10, -3, 15, 1, 14, 7, -5, 7], 'rgba(31,25,21,.45)');
      if (v === r.player && r.phase === 'drive') drawPlayerEffect(c, r, tick, reduce.matches);
      c.drawImage(sprite, -13.5, -8.1, 27, 16.2);
      if (v.wreck) {
        poly(c, [2, -4, 7, -3, 4, -1, 10, 2, 3, 2, 5, 4, 0, 1], '#2e2b22');
        for (let j = 0; j < 6; j++) {
          const age = (tick * 0.34 + j / 6) % 1;
          c.globalAlpha = (1 - age) * 0.56;
          c.fillStyle = j % 2 ? '#514638' : '#342f29';
          c.beginPath();
          c.arc(7 + age * 5, -1 - age * 11 + Math.sin(j + age * 4), 1.3 + age * 3.7, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }
      c.restore();
    }
    if (crash && age < 0.5) {
      const t = age / 0.5;
      c.save();
      c.translate(crash.p.x, crash.p.y);
      c.rotate(crash.p.angle);
      for (let n = 0; n < 14; n++) {
        const theta = n * 2.399,
          dist = (5 + (n % 5) * 2.1) * (1 - (1 - t) ** 2);
        const px = 7 + Math.cos(theta) * dist,
          py = Math.sin(theta) * dist;
        c.globalAlpha = 1 - t * t;
        line(
          c,
          px,
          py,
          px + Math.cos(theta) * 1.9,
          py + Math.sin(theta) * 1.9,
          n % 3 ? '#f2c582' : '#402d20',
          0.8,
        );
      }
      c.restore();
    }
    c.restore();
    if (!picking && !reduce.matches) {
      // Project the elevated top rail outwards from the lens; its feet stay on the ground.
      const first = Math.floor((r.player.s - 290) / 34) * 34;
      for (const side of [-1, 1]) {
        let previous;
        c.beginPath();
        for (let s = first; s <= first + 580; s += 34) {
          const foot = screen(trackPoint(s, side * 77));
          const head = { x: foot.x + (foot.x - w / 2) * 0.16,
            y: foot.y + (foot.y - h / 2) * 0.16 };
          c.moveTo(foot.x, foot.y);
          c.lineTo(head.x, head.y);
          if (previous) c.lineTo(previous.x, previous.y);
          previous = head;
        }
        c.strokeStyle = '#27291f';
        c.lineWidth = Math.max(1.4, cam.z * 0.78);
        c.stroke();
      }
    }
    // Printed slipstream hatching passes across the outer margins along the road tangent.
    if (rush > 0.18) {
      const direction = playerPoint.angle + cam.angle;
      c.save();
      c.translate(w / 2, h / 2);
      c.rotate(direction);
      const along = Math.abs(Math.cos(direction)) * w + Math.abs(Math.sin(direction)) * h;
      const across = Math.abs(Math.sin(direction)) * w + Math.abs(Math.cos(direction)) * h;
      const period = along * 0.38;
      c.globalAlpha = rush * 0.31;
      for (let j = 0; j < 8; j++) {
        const y = (j % 2 ? -1 : 1) * across * (0.31 + ((j * 7) % 5) * 0.035);
        const phase = r.player.s * cam.z * (1.38 + j * 0.025) + j * period * 0.61;
        const offset = ((phase % period) + period) % period;
        for (let x = -along / 2 - offset; x < along / 2; x += period) {
          poly(c, [x, y, x + (7 + j * 2) * rush, y - 0.9, x + (22 + j * 4) * rush, y],
            j % 3 ? '#f3d19c' : '#23241b');
        }
      }
      c.restore();
    }
    const soft = c.createRadialGradient(
      w * 0.5,
      h * 0.48,
      h * 0.22,
      w * 0.5,
      h * 0.48,
      Math.max(w * 0.66, h * 0.77),
    );
    soft.addColorStop(0, 'rgba(16,19,14,0)');
    soft.addColorStop(1, 'rgba(13,17,13,.39)');
    c.fillStyle = soft;
    c.fillRect(0, 0, w, h);
    if (picking) {
      rect(c, 0, 0, w, h, 'rgba(19,24,18,.22)');
      const start = screen(playerPoint);
      const rad = Math.max(16, Math.min(36, 12 * cam.z));
      for (const [index, v] of r.targets.entries()) {
        const q = screen(trackPoint(v.s, v.lane)),
          active = index === r.selected;
        hits.push({ x: q.x, y: q.y, r: rad + 12, index });
        c.save();
        c.strokeStyle = active ? lime : '#efe4c3';
        c.lineWidth = active ? 2 : 1;
        for (let n = 0; n < 4; n++) {
          const base = (n * Math.PI) / 2;
          c.beginPath();
          c.arc(q.x, q.y, rad, base + 0.15, base + 1.15);
          c.stroke();
        }
        c.restore();
        if (active) {
          c.save();
          c.setLineDash([4, 6]);
          c.lineDashOffset = -tick * 24;
          line(c, start.x, start.y, q.x, q.y, 'rgba(220,234,132,.75)', 1.5);
          c.restore();
          if (r.phase === 'jump') {
            const t = Math.max(0, Math.min(1, 1 - r.timer / 0.48));
            const ghostPoint = (u) => ({
              x: start.x + (q.x - start.x) * u,
              y: start.y + (q.y - start.y) * u - Math.sin(u * Math.PI) * Math.min(34, rad),
            });
            const mx = ghostPoint(t),
              sz = Math.min(1.25, Math.max(0.8, cam.z * 0.43));
            c.save();
            c.lineCap = 'round';
            for (let n = 4; n > 0; n--) {
              const tail = ghostPoint(Math.max(0, t - n * 0.045)),
                tip = ghostPoint(Math.max(0, t - (n - 1) * 0.045));
              line(
                c,
                tail.x,
                tail.y,
                tip.x,
                tip.y,
                'rgba(159,241,184,' + (0.62 - n * 0.1) + ')',
                sz * (11 - n * 1.6),
              );
            }
            c.translate(mx.x, mx.y);
            c.scale(sz * (q.x < start.x ? -1 : 1), sz);
            c.beginPath();
            c.moveTo(-11, 5);
            c.quadraticCurveTo(-12, -11, -2, -12);
            c.quadraticCurveTo(9, -14, 11, -4);
            c.lineTo(12, 8);
            c.lineTo(6, 5);
            c.lineTo(2, 10);
            c.lineTo(-3, 6);
            c.lineTo(-8, 9);
            c.closePath();
            c.fillStyle = '#a9f7c3';
            c.fill();
            c.strokeStyle = '#253e31';
            c.lineWidth = 1.5;
            c.stroke();
            rect(c, 0, -5, 2.5, 4, ink);
            rect(c, 6, -5, 2.5, 4, ink);
            c.restore();
          }
        }
      }
      const action = { coupe: 'DASH', wagon: 'GUARD', tow: 'HOOK', ambulance: 'MEND' };
      for (const hit of hits) {
        const word = action[r.targets[hit.index].kind];
        const badgeW = word === 'GUARD' ? 59 : 54, badgeH = 18;
        let best = Infinity;
        // Try all four edges of the target ring. Earlier flags and cars get first claim.
        for (const [dx, dy] of [[0, -rad - 11], [0, rad + 11],
          [rad + badgeW / 2 + 2, 0], [-rad - badgeW / 2 - 2, 0]]) {
          const x = Math.max(2, Math.min(w - badgeW - 2, hit.x + dx - badgeW / 2));
          const y = Math.max(2, Math.min(h - badgeH - 2, hit.y + dy - badgeH / 2));
          let overlap = 0;
          for (const other of hits) {
            const dx = Math.max(x - other.x, other.x - x - badgeW, 0);
            const dy = Math.max(y - other.y, other.y - y - badgeH, 0);
            overlap += Math.max(0, rad * 0.86 - Math.hypot(dx, dy));
            const b = other.badge;
            if (other !== hit && b && x < b.x + b.w + 2 && x + badgeW + 2 > b.x &&
                y < b.y + badgeH + 2 && y + badgeH + 2 > b.y) overlap += 100;
          }
          if (overlap < best) {
            best = overlap;
            hit.badge = { x, y, w: badgeW, h: badgeH };
          }
          if (!overlap) break;
        }
        const {x, y} = hit.badge;
        const accent = hit.index === r.selected ? lime : ivory;
        const nx = Math.max(x, Math.min(x + badgeW, hit.x));
        const ny = Math.max(y, Math.min(y + badgeH, hit.y));
        const heading = Math.atan2(ny - hit.y, nx - hit.x);
        line(c, hit.x + Math.cos(heading) * rad, hit.y + Math.sin(heading) * rad, nx, ny, accent, 1);
        poly(c, [x, y, x + badgeW, y, x + badgeW - 3, y + badgeH, x, y + badgeH], ink, accent, 1.2);
        poly(c, [x, y, x + 16, y, x + 13, y + badgeH, x, y + badgeH], accent);
        label(c, hit.index + 1, x + 7, y + 13, 11, ink);
        c.font = '600 12px Barlow, "Arial Narrow", sans-serif';
        c.textAlign = 'center';
        c.fillStyle = accent;
        c.fillText(word, x + (badgeW + 13) / 2, y + 13);
      }
    } else if (r.phase === 'drive') {
      const q = screen(playerPoint),
        heading = playerPoint.angle + bodyYaw(r.player) + cam.angle,
        top = q.y - (11 * Math.abs(Math.sin(heading)) + 5 * Math.abs(Math.cos(heading))) * cam.z - 7;
      poly(c, [q.x - 4.5, top - 4, q.x + 4.5, top - 4, q.x, top + 1], lime, ink, 0.8);
      if (r.charge > 0) {
        rect(c, q.x - 9, top - 9, 18, 4, ink);
        rect(c, q.x - 8, top - 8, 16 * r.charge, 2, r.charge === 1 ? ivory : lime);
      }
    }
  }
  function hitTarget(state, clientX, clientY) {
    if (state.phase !== 'clutch') return -1;
    const box = canvas.getBoundingClientRect(),
      x = ((clientX - box.left) * width) / box.width,
      y = ((clientY - box.top) * height) / box.height;
    let best = -1,
      distance = Infinity;
    for (const hit of hits) {
      const b = hit.badge;
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return hit.index;
    }
    for (const hit of hits) {
      const d = Math.hypot(x - hit.x, y - hit.y);
      if (d <= hit.r && d < distance) {
        best = hit.index;
        distance = d;
      }
    }
    return best;
  }
  return { draw, hitTarget };
}
