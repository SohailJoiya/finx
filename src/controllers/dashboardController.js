const User = require('../models/User')
const ProfitHistory = require('../models/ProfitHistory')
const Withdrawal = require('../models/Withdrawal')
const Deposit = require('../models/Deposit')
const Notification = require('../models/Notification')
const MonthlyReward = require('../models/MonthlyReward')
const {currentMonthKey} = require('../utils/monthKey')
require('dotenv').config()

// at top of the file once:
const {startOfDay, addDays} = require('date-fns')
const {utcToZonedTime, zonedTimeToUtc} = require('date-fns-tz')

const DAILY_PROFIT_AMOUNT = 2.0
const CLAIM_COOLDOWN_HOURS = 24

function buildReferralLink(code) {
  const base = process.env.FRONTEND_URL || 'https://flareautoearn.com'
  return `${base}/register?ref=${code}`
}

exports.getUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id
    const user = await User.findById(userId).select(
      'firstName lastName email balance totalProfit lastDailyClaimAt referralCode wallets role timezone timeZone'
    )

    // --- daily claim status (TZ-aware, resets at user's local midnight)
    let eligible = true
    let nextClaimAt = null

    const userTz = user?.timezone || user?.timeZone || 'Asia/Karachi'
    const nowUtc = new Date()
    const nowInUserTz = utcToZonedTime(nowUtc, userTz)

    // compute next local midnight and expose as UTC ISO (for countdowns)
    const startOfTomorrowInUserTz = startOfDay(addDays(nowInUserTz, 1))
    nextClaimAt = zonedTimeToUtc(startOfTomorrowInUserTz, userTz).toISOString()

    if (user.lastDailyClaimAt) {
      const lastInUserTz = utcToZonedTime(
        new Date(user.lastDailyClaimAt),
        userTz
      )
      const claimedSameLocalDay =
        nowInUserTz.getFullYear() === lastInUserTz.getFullYear() &&
        nowInUserTz.getMonth() === lastInUserTz.getMonth() &&
        nowInUserTz.getDate() === lastInUserTz.getDate()

      if (claimedSameLocalDay) eligible = false
    }

    // --- today's profit (still server-midnight-based)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const todayAgg = await ProfitHistory.aggregate([
      {$match: {user: userId, createdAt: {$gte: start}, type: 'Daily Profit'}},
      {$group: {_id: null, sum: {$sum: '$amount'}}}
    ])
    const todaysProfit = todayAgg.length ? todayAgg[0].sum : 0

    // --- parent totals
    const withAgg = await Withdrawal.aggregate([
      {$match: {user: userId, status: 'Approved'}},
      {$group: {_id: null, sum: {$sum: '$amount'}}}
    ])
    const totalWithdrawal = withAgg.length ? withAgg[0].sum : 0

    const investAgg = await Deposit.aggregate([
      {$match: {user: userId, status: 'Approved'}},
      {$group: {_id: null, sum: {$sum: '$amount'}}}
    ])
    const totalInvestment = investAgg.length ? investAgg[0].sum : 0

    // --- first-level directs
    const directs = await User.find({referredBy: userId})
      .select('_id balance firstName lastName')
      .lean()
    const teamSize = directs.length
    const directChildrenBalance = directs.reduce(
      (s, d) => s + (d.balance || 0),
      0
    )
    const directIds = directs.map(d => d._id)

    // --- withdrawals: parent + directs (Approved)
    let directChildrenWithdrawal = 0
    if (directIds.length) {
      const dirWithAgg = await Withdrawal.aggregate([
        {$match: {user: {$in: directIds}, status: 'Approved'}},
        {$group: {_id: null, sum: {$sum: '$amount'}}}
      ])
      directChildrenWithdrawal = dirWithAgg.length ? dirWithAgg[0].sum : 0
    }
    const parentPlusAllDirectsWithdrawal =
      totalWithdrawal + directChildrenWithdrawal

    // --- investments: parent deposits + directs’ balances
    const parentPlusAllDirectsInvestment =
      totalInvestment + directChildrenBalance

    // --- profit history (✅ latest 5 only)
    const profitHistory = await ProfitHistory.find({user: userId})
      .sort({createdAt: -1})
      .limit(5)
      .select('createdAt type description amount')

    // --- notifications (latest 10)
    const notifications = await Notification.find({
      $or: [{user: userId}, {user: null}]
    })
      .sort({createdAt: -1})
      .limit(10)
      .select('title message isRead createdAt')

    // --- monthly reward
    const month = currentMonthKey()
    const mr = await MonthlyReward.findOne({user: userId, month})
    const monthlyReward = {
      month,
      totalInvestment: mr?.totalInvestment || 0,
      teamInvestment: mr?.teamInvestment || 0,
      achievedTier: mr?.achievedTier || null,
      rewardAmount: mr?.rewardAmount || 0,
      isClaimed: mr?.isClaimed || false,
      progressSum: (mr?.totalInvestment || 0) + (mr?.teamInvestment || 0)
    }

    // --- final response
    res.json({
      user: {
        id: userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        balance: user.balance,
        totalProfit: user.totalProfit || 0,
        wallets: user.wallets || []
      },
      referral: {
        code: user.referralCode,
        link: buildReferralLink(user.referralCode)
      },
      dailyClaim: {
        eligible,
        amount: DAILY_PROFIT_AMOUNT,
        nextClaimAt
      },
      earningsSummary: {
        todaysProfit,
        totalProfit: user.totalProfit || 0,
        totalWithdrawal,
        teamSize
      },
      networkStats: {
        teamSize,
        withdrawal: parentPlusAllDirectsWithdrawal,
        investment: parentPlusAllDirectsInvestment,
        _details: {
          parent: {
            withdrawalsApproved: totalWithdrawal,
            depositsApproved: totalInvestment
          },
          directs: {
            count: teamSize,
            sumBalances: directChildrenBalance,
            withdrawalsApproved: directChildrenWithdrawal,
            list: directs.map(d => ({
              id: d._id,
              name: `${d.firstName || ''} ${d.lastName || ''}`.trim(),
              balance: d.balance || 0
            }))
          }
        }
      },
      profitHistory, // only 5 latest
      notifications,
      monthlyReward
    })
  } catch (err) {
    console.error('dashboard error', err)
    res.status(500).json({message: err.message})
  }
}
