// 平台层：只有这个文件知道自己跑在微信里还是浏览器里。
// 画布、触摸、震动、激励视频、存档、声音，全部从这里走；别的文件不碰 wx / window / document。
// 浏览器预览：一张 <canvas id="game">，只用 pointer 事件（只用一种事件，免得一次点击被算两次）
const isWx = typeof wx !== 'undefined' && wx && typeof wx.createCanvas === 'function';

function setup(onTouch) {
  let canvas, width, height, dpr;
  if (isWx) {
    canvas = wx.createCanvas();
    const info = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
    width = info.windowWidth;
    height = info.windowHeight;
    dpr = info.pixelRatio || 2;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const send = (type) => (e) => {
      const list = e.changedTouches || [];
      for (let i = 0; i < list.length; i++) {
        onTouch(type, list[i].identifier, list[i].clientX, list[i].clientY);
      }
    };
    wx.onTouchStart(send('down'));
    wx.onTouchMove(send('move'));
    wx.onTouchEnd(send('up'));
    wx.onTouchCancel(send('up'));
  } else {
    canvas = document.getElementById('game');
    // 电脑上预览时装成一部手机大小；手机浏览器里就占满屏
    const phone = window.innerWidth > 520;
    width = phone ? 390 : window.innerWidth;
    height = phone ? Math.min(844, window.innerHeight - 20) : window.innerHeight;
    dpr = window.devicePixelRatio || 2;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 不支持就算了 */ }
      const p = pos(e);
      onTouch('down', e.pointerId, p[0], p[1]);
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pos(e);
      onTouch('move', e.pointerId, p[0], p[1]);
    });
    const up = (e) => {
      const p = pos(e);
      onTouch('up', e.pointerId, p[0], p[1]);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }
  const ctx = canvas.getContext('2d');
  return { canvas, ctx, width, height, dpr };
}

function now() {
  return Date.now();
}

function nextFrame(fn) {
  return requestAnimationFrame(fn);
}

function later(fn, ms) {
  return setTimeout(fn, ms);
}

function vibrate(strong) {
  if (isWx && wx.vibrateShort) {
    wx.vibrateShort({ type: strong ? 'heavy' : 'light', fail() {} });
  } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(strong ? 30 : 8); } catch (e) { /* 有的浏览器不让 */ }
  }
}

// —— 激励视频 ——
// showRewardedAd(onDone)：看完就调 onDone()。
// 填了广告位 id 且在微信里 → 放真广告；否则放「广告占位（激励视频）」，约 1.5 秒后算看完。
// 占位画面由游戏自己画：每帧问 adState()。
let rewardedAd = null;
let adUnitId = '';
let fakeAdMs = 1500;
let mock = null; // { start, ms }
function configureAds(opts) {
  adUnitId = opts.adUnitId || '';
  fakeAdMs = opts.fakeAdMs || 1500;
}
function showRewardedAd(onDone) {
  if (mock) return;
  if (isWx && adUnitId && wx.createRewardedVideoAd) {
    if (!rewardedAd) rewardedAd = wx.createRewardedVideoAd({ adUnitId });
    rewardedAd.offClose();
    rewardedAd.onClose((res) => {
      if (!res || res.isEnded) onDone(); // 旧版基础库 res 为 undefined，算看完
    });
    rewardedAd.show().catch(() => {
      rewardedAd.load().then(() => rewardedAd.show()).catch(() => onDone());
    });
    return;
  }
  mock = { start: now(), ms: fakeAdMs };
  later(() => {
    mock = null;
    onDone();
  }, fakeAdMs);
}
function adState() {
  if (!mock) return null;
  return { progress: Math.min(1, (now() - mock.start) / mock.ms), leftSec: Math.max(0, (mock.ms - (now() - mock.start)) / 1000) };
}

// —— 存档：微信用 wx.setStorageSync，浏览器用 localStorage ——
function load(key) {
  try {
    const raw = isWx ? wx.getStorageSync(key) : window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function save(key, value) {
  try {
    const raw = JSON.stringify(value);
    if (isWx) wx.setStorageSync(key, raw);
    else window.localStorage.setItem(key, raw);
  } catch (e) {
    // 存不了就算了：原型里不影响玩
  }
}

// —— 声音：WebAudio 现场合成（微信 wx.createWebAudioContext，浏览器 AudioContext），不用素材 ——
let actx = null;
let master = null;
let noiseBuf = null;
let audioFailed = false;
function audio() {
  if (actx || audioFailed) return actx;
  try {
    if (isWx && wx.createWebAudioContext) actx = wx.createWebAudioContext();
    else if (!isWx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (actx) {
      master = actx.createGain();
      master.gain.value = 0.7;
      master.connect(actx.destination);
    }
  } catch (e) {
    actx = null;
    audioFailed = true;
  }
  if (!actx) audioFailed = true;
  return actx;
}
// 浏览器要在第一次触摸时把声音「叫醒」
function unlockAudio() {
  const a = audio();
  if (a && a.state === 'suspended' && a.resume) a.resume();
}
// 一个音：type 波形，f 起始频率，f2 结束频率，dur 秒，vol 音量，delay 延迟秒
function tone(o) {
  const a = audio();
  if (!a) return;
  try {
    const t0 = a.currentTime + (o.delay || 0);
    const dur = o.dur || 0.1;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f || 440, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol || 0.1, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (e) {
    // 声音坏了不影响玩
  }
}
// 一段噪声（纸、印章、笔），f 是带通中心频率
function noise(o) {
  const a = audio();
  if (!a) return;
  try {
    if (!noiseBuf) {
      const n = Math.floor(a.sampleRate * 0.6);
      noiseBuf = a.createBuffer(1, n, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = a.currentTime + (o.delay || 0);
    const dur = o.dur || 0.1;
    const src = a.createBufferSource();
    src.buffer = noiseBuf;
    const g = a.createGain();
    g.gain.setValueAtTime(o.vol || 0.1, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = src;
    if (a.createBiquadFilter) {
      const flt = a.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(o.f || 1000, t0);
      if (o.f2) flt.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
      flt.Q.value = o.q || 1;
      src.connect(flt);
      node = flt;
    }
    node.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  } catch (e) {
    // 同上
  }
}

function exposeForTest(name, value) {
  if (!isWx && typeof window !== 'undefined') window[name] = value;
}

module.exports = {
  isWx, setup, now, nextFrame, later, vibrate,
  configureAds, showRewardedAd, adState,
  load, save,
  unlockAudio, tone, noise,
  exposeForTest,
};
