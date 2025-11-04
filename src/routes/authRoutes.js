// src/routes/authRoutes.js
const express = require('express')
const router = express.Router()
const {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  verifyResetOTP,
  setNewPassword
} = require('../controllers/authController')

router.post('/register', register)
router.post('/login', login)

router.get('/verify-email', verifyEmail)
router.post('/resend-verification', resendVerification)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.post('/verify-reset-otp', verifyResetOTP) // step 1: verify OTP -> returns resetToken
router.post('/set-new-password', setNewPassword)

module.exports = router
