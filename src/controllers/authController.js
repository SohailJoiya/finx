const User = require('../models/User')
const ProfitHistory = require('../models/ProfitHistory')
const Withdrawal = require('../models/Withdrawal')
const Deposit = require('../models/Deposit')
const Notification = require('../models/Notification')
const MonthlyReward = require('../models/MonthlyReward')
const {currentMonthKey} = require('../utils/monthKey')
const {generateToken} = require('../config/jwt')
const crypto = require('crypto')
const {sendEmail} = require('../services/emailService')
const makeVerifyEmail = require('../templates/verificationEmail')
const makeResetEmail = require('../templates/resetPasswordEmail')

const DAILY_PROFIT_AMOUNT = 2.0

const BACKEND_URL = process.env.BASE_URL || 'https://api.zoraiztech.online'
function buildBackendUrl(path) {
  return `${BACKEND_URL}${path}`
}
const CLAIM_COOLDOWN_HOURS = 24

const buildReferralLink = code =>
  `${process.env.BASE_URL || 'https://flareautoearn.com'}/register?ref=${code}`

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

/** POST /api/auth/login
 * body: { email, password }
 * Returns JWT + full dashboard payload
 */
exports.login = async (req, res) => {
  try {
    const {email, password} = req.body
    const user = await User.findOne({email})
    if (!user) return res.status(400).json({message: 'Invalid credentials'})

    // 🔒 Blocked users cannot login
    if (user.isActive === false) {
      return res
        .status(403)
        .json({message: 'Your account is blocked. Contact support.'})
    }

    // ✅ Require verification only for accounts created on/after the cutoff
    // Use an ENV var if you want (LOGIN_VERIFY_CUTOFF), else default to your given timestamp.
    const cutoff = new Date(
      process.env.LOGIN_VERIFY_CUTOFF || '2025-11-03T16:23:21.245Z'
    )
    if (
      !user.isVerified &&
      user.createdAt &&
      user.createdAt.getTime() >= cutoff.getTime()
    ) {
      return res
        .status(403)
        .json({message: 'Please verify your email before logging in.'})
    }

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

// --- Email Verification: Register
exports.register = async (req, res) => {
  try {
    console.log(req.body)
    const {firstName, lastName, email, password, referralCode} = req.body
    const exists = await User.findOne({email})
    if (exists)
      return res.status(400).json({message: 'Email already registered'})
    let referredBy = null
    if (referralCode) {
      referredBy = await resolveRefToUserId(referralCode)
    }

    const user = new User({firstName, lastName, email, password, referredBy})
    // create verification token (hashed for DB, plain for link)
    const raw = crypto.randomBytes(32).toString('hex')
    const hash = crypto.createHash('sha256').update(raw).digest('hex')
    user.verificationToken = hash
    user.verificationExpires = new Date(Date.now() + 24 * 3600 * 1000)
    // resolve referredBy (if ref provided)

    await user.save()

    // Send verification email
    const verifyUrl = buildBackendUrl(`/api/auth/verify-email?token=${raw}`)
    const html = makeVerifyEmail({name: firstName || '', url: verifyUrl})
    await sendEmail({to: email, subject: 'Verify your email', html})

    res.status(201).json({message: 'Registered. Please verify your email.'})
  } catch (err) {
    console.error('register error', err)
    res.status(500).json({message: err.message})
  }
}

// --- Verify email
exports.verifyEmail = async (req, res) => {
  try {
    const {token} = req.query
    if (!token) return res.status(400).json({message: 'Missing token'})

    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      verificationToken: hash,
      verificationExpires: {$gt: new Date()}
    })

    if (!user)
      return res.status(400).json({message: 'Invalid or expired token'})

    // ✅ Mark verified
    user.isVerified = true
    user.verificationToken = undefined
    user.verificationExpires = undefined
    await user.save()

    // ✅ Redirect to homepage (frontend)
    const redirectUrl = process.env.FRONTEND_URL || 'https://flareautoearn.com'
    return res.redirect(302, `${redirectUrl}/`)
  } catch (err) {
    console.error('verifyEmail error', err)
    res.status(500).json({message: err.message})
  }
}

// --- Resend verify link
exports.resendVerification = async (req, res) => {
  try {
    const {email} = req.body
    const user = await User.findOne({email})
    if (!user) return res.status(404).json({message: 'User not found'})
    if (user.isVerified)
      return res.status(400).json({message: 'Already verified'})

    const raw = crypto.randomBytes(32).toString('hex')
    const hash = crypto.createHash('sha256').update(raw).digest('hex')
    user.verificationToken = hash
    user.verificationExpires = new Date(Date.now() + 24 * 3600 * 1000)
    await user.save()

    const verifyUrl = buildBackendUrl(`/api/auth/verify-email?token=${raw}`)
    const html = makeVerifyEmail({name: user.firstName || '', url: verifyUrl})
    await sendEmail({to: user.email, subject: 'Verify your email', html})

    res.json({message: 'Verification link sent'})
  } catch (err) {
    console.error('resendVerification error', err)
    res.status(500).json({message: err.message})
  }
}

// --- Forgot password

exports.forgotPassword = async (req, res) => {
  try {
    const {email} = req.body
    const user = await User.findOne({email})
    // Always respond 200 to avoid email enumeration
    if (!user) {
      return res
        .status(200)
        .json({message: 'If that email exists, we sent an OTP.'})
    }

    // 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // Hash OTP before saving
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex')
    user.passwordResetOTP = otp
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    await user.save()

    // Send OTP email
    const html = makeResetEmail({name: user.firstName || '', otp})
    await sendEmail({to: user.email, subject: 'Your password reset OTP', html})

    return res.json({message: 'If that email exists, we sent an OTP.'})
  } catch (err) {
    console.error('forgotPassword error', err)
    res.status(500).json({message: err.message})
  }
}

// POST /api/auth/verify-reset-otp
exports.verifyResetOTP = async (req, res) => {
  try {
    const {otp} = req.body
    if (!otp) {
      return res.status(400).json({message: 'Email and OTP are required.'})
    }

    const user = await User.findOne({passwordResetOTP: otp})

    if (!user._id) {
      return res.status(400).json({message: 'Invalid or expired OTP.'})
    }

    // ✅ OTP verified — issue short-lived one-time session token
    const rawSession = crypto.randomBytes(32).toString('hex')
    const sessionHash = crypto
      .createHash('sha256')
      .update(rawSession)
      .digest('hex')

    user.resetSessionToken = sessionHash
    user.resetSessionExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 min
    // Clear OTP so it can't be reused
    user.passwordResetOTP = undefined
    user.passwordResetExpires = undefined
    await user.save()

    // Return the **raw** session token to client (used in next step)
    return res.json({
      message: 'OTP verified.',
      resetToken: rawSession,
      expiresInMinutes: 10,
      user
    })
  } catch (err) {
    console.error('verifyResetOTP error', err)
    res.status(500).json({message: err.message})
  }
}

// --- Reset password (POST)
exports.resetPassword = async (req, res) => {
  try {
    const {token} = req.query
    const {password} = req.body
    if (!token) return res.status(400).json({message: 'Missing token'})
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({message: 'Password must be at least 6 characters'})
    }
    const hash = require('crypto')
      .createHash('sha256')
      .update(token)
      .digest('hex')
    const user = await User.findOne({
      passwordResetToken: hash,
      passwordResetExpires: {$gt: new Date()}
    })
    if (!user)
      return res.status(400).json({message: 'Invalid or expired token'})

    user.password = password
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save()

    res.json({message: 'Password updated successfully'})
  } catch (err) {
    console.error('resetPassword error', err)
    res.status(500).json({message: err.message})
  }
}

// POST /api/auth/set-new-password
exports.setNewPassword = async (req, res) => {
  try {
    const {email, resetToken, password} = req.body
    if (!email || !password) {
      return res
        .status(400)
        .json({message: 'Email, resetToken, and password are required.'})
    }
    if (String(password).length < 6) {
      return res
        .status(400)
        .json({message: 'Password must be at least 6 characters.'})
    }

    const user = await User.findOne({email})
    if (!user) {
      return res.status(400).json({message: 'Invalid or expired token.'})
    }

    // ✅ Update password & clear session token
    user.password = password
    user.resetSessionToken = undefined
    user.resetSessionExpires = undefined
    await user.save()

    return res.json({message: 'Password updated successfully.'})
  } catch (err) {
    console.error('setNewPassword error', err)
    res.status(500).json({message: err.message})
  }
}
