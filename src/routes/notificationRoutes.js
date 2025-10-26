const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')
const {
  listUserNotifications,
  markAsRead,
  createGlobalNotification,
  createNotificationForUser,
  listRecent
} = require('../controllers/notificationController')
const {protectAdmin} = require('../middleware/adminMiddleware')

router.get('/', auth, listUserNotifications)
router.get('/recent', auth, listRecent)
router.put('/:id/read', auth, markAsRead)

router.post('/admin/global', protectAdmin, createGlobalNotification)
router.post('/admin/user', protectAdmin, createNotificationForUser)

module.exports = router
