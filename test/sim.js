// 不开浏览器，直接用规则层（js/day.js）跑几百局，看难度。用法：node test/sim.js
// 时间模型：每个人 = 想的时间 + 走路递证盖章的动画时间；一天的秒数用完就下班。
const config = require('../js/config.js');
const D = require('../js/day.js');
const data = require('../js/data.js');

const an = config.anim;
const ANIM = an.walkIn + an.docsIn + an.stampSec + an.leave;
const POLICIES = {
  乱滑: { think: [3, 3, 3], judge: 'random', ads: false },
  照规则查_慢: { think: [6.5, 8, 9.5], judge: 'rules', ads: true },
  照规则查_快: { think: [4.5, 5.5, 6.5], judge: 'rules', ads: false },
  忘了新规则: { think: [5.5, 6.5, 7.5], judge: 'forget', ads: true },
  每天错两个: { think: [5.5, 6.5, 7.5], judge: 'two', ads: true },
};

function playDay(run, day, pol, r, timeAvail) {
  let t = timeAvail;
  let wrongLeft = 2;
  for (;;) {
    const p = D.current(day);
    if (!p) break;
    const cost = pol.think[day.idx] + ANIM + (p.story ? an.leaveLineSec : 0);
    if (t < pol.think[day.idx]) break; // 来不及判这个人了
    t -= cost;
    let ans;
    if (pol.judge === 'random') ans = r() < 0.5 ? 'x' : null;
    else {
      ans = D.checkByRules(run, p);
      if (pol.judge === 'forget' && p.flaw && p.flaw.kind.indexOf(data.days[day.idx].newRule || 'none') === 0) ans = null;
      if (pol.judge === 'two' && wrongLeft > 0 && r() < 0.25) { ans = ans ? null : 'x'; wrongLeft--; }
    }
    const marks = ans && ans !== 'x' ? [ans] : [];
    D.resolve(run, day, p, ans ? 'reject' : 'pass', marks, pol.judge === 'random' && r() < 0.5);
    day.qi++;
    if (t <= 0) break;
  }
}

function sim(name, pol, n) {
  let acc = 0, done = 0, money = 0, shortDays = 0, otUsed = 0, days = 0;
  for (let s = 1; s <= n; s++) {
    let rs = s * 7919;
    const r = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
    const run = D.newRun(s);
    for (let d = 0; d < 3; d++) {
      const day = D.startDay(run);
      playDay(run, day, pol, r, day.timeLeft);
      D.closeDay(run, day);
      const short = run.money + D.income(day) < D.billsTotal(day);
      if (short && pol.ads) { D.addOvertime(run, day); playDay(run, day, pol, r, config.overtimeSec); otUsed++; }
      if (run.money + D.income(day) < D.billsTotal(day)) shortDays++;
      days++;
      D.settle(run, day, D.defaultPaid(run, day));
      if (!D.nextDay(run)) break;
    }
    acc += run.stats.correct / Math.max(1, run.stats.total);
    if (!run.over) done++;
    money += run.money;
  }
  console.log(name.padEnd(8, '　') + ' 判对 ' + Math.round((acc / n) * 100) + '% · 三天撑下来 ' + Math.round((done / n) * 100) + '% · 结束存款均 ¥' + Math.round(money / n) + ' · 付不起全部账的天 ' + Math.round((shortDays / days) * 100) + '% · 用加班 ' + otUsed + ' 次/' + n + '局');
}

const N = +process.argv[2] || 300;
console.log('每种打法 ' + N + ' 局：');
Object.keys(POLICIES).forEach((k) => sim(k, POLICIES[k], N));
