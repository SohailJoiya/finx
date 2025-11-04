// src/cron/userLevelUpdate.js
const cron = require('node-cron')
const User = require('../models/User')
const Notification = require('../models/Notification')

// ---------- Helpers ----------
async function countMembers(userId) {
  // Direct active members
  const directs = await User.find({referredBy: userId, isActive: true})
    .select('_id')
    .lean()
  const directCount = directs.length

  // Indirect active members (children of directs)
  let indirectCount = 0
  if (directCount) {
    const directIds = directs.map(d => d._id)
    indirectCount = await User.countDocuments({
      referredBy: {$in: directIds},
      isActive: true
    })
  }

  return {directCount, indirectCount}
}

function decideLevel(
  totalInvestment,
  directCount,
  indirectCount,
  currentLevel
) {
  let target = 0
  console.log(totalInvestment > 1499)

  if (totalInvestment < 35) target = 0
  else if (totalInvestment < 500) target = 1
  else if (totalInvestment >= 1499 && directCount >= 3 && indirectCount >= 5) {
    console.log('::::::::::::', directCount, indirectCount)
    target = 2
  } else if (totalInvestment >= 2999 && directCount >= 5 && indirectCount >= 15)
    target = 3
  else if (totalInvestment >= 4999 && directCount >= 10 && indirectCount >= 25)
    target = 4
  else if (totalInvestment >= 5000 && directCount >= 20 && indirectCount >= 70)
    target = 5
  else if (totalInvestment >= 35) target = 1 // fallback

  // Only allow level increase
  return Math.max(currentLevel || 0, target)
}

function oneDaysFromNow() {
  return new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
}

// ---------- Calculate totalInvestment ----------
async function getTotalInvestment(user) {
  let total = user.balance || 0

  // Direct members
  const directs = await User.find({referredBy: user._id, isActive: true})
    .select('_id balance')
    .lean()

  for (const d of directs) {
    total += d.balance || 0

    // Indirect members (children of directs)
    const indirects = await User.find({referredBy: d._id, isActive: true})
      .select('balance')
      .lean()

    for (const i of indirects) {
      total += i.balance || 0
    }
  }

  return total
}

// ---------- Main job ----------
async function processUpTo10Users() {
  const now = new Date()

  // Fetch 10 eligible users (no cooldown)
  const users = await User.find({
    isActive: true,
    $or: [
      {levelUpdateHoldUntil: {$exists: false}},
      {levelUpdateHoldUntil: {$lte: now}}
    ]
  })
    .select('_id user_level firstName balance isActive referredBy')
    .limit(10)
    .lean()

  if (!users.length) return

  const bulkOps = []
  const notifications = []

  for (const u of users) {
    const [totalInvestment, {directCount, indirectCount}] = await Promise.all([
      getTotalInvestment(u),
      countMembers(u._id)
    ])

    const newLevel = decideLevel(
      totalInvestment,
      directCount,
      indirectCount,
      u.user_level
    )

    if (newLevel > (u.user_level || 0)) {
      bulkOps.push({
        updateOne: {
          filter: {_id: u._id},
          update: {
            $set: {
              user_level: newLevel,
              levelUpdateHoldUntil: oneDaysFromNow()
            }
          }
        }
      })

      notifications.push({
        user: u._id,
        title: '🎉 Level Up!',
        message: `Congratulations! Your level increased to ${newLevel}.`,
        type: 'LEVEL_UP',
        isRead: false
      })
    } else {
      // Update cooldown only
      bulkOps.push({
        updateOne: {
          filter: {_id: u._id},
          update: {
            $set: {levelUpdateHoldUntil: oneDaysFromNow()}
          }
        }
      })
    }
  }

  if (bulkOps.length) await User.bulkWrite(bulkOps)
  if (notifications.length) await Notification.insertMany(notifications)
}

async function runJob() {
  console.log('[CRON] userLevelUpdate tick')
  try {
    await processUpTo10Users()
    console.log('[CRON] userLevelUpdate done')
  } catch (err) {
    console.error('[CRON] userLevelUpdate error:', err)
  }
}

// 🕒 Run every 1 hour (change to '* * * * *' for 1-min testing)
cron.schedule('*/30 * * * * *', async () => {
  await runJob()
})

module.exports = {runJob}
