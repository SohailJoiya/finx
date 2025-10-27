// models/ProfitHistory.js
// removed mongoose require

const profitHistorySchema = new mongoose.Schema(
  {
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    type: {
      type: String,
      enum: ['Daily Profit', 'Referral Bonus', 'Rank Bonus', 'Deposit Bonus'], // added "Deposit Bonus"
      required: true
    },
    amount: {type: Number, required: true},
    description: String
  },
  {timestamps: true}
)

module.exports = mongoose.model('ProfitHistory', profitHistorySchema)
