const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { recordApprovedDepositForMonth } = require('../services/monthlyRewardsService');

async function sendNotification(userId, title, message) {
  await Notification.create({ user: userId, title, message });
}

exports.approveDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ message: 'Deposit not found' });
    if (deposit.status !== 'Pending') return res.status(400).json({ message: 'Already processed' });
    deposit.status = 'Approved';
    await deposit.save();
    const user = await User.findById(deposit.user);
    user.balance += deposit.amount;
    await user.save();
    await sendNotification(user._id, 'Deposit Approved ✅', `Your deposit of $${deposit.amount} has been approved.`);
    try { await recordApprovedDepositForMonth(user._id, deposit.amount); } catch(e){ console.error('Monthly reward update failed', e); }
    res.json({ message: 'Deposit approved', deposit });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.declineDeposit = async (req, res) => {
  try {
    const { reason } = req.body;
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ message: 'Deposit not found' });
    if (deposit.status !== 'Pending') return res.status(400).json({ message: 'Already processed' });
    deposit.status = 'Declined';
    deposit.adminReason = reason || '';
    await deposit.save();
    await sendNotification(deposit.user, 'Deposit Declined ❌', `Your deposit of $${deposit.amount} was declined. Reason: ${reason || 'Not provided'}`);
    res.json({ message: 'Deposit declined', deposit });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.approveWithdrawal = async (req, res) => {
  try {
    const w = await Withdrawal.findById(req.params.id);
    if (!w) return res.status(404).json({ message: 'Withdrawal not found' });
    if (w.status !== 'Pending') return res.status(400).json({ message: 'Already processed' });
    const user = await User.findById(w.user);
    if (user.balance < w.amount) return res.status(400).json({ message: 'Insufficient user balance' });
    user.balance = Number((user.balance - w.amount).toFixed(8));
    await user.save();
    w.status = 'Approved';
    await w.save();
    await sendNotification(user._id, 'Withdrawal Approved 💸', `Your withdrawal of $${w.amount} has been approved.`);
    res.json({ message: 'Withdrawal approved', withdrawal: w });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.declineWithdrawal = async (req, res) => {
  try {
    const { reason } = req.body;
    const w = await Withdrawal.findById(req.params.id);
    if (!w) return res.status(404).json({ message: 'Withdrawal not found' });
    if (w.status !== 'Pending') return res.status(400).json({ message: 'Already processed' });
    w.status = 'Declined';
    w.adminReason = reason || '';
    await w.save();
    await sendNotification(w.user, 'Withdrawal Declined ⚠️', `Your withdrawal of $${w.amount} was declined. Reason: ${reason || 'Not provided'}`);
    res.json({ message: 'Withdrawal declined', withdrawal: w });
  } catch (err) { res.status(500).json({ message: err.message }); }
};