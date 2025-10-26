const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { registerUser, getProfile } = require('../controllers/userController');
const referralController = require('../controllers/referralController');

router.post('/register', registerUser);
router.get('/me', auth, getProfile);
router.get('/referral-tree', auth, async (req, res) => {
  const tree = await referralController.getReferralTreeFor(req.user._id);
  res.json({ referralTree: tree });
});

module.exports = router;