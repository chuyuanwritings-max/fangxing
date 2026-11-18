// 《放行》原型 · 所有可以调的数都在这里。
// 单位：时间是秒，距离是屏幕上的点（375 宽的手机上量），钱是「元」。
// 人物、证件、规则的字在 js/data.js；回头客、报纸、家里的暗线在 js/story.js。

const config = {
  version: '放行 · 原型 0.2',
  saveKey: 'fangxing_v2',

  // 激励视频广告位 id。空着 = 放「广告占位（激励视频）」；上线前填后台建的 id。
  rewardedAdUnitId: '',
  fakeAdSec: 1.5,

  // —— 每天（第 1～12 天，前 6 天是第 1 章，后 6 天是第 2 章）——
  daySec: [120, 115, 115, 120, 120, 120, 130, 125, 125, 130, 130, 130], // 一天上班多少秒
  peoplePerDay: [10, 11, 11, 12, 12, 12, 11, 12, 12, 12, 13, 13], // 随机路人几个（回头客另算）
  invalidRate: [0.35, 0.4, 0.45, 0.45, 0.5, 0.5, 0.45, 0.5, 0.5, 0.55, 0.55, 0.55], // 路人里有问题的比例
  bribeRate: [0, 0.15, 0.2, 0.2, 0.25, 0.25, 0.2, 0.25, 0.25, 0.3, 0.3, 0.3], // 有问题的路人里夹钱的比例
  bribeAmount: [10, 20], // 路人夹多少钱（最少、最多）
  returnerRate: 0.45, // 被你驳回的路人，过两三天回来的机会
  returnerMax: 2, // 每天最多回来几个

  // —— 越来越难：破绽一天比一天细（每天一行）——
  // expiryGap 过期几天；nameMode surname 换姓 / similar 换一个长得像的字；
  // photoMode face 换一张脸 / hair 换发型 / detail 只差一处；sealMode shape 形状不对 / color 颜色不对
  // oldPhoto：第 2 章起，「照片不像」里有多少其实是本人（照片旧了，按手印能证明）
  subtle: [
    { expiryGap: [8, 40], nameMode: 'surname', photoMode: 'face', sealMode: 'shape', oldPhoto: 0 },
    { expiryGap: [5, 20], nameMode: 'surname', photoMode: 'face', sealMode: 'shape', oldPhoto: 0 },
    { expiryGap: [3, 10], nameMode: 'similar', photoMode: 'face', sealMode: 'shape', oldPhoto: 0 },
    { expiryGap: [2, 6], nameMode: 'similar', photoMode: 'hair', sealMode: 'shape', oldPhoto: 0 },
    { expiryGap: [1, 4], nameMode: 'similar', photoMode: 'hair', sealMode: 'shape', oldPhoto: 0 },
    { expiryGap: [1, 2], nameMode: 'similar', photoMode: 'detail', sealMode: 'shape', oldPhoto: 0 },
    { expiryGap: [1, 6], nameMode: 'similar', photoMode: 'hair', sealMode: 'shape', oldPhoto: 0.5 },
    { expiryGap: [1, 4], nameMode: 'similar', photoMode: 'hair', sealMode: 'shape', oldPhoto: 0.5 },
    { expiryGap: [1, 3], nameMode: 'similar', photoMode: 'hair', sealMode: 'color', oldPhoto: 0.5 },
    { expiryGap: [1, 2], nameMode: 'similar', photoMode: 'detail', sealMode: 'color', oldPhoto: 0.5 },
    { expiryGap: [1, 1], nameMode: 'similar', photoMode: 'detail', sealMode: 'color', oldPhoto: 0.5 },
    { expiryGap: [1, 1], nameMode: 'similar', photoMode: 'detail', sealMode: 'color', oldPhoto: 0.5 },
  ],
  // 有问题的路人被拉出红线后的反应（认错 / 撒谎 / 加价）比例；夹了钱的人才会加价
  reactWeights: { confess: 0.45, lie: 0.55 },
  bribeReactRate: 0.6, // 夹了钱的人，被拉出红线后加价的机会

  // —— 钱 ——
  pay: {
    correct: 5, // 判对一个人
    evidence: 2, // 驳回时拉出了那根红线 / 按手印证明了本人（查实）
    fine: 5, // 判错：第 3 次起每次罚这么多
    freeWarnings: 2, // 每天前几次判错只警告不扣钱
  },
  startMoney: 20,
  // 家里每晚（按章：第 1 章、第 2 章）。房租必付；暖气、饭、药自己挑
  home: {
    rent: [25, 28],
    heat: [14, 16],
    food: [20, 24],
    foodExtra: 5, // 家里多一张嘴（小豆）饭钱多这么多
    med: [20, 28], // 一份药，第 2 章涨价
    medDealRate: 0.5, // 跟药贩做了交易：外婆的药打几折
    tuitionStep: 10, // 「学费罐」一次放多少
    debtLimit: 2, // 连着几晚欠房租就被赶出门（这一天重来）
  },
  // 家里人：几晚不吃 / 几晚没暖气会生病；外婆一晚没暖气就病
  // deathAt：病 = 1、重病 = 2、更重 = 3（头像更淡），到这个数那晚椅子空出来
  health: { hungerSick: 2, coldSick: 2, nanColdSick: 1, deathAt: 4 },

  // —— 广告（只有激励视频，不放插屏；只救急，不抹掉每晚的取舍）——
  fileAdsPerDay: 2, // 「调出档案」每天几次
  overtimeSec: 30, // 「加班」多给几秒
  overtimeExtraPeople: 3, // 加班时队里补几个人
  doubleCap: 12, // 「今日工资翻倍」最多多给几块
  // 加班和工资翻倍：每天只能二选一（免得一晚把账全填平）
  appealPerDay: 1, // 「罚单申诉」每天几次（撤一张罚单）
  doctorPerChapter: 1, // 「夜诊医生」每章几次：把一个重病救回到病

  // —— 手感 ——
  tapSlop: 10, // 手指动了多少以内算「点一下」
  snapDist: 34, // 拉线时离目标多近就吸上去
  lowTimeSec: 15, // 剩多少秒开始滴答、钟变红
  anim: {
    walkIn: 0.55, // 下一个人走到窗口
    docsIn: 0.3, // 证件递进来
    stampSec: 0.5, // 盖章动画
    stampHit: 0.13, // 章落下的那一刻
    leave: 0.5, // 证件递回去、人走开
    leaveLineSec: 0.9, // 回头客走时说一句话
    reactSec: 1.6, // 红线后人物的反应（不挡操作）
    printSec: 1.3, // 按手印的动画
    citeSec: 2.2, // 罚单从打印机吐出来（期间时钟停，点一下可提前关）
    folderSec: 0.7, // 档案袋翻开
    slipLineSec: 0.32, // 工资条每行吐出来的间隔
    coinFlySec: 0.55, // 钱飞进钱包
  },
  // 爽感分级（README 里有节拍表）
  juice: {
    greenShake: 0,
    redShake: 6,
    stampShake: 5,
    evidenceShake: 9,
    fineShake: 8,
    bigShake: 14,
    hitstopSec: 0.08,
    bigHitstopSec: 0.16,
  },
};

module.exports = config;
