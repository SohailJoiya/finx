const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminMiddleware');
const ctrl = require('../controllers/adminAnalyticsController');

router.get('/user-status', protectAdmin, ctrl.userStatusOverview);
router.get('/registrations', protectAdmin, ctrl.newUserRegistrations);
router.get('/deposits', protectAdmin, ctrl.approvedDepositsSeries);
router.get('/withdrawals', protectAdmin, ctrl.approvedWithdrawalsSeries);
router.get('/deposits/cumulative', protectAdmin, ctrl.cumulativeDeposits);
router.get('/withdrawals/cumulative', protectAdmin, ctrl.cumulativeWithdrawals);
router.get('/net-flow', protectAdmin, ctrl.netFlowSeries);

module.exports = router;