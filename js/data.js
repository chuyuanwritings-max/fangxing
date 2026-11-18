// 《放行》的人、证件、规则、故事。Cc 改故事就改这个文件（数字在 config.js）。
// 世界设定是 Kira 暂定，等 Cc 定：近未来一座城，分外环和内城；你是内城关口 7 号窗的查验员。
//
// 日期：这座城用「新历」，每个月都是 30 天。date 是一个整数：61 = 3 月 2 日（显示 3.02）。
// 条件 need：['amei_pass'] = 阿梅被放行过；'!' 开头 = 没有。
//   每个故事人物处理完会留下标记：<id>_pass 放行 / <id>_reject 驳回 / <id>_took 收了钱 / <id>_refused 退了钱

module.exports = {
  world: {
    title: '放行',
    place: '内城关口 · 7 号窗',
    intro: ['城分两层：外环，内城。', '你在中间那道门。', '看证，盖章，养家。'],
  },

  // 家里两个人。账单名字在这里，钱数在 config.bills
  family: {
    nan: { name: '外婆', face: { skin: 4, hair: 3, hairC: 3, eyes: 0, brows: 0, mouth: 0, shape: 0, age: 2, glasses: true, cloth: 4 } },
    man: { name: '小满', face: { skin: 0, hair: 0, hairC: 0, eyes: 2, brows: 1, mouth: 2, shape: 0, age: 0, cloth: 5 } },
  },
  bills: [
    { id: 'med', name: '外婆的药', icon: 'pill', who: 'nan', ok: '外婆睡得安稳。', miss: '外婆咳了一夜。', miss2: '外婆住进了外环医院。' },
    { id: 'food', name: '饭钱', icon: 'bowl', who: 'man', ok: '小满吃饱了。', miss: '小满饿着肚子睡了。', miss2: '小满在学校饿晕了。' },
    { id: 'rent', name: '房租', icon: 'house', who: null, ok: '', miss: '房东来敲过门。', miss2: '房东换了锁。' },
  ],

  // 三天。rules 是当天要查的规则；newRule 是当天新加的那条
  days: [
    {
      date: 61,
      rules: ['expiry', 'name', 'photo'],
      newRule: null,
      brief: ['上岗第一天。', '有一处不对，就驳回。'],
      // 前两个人固定，用来教：第一个全对，第二个照片不对
      fixed: [{ flaw: null }, { flaw: 'photo' }],
    },
    {
      date: 62,
      rules: ['expiry', 'name', 'photo', 'seal'],
      newRule: 'seal',
      brief: ['昨晚查出一批假章。', '印章必须是本周章。'],
    },
    {
      date: 63,
      rules: ['expiry', 'name', 'photo', 'seal', 'permit'],
      newRule: 'permit',
      brief: ['内城今天开大会。', '还要带「当日许可」。'],
    },
  ],

  rules: {
    expiry: { short: '未过期', long: '通行证「有效至」不早于今天' },
    name: { short: '同名', long: '两张证上的名字一字不差' },
    photo: { short: '像本人', long: '身份卡照片 = 窗口里这个人' },
    seal: { short: '本周章', long: '通行证的章 = 本周章（形状、颜色）' },
    permit: { short: '当日许可', long: '带当日许可，日期是今天' },
  },

  // 本周章
  seal: { shape: 'hex', color: 'blue', char: '准' },
  sealFakes: { shape: ['circle', 'square'], color: ['purple', 'teal'] },

  // 罚单上「你漏看了什么」：{a} {b} 会换成证件上的字
  explain: {
    expiry: '有效期 {a}，今天 {b}：过期了',
    name: '名字对不上：{a} / {b}',
    photo: '照片不是本人',
    seal: '印章不是本周章',
    permitMissing: '没带当日许可',
    permitDate: '许可日期 {a}，不是今天',
    clean: '证件全对，本该放行',
  },
  wrongMark: '圈错了：{a} 没问题',
  fieldNames: {
    'id.photo': '照片',
    'id.name': '身份卡名字',
    'pass.name': '通行证名字',
    'pass.until': '有效期',
    'pass.seal': '印章',
    'permit.date': '许可日期',
    'permit.name': '许可名字',
    'permit.slot': '当日许可',
  },

  // —— 故事人物 ——
  // day 第几天，at 排第几个（从 0 数），need 出场条件
  // flaw 破绽：null 没问题 / expiry / name / photo / seal / permitDate / permitMissing
  // gap 过期几天；altName 证上写错的名字；bribe 夹多少钱
  // onPass / onReject：走的时候说的一句；gift：送了东西，当晚这笔账不用付
  story: [
    {
      id: 'amei', day: 1, at: 2, name: '林阿梅',
      face: { skin: 0, hair: 2, hairC: 1, eyes: 2, brows: 0, mouth: 0, shape: 1, age: 1, cloth: 1, earring: true },
      item: 'lunchbox', line: '我妈在内城住院。就差一天……',
      flaw: 'expiry', gap: 1, onPass: '谢谢你。谢谢。', onReject: '……我明白。',
    },
    {
      id: 'qian', day: 1, at: 5, name: '钱有福', altName: '钱友福',
      face: { skin: 1, hair: 4, hairC: 0, eyes: 0, brows: 2, mouth: 1, shape: 2, age: 1, glasses: true, beard: 2, cloth: 3 },
      item: 'briefcase', line: '小兄弟，规矩我懂。',
      flaw: 'name', bribe: 30, onPass: '聪明人。', onReject: '你会后悔的。',
    },
    {
      id: 'qian_angry', day: 2, at: 1, need: ['qian_took', 'qian_reject'], faceOf: 'qian', name: '钱有福',
      item: 'briefcase', line: '钱收了，人不放？', flaw: null,
      onPass: '哼。我会说出去的。', onReject: '好。你等着。', setFlag: 'qian_report',
    },
    {
      id: 'qian_back', day: 2, at: 1, need: ['!qian_took'], faceOf: 'qian', name: '钱有福',
      item: 'briefcase', line: '证改好了。你这人，有点意思。', flaw: null,
      onPass: '回头请你喝茶。', onReject: '我证全对！',
    },
    {
      id: 'tree', day: 2, at: 3, name: '宋小树',
      face: { skin: 0, hair: 5, hairC: 1, eyes: 2, brows: 1, mouth: 2, shape: 0, age: 0, cloth: 5 },
      item: 'flower', line: '今天她生日。', flaw: null,
      onPass: '谢啦！', onReject: '花要蔫了……',
    },
    {
      id: 'zhou', day: 2, at: 6, name: '周大川',
      face: { skin: 3, hair: 7, hairC: 0, eyes: 1, brows: 2, mouth: 1, shape: 2, age: 2, beard: 1, cloth: 2 },
      item: 'toolbox', line: '家里等米下锅。通融一下。',
      flaw: 'seal', bribe: 20, onPass: '好人有好报。', onReject: '……那我回去了。',
    },
    {
      id: 'amei_thanks', day: 3, at: 1, need: ['amei_pass'], faceOf: 'amei', name: '林阿梅',
      item: 'oranges', line: '见到最后一面了。橘子给你。', flaw: null, gift: 'food',
      onPass: '你家里人也吃。', onReject: '……今天的证是全的呀。',
    },
    {
      id: 'amei_sad', day: 3, at: 1, need: ['amei_reject'], faceOf: 'amei', name: '林阿梅',
      item: 'whiteflower', line: '来不及了。不怪你。', flaw: null,
      onPass: '……', onReject: '今天的证是全的。',
    },
    {
      id: 'grey', day: 3, at: 5, name: '顾一',
      face: { skin: 4, hair: 1, hairC: 2, eyes: 0, brows: 0, mouth: 0, shape: 1, age: 1, cloth: 4 },
      item: 'letter', line: '拿着。没人知道。',
      flaw: 'permitDate', bribe: 50, onPass: '嗯。', onReject: '嗯。',
    },
  ],

  // —— 事件：上班前（when: 'start'）或下班后（when: 'end'）出一张卡 ——
  events: [
    { day: 2, when: 'start', need: ['qian_took', 'qian_pass'], icon: 'audit', title: '督察来了', line: '昨天那张假证，查到你头上。', money: -40 },
    { day: 3, when: 'start', need: ['zhou_pass'], icon: 'audit', title: '督察来了', line: '昨天那个假章，是你放的？', money: -15 },
    { day: 3, when: 'start', need: ['qian_report'], icon: 'audit', title: '有人举报', line: '钱老板说你收钱不办事。', money: -30 },
    { day: 3, when: 'end', need: ['grey_took'], icon: 'audit', title: '顾一回来了', line: '我是督察局的。钱充公，记你一过。', money: -80 },
    { day: 3, when: 'end', need: ['grey_refused', 'grey_reject'], icon: 'medal', title: '顾一回来了', line: '我是督察局的。7 号窗，好样的。', money: 30 },
  ],

  // —— 结局里的几句（满足条件的都会出来）——
  endings: [
    { need: ['amei_pass'], line: '阿梅见到了她妈妈最后一面。' },
    { need: ['amei_reject'], line: '阿梅没赶上。她说不怪你。' },
    { need: ['qian_took'], line: '钱老板的钱，你收过。' },
    { need: ['!qian_took'], line: '钱老板记住了 7 号窗的怪人。' },
    { need: ['zhou_pass'], line: '周大川那天带回了米。' },
    { need: ['zhou_reject'], line: '周大川空着手回了外环。' },
    { need: ['grey_took'], line: '督察局的档案里，有你一笔。' },
    { need: ['grey_refused'], line: '督察局记住了 7 号窗。' },
  ],

  // —— 路人：从这些里随机拼 ——
  generic: {
    surnames: '林陈王李赵周吴郑孙何许高罗梁宋唐韩冯邓曹彭萧田董潘袁蒋蔡余杜叶程苏魏吕丁沈姚卢姜崔钟谭陆汪范金石廖夏韦方白邹孟熊秦江尹薛段雷侯龙史陶黎贺顾毛郝龚邵万严武戴孔汤'.split(''),
    // 每个名字至少有一个字在 similar 里，第 2 天起「名字不对」只换一个长得像的字
    given: ['晓明', '一凡', '玉兰', '海峰', '静', '伟', '子涵', '思远', '秀英', '国强', '佳琪', '浩然', '美玲', '志刚', '雨桐', '欣怡', '文博', '春生', '秋月', '大山', '丽娟', '宇', '婷', '长青', '冬梅', '立新', '建华', '晓雨', '明远', '桂芳'],
    similar: [['晓', '小'], ['明', '鸣'], ['玲', '铃'], ['伟', '玮'], ['静', '婧'], ['峰', '锋'], ['兰', '岚'], ['国', '囯'], ['涵', '函'], ['远', '原'], ['英', '瑛'], ['强', '墙'], ['琪', '棋'], ['然', '燃'], ['刚', '钢'], ['桐', '彤'], ['怡', '恰'], ['博', '搏'], ['生', '升'], ['月', '玥'], ['山', '川'], ['娟', '涓'], ['宇', '字'], ['婷', '停'], ['青', '清'], ['梅', '海'], ['新', '欣'], ['雨', '两'], ['建', '健'], ['华', '桦'], ['芳', '方'], ['凡', '帆'], ['玉', '王'], ['秀', '绣'], ['佳', '家'], ['浩', '皓'], ['美', '姜'], ['志', '至'], ['子', '仔'], ['思', '恩'], ['文', '汶'], ['春', '椿'], ['秋', '湫'], ['大', '太'], ['丽', '俪'], ['长', '常'], ['冬', '东'], ['立', '粒'], ['桂', '挂']],
    districts: ['外环 1 区', '外环 3 区', '外环 4 区', '外环 6 区', '外环 7 区', '外环 9 区'],
    lines: [
      '早班要迟到了。', '今天风大。', '我在内城做清洁。', '能快点吗？', '孩子在里面上学。',
      '第一次来内城。', '排了两个钟头。', '就去送个货。', '我在里面修电梯。', '天天来，你不认识我？',
      '雨要下了。', '下班前得赶回去。', '你们换人了？', '给老板送饭。', '今天人真多。',
      '我去面试。', '鸟要晒太阳。', '蛋糕要化了。',
    ],
    // 有问题的人有时会说漏嘴（第 1 天常说，第 3 天少说）
    hints: {
      expiry: ['证……应该还能用吧？', '上个月刚续的，我记得。'],
      name: ['名字？那是旧写法。', '写错一个字，不碍事吧？'],
      photo: ['照片是好几年前的。', '我最近瘦了。'],
      seal: ['章是巷子里盖的。', '这章挺正的吧？'],
      permitDate: ['许可是昨天的，一样吧？'],
      permitMissing: ['许可？什么许可？'],
    },
    items: ['umbrella', 'toolbox', 'flower', 'schoolbag', 'coffee', 'plant', 'cake', 'birdcage', 'letter', 'watch', 'lunchbox', 'briefcase'],
  },
};
