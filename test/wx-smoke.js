// 假装成微信小游戏环境跑 game.js：没有 document、没有 window，只有 wx。
// 能跑完 = 代码里没偷偷用网页才有的东西。用法：node test/wx-smoke.js
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
let frames = [];
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

require(path.join(__dirname, '..', 'game.js'));
const run = (n) => { for (let i = 0; i < n; i++) { const f = frames.shift(); if (f) f(); } };
const sleep = (ms) => { const e = Date.now() + ms; while (Date.now() < e); };
run(5);
const S = 390 / 375;
const tap = (x, y) => {
  handlers.down({ changedTouches: [{ identifier: 1, clientX: x * S, clientY: y * S }] });
  handlers.up({ changedTouches: [{ identifier: 1, clientX: x * S, clientY: y * S }] });
  run(3);
};
const H = 844 / S;
tap(187, H - 90); // 上岗
tap(187, H - 100); // 开窗
for (let i = 0; i < 60; i++) { sleep(16); run(1); } // 等人走到窗口
// 往右滑：放行
const y = 450;
handlers.down({ changedTouches: [{ identifier: 2, clientX: 100 * S, clientY: y * S }] });
for (let k = 1; k <= 8; k++) handlers.move({ changedTouches: [{ identifier: 2, clientX: (100 + k * 20) * S, clientY: y * S }] });
handlers.up({ changedTouches: [{ identifier: 2, clientX: 260 * S, clientY: y * S }] });
for (let i = 0; i < 40; i++) { sleep(16); run(1); }
console.log('微信环境跑通：画图调用 ' + calls.size + ' 种，震动 ' + vib + ' 次，存档 ' + Object.keys(store).length + ' 项');
if (!handlers.down || !calls.has('fillRect') || !calls.has('fillText')) throw new Error('没画出东西或没注册触摸');
if (vib < 1) throw new Error('滑动没盖章（没震动）');
if (!store.fangxing_v1) throw new Error('没存档');
