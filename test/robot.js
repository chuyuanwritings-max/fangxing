// 测试机器人：在 iPhone 大小的浏览器里用真的点击、滑动玩完三天，两种打法各一局。
//   random：瞎滑、瞎圈、钱一半收一半推
//   rules ：只看证件上写的东西 + 当天规则来判（不偷看答案），像个认真但不算快的人
// 用法：node test/robot.js   截图在 test/shots/
const { chromium } = require('/Users/chuyuannc/Downloads/Cursor/Kira/06_游戏设计/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const SPEED = 4; // 游戏时间加速几倍（只为了测得快；思考时间按游戏秒算）
const THINK = { random: [3, 3, 3], rules: [6.5, 8, 9.5] }; // 每个人想多久（游戏秒）

(async () => {
  const shots = path.join(__dirname, 'shots');
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'preview.html'));
  await page.waitForTimeout(500);
  const ok = [];
  const check = (cond, msg) => { if (!cond) throw new Error('没通过：' + msg); ok.push(msg); };
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = await g(() => __fx.scale);
  const LY = await g(() => __fx.LY);
  const snap = (n) => page.screenshot({ path: path.join(shots, n + '.png') });
  const mode = () => g(() => __fx.G.mode);
  const clickAt = async (x, y) => { await page.mouse.click(x * S, y * S); await page.waitForTimeout(60); };
  const clickBtn = async (id) => {
    const b = await g((i) => __fx.G.buttons.find((x) => x.id === i), id);
    if (!b) throw new Error('找不到按钮 ' + id + '（' + (await mode()) + '）');
    await clickAt(b.x + b.w / 2, b.y + b.h / 2);
  };
  const clickField = async (fid) => {
    const r = await g((f) => __fx.fieldRect(f), fid);
    await clickAt(r[0] + r[2] / 2, r[1] + r[3] / 2);
  };
  const swipe = async (dir) => {
    const y = (LY.deskY + 60) * S;
    const x0 = 187 * S;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(x0 + dir * k * 20 * S, y + k);
    await page.mouse.up();
  };
  const waitGame = async (sec) => {
    const t0 = await g(() => __fx.G.t);
    await page.waitForFunction((t) => __fx.G.t >= t || __fx.G.mode !== 'work', t0 + sec, { polling: 30, timeout: 60000 });
  };

  await snap('01_开场');
  check((await mode()) === 'title', '打开先是开场');

  async function playRun(policy) {
    const tag = policy === 'rules' ? 'b' : 'a';
    let rnd = policy === 'rules' ? 1 : 7;
    const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
    await clickBtn('start');
    await g((s) => { __fx.G.timeScale = s; }, SPEED);
    const days = [];
    let firstSwipe = true;
    let shotFlags = {};
    for (let d = 0; d < 3; d++) {
      await page.waitForFunction(() => __fx.G.mode === 'brief', null, { timeout: 10000 });
      await page.waitForTimeout(500);
      await snap(tag + '_d' + (d + 1) + '_0上班前');
      await clickBtn('open');
      check((await mode()) === 'work', policy + ' 第 ' + (d + 1) + ' 天：点「开窗」开始上班');
      let shotDone = 0;
      for (;;) {
        await page.waitForFunction(() => {
          const G = __fx.G;
          return (G.mode === 'work' && G.ph === 'check' && !G.modal) || G.mode === 'slip' || G.mode === 'closing' || G.mode === 'event' || G.mode === 'ledger';
        }, null, { polling: 30, timeout: 60000 });
        const m = await mode();
        if (m === 'slip') {
          if (!shotFlags.slip) { shotFlags.slip = 1; await page.waitForTimeout(250); await snap(tag + '_罚单'); }
          await page.waitForTimeout(450);
          await clickAt(187, 200);
          continue;
        }
        if (m !== 'work') break;
        const info = await g(() => {
          const { G, D } = __fx;
          return { answer: D.checkByRules(G.run, G.cur), bribe: G.bribe, fields: __fx.presentFields(), n: G.day.ledger.n, qi: G.day.qi, story: G.cur.story && G.cur.story.id, permit: !!G.cur.docs.permit };
        });
        await waitGame(THINK[policy][d] * 0.5);
        if ((await mode()) !== 'work') continue;
        // 单击只算一次
        if (policy === 'rules' && d === 0 && info.qi === 0) {
          await clickField('id.photo');
          const n1 = await g(() => __fx.G.marks.length);
          await clickField('id.photo');
          const n2 = await g(() => __fx.G.marks.length);
          check(n1 === 1 && n2 === 0, '点一下圈上、再点一下取消（一次点击只算一次）');
          await snap('b_教学');
        }
        // 规则卡
        if (policy === 'rules' && d === 1 && info.qi === 0) {
          await clickAt(40, LY.chipsY + 12);
          check((await g(() => __fx.G.modal)) === 'rules', '点规则条打开规则');
          await page.waitForTimeout(150);
          await snap('b_d2_规则');
          await clickAt(187, 400);
        }
        // 档案（激励视频）
        if (policy === 'rules' && d === 1 && info.qi === 2) {
          await clickBtn('file');
          check((await mode()) === 'ad', '调出档案：先放广告占位');
          await page.waitForTimeout(600);
          await snap('b_d2_广告占位');
          await page.waitForFunction(() => __fx.G.mode === 'folder', null, { timeout: 5000 });
          await page.waitForTimeout(80);
          await snap('b_d2_档案袋');
          await page.waitForFunction(() => __fx.G.mode === 'work' && __fx.G.hl, null, { timeout: 5000 });
          const hl = await g(() => __fx.G.hl);
          const flaw = await g(() => __fx.G.cur.flaw && __fx.G.cur.flaw.fields[0]);
          check(hl.clean ? !flaw : hl.fields[0] === flaw, '档案高亮的正是那处破绽（或说没问题）');
          await page.waitForTimeout(200);
          await snap('b_d2_档案高亮');
        }
        // 夹钱
        if (info.bribe === 'pending') {
          const r = await g(() => __fx.billRect());
          await clickAt(r[0] + r[2] / 2, r[1] + r[3] / 2);
          if (!shotFlags.bribe) { shotFlags.bribe = 1; await page.waitForTimeout(150); await snap(tag + '_夹钱'); }
          const take = policy === 'random' ? rand() < 0.5 : false;
          await clickBtn(take ? 'take' : 'refuse');
        }
        let dir;
        if (policy === 'rules') {
          if (info.answer) await clickField(info.answer);
          dir = info.answer ? -1 : 1;
        } else {
          if (rand() < 0.5) await clickField(info.fields[Math.floor(rand() * info.fields.length)]);
          dir = rand() < 0.5 ? -1 : 1;
        }
        if (info.story === 'amei' && !shotFlags.amei) { shotFlags.amei = 1; await snap(tag + '_阿梅'); }
        if (d === 2 && !shotFlags.d3) { shotFlags.d3 = 1; await snap(tag + '_d3_当日许可'); }
        await waitGame(THINK[policy][d] * 0.5);
        if ((await g(() => __fx.G.mode !== 'work' || __fx.G.ph !== 'check'))) continue;
        if (shotDone === 1 && tag === 'b' && d === 0) await snap('b_d1_圈好');
        await swipe(dir);
        await page.waitForTimeout(Math.round((0.15 / SPEED) * 1000) + 20);
        if (shotDone === 1 && d === 0) { await page.waitForTimeout(10); await snap(tag + '_d1_盖章'); }
        shotDone++;
        const n2 = await g(() => __fx.G.day.ledger.n);
        if (firstSwipe) { check(n2 === info.n + 1, policy + '：滑一下 = 盖一个章（不多不少）'); firstSwipe = false; }
      }
      // 下班 → 事件 → 记账
      await page.waitForFunction(() => ['closing', 'event', 'ledger'].includes(__fx.G.mode), null, { timeout: 30000 });
      if ((await mode()) === 'closing') { await page.waitForTimeout(150); await snap(tag + '_d' + (d + 1) + '_下班'); }
      for (;;) {
        await page.waitForFunction(() => ['event', 'ledger'].includes(__fx.G.mode), null, { timeout: 30000 });
        if ((await mode()) === 'ledger') break;
        await page.waitForTimeout(300);
        await snap(tag + '_事件');
        await page.waitForTimeout(400);
        await clickAt(187, 600);
      }
      await page.waitForTimeout(1600 / 1);
      await snap(tag + '_d' + (d + 1) + '_记账');
      let led = await g(() => { const { G, D } = __fx; return { inc: D.income(G.day), money: G.run.money, bills: D.billsTotal(G.day), ot: !!G.buttons.find((b) => b.id === 'overtime'), L: G.day.ledger, queue: G.day.queue.length }; });
      const rec = { day: d + 1, n: led.L.n, correct: led.L.correct, wrong: led.L.wrong, queue: led.queue, income: led.inc, overtime: false };
      if (led.ot && policy === 'rules') {
        rec.overtime = true;
        await clickBtn('overtime');
        check((await mode()) === 'ad', '钱不够：加班一小时先放广告占位');
        await page.waitForFunction(() => __fx.G.mode === 'work', null, { timeout: 5000 });
        check(true, '看完广告回去加班');
        // 加班：同样的打法
        for (;;) {
          await page.waitForFunction(() => { const G = __fx.G; return (G.mode === 'work' && G.ph === 'check' && !G.modal) || ['slip', 'closing', 'event', 'ledger'].includes(G.mode); }, null, { polling: 30, timeout: 60000 });
          const m = await mode();
          if (m === 'slip') { await page.waitForTimeout(450); await clickAt(187, 200); continue; }
          if (m !== 'work') break;
          const info = await g(() => ({ answer: __fx.D.checkByRules(__fx.G.run, __fx.G.cur), bribe: __fx.G.bribe }));
          await waitGame(THINK.rules[d]);
          if ((await g(() => __fx.G.mode !== 'work' || __fx.G.ph !== 'check'))) continue;
          if (info.bribe === 'pending') { const r = await g(() => __fx.billRect()); await clickAt(r[0] + r[2] / 2, r[1] + r[3] / 2); await clickBtn('refuse'); }
          if (info.answer) await clickField(info.answer);
          await swipe(info.answer ? -1 : 1);
          await page.waitForTimeout(80);
        }
        await page.waitForFunction(() => __fx.G.mode === 'ledger', null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        await snap(tag + '_d' + (d + 1) + '_加班后记账');
        led = await g(() => { const { G, D } = __fx; return { inc: D.income(G.day), money: G.run.money, bills: D.billsTotal(G.day), L: G.day.ledger, queue: G.day.queue.length }; });
        Object.assign(rec, { n: led.L.n, correct: led.L.correct, wrong: led.L.wrong, queue: led.queue, income: led.inc });
      }
      rec.canPay = led.money + led.inc >= led.bills;
      await clickBtn('home');
      await page.waitForTimeout(1300);
      await snap(tag + '_d' + (d + 1) + '_夜');
      rec.moneyAfter = await g(() => __fx.G.run.money);
      rec.missed = await g(() => Object.assign({}, __fx.G.run.miss));
      days.push(rec);
      await clickAt(187, 600);
      if ((await mode()) === 'ending') break;
    }
    await page.waitForFunction(() => __fx.G.mode === 'ending', null, { timeout: 10000 });
    await page.waitForTimeout(300);
    await snap(tag + '_结局');
    const end = await g(() => ({ s: __fx.G.run.stats, money: __fx.G.run.money, over: __fx.G.run.over, lines: __fx.D.endingLines(__fx.G.run) }));
    await clickBtn('again');
    return { days, end };
  }

  const R = {};
  for (const pol of ['random', 'rules']) {
    R[pol] = await playRun(pol);
    check((await mode()) === 'title', pol + '：结局点「再上一次岗」回开场');
  }
  // 加班：第 1 天一个人都不查，等下班 → 钱不够 → 加班一小时（广告占位）→ 回去接着查
  await clickBtn('start');
  await page.waitForFunction(() => __fx.G.mode === 'brief');
  await clickBtn('open');
  await g(() => { __fx.G.timeScale = 30; });
  await page.waitForFunction(() => __fx.G.mode === 'ledger', null, { timeout: 30000 });
  await g(() => { __fx.G.timeScale = 1; });
  await page.waitForTimeout(1500);
  await snap('c_钱不够');
  await clickBtn('overtime');
  check((await mode()) === 'ad', '钱不够：「加班一小时」先放广告占位');
  await page.waitForTimeout(500);
  await snap('c_加班广告');
  await page.waitForFunction(() => __fx.G.mode === 'work', null, { timeout: 5000 });
  const ot = await g(() => ({ t: __fx.G.day.timeLeft, used: __fx.G.day.overtimeUsed }));
  check(ot.used && ot.t > 30, '看完广告：回窗口多查 ' + Math.round(ot.t) + ' 秒');
  await page.waitForTimeout(1200);
  await snap('c_加班中');

  // 小屏（iPhone SE）也排得下
  await page.setViewportSize({ width: 375, height: 667 });
  await page.reload();
  await page.waitForTimeout(400);
  await clickBtn('start');
  await clickBtn('open');
  await page.waitForFunction(() => __fx.G.ph === 'check', null, { timeout: 5000 });
  await page.waitForTimeout(300);
  await snap('d_小屏');
  const fit = await g(() => { const { LY } = __fx; return LY.docs.permit.y + 86 < LY.ctrlTop; });
  check(fit, '小屏上证件不压按钮');

  check(errors.length === 0, '没有报错' + (errors.length ? '：' + errors.join(' | ') : ''));
  await browser.close();
  console.log(ok.map((m) => '✓ ' + m).join('\n'));
  console.log('共 ' + ok.length + ' 项\n');
  for (const pol of ['random', 'rules']) {
    const { days, end } = R[pol];
    const acc = end.s.total ? Math.round((end.s.correct / end.s.total) * 100) : 0;
    console.log('【' + (pol === 'random' ? '乱滑' : '照规则查') + '】判对 ' + end.s.correct + '/' + end.s.total + '（' + acc + '%），查实 ' + end.s.evidence + '，收钱 ¥' + end.s.bribes + '，最后存款 ¥' + end.money + (end.over ? '，出事：' + end.over.text : ''));
    days.forEach((d) => console.log('  第 ' + d.day + ' 天：查 ' + d.n + '/' + d.queue + ' 人，对 ' + d.correct + ' 错 ' + d.wrong + '，进账 ' + d.income + (d.overtime ? '（加班）' : '') + '，付得起全部账：' + (d.canPay ? '是' : '否') + '，夜里存款 ' + d.moneyAfter + '，欠账 ' + JSON.stringify(d.missed)));
    console.log('  ' + end.lines.join(' / '));
  }
  fs.writeFileSync(path.join(shots, 'result.json'), JSON.stringify(R, null, 1));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
