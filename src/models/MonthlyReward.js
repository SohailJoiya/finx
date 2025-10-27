// removed mongoose require

const monthlyRewardSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true },
  totalInvestment: { type: Number, default: 0 },
  teamInvestment: { type: Number, default: 0 },
  achievedTier: { type: String, default: null },
  rewardAmount: { type: Number, default: 0 },
  isClaimed: { type: Boolean, default: false }
}, { timestamps: true });

monthlyRewardSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyReward', monthlyRewardSchema);