const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const walletSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
});

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, default: '' },
    lastName:  { type: String, default: '' },
    email:     { type: String, required: true, unique: true },
    password:  { type: String, required: true },

    referralCode: { type: String, unique: true, sparse: true },
    referredBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    balance:       { type: Number, default: 0 },
    totalProfit:   { type: Number, default: 0 },
    lastDailyClaimAt: { type: Date, default: null },

    wallets: [walletSchema],

    rank: { type: String, default: 'Starter' },
    rankAchievedAt: { type: Date, default: null },

    phone: { type: String, default: '' },
    isActive: { type: Boolean, default: true },

    lastLoginAt: { type: Date, default: null },

    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('User', userSchema);