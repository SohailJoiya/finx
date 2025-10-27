// removed mongoose require
const withdrawalSchema = new mongoose.Schema(
  {
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    amount: {type: Number, required: true},
    fee: {type: Number, required: true},
    finalAmount: {type: Number},
    walletName: {type: String, required: true}, // ✅ Added
    network: {type: String, required: true}, // ✅ Added
    destinationAddress: {type: String, required: true},
    receivable: {type: Number, required: true},

    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Declined'],
      default: 'Pending'
    },
    transactionId: String
  },
  {timestamps: true}
)

module.exports = mongoose.model('Withdrawal', withdrawalSchema)
