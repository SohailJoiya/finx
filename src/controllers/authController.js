const User = require('../models/User')
const ProfitHistory = require('../models/ProfitHistory')
const Withdrawal = require('../models/Withdrawal')
const Deposit = require('../models/Deposit')
const Notification = require('../models/Notification')
const MonthlyReward = require('../models/MonthlyReward')
const {currentMonthKey} = require('../utils/monthKey')
const {generateToken} = require('../config/jwt')

const DAILY_PROFIT_AMOUNT = 2.0
const CLAIM_COOLDOWN_HOURS = 24

const buildReferralLink = code =>
  `${process.env.BASE_URL || 'http://localhost:5000'}/register?ref=${code}`

/** Resolve a ref string to a parent user _id.
 * Accepts either: existing user's referralCode OR a valid ObjectId (_id).
 * Returns null if not found.
 */
async function resolveRefToUserId(ref) {
  if (!ref) return null
  // Try by referralCode first
  let parent = await User.findOne({referralCode: ref}).select('_id')
  if (parent) return parent._id

  // Try as ObjectId (_id) if looks like one
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(ref)
  if (isObjectId) {
    parent = await User.findById(ref).select('_id')
    if (parent) return parent._id
  }
  return null
}

/** Generate a short referral code if the user doesn't have one yet */
function generateReferralCodeSeed(userId) {
  // base36 shorten + last 6 of objectId for readability
  const tail = String(userId).slice(-6)
  const rnd = Math.random().toString(36).substring(2, 8)
  return `${rnd}${tail}`.toLowerCase()
}

async function buildDashboard(user) {
  const userId = user._id

  // daily claim status
  let eligible = true,
    nextClaimAt = null
  if (user.lastDailyClaimAt) {
    const next = new Date(
      user.lastDailyClaimAt.getTime() + CLAIM_COOLDOWN_HOURS * 3600 * 1000
    )
    if (new Date() < next) {
      eligible = false
      nextClaimAt = next.toISOString()
    }
  }

  // today's profit
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const todayAgg = await ProfitHistory.aggregate([
    {$match: {user: userId, createdAt: {$gte: start}, type: 'Daily Profit'}},
    {$group: {_id: null, sum: {$sum: '$amount'}}}
  ])
  const todaysProfit = todayAgg.length ? todayAgg[0].sum : 0

  // totals
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

  const teamSize = await User.countDocuments({referredBy: userId})

  const profitHistory = await ProfitHistory.find({user: userId})
    .sort({createdAt: -1})
    .limit(20)
    .select('createdAt type description amount')

  const notifications = await Notification.find({
    $or: [{user: userId}, {user: null}]
  })
    .sort({createdAt: -1})
    .limit(10)
    .select('title message isRead createdAt')

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

  return {
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
    dailyClaim: {eligible, amount: DAILY_PROFIT_AMOUNT, nextClaimAt},
    earningsSummary: {
      todaysProfit,
      totalProfit: user.totalProfit || 0,
      totalWithdrawal,
      teamSize
    },
    networkStats: {
      teamSize,
      withdrawal: totalWithdrawal,
      investment: totalInvestment
    },
    profitHistory,
    notifications,
    monthlyReward
  }
}

/** POST /api/auth/register
 * body: { firstName, lastName, email, password, ref? }
 * Creates user, resolves ref to parent, sets referredBy, generates referralCode if missing,
 * returns JWT + dashboard payload (same shape as login).
 */
exports.register = async (req, res) => {
  try {
    const {firstName, lastName, email, password, ref} = req.body

    // basic validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({message: 'Missing required fields'})
    }

    // already exists?
    const exists = await User.findOne({email})
    if (exists)
      return res.status(400).json({message: 'Email already registered'})

    // resolve referredBy (if ref provided)
    let referredBy = null
    if (ref) {
      referredBy = await resolveRefToUserId(ref)
    }

    // create user
    const newUser = await User.create({
      firstName,
      lastName,
      email,
      password, // assume pre-save hash via user model
      role: 'user',
      referredBy,
      balance: 0,
      totalProfit: 0
    })

    // ensure referralCode exists
    if (!newUser.referralCode) {
      newUser.referralCode = generateReferralCodeSeed(newUser._id)
      await newUser.save()
    }

    // token + dashboard
    const token = generateToken({id: newUser._id, role: newUser.role})
    const dashboard = await buildDashboard(newUser)

    return res.status(201).json({token, ...dashboard})
  } catch (err) {
    console.error('register error:', err)
    return res.status(500).json({message: err.message})
  }
}

/** POST /api/auth/login
 * body: { email, password }
 * Returns JWT + full dashboard payload
 */
exports.login = async (req, res) => {
  try {
    const {email, password} = req.body
    const user = await User.findOne({email})
    if (!user) return res.status(400).json({message: 'Invalid credentials'})

    const ok = await user.comparePassword(password)
    if (!ok) return res.status(400).json({message: 'Invalid credentials'})

    user.lastLoginAt = new Date()
    if (!user.referralCode) {
      user.referralCode = generateReferralCodeSeed(user._id) // backfill if older account
    }
    await user.save()

    const token = generateToken({id: user._id, role: user.role})
    const dashboard = await buildDashboard(user)

    res.json({token, ...dashboard})
  } catch (err) {
    console.error('login error:', err)
    res.status(500).json({message: err.message})
  }
}
