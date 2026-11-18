// 测试机器人：在 iPhone 大小的浏览器里用真的按下、拖动、松开玩完 12 天。
//   a 局：乱判（瞎拉线、钱一半收、选项乱选）× 不管家（只交房租）
//   b 局：照规则查（拉对那根线，第 2 章照片不像就按手印，不收钱）× 顾家（先买药，再饭、暖气；钱不够看救急广告）
// 然后测：存档续玩、第 1 章通关解锁第 2 章、375×600 矮屏。截图在 test/shots/（不进 git）。
// 用法：node test/robot.js
const { chromium } = require('/Users/chuyuannc/Downloads/Cursor/Kira/06_游戏设计/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const SPEED = 8; // 游戏时间加速几倍（只为了测得快；想的时间按游戏秒算）
const THINK = { random: 2.5, rules: 6 };
const TALK_RULES = { han1: 'yes', han2: 'no', amei3: 'yes', han3a: 'no' };

(async () => {
  const shots = path.join(__dirname, 'shots');
  fs.mkdirSync(shots, { recursive: true });
  fs.readdirSync(shots).forEach((f) => fs.unlinkSync(path.join(shots, f)));
  const browser = await chromium.launch();
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctxB.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const url = 'file://' + path.join(__dirname, '..', 'preview.html');
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
  const ok = [];
  const check = (cond, msg) => { if (!cond) throw new Error('没通过：' + msg); if (ok.indexOf(msg) < 0) ok.push(msg); };
  const g = (fn, arg) => page.evaluate(fn, arg);
  let S = await g(() => __fx.scale);
  const snap = (n) => page.screenshot({ path: path.join(shots, n + '.png') });
  const shot = {};
  // 截图时先把游戏放回正常速度，免得一闪而过的画面（罚单、手印）截不到
  const snapOnce = async (n, wait) => {
    if (shot[n]) return;
    shot[n] = 1;
    const ts = await g(() => __fx.G.timeScale);
    await g(() => { __fx.G.timeScale = 1; });
    if (wait) await page.waitForTimeout(wait);
    await snap(n);
    await g((v) => { __fx.G.timeScale = v; }, ts);
  };
  const mode = () => g(() => __fx.G.mode);
  const clickAt = async (x, y) => { await page.mouse.click(x * S, y * S); await page.waitForTimeout(40); };
  const btn = (id) => g((i) => __fx.G.buttons.find((x) => x.id === i && !x.disabled), id);
  const clickBtn = async (id) => {
    const b = await btn(id);
    if (!b) throw new Error('找不到按钮 ' + id + '（' + (await mode()) + '）');
    await clickAt(b.x + b.w / 2, b.y + b.h / 2);
  };
  const drag = async (a, b) => {
    const c = await g((ab) => [__fx.W.center(ab[0]), __fx.W.center(ab[1])], [a, b]);
    await page.mouse.move(c[0][0] * S, c[0][1] * S);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move((c[0][0] + ((c[1][0] - c[0][0]) * k) / 8) * S, (c[0][1] + ((c[1][1] - c[0][1]) * k) / 8) * S);
    await page.mouse.up();
    await page.waitForTimeout(30);
  };
  const waitGame = async (sec) => {
    const t0 = await g(() => __fx.G.t);
    await page.waitForFunction((t) => __fx.G.t >= t || __fx.G.mode !== 'work' || __fx.G.ph !== 'check', t0 + sec, { polling: 30, timeout: 60000 });
  };
  const waitMode = (ms, timeout) => page.waitForFunction((m) => m.indexOf(__fx.G.mode) >= 0, ms, { polling: 40, timeout: timeout || 60000 });

  await snap('00_开场');
  check((await mode()) === 'title', '打开先是开场');

  // ———— 一局 12 天 ————
  async function playRun(judge, spend, tag) {
    let rnd = judge === 'rules' ? 11 : 7;
    const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
    await clickBtn((await btn('start')) ? 'start' : 'continue');
    const days = [];
    let firstLine = true;
    let evictions = 0;
    let learned = false; // 被赶出门后「学乖了」：这一天照规则查
    for (let d = 0; d < 12; d++) {
      await waitMode(['paper'], 20000);
      await g((s) => { __fx.G.timeScale = s; }, SPEED);
      const dayNo = await g(() => __fx.G.run.dayIdx + 1);
      if (dayNo !== d + 1) d = dayNo - 1;
      await page.waitForTimeout(1300 / 1);
      if ([1, 2, 4, 7, 9, 12].indexOf(dayNo) >= 0 || judge === 'rules') await snapOnce(tag + '_报纸_d' + dayNo);
      await clickBtn('go');
      const J = learned ? 'rules' : judge;
      for (;;) {
        await page.waitForFunction(() => {
          const G = __fx.G;
          return (G.mode === 'work' && (G.ph === 'check' || G.ph === 'talk') && !G.modal) || ['cite', 'closing', 'card', 'slip'].indexOf(G.mode) >= 0;
        }, null, { polling: 30, timeout: 60000 });
        const m = await mode();
        if (m === 'cite') {
          const c = await g(() => __fx.G.cite.res);
          await g(() => { __fx.G.timeScale = 1; });
          if (c.fine) await snapOnce('罚单章_罚', 1000);
          else await snapOnce('罚单章_警告', 1000);
          await g((v) => { __fx.G.timeScale = v; }, SPEED);
          await page.waitForTimeout(80);
          await clickAt(187, 300);
          continue;
        }
        if (m !== 'work') break;
        const info = await g(() => {
          const { G, D } = __fx;
          const p = G.cur;
          return { ph: G.ph, talk: !!(p.story && p.story.kind === 'talk'), story: p.story && p.story.id, ans: D.checkByRules(G.run, p), bribe: G.bribe, med: p.med, n: G.day.ledger.n, choices: p.story && p.story.choices ? p.story.choices.map((c) => c.id) : null, lines: p.story && p.story.lines ? p.story.lines.length : 0 };
        });
        if (info.talk) {
          for (let i = 0; i < 6; i++) {
            const st = await g(() => ({ step: __fx.G.talkStep, ph: __fx.G.ph, phT: __fx.G.phT }));
            if (st.ph !== 'talk' || st.step >= info.lines - 1) break;
            await page.waitForTimeout(120);
            await clickAt(187, __fx_boothY());
          }
          await page.waitForFunction(() => __fx.G.ph !== 'talk' || __fx.G.buttons.some((b) => b.id.indexOf('talk_') === 0), null, { timeout: 8000 });
          if ((await g(() => __fx.G.ph)) !== 'talk') continue;
          if (info.story === 'han2') await snapOnce('老韩_求你冤枉人', 100);
          if (info.story === 'amei3') await snapOnce('阿梅_托孤', 100);
          let cid = info.choices[info.choices.length - 1];
          if (J === 'random') cid = info.choices[Math.floor(rand() * info.choices.length)];
          else if (TALK_RULES[info.story]) cid = TALK_RULES[info.story];
          await clickBtn('talk_' + cid);
          continue;
        }
        await waitGame(THINK[J] * 0.4);
        if ((await g(() => __fx.G.mode !== 'work' || __fx.G.ph !== 'check'))) continue;
        // 夹钱 / 夹药
        if (info.bribe === 'pending') {
          const r = await g(() => __fx.W.billRect());
          await clickAt(r[0] + r[2] / 2, r[1] + r[3] / 2);
          await page.waitForTimeout(60);
          if ((await g(() => __fx.G.modal)) === 'bribe') {
            if (info.med) await snapOnce('药贩_便宜药换放货', 120);
            else await snapOnce(tag + '_夹钱', 120);
            const take = J === 'random' ? rand() < 0.5 : false;
            await clickBtn(take ? 'take' : 'refuse');
          }
        }
        let dec;
        if (J === 'rules') {
          if (info.ans) {
            const before = await g(() => __fx.G.lines.length);
            await drag(info.ans.link[0], info.ans.link[1]);
            const after = await g(() => ({ n: __fx.G.lines.length, react: __fx.G.react && __fx.G.react.type, red: __fx.G.lines.some((l) => l.kind === 'red') }));
            if (firstLine) { check(after.n === before + 1 && after.red, '拖一下 = 拉一根线（对不上变红线）'); firstLine = false; }
            if (after.react && after.react !== 'again') {
              const nm = { confess: '认错', lie: '撒谎', bribe: '加价', explain: '解释' }[after.react];
              if (nm) await snapOnce('红线_' + nm, 380);
            }
            // 第 2 章照片不像：按手印
            if (info.ans.needPrint) {
              await page.waitForTimeout(60);
              await clickBtn('print');
              await page.waitForFunction(() => __fx.G.printFx && __fx.G.printFx.t > __fx.config.anim.printSec * 0.8, null, { timeout: 8000 });
              await snapOnce('按手印');
              await page.waitForFunction(() => __fx.G.printFx && __fx.G.printFx.t > __fx.config.anim.printSec + 0.35, null, { timeout: 8000 });
              const m2 = await g(() => __fx.G.cur.ix.printMatch);
              await snapOnce(m2 ? '按手印_对上' : '按手印_对不上', 50);
              dec = m2 ? 'pass' : 'reject';
            } else dec = 'reject';
          } else {
            // 没问题的人：随手对一根绿线再放
            if (rand() < 0.3) {
              await drag('id.photo', 'face');
              await snapOnce('绿线_对得上', 150);
            }
            dec = 'pass';
          }
        } else {
          if (rand() < 0.5) {
            const pairs = [['id.photo', 'face'], ['id.name', 'pass.name'], ['pass.until', 'chip.expiry'], ['pass.seal', 'id.name']];
            const pr = pairs[Math.floor(rand() * pairs.length)];
            await drag(pr[0], pr[1]);
          }
          dec = rand() < 0.5 ? 'pass' : 'reject';
        }
        await waitGame(THINK[J] * 0.6);
        if ((await g(() => __fx.G.mode !== 'work' || __fx.G.ph !== 'check' || __fx.G.printFx && __fx.G.printFx.t < __fx.config.anim.printSec))) {
          if ((await g(() => __fx.G.mode === 'work' && __fx.G.ph === 'check'))) await page.waitForTimeout(150);
          else continue;
        }
        if ((await g(() => __fx.G.modal))) await clickBtn('refuse').catch(() => {});
        await clickBtn(dec);
        if (dayNo === 1 && info.n === 1 && J === 'rules') await snapOnce('盖章_驳回', 90);
        await page.waitForTimeout(20);
      }
      // 下班 → 事件卡 → 工资条
      for (;;) {
        await waitMode(['card', 'slip', 'closing'], 30000);
        const m = await mode();
        if (m === 'slip') break;
        if (m === 'card') { await snapOnce('事件卡_' + (await g(() => __fx.G.event.title)), 500); await page.waitForTimeout(500); await clickAt(187, 400); }
        else await page.waitForTimeout(100);
      }
      await page.waitForFunction(() => __fx.G.slip && __fx.G.slip.done && __fx.G.coins.length === 0 && Math.abs(__fx.G.moneyShown - __fx.G.moneyTarget) < 1, null, { timeout: 30000 });
      const hasFine = await g(() => __fx.G.day.ledger.fines.length > 0);
      if (hasFine) await snapOnce('工资条_有罚单', 200);
      else await snapOnce('工资条', 200);
      let led = await g(() => { const { G, D } = __fx; return { inc: D.income(G.day), L: G.day.ledger, q: G.day.queue.length, money: G.run.money, shown: Math.round(G.moneyShown) }; });
      check(Math.abs(led.shown - (led.money + led.inc)) <= 1, '工资条：钱飞进钱包后，钱包 = 存款 + 今天进账');
      const rec = { day: dayNo, n: led.L.n, correct: led.L.correct, wrong: led.L.wrong, q: led.q, income: led.inc, ads: [] };
      // 救急广告（只在顾家那局用）
      if (spend === 'care') {
        const need = await g(() => { const { G, D } = __fx; const c = D.costs(G.run, G.day); return c.rent + c.heat + c.food + D.needsMed(G.run).reduce((s, id) => s + (id === 'nan' ? c.medNan : c.med), 0); });
        if (await btn('appeal')) {
          await clickBtn('appeal');
          await waitMode(['slip'], 8000);
          await page.waitForFunction(() => __fx.G.slip.done && __fx.G.coins.length === 0, null, { timeout: 8000 });
          await snapOnce('工资条_申诉撤销', 200);
          rec.ads.push('申诉');
        }
        const cur = await g(() => __fx.G.run.money + __fx.D.income(__fx.G.day));
        if (cur < need && (await btn('double'))) {
          if (dayNo % 2 === 0) {
            await clickBtn('overtime');
            check((await mode()) === 'ad', '加班：先放广告占位');
            await snapOnce('广告占位', 400);
            await waitMode(['work'], 8000);
            rec.ads.push('加班');
            // 加班：同样的打法，简单点：一律照规则
            for (;;) {
              await page.waitForFunction(() => { const G = __fx.G; return (G.mode === 'work' && G.ph === 'check' && !G.modal) || ['cite', 'closing', 'card', 'slip'].indexOf(G.mode) >= 0; }, null, { polling: 30, timeout: 60000 });
              const m = await mode();
              if (m === 'cite') { await page.waitForTimeout(300); await clickAt(187, 300); continue; }
              if (m !== 'work') break;
              const a = await g(() => __fx.D.checkByRules(__fx.G.run, __fx.G.cur));
              await waitGame(3);
              if ((await g(() => __fx.G.mode !== 'work' || __fx.G.ph !== 'check'))) continue;
              let dd = 'pass';
              if (a) { await drag(a.link[0], a.link[1]); dd = 'reject'; if (a.needPrint) { await clickBtn('print'); await page.waitForFunction(() => __fx.G.printFx && __fx.G.printFx.t > __fx.config.anim.printSec + 0.1, null, { timeout: 8000 }); dd = (await g(() => __fx.G.cur.ix.printMatch)) ? 'pass' : 'reject'; } }
              if ((await g(() => __fx.G.modal))) await clickBtn('refuse');
              await clickBtn(dd).catch(() => {});
            }
            for (;;) { await waitMode(['card', 'slip', 'closing'], 30000); if ((await mode()) === 'slip') break; await page.waitForTimeout(700); await clickAt(187, 400); }
            await page.waitForFunction(() => __fx.G.slip && __fx.G.slip.done && __fx.G.coins.length === 0, null, { timeout: 30000 });
            await snapOnce('工资条_加班后', 100);
          } else {
            await clickBtn('double');
            await waitMode(['slip'], 8000);
            await page.waitForFunction(() => __fx.G.slip.done && __fx.G.coins.length === 0, null, { timeout: 8000 });
            await snapOnce('工资条_翻倍', 200);
            rec.ads.push('翻倍');
          }
          led = await g(() => { const { G, D } = __fx; return { inc: D.income(G.day), L: G.day.ledger, q: G.day.queue.length }; });
          Object.assign(rec, { n: led.L.n, correct: led.L.correct, wrong: led.L.wrong, q: led.q, income: led.inc });
        }
      }
      await clickBtn('home');
      await waitMode(['home'], 5000);
      await page.waitForTimeout(250);
      // 花钱
      if (spend === 'neglect') {
        for (const id of ['buy_heat', 'buy_food', 'buy_mednan', 'buy_medman', 'buy_meddou']) {
          const on = await g((i) => { const h = __fx.G.home.buys; return i === 'buy_heat' ? h.heat : i === 'buy_food' ? h.food : !!h.med[i.slice(7)]; }, id);
          if (on && (await btn(id))) await clickBtn(id);
        }
      } else {
        // 顾家：先确保病人有药（钱不够就把暖气让出来）
        const sick = await g(() => __fx.D.needsMed(__fx.G.run));
        for (const id of sick) {
          const has = await g((i) => !!__fx.G.home.buys.med[i], id);
          if (!has) {
            if (await g(() => __fx.G.home.buys.heat)) await clickBtn('buy_heat');
            if (await btn('buy_med' + id)) await clickBtn('buy_med' + id);
          }
        }
        if (await btn('doctor')) {
          await snapOnce('夜诊医生_按钮', 50);
          await clickBtn('doctor');
          await waitMode(['home'], 8000);
          rec.ads.push('夜诊');
        }
      }
      await page.waitForTimeout(300);
      const words = await g(() => __fx.G.home.tonight.members.map((m) => (__fx.G.run.fam[m.id].dead ? '空椅子' : m.word || '好')));
      for (const w of words) if (w !== '好') await snapOnce('家_' + w, 30);
      if (dayNo === 2 || dayNo === 6 || dayNo === 11) await snapOnce(tag + '_家_d' + dayNo, 30);
      const buys = await g(() => JSON.parse(JSON.stringify(__fx.G.home.buys)));
      await clickBtn('sleep');
      await page.waitForFunction(() => __fx.G.home.phase === 'night' && __fx.G.home.nt > (__fx.G.home.doneAt || 99), null, { timeout: 30000 });
      await snapOnce(tag + '_夜_d' + dayNo, 0);
      const after = await g(() => ({ money: __fx.G.run.money, fam: __fx.D.famWords(__fx.G.run), over: __fx.G.run.over, rep: __fx.G.home.report }));
      if (after.rep.deaths.length) await snapOnce('夜_空椅子', 0);
      if (after.rep.income.some((x) => x.who === 'man')) await snapOnce('夜_小满晚归', 0);
      rec.buys = buys;
      rec.money = after.money;
      rec.fam = after.fam;
      days.push(rec);
      await clickAt(187, 200);
      await waitMode(['paper', 'chapter', 'over'], 10000);
      const m = await mode();
      if (m === 'over') {
        evictions++;
        await snapOnce('被赶出门', 300);
        rec.evicted = true;
        learned = evictions >= 2;
        await clickBtn('retry');
        d -= 1;
        continue;
      }
      learned = false;
      if (m === 'chapter') {
        const ch = await g(() => __fx.G.chap.ch);
        await page.waitForTimeout(1600);
        await snapOnce(tag + '_章节卡' + ch + '_那些人');
        await clickBtn('next');
        await page.waitForTimeout(1300);
        await snapOnce(tag + '_章节卡' + ch + '_家里');
        if (ch === 1) {
          await clickBtn('ch2go');
          check(await g(() => __fx.G.save.unlocked2 === true), '第 1 章通关 → 解锁第 2 章（存档里记下）');
        } else {
          await clickBtn('totitle');
          break;
        }
      }
    }
    const end = await g(() => {
      const { G, D } = __fx;
      const F = G.run.flags;
      return { s: G.run.stats, money: G.run.money, fam: D.famWords(G.run), flags: Object.keys(F).filter((k) => F[k]), errands: G.run.errands };
    });
    return { days, end, evictions };
  }

  // 机器人点窗口里（让说话类往下说）
  const LY = await g(() => __fx.LY);
  global.__fx_boothY = () => LY.booth.y + 60;

  const R = {};
  R.a = await playRun('random', 'neglect', 'a');
  check((await mode()) === 'title', '乱判 × 不管家：12 天打完回到开场');
  await page.evaluate(() => { localStorage.clear(); __fx.G.save = { plays: 0, run: null, unlocked2: false }; });
  R.b = await playRun('rules', 'care', 'b');
  check((await mode()) === 'title', '照规则 × 顾家：12 天打完回到开场');

  // ———— 补拍：冷、夜诊医生（激励视频占位）————
  await page.evaluate(() => {
    const { G, D, S } = __fx;
    G.run = D.newRun(5); G.run.dayIdx = 3; G.day = D.startDay(G.run); G.day.banked = true;
    G.run.fam.nan.sick = 2; G.run.fam.man.cold = 1; G.run.money = 30;
    S.enterHome();
  });
  await page.waitForTimeout(300);
  if (await g(() => __fx.G.home.buys.heat)) await clickBtn('buy_heat');
  await page.waitForTimeout(200);
  await snap('家_冷_重病_没暖气');
  await clickBtn('doctor');
  check((await mode()) === 'ad', '夜诊医生：先放广告占位');
  await page.waitForTimeout(500);
  await snap('广告占位_夜诊医生');
  await waitMode(['home'], 5000);
  check(await g(() => __fx.G.home.buys.doctor === 'nan'), '看完广告：夜诊医生来过，外婆重病 → 病');
  await clickBtn('sleep');
  await page.waitForFunction(() => __fx.G.home.nt > (__fx.G.home.doneAt || 99), null, { timeout: 20000 });
  check(await g(() => __fx.G.run.fam.nan.sick === 1 && !__fx.G.run.fam.nan.dead), '夜诊医生：第二天外婆是「病」，不是空椅子');
  await snap('夜_夜诊之后');

  // ———— 存档续玩 ————
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
  await clickBtn('start');
  await waitMode(['paper'], 5000);
  await page.waitForTimeout(600);
  await clickBtn('go');
  await g(() => { __fx.G.timeScale = 40; });
  await waitMode(['slip'], 30000);
  await page.waitForFunction(() => __fx.G.slip.done, null, { timeout: 20000 });
  await clickBtn('home');
  await clickBtn('sleep');
  await page.waitForFunction(() => __fx.G.home.nt > (__fx.G.home.doneAt || 99), null, { timeout: 20000 });
  await clickAt(187, 200);
  await waitMode(['paper'], 5000);
  const m2 = await g(() => __fx.G.run.money);
  await page.reload();
  await page.waitForTimeout(500);
  check(!!(await btn('continue')), '重开页面：开场有「继续」');
  await snap('01_开场_有存档');
  await clickBtn('continue');
  await waitMode(['paper'], 5000);
  const cont = await g(() => ({ d: __fx.G.run.dayIdx, m: __fx.G.run.money }));
  check(cont.d === 1 && cont.m === m2, '「继续」接着第 2 天，钱一分不差（¥' + m2 + '）');

  // ———— 第 2 章入口 ————
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('fangxing_v2')); s.unlocked2 = true; s.ch2Start = s.run; s.ch2Start.dayIdx = 6; localStorage.setItem('fangxing_v2', JSON.stringify(s)); });
  await page.reload();
  await page.waitForTimeout(400);
  check(!!(await btn('ch2')), '解锁后开场有「从第 2 章开始」');

  // ———— 375×600 矮屏 ————
  await page.setViewportSize({ width: 375, height: 600 });
  await page.reload();
  await page.waitForTimeout(400);
  S = await g(() => __fx.scale);
  await snap('矮屏_开场');
  await clickBtn('start');
  await waitMode(['paper'], 5000);
  await page.waitForTimeout(1300);
  await snap('矮屏_报纸_第1天');
  await clickBtn('go');
  await page.waitForFunction(() => __fx.G.ph === 'check', null, { timeout: 5000 });
  await page.waitForTimeout(200);
  await snap('矮屏_窗口');
  await waitGame(0.5);
  await drag('id.photo', 'face');
  await page.waitForTimeout(150);
  await clickBtn('pass');
  await page.waitForFunction(() => __fx.G.ph === 'check' && __fx.G.day.qi === 1, null, { timeout: 8000 });
  await drag('id.photo', 'face');
  await page.waitForTimeout(400);
  await snap('矮屏_红线_认错');
  const lay = await g(() => { const { LY, L } = __fx; return { docsB: LY.docsBottom, act: LY.actY, ctrl: LY.ctrlY, H: L.H, gap: LY.gapH }; });
  check(lay.docsB < lay.act && lay.ctrl + 52 <= lay.H, '矮屏：证件、追查工具、按钮不互相压（证件底 ' + Math.round(lay.docsB) + ' < 工具 ' + Math.round(lay.act) + '）');
  await clickBtn('reject');
  await g(() => { __fx.G.timeScale = 40; });
  await waitMode(['slip'], 30000);
  await page.waitForFunction(() => __fx.G.slip.done, null, { timeout: 20000 });
  await page.waitForTimeout(200);
  await snap('矮屏_工资条');
  // 矮屏回家：把家里人弄成各种样子看排得下不
  await clickBtn('home');
  await page.evaluate(() => {
    const { G, S } = __fx;
    G.run.fam.nan.sick = 2; G.run.fam.man.hunger = 1; G.run.flags.dou_adopt = true; G.run.money = 120;
    G.run.dayIdx = 5;
    S.enterHome();
  });
  await page.waitForTimeout(300);
  await snap('矮屏_家_重病饿_四口人');
  // 章节卡（矮屏）
  await page.evaluate(() => { const { G, S } = __fx; G.run.flags.amei1_seen = G.run.flags.amei1_pass = G.run.flags.qian1_seen = G.run.flags.qian1_took = G.run.flags.grey1_seen = G.run.flags.tree1_seen = G.run.flags.tree1_pass = G.run.flags.drug1_seen = G.run.flags.man_errand = true; S.enterChapter(1); });
  await page.waitForTimeout(1600);
  await snap('矮屏_章节卡_那些人');
  await clickBtn('next');
  await page.waitForTimeout(1200);
  await snap('矮屏_章节卡_家里');
  await page.evaluate(() => { const { G, S } = __fx; G.run.dayIdx = 11; S.enterChapter(2); G.chap.page = 1; });
  await page.waitForTimeout(1600);
  await snap('矮屏_章节卡2_家里');

  check(errors.length === 0, '没有报错' + (errors.length ? '：' + errors.slice(0, 5).join(' | ') : ''));
  await browser.close();

  console.log(ok.map((m) => '✓ ' + m).join('\n'));
  console.log('共 ' + ok.length + ' 项\n');
  for (const k of ['a', 'b']) {
    const { days, end, evictions } = R[k];
    const acc = end.s.total ? Math.round((end.s.correct / end.s.total) * 100) : 0;
    console.log('【' + (k === 'a' ? '乱判 × 不管家' : '照规则 × 顾家') + '】判对 ' + end.s.correct + '/' + end.s.total + '（' + acc + '%），查实 ' + end.s.evidence + '，红线 ' + end.s.red + '，绿线 ' + end.s.green + '，手印 ' + end.s.prints + '，警告 ' + end.s.warns + '，罚单 ' + end.s.fines + '，收钱 ¥' + end.s.bribes + '，最后存款 ¥' + end.money + '，被赶出门 ' + evictions + ' 次');
    days.forEach((d) => console.log('  第 ' + d.day + ' 天：查 ' + d.n + '/' + d.q + '，对 ' + d.correct + ' 错 ' + d.wrong + '，进账 ' + d.income + (d.ads.length ? '（' + d.ads.join('、') + '）' : '') + '，买：' + (d.buys.heat ? '暖' : '') + (d.buys.food ? '饭' : '') + Object.keys(d.buys.med).filter((x) => d.buys.med[x]).map((x) => '药' + x).join('') + '，夜里存款 ' + d.money + '，家里 ' + JSON.stringify(d.fam) + (d.evicted ? ' ← 被赶出门，重来' : '')));
    console.log('  家里最后：' + JSON.stringify(end.fam) + '；小满晚归 ' + end.errands + ' 次');
    console.log('  标记：' + end.flags.filter((f) => !/_seen$|_red$/.test(f)).join(' '));
  }
  fs.writeFileSync(path.join(shots, 'result.json'), JSON.stringify(R, null, 1));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
