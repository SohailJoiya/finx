const cron = require('node-cron')
const mongoose = require('mongoose')
const User = require('../models/User')
const Notification = require('../models/Notification')

// Common match for all downline members
const DOWNLINE_MATCH = {
  balance: {$gte: 35}
}

// If you ALSO want to exclude the root when balance <= 35, set this to true
const EXCLUDE_ROOT_IF_UNDER_35 = false

/**
 * Returns arrays of descendant IDs by depth, respecting 5 business levels with user at Level 5.
 * Shape: [L4, L3, L2, L1] -> up to 4 arrays (children down to great-great-grandchildren)
 * Expansion uses DOWNLINE_MATCH, so only active users with balance > 35 are included.
 */
async function getDownlineIds(rootId, totalLevels = 5) {
  const descendantDepth = Math.max(0, totalLevels - 1) // 4
  const levels = []
  let frontier = [rootId]

  for (let d = 1; d <= descendantDepth; d++) {
    const children = await User.find({
      referredBy: {$in: frontier},
      ...DOWNLINE_MATCH
    })
      .select('_id')
      .lean()

    const ids = children.map(c => c._id)
    levels.push(ids)
    if (!ids.length) break
    frontier = ids
  }

  // levels[0]=L4 (directs), levels[1]=L3, levels[2]=L2, levels[3]=L1
  return levels
}

/**
 * directCount = Level 4 size (with filters)
 * indirectCount = sum(Levels 3 + 2 + 1) (with filters)
 */
async function countMembers(userId) {
  const levels = await getDownlineIds(userId, 5)
  const l4 = levels[0] || []
  const l3 = levels[1] || []
  const l2 = levels[2] || []
  const l1 = levels[3] || []

  const directCount = l4.length
  const indirectCount = l3.length + l2.length + l1.length

  return {directCount, indirectCount}
}

/**
 * totalInvestment = root user (optionally filtered) + all filtered descendants (Levels 4..1)
 * Descendants are filtered by DOWNLINE_MATCH. Root is included by default.
 */
async function getTotalInvestment(user) {
  let includeRoot = true
  if (EXCLUDE_ROOT_IF_UNDER_35 && !((user.balance || 0) > 35)) {
    includeRoot = false
  }

  let total = includeRoot ? user.balance || 0 : 0

  const levels = await getDownlineIds(user._id, 5)
  const allDescendantIds = levels.flat()

  if (allDescendantIds.length) {
    const balances = await User.find({_id: {$in: allDescendantIds}})
      .select('balance')
      .lean()
    for (const d of balances) total += d.balance || 0
  }

  return total
}

/**
 * Only increases level based on totals and counts.
 * (Thresholds unchanged; they now use filtered counts/totals.)
 */
function decideLevel(
  totalInvestment,
  directCount,
  indirectCount,
  currentLevel = 0
) {
  // Debug: show raw numbers + whether each threshold is met

  let target = 0

  if (totalInvestment >= 5000 && directCount >= 20 && indirectCount >= 70) {
    target = 5
  } else if (
    totalInvestment >= 3000 &&
    directCount >= 10 &&
    indirectCount >= 25
  ) {
    target = 4
  } else if (
    totalInvestment >= 1500 &&
    directCount >= 5 &&
    indirectCount >= 15
  ) {
    target = 3
  } else if (totalInvestment >= 500 && directCount >= 3 && indirectCount >= 5) {
    target = 2
  } else if (totalInvestment >= 35 && totalInvestment < 500) {
    target = 1
  } else {
    target = 0
  }

  return target
}

function oneDayFromNow() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000)
}

// ---------- Main job (unchanged except it calls updated helpers) ----------

async function processUpTo10Users() {
  const now = new Date()

  const users = await User.find({
    ...DOWNLINE_MATCH,
    $or: [
      {levelUpdateHoldUntil: {$exists: false}},
      {levelUpdateHoldUntil: {$lte: now}}
    ]
  })
    .select('_id user_level balance')
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
      u.balance,
      directCount,
      indirectCount,
      u.user_level
    )
    if (newLevel != u.user_level) {
      bulkOps.push({
        updateOne: {
          filter: {_id: u._id},
          update: {
            $set: {
              user_level: newLevel,
              levelUpdateHoldUntil: oneDayFromNow()
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
      bulkOps.push({
        updateOne: {
          filter: {_id: u._id},
          update: {$set: {levelUpdateHoldUntil: oneDayFromNow()}}
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

// Every 30s for testing; change to '0 * * * *' for hourly
cron.schedule('*/30 * * * * *', async () => {
  await runJob()
})

module.exports = {runJob}
