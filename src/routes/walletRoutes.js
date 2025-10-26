const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getWallets, addWallet, updateWallet, deleteWallet } = require('../controllers/walletController');

router.get('/', auth, getWallets);
router.post('/', auth, addWallet);
router.put('/:walletId', auth, updateWallet);
router.delete('/:walletId', auth, deleteWallet);

module.exports = router;