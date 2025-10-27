const mongoose = require('mongoose')
const User = require('../models/User')
const Deposit = require('../models/Deposit')
const Withdrawal = require('../models/Withdrawal')

// helper: convert "sort" like "-createdAt,balance" to an object for $sort
function parseSort(sortStr = '-createdAt') {
  const sort = {}
  for (const token of String(sortStr)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)) {
    if (token.startsWith('-')) sort[token.slice(1)] = -1
    else sort[token] = 1
  }
  return sort
}

// ---- Admin: Users list (with ID, name, filters, + teamCount) ----
exports.getUsers = async (req, res) => {
  try {
    const {
      search,
      startDate,
      endDate,
      role,
      status,
      page = 1,
      limit = 20,
      sort = '-createdAt'
    } = req.query

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10)
    const lim = parseInt(limit, 10)

    // base filter: only normal users
    const filter = {role: 'user'}

    // search by id/name/email
    if (search) {
      const idSearch = mongoose.Types.ObjectId.isValid(search)
        ? {_id: new mongoose.Types.ObjectId(search)}
        : null
      filter.$or = [
        idSearch,
        {email: {$regex: search, $options: 'i'}},
        {firstName: {$regex: search, $options: 'i'}},
        {lastName: {$regex: search, $options: 'i'}},
        {fullName: {$regex: search, $options: 'i'}} // if you store it
      ].filter(Boolean)
    }

    // date range
    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate)
      if (endDate) filter.createdAt.$lte = new Date(endDate)
    }

    // optional role override & status
    if (role === 'user' || role === 'admin') filter.role = role
    // ⚙️ Status filter
    if (status === 'active') {
      filter.balance = {$gt: 0} // ✅ active = has balance
    }
    if (status === 'inactive') {
      filter.balance = {$eq: 0} // ✅ inactive = zero balance
    }

    // total count for pagination
    const total = await User.countDocuments(filter)

    // main page results + teamCount in one aggregation
    const users = await User.aggregate([
      {$match: filter},
      {$sort: parseSort(sort)},
      {$skip: skip},
      {$limit: lim},
      {
        $lookup: {
          from: 'users',
          let: {uid: '$_id'},
          pipeline: [
            {$match: {$expr: {$eq: ['$referredBy', '$$uid']}}},
            {$count: 'cnt'}
          ],
          as: 'teamArr'
        }
      },
      {
        $addFields: {
          teamCount: {$ifNull: [{$arrayElemAt: ['$teamArr.cnt', 0]}, 0]}
        }
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          role: 1,
          user_type: 1,
          isActive: 1,
          balance: 1,
          lastLoginAt: 1,
          createdAt: 1,
          teamCount: 1
        }
      }
    ])

    res.json({
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / lim),
      results: users
    })
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}

// ---- Admin: Deposits list with powerful filters ----
exports.getDeposits = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status, // 'Pending' | 'Approved' | 'Declined' or comma-separated e.g. 'Pending,Approved'
      userEmail, // exact or partial
      transactionId, // exact or partial
      minAmount, // number
      maxAmount, // number
      search, // applies to email OR transactionId
      page = 1,
      limit = 20,
      sort = '-createdAt' // e.g. '-amount' or 'amount'
    } = req.query

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10)
    const filter = {}

    // Date window
    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate)
      if (endDate) filter.createdAt.$lte = new Date(endDate)
    }

    // Status filter
    if (status) {
      const allowed = ['Pending', 'Approved', 'Declined']
      const list = String(status)
        .split(',')
        .map(s => s.trim())
        .filter(s => allowed.includes(s))
      if (list.length === 1) filter.status = list[0]
      if (list.length > 1) filter.status = {$in: list}
    }

    // Amount range
    if (minAmount || maxAmount) {
      filter.amount = {}
      if (minAmount) filter.amount.$gte = Number(minAmount)
      if (maxAmount) filter.amount.$lte = Number(maxAmount)
    }

    // Text filters: transactionId and/or userEmail (need user lookup for email)
    const or = []
    if (transactionId) {
      or.push({transactionId: {$regex: String(transactionId), $options: 'i'}})
    }
    // Resolve userEmail and generic search into user id list (if provided)
    let userIdSet = null
    if (userEmail || search) {
      const emailRegex =
        userEmail || search ? new RegExp(userEmail || search, 'i') : null
      if (emailRegex) {
        const users = await User.find({email: emailRegex}).select('_id')
        userIdSet = users.map(u => u._id)
      }
    }
    if (userIdSet && userIdSet.length) {
      or.push({user: {$in: userIdSet}})
    }
    if (search) {
      // also search transactionId with 'search'
      or.push({transactionId: {$regex: String(search), $options: 'i'}})
    }
    if (or.length) {
      filter.$or = or
    }

    const total = await Deposit.countDocuments(filter)
    const results = await Deposit.find(filter)
      .populate('user', 'firstName lastName email role')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))

    res.json({
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      results
    })
  } catch (err) {
    console.error('getDeposits error', err)
    res.status(500).json({message: err.message})
  }
}

// ---- Admin: Withdrawals list (unchanged) ----
exports.getWithdrawals = async (req, res) => {
  try {
    const {startDate, endDate, page = 1, limit = 10} = req.query
    const skip = (page - 1) * limit
    const filter = {}
    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate)
      if (endDate) filter.createdAt.$lte = new Date(endDate)
    }
    const total = await Withdrawal.countDocuments(filter)
    const withdrawals = await Withdrawal.find(filter)
      .populate('user', 'firstName lastName email role balance')
      .sort({createdAt: -1})
      .skip(Number(skip))
      .limit(Number(limit))
    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      results: withdrawals
    })
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}
