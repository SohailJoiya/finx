const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const { createDeposit, getUserDeposits } = require('../controllers/depositController');

router.post('/', auth, upload.single('screenshot'), createDeposit);
router.get('/', auth, getUserDeposits);

module.exports = router;