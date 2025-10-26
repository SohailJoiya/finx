const User = require('../models/User')
const ProfitHistory = require('../models/ProfitHistory')
const Notification = require('../models/Notification')

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
    const now = new Date()
    let eligible = true,
      nextClaimAt = null

    if (user.lastDailyClaimAt) {
      const next = new Date(
        user.lastDailyClaimAt.getTime() + CLAIM_COOLDOWN_HOURS * 3600 * 1000
      )
      if (now < next) {
        eligible = false
        nextClaimAt = next.toISOString()
      }
    }

    const amount = round2((Number(user.balance) || 0) * DAILY_PERCENT)
    res.json({eligible, percent: 2, amount, nextClaimAt})
  } catch (err) {
    console.error('getTodayStatus error:', err)
    res.status(500).json({message: err.message})
  }
}

// ✅ POST /api/profit/claim-daily
exports.claimDailyProfit = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      'balance totalProfit lastDailyClaimAt'
    )
    if (!user) return res.status(404).json({message: 'User not found'})

    const now = new Date()

    // Check cooldown
    if (user.lastDailyClaimAt) {
      const next = new Date(
        user.lastDailyClaimAt.getTime() + CLAIM_COOLDOWN_HOURS * 3600 * 1000
      )
      if (now < next) {
        return res.status(400).json({
          message: 'Daily profit already claimed',
          nextClaimAt: next.toISOString()
        })
      }
    }

    const base = Number(user.balance) || 0
    const credit = round2(base * DAILY_PERCENT)

    if (credit <= 0) {
      return res
        .status(400)
        .json({message: 'Balance is zero; nothing to claim'})
    }

    // Update balance and total profit
    user.balance = round2(base + credit)
    user.totalProfit = round2((user.totalProfit || 0) + credit)
    user.lastDailyClaimAt = now
    await user.save()

    // Log ProfitHistory
    await ProfitHistory.create({
      user: user._id,
      type: 'Daily Profit',
      description: `2% daily profit on balance ${base.toFixed(2)}`,
      amount: credit
    })

    // Send notification
    await Notification.create({
      user: user._id,
      title: 'Daily Profit Claimed 🎉',
      message: `You received $${credit.toFixed(2)} (2% of your wallet balance).`
    })

    res.json({
      message: 'Daily profit credited',
      credited: credit,
      balance: user.balance,
      totalProfit: user.totalProfit,
      lastDailyClaimAt: user.lastDailyClaimAt
    })
  } catch (err) {
    console.error('claimDailyProfit error:', err)
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
