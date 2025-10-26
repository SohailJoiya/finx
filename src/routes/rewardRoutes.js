const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getMyMonthlyProgress, claimMyMonthlyReward } = require('../controllers/rewardController');

router.get('/monthly', auth, getMyMonthlyProgress);
router.post('/monthly/claim', auth, claimMyMonthlyReward);

module.exports = router;