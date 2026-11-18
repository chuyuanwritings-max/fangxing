// 画画：像素格、图标、印章、证件、关口场景。全部用代码画（平涂 + 一层硬阴影 + 深色描边）。
const face = require('./face.js');
const { fmtDate, rng } = require('./util.js');

const C = {
  bg: '#0d0a14',
  ink: '#120c18',
  paper: '#efe5cc',
  paperS: '#cfc09c',
  red: '#e0433a',
  redS: '#a52c26',
  green: '#3fbf6a',
  greenS: '#2a8a4b',
  yellow: '#ffd23f',
  yellowS: '#c99a1e',
  teal: '#38e0c8',
  pink: '#ff5c9a',
  grey: '#8b8496',
  dim: '#4a4356',
  wood: '#4a3226',
  woodS: '#36241b',
  woodL: '#5e4231',
  white: '#f4f0e8',
};
const SEAL_COLORS = { blue: '#2f63d0', purple: '#7d43c9', teal: '#1f9e93', red: '#d0392f' };

// —— 文字 ——
function text(ctx, s, x, y, size, color, align, weight) {
  ctx.font = (weight || '700') + ' ' + size + 'px sans-serif';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color || C.white;
  ctx.fillText(s, x, y);
}
// 粗字 + 硬阴影 + 描边（标题、大数字）
function bigText(ctx, s, x, y, size, color, align) {
  ctx.font = '900 ' + size + 'px sans-serif';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 6);
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = C.ink;
  ctx.fillText(s, x + size / 14, y + size / 10);
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color || C.yellow;
  ctx.fillText(s, x, y);
}

// —— 方块：平涂 + 下边一层硬阴影 + 深色描边 ——
function block(ctx, x, y, w, h, fill, shade, opt) {
  opt = opt || {};
  const o = opt.outline === undefined ? 2 : opt.outline;
  if (opt.drop) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + opt.drop, y + opt.drop, w, h);
  }
  ctx.fillStyle = C.ink;
  ctx.fillRect(x - o, y - o, w + o * 2, h + o * 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (shade) {
    const sh = opt.shadeH || Math.max(3, Math.round(h * 0.14));
    ctx.fillStyle = shade;
    ctx.fillRect(x, y + h - sh, w, sh);
  }
  if (opt.hi) {
    ctx.fillStyle = opt.hi;
    ctx.fillRect(x, y, w, 2);
  }
}

// —— 像素格 ——
// tone：'grey' 报纸灰 / 'pale' 褪色（重病）/ 空 = 原色
const toneCache = {};
function toneColor(c, tone) {
  const k = tone + c;
  if (toneCache[k]) return toneCache[k];
  const n = parseInt(c.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  let out;
  if (tone === 'grey') {
    // 报纸只有四种灰
    const lv = l < 60 ? '#2b2620' : l < 120 ? '#5a534a' : l < 185 ? '#8f877b' : '#d6cdbb';
    out = lv;
  } else {
    const m = (v) => Math.round(v * 0.35 + l * 0.45 + 30);
    out = 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }
  toneCache[k] = out;
  return out;
}

function drawCells(ctx, cells, gw, gh, x, y, cell, headDy, headRows, tint, tone) {
  const ov = 0.35; // 盖一点缝，免得放大后格子之间露线
  for (let j = 0; j < gh; j++) {
    const dy = j < headRows ? headDy : 0;
    for (let i = 0; i < gw; i++) {
      const c = cells[j * gw + i];
      if (!c) continue;
      ctx.fillStyle = tone ? toneColor(c, tone) : c;
      ctx.fillRect(x + i * cell, y + j * cell + dy, cell + ov, cell + ov);
    }
  }
  if (tint) {
    // 暗处的人：整体压暗
    ctx.fillStyle = tint;
    for (let j = 0; j < gh; j++) {
      const dy = j < headRows ? headDy : 0;
      for (let i = 0; i < gw; i++) if (cells[j * gw + i]) ctx.fillRect(x + i * cell, y + j * cell + dy, cell + ov, cell + ov);
    }
  }
}

function portrait(ctx, f, x, y, cell, o) {
  o = o || {};
  const g = face.grid(f, o);
  drawCells(ctx, g, face.W, face.H, x, y, cell, o.headDy || 0, face.HEAD_ROWS, o.tint, o.tone);
}

// —— 图标：字母画（. 是空），自动描边 ——
const ICONS = {
  lunchbox: { p: { a: '#d9534f', b: '#a33a36', c: '#c0c0c8', d: '#f2e6c8' }, m: [
    '....cccc....', '....c..c....', '..aaaaaaaa..', '..aaaaaaab..', '..dddddddd..', '..aaaaaaab..',
    '..aaaaaaab..', '..dddddddd..', '..aaaaaaab..', '..aaaaaaab..', '...bbbbbb...'] },
  briefcase: { p: { a: '#7a4a2a', b: '#57331c', c: '#3a2414', d: '#ffd23f' }, m: [
    '....cccc....', '....c..c....', '.aaaaaaaaaa.', '.aaaaaaaaab.', '.aaaaddaaab.', '.bbbbddbbbb.',
    '.aaaaaaaaab.', '.aaaaaaaaab.', '.aaaaaaaaab.', '.bbbbbbbbbb.'] },
  flower: { p: { a: '#ff7aa8', b: '#d24b7c', c: '#ffd23f', e: '#4caf50', d: '#f3ead2', f: '#c9bb94' }, m: [
    '.aa..aa.....', 'aaca.acaa...', '.aa..aab.aa.', '..e..e..acaa', '..e..e..eaa.', '...eee.ee...',
    '...ddddd....', '..dddddff...', '..ddddfff...', '...ddfff....', '....dff.....'] },
  whiteflower: { p: { a: '#f4f0e8', b: '#c8c2b8', c: '#ffe58a', e: '#4f7a4a', d: '#3a3a44', f: '#26262e' }, m: [
    '.aa..aa.....', 'aaca.acaa...', '.aa..aab.aa.', '..e..e..acaa', '..e..e..eaa.', '...eee.ee...',
    '...ddddd....', '..dddddff...', '..ddddfff...', '...ddfff....', '....dff.....'] },
  oranges: { p: { a: '#ff9a2e', b: '#d06a14', e: '#4caf50', d: '#d8c9a0', f: '#a8976c' }, m: [
    '...e....e...', '..aab..aab..', '.aaaab.aaab.', '.aaabb.aabb.', '..bbaab.bb..', '....aaab....',
    '.ddddddddd..', '.ddddddddf..', '.dddddddff..', '..dddddff...'] },
  toolbox: { p: { a: '#3f7fd1', b: '#2a5a99', c: '#c0c0c8', d: '#ffd23f' }, m: [
    '....cccc....', '....c..c....', '.aaaaaaaaaa.', '.aaaaaaaaab.', '.dddddddddd.', '.aaaaaaaaab.',
    '.aaaaaaaaab.', '.aaaaaaaaab.', '.bbbbbbbbbb.'] },
  umbrella: { p: { a: '#7a5bd6', b: '#5640a3', c: '#d8d4cc', d: '#8a6a3a' }, m: [
    '.....aa.....', '...aaaaaa...', '..aaaaaaab..', '.aaaaaaaabb.', '.abaabaabab.', '.....c......',
    '.....c......', '.....c......', '.....c......', '.....c.c....', '......c.....'] },
  schoolbag: { p: { a: '#e0433a', b: '#a52c26', c: '#f3ead2', d: '#ffd23f' }, m: [
    '....bbbb....', '...b....b...', '..aaaaaaaa..', '..aaaaaaab..', '..accccccb..', '..accddccb..',
    '..accccccb..', '..aaaaaaab..', '..aaaaaaab..', '..bbbbbbbb..'] },
  coffee: { p: { a: '#f3ead2', b: '#c9bb94', c: '#6a4228', d: '#d8d4cc' }, m: [
    '...d..d.....', '....d..d....', '..cccccc....', '.aaaaaaaa...', '.aaaaaaab.a.', '.aaaaaaabaa.',
    '.aaaaaaab.a.', '.aaaaaaabaa.', '..aaaaab....', '..bbbbbb....'] },
  plant: { p: { a: '#4caf50', b: '#2f7a34', c: '#b0563a', d: '#823e29' }, m: [
    '.....a......', '...a.aa.a...', '..aaaaaaab..', '.aaabaaabaa.', '..abaaaba...', '...aabab....',
    '..cccccccd..', '...cccccd...', '...cccccd...', '....cccd....'] },
  cake: { p: { a: '#f7e1ec', b: '#d6aec2', c: '#ff5c9a', d: '#ffd23f', e: '#8a5a3a' }, m: [
    '.....d......', '.....c......', '..aaaaaaaa..', '..acacacab..', '..aaaaaaab..', '..eeeeeeee..',
    '..aaaaaaab..', '..bbbbbbbb..', '.cccccccccc.'] },
  birdcage: { p: { a: '#c99a1e', b: '#8a6a14', c: '#ffd23f', d: '#38e0c8' }, m: [
    '.....a......', '....aaa.....', '...a.a.a....', '..a..a..a...', '..a.dd..a...', '..a.ddd.a...',
    '..a..a..a...', '..a..a..a...', '.aaaaaaaaa..', '.bbbbbbbbb..'] },
  letter: { p: { a: '#f3ead2', b: '#c9bb94', c: '#e0433a', d: '#8b8496' }, m: [
    '............', '.aaaaaaaaaa.', '.abaaaaaaba.', '.aabaaaabaa.', '.aaabaabaaa.', '.aaaabbaaaa.',
    '.aaaaccaaab.', '.aaaaaaaaab.', '.bbbbbbbbbb.'] },
  watch: { p: { a: '#ffd23f', b: '#c99a1e', c: '#f4f0e8', d: '#120c18', e: '#6a4228' }, m: [
    '....eeee....', '....eeee....', '...aaaaaa...', '..accccccb..', '..accdcccb..', '..accddccb..',
    '..accccccb..', '...bbbbbb...', '....eeee....', '....eeee....'] },
  crate: { p: { a: '#8a5a2a', b: '#5e3c1a', c: '#c9a46a' }, m: [
    'cccccccccccc', 'caaaaaaaaaab', 'cabbbbbbbbab', 'caaaaaaaaaab', 'cabbbbbbbbab', 'caaaaaaaaaab',
    'cabbbbbbbbab', 'caaaaaaaaaab', 'bbbbbbbbbbbb'] },
  herbs: { p: { a: '#6aa84f', b: '#3f7a30', c: '#c9a46a', d: '#e0433a' }, m: [
    '..a..a..a...', '.aaa.aa.aa..', '..aabaabaa..', '...abbaba...', '....dddd....', '....cccc....',
    '....cccc....', '....cccc....', '.....cc.....'] },
  coal: { p: { a: '#8a7a5a', b: '#5e523a', c: '#2a2a30', d: '#4a4a52' }, m: [
    '....cdcd....', '...cdcdcd...', '..aaaaaaaa..', '.aaaaaaaaab.', '.aaaaaaaaab.', '.aaaaaaaaab.',
    '.aaaaaaaaab.', '..bbbbbbbb..'] },
  doll: { p: { a: '#f2c9a0', b: '#d24b7c', c: '#2a2230', d: '#ff7aa8' }, m: [
    '....cccc....', '...caaaac...', '...acaaca...', '...aaaaaa...', '....aaaa....', '...dddddd...',
    '..ddbddbdd..', '...dddddd...', '...dd..dd...'] },
  apron: { p: { a: '#f4f0e8', b: '#c8c2b8', c: '#3f7fd1' }, m: [
    '...c....c...', '....c..c....', '...aaaaaa...', '..aaaaaaab..', '..aaccccab..', '..aaaaaaab..',
    '..aaaaaaab..', '..bbbbbbbb..'] },
  oldphoto: { p: { a: '#e8dcc0', b: '#b8a880', c: '#8a7a5a', d: '#3a3020' }, m: [
    'aaaaaaaaaa', 'abbbbbbbba', 'abccddccba', 'abcddddcba', 'abccddccba', 'abcddddcba', 'abbbbbbbba', 'aaaaaaaaab'] },
  brochure: { p: { a: '#f4f0e8', b: '#c8c2b8', c: '#3f7fd1', d: '#e0433a' }, m: [
    'cccccccc', 'cacacaca', 'aaaaaaab', 'adddaaab', 'aaaaaaab', 'acccccab', 'aaaaaaab', 'bbbbbbbb'] },
  oldpass: { p: { a: '#d8c8a8', b: '#a89878', c: '#8a3a2a', d: '#6a5a40' }, m: [
    'cccccccccc', 'aaaaaaaaab', 'adddaaccab', 'aaaaacaacb', 'adddaaccab', 'aaaaaaaaab', 'bbbbbbbbbb'] },
  shoes: { p: { a: '#f4f0e8', b: '#c8c2b8', c: '#e0433a', d: '#2a2230' }, m: [
    '..cc....cc..', '.cccc..cccc.', '.ccccc.ccccc', 'aaaaaa.aaaaa', 'dddddd.ddddd'] },
  fakepass: { p: { a: '#efe5cc', b: '#cfc09c', c: '#b0563a', d: '#7d43c9', e: '#120c18' }, m: [
    'cccccccccc', 'aaaaaaaaab', 'aeeeaaddab', 'aaaaaddddb', 'aeeaaaddab', 'aaaaaaaaab', 'bbbbbbbbbb'] },
  yuanpass: { p: { a: '#cfe3e6', b: '#a8c4c9', c: '#2f7a7a', d: '#e0433a', e: '#120c18' }, m: [
    'cccccccccc', 'aaaaaaaaab', 'aeeeaaaaab', 'aaaaaaddab', 'aeeaaaddab', 'aaaaaaaaab', 'bbbbbbbbbb'] },
  candle: { p: { a: '#f4f0e8', b: '#c8c2b8', c: '#ffd23f', d: '#ff8a3a' }, m: [
    '..c..', '.cdc.', '..d..', '.aaa.', '.aab.', '.aab.', '.aab.', 'bbbbb'] },
  medbottle: { p: { a: '#c9483a', b: '#8f2f26', c: '#f4f0e8', d: '#e8e0d0' }, m: [
    '..cccc..', '..dddd..', '.aaaaaa.', '.acccca.', '.acaaca.', '.acccca.', '.aaaaab.', '..bbbb..'] },
  jar: { p: { a: '#bfe3ea', b: '#8fb8c2', c: '#ffd23f', d: '#8a6a3a' }, m: [
    '.dddddd.', 'aaaaaaaa', 'a.cc..ab', 'a.....ab', 'a.cc.cab', 'acccccab', 'bbbbbbbb'] },
  print: { p: { a: '#f4f0e8', b: '#2a2030', c: '#c8c2b8' }, m: [
    '..bbbb..', '.baaaab.', 'babbbbab', 'bab..bab', 'babbbbab', '.baaaab.', '..bbbb..'] },
  lock: { p: { a: '#8b8496', b: '#615a6c', c: '#ffd23f' }, m: [
    '..bbbb..', '.b....b.', '.b....b.', 'aaaaaaaa', 'aaacaaaa', 'aaacaaab', 'bbbbbbbb'] },
  // UI 小图标
  cal: { p: { a: '#f4f0e8', b: '#c8c2b8', c: '#e0433a', d: '#120c18' }, m: [
    '.c....c.', 'cccccccc', 'aaaaaaaa', 'adadadab', 'aaaaaaab', 'adadadab', 'bbbbbbbb'] },
  name: { p: { a: '#f4f0e8', b: '#c8c2b8', c: '#3f7fd1', d: '#120c18' }, m: [
    'aaaaaaaa', 'accaddda', 'accaaaaa', 'aaaaddda', 'bbbbbbbb'] },
  face: { p: { a: '#f2c9a0', b: '#d39a72', c: '#2a2230', d: '#120c18' }, m: [
    '.cccccc.', 'cccccccc', 'aaaaaaab', 'adaaadab', 'aaaaaaab', 'aaaddaab', '.aaaaab.'] },
  permit: { p: { a: '#ffb8cf', b: '#e08aa8', c: '#120c18' }, m: [
    'aaaaaaa.', 'acacaca.', 'aaaaaaab', 'acccaaab', 'aaaaaaab', 'bbbbbbbb'] },
  pill: { p: { a: '#e0433a', b: '#f4f0e8', c: '#a52c26', d: '#c8c2b8' }, m: [
    '..aaa...', '.aaaaa..', '.aaaaac.', '..ccbbb.', '...bbbbb', '....bbbd', '.....dd.'] },
  bowl: { p: { a: '#f4f0e8', b: '#c8c2b8', c: '#3f7fd1', d: '#d8d4cc' }, m: [
    '..d..d..', '...d..d.', 'aaaaaaaa', 'ccccccca', '.aaaaab.', '..bbbb..'] },
  house: { p: { a: '#e0433a', b: '#a52c26', c: '#efe5cc', d: '#6a4228', e: '#ffd23f' }, m: [
    '...aa...', '..aaaa..', '.aaaaaa.', 'aaaaaabb', '.cccccc.', '.ceccdc.', '.ccccdc.'] },
  audit: { p: { a: '#3a4a6a', b: '#26324a', c: '#ffd23f', d: '#f2c9a0', e: '#120c18' }, m: [
    '..aaaa..', '.aaaaaa.', '.bbcbbb.', '.dddddd.', '.dedded.', '.dddddd.', 'aaaaaaaa', 'aaacaaaa'] },
  medal: { p: { a: '#ffd23f', b: '#c99a1e', c: '#e0433a', d: '#3f7fd1' }, m: [
    'cd....dc', '.cd..dc.', '..cddc..', '..aaaa..', '.aaaaab.', '.aabaab.', '.aaaaab.', '..bbbb..'] },
  coin: { p: { a: '#ffd23f', b: '#c99a1e', c: '#fff1a8' }, m: [
    '.aaaa.', 'acaaab', 'acabab', 'aaaaab', '.bbbb.'] },
  bill: { p: { a: '#7fd18a', b: '#4f9a5a', c: '#2f6a3a' }, m: [
    'aaaaaaaaaa', 'acaaaaaaca', 'aaaccccaab', 'acaaaaaacb', 'bbbbbbbbbb'] },
};
const iconCache = {};
function iconCells(name) {
  if (iconCache[name]) return iconCache[name];
  const ic = ICONS[name];
  const gh = ic.m.length + 2;
  const gw = ic.m.reduce((m, r) => Math.max(m, r.length), 0) + 2;
  const c = new Array(gw * gh).fill(null);
  ic.m.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') c[(j + 1) * gw + i + 1] = ic.p[row[i]];
  });
  const out = c.slice();
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    if (c[y * gw + x]) continue;
    const n = (xx, yy) => xx >= 0 && xx < gw && yy >= 0 && yy < gh && c[yy * gw + xx];
    if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) out[y * gw + x] = C.ink;
  }
  iconCache[name] = { c: out, w: gw, h: gh };
  return iconCache[name];
}
// cx, cy 是中心
function icon(ctx, name, cx, cy, cell) {
  if (!ICONS[name]) return;
  const ic = iconCells(name);
  drawCells(ctx, ic.c, ic.w, ic.h, Math.round(cx - (ic.w * cell) / 2), Math.round(cy - (ic.h * cell) / 2), cell, 0, 0);
}

// —— 印章 ——
function polygon(ctx, x, y, r, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (Math.PI * 2 * i) / n;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
function sealPath(ctx, shape, x, y, r) {
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  } else if (shape === 'hex') polygon(ctx, x, y, r, 6, Math.PI / 6);
  else polygon(ctx, x, y, r * 1.12, 4, Math.PI / 4);
}
function seal(ctx, s, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 0.88 : alpha;
  const col = SEAL_COLORS[s.color] || s.color;
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2, r * 0.14);
  sealPath(ctx, s.shape, x, y, r);
  ctx.stroke();
  sealPath(ctx, s.shape, x, y, r * 0.72);
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.stroke();
  text(ctx, s.char || '准', x, y + 1, Math.round(r * 0.8), col, 'center', '900');
  ctx.restore();
}

// —— 大章（放行 / 驳回）——
function bigStamp(ctx, x, y, w, h, ok, alpha, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot || 0);
  ctx.globalAlpha = alpha;
  const col = ok ? '#2fae5c' : '#d8362d';
  ctx.strokeStyle = col;
  ctx.lineWidth = 4;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
  text(ctx, ok ? '放 行' : '驳 回', 0, 1, Math.round(h * 0.5), col, 'center', '900');
  ctx.restore();
}

// —— 证件 ——
// 每张证件的可点区（相对证件左上角）
const FIELDS = {
  id: { 'id.photo': [5, 21, 60, 72], 'id.name': [68, 22, 102, 34] },
  pass: { 'pass.name': [5, 22, 118, 34], 'pass.until': [5, 58, 100, 38], 'pass.seal': [106, 58, 64, 64] },
};
const SIZE = { id: [174, 118], pass: [174, 134] };

function idCard(ctx, x, y, d, f) {
  const [w, h] = SIZE.id;
  block(ctx, x, y, w, h, '#cfe3e6', '#a8c4c9', { drop: 4, shadeH: 6 });
  ctx.fillStyle = '#2f7a7a';
  ctx.fillRect(x, y, w, 18);
  text(ctx, '身份卡', x + 8, y + 9, 11, C.white, 'left', '900');
  text(ctx, '外环居民', x + w - 8, y + 9, 10, '#bfeee8', 'right', '700');
  // 照片
  ctx.fillStyle = '#9fb7c9';
  ctx.fillRect(x + 8, y + 24, 54, 66);
  portrait(ctx, d.photo, x + 8, y + 24, 3, {});
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 8, y + 24, 54, 66);
  text(ctx, '姓名', x + 72, y + 28, 10, '#5a7a80');
  text(ctx, d.name, x + 72, y + 45, 17, C.ink, 'left', '900');
  text(ctx, '编号', x + 72, y + 64, 10, '#5a7a80');
  text(ctx, d.no, x + 72, y + 77, 12, '#2a3a40', 'left', '700');
  text(ctx, d.district, x + 72, y + 98, 11, '#2a3a40', 'left', '700');
  // 一条小磁条做装饰
  ctx.fillStyle = '#7fa6ad';
  ctx.fillRect(x + 8, y + 96, 54, 4);
  // 存档手印
  ctx.fillStyle = '#e4eef0';
  ctx.fillRect(x + 140, y + 62, 26, 32);
  fingerprint(ctx, x + 153, y + 78, 13, d.print, 0.55);
  ctx.strokeStyle = '#7fa6ad';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 140, y + 62, 26, 32);
}

function passCard(ctx, x, y, d) {
  const [w, h] = SIZE.pass;
  block(ctx, x, y, w, h, C.paper, C.paperS, { drop: 4, shadeH: 6 });
  ctx.fillStyle = '#b0563a';
  ctx.fillRect(x, y, w, 18);
  text(ctx, '内城通行证', x + 8, y + 9, 11, C.white, 'left', '900');
  text(ctx, d.no, x + w - 8, y + 9, 10, '#ffd9c8', 'right', '700');
  text(ctx, '姓名', x + 9, y + 28, 10, '#8a6a4a');
  text(ctx, d.name, x + 9, y + 45, 17, C.ink, 'left', '900');
  text(ctx, '有效至', x + 9, y + 66, 10, '#8a6a4a');
  text(ctx, fmtDate(d.until), x + 9, y + 84, 20, C.ink, 'left', '900');
  // 底纹
  ctx.fillStyle = 'rgba(176,86,58,0.18)';
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 9 + i * 16, y + 108, 10, 3);
  text(ctx, '凭此证入内城', x + 9, y + 121, 10, '#8a6a4a');
  seal(ctx, d.seal, x + 138, y + 90, 24, 0.9);
}

// 钞票（夹在证件里）
function bill(ctx, x, y, amount, wob) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18 + (wob || 0));
  block(ctx, -26, -12, 52, 24, '#8fdc98', '#5aa864', { shadeH: 4 });
  ctx.fillStyle = '#4f9a5a';
  ctx.fillRect(-20, -6, 8, 12);
  text(ctx, '¥' + amount, 6, 0, 13, '#1f4a28', 'center', '900');
  ctx.restore();
}

// —— 关口场景（窗口外）——
let city = null;
function buildCity(w) {
  const r = rng(4242);
  const towers = [];
  let x = -10;
  while (x < w + 20) {
    const tw = 18 + Math.floor(r() * 26);
    const th = 40 + Math.floor(r() * 90);
    const inner = x > w * 0.55;
    const wins = [];
    for (let wy = 6; wy < th - 6; wy += 7) for (let wx = 4; wx < tw - 4; wx += 6) if (r() < (inner ? 0.55 : 0.22)) wins.push([wx, wy, r()]);
    towers.push({ x, w: tw, h: inner ? th + 30 : th, inner, wins, hue: r() });
    x += tw + 2 + Math.floor(r() * 6);
  }
  const stars = [];
  for (let i = 0; i < 26; i++) stars.push([r() * w, r() * 60, r()]);
  return { towers, stars };
}

// bx, by, bw, bh：窗口；gate：栏杆抬起 0~1
function booth(ctx, bx, by, bw, bh, t, gate) {
  if (!city) city = buildCity(bw);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  // 天：三层平涂
  ctx.fillStyle = '#1a1030';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#24163e';
  ctx.fillRect(bx, by + bh * 0.28, bw, bh);
  ctx.fillStyle = '#2f1d4a';
  ctx.fillRect(bx, by + bh * 0.48, bw, bh);
  city.stars.forEach((s) => {
    const a = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + s[2] * 9));
    ctx.fillStyle = 'rgba(255,240,200,' + a.toFixed(2) + ')';
    ctx.fillRect(bx + s[0], by + 6 + s[1], 2, 2);
  });
  // 楼：外环暗，内城亮
  const ground = by + bh * 0.7;
  city.towers.forEach((tw) => {
    const x = bx + tw.x;
    const top = ground - tw.h;
    ctx.fillStyle = tw.inner ? '#3a2a5e' : '#231a36';
    ctx.fillRect(x, top, tw.w, tw.h);
    ctx.fillStyle = tw.inner ? '#2c1f4a' : '#1a1328';
    ctx.fillRect(x + tw.w - 5, top, 5, tw.h);
    tw.wins.forEach((wn) => {
      const on = Math.sin(t * 0.5 + wn[2] * 40) > -0.85;
      if (!on) return;
      ctx.fillStyle = tw.inner ? (wn[2] < 0.3 ? C.teal : wn[2] < 0.5 ? C.pink : '#ffe08a') : '#a8865a';
      ctx.fillRect(x + wn[0], top + wn[1], 3, 3);
    });
  });
  // 地面
  ctx.fillStyle = '#2a2236';
  ctx.fillRect(bx, ground, bw, bh);
  ctx.fillStyle = '#1e1828';
  for (let i = 0; i < 12; i++) ctx.fillRect(bx + ((i * 40 + t * 0) % bw), ground + 14, 22, 3);
  // 门柱 + 「内城」灯牌
  const gx = bx + bw - 52;
  block(ctx, gx, by + 18, 18, bh, '#4a4060', '#3a3250', { outline: 2 });
  block(ctx, gx + 30, by + 18, 18, bh, '#4a4060', '#3a3250', { outline: 2 });
  const flick = Math.sin(t * 13) > -0.95 ? 1 : 0.4;
  ctx.globalAlpha = flick;
  block(ctx, gx - 4, by + 26, 56, 22, '#18303a', null, { outline: 2 });
  text(ctx, '内 城', gx + 24, by + 37, 13, C.teal, 'center', '900');
  ctx.globalAlpha = 1;
  // 栏杆
  ctx.save();
  ctx.translate(gx + 9, ground - 6);
  ctx.rotate(-gate * 1.25);
  ctx.fillStyle = C.ink;
  ctx.fillRect(-82, -5, 86, 10);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? '#f4f0e8' : C.red;
    ctx.fillRect(-80 + i * 14, -3, 14, 6);
  }
  ctx.restore();
  // 「外环」路牌
  block(ctx, bx + 8, by + 14, 46, 18, '#3a2a2a', null, { outline: 2 });
  text(ctx, '← 外环', bx + 31, by + 23, 10, '#d8b890', 'center', '900');
  ctx.restore();
}

// —— 手印：三种纹（seed % 3：螺纹 / 箕纹 / 弓纹），中心位置也随 seed ——
function fingerprint(ctx, cx, cy, r, seed, alpha, reveal) {
  const type = seed % 3;
  const ox = (((seed >> 2) % 5) - 2) * r * 0.08;
  const oy = (((seed >> 5) % 5) - 2) * r * 0.08;
  const k = reveal === undefined ? 1 : reveal;
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.78, r, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = '#2a2030';
  ctx.lineWidth = Math.max(1.2, r * 0.07);
  const n = Math.max(1, Math.round(8 * k));
  for (let i = 1; i <= n; i++) {
    const rr = i * r * 0.13;
    ctx.beginPath();
    if (type === 0) ctx.ellipse(cx + ox, cy + oy, rr * 0.8, rr, 0, 0, Math.PI * 2);
    else if (type === 1) {
      ctx.moveTo(cx + ox - rr, cy + r);
      ctx.lineTo(cx + ox - rr, cy + oy);
      ctx.arc(cx + ox, cy + oy, rr, Math.PI, 0);
      ctx.lineTo(cx + ox + rr, cy + r);
    } else ctx.ellipse(cx + ox, cy + r * 0.9 + oy, r * 1.2, rr * 1.4 + r * 0.1, 0, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}

// —— 钱包：钱越多越鼓，露出来的钞票越多 ——
function wallet(ctx, cx, cy, money, bump) {
  const fat = Math.max(0, Math.min(1, money / 160));
  const w = 74 + fat * 10;
  const h = 34 + fat * 18;
  const s = 1 + (bump || 0) * 0.18;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  const bills = Math.max(0, Math.min(5, Math.floor(money / 30)));
  for (let i = 0; i < bills; i++) {
    const bx = -w / 2 + 8 + i * ((w - 30) / Math.max(1, bills));
    block(ctx, bx, -h / 2 - 9 - (i % 2) * 3, 24, 16, '#8fdc98', '#5aa864', { shadeH: 3, outline: 1 });
  }
  block(ctx, -w / 2, -h / 2, w, h, '#8a5a32', '#6a4222', { shadeH: Math.round(h * 0.3), hi: '#a8743e' });
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(-w / 2, -2, w, 3);
  block(ctx, w / 2 - 18, -7, 14, 12, '#ffd23f', '#c99a1e', { shadeH: 3, outline: 1 });
  ctx.restore();
}

// —— 打印机 ——
function printer(ctx, x, y, w, t, busy) {
  block(ctx, x, y, w, 40, '#5a5468', '#423d50', { drop: 4, shadeH: 10, hi: '#76708a' });
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + 14, y + 30, w - 28, 6);
  const on = busy ? Math.floor(t * 10) % 2 === 0 : true;
  ctx.fillStyle = on ? (busy ? C.green : '#2a6a3a') : '#1a3a22';
  ctx.fillRect(x + w - 20, y + 9, 7, 7);
  ctx.fillStyle = '#3a3448';
  ctx.fillRect(x + 10, y + 9, w - 46, 4);
}

// —— 一双手（扶着柜台）——
function hands(ctx, cx, y, skin, shake) {
  const sx = shake ? Math.round(Math.sin(shake * 60) * 2) : 0;
  [-1, 1].forEach((sgn) => {
    const x = cx + sgn * 34 - 9 + (sgn < 0 ? sx : -sx);
    block(ctx, x, y, 18, 10, skin[0], skin[1], { shadeH: 3, outline: 2 });
    ctx.fillStyle = skin[1];
    ctx.fillRect(x + 4, y + 1, 1, 6);
    ctx.fillRect(x + 9, y + 1, 1, 6);
    ctx.fillRect(x + 14, y + 1, 1, 6);
  });
}

// —— 报纸上的照片（四种灰 + 网点）——
const NP = { k: '#2b2620', d: '#5a534a', m: '#8f877b', l: '#c9c0b0', p: '#e9e1cf' };
function paperPic(ctx, x, y, w, h, pic, t, faces) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const night = pic === 'night';
  ctx.fillStyle = night ? NP.d : NP.l;
  ctx.fillRect(x, y, w, h);
  const gy = y + h * 0.72;
  ctx.fillStyle = night ? NP.k : NP.m;
  ctx.fillRect(x, gy, w, h);
  const R = (a, b, c, d, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x + a), Math.round(y + b), Math.round(c), Math.round(d));
  };
  // 远处的楼
  for (let i = 0; i < 9; i++) {
    const bw = 22 + ((i * 37) % 18);
    const bh = 30 + ((i * 53) % 40);
    R(i * 38 - 6, gy - y - bh, bw, bh, night ? '#3a342c' : '#a8a092');
  }
  const cx = w / 2;
  if (pic === 'gate' || pic === 'night' || pic === 'arrest') {
    R(w - 90, gy - y - 70, 16, 70, NP.k);
    R(w - 50, gy - y - 70, 16, 70, NP.k);
    R(w - 96, gy - y - 82, 68, 16, NP.d);
    R(w - 200, gy - y - 22, 120, 8, NP.k);
    for (let i = 0; i < 6; i++) R(w - 198 + i * 20, gy - y - 20, 10, 4, NP.p);
    if (night) {
      ctx.fillStyle = NP.p;
      ctx.beginPath();
      ctx.arc(x + 40, y + 26, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pic === 'arrest') {
      for (let i = 0; i < 3; i++) {
        R(30 + i * 34, gy - y - 28 - (i === 1 ? 26 : 0), 32, 26, NP.d);
        R(32 + i * 34, gy - y - 26 - (i === 1 ? 26 : 0), 28, 3, NP.m);
      }
    }
  } else if (pic === 'hospital') {
    R(cx - 70, gy - y - 90, 140, 90, NP.p);
    R(cx - 70, gy - y - 90, 140, 8, NP.d);
    R(cx - 8, gy - y - 78, 16, 40, NP.k);
    R(cx - 20, gy - y - 66, 40, 16, NP.k);
    for (let i = 0; i < 4; i++) R(cx - 60 + i * 34, gy - y - 30, 18, 14, NP.m);
  } else if (pic === 'market') {
    for (let i = 0; i < 3; i++) {
      const sx = 20 + i * (w - 40) / 3;
      for (let j = 0; j < 5; j++) R(sx + j * 16, gy - y - 54, 16, 12, j % 2 ? NP.p : NP.d);
      R(sx + 4, gy - y - 42, 4, 42, NP.k);
      R(sx + 70, gy - y - 42, 4, 42, NP.k);
      R(sx, gy - y - 18, 80, 10, NP.m);
    }
  } else if (pic === 'inspector') {
    ctx.fillStyle = NP.d;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? 18 : 40;
      ctx.lineTo(x + w - 60 + Math.cos(a) * rr, y + h * 0.42 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = NP.p;
    ctx.beginPath();
    ctx.arc(x + w - 60, y + h * 0.42, 12, 0, Math.PI * 2);
    ctx.fill();
  } else if (pic === 'medicine') {
    for (let j = 0; j < 3; j++) {
      R(16, 18 + j * 34, w - 32, 4, NP.k);
      for (let i = 0; i < 10; i++) {
        const bh = 14 + ((i * 7 + j * 3) % 10);
        R(24 + i * ((w - 48) / 10), 18 + j * 34 - bh, 14, bh, (i + j) % 3 ? NP.d : NP.p);
      }
    }
  } else if (pic === 'oldhouse') {
    R(cx - 80, gy - y - 70, 120, 70, NP.d);
    ctx.fillStyle = NP.k;
    ctx.beginPath();
    ctx.moveTo(x + cx - 92, y + gy - y - 70);
    ctx.lineTo(x + cx - 20, y + gy - y - 104);
    ctx.lineTo(x + cx + 52, y + gy - y - 70);
    ctx.fill();
    for (let i = 0; i < 3; i++) R(cx - 68 + i * 36, gy - y - 54, 18, 20, NP.l);
    R(w - 70, 10, 6, gy - y - 10, NP.k);
    R(w - 150, 10, 86, 6, NP.k);
    R(w - 148, 16, 2, 30, NP.k);
  } else if (pic === 'school') {
    R(cx - 90, gy - y - 76, 180, 76, NP.p);
    R(cx - 90, gy - y - 76, 180, 8, NP.d);
    ctx.fillStyle = NP.k;
    ctx.beginPath();
    ctx.arc(x + cx, y + gy - y - 50, 12, 0, Math.PI * 2);
    ctx.fill();
    R(cx - 1, gy - y - 112, 2, 36, NP.k);
    R(cx + 1, gy - y - 112, 22, 12, NP.d);
    for (let i = 0; i < 6; i++) R(cx - 80 + i * 28, gy - y - 28, 14, 12, NP.m);
  } else if (pic === 'couple') {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = NP.d;
      ctx.beginPath();
      ctx.arc(x + 30 + i * (w - 60) / 2, y + gy - y - 40, 22, 0, Math.PI * 2);
      ctx.fill();
      R(28 + i * (w - 60) / 2, gy - y - 20, 4, 20, NP.k);
    }
  }
  // 照片里的人
  const ppl = (faces || []).filter(Boolean);
  ppl.forEach((f, i) => {
    const cell = Math.max(2, Math.min(4, Math.floor((h - 14) / 22)));
    const pw = face.W * cell;
    const px = ppl.length === 1 ? (pic === 'night' || pic === 'gate' ? 36 : cx - pw / 2 - (pic === 'inspector' ? 40 : 0)) : cx - pw - 4 + i * (pw + 8);
    portrait(ctx, f, Math.round(x + px), Math.round(y + h - face.H * cell), cell, { tone: 'grey', mood: pic === 'night' ? 'sad' : null });
  });
  // 网点
  ctx.fillStyle = 'rgba(43,38,32,0.16)';
  for (let yy = 0; yy < h; yy += 4) for (let xx = (yy / 4) % 2 ? 2 : 0; xx < w; xx += 4) ctx.fillRect(x + xx, y + yy, 1, 1);
  ctx.restore();
  ctx.strokeStyle = NP.k;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

module.exports = { C, SEAL_COLORS, NP, text, bigText, block, drawCells, portrait, icon, ICONS, seal, bigStamp, FIELDS, SIZE, idCard, passCard, bill, booth, fingerprint, wallet, printer, hands, paperPic, toneColor };
