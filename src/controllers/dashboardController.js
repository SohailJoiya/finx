const User = require('../models/User');
const ProfitHistory = require('../models/ProfitHistory');
const Withdrawal = require('../models/Withdrawal');
const Deposit = require('../models/Deposit');
const Notification = require('../models/Notification');
const MonthlyReward = require('../models/MonthlyReward');
const { currentMonthKey } = require('../utils/monthKey');

const DAILY_PROFIT_AMOUNT = 2.0;
const CLAIM_COOLDOWN_HOURS = 24;

function buildReferralLink(code) {
  const base = process.env.BASE_URL || 'http://localhost:5000';
  return `${base}/register?ref=${code}`;
}

exports.getUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select(
      'firstName lastName email balance totalProfit lastDailyClaimAt referralCode wallets role'
    );

    // --- daily claim status
    let eligible = true, nextClaimAt = null;
    if (user.lastDailyClaimAt) {
      const next = new Date(user.lastDailyClaimAt.getTime() + CLAIM_COOLDOWN_HOURS * 3600 * 1000);
      if (new Date() < next) { eligible = false; nextClaimAt = next.toISOString(); }
    }

    // --- today's profit
    const start = new Date(); start.setHours(0,0,0,0);
    const todayAgg = await ProfitHistory.aggregate([
      { $match: { user: userId, createdAt: { $gte: start }, type: 'Daily Profit' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } }
    ]);
    const todaysProfit = todayAgg.length ? todayAgg[0].sum : 0;

    // --- totals: withdrawals (approved) and investments (approved)
    const withAgg = await Withdrawal.aggregate([
      { $match: { user: userId, status: 'Approved' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } }
    ]);
    const totalWithdrawal = withAgg.length ? withAgg[0].sum : 0;

    const investAgg = await Deposit.aggregate([
      { $match: { user: userId, status: 'Approved' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } }
    ]);
    const totalInvestment = investAgg.length ? investAgg[0].sum : 0;

    // --- team size (directs)
    const teamSize = await User.countDocuments({ referredBy: userId });

    // --- profit history (latest 20)
    const profitHistory = await ProfitHistory.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('createdAt type description amount');

    // --- recent notifications (10)
    const notifications = await Notification.find({ $or: [{ user: userId }, { user: null }] })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title message isRead createdAt');

    // --- monthly reward
    const month = currentMonthKey();
    const mr = await MonthlyReward.findOne({ user: userId, month });
    const monthlyReward = {
      month,
      totalInvestment: mr?.totalInvestment || 0,
      teamInvestment: mr?.teamInvestment || 0,
      achievedTier: mr?.achievedTier || null,
      rewardAmount: mr?.rewardAmount || 0,
      isClaimed: mr?.isClaimed || false,
      progressSum: (mr?.totalInvestment || 0) + (mr?.teamInvestment || 0),
    };

    res.json({
      user: {
        id: userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        balance: user.balance,
        totalProfit: user.totalProfit || 0,
        wallets: user.wallets || [],
      },
      referral: {
        code: user.referralCode,
        link: buildReferralLink(user.referralCode),
      },
      dailyClaim: {
        eligible,
        amount: DAILY_PROFIT_AMOUNT,
        nextClaimAt,
      },
      earningsSummary: {
        todaysProfit,
        totalProfit: user.totalProfit || 0,
        totalWithdrawal,
        teamSize,
      },
      networkStats: {
        teamSize,
        withdrawal: totalWithdrawal,
        investment: totalInvestment
      },
      profitHistory,
      notifications,
      monthlyReward
    });
  } catch (err) {
    console.error('dashboard error', err);
    res.status(500).json({ message: err.message });
  }
};