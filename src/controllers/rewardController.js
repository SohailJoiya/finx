const MonthlyReward = require('../models/MonthlyReward');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { currentMonthKey } = require('../utils/monthKey');

exports.getMyMonthlyProgress = async (req, res) => {
  const month = currentMonthKey();
  const doc = await MonthlyReward.findOne({ user: req.user._id, month });
  res.json({
    month,
    totalInvestment: doc?.totalInvestment || 0,
    teamInvestment: doc?.teamInvestment || 0,
    achievedTier: doc?.achievedTier || null,
    rewardAmount: doc?.rewardAmount || 0,
    isClaimed: doc?.isClaimed || false,
    progressSum: (doc?.totalInvestment || 0) + (doc?.teamInvestment || 0)
  });
};

exports.claimMyMonthlyReward = async (req, res) => {
  const month = currentMonthKey();
  const doc = await MonthlyReward.findOne({ user: req.user._id, month });
  if (!doc) return res.status(400).json({ message: 'No progress this month yet.' });
  if (!doc.achievedTier || !doc.rewardAmount) return res.status(400).json({ message: 'No tier achieved yet.' });
  if (doc.isClaimed) return res.status(400).json({ message: 'Reward already claimed.' });

  const user = await User.findById(req.user._id);
  user.balance += Number(doc.rewardAmount);
  await user.save();

  doc.isClaimed = true;
  await doc.save();

  await Notification.create({
    user: user._id,
    title: 'Monthly Reward Claimed 🏆',
    message: `You claimed $${doc.rewardAmount} for ${doc.achievedTier} (${month}).`
  });

  res.json({ message: 'Reward claimed', reward: { month, tier: doc.achievedTier, amount: doc.rewardAmount }, balance: user.balance });
};