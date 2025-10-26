const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getUserDashboard } = require('../controllers/dashboardController');

router.get('/', auth, getUserDashboard);

module.exports = router;