const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminMiddleware');
const ctrl = require('../controllers/adminNotificationsController');

router.get('/', protectAdmin, ctrl.list);
router.put('/:id', protectAdmin, ctrl.update);
router.delete('/:id', protectAdmin, ctrl.remove);

module.exports = router;