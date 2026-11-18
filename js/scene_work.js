// 窗口查证：人走过来 → 递证件 → 拉线审问（对得上绿线 / 对不上红线 + 人物反应）→ 按手印（第 2 章）→ 驳回 / 放行 → 盖章。
// 判错：窗口上的打印机吐罚单，前两张盖「警告」，第三张起盖「罚」并扣钱。
// 说话类来访（老韩、阿梅托孤）：不递证，说完给两个选项。
const U = require('./ui.js');
const platform = require('./platform.js');
const config = require('./config.js');
const data = require('./data.js');
const story = require('./story.js');
const D = require('./day.js');
const A = require('./art.js');
const face = require('./face.js');
const sfx = require('./sfx.js');
const { clamp, lerp, easeOut, fmtDate, hash, pick } = require('./util.js');

const { G, L, LY, C, ctx } = U;
const touches = {};
const J = config.juice;
const AN = config.anim;

// —— 流程 ——
function openWindow() {
  U.setMode('work');
  G.cur = D.current(G.day);
  resetPerson();
  sfx.bell();
}

function resetPerson() {
  G.lines = [];
  G.drag = null;
  G.react = null;
  G.printFx = null;
  G.bribe = G.cur && G.cur.bribe ? 'pending' : null;
  G.decision = null;
  G.slammed = false;
  G.result = null;
  G.hl = null;
  G.modal = null;
  G.talkStep = 0;
  G.talkChoice = null;
  G.tapHint = null;
  U.setPh('enter');
}

function nextPerson() {
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
  U.setMode('closing');
  sfx.bell();
}

function isTalk(p) {
  return !!(p && p.story && p.story.kind === 'talk');
}
function printing() {
  return !!(G.printFx && G.printFx.t < AN.printSec);
}
function canAct() {
  return G.mode === 'work' && G.ph === 'check' && !G.modal && !printing();
}
function hasRed() {
  return G.lines.some((l) => l.kind === 'red');
}

// —— 可以拉线的地方 ——
function personCX() {
  return 187;
}
function fieldRect(fid) {
  if (fid === 'face') {
    const w = face.W * LY.cell + 20;
    return [personCX() - w / 2, LY.booth.y + 6, w, LY.counterY - LY.booth.y - 6];
  }
  if (fid.indexOf('chip.') === 0) return G.chipRects[fid] || null;
  const doc = fid.split('.')[0];
  const p = LY.docs[doc];
  const r = A.FIELDS[doc][fid];
  return [p.x + r[0], p.y + r[1], r[2], r[3]];
}
function center(fid) {
  if (fid === 'face') return [personCX(), LY.personTop + 9 * LY.cell];
  const r = fieldRect(fid);
  return r ? [r[0] + r[2] / 2, r[1] + r[3] / 2] : [0, 0];
}
function anchors() {
  const out = ['pass.seal', 'id.photo', 'id.name', 'pass.name', 'pass.until', 'chip.expiry', 'face'];
  if (G.chipRects['chip.seal']) out.unshift('chip.seal');
  return out;
}
function anchorAt(x, y, exclude) {
  const list = anchors().filter((a) => a !== exclude);
  for (let i = 0; i < list.length; i++) {
    const r = fieldRect(list[i]);
    if (r && U.inRect([r[0] - 4, r[1] - 4, r[2] + 8, r[3] + 8], x, y)) return list[i];
  }
  // 差一点也吸上去
  let best = null;
  let bd = config.snapDist;
  list.forEach((a) => {
    const c = center(a);
    const d = Math.hypot(c[0] - x, c[1] - y);
    if (d < bd) {
      bd = d;
      best = a;
    }
  });
  return best;
}
function billRect() {
  const p = LY.docs.pass;
  return [p.x + 54, p.y + 106, 60, 32];
}
function helpRect() {
  return G.chipRects.help;
}

// —— 拉线 ——
function doLink(a, b) {
  const p = G.cur;
  const res = D.link(G.run, p, a, b);
  if (res.kind === 'none') return;
  const ca = center(a);
  const cb = center(b);
  const mx = (ca[0] + cb[0]) / 2;
  const my = (ca[1] + cb[1]) / 2;
  const key = [a, b].sort().join('|');
  G.lines = G.lines.filter((l) => [l.a, l.b].sort().join('|') !== key || l.kind === 'red');
  if (G.lines.some((l) => l.kind === 'red' && [l.a, l.b].sort().join('|') === key)) {
    sfx.nope();
    return;
  }
  G.lines.push({ a, b, kind: res.kind, t: G.t });
  if (res.kind === 'green') {
    sfx.green();
    U.float(data.lineText.green, mx, my, C.green, 15);
    U.splat(cb[0], cb[1], C.green, 6, 0.4);
    if (!G.react || G.react.type === 'shrug') G.react = { type: 'shrug', t: 0, line: pick(Math.random, data.generic.shrug) };
    G.tut = Object.assign(G.tut || {}, { green: true });
  } else if (res.kind === 'grey' || res.kind === 'off') {
    sfx.grey();
    U.float(data.lineText[res.kind], mx, my, '#b8b0c8', 12);
  } else if (res.kind === 'red') {
    sfx.red();
    platform.vibrate(true);
    G.shake = J.redShake;
    G.freeze = 0.06;
    G.flash = { t: 0, color: '224,67,58' };
    U.splat(ca[0], ca[1], C.red, 9, 0.6);
    U.splat(cb[0], cb[1], C.red, 9, 0.6);
    U.float('对不上！', mx, my, C.red, 19);
    G.tut = Object.assign(G.tut || {}, { red: true });
    if (res.react && res.react !== 'again') {
      G.react = { type: res.react, t: 0, line: res.line, memory: res.memory, from: res.from, to: res.to };
      if (res.react === 'confess') sfx.sigh();
      else if (res.react === 'lie') sfx.liar();
      else if (res.react === 'explain') sfx.hmm();
      else if (res.react === 'bribe') {
        sfx.rustle();
        G.bribe = 'pending';
        const r = billRect();
        if (!p.med) U.float('¥' + res.from + ' → ¥' + res.to, r[0] + 30, r[1] + 46, C.yellow, 16);
        else U.float('药 ×2', r[0] + 30, r[1] + 46, C.yellow, 16);
        U.splat(r[0] + 30, r[1] + 14, '#8fdc98', 10, 0.6);
      }
    }
  }
}

function doPrint() {
  if (!canAct() || !D.canPrint(G.run, G.cur)) return;
  const m = D.takePrint(G.run, G.cur);
  G.printFx = { t: 0, match: m, said: false };
  sfx.ink();
  platform.vibrate(false);
}

// —— 判 ——
function decide(dec) {
  if (!canAct()) return;
  if (G.bribe === 'pending') {
    G.bribe = 'refused';
    U.toast(G.cur.med ? '药推回去了' : '钱推回去了');
    sfx.push();
  }
  G.decision = dec;
  G.drag = null;
  U.setPh('stamp');
}

function stampPos() {
  const p = LY.docs.pass;
  return [p.x + 87, p.y + 70];
}

function slam() {
  G.slammed = true;
  const res = D.resolve(G.run, G.day, G.cur, G.decision, G.bribe === 'took');
  G.result = res;
  const [sx, sy] = stampPos();
  const ok = G.decision === 'pass';
  const big = G.cur.story && G.cur.story.id === 'grey1' && G.decision === 'reject' && G.bribe === 'refused';
  U.splat(sx, sy, ok ? '#2fae5c' : '#d8362d', res.evidence || big ? 26 : 14, res.evidence || big ? 1.4 : 1);
  platform.vibrate(true);
  if (res.correct) {
    const n = 3 + (res.evidence ? 2 : 0);
    U.flyMoney(sx, sy - 10, n, { gap: 0.07 });
    U.float('+' + config.pay.correct, sx, sy - 40, C.green, 24);
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
      U.float((G.cur.flaw && G.cur.flaw.legit ? '核实' : '查实') + ' +' + config.pay.evidence, sx, sy - 68, C.yellow, 19);
    } else {
      G.shake = J.stampShake;
      sfx.stamp(false);
      sfx.good();
    }
  } else {
    G.shake = J.stampShake;
    sfx.stamp(false);
    sfx.bad();
    G.flash = { t: 0, color: '224,67,58' };
  }
  if (res.reward) {
    U.float(res.reward.say, L.W / 2, LY.booth.y + 40, '#b8b0c8', 13);
    U.flyMoney(L.W / 2, LY.booth.y + 60, 3, { kind: 'bill', delay: 0.3 });
  }
}

function afterStamp() {
  if (G.result && !G.result.correct) {
    U.setMode('cite');
    G.cite = { res: G.result, slammed: false, lines: 0 };
  } else {
    U.setPh('leave');
    sfx.paper();
  }
}

function closeCite() {
  U.setMode('work');
  U.setPh('leave');
  sfx.paper();
}

function takeBribe(yes) {
  G.modal = null;
  const r = billRect();
  if (yes) {
    G.bribe = 'took';
    if (G.cur.med) {
      sfx.coin();
      U.float('药收下了', r[0] + 10, r[1] - 10, C.yellow, 14);
    } else {
      sfx.coin();
      U.flyMoney(r[0] + 30, r[1] + 14, Math.min(6, Math.ceil(G.cur.bribe / 10)), { kind: 'bill', gap: 0.08 });
      U.float('+¥' + G.cur.bribe + ' 进抽屉', r[0] + 10, r[1] - 10, '#c8c0d0', 14);
    }
  } else {
    G.bribe = 'refused';
    sfx.push();
    U.toast(G.cur.med ? '药推回去了' : '钱推回去了');
  }
}

function chooseTalk(id) {
  if (G.ph !== 'talk' || G.talkChoice) return;
  const c = D.talkChoice(G.run, G.day, G.cur, id);
  G.talkChoice = c;
  if (c.gift) {
    sfx.coin();
    U.float(c.gift === 'heat' ? '今晚暖气不用买' : '今晚饭不用买', L.W / 2, LY.deskY + 40, C.yellow, 15);
  } else sfx.paper();
  U.setPh('leave');
}

function callFile() {
  if (!canAct()) return;
  if (G.hl) return U.toast('档案已经调过了');
  if (G.day.adsLeft <= 0) {
    sfx.nope();
    return U.toast('今天的档案调完了');
  }
  U.flow.ad('file', () => {
    G.day.adsLeft -= 1;
    U.setMode('folder');
    sfx.folder();
  });
}

// —— 输入（按钮由 main 先判）——
function touch(type, id, x, y) {
  if (type === 'down') {
    if (G.modal === 'rules') {
      G.modal = null;
      sfx.paper();
      touches[id] = { role: 'none' };
      return;
    }
    if (G.modal) {
      touches[id] = { role: 'none' };
      return;
    }
    if (G.mode !== 'work') {
      touches[id] = { role: 'none' };
      return;
    }
    if (U.inRect(helpRect(), x, y)) {
      G.modal = 'rules';
      sfx.paper();
      touches[id] = { role: 'none' };
      return;
    }
    if (G.ph === 'talk') {
      touches[id] = { role: 'talk' };
      return;
    }
    if (G.ph === 'check' && !printing()) {
      if (G.bribe === 'pending' && U.inRect(billRect(), x, y)) {
        touches[id] = { role: 'bill' };
        return;
      }
      const a = anchorAt(x, y);
      if (a && (a !== 'face' || y < LY.counterY)) {
        touches[id] = { role: 'line' };
        G.drag = { from: a, x, y, x0: x, y0: y, moved: false, over: null, lastX: x, lastY: y };
        return;
      }
    }
    if (y >= LY.booth.y && y < LY.counterY) {
      sfx.tap();
      if (G.cur && G.ph === 'check') G.poke = G.t;
    }
    touches[id] = { role: 'none' };
  } else if (type === 'move') {
    const t = touches[id];
    if (!t || t.role !== 'line' || !G.drag) return;
    const d = G.drag;
    d.x = x;
    d.y = y;
    if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > config.tapSlop) d.moved = true;
    if (d.moved) {
      const over = anchorAt(x, y, d.from);
      if (over !== d.over && over) sfx.tap();
      d.over = over;
      if (Math.hypot(x - d.lastX, y - d.lastY) > 26) {
        sfx.pull();
        d.lastX = x;
        d.lastY = y;
      }
    }
  } else {
    const t = touches[id];
    delete touches[id];
    if (!t) return;
    if (t.role === 'line' && G.drag) {
      const d = G.drag;
      G.drag = null;
      if (G.mode !== 'work' || G.ph !== 'check') return;
      if (!d.moved) {
        G.tapHint = { fid: d.from, t: G.t };
        sfx.tap();
        U.toast('按住，拖到另一处对一对', C.teal, LY.gapTop + 14);
      } else if (d.over) doLink(d.from, d.over);
      else {
        G.lines.push({ a: d.from, bx: x, by: y, kind: 'cancel', t: G.t });
        sfx.grey();
      }
    } else if (t.role === 'bill') {
      if (U.inRect(billRect(), x, y) && G.bribe === 'pending' && canAct()) {
        G.modal = 'bribe';
        sfx.paper();
      }
    } else if (t.role === 'talk') {
      const s = G.cur && G.cur.story;
      if (s && G.ph === 'talk' && G.talkStep < s.lines.length - 1 && G.phT > 0.3) {
        G.talkStep += 1;
        U.setPh('talk');
        G.phT = 0.31;
        sfx.paper();
      }
    }
  }
}

// —— 更新 ——
function update(dt) {
  const day = G.day;
  if (G.react) G.react.t += dt;
  if (G.printFx) {
    const pf = G.printFx;
    pf.t += dt;
    if (!pf.said && pf.t >= AN.printSec * 0.75) {
      pf.said = true;
      const r = fieldRect('id.photo');
      if (pf.match) {
        sfx.match();
        U.float('手印对上：本人', L.W / 2, LY.deskY + 158, C.green, 18);
      } else {
        sfx.nomatch();
        G.shake = J.redShake;
        U.float('手印对不上：冒名！', L.W / 2, LY.deskY + 158, C.red, 18);
        U.splat(r[0] + 30, r[1] + 30, C.red, 10, 0.6);
      }
    }
  }
  G.lines = G.lines.filter((l) => l.kind === 'red' || G.t - l.t < (l.kind === 'green' ? 1.6 : 0.6));
  const gateUp = G.mode === 'work' && G.ph === 'leave' && (G.decision === 'pass' || (G.talkChoice && G.ph === 'leave'));
  G.gate = lerp(G.gate, gateUp ? 1 : 0, Math.min(1, dt * 8));
  const cm = story.cameo;
  if (day.idx + 1 === cm.day && day.qi >= cm.at && day.qi <= cm.at + 2) G.cameoT = (G.cameoT || 0) + dt;
  if (G.mode === 'work') {
    day.timeLeft -= dt;
    const sec = Math.ceil(day.timeLeft);
    if (sec !== G.lastTick && day.timeLeft > 0 && day.timeLeft <= config.lowTimeSec) sfx.tick(sec <= 5);
    G.lastTick = sec;
    if (G.ph === 'enter') {
      if (Math.floor(G.phT / 0.14) !== Math.floor((G.phT - dt) / 0.14)) sfx.step(Math.floor(G.phT / 0.14));
      if (G.phT >= AN.walkIn) {
        if (isTalk(G.cur)) U.setPh('talk');
        else U.setPh('docs');
        sfx.paper();
      }
    } else if (G.ph === 'docs' && G.phT >= AN.docsIn) U.setPh('check');
    else if (G.ph === 'stamp') {
      if (!G.slammed && G.phT >= AN.stampHit) slam();
      if (G.phT >= AN.stampSec) afterStamp();
    } else if (G.ph === 'leave') {
      const extra = G.cur && G.cur.story ? AN.leaveLineSec : 0;
      if (G.phT >= AN.leave + extra) nextPerson();
    }
    if (G.mode === 'work' && day.timeLeft <= 0 && (G.ph === 'enter' || G.ph === 'docs' || G.ph === 'check' || G.ph === 'talk') && !printing()) endShift(false);
  } else if (G.mode === 'cite') {
    const c = G.cite;
    const nl = Math.min(3, Math.floor(G.modeT / 0.16));
    if (nl > c.lines) {
      c.lines = nl;
      sfx.printLine();
    }
    if (!c.slammed && G.modeT >= 0.75) {
      c.slammed = true;
      platform.vibrate(true);
      if (c.res.fine) {
        sfx.fine();
        G.shake = J.fineShake;
        G.flash = { t: 0, color: '224,67,58' };
        U.flyMoney(G.walletPos.x, G.walletPos.y, 3, { tx: G.walletPos.x + 30, ty: -30, out: true, gap: 0.08 });
      } else {
        sfx.warn();
        G.shake = 4;
      }
    }
    if (G.modeT >= AN.citeSec) closeCite();
  } else if (G.mode === 'folder') {
    if (G.modeT >= AN.folderSec) {
      const f = G.cur.flaw;
      G.hl = { t: G.t, clean: !f, legit: !!(f && f.legit), fields: f ? hlFields(f.kind) : [] };
      U.setMode('work');
      sfx.mark();
    }
  } else if (G.mode === 'closing') {
    if (G.modeT >= 1.8) U.flow.afterShift();
  }
}

function hlFields(kind) {
  return { expiry: ['pass.until', 'chip.expiry'], name: ['id.name', 'pass.name'], photo: ['id.photo', 'face'], photoOld: ['id.photo', 'face'], seal: ['pass.seal', 'chip.seal'] }[kind] || [];
}

// —— 画 ——
function drawHUD() {
  const y = LY.hudY;
  if (!G.day) return;
  A.block(ctx, 10, y, 86, 32, '#2a2236', '#201a2b', { shadeH: 3 });
  A.text(ctx, '第 ' + (G.day.idx + 1) + ' 天', 18, y + 10, 13, C.yellow, 'left', '900');
  A.text(ctx, '第 ' + G.day.ch + ' 章 · ' + fmtDate(G.day.date), 18, y + 24, 9, C.white, 'left', '700');
  const total = G.day.overtimeUsed ? config.overtimeSec : config.daySec[G.day.idx];
  const k = clamp(G.day.timeLeft / total, 0, 1);
  const low = G.day.timeLeft <= config.lowTimeSec;
  const bx = 106;
  const bw = 140;
  A.block(ctx, bx, y + 7, bw, 18, '#1a1424', null);
  ctx.globalAlpha = low ? 0.6 + 0.4 * Math.sin(G.t * 12) : 1;
  ctx.fillStyle = low ? C.red : G.day.overtimeUsed ? C.teal : C.yellow;
  ctx.fillRect(bx, y + 7, bw * k, 18);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(bx, y + 20, bw * k, 5);
  ctx.globalAlpha = 1;
  const mins = Math.round((1 - k) * 9 * 60) + 8 * 60;
  const clock = G.day.overtimeUsed ? '加班 ' + Math.max(0, Math.ceil(G.day.timeLeft)) + ' 秒' : (Math.floor(mins / 60) < 10 ? '0' : '') + Math.floor(mins / 60) + ':' + ('0' + (mins % 60)).slice(-2);
  ctx.save();
  ctx.font = '900 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.strokeText(clock, bx + bw / 2, y + 16);
  ctx.fillStyle = C.white;
  ctx.fillText(clock, bx + bw / 2, y + 16);
  ctx.restore();
  // 钱包
  G.walletPos = { x: 282, y: y + 18 };
  A.block(ctx, 256, y, 109, 32, '#2a2236', '#201a2b', { shadeH: 3 });
  ctx.save();
  ctx.translate(282, y + 17);
  ctx.scale(0.42, 0.42);
  A.wallet(ctx, 0, 0, G.moneyShown, G.walletBump);
  ctx.restore();
  A.text(ctx, '¥ ' + Math.round(G.moneyShown), 304, y + 11, 15, G.moneyShown < 0 ? C.red : C.yellow, 'left', '900');
  const dr = G.day.ledger.drawer;
  A.text(ctx, dr ? '抽屉 ¥' + dr : '存款+今天', 304, y + 25, 9, dr ? '#c8c0d0' : C.grey, 'left', '700');
}

function personX() {
  if (G.ph === 'enter') return lerp(40, 187, easeOut(clamp(G.phT / AN.walkIn, 0, 1)));
  if (G.ph === 'leave') {
    const k = clamp((G.phT - (G.cur.story ? AN.leaveLineSec * 0.6 : 0.1)) / AN.leave, 0, 1);
    const pass = G.decision === 'pass' || (G.talkChoice && !G.decision);
    return lerp(187, pass ? 430 : -80, k * k);
  }
  return 187;
}

function drawPerson(p, cx) {
  const seed = hash(p.name);
  const period = 2.4 + (seed % 100) / 40;
  let blink = (G.t + (seed % 7)) % period < 0.13;
  const R = G.react;
  const talking = (G.ph === 'docs' || G.ph === 'talk' || (G.ph === 'check' && G.phT < 0.9) || (G.ph === 'leave' && p.story && G.phT < 0.8) || (R && R.t < 0.9)) && Math.floor(G.t / 0.12) % 2 === 0;
  const walking = G.ph === 'enter' || G.ph === 'leave';
  const breath = Math.round(Math.sin(G.t * 2.2 + seed) * 1.5);
  let bob = walking ? -Math.abs(Math.sin(G.t * 14)) * 5 : 0;
  let dx = G.poke && G.t - G.poke < 0.3 ? Math.sin((G.t - G.poke) * 40) * 3 : 0;
  const o = { blink, talk: talking, headDy: breath };
  let sweat = false;
  if (R && !walking) {
    if (R.type === 'confess') {
      o.mood = 'sad';
      o.headDy = breath + Math.round(4 * Math.min(1, R.t * 5));
      o.blink = blink || R.t % 2.2 < 1.4;
      o.talk = false;
    } else if (R.type === 'lie') {
      const hot = R.t < 3 || (R.t % 3) < 1;
      if (hot) o.look = Math.floor(G.t * 4) % 2 ? -1 : 1;
      dx += Math.round(Math.sin(G.t * 47) * 1);
      sweat = true;
    } else if (R.type === 'bribe') {
      if (R.t < 3) o.mood = 'grin';
    } else if (R.type === 'explain') {
      if (R.t < 0.4) bob = -Math.sin(R.t * 8) * 3;
    } else if (R.type === 'shrug') {
      if (R.t < 0.4) bob = -Math.sin(R.t * 8) * 2;
    }
  }
  const px = cx - (face.W * LY.cell) / 2 + dx;
  const py = LY.personTop + bob;
  A.portrait(ctx, p.face, px, py, LY.cell, o);
  if (sweat) {
    for (let i = 0; i < 3; i++) {
      const k = ((G.t * 0.9 + i * 0.37) % 1);
      const sx = px + (i === 1 ? 3 : i === 0 ? 14 : 15.5) * LY.cell;
      const sy = py + (5 + k * 6) * LY.cell;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = C.ink;
      ctx.fillRect(sx - 1, sy - 1, LY.cell * 0.6 + 2, LY.cell + 2);
      ctx.fillStyle = '#9fd3ff';
      ctx.fillRect(sx, sy, LY.cell * 0.6, LY.cell);
      ctx.globalAlpha = 1;
    }
  }
  return { sweat };
}

function drawQueue() {
  const b = LY.booth;
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
  const q = G.day.queue;
  const start = G.day.qi + 1;
  const shift = G.ph === 'enter' ? 1 - easeOut(clamp(G.phT / AN.walkIn, 0, 1)) : 0;
  const qc = Math.max(2, Math.min(3, LY.cell - 3));
  const baseY = b.y + b.h * 0.72 - 22 * qc;
  for (let i = 3; i >= 0; i--) {
    const p = q[start + i];
    if (!p) continue;
    const seed = hash(p.name);
    const x = b.x + 34 - i * 26 + shift * 26 + Math.sin(G.t * 0.7 + seed) * 2;
    const y = baseY - (i % 2) * 2 + Math.round(Math.sin(G.t * 2 + seed) * 1);
    A.portrait(ctx, p.face, x, y, qc, { blink: (G.t + (seed % 5)) % 3 < 0.12, tint: 'rgba(16,8,30,' + (0.45 + i * 0.1) + ')' });
  }
  // 第 12 天：队伍里一个像小满的男孩，看了你一眼，走了
  const cm = story.cameo;
  if (G.day.idx + 1 === cm.day && G.day.qi >= cm.at && G.day.qi <= cm.at + 2) {
    if (G.cameoT == null) G.cameoT = 0;
    const k = G.cameoT;
    const walk = clamp((k - 2.6) / 1.4, 0, 1);
    const x = b.x + 60 - walk * 140;
    const f = Object.assign({}, G.run.faces.man || face.withParts(() => 0.5, data.family.man.face), { hair: 7 });
    A.portrait(ctx, f, x, baseY - 4 - (walk > 0 ? Math.abs(Math.sin(G.t * 12)) * 3 : 0), qc, { look: k > 1 && k < 2.6 ? 1 : 0, tint: 'rgba(16,8,30,0.25)' });
    if (k > 0.6) G.run.flags.man_cameo = true;
  }
  ctx.restore();
}

function drawBubble(s, style) {
  const lines = U.wrap(s, 8).slice(0, 3);
  ctx.font = '800 13px sans-serif';
  const w = Math.min(150, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18);
  const h = 14 + lines.length * 17;
  const x = 358 - w;
  const y = LY.booth.y + 14;
  const pop = G.ph === 'docs' || (G.react && G.react.t < 0.15) ? easeOut(clamp((G.react && G.react.t < 0.15 ? G.react.t : G.phT) / 0.15, 0, 1)) : 1;
  const wob = style === 'lie' ? Math.sin(G.t * 30) * 1 : 0;
  const fill = { lie: '#fff3b8', confess: '#dfe6f0', bribe: '#d6f5da', explain: C.white }[style] || C.white;
  ctx.save();
  ctx.translate(x + wob, y + h);
  ctx.scale(pop, pop);
  A.block(ctx, 0, -h, w, h, fill, '#d8d2c6', { shadeH: 3 });
  ctx.fillStyle = C.ink;
  ctx.fillRect(-10, -12, 12, 4);
  ctx.fillStyle = fill;
  ctx.fillRect(-6, -11, 8, 2);
  lines.forEach((l, i) => A.text(ctx, l, 8, -h + 14 + i * 17, 13, C.ink, 'left', '800'));
  ctx.restore();
}

function drawMemory(m) {
  const k = easeOut(clamp(G.react.t / 0.3, 0, 1));
  const lines = U.wrap('「' + m.text + '」', 12).slice(0, 2);
  const w = 196;
  const h = 22 + lines.length * 15;
  const x = LY.booth.x + 6 - (1 - k) * 220;
  const y = LY.booth.y + 44;
  A.block(ctx, x, y, w, h, '#efe5cc', '#cfc09c', { shadeH: 3, drop: 3 });
  A.text(ctx, '记得吗：' + m.label, x + 8, y + 10, 10, '#8a6a4a', 'left', '800');
  lines.forEach((l, i) => A.text(ctx, l, x + 8, y + 25 + i * 15, 12, C.ink, 'left', '900'));
}

function drawBooth() {
  const b = LY.booth;
  A.booth(ctx, b.x, b.y, b.w, b.h, G.t, G.gate);
  // 宋小树留下的照片，钉在窗框上
  if (G.run && G.run.flags.tree_photo) {
    const px = b.x + 64;
    const py = b.y + 8;
    const glow = G.cur && G.cur.story && G.cur.story.who === 'qing' && G.ph === 'check';
    if (glow) {
      ctx.fillStyle = 'rgba(255,210,63,' + (0.3 + 0.3 * Math.sin(G.t * 6)).toFixed(2) + ')';
      ctx.fillRect(px - 4, py - 4, 38, 46);
    }
    A.block(ctx, px, py, 30, 38, '#f4f0e8', '#d8d2c6', { shadeH: 6, outline: 1 });
    ctx.fillStyle = '#9fb7c9';
    ctx.fillRect(px + 3, py + 3, 24, 26);
    A.portrait(ctx, personFace('qing'), px + 3, py + 3, 1.33, {});
    ctx.fillStyle = C.red;
    ctx.fillRect(px + 13, py - 3, 4, 4);
  }
  if (['work', 'cite', 'ad', 'folder', 'closing'].indexOf(G.mode) >= 0) {
    drawQueue();
    if (G.cur && G.mode !== 'closing') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x, b.y, b.w, b.h);
      ctx.clip();
      drawPerson(G.cur, personX());
      ctx.restore();
    }
  }
  // 柜台
  const cy = LY.counterY;
  A.block(ctx, b.x, cy, b.w, b.y + b.h - cy, C.woodL, C.wood, { shadeH: 8, hi: '#7a5a42' });
  const here = G.cur && G.mode !== 'closing' && G.ph !== 'enter' && !(G.ph === 'leave' && G.phT > 0.3);
  if (here) {
    const sk = face.SKIN[G.cur.face.skin];
    const shake = G.react && G.react.type === 'lie' ? G.t : 0;
    A.hands(ctx, personX(), cy - 4, sk, shake);
    A.icon(ctx, G.cur.item, b.x + 52, cy - 14 + Math.round(Math.sin(G.t * 3) * 0.6), 3);
  }
  // 窗框
  ctx.fillStyle = C.ink;
  ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, 5);
  ctx.fillRect(b.x - 4, b.y - 4, 5, b.h + 8);
  ctx.fillRect(b.x + b.w - 1, b.y - 4, 5, b.h + 8);
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
    let style = null;
    const s = G.cur.story;
    if (G.ph === 'talk' && s) line = s.lines[G.talkStep];
    else if (G.ph === 'docs' || G.ph === 'check' || G.ph === 'stamp' || G.mode === 'cite' || G.mode === 'ad' || G.mode === 'folder') {
      line = G.cur.line;
      if (G.react && (G.react.type !== 'shrug' || G.react.t < 1.1)) {
        line = G.react.line;
        style = G.react.type;
      }
    } else if (G.ph === 'leave' && G.phT < AN.leaveLineSec + 0.2) {
      if (G.talkChoice) line = G.talkChoice.say;
      else if (s) line = G.decision === 'pass' ? s.onPass : s.onReject;
    }
    if (G.poke && G.t - G.poke < 0.8 && G.ph === 'check') line = '嗯？';
    if (line) drawBubble(line, style);
    if (G.react && G.react.memory && (G.ph === 'check' || G.ph === 'stamp')) drawMemory(G.react.memory);
  }
}

function personFace(who) {
  if (!G.run.faces[who]) {
    const pp = story.people[who];
    G.run.faces[who] = face.withParts(() => 0.5, pp.face);
  }
  return G.run.faces[who];
}

function drawDesk() {
  ctx.fillStyle = C.wood;
  ctx.fillRect(0, LY.chipsY - 6, L.W, L.H);
  ctx.fillStyle = C.woodS;
  for (let i = 0; i < 8; i++) ctx.fillRect(0, LY.chipsY + 30 + i * 70, L.W, 3);
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, LY.chipsY - 8, L.W, 3);
  // 台面上：药贩留的名片、印台、杯子（地方够才画）
  if (LY.gapH > 110) {
    const y = LY.actY - 46;
    A.block(ctx, 220, y, 56, 26, '#2a2a36', '#1e1e28', { shadeH: 5 });
    ctx.fillStyle = '#5a1f2a';
    ctx.fillRect(226, y + 5, 44, 12);
    A.icon(ctx, 'coffee', 320, y + 10, 3);
    if (Math.sin(G.t * 2) > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(316, y - 18 - ((G.t * 10) % 8), 2, 6);
    }
    if (G.run && G.run.flags.drug_card) {
      ctx.save();
      ctx.translate(40, y + 10);
      ctx.rotate(-0.12);
      A.block(ctx, 0, 0, 44, 24, '#f4f0e8', '#d8d2c6', { shadeH: 3, outline: 1 });
      A.text(ctx, '药', 8, 12, 11, '#3f7a30', 'left', '900');
      ctx.fillStyle = '#8a7a6a';
      ctx.fillRect(22, 8, 16, 2);
      ctx.fillRect(22, 14, 12, 2);
      ctx.restore();
    }
  }
}

function drawChips() {
  if (!G.run) return;
  const rs = D.rules(G.run);
  const nr = D.dayData(G.run).newRule;
  let x = 10;
  const y = LY.chipsY;
  G.chipRects = {};
  const dragging = G.drag && G.drag.moved;
  rs.forEach((k) => {
    let label = data.rules[k].short;
    if (k === 'expiry') label = '今天 ' + fmtDate(G.day.date);
    ctx.font = '900 11px sans-serif';
    const w = 30 + ctx.measureText(label).width;
    const isNew = k === nr;
    const target = k === 'expiry' || k === 'seal';
    let fill = isNew ? '#3a3050' : '#2a2236';
    if (target && dragging && G.drag.over === 'chip.' + k) fill = '#5a4a20';
    A.block(ctx, x, y, w, 24, fill, '#201a2b', { shadeH: 3 });
    if (k === 'seal') A.seal(ctx, data.seal, x + 13, y + 12, 8, 1);
    else A.icon(ctx, { expiry: 'cal', name: 'name', photo: 'face' }[k], x + 13, y + 12, 1.5);
    A.text(ctx, label, x + 24, y + 12, 11, isNew ? C.yellow : C.white, 'left', '900');
    if (target) G.chipRects['chip.' + k] = [x, y, w, 24];
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
  const hx = L.W - 34;
  A.block(ctx, hx, y, 24, 24, '#2a2236', '#201a2b', { shadeH: 3 });
  A.text(ctx, '?', hx + 12, y + 12, 14, C.teal, 'center', '900');
  G.chipRects.help = [hx - 4, y - 4, 32, 32];
}

function docsVisible() {
  if (!G.cur || !G.day || !G.cur.docs) return null;
  if (G.mode === 'closing') return null;
  if (G.ph === 'enter') return null;
  if (G.ph === 'docs') {
    const k = easeOut(clamp(G.phT / AN.docsIn, 0, 1));
    return { dy: -100 * (1 - k), a: k };
  }
  if (G.ph === 'leave') {
    const k = clamp(G.phT / 0.3, 0, 1);
    return { dy: -120 * k, a: 1 - k };
  }
  return { dy: 0, a: 1 };
}

function dashRect(r, color, lw) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 2;
  ctx.setLineDash([5, 4]);
  ctx.lineDashOffset = -G.t * 20;
  ctx.strokeRect(r[0] - 2, r[1] - 2, r[2] + 4, r[3] + 4);
  ctx.restore();
}

function drawDocs() {
  const p = G.cur;
  if (p && isTalk(p) && G.ph !== 'enter') {
    // 说话类：桌上只摆他带来的东西
    const a = G.ph === 'leave' ? 1 - clamp(G.phT / 0.4, 0, 1) : 1;
    ctx.globalAlpha = a;
    A.block(ctx, L.W / 2 - 80, LY.deskY + 10, 160, 110, '#3a2a22', '#2a1e18', { shadeH: 6 });
    A.icon(ctx, p.item, L.W / 2, LY.deskY + 56, 6);
    A.text(ctx, p.displayName || p.name, L.W / 2, LY.deskY + 108, 12, C.white, 'center', '900');
    ctx.globalAlpha = 1;
    return;
  }
  const v = docsVisible();
  if (!v) return;
  ctx.save();
  ctx.globalAlpha = v.a;
  ctx.translate(0, v.dy);
  const pos = LY.docs;
  A.idCard(ctx, pos.id.x, pos.id.y, p.docs.id);
  A.passCard(ctx, pos.pass.x, pos.pass.y, p.docs.pass);
  // 手印结果贴在身份卡上
  if (p.ix.printed && (!G.printFx || G.printFx.t >= AN.printSec + 0.3)) {
    const ok = p.ix.printMatch;
    A.block(ctx, pos.id.x + 8, pos.id.y + 92, 54, 16, ok ? C.green : C.red, null, { outline: 1 });
    A.text(ctx, ok ? '✓ 本人' : '✗ 冒名', pos.id.x + 35, pos.id.y + 100, 10, ok ? C.ink : C.white, 'center', '900');
  }
  // 档案高亮
  if (G.hl) {
    const a = 0.55 + 0.45 * Math.sin(G.t * 8);
    G.hl.fields.forEach((fid) => {
      if (fid.indexOf('chip.') === 0 || fid === 'face') return;
      const r = fieldRect(fid);
      ctx.strokeStyle = 'rgba(255,210,63,' + a.toFixed(2) + ')';
      ctx.lineWidth = 4;
      ctx.strokeRect(r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6);
    });
  }
  // 罚单时：红框标出漏看的地方
  if (G.mode === 'cite' && p.flaw) {
    const a = 0.55 + 0.45 * Math.sin(G.t * 10);
    p.flaw.fields.slice(0, p.flaw.kind === 'name' ? 2 : 1).forEach((fid) => {
      const r = fieldRect(fid);
      ctx.fillStyle = 'rgba(224,67,58,' + (a * 0.25).toFixed(2) + ')';
      ctx.fillRect(r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6);
      ctx.strokeStyle = 'rgba(255,90,80,' + a.toFixed(2) + ')';
      ctx.lineWidth = 4;
      ctx.strokeRect(r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6);
    });
  }
  // 夹着的钱 / 药
  if (G.bribe === 'pending') {
    const r = billRect();
    if (p.med) {
      const n = p.bribeRaised ? 2 : 1;
      for (let i = 0; i < n; i++) A.icon(ctx, 'medbottle', r[0] + 22 + i * 18, r[1] + 14 + Math.sin(G.t * 3 + i) * 1.5, 3);
    } else {
      if (p.bribeRaised) A.bill(ctx, r[0] + 36, r[1] + 10, Math.round(p.bribe / 2), Math.sin(G.t * 3 + 1) * 0.05 + 0.25);
      A.bill(ctx, r[0] + 29, r[1] + 15, p.bribeRaised ? Math.round(p.bribe / 2) : p.bribe, Math.sin(G.t * 3) * 0.04);
    }
  }
  if (G.slammed) {
    const ps = LY.docs.pass;
    A.bigStamp(ctx, ps.x + 87, ps.y + 66, 104, 44, G.decision === 'pass', 0.72, G.decision === 'pass' ? -0.12 : 0.1);
  }
  ctx.restore();
  // 拉线时：能对的地方都描一圈虚线
  if (G.drag && G.drag.moved && G.ph === 'check') {
    anchors().forEach((a) => {
      if (a === G.drag.from) return;
      const r = fieldRect(a);
      if (!r) return;
      if (a === 'face') return;
      dashRect(r, a === G.drag.over ? C.yellow : 'rgba(255,255,255,0.35)', a === G.drag.over ? 3 : 2);
    });
    if (G.drag.over === 'face' || G.drag.from === 'face') {
      const c = center('face');
      ctx.save();
      ctx.strokeStyle = G.drag.over === 'face' ? C.yellow : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -G.t * 20;
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], 9 * LY.cell, 10 * LY.cell, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (G.tapHint && G.t - G.tapHint.t < 0.8) {
    const r = fieldRect(G.tapHint.fid);
    if (r) dashRect(r, C.teal, 3);
  }
}

function strokeLine(x1, y1, x2, y2, color, lw, wob) {
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = lw + 3;
  ctx.lineCap = 'round';
  const seg = (stroke) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (wob) {
      const n = 8;
      for (let i = 1; i < n; i++) {
        const k = i / n;
        const nx = -(y2 - y1);
        const ny = x2 - x1;
        const len = Math.hypot(nx, ny) || 1;
        const off = Math.sin(i * 2.7 + G.t * 60) * wob * (i % 2 ? 1 : -1);
        ctx.lineTo(lerp(x1, x2, k) + (nx / len) * off, lerp(y1, y2, k) + (ny / len) * off);
      }
    }
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = stroke;
    ctx.stroke();
  };
  seg(C.ink);
  ctx.lineWidth = lw;
  seg(color);
  ctx.lineCap = 'butt';
}

function dot(x, y, r, color) {
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(x, y, r + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawLines() {
  if (!G.cur || G.mode === 'closing') return;
  const vis = docsVisible();
  if (G.ph === 'leave' || (vis && vis.a < 1)) return;
  G.lines.forEach((l) => {
    const ca = center(l.a);
    const age = G.t - l.t;
    if (l.kind === 'cancel') {
      const k = clamp(age / 0.35, 0, 1);
      const x2 = lerp(l.bx, ca[0], k);
      const y2 = lerp(l.by, ca[1], k);
      ctx.globalAlpha = 1 - k;
      strokeLine(ca[0], ca[1], x2, y2, '#b8b0c8', 2);
      ctx.globalAlpha = 1;
      return;
    }
    const cb = center(l.b);
    if (l.kind === 'red') {
      const wob = age < 0.25 ? (0.25 - age) * 30 : 0;
      const pulse = 4 + Math.sin(G.t * 6) * 0.8;
      strokeLine(ca[0], ca[1], cb[0], cb[1], '#ff4a3a', pulse, wob);
      dot(ca[0], ca[1], 5, '#ff4a3a');
      dot(cb[0], cb[1], 5, '#ff4a3a');
    } else if (l.kind === 'green') {
      ctx.globalAlpha = clamp(1.6 - age, 0, 1);
      strokeLine(ca[0], ca[1], cb[0], cb[1], C.green, 3);
      dot(ca[0], ca[1], 4, C.green);
      dot(cb[0], cb[1], 4, C.green);
      ctx.globalAlpha = 1;
    } else {
      const k = clamp(age / 0.6, 0, 1);
      ctx.globalAlpha = 1 - k;
      ctx.save();
      ctx.setLineDash([4, 4]);
      strokeLine(ca[0], ca[1], lerp(cb[0], ca[0], k), lerp(cb[1], ca[1], k), '#b8b0c8', 2);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  });
  // 正在拉的线
  if (G.drag && G.drag.moved) {
    const ca = center(G.drag.from);
    const tgt = G.drag.over ? center(G.drag.over) : [G.drag.x, G.drag.y];
    ctx.save();
    if (!G.drag.over) {
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -G.t * 40;
    }
    strokeLine(ca[0], ca[1], tgt[0], tgt[1], G.drag.over ? C.yellow : C.white, 3);
    ctx.restore();
    dot(ca[0], ca[1], 5, C.yellow);
    dot(tgt[0], tgt[1], G.drag.over ? 7 : 5, G.drag.over ? C.yellow : C.white);
  }
}

function drawStampAnim() {
  if (G.ph !== 'stamp' || G.mode !== 'work') return;
  const [x, y] = stampPos();
  const ok = G.decision === 'pass';
  ctx.save();
  if (G.phT < AN.stampHit) {
    const k = G.phT / AN.stampHit;
    const s = lerp(2.4, 1, k * k);
    ctx.translate(x, y - (1 - k) * 60);
    ctx.scale(s, s);
  } else {
    const k = clamp((G.phT - AN.stampHit) / (AN.stampSec - AN.stampHit), 0, 1);
    ctx.globalAlpha = 1 - k;
    ctx.translate(x, y - 20 - k * 70);
  }
  A.block(ctx, -14, -46, 28, 30, '#7a4a2a', '#57331c', { shadeH: 5 });
  A.block(ctx, -30, -18, 60, 18, ok ? '#2fae5c' : '#d8362d', ok ? '#1f7a40' : '#962520', { shadeH: 5 });
  ctx.restore();
}

// 按手印：印泥 → 拇指按下 → 两个手印并排比
function drawPrintFx() {
  const pf = G.printFx;
  if (!pf || pf.t > AN.printSec + 0.4) return;
  const p = G.cur;
  const k = clamp(pf.t / AN.printSec, 0, 1);
  const fade = pf.t > AN.printSec ? 1 - (pf.t - AN.printSec) / 0.4 : 1;
  ctx.globalAlpha = fade;
  const w = 300;
  const h = 128;
  const x = (L.W - w) / 2;
  const y = LY.deskY + 2;
  A.block(ctx, x, y, w, h, '#efe5cc', '#cfc09c', { drop: 5, shadeH: 5 });
  A.text(ctx, '按手印', x + 10, y + 13, 12, '#8a6a4a', 'left', '900');
  A.text(ctx, '证上存的', x + 70, y + 28, 10, '#8a6a4a', 'center', '800');
  A.text(ctx, '他现在按的', x + w - 70, y + 28, 10, '#8a6a4a', 'center', '800');
  ctx.fillStyle = '#f7f1e2';
  ctx.fillRect(x + 40, y + 38, 60, 72);
  ctx.fillRect(x + w - 100, y + 38, 60, 72);
  A.fingerprint(ctx, x + 70, y + 74, 30, p.docs.id.print, 1);
  // 拇指落下
  const press = clamp((k - 0.15) / 0.3, 0, 1);
  if (k > 0.45) A.fingerprint(ctx, x + w - 70, y + 74, 30, p.print, 1, clamp((k - 0.45) / 0.3, 0, 1));
  if (k < 0.6) {
    const ty = lerp(y - 40, y + 50, easeOut(press)) - (k > 0.45 ? (k - 0.45) * 300 : 0);
    const sk = face.SKIN[p.face.skin];
    A.block(ctx, x + w - 86, ty, 32, 42, sk[0], sk[1], { shadeH: 8 });
    ctx.fillStyle = sk[1];
    ctx.fillRect(x + w - 80, ty + 6, 20, 3);
  }
  if (k >= 0.75) {
    const ok = pf.match;
    A.block(ctx, x + w / 2 - 22, y + 58, 44, 34, ok ? C.green : C.red, ok ? C.greenS : C.redS, { shadeH: 4 });
    A.text(ctx, ok ? '=' : '≠', x + w / 2, y + 74, 22, ok ? C.ink : C.white, 'center', '900');
  }
  ctx.globalAlpha = 1;
}

function drawHlLabel() {
  if (!G.hl || G.mode !== 'work' || G.ph !== 'check') return;
  const s = G.hl.clean ? '档案：这个人没问题' : G.hl.legit ? '档案：照片旧了，按手印看看' : '档案：' + data.fieldNames[G.hl.fields[0]] + ' 对不上';
  const y = LY.gapTop + (LY.gapH > 60 ? 40 : 12);
  ctx.font = '900 12px sans-serif';
  const w = ctx.measureText(s).width + 20;
  A.block(ctx, L.W / 2 - w / 2, y - 10, w, 20, G.hl.clean ? C.green : C.yellow, null, { outline: 2 });
  A.text(ctx, s, L.W / 2, y, 12, C.ink, 'center', '900');
}

function drawControls() {
  const y = LY.ctrlY;
  const p = G.cur;
  if (p && isTalk(p) && G.ph === 'talk') {
    const s = p.story;
    const ready = G.talkStep >= s.lines.length - 1 && G.phT > 0.35;
    if (!ready) {
      A.text(ctx, '点一下 · 听他说完', L.W / 2, y + 26, 12, C.grey, 'center', '800');
      return;
    }
    const cs = s.choices;
    if (cs.length === 1) {
      U.button('talk_' + cs[0].id, 60, y, L.W - 120, 52, cs[0].label, '#8b8496', '#615a6c', () => chooseTalk(cs[0].id), { color: C.white, size: 18 });
    } else {
      U.button('talk_' + cs[0].id, 10, y, 172, 52, cs[0].label, C.teal, '#1f9e93', () => chooseTalk(cs[0].id), { size: 18 });
      U.button('talk_' + cs[1].id, L.W - 182, y, 172, 52, cs[1].label, '#8b8496', '#615a6c', () => chooseTalk(cs[1].id), { color: C.white, size: 18 });
    }
    return;
  }
  const can = canAct();
  const red = hasRed();
  ctx.save();
  if (!can) ctx.globalAlpha = 0.45;
  U.button('reject', 10, y, 104, 52, '驳回', C.red, C.redS, () => decide('reject'), { color: C.white, size: 19, pulse: can && red });
  U.button('pass', L.W - 114, y, 104, 52, '放行', C.green, C.greenS, () => decide('pass'), { color: C.white, size: 19 });
  const left = G.day ? G.day.adsLeft : 0;
  U.button('file', 124, y, 127, 52, '调出档案', left ? '#d8b26a' : '#6a6070', left ? '#a8843e' : '#4a4256', callFile, { icon: 'letter', size: 14, sub: '▶ 看广告 · 剩 ' + left });
  ctx.restore();
  // 红线后：底下浮出追查工具
  if (can && red) {
    const ay = LY.actY;
    const k = easeOut(clamp((G.t - G.lines.find((l) => l.kind === 'red').t) / 0.25, 0, 1));
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 20);
    const printOn = D.hasTool(G.run, 'print');
    const printed = G.cur.ix.printed;
    if (printOn) {
      U.button('print', 120, ay, 135, 42, printed ? '已按手印' : '按手印', printed ? '#6a6070' : '#c9a0e8', printed ? '#4a4256' : '#9a70c0', doPrint, { icon: 'print', size: 15, disabled: printed, pulse: !printed && G.cur.flaw && G.cur.flaw.kind.indexOf('photo') === 0 });
    } else lockedBtn('lk_print', 120, ay, 135, '按手印', '第 2 章');
    lockedBtn('lk_search', 10, ay, 100, '搜包', '第 3 章');
    lockedBtn('lk_detain', L.W - 110, ay, 100, '拘留', '第 3 章');
    ctx.restore();
  }
}

function lockedBtn(id, x, y, w, label, sub) {
  A.block(ctx, x, y, w, 42, '#2a2236', '#201a2b', { shadeH: 4 });
  A.icon(ctx, 'lock', x + 16, y + 21, 1.5);
  A.text(ctx, label, x + w / 2 + 8, y + 15, 13, '#8b8496', 'center', '900');
  A.text(ctx, sub, x + w / 2 + 8, y + 31, 9, '#6a6278', 'center', '700');
  G.buttons.push({ id, x, y, w, h: 42, fn: () => { sfx.nope(); U.toast(sub + '才能用', C.grey, LY.actY - 16); } });
}

// —— 教学（第 1 天、第 7 天）——
function finger(x, y, a) {
  ctx.globalAlpha = a == null ? 1 : a;
  ctx.fillStyle = C.ink;
  ctx.fillRect(x - 2, y - 2, 16, 22);
  ctx.fillStyle = C.white;
  ctx.fillRect(x, y, 6, 10);
  ctx.fillRect(x, y + 8, 12, 10);
  ctx.globalAlpha = 1;
}
function drawTutorial() {
  if (!G.day || G.mode !== 'work' || G.ph !== 'check' || G.modal || printing()) return;
  const di = G.day.idx;
  const qi = G.day.qi;
  const p = G.cur;
  const tut = G.tut || {};
  let lines = null;
  let path = null;
  let pointBtn = null;
  const red = hasRed();
  const green = G.lines.some((l) => l.kind === 'green');
  if (di === 0 && qi === 0) {
    if (!green && !red) {
      lines = ['按住照片，拖到他脸上：对一对'];
      path = ['id.photo', 'face'];
    } else {
      lines = ['绿线 = 对得上。都对 → 按「放行」'];
      pointBtn = 'pass';
    }
  } else if (di === 0 && qi === 1) {
    if (!red) {
      lines = ['再对一次：照片 → 脸'];
      path = ['id.photo', 'face'];
    } else {
      lines = ['红线 = 对不上，他认了。→ 按「驳回」'];
      pointBtn = 'reject';
    }
  } else if (di === 0 && qi === 2 && !G.lines.length) {
    lines = ['名字：身份卡 ↔ 通行证', '有效期 ↔ 规则条上的「今天」'];
    path = ['pass.until', 'chip.expiry'];
  } else if (di === 6 && qi === 0 && !G.lines.length) {
    lines = ['新规则：通行证的章 ↔ 规则条上的本周章'];
    path = ['pass.seal', 'chip.seal'];
  } else if (di === 6 && qi === 1) {
    if (!red) {
      lines = ['照片好像不太像？先拉红线'];
      path = ['id.photo', 'face'];
    } else if (!p.ix.printed) {
      lines = ['照片旧了还是冒名？按手印看看'];
      pointBtn = 'print';
    } else lines = [p.ix.printMatch ? '手印对上 = 本人 → 放行' : '手印对不上 → 驳回'];
  } else if (di === 6 && qi === 2 && !red) {
    lines = ['章的形状、颜色都要对'];
  }
  if (!lines) return;
  const y = LY.gapTop + 2;
  const h = 10 + lines.length * 16;
  A.block(ctx, 8, y, L.W - 16, h, C.yellow, C.yellowS, { shadeH: 3 });
  lines.forEach((l, i) => A.text(ctx, l, L.W / 2, y + 12 + i * 16, 12, C.ink, 'center', '900'));
  if (path && !(G.drag && G.drag.moved)) {
    const a = center(path[0]);
    const b = center(path[1]);
    const k = (G.t % 1.6) / 1.6;
    const e = easeOut(clamp(k / 0.8, 0, 1));
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.setLineDash([6, 5]);
    strokeLine(a[0], a[1], lerp(a[0], b[0], e), lerp(a[1], b[1], e), C.yellow, 2);
    ctx.restore();
    finger(lerp(a[0], b[0], e), lerp(a[1], b[1], e), 1 - Math.max(0, k - 0.8) * 5);
  }
  if (pointBtn) {
    const bt = G.buttons.find((b) => b.id === pointBtn);
    if (bt) finger(bt.x + bt.w - 22, bt.y + 16 - Math.abs(Math.sin(G.t * 5)) * 8, 1);
  }
}

function drawCite() {
  if (G.mode !== 'cite') return;
  const c = G.cite;
  const res = c.res;
  const w = L.W - 60;
  const x = 30;
  const top = LY.booth.y - 2;
  // 打印机挂在窗框上
  A.printer(ctx, L.W / 2 - 70, top - 10, 140, G.t, G.modeT < 0.7);
  const full = 112;
  const len = Math.min(full, easeOut(clamp(G.modeT / 0.6, 0, 1)) * full);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 10, top + 26, w + 20, len + 10);
  ctx.clip();
  const y = top + 26 + len - full;
  A.block(ctx, x, y, w, full, '#f7e6e0', '#e0c4ba', { drop: 5, shadeH: 4 });
  ctx.fillStyle = C.red;
  ctx.fillRect(x, y, w, 20);
  A.text(ctx, '罚 单 · 第 ' + G.day.mistakes + ' 张', x + 10, y + 10, 12, C.white, 'left', '900');
  A.text(ctx, res.invalid ? '你放进去了。漏看：' : res.reason === data.explain.photoOld ? '你赶走了本人：' : '你赶走了一个没问题的人。', x + 10, y + 34, 11, '#6a3a30', 'left', '800');
  A.text(ctx, res.reason, x + 10, y + 56, 14, C.ink, 'left', '900');
  A.text(ctx, '红框 = 你漏看的地方 · 点一下继续', x + w / 2, y + full - 12, 10, '#9a6a5a', 'center', '700');
  ctx.restore();
  if (c.slammed) {
    const k = clamp((G.modeT - 0.75) / 0.12, 0, 1);
    const s = lerp(2.2, 1, k);
    ctx.save();
    ctx.translate(x + w - 62, top + 26 + 66);
    ctx.rotate(-0.15);
    ctx.scale(s, s);
    ctx.globalAlpha = 0.9;
    const fine = !!res.fine;
    const col = fine ? '#d8362d' : '#d8a21e';
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.strokeRect(-48, -22, 96, 44);
    A.text(ctx, fine ? '罚 −' + res.fine : '警告 ' + res.warn + '/' + config.pay.freeWarnings, 0, 0, fine ? 20 : 16, col, 'center', '900');
    ctx.restore();
    if (!fine && res.warn === config.pay.freeWarnings) A.text(ctx, '再错就扣钱了', L.W / 2, top + 26 + full + 16, 12, C.yellow, 'center', '900');
  }
}

function drawBribeModal() {
  U.dim(0.6);
  const p = G.cur;
  const w = 290;
  const h = 196;
  const x = (L.W - w) / 2;
  const y = Math.max(LY.deskY - 20, L.H - 70 - h);
  A.block(ctx, x, y, w, h, '#2a2236', '#201a2b', { drop: 5, shadeH: 6 });
  if (p.med) {
    A.icon(ctx, 'medbottle', L.W / 2 - (p.bribeRaised ? 12 : 0), y + 40, 4);
    if (p.bribeRaised) A.icon(ctx, 'medbottle', L.W / 2 + 14, y + 42, 4);
    A.text(ctx, p.bribeRaised ? '证件里夹着两瓶药' : '证件里夹着一瓶药', L.W / 2, y + 82, 16, C.yellow, 'center', '900');
    A.text(ctx, '收下 + 放行 = 外婆的药以后半价', L.W / 2, y + 104, 12, C.grey, 'center', '700');
  } else {
    A.bill(ctx, L.W / 2, y + 42, p.bribe, Math.sin(G.t * 3) * 0.05);
    A.text(ctx, '证件里夹着 ¥' + p.bribe, L.W / 2, y + 82, 16, C.yellow, 'center', '900');
    A.text(ctx, '收了，钱进抽屉。', L.W / 2, y + 104, 12, C.grey, 'center', '700');
  }
  U.button('take', x + 16, y + 126, 120, 52, '收下', C.yellow, C.yellowS, () => takeBribe(true));
  U.button('refuse', x + w - 136, y + 126, 120, 52, '推回去', '#8b8496', '#615a6c', () => takeBribe(false), { color: C.white });
}

function drawRulesModal() {
  U.dim(0.78);
  const rs = D.rules(G.run);
  const x = 16;
  const w = L.W - 32;
  const tools = D.hasTool(G.run, 'print') ? ['line', 'print'] : ['line'];
  const h = 50 + rs.length * 36 + tools.length * 36 + 56;
  const y = Math.max(20, L.H - 80 - h);
  A.block(ctx, x, y, w, h, C.paper, C.paperS, { drop: 5, shadeH: 6 });
  A.text(ctx, '查验规则 · 今天 ' + fmtDate(G.day.date), x + 14, y + 20, 15, C.ink, 'left', '900');
  const nr = D.dayData(G.run).newRule;
  rs.forEach((k, i) => {
    const yy = y + 50 + i * 36;
    if (k === 'seal') A.seal(ctx, data.seal, x + 26, yy, 13, 1);
    else A.icon(ctx, { expiry: 'cal', name: 'name', photo: 'face' }[k], x + 26, yy, 2.5);
    A.text(ctx, data.rules[k].short, x + 48, yy - 8, 13, k === nr ? C.redS : C.ink, 'left', '900');
    const long = k === 'photo' && D.hasTool(G.run, 'print') ? data.rules[k].long2 : data.rules[k].long;
    A.text(ctx, long, x + 48, yy + 9, 11, '#5a4a3a', 'left', '700');
  });
  tools.forEach((t, i) => {
    const yy = y + 50 + rs.length * 36 + i * 36;
    A.icon(ctx, t === 'print' ? 'print' : 'letter', x + 26, yy, 2);
    A.text(ctx, '工具 · ' + data.tools[t].name, x + 48, yy - 8, 13, '#3a2a6a', 'left', '900');
    A.text(ctx, data.tools[t].how.join('，'), x + 48, yy + 9, 10, '#5a4a3a', 'left', '700');
  });
  const yy = y + 50 + (rs.length + tools.length) * 36 + 2;
  A.text(ctx, '判对 +' + config.pay.correct + ' · 拉出红线再驳回 +' + config.pay.evidence, x + 14, yy, 11, '#5a4a3a', 'left', '800');
  A.text(ctx, '判错：每天前 ' + config.pay.freeWarnings + ' 次警告，之后每次 −' + config.pay.fine, x + 14, yy + 18, 11, C.redS, 'left', '900');
  A.text(ctx, '点哪儿都能关', L.W / 2, y + h - 10, 10, '#8a7a6a', 'center', '700');
}

function drawFolder() {
  U.dim(0.55);
  const k = clamp(G.modeT / AN.folderSec, 0, 1);
  const cx = L.W / 2;
  const cy = L.H / 2 - 30;
  const w = 220;
  const h = 150;
  A.block(ctx, cx - w / 2, cy - h / 2, w, h, '#d8b26a', '#a8843e', { drop: 6, shadeH: 8 });
  A.block(ctx, cx - w / 2 + 16, cy - h / 2 + 12 - easeOut(k) * 24, w - 32, h - 30, C.paper, C.paperS, { shadeH: 4 });
  A.text(ctx, '档案 · ' + G.cur.name, cx, cy - h / 2 + 30 - easeOut(k) * 24, 14, C.ink, 'center', '900');
  A.text(ctx, k > 0.6 ? (G.cur.flaw ? '有一处对不上……' : '没查到问题') : '翻找中……', cx, cy - easeOut(k) * 24, 13, k > 0.6 ? C.redS : '#6a5a4a', 'center', '900');
  const flip = Math.cos(Math.min(1, k * 1.6) * Math.PI);
  ctx.save();
  ctx.translate(cx, cy - h / 2);
  ctx.scale(1, flip);
  A.block(ctx, -w / 2, 0, w, h, flip > 0 ? '#e6c47e' : '#b8944e', '#c9a45e', { shadeH: 8 });
  if (flip > 0) A.text(ctx, '档 案', 0, h / 2, 22, '#6a4a1e', 'center', '900');
  ctx.restore();
}

function draw() {
  drawBooth();
  drawDesk();
  drawChips();
  drawDocs();
  drawLines();
  drawStampAnim();
  drawPrintFx();
  drawHlLabel();
  drawControls();
  drawTutorial();
  drawCite();
  if (G.mode === 'closing') {
    U.dim(0.5);
    const k = easeOut(clamp(G.modeT / 0.3, 0, 1));
    A.bigText(ctx, G.closingEmpty ? '人查完了' : '下 班', L.W / 2, L.H / 2 - 20, Math.round(44 * k + 1), C.yellow);
    A.text(ctx, G.closingEmpty ? '今天的队排完了' : '没查完的人，明天再来', L.W / 2, L.H / 2 + 24, 13, C.white, 'center', '800');
  }
  drawHUD();
  if (G.modal === 'bribe' && G.mode === 'work') drawBribeModal();
  if (G.modal === 'rules' && G.mode === 'work') drawRulesModal();
  if (G.mode === 'folder') drawFolder();
}

module.exports = {
  openWindow, update, draw, touch, drawBooth, drawHUD, fieldRect, center, anchors, billRect, decide, doLink, doPrint, chooseTalk, closeCite, endShift, personFace,
  modes: ['work', 'cite', 'folder', 'closing'],
};
