// removed mongoose require

const depositSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  transactionId: { type: String },
  screenshot: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Declined'], default: 'Pending' },
  adminReason: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Deposit', depositSchema);