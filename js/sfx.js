// 音效：全部用 WebAudio 现场合成（走 platform.tone / platform.noise）。越大的事越响、越长。
const P = require('./platform.js');

module.exports = {
  // 碰一下任何东西
  tap() { P.tone({ type: 'square', f: 900, dur: 0.03, vol: 0.04 }); },
  // 按钮
  button() { P.tone({ type: 'square', f: 520, f2: 780, dur: 0.06, vol: 0.06 }); },
  // 圈一下（笔刷刷的声音）
  mark() {
    P.noise({ f: 3200, f2: 1800, q: 2, dur: 0.09, vol: 0.18 });
    P.tone({ type: 'triangle', f: 1300, f2: 900, dur: 0.06, vol: 0.05 });
  },
  unmark() { P.noise({ f: 1800, f2: 3000, q: 2, dur: 0.06, vol: 0.1 }); },
  // 证件递进来 / 递回去
  paper() { P.noise({ f: 2200, f2: 900, q: 0.8, dur: 0.16, vol: 0.12 }); },
  step(i) { P.tone({ type: 'triangle', f: i % 2 ? 110 : 130, dur: 0.05, vol: 0.06 }); },
  drag() { P.noise({ f: 1400, q: 1.2, dur: 0.04, vol: 0.04 }); },
  // 盖章：低沉一下 + 一声闷响
  stamp(big) {
    P.tone({ type: 'sine', f: big ? 160 : 140, f2: 40, dur: big ? 0.3 : 0.2, vol: big ? 0.7 : 0.5 });
    P.noise({ f: 700, f2: 200, q: 0.7, dur: big ? 0.22 : 0.14, vol: big ? 0.5 : 0.35 });
  },
  good() {
    P.tone({ type: 'square', f: 660, dur: 0.07, vol: 0.06, delay: 0.06 });
    P.tone({ type: 'square', f: 990, dur: 0.1, vol: 0.06, delay: 0.13 });
  },
  evidence() {
    [784, 988, 1318].forEach((f, i) => P.tone({ type: 'square', f, dur: 0.1, vol: 0.07, delay: 0.06 + i * 0.07 }));
  },
  bad() {
    P.tone({ type: 'sawtooth', f: 200, f2: 90, dur: 0.38, vol: 0.14, delay: 0.05 });
    P.tone({ type: 'square', f: 150, f2: 80, dur: 0.3, vol: 0.06, delay: 0.1 });
  },
  coin() {
    P.tone({ type: 'square', f: 1320, dur: 0.05, vol: 0.06 });
    P.tone({ type: 'square', f: 1760, dur: 0.12, vol: 0.06, delay: 0.05 });
  },
  push() { P.noise({ f: 1200, f2: 600, q: 1, dur: 0.12, vol: 0.1 }); },
  tick(hi) { P.tone({ type: 'square', f: hi ? 1800 : 1400, dur: 0.02, vol: 0.05 }); },
  whoosh() { P.noise({ f: 400, f2: 2400, q: 0.6, dur: 0.25, vol: 0.12 }); },
  folder() {
    P.noise({ f: 1800, f2: 800, q: 0.8, dur: 0.2, vol: 0.12 });
    P.tone({ type: 'triangle', f: 520, f2: 1040, dur: 0.25, vol: 0.06, delay: 0.15 });
  },
  bell() {
    [523, 659, 784].forEach((f, i) => P.tone({ type: 'triangle', f, dur: 0.5, vol: 0.09, delay: i * 0.12 }));
  },
  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => P.tone({ type: 'square', f, dur: 0.16, vol: 0.07, delay: i * 0.09 }));
    P.tone({ type: 'square', f: 1046, dur: 0.5, vol: 0.07, delay: 0.4 });
  },
  sad() {
    [392, 349, 294].forEach((f, i) => P.tone({ type: 'triangle', f, dur: 0.35, vol: 0.08, delay: i * 0.22 }));
  },
  count() { P.tone({ type: 'square', f: 1100, dur: 0.015, vol: 0.03 }); },
  nope() { P.tone({ type: 'square', f: 220, f2: 180, dur: 0.1, vol: 0.06 }); },
  // —— 0.2 新加 ——
  // 拉线：拖的时候笔尖沙沙
  pull() { P.noise({ f: 2600, q: 3, dur: 0.03, vol: 0.05 }); },
  // 绿线：对得上（两声轻叮）
  green() {
    P.tone({ type: 'triangle', f: 880, dur: 0.08, vol: 0.06 });
    P.tone({ type: 'triangle', f: 1320, dur: 0.12, vol: 0.05, delay: 0.06 });
  },
  // 灰线：不用对（缩回去）
  grey() { P.tone({ type: 'square', f: 300, f2: 200, dur: 0.08, vol: 0.04 }); },
  // 红线：啪地绷断一样的脆响 + 低音
  red() {
    P.noise({ f: 5200, f2: 1200, q: 4, dur: 0.07, vol: 0.32 });
    P.tone({ type: 'sawtooth', f: 520, f2: 130, dur: 0.18, vol: 0.12 });
    P.tone({ type: 'square', f: 90, dur: 0.14, vol: 0.08, delay: 0.02 });
  },
  // 反应：认错（叹气）/ 撒谎（心虚的颤音）/ 加价（钞票抖）/ 解释
  sigh() { P.noise({ f: 700, f2: 300, q: 0.7, dur: 0.5, vol: 0.12 }); },
  liar() { [0, 1, 2, 3].forEach((i) => P.tone({ type: 'square', f: i % 2 ? 620 : 560, dur: 0.05, vol: 0.04, delay: i * 0.06 })); },
  rustle() {
    P.noise({ f: 3000, f2: 1800, q: 1.5, dur: 0.12, vol: 0.12 });
    P.noise({ f: 2600, f2: 1600, q: 1.5, dur: 0.12, vol: 0.1, delay: 0.12 });
  },
  hmm() { P.tone({ type: 'triangle', f: 330, f2: 392, dur: 0.18, vol: 0.06 }); },
  // 按手印：印泥 + 按下去
  ink() {
    P.noise({ f: 400, f2: 200, q: 1, dur: 0.12, vol: 0.2 });
    P.tone({ type: 'sine', f: 120, f2: 60, dur: 0.12, vol: 0.3, delay: 0.05 });
  },
  match() { [660, 880, 1100].forEach((f, i) => P.tone({ type: 'triangle', f, dur: 0.1, vol: 0.07, delay: i * 0.07 })); },
  nomatch() {
    P.tone({ type: 'square', f: 300, f2: 150, dur: 0.25, vol: 0.08 });
    P.tone({ type: 'square', f: 220, f2: 110, dur: 0.3, vol: 0.06, delay: 0.12 });
  },
  // 打印机：针式打印一行
  printLine() {
    for (let i = 0; i < 6; i++) P.tone({ type: 'square', f: 1800 + (i % 2) * 300, dur: 0.012, vol: 0.035, delay: i * 0.025 });
    P.noise({ f: 900, q: 1, dur: 0.15, vol: 0.05 });
  },
  // 罚单章：比放行章更重
  fine() {
    P.tone({ type: 'sine', f: 120, f2: 35, dur: 0.35, vol: 0.8 });
    P.noise({ f: 600, f2: 150, q: 0.6, dur: 0.25, vol: 0.55 });
    P.tone({ type: 'sawtooth', f: 160, f2: 70, dur: 0.3, vol: 0.1, delay: 0.05 });
  },
  warn() {
    P.tone({ type: 'sine', f: 180, f2: 60, dur: 0.2, vol: 0.45 });
    P.tone({ type: 'square', f: 440, dur: 0.06, vol: 0.05, delay: 0.05 });
    P.tone({ type: 'square', f: 440, dur: 0.06, vol: 0.05, delay: 0.15 });
  },
  // 钱飞进钱包：一枚一声，越来越高
  coinIn(i) { P.tone({ type: 'square', f: 1200 + Math.min(10, i || 0) * 60, dur: 0.04, vol: 0.05 }); },
  billIn() { P.noise({ f: 2400, f2: 1400, q: 1.2, dur: 0.08, vol: 0.1 }); },
  register() {
    P.tone({ type: 'square', f: 1568, dur: 0.06, vol: 0.06 });
    P.tone({ type: 'square', f: 2093, dur: 0.2, vol: 0.06, delay: 0.07 });
    P.noise({ f: 3000, q: 1, dur: 0.1, vol: 0.08, delay: 0.02 });
  },
  // 报纸拍在桌上
  thump() {
    P.noise({ f: 500, f2: 150, q: 0.6, dur: 0.18, vol: 0.4 });
    P.tone({ type: 'sine', f: 90, f2: 50, dur: 0.15, vol: 0.3 });
  },
  // 家里
  cough() {
    P.noise({ f: 800, f2: 400, q: 1.2, dur: 0.12, vol: 0.22 });
    P.noise({ f: 700, f2: 350, q: 1.2, dur: 0.14, vol: 0.18, delay: 0.2 });
  },
  growl() { P.tone({ type: 'sawtooth', f: 70, f2: 55, dur: 0.5, vol: 0.06 }); },
  wind() { P.noise({ f: 500, f2: 900, q: 0.5, dur: 1.0, vol: 0.1 }); },
  door() { P.tone({ type: 'sawtooth', f: 180, f2: 260, dur: 0.4, vol: 0.04 }); },
  lamp() { P.tone({ type: 'square', f: 2400, dur: 0.02, vol: 0.04 }); },
  candle() { [523, 392].forEach((f, i) => P.tone({ type: 'sine', f, dur: 0.9, vol: 0.08, delay: i * 0.5 })); },
  lullaby() { [392, 330, 294, 262].forEach((f, i) => P.tone({ type: 'triangle', f, dur: 0.4, vol: 0.05, delay: i * 0.28 })); },
  better() { [523, 784].forEach((f, i) => P.tone({ type: 'triangle', f, dur: 0.2, vol: 0.06, delay: i * 0.1 })); },
};
