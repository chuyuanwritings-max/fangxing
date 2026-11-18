// 《放行》原型主程序：开场 → 每天（早上报纸 → 窗口查证 → 下班事件 → 工资条 → 回家挑谁先受苦 → 夜里）→ 第 6 天章节卡 → 第 2 章 → 第 12 天章节卡。
// 全部画在一张 canvas 上（微信小游戏没有 HTML 按钮）。每天早上自动存档，下次打开能「继续」。
//
// 画面（G.mode）：
//   title 开场 → paper 报纸 → work 查证（cite 罚单 / folder 档案 / ad 广告占位）→ closing 下班
//   → card 事件卡 → slip 工资条 → home 回家（choose 挑 → night 夜里）→ chapter 章节卡 / over 被赶出门
const platform = require('./platform.js');
const config = require('./config.js');
const D = require('./day.js');
const U = require('./ui.js');
const W = require('./scene_work.js');
const S = require('./scene_day.js');
const sfx = require('./sfx.js');

const { G, L, C, ctx, P, scale } = U;

G.save = platform.load(config.saveKey) || { plays: 0, run: null, unlocked2: false, ch2Start: null, cleared: 0 };
function persist() {
  platform.save(config.saveKey, G.save);
}
function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

// —— 流程 ——
function startDay() {
  // 每天早上先存档（开工前的样子），被赶出门或关掉游戏都从这里接着来
  G.save.run = D.snapshot(G.run);
  persist();
  G.day = D.startDay(G.run);
  G.cur = null;
  G.cameoT = null;
  G.tut = {};
  G.cardSlam = false;
  G.moneyShown = G.moneyTarget = G.run.money;
  S.enterPaper();
}

U.flow.startRun = () => {
  G.run = D.newRun(Math.floor(Math.random() * 1e9));
  G.save.plays = (G.save.plays || 0) + 1;
  startDay();
};
U.flow.continueRun = () => {
  const r = G.save.run && D.restore(clone(G.save.run));
  if (!r) return U.setMode('title');
  G.run = r;
  startDay();
};
U.flow.startCh2 = () => {
  const r = G.save.ch2Start && D.restore(clone(G.save.ch2Start));
  if (!r) return;
  G.run = r;
  G.save.plays = (G.save.plays || 0) + 1;
  startDay();
};
U.flow.toWork = () => W.openWindow();
U.flow.afterShift = () => {
  D.closeDay(G.run, G.day);
  nextCardOrSlip();
};
function nextCardOrSlip() {
  if (G.day.endShown < G.day.cards.length) {
    G.event = G.day.cards[G.day.endShown];
    G.day.endShown += 1;
    U.setMode('card');
    if (G.event.money > 0) {
      sfx.fanfare();
      G.shake = config.juice.bigShake;
      G.freeze = config.juice.bigHitstopSec;
    } else {
      sfx.bad();
      G.shake = config.juice.stampShake;
    }
    return;
  }
  S.enterSlip();
}
U.flow.afterNight = () => {
  if (G.run.over) {
    U.setMode('over');
    sfx.sad();
    return;
  }
  const ch = D.chapterJustEnded(G.run);
  if (ch) return S.enterChapter(ch);
  D.nextDay(G.run);
  startDay();
};
U.flow.afterChapter = () => {
  const ch = G.chap.ch;
  if (ch === 1) {
    D.nextDay(G.run);
    G.save.unlocked2 = true;
    G.save.ch2Start = D.snapshot(G.run);
    startDay();
  } else {
    G.save.cleared = (G.save.cleared || 0) + 1;
    G.save.run = null;
    persist();
    U.setMode('title');
  }
};
// 激励视频（占位）：看完回到原来的画面再给奖励
U.flow.ad = (kind, cb) => {
  G.adFor = kind;
  G.adBack = G.mode;
  U.setMode('ad');
  sfx.whoosh();
  platform.showRewardedAd(() => {
    G.mode = G.adBack;
    G.run.stats.ads[kind] = (G.run.stats.ads[kind] || 0) + 1;
    cb();
  });
};

// —— 输入：只认按下 / 移动 / 松开，按钮先判 ——
const touches = {};
const TAP_ANY = { cite: 0.4, card: 0.6, closing: 0.6 };
U.onTouch = (type, id, sx, sy) => {
  const x = sx / scale;
  const y = sy / scale;
  if (type === 'down') {
    platform.unlockAudio();
    G.ripples.push({ x, y, t: 0 });
    if (G.mode === 'ad' || G.mode === 'folder') {
      touches[id] = { role: 'none' };
      return;
    }
    const b = U.hitButton(x, y);
    if (b) {
      touches[id] = { role: 'btn', b };
      G.pressed = b.id;
      sfx.tap();
      return;
    }
    if (TAP_ANY[G.mode] !== undefined || G.mode === 'slip' || (G.mode === 'home' && G.home.phase === 'night')) {
      touches[id] = { role: 'any' };
      return;
    }
    if (W.modes.indexOf(G.mode) >= 0) {
      touches[id] = { role: 'work' };
      W.touch('down', id, x, y);
      return;
    }
    touches[id] = { role: 'none' };
  } else if (type === 'move') {
    const t = touches[id];
    if (t && t.role === 'work') W.touch('move', id, x, y);
  } else {
    const t = touches[id];
    delete touches[id];
    if (!t) return;
    if (t.role === 'btn') {
      G.pressed = null;
      const b = U.hitButton(x, y);
      if (b && b.id === t.b.id) {
        sfx.button();
        t.b.fn();
      }
    } else if (t.role === 'work') W.touch('up', id, x, y);
    else if (t.role === 'any') tapAny();
  }
};
function tapAny() {
  const m = G.mode;
  if (TAP_ANY[m] !== undefined && G.modeT < TAP_ANY[m]) return;
  if (m === 'cite') W.closeCite();
  else if (m === 'card') nextCardOrSlip();
  else if (m === 'closing') U.flow.afterShift();
  else if (m === 'slip') {
    const s = G.slip;
    if (s.shown < s.lines.length) s.t = 0.4 + s.lines.length * config.anim.slipLineSec;
  } else if (m === 'home' && G.home.phase === 'night' && G.home.nt > (G.home.doneAt || 2)) U.flow.afterNight();
}

// —— 更新 ——
function update(dtReal) {
  U.update(dtReal);
  if (G.freeze > 0) {
    G.freeze -= dtReal;
    return;
  }
  const dt = dtReal * G.timeScale;
  G.t += dt;
  G.modeT += dt;
  G.phT += dt;
  const m = G.mode;
  if (W.modes.indexOf(m) >= 0) {
    W.update(dt);
    if (G.run && G.day) G.moneyTarget = G.run.money + D.income(G.day);
  } else if (m === 'paper') S.updatePaper();
  else if (m === 'slip') S.updateSlip(dt);
  else if (m === 'home') S.updateHome(dt);
}

// —— 画 ——
function drawScene(m) {
  if (m === 'title') S.drawTitle();
  else if (m === 'paper') S.drawPaper();
  else if (W.modes.indexOf(m) >= 0) W.draw();
  else if (m === 'card') S.drawCard();
  else if (m === 'slip') S.drawSlip();
  else if (m === 'home') S.drawHome();
  else if (m === 'chapter') S.drawChapter();
  else if (m === 'over') S.drawOver();
}
function render() {
  ctx.setTransform(P.canvas.width / L.W, 0, 0, P.canvas.width / L.W, 0, 0);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, L.W, L.H);
  G.buttons = [];
  ctx.save();
  if (G.shake > 0.3) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  drawScene(G.mode === 'ad' ? G.adBack : G.mode);
  if (G.mode === 'ad') {
    G.buttons = [];
    S.drawAd();
  }
  U.drawFx();
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

platform.exposeForTest('__fx', { G, D, U, W, S, config, L, LY: U.LY, scale, flow: U.flow, persist });
platform.nextFrame(frame);
