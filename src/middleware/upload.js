const multer = require('multer');
const path = require('path');
const fs = require('fs');

const destDir = path.join(__dirname, '../../uploads/deposits');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, destDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowed.includes(ext));
};

module.exports = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });