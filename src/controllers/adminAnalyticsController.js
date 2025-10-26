const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');

function parseRange({ rangeType = 'monthly', startDate, endDate }) {
  const now = new Date();
  let from, to;
  if (rangeType === 'custom') {
    if (!startDate || !endDate) throw new Error('startDate and endDate are required for custom range');
    from = new Date(startDate);
    to = new Date(endDate);
    to.setHours(23, 59, 59, 999);
  } else if (rangeType === 'daily') {
    to = new Date(); to.setHours(23, 59, 59, 999);
    from = new Date(); from.setDate(to.getDate() - 6); from.setHours(0, 0, 0, 0);
  } else if (rangeType === 'weekly') {
    to = new Date(); to.setHours(23, 59, 59, 999);
    from = new Date(); from.setDate(to.getDate() - 7 * 11); from.setHours(0, 0, 0, 0);
  } else {
    to = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999);
    from = new Date(now.getUTCFullYear(), now.getUTCMonth() - 11, 1, 0, 0, 0, 0);
  }
  return { from, to };
}

function timeGroup(rangeType) {
  if (rangeType === 'daily')   return { fmt: '%Y-%m-%d' };
  if (rangeType === 'weekly')  return { fmt: '%G-W%V' };
  return { fmt: '%Y-%m' };
}

exports.userStatusOverview = async (req, res) => {
  try {
    const { rangeType = 'monthly', startDate, endDate, activeDays } = req.query;
    const { from, to } = parseRange({ rangeType, startDate, endDate });

    let active = 0, inactive = 0, total = 0;
    if (activeDays) {
      const days = parseInt(activeDays, 10);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
      total   = await User.countDocuments({});
      active  = await User.countDocuments({ lastLoginAt: { $gte: cutoff } });
      inactive = total - active;
    } else {
      const agg = await User.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $project: { isActive: { $ifNull: ['$isActive', true] } } },
        { $group: { _id: '$isActive', count: { $sum: 1 } } }
      ]);
      agg.forEach(a => { if (a._id) active = a.count; else inactive = a.count; });
      total = active + inactive;
    }

    res.json({ totalUsers: total, active, inactive });
  } catch (err) {
    console.error('userStatusOverview error', err);
    res.status(500).json({ message: err.message });
  }
};

exports.newUserRegistrations = async (req, res) => {
  try {
    const { rangeType = 'monthly', startDate, endDate } = req.query;
    const { from, to } = parseRange({ rangeType, startDate, endDate });
    const { fmt } = timeGroup(rangeType);
    const rows = await User.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: fmt, date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ series: rows.map(r => ({ x: r._id, y: r.count })) });
  } catch (err) {
    console.error('newUserRegistrations error', err);
    res.status(500).json({ message: err.message });
  }
};

exports.approvedDepositsSeries = async (req, res) => {
  try {
    const { rangeType = 'monthly', startDate, endDate } = req.query;
    const { from, to } = parseRange({ rangeType, startDate, endDate });
    const { fmt } = timeGroup(rangeType);
    const rows = await Deposit.aggregate([
      { $match: { status: 'Approved', createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: fmt, date: '$createdAt' } }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({
      countSeries: rows.map(r => ({ x: r._id, y: r.count })),
      amountSeries: rows.map(r => ({ x: r._id, y: r.amount })),
      totals: {
        count: rows.reduce((a, c) => a + c.count, 0),
        amount: rows.reduce((a, c) => a + c.amount, 0)
      }
    });
  } catch (err) {
    console.error('approvedDepositsSeries error', err);
    res.status(500).json({ message: err.message });
  }
};

exports.approvedWithdrawalsSeries = async (req, res) => {
  try {
    const { rangeType = 'monthly', startDate, endDate } = req.query;
    const { from, to } = parseRange({ rangeType, startDate, endDate });
    const { fmt } = timeGroup(rangeType);
    const rows = await Withdrawal.aggregate([
      { $match: { status: 'Approved', createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: fmt, date: '$createdAt' } }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({
      countSeries: rows.map(r => ({ x: r._id, y: r.count })),
      amountSeries: rows.map(r => ({ x: r._id, y: r.amount })),
      totals: {
        count: rows.reduce((a, c) => a + c.count, 0),
        amount: rows.reduce((a, c) => a + c.amount, 0)
      }
    });
  } catch (err) {
    console.error('approvedWithdrawalsSeries error', err);
    res.status(500).json({ message: err.message });
  }
};

async function aggregateAmountSeries(Model, match, fmt) {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: fmt, date: '$createdAt' } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  return rows;
}
function toRunning(series, key = 'amount') {
  let acc = 0;
  return series.map(p => { acc += p[key]; return { x: p._id || p.x, y: acc }; });
}
function toXY(series, key = 'amount') {
  return series.map(p => ({ x: p._id, y: p[key] }));
}

exports.cumulativeDeposits = async (req, res) => {
  try {
    const { rangeType = 'monthly', startDate, endDate } = req.query;
    const { from, to } = parseRange({ rangeType, startDate, endDate });
    const { fmt } = timeGroup(rangeType);
    const rows = await aggregateAmountSeries(Deposit, { status: 'Approved', createdAt: { $gte: from, $lte: to } }, fmt);
    res.json({
      amountSeries: toXY(rows, 'amount'),
      amountCumulative: toRunning(rows, 'amount'),
      countSeries: toXY(rows, 'count'),
      countCumulative: toRunning(rows, 'count'),
      totals: {
        amount: rows.reduce((a, c) => a + c.amount, 0),
        count: rows.reduce((a, c) => a + c.count, 0)
      }
    });
  } catch (err) {
    console.error('cumulativeDeposits error', err);
    res.status(500).json({ message: err.message });
  }
};

exports.cumulativeWithdrawals = async (req, res) => {
  try {
    const { rangeType = 'monthly', startDate, endDate } = req.query;
    const { from, to } = parseRange({ rangeType, startDate, endDate });
    const { fmt } = timeGroup(rangeType);
    const rows = await aggregateAmountSeries(Withdrawal, { status: 'Approved', createdAt: { $gte: from, $lte: to } }, fmt);
    res.json({
      amountSeries: toXY(rows, 'amount'),
      amountCumulative: toRunning(rows, 'amount'),
      countSeries: toXY(rows, 'count'),
      countCumulative: toRunning(rows, 'count'),
      totals: {
        amount: rows.reduce((a, c) => a + c.amount, 0),
        count: rows.reduce((a, c) => a + c.count, 0)
      }
    });
  } catch (err) {
    console.error('cumulativeWithdrawals error', err);
    res.status(500).json({ message: err.message });
  }
};

exports.netFlowSeries = async (req, res) => {
  try {
    const { rangeType = 'monthly', startDate, endDate } = req.query;
    const { from, to } = parseRange({ rangeType, startDate, endDate });
    const { fmt } = timeGroup(rangeType);
    const depRows = await aggregateAmountSeries(Deposit, { status: 'Approved', createdAt: { $gte: from, $lte: to } }, fmt);
    const wdrRows = await aggregateAmountSeries(Withdrawal, { status: 'Approved', createdAt: { $gte: from, $lte: to } }, fmt);
    const periods = new Set([...depRows.map(r => r._id), ...wdrRows.map(r => r._id)]);
    const sorted = Array.from(periods).sort();
    const depMap = new Map(depRows.map(r => [r._id, r.amount]));
    const wdrMap = new Map(wdrRows.map(r => [r._id, r.amount]));

    const deposits = [], withdrawals = [], net = [], cumulativeNet = [];
    let acc = 0;
    for (const label of sorted) {
      const d = depMap.get(label) || 0;
      const w = wdrMap.get(label) || 0;
      const n = d - w; acc += n;
      deposits.push({ x: label, y: d });
      withdrawals.push({ x: label, y: w });
      net.push({ x: label, y: n });
      cumulativeNet.push({ x: label, y: acc });
    }
    res.json({
      deposits, withdrawals, net, cumulativeNet,
      totals: {
        deposits: depRows.reduce((a, c) => a + c.amount, 0),
        withdrawals: wdrRows.reduce((a, c) => a + c.amount, 0),
        net: depRows.reduce((a, c) => a + c.amount, 0) - wdrRows.reduce((a, c) => a + c.amount, 0)
      }
    });
  } catch (err) {
    console.error('netFlowSeries error', err);
    res.status(500).json({ message: err.message });
  }
};