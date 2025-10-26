const Withdrawal = require('../models/Withdrawal')
const {calculateWithdrawalFee} = require('../utils/calcFees')

// Request new withdrawal
exports.requestWithdrawal = async (req, res) => {
  try {
    const {amount, destinationAddress} = req.body
    const user = req.user
    const amt = Number(amount)

    if (!amt || amt <= 0)
      return res.status(400).json({message: 'Invalid amount'})
    if (amt > user.balance)
      return res.status(400).json({message: 'Insufficient balance'})

    const {fee, receivable} = calculateWithdrawalFee(amt, user.balance)

    const w = await Withdrawal.create({
      user: user._id,
      amount: amt,
      fee,
      receivable,
      destinationAddress
    })

    res.status(201).json({withdrawal: w})
  } catch (err) {
    res.status(500).json({message: err.message})
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
    res.status(500).json({message: err.message})
  }
}
