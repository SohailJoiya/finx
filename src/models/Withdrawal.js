const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  fee: { type: Number, required: true },
  receivable: { type: Number, required: true },
  destinationAddress: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Declined'], default: 'Pending' },
  adminReason: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);