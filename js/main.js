// 《放行》原型主程序：开场 → 三天（每天：上班前 → 查证 → 下班 → 记账 → 回家）→ 结局。
// 全部画在一张 canvas 上（微信小游戏没有 HTML 按钮）。
//
// 流程（G.mode）：
//   title 开场 → brief 上班前（新规则、督察） → work 查证
//     work 里每个人：enter 走到窗口 → docs 递证件 → check 查（点圈、滑动）→ stamp 盖章 → leave 走开
//     判错 → slip 罚单（时钟停）→ leave
//     调出档案 → ad 广告占位 → folder 档案袋翻开 → work（高亮一处）
//   时间到 → closing 下班 →（有事件）event → ledger 记账（加班 → ad → work）→ night 回家 → 下一天 brief
//   第 3 天回家后 / 家里出大事 → ending 结局
const platform = require('./platform.js');
const config = require('./config.js');
const data = require('./data.js');
const D = require('./day.js');
const A = require('./art.js');
const face = require('./face.js');
const sfx = require('./sfx.js');
const { clamp, lerp, easeOut, fmtDate, hash } = require('./util.js');

const C = A.C;
const DESIGN_W = 375;
const touches = {};
const P = platform.setup(onTouch);
platform.configureAds({ adUnitId: config.rewardedAdUnitId, fakeAdMs: config.fakeAdSec * 1000 });
const scale = P.width / DESIGN_W;
const L = { W: DESIGN_W, H: P.height / scale };

// —— 版面 ——
const LY = (() => {
  const H = L.H;
  const boothY = 76;
  const boothH = clamp(Math.round(H - 480), 196, 300);
  const chipsY = boothY + boothH + 8;
  const deskY = chipsY + 34;
  const ctrlY = H - 52;
  return {
    hudY: 38,
    booth: { x: 8, y: boothY, w: 359, h: boothH },
    counterY: boothY + boothH - 24,
    chipsY,
    deskY,
    ctrlY,
    ctrlTop: ctrlY - 40,
    docs: {
      id: { x: 10, y: deskY + 8 },
      pass: { x: 191, y: deskY + 2 },
      permit: { x: 10, y: deskY + 8 + A.SIZE.id[1] + 12 },
    },
  };
})();
const PERSON_CELL = LY.booth.h >= 260 ? 7 : 6;
const personTop = LY.counterY - 19 * PERSON_CELL;
// 证件下面那块空地：放教学提示、档案结果
function hintY() {
  const passB = LY.docs.pass.y + A.SIZE.pass[1];
  const permB = hasPermitRule() ? LY.docs.permit.y + A.SIZE.permit[1] : 0;
  return Math.max(passB, permB, LY.docs.id.y + A.SIZE.id[1]) + 14;
}

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
  marks: [], // [{id, t}]
  bribe: null, // null 没钱 / 'pending' / 'took' / 'refused'
  decision: null,
  slammed: false,
  result: null,
  lastResult: null,
  drag: null,
  dragShown: 0,
  shake: 0,
  freeze: 0,
  flash: null,
  floats: [],
  parts: [],
  ripples: [],
  toast: null,
  hl: null, // 档案高亮
  modal: null, // 'bribe' | 'rules'
  buttons: [],
  pressed: null,
  moneyShown: 0,
  paid: {},
  nightLines: [],
  leaving: null, // 正在走开的人（下一个已经在走过来）
  gate: 0,
  adFor: null,
  lastTick: 99,
  history: [],
  save: platform.load('fangxing_v1') || { plays: 0, best: null },
};

function setMode(m) {
  G.mode = m;
  G.modeT = 0;
}
function setPh(p) {
  G.ph = p;
  G.phT = 0;
}
function toast(text, color) {
  G.toast = { text, t: 0, color: color || C.yellow };
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

function hasPermitRule() {
  return G.run && D.rules(G.run).indexOf('permit') >= 0;
}
function income() {
  return G.run ? G.run.money + (G.day ? D.income(G.day) : 0) : 0;
}

// —— 证件和可点区 ——
function docSize(doc) {
  return A.SIZE[doc];
}
function fieldRect(fid) {
  const doc = fid.split('.')[0];
  const p = LY.docs[doc];
  if (fid === 'permit.slot') return [p.x, p.y, A.SIZE.permit[0], A.SIZE.permit[1]];
  const r = A.FIELDS[doc][fid];
  return [p.x + r[0], p.y + r[1], r[2], r[3]];
}
function presentFields() {
  const out = Object.keys(A.FIELDS.id).concat(Object.keys(A.FIELDS.pass));
  if (hasPermitRule()) {
    if (G.cur && G.cur.docs.permit) out.push(...Object.keys(A.FIELDS.permit));
    else out.push('permit.slot');
  }
  return out;
}
function billRect() {
  const p = LY.docs.pass;
  return [p.x + 112, p.y - 16, 58, 30];
}

// —— 流程 ——
function startRun() {
  G.run = D.newRun(Math.floor(Math.random() * 1e9));
  G.history = [];
  G.save.plays += 1;
  platform.save('fangxing_v1', G.save);
  startDayFlow();
}

function startDayFlow() {
  G.day = D.startDay(G.run);
  G.cur = null;
  G.leaving = null;
  G.moneyShown = income();
  setMode('brief');
  sfx.paper();
}

function openWindow() {
  setMode('work');
  G.cur = D.current(G.day);
  resetPerson();
  sfx.bell();
}

function resetPerson() {
  G.marks = [];
  G.bribe = G.cur && G.cur.bribe ? 'pending' : null;
  G.decision = null;
  G.slammed = false;
  G.result = null;
  G.hl = null;
  G.drag = null;
  G.modal = null;
  setPh('enter');
}

function nextPerson() {
  G.leaving = null;
  G.day.qi += 1;
  G.cur = D.current(G.day);
  if (!G.cur) return endShift(true);
  if (G.day.timeLeft <= 0) return endShift(false);
  resetPerson();
}

function endShift(empty) {
  G.modal = null;
  G.drag = null;
  G.closingEmpty = !!empty;
  setMode('closing');
  sfx.bell();
}

function toLedger() {
  D.closeDay(G.run, G.day);
  const shown = G.day.endShown || 0;
  if (G.day.endEvents.length > shown) {
    G.event = G.day.endEvents[shown];
    G.day.endShown = shown + 1;
    setMode('event');
    if (G.event.money > 0) { sfx.fanfare(); G.shake = config.juice.bigShake; G.freeze = config.juice.bigHitstopSec; }
    else { sfx.bad(); G.shake = config.juice.stampShake; }
    return;
  }
  G.paid = D.defaultPaid(G.run, G.day);
  setMode('ledger');
}

function goHome() {
  G.nightLines = D.settle(G.run, G.day, G.paid);
  G.history.push({ day: G.day.idx + 1, log: G.day.log.slice() });
  setMode('night');
  sfx.sad();
}

function afterNight() {
  if (G.run.over || G.run.dayIdx >= config.days - 1) {
    finish();
    return;
  }
  D.nextDay(G.run);
  startDayFlow();
}

function finish() {
  const s = G.run.stats;
  const best = G.save.best;
  if (!best || G.run.money > best.money) G.save.best = { money: G.run.money, acc: s.total ? Math.round((s.correct / s.total) * 100) : 0 };
  platform.save('fangxing_v1', G.save);
  setMode('ending');
  if (G.run.over) sfx.sad();
  else sfx.fanfare();
}

// —— 查证 ——
function decide(dec) {
  if (G.mode !== 'work' || G.ph !== 'check' || G.modal) return;
  if (G.bribe === 'pending') {
    G.bribe = 'refused';
    toast('钱推回去了');
    sfx.push();
  }
  G.decision = dec;
  G.drag = null;
  setPh('stamp');
}

function slam() {
  G.slammed = true;
  const res = D.resolve(G.run, G.day, G.cur, G.decision, G.marks.map((m) => m.id), G.bribe === 'took');
  G.result = res;
  G.lastResult = res;
  const p = LY.docs.pass;
  const sx = p.x + 87;
  const sy = p.y + 70;
  const ok = G.decision === 'pass';
  const big = G.cur.story && G.cur.story.id === 'grey' && G.decision === 'reject' && G.bribe === 'refused';
  const J = config.juice;
  splat(sx, sy, ok ? '#2fae5c' : '#d8362d', res.evidence || big ? 26 : 14, res.evidence || big ? 1.4 : 1);
  if (big) {
    G.shake = J.bigShake;
    G.freeze = J.bigHitstopSec;
    G.flash = { t: 0, color: '255,210,63' };
    sfx.stamp(true);
    sfx.fanfare();
  } else if (res.evidence) {
    G.shake = J.evidenceShake;
    G.freeze = J.hitstopSec;
    G.flash = { t: 0, color: '255,255,255' };
    sfx.stamp(true);
    sfx.evidence();
  } else {
    G.shake = J.stampShake;
    sfx.stamp(false);
    if (res.correct) sfx.good();
  }
  platform.vibrate(true);
  if (res.correct) {
    float('+' + config.pay.correct, sx, sy - 40, C.green, 22);
    if (res.evidence) float('查实 +' + config.pay.evidence, sx, sy - 66, C.yellow, 18);
  } else {
    float('−' + config.pay.fine, sx, sy - 40, C.red, 24);
    sfx.bad();
    G.flash = { t: 0, color: '224,67,58' };
  }
}

function closeSlip() {
  setMode('work');
  setPh('leave');
  sfx.paper();
}

function toggleMark(fid) {
  const i = G.marks.findIndex((m) => m.id === fid);
  const r = fieldRect(fid);
  if (i >= 0) {
    G.marks.splice(i, 1);
    sfx.unmark();
  } else {
    G.marks.push({ id: fid, t: G.t });
    sfx.mark();
    platform.vibrate(false);
    splat(r[0] + r[2] / 2, r[1] + r[3] / 2, '#e0433a', 5, 0.35);
  }
}

function tapDesk(x, y) {
  if (G.ph !== 'check' && G.ph !== 'docs') return;
  if (G.bribe === 'pending' && inRect(billRect(), x, y)) {
    G.modal = 'bribe';
    sfx.paper();
    return;
  }
  const fs = presentFields();
  // 小的格先判（印章在通行证里）
  for (let i = fs.length - 1; i >= 0; i--) {
    if (inRect(fieldRect(fs[i]), x, y)) {
      toggleMark(fs[i]);
      return;
    }
  }
  sfx.tap();
}

function takeBribe(yes) {
  G.modal = null;
  if (yes) {
    G.bribe = 'took';
    sfx.coin();
    const r = billRect();
    for (let i = 0; i < 6; i++) G.parts.push({ x: r[0] + 20, y: r[1] + 10, vx: (Math.random() - 0.5) * 80, vy: -120 - Math.random() * 80, s: 4, color: C.yellow, t: 0, life: 0.6, coin: true });
    float('+¥' + G.cur.bribe + ' 进抽屉', r[0] + 10, r[1] - 10, C.yellow, 14);
  } else {
    G.bribe = 'refused';
    sfx.push();
    toast('钱推回去了');
  }
}

function callFile() {
  if (G.mode !== 'work' || G.ph !== 'check' || G.modal) return;
  if (G.hl) return toast('档案已经调过了');
  if (G.day.adsLeft <= 0) {
    sfx.nope();
    return toast('今天的档案调完了');
  }
  G.adFor = 'file';
  setMode('ad');
  sfx.whoosh();
  platform.showRewardedAd(() => {
    G.day.adsLeft -= 1;
    setMode('folder');
    sfx.folder();
  });
}

function callOvertime() {
  if (G.day.overtimeUsed) return;
  G.adFor = 'overtime';
  setMode('ad');
  sfx.whoosh();
  platform.showRewardedAd(() => {
    D.addOvertime(G.run, G.day);
    setMode('work');
    G.cur = D.current(G.day);
    G.leaving = null;
    resetPerson();
    toast('加班一小时', C.teal);
    sfx.bell();
  });
}

function toggleBill(id) {
  if (G.paid[id]) {
    G.paid[id] = false;
    sfx.unmark();
    return;
  }
  const cost = D.billCost(G.day, id);
  const used = data.bills.reduce((s, b) => s + (G.paid[b.id] ? D.billCost(G.day, b.id) : 0), 0);
  if (income() - used >= cost) {
    G.paid[id] = true;
    sfx.coin();
  } else {
    sfx.nope();
    toast('钱不够', C.red);
    G.shake = 3;
  }
}

// —— 输入 ——
function inRect(r, x, y) {
  return x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
}
function hitButton(x, y) {
  for (let i = G.buttons.length - 1; i >= 0; i--) {
    const b = G.buttons[i];
    if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4) return b;
  }
  return null;
}

const TAP_ANY = { slip: 0.4, event: 0.6, night: 0.8, closing: 0.6 };

function onTouch(type, id, sx, sy) {
  const x = sx / scale;
  const y = sy / scale;
  if (type === 'down') {
    platform.unlockAudio();
    G.ripples.push({ x, y, t: 0 });
    if (G.mode === 'ad' || G.mode === 'folder') return;
    const b = hitButton(x, y);
    if (b) {
      touches[id] = { role: 'btn', b };
      G.pressed = b.id;
      sfx.tap();
      return;
    }
    if (G.modal === 'rules') {
      G.modal = null;
      sfx.paper();
      touches[id] = { role: 'none' };
      return;
    }
    if (G.modal === 'bribe') {
      touches[id] = { role: 'none' };
      return;
    }
    if (TAP_ANY[G.mode] !== undefined) {
      touches[id] = { role: 'any' };
      return;
    }
    if (G.mode === 'work') {
      if (y >= LY.chipsY - 4 && y <= LY.chipsY + 28) {
        G.modal = 'rules';
        sfx.paper();
        touches[id] = { role: 'none' };
        return;
      }
      if (y >= LY.deskY - 20 && y < LY.ctrlTop) {
        touches[id] = { role: 'desk', x0: x, y0: y, moved: false, lastX: x };
        return;
      }
      if (y >= LY.booth.y && y < LY.booth.y + LY.booth.h) {
        sfx.tap();
        if (G.cur && G.ph === 'check') G.poke = G.t;
      }
    }
    touches[id] = { role: 'none' };
  } else if (type === 'move') {
    const t = touches[id];
    if (!t || t.role !== 'desk') return;
    const dx = x - t.x0;
    const dy = y - t.y0;
    if (!t.moved && Math.hypot(dx, dy) > config.tapSlop) t.moved = true;
    if (t.moved && G.mode === 'work' && G.ph === 'check' && !G.modal && Math.abs(dx) > Math.abs(dy) * 0.7) {
      if (G.drag === null) sfx.drag();
      G.drag = dx;
      if (Math.abs(x - t.lastX) > 30) {
        sfx.drag();
        t.lastX = x;
      }
    }
  } else {
    const t = touches[id];
    delete touches[id];
    if (!t) return;
    if (t.role === 'btn') {
      G.pressed = null;
      const b = hitButton(x, y);
      if (b && b.id === t.b.id) {
        sfx.button();
        t.b.fn();
      }
    } else if (t.role === 'any') {
      if (G.modeT < TAP_ANY[G.mode]) return;
      if (G.mode === 'slip') closeSlip();
      else if (G.mode === 'event') toLedger();
      else if (G.mode === 'night') afterNight();
      else if (G.mode === 'closing') toLedger();
    } else if (t.role === 'desk') {
      if (G.drag !== null) {
        const d = G.drag;
        G.drag = null;
        if (Math.abs(d) >= config.swipeDist) decide(d > 0 ? 'pass' : 'reject');
      } else if (!t.moved && G.mode === 'work' && !G.modal) tapDesk(x, y);
    }
  }
}

// —— 更新 ——
function update(dtReal) {
  const dt = dtReal * G.timeScale;
  // 特效照常走（顿帧时也走，免得画面死掉）
  G.ripples.forEach((r) => (r.t += dtReal));
  G.ripples = G.ripples.filter((r) => r.t < 0.35);
  if (G.freeze > 0) {
    G.freeze -= dt;
    return;
  }
  G.t += dt;
  G.modeT += dt;
  G.phT += dt;
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
  G.floats = G.floats.filter((f) => f.t < 1.1);
  if (G.toast) {
    G.toast.t += dt;
    if (G.toast.t > 1.6) G.toast = null;
  }
  G.dragShown = lerp(G.dragShown, G.drag === null ? 0 : G.drag * 0.85, Math.min(1, dt * 18));
  const want = income();
  if (Math.abs(G.moneyShown - want) > 0.5) {
    const step = Math.sign(want - G.moneyShown) * Math.max(1, Math.abs(want - G.moneyShown) * dt * 6);
    G.moneyShown = Math.abs(step) > Math.abs(want - G.moneyShown) ? want : G.moneyShown + step;
    if (Math.floor(G.t * 30) % 2 === 0) sfx.count();
  } else G.moneyShown = want;
  // 栏杆：有人被放行时抬起
  const gateUp = G.mode === 'work' && G.ph === 'leave' && G.decision === 'pass';
  G.gate = lerp(G.gate, gateUp ? 1 : 0, Math.min(1, dt * 8));

  const m = G.mode;
  const an = config.anim;
  if (m === 'work') {
    const day = G.day;
    day.timeLeft -= dt;
    const sec = Math.ceil(day.timeLeft);
    if (sec !== G.lastTick && day.timeLeft > 0 && day.timeLeft <= config.lowTimeSec) sfx.tick(sec <= 5);
    G.lastTick = sec;
    if (G.ph === 'enter') {
      if (Math.floor(G.phT / 0.14) !== Math.floor((G.phT - dt) / 0.14)) sfx.step(Math.floor(G.phT / 0.14));
      if (G.phT >= an.walkIn) {
        setPh('docs');
        sfx.paper();
      }
    } else if (G.ph === 'docs' && G.phT >= an.docsIn) setPh('check');
    else if (G.ph === 'stamp') {
      if (!G.slammed && G.phT >= an.stampHit) slam();
      if (G.phT >= an.stampSec) {
        if (G.result && !G.result.correct) {
          setMode('slip');
        } else {
          setPh('leave');
          sfx.paper();
        }
      }
    } else if (G.ph === 'leave') {
      const extra = G.cur && G.cur.story ? an.leaveLineSec : 0;
      if (G.phT >= an.leave + extra) nextPerson();
    }
    if (G.mode === 'work' && day.timeLeft <= 0 && (G.ph === 'enter' || G.ph === 'docs' || G.ph === 'check')) endShift(false);
  } else if (m === 'slip') {
    if (G.modeT >= an.slipSec) closeSlip();
  } else if (m === 'folder') {
    if (G.modeT >= an.folderSec) {
      G.hl = { t: G.t, fields: G.cur.flaw ? G.cur.flaw.fields.slice(0, 1) : [], clean: !G.cur.flaw };
      setMode('work');
      sfx.mark();
    }
  } else if (m === 'closing') {
    if (G.modeT >= 1.8) toLedger();
  }
}

// —— 画 ——
const ctx = P.ctx;

function button(id, x, y, w, h, label, fill, shade, fn, opt) {
  opt = opt || {};
  const down = G.pressed === id;
  const dy = down ? 3 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x + 2, y + 5, w, h);
  A.block(ctx, x, y + dy, w, h, fill, shade, { shadeH: 5, hi: 'rgba(255,255,255,0.25)' });
  if (opt.icon) A.icon(ctx, opt.icon, x + 20, y + dy + h / 2 - 1, 2);
  A.text(ctx, label, x + w / 2 + (opt.icon ? 10 : 0), y + dy + h / 2 - 1, opt.size || 16, opt.color || C.ink, 'center', '900');
  if (opt.sub) A.text(ctx, opt.sub, x + w / 2 + (opt.icon ? 10 : 0), y + dy + h - 9, 10, opt.color || C.ink, 'center', '700');
  G.buttons.push({ id, x, y, w, h, fn });
}

function wrap(s, n) {
  const out = [];
  let cur = '';
  for (const ch of s) {
    cur += ch;
    if (cur.length >= n && !/[，。？！…、]/.test(ch)) {
      out.push(cur);
      cur = '';
    }
  }
  if (cur) {
    if (out.length && cur.length <= 2) out[out.length - 1] += cur;
    else out.push(cur);
  }
  // 标点不放行首
  for (let i = 1; i < out.length; i++) {
    while (out[i] && /^[，。？！…、]/.test(out[i])) {
      out[i - 1] += out[i][0];
      out[i] = out[i].slice(1);
    }
  }
  return out.filter((l) => l);
}

function drawHUD() {
  const y = LY.hudY;
  A.text(ctx, data.world.place, 12, 18, 10, C.grey, 'left', '700');
  if (!G.day) return;
  A.block(ctx, 10, y - 2, 84, 30, '#2a2236', '#201a2b', { shadeH: 3 });
  A.text(ctx, '第 ' + (G.day.idx + 1) + ' 天', 18, y + 7, 12, C.yellow, 'left', '900');
  A.text(ctx, '今天 ' + fmtDate(G.day.date), 18, y + 20, 10, C.white, 'left', '700');
  // 钟
  const total = config.daySec[G.day.idx];
  const k = clamp(G.day.timeLeft / (G.day.overtimeUsed ? config.overtimeSec : total), 0, 1);
  const low = G.day.timeLeft <= config.lowTimeSec;
  const bx = 104;
  const bw = 150;
  A.block(ctx, bx, y + 4, bw, 18, '#1a1424', null);
  const pulse = low ? 0.6 + 0.4 * Math.sin(G.t * 12) : 1;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = low ? C.red : G.day.overtimeUsed ? C.teal : C.yellow;
  ctx.fillRect(bx, y + 4, bw * k, 18);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(bx, y + 17, bw * k, 5);
  ctx.globalAlpha = 1;
  const mins = Math.round((1 - k) * 9 * 60) + 8 * 60;
  const clock = G.day.overtimeUsed ? '加班 ' + Math.max(0, Math.ceil(G.day.timeLeft)) + ' 秒' : (Math.floor(mins / 60) < 10 ? '0' : '') + Math.floor(mins / 60) + ':' + ('0' + (mins % 60)).slice(-2);
  A.text(ctx, clock, bx + bw / 2, y + 13, 12, C.ink, 'center', '900');
  // 钱
  A.block(ctx, 264, y - 2, 101, 30, '#2a2236', '#201a2b', { shadeH: 3 });
  A.icon(ctx, 'coin', 278, y + 13, 2);
  A.text(ctx, '¥ ' + Math.round(G.moneyShown), 292, y + 8, 15, C.yellow, 'left', '900');
  const dr = G.day.ledger.drawer;
  A.text(ctx, dr ? '抽屉 ¥' + dr : '存款+今天', 292, y + 21, 9, dr ? C.pink : C.grey, 'left', '700');
}

function personX() {
  const an = config.anim;
  if (G.ph === 'enter') return lerp(40, 187, easeOut(clamp(G.phT / an.walkIn, 0, 1)));
  if (G.ph === 'leave') {
    const k = clamp((G.phT - (G.cur.story ? an.leaveLineSec * 0.6 : 0.1)) / an.leave, 0, 1);
    return lerp(187, G.decision === 'pass' ? 430 : -80, k * k);
  }
  return 187;
}

function drawPerson(p, cx, alpha) {
  const seed = hash(p.name);
  const period = 2.4 + (seed % 100) / 40;
  const blink = (G.t + (seed % 7)) % period < 0.13;
  const talking = (G.ph === 'docs' || (G.ph === 'check' && G.phT < 0.9) || (G.ph === 'leave' && p.story && G.phT < 0.8)) && Math.floor(G.t / 0.12) % 2 === 0;
  const walking = G.ph === 'enter' || G.ph === 'leave';
  const breath = Math.round(Math.sin(G.t * 2.2 + seed) * 1.5);
  const bob = walking ? -Math.abs(Math.sin(G.t * 14)) * 5 : 0;
  const poke = G.poke && G.t - G.poke < 0.3 ? Math.sin((G.t - G.poke) * 40) * 3 : 0;
  ctx.globalAlpha = alpha;
  A.portrait(ctx, p.face, cx - (face.W * PERSON_CELL) / 2 + poke, personTop + bob, PERSON_CELL, { blink, talk: talking, headDy: breath });
  ctx.globalAlpha = 1;
}

function drawQueue() {
  const b = LY.booth;
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
  const q = G.day.queue;
  const start = G.day.qi + (G.ph === 'enter' ? 1 : 1);
  const shift = G.ph === 'enter' ? 1 - easeOut(clamp(G.phT / config.anim.walkIn, 0, 1)) : 0;
  for (let i = 3; i >= 0; i--) {
    const p = q[start + i];
    if (!p) continue;
    const seed = hash(p.name);
    const x = b.x + 34 - i * 26 + shift * 26 + Math.sin(G.t * 0.7 + seed) * 2;
    const y = b.y + b.h * 0.7 - 50 - (i % 2) * 2 + Math.round(Math.sin(G.t * 2 + seed) * 1);
    A.portrait(ctx, p.face, x, y, 2.5, { blink: (G.t + seed % 5) % 3 < 0.12, tint: 'rgba(16,8,30,' + (0.45 + i * 0.1) + ')' });
  }
  ctx.restore();
}

function drawBooth() {
  const b = LY.booth;
  A.booth(ctx, b.x, b.y, b.w, b.h, G.t, G.gate);
  if (G.mode === 'work' || G.mode === 'slip' || G.mode === 'ad' || G.mode === 'folder' || G.mode === 'closing') {
    drawQueue();
    if (G.cur && G.mode !== 'closing') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x, b.y, b.w, b.h);
      ctx.clip();
      drawPerson(G.cur, personX(), 1);
      ctx.restore();
    }
  }
  // 柜台
  const cy = LY.counterY;
  A.block(ctx, b.x, cy, b.w, b.y + b.h - cy, C.woodL, C.wood, { shadeH: 8, hi: '#7a5a42' });
  // 东西放柜台上
  if (G.cur && G.mode !== 'closing' && (G.ph === 'docs' || G.ph === 'check' || G.ph === 'stamp' || G.mode === 'slip' || G.mode === 'ad' || G.mode === 'folder')) {
    A.icon(ctx, G.cur.item, b.x + 58, cy - 14 + Math.round(Math.sin(G.t * 3) * 0.6), 3);
  }
  // 窗框
  ctx.fillStyle = C.ink;
  ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, 5);
  ctx.fillRect(b.x - 4, b.y - 4, 5, b.h + 8);
  ctx.fillRect(b.x + b.w - 1, b.y - 4, 5, b.h + 8);
  ctx.fillStyle = '#3a3248';
  ctx.fillRect(b.x, b.y, b.w, 3);
  // 玻璃反光
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.moveTo(b.x + 180, b.y);
  ctx.lineTo(b.x + 220, b.y);
  ctx.lineTo(b.x + 150, cy);
  ctx.lineTo(b.x + 110, cy);
  ctx.fill();
  // 对话
  if (G.cur && G.mode !== 'closing') {
    let line = null;
    if (G.ph === 'docs' || G.ph === 'check' || G.ph === 'stamp' || G.mode === 'slip' || G.mode === 'ad' || G.mode === 'folder') line = G.cur.line;
    else if (G.ph === 'leave' && G.cur.story && G.phT < config.anim.leaveLineSec + 0.2) line = G.decision === 'pass' ? G.cur.story.onPass : G.cur.story.onReject;
    if (G.poke && G.t - G.poke < 0.8 && G.ph === 'check') line = '嗯？';
    if (line) drawBubble(line);
  }
}

function drawBubble(s) {
  const lines = wrap(s, 8);
  const w = 118;
  const h = 14 + lines.length * 17;
  const x = 240;
  const y = LY.booth.y + 18;
  const pop = G.ph === 'docs' ? easeOut(clamp(G.phT / 0.15, 0, 1)) : 1;
  ctx.save();
  ctx.translate(x, y + h);
  ctx.scale(pop, pop);
  A.block(ctx, 0, -h, w, h, C.white, '#d8d2c6', { shadeH: 3 });
  ctx.fillStyle = C.ink;
  ctx.fillRect(-10, -12, 12, 4);
  ctx.fillStyle = C.white;
  ctx.fillRect(-6, -11, 8, 2);
  lines.forEach((l, i) => A.text(ctx, l, 8, -h + 14 + i * 17, 13, C.ink, 'left', '800'));
  ctx.restore();
}

function drawDesk() {
  ctx.fillStyle = C.wood;
  ctx.fillRect(0, LY.chipsY - 6, L.W, L.H);
  ctx.fillStyle = C.woodS;
  for (let i = 0; i < 6; i++) ctx.fillRect(0, LY.chipsY + 30 + i * 70, L.W, 3);
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, LY.chipsY - 8, L.W, 3);
  // 台面上的小东西：印台、杯子（空间够才画）
  const pb = LY.docs.permit.y + A.SIZE.permit[1];
  if (LY.ctrlTop - pb > 70) {
    const y = pb + 26;
    A.block(ctx, 214, y, 60, 30, '#2a2a36', '#1e1e28', { shadeH: 5 });
    ctx.fillStyle = '#5a1f2a';
    ctx.fillRect(220, y + 5, 48, 16);
    A.icon(ctx, 'coffee', 316, y + 14, 3);
    if (Math.sin(G.t * 2) > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(312, y - 14 - (G.t * 10) % 8, 2, 6);
    }
  }
}

function drawChips() {
  if (!G.run) return;
  const rs = D.rules(G.run);
  const nr = data.days[G.run.dayIdx].newRule;
  let x = 10;
  const y = LY.chipsY;
  const icons = { expiry: 'cal', name: 'name', photo: 'face', permit: 'permit' };
  rs.forEach((k) => {
    const label = data.rules[k].short;
    ctx.font = '900 11px sans-serif';
    const w = 30 + ctx.measureText(label).width;
    const isNew = k === nr;
    A.block(ctx, x, y, w, 24, isNew ? '#3a3050' : '#2a2236', '#201a2b', { shadeH: 3 });
    if (k === 'seal') A.seal(ctx, data.seal, x + 13, y + 12, 8, 1);
    else A.icon(ctx, icons[k], x + 13, y + 12, 1.5);
    A.text(ctx, label, x + 24, y + 12, 11, isNew ? C.yellow : C.white, 'left', '900');
    if (isNew) {
      const s = 1 + 0.15 * Math.sin(G.t * 6);
      ctx.save();
      ctx.translate(x + w - 2, y - 2);
      ctx.scale(s, s);
      A.block(ctx, -9, -7, 18, 14, C.red, C.redS, { shadeH: 2, outline: 1 });
      A.text(ctx, '新', 0, 0, 9, C.white, 'center', '900');
      ctx.restore();
    }
    x += w + 6;
  });
  if (x + 30 < L.W) {
    A.block(ctx, L.W - 34, y, 24, 24, '#2a2236', '#201a2b', { shadeH: 3 });
    A.text(ctx, '?', L.W - 22, y + 12, 14, C.teal, 'center', '900');
  }
}

function docsVisible() {
  if (!G.cur || !G.day) return null;
  const an = config.anim;
  if (G.mode === 'closing' || G.mode === 'ledger') return null;
  if (G.ph === 'enter') return null;
  if (G.ph === 'docs') {
    const k = easeOut(clamp(G.phT / an.docsIn, 0, 1));
    return { dx: 0, dy: -100 * (1 - k), a: k, rot: 0 };
  }
  if (G.ph === 'leave') {
    const k = clamp(G.phT / 0.3, 0, 1);
    return { dx: 0, dy: -120 * k, a: 1 - k, rot: 0 };
  }
  return { dx: G.dragShown, dy: 0, a: 1, rot: G.dragShown * 0.0008 };
}

function ring(r, color, wob, lw) {
  ctx.save();
  ctx.translate(r[0] + r[2] / 2, r[1] + r[3] / 2);
  ctx.rotate(wob);
  ctx.scale(r[2] / 2 + 4, r[3] / 2 + 4);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0.2, Math.PI * 2 - 0.1);
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 3;
  ctx.stroke();
}

function drawDocs() {
  const v = docsVisible();
  if (!v) return;
  const p = G.cur;
  ctx.save();
  ctx.globalAlpha = v.a;
  ctx.translate(v.dx, v.dy);
  ctx.translate(L.W / 2, LY.deskY + 100);
  ctx.rotate(v.rot);
  ctx.translate(-L.W / 2, -(LY.deskY + 100));
  const pos = LY.docs;
  A.idCard(ctx, pos.id.x, pos.id.y, p.docs.id);
  A.passCard(ctx, pos.pass.x, pos.pass.y, p.docs.pass);
  if (hasPermitRule()) {
    if (p.docs.permit) A.permitCard(ctx, pos.permit.x, pos.permit.y, p.docs.permit);
    else A.permitSlot(ctx, pos.permit.x, pos.permit.y);
  }
  // 圈
  G.marks.forEach((m) => {
    const r = fieldRect(m.id);
    const k = easeOut(clamp((G.t - m.t) / 0.12, 0, 1));
    const rr = [r[0] + (r[2] * (1 - k)) / 2, r[1] + (r[3] * (1 - k)) / 2, r[2] * k, r[3] * k];
    ring(rr, '#e0433a', -0.05 + (hash(m.id) % 10) / 100, 3);
  });
  // 档案高亮
  if (G.hl) {
    const a = 0.55 + 0.45 * Math.sin(G.t * 8);
    G.hl.fields.forEach((fid) => {
      const r = fieldRect(fid);
      ctx.strokeStyle = 'rgba(255,210,63,' + a.toFixed(2) + ')';
      ctx.lineWidth = 4;
      ctx.strokeRect(r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6);
    });
  }
  // 罚单时：红框标出漏看的地方，圈错的打叉
  if (G.mode === 'slip' && G.result) {
    const a = 0.55 + 0.45 * Math.sin(G.t * 10);
    if (p.flaw) p.flaw.fields.slice(0, p.flaw.kind === 'name' ? 2 : 1).forEach((fid) => {
      const r = fieldRect(fid);
      ctx.fillStyle = 'rgba(224,67,58,' + (a * 0.25).toFixed(2) + ')';
      ctx.fillRect(r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6);
      ctx.strokeStyle = 'rgba(255,90,80,' + a.toFixed(2) + ')';
      ctx.lineWidth = 4;
      ctx.strokeRect(r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6);
    });
  }
  // 夹着的钱
  if (G.bribe === 'pending' || (G.bribe === 'refused' && G.ph !== 'leave' && false)) {
    const r = billRect();
    A.bill(ctx, r[0] + 29, r[1] + 15, p.bribe, Math.sin(G.t * 3) * 0.04);
  }
  // 盖好的章
  if (G.slammed) {
    const ps = LY.docs.pass;
    A.bigStamp(ctx, ps.x + 87, ps.y + 66, 104, 44, G.decision === 'pass', 0.72, G.decision === 'pass' ? -0.12 : 0.1);
  }
  ctx.restore();
  // 拖的时候：两边的大章影子
  if (G.ph === 'check' && Math.abs(G.dragShown) > 8) {
    const k = clamp(Math.abs(G.dragShown) / config.swipeDist, 0, 1);
    const ok = G.dragShown > 0;
    A.bigStamp(ctx, L.W / 2, LY.deskY + 80, 150, 64, ok, k * (k >= 1 ? 0.9 : 0.5), ok ? -0.1 : 0.1);
  }
}

function drawStampAnim() {
  if (G.ph !== 'stamp' || G.mode !== 'work') return;
  const an = config.anim;
  const ps = LY.docs.pass;
  const x = ps.x + 87;
  const y = ps.y + 70;
  const ok = G.decision === 'pass';
  if (G.phT < an.stampHit) {
    const k = G.phT / an.stampHit;
    const s = lerp(2.4, 1, k * k);
    ctx.save();
    ctx.translate(x, y - (1 - k) * 60);
    ctx.scale(s, s);
    // 章的木柄
    A.block(ctx, -14, -46, 28, 30, '#7a4a2a', '#57331c', { shadeH: 5 });
    A.block(ctx, -30, -18, 60, 18, ok ? '#2fae5c' : '#d8362d', ok ? '#1f7a40' : '#962520', { shadeH: 5 });
    ctx.restore();
  } else {
    const k = clamp((G.phT - an.stampHit) / (an.stampSec - an.stampHit), 0, 1);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.translate(x, y - 20 - k * 70);
    A.block(ctx, -14, -46, 28, 30, '#7a4a2a', '#57331c', { shadeH: 5 });
    A.block(ctx, -30, -18, 60, 18, ok ? '#2fae5c' : '#d8362d', ok ? '#1f7a40' : '#962520', { shadeH: 5 });
    ctx.restore();
  }
}

function drawControls() {
  const y = LY.ctrlY;
  const canAct = G.mode === 'work' && G.ph === 'check' && !G.modal;
  ctx.globalAlpha = canAct ? 1 : 0.45;
  button('reject', 10, y - 26, 104, 52, '← 驳回', C.red, C.redS, () => decide('reject'), { color: C.white, size: 17 });
  button('pass', L.W - 114, y - 26, 104, 52, '放行 →', C.green, C.greenS, () => decide('pass'), { color: C.white, size: 17 });
  const left = G.day ? G.day.adsLeft : 0;
  button('file', 124, y - 26, 127, 52, '调出档案', left ? '#d8b26a' : '#6a6070', left ? '#a8843e' : '#4a4256', callFile, { icon: 'letter', size: 14, sub: '▶ 看广告 · 剩 ' + left });
  ctx.globalAlpha = 1;
  if (canAct && G.day.qi < 3 && G.day.idx === 0) {
    A.text(ctx, '也可以按住证件左右滑', L.W / 2, y - 36, 10, 'rgba(255,255,255,0.4)', 'center', '700');
  }
}

function drawTutorial() {
  if (!G.day || G.day.idx !== 0 || G.mode !== 'work' || G.ph !== 'check' || G.modal) return;
  let lines = null;
  let dir = 0;
  if (G.day.qi === 0) {
    lines = ['对一对：照片像本人？名字一样？没过期？', '全对 → 往右滑「放行」'];
    dir = 1;
  } else if (G.day.qi === 1) {
    if (!G.marks.length) lines = ['照片和窗口里的人不一样？', '点一下照片，画个圈'];
    else lines = ['圈好了 → 往左滑「驳回」（圈对多拿 ' + config.pay.evidence + ' 元）'];
    dir = G.marks.length ? -1 : 0;
  }
  if (!lines) return;
  const y = hintY();
  A.block(ctx, 8, y, L.W - 16, 16 + lines.length * 16, C.yellow, C.yellowS, { shadeH: 3 });
  lines.forEach((l, i) => A.text(ctx, l, L.W / 2, y + 12 + i * 16, 12, C.ink, 'center', '900'));
  // 手指
  const k = (G.t % 1.4) / 1.4;
  let hx;
  let hy;
  if (dir) {
    hx = L.W / 2 + dir * (k * 110 - 40);
    hy = y + 22 + lines.length * 16;
  } else {
    const r = fieldRect('id.photo');
    hx = r[0] + r[2] / 2 + 6;
    hy = r[1] + r[3] / 2 + 6 - Math.abs(Math.sin(G.t * 5)) * 6;
  }
  ctx.globalAlpha = dir ? 1 - k * 0.5 : 1;
  ctx.fillStyle = C.ink;
  ctx.fillRect(hx - 2, hy - 2, 16, 22);
  ctx.fillStyle = C.white;
  ctx.fillRect(hx, hy, 6, 10);
  ctx.fillRect(hx, hy + 8, 12, 10);
  ctx.globalAlpha = 1;
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
  G.floats.forEach((f) => {
    ctx.globalAlpha = 1 - clamp((f.t - 0.6) / 0.5, 0, 1);
    const pop = f.t < 0.1 ? 1 + (0.1 - f.t) * 4 : 1;
    A.bigText(ctx, f.text, f.x, f.y - easeOut(Math.min(1, f.t)) * 30, Math.round(f.size * pop), f.color);
  });
  ctx.globalAlpha = 1;
  G.ripples.forEach((r) => {
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 - r.t * 1.4).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 6 + r.t * 60, 0, Math.PI * 2);
    ctx.stroke();
  });
  if (G.toast) {
    const a = clamp(1.6 - G.toast.t, 0, 1);
    ctx.globalAlpha = a;
    const y = LY.deskY - 4;
    ctx.font = '900 14px sans-serif';
    const w = ctx.measureText(G.toast.text).width + 28;
    A.block(ctx, L.W / 2 - w / 2, y - 14, w, 28, '#241c30', '#1a1424', { shadeH: 3 });
    A.text(ctx, G.toast.text, L.W / 2, y, 14, G.toast.color, 'center', '900');
    ctx.globalAlpha = 1;
  }
}

function dim(a) {
  ctx.fillStyle = 'rgba(8,5,14,' + a + ')';
  ctx.fillRect(-20, -20, L.W + 40, L.H + 40);
}

function drawBribeModal() {
  dim(0.6);
  const w = 280;
  const h = 200;
  const x = (L.W - w) / 2;
  const y = LY.deskY - 40;
  A.block(ctx, x, y, w, h, '#2a2236', '#201a2b', { drop: 5, shadeH: 6 });
  A.bill(ctx, L.W / 2, y + 44, G.cur.bribe, Math.sin(G.t * 3) * 0.05);
  A.text(ctx, '证件里夹着 ¥' + G.cur.bribe, L.W / 2, y + 84, 16, C.yellow, 'center', '900');
  A.text(ctx, '收了，钱进抽屉。', L.W / 2, y + 106, 12, C.grey, 'center', '700');
  button('take', x + 16, y + 128, 116, 52, '收下', C.yellow, C.yellowS, () => takeBribe(true));
  button('refuse', x + w - 132, y + 128, 116, 52, '推回去', '#8b8496', '#615a6c', () => takeBribe(false), { color: C.white });
}

function drawRulesModal() {
  dim(0.75);
  const rs = D.rules(G.run);
  const x = 16;
  const w = L.W - 32;
  const h = 70 + rs.length * 38 + 60;
  const y = 110;
  A.block(ctx, x, y, w, h, C.paper, C.paperS, { drop: 5, shadeH: 6 });
  A.text(ctx, '查验规则 · 今天 ' + fmtDate(G.day.date), x + 14, y + 22, 15, C.ink, 'left', '900');
  const icons = { expiry: 'cal', name: 'name', photo: 'face', permit: 'permit' };
  rs.forEach((k, i) => {
    const yy = y + 56 + i * 38;
    if (k === 'seal') A.seal(ctx, data.seal, x + 26, yy, 13, 1);
    else A.icon(ctx, icons[k], x + 26, yy, 2.5);
    A.text(ctx, data.rules[k].short, x + 48, yy - 8, 13, k === data.days[G.run.dayIdx].newRule ? C.redS : C.ink, 'left', '900');
    A.text(ctx, data.rules[k].long, x + 48, yy + 9, 11, '#5a4a3a', 'left', '700');
  });
  const yy = y + 56 + rs.length * 38 + 6;
  A.text(ctx, '有一处不对 → 驳回。圈对了，多拿 ' + config.pay.evidence + ' 元。', x + 14, yy, 11, '#5a4a3a', 'left', '800');
  A.text(ctx, '判对 +' + config.pay.correct + '，判错 −' + config.pay.fine, x + 14, yy + 20, 12, C.redS, 'left', '900');
  A.text(ctx, '点哪儿都能关', L.W / 2, y + h - 12, 10, '#8a7a6a', 'center', '700');
}

function drawSlip() {
  const k = easeOut(clamp(G.modeT / 0.2, 0, 1));
  const w = L.W - 40;
  const res = G.result;
  const extra = res.wrongMarks.length ? 1 : 0;
  const h = 96 + extra * 18;
  const x = 20;
  const y = LY.booth.y + 20 - (1 - k) * 200;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.02);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  A.block(ctx, x, y, w, h, '#f7e6e0', '#e0c4ba', { drop: 6, shadeH: 5 });
  ctx.fillStyle = C.red;
  ctx.fillRect(x, y, w, 24);
  A.text(ctx, '罚 单', x + 12, y + 12, 13, C.white, 'left', '900');
  A.text(ctx, '−' + config.pay.fine + ' 元', x + w - 12, y + 12, 14, C.yellow, 'right', '900');
  A.text(ctx, res.invalid ? '你放进去了。漏看：' : '你赶走了一个没问题的人。', x + 12, y + 40, 12, '#6a3a30', 'left', '800');
  A.text(ctx, res.reason, x + 12, y + 62, 16, C.ink, 'left', '900');
  if (extra) A.text(ctx, res.wrongMarks.join('，'), x + 12, y + 82, 11, '#a0402e', 'left', '800');
  A.text(ctx, '红框 = 你漏看的地方 · 点一下继续', x + w / 2, y + h - 12, 10, '#9a6a5a', 'center', '700');
  ctx.restore();
}

function drawAd() {
  dim(0.92);
  const st = platform.adState();
  const k = st ? st.progress : 1;
  A.block(ctx, 40, L.H / 2 - 80, L.W - 80, 160, '#1a1424', '#120c18', { shadeH: 6 });
  A.text(ctx, '广告占位（激励视频）', L.W / 2, L.H / 2 - 40, 16, C.white, 'center', '900');
  A.text(ctx, G.adFor === 'file' ? '看完：调出这个人的档案' : '看完：加班一小时', L.W / 2, L.H / 2 - 10, 12, C.grey, 'center', '700');
  A.block(ctx, 70, L.H / 2 + 20, L.W - 140, 14, '#2a2236', null);
  ctx.fillStyle = C.teal;
  ctx.fillRect(70, L.H / 2 + 20, (L.W - 140) * k, 14);
  A.text(ctx, st ? Math.ceil(st.leftSec * 10) / 10 + ' 秒' : '', L.W / 2, L.H / 2 + 54, 11, C.grey, 'center', '700');
}

function drawFolder() {
  dim(0.55);
  const k = clamp(G.modeT / config.anim.folderSec, 0, 1);
  const cx = L.W / 2;
  const cy = L.H / 2 - 30;
  const w = 220;
  const h = 150;
  // 档案袋底
  A.block(ctx, cx - w / 2, cy - h / 2, w, h, '#d8b26a', '#a8843e', { drop: 6, shadeH: 8 });
  ctx.fillStyle = '#a8843e';
  ctx.fillRect(cx - w / 2 + 14, cy - h / 2 - 10, 70, 12);
  // 里面的纸
  A.block(ctx, cx - w / 2 + 16, cy - h / 2 + 12 - easeOut(k) * 24, w - 32, h - 30, C.paper, C.paperS, { shadeH: 4 });
  A.text(ctx, '档案 · ' + G.cur.name, cx, cy - h / 2 + 30 - easeOut(k) * 24, 14, C.ink, 'center', '900');
  A.text(ctx, k > 0.6 ? (G.cur.flaw ? '有一处对不上……' : '没查到问题') : '翻找中……', cx, cy - easeOut(k) * 24, 13, k > 0.6 ? C.redS : '#6a5a4a', 'center', '900');
  // 封面翻开：竖着压扁
  const flip = Math.cos(Math.min(1, k * 1.6) * Math.PI);
  ctx.save();
  ctx.translate(cx, cy - h / 2);
  ctx.scale(1, flip);
  A.block(ctx, -w / 2, 0, w, h, flip > 0 ? '#e6c47e' : '#b8944e', '#c9a45e', { shadeH: 8 });
  if (flip > 0) {
    A.text(ctx, '档 案', 0, h / 2, 22, '#6a4a1e', 'center', '900');
    ctx.fillStyle = C.red;
    ctx.fillRect(-6, h - 30, 12, 12);
  }
  ctx.restore();
}

function drawHlLabel() {
  if (!G.hl || G.mode !== 'work' || G.ph !== 'check') return;
  const s = G.hl.clean ? '档案：这个人没问题' : '档案：' + data.fieldNames[G.hl.fields[0]] + ' 对不上';
  const y = hintY() + 14;
  ctx.font = '900 12px sans-serif';
  const w = ctx.measureText(s).width + 20;
  A.block(ctx, L.W / 2 - w / 2, y - 10, w, 20, G.hl.clean ? C.green : C.yellow, null, { outline: 2 });
  A.text(ctx, s, L.W / 2, y, 12, C.ink, 'center', '900');
}

function drawWork() {
  drawBooth();
  drawDesk();
  drawChips();
  drawDocs();
  drawStampAnim();
  drawHlLabel();
  drawControls();
  drawTutorial();
  if (G.mode === 'closing') {
    dim(0.5);
    const k = easeOut(clamp(G.modeT / 0.3, 0, 1));
    A.bigText(ctx, G.closingEmpty ? '人查完了' : '下 班', L.W / 2, L.H / 2 - 20, Math.round(44 * k + 1), C.yellow);
    A.text(ctx, G.closingEmpty ? '今天的队排完了' : '没查完的人，明天再来', L.W / 2, L.H / 2 + 24, 13, C.white, 'center', '800');
  }
}

// —— 开场 ——
function drawTitle() {
  const b = LY.booth;
  A.booth(ctx, b.x, b.y + 40, b.w, b.h + 40, G.t, (Math.sin(G.t * 0.8) + 1) / 2 > 0.9 ? 1 : 0);
  // 矮屏（手机浏览器去掉地址栏后）整块往上挪，免得介绍字被「上岗」按钮压住
  const introN = data.world.intro.length;
  const lift = Math.max(0, (b.y + b.h + 224 + (introN - 1) * 22 + 10) - (L.H - 120 - 8));
  const y0 = b.y + b.h - lift;
  A.bigText(ctx, '放 行', L.W / 2, y0 + 140, 64, C.yellow);
  A.text(ctx, data.world.place, L.W / 2, y0 + 190, 14, C.teal, 'center', '900');
  data.world.intro.forEach((l, i) => A.text(ctx, l, L.W / 2, y0 + 224 + i * 22, 13, C.white, 'center', '700'));
  // 章一直在盖
  const k = (G.t % 2.2) / 2.2;
  A.bigStamp(ctx, L.W / 2 + 96, y0 + 120, 80, 34, true, k < 0.1 ? k * 10 : 1 - (k - 0.1) * 0.6, -0.2);
  button('start', L.W / 2 - 90, L.H - 120, 180, 60, '上 岗', C.green, C.greenS, startRun, { color: C.white, size: 22 });
  const best = G.save.best;
  if (best) A.text(ctx, '上次最好：存款 ¥' + best.money + ' · 判对 ' + best.acc + '%', L.W / 2, L.H - 40, 11, C.grey, 'center', '700');
  A.text(ctx, config.version, L.W / 2, L.H - 22, 9, C.dim, 'center', '700');
}

// —— 上班前 ——
function drawBrief() {
  const di = G.day.idx;
  const dd = data.days[di];
  A.bigText(ctx, '第 ' + (di + 1) + ' 天', L.W / 2, 110, 40, C.yellow);
  A.text(ctx, '新历 · ' + fmtDate(dd.date), L.W / 2, 146, 14, C.teal, 'center', '900');
  dd.brief.forEach((l, i) => A.text(ctx, l, L.W / 2, 186 + i * 24, 15, C.white, 'center', '800'));
  let y = 250;
  if (dd.newRule) {
    const k = easeOut(clamp((G.modeT - 0.2) / 0.3, 0, 1));
    ctx.save();
    ctx.translate(L.W / 2, y + 60);
    ctx.scale(k, k);
    A.block(ctx, -150, -60, 300, 120, C.paper, C.paperS, { drop: 5, shadeH: 6 });
    ctx.fillStyle = C.red;
    ctx.fillRect(-150, -60, 300, 22);
    A.text(ctx, '新规则', -138, -49, 12, C.white, 'left', '900');
    if (dd.newRule === 'seal') {
      A.seal(ctx, data.seal, -96, 12, 30, 1);
      A.text(ctx, '本周章', -46, -6, 16, C.ink, 'left', '900');
      A.text(ctx, '蓝色 · 六角', -46, 16, 14, '#2f63d0', 'left', '900');
      A.text(ctx, '别的章 = 假章', -46, 38, 12, C.redS, 'left', '800');
    } else {
      A.permitCard(ctx, -140, -30, { name: '（本人）', date: dd.date });
      A.text(ctx, '日期 = 今天', 46, 0, 15, C.ink, 'left', '900');
      A.text(ctx, '没带也驳回', 46, 22, 12, C.redS, 'left', '800');
    }
    ctx.restore();
    y += 140;
  }
  G.day.startEvents.forEach((e, i) => {
    const yy = y + i * 64;
    A.block(ctx, 24, yy, L.W - 48, 56, '#2a2236', '#201a2b', { shadeH: 4 });
    A.icon(ctx, e.icon, 50, yy + 28, 3);
    A.text(ctx, e.title, 80, yy + 17, 14, C.yellow, 'left', '900');
    A.text(ctx, e.line, 80, yy + 38, 12, C.white, 'left', '800');
    A.text(ctx, (e.money > 0 ? '+' : '−') + Math.abs(e.money), L.W - 36, yy + 17, 15, e.money > 0 ? C.green : C.red, 'right', '900');
  });
  // 家里：今晚要付的账
  const fy = L.H - 250;
  A.text(ctx, '今晚要付', 24, fy - 14, 12, C.grey, 'left', '800');
  A.text(ctx, '存款 ¥' + G.run.money, L.W - 24, fy - 14, 13, C.yellow, 'right', '900');
  data.bills.forEach((b, i) => {
    const bw = (L.W - 48 - 16) / 3;
    const bx = 24 + i * (bw + 8);
    const cost = D.billCost(G.day, b.id);
    A.block(ctx, bx, fy, bw, 86, '#2a2236', '#201a2b', { shadeH: 4 });
    if (b.who) A.portrait(ctx, face.withParts(() => 0.5, data.family[b.who].face), bx + bw / 2 - 18, fy + 4, 2, { blink: (G.t + i) % 3 < 0.12 });
    else A.icon(ctx, b.icon, bx + bw / 2, fy + 24, 3);
    A.text(ctx, b.name, bx + bw / 2, fy + 56, 11, C.white, 'center', '800');
    A.text(ctx, '¥' + cost, bx + bw / 2, fy + 73, 14, C.yellow, 'center', '900');
    const prev = G.day.idx > 0 ? config.bills[b.id][G.day.idx - 1] : cost;
    if (config.bills[b.id][G.day.idx] > prev) {
      A.block(ctx, bx + bw - 30, fy - 6, 34, 16, C.red, null, { outline: 1 });
      A.text(ctx, '涨价', bx + bw - 13, fy + 2, 9, C.white, 'center', '900');
    }
  });
  button('open', L.W / 2 - 90, L.H - 128, 180, 60, '开 窗', C.green, C.greenS, openWindow, { color: C.white, size: 22 });
}

// —— 下班后的事 ——
function drawEvent() {
  drawWork();
  dim(0.75);
  const e = G.event;
  const k = easeOut(clamp(G.modeT / 0.3, 0, 1));
  ctx.save();
  ctx.translate(L.W / 2, L.H / 2 - 40);
  ctx.scale(k, k);
  A.block(ctx, -150, -90, 300, 180, '#2a2236', '#201a2b', { drop: 6, shadeH: 6 });
  const grey = data.story.find((s) => s.id === 'grey');
  if (grey && G.run.faces.grey && e.title.indexOf('顾一') >= 0) A.portrait(ctx, G.run.faces.grey, -130, -80, 3, { blink: G.t % 3 < 0.12 });
  else A.icon(ctx, e.icon, -100, -40, 5);
  A.text(ctx, e.title, -60, -60, 17, C.yellow, 'left', '900');
  wrap(e.line, 11).forEach((l, i) => A.text(ctx, l, -60, -30 + i * 20, 13, C.white, 'left', '800'));
  A.bigText(ctx, (e.money > 0 ? '+' : '−') + Math.abs(e.money) + ' 元', 0, 50, 26, e.money > 0 ? C.green : C.red);
  ctx.restore();
  A.text(ctx, '点一下继续', L.W / 2, L.H / 2 + 70, 11, C.grey, 'center', '700');
}

// —— 记账 ——
function drawLedger() {
  const day = G.day;
  const Lg = day.ledger;
  const x = 16;
  const w = L.W - 32;
  let y = 60;
  A.bigText(ctx, '第 ' + (day.idx + 1) + ' 天 · 记账', L.W / 2, y, 24, C.yellow);
  y += 30;
  const rows = [
    ['工资（判对 ' + Lg.correct + ' / ' + Lg.n + ' 人）', Lg.pay, C.ink],
    ['查实奖励', Lg.evidence, C.ink],
    ['罚款（判错 ' + Lg.wrong + '）', -Lg.fines, C.redS],
  ];
  if (Lg.drawer) rows.push(['抽屉里的钱', Lg.drawer, '#2f7a3a']);
  Lg.events.forEach((e) => rows.push([e.title, e.money, e.money < 0 ? C.redS : '#2f7a3a']));
  const panelH = rows.length * 24 + 92;
  A.block(ctx, x, y, w, panelH, C.paper, C.paperS, { drop: 5, shadeH: 6 });
  const t = G.modeT;
  rows.forEach((r, i) => {
    const k = clamp((t - i * 0.22) / 0.35, 0, 1);
    const yy = y + 22 + i * 24;
    A.text(ctx, r[0], x + 14, yy, 12, '#4a3a2a', 'left', '800');
    A.text(ctx, (r[1] < 0 ? '−' : '+') + Math.abs(Math.round(r[1] * k)), x + w - 14, yy, 14, r[2], 'right', '900');
    if (k > 0 && k < 1 && Math.floor(t * 30) % 3 === 0) sfx.count();
  });
  const inc = D.income(day);
  let yy = y + 22 + rows.length * 24 + 4;
  ctx.fillStyle = '#8a7a6a';
  ctx.fillRect(x + 14, yy - 10, w - 28, 2);
  A.text(ctx, '今天进账', x + 14, yy + 4, 13, C.ink, 'left', '900');
  A.text(ctx, (inc < 0 ? '−' : '+') + Math.abs(inc), x + w - 14, yy + 4, 16, inc < 0 ? C.redS : C.ink, 'right', '900');
  A.text(ctx, '存款 ' + G.run.money + ' + 进账 = 可用', x + 14, yy + 28, 12, '#4a3a2a', 'left', '800');
  A.text(ctx, '¥' + income(), x + w - 14, yy + 28, 18, C.ink, 'right', '900');
  // 账单
  y += panelH + 22;
  A.text(ctx, '今晚付哪些？（点一下勾选）', x, y, 12, C.grey, 'left', '800');
  y += 14;
  let used = 0;
  data.bills.forEach((b, i) => {
    const by = y + i * 56;
    const cost = D.billCost(day, b.id);
    const on = !!G.paid[b.id];
    if (on) used += cost;
    const down = G.pressed === 'bill_' + b.id ? 2 : 0;
    A.block(ctx, x, by + down, w, 48, on ? '#2e4a36' : '#3a2230', on ? '#22382a' : '#2a1824', { shadeH: 4 });
    A.icon(ctx, b.icon, x + 26, by + 24 + down, 3);
    A.text(ctx, b.name, x + 52, by + 17 + down, 15, C.white, 'left', '900');
    const fam = b.who ? data.family[b.who].name : '';
    const miss = G.run.miss[b.id];
    A.text(ctx, cost === 0 ? '有人送了，今晚不用' : miss ? '昨晚没付！' : fam ? '给' + fam : '月底收', x + 52, by + 35 + down, 10, miss ? C.pink : C.grey, 'left', '700');
    A.text(ctx, '¥' + cost, x + w - 60, by + 24 + down, 16, C.yellow, 'right', '900');
    A.block(ctx, x + w - 44, by + 10 + down, 28, 28, on ? C.green : '#1a1424', null, { outline: 2 });
    if (on) A.text(ctx, '✓', x + w - 30, by + 24 + down, 18, C.ink, 'center', '900');
    G.buttons.push({ id: 'bill_' + b.id, x, y: by, w, h: 48, fn: () => toggleBill(b.id) });
  });
  y += data.bills.length * 56 + 6;
  const left = income() - used;
  A.text(ctx, '付完剩下', x, y + 8, 13, C.white, 'left', '800');
  A.text(ctx, '¥' + left, x + w, y + 8, 18, left < 10 ? C.pink : C.yellow, 'right', '900');
  const short = income() < D.billsTotal(day);
  const by = L.H - 76;
  if (short && !day.overtimeUsed) {
    button('overtime', x, by, 160, 58, '加班一小时', C.teal, '#1f9e93', callOvertime, { size: 15, sub: '▶ 看广告 · 再查几个人' });
    button('home', x + 170, by, w - 170, 58, '回家睡觉', '#8b8496', '#615a6c', goHome, { color: C.white, size: 17 });
    A.text(ctx, '钱不够付全部账单', L.W / 2, by - 14, 12, C.pink, 'center', '900');
  } else {
    button('home', x, by, w, 58, '回家睡觉', C.green, C.greenS, goHome, { color: C.white, size: 18 });
  }
}

// —— 晚上 ——
function drawNight() {
  ctx.fillStyle = '#0a0812';
  ctx.fillRect(0, 0, L.W, L.H);
  // 一扇小窗
  A.block(ctx, L.W / 2 - 60, 90, 120, 90, '#1a2a4a', null, { outline: 4 });
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L.W / 2 + 18, 104, 14, 14);
  ctx.fillStyle = C.ink;
  ctx.fillRect(L.W / 2 - 2, 90, 4, 90);
  ctx.fillRect(L.W / 2 - 60, 133, 120, 4);
  A.text(ctx, '第 ' + (G.day.idx + 1) + ' 天 · 夜', L.W / 2, 212, 16, C.yellow, 'center', '900');
  // 家里人
  const fam = ['nan', 'man'];
  fam.forEach((id, i) => {
    const f = face.withParts(() => 0.5, data.family[id].face);
    const bill = data.bills.find((b) => b.who === id);
    const sad = G.run.miss[bill.id] > 0;
    const x = L.W / 2 - 110 + i * 130;
    const y = 240;
    A.block(ctx, x, y, 90, 110, sad ? '#2a1824' : '#1e2a2a', null, { outline: 2 });
    A.portrait(ctx, f, x + 18, y + 8, 3, { blink: (G.t + i) % 3 < 0.12, headDy: Math.round(Math.sin(G.t * 2 + i)) });
    A.text(ctx, data.family[id].name, x + 45, y + 98, 12, C.white, 'center', '900');
    if (sad) A.text(ctx, '…', x + 78, y + 14, 16, C.pink, 'center', '900');
  });
  G.nightLines.forEach((l, i) => {
    const k = clamp((G.modeT - 0.3 - i * 0.35) / 0.3, 0, 1);
    ctx.globalAlpha = k;
    A.text(ctx, l.text, L.W / 2, 390 + i * 26, 15, l.good ? C.white : C.pink, 'center', '800');
  });
  ctx.globalAlpha = 1;
  A.text(ctx, '存款 ¥' + G.run.money, L.W / 2, 390 + G.nightLines.length * 26 + 20, 14, C.yellow, 'center', '900');
  if (G.modeT > 0.8) A.text(ctx, G.run.over || G.day.idx >= config.days - 1 ? '点一下 · 看结局' : '点一下 · 第 ' + (G.day.idx + 2) + ' 天', L.W / 2, L.H - 60, 13, C.grey, 'center', '800');
}

// —— 结局 ——
function drawEnding() {
  const run = G.run;
  const s = run.stats;
  const acc = s.total ? Math.round((s.correct / s.total) * 100) : 0;
  A.bigText(ctx, run.over ? '撑不下去了' : '三天过去了', L.W / 2, 80, 32, run.over ? C.pink : C.yellow);
  let y = 124;
  if (run.over) {
    A.text(ctx, run.over.text, L.W / 2, y, 15, C.pink, 'center', '900');
    y += 28;
  }
  A.block(ctx, 16, y, L.W - 32, 92, '#2a2236', '#201a2b', { shadeH: 4 });
  A.text(ctx, '查了 ' + s.total + ' 人 · 判对 ' + acc + '% · 查实 ' + s.evidence, L.W / 2, y + 22, 14, C.white, 'center', '900');
  A.text(ctx, '存款 ¥' + run.money + (s.bribes ? ' · 收过钱 ¥' + s.bribes : ' · 一分钱没收'), L.W / 2, y + 48, 14, C.yellow, 'center', '900');
  const mm = D.mostMissed(run);
  const tip = mm ? '最常漏看：' + (mm === 'clean' ? '错赶好人' : data.explain[mm] ? tipName(mm) : mm) : '一个都没判错！';
  A.text(ctx, tip, L.W / 2, y + 72, 13, mm ? C.pink : C.green, 'center', '900');
  y += 110;
  A.text(ctx, '那些人', 20, y, 12, C.grey, 'left', '800');
  y += 20;
  D.endingLines(run).forEach((l, i) => A.text(ctx, '· ' + l, 24, y + i * 24, 13, C.white, 'left', '800'));
  y += D.endingLines(run).length * 24 + 12;
  A.text(ctx, '下一局可以：', 20, y, 12, C.grey, 'left', '800');
  tips(run).forEach((l, i) => A.text(ctx, '→ ' + l, 24, y + 22 + i * 22, 12, C.teal, 'left', '800'));
  button('again', L.W / 2 - 90, L.H - 100, 180, 58, '再上一次岗', C.green, C.greenS, () => setMode('title'), { color: C.white, size: 18 });
}

function tipName(k) {
  return { expiry: '有效期', name: '名字', photo: '照片', seal: '印章', permitDate: '许可日期', permitMissing: '没带许可' }[k] || k;
}
function tips(run) {
  const out = [];
  const mm = D.mostMissed(run);
  if (mm === 'clean') out.push('拿不准时先圈再判，别乱赶人');
  else if (mm) out.push('先看「' + tipName(mm) + '」');
  if (run.stats.days.some((d) => d.queue - d.n > 2)) out.push('快一点：队里还剩好几个人没查');
  if (run.stats.bribes) out.push('收的钱会有人回来找你');
  if (!out.length) out.push('试试收下钱，看谁会回来');
  return out.slice(0, 3);
}

function render() {
  ctx.setTransform(P.canvas.width / L.W, 0, 0, P.canvas.width / L.W, 0, 0);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, L.W, L.H);
  G.buttons = [];
  ctx.save();
  if (G.shake > 0.3) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  const m = G.mode;
  if (m === 'title') drawTitle();
  else if (m === 'brief') drawBrief();
  else if (m === 'work' || m === 'slip' || m === 'ad' || m === 'folder' || m === 'closing') {
    drawWork();
    if (m === 'slip') drawSlip();
  } else if (m === 'event') drawEvent();
  else if (m === 'ledger') drawLedger();
  else if (m === 'night') drawNight();
  else if (m === 'ending') drawEnding();
  if (m === 'work' || m === 'slip' || m === 'ad' || m === 'folder' || m === 'closing' || m === 'event') drawHUD();
  if (G.modal === 'bribe' && m === 'work') drawBribeModal();
  if (G.modal === 'rules' && m === 'work') drawRulesModal();
  if (m === 'folder') drawFolder();
  if (m === 'ad') drawAd();
  drawFx();
  if (G.flash) {
    ctx.fillStyle = 'rgba(' + G.flash.color + ',' + (0.35 * (1 - G.flash.t / 0.25)).toFixed(2) + ')';
    ctx.fillRect(-20, -20, L.W + 40, L.H + 40);
  }
  ctx.restore();
}

let last = platform.now();
function frame() {
  const t = platform.now();
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  update(dt);
  render();
  platform.nextFrame(frame);
}

platform.exposeForTest('__fx', { G, D, config, data, L, LY, scale, fieldRect, presentFields, billRect, setMode, startRun });
platform.nextFrame(frame);
