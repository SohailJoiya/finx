const Deposit = require('../models/Deposit')

exports.createDeposit = async (req, res) => {
  try {
    const {amount, transactionId} = req.body
    if (!req.file) return res.status(400).json({message: 'Screenshot required'})
    const screenshotPath = `/api/uploads/deposits/${req.file.filename}`
    const deposit = await Deposit.create({
      user: req.user._id,
      amount: Number(amount),
      transactionId: transactionId || '',
      screenshot: screenshotPath
    })
    res.status(201).json({deposit, message: 'Deposit submitted'})
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}

exports.getUserDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({user: req.user._id}).sort({
      createdAt: -1
    })
    res.json(deposits)
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}
