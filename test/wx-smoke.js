// 假装成微信小游戏环境跑 game.js：没有 document、没有 window，只有 wx。
// 能跑完 = 代码里没偷偷用网页才有的东西。用法：node test/wx-smoke.js
// 走一遍：开场「上岗」→ 报纸「上班」→ 拖一根线（照片 → 脸）→ 放行盖章 → 存档在不在
const path = require('path');
const calls = new Set();
const ctx = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'measureText') return (s) => ({ width: String(s).length * 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    return (...a) => { calls.add(k); };
  },
  set(t, k, v) { t[k] = v; return true; },
});
const handlers = {};
const store = {};
const frames = [];
let vib = 0;
global.wx = {
  createCanvas: () => ({ width: 0, height: 0, getContext: () => ctx }),
  getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 3 }),
  onTouchStart: (f) => (handlers.down = f),
  onTouchMove: (f) => (handlers.move = f),
  onTouchEnd: (f) => (handlers.up = f),
  onTouchCancel: () => {},
  vibrateShort: () => { vib++; },
  getStorageSync: (k) => store[k] || '',
  setStorageSync: (k, v) => { store[k] = v; },
};
global.requestAnimationFrame = (f) => frames.push(f);
if (typeof global.document !== 'undefined' || typeof global.window !== 'undefined') throw new Error('环境不干净');

const root = path.join(__dirname, '..');
require(path.join(root, 'game.js'));
// 同一份模块（require 有缓存），测试能直接看游戏状态
const U = require(path.join(root, 'js/ui.js'));
const W = require(path.join(root, 'js/scene_work.js'));
const G = U.G;
const sleep = (ms) => { const e = Date.now() + ms; while (Date.now() < e); };
const run = (n) => { for (let i = 0; i < n; i++) { sleep(16); const f = frames.shift(); if (f) f(); } };
const until = (fn, max) => { for (let i = 0; i < (max || 400); i++) { if (fn()) return true; run(1); } return false; };
const S = U.scale;
const touch = (type, id, x, y) => handlers[type]({ changedTouches: [{ identifier: id, clientX: x * S, clientY: y * S }] });
const tapBtn = (bid) => {
  const b = G.buttons.find((x) => x.id === bid);
  if (!b) throw new Error('找不到按钮 ' + bid + '（' + G.mode + '）');
  touch('down', 1, b.x + b.w / 2, b.y + b.h / 2);
  touch('up', 1, b.x + b.w / 2, b.y + b.h / 2);
  run(2);
};

run(3);
tapBtn('start');
if (!until(() => G.mode === 'paper' && G.modeT > 0.6)) throw new Error('没进报纸');
tapBtn('go');
G.timeScale = 4;
if (!until(() => G.mode === 'work' && G.ph === 'check')) throw new Error('人没走到窗口');
G.timeScale = 1;
// 拖一根线：照片 → 脸
const a = W.center('id.photo');
const b = W.center('face');
touch('down', 2, a[0], a[1]);
for (let k = 1; k <= 8; k++) touch('move', 2, a[0] + ((b[0] - a[0]) * k) / 8, a[1] + ((b[1] - a[1]) * k) / 8);
touch('up', 2, b[0], b[1]);
run(2);
if (G.lines.length !== 1) throw new Error('拖了一下却没有一根线（' + G.lines.length + '）');
const kind = G.lines[0].kind;
tapBtn('pass');
if (!until(() => G.day.ledger.n === 1, 120)) throw new Error('放行没盖章');
console.log('微信环境跑通：画图调用 ' + calls.size + ' 种，拉线 1 根（' + kind + '），盖章 1 个，震动 ' + vib + ' 次，存档 ' + Object.keys(store).join(','));
if (!calls.has('fillRect') || !calls.has('fillText')) throw new Error('没画出东西');
if (vib < 1) throw new Error('盖章没震动');
if (!store.fangxing_v2) throw new Error('没存档');
