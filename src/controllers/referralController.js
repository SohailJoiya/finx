const User = require('../models/User');
const ReferralCommission = require('../models/ReferralCommission');
const ProfitHistory = require('../models/ProfitHistory');

const LEVELS = [0.10, 0.05, 0.03, 0.02, 0.01];

exports.distributeReferralCommission = async (fromUserId, amount) => {
  try {
    let current = await User.findById(fromUserId);
    if (!current || !current.referredBy) return;
    let level = 1;
    let uplineId = current.referredBy;
    while (uplineId && level <= LEVELS.length) {
      const upline = await User.findById(uplineId);
      if (!upline) break;
      const commission = Number((amount * LEVELS[level - 1]).toFixed(8));
      upline.balance += commission;
      upline.totalProfit += commission;
      await upline.save();

      await ReferralCommission.create({ fromUser: fromUserId, toUser: upline._id, level, amount: commission });
      await ProfitHistory.create({ user: upline._id, type: 'Referral Bonus', amount: commission, description: `Level ${level} from ${current._id}` });

      uplineId = upline.referredBy;
      level++;
    }
  } catch (err) {
    console.error('Referral error', err);
  }
};

exports.getReferralTreeFor = async (userId, maxLevel = 5) => {
  const build = async (parentId, level) => {
    if (level > maxLevel) return [];
    const children = await User.find({ referredBy: parentId }).select('firstName lastName email referralCode');
    const out = [];
    for (const c of children) {
      out.push({
        level,
        id: c._id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        referralCode: c.referralCode,
        referrals: await build(c._id, level+1)
      });
    }
    return out;
  };
  return await build(userId, 1);
};