const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/profileController');

router.put('/me', auth, ctrl.updateProfile);
router.put('/me/password', auth, ctrl.changePassword);
router.get('/me/referral-link', auth, ctrl.getReferralLink);
router.get('/me/summary', auth, ctrl.getUserSummary);

module.exports = router;