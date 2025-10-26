const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')
const {
  requestWithdrawal,
  getUserWithdrawals
} = require('../controllers/withdrawalController')

router.post('/', auth, requestWithdrawal)
router.get('/', auth, getUserWithdrawals) // 👈 history endpoint

module.exports = router
