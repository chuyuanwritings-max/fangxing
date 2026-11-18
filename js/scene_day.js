// 一天里窗口以外的画面：开场、早上的报纸、下班的事件卡、工资条、回家（挑谁先受苦）、夜里、章节卡、被赶出门、广告占位。
const U = require('./ui.js');
const platform = require('./platform.js');
const config = require('./config.js');
const data = require('./data.js');
const story = require('./story.js');
const D = require('./day.js');
const A = require('./art.js');
const face = require('./face.js');
const sfx = require('./sfx.js');
const W = require('./scene_work.js');
const { clamp, lerp, easeOut, fmtDate, hash, fill } = require('./util.js');

const { G, L, C, ctx } = U;
const AN = config.anim;

function famFace(id) {
  if (!G.run.faces['fam_' + id]) G.run.faces['fam_' + id] = face.withParts(() => 0.5, data.family[id].face);
  return G.run.faces['fam_' + id];
}
function whoFace(who) {
  if (!who) return null;
  if (data.family[who]) return famFace(who);
  const pp = story.people[who];
  if (pp && pp.faceOf) return famFace(pp.faceOf);
  return W.personFace(who);
}

// ================= 开场 =================
function drawTitle() {
  const b = U.LY.booth;
  const bh = Math.min(b.h + 40, L.H * 0.42);
  A.booth(ctx, b.x, 40, b.w, bh, G.t, (Math.sin(G.t * 0.8) + 1) / 2 > 0.9 ? 1 : 0);
  // 窗口里外婆、小满、阿圆的剪影晃一晃
  ['nan', 'man', 'yuan'].forEach((id, i) => {
    A.portrait(ctx, face.withParts(() => 0.5, data.family[id].face), 40 + i * 44, 40 + bh - 74 + Math.round(Math.sin(G.t * 2 + i) * 1.5), 3, { blink: (G.t + i) % 3 < 0.12, tint: 'rgba(16,8,30,0.35)' });
  });
  const y0 = 40 + bh;
  const btnTop = L.H - (G.save.run ? 210 : 150) - (G.save.unlocked2 ? 60 : 0);
  const ty = Math.min(y0 + 64, btnTop - 96);
  A.bigText(ctx, '放 行', L.W / 2, ty, 60, C.yellow);
  A.text(ctx, data.world.place, L.W / 2, ty + 44, 14, C.teal, 'center', '900');
  data.world.intro.forEach((l, i) => {
    const yy = ty + 70 + i * 20;
    if (yy < btnTop - 8) A.text(ctx, l, L.W / 2, yy, 13, C.white, 'center', '700');
  });
  const k = (G.t % 2.2) / 2.2;
  A.bigStamp(ctx, L.W / 2 + 96, ty - 22, 80, 34, true, k < 0.1 ? k * 10 : 1 - (k - 0.1) * 0.6, -0.2);
  let by = btnTop;
  const sv = G.save.run;
  if (sv) {
    U.button('continue', 40, by, L.W - 80, 58, '继续 · 第 ' + (sv.dayIdx + 1) + ' 天', C.green, C.greenS, U.flow.continueRun, { color: C.white, size: 20, sub: '第 ' + D.dayData(sv).ch + ' 章 · 存款 ¥' + sv.money });
    by += 70;
  }
  if (G.save.unlocked2) {
    U.button('ch2', 40, by, L.W - 80, 50, '从第 2 章开始', '#c9a0e8', '#9a70c0', U.flow.startCh2, { size: 16 });
    by += 60;
  }
  U.button('start', 40, by, L.W - 80, sv ? 50 : 58, sv ? '从头开始' : '上 岗', sv ? '#8b8496' : C.green, sv ? '#615a6c' : C.greenS, U.flow.startRun, { color: C.white, size: sv ? 16 : 22 });
  A.text(ctx, config.version + (G.save.plays ? ' · 上过 ' + G.save.plays + ' 次岗' : ''), L.W / 2, L.H - 16, 9, C.dim, 'center', '700');
}

// ================= 早上的报纸 =================
function enterPaper() {
  G.paper = D.paper(G.run);
  G.paperLanded = false;
  U.setMode('paper');
  sfx.whoosh();
}
function updatePaper() {
  if (!G.paperLanded && G.modeT >= 0.35) {
    G.paperLanded = true;
    sfx.thump();
    G.shake = 6;
    platform.vibrate(false);
  }
  if (G.paperLanded && !G.cardSlam && G.modeT >= 0.9 && cardKind()) {
    G.cardSlam = true;
    sfx.stamp(true);
    G.shake = 7;
  }
}
function cardKind() {
  const dd = D.dayData(G.run);
  return dd.newTool || dd.newRule ? dd : null;
}

function drawPaper() {
  ctx.fillStyle = C.wood;
  ctx.fillRect(0, 0, L.W, L.H);
  ctx.fillStyle = C.woodS;
  for (let i = 0; i < 12; i++) ctx.fillRect(0, 40 + i * 70, L.W, 3);
  const pp = G.paper;
  const k = easeOut(clamp(G.modeT / 0.35, 0, 1));
  const px = 14;
  const pw = L.W - 28;
  const ph = L.H - 100;
  const py = 14;
  ctx.save();
  ctx.translate(L.W / 2, py + ph / 2 - (1 - k) * L.H);
  ctx.rotate(lerp(-0.35, -0.012, k) + Math.sin(G.t * 0.8) * 0.003);
  ctx.translate(-L.W / 2, -(py + ph / 2));
  A.block(ctx, px, py, pw, ph, A.NP.p, '#d6cdbb', { drop: 6, shadeH: 6 });
  const ink = A.NP.k;
  A.text(ctx, '外 环 晨 报', L.W / 2, py + 30, 28, ink, 'center', '900');
  A.text(ctx, '新历 ' + fmtDate(pp.date) + ' · 第 ' + pp.day + ' 天 · 第 ' + D.chapter(G.run) + ' 章', L.W / 2, py + 58, 11, A.NP.d, 'center', '800');
  ctx.fillStyle = ink;
  ctx.fillRect(px + 12, py + 68, pw - 24, 3);
  ctx.fillRect(px + 12, py + 73, pw - 24, 1);
  let y = py + 96;
  const heads = U.wrap(pp.head, 11).slice(0, 2);
  heads.forEach((h, i) => A.text(ctx, h, L.W / 2, y + i * 30, 24, ink, 'center', '900'));
  y += heads.length * 30 - 4;
  const card = cardKind();
  const cardH = card ? (card.newRule ? 150 : 128) : 0;
  const bottom = py + ph - 10 - cardH;
  const famH = 34;
  const picH = clamp(Math.round(bottom - y - 8 - (pp.sub ? 22 : 0) - famH - 10 - 40), 70, 260);
  const faces = [whoFace(pp.who), whoFace(pp.who2)];
  A.paperPic(ctx, px + 14, y, pw - 28, picH, pp.pic, G.t, faces);
  y += picH + 16;
  if (pp.sub) {
    A.text(ctx, pp.sub, L.W / 2, y, 13, A.NP.d, 'center', '800');
    y += 20;
  }
  // 下面两栏：角落一条小新闻 + 灰条装成正文（不用读）
  const colTop = y + 2;
  const colBot = bottom - famH - 6;
  if (colBot - colTop > 24) {
    ctx.fillStyle = A.NP.m;
    ctx.fillRect(px + 12, colTop - 4, pw - 24, 1);
    const cw = (pw - 36) / 2;
    let ly = colTop + 10;
    if (pp.side) {
      A.text(ctx, '▪ ' + pp.side, px + 14, ly, 12, ink, 'left', '900');
      ly += 18;
    }
    const rr = hash(pp.head);
    for (let c = 0; c < 2; c++) {
      const cx0 = px + 14 + c * (cw + 8);
      for (let yy = c === 0 ? ly : colTop + 10; yy < colBot; yy += 9) {
        const wv = cw * (0.6 + (((rr >> ((yy + c * 7) % 13)) & 7) / 7) * 0.4);
        ctx.fillStyle = 'rgba(90,83,74,0.28)';
        ctx.fillRect(cx0, yy - 2, wv, 4);
      }
    }
    ctx.fillStyle = A.NP.m;
    ctx.fillRect(px + 14 + cw + 3, colTop + 2, 1, colBot - colTop - 4);
  }
  // 家里：每人一个字（和晚上回家看到的一样）
  const fy = Math.max(y + 4, bottom - famH);
  if (fy + famH <= bottom + 4) {
    ctx.fillStyle = A.NP.m;
    ctx.fillRect(px + 12, fy, pw - 24, 1);
    const fam = D.homeTonight(G.run).members.filter((m) => m.id !== 'yuan');
    const my = fy + 18;
    A.text(ctx, '家里', px + 16, my, 11, A.NP.d, 'left', '900');
    fam.forEach((m, i) => {
      const fx = px + 52 + i * 92;
      if (G.run.fam[m.id].dead) {
        A.icon(ctx, 'candle', fx + 8, my, 1.6);
        A.text(ctx, m.name, fx + 20, my, 11, A.NP.d, 'left', '800');
        return;
      }
      A.portrait(ctx, famFace(m.id), fx, my - 14, 1.3, { tone: 'grey' });
      A.text(ctx, m.name + (m.word ? ' · ' + m.word : ''), fx + 27, my, 11, m.word ? C.redS : A.NP.d, 'left', '900');
    });
  }
  ctx.restore();
  if (card && G.modeT >= 0.9) drawRuleCard(card, px + 6, py + ph - 8 - cardH, pw - 12, cardH);
  if (G.modeT > 0.5) U.button('go', 40, L.H - 74, L.W - 80, 58, '上 班', C.green, C.greenS, U.flow.toWork, { color: C.white, size: 22 });
}

function drawRuleCard(dd, x, y, w, h) {
  const k = easeOut(clamp((G.modeT - 0.9) / 0.15, 0, 1));
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(0.02);
  ctx.scale(lerp(1.6, 1, k), lerp(1.6, 1, k));
  ctx.globalAlpha = k;
  ctx.translate(-(x + w / 2), -(y + h / 2));
  A.block(ctx, x, y, w, h, C.paper, C.paperS, { drop: 5, shadeH: 5 });
  ctx.fillStyle = C.red;
  ctx.fillRect(x, y, w, 22);
  A.text(ctx, dd.newRule ? '新规则 · 新工具' : '新工具', x + 12, y + 11, 12, C.white, 'left', '900');
  let yy = y + 36;
  if (dd.newRule) {
    A.seal(ctx, data.seal, x + 34, yy + 10, 17, 1);
    A.text(ctx, '本周章：蓝色 · 六角', x + 62, yy + 2, 14, C.ink, 'left', '900');
    A.text(ctx, '别的形状、颜色 = 假章', x + 62, yy + 20, 11, C.redS, 'left', '800');
    yy += 48;
  }
  const tool = data.tools[dd.newTool];
  if (dd.newTool === 'print') {
    A.fingerprint(ctx, x + 34, yy + 14, 16, 7, 1);
  } else {
    // 小示意：照片 → 脸，一根红线
    A.block(ctx, x + 14, yy - 4, 20, 26, '#9fb7c9', null, { outline: 1 });
    A.block(ctx, x + 44, yy + 18, 16, 16, '#f2c9a0', null, { outline: 1 });
    const t = (G.t % 1.4) / 1.4;
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 24, yy + 9);
    ctx.lineTo(lerp(x + 24, x + 52, t), lerp(yy + 9, yy + 26, t));
    ctx.stroke();
  }
  A.text(ctx, tool.name, x + 72, yy, 15, '#3a2a6a', 'left', '900');
  A.text(ctx, tool.how[0], x + 72, yy + 19, 11, '#5a4a3a', 'left', '800');
  A.text(ctx, tool.how[1], x + 72, yy + 35, 11, '#5a4a3a', 'left', '800');
  A.text(ctx, tool.tip, x + 72, yy + 53, 11, C.redS, 'left', '900');
  ctx.restore();
}

// ================= 下班后的事件卡 =================
function drawCard() {
  W.draw();
  U.dim(0.75);
  const e = G.event;
  const k = easeOut(clamp(G.modeT / 0.3, 0, 1));
  ctx.save();
  ctx.translate(L.W / 2, L.H / 2 - 40);
  ctx.scale(k, k);
  A.block(ctx, -160, -100, 320, 200, '#2a2236', '#201a2b', { drop: 6, shadeH: 6 });
  const f = whoFace(e.who);
  if (f) A.portrait(ctx, f, -146, -88, 3, { blink: G.t % 3 < 0.12, mood: e.money < 0 ? null : 'grin' });
  else A.icon(ctx, 'audit', -110, -44, 5);
  A.text(ctx, e.title, -84, -70, 17, C.yellow, 'left', '900');
  U.wrap(e.line, 15).forEach((l, i) => A.text(ctx, l, -84, -40 + i * 20, 13, C.white, 'left', '800'));
  if (e.money) A.bigText(ctx, (e.money > 0 ? '+' : '−') + Math.abs(e.money) + ' 元', 0, 62, 28, e.money > 0 ? C.green : C.red);
  else A.text(ctx, '（不罚钱）', 0, 62, 13, C.grey, 'center', '800');
  ctx.restore();
  if (G.modeT > 0.6) A.text(ctx, '点一下 · 看工资条', L.W / 2, L.H / 2 + 86, 12, C.grey, 'center', '800');
}

// ================= 工资条 =================
function enterSlip() {
  G.slip = { lines: D.payslip(G.run, G.day), shown: 0, t: 0, banked: 0, flown: false, done: false };
  U.setMode('slip');
  sfx.whoosh();
}
function slipLayout() {
  const lines = G.slip.lines;
  const top = 76;
  const bottom = L.H - 206;
  const lh = Math.max(17, Math.min(26, Math.floor((bottom - top - 30) / lines.length)));
  return { top, lh, x: 50, w: L.W - 100, walletY: Math.min(L.H - 180, top + 30 + lines.length * lh + 52) };
}
function updateSlip(dt) {
  const s = G.slip;
  s.t += dt;
  const n = Math.min(s.lines.length, Math.floor((s.t - 0.4) / AN.slipLineSec) + 1);
  while (s.shown < n) {
    const ln = s.lines[s.shown];
    s.shown += 1;
    sfx.printLine();
    if (ln.k === 'fine' && !ln.appealed) {
      sfx.fine();
      G.shake = config.juice.fineShake;
      G.flash = { t: 0, color: '224,67,58' };
      platform.vibrate(true);
    } else if (ln.k === 'warn') sfx.warn();
    else if (ln.k === 'drawer') sfx.rustle();
    else if (ln.k === 'event' && ln.amount < 0) sfx.bad();
    else if (ln.k === 'total') {
      sfx.register();
      platform.vibrate(true);
    }
    ln.at = G.t;
  }
  if (s.shown >= s.lines.length && !s.flown && s.t > 0.4 + s.lines.length * AN.slipLineSec + 0.2) {
    s.flown = true;
    flyTotal(D.income(G.day));
  }
  G.moneyTarget = G.run.money + s.banked;
}
function flyTotal(amount) {
  const s = G.slip;
  const lay = slipLayout();
  const ty = lay.top + 30 + (s.lines.length - 1) * lay.lh;
  if (amount === 0) {
    s.done = true;
    return;
  }
  const n = clamp(Math.round(Math.abs(amount) / 5), 3, 14);
  const per = amount / n;
  let got = 0;
  for (let i = 0; i < n; i++) {
    const big = Math.abs(amount) >= 20 && i % 3 === 0;
    U.flyMoney(amount > 0 ? L.W - 90 : L.W / 2, amount > 0 ? ty : lay.walletY, 1, {
      tx: amount > 0 ? L.W / 2 : L.W / 2 + 60, ty: amount > 0 ? lay.walletY : L.H + 20, kind: big ? 'bill' : 'coin', delay: i * 0.08, out: amount < 0,
      onArrive: () => {
        got += 1;
        s.banked = got >= n ? s.banked0 + amount : s.banked + per;
        if (got >= n) s.done = true;
      },
    });
  }
  s.banked0 = s.banked;
}
function slipAd(kind) {
  U.flow.ad(kind, () => {
    const before = D.income(G.day);
    if (kind === 'overtime') {
      D.addOvertime(G.run, G.day);
      W.openWindow();
      U.toast('加班', C.teal);
      return;
    }
    if (kind === 'double') D.applyDouble(G.day);
    if (kind === 'appeal') D.appealOne(G.day);
    const s = G.slip;
    s.lines = D.payslip(G.run, G.day);
    s.shown = s.lines.length;
    s.lines.forEach((l) => (l.at = G.t - 1));
    sfx.better();
    const gain = D.income(G.day) - before;
    if (gain) {
      s.done = false;
      flyTotal(gain);
    }
  });
}
function goHome() {
  if (!G.day.banked) {
    G.run.money += D.income(G.day);
    G.day.banked = true;
  }
  enterHome();
}

function stampMark(x, y, label, col, at, big) {
  const k = clamp((G.t - (at || 0)) / 0.12, 0, 1);
  const s = lerp(2.4, 1, easeOut(k));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18);
  ctx.scale(s, s);
  ctx.globalAlpha = 0.85 * k;
  ctx.strokeStyle = col;
  ctx.lineWidth = big ? 3 : 2;
  ctx.font = '900 ' + (big ? 14 : 11) + 'px sans-serif';
  const w = ctx.measureText(label).width + 12;
  ctx.strokeRect(-w / 2, -10, w, 20);
  A.text(ctx, label, 0, 0, big ? 14 : 11, col, 'center', '900');
  ctx.restore();
}

function drawSlip() {
  ctx.fillStyle = '#16111e';
  ctx.fillRect(0, 0, L.W, L.H);
  const s = G.slip;
  const lay = slipLayout();
  A.printer(ctx, L.W / 2 - 110, 22, 220, G.t, !s.done);
  A.text(ctx, '第 ' + (G.day.idx + 1) + ' 天 · 工资条', L.W / 2, 14, 11, C.grey, 'center', '800');
  const paperLen = 30 + s.shown * lay.lh + 10;
  const x = lay.x;
  const w = lay.w;
  const y = lay.top - 12;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 8, 56, w + 16, paperLen + 30);
  ctx.clip();
  A.block(ctx, x, y, w, paperLen, '#f4efe2', '#e0d8c4', { shadeH: 4, drop: 4 });
  // 锯齿下边
  ctx.fillStyle = '#16111e';
  for (let i = 0; i < w; i += 8) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + paperLen + 1);
    ctx.lineTo(x + i + 4, y + paperLen - 4);
    ctx.lineTo(x + i + 8, y + paperLen + 1);
    ctx.fill();
  }
  A.text(ctx, '内城关口 · 7 号窗 · ' + fmtDate(G.day.date), x + 10, y + 14, 10, '#8a7a6a', 'left', '800');
  for (let i = 0; i < s.shown; i++) {
    const ln = s.lines[i];
    const ly = lay.top + 30 + i * lay.lh - 6;
    const fs = lay.lh < 21 ? 11 : 12;
    let col = '#3a2a1a';
    if (ln.k === 'fine' || (ln.k === 'event' && ln.amount < 0)) col = C.redS;
    if (ln.k === 'drawer') col = '#9a929e';
    if (ln.k === 'total') {
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x + 10, ly - lay.lh / 2 + 1, w - 20, 2);
      ctx.fillRect(x + 10, ly - lay.lh / 2 + 4, w - 20, 1);
    }
    if (ln.k === 'drawer') {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#b8b0bc';
      ctx.beginPath();
      ctx.moveTo(x + 10, ly - lay.lh / 2 + 2);
      ctx.lineTo(x + w - 10, ly - lay.lh / 2 + 2);
      ctx.stroke();
      ctx.restore();
    }
    A.text(ctx, ln.label, x + 12, ly, ln.k === 'total' ? 14 : fs, col, 'left', ln.k === 'total' ? '900' : '800');
    if (ln.amount != null && ln.k !== 'warn') {
      const amt = (ln.amount < 0 ? '−' : '+') + Math.abs(ln.amount);
      A.text(ctx, amt, x + w - 12, ly, ln.k === 'total' ? 17 : 14, ln.k === 'total' ? (ln.amount < 0 ? C.redS : '#2a7a3a') : col, 'right', '900');
    }
    if (ln.appealed) {
      ctx.fillStyle = C.redS;
      ctx.fillRect(x + 12, ly, w - 24, 2);
    }
  }
  ctx.restore();
  // 章：警告黄、罚单红（砸下来）、撤销青
  for (let i = 0; i < s.shown; i++) {
    const ln = s.lines[i];
    const ly = lay.top + 30 + i * lay.lh - 6;
    if (ln.k === 'warn') stampMark(x + w - 34, ly, '警告', '#c99a1e', ln.at, false);
    if (ln.k === 'fine') {
      if (ln.appealed) stampMark(x + w - 60, ly, '已撤销', '#1f9e93', ln.at, false);
      else stampMark(x + w - 64, ly, '罚', '#d8362d', ln.at, true);
    }
    if (ln.k === 'drawer') stampMark(x + w - 70, ly, '不记账', '#8b8496', ln.at, false);
  }
  // 钱包
  const wy = lay.walletY;
  G.walletPos = { x: L.W / 2, y: wy };
  A.wallet(ctx, L.W / 2 - 46, wy, G.moneyShown, G.walletBump);
  A.text(ctx, '¥ ' + Math.round(G.moneyShown), L.W / 2 + 6, wy, 22, G.moneyShown < 0 ? C.red : C.yellow, 'left', '900');
  if (!s.done) {
    A.text(ctx, '点一下 · 快进', L.W / 2, L.H - 50, 11, C.grey, 'center', '700');
    return;
  }
  // 广告（只救急）：加班 / 翻倍 二选一，申诉撤一张罚单
  const day = G.day;
  const adY = L.H - 136;
  const btns = [];
  const oneLeft = !day.overtimeUsed && !day.doubleUsed;
  btns.push({ id: 'overtime', label: '加班', sub: '▶ +' + config.overtimeSec + ' 秒', on: oneLeft, fn: () => slipAd('overtime') });
  btns.push({ id: 'double', label: '工资翻倍', sub: '▶ 最多 +' + config.doubleCap, on: oneLeft && day.ledger.pay > 0, fn: () => slipAd('double') });
  const canAppeal = day.appealsLeft > 0 && day.ledger.fines.some((f) => !f.appealed);
  btns.push({ id: 'appeal', label: '罚单申诉', sub: '▶ 撤一张', on: canAppeal, fn: () => slipAd('appeal') });
  const bw = (L.W - 20 - 16) / 3;
  btns.forEach((b, i) => {
    U.button(b.id, 10 + i * (bw + 8), adY, bw, 48, b.label, C.teal, '#1f9e93', b.fn, { size: 14, sub: b.sub, disabled: !b.on });
  });
  if (oneLeft && adY - 12 > wy + 30) A.text(ctx, '加班和翻倍，一天只能选一个', L.W / 2, adY - 12, 10, C.grey, 'center', '700');
  U.button('home', 40, L.H - 74, L.W - 80, 58, '回 家', C.green, C.greenS, goHome, { color: C.white, size: 22 });
}

// ================= 回家 =================
function enterHome() {
  const tonight = D.homeTonight(G.run);
  const c = D.costs(G.run, G.day);
  const buys = { heat: false, food: false, med: {}, tuition: false, doctor: null };
  // 默认：付得起就先勾暖气、饭，再给病人买药（玩家自己取舍）
  let left = G.run.money - c.rent;
  if (left >= c.heat) { buys.heat = true; left -= c.heat; }
  if (left >= c.food) { buys.food = true; left -= c.food; }
  D.needsMed(G.run).forEach((id) => {
    const p = id === 'nan' ? c.medNan : c.med;
    if (left >= p) { buys.med[id] = true; left -= p; }
  });
  G.home = { tonight, buys, costs: c, phase: 'choose', report: null, nt: 0, flyFx: {} };
  U.setMode('home');
  sfx.door();
}
function spent() {
  const h = G.home;
  const c = h.costs;
  let s = c.rent;
  if (h.buys.heat) s += c.heat;
  if (h.buys.food) s += c.food;
  Object.keys(h.buys.med).forEach((id) => { if (h.buys.med[id]) s += id === 'nan' ? c.medNan : c.med; });
  if (h.buys.tuition) s += c.tuition;
  return s;
}
function toggle(key, id) {
  const h = G.home;
  const c = h.costs;
  const b = h.buys;
  const price = key === 'med' ? (id === 'nan' ? c.medNan : c.med) : c[key];
  const on = key === 'med' ? !!b.med[id] : !!b[key];
  if (on) {
    if (key === 'med') b.med[id] = false;
    else b[key] = false;
    sfx.unmark();
    return;
  }
  if (G.run.money - spent() < price) {
    sfx.nope();
    U.toast('钱不够', C.red, G.homeLay.togY - 14);
    G.shake = 3;
    return;
  }
  if (key === 'med') b.med[id] = true;
  else b[key] = true;
  sfx.coin();
  if (key === 'heat') sfx.lamp();
  h.flyFx[key + (id || '')] = G.t;
  const tgt = G.homeLay.targets[key === 'med' ? 'med_' + id : key];
  if (tgt) U.flyMoney(G.homeLay.walletX, G.homeLay.walletY, 3, { tx: tgt[0], ty: tgt[1], out: true, gap: 0.05 });
}
function callDoctor(id) {
  U.flow.ad('doctor', () => {
    G.home.buys.doctor = id;
    sfx.better();
    U.toast('夜诊医生来过了', C.teal, G.homeLay.togY - 14);
  });
}
function sleepNow() {
  const h = G.home;
  h.report = D.sleep(G.run, G.day, h.buys);
  h.phase = 'night';
  h.nt = 0;
  h.seen = {};
  sfx.lamp();
  sfx.lullaby();
}
function updateHome(dt) {
  const h = G.home;
  if (h.phase === 'choose') {
    G.moneyTarget = G.run.money - spent();
    return;
  }
  h.nt += dt;
  G.moneyTarget = G.run.money;
  const ch = h.report.changes;
  ch.forEach((c, i) => {
    const at = 1.0 + i * 0.75;
    if (h.nt >= at && !h.seen[c.id]) {
      h.seen[c.id] = true;
      if (c.died) sfx.candle();
      else if (c.after === data.words.sick || c.after === data.words.grave) sfx.cough();
      else if (c.after === data.words.hungry) sfx.growl();
      else if (c.after === data.words.cold) sfx.wind();
      else if (c.before && !c.after) sfx.better();
    }
  });
  const incAt = 1.0 + ch.length * 0.75;
  h.report.income.forEach((inc, i) => {
    const at = incAt + i * 0.9;
    const k = 'inc' + i;
    if (h.nt >= at && !h.seen[k]) {
      h.seen[k] = true;
      if (inc.who === 'man') sfx.door();
      const seat = G.homeLay.seats[inc.who];
      if (seat) {
        U.flyMoney(seat[0], seat[1] + 30, 4, { tx: G.homeLay.walletX, ty: G.homeLay.walletY, gap: 0.1, delay: 0.4 });
        U.float('+¥' + inc.money, seat[0], seat[1] - 10, C.yellow, 16);
      }
    }
  });
  h.doneAt = incAt + h.report.income.length * 0.9 + 0.6;
}

const WORD_COL = { 冷: '#7fb8ff', 饿: '#ffb04a', 病: '#ff7aa8', 重病: '#ff4a3a' };

// 小屋：灯、炉子、窗外的雪、桌上的碗和药、每人头上一个字
function drawHouse(x, y, w, h) {
  const hm = G.home;
  const night = hm.phase === 'night';
  const heat = hm.buys.heat || !!G.day.gifts.heat;
  const food = hm.buys.food || !!G.day.gifts.food;
  const t = G.t;
  const lay = { seats: {}, targets: {} };
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = heat ? '#4a3040' : '#2a3048';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = heat ? '#3e2836' : '#232840';
  for (let i = 0; i < 6; i++) ctx.fillRect(x + i * 64 + 20, y, 3, h);
  const floorY = y + h - 30;
  ctx.fillStyle = '#3a2a22';
  ctx.fillRect(x, floorY, w, 30);
  ctx.fillStyle = '#2a1e18';
  for (let i = 0; i < 8; i++) ctx.fillRect(x + i * 48, floorY + 10, 30, 2);
  // 窗：夜、月亮、雪
  const wx = x + 24;
  const wy = y + 18;
  A.block(ctx, wx, wy, 84, 62, '#141c34', null, { outline: 3 });
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(wx + 62, wy + 18, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8e4f0';
  for (let i = 0; i < 14; i++) {
    const sx = (i * 23 + t * 8 * (1 + (i % 3))) % 84;
    const sy = (i * 17 + t * 22 * (1 + (i % 2))) % 62;
    ctx.fillRect(wx + sx, wy + sy, 2, 2);
  }
  if (!heat) {
    ctx.fillStyle = 'rgba(200,230,255,0.25)';
    ctx.fillRect(wx, wy + 48, 84, 14);
    ctx.fillRect(wx, wy, 10, 62);
  }
  ctx.fillStyle = C.ink;
  ctx.fillRect(wx + 40, wy, 3, 62);
  ctx.fillRect(wx, wy + 30, 84, 3);
  // 炉子
  const sx = x + 8;
  const sy = floorY - 76;
  A.block(ctx, sx, sy, 36, 76, '#3a3440', '#2a2430', { shadeH: 8 });
  A.block(ctx, sx + 6, sy + 40, 24, 22, heat ? '#2a1010' : '#141018', null, { outline: 2 });
  if (heat) {
    for (let i = 0; i < 3; i++) {
      const fh = 8 + Math.abs(Math.sin(t * 9 + i * 2)) * 10;
      ctx.fillStyle = i === 1 ? C.yellow : '#ff7a2a';
      ctx.fillRect(sx + 9 + i * 7, sy + 60 - fh, 5, fh);
    }
  } else {
    ctx.fillStyle = 'rgba(200,230,255,0.4)';
    ctx.fillRect(sx + 2, sy + 2, 32, 3);
  }
  ctx.fillStyle = '#2a2430';
  ctx.fillRect(sx + 14, y, 8, sy - y);
  lay.targets.heat = [sx + 18, sy + 50];
  // 架子：学费罐、阿圆的相框、外婆的旧证
  const shx = x + w - 120;
  const shy = y + 54;
  ctx.fillStyle = '#5a3e2e';
  ctx.fillRect(shx, shy, 110, 6);
  const items = hm.tonight.items;
  if (G.run.dayIdx >= 1) {
    A.icon(ctx, 'jar', shx + 16, shy - 12, 2.5);
    const lvl = clamp(G.run.tuition / 300, 0, 1);
    ctx.fillStyle = C.yellow;
    ctx.fillRect(shx + 8, shy - 4 - lvl * 12, 16, lvl * 12);
    lay.targets.tuition = [shx + 16, shy - 12];
  }
  if (!hm.tonight.weekend) {
    A.block(ctx, shx + 40, shy - 30, 24, 28, '#c9a46a', '#8a6a3a', { shadeH: 3, outline: 1 });
    A.portrait(ctx, famFace('yuan'), shx + 43, shy - 27, 1, { tone: 'pale' });
  }
  if (items.indexOf('oldpass') >= 0) {
    ctx.save();
    ctx.translate(shx + 88, shy - 9);
    ctx.rotate(0.12);
    A.icon(ctx, 'oldpass', 0, 0, 2);
    ctx.restore();
  }
  if (items.indexOf('yuanpass') >= 0) {
    A.icon(ctx, 'yuanpass', shx + 52, shy + 26, 2);
  }
  // 门（小满晚归从这里进来）
  const dx = x + w - 40;
  const dy = floorY - 96;
  const late = hm.tonight.late;
  const manIn = !late || (night && hm.nt >= 1.0 + hm.report.changes.length * 0.75);
  const doorOpen = late && night && Math.abs(hm.nt - (1.0 + hm.report.changes.length * 0.75)) < 0.8;
  A.block(ctx, dx, dy, 34, 96, doorOpen ? '#0a0810' : '#5a3a28', '#3a2418', { shadeH: 6 });
  if (!doorOpen) {
    ctx.fillStyle = C.yellow;
    ctx.fillRect(dx + 6, dy + 50, 4, 4);
  }
  if (items.indexOf('shoes') >= 0) A.icon(ctx, 'shoes', dx - 6, floorY + 10, 2);
  // 灯
  const lampX = x + w / 2;
  ctx.fillStyle = C.ink;
  ctx.fillRect(lampX - 1, y, 2, 34);
  const on = !night || hm.nt < 0.4;
  const glowR = on ? (heat ? 120 : 60) : 0;
  if (glowR) {
    const flick = heat ? 1 : 0.8 + 0.2 * Math.sin(t * 17) * Math.sin(t * 5);
    for (let i = 4; i >= 1; i--) {
      ctx.fillStyle = 'rgba(255,220,140,' + (0.05 * flick).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(lampX, y + 42, (glowR * i) / 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  A.block(ctx, lampX - 16, y + 32, 32, 12, on ? (heat ? '#ffd23f' : '#a88a3a') : '#3a3440', null, { outline: 2 });
  // 家里人 + 桌子
  const mem = hm.tonight.members;
  const tx0 = x + 52;
  const tw = w - 104;
  const tableY = floorY - 40;
  const cell = mem.length <= 3 && h >= 320 ? 4 : 3;
  mem.forEach((m, i) => {
    const cx = tx0 + ((i + 0.5) * tw) / mem.length;
    const ptop = tableY - 17 * cell;
    lay.seats[m.id] = [cx, ptop];
    const st = G.run.fam[m.id];
    const ch = night ? hm.report.changes.find((c) => c.id === m.id) : null;
    const revealed = ch && hm.seen && hm.seen[m.id];
    const dead = night ? st.dead && (revealed || !ch || !ch.died) : st.dead;
    const dying = ch && ch.died && revealed;
    const wordNow = night ? (ch ? (revealed ? ch.after : ch.before) : D.word(st)) : m.word;
    const absent = m.late && !manIn;
    // 椅背
    A.block(ctx, cx - 9 * cell, ptop + 2 * cell, 18 * cell, 20 * cell, '#6a4a32', '#4a3222', { shadeH: 6 });
    if (absent) {
      A.icon(ctx, 'schoolbag', cx, ptop + 34, 2.5);
    } else if (!dead || dying) {
      const fadeK = dying ? clamp((hm.nt - (1.0 + hm.report.changes.indexOf(ch) * 0.75)) / 1.2, 0, 1) : 0;
      if (!(dead && fadeK >= 1)) {
        const grave = (wordNow === data.words.grave);
        ctx.save();
        const worse = grave && st.sick >= 3 && (!night || revealed);
        ctx.globalAlpha = (grave ? (worse ? 0.35 : 0.55) : 1) * (1 - fadeK);
        const sleepy = night && hm.nt > 0.5;
        A.portrait(ctx, famFace(m.id), cx - (face.W * cell) / 2, ptop + (wordNow ? 2 : 0), cell, {
          blink: sleepy || (t + i * 1.3) % 3.2 < 0.13, headDy: Math.round(Math.sin(t * 2 + i) * 1), tone: grave ? 'pale' : null,
          mood: wordNow === data.words.sick || grave || wordNow === data.words.hungry ? 'sad' : null,
        });
        ctx.restore();
        if (wordNow === data.words.cold && !night) {
          // 冷得发抖：呼出白气
          ctx.fillStyle = 'rgba(220,235,255,' + (0.4 + 0.3 * Math.sin(t * 3 + i)).toFixed(2) + ')';
          ctx.fillRect(cx + 10 + ((t * 10) % 6), ptop + 38 - ((t * 8) % 6), 4, 3);
        }
      }
    }
    // 一个字
    if (wordNow && !(dead && !dying) && !absent) {
      const pop = night && revealed ? easeOut(clamp((hm.nt - (1.0 + hm.report.changes.indexOf(ch) * 0.75)) / 0.2, 0, 1)) : 1;
      ctx.save();
      ctx.translate(cx, ptop - 12);
      ctx.scale(pop, pop);
      ctx.font = '900 14px sans-serif';
      const bw = ctx.measureText(wordNow).width + 14;
      A.block(ctx, -bw / 2, -10, bw, 20, '#1a1424', null, { outline: 2 });
      A.text(ctx, wordNow, 0, 0, 14, WORD_COL[wordNow] || C.white, 'center', '900');
      ctx.restore();
    }
    lay.targets['med_' + m.id] = [cx + 18, tableY - 6];
  });
  // 桌子
  A.block(ctx, tx0 - 10, tableY, tw + 20, 14, '#8a5a3a', '#6a4228', { shadeH: 4, hi: '#a8744e' });
  ctx.fillStyle = '#5a3a24';
  ctx.fillRect(tx0, tableY + 14, 8, floorY - tableY - 14);
  ctx.fillRect(tx0 + tw - 8, tableY + 14, 8, floorY - tableY - 14);
  lay.targets.food = [x + w / 2, tableY - 4];
  mem.forEach((m, i) => {
    const cx = tx0 + ((i + 0.5) * tw) / mem.length;
    const st = G.run.fam[m.id];
    const ch = night ? hm.report.changes.find((c) => c.id === m.id) : null;
    const goneNow = st.dead && (!night || !ch || !ch.died || (hm.seen && hm.seen[m.id]));
    if (goneNow) {
      A.icon(ctx, 'candle', cx, tableY - 8 + 0, 2);
      if (Math.sin(t * 9 + i) > 0) {
        ctx.fillStyle = C.yellow;
        ctx.fillRect(cx - 1, tableY - 22, 2, 2);
      }
      return;
    }
    // 碗：买了饭冒热气，没买是空碗
    ctx.fillStyle = C.ink;
    ctx.fillRect(cx - 12, tableY - 7, 24, 8);
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(cx - 11, tableY - 6, 22, 6);
    if (food) {
      ctx.fillStyle = '#f4f0e8';
      ctx.fillRect(cx - 9, tableY - 9, 18, 3);
      if (!night && Math.sin(t * 2 + i) > -0.3) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(cx - 3 + Math.sin(t * 3 + i) * 2, tableY - 18 - ((t * 10) % 6), 2, 5);
      }
    }
    if (hm.buys.med[m.id]) A.icon(ctx, 'medbottle', cx + 20, tableY - 8, 1.5);
    if (m.id === 'man' && items.indexOf('brochure') >= 0 && items.indexOf('fakepass') < 0) A.icon(ctx, 'brochure', cx - 24, tableY - 5, 1.3);
    if (m.id === 'man' && items.indexOf('fakepass') >= 0) A.icon(ctx, 'fakepass', cx - 24, tableY - 5, 1.5);
  });
  // 没暖气：整屋暗、冷色；夜里：熄灯
  if (!heat) {
    ctx.fillStyle = 'rgba(10,20,50,0.28)';
    ctx.fillRect(x, y, w, h);
  }
  if (night) {
    const dk = clamp(hm.nt / 0.6, 0, 1) * 0.55;
    ctx.fillStyle = 'rgba(4,4,14,' + dk.toFixed(2) + ')';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(180,200,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(wx, wy + 62);
    ctx.lineTo(wx + 84, wy + 62);
    ctx.lineTo(wx + 160, floorY);
    ctx.lineTo(wx + 40, floorY);
    ctx.fill();
    if (hm.nt > 0.8) A.text(ctx, 'z', lampX + 30 + Math.sin(t) * 3, y + 70 - ((t * 12) % 20), 14, 'rgba(255,255,255,0.4)', 'center', '900');
  }
  ctx.restore();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  return lay;
}

function drawHome() {
  ctx.fillStyle = '#0a0812';
  ctx.fillRect(0, 0, L.W, L.H);
  const hm = G.home;
  const houseH = clamp(Math.round(L.H * 0.44), 236, 360);
  const hx = 10;
  const hy = 30;
  const hw = L.W - 20;
  A.text(ctx, '第 ' + (G.day.idx + 1) + ' 天 · 夜', 14, 16, 13, C.yellow, 'left', '900');
  const lay = drawHouse(hx, hy, hw, houseH);
  const capY = hy + houseH + 16;
  // 钱包
  const wy = capY + 14;
  lay.walletX = 44;
  lay.walletY = wy;
  G.walletPos = { x: 44, y: wy };
  ctx.save();
  ctx.translate(44, wy);
  ctx.scale(0.62, 0.62);
  A.wallet(ctx, 0, 0, G.moneyShown, G.walletBump);
  ctx.restore();
  A.text(ctx, '¥ ' + Math.round(G.moneyShown), 76, wy - 2, 20, G.moneyShown < 0 ? C.red : C.yellow, 'left', '900');
  if (hm.phase === 'choose') A.text(ctx, '房租 −' + hm.costs.rent + '（必付）', L.W - 14, wy - 2, 11, C.grey, 'right', '800');
  lay.togY = wy + 26;
  G.homeLay = lay;
  if (hm.phase === 'choose') drawChoices(lay);
  else drawNightText(lay);
}

function drawChoices(lay) {
  const hm = G.home;
  const c = hm.costs;
  const opts = [];
  opts.push({ key: 'heat', label: data.homeItems.heat, price: c.heat, on: hm.buys.heat, icon: 'coal', gift: !!G.day.gifts.heat });
  opts.push({ key: 'food', label: data.homeItems.food, price: c.food, on: hm.buys.food, icon: 'bowl', gift: !!G.day.gifts.food });
  D.needsMed(G.run).forEach((id) => {
    opts.push({ key: 'med', id, label: '药 · ' + data.family[id].name, price: id === 'nan' ? c.medNan : c.med, on: !!hm.buys.med[id], icon: 'medbottle', deal: id === 'nan' && D.dealActive(G.run) });
  });
  if (G.run.dayIdx >= 1) opts.push({ key: 'tuition', label: data.homeItems.tuition, price: c.tuition, on: hm.buys.tuition, icon: 'jar', sub: '¥' + G.run.tuition + ' / 300' });
  const graves = ['nan', 'man', 'dou'].filter((id) => G.run.fam[id] && !G.run.fam[id].dead && G.run.fam[id].sick >= 2);
  const docLeft = config.doctorPerChapter - (G.run.doctorUsed[D.chapter(G.run)] || 0);
  const bw = (L.W - 28) / 2;
  const bh = 42;
  const rows = Math.ceil((opts.length + (graves.length && docLeft > 0 && !hm.buys.doctor ? 1 : 0)) / 2);
  const gapY = Math.min(8, Math.max(4, Math.floor((L.H - 80 - lay.togY - rows * bh) / Math.max(1, rows))));
  opts.forEach((o, i) => {
    const x = 10 + (i % 2) * (bw + 8);
    const y = lay.togY + Math.floor(i / 2) * (bh + gapY);
    const id = 'buy_' + o.key + (o.id || '');
    const down = G.pressed === id ? 2 : 0;
    const fresh = hm.flyFx[o.key + (o.id || '')] && G.t - hm.flyFx[o.key + (o.id || '')] < 0.25;
    A.block(ctx, x, y + down, bw, bh, o.on ? '#2e4a36' : '#3a2230', o.on ? '#22382a' : '#2a1824', { shadeH: 4, hi: fresh ? C.yellow : null });
    A.icon(ctx, o.icon, x + 20, y + bh / 2 + down, 2);
    A.text(ctx, o.label, x + 38, y + 14 + down, 13, C.white, 'left', '900');
    const sub = o.gift ? '有人送了' : o.deal ? '半价（药贩）' : o.sub || '';
    A.text(ctx, o.gift ? '¥0' : '¥' + o.price, x + 38, y + 30 + down, 12, C.yellow, 'left', '900');
    if (sub) A.text(ctx, sub, x + 74, y + 30 + down, 9, o.deal ? C.pink : C.grey, 'left', '700');
    A.block(ctx, x + bw - 30, y + 10 + down, 22, 22, o.on ? C.green : '#1a1424', null, { outline: 2 });
    if (o.on) A.text(ctx, '✓', x + bw - 19, y + 21 + down, 15, C.ink, 'center', '900');
    G.buttons.push({ id, x, y, w: bw, h: bh, fn: () => (o.gift ? U.toast('今晚有人送了', C.teal, lay.togY - 14) : toggle(o.key, o.id)) });
  });
  if (graves.length && docLeft > 0 && !hm.buys.doctor) {
    const i = opts.length;
    const x = 10 + (i % 2) * (bw + 8);
    const y = lay.togY + Math.floor(i / 2) * (bh + gapY);
    U.button('doctor', x, y, bw, bh, '夜诊医生', C.teal, '#1f9e93', () => callDoctor(graves[0]), { size: 13, sub: '▶ 重病→病 · 本章 1 次', subSize: 9 });
  }
  U.button('sleep', 40, L.H - 70, L.W - 80, 56, '睡 觉', '#6a5acd', '#4a3a9d', sleepNow, { color: C.white, size: 21 });
}

function drawNightText(lay) {
  const hm = G.home;
  const y = lay.togY + 4;
  const lines = [];
  hm.report.changes.forEach((c) => {
    if (!hm.seen[c.id]) return;
    if (c.died) lines.push({ t: data.family[c.id].name + '的椅子空了。', col: C.pink });
  });
  if (hm.tonight.caption && hm.nt > 1.2) lines.push({ t: hm.tonight.caption, col: '#c8c0d8' });
  hm.report.income.forEach((inc, i) => {
    if (!hm.seen['inc' + i]) return;
    lines.push({ t: inc.who === 'man' ? '小满回来了。桌上多了 ¥' + inc.money + '。' : '阿圆回家了，带回 ¥' + inc.money + '。', col: C.yellow });
  });
  if (hm.report.debt) lines.push({ t: G.run.over ? '房东换了锁。' : '欠了房租。房东来敲过门。', col: C.red });
  lines.forEach((l, i) => A.text(ctx, l.t, L.W / 2, y + i * 24, 14, l.col, 'center', '800'));
  if (hm.nt > (hm.doneAt || 2)) {
    const last = G.run.dayIdx >= D.DAYS - 1 || D.chapterJustEnded(G.run);
    A.text(ctx, '天亮了 · 点一下' + (G.run.over ? '' : last ? '' : ' · 第 ' + (G.day.idx + 2) + ' 天'), L.W / 2, L.H - 40, 13, C.grey, 'center', '800');
  }
}

// ================= 章节卡 =================
function enterChapter(ch) {
  G.chap = { ch, page: 0 };
  U.setMode('chapter');
  sfx.fanfare();
  G.shake = 8;
}
function drawChapter() {
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(0, 0, L.W, L.H);
  const ch = G.chap.ch;
  const info = story.chapterEnd[ch];
  const run = G.run;
  const s = run.stats;
  A.bigText(ctx, info.title, L.W / 2, 50, 26, C.yellow);
  const k = clamp((G.modeT - 0.2) / 0.15, 0, 1);
  if (k > 0) {
    ctx.save();
    ctx.translate(L.W / 2 + 120, 50);
    ctx.rotate(-0.2);
    ctx.scale(lerp(2.5, 1, k), lerp(2.5, 1, k));
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 3;
    ctx.strokeRect(-24, -16, 48, 32);
    A.text(ctx, '完', 0, 0, 20, C.red, 'center', '900');
    ctx.restore();
  }
  if (G.chap.page === 0) {
    const acc = s.total ? Math.round((s.correct / s.total) * 100) : 0;
    A.block(ctx, 16, 80, L.W - 32, 56, '#2a2236', '#201a2b', { shadeH: 4 });
    A.text(ctx, '查了 ' + s.total + ' 人 · 判对 ' + acc + '% · 查实 ' + s.evidence, L.W / 2, 98, 13, C.white, 'center', '900');
    A.text(ctx, '存款 ¥' + run.money + (s.bribes ? ' · 收过 ¥' + s.bribes : ' · 一分没收') + ' · 罚单 ' + s.fines, L.W / 2, 120, 13, C.yellow, 'center', '900');
    A.text(ctx, '那些人', 20, 156, 12, C.grey, 'left', '800');
    const fs = D.fates(run, ch);
    const rowH = Math.min(40, Math.floor((L.H - 250) / Math.max(1, fs.length)));
    fs.forEach((f, i) => {
      const y = 170 + i * rowH;
      const kk = clamp((G.modeT - 0.4 - i * 0.15) / 0.2, 0, 1);
      ctx.globalAlpha = kk;
      A.portrait(ctx, whoFace(f.who), 22, y, Math.min(1.6, rowH / 24), {});
      A.text(ctx, story.people[f.who].name, 58, y + rowH * 0.32, 13, C.teal, 'left', '900');
      A.text(ctx, f.line, 58, y + rowH * 0.32 + 16, 12, C.white, 'left', '800');
      ctx.globalAlpha = 1;
    });
    U.button('next', 40, L.H - 74, L.W - 80, 58, '家 里 →', '#8b8496', '#615a6c', () => { G.chap.page = 1; sfx.paper(); }, { color: C.white, size: 18 });
    return;
  }
  // 第二页：家里、伏笔、解锁
  let y = 84;
  A.text(ctx, '家里', 20, y, 12, C.grey, 'left', '800');
  y += 12;
  const ids = ['nan', 'man', 'yuan', 'dou'].filter((id) => run.fam[id]);
  ids.forEach((id, i) => {
    const x = 20 + i * 86;
    const m = run.fam[id];
    if (m.dead) {
      A.block(ctx, x + 8, y + 10, 52, 56, '#3a2a22', '#2a1e18', { shadeH: 5 });
      A.icon(ctx, 'candle', x + 34, y + 40, 2.5);
    } else A.portrait(ctx, famFace(id), x + 7, y, 3, { blink: (G.t + i) % 3 < 0.12, tone: m.sick >= 2 ? 'pale' : null });
    const w = D.word(m);
    A.text(ctx, data.family[id].name + (m.dead ? ' · 不在了' : w ? ' · ' + w : ''), x + 34, y + 78, 11, m.dead ? C.pink : w ? WORD_COL[w] : C.white, 'center', '900');
  });
  y += 100;
  if (ch === 2) {
    A.text(ctx, '家里的事，一件件走近窗口', 20, y, 12, C.grey, 'left', '800');
    y += 14;
    story.foreshadow.forEach((f, i) => {
      const gone = run.fam[f.who] && run.fam[f.who].dead;
      const line = gone ? f.gone : f.line;
      if (!line) return;
      const kk = clamp((G.modeT - 0.2 - i * 0.3) / 0.3, 0, 1);
      ctx.globalAlpha = kk;
      if (gone) A.icon(ctx, 'candle', 34, y + 16, 2);
      else A.portrait(ctx, famFace(f.who), 20, y, 1.4, {});
      U.wrap(line, 18).forEach((l, j) => A.text(ctx, l, 52, y + 14 + j * 16, 13, C.white, 'left', '800'));
      ctx.globalAlpha = 1;
      y += 38;
    });
  } else {
    if (run.flags.man_errand) {
      A.portrait(ctx, famFace('man'), 20, y, 1.4, {});
      A.text(ctx, '小满开始晚回家了。', 52, y + 14, 13, C.white, 'left', '800');
      y += 38;
    }
  }
  y += 6;
  const ub = Math.min(y, L.H - 74 - 16 - 70);
  A.block(ctx, 16, ub, L.W - 32, 62, '#3a3050', '#2a2238', { shadeH: 4 });
  A.text(ctx, ch === 1 ? '解锁' : '下一章', 28, ub + 14, 11, C.teal, 'left', '900');
  info.unlock.forEach((l, i) => A.text(ctx, l, 28, ub + 32 + i * 18, 13, C.yellow, 'left', '900'));
  if (ch === 1) U.button('ch2go', 40, L.H - 74, L.W - 80, 58, '进入第 2 章', C.green, C.greenS, U.flow.afterChapter, { color: C.white, size: 20 });
  else U.button('totitle', 40, L.H - 74, L.W - 80, 58, '回到开场', '#8b8496', '#615a6c', U.flow.afterChapter, { color: C.white, size: 18 });
}

// ================= 被赶出门 =================
function drawOver() {
  ctx.fillStyle = '#0a0812';
  ctx.fillRect(0, 0, L.W, L.H);
  A.bigText(ctx, '房东换了锁', L.W / 2, L.H * 0.3, 32, C.pink);
  A.text(ctx, '连着两晚付不起房租。', L.W / 2, L.H * 0.3 + 44, 14, C.white, 'center', '800');
  A.text(ctx, '少收一点、少罚一点、挑着买。', L.W / 2, L.H * 0.3 + 68, 13, C.grey, 'center', '700');
  A.icon(ctx, 'house', L.W / 2, L.H * 0.3 + 120, 6);
  U.button('retry', 40, L.H - 140, L.W - 80, 56, '从今天早上重来', C.green, C.greenS, U.flow.continueRun, { color: C.white, size: 18 });
  U.button('totitle2', 40, L.H - 74, L.W - 80, 50, '回到开场', '#8b8496', '#615a6c', () => U.setMode('title'), { color: C.white, size: 16 });
}

// ================= 广告占位 =================
const AD_LABEL = { file: '调出这个人的档案', overtime: '加班：多查几个人', double: '今天的工资翻倍', appeal: '撤掉一张罚单', doctor: '请夜诊医生' };
function drawAd() {
  U.dim(0.92);
  const st = platform.adState();
  const k = st ? st.progress : 1;
  const y = L.H / 2;
  A.block(ctx, 40, y - 80, L.W - 80, 160, '#1a1424', '#120c18', { shadeH: 6 });
  A.text(ctx, '广告占位（激励视频）', L.W / 2, y - 40, 16, C.white, 'center', '900');
  A.text(ctx, '看完：' + (AD_LABEL[G.adFor] || ''), L.W / 2, y - 10, 12, C.grey, 'center', '700');
  A.block(ctx, 70, y + 20, L.W - 140, 14, '#2a2236', null);
  ctx.fillStyle = C.teal;
  ctx.fillRect(70, y + 20, (L.W - 140) * k, 14);
  A.text(ctx, st ? Math.ceil(st.leftSec * 10) / 10 + ' 秒' : '', L.W / 2, y + 54, 11, C.grey, 'center', '700');
}

module.exports = {
  drawTitle, enterPaper, updatePaper, drawPaper, drawCard, enterSlip, updateSlip, drawSlip, goHome,
  enterHome, updateHome, drawHome, sleepNow, enterChapter, drawChapter, drawOver, drawAd, toggle, slipAd,
};
