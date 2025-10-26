const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/referralUserController');

router.get('/levels', ctrl.getLevels);
router.get('/summary', auth, ctrl.getSummary);
router.get('/directs', auth, ctrl.getDirects);
router.get('/commissions', auth, ctrl.getCommissions);

module.exports = router;