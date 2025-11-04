// src/routes/testRoutes.js
const express = require('express')
const router = express.Router()
const {runJob} = require('../cron/userLevelUpdate')

/**
 * Manual trigger for user level update
 * Protected for safety (use only in dev or admin)
 */
router.post('/run-user-level-update', async (req, res) => {
  try {
    console.log('Manual job run triggered')
    await runJob()
    res.json({message: 'User level update job executed successfully.'})
  } catch (err) {
    console.error('Manual job run error:', err)
    res.status(500).json({message: err.message})
  }
})

module.exports = router
