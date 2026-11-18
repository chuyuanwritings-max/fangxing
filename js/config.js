// 《放行》原型 · 所有可以调的数都在这里。
// 单位：时间是秒，距离是屏幕上的点（375 宽的手机上量），钱是「元」。
// 人物、证件、规则、故事的字在 js/data.js。

const config = {
  version: '放行 · 原型 0.1',

  // 激励视频广告位 id。空着 = 放「广告占位（激励视频）」；上线前填后台建的 id。
  rewardedAdUnitId: '',
  fakeAdSec: 1.5,

  days: 3, // 原型一共几天

  // —— 每天（第 1、2、3 天）——
  daySec: [100, 110, 120], // 一天上班多少秒（时间紧：认真查一个人大约 8～12 秒）
  peoplePerDay: [9, 10, 10], // 队里排几个人（查不完就下班了）
  invalidRate: [0.4, 0.5, 0.55], // 随机路人里有问题的比例
  bribeRate: [0, 0.2, 0.25], // 有问题的路人里，往证件里夹钱的比例（故事人物另算）
  bribeAmount: [10, 20], // 路人夹多少钱（最少、最多）

  // —— 越来越难：破绽一天比一天细 ——
  // expiryGap：过期了几天（第 1 天差很多，第 3 天只差 1 天）
  // nameMode：surname 换姓（一眼看出） / similar 换一个长得像的字（晓→小）
  // photoMode：face 换一张脸 / hair 换发型 / detail 只差一处（眼镜、胡子、发色）
  // sealMode：shape 形状不对 / color 只有颜色不对
  // hint：有问题的人说一句「露馅的话」的机会
  subtle: [
    { expiryGap: [6, 40], nameMode: 'surname', photoMode: 'face', sealMode: 'shape', hint: 0.5 },
    { expiryGap: [1, 4], nameMode: 'similar', photoMode: 'hair', sealMode: 'shape', hint: 0.35 },
    { expiryGap: [1, 1], nameMode: 'similar', photoMode: 'detail', sealMode: 'color', hint: 0.2 },
  ],
  permitMissingRate: 0.35, // 第 3 天许可有问题时，「根本没带」的比例（其余是日期不对）

  // —— 钱 ——
  pay: {
    correct: 8, // 判对一个人
    evidence: 2, // 驳回时圈对了破绽（查实）
    fine: 8, // 判错一个人：这一个不给钱，还罚这么多
  },
  startMoney: 15, // 开局存款
  // 每晚要付的账（第 1、2、3 天；名字在 data.js）。药一天比一天贵
  bills: { rent: [30, 30, 30], food: [25, 25, 25], med: [25, 30, 35] },
  missLimit: 2, // 同一笔账连着几晚没付就出大事（结局）

  // —— 广告（只有激励视频，不放插屏）——
  fileAdsPerDay: 2, // 「调出档案」每天最多几次
  overtimeSec: 35, // 「加班一小时」多给几秒
  overtimeExtraPeople: 4, // 加班时队里补几个人

  // —— 手感 ——
  swipeDist: 70, // 证件拖多远算一次滑动（放行 / 驳回）
  tapSlop: 10, // 手指动了多少以内算「点一下」
  lowTimeSec: 15, // 剩多少秒开始滴答、钟变红
  anim: {
    walkIn: 0.55, // 下一个人走到窗口
    docsIn: 0.3, // 证件递进来
    stampSec: 0.5, // 盖章动画
    stampHit: 0.13, // 章落下的那一刻
    leave: 0.5, // 证件递回去、人走开
    slipSec: 2.6, // 罚单停留（点一下可以提前关）；罚单期间时钟停
    folderSec: 0.7, // 档案袋翻开
    leaveLineSec: 0.9, // 故事人物走时说一句话
  },
  // 爽感分级（README 里有节拍表）
  juice: {
    markShake: 0,
    stampShake: 5,
    evidenceShake: 9,
    bigShake: 14,
    hitstopSec: 0.08, // 查实时顿一下
    bigHitstopSec: 0.16, // 识破督察 / 一天全对
  },
};

module.exports = config;
