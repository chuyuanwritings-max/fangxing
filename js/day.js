// 规则层：一局（12 天）、一天、一个人、拉线审问、按手印、判对判错、工资条、家里过夜、报纸、存档。
// 不画画、不碰平台，node 里也能直接跑（test/sim.js）。
const config = require('./config.js');
const data = require('./data.js');
const story = require('./story.js');
const face = require('./face.js');
const { rng, pick, randInt, hash, fmtDate, meets, fill } = require('./util.js');

const DAYS = data.days.length;

// —— 一局 ——
function mem() {
  return { sick: 0, hunger: 0, cold: 0, dead: false, deadDay: 0 };
}
function newRun(seed) {
  return {
    v: 2,
    seed: seed >>> 0,
    dayIdx: 0,
    money: config.startMoney,
    flags: {},
    fam: { nan: mem(), man: mem(), yuan: mem(), dou: null },
    debt: 0,
    tuition: 0,
    errands: 0,
    stats: { total: 0, correct: 0, wrong: 0, evidence: 0, prints: 0, bribes: 0, red: 0, green: 0, grey: 0, fines: 0, warns: 0, missed: {}, days: [], deaths: [], ads: {} },
    faces: {},
    said: {},
    returners: [],
    doctorUsed: {},
    over: null,
  };
}

function dayData(run) {
  return data.days[Math.min(run.dayIdx, DAYS - 1)];
}
function today(run) {
  return dayData(run).date;
}
function rules(run) {
  return dayData(run).rules;
}
function chapter(run) {
  return dayData(run).ch;
}
function hasTool(run, tool) {
  return tool === 'line' || (tool === 'print' && chapter(run) >= 2);
}

function makeName(r) {
  return pick(r, data.generic.surnames) + pick(r, data.generic.given);
}
function idNo(r) {
  return randInt(r, 1000, 9999) + '-' + randInt(r, 100, 999);
}

// 一个人：脸、名字、一句话、一样东西、证件。print = 他本人的手印
function basePerson(run, r, name, f) {
  const t = today(run);
  const no = idNo(r);
  const print = hash(name + no) % 100000;
  return {
    name,
    face: f,
    line: '',
    purpose: null,
    item: pick(r, data.generic.items),
    print,
    docs: {
      id: { name, photo: f, no, district: pick(r, data.generic.districts), print },
      pass: { name, until: t + randInt(r, 3, 50), seal: Object.assign({}, data.seal), no: 'N-' + randInt(r, 10000, 99999) },
    },
    flaw: null,
    bribe: 0,
    med: false,
    react: null,
    reactLine: '',
    raise: 0,
    memory: null,
    story: null,
    ix: { red: {}, green: {}, reacted: false, printed: false, printMatch: null },
  };
}

// 手印：三种纹（seed % 3），冒名的一定换一种纹
function otherPrint(p) {
  return p + 1 + 3 * ((p >> 3) % 7);
}

function similarName(name, r) {
  const chars = name.split('');
  const idx = [];
  chars.forEach((ch, i) => {
    if (i > 0 && data.generic.similar.some((pr) => pr[0] === ch || pr[1] === ch)) idx.push(i);
  });
  if (!idx.length) return name + '子';
  const i = pick(r, idx);
  const pr = data.generic.similar.find((x) => x[0] === chars[i] || x[1] === chars[i]);
  chars[i] = pr[0] === chars[i] ? pr[1] : pr[0];
  return chars.join('');
}

// 第几天的破绽有多细，见 config.subtle
function applyFlaw(run, p, kind, r, opt) {
  opt = opt || {};
  const sub = config.subtle[run.dayIdx];
  const t = today(run);
  const d = p.docs;
  if (kind === 'expiry') {
    const gap = opt.gap || randInt(r, sub.expiryGap[0], sub.expiryGap[1]);
    d.pass.until = t - gap;
    p.flaw = { kind, fields: ['pass.until'], a: fmtDate(d.pass.until), b: fmtDate(t) };
  } else if (kind === 'name') {
    let wrong = opt.altName;
    if (!wrong) {
      if (sub.nameMode === 'surname') {
        let s = p.name[0];
        while (s === p.name[0]) s = pick(r, data.generic.surnames);
        wrong = s + p.name.slice(1);
      } else wrong = similarName(p.name, r);
    }
    // 写错的名字落在通行证上（第 2 章有一半落在身份卡上）
    if (chapter(run) >= 2 && !opt.altName && r() < 0.5) d.id.name = wrong;
    else d.pass.name = wrong;
    p.flaw = { kind, fields: ['pass.name', 'id.name'], a: d.id.name, b: d.pass.name };
  } else if (kind === 'photo') {
    d.id.photo = face.mutate(p.face, opt.photoMode || sub.photoMode, r);
    d.id.print = otherPrint(p.print);
    p.flaw = { kind, fields: ['id.photo'] };
  } else if (kind === 'photoOld') {
    // 照片旧了：是本人，手印对得上
    d.id.photo = face.mutate(p.face, opt.photoMode || (r() < 0.5 ? 'hair' : 'detail'), r);
    p.flaw = { kind, fields: ['id.photo'], legit: true };
  } else if (kind === 'seal') {
    if (opt.sealOld) d.pass.seal.color = 'teal';
    else if (sub.sealMode === 'color') d.pass.seal.color = pick(r, data.sealFakes.color);
    else d.pass.seal.shape = pick(r, data.sealFakes.shape);
    p.flaw = { kind, fields: ['pass.seal'] };
  }
}

// 一条规则 → 一种破绽（第 2 章「照片不像」有一半是旧照片）
function ruleToFlaw(run, rule, r) {
  if (rule === 'photo' && r() < config.subtle[run.dayIdx].oldPhoto) return 'photoOld';
  return rule;
}

function otherPurpose(r, cur) {
  let p = cur;
  let n = 0;
  while ((p === cur || !p) && n++ < 20) p = pick(r, data.generic.purposes);
  return p;
}

// 被拉出红线后会怎么反应（路人随机，回头客照剧本）
function assignReact(run, p, r) {
  const f = p.flaw;
  if (!f) return;
  const G = data.generic;
  const kind = f.kind === 'photoOld' ? 'photo' : f.kind;
  if (f.kind === 'photoOld' || (f.kind === 'photo' && chapter(run) >= 2 && r() < 0.6)) {
    p.react = 'explain';
    p.reactLine = pick(r, G.explainPhoto);
    return;
  }
  if (p.bribe && r() < config.bribeReactRate) {
    p.react = 'bribe';
    p.reactLine = pick(r, G.bribe);
    p.raise = p.bribe * 2;
    return;
  }
  const w = config.reactWeights;
  if (r() < w.confess / (w.confess + w.lie)) {
    p.react = 'confess';
    p.reactLine = pick(r, G.confess[kind]);
  } else {
    p.react = 'lie';
    const other = otherPurpose(r, p.purpose);
    p.reactLine = fill(pick(r, G.lie[kind]).replace('{p}', other.p));
    if (!p.memory && p.purpose) p.memory = { label: '刚才说', text: p.purpose.say };
  }
}

function genericPerson(run, r, invalid, forced) {
  const f = face.random(r);
  const p = basePerson(run, r, makeName(r), f);
  p.purpose = pick(r, data.generic.purposes);
  const fx = forced || {};
  const flawKind = fx.flaw !== undefined ? fx.flaw : invalid ? ruleToFlaw(run, pickRule(run, r), r) : null;
  if (flawKind) {
    applyFlaw(run, p, flawKind, r, { photoMode: fx.flaw === 'photo' ? 'face' : null });
    if (fx.flaw === undefined && r() < config.bribeRate[run.dayIdx]) p.bribe = randInt(r, config.bribeAmount[0], config.bribeAmount[1]);
    p.line = p.purpose.say;
    assignReact(run, p, r);
    if (fx.react) {
      p.react = fx.react;
      if (fx.react === 'confess') p.reactLine = pick(r, data.generic.confess[flawKind === 'photoOld' ? 'photo' : flawKind]);
    }
  } else {
    p.line = r() < 0.6 ? p.purpose.say : pick(r, data.generic.chatter);
  }
  return p;
}

// 新规则当天多考一点
function pickRule(run, r) {
  const rs = rules(run).slice();
  const nr = dayData(run).newRule;
  if (nr) rs.push(nr, nr);
  return pick(r, rs);
}

function personFace(run, who) {
  if (run.faces[who]) return run.faces[who];
  const pp = story.people[who];
  let parts;
  if (pp && pp.faceOf) parts = data.family[pp.faceOf].face;
  else if (pp) parts = pp.face;
  else parts = data.family[who].face;
  const f = face.withParts(rng(hash(who)), parts);
  run.faces[who] = f;
  return f;
}

function storyPerson(run, s, r) {
  const pp = story.people[s.who] || {};
  const f = personFace(run, s.who);
  const p = basePerson(run, r, pp.docName || pp.name, f);
  p.displayName = pp.name;
  p.line = s.line || (s.lines ? s.lines.join('') : '');
  p.item = s.item || p.item;
  p.story = s;
  if (s.kind === 'talk') {
    p.docs = null;
    return p;
  }
  if (s.until) p.docs.pass.until = today(run) + s.until;
  if (s.flaw) applyFlaw(run, p, s.flaw, r, { gap: s.gap, altName: s.altName, photoMode: s.photoMode, sealOld: s.sealOld });
  p.bribe = s.bribe || 0;
  p.med = !!s.med;
  if (s.flaw) {
    p.react = s.react || 'confess';
    p.reactLine = s.reactLine || '……';
    p.raise = s.raise || (p.bribe ? p.bribe * 2 : 0);
    const prev = run.said[s.who];
    if (s.memory) p.memory = { label: '上次', text: s.memory };
    else if (p.react === 'lie' && prev) p.memory = { label: '上次（第 ' + prev.day + ' 天）说', text: prev.text };
  }
  return p;
}

function returnerPerson(run, rt, r) {
  const p = basePerson(run, r, rt.name, rt.face);
  p.returner = rt;
  const prev = data.generic.purposes.find((x) => x.say === rt.said) || data.generic.purposes[0];
  if (r() < 0.5) {
    p.line = '证办好了。上回是我不对。';
    p.purpose = prev;
  } else {
    // 又来了，换了个说法：和上次说的对不上
    p.purpose = otherPurpose(r, prev);
    p.line = p.purpose.say;
    applyFlaw(run, p, ruleToFlaw(run, pickRule(run, r), r), r);
    if (p.flaw.kind === 'photoOld') {
      p.react = 'explain';
      p.reactLine = pick(r, data.generic.explainPhoto);
    } else {
      const kind = p.flaw.kind;
      p.react = 'lie';
      p.reactLine = fill(pick(r, data.generic.lie[kind]).replace('{p}', otherPurpose(r, p.purpose).p));
    }
    p.memory = { label: '上次（第 ' + (rt.day + 1) + ' 天）说', text: rt.said };
  }
  return p;
}

// —— 一天 ——
function startDay(run) {
  const di = run.dayIdx;
  const dd = data.days[di];
  const r = rng(run.seed * 31 + di * 977 + 5);
  const n = config.peoplePerDay[di];
  const queue = [];
  for (let i = 0; i < n; i++) {
    const fx = dd.fixed && dd.fixed[i];
    queue.push(genericPerson(run, r, r() < config.invalidRate[di], fx));
  }
  // 回来的路人
  const back = run.returners.filter((x) => x.back === di).slice(0, config.returnerMax);
  run.returners = run.returners.filter((x) => x.back > di);
  back.forEach((rt) => queue.splice(randInt(r, 3, queue.length), 0, returnerPerson(run, rt, r)));
  // 回头客按顺序插进去
  story.beats
    .filter((s) => s.day === di + 1 && meets(run.flags, s.need))
    .sort((a, b) => a.at - b.at)
    .forEach((s) => queue.splice(Math.min(s.at, queue.length), 0, storyPerson(run, s, r)));
  return {
    idx: di,
    date: dd.date,
    ch: dd.ch,
    timeLeft: config.daySec[di],
    queue,
    qi: 0,
    r,
    mistakes: 0,
    ledger: { n: 0, correct: 0, wrong: 0, pay: 0, evidence: 0, evN: 0, double: 0, warns: [], fines: [], drawer: 0, events: [] },
    cards: [],
    adsLeft: config.fileAdsPerDay,
    overtimeUsed: false,
    doubleUsed: false,
    appealsLeft: config.appealPerDay,
    gifts: {},
    log: [],
    endShown: 0,
  };
}

function current(day) {
  return day.queue[day.qi] || null;
}

function addOvertime(run, day) {
  day.overtimeUsed = true;
  day.timeLeft = config.overtimeSec;
  for (let i = 0; i < config.overtimeExtraPeople; i++) {
    day.queue.push(genericPerson(run, day.r, day.r() < config.invalidRate[day.idx]));
  }
}

// —— 拉线审问 ——
// a、b 是两处的 id（id.photo / pass.name / chip.expiry / face …）
// 返回 kind：red 对不上 / green 对得上 / grey 不用对 / off 今天不查
function link(run, p, a, b) {
  if (!p || !p.docs || a === b) return { kind: 'none' };
  const key = [a, b].sort().join('|');
  const rule = data.pairs[key];
  if (!rule) return { kind: 'grey' };
  if (rules(run).indexOf(rule) < 0) return { kind: 'off', rule };
  const f = p.flaw;
  let red = false;
  if (f) red = rule === 'photo' ? f.kind === 'photo' || f.kind === 'photoOld' : f.kind === rule;
  const res = { kind: red ? 'red' : 'green', rule };
  if (red) {
    p.ix.red[rule] = true;
    run.stats.red += 1;
    if (!p.ix.reacted) {
      p.ix.reacted = true;
      res.react = p.react || 'confess';
      res.line = p.reactLine || '……';
      res.memory = p.memory;
      if (p.react === 'bribe') {
        res.from = p.bribe;
        p.bribe = p.raise || (p.bribe ? p.bribe * 2 : 20);
        res.to = p.bribe;
        p.bribeRaised = true;
      }
    } else {
      res.react = 'again';
      res.line = '……';
    }
  } else {
    p.ix.green[rule] = true;
    run.stats.green += 1;
  }
  return res;
}

function canPrint(run, p) {
  return hasTool(run, 'print') && p && p.docs && Object.keys(p.ix.red).length > 0 && !p.ix.printed;
}

// 按手印：对上 = 本人
function takePrint(run, p) {
  p.ix.printed = true;
  p.ix.printMatch = p.docs.id.print === p.print;
  run.stats.prints += 1;
  return p.ix.printMatch;
}

function ruleOf(kind) {
  return kind === 'photoOld' ? 'photo' : kind;
}

// 判一个人。decision: 'pass' | 'reject'；took：收没收夹着的钱 / 药
function resolve(run, day, p, decision, took) {
  const f = p.flaw;
  const invalid = !!f && !f.legit;
  const correct = (decision === 'reject') === invalid;
  const red = !!(f && p.ix.red[ruleOf(f.kind)]);
  let evidence = false;
  if (correct && invalid && red) evidence = true;
  if (correct && f && f.legit && p.ix.printed) evidence = true;
  const L = day.ledger;
  L.n += 1;
  const res = { correct, evidence, decision, invalid, reason: explain(run, p), fine: 0, warn: 0, took: !!(took && p.bribe), reward: null };
  if (correct) {
    L.correct += 1;
    L.pay += config.pay.correct;
    if (evidence) {
      L.evidence += config.pay.evidence;
      L.evN += 1;
    }
  } else {
    L.wrong += 1;
    day.mistakes += 1;
    if (day.mistakes > config.pay.freeWarnings) {
      res.fine = config.pay.fine;
      L.fines.push({ amount: config.pay.fine, reason: shortReason(p), appealed: false });
      run.stats.fines += 1;
    } else {
      res.warn = day.mistakes;
      L.warns.push({ reason: shortReason(p) });
      run.stats.warns += 1;
    }
  }
  if (took && p.bribe && !p.med) {
    L.drawer += p.bribe;
    run.stats.bribes += p.bribe;
  }
  const S = run.stats;
  S.total += 1;
  if (correct) S.correct += 1;
  else {
    S.wrong += 1;
    const k = invalid ? f.kind : 'clean';
    S.missed[k] = (S.missed[k] || 0) + 1;
  }
  if (evidence) S.evidence += 1;
  const s = p.story;
  if (s) {
    const id = s.id;
    const F = run.flags;
    F[id + '_seen'] = true;
    F[id + (decision === 'pass' ? '_pass' : '_reject')] = true;
    if (p.bribe) F[id + (took ? '_took' : '_refused')] = true;
    if (red) F[id + '_red'] = true;
    if (p.ix.printed) F[id + '_print'] = true;
    if (s.set) F[s.set] = true;
    if (decision === 'pass' && s.passSet) F[s.passSet] = true;
    if (decision === 'reject' && s.rejectSet) F[s.rejectSet] = true;
    if (s.gift && (s.gift.on === 'any' || s.gift.on === decision)) day.gifts[s.gift.item] = id;
    if (s.reward && s.reward.on === decision && meets(F, s.reward.need)) {
      L.drawer += s.reward.drawer;
      run.stats.bribes += s.reward.drawer;
      res.reward = s.reward;
    }
    run.said[s.who] = { day: day.idx + 1, text: s.line };
  } else if (decision === 'reject' && invalid && !p.returner && day.r() < config.returnerRate && day.idx + 2 < DAYS) {
    // 被驳回的路人，过两三天可能回来
    run.returners.push({ name: p.name, face: p.face, said: p.purpose ? p.purpose.say : '', day: day.idx, back: day.idx + 2 + (day.r() < 0.5 ? 1 : 0) });
  }
  day.log.push({ name: p.name, story: s && s.id, decision, correct, evidence, flaw: f && f.kind, fine: res.fine, warn: res.warn });
  return res;
}

// 说话类来访：选一个
function talkChoice(run, day, p, choiceId) {
  const s = p.story;
  const c = s.choices.find((x) => x.id === choiceId) || s.choices[0];
  const F = run.flags;
  F[s.id + '_seen'] = true;
  F[s.id + '_' + c.id] = true;
  if (c.set) F[c.set] = true;
  if (c.gift) day.gifts[c.gift] = s.id;
  run.said[s.who] = { day: day.idx + 1, text: (s.lines || []).join('') };
  day.log.push({ name: p.displayName || p.name, story: s.id, decision: 'talk:' + c.id });
  return c;
}

function explain(run, p) {
  const e = data.explain;
  if (!p.flaw) return e.clean;
  const f = p.flaw;
  if (f.kind === 'photo' && chapter(run) >= 2) return e.photo2;
  return fill(e[f.kind], f.a, f.b);
}
function shortReason(p) {
  if (!p.flaw) return '赶走了没问题的人';
  return { expiry: '放了过期证', name: '放了错名字', photo: '放了冒名的', photoOld: '赶走了本人', seal: '放了假章' }[p.flaw.kind] || '判错';
}

// —— 下班 ——
function closeDay(run, day) {
  story.events.filter((e) => e.day === day.idx + 1 && meets(run.flags, e.need)).forEach((e) => {
    if (day.ledger.events.some((x) => x.src === e)) return;
    day.ledger.events.push({ src: e, title: e.title, money: e.money, who: e.who });
    if (e.card) day.cards.push(e);
    if (e.set) run.flags[e.set] = true;
  });
}

function finesTotal(day) {
  return day.ledger.fines.reduce((s, f) => s + (f.appealed ? 0 : f.amount), 0);
}

function income(day) {
  const L = day.ledger;
  return L.pay + L.evidence + L.double - finesTotal(day) + L.drawer + L.events.reduce((s, e) => s + e.money, 0);
}

function applyDouble(day) {
  day.doubleUsed = true;
  day.ledger.double = Math.min(config.doubleCap, day.ledger.pay);
}

function appealOne(day) {
  if (day.appealsLeft <= 0) return false;
  const f = day.ledger.fines.find((x) => !x.appealed);
  if (!f) return false;
  f.appealed = true;
  day.appealsLeft -= 1;
  return true;
}

// 工资条：一行一行（main 里打印机一行行吐）
function payslip(run, day) {
  const L = day.ledger;
  const out = [];
  out.push({ k: 'n', label: '查验 ' + L.n + ' 人', amount: null });
  out.push({ k: 'pay', label: '判对 × ' + L.correct, amount: L.pay });
  if (L.evN) out.push({ k: 'ev', label: '查实 × ' + L.evN, amount: L.evidence });
  if (L.double) out.push({ k: 'double', label: '工资翻倍（广告）', amount: L.double });
  L.warns.forEach((w, i) => out.push({ k: 'warn', label: '警告 ' + (i + 1) + ' · ' + w.reason, amount: 0 }));
  L.fines.forEach((f, i) => out.push({ k: 'fine', label: '罚单 · ' + f.reason, amount: -f.amount, appealed: f.appealed, idx: i }));
  L.events.forEach((e) => out.push({ k: 'event', label: e.title, amount: e.money }));
  if (L.drawer) out.push({ k: 'drawer', label: '抽屉里的钱（不记账）', amount: L.drawer });
  out.push({ k: 'total', label: '今天进账', amount: income(day) });
  return out;
}

// —— 家里 ——
function dealActive(run) {
  const F = run.flags;
  return !!(F.drug2_took && F.drug2_pass && !F.drug3_reject);
}
function costs(run, day) {
  const ci = chapter(run) - 1;
  const H = config.home;
  const med = H.med[ci];
  return {
    rent: H.rent[ci],
    heat: day && day.gifts.heat ? 0 : H.heat[ci],
    food: day && day.gifts.food ? 0 : H.food[ci] + (run.fam.dou && !run.fam.dou.dead ? H.foodExtra : 0),
    med,
    medNan: dealActive(run) ? Math.round(med * H.medDealRate) : med,
    tuition: H.tuitionStep,
  };
}

function word(m) {
  if (!m || m.dead) return '';
  const W = data.words;
  if (m.sick >= 2) return W.grave;
  if (m.sick === 1) return W.sick;
  if (m.hunger >= 1) return W.hungry;
  if (m.cold >= 1) return W.cold;
  return '';
}

function homeBeats(run) {
  const d = run.dayIdx + 1;
  return story.home.filter((h) => (h.day === d || (h.keep && h.day <= d)) && meets(run.flags, h.need));
}

// 今晚家里：谁在、各自一个字、桌上摆了什么
function homeTonight(run) {
  const d = run.dayIdx + 1;
  const dd = data.days[run.dayIdx];
  if (run.flags.dou_adopt && !run.fam.dou) run.fam.dou = mem();
  const beats = homeBeats(run);
  const tonight = beats.filter((h) => h.day === d);
  const late = tonight.find((h) => h.late && !run.fam[h.late].dead);
  const members = [];
  ['nan', 'man', 'yuan', 'dou'].forEach((id) => {
    const m = run.fam[id];
    if (!m) return;
    if (id === 'yuan' && !dd.weekend) return;
    members.push({ id, name: data.family[id].name, word: word(m), sick: m.sick, dead: m.dead, late: !!(late && late.late === id) });
  });
  return {
    members,
    items: beats.filter((h) => h.item).map((h) => h.item),
    caption: (tonight.find((h) => h.caption && (!h.late || late)) || {}).caption || '',
    late: late || null,
    yuan: tonight.find((h) => h.yuan) || null,
    weekend: !!dd.weekend,
  };
}

// 谁需要药
function needsMed(run) {
  return ['nan', 'man', 'dou'].filter((id) => run.fam[id] && !run.fam[id].dead && run.fam[id].sick > 0);
}

// buys: { heat, food, med: { nan, man, dou }, tuition, doctor: id|null }
// 先付房租（必付，不够就欠），再付选了的；过夜后每人的字会变
function sleep(run, day, buys) {
  const c = costs(run, day);
  const H = config.health;
  const d = day.idx + 1;
  const dd = data.days[day.idx];
  const report = { changes: [], income: [], spent: 0, debt: false, deaths: [] };
  run.money -= c.rent;
  report.spent += c.rent;
  if (buys.heat && c.heat) { run.money -= c.heat; report.spent += c.heat; }
  if (buys.food && c.food) { run.money -= c.food; report.spent += c.food; }
  ['nan', 'man', 'dou'].forEach((id) => {
    if (buys.med && buys.med[id]) {
      const p = id === 'nan' ? c.medNan : c.med;
      run.money -= p;
      report.spent += p;
    }
  });
  if (buys.tuition) {
    run.money -= c.tuition;
    run.tuition += c.tuition;
    report.spent += c.tuition;
  }
  if (buys.doctor) run.doctorUsed[dd.ch] = (run.doctorUsed[dd.ch] || 0) + 1;
  const fed = !!(buys.food || day.gifts.food);
  const warm = !!(buys.heat || day.gifts.heat);
  const badMed = run.flags.drug_bad && d === 11;
  const cough = (story.nanCough || []).indexOf(d) >= 0;
  ['nan', 'man', 'yuan', 'dou'].forEach((id) => {
    const m = run.fam[id];
    if (!m || m.dead) return;
    if (id === 'yuan' && !dd.weekend) return; // 阿圆平时住在内城东家
    const before = word(m);
    m.hunger = fed ? 0 : m.hunger + 1;
    m.cold = warm ? 0 : m.cold + 1;
    const gotMed = !!(buys.med && buys.med[id]) && !(badMed && id === 'nan');
    let cured = false;
    if (m.sick > 0) {
      if (gotMed) {
        m.sick -= 1;
        cured = true;
      } else m.sick += 1;
    }
    if (buys.doctor === id && m.sick > 1) m.sick = 1;
    let died = false;
    if (m.sick >= H.deathAt) {
      m.dead = true;
      m.deadDay = d;
      died = true;
      run.stats.deaths.push({ id, day: d });
      report.deaths.push(id);
    } else if (m.sick === 0 && !cured) {
      if (m.hunger >= H.hungerSick || m.cold >= H.coldSick || (id === 'nan' && m.cold >= H.nanColdSick) || (id === 'nan' && cough) || (id === 'nan' && badMed)) m.sick = 1;
    }
    if (badMed && id === 'nan' && !m.dead && m.sick === 0) m.sick = 1;
    report.changes.push({ id, before, after: word(m), died });
  });
  // 夜里的钱：小满晚归带回来的、周末阿圆带回来的
  const home = homeTonight(run);
  if (home.late) {
    const extra = home.late.money + (run.fam.man.hunger >= 1 ? story.hungryErrandBonus : 0);
    run.money += extra;
    run.errands += 1;
    run.flags.man_errand = true;
    report.income.push({ who: 'man', money: extra });
  }
  if (home.yuan && !run.fam.yuan.dead) {
    run.money += home.yuan.money;
    report.income.push({ who: 'yuan', money: home.yuan.money });
  }
  if (run.money < 0) {
    run.debt += 1;
    report.debt = true;
    if (run.debt >= config.home.debtLimit) run.over = { kind: 'evicted', day: d };
  } else run.debt = 0;
  const L = day.ledger;
  run.stats.days.push({ day: d, n: L.n, correct: L.correct, wrong: L.wrong, income: income(day), money: run.money, queue: day.queue.length, overtime: day.overtimeUsed, words: famWords(run) });
  return report;
}

function famWords(run) {
  const o = {};
  Object.keys(run.fam).forEach((id) => {
    const m = run.fam[id];
    if (m) o[id] = m.dead ? '空椅子' : word(m) || '好';
  });
  return o;
}

function nextDay(run) {
  run.dayIdx += 1;
  return run.dayIdx < DAYS && !run.over;
}

// 第几章刚结束（第 6、12 天过完）
function chapterJustEnded(run) {
  const d = run.dayIdx + 1;
  const ch = data.chapters.find((c) => c.days[1] === d);
  return ch ? ch.n : 0;
}

// —— 报纸 ——
function paper(run) {
  const d = run.dayIdx + 1;
  const F = run.flags;
  const cands = story.papers.filter((p) => p.day === d && meets(F, p.need));
  let best = null;
  cands.forEach((p) => {
    const pr = p.prio != null ? p.prio : p.need ? 1 : 0;
    if (!best || pr > best.pr) best = { pr, p };
  });
  const main = best ? best.p : { head: '外环晨报', pic: 'gate' };
  const deaths = run.stats.deaths.filter((x) => x.day === d - 1);
  let side = '';
  if (deaths.length) side = fill(story.obit, data.family[deaths[0].id].name);
  else {
    const s = story.paperSide.find((x) => x.day === d && meets(F, x.need));
    side = s ? s.line : '';
  }
  return { head: main.head, sub: main.sub || '', pic: main.pic, who: main.who, who2: main.who2, side, date: today(run), day: d };
}

// —— 章节卡 ——
function fates(run, ch) {
  const out = [];
  const seen = {};
  story.fates.forEach((f) => {
    if (f.ch !== ch || seen[f.who]) return;
    if (!meets(run.flags, f.need)) return;
    // 没见过这个人就不写
    const met = story.beats.some((b) => b.who === f.who && run.flags[b.id + '_seen']);
    if (!met) return;
    seen[f.who] = true;
    out.push(f);
  });
  return out;
}

// —— 存档：整局就是一个能 JSON 的对象 ——
function snapshot(run) {
  return JSON.parse(JSON.stringify(run));
}
function restore(obj) {
  if (!obj || obj.v !== 2 || typeof obj.dayIdx !== 'number') return null;
  return obj;
}

// —— 机器人用：只看证件上写的东西 + 今天的规则（不偷看答案）——
// 返回要拉的那根线 [a, b]；needPrint = 第 2 章照片不像，要按手印才知道
function checkByRules(run, p) {
  if (!p || !p.docs) return null;
  const d = p.docs;
  const t = today(run);
  const rs = rules(run);
  for (let i = 0; i < rs.length; i++) {
    const k = rs[i];
    if (k === 'expiry' && d.pass.until < t) return { link: ['pass.until', 'chip.expiry'] };
    if (k === 'name' && d.id.name !== d.pass.name) return { link: ['id.name', 'pass.name'] };
    if (k === 'photo' && !face.same(d.id.photo, p.face)) return { link: ['id.photo', 'face'], needPrint: chapter(run) >= 2 };
    if (k === 'seal' && (d.pass.seal.shape !== data.seal.shape || d.pass.seal.color !== data.seal.color)) return { link: ['pass.seal', 'chip.seal'] };
  }
  return null;
}

module.exports = {
  DAYS, newRun, startDay, current, link, canPrint, takePrint, resolve, talkChoice, addOvertime, closeDay, income,
  applyDouble, appealOne, payslip, finesTotal, costs, word, homeTonight, needsMed, sleep, nextDay, chapterJustEnded,
  paper, fates, snapshot, restore, checkByRules, today, rules, chapter, hasTool, dayData, explain, dealActive, famWords,
};
