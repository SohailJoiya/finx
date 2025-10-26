const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const { generateToken } = require('../config/jwt');

const generateReferralCode = () => uuidv4().split('-')[0];
const buildReferralLink = (code) => `${process.env.BASE_URL || 'http://localhost:5000'}/register?ref=${code}`;

exports.registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, referralCode } = req.body;
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ message: 'Missing fields' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode });
      if (!referrer) return res.status(400).json({ message: 'Invalid referral code' });
    }

    const newUser = new User({
      firstName, lastName, email, password,
      referredBy: referrer ? referrer._id : null,
      referralCode: generateReferralCode(),
      role: 'user'
    });
    await newUser.save();

    const token = generateToken({ id: newUser._id, role: newUser.role });

    res.status(201).json({
      token,
      user: {
        id: newUser._id, firstName: newUser.firstName, lastName: newUser.lastName,
        email: newUser.email, referralCode: newUser.referralCode, referralLink: buildReferralLink(newUser.referralCode), role: newUser.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProfile = async (req, res) => {
  const user = req.user;
  res.json({
    id: user._id, firstName: user.firstName, lastName: user.lastName,
    email: user.email, balance: user.balance, wallets: user.wallets, role: user.role
  });
};