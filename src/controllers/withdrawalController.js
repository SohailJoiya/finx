const Deposit = require('../models/Deposit')
const Withdrawal = require('../models/Withdrawal')
const {calculateWithdrawalFee} = require('../utils/calcFees')
const Notification = require('../models/Notification')
const User = require('../models/User')

const MIN_BALANCE_FOR_WITHDRAW = 35
const WITHDRAW_COOLDOWN_HOURS = 24
const MIN_DAYS_AFTER_FIRST_DEPOSIT = 1

const hoursBetween = (a, b) => Math.abs(a - b) / 36e5

exports.requestWithdrawal = async (req, res) => {
  try {
    const {amount, destinationAddress, walletName, network} = req.body
    const user = req.user
    const amt = Number(amount)
    const now = new Date()

    // 1️⃣ Basic validations
    if (!amt || amt <= 0)
      return res.status(400).json({message: 'Invalid amount'})
    if (!walletName || !network || !destinationAddress)
      return res.status(400).json({
        message: 'Wallet name, network, and destination address are required'
      })
    if (user.balance < MIN_BALANCE_FOR_WITHDRAW)
      return res.status(400).json({
        message: `Minimum account balance for withdrawal is ${MIN_BALANCE_FOR_WITHDRAW}.`
      })
    if (amt > user.balance)
      return res.status(400).json({message: 'Insufficient balance'})

    // 2️⃣ 10 days after first approved deposit
    const firstApprovedDeposit = await Deposit.findOne({
      user: user._id,
      status: 'Approved'
    })
      .sort({createdAt: 1})
      .select({createdAt: 1})
      .lean()

    if (!firstApprovedDeposit) {
      return res.status(400).json({
        message: 'You can withdraw only after your first approved deposit.'
      })
    }

    const tenDaysMs = MIN_DAYS_AFTER_FIRST_DEPOSIT * 24 * 60 * 60 * 1000
    if (now - new Date(firstApprovedDeposit.createdAt) < tenDaysMs) {
      const unlockAt = new Date(
        new Date(firstApprovedDeposit.createdAt).getTime() + tenDaysMs
      )
      return res.status(400).json({
        message: `Withdrawals open ${MIN_DAYS_AFTER_FIRST_DEPOSIT} days after your first approved deposit.`,
        unlockAt
      })
    }

    // 3️⃣ Check pending withdrawals
    const pending = await Withdrawal.findOne({
      user: user._id,
      status: 'Pending'
    }).lean()

    if (pending) {
      return res
        .status(400)
        .json({message: 'You already have a pending withdrawal request.'})
    }

    // 4️⃣ 24-hour cooldown after last APPROVED withdrawal (ignore declined)
    const lastApproved = await Withdrawal.findOne({
      user: user._id,
      status: 'Approved'
    })
      .sort({updatedAt: -1})
      .select({updatedAt: 1})
      .lean()

    if (lastApproved) {
      const hrs = hoursBetween(now, new Date(lastApproved.updatedAt))
      if (hrs < WITHDRAW_COOLDOWN_HOURS) {
        const waitHrs = Math.ceil(WITHDRAW_COOLDOWN_HOURS - hrs)
        return res.status(400).json({
          message: `You can request your next withdrawal in ${waitHrs} hour(s).`
        })
      }
    }

    // 5️⃣ All good → create withdrawal
    const {fee, receivable} = calculateWithdrawalFee(amt, user.balance)

    const withdrawal = await Withdrawal.create({
      user: user._id,
      amount: amt,
      fee,
      receivable,
      destinationAddress,
      walletName,
      network
    })

    // Find admins
    const admin = await User.findOne({role: 'admin'}).select('_id name email')

    // Build notification payload
    const who =
      `${req.user.firstName} ${req.user.lastName}` || req.user.email || 'A user'
    const note = {
      title: 'New Withdrawal Submitted',
      message: `${who} submitted a withdrawal of ${Number(amount).toFixed(
        2
      )}. Txn: ${withdrawal._id || 'N/A'}.`
    }

    // Create a notification per admin (if none found, you could optionally create a global one with user: null)
    if (admin._id) {
      await Notification.create({...note, user: admin._id})
    }

    return res.status(201).json({withdrawal})
  } catch (err) {
    console.error('requestWithdrawal error:', err)
    return res.status(500).json({message: err.message})
  }
}

// User withdrawal history
exports.getUserWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({user: req.user._id}).sort({
      createdAt: -1
    })
    res.json(withdrawals)
  } catch (err) {
    console.error('getUserWithdrawals error:', err)
    res.status(500).json({message: err.message})
  }
}
