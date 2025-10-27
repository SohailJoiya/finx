// controllers/team.controller.js
const mongoose = require('mongoose')
const User = require('../models/User')
const Deposit = require('../models/Deposit')

const MAX_LEVELS = 5 // depth in your referral tree

// Tier rules per your spec
const TIER_RULES = {
  1: {min: 35, max: 499, minDirect: 3, minIndirect: 5},
  2: {min: 500, max: 1499, minDirect: 5, minIndirect: 15},
  3: {min: 1500, max: 2999, minDirect: 5, minIndirect: 15},
  4: {min: 3000, max: 4999, minDirect: 10, minIndirect: 25},
  5: {min: 5000, max: null, minDirect: 20, minIndirect: 70}
}

/**
 * GET /api/team/overview
 * Totals across the user's downline (levels 1..5)
 * - Total Team Members
 * - Total Team Investment (sum of Approved deposits)
 * - Active Members (>=1 Approved deposit)
 * - Inactive Members
 */
exports.getTeamOverview = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id)

    const [result] = await User.aggregate([
      {$match: {_id: userId}},

      // Pull descendants up to MAX_LEVELS
      {
        $graphLookup: {
          from: 'users',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'referredBy',
          as: 'downline',
          maxDepth: MAX_LEVELS - 1,
          depthField: 'level' // level: 0..4 means 1..5 later
        }
      },

      // Keep only level 1..5 (exclude self/level - keep level >=0)
      {
        $addFields: {
          downline: {
            $filter: {
              input: '$downline',
              as: 'd',
              cond: {$lte: ['$$d.level', MAX_LEVELS - 1]}
            }
          }
        }
      },

      // Flatten so we can join deposits
      {$unwind: {path: '$downline', preserveNullAndEmptyArrays: true}},

      // Join approved deposits per member
      {
        $lookup: {
          from: 'deposits',
          let: {memberId: '$downline._id'},
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {$eq: ['$user', '$$memberId']},
                    {$eq: ['$status', 'Approved']}
                  ]
                }
              }
            },
            {$group: {_id: null, amount: {$sum: '$amount'}}}
          ],
          as: 'dep'
        }
      },
      {
        $addFields: {
          memberInvestment: {$ifNull: [{$first: '$dep.amount'}, 0]},
          memberActive: {$gt: [{$ifNull: [{$first: '$dep.amount'}, 0]}, 0]}
        }
      },
      // Re-group to root to compute totals
      {
        $group: {
          _id: '$_id',
          totalMembers: {
            $sum: {$cond: [{$ifNull: ['$downline._id', false]}, 1, 0]}
          },
          totalInvestment: {$sum: '$memberInvestment'},
          activeMembers: {$sum: {$cond: ['$memberActive', 1, 0]}}
        }
      },
      {
        $project: {
          _id: 0,
          totalMembers: 1,
          totalInvestment: 1,
          activeMembers: 1,
          inactiveMembers: {$subtract: ['$totalMembers', '$activeMembers']}
        }
      }
    ])

    res.json(
      result || {
        totalMembers: 0,
        totalInvestment: 0,
        activeMembers: 0,
        inactiveMembers: 0
      }
    )
  } catch (err) {
    console.error('getTeamOverview error', err)
    res.status(500).json({message: err.message})
  }
}

/**
 * GET /api/team/levels
 * Returns members per level (1..5) with { _id, name, joinDate, status, investment }
 * Query params:
 *   ?levels=3   // optional, limit depth (default 5)
 */
exports.getTeamLevels = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id)
    const maxLevels =
      Number(req.query.levels) > 0
        ? Math.min(Number(req.query.levels), MAX_LEVELS)
        : MAX_LEVELS

    const tier = Number(req.query.tier) // 1..5 optional
    const rule = TIER_RULES[tier] || null

    const data = await User.aggregate([
      {$match: {_id: userId}},

      // Get descendants up to requested depth
      {
        $graphLookup: {
          from: 'users',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'referredBy',
          as: 'downline',
          maxDepth: maxLevels - 1,
          depthField: 'level'
        }
      },

      // Keep within requested depth
      {
        $project: {
          downline: {
            $filter: {
              input: '$downline',
              as: 'd',
              cond: {$lte: ['$$d.level', maxLevels - 1]}
            }
          }
        }
      },
      {$unwind: {path: '$downline', preserveNullAndEmptyArrays: false}},

      // Sum each member's Approved deposits (their own investment)
      {
        $lookup: {
          from: 'deposits',
          let: {memberId: '$downline._id'},
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {$eq: ['$user', '$$memberId']},
                    {$eq: ['$status', 'Approved']}
                  ]
                }
              }
            },
            {$group: {_id: null, amount: {$sum: '$amount'}}}
          ],
          as: 'dep'
        }
      },
      {
        $addFields: {
          memberInvestment: {$ifNull: [{$first: '$dep.amount'}, 0]},
          memberActive: {$gt: [{$ifNull: [{$first: '$dep.amount'}, 0]}, 0]}
        }
      },

      // Compute each member's own direct & indirect counts
      {
        $project: {
          level: {$add: ['$downline.level', 1]}, // 0.. -> 1..
          member: {
            _id: '$downline._id',
            firstName: '$downline.firstName',
            lastName: '$downline.lastName',
            createdAt: '$downline.createdAt'
          },
          memberInvestment: 1,
          memberActive: 1
        }
      },

      // Pull the member's downline to count direct/indirect
      {
        $graphLookup: {
          from: 'users',
          startWith: '$member._id',
          connectFromField: '_id',
          connectToField: 'referredBy',
          as: 'memberDownline',
          maxDepth: MAX_LEVELS - 1,
          depthField: 'mlevel'
        }
      },
      {
        $addFields: {
          directCount: {
            $size: {
              $filter: {
                input: '$memberDownline',
                as: 'md',
                cond: {$eq: ['$$md.mlevel', 0]} // direct = depth 0 from the member
              }
            }
          },
          indirectCount: {
            $size: {
              $filter: {
                input: '$memberDownline',
                as: 'md',
                cond: {$gt: ['$$md.mlevel', 0]} // indirect = depth >= 1
              }
            }
          }
        }
      },

      // If a tier filter is provided, apply it here
      ...(rule
        ? [
            {
              $match: {
                $and: [
                  // Investment range
                  rule.max === null
                    ? {memberInvestment: {$gte: rule.min}}
                    : {memberInvestment: {$gte: rule.min, $lte: rule.max}},
                  // Min direct & indirect counts
                  {directCount: {$gte: rule.minDirect}},
                  {indirectCount: {$gte: rule.minIndirect}}
                ]
              }
            }
          ]
        : []),

      // Final member shape for response
      {
        $project: {
          level: 1,
          member: {
            _id: '$member._id',
            name: {
              $concat: [
                {$ifNull: ['$member.firstName', '']},
                ' ',
                {$ifNull: ['$member.lastName', '']}
              ]
            },
            joinDate: '$member.createdAt',
            status: {$cond: ['$memberActive', 'Active', 'Inactive']},
            investment: '$memberInvestment',
            directCount: '$directCount',
            indirectCount: '$indirectCount'
          }
        }
      },

      // Group back by tree level (Level 1..N)
      {
        $group: {
          _id: '$level',
          members: {$push: '$member'},
          count: {$sum: 1},
          investment: {$sum: '$member.investment'},
          active: {$sum: {$cond: [{$eq: ['$member.status', 'Active']}, 1, 0]}}
        }
      },
      {$sort: {_id: 1}}
    ])

    // Normalize to always return levels 1..maxLevels (even if empty)
    const levels = {}
    for (let i = 1; i <= maxLevels; i++) {
      const found = data.find(d => d._id === i)
      levels[i] = {
        members: found?.members || [],
        stats: {
          count: found?.count || 0,
          investment: found?.investment || 0,
          active: found?.active || 0,
          inactive: (found?.count || 0) - (found?.active || 0)
        }
      }
    }

    res.json({levels, appliedTier: rule ? tier : null})
  } catch (err) {
    console.error('getTeamLevels error', err)
    res.status(500).json({message: err.message})
  }
}

exports.listReferredUsers = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id)

    // pagination + sorting
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100
    )
    const sortField = req.query.sort || 'createdAt'
    const sortOrder = req.query.order === 'asc' ? 1 : -1
    const withStats = req.query.withStats === '1'

    const match = {referredBy: userId}

    if (!withStats) {
      // simple, fast query
      const [total, users] = await Promise.all([
        User.countDocuments(match),
        User.find(match)
          .sort({[sortField]: sortOrder})
          .skip((page - 1) * limit)
          .limit(limit)
          .select('_id firstName lastName email createdAt balance')
          .lean()
      ])

      return res.json({
        data: users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasPrev: page > 1,
          hasNext: page * limit < total
        }
      })
    }

    // withStats: include each referral's total approved deposits + active flag
    const Deposit = require('../models/Deposit')
    const skip = (page - 1) * limit

    const results = await User.aggregate([
      {$match: match},
      {
        $lookup: {
          from: 'deposits',
          let: {uid: '$_id'},
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {$eq: ['$user', '$$uid']},
                    {$eq: ['$status', 'Approved']}
                  ]
                }
              }
            },
            {$group: {_id: null, amount: {$sum: '$amount'}}}
          ],
          as: 'dep'
        }
      },
      {
        $addFields: {
          totalInvestment: {$ifNull: [{$first: '$dep.amount'}, 0]},
          active: {$gt: [{$ifNull: [{$first: '$dep.amount'}, 0]}, 0]}
        }
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          createdAt: 1,
          balance: 1,
          totalInvestment: 1,
          active: 1
        }
      },
      {$sort: {[sortField]: sortOrder}},
      {
        $facet: {
          data: [{$skip: skip}, {$limit: limit}],
          count: [{$count: 'total'}]
        }
      }
    ])

    const data = results[0]?.data || []
    const total = results[0]?.count?.[0]?.total || 0

    return res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasPrev: page > 1,
        hasNext: page * limit < total
      }
    })
  } catch (err) {
    console.error('listReferredUsers error', err)
    res.status(500).json({message: err.message})
  }
}
