const mongoose = require('mongoose')
require('dotenv').config()
const User = require('../models/User')
const {v4: uuidv4} = require('uuid')

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/finx'
;(async () => {
  try {
    await mongoose.connect(MONGO)
    const email = 'admin@flareautoearn.com'
    const existing = await User.findOne({email})
    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin'
        await existing.save()
        console.log('Promoted existing user to admin:', email)
      } else {
        console.log('Admin already exists:', email)
      }
    } else {
      const admin = new User({
        firstName: 'System',
        lastName: 'Admin',
        email,
        password: 'flareAHT@642',
        role: 'admin',
        referralCode: uuidv4().split('-')[0]
      })
      await admin.save()
      console.log('Admin created: admin@finx.com / 123456')
    }
    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('Seeder error', err)
    process.exit(1)
  }
})()
