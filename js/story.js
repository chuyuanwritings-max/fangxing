// 《放行》的回头客、报纸、家里的暗线、章节卡。Cc 改故事就改这个文件。
//
// 条件 need：['amei1_pass'] = 阿梅第一次来被放行了；'!' 开头 = 没有。
// 每次来访（beat）处理完会自动留下标记：
//   <id>_seen 来过 / <id>_pass 放行 / <id>_reject 驳回 / <id>_took 收了钱或东西 / <id>_refused 推回去
//   <id>_red 拉出了红线 / <id>_print 按了手印 / 说话类（talk）：<id>_<选项 id>
// 也可以自己加：set（来过就记）、passSet / rejectSet（放行 / 驳回时记）
//
// 来访字段：
//   who 是谁（见 people）；day 第几天；at 排第几个（从 0 数）；kind: 'talk' = 不递证，只说话、给两个选项
//   flaw 破绽：null 没问题 / expiry / name / photo（冒名）/ photoOld（照片旧了，手印对得上 = 本人，该放行）/ seal
//   gap 过期几天；altName 证上写错的名字；until 证还剩几天（没问题的人）
//   bribe 夹多少钱；med: true = 夹的不是钱，是一瓶药（收下 = 外婆的药以后打折）
//   react 被拉出红线后的反应：confess 认错（低头）/ lie 撒谎（眼神躲、冒汗、手抖，和上次说的对不上）/ bribe 加价 / explain 解释
//   reactLine 那句话；raise 加价后变多少
//   line 开口第一句；onPass / onReject 走的时候说的一句
//   gift：{ on: 'pass' | 'any', item: 'food' | 'heat' } 送了东西，当晚这样不用买
//   reward：{ on: 'reject', need: [...], drawer: 15 } 驳回了有人塞钱（灰色收入）

module.exports = {
  // —— 回头客 ——
  people: {
    qian: { name: '钱有福', face: { skin: 1, hair: 4, hairC: 0, eyes: 0, brows: 2, mouth: 1, shape: 2, age: 1, glasses: true, beard: 2, cloth: 3 } },
    amei: { name: '林阿梅', face: { skin: 0, hair: 2, hairC: 1, eyes: 2, brows: 0, mouth: 0, shape: 1, age: 1, cloth: 1, earring: true } },
    grey: { name: '顾一', face: { skin: 4, hair: 1, hairC: 2, eyes: 0, brows: 0, mouth: 0, shape: 1, age: 1, cloth: 4, glasses: false } },
    tree: { name: '宋小树', face: { skin: 0, hair: 5, hairC: 1, eyes: 2, brows: 1, mouth: 2, shape: 0, age: 0, cloth: 5 } },
    qing: { name: '阿青', docName: '许青', face: { skin: 4, hair: 1, hairC: 0, eyes: 2, brows: 1, mouth: 2, shape: 1, age: 0, cloth: 6, earring: true } },
    han: { name: '老韩', face: { skin: 2, hair: 4, hairC: 2, eyes: 1, brows: 2, mouth: 1, shape: 2, age: 2, beard: 1, cloth: 0, collar: 2 } },
    drug: { name: '药贩', docName: '吴三', face: { skin: 1, hair: 1, hairC: 0, eyes: 1, brows: 2, mouth: 1, shape: 1, age: 1, mole: true, cloth: 2, collar: 2 } },
    zhou: { name: '周婆婆', docName: '周桂兰', face: { skin: 4, hair: 3, hairC: 3, eyes: 2, brows: 0, mouth: 0, shape: 1, age: 2, cloth: 1, collar: 1 } },
    cap: { name: '卖菜的', docName: '马大有', face: { skin: 2, hair: 7, hairC: 0, eyes: 0, brows: 2, mouth: 2, shape: 2, age: 1, cloth: 3 } },
    ayuan: { name: '阿圆', docName: '陈圆', faceOf: 'yuan' }, // 姐姐，脸用家里人那张
  },

  beats: [
    // ===== 第 1 章 =====
    // 林阿梅：母亲住院 → 送橘子 / 来不及 → 托孤
    { id: 'amei1', who: 'amei', day: 1, at: 3, flaw: 'expiry', gap: 1, item: 'lunchbox',
      line: '我妈在内城住院。就差一天……', react: 'confess', reactLine: '……我知道。就差一天。',
      onPass: '谢谢你。谢谢。', onReject: '……我明白。' },
    // 钱有福：行贿商人（喜剧）→ 回来闹 / 二进城 / 成了朋友 → 出城证
    { id: 'qian1', who: 'qian', day: 2, at: 4, flaw: 'name', altName: '钱友福', bribe: 30, item: 'briefcase',
      line: '小兄弟，规矩我懂。', react: 'bribe', raise: 60, reactLine: '再加一张。交个朋友。',
      onPass: '聪明人。', onReject: '你会后悔的。' },
    { id: 'amei2a', who: 'amei', day: 3, at: 2, need: ['amei1_pass'], item: 'oranges',
      line: '见到最后一面了。橘子给你。', gift: { on: 'any', item: 'food' },
      onPass: '你家里人也吃。', onReject: '……今天的证是全的呀。' },
    { id: 'amei2b', who: 'amei', day: 3, at: 2, need: ['amei1_reject'], item: 'whiteflower',
      line: '来不及了。不怪你。', onPass: '……', onReject: '今天的证是全的。' },
    // 宋小树：留下女朋友的照片 → 撒谎「面试」→ 女朋友阿青来了，证不全
    { id: 'tree1', who: 'tree', day: 3, at: 5, item: 'flower', line: '今天她生日。我去求婚！',
      onPass: '这是她。哪天她来，帮我认认！', onReject: '花要蔫了……', passSet: 'tree_photo' },
    // 顾一：督察，每章考你一次
    { id: 'grey1', who: 'grey', day: 4, at: 5, flaw: 'expiry', gap: 1, bribe: 50, item: 'letter',
      line: '拿着。没人知道。', react: 'bribe', raise: 100, reactLine: '嘘。再加一张。',
      onPass: '嗯。', onReject: '嗯。' },
    // 夜班老韩：先给炭 → 求你冤枉一个人 → 拘人分钱
    { id: 'han1', who: 'han', day: 4, at: 2, kind: 'talk', item: 'coal',
      lines: ['冷吧？夜班剩的炭，分你一袋。'],
      choices: [
        { id: 'yes', label: '收下', gift: 'heat', set: 'han_friend', say: '暖和暖和。' },
        { id: 'no', label: '不用', say: '行。你清高。' },
      ] },
    { id: 'qian2a', who: 'qian', day: 5, at: 3, need: ['qian1_took', 'qian1_pass'], flaw: 'name', altName: '钱有富', bribe: 40, item: 'briefcase',
      line: '老朋友！还是老规矩。', react: 'lie', reactLine: '我一直叫钱有富！',
      onPass: '够意思！', onReject: '翻脸不认人？' },
    { id: 'qian2b', who: 'qian', day: 5, at: 3, need: ['qian1_took', 'qian1_reject'], item: 'briefcase',
      line: '钱收了，人不放？', set: 'qian_report', onPass: '哼。我会说出去的。', onReject: '好。你等着。' },
    { id: 'qian2c', who: 'qian', day: 5, at: 3, need: ['!qian1_took'], item: 'briefcase',
      line: '证改好了。你这人，有点意思。', passSet: 'qian_respect', onPass: '回头请你喝茶。', onReject: '我证全对！' },
    // 药贩：先认得你家（外婆咳嗽）→ 便宜药换放货 → 假药
    { id: 'drug1', who: 'drug', day: 5, at: 6, item: 'herbs', line: '家里老人咳嗽吧？我听得出来。',
      onPass: '有事，来找我。', onReject: '……会再见的。', set: 'drug_card' },
    { id: 'tree2', who: 'tree', day: 6, at: 4, flaw: 'expiry', gap: 2, item: 'watch',
      line: '我去面试。今天就面试。', react: 'lie', reactLine: '是面试！我……去面试的！',
      onPass: '……谢谢。别告诉别人。', onReject: '她在里面等我……' },

    // ===== 第 2 章 =====
    { id: 'han2', who: 'han', day: 7, at: 3, kind: 'talk', item: 'coal',
      lines: ['帮个忙。下一个戴红帽子的，', '驳回他。分你十五。'],
      choices: [
        { id: 'yes', label: '答应', set: 'han_yes', say: '够意思。' },
        { id: 'no', label: '不干', set: 'han_no', say: '……你记着。' },
      ] },
    { id: 'capman', who: 'cap', day: 7, at: 4, item: 'plant', line: '我卖菜的。早市要开了。',
      reward: { on: 'reject', need: ['han_yes'], drawer: 15, say: '老韩在窗外比了个拇指' },
      onPass: '谢了！', onReject: '证是好的啊……' },
    { id: 'drug2', who: 'drug', day: 8, at: 4, flaw: 'seal', bribe: 1, med: true, item: 'crate',
      line: '放我的货过去。你外婆的药，以后半价。', react: 'bribe', reactLine: '一个月的药。白送。',
      onPass: '合作愉快。', onReject: '你外婆等不起。' },
    { id: 'zhou', who: 'zhou', day: 9, at: 3, flaw: 'photoOld', photoMode: 'hair', item: 'oldphoto',
      line: '你是阿秀的外孙吧？你长得像她。', react: 'explain', reactLine: '照片是好多年前的了。',
      onPass: '替我问阿秀好。', onReject: '……老城区要拆了，我就想看一眼。' },
    { id: 'grey2', who: 'grey', day: 10, at: 4, flaw: 'photoOld', photoMode: 'glasses', item: 'letter',
      line: '又见面了。', react: 'explain', reactLine: '那时候还没戴眼镜。',
      onPass: '嗯。', onReject: '嗯。' },
    { id: 'qian3a', who: 'qian', day: 10, at: 2, need: ['qian1_took', 'qian1_pass'], flaw: 'seal', bribe: 50, item: 'briefcase',
      line: '外环要乱了。想走，出城证我弄得到。', react: 'bribe', raise: 100, reactLine: '一百。老朋友价。',
      set: 'qian_exit_offer', onPass: '记得我说的。', onReject: '你会来找我的。' },
    { id: 'qian3b', who: 'qian', day: 10, at: 2, need: ['!qian1_took'], item: 'briefcase',
      line: '内城学校招插班生。给你弟弟留意。', set: 'school_tip', onPass: '茶还欠着。', onReject: '证是全的呀？' },
    { id: 'ayuan', who: 'ayuan', day: 10, at: 7, until: 4, item: 'apron',
      line: '是我。别给我开后门。', onPass: '证还剩四天。周末见。', onReject: '……你认真的？' },
    { id: 'drug3', who: 'drug', day: 11, at: 3, need: ['drug2_took', 'drug2_pass'], flaw: 'seal', bribe: 1, med: true, item: 'crate',
      line: '这次的货……别问。', react: 'lie', reactLine: '是药！普通的药！',
      passSet: 'drug_bad', onPass: '老规矩。', onReject: '那药，你就别想了。' },
    { id: 'amei3', who: 'amei', day: 11, at: 2, need: ['amei1_pass'], kind: 'talk', item: 'doll',
      lines: ['我被派去内城做长工，一年。', '小豆……能先住你家吗？'],
      choices: [
        { id: 'yes', label: '收下', set: 'dou_adopt', say: '小豆，叫人。' },
        { id: 'no', label: '不行', say: '……我再想办法。' },
      ] },
    { id: 'qing', who: 'qing', day: 11, at: 6, flaw: 'seal', sealOld: true, item: 'flower',
      line: '我找宋小树。他在里面等我。', react: 'confess', reactLine: '章是旧的……我只有这张。',
      onPass: '谢谢你。', onReject: '……我在外面等他。' },
    { id: 'han3a', who: 'han', day: 12, at: 3, need: ['capman_reject', 'han_yes'], kind: 'talk', item: 'coal',
      lines: ['下礼拜起，能拘人了。', '拘一个，分你五块。'],
      choices: [
        { id: 'yes', label: '好', set: 'han_detain', say: '这才对。' },
        { id: 'no', label: '再说', say: '别想太久。' },
      ] },
    { id: 'han3b', who: 'han', day: 12, at: 3, need: ['!han_yes'], kind: 'talk', item: 'coal',
      lines: ['你这人，不合群。'],
      choices: [{ id: 'ok', label: '嗯', say: '……' }] },
    { id: 'han3c', who: 'han', day: 12, at: 3, need: ['han_yes', '!capman_reject'], kind: 'talk', item: 'coal',
      lines: ['说好的事，你没办。'],
      choices: [{ id: 'ok', label: '嗯', say: '记着。' }] },
  ],

  // 第 12 天：队伍后面一个像小满的男孩，没排到你就走了
  cameo: { day: 12, at: 4, who: 'man' },

  // —— 下班时的事：钱打在工资条上；card: true 先出一张卡 ——
  events: [
    { day: 3, need: ['qian1_took', 'qian1_pass'], title: '督察追查假证', line: '昨天那张错字的证，查到你头上。', money: -20, who: 'grey', card: true },
    { day: 4, need: ['grey1_took'], title: '顾一回来了', line: '我是督察局的。钱充公，记你一笔。', money: -40, who: 'grey', card: true, set: 'grey_record' },
    { day: 4, need: ['grey1_refused', 'grey1_reject'], title: '顾一回来了', line: '我是督察局的。7 号窗，好样的。', money: 20, who: 'grey', card: true },
    { day: 4, need: ['grey1_pass', '!grey1_took'], title: '顾一回来了', line: '我是督察局的。过期的证，你放了。', money: -10, who: 'grey', card: true },
    { day: 6, need: ['qian_report'], title: '有人举报', line: '钱老板说你收钱不办事。', money: -15, who: 'qian', card: true },
    { day: 6, need: ['qian2a_took', 'qian2a_pass'], title: '督察追查假证', line: '同一个商人，两张假证。', money: -25, who: 'grey', card: true, set: 'grey_record' },
    { day: 10, need: ['grey2_pass', 'grey2_print'], title: '顾一回来了', line: '会用手印了。不错。', money: 20, who: 'grey', card: true },
    { day: 10, need: ['grey2_pass', '!grey2_print'], title: '顾一回来了', line: '放对了。可你没按手印。', money: 0, who: 'grey', card: true },
    { day: 10, need: ['grey2_reject'], title: '顾一回来了', line: '冤枉好人。记一笔。', money: -30, who: 'grey', card: true, set: 'grey_record' },
    { day: 11, need: ['qian3a_took', 'qian3a_pass'], title: '督察追查假章', line: '又是钱老板。', money: -30, who: 'grey', card: true, set: 'grey_record' },
  ],

  // —— 早上的报纸：第 N 天早上，讲前一天你放走 / 拦下的人 ——
  // prio 越大越优先；没有 need 的是那天的「默认头条」
  // pic 画面：gate 关口 / hospital 医院 / night 夜里关口外 / market 集市 / inspector 督察 / couple 两个人 /
  //          medicine 药 / arrest 截下的货 / oldhouse 老城区 / school 学校；who / who2 是照片里的人
  papers: [
    { day: 1, head: '内城关口扩招查验员', sub: '7 号窗今天换新人', pic: 'gate' },
    { day: 2, need: ['amei1_pass'], head: '她赶上了', sub: '外环一位母亲，等到了女儿', pic: 'hospital', who: 'amei' },
    { day: 2, need: ['amei1_reject'], head: '关口外，她坐到天亮', sub: '通行证过期一天', pic: 'night', who: 'amei' },
    { day: 3, need: ['qian1_took', 'qian1_pass'], prio: 2, head: '假证流进内城？', sub: '督察局：从关口查起', pic: 'inspector', who: 'qian' },
    { day: 3, need: ['qian1_took', 'qian1_reject'], prio: 2, head: '钱老板放话', sub: '「7 号窗收钱不办事」', pic: 'market', who: 'qian' },
    { day: 3, need: ['qian1_reject'], head: '外环商人：生意难做', sub: '一张错字的证被驳回', pic: 'market', who: 'qian' },
    { day: 3, need: ['qian1_pass'], head: '一张错字的证进了城', sub: '没人发现', pic: 'gate', who: 'qian' },
    { day: 4, need: ['tree1_pass'], head: '内城公园：她说愿意', sub: '外环小伙求婚成功', pic: 'couple', who: 'tree', who2: 'qing' },
    { day: 4, need: ['tree1_reject'], head: '一束花蔫在关口外', sub: '「今天她生日」', pic: 'night', who: 'tree' },
    { day: 5, need: ['grey1_took'], head: '督察局：7 号窗记档', sub: '收钱的事，有人看见了', pic: 'inspector', who: 'grey' },
    { day: 5, need: ['grey1_refused', 'grey1_reject'], head: '督察局表扬 7 号窗', sub: '「钱推回去了」', pic: 'inspector', who: 'grey' },
    { day: 5, need: ['grey1_pass'], head: '督察暗访：关口漏洞不少', pic: 'inspector', who: 'grey' },
    { day: 6, head: '外环药价又涨了', sub: '下周起，一份咳嗽药 ¥22', pic: 'medicine' },
    { day: 6, need: ['qian2a_pass'], prio: 2, head: '假名商人二进内城', sub: '「钱友福」「钱有富」是同一人', pic: 'market', who: 'qian' },
    { day: 7, head: '关口查出一批假章', sub: '今天起，通行证要查本周章', pic: 'arrest' },
    { day: 8, need: ['capman_reject'], head: '一车菜烂在关口外', sub: '卖菜的说：证是好的', pic: 'market', who: 'cap' },
    { day: 8, need: ['capman_pass', 'han_yes'], head: '夜班老韩：「7 号窗不懂事」', pic: 'gate', who: 'han' },
    { day: 8, head: '内城早市照常开张', pic: 'market' },
    { day: 9, need: ['drug2_took', 'drug2_pass'], prio: 2, head: '外环药摊来了便宜药', sub: '半价，不问来路', pic: 'medicine', who: 'drug' },
    { day: 9, need: ['drug2_reject'], head: '关口截下一箱来路不明的药', pic: 'arrest', who: 'drug' },
    { day: 9, need: ['drug2_pass'], head: '一箱药进了内城', pic: 'arrest', who: 'drug' },
    { day: 10, need: ['zhou_pass'], head: '老城区拆迁前，有人回来看了一眼', sub: '「我年轻时住这儿」', pic: 'oldhouse', who: 'zhou' },
    { day: 10, head: '老城区今天开拆', sub: '几十年前，外环人也住过这里', pic: 'oldhouse' },
    { day: 11, need: ['grey2_pass', 'grey2_print'], head: '督察局：7 号窗会用手印了', pic: 'inspector', who: 'grey' },
    { day: 11, need: ['grey2_reject'], head: '督察被拦在关口外', sub: '「冤枉好人，记一笔」', pic: 'inspector', who: 'grey' },
    { day: 11, head: '内城学校招插班生', sub: '学费 ¥300，外环名额 5 个', pic: 'school' },
    { day: 12, need: ['drug_bad'], prio: 3, head: '外环多人喝了假药住院', sub: '药是从关口那边来的', pic: 'hospital', who: 'drug' },
    { day: 12, need: ['qing_pass'], prio: 2, head: '关口里，两个人抱在一起', sub: '宋小树等到了阿青', pic: 'couple', who: 'tree', who2: 'qing' },
    { day: 12, need: ['qing_reject'], prio: 2, head: '关口外，一个女孩等到天黑', pic: 'night', who: 'qing' },
    { day: 12, head: '外环少年替人跑腿运假证', sub: '抓到的不到一半', pic: 'arrest' },
  ],
  // 报纸角落一行小字（满足条件的第一条）
  paperSide: [
    { day: 3, line: '内城学校：明年起收外环学生' },
    { day: 4, line: '冷空气要来了，注意取暖' },
    { day: 5, line: '外环 4 区停电两小时' },
    { day: 6, need: ['amei1_pass'], line: '林阿梅回外环摆摊了' },
    { day: 6, line: '内城家政公司招保姆' },
    { day: 8, line: '少年跑腿：一趟十块' },
    { day: 9, line: '内城学校：插班考试下月开考' },
    { day: 10, need: ['drug2_took', 'drug2_pass'], line: '有人在外环卖半价药' },
    { day: 10, line: '外环夜里有人送信' },
    { day: 11, line: '内城家政：保姆证一律重审' },
    { day: 12, line: '保姆证到期者，不得入城' },
  ],
  obit: '讣告：外环 6 区，{a}，昨夜走了。',

  // —— 家里的暗线：晚上回家看到的东西（不写字，只摆东西；caption 是一行小字，能不用就不用）——
  // item 摆在桌上 / 抽屉里；late: 'man' = 小满还没回来，夜里他回来，桌上多了钱（他饿着时更多）
  // yuan: true = 周末阿圆回家，带钱
  home: [
    { day: 2, item: 'brochure', keep: true },
    { day: 3, item: 'oldpass', keep: true },
    { day: 5, late: 'man', money: 10, caption: '小满还没回来。' },
    { day: 6, yuan: true, money: 20 },
    { day: 8, late: 'man', money: 10, item: 'shoes', keep: true },
    { day: 9, late: 'man', money: 10 },
    { day: 9, need: ['zhou_pass'], caption: '外婆把旧通行证拿出来，看了很久。' },
    { day: 11, late: 'man', money: 15, item: 'fakepass', keep: true },
    { day: 12, yuan: true, money: 20, item: 'yuanpass' },
  ],
  hungryErrandBonus: 10, // 小满那晚饿着：多带回这么多
  // 外婆老咳嗽：这几晚她会犯病（第二天晚上要药）
  nanCough: [2, 5, 7, 9, 11],

  // —— 章节卡 ——
  chapterEnd: {
    1: { title: '第 1 章 · 窗口', unlock: ['第 2 章：查「本周章」', '新工具：按手印'] },
    2: { title: '第 2 章 · 手印', unlock: ['第 3 章：搜包 · 拘留', '（还没做，敬请期待）'] },
  },
  // 章节卡上「那些人」：每人满足条件的第一条
  fates: [
    { ch: 1, who: 'amei', need: ['amei1_pass'], line: '赶上了最后一面' },
    { ch: 1, who: 'amei', need: ['amei1_reject'], line: '没赶上，说不怪你' },
    { ch: 1, who: 'qian', need: ['qian1_took'], line: '记住了你收过钱' },
    { ch: 1, who: 'qian', need: ['!qian1_took'], line: '觉得 7 号窗是个怪人' },
    { ch: 1, who: 'grey', need: ['grey1_took'], line: '督察局记了你一笔' },
    { ch: 1, who: 'grey', need: ['grey1_reject'], line: '督察局记住了你' },
    { ch: 1, who: 'grey', need: [], line: '在看着你' },
    { ch: 1, who: 'tree', need: ['tree1_pass'], line: '把她的照片留在了窗口' },
    { ch: 1, who: 'tree', need: [], line: '花蔫了' },
    { ch: 1, who: 'drug', need: ['drug1_seen'], line: '知道你家有人咳嗽' },
    { ch: 2, who: 'qing', need: ['qing_pass'], line: '找到了宋小树' },
    { ch: 2, who: 'qing', need: ['qing_reject'], line: '在关口外等到天黑' },
    { ch: 2, who: 'drug', need: ['drug_bad'], line: '他的药让人住了院' },
    { ch: 2, who: 'drug', need: ['drug2_took', 'drug2_pass'], line: '外婆吃上了半价药' },
    { ch: 2, who: 'drug', need: [], line: '没能从你这儿过' },
    { ch: 2, who: 'han', need: ['han_detain'], line: '下礼拜起，拘人分你钱' },
    { ch: 2, who: 'han', need: ['han_yes'], line: '你帮他冤枉过一个人' },
    { ch: 2, who: 'han', need: [], line: '说你不合群' },
    { ch: 2, who: 'qian', need: ['qian_exit_offer'], line: '说出城证他弄得到' },
    { ch: 2, who: 'qian', need: ['school_tip'], line: '给小满递了个上学的消息' },
    { ch: 2, who: 'zhou', need: ['zhou_pass'], line: '托你问外婆好' },
    { ch: 2, who: 'amei', need: ['dou_adopt'], line: '把小豆托给了你' },
  ],
  // 第 2 章结尾：家里的事一件件走近窗口
  // alive：这个人还在才写；不在了就写 gone
  foreshadow: [
    { who: 'man', line: '小满的书包里，有一张别人名字的通行证。', gone: '小满的书包还挂在门后。' },
    { who: 'yuan', line: '阿圆的证，还剩两天。', gone: '' },
    { who: 'nan', line: '外婆抽屉里那张旧证，是内城发的。', gone: '外婆抽屉里那张旧证，还在。' },
  ],
};
