const User = require('../models/User')
const ProfitHistory = require('../models/ProfitHistory')
const Notification = require('../models/Notification')
const {startOfDay, addDays} = require('date-fns')
const {utcToZonedTime, zonedTimeToUtc} = require('date-fns-tz')

const CLAIM_COOLDOWN_HOURS = 24
const DAILY_PERCENT = 0.02 // 2%

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

// ✅ GET /api/profit/today
exports.getTodayStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      'balance lastDailyClaimAt'
    )
    if (!user) return res.status(404).json({message: 'User not found'})

    const now = new Date()
    let eligible = true
    let nextClaimAt = null

    if (user.lastDailyClaimAt) {
      const last = new Date(user.lastDailyClaimAt)
      const next = new Date(last.getTime() + CLAIM_COOLDOWN_HOURS * 3600 * 1000)

      // Check if date changed (different calendar day)
      const dateChanged =
        now.getFullYear() !== last.getFullYear() ||
        now.getMonth() !== last.getMonth() ||
        now.getDate() !== last.getDate()

      // If still within cooldown and same calendar day → not eligible
      if (!dateChanged && now < next) {
        eligible = false
        nextClaimAt = next.toISOString()
      }
    }

    const amount = round2((Number(user.balance) || 0) * DAILY_PERCENT)
    res.json({eligible, percent: DAILY_PERCENT * 100, amount, nextClaimAt})
  } catch (err) {
    console.error('getTodayStatus error:', err)
    res.status(500).json({message: err.message})
  }
}

// ✅ POST /api/profit/claim-daily (TZ-aware once-per-day)
exports.claimDailyProfit = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      'balance totalProfit lastDailyClaimAt timeZone user_level'
    )
    if (!user) return res.status(404).json({message: 'User not found'})

    const userTz = user?.timeZone || 'Asia/Karachi'
    const nowUtc = new Date()
    const nowInUserTz = utcToZonedTime(nowUtc, userTz)
    const startOfTomorrowInUserTz = startOfDay(addDays(nowInUserTz, 1))
    const nextUtc = zonedTimeToUtc(startOfTomorrowInUserTz, userTz)

    // already claimed today?
    if (user.lastDailyClaimAt) {
      const lastInUserTz = utcToZonedTime(
        new Date(user.lastDailyClaimAt),
        userTz
      )
      const claimedSameLocalDay =
        lastInUserTz.getFullYear() === nowInUserTz.getFullYear() &&
        lastInUserTz.getMonth() === nowInUserTz.getMonth() &&
        lastInUserTz.getDate() === nowInUserTz.getDate()

      if (claimedSameLocalDay) {
        return res.status(400).json({
          message: 'Daily profit already claimed. Try again at local midnight.',
          nextClaimAt: nextUtc.toISOString()
        })
      }
    }

    // Minimum balance rule
    const base = Number(user.balance) || 0
    if (base < 35) {
      return res.status(400).json({
        message: 'Your balance must be at least $35 to claim daily profit.',
        nextClaimAt: nextUtc.toISOString()
      })
    }

    // 💡 Level-based percent
    const LEVEL_PERCENTS = {1: 0.02, 2: 0.025, 3: 0.03, 4: 0.035, 5: 0.04}
    const dailyPercent = LEVEL_PERCENTS[user.user_level] || 0

    // If level 0 or invalid -> block claim
    if (dailyPercent === 0) {
      return res.status(400).json({
        message: 'Your level must be at least 1 to claim daily profit.',
        nextClaimAt: nextUtc.toISOString()
      })
    }

    // Calculate credit using level percent
    const credit = round2(base * dailyPercent)
    if (credit <= 0) {
      return res.status(400).json({message: 'Nothing to claim for your level.'})
    }

    // 💰 Update wallet + totals
    user.balance = round2(base + credit)
    user.totalProfit = round2((user.totalProfit || 0) + credit)
    user.lastDailyClaimAt = nowUtc
    await user.save()

    // 🧾 Log profit
    await ProfitHistory.create({
      user: user._id,
      type: 'Daily Profit',
      description: `${(dailyPercent * 100).toFixed(
        1
      )}% daily profit on $${base.toFixed(2)}`,
      amount: credit
    })

    // 🔔 Notify user
    await Notification.create({
      user: user._id,
      title: 'Daily Profit Claimed 🎉',
      message: `You received $${credit.toFixed(2)} (${(
        dailyPercent * 100
      ).toFixed(1)}% of your wallet balance).`
    })

    res.json({
      message: 'Daily profit credited successfully.',
      level: user.user_level,
      percent: dailyPercent,
      credited: credit,
      balance: user.balance,
      totalProfit: user.totalProfit,
      lastDailyClaimAt: user.lastDailyClaimAt
    })
  } catch (err) {
    console.error('claimDailyProfit error', err)
    res.status(500).json({message: err.message})
  }
}

// ✅ GET /api/profit/history?page=&limit=
exports.getHistory = async (req, res) => {
  try {
    const {page = 1, limit = 20} = req.query
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10)

    const [items, total] = await Promise.all([
      ProfitHistory.find({user: req.user._id})
        .sort({createdAt: -1})
        .skip(skip)
        .limit(parseInt(limit, 10))
        .select('createdAt type description amount'),
      ProfitHistory.countDocuments({user: req.user._id})
    ])

    res.json({
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      results: items
    })
  } catch (err) {
    console.error('getHistory error:', err)
    res.status(500).json({message: err.message})
  }
}
