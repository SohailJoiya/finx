const Notification = require('../models/Notification');
const getPagination = require('../utils/paginate');

exports.list = async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const total = await Notification.countDocuments({});
  const rows = await Notification.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit);
  res.json({ total, page, pages: Math.ceil(total/limit), results: rows });
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { title, message, user } = req.body;
  const note = await Notification.findById(id);
  if (!note) return res.status(404).json({ message: 'Not found' });
  if (title !== undefined) note.title = title;
  if (message !== undefined) note.message = message;
  if (user !== undefined) note.user = user;
  await note.save();
  res.json({ message: 'Updated', note });
};

exports.remove = async (req, res) => {
  await Notification.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
};