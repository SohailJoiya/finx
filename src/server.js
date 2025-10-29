require('dotenv').config()
const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const path = require('path')
const connectDB = require('./config/db')

connectDB()

const app = express()
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

// ✅ serve project-root/uploads (works in dev and after build)
app.use(
  '/api/uploads',
  express.static(path.resolve(__dirname, '..', 'uploads'))
)

// Routes
app.use('/api/auth', require('./routes/authRoutes'))
app.use('/api/users', require('./routes/userRoutes')) // register, profile, referral-tree
app.use('/api/referral', require('./routes/referralRoutes')) // simulate commission
app.use('/api/referral', require('./routes/referralUserRoutes')) // user referral pages
app.use('/api/deposits', require('./routes/depositRoutes'))
app.use('/api/withdrawals', require('./routes/withdrawalRoutes'))
app.use('/api/wallets', require('./routes/walletRoutes'))
app.use('/api/notifications', require('./routes/notificationRoutes'))
app.use('/api/admin', require('./routes/adminRoutes')) // lists
app.use('/api/admin/transactions', require('./routes/adminTransactionRoutes'))
app.use('/api/admin/analytics', require('./routes/adminAnalyticsRoutes'))
app.use('/api/profit', require('./routes/profitRoutes'))
app.use('/api/system', require('./routes/settingsRoutes'))
app.use('/api/users', require('./routes/profileRoutes')) // profile update, password, summary
app.use(
  '/api/admin/notifications',
  require('./routes/adminNotificationsRoutes')
)
app.use('/api/rewards', require('./routes/rewardRoutes'))
app.use('/api/dashboard', require('./routes/dashboardRoutes'))
// app.js or index.js
app.use('/api', require('./routes/teamRoutes'))

// Cron
require('./cron/monthlyRewards')

app.get('/api/test', (req, res) => res.json({status: 'FinX API running'}))

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))
