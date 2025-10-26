const express = require('express');
const router = express.Router();
const { distributeReferralCommission } = require('../controllers/referralController');

router.post('/simulate', async (req, res) => {
  const { userId, amount } = req.body;
  if (!userId || !amount) return res.status(400).json({ message: 'Missing' });
  await distributeReferralCommission(userId, Number(amount));
  res.json({ message: 'Done' });
});

module.exports = router;