const User = require('../models/User');
const ReferralCommission = require('../models/ReferralCommission');
const levels = require('../utils/commissionLevels');
const getPagination = require('../utils/paginate');

exports.getLevels = async (_req, res) => res.json({ levels });

exports.getSummary = async (req, res) => {
  const userId = req.user._id;
  const totalAgg = await ReferralCommission.aggregate([
    { $match: { toUser: userId } },
    { $group: { _id: null, sum: { $sum: '$amount' } } }
  ]);
  const total = totalAgg.length ? totalAgg[0].sum : 0;
  const start = new Date(); start.setHours(0,0,0,0);
  const todayAgg = await ReferralCommission.aggregate([
    { $match: { toUser: userId, createdAt: { $gte: start } } },
    { $group: { _id: null, sum: { $sum: '$amount' } } }
  ]);
  const today = todayAgg.length ? todayAgg[0].sum : 0;
  const directs = await User.countDocuments({ referredBy: userId });
  res.json({ today, total, directs });
};

exports.getDirects = async (req, res) => {
  const { q } = req.query;
  const { page, limit, skip } = getPagination(req);
  const filter = { referredBy: req.user._id };
  if (q) {
    filter.$or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName:  { $regex: q, $options: 'i' } },
      { email:     { $regex: q, $options: 'i' } },
    ];
  }
  const total = await User.countDocuments(filter);
  const rows = await User.find(filter)
    .select('firstName lastName email isActive lastLoginAt createdAt')
    .sort({ createdAt: -1 }).skip(skip).limit(limit);
  res.json({ total, page, pages: Math.ceil(total/limit), results: rows });
};

exports.getCommissions = async (req, res) => {
  const { startDate, endDate } = req.query;
  const { page, limit, skip } = getPagination(req);
  const filter = { toUser: req.user._id };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate)   filter.createdAt.$lte = new Date(endDate);
  }
  const total = await ReferralCommission.countDocuments(filter);
  const rows = await ReferralCommission.find(filter)
    .populate('fromUser', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  res.json({ total, page, pages: Math.ceil(total/limit), results: rows });
};