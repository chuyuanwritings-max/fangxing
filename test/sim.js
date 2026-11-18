// 不开浏览器，直接用规则层（js/day.js）把 12 天跑几百局，看难度、钱、家里人、哪些暗线被触发。
// 用法：node test/sim.js [每种打法几局，默认 300]
// 打法 = 查证方式 × 花钱方式：
//   查证：random 乱判（瞎拉线、钱一半收、选项乱选）/ rules 照规则查（拉对那根线，第 2 章照片不像就按手印，不收钱）
//   花钱：care 顾家（先给重病的买药，再病的、饭、暖气，钱不够加班或翻倍）/ neglect 不管家（只交房租，钱全攒着）
// 时间模型：每个人 = 想的时间 + 走路递证盖章的动画 + 每拉一根线 1.2 秒 + 按手印的动画；一天的秒数用完就下班。
const config = require('../js/config.js');
const D = require('../js/day.js');
const story = require('../js/story.js');

const an = config.anim;
const ANIM = an.walkIn + an.docsIn + an.stampSec + an.leave;
const LINE_SEC = 1.2;
const THINK = {
  random: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  rules: [7, 7, 6.5, 6.5, 6, 6, 7.5, 7, 7, 6.5, 6.5, 6.5],
  human: [10, 9.5, 9, 9, 8.5, 8.5, 10, 9.5, 9, 9, 8.5, 8.5],
};

function playDay(run, day, pol, r, timeAvail) {
  let t = timeAvail;
  for (;;) {
    const p = D.current(day);
    if (!p) break;
    if (p.story && p.story.kind === 'talk') {
      const cost = 3 + an.walkIn + an.leave + an.leaveLineSec;
      if (t < 3) break;
      t -= cost;
      const cs = p.story.choices;
      const pick = pol.judge === 'random' ? cs[Math.floor(r() * cs.length)] : cs[pol.talk === 'yes' ? 0 : cs.length - 1];
      D.talkChoice(run, day, p, pick.id);
      day.qi++;
      if (t <= 0) break;
      continue;
    }
    const think = THINK[pol.judge][day.idx];
    if (t < think) break;
    let cost = think + ANIM + (p.story ? an.leaveLineSec : 0);
    let dec;
    let took = false;
    if (pol.judge === 'random') {
      if (r() < 0.5) {
        const pairs = [['id.photo', 'face'], ['id.name', 'pass.name'], ['pass.until', 'chip.expiry'], ['pass.seal', 'chip.seal']];
        const pr = pairs[Math.floor(r() * pairs.length)];
        D.link(run, p, pr[0], pr[1]);
        cost += LINE_SEC;
      }
      dec = r() < 0.5 ? 'pass' : 'reject';
      took = r() < 0.5;
    } else {
      const a = D.checkByRules(run, p);
      if (pol.judge === 'human' && r() < 0.08) {
        // 像真人：偶尔看漏 / 看错
        dec = a ? 'pass' : 'reject';
        t -= cost;
        D.resolve(run, day, p, dec, false);
        day.qi++;
        if (t <= 0) break;
        continue;
      }
      dec = 'pass';
      if (a) {
        D.link(run, p, a.link[0], a.link[1]);
        cost += LINE_SEC;
        if (a.needPrint) {
          cost += an.printSec;
          dec = D.takePrint(run, p) ? 'pass' : 'reject';
        } else dec = 'reject';
      }
      took = pol.bribe === 'take';
    }
    t -= cost;
    D.resolve(run, day, p, dec, took);
    day.qi++;
    if (t <= 0) break;
  }
}

// 顾家：先救重病，再治病，再吃饭，再暖气；不管家：一分不花
function buy(run, day, pol) {
  const c = D.costs(run, day);
  const b = { heat: false, food: false, med: {}, tuition: false, doctor: null };
  if (pol.spend === 'neglect') return b;
  let left = run.money - c.rent;
  const sick = D.needsMed(run).sort((x, y) => run.fam[y].sick - run.fam[x].sick);
  if (pol.ads) {
    const grave = sick.find((id) => run.fam[id].sick >= 2);
    if (grave && !(run.doctorUsed[D.chapter(run)] >= config.doctorPerChapter)) b.doctor = grave;
  }
  sick.forEach((id) => {
    const p = id === 'nan' ? c.medNan : c.med;
    if (left >= p) {
      b.med[id] = true;
      left -= p;
    }
  });
  if (left >= c.food) {
    b.food = true;
    left -= c.food;
  }
  if (left >= c.heat) {
    b.heat = true;
    left -= c.heat;
  }
  return b;
}

function needTotal(run, day) {
  const c = D.costs(run, day);
  return c.rent + c.heat + c.food + D.needsMed(run).reduce((s, id) => s + (id === 'nan' ? c.medNan : c.med), 0);
}

function runOne(seed, pol) {
  let rs = seed * 7919 + 13;
  const r = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  const run = D.newRun(seed);
  const out = { shortNights: 0, nights: 0, ot: 0, dbl: 0, doctor: 0 };
  for (let d = 0; d < D.DAYS; d++) {
    const day = D.startDay(run);
    playDay(run, day, pol, r, day.timeLeft);
    D.closeDay(run, day);
    if (pol.ads && run.money + D.income(day) < needTotal(run, day)) {
      if (r() < 0.5) {
        D.addOvertime(run, day);
        playDay(run, day, pol, r, config.overtimeSec);
        out.ot++;
      } else {
        D.applyDouble(day);
        out.dbl++;
      }
    }
    if (pol.ads) while (D.appealOne(day));
    run.money += D.income(day);
    if (run.money < needTotal(run, day)) out.shortNights++;
    out.nights++;
    const b = buy(run, day, pol);
    if (b.doctor) out.doctor++;
    D.sleep(run, day, b);
    if (!D.nextDay(run)) break;
  }
  out.run = run;
  return out;
}

const ARCS = {
  阿梅赶上: 'amei1_pass', 托孤小豆: 'dou_adopt', 钱老板收钱: 'qian1_took', 钱老板出城证: 'qian_exit_offer', 学校消息: 'school_tip',
  顾一记档: 'grey_record', 小树留照片: 'tree_photo', 阿青进城: 'qing_pass', 老韩冤枉人: 'han_yes', 老韩拘人: 'han_detain',
  药贩交易: 'drug2_took', 假药: 'drug_bad', 周婆婆进城: 'zhou_pass', 小满晚归: 'man_errand',
};

function sim(name, pol, n) {
  let acc = 0, money = 0, done = 0, evicted = 0, short = 0, nights = 0;
  const deaths = { nan: 0, man: 0, dou: 0, yuan: 0 };
  const words = {};
  const arcs = {};
  let ads = { ot: 0, dbl: 0, doctor: 0 };
  let anyDeath = 0;
  for (let s = 1; s <= n; s++) {
    const o = runOne(s, pol);
    const run = o.run;
    acc += run.stats.correct / Math.max(1, run.stats.total);
    money += run.money;
    if (run.over) evicted++;
    else if (run.dayIdx >= D.DAYS - 1) done++;
    short += o.shortNights;
    nights += o.nights;
    ads.ot += o.ot; ads.dbl += o.dbl; ads.doctor += o.doctor;
    if (run.stats.deaths.length) anyDeath++;
    run.stats.deaths.forEach((x) => (deaths[x.id] += 1));
    run.stats.days.forEach((d) => Object.keys(d.words).forEach((id) => {
      const w = d.words[id];
      words[w] = (words[w] || 0) + 1;
    }));
    Object.keys(ARCS).forEach((k) => { if (run.flags[ARCS[k]]) arcs[k] = (arcs[k] || 0) + 1; });
  }
  const pc = (x) => Math.round((x / n) * 100) + '%';
  console.log('【' + name + '】' + n + ' 局');
  console.log('  判对 ' + Math.round((acc / n) * 100) + '% · 12 天撑完 ' + pc(done) + ' · 被赶出门 ' + pc(evicted) + ' · 结束存款均 ¥' + Math.round(money / n) + ' · 钱不够付全部需要的夜 ' + Math.round((short / Math.max(1, nights)) * 100) + '%');
  console.log('  有家人走了的局 ' + pc(anyDeath) + '（外婆 ' + deaths.nan + ' · 小满 ' + deaths.man + ' · 小豆 ' + deaths.dou + '）');
  const tw = Object.values(words).reduce((a, b) => a + b, 0) || 1;
  console.log('  每晚家人状态占比：' + Object.keys(words).sort().map((k) => k + ' ' + Math.round((words[k] / tw) * 100) + '%').join(' · '));
  if (pol.ads) console.log('  广告：加班 ' + ads.ot + ' · 翻倍 ' + ads.dbl + ' · 夜诊 ' + ads.doctor + '（共 ' + n + ' 局）');
  console.log('  暗线触发：' + Object.keys(ARCS).map((k) => k + ' ' + pc(arcs[k] || 0)).join(' · '));
}

const N = +process.argv[2] || 300;
const POL = {
  '乱判 × 不管家': { judge: 'random', spend: 'neglect' },
  '乱判 × 顾家': { judge: 'random', spend: 'care' },
  '照规则 × 不管家': { judge: 'rules', spend: 'neglect', talk: 'no' },
  '照规则 × 顾家（不看广告）': { judge: 'rules', spend: 'care', talk: 'no' },
  '照规则 × 顾家 + 救急广告': { judge: 'rules', spend: 'care', talk: 'no', ads: true },
  '照规则 × 顾家 × 收钱答应': { judge: 'rules', spend: 'care', talk: 'yes', bribe: 'take' },
  '像真人（慢一点、错 8%）× 顾家': { judge: 'human', spend: 'care', talk: 'no' },
  '像真人 × 顾家 + 救急广告': { judge: 'human', spend: 'care', talk: 'no', ads: true },
};
Object.keys(POL).forEach((k) => sim(k, POL[k], N));
if (story.beats.length) console.log('\n（回头客来访 ' + story.beats.length + ' 条；报纸 ' + story.papers.length + ' 条）');
