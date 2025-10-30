const Notification = require('../models/Notification')

exports.listUserNotifications = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '10', 10), 50)
  const userId = req.user._id
  if (req.user.role == 'admin') {
    const notes = await Notification.find({user: userId, isRead: false})
      .sort({createdAt: -1})
      .limit(limit)

    return res.json(notes)
  } else if (req.user.role == 'user') {
    const notes = await Notification.find({
      $or: [{user: userId}, {user: null}]
    }).sort({createdAt: -1})
    res.json(notes)
  }
}

exports.markAsRead = async (req, res) => {
  try {
    console
    const note = await Notification.findOne({
      _id: req.params.id
    })
    if (!note) return res.status(404).json({message: 'Notification not found'})
    note.isRead = true
    await note.save()
    res.json({message: 'Marked as read', note})
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}

exports.createGlobalNotification = async (req, res) => {
  try {
    const {title, message} = req.body
    if (!title || !message)
      return res.status(400).json({message: 'Title & message required'})
    const notif = await Notification.create({user: null, title, message})
    res.status(201).json({notif})
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}

exports.createNotificationForUser = async (req, res) => {
  try {
    const {userId, title, message} = req.body
    if (!userId || !title || !message)
      return res.status(400).json({message: 'Missing fields'})
    const notif = await Notification.create({user: userId, title, message})
    res.status(201).json({notif})
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}

exports.listRecent = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '10', 10), 50)
  const userId = req.user._id
  if (req.user.role == 'admin') {
    const notes = await Notification.find({user: userId, isRead: false})
      .sort({createdAt: -1})
      .limit(limit)

    return res.json(notes)
  } else if (req.user.role == 'user') {
    const notes = await Notification.find({$or: [{user: userId}, {user: null}]})
      .sort({createdAt: -1})
      .limit(limit)
    return res.json(notes)
  }
}
