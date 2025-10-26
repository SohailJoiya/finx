const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/profitController');

router.get('/today', auth, ctrl.getTodayStatus);
router.post('/claim-daily', auth, ctrl.claimDaily);
router.get('/history', auth, ctrl.getHistory);

module.exports = router;