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

const mongoose = require('mongoose')
// ... keep your existing imports & helpers

exports.getUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id
    const user = await User.findById(userId).select(
      'firstName lastName email balance user_level totalProfit lastDailyClaimAt referralCode wallets role timezone timeZone'
    )

    // --- daily claim status (TZ-aware, resets at user's local midnight)
    let eligible = true
    let nextClaimAt = null

    const userTz = user?.timezone || user?.timeZone || 'Asia/Karachi'
    const nowUtc = new Date()
    const nowInUserTz = utcToZonedTime(nowUtc, userTz)

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

    // --- today's profit (server-midnight-based)
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

    // --- fetch team across 5 levels using $graphLookup (0..4 -> levels 1..5)
    const [teamDoc] = await User.aggregate([
      {$match: {_id: new mongoose.Types.ObjectId(userId)}},
      {
        $graphLookup: {
          from: 'users',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'referredBy',
          as: 'team',
          maxDepth: 4, // 0..4 => 5 levels total
          depthField: 'level' // 0 => L1 (directs), 4 => L5
        }
      },
      {$project: {team: 1, _id: 0}}
    ])

    const team = (teamDoc?.team || []).map(u => ({
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      balance: u.balance || 0,
      level: (u.level ?? 0) + 1 // convert 0..4 to 1..5
    }))

    // ✅ Only count members with balance >= 35 toward teamSize
    const TEAM_SIZE_THRESHOLD = 35
    const eligibleTeam = team.filter(t => t.balance >= TEAM_SIZE_THRESHOLD)
    const teamSize = eligibleTeam.length

    const teamIds = team.map(t => t._id)

    // --- per-level breakdown (counts & sum of balances)
    const levels = [1, 2, 3, 4, 5].map(L => {
      const atLevel = team.filter(t => t.level === L)
      const count = atLevel.length
      const sumBalances = atLevel.reduce((s, d) => s + (d.balance || 0), 0)
      // (optional) how many at this level meet the >= 35 criterion
      const eligibleCount = atLevel.filter(
        t => t.balance >= TEAM_SIZE_THRESHOLD
      ).length
      return {level: L, count, sumBalances, eligibleCount}
    })

    // --- first-level directs (for backward-compatible details list)
    const directs = team.filter(t => t.level === 1)
    const directChildrenBalance = levels[0].sumBalances

    // --- withdrawals: parent + all team (Approved)
    let teamWithdrawal = 0
    if (teamIds.length) {
      const dirWithAgg = await Withdrawal.aggregate([
        {$match: {user: {$in: teamIds}, status: 'Approved'}},
        {$group: {_id: null, sum: {$sum: '$amount'}}}
      ])
      teamWithdrawal = dirWithAgg.length ? dirWithAgg[0].sum : 0
    }
    const parentPlusTeamWithdrawal = totalWithdrawal + teamWithdrawal

    // --- investments: parent deposits + team balances (keeping your prior semantics)
    const teamBalancesSum = levels.reduce((s, L) => s + L.sumBalances, 0)
    const parentPlusTeamInvestment = totalInvestment + teamBalancesSum

    // If you want "team investment" to mean team deposits instead of balances,
    // swap the above with this:
    // let teamDeposits = 0
    // if (teamIds.length) {
    //   const depAgg = await Deposit.aggregate([
    //     { $match: { user: { $in: teamIds }, status: 'Approved' } },
    //     { $group: { _id: null, sum: { $sum: '$amount' } } }
    //   ])
    //   teamDeposits = depAgg.length ? depAgg[0].sum : 0
    // }
    // const parentPlusTeamInvestment = totalInvestment + teamDeposits

    // --- profit history (latest 5)
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

    // --- monthly reward (unchanged)
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
        wallets: user.wallets || [],
        user_level: user.user_level
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
        teamSize // now counts only members with balance >= 35
      },
      networkStats: {
        teamSize, // across levels 1..5, filtered by balance >= 35
        withdrawal: parentPlusTeamWithdrawal,
        investment: parentPlusTeamInvestment,
        _details: {
          parent: {
            withdrawalsApproved: totalWithdrawal,
            depositsApproved: totalInvestment
          },
          levels, // [{level, count, sumBalances, eligibleCount}, ... up to 5]
          directs: {
            count: levels[0].count,
            sumBalances: directChildrenBalance,
            withdrawalsApproved: teamWithdrawal, // total team; adjust if you want only L1
            list: directs.map(d => ({
              id: d._id,
              name: `${d.firstName || ''} ${d.lastName || ''}`.trim(),
              balance: d.balance || 0
            }))
          }
        }
      },
      profitHistory, // latest 5
      notifications,
      monthlyReward
    })
  } catch (err) {
    console.error('dashboard error', err)
    res.status(500).json({message: err.message})
  }
}
