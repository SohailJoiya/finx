const User = require('../models/User');

exports.getWallets = async (req, res) => {
  res.json(req.user.wallets || []);
};

exports.addWallet = async (req, res) => {
  try {
    const { name, address } = req.body;
    if (!name || !address) return res.status(400).json({ message: 'Name and address required' });
    const user = req.user;
    user.wallets.push({ name, address });
    await user.save();
    res.json({ wallets: user.wallets });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { name, address } = req.body;
    const user = req.user;
    const w = user.wallets.id(walletId);
    if (!w) return res.status(404).json({ message: 'Wallet not found' });
    if (name) w.name = name;
    if (address) w.address = address;
    await user.save();
    res.json({ wallet: w });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const user = req.user;
    user.wallets = user.wallets.filter(w => w._id.toString() !== walletId);
    await user.save();
    res.json({ wallets: user.wallets });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};