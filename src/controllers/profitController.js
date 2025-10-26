const User = require('../models/User');
const ProfitHistory = require('../models/ProfitHistory');
const getPagination = require('../utils/paginate');

const DAILY_PROFIT_AMOUNT = 2.0;
const CLAIM_COOLDOWN_HOURS = 24;

exports.getTodayStatus = async (req, res) => {
  const user = req.user;
  const last = user.lastDailyClaimAt ? new Date(user.lastDailyClaimAt) : null;
  let eligible = true, nextClaimAt = null;
  if (last) {
    const next = new Date(last.getTime() + CLAIM_COOLDOWN_HOURS * 3600 * 1000);
    if (new Date() < next) { eligible = false; nextClaimAt = next.toISOString(); }
  }
  res.json({ eligible, amount: DAILY_PROFIT_AMOUNT, nextClaimAt });
};

exports.claimDaily = async (req, res) => {
  const user = await User.findById(req.user._id);
  const last = user.lastDailyClaimAt ? new Date(user.lastDailyClaimAt) : null;
  if (last) {
    const next = new Date(last.getTime() + CLAIM_COOLDOWN_HOURS * 3600 * 1000);
    if (new Date() < next) {
      return res.status(400).json({ message: 'Already claimed today', nextClaimAt: next.toISOString() });
    }
  }
  user.balance += DAILY_PROFIT_AMOUNT;
  user.totalProfit += DAILY_PROFIT_AMOUNT;
  user.lastDailyClaimAt = new Date();
  await user.save();
  await ProfitHistory.create({ user: user._id, type: 'Daily Profit', amount: DAILY_PROFIT_AMOUNT, description: 'Daily profit claim' });
  res.json({ credited: DAILY_PROFIT_AMOUNT, nextClaimAt: new Date(user.lastDailyClaimAt.getTime() + CLAIM_COOLDOWN_HOURS*3600*1000).toISOString(), balance: user.balance });
};

exports.getHistory = async (req, res) => {
  const { type, startDate, endDate } = req.query;
  const { page, limit, skip } = getPagination(req);
  const filter = { user: req.user._id };
  if (type) filter.type = type;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate)   filter.createdAt.$lte = new Date(endDate);
  }
  const total = await ProfitHistory.countDocuments(filter);
  const rows = await ProfitHistory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  res.json({ total, page, pages: Math.ceil(total/limit), results: rows });
};