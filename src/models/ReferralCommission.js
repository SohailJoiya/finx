const mongoose = require('mongoose');

const referralCommissionSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  level: Number,
  amount: Number
}, { timestamps: true });

module.exports = mongoose.model('ReferralCommission', referralCommissionSchema);