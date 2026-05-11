import { state, PHASES } from './state.js';
import { bezier } from './physics.js';

const COLORS = {
  grass: '#2f7a3a',
  grassDark: '#256330',
  dirt: '#b8895a',
  dirtDark: '#9a6f44',
  base: '#ffffff',
  rubber: '#e8e8e8',
  ball: '#ffffff',
  ballShadow: 'rgba(0,0,0,0.4)',
  rampFill: '#c4163c',
  rampStroke: '#7a0e26',
  line: 'rgba(255,255,255,0.6)',
};

let pitcherPos = { x: 0.5, y: 0.55 };
let homePos = { x: 0.5, y: 0.88 };
let arcApex = { x: 0.5, y: 0.18 };

export function setupField(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);
  return ctx;
}

export function drawField(ctx, canvas) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  // sky / outfield background gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0d1220');
  sky.addColorStop(0.25, '#1f2a44');
  sky.addColorStop(0.26, COLORS.grassDark);
  sky.addColorStop(1, COLORS.grass);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // outfield arc (subtle stripes)
  ctx.save();
  ctx.translate(w * 0.5, h * 0.88);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? COLORS.grass : COLORS.grassDark;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(w, h) * (1 - i * 0.1), Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#050810';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(w, h) * (1 - (i + 1) * 0.1 + 0.005), Math.PI, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // infield diamond (rotated square)
  drawDiamond(ctx, w, h);

  // foul lines
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * homePos.x, h * homePos.y);
  ctx.lineTo(w * 0.02, h * 0.22);
  ctx.moveTo(w * homePos.x, h * homePos.y);
  ctx.lineTo(w * 0.98, h * 0.22);
  ctx.stroke();

  // pitcher's mound
  ctx.fillStyle = COLORS.dirt;
  ctx.beginPath();
  ctx.arc(w * pitcherPos.x, h * pitcherPos.y, w * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.rubber;
  ctx.fillRect(w * pitcherPos.x - w * 0.025, h * pitcherPos.y - 2, w * 0.05, 4);

  // home plate
  drawHomePlate(ctx, w, h);

  // runners on bases
  drawRunners(ctx, w, h);

  // ramp on fence (drawn here so we can show it physically in field)
  drawRamp(ctx, w, h);

  // ball
  drawBall(ctx, w, h);
}

function drawDiamond(ctx, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.62;
  const r = w * 0.32;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = COLORS.dirt;
  ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(-r * 0.55, -r * 0.55, r * 1.1, r * 1.1);
  ctx.restore();

  const baseSize = w * 0.025;
  const bases = [
    { x: cx + r * 0.7, y: cy }, // 1B
    { x: cx, y: cy - r * 0.7 }, // 2B
    { x: cx - r * 0.7, y: cy }, // 3B
  ];
  ctx.fillStyle = COLORS.base;
  bases.forEach((b) => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-baseSize / 2, -baseSize / 2, baseSize, baseSize);
    ctx.restore();
  });
}

function drawHomePlate(ctx, w, h) {
  const cx = w * homePos.x;
  const cy = h * homePos.y;
  const s = w * 0.035;
  ctx.fillStyle = COLORS.base;
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s * 0.4);
  ctx.lineTo(cx + s, cy - s * 0.4);
  ctx.lineTo(cx + s, cy);
  ctx.lineTo(cx, cy + s * 0.5);
  ctx.lineTo(cx - s, cy);
  ctx.closePath();
  ctx.fill();
}

function drawRunners(ctx, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.62;
  const r = w * 0.32;
  const baseSpots = {
    first: { x: cx + r * 0.7, y: cy },
    second: { x: cx, y: cy - r * 0.7 },
    third: { x: cx - r * 0.7, y: cy },
  };
  for (const key of ['first', 'second', 'third']) {
    if (!state.bases[key]) continue;
    const p = baseSpots[key];
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a3a7a';
    ctx.fillRect(p.x - 4, p.y - 2, 8, 10);
  }
}

function drawRamp(ctx, w, h) {
  if (state.ramp.slot < 0) return;
  const fenceTop = h * 0.22;
  const slotCount = 12;
  const slotWidth = (w * 0.9) / slotCount;
  const slotLeft = w * 0.05 + state.ramp.slot * slotWidth;
  const rampWidth = slotWidth * state.ramp.widthFraction;
  const rampLeft = slotLeft + (slotWidth - rampWidth) / 2;
  ctx.fillStyle = COLORS.rampFill;
  ctx.strokeStyle = COLORS.rampStroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rampLeft, fenceTop + 6);
  ctx.lineTo(rampLeft + rampWidth, fenceTop + 6);
  ctx.lineTo(rampLeft + rampWidth / 2, fenceTop - 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawBall(ctx, w, h) {
  let bx, by;
  if (state.phase === PHASES.PITCHING) {
    const t = state.pitch.t;
    bx = pitcherPos.x + (homePos.x - pitcherPos.x) * t;
    by = pitcherPos.y + (homePos.y - pitcherPos.y) * t;
  } else if (state.phase === PHASES.BALL_IN_FLIGHT && state.ball.landingX != null) {
    const t = state.ball.t;
    const p0 = { x: homePos.x, y: homePos.y };
    const p2 = { x: state.ball.landingX, y: 0.22 };
    const p1 = { x: (p0.x + p2.x) / 2, y: arcApex.y };
    const pt = bezier(t, p0, p1, p2);
    bx = pt.x;
    by = pt.y;
  } else {
    return;
  }
  const px = bx * w;
  const py = by * h;
  ctx.beginPath();
  ctx.fillStyle = COLORS.ballShadow;
  ctx.ellipse(px, py + 8, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = COLORS.ball;
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c4163c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(px, py, 6, 0.2, 1.3);
  ctx.stroke();
}
