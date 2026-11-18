// 《放行》的世界、规则、日子、路人、家里人。Cc 改字就改这个文件（数字在 config.js）。
// 回头客、报纸、家里的暗线、章节卡在 js/story.js。
// 世界设定是 Kira 暂定，等 Cc 定：近未来一座城，分外环和内城；你是内城关口 7 号窗的查验员。全部架空。
//
// 日期：这座城用「新历」，每个月都是 30 天。date 是一个整数：61 = 3 月 2 日（显示 3.02）。

module.exports = {
  world: {
    title: '放行',
    place: '内城关口 · 7 号窗',
    intro: ['城分两层：外环，内城。', '你在中间那道门。', '家里三口人等你回去。'],
  },

  chapters: [
    { n: 1, name: '窗口', days: [1, 6], tool: 'line', rule: null },
    { n: 2, name: '手印', days: [7, 12], tool: 'print', rule: 'seal' },
  ],

  // 12 天。rules 是当天要查的；newRule / newTool 是当天新加的（报纸下面出一张卡）
  // weekend：周末，姐姐阿圆回家
  // fixed：前几个人固定，用来教。flaw 破绽，react 反应
  days: [
    { date: 61, ch: 1, rules: ['expiry', 'name', 'photo'], newTool: 'line', fixed: [{ flaw: null }, { flaw: 'photo', react: 'confess' }] },
    { date: 62, ch: 1, rules: ['expiry', 'name', 'photo'] },
    { date: 63, ch: 1, rules: ['expiry', 'name', 'photo'] },
    { date: 64, ch: 1, rules: ['expiry', 'name', 'photo'] },
    { date: 65, ch: 1, rules: ['expiry', 'name', 'photo'] },
    { date: 66, ch: 1, rules: ['expiry', 'name', 'photo'], weekend: true },
    { date: 67, ch: 2, rules: ['expiry', 'name', 'photo', 'seal'], newRule: 'seal', newTool: 'print', fixed: [{ flaw: null }, { flaw: 'photoOld' }, { flaw: 'seal', react: 'confess' }] },
    { date: 68, ch: 2, rules: ['expiry', 'name', 'photo', 'seal'] },
    { date: 69, ch: 2, rules: ['expiry', 'name', 'photo', 'seal'] },
    { date: 70, ch: 2, rules: ['expiry', 'name', 'photo', 'seal'] },
    { date: 71, ch: 2, rules: ['expiry', 'name', 'photo', 'seal'] },
    { date: 72, ch: 2, rules: ['expiry', 'name', 'photo', 'seal'], weekend: true },
  ],

  rules: {
    expiry: { short: '未过期', long: '「有效至」不早于今天' },
    name: { short: '同名', long: '两张证上的名字一字不差' },
    photo: { short: '像本人', long: '身份卡照片 = 窗口里这个人', long2: '照片不像 → 按手印：对上 = 本人' },
    seal: { short: '本周章', long: '通行证的章 = 本周章（形状、颜色）' },
  },
  tools: {
    line: { name: '拉线审问', how: ['按住证件上一处，拖到另一处', '或拖到他脸上：对一对'], tip: '红线 = 对不上 · 他会有反应' },
    print: { name: '按手印', how: ['拉出红线后，底下出「按手印」', '手印对上 = 本人'], tip: '照片旧了不算错，手印为准' },
  },

  // 拉线：哪两处能对（顺序无所谓）。chip.* 是规则条上的「今天」和「本周章」样章，face 是窗口里的人
  pairs: {
    'face|id.photo': 'photo',
    'id.name|pass.name': 'name',
    'chip.expiry|pass.until': 'expiry',
    'chip.seal|pass.seal': 'seal',
  },
  lineText: {
    green: '对得上',
    grey: '这两样不用对',
    off: '今天不查这个',
  },

  // 本周章（第 2 章起查）。上周的章 = 假章的一种
  seal: { shape: 'hex', color: 'blue', char: '准' },
  sealFakes: { shape: ['circle', 'square'], color: ['purple', 'teal'] },

  // 罚单上「你漏看了什么」：{a} {b} 会换成证件上的字
  explain: {
    expiry: '有效期 {a}，今天 {b}：过期了',
    name: '名字对不上：{a} / {b}',
    photo: '照片不是本人',
    photo2: '照片不是本人，手印也对不上',
    photoOld: '照片旧了，可手印对得上：是本人',
    seal: '印章不是本周章',
    clean: '证件全对，本该放行',
  },
  fieldNames: {
    'id.photo': '照片',
    'id.name': '身份卡名字',
    'pass.name': '通行证名字',
    'pass.until': '有效期',
    'pass.seal': '印章',
    face: '他本人',
    'chip.expiry': '今天',
    'chip.seal': '本周章',
  },

  // —— 家里人 ——
  // 外婆、小满在家；阿圆在内城当保姆，周末回家；小豆是林阿梅托给你的孩子（要你答应）
  family: {
    nan: { name: '外婆', face: { skin: 4, hair: 3, hairC: 3, eyes: 0, brows: 0, mouth: 0, shape: 0, age: 2, glasses: true, cloth: 4, collar: 1 } },
    man: { name: '小满', face: { skin: 0, hair: 0, hairC: 0, eyes: 2, brows: 1, mouth: 2, shape: 0, age: 0, cloth: 5, collar: 0 } },
    yuan: { name: '阿圆', face: { skin: 0, hair: 2, hairC: 1, eyes: 2, brows: 0, mouth: 0, shape: 1, age: 1, cloth: 6, collar: 1, earring: true } },
    dou: { name: '小豆', face: { skin: 0, hair: 5, hairC: 1, eyes: 2, brows: 1, mouth: 2, shape: 1, age: 0, cloth: 1, collar: 0 } },
  },
  // 每人头上只给一个字
  words: { cold: '冷', hungry: '饿', sick: '病', grave: '重病' },
  homeItems: {
    heat: '暖气',
    food: '饭',
    med: '药',
    tuition: '学费罐',
    rent: '房租',
  },

  // —— 路人：从这些里随机拼 ——
  generic: {
    surnames: '林陈王李赵周吴郑孙何许高罗梁唐韩冯邓曹彭萧田董潘袁蒋蔡余杜叶程苏魏吕丁沈姚卢姜崔钟谭陆汪范金石廖夏韦方白邹孟熊秦江尹薛段雷侯龙史陶黎贺毛郝龚邵万严武戴孔汤'.split(''),
    // 每个名字至少有一个字在 similar 里，第 3 天起「名字不对」只换一个长得像的字
    given: ['晓明', '一凡', '玉兰', '海峰', '静', '伟', '子涵', '思远', '秀英', '国强', '佳琪', '浩然', '美玲', '志刚', '雨桐', '欣怡', '文博', '春生', '秋月', '大山', '丽娟', '宇', '婷', '长青', '冬梅', '立新', '建华', '晓雨', '明远', '桂芳'],
    similar: [['晓', '小'], ['明', '鸣'], ['玲', '铃'], ['伟', '玮'], ['静', '婧'], ['峰', '锋'], ['兰', '岚'], ['国', '囯'], ['涵', '函'], ['远', '原'], ['英', '瑛'], ['强', '墙'], ['琪', '棋'], ['然', '燃'], ['刚', '钢'], ['桐', '彤'], ['怡', '恰'], ['博', '搏'], ['生', '升'], ['月', '玥'], ['山', '川'], ['娟', '涓'], ['宇', '字'], ['婷', '停'], ['青', '清'], ['梅', '海'], ['新', '欣'], ['雨', '两'], ['建', '健'], ['华', '桦'], ['芳', '方'], ['凡', '帆'], ['玉', '王'], ['秀', '绣'], ['佳', '家'], ['浩', '皓'], ['美', '姜'], ['志', '至'], ['子', '仔'], ['思', '恩'], ['文', '汶'], ['春', '椿'], ['秋', '湫'], ['大', '太'], ['丽', '俪'], ['长', '常'], ['冬', '东'], ['立', '粒'], ['桂', '挂']],
    districts: ['外环 1 区', '外环 3 区', '外环 4 区', '外环 6 区', '外环 7 区', '外环 9 区'],
    // 进城干什么：say 是开口说的，p 是撒谎时换的说法
    purposes: [
      { say: '我去面试。', p: '去面试' },
      { say: '去看我妈。', p: '去看我妈' },
      { say: '给老板送货。', p: '去送货' },
      { say: '我在里面做清洁。', p: '去上工' },
      { say: '接孩子放学。', p: '接孩子' },
      { say: '去修电梯。', p: '去修电梯' },
      { say: '去医院拿药。', p: '去拿药' },
      { say: '上夜班，要迟到了。', p: '上夜班' },
    ],
    // 没问题的人有时说点闲话
    chatter: ['今天风大。', '排了两个钟头。', '你们换人了？', '雨要下了。', '今天人真多。', '天天来，你不认识我？', '鸟要晒太阳。', '蛋糕要化了。'],
    // 被拉出红线后：认错（低头）
    confess: {
      expiry: ['……我知道过期了。', '续证要排一个月。'],
      name: ['……那是我哥的证。', '名字是借的。'],
      photo: ['……是我表哥的证。', '对不起。我没别的办法。'],
      seal: ['章是巷子里买的。', '……我被人骗了。'],
    },
    // 撒谎（眼神躲、冒汗、手抖）：{p} 换成跟刚才 / 上次不一样的说法
    lie: {
      expiry: ['没过期！我{p}，急着呢！', '昨天还能用！我是{p}的！'],
      name: ['就是我！我{p}……', '名字没错！我{p}！'],
      photo: ['是我本人！我{p}！', '我、我是{p}的……'],
      seal: ['章是正规的！我{p}！', '我{p}，章是局里盖的！'],
    },
    // 加价（夹的钱变两张）
    bribe: ['再加一张。交个朋友。', '不够？那这样。', '都给你，放我过去。'],
    // 照片不像时的解释（第 2 章起，真本人和冒名的都会这么说，要按手印）
    explainPhoto: ['照片是好几年前的。', '我剪了头发。', '最近瘦了好多。', '那会儿还没戴眼镜。'],
    // 绿线（对得上）时的小反应
    shrug: ['嗯？', '怎么了？', '……'],
    items: ['umbrella', 'toolbox', 'flower', 'schoolbag', 'coffee', 'plant', 'cake', 'birdcage', 'letter', 'watch', 'lunchbox', 'briefcase'],
  },
};
