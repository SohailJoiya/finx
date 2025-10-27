const mongoose = require('mongoose')
const Deposit = require('../models/Deposit')
const Withdrawal = require('../models/Withdrawal')
const User = require('../models/User')
const Notification = require('../models/Notification')
const {
  recordApprovedDepositForMonth
} = require('../services/monthlyRewardsService')

const ProfitHistory = require('../models/ProfitHistory')

async function sendNotificationDoc(user, title, message) {
  console.log('sendNotificationDoc', user, title, message)
  await Notification.create([{user, title, message}])
}

const COMMISSION_RATES = [10, 5, 3, 2, 1] // levels 1..5
const DEPOSIT_BONUS_PCT = 1
const MIN_PROFIT_BALANCE = 35 // ✅ New: minimum balance required to receive any profit

const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// ✅ helper: only users with balance >= 35 can receive any "profit" (bonus/commission)
function canReceiveProfitBalance(userDoc) {
  const bal = Number(userDoc?.balance) || 0
  return bal >= MIN_PROFIT_BALANCE
}

// Admin can enable/disable the 1% first-deposit bonus. We try, in order:
// 1) ENV var FIRST_DEPOSIT_BONUS_ENABLED=true|false
// 2) Optional Settings model: settings.firstDepositBonusEnabled (boolean)
// 3) Default: true (enabled)
async function isOnePercentBonusEnabled() {
  if (typeof process.env.FIRST_DEPOSIT_BONUS_ENABLED !== 'undefined') {
    return (
      String(process.env.FIRST_DEPOSIT_BONUS_ENABLED).toLowerCase() === 'true'
    )
  }
  try {
    const Settings = require('../models/Settings') // if you have one
    const s = await Settings.findOne().lean()
    if (s && typeof s.firstDepositBonusEnabled === 'boolean')
      return s.firstDepositBonusEnabled
  } catch (_) {
    /* Settings model not present — ignore */
  }
  return true
}

async function coreApprove(depositId, {useSession} = {}) {
  const session = useSession ? await mongoose.startSession() : null

  const run = async sessionOrNull => {
    // 1) Approve deposit atomically only if still Pending
    const deposit = await Deposit.findOneAndUpdate(
      {_id: depositId, status: 'Pending'},
      {$set: {status: 'Approved'}},
      {new: true, session: sessionOrNull}
    )
    if (!deposit) {
      // Either already processed or not found
      const current = await Deposit.findById(depositId).session(sessionOrNull)
      if (!current)
        throw Object.assign(new Error('Deposit not found'), {code: 404})
      throw Object.assign(new Error('Already processed'), {code: 400})
    }

    // 2) Credit depositor (principal) — always
    const user = await User.findById(deposit.user).session(sessionOrNull)
    if (!user) throw new Error('User not found')

    user.balance = r2((user.balance || 0) + deposit.amount)
    await user.save({session: sessionOrNull})

    // 3) 1% BONUS: only if admin allows AND this is user's FIRST approved deposit
    const approvedCount = await Deposit.countDocuments({
      user: user._id,
      status: 'Approved'
    }).session(sessionOrNull)
    const isFirstApproved = approvedCount === 1
    const bonusAllowed = await isOnePercentBonusEnabled()

    let bonus = 0
    if (bonusAllowed && isFirstApproved && canReceiveProfitBalance(user)) {
      bonus = r2(deposit.amount * (DEPOSIT_BONUS_PCT / 100))
      if (bonus > 0) {
        user.balance = r2(user.balance + bonus)
        await user.save({session: sessionOrNull})

        await ProfitHistory.create(
          [
            {
              user: user._id,
              type: 'Deposit Bonus',
              amount: bonus,
              description: `1% first deposit bonus on $${r2(deposit.amount)}.`
            }
          ],
          {session: sessionOrNull}
        )
      }
    }
    // (Optional) else notify they didn't meet min balance:
    // else {
    //   await Notification.create([{
    //     user: user._id,
    //     title: 'Bonus Not Applied',
    //     message: `Bonus requires a minimum balance of $${MIN_PROFIT_BALANCE}.`
    //   }], {session: sessionOrNull})
    // }

    // 4) Multi-level commissions to upline (apply on EVERY approved deposit)
    const notifications = [
      {
        user: user._id,
        title: 'Deposit Approved ✅',
        message:
          bonus > 0
            ? `Your first deposit of $${r2(
                deposit.amount
              )} is approved. A ${DEPOSIT_BONUS_PCT}% bonus ($${bonus}) was credited.`
            : `Your deposit of $${r2(deposit.amount)} is approved.`
      }
    ]

    let ancestorId = user.referredBy || null
    for (
      let level = 0;
      level < COMMISSION_RATES.length && ancestorId;
      level++
    ) {
      const pct = COMMISSION_RATES[level]
      const commission = r2(deposit.amount * (pct / 100))
      const ancestor = await User.findById(ancestorId).session(sessionOrNull)
      if (!ancestor) break

      if (commission > 0 && canReceiveProfitBalance(ancestor)) {
        ancestor.balance = r2((ancestor.balance || 0) + commission)
        await ancestor.save({session: sessionOrNull})

        await ProfitHistory.create(
          [
            {
              user: ancestor._id,
              type: 'Referral Bonus',
              amount: commission,
              description: `Level ${
                level + 1
              } (${pct}%) from ${user._id.toString()} deposit $${r2(
                deposit.amount
              )}.`
            }
          ],
          {session: sessionOrNull}
        )

        notifications.push({
          user: ancestor._id,
          title: 'Referral Bonus Earned 💸',
          message: `You earned $${commission} (Level ${
            level + 1
          }) from your referral’s deposit.`
        })
      }
      // (Optional) else notify ancestor they didn't meet min balance:
      // else {
      //   notifications.push({
      //     user: ancestor._id,
      //     title: 'Commission Not Applied',
      //     message: `Commissions require a minimum balance of $${MIN_PROFIT_BALANCE}.`
      //   })
      // }

      ancestorId = ancestor.referredBy || null // move up
    }

    // 5) Notifications
    if (notifications.length) {
      await Notification.create(
        notifications.map(n => ({
          user: n.user,
          title: n.title,
          message: n.message
        })),
        {session: sessionOrNull}
      )
    }

    // 6) Monthly rewards
    try {
      await recordApprovedDepositForMonth(user._id, deposit.amount)
    } catch (e) {
      console.error('Monthly reward update failed', e)
    }

    return {deposit}
  }

  if (!useSession) {
    // No-transaction path
    return run(null)
  }

  // Try with transaction; if server doesn't support, bubble error for fallback
  try {
    let result
    await session.withTransaction(async () => {
      result = await run(session)
    })
    return result
  } finally {
    session.endSession()
  }
}

exports.approveDeposit = async (req, res) => {
  try {
    // First try WITH transaction
    try {
      const data = await coreApprove(req.params.id, {useSession: true})
      return res.json({message: 'Deposit approved', ...data})
    } catch (e) {
      const msg = String(e.message || '')
      const code = e.code || 500
      // Fallback: if transactions aren’t supported, run once WITHOUT session
      if (
        msg.includes('Transaction numbers are only allowed') ||
        msg.includes('Transaction required a replica set') ||
        msg.includes('not supported')
      ) {
        const data = await coreApprove(req.params.id, {useSession: false})
        return res.json({message: 'Deposit approved (no-tx fallback)', ...data})
      }
      if (code === 404)
        return res.status(404).json({message: 'Deposit not found'})
      if (code === 400)
        return res.status(400).json({message: 'Already processed'})
      throw e
    }
  } catch (err) {
    console.error('approveDeposit error:', err)
    return res.status(500).json({message: err.message || 'Internal error'})
  }
}

exports.declineDeposit = async (req, res) => {
  try {
    const {reason} = req.body
    const deposit = await Deposit.findById(req.params.id)
    if (!deposit) return res.status(404).json({message: 'Deposit not found'})
    if (deposit.status !== 'Pending')
      return res.status(400).json({message: 'Already processed'})
    deposit.status = 'Declined'
    deposit.adminReason = reason || ''
    await deposit.save()
    await sendNotificationDoc(
      deposit.user,
      'Deposit Declined ❌',
      `Your deposit of $${deposit.amount} was declined. Reason: ${
        reason || 'Not provided'
      }`
    )
    res.json({message: 'Deposit declined', deposit})
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}

exports.approveWithdrawal = async (req, res) => {
  try {
    const w = await Withdrawal.findById(req.params.id)
    if (!w) return res.status(404).json({message: 'Withdrawal not found'})
    if (w.status !== 'Pending')
      return res.status(400).json({message: 'Already processed'})
    const user = await User.findById(w.user)
    if (user.balance < w.amount)
      return res.status(400).json({message: 'Insufficient user balance'})
    user.balance = Number((user.balance - w.amount).toFixed(8))
    await user.save()
    w.status = 'Approved'
    await w.save()
    await sendNotificationDoc(
      user._id,
      'Withdrawal Approved 💸',
      `Your withdrawal of $${w.amount} has been approved.`
    )
    res.json({message: 'Withdrawal approved', withdrawal: w})
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}

exports.declineWithdrawal = async (req, res) => {
  try {
    const {reason} = req.body
    const w = await Withdrawal.findById(req.params.id)
    if (!w) return res.status(404).json({message: 'Withdrawal not found'})
    if (w.status !== 'Pending')
      return res.status(400).json({message: 'Already processed'})
    w.status = 'Declined'
    w.adminReason = reason || ''
    await w.save()
    await sendNotificationDoc(
      w.user,
      'Withdrawal Declined ⚠️',
      `Your withdrawal of $${w.amount} was declined. Reason: ${
        reason || 'Not provided'
      }`
    )
    res.json({message: 'Withdrawal declined', withdrawal: w})
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}
