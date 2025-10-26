const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminMiddleware');
const adminTrans = require('../controllers/adminTransactionController');

router.put('/deposits/:id/approve', protectAdmin, adminTrans.approveDeposit);
router.put('/deposits/:id/decline', protectAdmin, adminTrans.declineDeposit);

router.put('/withdrawals/:id/approve', protectAdmin, adminTrans.approveWithdrawal);
router.put('/withdrawals/:id/decline', protectAdmin, adminTrans.declineWithdrawal);

module.exports = router;