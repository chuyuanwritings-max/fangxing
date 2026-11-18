// 共用的东西：画布、版面、全局状态 G、按钮、特效（墨点、飘字、飞钱、震屏）。
// 各个画面（scene_*.js）都从这里拿；流程函数挂在 U.flow 上（main.js 填），免得互相 require 打圈。
const platform = require('./platform.js');
const config = require('./config.js');
const A = require('./art.js');
const sfx = require('./sfx.js');
const { clamp, lerp, easeOut } = require('./util.js');

const U = { onTouch: null, flow: {} };
const P = platform.setup((type, id, x, y) => U.onTouch && U.onTouch(type, id, x, y));
platform.configureAds({ adUnitId: config.rewardedAdUnitId, fakeAdMs: config.fakeAdSec * 1000 });
const DESIGN_W = 375;
const scale = P.width / DESIGN_W;
const L = { W: DESIGN_W, H: P.height / scale };
const ctx = P.ctx;
const C = A.C;

// —— 查证画面的版面：上半是窗口（看人），下半是证件和按钮（单手够得着）——
const LY = (() => {
  const H = L.H;
  const boothY = 52;
  const boothH = clamp(Math.round(H - 450), 140, 290);
  const chipsY = boothY + boothH + 8;
  const deskY = chipsY + 34;
  const ctrlY = H - 62;
  return {
    hudY: 8,
    booth: { x: 8, y: boothY, w: 359, h: boothH },
    counterY: boothY + boothH - 24,
    chipsY,
    deskY,
    ctrlY,
    actY: ctrlY - 50,
    docs: { id: { x: 10, y: deskY + 6 }, pass: { x: 191, y: deskY } },
    docsBottom: deskY + A.SIZE.pass[1] + 6,
  };
})();
LY.cell = LY.booth.h >= 260 ? 7 : LY.booth.h >= 190 ? 6 : 5;
LY.personTop = LY.counterY - 19 * LY.cell;
LY.gapTop = LY.docsBottom + 8;
LY.gapH = LY.actY - 8 - LY.gapTop;

const G = {
  mode: 'title',
  modeT: 0,
  t: 0,
  timeScale: 1, // 测试用：机器人可以把时间调快
  run: null,
  day: null,
  cur: null,
  ph: 'enter',
  phT: 0,
  lines: [],
  drag: null,
  react: null,
  printFx: null,
  bribe: null,
  decision: null,
  slammed: false,
  result: null,
  talkStep: 0,
  talkChoice: null,
  shake: 0,
  freeze: 0,
  flash: null,
  floats: [],
  parts: [],
  ripples: [],
  coins: [],
  toast: null,
  hl: null,
  modal: null,
  buttons: [],
  pressed: null,
  moneyShown: 0,
  moneyTarget: 0,
  walletBump: 0,
  walletPos: { x: 320, y: 26 },
  chipRects: {},
  leaving: null,
  gate: 0,
  adFor: null,
  lastTick: 99,
  save: null,
};

function setMode(m) {
  G.mode = m;
  G.modeT = 0;
}
function setPh(p) {
  G.ph = p;
  G.phT = 0;
}
function toast(text, color, y) {
  G.toast = { text, t: 0, color: color || C.yellow, y };
}
function float(text, x, y, color, size) {
  G.floats.push({ text, x, y, color, size: size || 18, t: 0 });
}
function splat(x, y, color, n, power) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (40 + Math.random() * 160) * power;
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, s: 2 + Math.floor(Math.random() * 4), color, t: 0, life: 0.4 + Math.random() * 0.4 });
  }
}
// 钱飞进钱包（kind: coin / bill）；value 到了才加进钱包显示（onArrive）
function flyMoney(x, y, n, opt) {
  opt = opt || {};
  for (let i = 0; i < n; i++) {
    G.coins.push({
      x0: x + (Math.random() - 0.5) * 20, y0: y + (Math.random() - 0.5) * 10,
      x1: opt.tx != null ? opt.tx : G.walletPos.x, y1: opt.ty != null ? opt.ty : G.walletPos.y,
      t: 0, delay: (opt.gap != null ? opt.gap : 0.06) * i + (opt.delay || 0), dur: config.anim.coinFlySec * (opt.slow || 1),
      kind: opt.kind || 'coin', i, out: !!opt.out, onArrive: i === n - 1 ? opt.onArrive : opt.each,
      value: opt.value || 0,
    });
  }
}

function inRect(r, x, y) {
  return r && x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
}
function hitButton(x, y) {
  for (let i = G.buttons.length - 1; i >= 0; i--) {
    const b = G.buttons[i];
    if (b.disabled) continue;
    if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4) return b;
  }
  return null;
}

function button(id, x, y, w, h, label, fill, shade, fn, opt) {
  opt = opt || {};
  const down = G.pressed === id;
  const dy = down ? 3 : 0;
  const dis = !!opt.disabled;
  ctx.save();
  if (dis) ctx.globalAlpha *= 0.42;
  if (opt.pulse) {
    const k = 0.5 + 0.5 * Math.sin(G.t * 7);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.18 * k).toFixed(2) + ')';
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x + 2, y + 5, w, h);
  A.block(ctx, x, y + dy, w, h, fill, shade, { shadeH: 5, hi: 'rgba(255,255,255,0.25)' });
  const ix = opt.icon ? 18 : 0;
  if (opt.icon) A.icon(ctx, opt.icon, x + 20, y + dy + h / 2 - 1, opt.iconCell || 2);
  const ty = opt.sub ? y + dy + h / 2 - 7 : y + dy + h / 2 - 1;
  A.text(ctx, label, x + w / 2 + ix / 2, ty, opt.size || 16, opt.color || C.ink, 'center', '900');
  if (opt.sub) A.text(ctx, opt.sub, x + w / 2 + ix / 2, y + dy + h - 12, opt.subSize || 10, opt.subColor || opt.color || C.ink, 'center', '700');
  ctx.restore();
  G.buttons.push({ id, x, y, w, h, fn, disabled: dis });
}

// 中文按字数换行，标点不放行首
function wrap(s, n) {
  const out = [];
  let cur = '';
  for (const ch of s) {
    cur += ch;
    if (cur.length >= n && !/[，。？！…、」]/.test(ch)) {
      out.push(cur);
      cur = '';
    }
  }
  if (cur) {
    if (out.length && cur.length <= 2) out[out.length - 1] += cur;
    else out.push(cur);
  }
  for (let i = 1; i < out.length; i++) {
    while (out[i] && /^[，。？！…、」]/.test(out[i])) {
      out[i - 1] += out[i][0];
      out[i] = out[i].slice(1);
    }
  }
  return out.filter((l) => l);
}

function dim(a) {
  ctx.fillStyle = 'rgba(8,5,14,' + a + ')';
  ctx.fillRect(-20, -20, L.W + 40, L.H + 40);
}

function update(dtReal) {
  const dt = dtReal * G.timeScale;
  G.ripples.forEach((r) => (r.t += dtReal));
  G.ripples = G.ripples.filter((r) => r.t < 0.35);
  G.shake = Math.max(0, G.shake - dt * 40);
  if (G.flash) {
    G.flash.t += dt;
    if (G.flash.t > 0.25) G.flash = null;
  }
  G.parts.forEach((p) => {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 600 * dt;
    p.vx *= 0.96;
  });
  G.parts = G.parts.filter((p) => p.t < p.life);
  G.floats.forEach((f) => (f.t += dt));
  G.floats = G.floats.filter((f) => f.t < 1.2);
  const keep = [];
  G.coins.forEach((c) => {
    c.t += dt;
    if (c.t >= c.delay + c.dur) {
      if (!c.out) {
        if (c.kind === 'bill') sfx.billIn();
        else sfx.coinIn(c.i);
        G.walletBump = 1;
      }
      if (c.onArrive) c.onArrive(c);
    } else keep.push(c);
  });
  G.coins = keep;
  G.walletBump = Math.max(0, G.walletBump - dt * 5);
  if (G.toast) {
    G.toast.t += dt;
    if (G.toast.t > 1.6) G.toast = null;
  }
  // 钱数滚动，不跳
  const want = G.moneyTarget;
  if (Math.abs(G.moneyShown - want) > 0.5) {
    const step = Math.sign(want - G.moneyShown) * Math.max(1, Math.abs(want - G.moneyShown) * dt * 6);
    G.moneyShown = Math.abs(step) > Math.abs(want - G.moneyShown) ? want : G.moneyShown + step;
    if (Math.floor(G.t * 30) % 2 === 0) sfx.count();
  } else G.moneyShown = want;
}

function drawFx() {
  G.parts.forEach((p) => {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = C.ink;
    ctx.fillRect(p.x - 1, p.y - 1, p.s + 2, p.s + 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.s, p.s);
  });
  ctx.globalAlpha = 1;
  G.coins.forEach((c) => {
    if (c.t < c.delay) return;
    const k = clamp((c.t - c.delay) / c.dur, 0, 1);
    const e = k * k * (3 - 2 * k);
    const x = lerp(c.x0, c.x1, e);
    const y = lerp(c.y0, c.y1, e) - Math.sin(k * Math.PI) * (c.out ? -30 : 60);
    if (c.kind === 'bill') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(c.t * 12 + c.i) * 0.5);
      A.block(ctx, -11, -6, 22, 12, '#8fdc98', '#5aa864', { shadeH: 3, outline: 1 });
      ctx.restore();
    } else {
      const w = Math.abs(Math.cos(c.t * 14 + c.i)) * 4 + 2;
      ctx.fillStyle = C.ink;
      ctx.fillRect(x - w - 1, y - 6, w * 2 + 2, 12);
      ctx.fillStyle = c.out ? C.red : C.yellow;
      ctx.fillRect(x - w, y - 5, w * 2, 10);
    }
  });
  G.floats.forEach((f) => {
    ctx.globalAlpha = 1 - clamp((f.t - 0.7) / 0.5, 0, 1);
    const pop = f.t < 0.1 ? 1 + (0.1 - f.t) * 4 : 1;
    A.bigText(ctx, f.text, f.x, f.y - easeOut(Math.min(1, f.t)) * 30, Math.round(f.size * pop), f.color);
  });
  ctx.globalAlpha = 1;
  G.ripples.forEach((r) => {
    ctx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, 0.5 - r.t * 1.4).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 6 + r.t * 60, 0, Math.PI * 2);
    ctx.stroke();
  });
  if (G.toast) {
    const a = clamp(1.6 - G.toast.t, 0, 1);
    ctx.globalAlpha = a;
    const y = G.toast.y || LY.deskY - 4;
    ctx.font = '900 14px sans-serif';
    const w = ctx.measureText(G.toast.text).width + 28;
    A.block(ctx, L.W / 2 - w / 2, y - 14, w, 28, '#241c30', '#1a1424', { shadeH: 3 });
    A.text(ctx, G.toast.text, L.W / 2, y, 14, G.toast.color, 'center', '900');
    ctx.globalAlpha = 1;
  }
}

Object.assign(U, {
  P, L, LY, G, C, ctx, scale, setMode, setPh, toast, float, splat, flyMoney, inRect, hitButton, button, wrap, dim, update, drawFx,
});
module.exports = U;
