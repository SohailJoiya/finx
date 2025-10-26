const bcrypt = require('bcryptjs');
const User = require('../models/User');

exports.updateProfile = async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  const u = await User.findById(req.user._id);
  if (firstName) u.firstName = firstName;
  if (lastName)  u.lastName = lastName;
  if (phone !== undefined) u.phone = phone;
  await u.save();
  res.json({ message: 'Profile updated', user: { firstName: u.firstName, lastName: u.lastName, phone: u.phone } });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing fields' });
  const u = await User.findById(req.user._id);
  const ok = await u.comparePassword(currentPassword);
  if (!ok) return res.status(400).json({ message: 'Current password incorrect' });
  u.password = await bcrypt.hash(newPassword, 10);
  await u.save();
  res.json({ message: 'Password changed' });
};

exports.getReferralLink = async (req, res) => {
  const base = process.env.BASE_URL || 'http://localhost:5000';
  res.json({ referralLink: `${base}/register?ref=${req.user.referralCode}` });
};

exports.getUserSummary = async (req, res) => {
  const user = await User.findById(req.user._id);
  const start = new Date(); start.setHours(0,0,0,0);
  const ProfitHistory = require('../models/ProfitHistory');
  const todayAgg = await ProfitHistory.aggregate([
    { $match: { user: user._id, type: 'Daily Profit', createdAt: { $gte: start } } },
    { $group: { _id: null, sum: { $sum: '$amount' } } }
  ]);
  const todaysProfit = todayAgg.length ? todayAgg[0].sum : 0;
  const Withdrawal = require('../models/Withdrawal');
  const withAgg = await Withdrawal.aggregate([
    { $match: { user: user._id, status: 'Approved' } },
    { $group: { _id: null, sum: { $sum: '$amount' } } }
  ]);
  const totalWithdrawal = withAgg.length ? withAgg[0].sum : 0;
  const UserModel = require('../models/User');
  const teamSize = await UserModel.countDocuments({ referredBy: user._id });
  res.json({ balance: user.balance, todaysProfit, totalProfit: user.totalProfit || 0, teamSize, totalWithdrawal });
};