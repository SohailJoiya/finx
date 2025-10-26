const cron = require('node-cron');
const MonthlyReward = require('../models/MonthlyReward');
const Notification = require('../models/Notification');
const { monthKeyFromDate } = require('../utils/monthKey');

cron.schedule('5 0 1 * *', async () => {
  try {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevKey = monthKeyFromDate(prev);

    const unclaimed = await MonthlyReward.find({
      month: prevKey, achievedTier: { $ne: null }, isClaimed: false
    }).select('user rewardAmount achievedTier');

    for (const r of unclaimed) {
      await Notification.create({
        user: r.user,
        title: 'Monthly Reward Available 🎯',
        message: `You reached ${r.achievedTier} in ${prevKey}. Claim your $${r.rewardAmount} reward!`
      });
    }
    console.log(`[Cron] Monthly rollover processed for ${prevKey}`);
  } catch (e) {
    console.error('[Cron] Monthly rollover failed:', e);
  }
}, { timezone: 'Asia/Karachi' });

module.exports = {};