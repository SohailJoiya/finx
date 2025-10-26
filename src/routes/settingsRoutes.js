const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminMiddleware');
const ctrl = require('../controllers/settingsController');

router.get('/public/wallets', ctrl.getPublicWallets);
router.get('/public/about', ctrl.getAbout);
router.put('/admin/wallets', protectAdmin, ctrl.updateWallets);
router.put('/admin/about', protectAdmin, ctrl.updateAbout);

module.exports = router;