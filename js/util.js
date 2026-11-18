// 小工具：可复现的随机数、数学、日期。

// 同一个 seed 永远出同一串随机数
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const randInt = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

function shuffle(r, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 新历：每月 30 天。61 → '3.02'
function fmtDate(n) {
  const m = Math.floor(n / 30) + 1;
  const d = (n % 30) + 1;
  return m + '.' + (d < 10 ? '0' : '') + d;
}

// need: ['a', '!b']
function meets(flags, need) {
  if (!need) return true;
  return need.every((k) => (k[0] === '!' ? !flags[k.slice(1)] : !!flags[k]));
}

function fill(tpl, a, b) {
  return tpl.replace('{a}', a == null ? '' : a).replace('{b}', b == null ? '' : b);
}

module.exports = { rng, clamp, lerp, easeOut, easeIn, pick, randInt, shuffle, hash, fmtDate, meets, fill };
