const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');

exports.getUsers = async (req, res) => {
  try {
    const { search, startDate, endDate, page = 1, limit = 10 } = req.query;
    const skip = (page-1)*limit;
    const filter = {};
    if (search) filter.$or = [{ email: { $regex: search, $options: 'i' } }, { firstName: { $regex: search, $options: 'i' } }, { lastName: { $regex: search, $options: 'i' } }];
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    const total = await User.countDocuments(filter);
    const users = await User.find(filter).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit));
    res.json({ total, page: Number(page), pages: Math.ceil(total/limit), results: users });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getDeposits = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;
    const skip = (page-1)*limit;
    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    const total = await Deposit.countDocuments(filter);
    const deposits = await Deposit.find(filter).populate('user', 'firstName lastName email').sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit));
    res.json({ total, page: Number(page), pages: Math.ceil(total/limit), results: deposits });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getWithdrawals = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;
    const skip = (page-1)*limit;
    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    const total = await Withdrawal.countDocuments(filter);
    const withdrawals = await Withdrawal.find(filter).populate('user', 'firstName lastName email').sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit));
    res.json({ total, page: Number(page), pages: Math.ceil(total/limit), results: withdrawals });
  } catch (err) { res.status(500).json({ message: err.message }); }
};