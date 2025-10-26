const MonthlyReward = require('../models/MonthlyReward');
const User = require('../models/User');
const TIERS = require('../utils/rewardTiers');
const { currentMonthKey } = require('../utils/monthKey');

const pickTier = (sum) => {
  let best = null;
  for (const t of TIERS) {
    if (sum >= t.target) best = t; else break;
  }
  return best;
};

async function getOrCreateMonthlyDoc(userId, month = currentMonthKey()) {
  let doc = await MonthlyReward.findOne({ user: userId, month });
  if (!doc) doc = await MonthlyReward.create({ user: userId, month });
  return doc;
}

exports.recordApprovedDepositForMonth = async (userId, amount) => {
  const month = currentMonthKey();
  const me = await getOrCreateMonthlyDoc(userId, month);
  me.totalInvestment += Number(amount);
  const sumMe = me.totalInvestment + me.teamInvestment;
  const tierMe = pickTier(sumMe);
  if (tierMe) { me.achievedTier = tierMe.tier; me.rewardAmount = tierMe.reward; }
  await me.save();

  let hop = await User.findById(userId).select('referredBy');
  let guard = 0;
  while (hop?.referredBy && guard < 50) {
    const up = await User.findById(hop.referredBy).select('_id referredBy');
    if (!up) break;
    const upDoc = await getOrCreateMonthlyDoc(up._id, month);
    upDoc.teamInvestment += Number(amount);
    const sumUp = upDoc.totalInvestment + upDoc.teamInvestment;
    const t = pickTier(sumUp);
    if (t) { upDoc.achievedTier = t.tier; upDoc.rewardAmount = t.reward; }
    await upDoc.save();
    hop = up;
    guard++;
  }
};