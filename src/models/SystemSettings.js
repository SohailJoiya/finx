// removed mongoose require

const systemSettingsSchema = new mongoose.Schema({
  wallets: {
    binance: { type: String, default: '' },
    trust:   { type: String, default: '' }
  },
  aboutHtml: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);