const Deposit = require('../models/Deposit')
const Notification = require('../models/Notification')
const User = require('../models/User') // assumes you have a role field like 'admin'

exports.createDeposit = async (req, res) => {
  try {
    const {amount, transactionId} = req.body

    if (!req.file) {
      return res.status(400).json({message: 'Screenshot required'})
    }

    const screenshotPath = `/api/uploads/deposits/${req.file.filename}`

    // Create deposit
    const deposit = await Deposit.create({
      user: req.user._id,
      amount: Number(amount),
      transactionId: transactionId || '',
      screenshot: screenshotPath
    })

    // Find admins
    const admin = await User.findOne({role: 'admin', isActive: true}).select(
      '_id name email'
    )

    // Build notification payload
    const who =
      `${req.user.firstName} ${req.user.lastName}` || req.user.email || 'A user'
    const note = {
      title: 'New Deposit Submitted',
      message: `${who} submitted a deposit of ${Number(amount).toFixed(
        2
      )}. Txn: ${transactionId || 'N/A'}.`
    }

    // Create a notification per admin (if none found, you could optionally create a global one with user: null)
    if (admin._id) {
      await Notification.create({...note, user: admin._id})
    }
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
