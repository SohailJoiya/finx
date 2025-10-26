const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protectAdmin } = require('../middleware/adminMiddleware');

router.get('/users', protectAdmin, adminController.getUsers);
router.get('/deposits', protectAdmin, adminController.getDeposits);
router.get('/withdrawals', protectAdmin, adminController.getWithdrawals);

module.exports = router;