// 规则层：一局（三天）、一天、一个人、判对判错、记账。不画画、不碰平台，node 里也能直接跑（test/sim.js）。
const config = require('./config.js');
const data = require('./data.js');
const face = require('./face.js');
const { rng, pick, randInt, hash, fmtDate, meets, fill } = require('./util.js');

// —— 一局 ——
function newRun(seed) {
  return {
    seed: seed >>> 0,
    dayIdx: 0,
    money: config.startMoney,
    flags: {},
    miss: { med: 0, food: 0, rent: 0 }, // 每笔账连着几晚没付
    stats: { total: 0, correct: 0, wrong: 0, evidence: 0, bribes: 0, missed: {}, passedStory: [], days: [] },
    faces: {}, // 故事人物的脸（回来时同一张脸）
    over: null,
  };
}

function today(run) {
  return data.days[run.dayIdx].date;
}

function rules(run) {
  return data.days[run.dayIdx].rules;
}

function makeName(r) {
  return pick(r, data.generic.surnames) + pick(r, data.generic.given);
}

function idNo(r) {
  return randInt(r, 1000, 9999) + '-' + randInt(r, 100, 999);
}

// 一个人：脸、名字、一句话、一样东西、证件
function basePerson(run, r, name, f) {
  const t = today(run);
  const hasPermitRule = rules(run).indexOf('permit') >= 0;
  return {
    name,
    face: f,
    line: pick(r, data.generic.lines),
    item: pick(r, data.generic.items),
    docs: {
      id: { name, photo: f, no: idNo(r), district: pick(r, data.generic.districts) },
      pass: { name, until: t + randInt(r, 2, 50), seal: Object.assign({}, data.seal), no: 'N-' + randInt(r, 10000, 99999) },
      permit: hasPermitRule ? { name, date: t } : null,
    },
    flaw: null,
    bribe: 0,
    story: null,
  };
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
      } else {
        wrong = similarName(p.name, r);
      }
    }
    // 写错的名字落在通行证上（第 3 天有一半落在身份卡上）
    if (run.dayIdx >= 2 && r() < 0.5) d.id.name = wrong;
    else d.pass.name = wrong;
    if (d.permit) d.permit.name = d.pass.name;
    p.flaw = { kind, fields: ['pass.name', 'id.name'], a: d.id.name, b: d.pass.name };
  } else if (kind === 'photo') {
    d.id.photo = face.mutate(p.face, opt.photoMode || sub.photoMode, r);
    p.flaw = { kind, fields: ['id.photo'] };
  } else if (kind === 'seal') {
    if (sub.sealMode === 'color') d.pass.seal.color = pick(r, data.sealFakes.color);
    else d.pass.seal.shape = pick(r, data.sealFakes.shape);
    p.flaw = { kind, fields: ['pass.seal'] };
  } else if (kind === 'permitMissing') {
    d.permit = null;
    p.flaw = { kind, fields: ['permit.slot'] };
  } else if (kind === 'permitDate') {
    d.permit.date = t - 1;
    p.flaw = { kind, fields: ['permit.date'], a: fmtDate(d.permit.date) };
  }
  const hints = data.generic.hints[kind];
  if (!opt.keepLine && hints && r() < sub.hint) p.line = pick(r, hints);
}

function similarName(name, r) {
  const chars = name.split('');
  const idx = [];
  chars.forEach((ch, i) => {
    if (i > 0 && data.generic.similar.some((pr) => pr[0] === ch || pr[1] === ch)) idx.push(i);
  });
  if (!idx.length) return name[0] + name.slice(1) + '子';
  const i = pick(r, idx);
  const pr = data.generic.similar.find((x) => x[0] === chars[i] || x[1] === chars[i]);
  chars[i] = pr[0] === chars[i] ? pr[1] : pr[0];
  return chars.join('');
}

function ruleToFlaw(rule, r) {
  if (rule === 'permit') return r() < config.permitMissingRate ? 'permitMissing' : 'permitDate';
  return rule;
}

function genericPerson(run, r, invalid, forcedFlaw) {
  const f = face.random(r);
  const p = basePerson(run, r, makeName(r), f);
  if (forcedFlaw === null) return p;
  if (forcedFlaw) {
    applyFlaw(run, p, forcedFlaw, r, { photoMode: 'face' });
  } else if (invalid) {
    // 新规则当天多考一点
    const rs = rules(run).slice();
    const nr = data.days[run.dayIdx].newRule;
    if (nr) rs.push(nr, nr);
    applyFlaw(run, p, ruleToFlaw(pick(r, rs), r), r);
    if (r() < config.bribeRate[run.dayIdx]) p.bribe = randInt(r, config.bribeAmount[0], config.bribeAmount[1]);
  }
  return p;
}

function storyPerson(run, s, r) {
  const fr = rng(hash(s.faceOf || s.id));
  let f = run.faces[s.faceOf || s.id];
  if (!f) {
    const src = s.faceOf ? data.story.find((x) => x.id === s.faceOf) : s;
    f = face.withParts(fr, src.face);
    run.faces[s.faceOf || s.id] = f;
  }
  const p = basePerson(run, r, s.name, f);
  p.line = s.line;
  p.item = s.item;
  p.story = s;
  if (s.flaw) applyFlaw(run, p, s.flaw, r, { gap: s.gap, altName: s.altName, keepLine: true });
  p.bribe = s.bribe || 0;
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
    if (fx) queue.push(genericPerson(run, r, !!fx.flaw, fx.flaw));
    else queue.push(genericPerson(run, r, r() < config.invalidRate[di]));
  }
  // 故事人物按顺序插进去
  data.story
    .filter((s) => s.day === di + 1 && meets(run.flags, s.need))
    .sort((a, b) => a.at - b.at)
    .forEach((s) => queue.splice(Math.min(s.at, queue.length), 0, storyPerson(run, s, r)));
  const day = {
    idx: di,
    date: dd.date,
    timeLeft: config.daySec[di],
    queue,
    qi: 0,
    r,
    ledger: { n: 0, correct: 0, wrong: 0, pay: 0, evidence: 0, fines: 0, drawer: 0, events: [] },
    startEvents: [],
    endEvents: [],
    adsLeft: config.fileAdsPerDay,
    overtimeUsed: false,
    gifts: {},
    log: [],
  };
  data.events.filter((e) => e.day === di + 1 && e.when === 'start' && meets(run.flags, e.need)).forEach((e) => {
    day.startEvents.push(e);
    day.ledger.events.push({ title: e.title, money: e.money });
  });
  return day;
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

// 判一个人。decision: 'pass' | 'reject'；marks：玩家圈了哪些格；took：收没收钱
function resolve(run, day, p, decision, marks, took) {
  marks = marks || [];
  const invalid = !!p.flaw;
  const correct = (decision === 'reject') === invalid;
  const evidence = correct && invalid && marks.some((m) => p.flaw.fields.indexOf(m) >= 0);
  const L = day.ledger;
  L.n += 1;
  let delta = 0;
  if (correct) {
    L.correct += 1;
    L.pay += config.pay.correct;
    delta += config.pay.correct;
    if (evidence) {
      L.evidence += config.pay.evidence;
      delta += config.pay.evidence;
    }
  } else {
    L.wrong += 1;
    L.fines += config.pay.fine;
    delta -= config.pay.fine;
  }
  if (took && p.bribe) {
    L.drawer += p.bribe;
    run.stats.bribes += p.bribe;
  }
  const S = run.stats;
  S.total += 1;
  if (correct) S.correct += 1;
  else {
    S.wrong += 1;
    const k = invalid ? p.flaw.kind : 'clean';
    S.missed[k] = (S.missed[k] || 0) + 1;
  }
  if (evidence) S.evidence += 1;
  if (p.story) {
    const id = p.story.id;
    run.flags[id + (decision === 'pass' ? '_pass' : '_reject')] = true;
    if (p.bribe) run.flags[id + (took ? '_took' : '_refused')] = true;
    if (p.story.setFlag) run.flags[p.story.setFlag] = true;
    if (p.story.gift) day.gifts[p.story.gift] = true;
  }
  const res = { correct, evidence, delta, decision, invalid, reason: explain(p), wrongMarks: wrongMarks(p, marks), took: !!(took && p.bribe) };
  day.log.push({ name: p.name, story: p.story && p.story.id, decision, correct, evidence, flaw: p.flaw && p.flaw.kind });
  return res;
}

function explain(p) {
  const e = data.explain;
  if (!p.flaw) return e.clean;
  const f = p.flaw;
  return fill(e[f.kind], f.a, f.b);
}

function wrongMarks(p, marks) {
  const ok = p.flaw ? p.flaw.fields : [];
  return marks.filter((m) => ok.indexOf(m) < 0).map((m) => fill(data.wrongMark, data.fieldNames[m] || m));
}

// 下班：把今天的事件（下班后那种）算进来
function closeDay(run, day) {
  data.events.filter((e) => e.day === day.idx + 1 && e.when === 'end' && meets(run.flags, e.need)).forEach((e) => {
    if (day.endEvents.indexOf(e) >= 0) return;
    day.endEvents.push(e);
    day.ledger.events.push({ title: e.title, money: e.money });
  });
}

function income(day) {
  const L = day.ledger;
  return L.pay + L.evidence - L.fines + L.drawer + L.events.reduce((s, e) => s + e.money, 0);
}

function billCost(day, id) {
  return day.gifts[id] ? 0 : config.bills[id][day.idx];
}

function billsTotal(day) {
  return data.bills.reduce((s, b) => s + billCost(day, b.id), 0);
}

// 默认付哪些：按 data.bills 的顺序（药 → 饭 → 房租），付得起就付
function defaultPaid(run, day) {
  let left = run.money + income(day);
  const paid = {};
  data.bills.forEach((b) => {
    const c = billCost(day, b.id);
    if (left >= c) {
      paid[b.id] = true;
      left -= c;
    } else paid[b.id] = false;
  });
  return paid;
}

// 付账、过夜。返回今晚家里的几句话
function settle(run, day, paid) {
  run.money += income(day);
  const lines = [];
  data.bills.forEach((b) => {
    const c = billCost(day, b.id);
    if (paid[b.id] && run.money >= c) {
      run.money -= c;
      run.miss[b.id] = 0;
      if (day.gifts[b.id]) lines.push({ text: '阿梅的橘子：今晚不用买菜。', good: true });
      else if (b.ok) lines.push({ text: b.ok, good: true });
    } else {
      run.miss[b.id] += 1;
      lines.push({ text: run.miss[b.id] >= config.missLimit ? b.miss2 : b.miss, good: false });
      if (run.miss[b.id] >= config.missLimit && !run.over) run.over = { bill: b.id, text: b.miss2 };
    }
  });
  const L = day.ledger;
  run.stats.days.push({ day: day.idx + 1, n: L.n, correct: L.correct, wrong: L.wrong, income: income(day), money: run.money, queue: day.queue.length, overtime: day.overtimeUsed });
  return lines;
}

function nextDay(run) {
  run.dayIdx += 1;
  return run.dayIdx < config.days && !run.over;
}

function endingLines(run) {
  return data.endings.filter((e) => meets(run.flags, e.need)).map((e) => e.line);
}

function mostMissed(run) {
  let best = null;
  Object.keys(run.stats.missed).forEach((k) => {
    if (!best || run.stats.missed[k] > run.stats.missed[best]) best = k;
  });
  return best;
}

// 机器人用：只看证件上写的东西 + 今天的规则来判（不偷看答案）
function checkByRules(run, p) {
  const d = p.docs;
  const t = today(run);
  const rs = rules(run);
  for (let i = 0; i < rs.length; i++) {
    const k = rs[i];
    if (k === 'expiry' && d.pass.until < t) return 'pass.until';
    if (k === 'name' && d.id.name !== d.pass.name) return 'pass.name';
    if (k === 'photo' && !face.same(d.id.photo, p.face)) return 'id.photo';
    if (k === 'seal' && (d.pass.seal.shape !== data.seal.shape || d.pass.seal.color !== data.seal.color)) return 'pass.seal';
    if (k === 'permit' && !d.permit) return 'permit.slot';
    if (k === 'permit' && d.permit.date !== t) return 'permit.date';
  }
  return null;
}

module.exports = {
  newRun, startDay, current, resolve, addOvertime, closeDay, income, billCost, billsTotal,
  defaultPaid, settle, nextDay, endingLines, mostMissed, checkByRules, today, rules, explain,
};
