const SystemSettings = require('../models/SystemSettings');

async function ensureDoc() {
  let doc = await SystemSettings.findOne({});
  if (!doc) doc = await SystemSettings.create({});
  return doc;
}

exports.getPublicWallets = async (_req, res) => {
  const doc = await ensureDoc();
  res.json(doc.wallets || { binance: '', trust: '' });
};
exports.getAbout = async (_req, res) => {
  const doc = await ensureDoc();
  res.json({ aboutHtml: doc.aboutHtml || '' });
};
exports.updateWallets = async (req, res) => {
  const { binance, trust } = req.body;
  const doc = await ensureDoc();
  doc.wallets = { binance: binance || '', trust: trust || '' };
  await doc.save();
  res.json({ wallets: doc.wallets });
};
exports.updateAbout = async (req, res) => {
  const { aboutHtml } = req.body;
  const doc = await ensureDoc();
  doc.aboutHtml = aboutHtml || '';
  await doc.save();
  res.json({ aboutHtml: doc.aboutHtml });
};