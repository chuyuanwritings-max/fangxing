// 脸：用部件拼出来（肤色、发型、发色、眼睛、眉毛、嘴、脸型、年纪、眼镜、胡子、痣、耳环、衣服）。
// grid() 把一张脸画成 18×22 的像素格（平涂 + 一层硬阴影 + 深色描边），art.js 负责把格子画到屏幕上。
const { pick, randInt } = require('./util.js');

const W = 18;
const H = 22;
const HEAD_ROWS = 16; // 这一行以上算头（呼吸时头会动一下）
const OUT = '#120c18';
const EYE = '#1a1220';
const WHITE = '#f4f0e8';
const MOUTH = '#7a2f3a';

const SKIN = [['#f2c9a0', '#d39a72'], ['#e0b088', '#b9845e'], ['#c68e62', '#9e6a44'], ['#9a6a48', '#764e33'], ['#f5d6bc', '#d6ae90']];
const HAIR = [['#2a2230', '#17111c'], ['#6a4228', '#47291a'], ['#8d8a92', '#66636c'], ['#e4e0d8', '#b6b1a8'], ['#2f8f86', '#1f625c'], ['#b0442f', '#7c2d20'], ['#d1a54e', '#9c7634']];
const CLOTH = [['#3d5a8a', '#2a3f63'], ['#7a3b4e', '#552838'], ['#4f6b3a', '#374b28'], ['#8a6a3a', '#634b27'], ['#555066', '#3b374a'], ['#2f7a7a', '#205656'], ['#b0563a', '#823e29']];
const CAP = ['#c9483a', '#8f2f26'];
const HAIR_STYLES = 8;

// 比照片时比这些（衣服不比：照片里穿的就是今天这身）
const KEYS = ['skin', 'hair', 'hairC', 'eyes', 'brows', 'mouth', 'shape', 'age', 'glasses', 'beard', 'mole', 'earring'];

function random(r) {
  const age = randInt(r, 0, 2);
  return {
    skin: randInt(r, 0, SKIN.length - 1),
    hair: randInt(r, 0, HAIR_STYLES - 1),
    hairC: age === 2 && r() < 0.6 ? randInt(r, 2, 3) : pick(r, [0, 0, 1, 1, 4, 5, 6]),
    eyes: randInt(r, 0, 2),
    brows: randInt(r, 0, 2),
    mouth: randInt(r, 0, 2),
    shape: randInt(r, 0, 2),
    age,
    glasses: r() < 0.25,
    beard: r() < 0.25 ? randInt(r, 1, 2) : 0,
    mole: r() < 0.15,
    earring: r() < 0.15,
    cloth: randInt(r, 0, CLOTH.length - 1),
    collar: randInt(r, 0, 2),
  };
}

function withParts(r, parts) {
  return Object.assign(random(r), parts || {});
}

function same(a, b) {
  return KEYS.every((k) => a[k] === b[k]);
}

function differentFrom(r, n, cur) {
  let v = cur;
  while (v === cur) v = randInt(r, 0, n - 1);
  return v;
}

// 做一张「不是本人」的照片。mode：face 整张换 / hair 换发型 / detail 只差一处
function mutate(f, mode, r) {
  const g = Object.assign({}, f);
  if (mode === 'face') {
    const n = random(r);
    KEYS.forEach((k) => (g[k] = n[k]));
    g.hair = differentFrom(r, HAIR_STYLES, f.hair);
    g.shape = differentFrom(r, 3, f.shape);
    g.skin = differentFrom(r, SKIN.length, f.skin);
  } else if (mode === 'glasses') {
    g.glasses = !f.glasses;
  } else if (mode === 'hair') {
    g.hair = differentFrom(r, HAIR_STYLES, f.hair);
    if (g.hair === 4 || f.hair === 4) g.hairC = f.hairC; // 寸头本来就看不太出颜色
  } else {
    const opts = ['glasses', 'hairC', 'beard'];
    const k = pick(r, opts);
    if (k === 'glasses') g.glasses = !f.glasses;
    else if (k === 'beard') g.beard = f.beard ? 0 : randInt(r, 1, 2);
    else {
      // 换一个反差大的发色
      const far = { 0: 3, 1: 3, 2: 0, 3: 0, 4: 5, 5: 4, 6: 0 };
      g.hairC = far[f.hairC];
      if (f.hair === 4 || f.hair === 7) g.glasses = !f.glasses; // 寸头、帽子看不见头发，改眼镜
    }
  }
  if (same(f, g)) g.glasses = !f.glasses;
  return g;
}

const cache = {};
// o: { blink, talk, look: -1 / 1 眼珠往左 / 右, mood: 'sad' 低头苦脸 / 'grin' 咧嘴 / 'shock' 张嘴 }
function grid(f, o) {
  o = o || {};
  const key = KEYS.concat(['cloth', 'collar']).map((k) => +f[k]).join(',') + (o.blink ? 'b' : '') + (o.talk ? 't' : '') + (o.look || '') + (o.mood || '');
  if (cache[key]) return cache[key];
  const c = new Array(W * H).fill(null);
  const set = (x, y, col) => {
    if (x >= 0 && x < W && y >= 0 && y < H) c[y * W + x] = col;
  };
  const rect = (x, y, w, h, col) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, col);
  };
  const [sk, skS] = SKIN[f.skin];
  const [hc, hcS] = HAIR[f.hairC];
  const [cl, clS] = CLOTH[f.cloth];
  // 头发 / 布料：右边一层硬阴影（光从左上来）
  const hrect = (x, y, w, h) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, x + i >= 12 ? hcS : hc);
  };

  // 肩膀
  rect(3, 17, 12, 1, cl);
  rect(1, 18, 16, 4, cl);
  rect(12, 17, 3, 1, clS);
  rect(12, 18, 5, 4, clS);
  rect(1, 21, 16, 1, clS);
  // 长发在肩膀前、脸后
  if (f.hair === 2) {
    rect(3, 6, 2, 13, hc);
    rect(13, 6, 2, 13, hcS);
  }
  // 脖子
  rect(7, 15, 4, 3, sk);
  rect(7, 15, 4, 1, skS);
  rect(10, 16, 1, 2, skS);
  // 领子
  if (f.collar === 0) {
    rect(8, 17, 2, 2, sk);
    set(8, 19, sk);
  } else if (f.collar === 1) {
    const w = '#e9e4da';
    set(6, 17, w); set(7, 17, w); set(7, 18, w);
    set(11, 17, '#c9c2b4'); set(10, 17, '#c9c2b4'); set(10, 18, '#c9c2b4');
  } else {
    rect(6, 16, 6, 2, clS);
    rect(6, 16, 4, 1, cl);
  }

  // 脸型
  const rows = [];
  if (f.shape === 0) {
    rows[4] = [6, 11];
    for (let y = 5; y <= 13; y++) rows[y] = [4, 13];
    rows[14] = [5, 12];
    rows[15] = [6, 11];
  } else if (f.shape === 1) {
    rows[3] = [6, 11];
    for (let y = 4; y <= 14; y++) rows[y] = [5, 12];
    rows[15] = [6, 11];
  } else {
    for (let y = 4; y <= 14; y++) rows[y] = [4, 13];
    rows[15] = [5, 12];
  }
  rows.forEach((rg, y) => {
    if (!rg) return;
    for (let x = rg[0]; x <= rg[1]; x++) set(x, y, x >= 11 || y === 15 ? skS : sk);
  });
  const left = f.shape === 1 ? 4 : 3;
  const right = f.shape === 1 ? 13 : 14;
  set(left, 9, sk); set(left, 10, sk);
  set(right, 9, skS); set(right, 10, skS);
  if (f.earring) set(left, 11, '#ffd23f');

  // 年纪：皱纹
  if (f.age >= 1) { set(6, 11, skS); set(11, 11, skS); }
  if (f.age >= 2) { set(7, 12, skS); set(10, 12, skS); rect(7, 6, 4, 1, skS); }

  // 胡子
  if (f.beard === 1) {
    const bc = HAIR[f.hairC][1];
    for (let y = 12; y <= 15; y++) {
      const rg = rows[y];
      if (!rg) continue;
      for (let x = rg[0] + (y === 12 ? 1 : 0); x <= rg[1] - (y === 12 ? 1 : 0); x++) if ((x + y) % 2 === 0 || y >= 14) set(x, y, bc);
    }
  } else if (f.beard === 2) {
    rect(7, 12, 4, 1, hcS);
  }

  // 眉毛
  if (f.brows === 0) {
    rect(5, 7, 3, 1, hcS);
    rect(10, 7, 3, 1, hcS);
  } else if (f.brows === 1) {
    set(5, 8, hcS); set(6, 7, hcS); set(7, 7, hcS);
    set(10, 7, hcS); set(11, 7, hcS); set(12, 8, hcS);
  } else {
    rect(5, 6, 3, 2, hcS);
    rect(10, 6, 3, 2, hcS);
  }

  // 眼睛
  if (o.blink) {
    rect(6, 9, 2, 1, skS);
    rect(10, 9, 2, 1, skS);
  } else if (o.look) {
    // 眼神躲：两只眼都看向一边（眼白 + 眼珠）
    const lk = o.look < 0 ? 0 : 1;
    set(6, 9, WHITE); set(7, 9, WHITE); set(10, 9, WHITE); set(11, 9, WHITE);
    set(6 + lk, 9, EYE); set(10 + lk, 9, EYE);
  } else if (f.eyes === 0) {
    set(6, 9, EYE); set(11, 9, EYE);
  } else if (f.eyes === 1) {
    set(6, 8, EYE); set(6, 9, EYE); set(11, 8, EYE); set(11, 9, EYE);
  } else {
    set(6, 9, WHITE); set(7, 9, EYE); set(10, 9, EYE); set(11, 9, WHITE);
  }
  // 眼镜
  if (f.glasses) {
    const fr = '#2a2030';
    const lens = '#9fd3ff';
    rect(5, 8, 4, 1, fr); rect(10, 8, 4, 1, fr);
    set(5, 9, fr); set(8, 9, fr); set(9, 9, fr); set(13, 9, fr);
    [6, 7, 11, 12].forEach((x) => { if (c[9 * W + x] !== EYE) set(x, 9, lens); });
    if (!o.blink) {
      if (f.eyes === 2) { set(7, 9, EYE); set(11, 9, EYE); } else { set(6, 9, EYE); set(11, 9, EYE); }
    }
  }

  // 鼻子
  set(9, 10, skS);
  set(9, 11, skS);
  set(8, 11, skS);

  // 嘴
  if (f.mouth === 0) rect(8, 13, 2, 1, MOUTH);
  else if (f.mouth === 1) rect(7, 13, 4, 1, MOUTH);
  else { set(7, 12, MOUTH); rect(8, 13, 2, 1, MOUTH); set(10, 12, MOUTH); }
  if (o.mood === 'sad') {
    rect(7, 13, 4, 1, sk); set(7, 14, MOUTH); rect(8, 13, 2, 1, MOUTH); set(10, 14, MOUTH);
    set(5, 7, sk); set(12, 7, sk); set(6, 6, hcS); set(11, 6, hcS);
  } else if (o.mood === 'grin') {
    rect(6, 12, 6, 2, sk); set(6, 12, MOUTH); rect(7, 13, 4, 1, MOUTH); set(11, 12, MOUTH); rect(8, 13, 2, 1, WHITE);
  } else if (o.mood === 'shock') {
    rect(7, 12, 4, 3, sk); rect(8, 12, 2, 3, EYE); set(8, 12, MOUTH); set(9, 14, MOUTH);
  }
  if (o.talk && !o.mood) { rect(8, 13, 2, 1, EYE); rect(8, 14, 2, 1, MOUTH); }
  if (f.mole) set(12, 12, '#5a3020');

  // 发型
  const h = f.hair;
  if (h === 0) {
    hrect(6, 2, 6, 1); hrect(4, 3, 10, 3); hrect(4, 6, 1, 3); hrect(13, 6, 1, 2);
  } else if (h === 1) {
    hrect(5, 2, 8, 1); hrect(4, 3, 10, 3); hrect(3, 5, 2, 9); hrect(13, 5, 2, 9); hrect(5, 6, 3, 1);
  } else if (h === 2) {
    hrect(5, 2, 8, 1); hrect(4, 3, 10, 3); hrect(3, 5, 2, 3); hrect(13, 5, 2, 3);
  } else if (h === 3) {
    hrect(7, 0, 4, 2); hrect(5, 2, 8, 1); hrect(4, 3, 10, 3); hrect(4, 6, 1, 2); hrect(13, 6, 1, 2);
  } else if (h === 4) {
    hrect(5, 3, 8, 1); hrect(4, 4, 10, 1);
  } else if (h === 5) {
    hrect(5, 2, 8, 1); hrect(4, 3, 10, 3); hrect(4, 6, 5, 1); hrect(4, 7, 3, 1); hrect(13, 6, 1, 3);
  } else if (h === 6) {
    hrect(4, 2, 10, 4);
    [5, 8, 11].forEach((x) => hrect(x, 1, 2, 1));
    for (let y = 3; y <= 10; y++) if (y % 2 === 1) { hrect(3, y, 1, 1); hrect(14, y, 1, 1); }
    hrect(4, 6, 1, 2); hrect(13, 6, 1, 2);
  } else {
    rect(4, 2, 10, 3, CAP[0]); rect(11, 2, 3, 3, CAP[1]);
    rect(3, 5, 12, 1, CAP[1]);
    set(8, 3, '#ffd23f');
    hrect(4, 6, 1, 2); hrect(13, 6, 1, 2);
  }

  // 描边：空格挨着有颜色的格就涂深色
  const out = c.slice();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (c[y * W + x]) continue;
      const n = (xx, yy) => xx >= 0 && xx < W && yy >= 0 && yy < H && c[yy * W + xx];
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) out[y * W + x] = OUT;
    }
  }
  cache[key] = out;
  return out;
}

module.exports = { W, H, HEAD_ROWS, OUT, KEYS, random, withParts, same, mutate, grid, SKIN, HAIR, CLOTH };
