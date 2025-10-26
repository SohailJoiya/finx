// src/routes/profitRoutes.js
const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')
const {
  getTodayStatus,
  claimDailyProfit,
  getHistory
} = require('../controllers/profitController')

router.get('/today', auth, getTodayStatus)
router.post('/claim-daily', auth, claimDailyProfit)
router.get('/history', auth, getHistory)

module.exports = router
