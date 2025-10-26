const { verifyToken } = require('../config/jwt');
const User = require('../models/User');

exports.protectAdmin = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'No token' });
    const token = auth.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ message: 'Invalid token' });
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });
    req.admin = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};